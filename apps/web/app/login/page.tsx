"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { useToast } from "@/components/ToastProvider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await login(email, password);
      saveSession(result);
      window.dispatchEvent(new Event("rcs:session"));
      toast("success", `Welcome back, ${result.user.name}.`);
      router.push("/workspace");
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-rise-border bg-rise-surface p-6"
      >
        <div>
          <h1 className="text-lg font-bold">Log in to RCS</h1>
          <p className="text-xs text-rise-muted">
            Profiles are created by the Admin. Your 16-character credential was
            delivered via a one-time magic link.
          </p>
        </div>
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
          Password
          <input
            type="password"
            required
            minLength={16}
            maxLength={16}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded border border-rise-border bg-rise-bg px-3 py-2 font-mono outline-none focus:border-rise-accent"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-rise-accent px-3 py-2 text-sm font-semibold text-rise-bg transition-opacity disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
