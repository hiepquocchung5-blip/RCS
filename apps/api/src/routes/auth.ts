import { Router, type Request, type Response } from "express";
import { isRole } from "@rcs/shared";
import type { ApiConfig } from "../config.js";
import { generateOtp, type OtpStore } from "../auth/otp.js";
import { signBridgeToken, signSessionToken } from "../auth/tokens.js";
import type { Store } from "../store.js";
import { requireAuth, type AuthedRequest } from "../middleware.js";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function authRoutes(
  config: ApiConfig,
  store: Store,
  otpStore: OtpStore,
): Router {
  const router = Router();

  /**
   * Step 1 — developer applies. An OTP is issued with a strict 5-minute TTL.
   * In production the Onboarding Agent emails it; in dev we log it so the
   * flow can be exercised end-to-end.
   */
  router.post("/apply", async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const email = asString(body["email"]);
    const name = asString(body["name"]);
    const githubUrl = asString(body["githubUrl"]);
    const requestedRole = asString(body["requestedRole"]);
    if (
      email === null ||
      name === null ||
      githubUrl === null ||
      requestedRole === null ||
      !isRole(requestedRole) ||
      requestedRole === "admin"
    ) {
      res.status(400).json({
        error:
          "email, name, githubUrl and requestedRole (pm|devops|frontend|backend) are required",
      });
      return;
    }
    const application = store.createApplication({
      email,
      name,
      githubUrl,
      requestedRole,
    });
    const otp = generateOtp();
    await otpStore.issue(application.id, otp);
    store.log(
      "onboarding-agent",
      "otp_issued",
      `OTP issued for application ${application.id} (${email}), expires in 5 minutes`,
    );
    if (!config.isProduction) {
      console.log(`[onboarding-agent] DEV OTP for ${email}: ${otp}`);
    }
    res.status(201).json({ applicationId: application.id });
  });

  /** Step 2 — applicant proves email ownership with the OTP. */
  router.post("/verify-otp", async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const applicationId = asString(body["applicationId"]);
    const otp = asString(body["otp"]);
    if (applicationId === null || otp === null) {
      res.status(400).json({ error: "applicationId and otp are required" });
      return;
    }
    const application = store.getApplication(applicationId);
    if (application === undefined || application.status !== "pending_otp") {
      res.status(404).json({ error: "no application awaiting OTP" });
      return;
    }
    const valid = await otpStore.verify(applicationId, otp);
    if (!valid) {
      store.log(
        "onboarding-agent",
        "otp_rejected",
        `OTP rejected for application ${applicationId} (wrong or expired)`,
      );
      res.status(401).json({ error: "invalid or expired OTP" });
      return;
    }
    store.setApplicationStatus(applicationId, "otp_verified");
    store.log(
      "onboarding-agent",
      "otp_verified",
      `OTP verified for application ${applicationId}; awaiting admin approval`,
    );
    res.json({ status: "otp_verified" });
  });

  /** Step 5 — one-time magic link reveals the generated credential. */
  router.get("/magic/:token", (req: Request, res: Response) => {
    const token = req.params.token;
    if (token === undefined) {
      res.status(400).json({ error: "token required" });
      return;
    }
    const result = store.consumeMagicLink(token);
    if (result === undefined) {
      res.status(410).json({ error: "magic link invalid or already used" });
      return;
    }
    store.log(
      "onboarding-agent",
      "magic_link_consumed",
      `Credentials delivered to ${result.user.email}; link burned`,
    );
    res.json(result);
  });

  /** Standard login for provisioned users. */
  router.post("/login", (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const email = asString(body["email"]);
    const password = asString(body["password"]);
    if (email === null || password === null) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }
    const user = store.findUserByEmail(email);
    if (user === undefined || user.password !== password) {
      res.status(401).json({ error: "invalid credentials" });
      return;
    }
    const token = signSessionToken(config.jwtSecret, {
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    store.log("api", "login", `${user.email} logged in (${user.role})`);
    const { password: _password, ...profile } = user;
    res.json({ token, user: profile });
  });

  /**
   * Issues a short-lived JWT the browser hands to the local RCS-CLI daemon
   * when opening the terminal bridge WebSocket.
   */
  router.post(
    "/bridge-token",
    requireAuth(config.jwtSecret),
    (req: AuthedRequest, res: Response) => {
      const session = req.session;
      if (session === undefined) {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }
      const token = signBridgeToken(config.jwtSecret, {
        sub: session.sub,
        email: session.email,
        role: session.role,
      });
      store.log(
        "local-bridge-agent",
        "bridge_token_issued",
        `Bridge token issued to ${session.email}`,
      );
      res.json({ token });
    },
  );

  /**
   * Dev-only convenience: lets the Workspace terminal connect without a full
   * login while developing locally. Disabled in production.
   */
  router.post("/dev-bridge-token", (_req: Request, res: Response) => {
    if (config.isProduction) {
      res.status(404).json({ error: "not available in production" });
      return;
    }
    const token = signBridgeToken(config.jwtSecret, {
      sub: "dev-guest",
      email: "dev-guest@localhost",
      role: "frontend",
    });
    store.log(
      "local-bridge-agent",
      "bridge_token_issued",
      "DEV bridge token issued to local guest (non-production only)",
    );
    res.json({ token });
  });

  return router;
}
