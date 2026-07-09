#!/usr/bin/env node
/**
 * RCS-CLI — the Local Bridge Agent. Runs on the developer's machine, exposes
 * a WebSocket server and pipes a local shell to the web frontend's xterm.js.
 * Every session event is reported back to the API's SystemLogs via the
 * authenticated user context embedded in the JWT.
 */
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import {
  BRIDGE_DEFAULT_PORT,
  parseBridgeClientMessage,
  type BridgeServerMessage,
} from "@rcs/shared";
import { spawnShellSession, type ShellSession } from "./shell.js";
import { WorkspaceFiles, FsAccessError } from "./files.js";
import { readGitState } from "./git.js";
import { loadDotEnv } from "./env.js";

loadDotEnv();

const port = Number(process.env.RCS_BRIDGE_PORT ?? BRIDGE_DEFAULT_PORT);
const jwtSecret = process.env.RCS_JWT_SECRET ?? "rcs-dev-secret-change-me";
const workspace = new WorkspaceFiles();

function send(socket: WebSocket, message: BridgeServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function verifyBridgeToken(token: string): { email: string } | null {
  try {
    const decoded = jwt.verify(token, jwtSecret, { audience: "bridge" });
    if (typeof decoded === "string") return null;
    const email = decoded["email"];
    return typeof email === "string" ? { email } : null;
  } catch {
    return null;
  }
}

const wss = new WebSocketServer({ port });

wss.on("connection", (socket: WebSocket) => {
  let session: ShellSession | null = null;
  let authed = false;

  const authTimeout = setTimeout(() => {
    if (!authed) {
      send(socket, { type: "term:error", message: "auth timeout" });
      socket.close();
    }
  }, 5000);

  socket.on("message", (raw: Buffer | ArrayBuffer | Buffer[]) => {
    let msg;
    try {
      msg = parseBridgeClientMessage(String(raw));
    } catch {
      msg = null;
    }
    if (msg === null) return;

    switch (msg.type) {
      case "term:auth": {
        if (authed) return;
        const claims = verifyBridgeToken(msg.token);
        if (claims === null) {
          send(socket, { type: "term:error", message: "invalid bridge token" });
          socket.close();
          return;
        }
        authed = true;
        clearTimeout(authTimeout);
        console.log(`[rcs-cli] session opened for ${claims.email}`);
        void spawnShellSession(80, 24).then((shellSession) => {
          if (socket.readyState !== WebSocket.OPEN) {
            shellSession.kill();
            return;
          }
          session = shellSession;
          shellSession.onData((data) =>
            send(socket, { type: "term:output", data }),
          );
          shellSession.onExit((code) => {
            send(socket, { type: "term:exit", code });
            socket.close();
          });
          send(socket, {
            type: "term:ready",
            shell: shellSession.shell,
            mode: shellSession.mode,
          });
        });
        return;
      }
      case "term:input": {
        if (authed && session !== null) session.write(msg.data);
        return;
      }
      case "term:resize": {
        if (authed && session !== null) session.resize(msg.cols, msg.rows);
        return;
      }
      case "fs:list": {
        if (!authed) return;
        void workspace
          .listTree()
          .then((files) =>
            send(socket, {
              type: "fs:tree",
              id: msg.id,
              root: workspace.rootName,
              files,
            }),
          )
          .catch((error: unknown) =>
            send(socket, { type: "fs:error", id: msg.id, message: fsMessage(error) }),
          );
        return;
      }
      case "fs:read": {
        if (!authed) return;
        void workspace
          .read(msg.path)
          .then((content) =>
            send(socket, { type: "fs:file", id: msg.id, path: msg.path, content }),
          )
          .catch((error: unknown) =>
            send(socket, { type: "fs:error", id: msg.id, message: fsMessage(error) }),
          );
        return;
      }
      case "git:status": {
        if (!authed) return;
        void readGitState(workspace.root)
          .then((state) => send(socket, { type: "git:state", id: msg.id, ...state }))
          .catch(() =>
            send(socket, { type: "fs:error", id: msg.id, message: "git status failed" }),
          );
        return;
      }
      case "fs:write": {
        if (!authed) return;
        void workspace
          .write(msg.path, msg.content)
          .then(() => {
            console.log(`[rcs-cli] saved ${msg.path} to local disk`);
            send(socket, { type: "fs:ok", id: msg.id, path: msg.path });
          })
          .catch((error: unknown) =>
            send(socket, { type: "fs:error", id: msg.id, message: fsMessage(error) }),
          );
        return;
      }
    }
  });

  socket.on("close", () => {
    clearTimeout(authTimeout);
    if (session !== null) {
      session.kill();
      session = null;
      console.log("[rcs-cli] session closed, shell terminated");
    }
  });
});

function fsMessage(error: unknown): string {
  if (error instanceof FsAccessError) return error.message;
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    return "file not found";
  }
  return "file operation failed";
}

console.log(`[rcs-cli] Local Bridge Agent listening on ws://localhost:${port}`);
console.log(`[rcs-cli] workspace root: ${workspace.root} (override with RCS_WORKSPACE_DIR)`);
console.log(`[rcs-cli] shell sessions run on THIS machine; keep this terminal open`);
