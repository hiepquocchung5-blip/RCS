import { randomUUID } from "node:crypto";
import {
  TICKET_NEXT_STATUS,
  type ClientOrder,
  type DeveloperApplication,
  type Project,
  type ProjectType,
  type ProjectHealth,
  type Milestone,
  type ResourceRequirement,
  type Role,
  type ShowcaseProject,
  type SkillLevel,
  type SystemLogActor,
  type SystemLogEntry,
  type Ticket,
  type TicketStatus,
  type UserProfile,
} from "@rcs/shared";
import { randomBytes } from "node:crypto";
import { decryptCredential, encryptCredential, hashOpaqueToken, hashPassword, verifyPassword } from "./security/credentials.js";

export interface StoredUser extends UserProfile {
  passwordHash: string;
}

export interface MagicLink {
  tokenHash: string;
  userId: string;
  encryptedPassword: string;
  expiresAt: number;
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
  private readonly projects = new Map<string, Project>();
  private readonly orders = new Map<string, ClientOrder>();
  private readonly logs: SystemLogEntry[] = [];
  private readonly magicLinks = new Map<string, MagicLink>();
  private ticketCounter = 100;

  constructor(private readonly credentialSecret = "rcs-development-credential-secret") {}

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
    skillLevel: SkillLevel;
    password: string;
  }): StoredUser {
    const user: StoredUser = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      role: input.role,
      skillLevel: input.skillLevel,
      passwordHash: hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
  }

  getUser(id: string): StoredUser | undefined {
    return this.users.get(id);
  }

  findUserByEmail(email: string): StoredUser | undefined {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return undefined;
  }

  authenticateUser(email: string, password: string): StoredUser | undefined {
    const user = this.findUserByEmail(email);
    return user !== undefined && verifyPassword(password, user.passwordHash) ? user : undefined;
  }

  listUsers(): readonly UserProfile[] {
    return [...this.users.values()].map(({ passwordHash: _passwordHash, ...rest }) => rest);
  }

  // -- onboarding applications ----------------------------------------------

  createApplication(input: {
    email: string;
    name: string;
    githubUrl: string;
    requestedRole: DeveloperApplication["requestedRole"];
    skillLevel: SkillLevel;
  }): DeveloperApplication {
    const application: DeveloperApplication = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      githubUrl: input.githubUrl,
      requestedRole: input.requestedRole,
      skillLevel: input.skillLevel,
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

  createMagicLink(userId: string, password: string): MagicLink & { token: string } {
    const token = randomBytes(32).toString("base64url");
    const link: MagicLink = {
      tokenHash: hashOpaqueToken(token),
      userId,
      encryptedPassword: encryptCredential(password, this.credentialSecret),
      expiresAt: Date.now() + 15 * 60 * 1000,
      consumed: false,
    };
    this.magicLinks.set(link.tokenHash, link);
    return { ...link, token };
  }

  /** One-time consumption: returns the credential once, then burns the link. */
  consumeMagicLink(
    token: string,
  ): { user: UserProfile; password: string } | undefined {
    const tokenHash = hashOpaqueToken(token);
    const link = this.magicLinks.get(tokenHash);
    if (link === undefined || link.consumed || Date.now() >= link.expiresAt) return undefined;
    const user = this.users.get(link.userId);
    if (user === undefined) return undefined;
    const password = decryptCredential(link.encryptedPassword, this.credentialSecret);
    if (password === null) return undefined;
    this.magicLinks.set(tokenHash, { ...link, consumed: true });
    const { passwordHash: _passwordHash, ...profile } = user;
    return { user: profile, password };
  }

  // -- projects & Mentorship/Team Engine ---------------------------------------

  createProject(input: {
    name: string;
    type: ProjectType;
    description: string;
    clientName: string;
    isPublic: boolean;
    techStack: string[];
    resourceMatrix: ResourceRequirement[];
  }): Project {
    const project: Project = {
      id: randomUUID(),
      name: input.name,
      type: input.type,
      description: input.description,
      clientName: input.clientName,
      isPublic: input.isPublic,
      techStack: [...new Set(input.techStack.map((t) => t.trim()).filter((t) => t.length > 0))],
      resourceMatrix: input.resourceMatrix,
      team: [],
      milestones: [],
      deadline: null,
      ownerId: null,
      ownerName: null,
      health: "on_track",
      createdAt: new Date().toISOString(),
    };
    this.projects.set(project.id, project);
    return project;
  }

  getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }

  listProjects(): readonly Project[] {
    return [...this.projects.values()];
  }

  /** Client-safe view for the public Showcase portal (is_public only). */
  listShowcase(): readonly ShowcaseProject[] {
    return [...this.projects.values()]
      .filter((project) => project.isPublic)
      .map((project) => ({
        id: project.id,
        name: project.name,
        type: project.type,
        description: project.description,
        clientName: project.clientName,
        techStack: project.techStack,
        teamSize: project.team.length,
        createdAt: project.createdAt,
      }));
  }

  /** Team-managed tech stack: add or remove one technology, deterministically. */
  updateTechStack(
    id: string,
    change: { add?: string; remove?: string },
  ): Project | undefined {
    const project = this.projects.get(id);
    if (project === undefined) return undefined;
    let techStack = [...project.techStack];
    if (change.add !== undefined) {
      const tech = change.add.trim();
      if (tech.length > 0 && !techStack.includes(tech)) techStack.push(tech);
    }
    if (change.remove !== undefined) {
      techStack = techStack.filter((t) => t !== change.remove);
    }
    const updated: Project = { ...project, techStack };
    this.projects.set(id, updated);
    return updated;
  }

  /** How many matrix seats for (role, level) are still unfilled. */
  private openSeats(project: Project, role: Role, level: SkillLevel): number {
    const required = project.resourceMatrix
      .filter((req) => req.role === role && req.skillLevel === level)
      .reduce((sum, req) => sum + req.count, 0);
    const filled = project.team.filter(
      (member) => member.role === role && member.skillLevel === level,
    ).length;
    return required - filled;
  }

  /**
   * Guided team building: developers whose role + skill level match a still
   * unfilled seat of the resource matrix and who are not on the team yet.
   */
  candidatesFor(id: string): readonly UserProfile[] {
    const project = this.projects.get(id);
    if (project === undefined) return [];
    const teamIds = new Set(project.team.map((member) => member.userId));
    return [...this.users.values()]
      .filter(
        (user) =>
          !teamIds.has(user.id) &&
          user.role !== "admin" &&
          user.role !== "pm" &&
          this.openSeats(project, user.role, user.skillLevel) > 0,
      )
      .map(({ passwordHash: _passwordHash, ...profile }) => profile);
  }

  /** Fills a matrix seat; refuses users that do not match an open requirement. */
  assignTeamMember(
    id: string,
    userId: string,
  ): { ok: true; project: Project } | { ok: false; error: string } {
    const project = this.projects.get(id);
    if (project === undefined) return { ok: false, error: "project not found" };
    const user = this.users.get(userId);
    if (user === undefined) return { ok: false, error: "user not found" };
    if (project.team.some((member) => member.userId === userId)) {
      return { ok: false, error: `${user.name} is already on the team` };
    }
    if (this.openSeats(project, user.role, user.skillLevel) <= 0) {
      return {
        ok: false,
        error: `resource matrix has no open ${user.skillLevel} ${user.role} seat`,
      };
    }
    const updated: Project = {
      ...project,
      team: [
        ...project.team,
        {
          userId: user.id,
          name: user.name,
          role: user.role,
          skillLevel: user.skillLevel,
        },
      ],
    };
    this.projects.set(id, updated);
    return { ok: true, project: updated };
  }

  isOnTeam(projectId: string, userId: string): boolean {
    const project = this.projects.get(projectId);
    return project !== undefined && project.team.some((m) => m.userId === userId);
  }

  updateProjectDelivery(
    id: string,
    input: { deadline?: string | null; ownerId?: string | null; health?: ProjectHealth },
  ): Project | undefined {
    const project = this.projects.get(id);
    if (project === undefined) return undefined;
    const owner = input.ownerId === undefined || input.ownerId === null
      ? null
      : this.users.get(input.ownerId) ?? null;
    const updated: Project = {
      ...project,
      deadline: input.deadline === undefined ? project.deadline : input.deadline,
      ownerId: input.ownerId === undefined ? project.ownerId : owner?.id ?? null,
      ownerName: input.ownerId === undefined ? project.ownerName : owner?.name ?? null,
      health: input.health ?? project.health,
    };
    this.projects.set(id, updated);
    return updated;
  }

  createMilestone(projectId: string, title: string, dueDate: string): Milestone | undefined {
    const project = this.projects.get(projectId);
    if (project === undefined) return undefined;
    const milestone: Milestone = {
      id: randomUUID(),
      projectId,
      title,
      dueDate,
      status: "planned",
      createdAt: new Date().toISOString(),
    };
    this.projects.set(projectId, { ...project, milestones: [...project.milestones, milestone] });
    return milestone;
  }

  // -- client orders ------------------------------------------------------------

  createOrder(input: {
    name: string;
    email: string;
    company: string;
    projectType: ProjectType;
    brief: string;
  }): ClientOrder {
    const order: ClientOrder = {
      id: randomUUID(),
      ...input,
      status: "new",
      createdAt: new Date().toISOString(),
    };
    this.orders.set(order.id, order);
    return order;
  }

  listOrders(): readonly ClientOrder[] {
    return [...this.orders.values()];
  }

  markOrderReviewed(id: string): ClientOrder | undefined {
    const order = this.orders.get(id);
    if (order === undefined) return undefined;
    const updated: ClientOrder = { ...order, status: "reviewed" };
    this.orders.set(id, updated);
    return updated;
  }

  markOrderConverted(id: string): ClientOrder | undefined {
    const order = this.orders.get(id);
    if (order === undefined || order.status !== "reviewed") return undefined;
    const updated: ClientOrder = { ...order, status: "converted" };
    this.orders.set(id, updated);
    return updated;
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
