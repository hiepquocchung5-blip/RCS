/**
 * @rcs/shared — domain types, constants and real-time chat contracts shared
 * by the web frontend and API.
 */

// ---------------------------------------------------------------------------
// Roles & users
// ---------------------------------------------------------------------------

export const ROLES = ["admin", "pm", "devops", "frontend", "backend"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Mentorship & Team Engine — seniority tags used for guided team building. */
export const SKILL_LEVELS = ["intern", "junior", "mid", "senior"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export function isSkillLevel(value: string): value is SkillLevel {
  return (SKILL_LEVELS as readonly string[]).includes(value);
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: Role;
  skillLevel: SkillLevel;
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
  skillLevel: SkillLevel;
  status: ApplicationStatus;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Projects — typed, tech-stacked, team-built (Mentorship & Team Engine)
// ---------------------------------------------------------------------------

export const PROJECT_TYPES = [
  "web_app",
  "mobile_app",
  "api_service",
  "ecommerce",
  "ai_ml",
  "devops_infra",
  "design_system",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export function isProjectType(value: string): value is ProjectType {
  return (PROJECT_TYPES as readonly string[]).includes(value);
}

export const PROJECT_TYPE_LABELS: Readonly<Record<ProjectType, string>> = {
  web_app: "Web Application",
  mobile_app: "Mobile App",
  api_service: "API / Backend Service",
  ecommerce: "E-Commerce",
  ai_ml: "AI / ML",
  devops_infra: "DevOps / Infrastructure",
  design_system: "Design System",
};

/** One row of the PM-defined resource matrix, e.g. { backend, senior, 1 }. */
export interface ResourceRequirement {
  role: Exclude<Role, "admin" | "pm">;
  skillLevel: SkillLevel;
  count: number;
}

export interface TeamMember {
  userId: string;
  name: string;
  role: Role;
  skillLevel: SkillLevel;
}

export const PROJECT_HEALTH_VALUES = ["on_track", "at_risk", "blocked"] as const;
export type ProjectHealth = (typeof PROJECT_HEALTH_VALUES)[number];

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  dueDate: string;
  status: "planned" | "active" | "complete";
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  description: string;
  clientName: string;
  /** Public projects appear on the client-facing Showcase portal. */
  isPublic: boolean;
  techStack: string[];
  resourceMatrix: ResourceRequirement[];
  team: TeamMember[];
  milestones: Milestone[];
  deadline: string | null;
  ownerId: string | null;
  ownerName: string | null;
  health: ProjectHealth;
  gitLink: string | null;
  liveLink: string | null;
  views: number;
  createdAt: string;
}

/** Client-safe subset served by the public Showcase endpoint. */
export interface ShowcaseProject {
  id: string;
  name: string;
  type: ProjectType;
  description: string;
  clientName: string;
  techStack: string[];
  teamSize: number;
  gitLink: string | null;
  liveLink: string | null;
  views: number;
  reactions: {
    star: number;
    like: number;
    love: number;
    fire: number;
  };
  userReactions: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Client orders — the public "Request a project" pipeline
// ---------------------------------------------------------------------------

export interface ClientOrder {
  id: string;
  name: string;
  email: string;
  company: string;
  projectType: ProjectType;
  brief: string;
  status: "new" | "reviewed" | "converted";
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
// Chat protocol (browser <-> API) — JWT-authenticated, strictly siloed rooms.
// Channel ids: "project:<projectId>" (team members + admin/pm only),
// "role:<role>" (that role only) and "tech:<slug>" (any authenticated dev).
// ---------------------------------------------------------------------------

export interface ChatChannel {
  id: string;
  label: string;
  kind: "project" | "role" | "tech";
}

/** Client → server: authenticate the socket and enter one channel. */
export interface ChatJoinMessage {
  type: "chat:join";
  channel: string;
  token: string;
}

/** Client → server: post to the joined channel (author comes from the JWT). */
export interface ChatPostMessage {
  type: "chat:post";
  body: string;
}

export type ChatClientMessage = ChatJoinMessage | ChatPostMessage;

/** Server → clients in the channel. */
export interface ChatMessage {
  type: "chat:message";
  channel: string;
  author: string;
  body: string;
  sentAt: string;
}

export interface ChatJoinedMessage {
  type: "chat:joined";
  channel: string;
  code?: number;
}

export interface ChatErrorMessage {
  type: "chat:error";
  message: string;
  code?: number;
}

export type ChatServerMessage = ChatMessage | ChatJoinedMessage | ChatErrorMessage;

export function parseChatClientMessage(raw: string): ChatClientMessage | null {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) return null;
  const msg = parsed as Record<string, unknown>;
  if (
    msg["type"] === "chat:join" &&
    typeof msg["channel"] === "string" &&
    typeof msg["token"] === "string"
  ) {
    return { type: "chat:join", channel: msg["channel"], token: msg["token"] };
  }
  if (msg["type"] === "chat:post" && typeof msg["body"] === "string") {
    return { type: "chat:post", body: msg["body"] };
  }
  return null;
}

export function parseChatServerMessage(raw: string): ChatServerMessage | null {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) return null;
  const msg = parsed as Record<string, unknown>;
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
  if (msg["type"] === "chat:joined" && typeof msg["channel"] === "string") {
    return {
      type: "chat:joined",
      channel: msg["channel"],
      code: typeof msg["code"] === "number" ? msg["code"] : undefined,
    };
  }
  if (msg["type"] === "chat:error" && typeof msg["message"] === "string") {
    return {
      type: "chat:error",
      message: msg["message"],
      code: typeof msg["code"] === "number" ? msg["code"] : undefined,
    };
  }
  return null;
}
