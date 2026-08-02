import { Router, type Request, type Response } from "express";
import type { ApiConfig } from "../config.js";
import type { Store } from "../store.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware.js";
import { orderSchema, validationError } from "../schemas.js";
import { createTelegramNotifier } from "../telegram.js";

/**
 * Client-side pipeline: the public "Request a project" form creates an Order;
 * the Admin reviews Orders and (via a PM) scopes them into Projects.
 */
export function orderRoutes(config: ApiConfig, store: Store): Router {
  const router = Router();
  const notifier = createTelegramNotifier(config);

  router.post("/", async (req: Request, res: Response) => {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(validationError(parsed.error));
      return;
    }
    const { name, email, company, telegramUsername, projectType, brief } = parsed.data;
    const order = await store.createOrder({
      name,
      email,
      company,
      telegramUsername,
      projectType,
      brief,
    });
    await store.log(
      "api",
      "order_received",
      `Client order from ${order.email} (${order.projectType}) awaiting admin review`,
    );

    // Send Telegram Notification asynchronously without blocking client HTTP response
    const tgMsg = `<b>🚀 New Project Request Received</b>\n\n` +
      `• <b>Client:</b> ${order.name}\n` +
      `• <b>Email:</b> ${order.email}\n` +
      (order.telegramUsername ? `• <b>Telegram:</b> ${order.telegramUsername}\n` : "") +
      (order.company ? `• <b>Company:</b> ${order.company}\n` : "") +
      `• <b>Type:</b> ${order.projectType}\n` +
      `• <b>Brief:</b> ${order.brief.slice(0, 150)}...`;
    void notifier.sendMessage(tgMsg).catch(() => {});

    res.status(201).json({ orderId: order.id });
  });

  router.get(
    "/",
    requireAuth(config.jwtSecret),
    requireRole("admin", "pm"),
    async (_req: AuthedRequest, res: Response) => {
      try {
        const orders = await store.listOrders();
        res.json({ orders });
      } catch (err) {
        res.json({ orders: [] });
      }
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
