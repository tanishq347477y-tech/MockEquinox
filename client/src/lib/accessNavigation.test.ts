import { describe, expect, it } from "vitest";
import { completeLogout, displayAccountState, ownerOnlyRouteRedirect, postLogoutRoute, protectedRouteRedirect, readQaAccountOverride, shouldShowDeveloperNavigation } from "./accessNavigation";

describe("protectedRouteRedirect", () => {
  it("redirects signed-out profile and developer URLs to sign-in", () => {
    expect(protectedRouteRedirect("profile", false, false)).toBe("login");
    expect(protectedRouteRedirect("admin", false, false)).toBe("login");
  });

  it("redirects signed-in learners away from developer URLs while allowing the configured owner", () => {
    expect(protectedRouteRedirect("admin", true, false)).toBe("student");
    expect(protectedRouteRedirect("admin", true, true)).toBeUndefined();
    expect(protectedRouteRedirect("student", true, false)).toBeUndefined();
  });

  it("keeps alternate operational routes owner-only", () => {
    expect(ownerOnlyRouteRedirect(false, false)).toBe("login");
    expect(ownerOnlyRouteRedirect(true, false)).toBe("student");
    expect(ownerOnlyRouteRedirect(true, true)).toBeUndefined();
  });

  it("shows developer navigation only to a signed-in configured owner and sends logout back to the public dashboard", () => {
    expect(shouldShowDeveloperNavigation(true, true)).toBe(true);
    expect(shouldShowDeveloperNavigation(false, true)).toBe(false);
    expect(shouldShowDeveloperNavigation(true, false)).toBe(false);
    expect(postLogoutRoute()).toBe("dashboard");
  });

  it("keeps the QA account display override strictly client-side and non-privileged", () => {
    expect(readQaAccountOverride("?qaAccount=learner")).toBeUndefined();
    expect(readQaAccountOverride("?qaAccount=learner", true)).toBe("learner");
    expect(displayAccountState("learner", true, true)).toEqual({ authenticated: true, isOwner: false });
    expect(displayAccountState("signed-out", true, true)).toEqual({ authenticated: false, isOwner: false });
    expect(displayAccountState("owner", false, false)).toEqual({ authenticated: true, isOwner: true });
  });

  it("waits for managed logout before returning the client to the public dashboard", async () => {
    const calls: string[] = [];
    const destination = await completeLogout(async () => { calls.push("logout"); });
    expect(calls).toEqual(["logout"]);
    expect(destination).toBe("dashboard");
  });
});
