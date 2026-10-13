// @vitest-environment jsdom
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usersRefetch: vi.fn(),
  questionsRefetch: vi.fn(),
  referencesRefetch: vi.fn(),
  updateRole: vi.fn(),
  setStatus: vi.fn(),
  createExam: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    ownerConsole: {
      users: {
        list: { useQuery: () => ({ isLoading: false, isError: false, data: [{ id: 2, openId: "learner", name: "Learner One", email: "learner@example.com", role: "student", createdAt: new Date(), lastSignedIn: new Date("2026-08-26") }], refetch: mocks.usersRefetch }) },
        updateRole: { useMutation: (options: { onSuccess?: () => void }) => ({ isPending: false, mutate: (input: unknown) => mocks.updateRole(input, options) }) },
      },
      content: {
        references: { useQuery: () => ({ isLoading: false, isError: false, data: { exams: [], subjects: [], topics: [] }, refetch: mocks.referencesRefetch }) },
        createExam: { useMutation: () => ({ isPending: false, mutate: mocks.createExam }) },
        createSubject: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
        createTopic: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
        list: { useQuery: () => ({ isLoading: false, isError: false, data: [{ id: 44, examId: 1, subjectId: 2, topicId: 3, currentVersion: 1, difficulty: "medium", status: "needs_review", qualityScore: 88, fingerprint: "test", stem: "A complete published workflow question with adequate text.", updatedAt: new Date() }], refetch: mocks.questionsRefetch }) },
        detail: { useQuery: () => ({ isLoading: false, isError: false, data: undefined }) },
        create: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
        update: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
        setStatus: { useMutation: () => ({ isPending: false, mutate: mocks.setStatus }) },
      },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import { OwnerCatalogPanel, OwnerContentPanel, OwnerUsersPanel } from "./OwnerManagement";

describe("Owner Console client mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateRole.mockImplementation((_input: unknown, options: { onSuccess?: () => void }) => options.onSuccess?.());
    mocks.setStatus.mockImplementation((_input: unknown, options: { onSuccess?: () => void }) => options.onSuccess?.());
    mocks.createExam.mockImplementation((_input: unknown, options: { onSuccess?: () => void }) => options.onSuccess?.());
  });

  it("submits a role update and refreshes real user records on success", async () => {
    const user = userEvent.setup();
    render(<OwnerUsersPanel />);
    await user.selectOptions(screen.getByRole("combobox"), "reviewer");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(mocks.updateRole).toHaveBeenCalledWith({ userId: 2, role: "reviewer" }, expect.any(Object));
    expect(mocks.usersRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Role updated");
  });

  it("publishes a question and refreshes the content list on success", async () => {
    const user = userEvent.setup();
    render(<OwnerContentPanel />);
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(mocks.setStatus).toHaveBeenCalledWith({ questionId: 44, status: "published" }, expect.any(Object));
    expect(mocks.questionsRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Question published");
  });

  it("creates an exam and refreshes catalogue references on success", async () => {
    const user = userEvent.setup();
    render(<OwnerCatalogPanel />);
    const form = screen.getAllByText("Create exam").map(element => element.closest("form")).find((value): value is HTMLFormElement => Boolean(value))!;
    await user.type(within(form).getByLabelText("Exam name"), "Practice Exam");
    await user.type(within(form).getByLabelText("Short name"), "PE");
    await user.type(within(form).getByLabelText("Slug"), "practice-exam");
    await user.click(within(form).getByRole("button", { name: "Create exam" }));
    expect(mocks.createExam).toHaveBeenCalledWith({ name: "Practice Exam", shortName: "PE", slug: "practice-exam", status: "draft" }, expect.any(Object));
    expect(mocks.referencesRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Exam created");
  });
});
