import type {
  ChatChannel,
  ClientOrder,
  DeveloperApplication,
  Project,
  Milestone,
  ResourceRequirement,
  ShowcaseProject,
  SystemLogEntry,
  Ticket,
  TicketStatus,
  UserProfile,
  StockShare,
  StockTransaction,
} from "@rcs/shared";
import { loadSession } from "./session";

export const API_BASE =
  process.env.NEXT_PUBLIC_RCS_API ?? "http://localhost:4000";

export const AUTH_BASE =
  process.env.NEXT_PUBLIC_RCS_AUTH ?? `${API_BASE}/auth`;

const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_RCS_COOKIE_DOMAIN;

/** True when running on localhost — all subdomain logic is skipped. */
function isLocal(): boolean {
  if (!COOKIE_DOMAIN) return true;
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h.includes("localhost") || h.includes("127.0.0.1")) return true;
  }
  return false;
}

/**
 * Build an absolute URL for the **auth** subdomain in production.
 * On localhost it returns the path as-is so every route works without subdomains.
 */
export function getAuthUrl(path: string): string {
  return isLocal() ? path : `https://auth.${COOKIE_DOMAIN}${path}`;
}

/**
 * Build an absolute URL for the **stock** subdomain in production.
 * On localhost it returns `/stock` prefixed paths directly.
 */
export function getStockUrl(path = "/"): string {
  if (isLocal()) return path === "/" ? "/stock" : `/stock${path}`;
  return `https://stock.${COOKIE_DOMAIN}${path}`;
}

/**
 * Build the absolute homepage URL.
 * On localhost returns "/".
 */
export function getHomeUrl(): string {
  return isLocal() ? "/" : `https://${COOKIE_DOMAIN}/`;
}

export class ApiError extends Error {
  readonly issues?: Array<{ path: (string | number)[]; message: string }>;

  constructor(
    readonly status: number,
    message: string,
    issues?: Array<{ path: (string | number)[]; message: string }>,
  ) {
    super(message);
    this.issues = issues;
  }
}

/**
 * Flatten zod validation issues from an ApiError into a field → message map
 * for inline form errors. Returns null when the error carries no issues.
 */
export function fieldErrorsFrom(error: unknown): Record<string, string> | null {
  if (!(error instanceof ApiError) || !error.issues) return null;
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    fieldErrors[issue.path.join(".")] = issue.message;
  }
  return fieldErrors;
}

async function request<T>(
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown; auth?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) headers["content-type"] = "application/json";
  const session = loadSession();
  if (init?.auth === true) {
    if (session === null) throw new ApiError(401, "not logged in");
    headers["authorization"] = `Bearer ${session.token}`;
  } else if (session !== null) {
    headers["authorization"] = `Bearer ${session.token}`;
  }
  if (typeof window !== "undefined") {
    let guestId = window.localStorage.getItem("rcs_guest_session");
    if (!guestId) {
      guestId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      window.localStorage.setItem("rcs_guest_session", guestId);
    }
    headers["x-guest-session"] = guestId;
  }
  let response: Response;
  const isAuthPath = path.startsWith("/auth/");
  const url = isAuthPath ? `${AUTH_BASE}${path.slice(5)}` : `${API_BASE}${path}`;
  try {
    response = await fetch(url, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, `RCS API unreachable at ${url} — is "npm run dev:api" running?`);
  }
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : `request failed (${response.status})`;
    const issues =
      typeof data === "object" && data !== null && "issues" in data && Array.isArray((data as { issues: unknown }).issues)
        ? (data as { issues: Array<{ path: (string | number)[]; message: string }> }).issues
        : undefined;
    throw new ApiError(response.status, message, issues);
  }
  return data as T;
}

// -- auth ---------------------------------------------------------------------

export function login(
  email: string,
  password: string,
): Promise<{ token: string; user: UserProfile }> {
  return request("/auth/login", { method: "POST", body: { email, password } });
}

export function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<{ ok: boolean }> {
  return request("/auth/change-password", {
    method: "POST",
    body: { oldPassword, newPassword },
    auth: true,
  });
}

export function apply(input: {
  email: string;
  name: string;
  githubUrl: string;
  requestedRole: string;
  skillLevel: string;
}): Promise<{ applicationId: string }> {
  return request("/auth/apply", { method: "POST", body: input });
}

export function verifyOtp(
  applicationId: string,
  otp: string,
): Promise<{ status: string }> {
  return request("/auth/verify-otp", {
    method: "POST",
    body: { applicationId, otp },
  });
}

// -- tickets ------------------------------------------------------------------

export function listTickets(): Promise<{ tickets: Ticket[] }> {
  return request("/tickets", { auth: true });
}

export function createTicket(input: {
  title: string;
  description: string;
  assigneeRole: string;
  projectId: string;
}): Promise<{ ticket: Ticket }> {
  return request("/tickets", { method: "POST", body: input, auth: true });
}

