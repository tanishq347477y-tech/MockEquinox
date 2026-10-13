// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({ trpc: { auth: { me: { useQuery: () => ({ data: null }) } } } }));
vi.mock("@/components/AccessibilityControls", () => ({ AccessibilityControls: () => <span data-testid="accessibility-controls" /> }));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ reducedMotion: true }) }));

import { StudyLanding } from "./StudyExperience";

const componentPath = path.resolve(import.meta.dirname, "StudyExperience.tsx");
const source = fs.readFileSync(componentPath, "utf8");
const landingSource = source.slice(source.indexOf("export function StudyLanding"), source.indexOf("export function StudyLogin"));

describe("scrollable MockE landing narrative", () => {
  it("keeps the lower landing story video-free while preserving the pencil motif and study conversion sections", () => {
    expect(landingSource).toContain("PencilLineMotif");
    expect(landingSource).toContain("pencilProgress");
    expect(source).toContain("landing-pen-stand");
    expect(landingSource).toContain("requestAnimationFrame(updateProgress)");
    expect(landingSource).toContain("Make every practice session");
    expect(landingSource).toContain("Why MockE");
    expect(landingSource).toContain("Choose the exam you");
    expect(landingSource).toContain("four free mock starts each calendar month");
    expect(landingSource).toContain("Make the next mock");
    expect(landingSource).not.toContain("pageVideoUrl");
  });

  it("routes hero, exam-library, pricing, and final-study calls to action to their expected destinations", () => {
    const onNavigate = vi.fn();
    render(<StudyLanding authenticated={false} onNavigate={onNavigate} />);
    expect(screen.queryByRole("button", { name: "Developer" })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /^Create an account/ })[0]);
    expect(onNavigate).toHaveBeenLastCalledWith("login");
    fireEvent.click(screen.getByRole("button", { name: /Explore the exam library/ }));
    expect(onNavigate).toHaveBeenLastCalledWith("exams");
    fireEvent.click(screen.getByRole("button", { name: /See monthly plans/ }));
    expect(onNavigate).toHaveBeenLastCalledWith("pricing");
    fireEvent.click(screen.getByRole("button", { name: /Browse exams/ }));
    expect(onNavigate).toHaveBeenLastCalledWith("exams");
  });
});
