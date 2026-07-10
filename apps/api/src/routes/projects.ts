import { Router, type Response } from "express";
import {
  isProjectType,
  isRole,
  isSkillLevel,
  type ResourceRequirement,
} from "@rcs/shared";
import type { ApiConfig } from "../config.js";
import type { Store } from "../store.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware.js";
import { milestoneSchema, projectDeliverySchema, validationError } from "../schemas.js";

function parseMatrix(value: unknown): ResourceRequirement[] | null {
  if (!Array.isArray(value)) return null;
  const matrix: ResourceRequirement[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const row = entry as Record<string, unknown>;
    const role = row["role"];
    const skillLevel = row["skillLevel"];
    const count = row["count"];
    if (
      typeof role !== "string" ||
      !isRole(role) ||
      role === "admin" ||
      role === "pm" ||
      typeof skillLevel !== "string" ||
      !isSkillLevel(skillLevel) ||
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 20
    ) {
      return null;
    }
    matrix.push({ role, skillLevel, count });
  }
  return matrix;
}

export function projectRoutes(config: ApiConfig, store: Store): Router {
  const router = Router();
  router.use(requireAuth(config.jwtSecret));

  router.get("/", async (req: AuthedRequest, res: Response) => {
    const session = req.session;
    if (session === undefined) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const isLead = session.role === "admin" || session.role === "pm";
    const allProjects = await store.listProjects();
    const projects = [];
    for (const project of allProjects) {
      if (isLead || (await store.isOnTeam(project.id, session.sub))) {
        projects.push(project);
      }
    }
    res.json({ projects });
  });

  router.get("/:id", async (req: AuthedRequest, res: Response) => {
    const id = req.params.id;
    const session = req.session;
    if (id === undefined || session === undefined) {
      res.status(400).json({ error: "project id is required" });
      return;
    }
    const project = await store.getProject(id);
    if (project === undefined) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    const allowed =
      session.role === "admin" ||
      session.role === "pm" ||
      (await store.isOnTeam(id, session.sub));
    if (!allowed) {
      res.status(403).json({ error: "project membership required" });
      return;
    }
    res.json({ project });
  });

  /** PM scopes an Order into a Project with a required resource matrix. */
  router.post(
    "/",
    requireRole("admin", "pm"),
    async (req: AuthedRequest, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const name = body["name"];
      const type = body["type"];
      const description = body["description"];
      const clientName = body["clientName"];
      const isPublic = body["isPublic"];
      const techStack = body["techStack"];
      const matrix = parseMatrix(body["resourceMatrix"] ?? []);
      if (
        typeof name !== "string" ||
        name.trim().length === 0 ||
        typeof type !== "string" ||
        !isProjectType(type) ||
        typeof description !== "string" ||
        matrix === null ||
        !Array.isArray(techStack) ||
        !techStack.every((t): t is string => typeof t === "string")
      ) {
        res.status(400).json({
          error:
            "name, type, description, techStack[] and a valid resourceMatrix are required",
        });
        return;
      }
      const project = await store.createProject({
        name: name.trim(),
        type,
        description,
        clientName: typeof clientName === "string" ? clientName : "",
        isPublic: isPublic === true,
        techStack,
        resourceMatrix: matrix,
      });
      await store.log(
        "user",
        "project_created",
        `${req.session?.email ?? "unknown"} scoped project "${project.name}" (${project.type}) with ${matrix.length} matrix rows`,
      );
      res.status(201).json({ project });
    },
  );

  router.post(
    "/:id/delivery",
    requireRole("admin", "pm"),
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id;
      const parsed = projectDeliverySchema.safeParse(req.body);
      if (id === undefined || !parsed.success) {
        res.status(400).json(parsed.success ? { error: "project id required" } : validationError(parsed.error));
        return;
      }
      const project = await store.updateProjectDelivery(id, parsed.data);
      if (project === undefined) {
        res.status(404).json({ error: "project not found" });
        return;
      }
      await store.log("user", "project_delivery_updated", `${req.session?.email ?? "unknown"} updated delivery health for "${project.name}"`);
      res.json({ project });
    },
  );

  router.post(
    "/:id/milestones",
    requireRole("admin", "pm"),
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id;
      const parsed = milestoneSchema.safeParse(req.body);
      if (id === undefined || !parsed.success) {
        res.status(400).json(parsed.success ? { error: "project id required" } : validationError(parsed.error));
        return;
      }
      const milestone = await store.createMilestone(id, parsed.data.title, parsed.data.dueDate);
      if (milestone === undefined) {
        res.status(404).json({ error: "project not found" });
        return;
      }
      await store.log("user", "milestone_created", `${req.session?.email ?? "unknown"} added milestone "${milestone.title}"`);
      res.status(201).json({ milestone });
    },
  );

  /** Guided team building: candidates matching unfilled matrix seats. */
  router.get(
    "/:id/candidates",
    requireRole("admin", "pm"),
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id;
      if (id === undefined || (await store.getProject(id)) === undefined) {
        res.status(404).json({ error: "project not found" });
        return;
      }
      res.json({ candidates: await store.candidatesFor(id) });
    },
  );

  router.post(
    "/:id/team",
    requireRole("admin", "pm"),
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id;
      const body = req.body as Record<string, unknown>;
      const userId = body["userId"];
      if (id === undefined || typeof userId !== "string") {
        res.status(400).json({ error: "project id and userId are required" });
        return;
      }
      const result = await store.assignTeamMember(id, userId);
      if (!result.ok) {
        res.status(409).json({ error: result.error });
        return;
      }
      const member = result.project.team[result.project.team.length - 1];
      await store.log(
        "user",
        "team_member_assigned",
        `${req.session?.email ?? "unknown"} assigned ${member?.name ?? userId} (${member?.skillLevel ?? "?"} ${member?.role ?? "?"}) to "${result.project.name}"`,
      );
      res.json({ project: result.project });
    },
  );

  /** Team-managed tech stack: team members, PMs and admins may edit it. */
  router.post("/:id/tech", async (req: AuthedRequest, res: Response) => {
    const id = req.params.id;
    const session = req.session;
    const body = req.body as Record<string, unknown>;
    const add = typeof body["add"] === "string" ? body["add"] : undefined;
    const remove = typeof body["remove"] === "string" ? body["remove"] : undefined;
    if (id === undefined || session === undefined || (add === undefined && remove === undefined)) {
      res.status(400).json({ error: "project id and add or remove are required" });
      return;
    }
    const project = await store.getProject(id);
    if (project === undefined) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    const allowed =
      session.role === "admin" ||
      session.role === "pm" ||
      (await store.isOnTeam(id, session.sub));
    if (!allowed) {
      res.status(403).json({ error: "only the project team, PMs or admins manage the tech stack" });
      return;
    }
    const updated = await store.updateTechStack(id, { add, remove });
    if (updated === undefined) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    await store.log(
      "user",
      "tech_stack_updated",
      `${session.email} ${add !== undefined ? `added "${add}" to` : `removed "${remove ?? ""}" from`} the "${updated.name}" tech stack`,
    );
    res.json({ project: updated });
  });

  return router;
}
