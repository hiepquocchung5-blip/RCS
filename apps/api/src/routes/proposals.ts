import { Router, type Response } from "express";
import type { ApiConfig } from "../config.js";
import type { Store } from "../store.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware.js";
import { isProjectType } from "@rcs/shared";

export function proposalRoutes(config: ApiConfig, store: Store): Router {
  const router = Router();
  router.use(requireAuth(config.jwtSecret));

  router.get("/", async (req: AuthedRequest, res: Response) => {
    const session = req.session;
    if (!session) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const isLead = session.role === "admin" || session.role === "pm";
    const proposals = await store.listProposals(isLead ? undefined : session.sub);
    res.json({ proposals });
  });

  router.post("/", async (req: AuthedRequest, res: Response) => {
    const session = req.session;
    if (!session) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const { title, description, projectType, techStack } = req.body;
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    if (!description || typeof description !== "string") {
      res.status(400).json({ error: "description is required" });
      return;
    }
    if (!projectType || !isProjectType(projectType)) {
      res.status(400).json({ error: "valid projectType required" });
      return;
    }
    const user = await store.findUserByEmail(session.email);
    const proposerName = user ? user.name : session.email;

    const proposal = await store.createProposal({
      title: title.trim(),
      description: description.trim(),
      projectType,
      techStack: Array.isArray(techStack) ? techStack : [],
      proposerId: session.sub,
      proposerName,
    });

    await store.log(
      "user",
      "proposal_created",
      `${session.email} submitted project proposal "${proposal.title}"`
    );

    res.status(201).json({ proposal });
  });

  router.post("/:id/approve", requireRole("admin", "pm"), async (req: AuthedRequest, res: Response) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: "proposal id required" });
      return;
    }
    const result = await store.approveProposal(id);
    if (!result) {
      res.status(404).json({ error: "proposal not found or already processed" });
      return;
    }
    await store.log(
      "user",
      "proposal_approved",
      `${req.session?.email ?? "unknown"} approved proposal "${result.proposal.title}" and created project "${result.project.name}"`
    );
    res.json(result);
  });

  router.post("/:id/reject", requireRole("admin", "pm"), async (req: AuthedRequest, res: Response) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: "proposal id required" });
      return;
    }
    const proposal = await store.rejectProposal(id);
    if (!proposal) {
      res.status(404).json({ error: "proposal not found or already processed" });
      return;
    }
    await store.log(
      "user",
      "proposal_rejected",
      `${req.session?.email ?? "unknown"} rejected proposal "${proposal.title}"`
    );
    res.json({ proposal });
  });

  return router;
}
