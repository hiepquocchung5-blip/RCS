"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  ROLES,
  SKILL_LEVELS,
  type Project,
  type ProjectType,
  type ResourceRequirement,
  type Role,
  type SkillLevel,
  type UserProfile,
} from "@rcs/shared";
import {
  ApiError,
  assignTeamMember,
  createProject,
  listCandidates,
  listProjects,
  updateTechStack,
} from "@/lib/api";
import { loadSession } from "@/lib/session";
import { useToast } from "@/components/ToastProvider";

const MATRIX_ROLES = ROLES.filter(
  (role): role is Exclude<Role, "admin" | "pm"> => role !== "admin" && role !== "pm",
);

const LEVEL_BADGE: Record<SkillLevel, string> = {
  intern: "text-rise-warning",
  junior: "text-rise-accent",
  mid: "text-rise-text",
  senior: "text-rise-success",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<readonly Project[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    try {
      const result = await listProjects();
      setProjects(result.projects);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setDenied(true);
        return;
      }
      toast("error", error instanceof Error ? error.message : "failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const session = loadSession();
    if (session === null) {
      setDenied(true);
      setLoading(false);
      return;
    }
    setRole(session.user.role);
    void refresh();
  }, [refresh]);

  if (denied) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-rise-muted">Projects are part of the Developer Portal.</p>
        <Link href="/login" className="text-rise-accent hover:underline">
          Log in →
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8" aria-busy="true" aria-label="Loading projects">
        <div className="h-10 w-52 animate-pulse rounded bg-rise-surface-2" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-xl border border-rise-border bg-rise-surface" />
          ))}
        </div>
        <div className="h-56 animate-pulse rounded-2xl border border-rise-border bg-rise-surface" />
      </div>
    );
  }

  const isLead = role === "admin" || role === "pm";

  const totalSeats = projects.reduce(
    (sum, project) => sum + project.resourceMatrix.reduce((count, row) => count + row.count, 0),
    0,
  );
  const assignedSeats = projects.reduce((sum, project) => sum + project.team.length, 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7 p-6 sm:p-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-rise-accent">Delivery portfolio</p>
          <h1 className="font-display mt-2 text-4xl">Projects</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-rise-muted">
            Plan engagements, assemble the right team and keep delivery context
            in one dependable place.
          </p>
        </div>
        {isLead && (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="shrink-0 rounded-full bg-rise-accent px-4 py-2 text-sm font-semibold text-rise-bg transition-transform hover:scale-105"
          >
            {showCreate ? "Close form" : "+ New project"}
          </button>
        )}
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Active projects" value={projects.length} />
        <SummaryCard label="Team seats filled" value={`${assignedSeats}/${totalSeats}`} />
        <SummaryCard label="Client showcase" value={projects.filter((project) => project.isPublic).length} />
      </section>

      {showCreate && (
        <CreateProjectForm
          onCreated={(project) => {
            setProjects((prev) => [...prev, project]);
            setShowCreate(false);
            toast("success", `Project “${project.name}” is ready for team planning.`);
          }}
        />
      )}

      {projects.length === 0 ? (
        <p className="rounded border border-rise-border bg-rise-surface px-4 py-3 text-sm text-rise-muted">
          Your delivery portfolio is ready for its first project.{" "}
          {isLead
            ? "Create one here, or begin with a reviewed client request in Admin."
            : "Projects assigned to you will appear here."}
        </p>
      ) : (
        projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            isLead={isLead}
            onChanged={(updated) =>
              setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
            }
          />
        ))
      )}
    </div>
  );
}

