# RCS Prototyping & UX/UI Standards

As a comprehensive Dev Hub, RiseCoreStudio must balance extreme data density with usability.

## 🎨 Design System: "Rise Dark"

**Primary theme:** deep dark mode by default. Developers stare at screens all day; the UI must be low-contrast and easy on the eyes.

| Token | Value | Usage |
| --- | --- | --- |
| Background | `#0f111a` | App background |
| Surfaces | `#1a1d27` | Panels, cards, headers |
| Cyber Blue | `#00f0ff` | Primary accent — active states |
| Neon Green | `#39ff14` | Success — passed pipelines, completed tickets |
| Crimson | `#ff3333` | Warning/Error — failed builds, approaching deadlines |

The Tailwind theme tokens live in `apps/web/app/globals.css` (`--color-rise-*`).

## 📐 Layout Principles

### The Workspace View (High Density)

| Region | Contents |
| --- | --- |
| Left sidebar | File tree / ticket context |
| Center top | Monaco code editor |
| Center bottom | Integrated xterm.js local terminal |
| Right sidebar | Real-time project chat and Git status |

### The PM Dashboard (Strategic View)

- Macro-level Gantt charts for Milestones.
- Kanban boards for ticket status.
- Quick-action modals for Git-link binding.

## 🔄 Interaction Guidelines

- **No "black box" automations** — since RCS avoids "AI automotive" behaviors, all automated state changes (e.g. a ticket moving to *Review* upon a merged PR) must display a clear toast notification explaining **why** the state changed.
- **Terminal safety** — the web-to-local terminal bridge must have a visible connection status indicator (**Red / Yellow / Green**) and a hard **"Disconnect"** kill switch that terminates the local shell.
