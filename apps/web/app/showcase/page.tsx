"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PROJECT_TYPE_LABELS, type ShowcaseProject } from "@rcs/shared";
import { fetchShowcase } from "@/lib/api";

/**
 * Client-facing gallery: only projects flagged is_public, served by the
 * public /showcase endpoint with client-safe fields.
 */
export default function ShowcasePage() {
  const [projects, setProjects] = useState<readonly ShowcaseProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchShowcase()
      .then((result) => setProjects(result.projects))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "showcase unavailable"),
      );
  }, []);

  return (
    <div className="relative min-h-full overflow-x-hidden">
      <div
        className="orb glow-pulse right-[-10%] top-[-15%] h-96 w-96"
        style={{ background: "color-mix(in srgb, var(--color-rise-gold) 18%, transparent)" }}
      />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <p className="fade-up font-mono text-xs uppercase tracking-[0.4em] text-rise-gold">
          The Gallery
        </p>
        <h1 className="fade-up fade-up-1 font-display mt-4 text-4xl">
          Work we are proud to sign.
        </h1>
        <p className="fade-up fade-up-2 mt-3 max-w-xl text-sm text-rise-muted">
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
                  className={`fade-up fade-up-${(index % 4) + 1} group rounded-xl border border-rise-border bg-rise-surface p-6 transition-all hover:-translate-y-1 hover:border-rise-gold`}
                >
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
                  <p className="mt-4 text-xs text-rise-muted">
                    Crafted by a squad of {project.teamSize > 0 ? project.teamSize : "hand-picked"}{" "}
                    {project.teamSize === 1 ? "developer" : "developers"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
