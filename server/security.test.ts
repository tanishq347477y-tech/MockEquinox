import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRateLimiter, createSharedRateLimiter, verifyRazorpayPaymentSignature, verifyRazorpayWebhookSignature } from "./security";

describe("payment verification guards", () => {
  it("accepts a correctly signed Razorpay-style payment and rejects tampering", () => {
    const keySecret = "unit-test-key";
    const orderId = "order_test_01";
    const paymentId = "pay_test_01";
    const signature = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");

    expect(verifyRazorpayPaymentSignature({ orderId, paymentId, signature, keySecret })).toBe(true);
    expect(verifyRazorpayPaymentSignature({ orderId, paymentId: "pay_tampered", signature, keySecret })).toBe(false);
  });

  it("requires a valid raw-body webhook signature", () => {
    const rawBody = '{"event":"payment.captured"}';
    const webhookSecret = "webhook-test-secret";
    const signature = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

    expect(verifyRazorpayWebhookSignature({ rawBody, webhookSecret, signature })).toBe(true);
    expect(verifyRazorpayWebhookSignature({ rawBody: `${rawBody} `, webhookSecret, signature })).toBe(false);
  });
});

describe("createRateLimiter", () => {
  it("blocks requests that exceed the configured window", () => {
    const limit = createRateLimiter(2, 60_000);
    expect(limit("student:1", 10).allowed).toBe(true);
    expect(limit("student:1", 11).allowed).toBe(true);
    expect(limit("student:1", 12).allowed).toBe(false);
    expect(limit("student:1", 70_020).allowed).toBe(true);
  });
});

describe("createSharedRateLimiter", () => {
  it("uses a development fallback but fails closed when production persistence is unavailable", async () => {
    const developmentLimit = createSharedRateLimiter(1, 60_000, { getDb: async () => null, isProduction: () => false });
    await expect(developmentLimit("student:1", 10)).resolves.toMatchObject({ allowed: true, remaining: 0 });
    await expect(developmentLimit("student:1", 11)).resolves.toMatchObject({ allowed: false, remaining: 0 });

    const productionLimit = createSharedRateLimiter(1, 60_000, { getDb: async () => null, isProduction: () => true });
    await expect(productionLimit("student:1", 10)).resolves.toMatchObject({ allowed: false, remaining: 0 });
  });
});
