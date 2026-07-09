# RCS Internal Agent Rules (Non-Generative Automation)

RiseCoreStudio utilizes deterministic **"Agents"** (background workers, cron jobs, webhook listeners) to handle repetitive tasks. These are **NOT** generative AI agents; they are strict logic processors.

## Agent Responsibilities

### Onboarding Agent

- Listens for OTP verification events.
- Handles the 16-character password generation algorithm securely.
- Dispatches secure email communications.

*Implementation:* `apps/api/src/auth/` (password + OTP) and `apps/api/src/routes/auth.ts` / `routes/admin.ts` (pipeline).

### Git Sync Agent

- Listens for GitHub webhooks.
- When a PR is merged with a ticket ID in the title (e.g. `RCS-142`), the Agent automatically transitions the ticket status **one legal state forward** and notifies the PM.

*Implementation:* `apps/api/src/routes/webhooks.ts`.

### Local Bridge Agent (RCS-CLI)

- A local Node.js daemon installed by the developer (`npm run rcs-cli`).
- Authenticates with the RCS backend via a secure JWT (audience `bridge`).
- Pipes local stdin/stdout securely to the web frontend's xterm.js interface.

*Implementation:* `packages/rcs-cli/`.

## Execution Constraints

- **Zero Magic** — Agents must write logs for **every** action to the SystemLogs store (`GET /logs` in the API, "SystemLogs" page in the web app).
- **Human Approval** — Agents cannot delete projects, fire users, or merge code directly. They can only stage actions or transition ticket states based on external triggers.
- **Never skip states** — ticket transitions always follow `todo → in_progress → review → complete`, one step at a time (see `TICKET_NEXT_STATUS` in `packages/shared`).
