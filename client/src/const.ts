/** Browser-safe authentication entry point. Credentials are submitted only to the
 * server-side auth procedures from the local sign-in screen. */
export function startLogin() {
  if (typeof window !== "undefined") window.location.assign("/#login");
}
