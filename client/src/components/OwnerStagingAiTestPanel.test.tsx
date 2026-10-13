// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    ownerConsole: {
      intake: {
        testExtract: {
          useMutation: () => ({
            isPending: false,
            mutate: mocks.mutate,
            data: undefined,
          }),
        },
      },
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { OwnerStagingAiTestPanel } from "./OwnerStagingAiTestPanel";

describe("OwnerStagingAiTestPanel", () => {
  it("clearly states the staging and no-write boundaries", () => {
    render(<OwnerStagingAiTestPanel />);
    expect(screen.getByText("No-write extraction smoke test")).toBeTruthy();
    expect(screen.getByText(/STAGING_AI_TEST_MODE=true/)).toBeTruthy();
    expect(
      screen.getByText(
        /does not upload a file, create a question, create a queue job/
      )
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Run staging test" })
    ).toHaveProperty("disabled", true);
  });
});
