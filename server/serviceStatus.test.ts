import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { getConfiguredServiceStatuses } from "./serviceStatus";

describe("owner service status", () => {
  const original = {
    emailProviderUrl: ENV.emailProviderUrl,
    emailApiKey: ENV.emailApiKey,
    emailFrom: ENV.emailFrom,
    llmApiKey: ENV.llmApiKey,
    s3Bucket: ENV.s3Bucket,
    s3AccessKeyId: ENV.s3AccessKeyId,
    s3SecretAccessKey: ENV.s3SecretAccessKey,
    razorpayKeyId: ENV.razorpayKeyId,
    razorpayKeySecret: ENV.razorpayKeySecret,
    razorpayWebhookSecret: ENV.razorpayWebhookSecret,
  };

  afterEach(() => {
    Object.assign(ENV, original);
  });

  it("reports configuration without returning secrets or creating side effects", () => {
    Object.assign(ENV, {
      emailProviderUrl: "https://email.example/v1",
      emailApiKey: "email-secret",
      emailFrom: "MockE <no-reply@example.com>",
      llmApiKey: "llm-secret",
      s3Bucket: "private-bucket",
      s3AccessKeyId: "access-key",
      s3SecretAccessKey: "storage-secret",
      razorpayKeyId: "rzp_test_key",
      razorpayKeySecret: "razor-secret",
      razorpayWebhookSecret: "webhook-secret",
    });

    const statuses = getConfiguredServiceStatuses();
    expect(statuses.map(item => item.key)).toEqual([
      "email",
      "razorpay",
      "s3",
      "ai",
    ]);
    expect(
      statuses.every(item => !JSON.stringify(item).includes("secret"))
    ).toBe(true);
    expect(statuses.find(item => item.key === "email")?.detail).toContain(
      "email.example"
    );
  });
});
