import { describe, expect, it } from "vitest";
import { getRazorpayConfig } from "./razorpayConfig";
import { createPaymentIdempotencyKey } from "./razorpayOrders";

describe("Razorpay configuration boundary", () => {
  it("fails closed when any required server-only payment secret is absent", () => {
    expect(getRazorpayConfig({ RAZORPAY_KEY_ID: "key" })).toBeNull();
    expect(getRazorpayConfig({
      RAZORPAY_KEY_ID: "key",
      RAZORPAY_KEY_SECRET: "secret",
      RAZORPAY_WEBHOOK_SECRET: "webhook",
    })).toEqual({ keyId: "key", keySecret: "secret", webhookSecret: "webhook" });
  });

  it("keeps checkout disabled when placeholder production variables are present", () => {
    expect(getRazorpayConfig({
      RAZORPAY_KEY_ID: "rzp_test_replace_in_production",
      RAZORPAY_KEY_SECRET: "replace_in_production",
      RAZORPAY_WEBHOOK_SECRET: "replace_in_production",
    })).toBeNull();
  });

  it("generates unique opaque idempotency keys for every server-created payment", () => {
    expect(createPaymentIdempotencyKey()).not.toBe(createPaymentIdempotencyKey());
  });
});
