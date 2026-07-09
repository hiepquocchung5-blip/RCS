"use client";

import { useEffect, useRef } from "react";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { BRIDGE_URL, useBridge, type BridgeStatus } from "./BridgeProvider";

const STATUS_META: Record<BridgeStatus, { color: string; label: string }> = {
  disconnected: { color: "bg-rise-error", label: "Disconnected" },
  connecting: { color: "bg-rise-warning", label: "Connecting…" },
  connected: { color: "bg-rise-success", label: "Connected (local)" },
};

export function TerminalPane() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const bridge = useBridge();
  const { status, sendInput, sendResize, onTerm, connect, disconnect } = bridge;

  // Mount xterm.js once, client-side only.
  useEffect(() => {
    let disposed = false;
    if (containerRef.current === null) return;
    void Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]).then(
      ([{ Terminal: XTerm }, { FitAddon: Fit }]) => {
        if (disposed || containerRef.current === null) return;
        const term = new XTerm({
          fontSize: 13,
          fontFamily: "SF Mono, Menlo, monospace",
          cursorBlink: true,
          theme: {
            background: "#0f111a",
            foreground: "#d6dae6",
            cursor: "#00f0ff",
            selectionBackground: "#00f0ff33",
          },
        });
        const fit = new Fit();
        term.loadAddon(fit);
        term.open(containerRef.current);
        fit.fit();
        term.writeln("RCS Local Terminal Bridge — not connected.");
        term.writeln(
          `Run [36mnpm run rcs-cli[0m locally, then press Connect.`,
        );
        term.onData((data) => sendInput(data));
        term.onResize(({ cols, rows }) => sendResize(cols, rows));
        termRef.current = term;
        fitRef.current = fit;
        const onWindowResize = () => fit.fit();
        window.addEventListener("resize", onWindowResize);
      },
    );
    return () => {
      disposed = true;
      termRef.current?.dispose();
      termRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Relay bridge events into the terminal.
  useEffect(() => {
    return onTerm((event) => {
      const term = termRef.current;
      if (term === null) return;
      switch (event.type) {
        case "output":
          term.write(event.data);
          break;
        case "exit":
          term.writeln(`\r\n[33m● shell exited (${event.code ?? "?"})[0m`);
          break;
        case "closed":
          term.writeln("\r\n[31m● bridge disconnected[0m");
          break;
      }
    });
  }, [onTerm]);

  // On connect: size the remote PTY to the pane and focus.
  useEffect(() => {
    if (status !== "connected") return;
    const term = termRef.current;
    const fit = fitRef.current;
    if (term !== null && fit !== null) {
      fit.fit();
      sendResize(term.cols, term.rows);
      term.focus();
    }
  }, [status, sendResize]);

  const meta = STATUS_META[status];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-rise-border bg-rise-surface px-3">
        <span className="flex items-center gap-2 text-xs text-rise-muted">
          <span className={`h-2.5 w-2.5 rounded-full ${meta.color}`} />
          {meta.label}
        </span>
        <span className="font-mono text-xs text-rise-muted">{BRIDGE_URL}</span>
        <div className="ml-auto flex items-center gap-2">
          {status === "disconnected" ? (
            <button
              type="button"
              onClick={() => void connect()}
              className="rounded border border-rise-accent px-3 py-1 text-xs text-rise-accent transition-colors hover:bg-rise-accent hover:text-rise-bg"
            >
              Connect
            </button>
          ) : (
            <button
              type="button"
              onClick={disconnect}
              className="rounded border border-rise-error px-3 py-1 text-xs font-semibold text-rise-error transition-colors hover:bg-rise-error hover:text-rise-bg"
            >
              ■ Disconnect
            </button>
          )}
        </div>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 bg-rise-bg p-1" />
    </div>
  );
}
