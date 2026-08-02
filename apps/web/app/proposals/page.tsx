"use client";

import { useEffect, useState } from "react";
import {
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  type ProjectProposal,
  type ProjectType,
} from "@rcs/shared";
import {
  listProposals,
  submitProposal,
  approveProposal,
  rejectProposal,
} from "@/lib/api";
import { loadSession } from "@/lib/session";
import { useToast } from "@/components/ToastProvider";

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<readonly ProjectProposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("web_app");
  const [techInput, setTechInput] = useState("React, Node.js, TypeScript");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const session = loadSession();
  const isLead = session?.user.role === "admin" || session?.user.role === "pm";

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    listProposals()
      .then((res) => setProposals(res.proposals))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load proposals")
      );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast("error", "Title and description are required.");
      return;
    }
    setSubmitting(true);
    try {
      const techStack = techInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      await submitProposal({
        title,
        description,
        projectType,
        techStack,
      });
      toast("success", "Project proposal submitted successfully!");
      setTitle("");
      setDescription("");
      loadData();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await approveProposal(id);
      toast("success", `Approved! Project "${res.project.name}" created and proposer assigned.`);
      loadData();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Approval failed");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectProposal(id);
      toast("info", "Proposal rejected.");
      loadData();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Rejection failed");
    }
  };

  return (
    <div className="relative min-h-full overflow-x-hidden bg-rise-bg text-rise-text">
      <div
        className="orb glow-pulse right-[-10%] top-[-10%] h-96 w-96"
        style={{ background: "color-mix(in srgb, var(--color-rise-accent) 15%, transparent)" }}
      />

      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-rise-gold">
            Developer Innovation Hub
          </p>
          <h1 className="font-display mt-2 text-4xl">Project Proposals</h1>
          <p className="mt-2 text-sm text-rise-muted">
            Propose product ideas. Approved proposals convert directly into mentored agency projects with you on the delivery squad.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* List of Proposals */}
          <div className="space-y-6">
            <h2 className="font-mono text-xs uppercase tracking-widest text-rise-accent">
              Proposals ({proposals?.length || 0})
            </h2>

            {error !== null ? (
              <p className="text-sm text-rise-error">{error}</p>
            ) : proposals === null ? (
              <p className="text-sm text-rise-muted">Loading proposals…</p>
            ) : proposals.length === 0 ? (
              <div className="rounded-xl border border-rise-border bg-rise-surface p-8 text-center">
                <p className="font-display text-xl">No proposals yet.</p>
                <p className="mt-2 text-xs text-rise-muted">
                  Be the first developer to propose an idea using the form on the right!
                </p>
              </div>
            ) : (
              proposals.map((prop) => (
                <article
                  key={prop.id}
                  className="rounded-xl border border-rise-border bg-rise-surface p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl text-rise-text">{prop.title}</h3>
                      <p className="mt-0.5 font-mono text-xs text-rise-gold">
                        Proposed by <span className="text-rise-text">{prop.proposerName}</span>
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-0.5 font-mono text-[11px] uppercase tracking-wide border ${
                        prop.status === "approved"
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                          : prop.status === "rejected"
                          ? "bg-rose-500/15 border-rose-500/40 text-rose-400"
                          : "bg-amber-500/15 border-amber-500/40 text-amber-400"
                      }`}
                    >
                      {prop.status}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-rise-muted">
                    {prop.description}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-rise-border/40">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded border border-rise-border px-2 py-0.5 font-mono text-[10px] uppercase text-rise-muted">
                        {PROJECT_TYPE_LABELS[prop.projectType]}
                      </span>
                      {prop.techStack.map((tech) => (
                        <span
                          key={tech}
                          className="rounded bg-rise-surface-2 px-2 py-0.5 font-mono text-[10px] text-rise-accent"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>

                    {/* Admin / PM Approval Controls */}
                    {isLead && prop.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(prop.id)}
                          className="rounded-full bg-rise-accent px-4 py-1.5 text-xs font-semibold text-rise-bg hover:opacity-90 transition-opacity"
                        >
                          Approve & Convert
                        </button>
                        <button
                          onClick={() => handleReject(prop.id)}
                          className="rounded-full border border-rose-500/40 px-4 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>

          {/* Submit Form */}
          <aside className="h-fit rounded-xl border border-rise-border bg-rise-surface p-6 space-y-4">
            <div>
              <h2 className="font-mono text-xs uppercase tracking-widest text-rise-gold">
                Submit an Idea
              </h2>
              <p className="mt-1 text-xs text-rise-muted">
                Pitch a new project stack or system to the team.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-rise-muted mb-1">Project Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. AI-Powered Resume Parser"
                  required
                  className="w-full rounded border border-rise-border bg-rise-bg px-3 py-2 text-sm text-rise-text outline-none focus:border-rise-accent"
                />
              </div>

              <div>
                <label className="block text-rise-muted mb-1">Project Type</label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value as ProjectType)}
                  className="w-full rounded border border-rise-border bg-rise-bg px-3 py-2 text-sm text-rise-text outline-none focus:border-rise-accent"
                >
                  {PROJECT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {PROJECT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-rise-muted mb-1">Target Tech Stack</label>
                <input
                  type="text"
                  value={techInput}
                  onChange={(e) => setTechInput(e.target.value)}
                  placeholder="Comma-separated (e.g. Next.js, Postgres, Tailwind)"
                  className="w-full rounded border border-rise-border bg-rise-bg px-3 py-2 text-sm text-rise-text outline-none focus:border-rise-accent"
                />
              </div>

              <div>
                <label className="block text-rise-muted mb-1">Description & Scope</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the objective, user workflow, and target architecture..."
                  required
                  className="w-full rounded border border-rise-border bg-rise-bg px-3 py-2 text-sm text-rise-text outline-none focus:border-rise-accent"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-rise-accent py-2.5 text-xs font-semibold text-rise-bg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Proposal"}
              </button>
            </form>
          </aside>
        </div>
      </div>
    </div>
  );
}
