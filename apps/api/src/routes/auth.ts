import { Router, type Request, type Response } from "express";
import type { ApiConfig } from "../config.js";
import { generateOtp, type OtpStore } from "../auth/otp.js";
import { signSessionToken } from "../auth/tokens.js";
import type { Store } from "../store.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { requireAuth, type AuthedRequest } from "../middleware.js";
import { applicationSchema, loginSchema, otpSchema, validationError } from "../schemas.js";
import { Mailer } from "../mail.js";

import { Redis } from "ioredis";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function authRoutes(
  config: ApiConfig,
  store: Store,
  otpStore: OtpStore,
  mailer: Mailer,
  redisClient?: Redis | null,
): Router {
  const router = Router();
  const applicationLimit = rateLimit({ name: "apply", windowMs: 60 * 60 * 1000, limit: 10, redisClient });
  const loginLimit = rateLimit({ name: "login", windowMs: 15 * 60 * 1000, limit: 10, redisClient });
  const magicLimit = rateLimit({ name: "magic", windowMs: 15 * 60 * 1000, limit: 10, redisClient });
  const otpLimit = rateLimit({
    name: "otp",
    windowMs: 5 * 60 * 1000,
    limit: 5,
    key: (req) => `${req.ip ?? "unknown"}:${String((req.body as Record<string, unknown>)["applicationId"] ?? "missing")}`,
    redisClient,
  });

  /**
   * The auth service is a JSON API, but auth.<domain> proxies straight to it,
   * so people typing that address land here with a browser. Send them to the
   * real login page instead of raw JSON.
   */
  router.get(["/", "/login"], (_req: Request, res: Response) => {
    if (config.loginRedirectUrl === null) {
      res.status(404).json({
        error: "not_found",
        message: "this is the RCS auth API; sign in on the web portal",
        code: 404,
      });
      return;
    }
    res.redirect(302, config.loginRedirectUrl);
  });

  /**
   * Step 1 — developer applies. An OTP is issued with a strict 5-minute TTL.
   * In production the Onboarding Agent emails it; in dev we log it so the
   * flow can be exercised end-to-end.
   */
  router.post("/apply", applicationLimit, async (req: Request, res: Response) => {
    const parsed = applicationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(validationError(parsed.error));
      return;
    }
    const { email, name, githubUrl, requestedRole, skillLevel } = parsed.data;
    const application = await store.createApplication({
      email,
      name,
      githubUrl,
      requestedRole,
      skillLevel,
    });
    const otp = generateOtp();
    await otpStore.issue(application.id, otp);
    await store.log(
      "onboarding-agent",
      "otp_issued",
      `OTP issued for application ${application.id} (${email}), expires in 5 minutes`,
    );
    if (!config.isProduction) {
      console.log(`[onboarding-agent] DEV OTP for ${email}: ${otp}`);
    }
    try {
      await mailer.sendMail({
        to: email,
        subject: "RCS Onboarding — Verify your email",
        text: `Hello ${name},\n\nYour OTP is ${otp}. It expires in exactly 5 minutes.\n\nBest regards,\nRiseCoreStudio Onboarding Agent`,
        html: `<p>Hello <strong>${name}</strong>,</p><p>Your OTP is <strong>${otp}</strong>. It expires in exactly 5 minutes.</p><p>Best regards,<br>RiseCoreStudio Onboarding Agent</p>`,
      });
    } catch (mailError: unknown) {
      console.error("[onboarding-agent] Failed to send OTP email:", mailError);
    }
    res.status(201).json({ applicationId: application.id });
  });

  /** Step 2 — applicant proves email ownership with the OTP. */
  router.post("/verify-otp", otpLimit, async (req: Request, res: Response) => {
    const parsed = otpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(validationError(parsed.error));
      return;
    }
    const { applicationId, otp } = parsed.data;
    const application = await store.getApplication(applicationId);
    if (application === undefined || application.status !== "pending_otp") {
      res.status(404).json({ error: "no application awaiting OTP" });
      return;
    }
    const valid = await otpStore.verify(applicationId, otp);
    if (!valid) {
      await store.log(
        "onboarding-agent",
        "otp_rejected",
        `OTP rejected for application ${applicationId} (wrong or expired)`,
      );
      res.status(401).json({ error: "invalid or expired OTP" });
      return;
    }
    await store.setApplicationStatus(applicationId, "otp_verified");
    await store.log(
      "onboarding-agent",
      "otp_verified",
      `OTP verified for application ${applicationId}; awaiting admin approval`,
    );
    res.json({ status: "otp_verified" });
  });

  /** Step 5 — one-time magic link reveals the generated credential. */
  router.get("/magic/:token", magicLimit, async (req: Request, res: Response) => {
    const token = req.params.token;
    if (token === undefined) {
      res.status(400).json({ error: "token required" });
      return;
    }
    const result = await store.consumeMagicLink(token);
    if (result === undefined) {
      res.status(410).json({ error: "magic link invalid or already used" });
      return;
    }
    await store.log(
      "onboarding-agent",
      "magic_link_consumed",
      `Credentials delivered to ${result.user.email}; link burned`,
    );
    res.json(result);
  });

  /** Standard login for provisioned users. */
  router.post("/login", loginLimit, async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(validationError(parsed.error));
      return;
    }
    const { email, password } = parsed.data;
    const user = await store.authenticateUser(email, password);
    if (user === undefined) {
      res.status(401).json({ error: "invalid credentials" });
      return;
    }
    const token = signSessionToken(config.jwtSecret, {
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const { passwordHash: _passwordHash, ...profile } = user;
    res.json({ token, user: profile });
  });

  router.post("/change-password", requireAuth(config.jwtSecret), async (req: AuthedRequest, res: Response) => {
    const session = req.session;
    if (!session) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      res.status(400).json({ error: "oldPassword and valid newPassword (min 8 chars) required" });
      return;
    }
    const ok = await store.changePassword(session.sub, oldPassword, newPassword);
    if (!ok) {
      res.status(400).json({ error: "incorrect old password or user not found" });
      return;
    }
    await store.log("api", "password_changed", `Password updated for ${session.email}`);
    res.json({ ok: true });
  });

  return router;
}
