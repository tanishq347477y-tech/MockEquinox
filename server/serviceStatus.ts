import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { ENV } from "./_core/env";
import { getEmailServiceStatus, isEmailDeliveryConfigured } from "./email";
import { getRazorpayConfig } from "./razorpayConfig";

export type ServiceState = "ready" | "not_configured" | "degraded";
export type ServiceStatus = {
  key: "razorpay" | "s3" | "ai" | "email";
  label: string;
  state: ServiceState;
  detail: string;
  checkedAt: string;
  latencyMs?: number;
};

function checkedAt() {
  return new Date().toISOString();
}

function status(
  key: ServiceStatus["key"],
  label: string,
  state: ServiceState,
  detail: string,
  latencyMs?: number
): ServiceStatus {
  return {
    key,
    label,
    state,
    detail,
    checkedAt: checkedAt(),
    ...(latencyMs === undefined ? {} : { latencyMs }),
  };
}

async function probeRazorpay(): Promise<ServiceStatus> {
  const config = getRazorpayConfig();
  if (!config)
    return status(
      "razorpay",
      "Razorpay",
      "not_configured",
      "Checkout is fail-closed until all server-only Razorpay variables are set."
    );
  const started = Date.now();
  try {
    const response = await fetch("https://api.razorpay.com/v1/orders?count=1", {
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`,
      },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok)
      return status(
        "razorpay",
        "Razorpay",
        "degraded",
        `Provider returned HTTP ${response.status}; no order was created.`,
        Date.now() - started
      );
    return status(
      "razorpay",
      "Razorpay",
      "ready",
      "Credentials accepted by the provider; no charge or order was created.",
      Date.now() - started
    );
  } catch {
    return status(
      "razorpay",
      "Razorpay",
      "degraded",
      "The provider could not be reached from the server.",
      Date.now() - started
    );
  }
}

async function probeS3(): Promise<ServiceStatus> {
  if (!ENV.s3Bucket || !ENV.s3AccessKeyId || !ENV.s3SecretAccessKey)
    return status(
      "s3",
      "Private storage",
      "not_configured",
      "PDF intake stays disabled until bucket credentials are configured."
    );
  const started = Date.now();
  try {
    const client = new S3Client({
      region: ENV.s3Region,
      endpoint: ENV.s3Endpoint || undefined,
      forcePathStyle: ENV.s3ForcePathStyle,
      credentials: {
        accessKeyId: ENV.s3AccessKeyId,
        secretAccessKey: ENV.s3SecretAccessKey,
      },
    });
    await client.send(new HeadBucketCommand({ Bucket: ENV.s3Bucket }));
    return status(
      "s3",
      "Private storage",
      "ready",
      "The configured bucket is reachable; probe did not write an object.",
      Date.now() - started
    );
  } catch {
    return status(
      "s3",
      "Private storage",
      "degraded",
      "The configured bucket could not be reached or authorized.",
      Date.now() - started
    );
  }
}

async function probeAi(): Promise<ServiceStatus> {
  if (!ENV.llmApiKey)
    return status(
      "ai",
      "AI extraction",
      "not_configured",
      "AI review jobs remain queued until an LLM_API_KEY is configured."
    );
  const started = Date.now();
  try {
    const response = await fetch(`${ENV.llmBaseUrl}/models`, {
      headers: { Authorization: `Bearer ${ENV.llmApiKey}` },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok)
      return status(
        "ai",
        "AI extraction",
        "degraded",
        `Provider returned HTTP ${response.status}; no prompt was sent.`,
        Date.now() - started
      );
    return status(
      "ai",
      "AI extraction",
      "ready",
      `The OpenAI-compatible endpoint responded for ${ENV.llmModel}.`,
      Date.now() - started
    );
  } catch {
    return status(
      "ai",
      "AI extraction",
      "degraded",
      "The configured AI endpoint could not be reached from the server.",
      Date.now() - started
    );
  }
}

function probeEmail(): ServiceStatus {
  const service = getEmailServiceStatus();
  return service.configured
    ? status(
        "email",
        "Transactional email",
        "ready",
        `Verification and reset messages use ${service.provider}.`
      )
    : status(
        "email",
        "Transactional email",
        "not_configured",
        "Account verification and reset delivery require EMAIL_PROVIDER_URL, EMAIL_API_KEY, and EMAIL_FROM."
      );
}

export function getConfiguredServiceStatuses() {
  return [
    probeEmail(),
    status(
      "razorpay",
      "Razorpay",
      getRazorpayConfig() ? "ready" : "not_configured",
      getRazorpayConfig()
        ? "Server-only payment credentials are present; use probe to verify the provider."
        : "Checkout is fail-closed until all server-only Razorpay variables are set."
    ),
    status(
      "s3",
      "Private storage",
      ENV.s3Bucket && ENV.s3AccessKeyId && ENV.s3SecretAccessKey
        ? "ready"
        : "not_configured",
      ENV.s3Bucket && ENV.s3AccessKeyId && ENV.s3SecretAccessKey
        ? "Bucket credentials are present; use probe to verify access."
        : "PDF intake stays disabled until bucket credentials are configured."
    ),
    status(
      "ai",
      "AI extraction",
      ENV.llmApiKey ? "ready" : "not_configured",
      ENV.llmApiKey
        ? `AI credentials are present for ${ENV.llmModel}; use probe to verify the endpoint.`
        : "AI review jobs remain queued until an LLM_API_KEY is configured."
    ),
  ];
}

export async function probeExternalServices() {
  const results = await Promise.all([probeRazorpay(), probeS3(), probeAi()]);
  return [probeEmail(), ...results];
}
