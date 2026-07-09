"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearSession, loadSession, type Session } from "@/lib/session";

export function SessionBadge() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(loadSession());
    const onStorage = () => setSession(loadSession());
    window.addEventListener("storage", onStorage);
    window.addEventListener("rcs:session", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("rcs:session", onStorage);
    };
  }, []);

  if (session === null) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link href="/apply" className="text-rise-muted hover:text-rise-accent">
          Apply
        </Link>
        <Link
          href="/login"
          className="rounded border border-rise-accent px-3 py-1 text-rise-accent transition-colors hover:bg-rise-accent hover:text-rise-bg"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-rise-muted">
        {session.user.name}
        <span className="ml-1 rounded bg-rise-surface-2 px-1.5 py-0.5 text-xs uppercase text-rise-accent">
          {session.user.role}
        </span>
      </span>
      <button
        type="button"
        className="text-rise-muted hover:text-rise-error"
        onClick={() => {
          clearSession();
          window.dispatchEvent(new Event("rcs:session"));
        }}
      >
        Log out
      </button>
    </div>
  );
}
