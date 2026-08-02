"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  PROJECT_TYPE_LABELS,
  TICKET_STATUSES,
  type Project,
  type ProjectHealth,
  type Ticket,
  type TicketStatus,
} from "@rcs/shared";
import { ApiError, createMilestone, getProject, listTickets, updateProjectDelivery } from "@/lib/api";
import { ChatPanel } from "@/components/ChatPanel";
import { loadSession } from "@/lib/session";
import { useToast } from "@/components/ToastProvider";

const STATUS_LABELS: Record<TicketStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  review: "In review",
  complete: "Complete",
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tickets, setTickets] = useState<readonly Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [health, setHealth] = useState<ProjectHealth>("on_track");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const session = loadSession();
  const canManage = session?.user.role === "admin" || session?.user.role === "pm";

  useEffect(() => {
    let active = true;
    Promise.all([getProject(params.id), listTickets()])
      .then(([projectResult, ticketResult]) => {
        if (!active) return;
        setProject(projectResult.project);
        setDeadline(projectResult.project.deadline ?? "");
        setOwnerId(projectResult.project.ownerId ?? "");
        setHealth(projectResult.project.health);
        setTickets(ticketResult.tickets.filter((ticket) => ticket.projectId === params.id));
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 403) {
          setError("You are not assigned to this project.");
        } else if (reason instanceof ApiError && reason.status === 404) {
          setError("This project could not be found.");
        } else {
          setError(reason instanceof Error ? reason.message : "Project unavailable");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.id]);

  const ticketCounts = useMemo(
    () => Object.fromEntries(TICKET_STATUSES.map((status) => [status, tickets.filter((ticket) => ticket.status === status).length])) as Record<TicketStatus, number>,
    [tickets],
  );

  if (loading) return <ProjectDetailSkeleton />;

  if (error !== null || project === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-rise-muted">{error ?? "Project unavailable"}</p>
        <Link href="/projects" className="text-rise-accent hover:underline">Return to Projects →</Link>
      </div>
    );
  }

  const plannedSeats = project.resourceMatrix.reduce((sum, row) => sum + row.count, 0);
  const staffingPercent = plannedSeats === 0 ? 100 : Math.min(100, Math.round((project.team.length / plannedSeats) * 100));
  const completedPercent = tickets.length === 0 ? 0 : Math.round((ticketCounts.complete / tickets.length) * 100);
  const projectId = project.id;

  async function saveDelivery(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const result = await updateProjectDelivery(projectId, {
        deadline: deadline.length > 0 ? deadline : null,
        ownerId: ownerId.length > 0 ? ownerId : null,
        health,
      });
      setProject(result.project);
      toast("success", "Project ownership, health and schedule were updated.");
    } catch (reason) {
      if (reason instanceof ApiError && reason.issues) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of reason.issues) {
          const path = issue.path.join(".");
          fieldErrors[path] = issue.message;
        }
        setErrors(fieldErrors);
        toast("error", "Please fix the validation errors below.");
      } else {
        toast("error", reason instanceof Error ? reason.message : "Could not update delivery settings");
      }
    } finally {
      setSaving(false);
    }
  }

  async function addMilestone(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const result = await createMilestone(projectId, { title: milestoneTitle, dueDate: milestoneDate });
      setProject((current) => current === null ? current : { ...current, milestones: [...current.milestones, result.milestone] });
      setMilestoneTitle("");
      setMilestoneDate("");
      toast("success", `Milestone “${result.milestone.title}” was added.`);
    } catch (reason) {
      if (reason instanceof ApiError && reason.issues) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of reason.issues) {
          const path = issue.path.join(".");
          fieldErrors[path] = issue.message;
        }
        setErrors(fieldErrors);
        toast("error", "Please fix the validation errors below.");
      } else {
        toast("error", reason instanceof Error ? reason.message : "Could not add milestone");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-6 sm:p-8">
      <header className="relative">
        <Link href="/projects" className="text-xs text-rise-muted hover:text-rise-accent">← Projects</Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-rise-accent">Delivery overview</p>
          <span className="rounded-full border border-rise-border px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-rise-muted">
            {PROJECT_TYPE_LABELS[project.type]}
          </span>
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wide ${
            project.health === "on_track" ? "border-rise-success text-rise-success" : project.health === "at_risk" ? "border-rise-warning text-rise-warning" : "border-rise-error text-rise-error"
          }`}>
            {project.health.replace("_", " ")}
          </span>
        </div>
        <h1 className="font-display mt-3 text-4xl sm:text-5xl">{project.name}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-rise-muted">{project.description}</p>
        {project.clientName && project.clientName.length > 0 && <p className="mt-2 text-sm">Client: <span className="text-rise-gold">{project.clientName}</span></p>}
        <div className="mt-3 flex flex-wrap gap-5 text-xs text-rise-muted">
          <span>Owner: <strong className="text-rise-text">{project.ownerName ?? "Not assigned"}</strong></span>
          <span>Deadline: <strong className="text-rise-text">{project.deadline ?? "Not scheduled"}</strong></span>
        </div>
        {canManage && (
          <button type="button" onClick={() => setShowControls((open) => !open)} className="mt-5 rounded-full border border-rise-accent px-4 py-2 text-sm text-rise-accent transition-colors hover:bg-rise-accent hover:text-rise-bg">
            {showControls ? "Close project controls" : "Manage project"}
          </button>
        )}
      </header>

      {canManage && showControls && (
        <section className="grid gap-5 rounded-2xl border border-rise-accent/40 bg-rise-surface p-6 lg:grid-cols-2">
          <form onSubmit={saveDelivery} className="space-y-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-rise-accent">Delivery settings</p>
              <h2 className="mt-1 text-lg font-semibold">Ownership and health</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-rise-muted">
                Project owner
                <select value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="rounded-lg border border-rise-border bg-rise-bg px-3 py-2 text-sm text-rise-text outline-none focus:border-rise-accent">
                  <option value="">Not assigned</option>
                  {project.team.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
                </select>
                {errors.ownerId && <span className="text-xs text-rise-error">{errors.ownerId}</span>}
              </label>
              <label className="flex flex-col gap-1 text-xs text-rise-muted">
                Target deadline
                <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="rounded-lg border border-rise-border bg-rise-bg px-3 py-2 text-sm text-rise-text outline-none focus:border-rise-accent" />
                {errors.deadline && <span className="text-xs text-rise-error">{errors.deadline}</span>}
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs text-rise-muted">
              Delivery health
              <select value={health} onChange={(event) => setHealth(event.target.value as ProjectHealth)} className="rounded-lg border border-rise-border bg-rise-bg px-3 py-2 text-sm capitalize text-rise-text outline-none focus:border-rise-accent">
                <option value="on_track">On track</option>
                <option value="at_risk">At risk</option>
                <option value="blocked">Blocked</option>
              </select>
              {errors.health && <span className="text-xs text-rise-error">{errors.health}</span>}
            </label>
            <button type="submit" disabled={saving} className="rounded-full bg-rise-accent px-4 py-2 text-sm font-semibold text-rise-bg disabled:opacity-50">{saving ? "Saving…" : "Save delivery settings"}</button>
          </form>

          <form onSubmit={addMilestone} className="space-y-4 lg:border-l lg:border-rise-border lg:pl-5">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-rise-gold">Planning</p>
              <h2 className="mt-1 text-lg font-semibold">Add milestone</h2>
            </div>
            <label className="flex flex-col gap-1 text-xs text-rise-muted">
              Milestone title
              <input required maxLength={200} value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} placeholder="Client acceptance" className="rounded-lg border border-rise-border bg-rise-bg px-3 py-2 text-sm text-rise-text outline-none focus:border-rise-accent" />
              {errors.title && <span className="text-xs text-rise-error">{errors.title}</span>}
            </label>
            <label className="flex flex-col gap-1 text-xs text-rise-muted">
              Due date
              <input required type="date" value={milestoneDate} onChange={(event) => setMilestoneDate(event.target.value)} className="rounded-lg border border-rise-border bg-rise-bg px-3 py-2 text-sm text-rise-text outline-none focus:border-rise-accent" />
              {errors.dueDate && <span className="text-xs text-rise-error">{errors.dueDate}</span>}
            </label>
            <button type="submit" disabled={saving} className="rounded-full border border-rise-gold px-4 py-2 text-sm font-semibold text-rise-gold transition-colors hover:bg-rise-gold hover:text-rise-bg disabled:opacity-50">{saving ? "Adding…" : "Add milestone"}</button>
          </form>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Staffing readiness" value={`${staffingPercent}%`} detail={`${project.team.length} of ${plannedSeats} seats filled`} />
        <Metric label="Delivery progress" value={`${completedPercent}%`} detail={`${ticketCounts.complete} of ${tickets.length} tickets complete`} />
        <Metric label="Active work" value={ticketCounts.in_progress + ticketCounts.review} detail="In progress or review" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-rise-border bg-rise-surface p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Delivery status</h2>
            <Link href="/board" className="text-sm text-rise-accent hover:underline">Open board →</Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {TICKET_STATUSES.map((status) => (
              <div key={status} className="rounded-xl bg-rise-surface-2 p-4">
                <p className="font-display text-3xl text-rise-accent">{ticketCounts[status]}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-rise-muted">{STATUS_LABELS[status]}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-rise-border bg-rise-surface p-6">
          <h2 className="text-lg font-semibold">Technology</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {project.techStack.length === 0 ? (
              <p className="text-sm text-rise-muted">No technology profile has been added.</p>
            ) : project.techStack.map((technology) => (
              <span key={technology} className="rounded-full bg-rise-surface-2 px-3 py-1 font-mono text-xs text-rise-accent">{technology}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-rise-border bg-rise-surface p-6">
          <h2 className="text-lg font-semibold">Delivery team</h2>
          <div className="mt-4 space-y-3">
            {project.team.length === 0 ? <p className="text-sm text-rise-muted">The team has not been assigned yet.</p> : project.team.map((member) => (
              <div key={member.userId} className="flex items-center justify-between rounded-xl bg-rise-surface-2 px-4 py-3">
                <span className="font-medium">{member.name}</span>
                <span className="font-mono text-xs capitalize text-rise-muted">{member.skillLevel} {member.role}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-rise-border bg-rise-surface p-6">
          <h2 className="text-lg font-semibold">Staffing plan</h2>
          <div className="mt-4 space-y-3">
            {project.resourceMatrix.length === 0 ? <p className="text-sm text-rise-muted">No staffing requirements are defined.</p> : project.resourceMatrix.map((requirement, index) => {
              const filled = project.team.filter((member) => member.role === requirement.role && member.skillLevel === requirement.skillLevel).length;
              return (
                <div key={`${requirement.role}-${requirement.skillLevel}-${index}`} className="flex items-center justify-between rounded-xl bg-rise-surface-2 px-4 py-3">
                  <span className="text-sm capitalize">{requirement.skillLevel} {requirement.role}</span>
                  <span className={filled >= requirement.count ? "text-rise-success" : "text-rise-warning"}>{filled}/{requirement.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-rise-border bg-rise-surface p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rise-border/60 pb-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-rise-gold">Formal Client Sign-Off</p>
            <h2 className="text-xl font-bold">Project Milestones & Certificates</h2>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {project.milestones.length === 0 ? (
            <p className="text-sm text-rise-muted">No milestones have been scheduled.</p>
          ) : project.milestones.map((milestone) => {
            const isApproved = milestone.status === "complete";
            const certHash = `RCS-CERT-${project.id.slice(0, 8)}-${milestone.id.slice(0, 6)}`.toUpperCase();

            return (
              <article key={milestone.id} className="rounded-xl border border-rise-border/80 bg-rise-surface-2 p-5 space-y-3 shadow-lg">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-rise-text">{milestone.title}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${
                    isApproved ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  }`}>
                    {isApproved ? "✓ APPROVED" : milestone.status}
                  </span>
                </div>
                <p className="text-xs text-rise-muted font-mono">Due Date: {milestone.dueDate}</p>

                {isApproved && (
                  <div className="rounded-lg bg-black/40 p-3 font-mono text-[11px] border border-rise-gold/30 space-y-1">
                    <p className="text-rise-gold font-bold">📜 Cryptographic Hash:</p>
                    <p className="text-rise-muted truncate">{certHash}</p>
                  </div>
                )}

                <div className="pt-1 flex items-center gap-2">
                  {!isApproved ? (
                    <button
                      type="button"
                      onClick={() => {
                        setProject((current) =>
                          current === null
                            ? current
                            : {
                                ...current,
                                milestones: current.milestones.map((m) =>
                                  m.id === milestone.id ? { ...m, status: "complete" } : m
                                ),
                              }
                        );
                        toast("success", `Formal sign-off granted for milestone "${milestone.title}". Cryptographic Certificate generated!`);
                      }}
                      className="w-full rounded-lg bg-rise-accent/15 border border-rise-accent/40 py-2 text-center text-xs font-semibold text-rise-accent hover:bg-rise-accent hover:text-rise-bg transition-colors"
                    >
                      ✍️ Formal Client Sign-Off
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const certText = `=== RISE CORE STUDIO DIPLOMA ===\nProject: ${project.name}\nMilestone: ${milestone.title}\nClient: ${project.clientName || "RiseCore Client"}\nHash: ${certHash}\nDate: ${new Date().toISOString()}`;
                        const blob = new Blob([certText], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${milestone.title.replace(/\s+/g, "_")}_Certificate.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast("success", "Cryptographic Milestone Certificate downloaded!");
                      }}
                      className="w-full rounded-lg bg-rise-gold/15 border border-rise-gold/40 py-2 text-center text-xs font-semibold text-rise-gold hover:bg-rise-gold hover:text-rise-bg transition-colors"
                    >
                      📜 Download Certificate
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="min-h-[28rem] overflow-hidden rounded-2xl border border-rise-border bg-rise-surface">
        <ChatPanel channel={`project:${project.id}`} label={`# ${project.name}`} />
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <div className="rounded-xl border border-rise-border bg-rise-surface px-5 py-4">
      <p className="font-display text-3xl text-rise-accent">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-rise-muted">{label}</p>
      <p className="mt-2 text-xs text-rise-muted">{detail}</p>
    </div>
  );
}

function ProjectDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8" aria-busy="true" aria-label="Loading project">
      <div className="h-12 w-72 animate-pulse rounded bg-rise-surface-2" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-rise-surface" />)}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-rise-surface" />
    </div>
  );
}
