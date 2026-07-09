import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { parseChatMessage, type ChatMessage } from "@rcs/shared";

/**
 * Real-time project chat: one WebSocket endpoint (/chat), channels keyed by
 * project. Clients join a channel first, then broadcast messages to everyone
 * in the same channel.
 */
export function attachChat(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/chat" });
  const channelOf = new Map<WebSocket, string>();

  wss.on("connection", (socket: WebSocket) => {
    socket.on("message", (raw: Buffer | ArrayBuffer | Buffer[]) => {
      let parsed;
      try {
        parsed = parseChatMessage(String(raw));
      } catch {
        parsed = null;
      }
      if (parsed === null) return;
      if (parsed.type === "chat:join") {
        channelOf.set(socket, parsed.channel);
        return;
      }
      const message: ChatMessage = parsed;
      for (const client of wss.clients) {
        if (
          client.readyState === WebSocket.OPEN &&
          channelOf.get(client) === message.channel
        ) {
          client.send(JSON.stringify(message));
        }
      }
    });
    socket.on("close", () => {
      channelOf.delete(socket);
    });
  });
}
