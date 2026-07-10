import { Router, type Request, type Response } from "express";
import type { ApiConfig } from "../config.js";
import type { Store } from "../store.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware.js";
import { orderSchema, validationError } from "../schemas.js";

/**
 * Client-side pipeline: the public "Request a project" form creates an Order;
 * the Admin reviews Orders and (via a PM) scopes them into Projects.
 */
export function orderRoutes(config: ApiConfig, store: Store): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(validationError(parsed.error));
      return;
    }
    const { name, email, company, projectType, brief } = parsed.data;
    const order = await store.createOrder({
      name,
      email,
      company,
      projectType,
      brief,
    });
    await store.log(
      "api",
      "order_received",
      `Client order from ${order.email} (${order.projectType}) awaiting admin review`,
    );
    res.status(201).json({ orderId: order.id });
  });

  router.get(
    "/",
    requireAuth(config.jwtSecret),
    requireRole("admin", "pm"),
    async (_req: AuthedRequest, res: Response) => {
      res.json({ orders: await store.listOrders() });
    },
  );

  router.post(
    "/:id/review",
    requireAuth(config.jwtSecret),
    requireRole("admin", "pm"),
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id;
      const order = id !== undefined ? await store.markOrderReviewed(id) : undefined;
      if (order === undefined) {
        res.status(404).json({ error: "order not found" });
        return;
      }
      await store.log(
        "user",
        "order_reviewed",
        `${req.session?.email ?? "unknown"} reviewed order from ${order.email}`,
      );
      res.json({ order });
    },
  );

  router.post(
    "/:id/convert",
    requireAuth(config.jwtSecret),
    requireRole("admin", "pm"),
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id;
      const allOrders = await store.listOrders();
      const order = id === undefined ? undefined : allOrders.find((item) => item.id === id);
      if (order === undefined) {
        res.status(404).json({ error: "order not found" });
        return;
      }
      if (order.status !== "reviewed") {
        res.status(409).json({ error: "only reviewed requests can be converted" });
        return;
      }
      const project = await store.createProject({
        name: order.company.length > 0 ? `${order.company} project` : `${order.name} project`,
        type: order.projectType,
        description: order.brief,
        clientName: order.company || order.name,
        isPublic: false,
        techStack: [],
        resourceMatrix: [],
      });
      await store.markOrderConverted(order.id);
      await store.log("user", "order_converted", `${req.session?.email ?? "unknown"} converted request ${order.id} into "${project.name}"`);
      res.status(201).json({ project });
    },
  );

  return router;
}
