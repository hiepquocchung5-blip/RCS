import { Router, type Response } from "express";
import type { ApiConfig } from "../config.js";
import { generatePassword } from "../auth/password.js";
import type { Store } from "../store.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware.js";
import { Mailer } from "../mail.js";

export function adminRoutes(config: ApiConfig, store: Store, mailer: Mailer): Router {
  const router = Router();
  router.use(requireAuth(config.jwtSecret), requireRole("admin"));

  router.get("/applications", async (_req: AuthedRequest, res: Response) => {
    res.json({ applications: await store.listApplications() });
  });

  router.get("/users", async (_req: AuthedRequest, res: Response) => {
    res.json({ users: await store.listUsers() });
  });

  /**
   * Steps 3–5 of the onboarding pipeline: admin approves a verified
   * application, the Onboarding Agent generates the 16-character credential
   * and a one-time magic link that delivers it.
   */
  router.post("/applications/:id/approve", async (req: AuthedRequest, res: Response) => {
    const id = req.params.id;
    if (id === undefined) {
      res.status(400).json({ error: "application id required" });
      return;
    }
    const application = await store.getApplication(id);
    if (application === undefined) {
      res.status(404).json({ error: "application not found" });
      return;
    }
    if (application.status !== "otp_verified") {
      res.status(409).json({
        error: `application is ${application.status}; only otp_verified applications can be approved`,
      });
      return;
    }
    const password = generatePassword();
    const { passwordHash: _passwordHash, ...user } = await store.createUser({
      email: application.email,
      name: application.name,
      role: application.requestedRole,
      skillLevel: application.skillLevel,
      password,
    });
    await store.setApplicationStatus(id, "approved");
    const link = await store.createMagicLink(user.id, password);
    const magicLinkUrl = `${config.apiBaseUrl.replace(/\/api$/, "")}/auth/magic/${link.token}`;
    try {
      await mailer.sendMail({
        to: application.email,
        subject: "RCS Onboarding — Application Approved",
        text: `Hello ${application.name},\n\nYour developer application to RiseCoreStudio has been approved!\n\nUse this one-time magic link to retrieve your generated credentials (burns after one use):\n\n${magicLinkUrl}\n\nBest regards,\nRiseCoreStudio Onboarding Agent`,
        html: `<p>Hello <strong>${application.name}</strong>,</p><p>Your developer application to RiseCoreStudio has been approved!</p><p>Use this one-time magic link to retrieve your generated credentials (burns after one use):</p><p><a href="${magicLinkUrl}" style="padding: 10px 20px; background-color: #00f0ff; color: #0f111a; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Retrieve Credentials</a></p><p>Or copy this link: ${magicLinkUrl}</p><p>Best regards,<br>RiseCoreStudio Onboarding Agent</p>`,
      });
    } catch (mailError: unknown) {
      console.error("[onboarding-agent] Failed to send credentials email:", mailError);
    }
    await store.log(
      "onboarding-agent",
      "application_approved",
      `Application ${id} approved; 16-char credential generated for ${user.email}; magic link issued`,
    );
    res.json({
      user,
      magicLinkPath: `/auth/magic/${link.token}`,
    });
  });

  router.post("/applications/:id/reject", async (req: AuthedRequest, res: Response) => {
    const id = req.params.id;
    if (id === undefined) {
      res.status(400).json({ error: "application id required" });
      return;
    }
    const updated = await store.setApplicationStatus(id, "rejected");
    if (updated === undefined) {
      res.status(404).json({ error: "application not found" });
      return;
    }
    await store.log("onboarding-agent", "application_rejected", `Application ${id} rejected`);
    res.json({ application: updated });
  });

  return router;
}
