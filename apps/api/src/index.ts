import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { loadConfig } from "./config.js";
import { createOtpStore } from "./auth/otp.js";
import { generatePassword } from "./auth/password.js";
import { Store } from "./store.js";
import { Redis } from "ioredis";
import { authRoutes } from "./routes/auth.js";
import { adminRoutes } from "./routes/admin.js";
import { ticketRoutes } from "./routes/tickets.js";
import { projectRoutes } from "./routes/projects.js";
import { orderRoutes } from "./routes/orders.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { requireAuth, requireRole, errorHandler } from "./middleware.js";
import { attachChat, chatRoutes } from "./chat.js";
import { metrics, requestContext } from "./observability.js";

const config = loadConfig();
const store = new Store(config.jwtSecret, config.databaseUrl);
const redisClient = config.redisUrl ? new Redis(config.redisUrl) : null;
const otpStore = createOtpStore(config.redisUrl);

await store.init();

/**
 * Seed the initial Admin (the Admin creates all other profiles). The
 * credential follows the 16-char rule; in dev it can be pinned via
 * RCS_ADMIN_PASSWORD, otherwise it is generated and printed once at boot.
 */
async function seedAdmin(): Promise<void> {
  const email = process.env.RCS_ADMIN_EMAIL ?? "admin@risecore.studio";
  const password = process.env.RCS_ADMIN_PASSWORD ?? generatePassword();
  const existing = await store.findUserByEmail(email);
  if (existing !== undefined) {
    return;
  }
  await store.createUser({
    email,
    name: "RCS Admin",
    role: "admin",
    skillLevel: "senior",
    password,
  });
  await store.log("api", "admin_seeded", `Admin account provisioned for ${email}`);
  console.log(`[rcs-api] Admin: ${email}`);
  if (process.env.RCS_ADMIN_PASSWORD === undefined) {
    console.log(`[rcs-api] Admin password (generated this boot): ${password}`);
  }
}

/** Optional demo data — only seeded when RCS_SEED_DEMO=true (never dummy data by default). */
async function seedDemoTickets(): Promise<void> {
  const projects = await store.listProjects();
  if (projects.some(p => p.name === "payvia")) {
    return;
  }
  const project = await store.createProject({
    name: "payvia",
    type: "web_app",
    description:
      "Payments dashboard with real-time settlement views, built by an RCS squad.",
    clientName: "Payvia Inc.",
    isPublic: true,
    techStack: ["Next.js", "TypeScript", "PostgreSQL", "Redis"],
    resourceMatrix: [
      { role: "backend", skillLevel: "senior", count: 1 },
      { role: "frontend", skillLevel: "junior", count: 2 },
      { role: "devops", skillLevel: "mid", count: 1 },
    ],
  });
  const projectId = project.id;
  await store.createTicket({
    title: "Build the settlement reporting dashboard",
    description: "Deliver client-ready reporting views with export support.",
    assigneeRole: "frontend",
    projectId,
  });
  await store.createTicket({
    title: "Complete responsive quality assurance",
    description: "Validate the delivery portal across supported breakpoints.",
    assigneeRole: "frontend",
    projectId,
  });
  await store.createTicket({
    title: "GitHub webhook → ticket transition",
    description: "Merged PR titled with RCS-<id> advances the ticket one state.",
    assigneeRole: "backend",
    projectId,
  });
  await store.createTicket({
    title: "Provision staging VPS",
    description: "Nginx reverse proxy for api + web, TLS via certbot.",
    assigneeRole: "devops",
    projectId,
  });
}

await seedAdmin();
if (process.env.RCS_SEED_DEMO === "true") {
  await seedDemoTickets();
  await store.log("api", "demo_seeded", "Demo tickets seeded (RCS_SEED_DEMO=true)");
}

const app = express();
app.use(cors({ origin: config.webOrigins }));
app.use(express.json({
  verify(req, _res, buffer) {
    (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  },
}));
app.use(requestContext);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "rcs-api" });
});
app.get("/ready", async (_req, res) => {
  let dbStatus = "memory";
  if (config.databaseUrl !== null) {
    try {
      await store.log("api", "healthcheck", "Database healthcheck query executed");
      dbStatus = "postgres";
    } catch {
      res.status(503).json({ ok: false, error: "Database not ready" });
      return;
    }
  }
  res.json({ ok: true, storage: dbStatus, otp: config.redisUrl === null ? "memory" : "redis" });
});
app.get("/metrics", (_req, res) => {
  res.type("text/plain; version=0.0.4").send(metrics());
});

app.use("/auth", authRoutes(config, store, otpStore, redisClient));
app.use("/admin", adminRoutes(config, store));
app.use("/tickets", ticketRoutes(config, store));
app.use("/projects", projectRoutes(config, store));
app.use("/orders", orderRoutes(config, store));
app.use("/chat", chatRoutes(config, store));
app.use("/webhooks", webhookRoutes(config, store, redisClient));

// Public, client-facing: only is_public projects, client-safe fields.
app.get("/showcase", async (_req, res) => {
  res.json({ projects: await store.listShowcase() });
});

app.get("/logs", requireAuth(config.jwtSecret), requireRole("admin", "pm"), async (_req, res) => {
  res.json({ logs: await store.listLogs() });
});

// Custom 404 not found handler
app.use((_req, res) => {
  res.status(404).json({
    error: "not_found",
    message: "the requested endpoint does not exist",
    code: 404
  });
});

// Register global error handler
app.use(errorHandler);

const server = createServer(app);
attachChat(server, store, config.jwtSecret);

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[rcs-api] ${signal} received; closing gracefully`);
  server.close(async (error) => {
    if (redisClient) {
      await redisClient.quit().catch((closeError: unknown) => {
        console.error("[rcs-api] failed to close shared Redis client", closeError);
      });
    }
    await store.close().catch((closeError: unknown) => {
      console.error("[rcs-api] failed to close Entity store", closeError);
    });
    await otpStore.close().catch((closeError: unknown) => {
      console.error("[rcs-api] failed to close OTP store", closeError);
    });
    if (error !== undefined) {
      console.error("[rcs-api] HTTP shutdown failed", error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

server.listen(config.port, () => {
  console.log(`[rcs-api] listening on ${config.apiBaseUrl}`);
  console.log(
    `[rcs-api] OTP store: ${config.redisUrl !== null ? "redis" : "in-memory (dev fallback, same 5-min TTL)"}`,
  );
  console.log(
    `[rcs-api] entity store: ${config.databaseUrl !== null ? "postgres" : "in-memory (dev fallback)"}`,
  );
  console.log(`[rcs-api] CORS origins: ${config.webOrigins.join(", ")}`);
});
