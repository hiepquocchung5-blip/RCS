import nodemailer from "nodemailer";
import type { ApiConfig } from "./config.js";

export interface Mailer {
  sendMail(options: { to: string; subject: string; text: string; html?: string }): Promise<void>;
}

export function createMailer(config: ApiConfig): Mailer {
  const host = config.smtpHost;

  if (host === null) {
    // Development fallback / dry-run mode
    return {
      async sendMail(options) {
        console.log(`[mailer] [DRY RUN] Sending mail:`);
        console.log(`  To:      ${options.to}`);
        console.log(`  Subject: ${options.subject}`);
        console.log(`  Body:    ${options.text}`);
      },
    };
  }

  const transportOptions: nodemailer.TransportOptions = {
    host,
    port: config.smtpPort,
    secure: config.smtpSecure,
  } as unknown as nodemailer.TransportOptions;

  if (config.smtpUser !== null && config.smtpPass !== null) {
    (transportOptions as Record<string, unknown>).auth = {
      user: config.smtpUser,
      pass: config.smtpPass,
    };
  }

  const transporter = nodemailer.createTransport(transportOptions);

  return {
    async sendMail(options) {
      await transporter.sendMail({
        from: config.smtpFrom,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
    },
  };
}
