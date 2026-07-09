# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RiseCoreStudio (RCS) — an internal agency Dev Hub & CMS. Always refer to the project as **RCS** or **RiseCoreStudio**. Full product vision lives in `README.md`, the annotated repo layout in `STRUCTURE.md`, deterministic-agent rules in `AGENT.md`, UX/design standards in `PROTOTYPE.md`, and the VPS deploy process in `DEPLOYMENT.md`.

## Strict Project Rules

- **Local-Synced Workspace paradigm**: Do NOT suggest spinning up Docker containers on the backend for code execution. The developer runs the **RCS-CLI** daemon locally, which exposes a WebSocket; the web frontend connects to it via **xterm.js**. Code executes on the developer's local machine, UI lives in the browser.
- **Authentication constraints**:
  - The Admin creates user profiles (developers apply, Admin approves).
  - Passwords must be **exactly 16 characters**, generated cryptographically, including symbols, numbers, and mixed-case letters.
  - OTPs (6-digit) must have a **strict 5-minute expiry in Redis**.
- **Code style**: Strict TypeScript — no `any` types. Tailwind CSS for styling. Favor deterministic logic (switch statements, map objects) over generative AI for internal state management. "Agents" in this codebase (see `AGENT.md`) are deterministic background workers/webhook listeners, never LLMs; every agent action must write to the SystemLogs store.
- **Development focus**: Prioritize the integration between the Monaco Editor, the xterm.js terminal UI, and the WebSocket bridge (RCS-CLI) that connects to the local development environment.
- **UX rules** (see `PROTOTYPE.md`): "Rise Dark" theme by default (background `#0f111a`, surfaces `#1a1d27`, primary accent `#00f0ff`, success `#39ff14`, error `#ff3333`). Automated state changes must surface a toast explaining why. The terminal bridge must show a Red/Yellow/Green connection indicator and a hard "Disconnect" kill switch.
- `confidentials/` holds secrets (VPS credentials). Never commit it, never print its contents, never reference its values in code.

## Repository Layout (npm workspaces monorepo)

- `apps/web` — Next.js (App Router) frontend: Workspace view (Monaco editor + xterm.js terminal + chat/git sidebar), Kanban, login/onboarding.
- `apps/api` — Express + TypeScript backend: JWT auth, RBAC (`admin | pm | devops | frontend | backend`), onboarding pipeline (OTP → admin approval → 16-char password), tickets, system logs. Redis is used for OTPs when `REDIS_URL` is set; an in-memory TTL store is the dev fallback (same 5-minute expiry).
- `packages/rcs-cli` — the local bridge daemon. Starts a WebSocket server on the developer's machine and pipes a local shell's stdin/stdout to the browser's xterm.js. Authenticates sessions with a JWT issued by the API.
- `packages/shared` — shared TypeScript types (roles, ticket states, WebSocket message protocol) used by all three.

## Commands

Run from the repo root:

- `npm install` — install all workspaces.
- `npm run dev` — start API (port 4000) and web (port 3000) together.
- `npm run dev:web` / `npm run dev:api` — start one app.
- `npm run rcs-cli` — start the local terminal bridge daemon (port 3711).
- `npm run build` — build all workspaces (shared → api → cli → web).
- `npm run typecheck` — strict `tsc --noEmit` across all workspaces.
- `npm run test` — run all tests (Node test runner); single workspace: `npm run test -w apps/api`.

## Architecture Notes

- **Terminal bridge flow**: browser xterm.js → `ws://localhost:3711` (RCS-CLI) with a JWT from the API in the connect payload. The CLI verifies the token, spawns a local shell, and relays I/O using the message protocol in `packages/shared` (`term:*`, plus `fs:*` for real file browse/save and `git:status` for the live Git panel — the Workspace never shows mock data). In the browser the single socket is owned by `components/BridgeProvider.tsx`. The web UI reflects socket state in the connection indicator and closes the socket on "Disconnect".
- **Configuration**: all env vars are documented in `.env.example` (root `.env` is auto-loaded by the API and RCS-CLI; `apps/web/.env.local` holds the `NEXT_PUBLIC_*` URLs). No demo data is seeded unless `RCS_SEED_DEMO=true`.
- **Onboarding pipeline** (`apps/api/src/auth`): apply → OTP issued (5-min TTL) → OTP verify → admin approval → `generatePassword()` produces the 16-char credential → magic-link token (one-time) delivers it.
- **Ticket state machine** is a deterministic map (`todo → in_progress → review → complete`); transitions triggered by external events (e.g., Git webhook with `RCS-<id>` in a merged PR title) are logged to SystemLogs and must never skip states.
