import Link from "next/link";

const FEATURES = [
  {
    title: "Local-Synced Workspace",
    body: "Monaco editor in the browser, terminal on your machine. The RCS-CLI daemon bridges xterm.js to your local shell over an authenticated WebSocket.",
    href: "/workspace",
    cta: "Open Workspace",
  },
  {
    title: "Deterministic Kanban",
    body: "Tickets move todo → in progress → review → complete. One state at a time, every transition logged — merged PRs advance tickets via the Git Sync Agent.",
    href: "/board",
    cta: "Open Board",
  },
  {
    title: "Gated Onboarding",
    body: "Apply with your GitHub and CV, verify a 5-minute OTP, and once the Admin approves you a one-time magic link delivers your 16-character credential.",
    href: "/apply",
    cta: "Apply as Developer",
  },
] as const;

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-16">
      <section className="flex flex-col gap-4">
        <p className="font-mono text-sm text-rise-accent">RiseCoreStudio</p>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight">
          The Dev Hub built for <span className="text-rise-accent">control</span>{" "}
          and <span className="text-rise-accent">precision</span>.
        </h1>
        <p className="max-w-2xl text-rise-muted">
          Robust, deterministic automation over unpredictable generation. Every
          action is tracked, role-gated and designed for human-in-the-loop
          validation.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="flex flex-col gap-3 rounded-lg border border-rise-border bg-rise-surface p-5"
          >
            <h2 className="font-semibold text-rise-text">{feature.title}</h2>
            <p className="flex-1 text-sm text-rise-muted">{feature.body}</p>
            <Link
              href={feature.href}
              className="text-sm font-medium text-rise-accent hover:underline"
            >
              {feature.cta} →
            </Link>
          </div>
        ))}
      </section>
    </div>
  );
}
