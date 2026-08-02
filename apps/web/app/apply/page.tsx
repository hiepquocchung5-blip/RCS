"use client";

import { useState, type FormEvent } from "react";
import { apply, verifyOtp, ApiError } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { SKILL_LEVELS, type SkillLevel } from "@rcs/shared";

type Step = "form" | "otp" | "done";

const ROLE_OPTIONS = ["pm", "devops", "frontend", "backend"] as const;

export default function ApplyPage() {
  const [step, setStep] = useState<Step>("form");
  const [applicationId, setApplicationId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("frontend");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("mid");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  async function submitApplication(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const result = await apply({
        email,
        name,
        githubUrl,
        requestedRole: role,
        skillLevel,
      });
      setApplicationId(result.applicationId);
      setStep("otp");
      toast(
        "info",
        "OTP sent to your email — it expires in exactly 5 minutes. (Dev mode: check the API console.)",
      );
    } catch (error) {
      if (error instanceof ApiError && error.issues) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of error.issues) {
          const path = issue.path.join(".");
          fieldErrors[path] = issue.message;
        }
        setErrors(fieldErrors);
        toast("error", "Please fix the validation errors below.");
      } else {
        toast("error", error instanceof Error ? error.message : "application failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await verifyOtp(applicationId, otp);
      setStep("done");
      toast("success", "Email verified. Your application is with the Admin now.");
    } catch (error) {
      if (error instanceof ApiError && error.issues) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of error.issues) {
          const path = issue.path.join(".");
          fieldErrors[path] = issue.message;
        }
        setErrors(fieldErrors);
        toast("error", "Please fix the validation errors below.");
      } else {
        toast("error", error instanceof Error ? error.message : "OTP rejected");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center p-6">
      {/* Background Orbs */}
      <div
        className="orb float-slow left-[10%] top-[15%] h-80 w-80"
        style={{ background: "color-mix(in srgb, var(--color-rise-accent) 15%, transparent)" }}
      />
      <div
        className="orb glow-pulse right-[10%] bottom-[15%] h-72 w-72"
        style={{ background: "color-mix(in srgb, var(--color-rise-gold) 10%, transparent)" }}
      />

      <div className="fade-up relative w-full max-w-lg rounded-2xl border border-rise-border/80 bg-rise-surface/60 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.37)] backdrop-blur-lg sm:p-10">
        {step === "form" && (
          <form onSubmit={submitApplication} className="flex flex-col gap-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-rise-gold">
                Onboarding Portal
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-rise-text">Apply to RCS</h1>
              <p className="mt-2 text-xs leading-relaxed text-rise-muted">
                Developer applications are reviewed by the Admin after email
                verification. Join a structured, senior-led squad.
              </p>
            </div>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-rise-muted">
              Full name
              <input
                required
                placeholder="e.g. John Doe"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 rounded-lg border border-rise-border bg-rise-bg/40 px-3.5 py-2.5 text-sm text-rise-text placeholder-rise-muted/50 outline-none transition-all duration-300 focus:border-rise-accent focus:bg-rise-bg/80 focus:shadow-[0_0_12px_rgba(0,240,255,0.15)]"
              />
              {errors.name && <span className="mt-1 text-xs font-normal normal-case tracking-normal text-rise-error">{errors.name}</span>}
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-rise-muted">
              Email
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 rounded-lg border border-rise-border bg-rise-bg/40 px-3.5 py-2.5 text-sm text-rise-text placeholder-rise-muted/50 outline-none transition-all duration-300 focus:border-rise-accent focus:bg-rise-bg/80 focus:shadow-[0_0_12px_rgba(0,240,255,0.15)]"
              />
              {errors.email && <span className="mt-1 text-xs font-normal normal-case tracking-normal text-rise-error">{errors.email}</span>}
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-rise-muted">
              GitHub profile
              <input
                type="url"
                required
                placeholder="https://github.com/you"
                value={githubUrl}
                onChange={(event) => setGithubUrl(event.target.value)}
                className="mt-1 rounded-lg border border-rise-border bg-rise-bg/40 px-3.5 py-2.5 text-sm text-rise-text placeholder-rise-muted/50 outline-none transition-all duration-300 focus:border-rise-accent focus:bg-rise-bg/80 focus:shadow-[0_0_12px_rgba(0,240,255,0.15)]"
              />
              {errors.githubUrl && <span className="mt-1 text-xs font-normal normal-case tracking-normal text-rise-error">{errors.githubUrl}</span>}
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-rise-muted">
                Role
                <select
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as (typeof ROLE_OPTIONS)[number])
                  }
                  className="mt-1 rounded-lg border border-rise-border bg-rise-bg/40 px-3.5 py-2.5 text-sm text-rise-text outline-none transition-all duration-300 focus:border-rise-accent focus:bg-rise-bg/80 focus:shadow-[0_0_12px_rgba(0,240,255,0.15)]"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option} value={option} className="bg-rise-surface">
                      {option}
                    </option>
                  ))}
                </select>
                {errors.requestedRole && <span className="mt-1 text-xs font-normal normal-case tracking-normal text-rise-error">{errors.requestedRole}</span>}
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-rise-muted">
                Experience level
                <select
                  value={skillLevel}
                  onChange={(event) => setSkillLevel(event.target.value as SkillLevel)}
                  className="mt-1 rounded-lg border border-rise-border bg-rise-bg/40 px-3.5 py-2.5 text-sm text-rise-text capitalize outline-none transition-all duration-300 focus:border-rise-accent focus:bg-rise-bg/80 focus:shadow-[0_0_12px_rgba(0,240,255,0.15)]"
                >
                  {SKILL_LEVELS.map((level) => (
                    <option key={level} value={level} className="capitalize bg-rise-surface">
                      {level}
                    </option>
                  ))}
                </select>
                {errors.skillLevel && <span className="mt-1 text-xs font-normal normal-case tracking-normal text-rise-error">{errors.skillLevel}</span>}
              </label>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="mt-2 relative overflow-hidden rounded-full bg-rise-accent px-6 py-3 text-sm font-semibold text-rise-bg shadow-[0_4px_20px_rgba(0,240,255,0.2)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_6px_24px_rgba(0,240,255,0.35)] active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit application"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={submitOtp} className="flex flex-col gap-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-rise-accent">
                Security Check
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-rise-text">Verify your email</h1>
              <p className="mt-2 text-xs leading-relaxed text-rise-muted">
                Enter the 6-digit verification code sent to your email. It expires strictly 5 minutes after issue.
              </p>
            </div>
            <input
              required
              pattern="\d{6}"
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              placeholder="000000"
              className="rounded-xl border border-rise-border bg-rise-bg/40 px-4 py-3 text-center font-mono text-3xl tracking-[0.6em] text-rise-text outline-none transition-all duration-300 focus:border-rise-accent focus:bg-rise-bg/80 focus:shadow-[0_0_16px_rgba(0,240,255,0.2)]"
            />
            {errors.otp && <span className="text-xs text-center font-normal text-rise-error">{errors.otp}</span>}
            <button
              type="submit"
              disabled={busy}
              className="relative overflow-hidden rounded-full bg-rise-accent px-6 py-3 text-sm font-semibold text-rise-bg shadow-[0_4px_20px_rgba(0,240,255,0.2)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_6px_24px_rgba(0,240,255,0.35)] active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="flex flex-col gap-4 text-center py-6">
            <span className="text-5xl animate-bounce">✨</span>
            <h1 className="text-2xl font-bold text-rise-text">Application verified</h1>
            <p className="text-sm leading-relaxed text-rise-muted px-4">
              The Admin will review your application. On approval you&apos;ll
              receive a one-time magic link containing your generated
              16-character credential.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
