# Portability Dependency Audit

The independent runtime conversion separated each formerly managed service boundary from MockE product logic. The application now uses standard server configuration, local account sessions, OpenAI-compatible AI calls, S3-compatible private storage, an external cron header, and a generic Vite build.

| Concern | Previous managed assumption | Portable replacement | Configuration location |
|---|---|---|---|
| Authentication | Hosted OAuth token exchange and identity lookup | Local email/password account creation, salted server-side scrypt hashes, signed HTTP-only session cookies | `SESSION_SECRET`, `OWNER_EMAIL` |
| Owner authorization | Hosted OpenID comparison | Exact normalized local account email comparison | `OWNER_EMAIL` |
| AI intake | Built-in model catalog and completion endpoint | OpenAI-compatible chat-completions request, still restricted to review drafts | `LLM_*` |
| PDF storage | Managed presign gateway and storage path | Standard S3-compatible `PutObject` plus short-lived signed download URLs | `S3_*` |
| Queue cadence | Managed scheduler creation/update API | External cron performs a bounded signed HTTP invocation | `CRON_SECRET` |
| Analytics | Injected managed analytics script | No baked-in analytics loader; add an independently owned provider only if desired | Optional future integration |
| Static video assets | Managed storage URL paths | Public CDN or storage base URL for the two supplied videos | `VITE_MEDIA_BASE_URL` |
| Build/runtime | Managed Vite runtime plugin and host allowlist | Standard Vite configuration listening on a generic host | No managed environment variables |

The compatibility files for unused managed AI, storage, OAuth, notification, scheduler, map, and voice helpers were removed from the runtime. Product data and API procedures remain in the ordinary Express/tRPC/Drizzle stack.
