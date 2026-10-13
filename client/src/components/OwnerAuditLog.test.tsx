// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auditQuery: vi.fn(), refetch: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    ownerConsole: {
      audit: {
        list: { useQuery: () => mocks.auditQuery() },
      },
    },
  },
}));

import { OwnerAuditLogPanel } from "./OwnerAuditLog";

describe("OwnerAuditLogPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows explicit loading, empty, and error states for the owner activity log", () => {
    mocks.auditQuery.mockReturnValueOnce({ isLoading: true, isError: false, isFetching: false, data: undefined, refetch: mocks.refetch });
    const view = render(<OwnerAuditLogPanel />);
    expect(screen.getByText("Loading recorded activity…")).toBeTruthy();

    mocks.auditQuery.mockReturnValueOnce({ isLoading: false, isError: false, isFetching: false, data: [], refetch: mocks.refetch });
    view.rerender(<OwnerAuditLogPanel />);
    expect(screen.getByText("No recorded changes yet.")).toBeTruthy();

    mocks.auditQuery.mockReturnValueOnce({ isLoading: false, isError: true, isFetching: false, data: undefined, error: { message: "Owner activity is unavailable" }, refetch: mocks.refetch });
    view.rerender(<OwnerAuditLogPanel />);
    expect(screen.getByText("Activity history could not be loaded: Owner activity is unavailable")).toBeTruthy();
  });
});
