/**
 * @rcs/shared — types, constants and the WebSocket message protocol shared by
 * the web frontend (apps/web), the API (apps/api) and the local bridge daemon
 * (packages/rcs-cli).
 */

// ---------------------------------------------------------------------------
// Roles & users
// ---------------------------------------------------------------------------

export const ROLES = ["admin", "pm", "devops", "frontend", "backend"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Onboarding pipeline
// ---------------------------------------------------------------------------

export type ApplicationStatus =
  | "pending_otp"
  | "otp_verified"
  | "approved"
  | "rejected";

export interface DeveloperApplication {
  id: string;
  email: string;
  name: string;
  githubUrl: string;
  requestedRole: Exclude<Role, "admin">;
  status: ApplicationStatus;
  createdAt: string;
}

/** Passwords are exactly 16 characters, cryptographically generated. */
export const PASSWORD_LENGTH = 16;
/** OTPs expire after a strict 5 minutes. */
export const OTP_TTL_SECONDS = 300;
export const OTP_DIGITS = 6;

// ---------------------------------------------------------------------------
// Tickets — deterministic state machine (never skip states)
// ---------------------------------------------------------------------------

export const TICKET_STATUSES = [
  "todo",
  "in_progress",
  "review",
  "complete",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** The only legal forward transition for each state. */
export const TICKET_NEXT_STATUS: Readonly<
  Record<TicketStatus, TicketStatus | null>
> = {
  todo: "in_progress",
  in_progress: "review",
  review: "complete",
  complete: null,
};

export function isTicketStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value);
}

