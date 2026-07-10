"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearSession, loadSession, type Session } from "@/lib/session";

export function SessionBadge() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

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

  if (session === undefined) {
    return <div aria-hidden="true" className="h-8 w-20 animate-pulse rounded-full bg-rise-surface-2" />;
  }

  if (session === null) {
    return (
      <Link
        href="/login"
        className="whitespace-nowrap rounded-full bg-rise-accent px-4 py-1.5 text-sm font-semibold text-rise-bg transition-transform hover:scale-105"
      >
        Dev Hub
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-rise-muted lg:inline">
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
          window.location.assign("/");
        }}
      >
        Log out
      </button>
    </div>
  );
}
