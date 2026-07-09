"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BRIDGE_DEFAULT_PORT,
  parseBridgeServerMessage,
  type BridgeClientMessage,
  type BridgeServerMessage,
  type GitState,
} from "@rcs/shared";
import { fetchBridgeToken, fetchDevBridgeToken } from "@/lib/api";
import { loadSession } from "@/lib/session";
import { useToast } from "./ToastProvider";

/** Red / Yellow / Green states required by PROTOTYPE.md. */
export type BridgeStatus = "disconnected" | "connecting" | "connected";

export const BRIDGE_URL =
  process.env.NEXT_PUBLIC_RCS_BRIDGE ?? `ws://localhost:${BRIDGE_DEFAULT_PORT}`;

export interface BridgeInfo {
  shell: string;
  mode: "pty" | "pipe";
}

type TermEvent =
  | { type: "output"; data: string }
  | { type: "exit"; code: number | null }
  | { type: "closed" };

interface PendingRequest {
  resolve(message: BridgeServerMessage): void;
  reject(error: Error): void;
}

interface BridgeContextValue {
  status: BridgeStatus;
  info: BridgeInfo | null;
  connect(): Promise<void>;
  /** Hard kill switch: closes the socket; the daemon terminates the shell. */
  disconnect(): void;
  sendInput(data: string): void;
  sendResize(cols: number, rows: number): void;
  /** Subscribe to terminal output/exit events; returns an unsubscribe fn. */
  onTerm(listener: (event: TermEvent) => void): () => void;
  fetchTree(): Promise<{ root: string; files: string[] }>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  gitStatus(): Promise<GitState>;
}

const BridgeContext = createContext<BridgeContextValue | null>(null);

export function useBridge(): BridgeContextValue {
  const ctx = useContext(BridgeContext);
  if (ctx === null) throw new Error("useBridge must be used inside BridgeProvider");
  return ctx;
}

const REQUEST_TIMEOUT_MS = 10_000;

export function BridgeProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());
  const termListenersRef = useRef<Set<(event: TermEvent) => void>>(new Set());
  const [status, setStatus] = useState<BridgeStatus>("disconnected");
  const [info, setInfo] = useState<BridgeInfo | null>(null);
  const { toast } = useToast();

  const emitTerm = useCallback((event: TermEvent) => {
    for (const listener of termListenersRef.current) listener(event);
  }, []);

  const send = useCallback((message: BridgeClientMessage) => {
    const socket = socketRef.current;
    if (socket !== null && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, []);

  const failAllPending = useCallback((reason: string) => {
    for (const pending of pendingRef.current.values()) {
      pending.reject(new Error(reason));
    }
    pendingRef.current.clear();
  }, []);

  const connect = useCallback(async () => {
    if (socketRef.current !== null) return;
    setStatus("connecting");
    let token: string;
    try {
      const result =
        loadSession() !== null
          ? await fetchBridgeToken()
          : await fetchDevBridgeToken();
      token = result.token;
    } catch (error) {
      setStatus("disconnected");
      toast(
        "error",
        `Bridge token refused: ${error instanceof Error ? error.message : "unknown error"}`,
      );
      return;
    }

    const socket = new WebSocket(BRIDGE_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "term:auth", token }));
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      const message = parseBridgeServerMessage(event.data);
      if (message === null) return;
      switch (message.type) {
        case "term:ready":
          setStatus("connected");
          setInfo({ shell: message.shell, mode: message.mode });
          toast(
            "success",
            `Terminal bridged to local ${message.shell} (${message.mode} mode) — commands and files stay on your machine.`,
          );
          break;
        case "term:output":
          emitTerm({ type: "output", data: message.data });
          break;
        case "term:exit":
          emitTerm({ type: "exit", code: message.code });
          toast("info", `Local shell exited (code ${message.code ?? "none"}).`);
          break;
        case "term:error":
          toast("error", `Bridge error: ${message.message}`);
          break;
        case "fs:tree":
        case "fs:file":
        case "fs:ok":
        case "git:state": {
          const pending = pendingRef.current.get(message.id);
          if (pending !== undefined) {
            pendingRef.current.delete(message.id);
            pending.resolve(message);
          }
          break;
        }
        case "fs:error": {
          const pending = pendingRef.current.get(message.id);
          if (pending !== undefined) {
            pendingRef.current.delete(message.id);
            pending.reject(new Error(message.message));
          }
          break;
        }
      }
    };

    socket.onclose = () => {
      socketRef.current = null;
      setStatus("disconnected");
      setInfo(null);
      failAllPending("bridge disconnected");
      emitTerm({ type: "closed" });
    };

    socket.onerror = () => {
      toast(
        "error",
        `Could not reach RCS-CLI at ${BRIDGE_URL}. Start it with "npm run rcs-cli".`,
      );
    };
  }, [emitTerm, failAllPending, toast]);

  const disconnect = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    setStatus("disconnected");
    setInfo(null);
    failAllPending("bridge disconnected");
    toast("info", "Terminal bridge disconnected by kill switch — local shell terminated.");
  }, [failAllPending, toast]);

  const request = useCallback(
    (message: BridgeClientMessage & { id: string }): Promise<BridgeServerMessage> => {
      return new Promise<BridgeServerMessage>((resolve, reject) => {
        const socket = socketRef.current;
        if (socket === null || socket.readyState !== WebSocket.OPEN) {
          reject(new Error("bridge is not connected"));
          return;
        }
        pendingRef.current.set(message.id, { resolve, reject });
        window.setTimeout(() => {
          const pending = pendingRef.current.get(message.id);
          if (pending !== undefined) {
            pendingRef.current.delete(message.id);
            pending.reject(new Error("bridge request timed out"));
          }
        }, REQUEST_TIMEOUT_MS);
        socket.send(JSON.stringify(message));
      });
    },
    [],
  );

  const value = useMemo<BridgeContextValue>(
    () => ({
      status,
      info,
      connect,
      disconnect,
      sendInput: (data) => send({ type: "term:input", data }),
      sendResize: (cols, rows) => send({ type: "term:resize", cols, rows }),
      onTerm: (listener) => {
        termListenersRef.current.add(listener);
        return () => termListenersRef.current.delete(listener);
      },
      fetchTree: async () => {
        const reply = await request({ type: "fs:list", id: crypto.randomUUID() });
        if (reply.type !== "fs:tree") throw new Error("unexpected bridge reply");
        return { root: reply.root, files: reply.files };
      },
      readFile: async (path) => {
        const reply = await request({
          type: "fs:read",
          id: crypto.randomUUID(),
          path,
        });
        if (reply.type !== "fs:file") throw new Error("unexpected bridge reply");
        return reply.content;
      },
      writeFile: async (path, content) => {
        const reply = await request({
          type: "fs:write",
          id: crypto.randomUUID(),
          path,
          content,
        });
        if (reply.type !== "fs:ok") throw new Error("unexpected bridge reply");
      },
      gitStatus: async () => {
        const reply = await request({ type: "git:status", id: crypto.randomUUID() });
        if (reply.type !== "git:state") throw new Error("unexpected bridge reply");
        return reply;
      },
    }),
    [status, info, connect, disconnect, send, request],
  );

  return <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>;
}
