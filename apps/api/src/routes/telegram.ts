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
    if (
      config.telegramWebhookSecret === null ||
      req.header("x-telegram-bot-api-secret-token") !== config.telegramWebhookSecret
    ) {
      res.status(401).json({ error: "invalid telegram webhook secret" });
      return;
    }
    const update = req.body;
    if (!update || typeof update !== "object") {
      res.status(400).send("Invalid update payload");
      return;
    }

    const message = update.message;
    if (message && typeof message.text === "string") {
      const text = message.text.trim();
      const chatId = message.chat?.id;
      const tgUsername = message.from?.username ? `@${message.from.username}` : "";
      const tgName = message.from?.first_name || "Developer";

      if (text.startsWith("/start") || text.startsWith("/help")) {
        const welcomeMsg = `<b>🚀 Welcome ${tgName} (${tgUsername}) to RiseCoreStudio!</b>\n\n` +
          `One Project One Month Developer Ecosystem.\n\n` +
          `<b>Available Commands:</b>\n` +
          `• /account - Retrieve your provisioned login credentials\n` +
          `• /projects - View active agency projects\n` +
          `• /proposals - View developer project proposals\n\n` +
          `Portal: <a href="https://developers.risecorestudio.com">developers.risecorestudio.com</a>`;
        if (chatId) await notifier.sendMessage(welcomeMsg, chatId);
      } else if (text.startsWith("/account") || text.startsWith("/credentials") || text.startsWith("/login")) {
        // Credentials never travel through Telegram. Known users receive the
        // portal address and use the normal password/magic-link flow.
        const username = message.from?.username?.toLowerCase();
        const users = await store.listUsers();
        const user = username
          ? users.find((candidate) => candidate.telegramUsername?.replace(/^@/, "").toLowerCase() === username)
          : undefined;
        const response = user
          ? `<b>🔐 Account found</b>\n\n${user.name} • ${user.role.toUpperCase()} • ${user.skillLevel.toUpperCase()}\n\nFor security, passwords are never sent in chat. Sign in or request a one-time link at: <a href="https://developers.risecorestudio.com/login">Developer Portal</a>`
          : `<b>Account not linked</b>\n\nAsk an administrator to link ${tgUsername || "your Telegram username"} to your approved RCS profile. Credentials are never created or disclosed by bot commands.`;
        if (chatId) await notifier.sendMessage(response, chatId);
      } else if (text.startsWith("/projects")) {
        const projects = await store.listProjects();
        const activeCount = projects.length;
        const msg = `<b>📊 RCS Live Projects (${activeCount})</b>\n` +
          projects.slice(0, 5).map(p => `• <b>${p.name}</b> (${p.type})`).join("\n");
        if (chatId) await notifier.sendMessage(msg, chatId);
      } else if (text.startsWith("/proposals")) {
        const proposals = await store.listProposals();
        const pending = proposals.filter(p => p.status === "pending").length;
        const msg = `<b>💡 RCS Developer Proposals</b>\nTotal: ${proposals.length} | Pending Review: ${pending}`;
        if (chatId) await notifier.sendMessage(msg, chatId);
      }
    }

    res.json({ ok: true });
  });

  return router;
}
