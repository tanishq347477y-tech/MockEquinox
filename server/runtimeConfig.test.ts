import { describe, expect, it } from "vitest";
import {
  createRuntimeConfig,
  missingProductionConfiguration,
} from "./runtimeConfig";

describe("portable runtime configuration", () => {
  it("uses server-only configuration and reports the minimum production requirements", () => {
    const production = createRuntimeConfig({
      NODE_ENV: "production",
      DATABASE_URL: "mysql://db",
      SESSION_SECRET:
        "a-session-secret-that-is-longer-than-thirty-two-characters",
      OWNER_EMAIL: "OWNER@EXAMPLE.COM",
      CORS_ORIGINS: "https://app.example.com, https://admin.example.com",
    });
    expect(production.ownerEmail).toBe("owner@example.com");
    expect(production.corsOrigins).toEqual([
      "https://app.example.com",
      "https://admin.example.com",
    ]);
    expect(missingProductionConfiguration(production)).toEqual([]);
  });

  it("does not treat payment, AI, object storage, or cron credentials as browser configuration", () => {
    const local = createRuntimeConfig({});
    expect(local.razorpayKeySecret).toBe("");
    expect(local.llmApiKey).toBe("");
    expect(local.s3SecretAccessKey).toBe("");
    expect(local.cronSecret).toBe("");
    expect(local.stagingAiTestMode).toBe(false);
    expect(
      createRuntimeConfig({ NODE_ENV: "staging", STAGING_AI_TEST_MODE: "true" })
        .stagingAiTestMode
    ).toBe(true);
  });
});
