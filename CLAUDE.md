# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# RCS Repository Guidance

RiseCoreStudio is an agency delivery platform. Refer to it as **RCS** or **RiseCoreStudio**.

## Product direction

Prioritize client services, project planning, team formation, transparent delivery and role-aware operations. RCS is not a browser IDE and does not execute developer code. Development happens in each engineer's normal toolchain.

## Commands

```bash
npm install
npm run dev          # api (port 4000) + web (port 3000) concurrently
npm run dev:api      # API only (tsx watch)
npm run dev:web      # web only
npm run build        # builds in dependency order: shared → api → web
npm run typecheck    # all workspaces
npm run test         # all workspaces (only apps/api has tests)
```

Tests use the Node.js built-in test runner via `tsx` and live in `apps/api/test/`:

```bash
npm run test -w apps/api                          # all API tests
npx tsx --test apps/api/test/tickets.test.ts      # a single test file
```

Database migrations (ordered SQL files in `apps/api/migrations/`, tracked in `schema_migrations`, safe to re-run):

```bash
npm run db:migrate -w apps/api    # requires DATABASE_URL
```

Configuration is documented in `.env.example`. No demo content is seeded unless `RCS_SEED_DEMO=true`.

## Architecture

npm-workspaces monorepo, build order `shared → api → web`:

- `packages/shared` (`@rcs/shared`) — **the single source of truth for domain rules**: roles, skill levels, project types, ticket state machine, chat protocol, password/OTP constants. One file: `packages/shared/src/index.ts`. Start there when touching business logic. It must not depend on either app.
- `apps/api` — Express + TypeScript. Owns authentication, RBAC, validation (zod), state transitions and activity logging. Route handlers in `src/routes/` coordinate all domain operations through the `Store` class (`src/store.ts`). Also serves the `/chat` WebSocket (`src/chat.ts`).
- `apps/web` — Next.js App Router + Tailwind. Owns presentation, browser session persistence and typed API calls (`lib/api.ts`, `lib/session.ts`). It must never make an authorization decision the API does not also enforce.

### Dual-mode persistence

`Store` serves two modes behind one async method boundary: with `DATABASE_URL` set it persists everything in PostgreSQL (SQL contracts in `src/repositories/`); without it, an in-memory dev adapter with identical behavior. OTPs likewise use Redis when `REDIS_URL` is set, else in-memory, with the same 5-minute expiry. All `Store` mutations return Promises so both adapters stay interchangeable.

### Domain invariants

- Ticket transitions are forward-only and never skip states: `todo → in_progress → review → complete` (`TICKET_NEXT_STATUS` in shared). Tickets carry a human ref like `RCS-142`, matched by the GitHub webhook to advance exactly one state per merged PR.
- Roles are `admin`, `pm`, `devops`, `frontend`, `backend`; users also carry a skill level (`intern` → `senior`) used by the team engine for staffing against a project's `resourceMatrix`.
- Onboarding: application → 6-digit OTP (5-minute TTL) → admin approval → generated 16-character credential delivered via one-time magic link → 12-hour session token.
- Chat channels are strictly siloed by id: `project:<id>` (team members + admin/pm), `role:<role>`, `tech:<slug>`. Sockets authenticate with the session JWT, replay the last 50 messages on join, and are rate-limited to 5 posts per 10 seconds.
- Public showcase endpoints serve an explicit client-safe projection (`ShowcaseProject`), never full `Project` records.
- At boot the API seeds one admin from `RCS_ADMIN_EMAIL`/`RCS_ADMIN_PASSWORD` and optional founder admins from `RCS_FOUNDERS`; generated credentials are printed once and never stored in plain text.

## Engineering rules

- Use strict TypeScript and avoid `any`.
- Use Tailwind CSS and the tokens in `apps/web/app/globals.css`.
- Keep state transitions deterministic and visible to users.
- Every automated action writes an activity entry (`SystemLogEntry`); automation cannot delete projects, remove users or merge code.
- Enforce RBAC at the API boundary, never only in the interface.
- Passwords are exactly 16 cryptographically generated characters.
- OTPs are six digits and expire after exactly five minutes.
- Never print or commit anything from `confidentials/`.

## Documentation map

`docs/BRIEF.md` (product purpose), `docs/ARCHITECTURE.md` (boundaries and decisions), `docs/INFRASTRUCTURE.md` and `DEPLOYMENT.md` (VPS topology), `docs/OPERATIONS.md` (live URLs and health checks), `STRUCTURE.md` (repo map), `AGENT.md` (deterministic automation rules — RCS "agents" are background workers and webhook listeners, not generative AI), `PROTOTYPE.md` (interface and product-language standards).
