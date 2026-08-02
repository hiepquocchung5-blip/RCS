import { Router, type Request, type Response } from "express";
import type { ApiConfig } from "../config.js";
import type { Store } from "../store.js";
import { createTelegramNotifier } from "../telegram.js";

export function telegramRoutes(config: ApiConfig, store: Store): Router {
  const router = Router();
  const notifier = createTelegramNotifier(config);

  /**
   * Telegram Webhook Receiver Endpoint:
   * Handles incoming Telegram bot updates and slash commands (/start, /projects, /proposals).
   */
  router.post("/webhook", async (req: Request, res: Response) => {
    const update = req.body;
    if (!update || typeof update !== "object") {
      res.status(400).send("Invalid update payload");
      return;
    }

    const message = update.message;
    if (message && typeof message.text === "string") {
      const text = message.text.trim();
      const chatId = message.chat?.id;

      if (text.startsWith("/start")) {
        const welcomeMsg = `<b>🚀 Welcome to Rise Core Studio (RCS)</b>\n\nOne Project One Month Developer Platform.\nVisit <a href="https://risecorestudio.com">risecorestudio.com</a> or <a href="https://developers.risecorestudio.com">developers.risecorestudio.com</a> to view live projects and proposals.`;
        if (chatId) await notifier.sendMessage(welcomeMsg);
      } else if (text.startsWith("/projects")) {
        const projects = await store.listProjects();
        const activeCount = projects.length;
        const msg = `<b>📊 RCS Live Projects (${activeCount})</b>\n` +
          projects.slice(0, 5).map(p => `• <b>${p.name}</b> (${p.type})`).join("\n");
        if (chatId) await notifier.sendMessage(msg);
      } else if (text.startsWith("/proposals")) {
        const proposals = await store.listProposals();
        const pending = proposals.filter(p => p.status === "pending").length;
        const msg = `<b>💡 RCS Developer Proposals</b>\nTotal: ${proposals.length} | Pending Review: ${pending}`;
        if (chatId) await notifier.sendMessage(msg);
      }
    }

    res.json({ ok: true });
  });

  return router;
}
