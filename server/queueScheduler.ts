import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { claimQueueWorkerRun, releaseQueueWorkerRun } from "./db";
import { runPdfQueueBatch } from "./pdfQueueWorker";
import { ENV } from "./_core/env";

export async function runScheduledPdfQueue(req: Request, res: Response) {
  const taskUid = "external-cron";
  let workerToken = "";
  try {
    if (!ENV.cronSecret || req.header("x-cron-secret") !== ENV.cronSecret) return res.status(403).json({ error: "cron-only" });
    workerToken = randomUUID();
    const claim = await claimQueueWorkerRun({ taskUid, workerToken });
    if (claim.status !== "claimed") return res.json({ ok: true, skipped: claim.status });
    try {
      const result = await runPdfQueueBatch({ maxJobs: Math.min(claim.schedule.batchSize, 1), workerToken: `cron-${workerToken}` });
      return res.json({ ok: true, processed: result.outcomes.length, outcomes: result.outcomes });
    } finally {
      await releaseQueueWorkerRun({ taskUid, workerToken });
    }
  } catch (error) {
    console.error("[Queue] Scheduled PDF batch failed", error);
    return res.status(500).json({ error: "PDF queue batch failed.", context: { taskUid }, timestamp: new Date().toISOString() });
  }
}
