import { Router, type Response } from "express";
import type { ApiConfig } from "../config.js";
import type { Store } from "../store.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware.js";
import { createTicketSchema, transitionTicketSchema, validationError } from "../schemas.js";

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
      const parsed = createTicketSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json(validationError(parsed.error));
        return;
      }
      const { title, description, assigneeRole, projectId } = parsed.data;
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
    const parsed = transitionTicketSchema.safeParse(req.body);
    if (id === undefined || !parsed.success) {
      res.status(400).json(parsed.success ? { error: "ticket id required" } : validationError(parsed.error));
      return;
    }
    const { to } = parsed.data;
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
