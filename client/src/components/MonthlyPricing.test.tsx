// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MonthlyPricing } from "./MonthlyPricing";

const mocks = vi.hoisted(() => ({ onNavigate: vi.fn(), onSelectPlan: vi.fn(), onCheckout: vi.fn() }));

vi.mock("@/lib/trpc", () => ({ trpc: { attempts: { allowance: { useQuery: () => ({ data: { tier: "free", remaining: 4 }, isLoading: false }) } } } }));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ reducedMotion: true }) }));

describe("MonthlyPricing", () => {
  it("presents the free plan with four monthly mock starts and lets a learner select monthly access", async () => {
    const user = userEvent.setup();
    render(<MonthlyPricing onNavigate={mocks.onNavigate} selectedExam="JEE Main" selectedPlan={4} onSelectPlan={mocks.onSelectPlan} onCheckout={mocks.onCheckout} authenticated name="Learner" />);
    expect(screen.getByText(/four mock-test attempts each calendar month/i)).toBeTruthy();
    expect(screen.getByText(/4 of 4 free mock starts remain this month/i)).toBeTruthy();
    expect(screen.getByText("₹199")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Choose this plan" }));
    expect(mocks.onSelectPlan).toHaveBeenCalledWith(10);
  });
});
