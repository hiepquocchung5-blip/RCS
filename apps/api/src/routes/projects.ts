import { Router, type Response } from "express";
import type { ApiConfig } from "../config.js";
import type { Store } from "../store.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware.js";
import {
  milestoneSchema,
  milestoneSignOffSchema,
  projectDeliverySchema,
  createProjectSchema,
  assignTeamMemberSchema,
  updateTechStackSchema,
  validationError,
} from "../schemas.js";

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
      const parsed = createProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json(validationError(parsed.error));
        return;
      }
      const { name, type, description, clientName, isPublic, techStack, resourceMatrix } = parsed.data;
      const project = await store.createProject({
        name,
        type,
        description,
        clientName,
        isPublic,
        techStack,
        resourceMatrix,
      });
      await store.log(
        "user",
        "project_created",
        `${req.session?.email ?? "unknown"} scoped project "${project.name}" (${project.type}) with ${resourceMatrix.length} matrix rows`,
      );
      res.status(201).json({ project });
    },
  );

  router.get("/:id/milestones/:milestoneId/certificate", async (req: AuthedRequest, res: Response) => {
    const { id, milestoneId } = req.params;
    const session = req.session;
    if (!id || !milestoneId || !session) {
      res.status(400).json({ error: "project and milestone ids are required" });
      return;
    }
    const allowed = session.role === "admin" || session.role === "pm" || await store.isOnTeam(id, session.sub);
    if (!allowed) {
      res.status(403).json({ error: "project membership required" });
      return;
    }
    const certificate = await store.getMilestoneCertificateByMilestone(milestoneId);
    if (!certificate || certificate.projectId !== id) {
      res.status(404).json({ error: "certificate not found" });
      return;
    }
    res.json({ certificate });
  });

  router.post(
    "/:id/milestones/:milestoneId/sign-off",
    requireRole("admin", "pm"),
    async (req: AuthedRequest, res: Response) => {
      const { id, milestoneId } = req.params;
      const session = req.session;
      const parsed = milestoneSignOffSchema.safeParse(req.body);
      if (!id || !milestoneId || !session || !parsed.success) {
        res.status(400).json(parsed.success ? { error: "project and milestone ids are required" } : validationError(parsed.error));
        return;
      }
      const signer = await store.getUser(session.sub);
      if (!signer) {
        res.status(401).json({ error: "signer account not found" });
        return;
      }
      const result = await store.signOffMilestone(id, milestoneId, { id: signer.id, name: signer.name });
      if (!result) {
        res.status(404).json({ error: "project or milestone not found" });
        return;
      }
      if (result.created) {
        await store.log("user", "milestone_signed_off", `${session.email} signed off milestone "${result.certificate.milestoneTitle}" for "${result.certificate.projectName}"`);
      }
      res.status(result.created ? 201 : 200).json(result);
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
      const parsed = assignTeamMemberSchema.safeParse(req.body);
      if (id === undefined || !parsed.success) {
        res.status(400).json(parsed.success ? { error: "project id required" } : validationError(parsed.error));
        return;
      }
      const { userId } = parsed.data;
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
    const parsed = updateTechStackSchema.safeParse(req.body);
    if (id === undefined || session === undefined || !parsed.success) {
      res.status(400).json(parsed.success ? { error: "project id and session required" } : validationError(parsed.error));
      return;
    }
    const { add, remove } = parsed.data;
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
