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
import { Pool } from "pg";
import { decryptCredential, encryptCredential, hashOpaqueToken, hashPassword, verifyPassword } from "./security/credentials.js";
import { getFullProject } from "./repositories/postgres.js";

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
 * Data store — supports both in-memory development and PostgreSQL.
 * All mutations return Promises so a SQL-backed implementation can replace
 * in-memory logic transparently at runtime.
 */
export class Store {
  private readonly users = new Map<string, StoredUser>();
  private readonly applications = new Map<string, DeveloperApplication>();
  private readonly tickets = new Map<string, Ticket>();
  private readonly projects = new Map<string, Project>();
  private readonly orders = new Map<string, ClientOrder>();
  private readonly logs: SystemLogEntry[] = [];
  private readonly magicLinks = new Map<string, MagicLink>();
  private readonly mockReactions = new Map<string, Map<string, Set<string>>>();
  private ticketCounter = 100;
  private readonly pool?: Pool;

  constructor(
    private readonly credentialSecret = "rcs-development-credential-secret",
    databaseUrl: string | null = null,
  ) {
    if (databaseUrl) {
      this.pool = new Pool({ connectionString: databaseUrl });
    }
  }

  async init(): Promise<void> {
    if (this.pool) {
      const res = await this.pool.query("SELECT MAX(CAST(substring(ref from 5) AS integer)) as max FROM tickets");
      const maxVal = res.rows[0]?.max;
      if (maxVal !== null && maxVal !== undefined) {
        this.ticketCounter = Number(maxVal);
      }
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  // -- system logs ----------------------------------------------------------

  async log(actor: SystemLogActor, action: string, detail: string): Promise<SystemLogEntry> {
    const entry: SystemLogEntry = {
      id: randomUUID(),
      actor,
      action,
      detail,
      createdAt: new Date().toISOString(),
    };
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO activity_log (id, actor, action, detail, created_at) VALUES ($1, $2, $3, $4, $5)`,
        [entry.id, entry.actor, entry.action, entry.detail, entry.createdAt]
      );
    } else {
      this.logs.push(entry);
    }
    return entry;
  }

  async listLogs(): Promise<readonly SystemLogEntry[]> {
    if (this.pool) {
      const res = await this.pool.query(`SELECT id, actor, action, detail, created_at as "createdAt" FROM activity_log ORDER BY created_at DESC`);
      return res.rows.map(r => ({
        ...r,
        createdAt: new Date(r.createdAt).toISOString()
      }));
    }
    return [...this.logs].reverse();
  }

  // -- users ----------------------------------------------------------------

  async createUser(input: {
    email: string;
    name: string;
    role: Role;
    skillLevel: SkillLevel;
    password: string;
  }): Promise<StoredUser> {
    const user: StoredUser = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      role: input.role,
      skillLevel: input.skillLevel,
      passwordHash: hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO users (id, email, name, role, skill_level, password_hash, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [user.id, user.email, user.name, user.role, user.skillLevel, user.passwordHash, user.createdAt]
      );
    } else {
      this.users.set(user.id, user);
    }
    return user;
  }

  async getUser(id: string): Promise<StoredUser | undefined> {
    if (this.pool) {
      const res = await this.pool.query(
        `SELECT id, email, name, role, skill_level as "skillLevel", password_hash as "passwordHash", created_at as "createdAt" FROM users WHERE id = $1`,
        [id]
      );
      if (res.rowCount === 0) return undefined;
      const r = res.rows[0];
      return {
        ...r,
        createdAt: new Date(r.createdAt).toISOString()
      };
    }
    return this.users.get(id);
  }

  async findUserByEmail(email: string): Promise<StoredUser | undefined> {
    if (this.pool) {
      const res = await this.pool.query(
        `SELECT id, email, name, role, skill_level as "skillLevel", password_hash as "passwordHash", created_at as "createdAt" FROM users WHERE email = $1`,
        [email]
      );
      if (res.rowCount === 0) return undefined;
      const r = res.rows[0];
      return {
        ...r,
        createdAt: new Date(r.createdAt).toISOString()
      };
    }
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return undefined;
  }

  async authenticateUser(email: string, password: string): Promise<StoredUser | undefined> {
    const user = await this.findUserByEmail(email);
    return user !== undefined && verifyPassword(password, user.passwordHash) ? user : undefined;
  }

  async listUsers(): Promise<readonly UserProfile[]> {
    if (this.pool) {
      const res = await this.pool.query(
        `SELECT id, email, name, role, skill_level as "skillLevel", created_at as "createdAt" FROM users ORDER BY name ASC`
      );
      return res.rows.map(r => ({
        ...r,
        createdAt: new Date(r.createdAt).toISOString()
      }));
    }
    return [...this.users.values()].map(({ passwordHash: _passwordHash, ...rest }) => rest);
  }

  // -- onboarding applications ----------------------------------------------

  async createApplication(input: {
    email: string;
    name: string;
    githubUrl: string;
    requestedRole: DeveloperApplication["requestedRole"];
    skillLevel: SkillLevel;
  }): Promise<DeveloperApplication> {
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
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO developer_applications (id, email, name, github_url, requested_role, skill_level, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [application.id, application.email, application.name, application.githubUrl, application.requestedRole, application.skillLevel, application.status, application.createdAt]
      );
    } else {
      this.applications.set(application.id, application);
    }
    return application;
  }

  async getApplication(id: string): Promise<DeveloperApplication | undefined> {
    if (this.pool) {
      const res = await this.pool.query(
        `SELECT id, email, name, github_url as "githubUrl", requested_role as "requestedRole", skill_level as "skillLevel", status, created_at as "createdAt" FROM developer_applications WHERE id = $1`,
        [id]
      );
      if (res.rowCount === 0) return undefined;
      const r = res.rows[0];
      return {
        ...r,
        createdAt: new Date(r.createdAt).toISOString()
      };
    }
    return this.applications.get(id);
  }

  async listApplications(): Promise<readonly DeveloperApplication[]> {
    if (this.pool) {
      const res = await this.pool.query(
        `SELECT id, email, name, github_url as "githubUrl", requested_role as "requestedRole", skill_level as "skillLevel", status, created_at as "createdAt" FROM developer_applications ORDER BY created_at DESC`
      );
      return res.rows.map(r => ({
        ...r,
        createdAt: new Date(r.createdAt).toISOString()
      }));
    }
    return [...this.applications.values()];
  }

  async setApplicationStatus(
    id: string,
    status: DeveloperApplication["status"],
  ): Promise<DeveloperApplication | undefined> {
    if (this.pool) {
      const res = await this.pool.query(
        `UPDATE developer_applications SET status = $1 WHERE id = $2 RETURNING id, email, name, github_url as "githubUrl", requested_role as "requestedRole", skill_level as "skillLevel", status, created_at as "createdAt"`,
        [status, id]
      );
      if (res.rowCount === 0) return undefined;
      const r = res.rows[0];
      return {
        ...r,
        createdAt: new Date(r.createdAt).toISOString()
      };
    }
    const application = this.applications.get(id);
    if (application === undefined) return undefined;
    const updated: DeveloperApplication = { ...application, status };
    this.applications.set(id, updated);
    return updated;
  }

  // -- magic links ------------------------------------------------------------

  async createMagicLink(userId: string, password: string): Promise<MagicLink & { token: string }> {
    const token = randomBytes(32).toString("base64url");
    const link: MagicLink = {
      tokenHash: hashOpaqueToken(token),
      userId,
      encryptedPassword: encryptCredential(password, this.credentialSecret),
      expiresAt: Date.now() + 15 * 60 * 1000,
      consumed: false,
    };
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO magic_links (token_hash, user_id, encrypted_credential, expires_at) VALUES ($1, $2, $3, $4)`,
        [link.tokenHash, link.userId, link.encryptedPassword, new Date(link.expiresAt)]
      );
    } else {
      this.magicLinks.set(link.tokenHash, link);
    }
    return { ...link, token };
  }

