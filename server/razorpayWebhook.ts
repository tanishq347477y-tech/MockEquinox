import type { Express, Request, Response } from "express";
import express from "express";
import { recordPaymentWebhookEvent } from "./db";
import { getRazorpayConfig } from "./razorpayConfig";
import { createSharedRateLimiter, verifyRazorpayWebhookSignature } from "./security";

const webhookRateLimit = createSharedRateLimiter(120, 60_000);

export function registerRazorpayWebhook(app: Express) {
  app.post("/api/webhooks/razorpay", express.raw({ type: "application/json", limit: "2mb" }), async (req: Request, res: Response) => {
    const requestKey = req.ip || req.socket.remoteAddress || "unknown";
    if (!(await webhookRateLimit(`razorpay-webhook:${requestKey}`)).allowed) {
      return res.status(429).json({ error: "Webhook request limit exceeded." });
    }
    const config = getRazorpayConfig();
    if (!config) {
      return res.status(503).json({ error: "Razorpay is not configured." });
    }

    const signature = req.header("x-razorpay-signature");
    const eventId = req.header("x-razorpay-event-id");
    if (!signature || !eventId || !Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: "Missing Razorpay webhook signature, event ID, or raw body." });
    }

    const rawBody = req.body.toString("utf8");
    if (!verifyRazorpayWebhookSignature({ rawBody, signature, webhookSecret: config.webhookSecret })) {
      return res.status(401).json({ error: "Invalid Razorpay webhook signature." });
    }

    let payload: { event?: string } & Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as { event?: string } & Record<string, unknown>;
    } catch {
      return res.status(400).json({ error: "Malformed Razorpay webhook payload." });
    }
    if (typeof payload.event !== "string" || payload.event.length === 0 || payload.event.length > 128) {
      return res.status(400).json({ error: "Malformed Razorpay webhook event." });
    }

    try {
      const accepted = await recordPaymentWebhookEvent({ eventId, eventType: payload.event ?? "unknown", payload });
      return res.status(accepted ? 202 : 200).json({ accepted, duplicate: !accepted });
    } catch (error) {
      console.error("[Razorpay] Failed to persist webhook event", error);
      return res.status(500).json({ error: "Webhook persistence failed." });
    }
  });
}