export interface Ticket {
  id: string;
  /** Human ref used in PR titles, e.g. "RCS-142". */
  ref: string;
  title: string;
  description: string;
  status: TicketStatus;
  assigneeRole: Role;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// System logs — every agent action is recorded
// ---------------------------------------------------------------------------

export type SystemLogActor =
  | "onboarding-agent"
  | "git-sync-agent"
  | "local-bridge-agent"
  | "api"
  | "user";

export interface SystemLogEntry {
  id: string;
  actor: SystemLogActor;
  action: string;
  detail: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Terminal bridge protocol (browser xterm.js <-> RCS-CLI daemon)
// ---------------------------------------------------------------------------

export const BRIDGE_DEFAULT_PORT = 3711;

/** Sent by the browser as the very first message after the socket opens. */
export interface TermAuthMessage {
  type: "term:auth";
  token: string;
}

export interface TermInputMessage {
  type: "term:input";
  data: string;
}

export interface TermOutputMessage {
  type: "term:output";
  data: string;
}

export interface TermResizeMessage {
  type: "term:resize";
  cols: number;
  rows: number;
}

export interface TermReadyMessage {
  type: "term:ready";
  shell: string;
  mode: "pty" | "pipe";
}

export interface TermExitMessage {
  type: "term:exit";
  code: number | null;
}

export interface TermErrorMessage {
  type: "term:error";
  message: string;
}

// File-sync messages: the Workspace browses and saves REAL files in the
// developer's local working copy (e.g. a repo cloned from GitHub) through the
// same authenticated bridge socket. Requests carry an `id` echoed by the
// matching response.

export interface FsListMessage {
  type: "fs:list";
  id: string;
}

export interface FsReadMessage {
  type: "fs:read";
  id: string;
  path: string;
}

export interface FsWriteMessage {
  type: "fs:write";
  id: string;
  path: string;
  content: string;
}

export interface FsTreeMessage {
  type: "fs:tree";
  id: string;
  /** Basename of the workspace root directory on the developer's machine. */
  root: string;
  files: string[];
}

export interface FsFileMessage {
  type: "fs:file";
  id: string;
  path: string;
  content: string;
}

export interface FsOkMessage {
  type: "fs:ok";
  id: string;
  path: string;
}

export interface FsErrorMessage {
  type: "fs:error";
  id: string;
  message: string;
}

/** Files larger than this are refused by the daemon (editor safety). */
export const FS_MAX_FILE_BYTES = 1_000_000;
/** The daemon stops walking the tree after this many files. */
export const FS_MAX_TREE_FILES = 2000;

/** Requests the real `git status` of the workspace root. */
export interface GitStatusRequestMessage {
  type: "git:status";
  id: string;
}

export interface GitState {
  isRepo: boolean;
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  lastCommit: string;
}

export interface GitStateMessage extends GitState {
  type: "git:state";
  id: string;
}

export type BridgeClientMessage =
  | TermAuthMessage
  | TermInputMessage
  | TermResizeMessage
  | FsListMessage
  | FsReadMessage
  | FsWriteMessage
  | GitStatusRequestMessage;

export type BridgeServerMessage =
  | TermOutputMessage
  | TermReadyMessage
  | TermExitMessage
  | TermErrorMessage
  | FsTreeMessage
  | FsFileMessage
  | FsOkMessage
  | FsErrorMessage
  | GitStateMessage;

export function parseBridgeClientMessage(
  raw: string,
): BridgeClientMessage | null {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) return null;
  const msg = parsed as Record<string, unknown>;
  switch (msg["type"]) {
    case "term:auth":
      return typeof msg["token"] === "string"
        ? { type: "term:auth", token: msg["token"] }
        : null;
    case "term:input":
      return typeof msg["data"] === "string"
        ? { type: "term:input", data: msg["data"] }
        : null;
    case "term:resize":
      return typeof msg["cols"] === "number" && typeof msg["rows"] === "number"
        ? { type: "term:resize", cols: msg["cols"], rows: msg["rows"] }
        : null;
    case "fs:list":
      return typeof msg["id"] === "string"
        ? { type: "fs:list", id: msg["id"] }
        : null;
    case "fs:read":
      return typeof msg["id"] === "string" && typeof msg["path"] === "string"
        ? { type: "fs:read", id: msg["id"], path: msg["path"] }
        : null;
    case "fs:write":
      return typeof msg["id"] === "string" &&
        typeof msg["path"] === "string" &&
        typeof msg["content"] === "string"
        ? {
            type: "fs:write",
            id: msg["id"],
            path: msg["path"],
            content: msg["content"],
          }
        : null;
    case "git:status":
      return typeof msg["id"] === "string"
        ? { type: "git:status", id: msg["id"] }
        : null;
    default:
      return null;
  }
}

export function parseBridgeServerMessage(
  raw: string,
): BridgeServerMessage | null {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) return null;
  const msg = parsed as Record<string, unknown>;
  switch (msg["type"]) {
    case "term:output":
      return typeof msg["data"] === "string"
        ? { type: "term:output", data: msg["data"] }
        : null;
    case "term:ready":
      return typeof msg["shell"] === "string" &&
        (msg["mode"] === "pty" || msg["mode"] === "pipe")
        ? { type: "term:ready", shell: msg["shell"], mode: msg["mode"] }
        : null;
    case "term:exit":
      return typeof msg["code"] === "number" || msg["code"] === null
        ? { type: "term:exit", code: msg["code"] as number | null }
        : null;
    case "term:error":
      return typeof msg["message"] === "string"
        ? { type: "term:error", message: msg["message"] }
        : null;
    case "fs:tree":
      return typeof msg["id"] === "string" &&
        typeof msg["root"] === "string" &&
        Array.isArray(msg["files"]) &&
        (msg["files"] as unknown[]).every((f) => typeof f === "string")
        ? {
            type: "fs:tree",
            id: msg["id"],
            root: msg["root"],
            files: msg["files"] as string[],
          }
        : null;
    case "fs:file":
      return typeof msg["id"] === "string" &&
        typeof msg["path"] === "string" &&
        typeof msg["content"] === "string"
        ? {
            type: "fs:file",
            id: msg["id"],
            path: msg["path"],
            content: msg["content"],
          }
        : null;
    case "fs:ok":
      return typeof msg["id"] === "string" && typeof msg["path"] === "string"
        ? { type: "fs:ok", id: msg["id"], path: msg["path"] }
        : null;
    case "fs:error":
      return typeof msg["id"] === "string" && typeof msg["message"] === "string"
        ? { type: "fs:error", id: msg["id"], message: msg["message"] }
        : null;
    case "git:state": {
      const strings = (value: unknown): value is string[] =>
        Array.isArray(value) && value.every((v) => typeof v === "string");
      return typeof msg["id"] === "string" &&
        typeof msg["isRepo"] === "boolean" &&
        typeof msg["branch"] === "string" &&
        typeof msg["ahead"] === "number" &&
        typeof msg["behind"] === "number" &&
        strings(msg["staged"]) &&
        strings(msg["modified"]) &&
        strings(msg["untracked"]) &&
        typeof msg["lastCommit"] === "string"
        ? {
            type: "git:state",
            id: msg["id"],
            isRepo: msg["isRepo"],
            branch: msg["branch"],
            ahead: msg["ahead"],
            behind: msg["behind"],
            staged: msg["staged"],
            modified: msg["modified"],
            untracked: msg["untracked"],
            lastCommit: msg["lastCommit"],
          }
        : null;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Project chat protocol (browser <-> API, per-project channels)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  type: "chat:message";
  channel: string;
  author: string;
  body: string;
  sentAt: string;
}

export interface ChatJoinMessage {
  type: "chat:join";
  channel: string;
  author: string;
}

export type ChatClientMessage = ChatJoinMessage | ChatMessage;

export function parseChatMessage(raw: string): ChatClientMessage | null {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) return null;
  const msg = parsed as Record<string, unknown>;
  if (
    msg["type"] === "chat:join" &&
    typeof msg["channel"] === "string" &&
    typeof msg["author"] === "string"
  ) {
    return { type: "chat:join", channel: msg["channel"], author: msg["author"] };
  }
  if (
    msg["type"] === "chat:message" &&
    typeof msg["channel"] === "string" &&
    typeof msg["author"] === "string" &&
    typeof msg["body"] === "string" &&
    typeof msg["sentAt"] === "string"
  ) {
    return {
      type: "chat:message",
      channel: msg["channel"],
      author: msg["author"],
      body: msg["body"],
      sentAt: msg["sentAt"],
    };
  }
  return null;
}
