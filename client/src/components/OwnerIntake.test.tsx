// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ importJson: vi.fn(), processPdf: vi.fn(), queueRetry: vi.fn(), queueJobs: [] as Array<Record<string, unknown>>, toastSuccess: vi.fn(), toastError: vi.fn(), refetch: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    ownerConsole: {
      content: { references: { useQuery: () => ({ isLoading: false, isError: false, data: { exams: [{ id: 1, name: "JEE Main" }], subjects: [{ id: 2, examId: 1, name: "Physics" }], topics: [{ id: 3, subjectId: 2, name: "Kinematics" }] } }) } },
      intake: {
        processPdf: { useMutation: () => ({ isPending: false, mutate: mocks.processPdf }) },
        importJson: { useMutation: () => ({ isPending: false, mutate: mocks.importJson }) },
      },
      queue: {
        status: { useQuery: () => ({ data: null, refetch: mocks.refetch }) },
        list: { useQuery: () => ({ data: mocks.queueJobs, isLoading: false, error: null, refetch: mocks.refetch }) },
        schedule: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
        setEnabled: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
        retry: { useMutation: () => ({ isPending: false, mutate: mocks.queueRetry }) },
      },
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import { OwnerIntakePanel } from "./OwnerIntake";

describe("Owner source intake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queueJobs = [];
    mocks.processPdf.mockImplementation((_input: unknown, options: { onSuccess?: (output: unknown) => void }) => options.onSuccess?.({ documentId: 7, jobId: 17, status: "queued", storageUrl: "/manus-storage/owner-imports/source.pdf", sourceLabel: "AI PDF import · source.pdf" }));
    mocks.importJson.mockImplementation((_input: unknown, options: { onSuccess?: (output: unknown) => void }) => options.onSuccess?.({ sourceLabel: "Structured JSON import · structured-question-import.json", processed: 1, created: 1, duplicates: 0, drafts: [{ questionId: 88, qualityScore: 92, duplicate: false, stem: "Which review state prevents immediate learner access?", options: ["Published", "Needs review", "Archived", "Attempted"], correctIndex: 1, explanation: "Imported content must be reviewed before publication." }] }));
  });

  it("validates and imports structured questions into a visible review summary", async () => {
    const user = userEvent.setup();
    render(<OwnerIntakePanel />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0], "1");
    await user.selectOptions(selects[1], "2");
    await user.selectOptions(selects[2], "3");
    await user.click(screen.getByRole("button", { name: "Load JSON template" }));
    await user.click(screen.getByRole("button", { name: "Validate and create review drafts" }));
    expect(mocks.importJson).toHaveBeenCalledWith(expect.objectContaining({ examId: 1, subjectId: 2, topicId: 3, questions: expect.any(Array) }), expect.any(Object));
    expect(await screen.findByText(/Generated question paper/i)).toBeTruthy();
    expect(screen.getByText(/1 new drafts, 0 duplicates withheld/i)).toBeTruthy();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("1 review drafts imported");
  });

  it("submits a PDF as a durable queued job instead of waiting for AI extraction", async () => {
    const user = userEvent.setup();
    const { container } = render(<OwnerIntakePanel />);
    const panel = within(container);
    const selects = panel.getAllByRole("combobox");
    await user.selectOptions(selects[0], "1");
    await user.selectOptions(selects[1], "2");
    await user.selectOptions(selects[2], "3");
    const file = new File(["%PDF-1.7 queued source"], "source.pdf", { type: "application/pdf" });
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("Expected PDF file input");
    fireEvent.change(input, { target: { files: [file] } });
    await user.click(panel.getByRole("button", { name: "Queue PDF for AI review" }));
    expect(mocks.processPdf).toHaveBeenCalledWith(expect.objectContaining({ examId: 1, subjectId: 2, topicId: 3, fileName: "source.pdf" }), expect.any(Object));
    expect(await panel.findByText(/Queued job #17/i)).toBeTruthy();
    expect(panel.getByText(/Durable AI processing queue/i)).toBeTruthy();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("PDF queued for AI review", expect.any(Object));
  });

  it("shows dead-letter state and returns only that job to the queue when the owner retries it", async () => {
    const user = userEvent.setup();
    mocks.queueJobs = [{ id: 19, documentId: 7, type: "extract_questions", state: "dead_letter", attemptCount: 3, maxAttempts: 3, progressPercent: 0, lastError: "Provider unavailable", payload: null, availableAt: new Date(), leaseExpiresAt: null, createdAt: new Date(), originalName: "failed-source.pdf" }];
    mocks.queueRetry.mockImplementation((_input: unknown, options: { onSuccess?: () => void }) => options.onSuccess?.());
    const { container } = render(<OwnerIntakePanel />);
    const panel = within(container);
    expect(panel.getByText(/failed-source.pdf/i)).toBeTruthy();
    expect(panel.getByText(/Latest failure: Provider unavailable/i)).toBeTruthy();
    await user.click(panel.getByRole("button", { name: "Retry job" }));
    expect(mocks.queueRetry).toHaveBeenCalledWith({ jobId: 19 }, expect.any(Object));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Dead-letter job returned to the queue");
  });
});
