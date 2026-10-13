// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  requestVerification: vi.fn(),
  verifyEmail: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { invalidate: mocks.invalidate } } }),
    auth: {
      login: {
        useMutation: () => ({ mutateAsync: mocks.login, isPending: false }),
      },
      register: {
        useMutation: () => ({ mutateAsync: mocks.register, isPending: false }),
      },
      requestVerification: {
        useMutation: () => ({
          mutateAsync: mocks.requestVerification,
          isPending: false,
        }),
      },
      verifyEmail: {
        useMutation: () => ({
          mutate: mocks.verifyEmail,
          isPending: false,
          isSuccess: false,
        }),
      },
      requestPasswordReset: {
        useMutation: () => ({
          mutateAsync: mocks.requestPasswordReset,
          isPending: false,
        }),
      },
      resetPassword: {
        useMutation: () => ({
          mutateAsync: mocks.resetPassword,
          isPending: false,
        }),
      },
    },
  },
}));

import { AuthPanel } from "./AuthPanel";

describe("AuthPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "";
    mocks.login.mockResolvedValue({});
    mocks.register.mockResolvedValue({ verificationRequired: false });
    mocks.requestVerification.mockResolvedValue({ accepted: true });
    mocks.requestPasswordReset.mockResolvedValue({ accepted: true });
    mocks.resetPassword.mockResolvedValue({ success: true });
    mocks.invalidate.mockResolvedValue(undefined);
  });

  it("keeps sign-in, registration, reset, and verification recovery reachable", async () => {
    const user = userEvent.setup();
    render(
      <AuthPanel
        onNavigate={vi.fn()}
        onSignIn={vi.fn()}
        onSignUp={vi.fn()}
        authenticated={false}
      />
    );
    expect(
      screen.getByRole("button", { name: "Sign in securely" })
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(
      screen.getByRole("button", { name: "Send reset link" })
    ).toBeTruthy();
    await user.type(
      screen.getByLabelText("Email address"),
      "learner@example.com"
    );
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
      email: "learner@example.com",
    });
    expect(screen.getByRole("status").textContent).toContain(
      "If an account exists"
    );
    await user.click(screen.getByRole("button", { name: /Back to sign in/ }));
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByLabelText("Your name")).toBeTruthy();
  });
});
