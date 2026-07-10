import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { TICKET_NEXT_STATUS } from "@rcs/shared";
import type { Store } from "../store.js";
import type { ApiConfig } from "../config.js";

const TICKET_REF_PATTERN = /RCS-\d+/;

/**
 * Git Sync Agent — deterministic webhook listener. When a PR whose title
 * contains a ticket ref (e.g. "RCS-142") is merged, the referenced ticket is
 * advanced one legal step. States are never skipped: a merged PR for a ticket
 * still in "todo" is refused and logged, not force-completed.
 */
const deliveries = new Set<string>();

interface RawBodyRequest extends Request { rawBody?: Buffer }

function validSignature(secret: string, body: Buffer | undefined, signature: string | undefined): boolean {
  if (signature === undefined || !signature.startsWith("sha256=")) return false;
  if (body === undefined) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export function webhookRoutes(config: ApiConfig, store: Store): Router {
  const router = Router();

  router.post("/github", (req: RawBodyRequest, res: Response) => {
    if (config.githubWebhookSecret === null) {
      res.status(503).json({ error: "GitHub webhook integration is not configured" });
      return;
    }
    if (!validSignature(config.githubWebhookSecret, req.rawBody, req.header("x-hub-signature-256"))) {
      res.status(401).json({ error: "invalid webhook signature" });
      return;
    }
    const deliveryId = req.header("x-github-delivery");
    if (deliveryId === undefined) {
      res.status(400).json({ error: "missing GitHub delivery id" });
      return;
    }
    if (deliveries.has(deliveryId)) {
      res.status(409).json({ error: "webhook delivery already processed" });
      return;
    }
    deliveries.add(deliveryId);
    const body = req.body as Record<string, unknown>;
    const action = body["action"];
    const pr = body["pull_request"] as Record<string, unknown> | undefined;
    if (action !== "closed" || pr === undefined || pr["merged"] !== true) {
      res.json({ handled: false, reason: "not a merged PR" });
      return;
    }
    const title = typeof pr["title"] === "string" ? pr["title"] : "";
    const match = TICKET_REF_PATTERN.exec(title);
    if (match === null) {
      store.log(
        "git-sync-agent",
        "webhook_ignored",
        `Merged PR "${title}" has no RCS ticket ref`,
      );
      res.json({ handled: false, reason: "no ticket ref in PR title" });
      return;
    }
    const ref = match[0];
    const ticket = store.findTicketByRef(ref);
    if (ticket === undefined) {
      store.log(
        "git-sync-agent",
        "webhook_unmatched",
        `Merged PR references ${ref} but no such ticket exists`,
      );
      res.json({ handled: false, reason: `unknown ticket ${ref}` });
      return;
    }
    const next = TICKET_NEXT_STATUS[ticket.status];
    if (next === null) {
      res.json({ handled: false, reason: `${ref} already complete` });
      return;
    }
    const result = store.transitionTicket(ticket.id, next);
    if (!result.ok) {
      store.log("git-sync-agent", "transition_refused", result.error);
      res.status(409).json({ handled: false, reason: result.error });
      return;
    }
    store.log(
      "git-sync-agent",
      "ticket_transitioned",
      `Merged PR "${title}" moved ${ref} from ${ticket.status} to ${next}; PM notified`,
    );
    res.json({ handled: true, ticket: result.ticket });
  });

  return router;
}
