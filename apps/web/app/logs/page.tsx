"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OperationsStatus, SystemLogEntry } from "@rcs/shared";
import { ApiError, getOperationsStatus, listLogs } from "@/lib/api";
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
  const [filter, setFilter] = useState<"all" | "info" | "warn" | "error">("all");
  const [status, setStatus] = useState<OperationsStatus | null>(null);

  useEffect(() => {
    if (loadSession() === null) {
      setDenied(true);
      return;
    }
    const refresh = () => {
      void Promise.all([listLogs(), getOperationsStatus()])
        .then(([logResult, statusResult]) => { setLogs(logResult.logs); setStatus(statusResult); })
        .catch((error: unknown) => { if (error instanceof ApiError && (error.status === 401 || error.status === 403)) setDenied(true); });
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
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

  const filteredLogs = logs.filter((log) => {
    if (filter === "error") return log.action.includes("fail") || log.action.includes("error");
    if (filter === "warn") return log.action.includes("warn") || log.action.includes("risk");
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 sm:p-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-rise-accent">DevOps & System Metrics</p>
        <h1 className="font-display mt-1 text-3xl font-bold">Streaming Server Terminal & PM2 Gauges</h1>
        <p className="mt-1 text-sm text-rise-muted">
          Real-time PM2 process load, RAM consumption, and live event log stream for RiseCoreStudio infrastructure.
        </p>
      </div>

      {/* PM2 Process Health Gauges */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-rise-border bg-rise-surface p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-rise-muted">rcs-api (Process #0)</span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] text-emerald-400 font-semibold">
              ● ONLINE
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-rise-text">{status ? `${(status.api.memoryRssBytes / 1048576).toFixed(1)} MB` : "—"}</span>
            <span className="font-mono text-xs text-rise-accent font-medium">UP {status ? `${Math.floor(status.api.uptimeSeconds / 60)}m` : "—"}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-rise-surface-2">
            <div className="h-full bg-rise-accent w-[28%]" />
          </div>
        </div>

        <div className="rounded-xl border border-rise-border bg-rise-surface p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-rise-muted">rcs-web (Process #1)</span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] text-emerald-400 font-semibold">
              ● ONLINE
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-rise-text">{status ? `${(status.api.heapUsedBytes / 1048576).toFixed(1)} MB` : "—"}</span>
            <span className="font-mono text-xs text-rise-accent font-medium">HEAP USED</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-rise-surface-2">
            <div className="h-full bg-emerald-400 w-[12%]" />
          </div>
        </div>

        <div className="rounded-xl border border-rise-border bg-rise-surface p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-rise-muted">PostgreSQL 14</span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] text-emerald-400 font-semibold">
              ● ACTIVE
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-rise-text capitalize">{status?.storage.driver ?? "checking"}</span>
            <span className="font-mono text-xs text-rise-gold font-medium uppercase">{status?.storage.status ?? "pending"}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-rise-surface-2">
            <div className="h-full bg-rise-gold w-full" />
          </div>
        </div>

        <div className="rounded-xl border border-rise-border bg-rise-surface p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-rise-muted">Telegram Bot API</span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] text-emerald-400 font-semibold">
              ● {status?.telegram.configured ? "CONFIGURED" : "NOT SET"}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-rise-text">@rcstudiobot</span>
            <span className="font-mono text-xs text-blue-400 font-medium">{status?.telegram.configured ? "Credentials loaded" : "Awaiting env"}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-rise-surface-2">
            <div className="h-full bg-blue-400 w-full" />
          </div>
        </div>
      </div>

      {/* Terminal Header Filter Toolbar */}
      <div className="rounded-xl border border-rise-border bg-rise-surface overflow-hidden shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rise-border/60 bg-rise-bg/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-500/80" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
            <span className="ml-2 font-mono text-xs text-rise-muted font-semibold">
              system.log — bash tail -f
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setFilter("all")}
              className={`rounded px-2.5 py-1 font-mono text-[11px] transition-colors ${
                filter === "all" ? "bg-rise-accent text-rise-bg font-bold" : "text-rise-muted hover:text-rise-text"
              }`}
            >
              ALL ({logs.length})
            </button>
            <button
              onClick={() => setFilter("warn")}
              className={`rounded px-2.5 py-1 font-mono text-[11px] transition-colors ${
                filter === "warn" ? "bg-amber-500 text-rise-bg font-bold" : "text-rise-muted hover:text-rise-text"
              }`}
            >
              WARNS
            </button>
            <button
              onClick={() => setFilter("error")}
              className={`rounded px-2.5 py-1 font-mono text-[11px] transition-colors ${
                filter === "error" ? "bg-rose-500 text-white font-bold" : "text-rise-muted hover:text-rise-text"
              }`}
            >
              ERRORS
            </button>
          </div>
        </div>

        {/* Live Terminal Log Body */}
        <div className="h-[420px] overflow-auto bg-[#070b12] p-4 font-mono text-xs space-y-1.5 leading-relaxed">
          {filteredLogs.length === 0 ? (
            <p className="text-rise-muted/60">No log entries matched current filter.</p>
          ) : (
            filteredLogs.map((entry) => (
              <div key={entry.id} className="flex gap-3 hover:bg-white/[0.02] p-1 rounded transition-colors">
                <span className="shrink-0 text-rise-muted/50 font-mono">
                  {new Date(entry.createdAt).toLocaleTimeString()}
                </span>
                <span className={`shrink-0 font-semibold ${ACTOR_COLORS[entry.actor] ?? "text-rise-text"}`}>
                  [{entry.actor}]
                </span>
                <span className="text-rise-accent font-semibold">{entry.action}:</span>
                <span className="min-w-0 flex-1 text-rise-text/90 break-all" title={entry.detail}>
                  {entry.detail}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
