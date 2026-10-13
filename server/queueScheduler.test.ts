import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ claimQueueWorkerRun: vi.fn(), releaseQueueWorkerRun: vi.fn(), runPdfQueueBatch: vi.fn() }));
vi.mock("./_core/env", () => ({ ENV: { cronSecret: "test-cron-secret" } }));
vi.mock("./db", () => ({ claimQueueWorkerRun: mocks.claimQueueWorkerRun, releaseQueueWorkerRun: mocks.releaseQueueWorkerRun }));
vi.mock("./pdfQueueWorker", () => ({ runPdfQueueBatch: mocks.runPdfQueueBatch }));

import { runScheduledPdfQueue } from "./queueScheduler";

function response() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json } as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function request(secret?: string) {
  return { header: vi.fn().mockReturnValue(secret) } as unknown as Request;
}

describe("scheduled durable PDF queue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects callers without the external cron secret and skips overlapping worker executions", async () => {
    const unauthenticated = response();
    await runScheduledPdfQueue(request(), unauthenticated);
    expect(unauthenticated.status).toHaveBeenCalledWith(403);

    mocks.claimQueueWorkerRun.mockResolvedValue({ status: "busy" });
    const busy = response();
    await runScheduledPdfQueue(request("test-cron-secret"), busy);
    expect(busy.json).toHaveBeenCalledWith({ ok: true, skipped: "busy" });
    expect(mocks.runPdfQueueBatch).not.toHaveBeenCalled();
  });

  it("runs one bounded batch only after the external scheduler presents its shared secret", async () => {
    mocks.claimQueueWorkerRun.mockResolvedValue({ status: "claimed", schedule: { batchSize: 1 } });
    mocks.runPdfQueueBatch.mockResolvedValue({ outcomes: [{ jobId: 17, state: "completed" }] });
    const res = response();
    await runScheduledPdfQueue(request("test-cron-secret"), res);
    expect(mocks.runPdfQueueBatch).toHaveBeenCalledWith(expect.objectContaining({ maxJobs: 1, workerToken: expect.stringMatching(/^cron-/) }));
    expect(mocks.releaseQueueWorkerRun).toHaveBeenCalledWith(expect.objectContaining({ taskUid: "external-cron" }));
    expect(res.json).toHaveBeenCalledWith({ ok: true, processed: 1, outcomes: [{ jobId: 17, state: "completed" }] });
  });
});
