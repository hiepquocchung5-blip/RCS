import Link from "next/link";

/**
 * Portal split: RCS is a dual-portal ecosystem. Clients and developers enter
 * through clearly separated doors with their own auth expectations.
 */
export default function PortalPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
        <section className="fade-up flex flex-col rounded-xl border border-rise-gold/40 bg-rise-surface p-8 transition-all hover:-translate-y-1 hover:border-rise-gold">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-rise-gold">
            Client Portal
          </p>
          <h1 className="font-display mt-3 text-3xl">The Gallery</h1>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-rise-muted">
            Browse finished work and commission your own. No account needed —
            your brief goes straight to the Admin's desk and a PM follows up
            personally.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/showcase"
              className="rounded-full border border-rise-gold px-5 py-2 text-center text-sm text-rise-gold transition-colors hover:bg-rise-gold hover:text-rise-bg"
            >
              View the showcase
            </Link>
            <Link
              href="/request"
              className="rounded-full bg-rise-gold px-5 py-2 text-center text-sm font-semibold text-rise-bg transition-transform hover:scale-[1.02]"
            >
              Request a project
            </Link>
          </div>
        </section>

        <section className="fade-up fade-up-1 flex flex-col rounded-xl border border-rise-accent/40 bg-rise-surface p-8 transition-all hover:-translate-y-1 hover:border-rise-accent">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-rise-accent">
            Developer Portal
          </p>
          <h1 className="font-display mt-3 text-3xl">The Dev Hub</h1>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-rise-muted">
            A role-aware delivery hub for project planning, guided team
            formation, focused project communication and transparent delivery
            workflows. Accounts are provisioned after verification.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/login"
              className="rounded-full bg-rise-accent px-5 py-2 text-center text-sm font-semibold text-rise-bg transition-transform hover:scale-[1.02]"
            >
              Open Dev Hub
            </Link>
            <Link
              href="/apply"
              className="rounded-full border border-rise-accent px-5 py-2 text-center text-sm text-rise-accent transition-colors hover:bg-rise-accent hover:text-rise-bg"
            >
              Apply to join
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
