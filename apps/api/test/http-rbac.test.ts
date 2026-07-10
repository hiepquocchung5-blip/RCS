import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createHmac } from "node:crypto";
import request from "supertest";
import { Store } from "../src/store.js";
import { projectRoutes } from "../src/routes/projects.js";
import { ticketRoutes } from "../src/routes/tickets.js";
import { webhookRoutes } from "../src/routes/webhooks.js";
import { signSessionToken } from "../src/auth/tokens.js";
import type { ApiConfig } from "../src/config.js";

const secret = "http-test-secret";
const config: ApiConfig = {
  port: 0,
  apiBaseUrl: "http://localhost",
  jwtSecret: secret,
  redisUrl: null,
  databaseUrl: null,
  githubWebhookSecret: null,
  webOrigins: ["http://localhost"],
  isProduction: false,
};

function bearer(user: { id: string; email: string; role: "admin" | "pm" | "frontend" | "backend" | "devops" }): string {
  return `Bearer ${signSessionToken(secret, { sub: user.id, email: user.email, role: user.role })}`;
}

test("project and ticket routes enforce portfolio roles and team membership", async () => {
  const store = new Store(secret);
  const admin = store.createUser({ email: "admin@test.dev", name: "Admin", role: "admin", skillLevel: "senior", password: "Admin!Password12" });
  const assigned = store.createUser({ email: "assigned@test.dev", name: "Assigned", role: "frontend", skillLevel: "mid", password: "Assign!Password1" });
  const outsider = store.createUser({ email: "outside@test.dev", name: "Outsider", role: "backend", skillLevel: "mid", password: "Outsid!Password1" });
  const project = store.createProject({ name: "Secure", type: "web_app", description: "Private project", clientName: "Client", isPublic: false, techStack: [], resourceMatrix: [{ role: "frontend", skillLevel: "mid", count: 1 }] });
  assert.equal(store.assignTeamMember(project.id, assigned.id).ok, true);
  const ticket = store.createTicket({ title: "Private ticket", description: "Only the team", assigneeRole: "frontend", projectId: project.id });

  const app = express();
  app.use(express.json());
  app.use("/projects", projectRoutes(config, store));
  app.use("/tickets", ticketRoutes(config, store));

  assert.equal((await request(app).get(`/projects/${project.id}`)).status, 401);
  assert.equal((await request(app).get(`/projects/${project.id}`).set("authorization", bearer(outsider))).status, 403);
  assert.equal((await request(app).get(`/projects/${project.id}`).set("authorization", bearer(assigned))).status, 200);
  assert.equal((await request(app).get("/projects").set("authorization", bearer(outsider))).body.projects.length, 0);
  assert.equal((await request(app).get("/projects").set("authorization", bearer(admin))).body.projects.length, 1);
  assert.equal((await request(app).post(`/tickets/${ticket.id}/transition`).set("authorization", bearer(outsider)).send({ to: "in_progress" })).status, 403);
  assert.equal((await request(app).post(`/tickets/${ticket.id}/transition`).set("authorization", bearer(assigned)).send({ to: "in_progress" })).status, 200);
});

test("stored credentials are hashed and opaque magic links are one-time", () => {
  const store = new Store(secret);
  const raw = "Secure!Password1";
  const user = store.createUser({ email: "secure@test.dev", name: "Secure", role: "frontend", skillLevel: "mid", password: raw });
  assert.notEqual(user.passwordHash, raw);
  assert.ok(user.passwordHash.startsWith("scrypt$"));
  assert.equal(store.authenticateUser(user.email, raw)?.id, user.id);
  const link = store.createMagicLink(user.id, raw);
  assert.equal("password" in link, false);
  assert.equal(store.consumeMagicLink(link.token)?.password, raw);
  assert.equal(store.consumeMagicLink(link.token), undefined);
});

test("GitHub webhook requires a valid signature and rejects replay", async () => {
  const webhookSecret = "github-test-secret";
  const webhookConfig = { ...config, githubWebhookSecret: webhookSecret };
  const store = new Store(secret);
  const project = store.createProject({ name: "Webhook", type: "web_app", description: "Webhook project", clientName: "Client", isPublic: false, techStack: [], resourceMatrix: [] });
  const ticket = store.createTicket({ title: "Merge work", description: "PR integration", assigneeRole: "backend", projectId: project.id });
  const body = { action: "closed", pull_request: { merged: true, title: `${ticket.ref} ship integration` } };
  const raw = JSON.stringify(body);
  const signature = `sha256=${createHmac("sha256", webhookSecret).update(raw).digest("hex")}`;
  const app = express();
  app.use(express.json({ verify(req, _res, buffer) { (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer); } }));
  app.use("/webhooks", webhookRoutes(webhookConfig, store));

  assert.equal((await request(app).post("/webhooks/github").send(body)).status, 401);
  const accepted = await request(app).post("/webhooks/github").set("x-hub-signature-256", signature).set("x-github-delivery", "delivery-1").send(body);
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.ticket.status, "in_progress");
  assert.equal((await request(app).post("/webhooks/github").set("x-hub-signature-256", signature).set("x-github-delivery", "delivery-1").send(body)).status, 409);
});
