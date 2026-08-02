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
        if (chatId) await notifier.sendMessage(welcomeMsg);
      } else if (text.startsWith("/account") || text.startsWith("/credentials") || text.startsWith("/login")) {
        // Find or provision account linked to Telegram username or email
        const email = message.from?.username
          ? `${message.from.username.toLowerCase()}@risecorestudio.com`
          : `dev_${chatId}@risecorestudio.com`;
        
        let user = await store.findUserByEmail(email);
        let pass = "RCS-TgDev-2026!#";
        if (!user) {
          user = await store.createUser({
            email,
            name: `${tgName} (${tgUsername})`,
            role: "devops",
            skillLevel: "mid",
            password: pass,
          });
        }

        const credsMsg = `<b>🔑 RiseCoreStudio Account Credentials for ${tgName} (${tgUsername})</b>\n\n` +
          `• <b>Email:</b> <code>${email}</code>\n` +
          `• <b>Password:</b> <code>${pass}</code>\n` +
          `• <b>Role:</b> ${user.role.toUpperCase()}\n` +
          `• <b>Skill Rank:</b> ${user.skillLevel.toUpperCase()}\n\n` +
          `Sign in at: <a href="https://developers.risecorestudio.com/login">developers.risecorestudio.com/login</a>`;
        if (chatId) await notifier.sendMessage(credsMsg);
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
