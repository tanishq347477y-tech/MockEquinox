# MockE / MockEquinox — Complete Project Reference

> A portable, production-oriented mock-test and exam-preparation platform for students, reviewers, and the configured owner.

## 1. Product summary

MockE helps learners prepare for competitive and professional exams through timed mock tests, question-bank practice, monthly exam access, clear result analysis, and a focused study interface. It also gives the owner a controlled content-ingestion workspace for importing source PDFs or structured question files, running AI-assisted extraction and validation, reviewing drafts, and monitoring service health.

The project is designed to run independently on a conventional Node.js host with a MySQL-compatible database. Manus-hosted authentication, storage, AI, analytics, and scheduler paths are not required by the active portable architecture.

## 2. Current product areas

### Public and learner experience

- Scrollable study-focused landing page with cinematic hero treatment.
- Local repository-owned ambient MP4 background videos for the hero and internal study pages.
- Video-free landing narrative sections explaining the study loop, exam breadth, pricing, governance, and calls to action.
- Animated pencil-line education motif with reduced-motion safeguards.
- Sign-in, account creation, email verification, password reset, and logout.
- Learner study desk/dashboard.
- Exam library with 26 exam categories represented in the current content model and UI.
- Exam, subject, and topic navigation.
- Timed mock-test interface.
- Question navigation, answer selection, mark-for-review, autosave, resume, and submit flow.
- Results with score, correct/incorrect/skipped counts, negative marking, and performance breakdown surfaces.
- Historical analytics summary and learner profile.
- My Access page for current monthly exam access and free-tier allowance.
- Monthly pricing screen with a free tier of four mock starts per calendar month and ₹199 monthly exam access messaging.
- Compact neutral upgrade prompt rather than an intrusive advertisement panel.

### Owner / Developer console

The owner console is not a general admin area. It is gated by the authenticated local account whose email exactly matches `OWNER_EMAIL`.

- User listing and owner-controlled role updates.
- Exam, subject, and topic creation.
- Versioned question creation, editing, publishing, and archiving.
- Private PDF/source-file upload for owner use only.
- Structured JSON question import for owner use only.
- Durable PDF/AI processing queue with bounded worker claims, lease expiry, retry backoff, and dead-letter handling.
- Reviewer draft generation with deterministic quality scoring and duplicate detection.
- AI validation for answer integrity, ambiguity, option duplication, self-containment, and explanation quality.
- Reviewer-only suggested explanations for weak or missing source explanations.
- Owner-only AI intake audit ledger.
- Staging-only, no-write AI extraction smoke test.
- Service status dashboard for AI, S3-compatible storage, Razorpay, and email delivery.
- Read-only activity/audit log with bounded retrieval and safe metadata summaries.
- Queue monitoring, pause/resume controls, and retry controls.

## 3. Technology stack

### Frontend

- React 19
- Vite 7
- TypeScript
- Tailwind CSS 4
- Radix UI primitives and shadcn-style components
- Lucide icons
- TanStack React Query through tRPC React bindings
- Wouter-style client navigation/state shell
- Recharts for analytics visualizations where used
- Vitest and Testing Library for component tests

### Backend

- Node.js 22+
- Express 5
- tRPC 11 for typed API procedures
- Drizzle ORM
- MySQL or compatible TiDB database
- `jose` for signed session tokens
- Node `scrypt`-based salted password hashes
- Axios for portable external HTTP integrations
- AWS SDK S3 client and presigner for S3-compatible storage
- Zod for input and structured-output validation
- External cron trigger for durable queue processing

### Build and operations

- `pnpm` package manager
- Vite client build plus esbuild server bundle
- Production static serving from the Express process
- Health endpoint: `/healthz`
- Database-aware readiness endpoint: `/readyz`
- Structured request correlation IDs and completion logs
- Production security headers, CORS allow-list, request limits, rate limiting, and graceful shutdown

## 4. Repository map

