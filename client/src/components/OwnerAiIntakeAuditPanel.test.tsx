// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auditQuery: vi.fn(), refetch: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    ownerConsole: {
      audit: { aiIntake: { useQuery: () => mocks.auditQuery() } },
    },
  },
}));

import { OwnerAiIntakeAuditPanel } from "./OwnerAiIntakeAuditPanel";

describe("OwnerAiIntakeAuditPanel", () => {
  beforeEach(() => vi.clearAllMocks());
  it("shows safe loading, empty, error, and event states", () => {
    mocks.auditQuery.mockReturnValueOnce({
      isLoading: true,
      isError: false,
      isFetching: false,
      data: undefined,
      refetch: mocks.refetch,
    });
    const view = render(<OwnerAiIntakeAuditPanel />);
    expect(screen.getByText("Loading AI intake history…")).toBeTruthy();
    mocks.auditQuery.mockReturnValueOnce({
      isLoading: false,
      isError: false,
      isFetching: false,
      data: [],
      refetch: mocks.refetch,
    });
    view.rerender(<OwnerAiIntakeAuditPanel />);
    expect(screen.getByText("No AI intake events yet.")).toBeTruthy();
    mocks.auditQuery.mockReturnValueOnce({
      isLoading: false,
      isError: true,
      isFetching: false,
      data: undefined,
      error: { message: "Ledger unavailable" },
      refetch: mocks.refetch,
    });
    view.rerender(<OwnerAiIntakeAuditPanel />);
    expect(
      screen.getByText(
        "AI intake history could not be loaded: Ledger unavailable"
      )
    ).toBeTruthy();
  });
});
