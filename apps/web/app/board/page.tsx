"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ROLES,
  TICKET_NEXT_STATUS,
  TICKET_STATUSES,
  type Role,
  type Ticket,
  type TicketStatus,
} from "@rcs/shared";
import { ApiError, createTicket, listTickets, transitionTicket } from "@/lib/api";
import { loadSession } from "@/lib/session";
import { useToast } from "@/components/ToastProvider";

const COLUMN_LABELS: Record<TicketStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  complete: "Complete",
};

const STATUS_ACCENT: Record<TicketStatus, string> = {
  todo: "border-rise-muted",
  in_progress: "border-rise-accent",
  review: "border-rise-warning",
  complete: "border-rise-success",
};

export default function BoardPage() {
  const [tickets, setTickets] = useState<readonly Ticket[]>([]);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    try {
      const result = await listTickets();
      setTickets(result.tickets);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setLoggedIn(false);
        return;
      }
      toast("error", error instanceof Error ? error.message : "failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const session = loadSession();
    setLoggedIn(session !== null);
    setRole(session?.user.role ?? null);
    if (session !== null) void refresh();
    else setLoading(false);
  }, [refresh]);

  async function moveTicket(ticket: Ticket, to: TicketStatus): Promise<void> {
    if (ticket.status === to) return;
    const legalNext = TICKET_NEXT_STATUS[ticket.status];
    if (legalNext !== to) {
      toast(
        "error",
        `${ticket.ref} can't jump ${ticket.status} → ${to}. The state machine only allows ${ticket.status} → ${legalNext ?? "nothing (complete is terminal)"}.`,
      );
      return;
    }
    try {
      const result = await transitionTicket(ticket.id, to);
      setTickets((prev) =>
        prev.map((t) => (t.id === result.ticket.id ? result.ticket : t)),
      );
      toast(
        "success",
        `${ticket.ref} moved to ${COLUMN_LABELS[to]}. The change is recorded in Activity.`,
      );
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "transition failed");
    }
  }

  if (loggedIn === false) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-rise-muted">The Kanban board is role-gated.</p>
        <Link href="/login" className="text-rise-accent hover:underline">
          Log in to view tickets →
        </Link>
      </div>
    );
  }

  if (loading || loggedIn === null) {
    return (
      <div className="space-y-6 p-6 sm:p-8" aria-busy="true" aria-label="Loading delivery board">
        <div className="h-10 w-64 animate-pulse rounded bg-rise-surface-2" />
        <div className="grid gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-72 animate-pulse rounded-xl border border-rise-border bg-rise-surface" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-rise-accent">Execution</p>
          <h1 className="font-display mt-2 text-4xl">Delivery Board</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-rise-muted">
            Track work through a clear, forward-only delivery process. Every
            transition is attributable and retained in the activity history.
          </p>
        </div>
        {(role === "admin" || role === "pm") && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="shrink-0 rounded-full bg-rise-accent px-4 py-2 text-sm font-semibold text-rise-bg transition-transform hover:scale-105"
          >
            + New ticket
          </button>
        )}
      </div>
      {/* Developer XP & Leaderboard Section with Sprint Velocity */}
      <section className="rounded-xl border border-rise-border bg-rise-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rise-border/40 pb-3">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-widest text-rise-accent">
              Agency Leaderboard & Sprint Velocity
            </h2>
            <p className="mt-0.5 text-xs text-rise-muted">
              Monthly developer velocity, ticket completions, and skill rank progression.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="font-mono text-xs text-right">
              <span className="text-rise-muted">Sprint Target: </span>
              <span className="font-bold text-rise-success">42 / 50 Story Points (84%)</span>
            </div>
            <span className="rounded-full bg-rise-gold/10 border border-rise-gold/30 px-3 py-1 font-mono text-xs text-rise-gold">
              🏆 Active Season 1
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-rise-border bg-rise-bg p-3.5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rise-gold/20 text-rise-gold text-lg font-bold">
              🥇
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-rise-text truncate">Pai Htoo Khant</span>
                <span className="font-mono text-xs text-rise-gold font-bold">12,400 XP</span>
              </div>
              <p className="text-[11px] text-rise-muted font-mono">Legend • Admin Lead</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-rise-surface-2">
                <div className="h-full bg-rise-gold w-full" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-rise-border bg-rise-bg p-3.5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rise-accent/20 text-rise-accent text-lg font-bold">
              🥈
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-rise-text truncate">Filip</span>
                <span className="font-mono text-xs text-rise-accent font-bold">8,900 XP</span>
              </div>
              <p className="text-[11px] text-rise-muted font-mono">Lead • Tech Co-Founder</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-rise-surface-2">
                <div className="h-full bg-rise-accent w-[89%]" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-rise-border bg-rise-bg p-3.5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-lg font-bold">
              🥉
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-rise-text truncate">Shayy</span>
                <span className="font-mono text-xs text-blue-400 font-bold">7,800 XP</span>
              </div>
              <p className="text-[11px] text-rise-muted font-mono">Lead • Co-Founder</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-rise-surface-2">
                <div className="h-full bg-blue-400 w-[78%]" />
              </div>
            </div>
          </div>
        </div>
      </section>
      {tickets.length === 0 && (
        <p className="rounded border border-rise-border bg-rise-surface px-4 py-3 text-sm text-rise-muted">
          No tickets yet.{" "}
          {role === "admin" || role === "pm"
            ? "Create the first one with “+ New ticket”."
            : "A PM or Admin creates tickets; they will appear here."}
        </p>
      )}
      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TICKET_STATUSES.map((status) => (
          <div
            key={status}
            className="flex min-h-72 flex-col rounded-xl border border-rise-border bg-rise-surface"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/rcs-ticket");
              const ticket = tickets.find((t) => t.id === id);
              if (ticket !== undefined) void moveTicket(ticket, status);
            }}
          >
            <div className="flex items-center justify-between border-b border-rise-border px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-rise-muted">
                {COLUMN_LABELS[status]}
              </span>
              <span className="text-xs text-rise-muted">
                {tickets.filter((t) => t.status === status).length}
              </span>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
              {tickets
                .filter((ticket) => ticket.status === status)
                .map((ticket) => (
                  <div
                    key={ticket.id}
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData("text/rcs-ticket", ticket.id)
                    }
                    className={`cursor-grab rounded-lg border border-rise-border border-l-2 bg-rise-surface-2 p-3 shadow-sm transition-transform hover:-translate-y-0.5 ${STATUS_ACCENT[status]}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-rise-accent font-semibold">
                        {ticket.ref}
                      </span>
                      <span className="rounded bg-rise-bg px-1.5 py-0.5 text-[10px] uppercase text-rise-muted">
                        {ticket.assigneeRole}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium leading-snug">{ticket.title}</p>
                    {ticket.description.length > 0 && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-rise-muted">{ticket.description}</p>
                    )}

                    {/* Quick Review / Move Action Button */}
                    <div className="mt-3 pt-2 border-t border-rise-border/40 flex items-center justify-between text-xs">
                      {ticket.status !== "complete" && (
                        <button
                          type="button"
                          onClick={() => void moveTicket(ticket, TICKET_NEXT_STATUS[ticket.status]!)}
                          className="rounded bg-rise-accent/15 border border-rise-accent/30 px-2 py-0.5 text-[11px] font-mono text-rise-accent hover:bg-rise-accent hover:text-rise-bg transition-colors"
                        >
                          Move → {COLUMN_LABELS[TICKET_NEXT_STATUS[ticket.status]!]}
                        </button>
                      )}
                      {ticket.status === "complete" && (
                        <span className="font-mono text-[10px] text-rise-success font-semibold">✓ COMPLETE</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateTicketForm({
  onClose,
  onCreated,
}: {
  onClose(): void;
  onCreated(ticket: Ticket): void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeRole, setAssigneeRole] = useState<Role>("frontend");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  return (
    <form
      className="grid gap-4 rounded-xl border border-rise-border bg-rise-surface p-5 md:grid-cols-2 xl:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setErrors({});
        createTicket({ title, description, assigneeRole, projectId })
          .then((result) => onCreated(result.ticket))
          .catch((error: unknown) => {
            if (error instanceof ApiError && error.issues) {
              const fieldErrors: Record<string, string> = {};
              for (const issue of error.issues) {
                const path = issue.path.join(".");
                fieldErrors[path] = issue.message;
              }
              setErrors(fieldErrors);
              toast("error", "Please fix the validation errors below.");
            } else {
              toast("error", error instanceof Error ? error.message : "create failed");
            }
          })
          .finally(() => setBusy(false));
      }}
    >
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-rise-muted">
        Title
        <input
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded border border-rise-border bg-rise-bg px-2 py-1.5 text-sm text-rise-text outline-none focus:border-rise-accent"
        />
        {errors.title && <span className="text-xs text-rise-error">{errors.title}</span>}
      </label>
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-rise-muted">
        Description
        <input
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="rounded border border-rise-border bg-rise-bg px-2 py-1.5 text-sm text-rise-text outline-none focus:border-rise-accent"
        />
        {errors.description && <span className="text-xs text-rise-error">{errors.description}</span>}
      </label>
      <label className="flex flex-col gap-1 text-xs text-rise-muted">
        Assignee role
        <select
          value={assigneeRole}
          onChange={(event) => setAssigneeRole(event.target.value as Role)}
          className="rounded border border-rise-border bg-rise-bg px-2 py-1.5 text-sm text-rise-text outline-none focus:border-rise-accent"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {errors.assigneeRole && <span className="text-xs text-rise-error">{errors.assigneeRole}</span>}
      </label>
      <label className="flex flex-col gap-1 text-xs text-rise-muted">
        Project ID (UUID)
        <input
          required
          placeholder="e.g. project-uuid"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          className="rounded border border-rise-border bg-rise-bg px-2 py-1.5 text-sm text-rise-text outline-none focus:border-rise-accent"
        />
        {errors.projectId && <span className="text-xs text-rise-error">{errors.projectId}</span>}
      </label>
      <div className="flex items-end gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-rise-accent px-3 py-1.5 text-sm font-semibold text-rise-bg disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create ticket"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-rise-border px-3 py-1.5 text-sm text-rise-muted hover:text-rise-text"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
