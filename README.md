# RiseCoreStudio (RCS)

RCS is an agency delivery platform for managing client requests, software projects, delivery teams and transparent execution in one place.

## Founders and mission

RiseCoreStudio was founded by **Filip**, **Shayy** and **Pai Htoo Khant**.

Our mission is to recruit and train young people in the technology field and guide them toward a high level of innovation. New developers join through the public application flow, verify their email with a one-time code, and — once approved — grow inside real project squads with mentorship from senior engineers.

## Product areas

- **Client experience** — a public showcase and structured project-request flow.
- **Project delivery** — project scoping, staffing plans, team assignment and team-managed technology profiles.
- **Execution** — deterministic ticket stages from `todo` through `complete`, with GitHub webhook support.
- **Team operations** — verified developer applications, role-based access and guided candidate matching.
- **Communication** — authenticated, project-specific real-time chat channels.
- **Accountability** — an activity history for automated and user-driven actions.

## Technology

| Layer | Technology |
| --- | --- |
| Web | Next.js App Router, React, TypeScript, Tailwind CSS |
| API | Node.js, Express, TypeScript |
| Real time | WebSockets for authenticated project chat with durable history |
| Storage | PostgreSQL (in-memory development fallback when `DATABASE_URL` is unset) |
| OTP | Redis in production with an in-memory development fallback |

## Getting started

```bash
npm install
npm run dev
```

The API starts on `http://localhost:4000` and the web app on `http://localhost:3000`. The API prints the seeded development Admin credentials on startup unless they are set through the environment.

Useful commands:

```bash
npm run build
npm run typecheck
npm run test
```

Configuration is documented in `.env.example`. No demo content is created unless `RCS_SEED_DEMO=true` is set.

### Seeded accounts

- **Admin** — one account from `RCS_ADMIN_EMAIL` / `RCS_ADMIN_PASSWORD`; when the password is unset, a fresh 16-character credential is generated and printed once at boot.
- **Founders** — optional Admin accounts from `RCS_FOUNDERS` (comma-separated `Name:email` pairs). Each founder receives a generated 16-character credential printed once at boot; change it after the first login. Accounts that already exist are never modified.

### New to this codebase?

Read in this order: [docs/BRIEF.md](docs/BRIEF.md) for what RCS is and who uses it, [STRUCTURE.md](STRUCTURE.md) for the repository map, then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the web app, API and shared package fit together. The API's domain rules (roles, ticket state machine, chat protocol) all live in `packages/shared/src/index.ts` — start there when you touch business logic.

## Documentation

- [docs/BRIEF.md](docs/BRIEF.md) — product purpose, audiences, journeys and priorities
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system boundaries, flows and decisions
- [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) — deployment topology, security and scaling
- [docs/PRODUCTION-READINESS.md](docs/PRODUCTION-READINESS.md) — implemented controls and launch gaps
- [docs/OPERATIONS.md](docs/OPERATIONS.md) — every live URL, access rules and production health checks
- [STRUCTURE.md](STRUCTURE.md) — concise repository map
- [AGENT.md](AGENT.md) — deterministic automation rules
- [PROTOTYPE.md](PROTOTYPE.md) — interface and product language standards
- [DEPLOYMENT.md](DEPLOYMENT.md) — VPS deployment guide
- [CLAUDE.md](CLAUDE.md) — repository guidance for assisted development
