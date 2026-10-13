// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MonthlyExamLibrary, MonthlyPurchases } from "./MonthlyAccessViews";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    payments: {
      access: { useQuery: () => ({ data: [] }) },
      transactions: { useQuery: () => ({ data: [] }) },
    },
    attempts: { allowance: { useQuery: () => ({ data: { tier: "free", limit: 4, used: 1, remaining: 3 } }) } },
  },
}));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ reducedMotion: true }) }));

const props = { onNavigate: vi.fn(), authenticated: true, name: "Learner" };

describe("monthly access surfaces", () => {
  it("presents free-tier and monthly access choices in the exam library", () => {
    render(<MonthlyExamLibrary {...props} onChoosePlan={vi.fn()} />);
    expect(screen.getByText(/four free mock tests each calendar month/i)).toBeTruthy();
    expect(screen.getAllByText("Monthly access").length).toBeGreaterThan(0);
    expect(screen.queryByText("5 mocks")).toBeNull();
  });

  it("shows the free allowance and monthly subscription state in My Access", () => {
    render(<MonthlyPurchases {...props} />);
    expect(screen.getByText(/four starts,/i)).toBeTruthy();
    expect(screen.getAllByText(/3 of 4 free mock starts remain/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/No monthly exam access yet/i)).toBeTruthy();
  });
});
