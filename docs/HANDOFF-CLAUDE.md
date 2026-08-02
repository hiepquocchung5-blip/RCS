# RCS engineering handoff for Claude

Updated: 2026-08-02

## Mission

Continue evolving RiseCoreStudio into a professional agency delivery platform. Do not reintroduce the removed Workspace/browser-IDE/CLI bridge. Product priorities are client acquisition, scoped project delivery, team operations, developer growth, secure automation and client trust.

## Start here

1. Read `CLAUDE.md`, `AGENT.md` and `docs/MUST-HAVE-FEATURES.md` completely.
2. Run `git status --short` before editing.
3. Preserve existing dirty changes. At handoff time these included:
   - `apps/web/app/projects/[id]/page.tsx`
   - `apps/web/components/PortalNavigation.tsx`
   - `docs/MUST-HAVE-FEATURES.md` (new documentation)
4. Never read, print, commit or quote secrets from `confidentials/`.

## Recently completed

- Public client request pipeline with optional Telegram username and asynchronous bot notification.
- Telegram Mini-App initialization, authenticated bot webhook secret and secure account lookup. Bot commands no longer create shared-password accounts or disclose passwords.
- API-backed Season 1 leaderboard and XP/rank presentation.
- API-backed operations status for uptime, memory, storage, Redis and Telegram configuration; `/logs` refreshes periodically.
- Strict configured-origin/trusted-subdomain CORS matching. Do not restore permissive fallbacks.
- Runtime-generated founder seed credentials; founder passwords are no longer embedded in source.
- PostgreSQL migrations/repositories, Zod request validation, rate limits, OTP attempt controls, signed GitHub webhooks, request IDs, readiness checks and Prometheus metrics.
- Project detail chat, milestones, owners, deadlines, health, request-to-project conversion, showcase device sandbox, PWA shell and mobile navigation.

Recent commits already on `main`/`origin/main` at handoff included:

- `8dbc04f` — stock cap-table export plus leaderboard/operations improvements
- `4243ad7` — sprint velocity and ticket actions plus security/API improvements

Confirm the live history rather than assuming these hashes remain HEAD.

## Verification baseline

- `npm run typecheck`: passed.
- `npm test`: 23/23 API tests passed.
- Shared and API TypeScript production builds passed.
- The Next.js production build did not complete because Next attempted to download its SWC compiler and stalled. This was an environment/toolchain download issue, not a reported TypeScript error. Retry with a supported Node LTS release (Node 20 or 22) and a working package network/cache.

## Highest-priority next implementation

### 1. Server-authoritative milestone sign-off and certificates

The current project UI generates certificate material in the browser. Replace this with:

- a migration for certificate/sign-off records;
- an authorized API endpoint with a Zod schema;
- an immutable canonical payload and server-side SHA-256/HMAC signature;
- audit log entries and idempotency protection;
- a verification endpoint that exposes no private project data;
- HTTP tests for client authorization, project isolation, replay and tampering;
- frontend download/rendering from the API response.

Do not call a browser-generated identifier a cryptographic certificate.

### 2. Real XP awards

The leaderboard reads persisted XP, but the award pipeline needs explicit business rules. Define deterministic XP events (for example reviewed ticket completion), make awards idempotent, persist an XP ledger and test duplicate webhook/transitions. Avoid allowing clients to submit arbitrary XP values.

### 3. Real Lighthouse artifacts

Current showcase scores are presentation values. Add a CI job that generates Lighthouse JSON for approved public URLs, persists/imports the result and displays the audit timestamp. Label unavailable data honestly.

### 4. Operations telemetry adapter

`/operations/status` exposes API-process metrics, not complete PM2 host CPU data. Add a least-privilege collector or PM2 adapter if VPS-level telemetry is required. Keep the endpoint Admin/PM-only and never expose environment variables, command execution or raw secrets.

### 5. Acceptance and browser coverage

Add tests for Telegram webhook secrets, rejected CORS lookalikes, leaderboard authorization, operations authorization, request latency behavior, service-worker offline fallback and mobile navigation accessibility.

## Production blockers

Do not describe the system as live until these are resolved and verified:

- `risecorestudio.com` DNS records were not resolving during the last deployment attempt.
- Git push previously received an authorization error for the configured GitHub identity; re-check current remote state before pushing.
- The VPS SSH host key changed. Verify its fingerprint through the hosting provider before changing `known_hosts` or reconnecting. Never bypass host-key checking.
- Rotate the VPS root credential because it was exposed in earlier command output. Do not reuse it.
- Production still needs PostgreSQL, Redis, SMTP, Telegram, GitHub webhook, JWT, TLS and cookie-domain secrets/configuration.

## Definition of done

For each feature:

1. Domain contract and authorization are enforced by the API.
2. PostgreSQL and in-memory development behavior remain compatible where intended.
3. Every automated mutation creates an activity record.
4. Runtime schemas reject malformed input.
5. HTTP tests cover the happy path, RBAC, isolation and replay/error cases.
6. `npm run typecheck`, `npm test` and `npm run build` pass.
7. Documentation distinguishes implemented, configured and production-verified states.

## Suggested first command sequence

```bash
git status --short
git diff --check
npm run typecheck
npm test
```

Do not clean, reset or overwrite dirty files to make these commands pass.
