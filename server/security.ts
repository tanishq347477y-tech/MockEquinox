import { and, eq, sql } from "drizzle-orm";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { rateLimitBuckets } from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";

function fixedTimeEquals(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function verifyRazorpayPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}) {
  const expected = createHmac("sha256", input.keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  return fixedTimeEquals(input.signature, expected);
}

export function verifyRazorpayWebhookSignature(input: {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}) {
  const expected = createHmac("sha256", input.webhookSecret)
    .update(input.rawBody)
    .digest("hex");
  return fixedTimeEquals(input.signature, expected);
}

type WindowState = { count: number; resetAt: number };

/**
 * Development-safe guard. In production, replace this process-local store with a
 * shared Redis/edge store so rate-limit windows stay consistent across replicas.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const windows = new Map<string, WindowState>();
  return (key: string, now = Date.now()) => {
    const current = windows.get(key);
    if (!current || current.resetAt <= now) {
      const next = { count: 1, resetAt: now + windowMs };
      windows.set(key, next);
      return { allowed: true, remaining: limit - 1, resetAt: next.resetAt };
    }
    current.count += 1;
    return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
  };
}

type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };
type RateLimitDependencies = { getDb: typeof getDb; isProduction: () => boolean };

/**
 * Shared fixed-window limiter for request paths that can be served by multiple
 * autoscaling replicas. The persisted key is hashed so user IDs and IP values
 * are not stored as raw operational data.
 */
export function createSharedRateLimiter(limit: number, windowMs: number, dependencies: RateLimitDependencies = { getDb, isProduction: () => ENV.isProduction }) {
  const developmentFallback = createRateLimiter(limit, windowMs);
  return async (key: string, now = Date.now()): Promise<RateLimitResult> => {
    const windowStartMs = Math.floor(now / windowMs) * windowMs;
    const resetAt = windowStartMs + windowMs;
    if (!dependencies.isProduction()) return developmentFallback(key, now);
    const limitKey = createHash("sha256").update(key).digest("hex");
    try {
      const db = await dependencies.getDb();
      if (!db) {
        return { allowed: false, remaining: 0, resetAt };
      }
      const windowStartedAt = new Date(windowStartMs);
      await db.insert(rateLimitBuckets).values({ limitKey, windowStartedAt, requestCount: 1 }).onDuplicateKeyUpdate({
        set: { requestCount: sql`${rateLimitBuckets.requestCount} + 1`, updatedAt: new Date() },
      });
      const [bucket] = await db.select({ requestCount: rateLimitBuckets.requestCount })
        .from(rateLimitBuckets)
        .where(and(eq(rateLimitBuckets.limitKey, limitKey), eq(rateLimitBuckets.windowStartedAt, windowStartedAt)))
        .limit(1);
      const count = bucket?.requestCount ?? limit + 1;
      return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt };
    } catch (error) {
      console.error("[RateLimit] Shared limiter persistence failed", error);
      return { allowed: false, remaining: 0, resetAt };
    }
  };
}