export function transitionTicket(
  id: string,
  to: TicketStatus,
): Promise<{ ticket: Ticket }> {
  return request(`/tickets/${id}/transition`, {
    method: "POST",
    body: { to },
    auth: true,
  });
}

// -- admin --------------------------------------------------------------------

export function listApplications(): Promise<{
  applications: DeveloperApplication[];
}> {
  return request("/admin/applications", { auth: true });
}

export function approveApplication(id: string): Promise<{
  user: UserProfile;
  magicLinkPath: string;
}> {
  return request(`/admin/applications/${id}/approve`, {
    method: "POST",
    auth: true,
  });
}

export function rejectApplication(
  id: string,
): Promise<{ application: DeveloperApplication }> {
  return request(`/admin/applications/${id}/reject`, {
    method: "POST",
    auth: true,
  });
}

export function listUsers(): Promise<{ users: UserProfile[] }> {
  return request("/admin/users", { auth: true });
}

// -- projects & team engine -----------------------------------------------------

export function listProjects(): Promise<{ projects: Project[] }> {
  return request("/projects", { auth: true });
}

export function getProject(id: string): Promise<{ project: Project }> {
  return request(`/projects/${id}`, { auth: true });
}

export function createProject(input: {
  name: string;
  type: string;
  description: string;
  clientName: string;
  isPublic: boolean;
  techStack: string[];
  resourceMatrix: ResourceRequirement[];
}): Promise<{ project: Project }> {
  return request("/projects", { method: "POST", body: input, auth: true });
}

export function listCandidates(
  projectId: string,
): Promise<{ candidates: UserProfile[] }> {
  return request(`/projects/${projectId}/candidates`, { auth: true });
}

export function assignTeamMember(
  projectId: string,
  userId: string,
): Promise<{ project: Project }> {
  return request(`/projects/${projectId}/team`, {
    method: "POST",
    body: { userId },
    auth: true,
  });
}

export function updateTechStack(
  projectId: string,
  change: { add?: string; remove?: string },
): Promise<{ project: Project }> {
  return request(`/projects/${projectId}/tech`, {
    method: "POST",
    body: change,
    auth: true,
  });
}

export function createMilestone(projectId: string, input: { title: string; dueDate: string }): Promise<{ milestone: Milestone }> {
  return request(`/projects/${projectId}/milestones`, { method: "POST", body: input, auth: true });
}

export function updateProjectDelivery(projectId: string, input: { deadline?: string | null; ownerId?: string | null; health?: string }): Promise<{ project: Project }> {
  return request(`/projects/${projectId}/delivery`, { method: "POST", body: input, auth: true });
}

// -- public client portal --------------------------------------------------------

export function fetchShowcase(): Promise<{ projects: ShowcaseProject[] }> {
  return request("/showcase");
}

export function fetchShowcaseProject(id: string): Promise<{ project: ShowcaseProject }> {
  return request(`/showcase/${id}`);
}

export function reactToShowcase(projectId: string, reactionType: "star" | "like" | "love" | "fire"): Promise<{
  reactions: { star: number; like: number; love: number; fire: number };
  userReactions: string[];
}> {
  return request(`/showcase/${projectId}/react`, { method: "POST", body: { reactionType } });
}

export function submitOrder(input: {
  name: string;
  email: string;
  company: string;
  projectType: string;
  brief: string;
}): Promise<{ orderId: string }> {
  return request("/orders", { method: "POST", body: input });
}

export function listOrders(): Promise<{ orders: ClientOrder[] }> {
  return request("/orders", { auth: true });
}

export function reviewOrder(id: string): Promise<{ order: ClientOrder }> {
  return request(`/orders/${id}/review`, { method: "POST", auth: true });
}

export function convertOrder(id: string): Promise<{ project: Project }> {
  return request(`/orders/${id}/convert`, { method: "POST", auth: true });
}

// -- chat --------------------------------------------------------------------

export function listChatChannels(): Promise<{ channels: ChatChannel[] }> {
  return request("/chat/channels", { auth: true });
}

// -- system logs ---------------------------------------------------------------

export function listLogs(): Promise<{ logs: SystemLogEntry[] }> {
  return request("/logs", { auth: true });
}

// -- stock ---------------------------------------------------------------------

export function getStockData(): Promise<{ shares: StockShare[]; transactions: StockTransaction[] }> {
  return request("/stock", { auth: true });
}

export function addShares(input: {
  founderEmail: string;
  sharesCount: number;
  pricePerShare: number;
}): Promise<{ ok: boolean }> {
  return request("/stock/shares", { method: "POST", body: input, auth: true });
}

export function addStockTransaction(input: {
  type: "income" | "outcome" | "expense";
  amount: number;
  description: string;
}): Promise<{ ok: boolean; transaction: StockTransaction }> {
  return request("/stock/transactions", { method: "POST", body: input, auth: true });
}
