# MockEquinox Production Readiness

MockEquinox is organized as a modular full-stack application with a protected server boundary for identity, role enforcement, deterministic scoring, and payment verification. The initial release should remain a modular monolith: this keeps the operational surface manageable while preserving clean domain seams for content processing, attempts, analytics, subscriptions, and administration.

| Concern | Implemented foundation | Required launch control |
| --- | --- | --- |
| Identity and roles | Managed OAuth, four roles, protected/reviewer/admin/super-admin procedures | Enforce least privilege, review administrator promotion, and audit role changes. |
| Question integrity | Versioned questions and immutable attempt snapshots | Require reviewer approval before publication and preserve every scoring snapshot. |
| Test reliability | Explicit attempt-state transition guard and deterministic scoring utility | Persist attempt writes idempotently; use server timestamps for start, expiry, and submission. |
| Document intake | S3 metadata model, checksum field, job-state model, and secure storage pattern | Validate type/size, scan uploads, queue extraction off-request, and use dead-letter handling. |
| Payments | Server-side HMAC signature utilities, payment/subscription records, idempotency key | Create orders server-side; verify callback and webhook signatures; activate access only after verified capture. |
| Abuse prevention | Local sliding-window limiter utility | Replace the process-local store with a shared edge or Redis limiter before multi-replica launch. |
| Observability | Audit-log table and CI workflow | Add central error tracking, metric dashboards, alerting, retention policy, backup restores, and runbooks. |

## Payment Integration Contract

Razorpay’s official integration guidance requires an order to be created on the server, then ties the returned `order_id` to checkout. The payment signature must be verified on the server before fulfilling the order. [1] Razorpay also requires webhook validation against the raw request body and documents that webhook events can be duplicated or arrive out of order; the platform should retain the gateway event identifier and process each event idempotently. [2]

The production implementation should store only gateway identifiers, signed event metadata, and subscription state. API secrets, webhook secrets, and private keys must live in server-side environment configuration; they must never be placed in client code, the database, or source control. The checked-in `.env.example` contains intentionally invalid placeholders. The payment availability procedure remains disabled until all three deployed variables—`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`—contain non-placeholder production values.

## Background Content Processing

Uploads should follow the following controlled workflow: file validation → secure object storage → document row → queued extraction job → OCR where required → structured AI extraction → deterministic validation → duplicate/quality checks → human review → publication. AI calls must run outside the request that accepted the file; critical decisions such as publishing, subscription activation, scoring, and role changes remain deterministic and reviewer or administrator controlled.

For the first launch, persistent processing should be isolated behind a durable queue. The web process should only create and inspect jobs. Workers must record progress, use bounded retries with exponential backoff, and move terminal failures to a dead-letter state for review.

## Release Gates

Before launch, load-test real test-attempt concurrency, exercise payment test-mode and retry paths, restore a database backup into a clean environment, verify audit-log access, test role escalations, and run a security assessment covering input validation, authenticated route coverage, object-storage access, rate limiting, and webhook replay handling. Promotion should proceed through staging first, with a limited rollout and live error/latency monitoring.

## References

[1] [Razorpay, “Standard Checkout: Integration Steps”](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)

[2] [Razorpay, “Validate and Test Webhooks”](https://razorpay.com/docs/webhooks/validate-test/)
