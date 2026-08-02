"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { PROJECT_TYPE_LABELS, type ShowcaseProject } from "@rcs/shared";
import { fetchShowcaseProject, reactToShowcase, getAuthUrl } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

export default function ShowcaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const [project, setProject] = useState<ShowcaseProject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchShowcaseProject(projectId)
      .then((res) => setProject(res.project))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Project not found")
      );
  }, [projectId]);

  const handleReact = async (reactionType: "star" | "like" | "love" | "fire") => {
    if (!project) return;
    try {
      const result = await reactToShowcase(project.id, reactionType);
      setProject((prev) =>
        prev
          ? { ...prev, reactions: result.reactions, userReactions: result.userReactions }
          : null
      );
      const wasAdded = result.userReactions.includes(reactionType);
      toast("success", wasAdded ? `Added reaction` : `Removed reaction`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "failed to toggle reaction");
    }
  };

  const handleCopyShareLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast("info", "Showcase link copied to clipboard!");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const shareTelegramUrl = project
    ? `https://t.me/share/url?url=${encodeURIComponent(
        typeof window !== "undefined" ? window.location.href : ""
      )}&text=${encodeURIComponent(`Check out ${project.name} built by RiseCoreStudio!`)}`
    : "#";

  const shareTwitterUrl = project
    ? `https://twitter.com/intent/tweet?url=${encodeURIComponent(
        typeof window !== "undefined" ? window.location.href : ""
      )}&text=${encodeURIComponent(`Check out ${project.name} built by RiseCoreStudio!`)}`
    : "#";

  return (
    <div className="relative min-h-full overflow-x-hidden bg-rise-bg text-rise-text">
      <div
        className="orb glow-pulse right-[-10%] top-[-10%] h-[400px] w-[400px]"
        style={{ background: "color-mix(in srgb, var(--color-rise-accent) 15%, transparent)" }}
      />

      <div className="mx-auto max-w-4xl px-6 py-16">
        <Link
          href="/showcase"
          className="fade-up inline-flex items-center gap-2 text-xs font-mono text-rise-muted hover:text-rise-accent transition-colors mb-8"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Gallery Showcase
        </Link>

        {error !== null ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
            <h1 className="font-display text-2xl text-rose-400">Project Not Found</h1>
            <p className="mt-2 text-sm text-rise-muted">{error}</p>
            <Link
              href="/showcase"
              className="mt-6 inline-block rounded-full bg-rise-accent px-6 py-2 text-xs font-semibold text-rise-bg"
            >
              Return to Gallery
            </Link>
          </div>
        ) : project === null ? (
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-1/3 rounded bg-rise-surface-2" />
            <div className="h-4 w-1/4 rounded bg-rise-surface-2" />
            <div className="h-40 rounded-xl bg-rise-surface-2" />
          </div>
        ) : (
          <article className="fade-up space-y-8">
            <header className="border-b border-rise-border pb-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="rounded-full border border-rise-accent/40 bg-rise-accent/10 px-3 py-1 font-mono text-xs text-rise-accent">
                  {PROJECT_TYPE_LABELS[project.type]}
                </span>
                <div className="flex items-center gap-4 text-xs font-mono text-rise-muted">
                  <span className="flex items-center gap-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {project.views || 0} views
                  </span>
                  <span>Squad Size: {project.teamSize > 0 ? `${project.teamSize} Devs` : "Core Team"}</span>
                </div>
              </div>

              <h1 className="font-display mt-4 text-4xl sm:text-5xl text-rise-text">
                {project.name}
              </h1>

              {project.clientName && project.clientName.length > 0 && (
                <p className="mt-2 font-mono text-sm text-rise-gold">
                  Delivered for <span className="font-semibold text-rise-text">{project.clientName}</span>
                </p>
              )}
            </header>

            <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
              <div className="space-y-6">
                <section className="rounded-xl border border-rise-border bg-rise-surface p-6">
                  <h2 className="font-mono text-xs uppercase tracking-widest text-rise-accent mb-3">
                    Project Overview
                  </h2>
                  <p className="text-sm leading-relaxed text-rise-muted whitespace-pre-line">
                    {project.description}
                  </p>
                </section>

                <section className="rounded-xl border border-rise-border bg-rise-surface p-6">
                  <h2 className="font-mono text-xs uppercase tracking-widest text-rise-gold mb-3">
                    Technology Architecture
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {project.techStack.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-md border border-rise-border bg-rise-surface-2 px-3 py-1 font-mono text-xs text-rise-accent"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </section>

                {/* External links */}
                {(project.gitLink || project.liveLink) && (
                  <section className="flex flex-wrap gap-4 pt-2">
                    {project.gitLink && (
                      <a
                        href={project.gitLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-full border border-rise-border bg-rise-surface px-5 py-2.5 text-xs font-semibold hover:border-rise-accent hover:text-rise-accent transition-colors"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                        </svg>
                        Explore Repository
                      </a>
                    )}
                    {project.liveLink && (
                      <a
                        href={project.liveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-full bg-rise-accent px-5 py-2.5 text-xs font-semibold text-rise-bg hover:opacity-90 transition-opacity"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View Live Deployment
                      </a>
                    )}
                  </section>
                )}
              </div>

              <aside className="space-y-6">
                {/* Reactions box */}
                <div className="rounded-xl border border-rise-border bg-rise-surface p-6">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-rise-muted mb-4">
                    Community Feedback
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleReact("star")}
                      className={`flex items-center justify-center gap-2 rounded-lg p-3 text-xs font-semibold transition-all ${
                        project.userReactions?.includes("star")
                          ? "bg-rise-gold/20 text-rise-gold border border-rise-gold/50"
                          : "bg-rise-surface-2 text-rise-muted border border-transparent hover:border-rise-border"
                      }`}
                    >
                      ⭐ {project.reactions?.star || 0} Star
                    </button>
                    <button
                      onClick={() => handleReact("like")}
                      className={`flex items-center justify-center gap-2 rounded-lg p-3 text-xs font-semibold transition-all ${
                        project.userReactions?.includes("like")
                          ? "bg-rise-accent/20 text-rise-accent border border-rise-accent/50"
                          : "bg-rise-surface-2 text-rise-muted border border-transparent hover:border-rise-border"
                      }`}
                    >
                      👍 {project.reactions?.like || 0} Like
                    </button>
                    <button
                      onClick={() => handleReact("love")}
                      className={`flex items-center justify-center gap-2 rounded-lg p-3 text-xs font-semibold transition-all ${
                        project.userReactions?.includes("love")
                          ? "bg-red-500/20 text-red-400 border border-red-500/50"
                          : "bg-rise-surface-2 text-rise-muted border border-transparent hover:border-rise-border"
                      }`}
                    >
                      ❤️ {project.reactions?.love || 0} Love
                    </button>
                    <button
                      onClick={() => handleReact("fire")}
                      className={`flex items-center justify-center gap-2 rounded-lg p-3 text-xs font-semibold transition-all ${
                        project.userReactions?.includes("fire")
                          ? "bg-orange-500/20 text-orange-400 border border-orange-500/50"
                          : "bg-rise-surface-2 text-rise-muted border border-transparent hover:border-rise-border"
                      }`}
                    >
                      🔥 {project.reactions?.fire || 0} Fire
                    </button>
                  </div>
                </div>

                {/* Social Share Box */}
                <div className="rounded-xl border border-rise-border bg-rise-surface p-6">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-rise-muted mb-4">
                    Share Showcase
                  </h3>
                  <div className="flex flex-col gap-2">
                    <a
                      href={shareTelegramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-lg bg-[#229ED9]/15 border border-[#229ED9]/40 p-2.5 text-xs text-[#229ED9] hover:bg-[#229ED9]/25 transition-colors font-medium"
                    >
                      Share on Telegram
                    </a>
                    <a
                      href={shareTwitterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-lg bg-rise-surface-2 border border-rise-border p-2.5 text-xs text-rise-text hover:border-rise-accent transition-colors font-medium"
                    >
                      Share on X / Twitter
                    </a>
                    <button
                      onClick={handleCopyShareLink}
                      className="flex items-center justify-center gap-2 rounded-lg border border-rise-border p-2.5 text-xs text-rise-muted hover:text-rise-accent hover:border-rise-accent transition-colors font-medium"
                    >
                      {copied ? "✓ Copied Link" : "Copy Direct Link"}
                    </button>
                  </div>
                </div>

                {/* Request CTA */}
                <div className="rounded-xl border border-rise-gold/30 bg-rise-gold/5 p-6 text-center">
                  <h4 className="font-display text-lg text-rise-gold">Want a custom build?</h4>
                  <p className="mt-2 text-xs leading-relaxed text-rise-muted">
                    Our squads design, build, and deliver high-impact software like this every month.
                  </p>
                  <a
                    href={getAuthUrl("/request")}
                    className="mt-4 block w-full rounded-full bg-rise-gold px-4 py-2 text-xs font-semibold text-rise-bg hover:opacity-90 transition-opacity"
                  >
                    Start Your Project
                  </a>
                </div>
              </aside>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
