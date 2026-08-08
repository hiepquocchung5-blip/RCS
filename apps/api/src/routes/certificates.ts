import { Router, type Request, type Response } from "express";
import type { Store } from "../store.js";

/** Public verification exposes only the immutable certificate snapshot. */
export function certificateRoutes(store: Store): Router {
  const router = Router();
  router.get("/:verificationId", async (req: Request, res: Response) => {
    const verificationId = req.params.verificationId;
    if (!verificationId || !/^[0-9a-f-]{36}$/i.test(verificationId)) {
      res.status(400).json({ error: "valid verification id required" });
      return;
    }
    const result = await store.verifyMilestoneCertificate(verificationId);
    if (!result) {
      res.status(404).json({ error: "certificate not found" });
      return;
    }
    res.json(result);
  });
  return router;
}
