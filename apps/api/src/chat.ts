import type { Server } from "node:http";
import { Router, type Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import {
  parseChatClientMessage,
  type ChatChannel,
  type ChatMessage,
  type ChatServerMessage,
} from "@rcs/shared";
import type { ApiConfig } from "./config.js";
import { verifyToken, type SessionClaims } from "./auth/tokens.js";
import type { Store } from "./store.js";
import { requireAuth, type AuthedRequest } from "./middleware.js";

interface ChatSession {
  user: SessionClaims;
  channel: string;
  /** Timestamps of recent posts, for per-socket flood protection. */
  postTimes: number[];
}

const CHAT_HISTORY_LIMIT = 50;
const CHAT_RATE_LIMIT = 5;
const CHAT_RATE_WINDOW_MS = 10_000;

/**
 * Real-time chat over WebSockets, authenticated via JWT on join. Rooms map
 * directly to Project IDs ("project:<id>") so communication is strictly
 * siloed per project; role rooms ("role:<role>") and tech-stack rooms
 * ("tech:<slug>") complement them.
 */
async function authorizeChannel(
  store: Store,
  user: SessionClaims,
  channel: string,
): Promise<boolean> {
  const [kind, key] = [channel.slice(0, channel.indexOf(":")), channel.slice(channel.indexOf(":") + 1)];
  if (channel.indexOf(":") === -1 || key.length === 0) return false;
  switch (kind) {
    case "project":
      if ((await store.getProject(key)) === undefined) return false;
      return (
        user.role === "admin" ||
        user.role === "pm" ||
        (await store.isOnTeam(key, user.sub))
      );
    case "role":
      return user.role === "admin" || user.role === key;
    case "tech":
      return true;
    default:
      return false;
  }
}

export function attachChat(server: Server, store: Store, jwtSecret: string): void {
  const wss = new WebSocketServer({ server, path: "/chat" });
  const sessions = new Map<WebSocket, ChatSession>();

  const send = (socket: WebSocket, message: ChatServerMessage): void => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };

  wss.on("connection", (socket: WebSocket) => {
    // The handler is async; a rejected store call must never become an
    // unhandled rejection (it would take the whole API process down).
    const handleMessage = async (raw: Buffer | ArrayBuffer | Buffer[]): Promise<void> => {
      let msg;
      try {
        msg = parseChatClientMessage(String(raw));
      } catch {
        msg = null;
      }
      if (msg === null) return;

      if (msg.type === "chat:join") {
        const user = verifyToken(jwtSecret, msg.token, "session");
        if (user === null) {
          send(socket, { type: "chat:error", message: "chat requires a valid session token", code: 401 });
          socket.close(4401, "chat requires a valid session token");
          return;
        }
        const isAuthorized = await authorizeChannel(store, user, msg.channel);
        if (!isAuthorized) {
          send(socket, {
            type: "chat:error",
            message: `you are not a member of ${msg.channel}`,
            code: 403,
          });
          socket.close(4403, `you are not a member of ${msg.channel}`);
          return;
        }
        sessions.set(socket, { user, channel: msg.channel, postTimes: [] });
        send(socket, { type: "chat:joined", channel: msg.channel, code: 101 });
        // Replay recent history (oldest first) so a refresh keeps the conversation.
        for (const entry of await store.listChatHistory(msg.channel, CHAT_HISTORY_LIMIT)) {
          send(socket, entry);
        }
        return;
      }

      // chat:post — author always comes from the verified JWT, never the client.
      const session = sessions.get(socket);
      if (session === undefined) {
        send(socket, { type: "chat:error", message: "join a channel first", code: 403 });
        return;
      }
      const body = msg.body.trim();
      if (body.length === 0 || body.length > 2000) return;
      const now = Date.now();
      session.postTimes = session.postTimes.filter((t) => now - t < CHAT_RATE_WINDOW_MS);
      if (session.postTimes.length >= CHAT_RATE_LIMIT) {
        send(socket, {
          type: "chat:error",
          message: "you are sending messages too quickly; wait a few seconds",
          code: 429,
        });
        return;
      }
      session.postTimes.push(now);
      const message: ChatMessage = {
        type: "chat:message",
        channel: session.channel,
        author: session.user.email,
        body,
        sentAt: new Date().toISOString(),
      };
      await store.saveChatMessage(message);
      for (const client of wss.clients) {
        if (
          client.readyState === WebSocket.OPEN &&
          sessions.get(client)?.channel === session.channel
        ) {
          client.send(JSON.stringify(message));
        }
      }
    };

    socket.on("message", (raw: Buffer | ArrayBuffer | Buffer[]) => {
      handleMessage(raw).catch((error: unknown) => {
        console.error("[rcs-chat] message handling failed", error);
        send(socket, {
          type: "chat:error",
          message: "chat is temporarily unavailable; please try again",
          code: 500,
        });
      });
    });

    socket.on("close", () => {
      sessions.delete(socket);
    });
  });
}

function techSlug(tech: string): string {
  return tech.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** GET /chat/channels — the channels the current user may join. */
export function chatRoutes(config: ApiConfig, store: Store): Router {
  const router = Router();
  router.get(
    "/channels",
    requireAuth(config.jwtSecret),
    async (req: AuthedRequest, res: Response) => {
      const session = req.session;
      if (session === undefined) {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }
      const channels: ChatChannel[] = [];
      const isLead = session.role === "admin" || session.role === "pm";
      const allProjects = await store.listProjects();
      const projects = [];
      for (const project of allProjects) {
        if (isLead || (await store.isOnTeam(project.id, session.sub))) {
          projects.push(project);
        }
      }
      for (const project of projects) {
        channels.push({
          id: `project:${project.id}`,
          label: `# ${project.name}`,
          kind: "project",
        });
      }
      channels.push({
        id: `role:${session.role}`,
        label: `# ${session.role} team`,
        kind: "role",
      });
      const techs = new Set<string>();
      for (const project of projects) {
        for (const tech of project.techStack) techs.add(tech);
      }
      for (const tech of [...techs].sort()) {
        channels.push({
          id: `tech:${techSlug(tech)}`,
          label: `# ${tech}`,
          kind: "tech",
        });
      }
      res.json({ channels });
    },
  );
  return router;
}
