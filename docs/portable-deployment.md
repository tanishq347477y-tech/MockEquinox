# MockE Independent Deployment Guide

## Purpose

MockE can now run as a conventional **React, Express, tRPC, Drizzle, and MySQL** application. Its live integrations are configured through server environment variables rather than a managed runtime. The committed template is [`config/environment.template`](../config/environment.template); it contains names and safe placeholders only. Do not add real credentials to source control.

## Local setup

Copy the template to a local, ignored `.env` file, replace only the values for services you intend to enable, install dependencies, apply the reviewed Drizzle migrations, and start the server.

```bash
cp config/environment.template .env
pnpm install
pnpm drizzle-kit migrate
pnpm dev
```

Production hosts should define the same variables in their encrypted secret manager. `SESSION_SECRET`, `EMAIL_API_KEY`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `LLM_API_KEY`, `S3_SECRET_ACCESS_KEY`, and `CRON_SECRET` are **server-only** values. They must not be prefixed with `VITE_`, embedded in the frontend, logged, or committed.

## Configuration map

| Area             | Variables                                                                                                  | Required when                          | Notes                                                                                                                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core runtime     | `DATABASE_URL`, `SESSION_SECRET`, `OWNER_EMAIL`, `APP_ORIGIN`, `CORS_ORIGINS`                              | Always in production                   | Startup refuses production operation without the database, a 32+ character session secret, and the configured owner email.                                                                                                              |
| Account security | `SESSION_SECRET`, `OWNER_EMAIL`                                                                            | Local sign-in                          | Email/password accounts use salted server-side scrypt hashes and HTTP-only, SameSite=Lax cookies. Register the owner with the exact `OWNER_EMAIL`.                                                                                      |
| Account delivery | `EMAIL_PROVIDER_URL`, `EMAIL_API_KEY`, `EMAIL_FROM`                                                        | Production registration/reset          | Verification and reset tokens are hashed at rest, single-use, and short-lived. Production startup rejects account creation until delivery is configured.                                                                                |
| Payments         | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`                                        | Enabling checkout                      | Leave all three blank to keep checkout fail-closed. Create a matching active 30-day ₹199 plan before enabling real payments.                                                                                                            |
| AI extraction    | `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_PDF_MODEL`                                | PDF/text extraction and Phase A review | Uses strict JSON schemas for extraction and a second bounded validation pass for answer integrity, ambiguity, duplicate options, and explanation quality. AI output remains a review draft and never bypasses question-review controls. |
| Staging AI test  | `STAGING_AI_TEST_MODE`                                                                                     | Non-production provider smoke test     | Must be explicitly `true` and is rejected whenever `NODE_ENV=production`. The owner-only test accepts text, returns structured drafts, records safe audit metadata, and writes no questions, files, or queue jobs.                      |
| File storage     | `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` | PDF intake                             | Works with AWS S3, Cloudflare R2, or MinIO. Owner import files are served via short-lived signed redirects and retain owner-only checks.                                                                                                |
| Public media     | `VITE_MEDIA_BASE_URL`                                                                                      | Reusing hero/page videos               | Optional. With no value, the app serves the included `client/public/media/mocke-study-hero.mp4` and `mocke-study-pages.mp4` files locally. Set this only when replacing them with a CDN or public bucket.                               |
| Queue schedule   | `CRON_SECRET`                                                                                              | PDF/AI queue processing                | Configure a hosted cron provider or system cron to `POST /api/scheduled/process-pdf-queue` every minute with `x-cron-secret`. The worker remains bounded to one leased job per run.                                                     |
| Optional OAuth   | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_CALLBACK_URL`                        | Adding Google sign-in later            | Local password authentication already works without these optional settings.                                                                                                                                                            |

## Operational sequence

First deploy with the minimum core configuration and confirm `GET /healthz` plus `GET /readyz`. Confirm the two included public media files load from `/media/`; the appearance menu supports Light, Dark, and High contrast, while High contrast and Reduced motion intentionally hide decorative video. Configure transactional email before registering production accounts, then register the account whose email matches `OWNER_EMAIL`, verify it through the emailed single-use link, and confirm that the Developer Console is available only to that account. The owner console's Service status panel can probe email, Razorpay, S3, and AI without creating a charge, writing an object, or sending an AI prompt. In staging, set `STAGING_AI_TEST_MODE=true`, run the no-write smoke test with representative text, confirm structured output and the AI intake audit ledger, then disable the flag before production. Configure private S3 storage before uploading source PDFs. Enable AI extraction only after adding a server-side model key. Finally, add payment credentials and an external cron trigger only when their corresponding services are ready.

## Phase A AI content workflow

The PDF worker performs the following bounded sequence:

1. Extract at most 20 single-correct MCQs using strict structured output.
2. Validate required fields and reject incomplete drafts before database insertion.
3. Run a second structured AI review for answer defensibility, ambiguity, option duplication, self-containment, and explanation quality.
4. Generate a concise suggested explanation only when the source explanation is missing or weak. The suggestion is stored as reviewer assistance, never as an authoritative answer.
5. Apply deterministic quality scoring and exact fingerprint duplicate detection.
6. Persist every result as `needs_review`, including AI verdict, confidence, issues, and fallback state in the version change summary and audit log.

If the second AI pass is unavailable, the worker keeps the extracted question as a clearly flagged reviewer draft rather than publishing, discarding, or silently approving it. Provider calls have a 45-second timeout and one bounded retry; queue leases and dead-letter handling remain the final operational guardrails.

## Portable queue trigger

The queue worker is no longer provisioned by the application. An external scheduler owns the timing and sends the secret header. A typical request is shown below; preserve the secret in the scheduler’s encrypted configuration.

```bash
curl --fail-with-body -X POST "https://your-domain.example/api/scheduled/process-pdf-queue" \
  -H "x-cron-secret: $CRON_SECRET"
```

The owner console can still enable, pause, inspect, and retry durable jobs. The external scheduler should continue to call the endpoint on cadence; a disabled schedule safely returns without processing a job.

## Migration notes

Migration `0009_absent_runaways.sql` adds a nullable `passwordHash` column only. It neither edits nor deletes existing records. Existing managed-login accounts do not have local passwords; for an independent deployment, use a new database or establish local accounts deliberately through the sign-in screen. Do not weaken owner checks or assign privileged roles through client code.

## Verification record

The local sign-in interface, revised landing experience, and active monthly pricing screen were reviewed at desktop and 375 px mobile viewports after the portability conversion. The sign-in form visibly presents separate email/password and account-creation flows, while the landing and pricing surfaces present the four-free-start monthly allowance and ₹199 monthly exam access without legacy pack pricing. The reviewed mobile views show no horizontal overflow.
