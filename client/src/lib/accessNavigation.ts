import type { StudyRoute } from "@/components/StudyExperience";

export type QaAccountOverride = "owner" | "learner" | "signed-out" | undefined;

export function readQaAccountOverride(search: string, enabled = false): QaAccountOverride {
  if (!enabled) return undefined;
  const value = new URLSearchParams(search).get("qaAccount");
  return value === "owner" || value === "learner" || value === "signed-out" ? value : undefined;
}

export function displayAccountState(override: QaAccountOverride, authenticated: boolean, isOwner: boolean) {
  if (override === "signed-out") return { authenticated: false, isOwner: false };
  if (override === "learner") return { authenticated: true, isOwner: false };
  if (override === "owner") return { authenticated: true, isOwner: true };
  return { authenticated, isOwner };
}

export function protectedRouteRedirect(route: StudyRoute, authenticated: boolean, isOwner: boolean) {
  if (route === "profile" && !authenticated) return "login" as const;
  if (route === "admin" && !isOwner) return authenticated ? "student" as const : "login" as const;
  return undefined;
}

export function ownerOnlyRouteRedirect(authenticated: boolean, isOwner: boolean) {
  if (isOwner) return undefined;
  return authenticated ? "student" as const : "login" as const;
}

export function shouldShowDeveloperNavigation(authenticated: boolean, isOwner: boolean) {
  return authenticated && isOwner;
}

export function postLogoutRoute() {
  return "dashboard" as const;
}

export async function completeLogout(logout: () => Promise<unknown>) {
  await logout();
  return postLogoutRoute();
}
