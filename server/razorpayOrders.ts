import { randomUUID } from "node:crypto";
import { getRazorpayConfig } from "./razorpayConfig";

export type RazorpayOrder = { id: string; amount: number; currency: string; receipt?: string; status: string };

export async function createRazorpayOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }) {
  const config = getRazorpayConfig();
  if (!config) throw new Error("Razorpay checkout is disabled until production variables are supplied.");
  const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: input.amountPaise, currency: "INR", receipt: input.receipt, notes: input.notes }),
  });
  if (!response.ok) throw new Error(`Razorpay order creation failed (${response.status}).`);
  return (await response.json()) as RazorpayOrder;
}

export function createPaymentIdempotencyKey() {
  return randomUUID();
}
