# 🚀 RiseCoreStudio (RCS)

**The Ultimate Developer Hub & Agency CMS**

RiseCoreStudio is a dual-portal ecosystem designed for high-performance software agencies. It bridges the gap between client-facing project showcases (User Portal) and complex internal development workflows (Developer Portal).

## 🌟 Core Philosophy

RCS is a Dev Hub built for **control** and **precision**. We emphasize robust, deterministic automation (CI/CD, webhooks, cron jobs) over unpredictable AI generation. Every action is tracked, role-gated, and designed for human-in-the-loop validation.

## 🔥 Rich Dynamic Features

### 1. Dual Portal Architecture

- **User Showcase Portal** — a high-performance, SEO-optimized public site displaying completed projects (flagged `is_public=true`).
- **RCS Dev Hub (Internal)** — the nerve center for our teams, protected by advanced authentication.

### 2. Advanced Onboarding Pipeline

1. Developer applies via form (GitHub, CV, role).
2. System issues a secure **6-digit OTP** via email (strict 5-minute expiry).
3. Admin reviews the application.
4. Upon approval, the system generates a cryptographically secure **16-character password** (mixed cases, numbers, symbols).
5. Credentials are sent securely via a **one-time magic link**.

### 3. Role-Based Access Control (RBAC)

| Role | Capabilities |
| --- | --- |
| **Admin** | Complete system override, user generation, high-level client Orders |
| **Project Manager (PM)** | Scopes Orders into Projects, creates Git links, defines Milestones, assigns Tickets |
| **DevOps / Frontend / Backend** | Specialized dashboards for ticket execution, environment management, and code delivery |

### 4. Local-Synced Workspace (VS Code-like IDE)

Unlike purely cloud-based codespaces, RCS integrates with the developer's **local machine** for maximum performance:

- **Rich Editor** — integrated Monaco Editor (VS Code engine) in the browser for quick edits and reviews.
- **Local Terminal Bridge** — using xterm.js and a lightweight local daemon (**RCS-CLI**), the web portal establishes a secure WebSocket connection to the developer's local terminal. Run `npm run dev`, `docker-compose up`, etc. directly from the RCS web interface while utilizing your own local hardware.
- **Git Sync** — integrated push, pull, and PR management bound to specific RCS Tickets.

### 5. Communication & Tracking

- Real-time WebSocket chat divided by **Project Channels**.
- Dynamic **Kanban boards** with drag-and-drop ticket routing.

## 🛠 Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js (App Router), Tailwind CSS, Monaco Editor, xterm.js |
| Backend | Node.js / Express + TypeScript |
| Database | PostgreSQL (relational integrity) + Redis (real-time pub/sub & caching) |
| Connectivity | WebSockets (`ws`) for chat and the Local Terminal Bridge |

## ⚡ Getting Started

```bash
npm install        # install all workspaces
npm run dev        # API on :4000 + web on :3000
npm run rcs-cli    # local terminal bridge daemon on :3711 (separate terminal)
```

Then open <http://localhost:3000>:

1. The API prints the seeded **Admin** email and generated password on boot (pin it with `RCS_ADMIN_EMAIL` / `RCS_ADMIN_PASSWORD`).
2. Open **Workspace** and press **Connect** in the terminal pane — commands run on your machine through RCS-CLI.
3. Try the onboarding flow at **Apply** (the dev OTP is printed to the API console) and approve it from **Admin**.

Other useful commands: `npm run build`, `npm run typecheck`, `npm run test`.

## 📚 Documentation

| File | Contents |
| --- | --- |
| [STRUCTURE.md](STRUCTURE.md) | Repository layout and how the pieces connect |
| [AGENT.md](AGENT.md) | Deterministic agent rules (non-generative automation) |
| [PROTOTYPE.md](PROTOTYPE.md) | UX/UI standards and the "Rise Dark" design system |
| [DEPLOYMENT.md](DEPLOYMENT.md) | VPS deployment guide |
| [CLAUDE.md](CLAUDE.md) | Guidance for AI-assisted development in this repo |
