import type { ApiConfig } from "./config.js";

export interface TelegramNotifier {
  sendMessage(text: string, targetChatId?: string | number): Promise<boolean>;
}

export function createTelegramNotifier(config: ApiConfig): TelegramNotifier {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  return {
    async sendMessage(text: string, targetChatId?: string | number): Promise<boolean> {
      const destination = targetChatId ?? chatId;
      if (!botToken || !destination) {
        // Soft fallback when Telegram credentials are not yet configured in env
        return false;
      }
      try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: destination,
            text,
            parse_mode: "HTML",
          }),
        });
        return res.ok;
      } catch (error) {
        console.error("[telegram-bot] notification failed", error);
        return false;
      }
    },
  };
}
