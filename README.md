# RiseCoreStudio (RCS)

RCS is an agency delivery platform for managing client requests, software projects, delivery teams and transparent execution in one place.

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
| Real time | WebSockets for authenticated project chat |
| Storage | PostgreSQL target with an in-memory development adapter |
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

## Documentation

- [docs/BRIEF.md](docs/BRIEF.md) — product purpose, audiences, journeys and priorities
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system boundaries, flows and decisions
- [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) — deployment topology, security and scaling
- [docs/PRODUCTION-READINESS.md](docs/PRODUCTION-READINESS.md) — implemented controls and launch gaps
- [STRUCTURE.md](STRUCTURE.md) — concise repository map
- [AGENT.md](AGENT.md) — deterministic automation rules
- [PROTOTYPE.md](PROTOTYPE.md) — interface and product language standards
- [DEPLOYMENT.md](DEPLOYMENT.md) — VPS deployment guide
- [CLAUDE.md](CLAUDE.md) — repository guidance for assisted development