```text
client/
  index.html                    Browser entry document
  public/media/                 Repository-owned public MP4 assets
  src/App.tsx                   Top-level providers and application shell
  src/pages/Home.tsx            Main route/state shell and study surfaces
  src/components/               Learner, auth, owner, and reusable UI components
  src/contexts/                 Theme and appearance preferences
  src/lib/                      tRPC client and navigation helpers
  src/index.css                 Theme tokens, layout, accessibility, and motion rules

server/
  _core/index.ts                Express startup, middleware, API, Vite/static serving
  _core/context.ts              tRPC request context and local session lookup
  _core/trpc.ts                 Public, protected, and owner procedure boundaries
  _core/operationalRoutes.ts   Health, readiness, production assertions, draining
  routers.ts                    Typed application procedures
  db.ts                         Drizzle queries and transactional helpers
  runtimeConfig.ts              Validated server-only environment configuration
  auth/credentials.ts           Password hashing and credential verification
  email.ts                      Portable transactional email adapter
  contentPipeline.ts            AI extraction and structured validation
  llm.ts                        OpenAI-compatible provider client with timeout/retry bounds
  pdfQueueWorker.ts             Durable PDF processing worker
  queueScheduler.ts             External-cron worker entrypoint
  questionQuality.ts            Quality score and duplicate fingerprint logic
  storage.ts                    S3-compatible object storage adapter
  storageProxy.ts               Owner-protected private object proxy
  serviceStatus.ts              Safe read-only external service probes
  audit.ts                      Audit event persistence and summaries
  razorpay*.ts                  Payment configuration, order, and webhook verification

shared/
  Shared types, constants, and error definitions

drizzle/
  schema.ts                     MySQL schema
  *.sql                         Ordered additive migrations
  meta/                         Drizzle migration snapshots

config/
  environment.template          Safe environment variable template

docs/
  portable-deployment.md        Deployment and operations runbook
  production-readiness.md       Hardening and launch notes
  PROJECT_REFERENCE.md          This document (root-level copy is canonical)

scripts/
  Browser/visual regression helpers used during development QA
```

## 5. Authentication and authorization

### Local authentication

- Accounts use email/password credentials.
- Passwords are never sent to or stored in the frontend after submission.
- Passwords are hashed server-side with salted scrypt parameters.
- Sessions are signed, HTTP-only, SameSite cookies.
- Session identity is read server-side on every protected request.
- Verification and reset tokens are hashed at rest, single-use, and short-lived.
- Registration, login, password reset, and verification routes have rate limits and graceful error states.

### Access boundaries

- Public procedures expose only intentionally public data.
- Protected procedures require a valid local session.
- Owner procedures require a valid session plus an email match against `OWNER_EMAIL`.
- PDF upload, structured import, AI extraction, queue controls, staging extraction, service probes, audit history, and owner CRUD are owner-only.
- The frontend hides owner navigation for learners, but the server remains the authoritative boundary.
- There is no client-side owner secret or privileged API key.

## 6. AI and PDF content pipeline

### Production owner workflow

1. Owner uploads a PDF through the owner console.
2. The source is stored privately in S3-compatible storage.
3. A database-backed processing job is enqueued atomically.
4. An external scheduler calls the queue endpoint once per minute.
5. A worker claims one job using a lease.
6. The worker obtains a short-lived signed source URL.
7. The OpenAI-compatible provider is asked for at most 20 structured single-correct MCQs.
8. Zod validates the structured response and rejects incomplete records.
9. A second structured AI pass checks answer defensibility, ambiguity, duplicate options, self-containment, and explanation quality.
10. A reviewer-only suggested explanation is generated only when the source explanation is missing or weak.
11. Deterministic quality scoring and exact fingerprint duplicate detection run locally.
12. Every resulting question is persisted as `needs_review` with validation metadata.
13. The owner reviews, edits, publishes, or archives the draft.

AI output never directly publishes a question. If the provider is unavailable, the system retains a clearly flagged review state or retries safely; it does not silently approve content.

### Staging no-write test

Set `STAGING_AI_TEST_MODE=true` only in a non-production environment. The owner can submit representative text and receive structured extraction plus safe audit metadata. The staging procedure cannot create a document, question, question version, queue job, or publication. It is rejected whenever `NODE_ENV=production`.

## 7. Database model

The current Drizzle schema includes these primary tables:

