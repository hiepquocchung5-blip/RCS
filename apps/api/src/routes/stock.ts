import { Router, type Response } from "express";
import type { ApiConfig } from "../config.js";
import type { Store } from "../store.js";
import { requireAuth, type AuthedRequest } from "../middleware.js";
import { isStockFounder } from "@rcs/shared";
import { z } from "zod";
import { validationError } from "../schemas.js";

const addSharesSchema = z.object({
  founderEmail: z.string().email(),
  sharesCount: z.number().positive(),
  pricePerShare: z.number().positive().default(32000),
});

const addTransactionSchema = z.object({
  type: z.enum(["income", "outcome", "expense"]),
  amount: z.number().positive(),
  description: z.string().min(1),
});

export function stockRoutes(config: ApiConfig, store: Store): Router {
  const router = Router();

  // Require auth globally for stock endpoints
  router.use(requireAuth(config.jwtSecret));

  // Enforce founder-only check middleware
  router.use((req: AuthedRequest, res: Response, next) => {
    const email = req.session?.email;
    if (email === undefined || !isStockFounder(email)) {
      res.status(403).json({ error: "forbidden", message: "Founder access only" });
      return;
    }
    next();
  });

  router.get("/", async (_req: AuthedRequest, res: Response) => {
    try {
      const shares = await store.listStockShares();
      const transactions = await store.listStockTransactions();
      res.json({ shares, transactions });
    } catch (err: unknown) {
      res.status(500).json({
        error: "failed to list stock data",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.post("/shares", async (req: AuthedRequest, res: Response) => {
    const parsed = addSharesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(validationError(parsed.error));
      return;
    }
    const { founderEmail, sharesCount, pricePerShare } = parsed.data;

    // Check if targets a valid founder
    if (!isStockFounder(founderEmail)) {
      res.status(400).json({ error: "invalid founder email" });
      return;
    }

    try {
      await store.addStockShares(founderEmail, sharesCount, pricePerShare);
      await store.log("user", "add_shares", `Added ${sharesCount} shares for ${founderEmail}`);
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(500).json({
        error: "failed to add shares",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.post("/transactions", async (req: AuthedRequest, res: Response) => {
    const parsed = addTransactionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(validationError(parsed.error));
      return;
    }
    const { type, amount, description } = parsed.data;
    const actorEmail = req.session!.email;

    try {
      const tx = await store.addStockTransaction(type, amount, description, actorEmail);
      await store.log("user", "add_stock_transaction", `Created ${type} transaction of ${amount} MMK`);
      res.json({ ok: true, transaction: tx });
    } catch (err: unknown) {
      res.status(500).json({
        error: "failed to create transaction",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return router;
}
