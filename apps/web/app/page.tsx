import Link from "next/link";

// Keep the public entry shell synchronized with the currently deployed asset
// manifest. This avoids a cached HTML document referencing retired JS/CSS
// chunks after a deployment or local production rebuild.
export const dynamic = "force-dynamic";

const SERVICES = [
  {
    number: "01",
    title: "Product engineering",
    body: "Senior-led teams design and deliver dependable web, mobile and platform products around clear business outcomes.",
  },
  {
    number: "02",
    title: "Purpose-built teams",
    body: "Every engagement is staffed against its technical needs, delivery stage and opportunities for meaningful mentorship.",
  },
  {
    number: "03",
    title: "Transparent delivery",
    body: "Clients and teams share a structured view of scope, ownership and progress from first brief through final handover.",
  },
] as const;

const PROCESS = [
  ["Discover", "We clarify the opportunity, constraints and measure of success."],
  ["Plan", "A project lead shapes the roadmap, team and delivery milestones."],
  ["Deliver", "The team works in focused stages with visible progress and review."],
  ["Evolve", "We launch, learn and support the product beyond its first release."],
] as const;

export default function HomePage() {
  return (
    <div className="relative min-h-full overflow-x-hidden">
      <div
        className="orb glow-pulse left-[-10%] top-[-10%] h-96 w-96"
        style={{ background: "color-mix(in srgb, var(--color-rise-accent) 20%, transparent)" }}
      />
      <div
        className="orb float-slow right-[-8%] top-[35%] h-80 w-80"
        style={{ background: "color-mix(in srgb, var(--color-rise-gold) 14%, transparent)" }}
      />

      <section className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pb-24 pt-24 text-center">
        <p className="fade-up font-mono text-xs uppercase tracking-[0.4em] text-rise-gold">
          Strategy · Design · Engineering
        </p>
        <h1 className="fade-up fade-up-1 font-display mt-6 max-w-4xl text-5xl leading-[1.08] sm:text-7xl">
          Digital products built with <em className="text-rise-accent">clarity</em>,
          craft and care.
        </h1>
        <p className="fade-up fade-up-2 mt-7 max-w-2xl text-base leading-relaxed text-rise-muted sm:text-lg">
          RiseCoreStudio partners with ambitious teams to turn complex ideas
          into thoughtful, scalable software—and keeps every stage of delivery visible.
        </p>
        <div className="fade-up fade-up-3 mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/request" className="rounded-full bg-rise-accent px-7 py-3 text-sm font-semibold text-rise-bg transition-transform hover:scale-105">
            Start a project
          </Link>
          <Link href="/showcase" className="rounded-full border border-rise-border px-7 py-3 text-sm transition-colors hover:border-rise-accent hover:text-rise-accent">
            Explore our work
          </Link>
        </div>
        <div className="hairline fade-up fade-up-4 mt-20 w-full" />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-10 max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.32em] text-rise-accent">What we do</p>
          <h2 className="font-display mt-3 text-4xl">A delivery partner, not a hand-off.</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {SERVICES.map((service) => (
            <article key={service.number} className="rounded-2xl border border-rise-border bg-rise-surface p-7">
              <p className="font-display text-3xl text-rise-gold">{service.number}</p>
              <h3 className="mt-5 text-lg font-semibold">{service.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-rise-muted">{service.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-rise-border bg-rise-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-rise-gold">How we work</p>
            <h2 className="font-display mt-3 text-4xl">A calm, accountable path to launch.</h2>
            <p className="mt-4 text-sm leading-relaxed text-rise-muted">
              Each engagement has clear ownership, deliberate checkpoints and a team matched to the work.
            </p>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-xl border border-rise-border bg-rise-border sm:grid-cols-2">
            {PROCESS.map(([title, body], index) => (
              <li key={title} className="bg-rise-bg p-6">
                <p className="font-mono text-xs text-rise-accent">0{index + 1}</p>
                <h3 className="mt-2 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-rise-muted">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto flex max-w-4xl flex-col items-center px-6 py-24 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.32em] text-rise-accent">Have something in mind?</p>
        <h2 className="font-display mt-4 text-4xl sm:text-5xl">Let’s shape the right way forward.</h2>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-rise-muted">
          Share the challenge, timeline and context. We’ll review your brief and respond with a practical next step.
        </p>
        <Link href="/request" className="mt-8 rounded-full bg-rise-accent px-7 py-3 text-sm font-semibold text-rise-bg transition-transform hover:scale-105">
          Tell us about your project
        </Link>
      </section>
    </div>
  );
}
