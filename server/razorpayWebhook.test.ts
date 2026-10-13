import { createHmac } from "node:crypto";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ recordPaymentWebhookEvent: vi.fn() }));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), recordPaymentWebhookEvent: mocks.recordPaymentWebhookEvent }));
vi.mock("./razorpayConfig", () => ({ getRazorpayConfig: () => ({ keyId: "key", keySecret: "secret", webhookSecret: "webhook-security-test" }) }));

import { registerRazorpayWebhook } from "./razorpayWebhook";

describe("Razorpay webhook validation", () => {
  const servers: Array<ReturnType<express.Express["listen"]>> = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
    mocks.recordPaymentWebhookEvent.mockReset();
  });

  it("rejects a correctly signed payload that has an invalid event shape before persistence", async () => {
    const rawBody = JSON.stringify({ event: "" });
    const signature = createHmac("sha256", "webhook-security-test").update(rawBody).digest("hex");
    const app = express();
    registerRazorpayWebhook(app);
    const server = app.listen(0);
    servers.push(server);
    await new Promise<void>(resolve => server.once("listening", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/webhooks/razorpay`, { method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": signature, "x-razorpay-event-id": "evt_security_test" }, body: rawBody });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Malformed Razorpay webhook event." });
    expect(mocks.recordPaymentWebhookEvent).not.toHaveBeenCalled();
  });

  it("returns 429 after repeated signed webhook deliveries from the same source", async () => {
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const signature = createHmac("sha256", "webhook-security-test").update(rawBody).digest("hex");
    mocks.recordPaymentWebhookEvent.mockResolvedValue(true);
    const app = express();
    registerRazorpayWebhook(app);
    const server = app.listen(0);
    servers.push(server);
    await new Promise<void>(resolve => server.once("listening", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
    const url = `http://127.0.0.1:${address.port}/api/webhooks/razorpay`;
    for (let attempt = 0; attempt < 121; attempt += 1) {
      await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": signature, "x-razorpay-event-id": `evt_rate_${attempt}` }, body: rawBody });
    }
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": signature, "x-razorpay-event-id": "evt_rate_final" }, body: rawBody });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "Webhook request limit exceeded." });
  });
});
