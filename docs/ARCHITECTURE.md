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
                           in-memory development                  Redis or development
                           PostgreSQL target                      memory adapter
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
6. The browser presents that token to protected REST routes and when joining chat.

The header deliberately exposes one public entry to authentication: **Dev Hub**. After login, the user is sent to `/projects` and internal navigation becomes available.

## Authorization model

- `admin` — applications, users, client requests and all delivery data.
- `pm` — project scoping, staffing and ticket planning.
- `devops`, `frontend`, `backend` — assigned project work and team collaboration.

Project chat is membership-aware. Ticket movement is a forward-only state machine: `todo → in_progress → review → complete`.

## Current persistence boundary

The `Store` class is an in-memory development implementation. Its method boundary reduces route coupling, but it is not durable or suitable for horizontal scaling. A production PostgreSQL repository must replace it before real client data is accepted. `DATABASE_URL` currently describes the intended deployment configuration; it does not yet activate a SQL adapter.

The initial relational schema lives in `apps/api/migrations/001_initial.sql`; repository contracts live in `apps/api/src/repositories/contracts.ts`. Run `npm run db:migrate -w apps/api` with `DATABASE_URL` set to apply the schema. Runtime repository implementations remain the next persistence task.

## Architecture decisions

- Development tools and code execution remain outside RCS.
- Project chat stays in the API because authorization depends on RCS membership.
- Automated transitions are deterministic and recorded in the activity history.
- Public showcase responses use an explicit client-safe projection.
