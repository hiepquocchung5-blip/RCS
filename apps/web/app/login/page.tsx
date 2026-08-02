"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login, ApiError, fieldErrorsFrom } from "@/lib/api";
import { loadSession, saveSession } from "@/lib/session";
import { useToast } from "@/components/ToastProvider";
import { PASSWORD_LENGTH } from "@rcs/shared";

const inputClass =
  "mt-1 w-full rounded-lg border border-rise-border bg-rise-bg/40 px-3.5 py-2.5 text-sm text-rise-text placeholder-rise-muted/50 outline-none transition-all duration-300 focus:border-rise-accent focus:bg-rise-bg/80 focus:shadow-[0_0_12px_rgba(0,240,255,0.15)] aria-[invalid=true]:border-rise-error";

const errorClass =
  "mt-1 text-xs font-normal normal-case tracking-normal text-rise-error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  // Already signed in? Skip the form and go straight to the portal.
  useEffect(() => {
    if (loadSession() !== null) router.replace("/projects");
  }, [router]);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const result = await login(email.trim(), password);
      saveSession(result);
      window.dispatchEvent(new Event("rcs:session"));
      toast("success", `Welcome back, ${result.user.name}.`);
      router.push("/projects");
    } catch (error) {
      const fieldErrors = fieldErrorsFrom(error);
      if (fieldErrors !== null) {
        setErrors(fieldErrors);
        toast("error", "Please fix the validation errors below.");
      } else if (error instanceof ApiError && error.status === 401) {
        setErrors({ password: "Email or password is incorrect." });
        toast("error", "Email or password is incorrect.");
      } else if (error instanceof ApiError && error.status === 429) {
        toast("error", "Too many sign-in attempts. Please wait a few minutes and try again.");
      } else {
        toast("error", error instanceof Error ? error.message : "Sign-in failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center p-6">
      {/* Background Orbs */}
      <div
        className="orb glow-pulse left-[15%] top-[15%] h-72 w-72"
        style={{ background: "color-mix(in srgb, var(--color-rise-accent) 15%, transparent)" }}
      />
      <div
        className="orb float-slow right-[15%] bottom-[15%] h-64 w-64"
        style={{ background: "color-mix(in srgb, var(--color-rise-gold) 10%, transparent)" }}
      />

      <form
        onSubmit={onSubmit}
        className="fade-up relative flex w-full max-w-md flex-col gap-5 rounded-2xl border border-rise-border/80 bg-rise-surface/60 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.37)] backdrop-blur-lg sm:p-10"
      >
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-rise-gold">
            Delivery Portal
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-rise-text">Welcome back</h1>
          <p className="mt-2 text-xs leading-relaxed text-rise-muted">
            Sign in to manage projects, delivery and team activity. New team
            members receive credentials after their application is approved.
            Clients don&apos;t need an account — use the{" "}
            <Link href="/portal" className="font-medium text-rise-gold hover:text-rise-accent hover:underline">
              Client Portal
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-rise-muted">
          <label htmlFor="login-email">Email Address</label>
          <input
            id="login-email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            spellCheck={false}
            placeholder="name@risecorestudio.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={errors.email !== undefined}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            className={inputClass}
          />
          {errors.email && (
            <span id="login-email-error" role="alert" className={errorClass}>
              {errors.email}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-rise-muted">
          <label htmlFor="login-password">Password</label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={PASSWORD_LENGTH}
              maxLength={PASSWORD_LENGTH}
              autoComplete="current-password"
              spellCheck={false}
              placeholder="••••••••••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={errors.password !== undefined}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              className={`${inputClass} pr-16 font-mono`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 top-1 flex items-center px-3.5 text-[10px] font-semibold uppercase tracking-wider text-rise-muted transition-colors hover:text-rise-accent"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && (
            <span id="login-password-error" role="alert" className={errorClass}>
              {errors.password}
            </span>
          )}
          <span className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-rise-muted/70">
            RCS credentials are exactly {PASSWORD_LENGTH} characters.
          </span>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 relative overflow-hidden rounded-full bg-rise-accent px-6 py-3 text-sm font-semibold text-rise-bg shadow-[0_4px_20px_rgba(0,240,255,0.2)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_6px_24px_rgba(0,240,255,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-xs text-rise-muted">
          Interested in joining the team?{" "}
          <Link href="/apply" className="font-semibold text-rise-accent hover:underline">Apply to RCS</Link>
        </p>
      </form>
    </div>
  );
}
