import { Pool, type PoolClient } from "pg";
import type {
  ClientOrder,
  DeveloperApplication,
  Milestone,
  Project,
  SystemLogEntry,
  Ticket,
  UserProfile,
  ProjectType,
  ProjectHealth,
} from "@rcs/shared";
import type {
  UserRepository,
  ProjectRepository,
  DeliveryRepository,
  OperationsRepository,
  RepositoryUnit,
} from "./contracts.js";

export async function getFullProject(client: Pool | PoolClient, projectId: string): Promise<Project | null> {
  const projectRes = await client.query(`
    SELECT p.*, u.name as owner_name
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    WHERE p.id = $1
  `, [projectId]);
  
  if (projectRes.rowCount === 0) return null;
  const p = projectRes.rows[0];
  
  const matrixRes = await client.query(`
    SELECT role, skill_level as "skillLevel", seat_count as count
    FROM resource_requirements
    WHERE project_id = $1
  `, [projectId]);
  
  const teamRes = await client.query(`
    SELECT pm.user_id as "userId", u.name, u.role, u.skill_level as "skillLevel"
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = $1
  `, [projectId]);
  
  const milestonesRes = await client.query(`
    SELECT id, project_id as "projectId", title, due_date::text as "dueDate", status, created_at::text as "createdAt"
    FROM milestones
    WHERE project_id = $1
    ORDER BY due_date ASC
  `, [projectId]);
  
  return {
    id: p.id,
    name: p.name,
    type: p.type as ProjectType,
    description: p.description,
    clientName: p.client_name,
    isPublic: p.is_public,
    techStack: p.tech_stack,
    resourceMatrix: matrixRes.rows,
    team: teamRes.rows,
    milestones: milestonesRes.rows.map(m => ({
      ...m,
      dueDate: m.dueDate,
    })),
    deadline: p.deadline ? (new Date(p.deadline).toISOString().split("T")[0] ?? null) : null,
    ownerId: p.owner_id ?? null,
    ownerName: p.owner_name ?? null,
    health: p.health as ProjectHealth,
    createdAt: new Date(p.created_at).toISOString(),
  };
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<UserProfile | null> {
    const res = await this.pool.query(
      `SELECT id, email, name, role, skill_level as "skillLevel", created_at as "createdAt" FROM users WHERE email = $1`,
      [email]
    );
    if (res.rowCount === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      createdAt: new Date(r.createdAt).toISOString(),
    };
  }

  async findById(id: string): Promise<UserProfile | null> {
    const res = await this.pool.query(
      `SELECT id, email, name, role, skill_level as "skillLevel", created_at as "createdAt" FROM users WHERE id = $1`,
      [id]
    );
    if (res.rowCount === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      createdAt: new Date(r.createdAt).toISOString(),
    };
  }

  async list(): Promise<readonly UserProfile[]> {
    const res = await this.pool.query(
      `SELECT id, email, name, role, skill_level as "skillLevel", created_at as "createdAt" FROM users ORDER BY name ASC`
    );
    return res.rows.map(r => ({
      ...r,
      createdAt: new Date(r.createdAt).toISOString(),
    }));
  }
}

export class PostgresProjectRepository implements ProjectRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Project | null> {
    return getFullProject(this.pool, id);
  }

  async listForUser(userId: string, portfolioWide: boolean): Promise<readonly Project[]> {
    let ids: string[] = [];
    if (portfolioWide) {
      const res = await this.pool.query(`SELECT id FROM projects`);
      ids = res.rows.map(r => r.id);
    } else {
      const res = await this.pool.query(`SELECT project_id FROM project_members WHERE user_id = $1`, [userId]);
      ids = res.rows.map(r => r.project_id);
    }
    const projects: Project[] = [];
    for (const id of ids) {
      const p = await getFullProject(this.pool, id);
      if (p) projects.push(p);
    }
    return projects;
  }

  async listMilestones(projectId: string): Promise<readonly Milestone[]> {
    const res = await this.pool.query(`
      SELECT id, project_id as "projectId", title, due_date::text as "dueDate", status, created_at::text as "createdAt"
      FROM milestones
      WHERE project_id = $1
      ORDER BY due_date ASC
    `, [projectId]);
    return res.rows;
  }
}

export class PostgresDeliveryRepository implements DeliveryRepository {
  constructor(private readonly pool: Pool) {}

  async listTicketsForUser(userId: string, portfolioWide: boolean): Promise<readonly Ticket[]> {
    let res;
    if (portfolioWide) {
      res = await this.pool.query(`
        SELECT id, ref, project_id as "projectId", title, description, status, assignee_role as "assigneeRole", created_at as "createdAt", updated_at as "updatedAt"
        FROM tickets
        ORDER BY created_at DESC
      `);
    } else {
      res = await this.pool.query(`
        SELECT t.id, t.ref, t.project_id as "projectId", t.title, t.description, t.status, t.assignee_role as "assigneeRole", t.created_at as "createdAt", t.updated_at as "updatedAt"
        FROM tickets t
        JOIN project_members pm ON t.project_id = pm.project_id
        WHERE pm.user_id = $1
        ORDER BY t.created_at DESC
      `, [userId]);
    }
    return res.rows.map(r => ({
      ...r,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    }));
  }
}

export class PostgresOperationsRepository implements OperationsRepository {
  constructor(private readonly pool: Pool) {}

  async listApplications(): Promise<readonly DeveloperApplication[]> {
    const res = await this.pool.query(`
      SELECT id, email, name, github_url as "githubUrl", requested_role as "requestedRole", skill_level as "skillLevel", status, created_at as "createdAt"
      FROM developer_applications
      ORDER BY created_at DESC
    `);
    return res.rows.map(r => ({
      ...r,
      createdAt: new Date(r.createdAt).toISOString(),
    }));
  }

  async listOrders(): Promise<readonly ClientOrder[]> {
    const res = await this.pool.query(`
      SELECT id, name, email, company, project_type as "projectType", brief, status, created_at as "createdAt"
      FROM client_orders
      ORDER BY created_at DESC
    `);
    return res.rows.map(r => ({
      ...r,
      createdAt: new Date(r.createdAt).toISOString(),
    }));
  }

  async listActivity(): Promise<readonly SystemLogEntry[]> {
    const res = await this.pool.query(`
      SELECT id, actor, action, detail, created_at as "createdAt"
      FROM activity_log
      ORDER BY created_at DESC
    `);
    return res.rows.map(r => ({
      ...r,
      createdAt: new Date(r.createdAt).toISOString(),
    }));
  }
}

export class PostgresRepositoryUnit implements RepositoryUnit {
  readonly users: PostgresUserRepository;
  readonly projects: PostgresProjectRepository;
  readonly delivery: PostgresDeliveryRepository;
  readonly operations: PostgresOperationsRepository;

  constructor(private readonly pool: Pool) {
    this.users = new PostgresUserRepository(pool);
    this.projects = new PostgresProjectRepository(pool);
    this.delivery = new PostgresDeliveryRepository(pool);
    this.operations = new PostgresOperationsRepository(pool);
  }

  async healthcheck(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
