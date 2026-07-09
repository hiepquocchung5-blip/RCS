import { Router, type Response } from "express";
import type { ApiConfig } from "../config.js";
import { generatePassword } from "../auth/password.js";
import type { Store } from "../store.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware.js";

export function adminRoutes(config: ApiConfig, store: Store): Router {
  const router = Router();
  router.use(requireAuth(config.jwtSecret), requireRole("admin"));

  router.get("/applications", (_req: AuthedRequest, res: Response) => {
    res.json({ applications: store.listApplications() });
  });

  router.get("/users", (_req: AuthedRequest, res: Response) => {
    res.json({ users: store.listUsers() });
  });

  /**
   * Steps 3–5 of the onboarding pipeline: admin approves a verified
   * application, the Onboarding Agent generates the 16-character credential
   * and a one-time magic link that delivers it.
   */
  router.post("/applications/:id/approve", (req: AuthedRequest, res: Response) => {
    const id = req.params.id;
    if (id === undefined) {
      res.status(400).json({ error: "application id required" });
      return;
    }
    const application = store.getApplication(id);
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
    const { password: _password, ...user } = store.createUser({
      email: application.email,
      name: application.name,
      role: application.requestedRole,
      password,
    });
    store.setApplicationStatus(id, "approved");
    const link = store.createMagicLink(user.id, password);
    store.log(
      "onboarding-agent",
      "application_approved",
      `Application ${id} approved; 16-char credential generated for ${user.email}; magic link issued`,
    );
    res.json({
      user,
      magicLinkPath: `/auth/magic/${link.token}`,
    });
  });

  router.post("/applications/:id/reject", (req: AuthedRequest, res: Response) => {
    const id = req.params.id;
    if (id === undefined) {
      res.status(400).json({ error: "application id required" });
      return;
    }
    const updated = store.setApplicationStatus(id, "rejected");
    if (updated === undefined) {
      res.status(404).json({ error: "application not found" });
      return;
    }
    store.log("onboarding-agent", "application_rejected", `Application ${id} rejected`);
    res.json({ application: updated });
  });

  return router;
}
