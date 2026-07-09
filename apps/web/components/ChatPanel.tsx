"use client";

import { useEffect, useRef, useState } from "react";
import { parseChatMessage, type ChatMessage } from "@rcs/shared";
import { API_BASE } from "@/lib/api";
import { loadSession } from "@/lib/session";

const CHANNEL = "payvia";

export function ChatPanel() {
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const author = loadSession()?.user.name ?? "guest";

  useEffect(() => {
    const wsUrl = `${API_BASE.replace(/^http/, "ws")}/chat`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;
    socket.onopen = () => {
      setConnected(true);
      socket.send(
        JSON.stringify({ type: "chat:join", channel: CHANNEL, author }),
      );
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      const parsed = parseChatMessage(event.data);
      if (parsed !== null && parsed.type === "chat:message") {
        setMessages((prev) => [...prev, parsed]);
      }
    };
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);
    return () => socket.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function send(): void {
    const body = draft.trim();
    const socket = socketRef.current;
    if (body.length === 0 || socket === null || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const message: ChatMessage = {
      type: "chat:message",
      channel: CHANNEL,
      author,
      body,
      sentAt: new Date().toISOString(),
    };
    socket.send(JSON.stringify(message));
    setDraft("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-rise-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rise-muted">
        #{CHANNEL}
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-rise-success" : "bg-rise-error"}`}
          title={connected ? "chat connected" : "chat offline"}
        />
      </div>
      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-auto p-3 text-sm">
        {messages.length === 0 ? (
          <p className="text-xs text-rise-muted">
            Project channel is quiet. Messages broadcast in real time to
            everyone in #{CHANNEL}.
          </p>
        ) : (
          messages.map((message, index) => (
            <div key={`${message.sentAt}-${index}`}>
              <span className="font-semibold text-rise-accent">
                {message.author}
              </span>{" "}
              <span className="text-rise-text">{message.body}</span>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2 border-t border-rise-border p-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") send();
          }}
          placeholder={connected ? `Message #${CHANNEL}` : "chat offline"}
          disabled={!connected}
          className="min-w-0 flex-1 rounded border border-rise-border bg-rise-bg px-2 py-1 text-sm outline-none focus:border-rise-accent"
        />
        <button
          type="button"
          onClick={send}
          disabled={!connected}
          className="rounded border border-rise-accent px-2 py-1 text-xs text-rise-accent disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