  /** One-time consumption: returns the credential once, then burns the link. */
  async consumeMagicLink(
    token: string,
  ): Promise<{ user: UserProfile; password: string } | undefined> {
    const tokenHash = hashOpaqueToken(token);
    if (this.pool) {
      const res = await this.pool.query(
        `SELECT token_hash as "tokenHash", user_id as "userId", encrypted_credential as "encryptedPassword", expires_at as "expiresAt", consumed_at as "consumedAt" FROM magic_links WHERE token_hash = $1`,
        [tokenHash]
      );
      if (res.rowCount === 0) return undefined;
      const link = res.rows[0];
      const expired = new Date() >= new Date(link.expiresAt);
      const consumed = link.consumedAt !== null;
      if (consumed || expired) return undefined;
      const user = await this.getUser(link.userId);
      if (user === undefined) return undefined;
      const password = decryptCredential(link.encryptedPassword, this.credentialSecret);
      if (password === null) return undefined;
      await this.pool.query(
        `UPDATE magic_links SET consumed_at = now() WHERE token_hash = $1`,
        [tokenHash]
      );
      const { passwordHash: _passwordHash, ...profile } = user;
      return { user: profile, password };
    } else {
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
  }

  // -- projects & Mentorship/Team Engine ---------------------------------------

  async createProject(input: {
    name: string;
    type: ProjectType;
    description: string;
    clientName: string;
    isPublic: boolean;
    techStack: string[];
    resourceMatrix: ResourceRequirement[];
    gitLink?: string | null;
    liveLink?: string | null;
  }): Promise<Project> {
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
      gitLink: input.gitLink ?? null,
      liveLink: input.liveLink ?? null,
      views: 0,
      createdAt: new Date().toISOString(),
    };
    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO projects (id, name, type, description, client_name, is_public, tech_stack, health, git_link, live_link, views, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [project.id, project.name, project.type, project.description, project.clientName, project.isPublic, project.techStack, project.health, project.gitLink, project.liveLink, project.views, project.createdAt]
        );
        for (const req of project.resourceMatrix) {
          await client.query(
            `INSERT INTO resource_requirements (id, project_id, role, skill_level, seat_count) VALUES ($1, $2, $3, $4, $5)`,
            [randomUUID(), project.id, req.role, req.skillLevel, req.count]
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } else {
      this.projects.set(project.id, project);
    }
    return project;
  }

  async getProject(id: string): Promise<Project | undefined> {
    if (this.pool) {
      const p = await getFullProject(this.pool, id);
      return p === null ? undefined : p;
    }
    return this.projects.get(id);
  }

  async listProjects(): Promise<readonly Project[]> {
    if (this.pool) {
      const res = await this.pool.query(`SELECT id FROM projects`);
      const projects: Project[] = [];
      for (const r of res.rows) {
        const p = await getFullProject(this.pool, r.id);
        if (p) projects.push(p);
      }
      return projects;
    }
    return [...this.projects.values()];
  }

  /** Client-safe view for the public Showcase portal (is_public only). */
  async listShowcase(sessionOrGuestId?: string | null): Promise<readonly ShowcaseProject[]> {
    if (this.pool) {
      const res = await this.pool.query(`SELECT id FROM projects WHERE is_public = true`);
      const projects: ShowcaseProject[] = [];
      for (const r of res.rows) {
        const p = await getFullProject(this.pool, r.id);
        if (p) {
          // Increment views
          await this.pool.query(`UPDATE projects SET views = views + 1 WHERE id = $1`, [p.id]);
          
          // Get reactions count
          const reactionsRes = await this.pool.query<{ reaction_type: string; count: string }>(
            `SELECT reaction_type, COUNT(*)::integer as count FROM showcase_reactions WHERE project_id = $1 GROUP BY reaction_type`,
            [p.id]
          );
          const reactions = { star: 0, like: 0, love: 0, fire: 0 };
          for (const row of reactionsRes.rows) {
            const type = row.reaction_type as keyof typeof reactions;
            if (type in reactions) {
              reactions[type] = Number(row.count);
            }
          }

          // User reactions
          let userReactions: string[] = [];
          if (sessionOrGuestId) {
            const userReactionsRes = await this.pool.query<{ reaction_type: string }>(
              `SELECT reaction_type FROM showcase_reactions WHERE project_id = $1 AND user_session_id = $2`,
              [p.id, sessionOrGuestId]
            );
            userReactions = userReactionsRes.rows.map(ur => ur.reaction_type);
          }

          projects.push({
            id: p.id,
            name: p.name,
            type: p.type,
            description: p.description,
            clientName: p.clientName,
            techStack: p.techStack,
            teamSize: p.team.length,
            gitLink: p.gitLink,
            liveLink: p.liveLink,
            views: p.views + 1, // Add the current view
            reactions,
            userReactions,
            createdAt: p.createdAt,
          });
        }
      }
      return projects;
    }

    // In-memory fallback
    const projects: ShowcaseProject[] = [];
    for (const project of this.projects.values()) {
      if (project.isPublic) {
        // Increment views
        project.views = (project.views ?? 0) + 1;

        const projectReactions = this.mockReactions.get(project.id) || new Map<string, Set<string>>();
        const reactions = { star: 0, like: 0, love: 0, fire: 0 };
        for (const [_, rxns] of projectReactions.entries()) {
          for (const r of rxns) {
            const type = r as keyof typeof reactions;
            if (type in reactions) reactions[type]++;
          }
        }

        let userReactions: string[] = [];
        if (sessionOrGuestId && projectReactions.has(sessionOrGuestId)) {
          userReactions = [...projectReactions.get(sessionOrGuestId)!];
        }

        projects.push({
          id: project.id,
          name: project.name,
          type: project.type,
          description: project.description,
          clientName: project.clientName,
          techStack: project.techStack,
          teamSize: project.team.length,
          gitLink: project.gitLink ?? null,
          liveLink: project.liveLink ?? null,
          views: project.views,
          reactions,
          userReactions,
          createdAt: project.createdAt,
        });
      }
    }
    return projects;
  }

  async reactToShowcase(
    projectId: string,
    sessionOrGuestId: string,
    reactionType: string
  ): Promise<{ reactions: { star: number; like: number; love: number; fire: number }; userReactions: string[] }> {
    if (this.pool) {
      const existing = await this.pool.query(
        `SELECT 1 FROM showcase_reactions WHERE project_id = $1 AND user_session_id = $2 AND reaction_type = $3`,
        [projectId, sessionOrGuestId, reactionType]
      );
      if ((existing.rowCount ?? 0) > 0) {
        await this.pool.query(
          `DELETE FROM showcase_reactions WHERE project_id = $1 AND user_session_id = $2 AND reaction_type = $3`,
          [projectId, sessionOrGuestId, reactionType]
        );
      } else {
        await this.pool.query(
          `INSERT INTO showcase_reactions (project_id, user_session_id, reaction_type) VALUES ($1, $2, $3)`,
          [projectId, sessionOrGuestId, reactionType]
        );
      }

      const counts = await this.pool.query<{ reaction_type: string; count: string }>(
        `SELECT reaction_type, COUNT(*)::integer as count FROM showcase_reactions WHERE project_id = $1 GROUP BY reaction_type`,
        [projectId]
      );
      const reactions = { star: 0, like: 0, love: 0, fire: 0 };
      for (const row of counts.rows) {
        const type = row.reaction_type as keyof typeof reactions;
        if (type in reactions) reactions[type] = Number(row.count);
      }

      const userReactionsRes = await this.pool.query<{ reaction_type: string }>(
        `SELECT reaction_type FROM showcase_reactions WHERE project_id = $1 AND user_session_id = $2`,
        [projectId, sessionOrGuestId]
      );
      const userReactions = userReactionsRes.rows.map(ur => ur.reaction_type);

      return { reactions, userReactions };
    } else {
      if (!this.mockReactions.has(projectId)) {
        this.mockReactions.set(projectId, new Map());
      }
      const projectReactions = this.mockReactions.get(projectId)!;
      if (!projectReactions.has(sessionOrGuestId)) {
        projectReactions.set(sessionOrGuestId, new Set());
      }
      const userReactionsSet = projectReactions.get(sessionOrGuestId)!;
      if (userReactionsSet.has(reactionType)) {
        userReactionsSet.delete(reactionType);
      } else {
        userReactionsSet.add(reactionType);
      }

      const reactions = { star: 0, like: 0, love: 0, fire: 0 };
      for (const [_, rxns] of projectReactions.entries()) {
        for (const r of rxns) {
          const type = r as keyof typeof reactions;
          if (type in reactions) reactions[type]++;
        }
      }

      return {
        reactions,
        userReactions: [...userReactionsSet]
      };
    }
  }

  /** Team-managed tech stack: add or remove one technology, deterministically. */
  async updateTechStack(
    id: string,
    change: { add?: string; remove?: string },
  ): Promise<Project | undefined> {
    const project = await this.getProject(id);
    if (project === undefined) return undefined;
    let techStack = [...project.techStack];
    if (change.add !== undefined) {
      const tech = change.add.trim();
      if (tech.length > 0 && !techStack.includes(tech)) techStack.push(tech);
    }
    if (change.remove !== undefined) {
      techStack = techStack.filter((t) => t !== change.remove);
    }
    if (this.pool) {
      await this.pool.query(
        `UPDATE projects SET tech_stack = $1 WHERE id = $2`,
        [techStack, id]
      );
      return (await getFullProject(this.pool, id))!;
    } else {
      const updated: Project = { ...project, techStack };
      this.projects.set(id, updated);
      return updated;
    }
  }

  /** How many matrix seats for (role, level) are still unfilled. */
  private async openSeats(project: Project, role: Role, level: SkillLevel): Promise<number> {
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
  async candidatesFor(id: string): Promise<readonly UserProfile[]> {
    const project = await this.getProject(id);
    if (project === undefined) return [];
    const teamIds = new Set(project.team.map((member) => member.userId));
    const allUsers = await this.listUsers();
    const result: UserProfile[] = [];
    for (const user of allUsers) {
      const hasSeat = await this.openSeats(project, user.role, user.skillLevel);
      if (!teamIds.has(user.id) && user.role !== "admin" && user.role !== "pm" && hasSeat > 0) {
        result.push(user);
      }
    }
    return result;
  }

  /** Fills a matrix seat; refuses users that do not match an open requirement. */
  async assignTeamMember(
    id: string,
    userId: string,
  ): Promise<{ ok: true; project: Project } | { ok: false; error: string }> {
    const project = await this.getProject(id);
    if (project === undefined) return { ok: false, error: "project not found" };
    const user = await this.getUser(userId);
    if (user === undefined) return { ok: false, error: "user not found" };
    if (project.team.some((member) => member.userId === userId)) {
      return { ok: false, error: `${user.name} is already on the team` };
    }
    const hasSeat = await this.openSeats(project, user.role, user.skillLevel);
    if (hasSeat <= 0) {
      return {
        ok: false,
        error: `resource matrix has no open ${user.skillLevel} ${user.role} seat`,
      };
    }
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)`,
        [id, userId]
      );
      const updated = (await getFullProject(this.pool, id))!;
      return { ok: true, project: updated };
    } else {
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
  }

  async isOnTeam(projectId: string, userId: string): Promise<boolean> {
    const project = await this.getProject(projectId);
    return project !== undefined && project.team.some((m) => m.userId === userId);
  }

  async updateProjectDelivery(
    id: string,
    input: { deadline?: string | null; ownerId?: string | null; health?: ProjectHealth },
  ): Promise<Project | undefined> {
    const project = await this.getProject(id);
    if (project === undefined) return undefined;
    const owner = input.ownerId === undefined || input.ownerId === null
      ? null
      : (await this.getUser(input.ownerId)) ?? null;
      
    if (this.pool) {
      let query = "UPDATE projects SET ";
      const params: any[] = [];
      const parts: string[] = [];
      let i = 1;
      if (input.deadline !== undefined) {
        parts.push(`deadline = $${i++}`);
        params.push(input.deadline);
      }
      if (input.ownerId !== undefined) {
        parts.push(`owner_id = $${i++}`);
        params.push(owner?.id ?? null);
      }
      if (input.health !== undefined) {
        parts.push(`health = $${i++}`);
        params.push(input.health);
      }
      if (parts.length === 0) return project;
      query += parts.join(", ") + ` WHERE id = $${i}`;
      params.push(id);
      await this.pool.query(query, params);
      return (await getFullProject(this.pool, id))!;
    } else {
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
  }

  async createMilestone(projectId: string, title: string, dueDate: string): Promise<Milestone | undefined> {
    const project = await this.getProject(projectId);
    if (project === undefined) return undefined;
    const milestone: Milestone = {
      id: randomUUID(),
      projectId,
      title,
      dueDate,
      status: "planned",
      createdAt: new Date().toISOString(),
    };
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO milestones (id, project_id, title, due_date, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [milestone.id, milestone.projectId, milestone.title, milestone.dueDate, milestone.status, milestone.createdAt]
      );
      return milestone;
    } else {
      this.projects.set(projectId, { ...project, milestones: [...project.milestones, milestone] });
      return milestone;
    }
  }

  // -- client orders ------------------------------------------------------------

  async createOrder(input: {
    name: string;
    email: string;
    company: string;
    projectType: ProjectType;
    brief: string;
  }): Promise<ClientOrder> {
    const order: ClientOrder = {
      id: randomUUID(),
      ...input,
      status: "new",
      createdAt: new Date().toISOString(),
    };
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO client_orders (id, name, email, company, project_type, brief, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [order.id, order.name, order.email, order.company, order.projectType, order.brief, order.status, order.createdAt]
      );
    } else {
      this.orders.set(order.id, order);
    }
    return order;
  }

  async listOrders(): Promise<readonly ClientOrder[]> {
    if (this.pool) {
      const res = await this.pool.query(`SELECT id, name, email, company, project_type as "projectType", brief, status, created_at as "createdAt" FROM client_orders ORDER BY created_at DESC`);
      return res.rows.map(r => ({
        ...r,
        createdAt: new Date(r.createdAt).toISOString()
      }));
    }
    return [...this.orders.values()];
  }

  async markOrderReviewed(id: string): Promise<ClientOrder | undefined> {
    if (this.pool) {
      const res = await this.pool.query(
        `UPDATE client_orders SET status = 'reviewed' WHERE id = $1 RETURNING id, name, email, company, project_type as "projectType", brief, status, created_at as "createdAt"`,
        [id]
      );
      if (res.rowCount === 0) return undefined;
      const r = res.rows[0];
      return {
        ...r,
        createdAt: new Date(r.createdAt).toISOString()
      };
    }
    const order = this.orders.get(id);
    if (order === undefined) return undefined;
    const updated: ClientOrder = { ...order, status: "reviewed" };
    this.orders.set(id, updated);
    return updated;
  }

  async markOrderConverted(id: string): Promise<ClientOrder | undefined> {
    if (this.pool) {
      const res = await this.pool.query(
        `UPDATE client_orders SET status = 'converted' WHERE id = $1 AND status = 'reviewed' RETURNING id, name, email, company, project_type as "projectType", brief, status, created_at as "createdAt"`,
        [id]
      );
      if (res.rowCount === 0) return undefined;
      const r = res.rows[0];
      return {
        ...r,
        createdAt: new Date(r.createdAt).toISOString()
      };
    }
    const order = this.orders.get(id);
    if (order === undefined || order.status !== "reviewed") return undefined;
    const updated: ClientOrder = { ...order, status: "converted" };
    this.orders.set(id, updated);
    return updated;
  }

  // -- tickets ----------------------------------------------------------------

  async createTicket(input: {
    title: string;
    description: string;
    assigneeRole: Role;
    projectId: string;
  }): Promise<Ticket> {
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
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO tickets (id, ref, project_id, title, description, status, assignee_role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [ticket.id, ticket.ref, ticket.projectId, ticket.title, ticket.description, ticket.status, ticket.assigneeRole, ticket.createdAt, ticket.updatedAt]
      );
    } else {
      this.tickets.set(ticket.id, ticket);
    }
    return ticket;
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    if (this.pool) {
      const res = await this.pool.query(
        `SELECT id, ref, project_id as "projectId", title, description, status, assignee_role as "assigneeRole", created_at as "createdAt", updated_at as "updatedAt" FROM tickets WHERE id = $1`,
        [id]
      );
      if (res.rowCount === 0) return undefined;
      const r = res.rows[0];
      return {
        ...r,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString()
      };
    }
    return this.tickets.get(id);
  }

  async findTicketByRef(ref: string): Promise<Ticket | undefined> {
    if (this.pool) {
      const res = await this.pool.query(
        `SELECT id, ref, project_id as "projectId", title, description, status, assignee_role as "assigneeRole", created_at as "createdAt", updated_at as "updatedAt" FROM tickets WHERE ref = $1`,
        [ref]
      );
      if (res.rowCount === 0) return undefined;
      const r = res.rows[0];
      return {
        ...r,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString()
      };
    }
    for (const ticket of this.tickets.values()) {
      if (ticket.ref === ref) return ticket;
    }
    return undefined;
  }

  async listTickets(): Promise<readonly Ticket[]> {
    if (this.pool) {
      const res = await this.pool.query(
        `SELECT id, ref, project_id as "projectId", title, description, status, assignee_role as "assigneeRole", created_at as "createdAt", updated_at as "updatedAt" FROM tickets ORDER BY created_at DESC`
      );
      return res.rows.map(r => ({
        ...r,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString()
      }));
    }
    return [...this.tickets.values()];
  }

  /**
   * Deterministic single-step transition. Returns the updated ticket, or an
   * error string when the move would skip a state or go backwards.
   */
  async transitionTicket(
    id: string,
    to: TicketStatus,
  ): Promise<{ ok: true; ticket: Ticket } | { ok: false; error: string }> {
    const ticket = await this.getTicket(id);
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
    if (this.pool) {
      await this.pool.query(
        `UPDATE tickets SET status = $1, updated_at = now() WHERE id = $2`,
        [to, id]
      );
      const updated = (await this.getTicket(id))!;
      return { ok: true, ticket: updated };
    } else {
      const updated: Ticket = {
        ...ticket,
        status: to,
        updatedAt: new Date().toISOString(),
      };
      this.tickets.set(id, updated);
      return { ok: true, ticket: updated };
    }
  }
}