- `users`: local identities, roles, password hash, verification state, and timestamps.
- `authTokens`: single-use verification and password-reset tokens.
- `exams`: exam categories.
- `subjects`: exam subjects.
- `topics`: subject topics.
- `questionTags` and `questionTagLinks`: question classification.
- `questions`: canonical question records and lifecycle state.
- `questionVersions`: versioned stem/options/answer/explanation history.
- `tests` and `testQuestions`: mock-test definitions and selected questions.
- `testAttempts` and `attemptAnswers`: server-owned test state and answers.
- `monthlyMockUsage`: four-free-start monthly allowance tracking.
- `documentUploads`: private source-file metadata.
- `processingJobs`: durable PDF/AI queue jobs, attempts, leases, and errors.
- `queueWorkerSchedules`: external worker schedule state and lease metadata.
- `plans`, `subscriptions`, `payments`, and `paymentWebhookEvents`: monthly monetization records and webhook idempotency.
- `auditLogs`: owner and security event history.
- `rateLimitBuckets`: database-backed replica-consistent throttling.

Migrations are additive and ordered in `drizzle/`. Never edit an already-applied migration; generate a new migration for schema changes.

## 8. Payments and pricing

- Free tier: four mock starts per calendar month.
- Paid access: ₹199 monthly per selected exam category in the current product messaging.
- Payment route is fail-closed until matching server-only Razorpay credentials and an active 30-day plan are configured.
- Webhook signatures are verified server-side.
- Webhook event IDs are stored for idempotency.
- Client code never receives Razorpay secret material.
- No real payment or checkout is enabled by default in a fresh local setup.

## 9. Configuration

Copy `config/environment.template` to `.env` locally. Do not commit `.env`.

### Core

- `NODE_ENV`: `development`, `test`, or `production`.
- `PORT`: HTTP port; defaults to 3000.
- `DATABASE_URL`: MySQL/TiDB connection string.
- `SESSION_SECRET`: at least 32 random characters in production.
- `OWNER_EMAIL`: exact email allowed to enter the owner console.
- `APP_ORIGIN`: canonical browser origin.
- `CORS_ORIGINS`: comma-separated allowed origins.

### Email

- `EMAIL_PROVIDER_URL`
- `EMAIL_API_KEY`
- `EMAIL_FROM`

### AI

- `LLM_PROVIDER`
- `LLM_API_KEY`
- `LLM_BASE_URL`
- `LLM_MODEL`
- `LLM_PDF_MODEL`
- `STAGING_AI_TEST_MODE` — non-production only; default false.

### Storage

- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_ENDPOINT` — supports AWS S3, Cloudflare R2, MinIO, and compatible services.
- `S3_FORCE_PATH_STYLE`
- `S3_PUBLIC_BASE_URL` when applicable.

### Payments and queue

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `CRON_SECRET`

### Optional integrations

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_CALLBACK_URL`

### Public media

- `VITE_MEDIA_BASE_URL` is optional. When unset, the application uses `/media`, which maps to `client/public/media/` in local and production static builds.
- The repository includes `mocke-study-hero.mp4` and `mocke-study-pages.mp4`.
- If a CDN is preferred, set `VITE_MEDIA_BASE_URL` to its public base URL without a trailing slash.
- Do not put secrets in any `VITE_` variable.

## 10. Theme and accessibility

- Light mode, dark mode, and high-contrast mode are persisted in local storage.
- The display preferences popover is available from study navigation.
- Reduced motion pauses decorative video and disables non-essential animation.
- High contrast intentionally hides video so text and controls remain maximally legible.
- Focus rings, semantic labels, keyboard-accessible controls, and responsive layouts are part of the UI contract.
- The study UI is intentionally cinematic; light mode changes the global semantic theme and non-study surfaces while the study hero retains its branded teal treatment for contrast.

## 11. Local development

Requirements: Node.js 22+, pnpm 10+, MySQL-compatible database, and optional provider credentials.

```bash
cp config/environment.template .env
# Edit .env with DATABASE_URL, SESSION_SECRET, OWNER_EMAIL, and APP_ORIGIN
pnpm install
pnpm db:push
pnpm dev
```

Open `http://localhost:3000` unless `PORT` or an occupied port causes the development server to select another port.

Useful commands:

```bash
pnpm check                         # TypeScript validation
pnpm test -- --maxWorkers=1        # Full regression suite
pnpm build                         # Client and server production bundle
pnpm start                         # Run dist/index.js in production mode
pnpm audit --prod                  # Production dependency audit
pnpm format                        # Prettier formatting
```

