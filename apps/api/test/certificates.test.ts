import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { Store } from "../src/store.js";
import { projectRoutes } from "../src/routes/projects.js";
import { certificateRoutes } from "../src/routes/certificates.js";
import { signSessionToken } from "../src/auth/tokens.js";
import type { ApiConfig } from "../src/config.js";

const secret = "certificate-test-secret";
const config: ApiConfig = {
  port: 0,
  apiBaseUrl: "http://localhost",
  jwtSecret: secret,
  redisUrl: null,
  databaseUrl: null,
  githubWebhookSecret: null,
  telegramWebhookSecret: null,
  webOrigins: ["http://localhost"],
  trustedDomain: null,
  loginRedirectUrl: null,
  isProduction: false,
  smtpHost: null,
  smtpPort: 25,
  smtpUser: null,
  smtpPass: null,
  smtpSecure: false,
  smtpFrom: "test@example.com",
};

function bearer(user: { id: string; email: string; role: "admin" | "pm" | "frontend" }): string {
  return `Bearer ${signSessionToken(secret, { sub: user.id, email: user.email, role: user.role })}`;
}

test("milestone certificates are authorized, idempotent and publicly verifiable", async () => {
  const store = new Store(secret);
  const admin = await store.createUser({ email: "admin@cert.test", name: "Certificate Admin", role: "admin", skillLevel: "senior", password: "Admin!Password12" });
  const outsider = await store.createUser({ email: "outside@cert.test", name: "Outsider", role: "frontend", skillLevel: "mid", password: "Outsid!Password1" });
  const project = await store.createProject({ name: "Signed delivery", type: "web_app", description: "Private", clientName: "Acme", isPublic: false, techStack: [], resourceMatrix: [] });
  const milestone = await store.createMilestone(project.id, "Production acceptance", "2026-09-01");
  assert.ok(milestone);

  const app = express();
  app.use(express.json());
  app.use("/projects", projectRoutes(config, store));
  app.use("/certificates", certificateRoutes(store));

  const path = `/projects/${project.id}/milestones/${milestone.id}/sign-off`;
  assert.equal((await request(app).post(path).set("authorization", bearer(outsider)).send({ confirmation: "approve" })).status, 403);
  assert.equal((await request(app).post(path).set("authorization", bearer(admin)).send({ confirmation: "wrong" })).status, 400);

  const first = await request(app).post(path).set("authorization", bearer(admin)).send({ confirmation: "approve" });
  assert.equal(first.status, 201);
  assert.equal(first.body.created, true);
  assert.match(first.body.certificate.signature, /^[a-f0-9]{64}$/);

  const repeated = await request(app).post(path).set("authorization", bearer(admin)).send({ confirmation: "approve" });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.created, false);
  assert.equal(repeated.body.certificate.id, first.body.certificate.id);

  const verification = await request(app).get(`/certificates/${first.body.certificate.verificationId}`);
  assert.equal(verification.status, 200);
  assert.equal(verification.body.valid, true);
  assert.equal(verification.body.certificate.projectName, "Signed delivery");
  assert.equal((await store.getProject(project.id))?.milestones[0]?.status, "complete");
});

test("certificate lookup preserves project isolation", async () => {
  const store = new Store(secret);
  const admin = await store.createUser({ email: "admin2@cert.test", name: "Admin", role: "admin", skillLevel: "senior", password: "Admin!Password12" });
  const one = await store.createProject({ name: "One", type: "web_app", description: "", clientName: "One", isPublic: false, techStack: [], resourceMatrix: [] });
  const two = await store.createProject({ name: "Two", type: "web_app", description: "", clientName: "Two", isPublic: false, techStack: [], resourceMatrix: [] });
  const milestone = await store.createMilestone(one.id, "Accept", "2026-09-01");
  assert.ok(milestone);
  await store.signOffMilestone(one.id, milestone.id, { id: admin.id, name: admin.name });

  const app = express();
  app.use(express.json());
  app.use("/projects", projectRoutes(config, store));
  const response = await request(app).get(`/projects/${two.id}/milestones/${milestone.id}/certificate`).set("authorization", bearer(admin));
  assert.equal(response.status, 404);
});
