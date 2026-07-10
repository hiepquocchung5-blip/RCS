"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PROJECT_TYPE_LABELS, type ShowcaseProject } from "@rcs/shared";
import { fetchShowcase, reactToShowcase } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

export default function ShowcasePage() {
  const [projects, setProjects] = useState<readonly ShowcaseProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchShowcase()
      .then((result) => setProjects(result.projects))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "showcase unavailable"),
      );
  }, []);

  const handleReact = async (projectId: string, reactionType: "star" | "like" | "love" | "fire") => {
    try {
      const result = await reactToShowcase(projectId, reactionType);
      setProjects((prev) =>
        prev
          ? prev.map((p) =>
              p.id === projectId
                ? { ...p, reactions: result.reactions, userReactions: result.userReactions }
                : p
            )
          : null
      );
      const wasAdded = result.userReactions.includes(reactionType);
      toast("success", wasAdded ? `Added reaction` : `Removed reaction`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "failed to toggle reaction");
    }
  };

  // Analytics helper variables
  const totalViews = projects ? projects.reduce((sum, p) => sum + (p.views || 0), 0) : 0;
  
  const totalReactionsCount = projects
    ? projects.reduce(
        (sum, p) =>
          sum +
          ((p.reactions?.star || 0) +
            (p.reactions?.like || 0) +
            (p.reactions?.love || 0) +
            (p.reactions?.fire || 0)),
        0
      )
    : 0;

  const topProject = projects && projects.length > 0
    ? [...projects].sort(
        (a, b) =>
          ((b.reactions?.star || 0) + (b.reactions?.love || 0)) -
          ((a.reactions?.star || 0) + (a.reactions?.love || 0))
      )[0]
    : null;

  return (
    <div className="relative min-h-full overflow-x-hidden bg-rise-bg text-rise-text">
      <div
        className="orb glow-pulse right-[-10%] top-[-15%] h-96 w-96"
        style={{ background: "color-mix(in srgb, var(--color-rise-gold) 18%, transparent)" }}
      />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="fade-up font-mono text-xs uppercase tracking-[0.4em] text-rise-gold">
              The Gallery
            </p>
            <h1 className="fade-up fade-up-1 mt-3 text-4xl">
              Work we are proud to sign.
            </h1>
          </div>
          {projects && projects.length > 0 && (
            <button
              onClick={() => setShowAnalytics((prev) => !prev)}
              className="fade-up shrink-0 flex items-center gap-2 rounded-full border border-rise-border bg-rise-surface px-4 py-2 text-xs font-semibold text-rise-accent transition-colors hover:border-rise-accent"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {showAnalytics ? "Hide Insights" : "Show Insights"}
            </button>
          )}
        </div>

        {/* Analytics Insights Dashboard */}
        {showAnalytics && projects && (
          <section className="fade-up mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-rise-border bg-rise-surface p-5">
              <span className="text-xs uppercase tracking-wider text-rise-muted">Total Gallery Views</span>
              <p className="font-display mt-2 text-3xl text-rise-accent">{totalViews}</p>
              <span className="mt-1 block text-[10px] text-rise-muted">Refreshes dynamically on visit</span>
            </div>
            <div className="rounded-xl border border-rise-border bg-rise-surface p-5">
              <span className="text-xs uppercase tracking-wider text-rise-muted">Total Reactions Given</span>
              <p className="font-display mt-2 text-3xl text-rise-gold">{totalReactionsCount}</p>
              <span className="mt-1 block text-[10px] text-rise-muted">Sum of Stars, Likes, Loves, Fires</span>
            </div>
            <div className="rounded-xl border border-rise-border bg-rise-surface p-5">
              <span className="text-xs uppercase tracking-wider text-rise-muted">Most Populated Project</span>
              <p className="font-display mt-2 text-xl truncate text-rise-text">{topProject ? topProject.name : "N/A"}</p>
              <span className="mt-1 block text-[10px] text-rise-muted">Leading in Stars & Love reactions</span>
            </div>
          </section>
        )}

        <p className="fade-up fade-up-2 mt-4 max-w-xl text-sm text-rise-muted">
          Every piece below was shipped by an RCS squad — scoped by a PM,
          built by a guided team, delivered through deterministic pipelines.
        </p>

        <div className="mt-12">
          {error !== null ? (
            <p className="text-sm text-rise-error">{error}</p>
          ) : projects === null ? (
            <p className="text-sm text-rise-muted">Loading the gallery…</p>
          ) : projects.length === 0 ? (
            <div className="fade-up rounded-xl border border-rise-border bg-rise-surface p-10 text-center">
              <p className="font-display text-2xl">The gallery is being curated.</p>
              <p className="mt-2 text-sm text-rise-muted">
                Finished projects appear here the moment they are flagged
                public. Meanwhile — tell us about yours.
              </p>
              <Link
                href="/request"
                className="mt-6 inline-block rounded-full bg-rise-accent px-6 py-2.5 text-sm font-semibold text-rise-bg transition-transform hover:scale-105"
              >
                Request a project
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {projects.map((project, index) => (
                <article
                  key={project.id}
                  className={`fade-up fade-up-${(index % 4) + 1} group flex flex-col justify-between rounded-xl border border-rise-border bg-rise-surface p-6 transition-all hover:-translate-y-1 hover:border-rise-gold`}
                >
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="font-display text-2xl group-hover:text-rise-gold">
                        {project.name}
                      </h2>
                      <span className="shrink-0 rounded-full border border-rise-border px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-rise-muted">
                        {PROJECT_TYPE_LABELS[project.type]}
                      </span>
                    </div>
                    {project.clientName && project.clientName.length > 0 && (
                      <p className="mt-1 font-mono text-xs text-rise-gold">
                        for {project.clientName}
                      </p>
                    )}
                    <p className="mt-3 text-sm leading-relaxed text-rise-muted">
                      {project.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {project.techStack.map((tech) => (
                        <span
                          key={tech}
                          className="rounded bg-rise-surface-2 px-2 py-0.5 font-mono text-[11px] text-rise-accent"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-rise-border/40">
                    <div className="flex items-center justify-between text-xs text-rise-muted font-mono">
                      <span>
                        Squad Size: {project.teamSize > 0 ? `${project.teamSize} Devs` : "Core Squad"}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {project.views || 0} views
                      </span>
                    </div>

                    {/* External links */}
                    {(project.gitLink || project.liveLink) && (
                      <div className="mt-4 flex gap-3">
                        {project.gitLink && (
                          <a
                            href={project.gitLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-rise-muted hover:text-rise-accent"
                          >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                            </svg>
                            Repository
                          </a>
                        )}
                        {project.liveLink && (
                          <a
                            href={project.liveLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-rise-muted hover:text-rise-accent"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Live Demo
                          </a>
                        )}
                      </div>
                    )}

                    {/* Interactive reactions panel */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleReact(project.id, "star")}
                        className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-all ${
                          project.userReactions?.includes("star")
                            ? "bg-rise-gold/15 text-rise-gold border border-rise-gold/50 shadow-[0_0_8px_rgba(230,175,46,0.2)]"
                            : "bg-rise-surface-2 text-rise-muted border border-transparent hover:border-rise-border"
                        }`}
                      >
                        ⭐ {project.reactions?.star || 0}
                      </button>
                      <button
                        onClick={() => handleReact(project.id, "like")}
                        className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-all ${
                          project.userReactions?.includes("like")
                            ? "bg-rise-accent/15 text-rise-accent border border-rise-accent/50 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                            : "bg-rise-surface-2 text-rise-muted border border-transparent hover:border-rise-border"
                        }`}
                      >
                        👍 {project.reactions?.like || 0}
                      </button>
                      <button
                        onClick={() => handleReact(project.id, "love")}
                        className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-all ${
                          project.userReactions?.includes("love")
                            ? "bg-red-500/15 text-red-500 border border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.2)]"
                            : "bg-rise-surface-2 text-rise-muted border border-transparent hover:border-rise-border"
                        }`}
                      >
                        ❤️ {project.reactions?.love || 0}
                      </button>
                      <button
                        onClick={() => handleReact(project.id, "fire")}
                        className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-all ${
                          project.userReactions?.includes("fire")
                            ? "bg-orange-500/15 text-orange-500 border border-orange-500/50 shadow-[0_0_8px_rgba(249,115,22,0.2)]"
                            : "bg-rise-surface-2 text-rise-muted border border-transparent hover:border-rise-border"
                        }`}
                      >
                        🔥 {project.reactions?.fire || 0}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
