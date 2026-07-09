"use client";

import { useState, type FormEvent } from "react";
import { apply, verifyOtp } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

type Step = "form" | "otp" | "done";

const ROLE_OPTIONS = ["pm", "devops", "frontend", "backend"] as const;

export default function ApplyPage() {
  const [step, setStep] = useState<Step>("form");
  const [applicationId, setApplicationId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("frontend");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function submitApplication(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await apply({ email, name, githubUrl, requestedRole: role });
      setApplicationId(result.applicationId);
      setStep("otp");
      toast(
        "info",
        "OTP sent to your email — it expires in exactly 5 minutes. (Dev mode: check the API console.)",
      );
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "application failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      await verifyOtp(applicationId, otp);
      setStep("done");
      toast("success", "Email verified. Your application is with the Admin now.");
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "OTP rejected");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-rise-border bg-rise-surface p-6">
        {step === "form" && (
          <form onSubmit={submitApplication} className="flex flex-col gap-4">
            <div>
              <h1 className="text-lg font-bold">Apply to RCS</h1>
              <p className="text-xs text-rise-muted">
                Developer applications are reviewed by the Admin after email
                verification.
              </p>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              Full name
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="rounded border border-rise-border bg-rise-bg px-3 py-2 outline-none focus:border-rise-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded border border-rise-border bg-rise-bg px-3 py-2 outline-none focus:border-rise-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              GitHub profile
              <input
                type="url"
                required
                placeholder="https://github.com/you"
                value={githubUrl}
                onChange={(event) => setGithubUrl(event.target.value)}
                className="rounded border border-rise-border bg-rise-bg px-3 py-2 outline-none focus:border-rise-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Role
              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as (typeof ROLE_OPTIONS)[number])
                }
                className="rounded border border-rise-border bg-rise-bg px-3 py-2 outline-none focus:border-rise-accent"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-rise-accent px-3 py-2 text-sm font-semibold text-rise-bg disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit application"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={submitOtp} className="flex flex-col gap-4">
            <div>
              <h1 className="text-lg font-bold">Verify your email</h1>
              <p className="text-xs text-rise-muted">
                Enter the 6-digit code. It expires strictly 5 minutes after
                issue.
              </p>
            </div>
            <input
              required
              pattern="\d{6}"
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              placeholder="000000"
              className="rounded border border-rise-border bg-rise-bg px-3 py-2 text-center font-mono text-2xl tracking-[0.5em] outline-none focus:border-rise-accent"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-rise-accent px-3 py-2 text-sm font-semibold text-rise-bg disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="flex flex-col gap-3 text-center">
            <span className="text-3xl">✅</span>
            <h1 className="text-lg font-bold">Application verified</h1>
            <p className="text-sm text-rise-muted">
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
