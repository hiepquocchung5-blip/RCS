"use client";

import Image from "next/image";
import Link from "next/link";

const VALUES = [
  {
    title: "Extreme Clarity",
    description: "No black boxes. We share real-time progress, explicit requirements, and complete visibility into our delivery pipeline.",
  },
  {
    title: "Engineering Excellence",
    description: "We build systems that last. From robust database schemas to automated CI/CD and clean, scalable Next.js codebases.",
  },
  {
    title: "Guided Mentorship",
    description: "Every engagement pairs senior engineers with talented juniors, cultivating growth and stewardship.",
  },
] as const;

const HISTORY = [
  {
    year: "2021",
    title: "The Genesis",
    description: "RiseCoreStudio was founded by a small collective of senior engineers who believed client delivery could be predictable, structured, and free of scope creep.",
  },
  {
    year: "2023",
    title: "Growth & Architecture",
    description: "We scaled our delivery models, integrating distributed rate limiting, webhook deduplication, and standard state machine engines.",
  },
  {
    year: "2025",
    title: "Enterprise Hub",
    description: "Launched the Developer Portal to manage complex delivery portfolios, assigning dedicated squads dynamically based on project matrices.",
  },
  {
    year: "2026",
    title: "Subdomain Architecture",
    description: "Hardened our operational boundaries across auth.risecorestudio.com, developers.risecorestudio.com, and api.risecorestudio.com.",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="relative min-h-full overflow-x-hidden">
      {/* Background orbs */}
      <div
        className="orb glow-pulse left-[-10%] top-[-10%] h-96 w-96"
        style={{ background: "color-mix(in srgb, var(--color-rise-accent) 15%, transparent)" }}
      />
      <div
        className="orb float-slow right-[-5%] top-[40%] h-80 w-80"
        style={{ background: "color-mix(in srgb, var(--color-rise-gold) 10%, transparent)" }}
      />

      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* Header */}
        <header className="fade-up max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-rise-gold">
            Who We Are
          </p>
          <h1 className="font-display mt-4 text-4xl sm:text-6xl">
            Sovereign engineering for digital products.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-rise-muted sm:text-lg">
            RiseCoreStudio (RCS) is a high-performance software agency. We combine robust platform architecture with an open-source development engine to ship digital products that withstand scale.
          </p>
        </header>

        {/* Brand Showcase Section */}
        <section className="fade-up fade-up-1 mt-16 rounded-2xl border border-rise-border bg-rise-surface p-8">
          <h2 className="font-display text-2xl">Corporate Identity & Brand Assets</h2>
          <p className="mt-2 text-sm text-rise-muted">
            Our identity represents structural integrity, high-speed delivery, and clean design. Here are the official RiseCoreStudio corporate assets:
          </p>
          
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            {/* Logo */}
            <div className="flex flex-col items-center justify-between rounded-xl border border-rise-border bg-rise-bg/60 p-6 text-center">
              <div className="relative flex h-64 w-full items-center justify-center overflow-hidden rounded-lg bg-black">
                <Image
                  src="/logo.jpg"
                  alt="RiseCoreStudio Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="mt-4">
                <h3 className="font-semibold text-rise-gold">Official Corporate Logo</h3>
                <p className="mt-1 text-xs text-rise-muted">High-tech 3D design, featuring metallic finish with gold and blue neon light elements.</p>
              </div>
            </div>

            {/* Icon */}
            <div className="flex flex-col items-center justify-between rounded-xl border border-rise-border bg-rise-bg/60 p-6 text-center">
              <div className="relative flex h-64 w-64 items-center justify-center overflow-hidden rounded-lg bg-black">
                <Image
                  src="/icon.jpg"
                  alt="RiseCoreStudio Platform Icon"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="mt-4">
                <h3 className="font-semibold text-rise-accent">Platform App Icon</h3>
                <p className="mt-1 text-xs text-rise-muted">Sleek digital node integrated inside the letter R, designed for platform dashboards.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="fade-up fade-up-2 mt-20">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-rise-accent">Core Principles</p>
            <h2 className="font-display mt-3 text-3xl sm:text-4xl">Built on accountability.</h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {VALUES.map((value) => (
              <div key={value.title} className="rounded-xl border border-rise-border bg-rise-surface p-6">
                <h3 className="text-lg font-semibold text-rise-text">{value.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-rise-muted">{value.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* History / Timeline */}
        <section className="fade-up fade-up-3 mt-24 border-t border-rise-border pt-20">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-rise-gold">Our History</p>
            <h2 className="font-display mt-3 text-3xl sm:text-4xl">The Journey of RCS</h2>
          </div>
          
          <div className="relative mt-12 border-l border-rise-border pl-6 ml-4 space-y-12">
            {HISTORY.map((milestone) => (
              <div key={milestone.year} className="relative group">
                {/* Bullet */}
                <div className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-rise-accent bg-rise-bg transition-colors group-hover:bg-rise-accent" />
                <span className="font-mono text-sm font-bold text-rise-accent">{milestone.year}</span>
                <h3 className="font-display mt-1 text-xl">{milestone.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-rise-muted max-w-2xl">{milestone.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Call to action */}
        <footer className="fade-up fade-up-4 mt-24 text-center border-t border-rise-border pt-16">
          <h2 className="font-display text-2xl">Ready to build?</h2>
          <p className="mt-2 text-sm text-rise-muted">Explore our portfolio or brief us on your project constraints.</p>
          <div className="mt-6 flex justify-center gap-4">
            <Link href="/request" className="rounded-full bg-rise-accent px-6 py-2.5 text-sm font-semibold text-rise-bg transition-transform hover:scale-105">
              Start a project
            </Link>
            <Link href="/showcase" className="rounded-full border border-rise-border px-6 py-2.5 text-sm transition-colors hover:border-rise-accent hover:text-rise-accent">
              View Showcase
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
