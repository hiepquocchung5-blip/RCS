import type {
  DeveloperApplication,
  SystemLogEntry,
  Ticket,
  TicketStatus,
  UserProfile,
} from "@rcs/shared";
import { loadSession } from "./session";

export const API_BASE =
  process.env.NEXT_PUBLIC_RCS_API ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown; auth?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) headers["content-type"] = "application/json";
  if (init?.auth === true) {
    const session = loadSession();
    if (session === null) throw new ApiError(401, "not logged in");
    headers["authorization"] = `Bearer ${session.token}`;
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, `RCS API unreachable at ${API_BASE} — is "npm run dev:api" running?`);
  }
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : `request failed (${response.status})`;
    throw new ApiError(response.status, message);
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

export function apply(input: {
  email: string;
  name: string;
  githubUrl: string;
  requestedRole: string;
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

export function fetchBridgeToken(): Promise<{ token: string }> {
  return request("/auth/bridge-token", { method: "POST", auth: true });
}

export function fetchDevBridgeToken(): Promise<{ token: string }> {
  return request("/auth/dev-bridge-token", { method: "POST" });
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

// -- system logs ---------------------------------------------------------------

export function listLogs(): Promise<{ logs: SystemLogEntry[] }> {
  return request("/logs", { auth: true });
}
