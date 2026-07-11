# RCS Repository Structure

RCS is an npm-workspaces monorepo. Build order: `shared → api → web`.

For system boundaries and deployment topology, see `docs/ARCHITECTURE.md` and `docs/INFRASTRUCTURE.md`.

```text
RCS/
├── apps/
│   ├── api/
│   │   ├── src/index.ts          # API bootstrap, routes and chat server
│   │   ├── src/store.ts          # entity storage boundaries
│   │   ├── src/auth/             # OTP, password and session tokens
│   │   └── src/routes/           # auth, admin, orders, projects, tickets, webhooks
│   └── web/
│       ├── app/                  # Next.js routes
│       ├── components/           # shared interface components
│       └── lib/                  # API and session clients
├── packages/shared/              # shared domain types and runtime contracts
└── scripts/provision-vps.sh      # production server provisioning
```

## Application flow

The browser communicates with the API over authenticated REST endpoints. Project chat uses the API's `/chat` WebSocket and authorizes access against project membership. Both applications import roles, project types, ticket rules and chat messages from `@rcs/shared`.

Public routes expose the showcase and client request flow. Internal routes require a session and enforce `admin`, `pm`, `devops`, `frontend` or `backend` permissions. Ticket transitions always follow `todo → in_progress → review → complete`.

OTPs use Redis when `REDIS_URL` is configured and otherwise use the development memory adapter with the same five-minute expiry. Entity data (including chat history) persists in PostgreSQL when `DATABASE_URL` is configured; without it the `Store` falls back to the in-memory development adapter.
