# RCS Repository Structure

npm-workspaces monorepo. Build order: `shared → api → rcs-cli → web`.

```
RCS/
├── apps/
│   ├── api/                  # Express + TypeScript backend (port 4000)
│   │   ├── src/
│   │   │   ├── index.ts      # bootstrap: seeds Admin + demo tickets, mounts routes, attaches chat WS
│   │   │   ├── config.ts     # env-driven config (PORT, RCS_JWT_SECRET, REDIS_URL, …)
│   │   │   ├── store.ts      # in-memory data store (dev fallback for PostgreSQL)
│   │   │   ├── middleware.ts # requireAuth (JWT) + requireRole (RBAC)
│   │   │   ├── chat.ts       # /chat WebSocket — per-project channels
│   │   │   ├── auth/
│   │   │   │   ├── password.ts   # 16-char cryptographic password generator
│   │   │   │   ├── otp.ts        # OTP store — Redis or in-memory, strict 5-min TTL
│   │   │   │   └── tokens.ts     # JWT sign/verify (session + bridge audiences)
│   │   │   └── routes/
│   │   │       ├── auth.ts       # apply → OTP → login → magic link → bridge tokens
│   │   │       ├── admin.ts      # application review, user list (admin-only)
│   │   │       ├── tickets.ts    # CRUD + deterministic state transitions
│   │   │       └── webhooks.ts   # Git Sync Agent: merged PR "RCS-<id>" → advance ticket
│   │   └── test/             # node:test suites (password, OTP, state machine)
│   │
│   └── web/                  # Next.js App Router frontend (port 3000)
│       ├── app/
│       │   ├── layout.tsx    # Rise Dark shell: top nav + ToastProvider
│       │   ├── page.tsx      # landing
│       │   ├── workspace/    # THE core view: file tree + Monaco + xterm + chat/git
│       │   ├── board/        # Kanban with drag-and-drop (one state forward)
│       │   ├── login/        # 16-char credential login
│       │   ├── apply/        # onboarding form + OTP verification
│       │   ├── admin/        # application approval → magic link
│       │   └── logs/         # SystemLogs viewer ("zero magic")
│       ├── components/       # EditorPane, TerminalPane, FileTree, ChatPanel, …
│       └── lib/              # typed API client, session storage, sample project
│
├── packages/
│   ├── shared/               # @rcs/shared — single source of truth for types
│   │   └── src/index.ts      # roles, ticket state machine, WS protocols, constants
│   │
│   └── rcs-cli/              # @rcs/cli — Local Bridge Agent daemon (port 3711)
│       └── src/
│           ├── index.ts      # WebSocket server, JWT auth, session lifecycle
│           ├── shell.ts      # PTY spawn (node-pty) with line-mode pipe fallback
│           ├── files.ts      # workspace file access (tree/read/write, root-jailed)
│           └── git.ts        # real `git status` for the Workspace Git panel
│
├── scripts/
│   └── provision-vps.sh      # one-time production server setup (run as root)
├── .env.example              # all environment variables, documented
├── confidentials/            # secrets (VPS credentials) — gitignored, never printed
├── CLAUDE.md                 # AI-assistant guidance
├── AGENT.md                  # deterministic agent rules
├── PROTOTYPE.md              # UX/UI standards ("Rise Dark")
├── DEPLOYMENT.md             # VPS deployment guide
└── README.md                 # product vision + getting started
```

## How the pieces connect

```
┌─────────────────────────── Browser (apps/web) ───────────────────────────┐
│  Monaco editor   xterm.js terminal   Kanban / Admin / Logs   Chat panel  │
└──────┬──────────────────┬──────────────────────┬──────────────┬──────────┘
       │ REST (JWT)       │ ws://localhost:3711  │ REST (JWT)   │ ws /chat
       ▼                  ▼                      ▼              ▼
┌── apps/api :4000 ──┐  ┌─ packages/rcs-cli :3711 ─┐   ┌── apps/api :4000 ──┐
│ auth / tickets /   │  │ verifies bridge JWT,     │   │ chat channels      │
│ admin / webhooks / │  │ spawns LOCAL shell,      │   └────────────────────┘
│ logs               │  │ relays term:* messages   │
└────────────────────┘  └──────────────────────────┘
       ▲
       │ shared types: roles, ticket states, WS protocol
       └────────────── packages/shared (imported by all three)
```

- The **bridge token** is issued by the API (`POST /auth/bridge-token`, audience `bridge`) and verified by RCS-CLI — both sides share `RCS_JWT_SECRET`.
- The bridge protocol is defined once in `packages/shared` with runtime parsers used on both ends:
  - terminal: `term:auth`, `term:input`, `term:output`, `term:resize`, `term:ready`, `term:exit`, `term:error`
  - file sync (real files on the developer's machine): `fs:list` → `fs:tree`, `fs:read` → `fs:file`, `fs:write` → `fs:ok` / `fs:error`
  - git: `git:status` → `git:state` (live `git status` for the Workspace Git panel)
- In the browser, `components/BridgeProvider.tsx` owns the single bridge socket; the terminal, file explorer, and Git panel all share it.
- **Configuration**: `apps/api` and `packages/rcs-cli` auto-load the root `.env` (see `.env.example`); `apps/web` uses `apps/web/.env.local` for the `NEXT_PUBLIC_*` URLs.
- **Storage**: OTPs go to Redis when `REDIS_URL` is set (in-memory TTL store otherwise, same strict 5-minute expiry). Entity storage is the in-memory `Store` class behind method boundaries, ready to be swapped for PostgreSQL (`DATABASE_URL`). No dummy data is seeded by default (`RCS_SEED_DEMO=true` opts in for demos).
