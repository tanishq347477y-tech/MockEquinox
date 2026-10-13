# MockEquinox Deployment Runbook

MockEquinox is prepared for **managed autoscaling deployment** as a stateless web application. The application keeps authoritative state in MySQL-compatible storage and managed object storage; individual web instances may start or stop without relying on in-memory application state.

## Release checklist

| Gate | Required action | Evidence |
| --- | --- | --- |
| Build | Run `pnpm test && pnpm check && pnpm build`. | All tests, type check, and production build pass. |
| Schema | Apply the reviewed Drizzle migrations before release. | `rateLimitBuckets`, `processingJobs` lease fields, and `queueWorkerSchedules` exist. |
| Secrets | Configure only production server secrets through the project settings. | `DATABASE_URL`, `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, and `OWNER_OPEN_ID` are set. |
| Payments | Keep checkout disabled unless all real Razorpay server values are configured. | Status endpoint reports checkout enabled only after configuration. |
| Health | Confirm `GET /healthz` returns `200` and `GET /readyz` returns `200`. | The readiness endpoint confirms database connectivity. |
| Owner controls | Sign in as the configured owner and inspect the Activity log. | Owner-only console displays recorded activity. |

## Runtime behavior

Every request is assigned an `X-Request-Id` and emits a structured completion log containing its method, path, status, and elapsed milliseconds. The service exposes a liveness probe at `/healthz` and a database-aware readiness probe at `/readyz`. On a termination signal, readiness changes to `503` before the HTTP server drains active requests.

In production, high-cost and sensitive request paths use database-backed fixed-window rate-limit buckets, allowing the throttle to be applied consistently across separate web replicas. Development and test environments retain isolated local counters. If the shared limiter cannot reach persistence in production, it fails closed rather than permitting unbounded processing.

## Scaling boundaries

The current managed autoscaling mode is appropriate for normal web requests, test attempts, owner administration, and short document operations. High-volume PDF extraction and AI review now run through a durable database-backed queue rather than inside the owner upload request. The queue stores its work item, claim lease, retry timing, attempt count, and terminal dead-letter state in the database.

## Durable PDF and AI queue

After publishing this release, sign in as the configured owner, open **Developer → Source intake**, and select **Activate worker** once. This registers a platform-managed task that calls `/api/scheduled/process-pdf-queue` once per minute. The task processes **one** leased PDF job per run, which preserves the managed hosting timeout budget and prevents overlapping schedule runs from processing the same item.

| Queue state | Meaning | Owner action |
| --- | --- | --- |
| `queued` | Awaiting the next scheduled batch or a retry window. | Monitor progress. |
| `processing` | A worker holds a temporary lease. | Wait; an expired lease can be reclaimed safely. |
| `completed` | Reviewer drafts were written and require ordinary content review. | Open the Question Bank to inspect and approve drafts. |
| `dead letter` | All bounded attempts failed. | Inspect the safe error summary and select **Retry job** after correcting the cause. |

Retries use exponential backoff and do not publish questions automatically. Duplicate fingerprints make a reclaimed job safe to run again after an interrupted worker. The scheduled handler accepts only platform-authenticated scheduled callers and returns an idempotent skip for disabled, orphaned, or already-running worker states.

For operations, alert on sustained non-2xx readiness responses, high `429` volume, webhook persistence failures, request latency, and database error logs. Retain audit data according to the applicable privacy policy, rehearse backup restoration before accepting paid traffic, and use staging plus a limited rollout for payment activation.
