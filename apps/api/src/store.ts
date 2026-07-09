import { randomUUID } from "node:crypto";
import {
  TICKET_NEXT_STATUS,
  type DeveloperApplication,
  type Role,
  type SystemLogActor,
  type SystemLogEntry,
  type Ticket,
  type TicketStatus,
  type UserProfile,
} from "@rcs/shared";

export interface StoredUser extends UserProfile {
  /** Dev-grade storage; swap for a hashed column when PostgreSQL lands. */
  password: string;
}

export interface MagicLink {
  token: string;
  userId: string;
  password: string;
  consumed: boolean;
}

/**
 * In-memory data store — the dev fallback for PostgreSQL. All mutations go
 * through methods so a SQL-backed implementation can replace this class
 * without touching the routes.
 */
export class Store {
  private readonly users = new Map<string, StoredUser>();
  private readonly applications = new Map<string, DeveloperApplication>();
  private readonly tickets = new Map<string, Ticket>();
  private readonly logs: SystemLogEntry[] = [];
  private readonly magicLinks = new Map<string, MagicLink>();
  private ticketCounter = 100;

  // -- system logs ----------------------------------------------------------

  log(actor: SystemLogActor, action: string, detail: string): SystemLogEntry {
    const entry: SystemLogEntry = {
      id: randomUUID(),
      actor,
      action,
      detail,
      createdAt: new Date().toISOString(),
    };
    this.logs.push(entry);
    return entry;
  }

  listLogs(): readonly SystemLogEntry[] {
    return [...this.logs].reverse();
  }

  // -- users ----------------------------------------------------------------

  createUser(input: {
    email: string;
    name: string;
    role: Role;
    password: string;
  }): StoredUser {
    const user: StoredUser = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      role: input.role,
      password: input.password,
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
  }

  findUserByEmail(email: string): StoredUser | undefined {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return undefined;
  }

  listUsers(): readonly UserProfile[] {
    return [...this.users.values()].map(({ password: _password, ...rest }) => rest);
  }

  // -- onboarding applications ----------------------------------------------

  createApplication(input: {
    email: string;
    name: string;
    githubUrl: string;
    requestedRole: DeveloperApplication["requestedRole"];
  }): DeveloperApplication {
    const application: DeveloperApplication = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      githubUrl: input.githubUrl,
      requestedRole: input.requestedRole,
      status: "pending_otp",
      createdAt: new Date().toISOString(),
    };
    this.applications.set(application.id, application);
    return application;
  }

  getApplication(id: string): DeveloperApplication | undefined {
    return this.applications.get(id);
  }

  listApplications(): readonly DeveloperApplication[] {
    return [...this.applications.values()];
  }

  setApplicationStatus(
    id: string,
    status: DeveloperApplication["status"],
  ): DeveloperApplication | undefined {
    const application = this.applications.get(id);
    if (application === undefined) return undefined;
    const updated: DeveloperApplication = { ...application, status };
    this.applications.set(id, updated);
    return updated;
  }

  // -- magic links ------------------------------------------------------------

  createMagicLink(userId: string, password: string): MagicLink {
    const link: MagicLink = {
      token: randomUUID(),
      userId,
      password,
      consumed: false,
    };
    this.magicLinks.set(link.token, link);
    return link;
  }

  /** One-time consumption: returns the credential once, then burns the link. */
  consumeMagicLink(
    token: string,
  ): { user: UserProfile; password: string } | undefined {
    const link = this.magicLinks.get(token);
    if (link === undefined || link.consumed) return undefined;
    const user = this.users.get(link.userId);
    if (user === undefined) return undefined;
    this.magicLinks.set(token, { ...link, consumed: true });
    const { password: _password, ...profile } = user;
    return { user: profile, password: link.password };
  }

  // -- tickets ----------------------------------------------------------------

  createTicket(input: {
    title: string;
    description: string;
    assigneeRole: Role;
    projectId: string;
  }): Ticket {
    this.ticketCounter += 1;
    const now = new Date().toISOString();
    const ticket: Ticket = {
      id: randomUUID(),
      ref: `RCS-${this.ticketCounter}`,
      title: input.title,
      description: input.description,
      status: "todo",
      assigneeRole: input.assigneeRole,
      projectId: input.projectId,
      createdAt: now,
      updatedAt: now,
    };
    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  getTicket(id: string): Ticket | undefined {
    return this.tickets.get(id);
  }

  findTicketByRef(ref: string): Ticket | undefined {
    for (const ticket of this.tickets.values()) {
      if (ticket.ref === ref) return ticket;
    }
    return undefined;
  }

  listTickets(): readonly Ticket[] {
    return [...this.tickets.values()];
  }

  /**
   * Deterministic single-step transition. Returns the updated ticket, or an
   * error string when the move would skip a state or go backwards.
   */
  transitionTicket(
    id: string,
    to: TicketStatus,
  ): { ok: true; ticket: Ticket } | { ok: false; error: string } {
    const ticket = this.tickets.get(id);
    if (ticket === undefined) return { ok: false, error: "ticket not found" };
    const next = TICKET_NEXT_STATUS[ticket.status];
    if (next === null) {
      return { ok: false, error: `ticket ${ticket.ref} is already complete` };
    }
    if (next !== to) {
      return {
        ok: false,
        error: `illegal transition ${ticket.status} → ${to}; next legal state is ${next}`,
      };
    }
    const updated: Ticket = {
      ...ticket,
      status: to,
      updatedAt: new Date().toISOString(),
    };
    this.tickets.set(id, updated);
    return { ok: true, ticket: updated };
  }
}
