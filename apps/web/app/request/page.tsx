"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { PROJECT_TYPES, PROJECT_TYPE_LABELS, type ProjectType } from "@rcs/shared";
import { submitOrder } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

export default function RequestPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("web_app");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      await submitOrder({ name, email, company, projectType, brief });
      setDone(true);
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "request failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="fade-up max-w-md rounded-xl border border-rise-border bg-rise-surface p-10 text-center">
          <p className="font-display text-3xl text-rise-success">Received.</p>
          <p className="mt-3 text-sm text-rise-muted">
            Your brief is with our Admin. A project manager will scope it into
            milestones and reply at <span className="text-rise-text">{email}</span>.
          </p>
          <Link
            href="/showcase"
            className="mt-6 inline-block text-sm text-rise-accent hover:underline"
          >
            Browse the gallery while you wait →
          </Link>
        </div>
      </div>
    );
  }

  const inputClass =
    "rounded border border-rise-border bg-rise-bg px-3 py-2 text-sm outline-none focus:border-rise-accent";

  return (
    <div className="relative min-h-full">
      <div
        className="orb float-slow left-[-8%] top-[10%] h-72 w-72"
        style={{ background: "color-mix(in srgb, var(--color-rise-accent) 16%, transparent)" }}
      />
      <div className="mx-auto max-w-xl px-6 py-16">
        <p className="fade-up font-mono text-xs uppercase tracking-[0.4em] text-rise-gold">
          Client Portal
        </p>
        <h1 className="fade-up fade-up-1 font-display mt-4 text-4xl">
          Commission a project.
        </h1>
        <p className="fade-up fade-up-2 mt-3 text-sm text-rise-muted">
          Tell us what you need. The Admin reviews every order personally; a
          PM then scopes it into a project with a hand-picked team.
        </p>
        <form onSubmit={onSubmit} className="fade-up fade-up-3 mt-10 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Your name
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Company <span className="text-xs text-rise-muted">(optional)</span>
              <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Project type
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value as ProjectType)}
                className={inputClass}
              >
                {PROJECT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {PROJECT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            The brief
            <textarea
              required
              minLength={10}
              rows={5}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="What are we building, for whom, and by when?"
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-full bg-rise-accent px-6 py-2.5 text-sm font-semibold text-rise-bg transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            {busy ? "Sending…" : "Submit the brief"}
          </button>
        </form>
      </div>
    </div>
  );
}
