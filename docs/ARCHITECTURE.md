# Architecture

## System context

RCS serves two audiences from one product:

- Clients use public pages to review work and submit a project request.
- Approved team members authenticate into the Dev Hub to manage projects, staffing and delivery.

```text
Client or team browser
        │
        ├── HTTPS ──> Next.js web application
        │                 │
        │                 └── REST with bearer session ──> Express API
        │
        └── WSS with session token ──────────────────────> Project chat
                                                          │
                                      ┌───────────────────┴──────────────────┐
                                      │                                      │
                                Entity store                           OTP store
                        PostgreSQL (DATABASE_URL)                 Redis (REDIS_URL) or
                        or in-memory dev fallback                 in-memory dev fallback
```

## Application boundaries

`apps/web` owns presentation, browser session persistence and typed API calls. It must not make authorization decisions that the API does not also enforce.

`apps/api` owns authentication, permissions, validation, state transitions and activity recording. Route handlers coordinate domain operations through `Store` methods.

`packages/shared` owns stable contracts used on both sides: roles, skill levels, projects, ticket states and chat messages. It must not depend on either application.

## Authentication flow

1. A candidate submits an application.
2. The API issues a one-time six-digit OTP with a five-minute TTL.
3. An Admin approves the verified application.
4. RCS generates a 16-character credential and exposes it through a one-time link.
5. Login returns a 12-hour signed session token.
6. The browser stores the session in a cookie scoped to the apex domain (`NEXT_PUBLIC_RCS_COOKIE_DOMAIN`), so one login is valid across every subdomain, and presents the token to protected REST routes and when joining chat.

The header deliberately exposes one public entry to authentication: **Dev Hub**. After login, the user is sent to `/projects` and internal navigation becomes available. Browsers that open the auth API host directly are redirected to the portal login page (`RCS_LOGIN_REDIRECT_URL`).

## Authorization model

- `admin` — applications, users, client requests and all delivery data.
- `pm` — project scoping, staffing and ticket planning.
- `devops`, `frontend`, `backend` — assigned project work and team collaboration.

Project chat is membership-aware. Ticket movement is a forward-only state machine: `todo → in_progress → review → complete`.

## Persistence boundary

The `Store` class serves two modes behind one method boundary: with `DATABASE_URL` set it persists every entity — users, applications, projects, tickets, orders, chat history and the activity log — in PostgreSQL; without it, it falls back to an in-memory development adapter with identical behavior. Production always runs with `DATABASE_URL` set.

The relational schema lives in `apps/api/migrations/` (`001_initial.sql`, `002_add_project_links_and_reactions.sql`, `003_chat_messages.sql`); repository contracts live in `apps/api/src/repositories/contracts.ts`. Run `npm run db:migrate -w apps/api` with `DATABASE_URL` set to apply pending migrations — the runner records applied names in `schema_migrations` and is safe to re-run.

## Architecture decisions

- Development tools and code execution remain outside RCS.
- Project chat stays in the API because authorization depends on RCS membership; messages persist durably, the last 50 replay on join, and each socket is limited to 5 posts per 10 seconds.
- Automated transitions are deterministic and recorded in the activity history.
- Public showcase responses use an explicit client-safe projection.
- CORS allows exact configured origins plus HTTPS subdomains of one trusted apex domain — never a plain suffix match, which lookalike domains could pass.
