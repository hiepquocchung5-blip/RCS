# RCS Repository Guidance

RiseCoreStudio is an agency delivery platform. Refer to it as **RCS** or **RiseCoreStudio**.

## Product direction

Prioritize client services, project planning, team formation, transparent delivery and role-aware operations. RCS is not a browser IDE and does not execute developer code. Development happens in each engineer's normal toolchain.

## Engineering rules

- Use strict TypeScript and avoid `any`.
- Use Tailwind CSS and the tokens in `apps/web/app/globals.css`.
- Keep state transitions deterministic and visible to users.
- Every automated action writes an activity entry.
- Enforce RBAC at the API boundary, never only in the interface.
- Passwords are exactly 16 cryptographically generated characters.
- OTPs are six digits and expire after exactly five minutes.
- Never print or commit anything from `confidentials/`.

## Commands

```bash
npm install
npm run dev
npm run build
npm run typecheck
npm run test
```

## Architecture

- `apps/web` — Next.js client, delivery portal and public client experience.
- `apps/api` — Express API, authentication, RBAC, projects, orders, tickets, logs and chat.
- `packages/shared` — shared domain types, state rules and chat protocol.

See `README.md`, `STRUCTURE.md`, `AGENT.md`, `PROTOTYPE.md` and `DEPLOYMENT.md` for the complete context.
