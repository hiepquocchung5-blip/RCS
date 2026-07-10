"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SystemLogEntry } from "@rcs/shared";
import { ApiError, listLogs } from "@/lib/api";
import { loadSession } from "@/lib/session";

const ACTOR_COLORS: Record<string, string> = {
  "onboarding-agent": "text-rise-accent",
  "git-sync-agent": "text-rise-success",
  api: "text-rise-muted",
  user: "text-rise-text",
};

export default function LogsPage() {
  const [logs, setLogs] = useState<readonly SystemLogEntry[]>([]);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (loadSession() === null) {
      setDenied(true);
      return;
    }
    listLogs()
      .then((result) => setLogs(result.logs))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) setDenied(true);
      });
  }, []);

  if (denied) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-rise-muted">Activity history requires a session.</p>
        <Link href="/login" className="text-rise-accent hover:underline">
          Log in →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-bold">Activity history</h1>
      <p className="mb-4 text-sm text-rise-muted">
        A transparent record of automated and team-driven delivery events.
      </p>
      <div className="space-y-1 rounded-lg border border-rise-border bg-rise-surface p-4 font-mono text-xs">
        {logs.length === 0 ? (
          <p className="text-rise-muted">No log entries yet.</p>
        ) : (
          logs.map((entry) => (
            <div key={entry.id} className="flex gap-3">
              <span className="shrink-0 text-rise-muted">
                {new Date(entry.createdAt).toLocaleTimeString()}
              </span>
              <span className={`shrink-0 ${ACTOR_COLORS[entry.actor] ?? "text-rise-text"}`}>
                [{entry.actor}]
              </span>
              <span className="text-rise-muted">{entry.action}</span>
              <span className="min-w-0 flex-1 truncate" title={entry.detail}>
                {entry.detail}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
