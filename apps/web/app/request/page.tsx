"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { PROJECT_TYPES, PROJECT_TYPE_LABELS, type ProjectType } from "@rcs/shared";
import { submitOrder, ApiError, fieldErrorsFrom } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

const BRIEF_MIN = 10;
const BRIEF_MAX = 10_000;

const inputClass =
  "mt-1 w-full rounded-lg border border-rise-border bg-rise-bg/40 px-3.5 py-2.5 text-sm text-rise-text placeholder-rise-muted/50 outline-none transition-all duration-300 focus:border-rise-accent focus:bg-rise-bg/80 focus:shadow-[0_0_12px_rgba(0,240,255,0.15)] aria-[invalid=true]:border-rise-error";

const errorClass =
  "mt-1 text-xs font-normal normal-case tracking-normal text-rise-error";

export default function RequestPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("web_app");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await submitOrder({
        name: name.trim(),
        email: email.trim(),
        company: company.trim(),
        telegramUsername: telegramUsername.trim(),
        projectType,
        brief: brief.trim(),
      });
      toast("success", "Your brief is in. We'll reply by email and Telegram.");
      setDone(true);
    } catch (error) {
      const fieldErrors = fieldErrorsFrom(error);
      if (fieldErrors !== null) {
        setErrors(fieldErrors);
        toast("error", "Please fix the validation errors below.");
      } else if (error instanceof ApiError && error.status === 429) {
        toast("error", "Too many requests from this connection. Please wait a few minutes and try again.");
      } else {
        toast("error", error instanceof Error ? error.message : "Request failed. Please try again.");
      }
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

  const briefTooShort = brief.trim().length > 0 && brief.trim().length < BRIEF_MIN;

  return (
    <div className="relative min-h-full flex items-center justify-center p-6">
      {/* Background Orbs */}
      <div
        className="orb float-slow left-[10%] top-[10%] h-80 w-80"
        style={{ background: "color-mix(in srgb, var(--color-rise-accent) 15%, transparent)" }}
      />
      <div
        className="orb glow-pulse right-[10%] bottom-[10%] h-72 w-72"
        style={{ background: "color-mix(in srgb, var(--color-rise-gold) 10%, transparent)" }}
      />

      <div className="fade-up relative w-full max-w-2xl rounded-2xl border border-rise-border/80 bg-rise-surface/60 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.37)] backdrop-blur-lg sm:p-10 my-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-rise-gold">
            Client Portal
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-rise-text">
            Commission a project
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-rise-muted">
            Tell us what you need. The Admin reviews every order personally; a
            PM then scopes it into a project with a hand-picked squad.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-rise-muted">
              <label htmlFor="request-name">Your name</label>
              <input
                id="request-name"
                required
                maxLength={120}
                autoComplete="name"
                placeholder="e.g. Alice Vance"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={errors.name !== undefined}
                aria-describedby={errors.name ? "request-name-error" : undefined}
                className={inputClass}
              />
              {errors.name && (
                <span id="request-name-error" role="alert" className={errorClass}>
                  {errors.name}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-rise-muted">
              <label htmlFor="request-email">Email</label>
              <input
                id="request-email"
                type="email"
                required
                maxLength={320}
                autoComplete="email"
                spellCheck={false}
                placeholder="alice@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={errors.email !== undefined}
                aria-describedby={errors.email ? "request-email-error" : undefined}
                className={inputClass}
              />
              {errors.email && (
                <span id="request-email-error" role="alert" className={errorClass}>
                  {errors.email}
                </span>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-rise-muted">
              <label htmlFor="request-company">
                Company <span className="text-[10px] font-normal normal-case text-rise-muted/70">(optional)</span>
              </label>
              <input
                id="request-company"
                maxLength={160}
                autoComplete="organization"
                placeholder="e.g. Acme Corp"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                aria-invalid={errors.company !== undefined}
                aria-describedby={errors.company ? "request-company-error" : undefined}
                className={inputClass}
              />
              {errors.company && (
                <span id="request-company-error" role="alert" className={errorClass}>
                  {errors.company}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-rise-muted">
              <label htmlFor="request-telegram">
                Telegram Handle <span className="text-[10px] font-normal normal-case text-rise-muted/70">(optional)</span>
              </label>
              <input
                id="request-telegram"
                maxLength={80}
                placeholder="@username"
                value={telegramUsername}
                onChange={(e) => setTelegramUsername(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-rise-muted">
              <label htmlFor="request-type">Project type</label>
              <select
                id="request-type"
                value={projectType}
                onChange={(e) => setProjectType(e.target.value as ProjectType)}
                aria-invalid={errors.projectType !== undefined}
                aria-describedby={errors.projectType ? "request-type-error" : undefined}
                className={inputClass}
              >
                {PROJECT_TYPES.map((type) => (
                  <option key={type} value={type} className="bg-rise-surface">
                    {PROJECT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              {errors.projectType && (
                <span id="request-type-error" role="alert" className={errorClass}>
                  {errors.projectType}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-rise-muted">
            <label htmlFor="request-brief">The brief</label>
            <textarea
              id="request-brief"
              required
              minLength={BRIEF_MIN}
              maxLength={BRIEF_MAX}
              rows={5}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="What are we building, for whom, and by when?"
              aria-invalid={errors.brief !== undefined || briefTooShort}
              aria-describedby={errors.brief ? "request-brief-error" : "request-brief-hint"}
              className={inputClass}
            />
            {errors.brief ? (
              <span id="request-brief-error" role="alert" className={errorClass}>
                {errors.brief}
              </span>
            ) : (
              <span
                id="request-brief-hint"
                className={`mt-1 text-[10px] font-normal normal-case tracking-normal ${briefTooShort ? "text-rise-error" : "text-rise-muted/70"}`}
              >
                {briefTooShort
                  ? `A few more words — briefs need at least ${BRIEF_MIN} characters.`
                  : "The more context you give (goals, audience, timeline), the sharper our scoping."}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-2 relative overflow-hidden rounded-full bg-rise-accent px-6 py-3 text-sm font-semibold text-rise-bg shadow-[0_4px_20px_rgba(0,240,255,0.2)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_6px_24px_rgba(0,240,255,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Sending…" : "Submit the brief"}
          </button>
        </form>
      </div>
    </div>
  );
}