For a local queue smoke test, configure a non-production `CRON_SECRET` and call:

```bash
curl -X POST http://localhost:3000/api/scheduled/process-pdf-queue \
  -H "x-cron-secret: $CRON_SECRET"
```

## 12. Production deployment checklist

1. Provision MySQL/TiDB and run migrations.
2. Configure encrypted server environment variables.
3. Use a strong random `SESSION_SECRET`.
4. Set the exact owner email and register/verify that account.
5. Configure transactional email before enabling account recovery in production.
6. Confirm `/healthz` and `/readyz`.
7. Confirm HTTPS, reverse proxy, CORS, and cookie behavior.
8. Configure private S3-compatible storage before accepting PDFs.
9. Configure an OpenAI-compatible provider only when AI review is ready.
10. Run the staging no-write test, then disable `STAGING_AI_TEST_MODE` before production.
11. Add the external cron call for the durable queue.
12. Configure Razorpay only after creating a matching active 30-day plan.
13. Verify webhook delivery and idempotency in a non-production environment.
14. Set database backups, restore testing, log retention, and alerting.
15. Do not commit `.env`, credentials, private source files, build output, or runtime logs.

## 13. Security and reliability controls

- HTTP-only signed session cookies.
- Salted scrypt password hashes.
- Single-use hashed auth tokens.
- Owner-only server procedures for privileged workflows.
- Private object storage with signed URLs and owner checks.
- Strict request body limits.
- Security headers including CSP, HSTS in production, referrer policy, and permissions policy.
- CORS allow-list.
- Correlation IDs and structured request completion logs.
- Database-backed rate limiting for auth, scoring, payment, intake, and webhook paths.
- Razorpay webhook signature verification and event idempotency.
- LLM request timeout and bounded retry behavior.
- Queue leases, retry backoff, dead-letter behavior, and scheduler leases.
- Graceful request draining on shutdown.
- Production configuration assertions that fail closed when required values are missing.

## 14. Testing status and conventions

The test suite covers:

- Local authentication, logout, verification, reset, and credential security.
- RBAC and owner-only route boundaries.
- Monthly free allowance and paid-access logic.
- Test engine state, scoring, negative marking, and resume behavior.
- AI extraction schemas, validation fallback, quality scoring, and duplicate detection.
- Queue worker claims, retries, leases, dead letters, and scheduler guardrails.
- PDF intake, owner audit ledger, and staging no-write extraction.
- Service probes and storage proxy privacy.
- Razorpay configuration, orders, and webhook validation.
- Theme preferences, landing CTAs, owner panels, auth UI, pricing, and mobile-oriented component states.
- Frontend security exposure checks to prevent server-only credentials from entering the browser bundle.

Always run TypeScript check, the full Vitest suite, a production build, and a production dependency audit before release.

## 15. Git guidance

The repository is intended to be portable and Git-friendly:

- Commit source, migrations, documentation, tests, lockfiles, and the small public media assets.
- Do not commit `.env` files, secrets, logs, `node_modules`, `dist`, database files, or platform metadata.
- Review `git status` before every commit.
- Use descriptive commits such as `feat: add owner AI intake audit` or `fix: restore local hero media`.
- Keep migrations and schema changes together in the same commit.
- Use a private Git repository if source or generated content is sensitive.

## 16. Known product boundaries

- AI drafts require human review and are not authoritative.
- Payment checkout remains disabled until real server-only Razorpay configuration exists.
- Email delivery is provider-dependent; local development can use a test provider or inspect adapter failures.
- Google sign-in is optional and not required for local password authentication.
- The included ambient videos are intentionally lightweight, abstract study visuals designed as safe local defaults. They can be replaced with properly licensed media by changing the two files or setting `VITE_MEDIA_BASE_URL`.

## 17. Release definition

A release is ready when:

- The database schema and migrations match.
- Production environment assertions pass.
- All tests pass.
- TypeScript passes.
- The production build succeeds.
- `pnpm audit --prod` reports no known vulnerabilities at the selected audit level.
- `/healthz` and `/readyz` respond correctly.
- The owner boundary is tested with both owner and non-owner identities.
- No secrets or managed-platform-only URLs appear in the browser bundle.
- The local media files or an explicitly configured public media base are available.
