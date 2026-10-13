import { describe, expect, it } from "vitest";
import { FREE_MONTHLY_MOCK_LIMIT, monthWindow } from "./db";

describe("monthly free-tier allowance", () => {
  it("sets the free tier at four mock starts and resets at the next UTC calendar month", () => {
    expect(FREE_MONTHLY_MOCK_LIMIT).toBe(4);
    expect(monthWindow(new Date("2026-08-31T23:59:59.000Z"))).toEqual({ monthKey: "2026-08", resetsAt: new Date("2026-09-01T00:00:00.000Z") });
  });

  it("keeps January resets correctly within a new calendar year", () => {
    expect(monthWindow(new Date("2027-01-15T09:00:00.000Z"))).toEqual({ monthKey: "2027-01", resetsAt: new Date("2027-02-01T00:00:00.000Z") });
  });
});
