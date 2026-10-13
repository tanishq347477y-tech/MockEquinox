# Account Access QA Matrix

The developer workspace is owner-only at both the navigation and server-procedure boundaries. The client hides the **Developer** destination unless the authenticated `isOwner` flag is true, while the server compares the authenticated OpenID to `OWNER_OPEN_ID` before returning operational metrics. This prevents a non-owner from recovering developer data through a direct route or RPC request.

| State | Expected navigation | Direct-route outcome | Account action |
| --- | --- | --- | --- |
| Signed-in project owner | Shows **Developer** and **Profile** | `#admin` renders the developer workspace | Profile shows **Project owner** and secure logout. |
| Signed-in learner | Hides **Developer** and shows **Profile** | `#admin` redirects to the study desk | Profile exposes access, display preferences, study desk, and logout. |
| Signed-out visitor | Shows sign-in entry | `#profile` and `#admin` redirect to `#login` | The login screen presents separate sign-in and create-account actions. |
| After logout | Returns to the public dashboard | Protected routes require authentication again | Managed session is cleared by the logout mutation. |

The automated suite covers backend owner enforcement, learner redirect behavior, developer-navigation visibility logic, and the client logout sequence. The logout mutation test verifies that the managed session cookie is cleared, while the client flow test verifies that the UI awaits that mutation before navigating to the public dashboard. The final responsive review exercised the owner, learner, and signed-out states at desktop (1440 px) and mobile (390 px) widths. It confirmed that the owner state exposes **Developer**, the learner state redirects `#admin` to the study desk without a Developer entry, and signed-out `#profile` redirects to a login page with separate **Sign in** and **Create an account** actions. It also captured role-labeled owner and learner profile pages at both breakpoints, each with category-access, display-preference, study-desk, and secure-logout actions. The visual state selector is development-only, does not change the session, and cannot grant server access. The final validation completed with 9 test files and 24 tests passing, successful type checking, and a successful production build.
