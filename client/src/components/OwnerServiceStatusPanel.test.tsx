// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  probe: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    ownerConsole: {
      services: {
        configured: {
          useQuery: () => ({
            isLoading: false,
            isError: false,
            data: [
              {
                key: "email",
                label: "Transactional email",
                state: "not_configured",
                detail: "Set email variables",
                checkedAt: new Date().toISOString(),
              },
            ],
          }),
        },
        probe: {
          useMutation: (options: {
            onSuccess?: (data: unknown) => void;
            onError?: (error: Error) => void;
          }) => ({ isPending: false, mutate: () => mocks.probe(options) }),
        },
      },
    },
  },
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { OwnerServiceStatusPanel } from "./OwnerServiceStatusPanel";

describe("OwnerServiceStatusPanel", () => {
  it("shows safe status information and runs a probe without exposing credentials", async () => {
    const user = userEvent.setup();
    mocks.probe.mockImplementation(
      (options: { onSuccess?: (data: unknown) => void }) =>
        options.onSuccess?.([
          {
            key: "email",
            label: "Transactional email",
            state: "ready",
            detail: "Provider responded",
            checkedAt: new Date().toISOString(),
            latencyMs: 42,
          },
        ])
    );
    render(<OwnerServiceStatusPanel />);
    expect(screen.getByText("Transactional email")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Run probes" }));
    expect(mocks.probe).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.queryByText(/secret/i)).toBeNull();
  });
});
