/**
 * Portable server configuration. All values are read only from the runtime
 * environment; browser bundles never import this module.
 */
export type RuntimeConfig = {
  appOrigin: string;
  corsOrigins: string[];
  cronSecret: string;
  databaseUrl: string;
  emailApiKey: string;
  emailFrom: string;
  emailProviderUrl: string;
  googleOAuthCallbackUrl: string;
  googleOAuthClientId: string;
  googleOAuthClientSecret: string;
  isProduction: boolean;
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
  llmPdfModel: string;
  llmProvider: string;
  ownerEmail: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  sessionSecret: string;
  stagingAiTestMode: boolean;
  s3AccessKeyId: string;
  s3Bucket: string;
  s3Endpoint: string;
  s3ForcePathStyle: boolean;
  s3PublicBaseUrl: string;
  s3Region: string;
  s3SecretAccessKey: string;
};

type Environment = Record<string, string | undefined>;

const read = (environment: Environment, key: string) =>
  environment[key]?.trim() ?? "";

export function createRuntimeConfig(
  environment: Environment = process.env
): RuntimeConfig {
  return {
    appOrigin: read(environment, "APP_ORIGIN") || "http://localhost:3000",
    corsOrigins: read(environment, "CORS_ORIGINS")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean),
    cronSecret: read(environment, "CRON_SECRET"),
    databaseUrl: read(environment, "DATABASE_URL"),
    emailApiKey: read(environment, "EMAIL_API_KEY"),
    emailFrom: read(environment, "EMAIL_FROM"),
    emailProviderUrl: read(environment, "EMAIL_PROVIDER_URL").replace(
      /\/+$/,
      ""
    ),
    googleOAuthCallbackUrl: read(environment, "GOOGLE_OAUTH_CALLBACK_URL"),
    googleOAuthClientId: read(environment, "GOOGLE_OAUTH_CLIENT_ID"),
    googleOAuthClientSecret: read(environment, "GOOGLE_OAUTH_CLIENT_SECRET"),
    isProduction: read(environment, "NODE_ENV") === "production",
    llmApiKey: read(environment, "LLM_API_KEY"),
    llmBaseUrl: (
      read(environment, "LLM_BASE_URL") || "https://api.openai.com/v1"
    ).replace(/\/+$/, ""),
    llmModel: read(environment, "LLM_MODEL") || "gpt-4o-mini",
    llmPdfModel:
      read(environment, "LLM_PDF_MODEL") ||
      read(environment, "LLM_MODEL") ||
      "gpt-4o-mini",
    llmProvider: read(environment, "LLM_PROVIDER") || "openai-compatible",
    ownerEmail: read(environment, "OWNER_EMAIL").toLowerCase(),
    razorpayKeyId: read(environment, "RAZORPAY_KEY_ID"),
    razorpayKeySecret: read(environment, "RAZORPAY_KEY_SECRET"),
    razorpayWebhookSecret: read(environment, "RAZORPAY_WEBHOOK_SECRET"),
    sessionSecret: read(environment, "SESSION_SECRET"),
    stagingAiTestMode:
      read(environment, "STAGING_AI_TEST_MODE").toLowerCase() === "true",
    s3AccessKeyId: read(environment, "S3_ACCESS_KEY_ID"),
    s3Bucket: read(environment, "S3_BUCKET"),
    s3Endpoint: read(environment, "S3_ENDPOINT").replace(/\/+$/, ""),
    s3ForcePathStyle:
      read(environment, "S3_FORCE_PATH_STYLE").toLowerCase() === "true",
    s3PublicBaseUrl: read(environment, "S3_PUBLIC_BASE_URL").replace(
      /\/+$/,
      ""
    ),
    s3Region: read(environment, "S3_REGION") || "us-east-1",
    s3SecretAccessKey: read(environment, "S3_SECRET_ACCESS_KEY"),
  };
}

export function missingProductionConfiguration(
  config: RuntimeConfig = createRuntimeConfig()
) {
  const required: Array<[keyof RuntimeConfig, string]> = [
    ["databaseUrl", "DATABASE_URL"],
    ["sessionSecret", "SESSION_SECRET"],
    ["ownerEmail", "OWNER_EMAIL"],
  ];
  const missing = required
    .filter(([key]) => !config[key])
    .map(([, variable]) => variable);
  if (config.sessionSecret && config.sessionSecret.length < 32)
    missing.push("SESSION_SECRET (at least 32 characters)");
  return missing;
}