function ProjectCard({
  project,
  isLead,
  onChanged,
}: {
  project: Project;
  isLead: boolean;
  onChanged(project: Project): void;
}) {
  const [candidates, setCandidates] = useState<readonly UserProfile[] | null>(null);
  const [newTech, setNewTech] = useState("");
  const { toast } = useToast();

  const seats = project.resourceMatrix.reduce((sum, req) => sum + req.count, 0);

  async function loadCandidates(): Promise<void> {
    try {
      const result = await listCandidates(project.id);
      setCandidates(result.candidates);
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "candidates unavailable");
    }
  }

  async function assign(candidate: UserProfile): Promise<void> {
    try {
      const result = await assignTeamMember(project.id, candidate.id);
      onChanged(result.project);
      toast(
        "success",
        `${candidate.name} joined "${project.name}" — matched the ${candidate.skillLevel} ${candidate.role} seat.`,
      );
      await loadCandidates();
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "assignment failed");
    }
  }

  async function editTech(change: { add?: string; remove?: string }): Promise<void> {
    try {
      const result = await updateTechStack(project.id, change);
      onChanged(result.project);
      setNewTech("");
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "tech stack update failed");
    }
  }

  return (
    <article className="rounded-2xl border border-rise-border bg-rise-surface p-6 shadow-sm transition-colors hover:border-rise-accent/40">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-semibold">{project.name}</h2>
        <span className="rounded-full border border-rise-border px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-rise-muted">
          {PROJECT_TYPE_LABELS[project.type]}
        </span>
        {project.isPublic && (
          <span className="rounded-full border border-rise-gold px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-rise-gold">
            public showcase
          </span>
        )}
        {project.clientName.length > 0 && (
          <span className="text-xs text-rise-muted">for {project.clientName}</span>
        )}
      </div>
      <p className="mt-2 text-sm text-rise-muted">{project.description}</p>
      <Link
        href={`/projects/${project.id}`}
        className="mt-4 inline-flex items-center text-sm font-medium text-rise-accent hover:underline"
      >
        Open delivery overview →
      </Link>

      {/* team-managed tech stack */}
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-rise-muted">
          Technology
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {project.techStack.map((tech) => (
            <span
              key={tech}
              className="group flex items-center gap-1 rounded bg-rise-surface-2 px-2 py-0.5 font-mono text-[11px] text-rise-accent"
            >
              {tech}
              <button
                type="button"
                title={`remove ${tech}`}
                onClick={() => void editTech({ remove: tech })}
                className="hidden text-rise-error group-hover:inline"
              >
                ×
              </button>
            </span>
          ))}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (newTech.trim().length > 0) void editTech({ add: newTech });
            }}
            className="flex items-center gap-1"
          >
            <input
              value={newTech}
              onChange={(event) => setNewTech(event.target.value)}
              placeholder="+ add tech"
              className="w-24 rounded border border-rise-border bg-rise-bg px-2 py-0.5 font-mono text-[11px] outline-none focus:border-rise-accent"
            />
          </form>
        </div>
      </div>

      {/* resource matrix + team */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rise-muted">
            Team plan ({project.team.length}/{seats} seats filled)
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {project.resourceMatrix.map((req, index) => {
              const filled = project.team.filter(
                (m) => m.role === req.role && m.skillLevel === req.skillLevel,
              ).length;
              return (
                <li key={index} className="flex items-center gap-2 font-mono text-xs">
                  <span className={filled >= req.count ? "text-rise-success" : "text-rise-warning"}>
                    {filled}/{req.count}
                  </span>
                  <span className={LEVEL_BADGE[req.skillLevel]}>{req.skillLevel}</span>
                  <span>{req.role}</span>
                </li>
              );
            })}
            {project.resourceMatrix.length === 0 && (
              <li className="text-xs text-rise-muted">no matrix defined</li>
            )}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rise-muted">Team</p>
          <ul className="mt-2 space-y-1 text-sm">
            {project.team.map((member) => (
              <li key={member.userId} className="flex items-center gap-2">
                <span>{member.name}</span>
                <span className={`font-mono text-xs ${LEVEL_BADGE[member.skillLevel]}`}>
                  {member.skillLevel} {member.role}
                </span>
              </li>
            ))}
            {project.team.length === 0 && (
              <li className="text-xs text-rise-muted">no members yet</li>
            )}
          </ul>
        </div>
      </div>

      {/* guided team building */}
      {isLead && (
        <div className="mt-4 border-t border-rise-border pt-3">
          {candidates === null ? (
            <button
              type="button"
              onClick={() => void loadCandidates()}
              className="text-sm text-rise-accent hover:underline"
            >
              Review recommended team members →
            </button>
          ) : candidates.length === 0 ? (
            <p className="text-xs text-rise-muted">
              No available team members currently match the open roles. Review
              the staffing plan or approved talent pool.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => void assign(candidate)}
                  title={`assign ${candidate.name}`}
                  className="rounded border border-rise-border px-3 py-1 text-xs transition-colors hover:border-rise-success hover:text-rise-success"
                >
                  + {candidate.name}{" "}
                  <span className={`font-mono ${LEVEL_BADGE[candidate.skillLevel]}`}>
                    {candidate.skillLevel} {candidate.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function CreateProjectForm({ onCreated }: { onCreated(project: Project): void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>("web_app");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [techStack, setTechStack] = useState("");
  const [matrix, setMatrix] = useState<ResourceRequirement[]>([
    { role: "backend", skillLevel: "senior", count: 1 },
  ]);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  function updateRow(index: number, patch: Partial<ResourceRequirement>): void {
    setMatrix((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await createProject({
        name,
        type,
        description,
        clientName,
        isPublic,
        techStack: techStack.split(",").map((t) => t.trim()).filter((t) => t.length > 0),
        resourceMatrix: matrix,
      });
      onCreated(result.project);
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "create failed");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "rounded border border-rise-border bg-rise-bg px-2 py-1.5 text-sm outline-none focus:border-rise-accent";

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-lg border border-rise-border bg-rise-surface p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-rise-muted">
          Project name
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-rise-muted">
          Type
          <select value={type} onChange={(e) => setType(e.target.value as ProjectType)} className={inputClass}>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROJECT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs text-rise-muted">
        Description
        <input required value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-rise-muted">
          Client or organisation
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-rise-muted">
          Technology (comma-separated)
          <input
            value={techStack}
            onChange={(e) => setTechStack(e.target.value)}
            placeholder="Next.js, PostgreSQL"
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 self-end pb-1.5 text-xs text-rise-muted">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="accent-current"
          />
          Include in the public showcase
        </label>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-rise-muted">
          Staffing plan
        </p>
        {matrix.map((row, index) => (
          <div key={index} className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={20}
              value={row.count}
              onChange={(e) => updateRow(index, { count: Number(e.target.value) })}
              className={`w-16 ${inputClass}`}
            />
            <select
              value={row.skillLevel}
              onChange={(e) => updateRow(index, { skillLevel: e.target.value as SkillLevel })}
              className={inputClass}
            >
              {SKILL_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            <select
              value={row.role}
              onChange={(e) =>
                updateRow(index, { role: e.target.value as Exclude<Role, "admin" | "pm"> })
              }
              className={inputClass}
            >
              {MATRIX_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setMatrix((prev) => prev.filter((_, i) => i !== index))}
              className="text-rise-error"
              title="remove row"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setMatrix((prev) => [...prev, { role: "frontend", skillLevel: "junior", count: 1 }])
          }
          className="mt-2 text-xs text-rise-accent hover:underline"
        >
          + Add role
        </button>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="self-start rounded bg-rise-accent px-4 py-1.5 text-sm font-semibold text-rise-bg disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-rise-border bg-rise-surface px-5 py-4">
      <p className="font-display text-3xl text-rise-accent">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-rise-muted">{label}</p>
    </div>
  );
}
