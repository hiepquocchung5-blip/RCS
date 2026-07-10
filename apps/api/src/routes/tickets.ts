import { Router, type Response } from "express";
import { isRole, isTicketStatus } from "@rcs/shared";
import type { ApiConfig } from "../config.js";
import type { Store } from "../store.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware.js";

export function ticketRoutes(config: ApiConfig, store: Store): Router {
  const router = Router();
  router.use(requireAuth(config.jwtSecret));

  router.get("/", async (req: AuthedRequest, res: Response) => {
    const session = req.session;
    if (session === undefined) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const isLead = session.role === "admin" || session.role === "pm";
    const allTickets = await store.listTickets();
    const tickets = [];
    for (const ticket of allTickets) {
      if (isLead || (await store.isOnTeam(ticket.projectId, session.sub))) {
        tickets.push(ticket);
      }
    }
    res.json({ tickets });
  });

  router.post(
    "/",
    requireRole("admin", "pm"),
    async (req: AuthedRequest, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const title = body["title"];
      const description = body["description"];
      const assigneeRole = body["assigneeRole"];
      const projectId = body["projectId"];
      if (
        typeof title !== "string" ||
        title.length === 0 ||
        typeof description !== "string" ||
        typeof assigneeRole !== "string" ||
        !isRole(assigneeRole) ||
        typeof projectId !== "string" ||
        projectId.length === 0
      ) {
        res.status(400).json({
          error: "title, description, assigneeRole and projectId are required",
        });
        return;
      }
      const project = await store.getProject(projectId);
      if (project === undefined) {
        res.status(404).json({ error: "project not found" });
        return;
      }
      const ticket = await store.createTicket({
        title,
        description,
        assigneeRole,
        projectId,
      });
      await store.log(
        "user",
        "ticket_created",
        `${req.session?.email ?? "unknown"} created ${ticket.ref}: ${ticket.title}`,
      );
      res.status(201).json({ ticket });
    },
  );

  /** Single-step, deterministic transition; illegal moves are refused. */
  router.post("/:id/transition", async (req: AuthedRequest, res: Response) => {
    const id = req.params.id;
    const body = req.body as Record<string, unknown>;
    const to = body["to"];
    if (id === undefined || typeof to !== "string" || !isTicketStatus(to)) {
      res.status(400).json({ error: "ticket id and target status are required" });
      return;
    }
    const allTickets = await store.listTickets();
    const ticket = allTickets.find((candidate) => candidate.id === id);
    const session = req.session;
    if (ticket === undefined) {
      res.status(404).json({ error: "ticket not found" });
      return;
    }
    if (
      session === undefined ||
      (session.role !== "admin" &&
        session.role !== "pm" &&
        !(await store.isOnTeam(ticket.projectId, session.sub)))
    ) {
      res.status(403).json({ error: "project membership required" });
      return;
    }
    const result = await store.transitionTicket(id, to);
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    await store.log(
      "user",
      "ticket_transitioned",
      `${req.session?.email ?? "unknown"} moved ${result.ticket.ref} to ${to}`,
    );
    res.json({ ticket: result.ticket });
  });

  return router;
}
