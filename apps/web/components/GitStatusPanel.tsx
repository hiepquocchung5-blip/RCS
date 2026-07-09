"use client";

import { useCallback, useEffect, useState } from "react";
import type { GitState } from "@rcs/shared";
import { useBridge } from "./BridgeProvider";

/** Live `git status` of the connected workspace — no mock data. */
export function GitStatusPanel() {
  const { status, gitStatus } = useBridge();
  const [state, setState] = useState<GitState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await gitStatus());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "git status failed");
    }
  }, [gitStatus]);

  useEffect(() => {
    if (status === "connected") {
      void refresh();
    } else {
      setState(null);
      setError(null);
    }
  }, [status, refresh]);

  return (
    <div className="border-b border-rise-border">
      <div className="flex items-center border-b border-rise-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rise-muted">
        Git
        {status === "connected" && (
          <button
            type="button"
            onClick={() => void refresh()}
            className="ml-auto rounded px-1.5 text-rise-muted normal-case hover:text-rise-accent"
            title="Refresh git status"
          >
            ↻
          </button>
        )}
      </div>
      <div className="space-y-2 p-3 text-sm">
        {status !== "connected" ? (
          <p className="text-xs text-rise-muted">
            Connect the terminal bridge to see the live git status of your
            working copy.
          </p>
        ) : error !== null ? (
          <p className="text-xs text-rise-error">{error}</p>
        ) : state === null ? (
          <p className="text-xs text-rise-muted">Reading git status…</p>
        ) : !state.isRepo ? (
          <p className="text-xs text-rise-muted">
            The workspace folder is not a git repository. Clone your GitHub
            repo and point <code className="text-rise-accent">RCS_WORKSPACE_DIR</code>{" "}
            at it.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-rise-accent">⎇</span>
              <span className="truncate" title={state.branch}>
                {state.branch}
              </span>
              {(state.ahead > 0 || state.behind > 0) && (
                <span className="ml-auto rounded bg-rise-surface-2 px-1.5 text-rise-success">
                  {state.ahead > 0 ? `↑${state.ahead}` : ""}
                  {state.behind > 0 ? ` ↓${state.behind}` : ""}
                </span>
              )}
            </div>
            {state.staged.length + state.modified.length + state.untracked.length ===
            0 ? (
              <p className="font-mono text-xs text-rise-success">
                ✓ working tree clean
              </p>
            ) : (
              <ul className="max-h-32 space-y-1 overflow-auto font-mono text-xs">
                {state.staged.map((file) => (
                  <li key={`s-${file}`} className="truncate text-rise-success" title={file}>
                    A {file}
                  </li>
                ))}
                {state.modified.map((file) => (
                  <li key={`m-${file}`} className="truncate text-rise-warning" title={file}>
                    M {file}
                  </li>
                ))}
                {state.untracked.map((file) => (
                  <li key={`u-${file}`} className="truncate text-rise-muted" title={file}>
                    ? {file}
                  </li>
                ))}
              </ul>
            )}
            {state.lastCommit.length > 0 && (
              <p className="truncate text-xs text-rise-muted" title={state.lastCommit}>
                ● {state.lastCommit}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
