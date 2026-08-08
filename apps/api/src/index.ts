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
import { stockRoutes } from "./routes/stock.js";
import { proposalRoutes } from "./routes/proposals.js";
import { telegramRoutes } from "./routes/telegram.js";
import { certificateRoutes } from "./routes/certificates.js";
import { requireAuth, requireRole, errorHandler } from "./middleware.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { verifyToken } from "./auth/tokens.js";
import { attachChat, chatRoutes } from "./chat.js";
import { metrics, requestContext } from "./observability.js";
import { createMailer } from "./mail.js";

const config = loadConfig();
const store = new Store(config.jwtSecret, config.databaseUrl);
const redisClient = config.redisUrl ? new Redis(config.redisUrl) : null;
const otpStore = createOtpStore(config.redisUrl);
const mailer = createMailer(config);

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

/**
 * Seed founder Admin accounts from RCS_FOUNDERS ("Name:email" pairs,
 * comma-separated). Each founder gets a generated 16-char credential that is
 * printed once at boot; existing accounts are never touched.
 */
async function seedFounders(): Promise<void> {
  const raw = process.env.RCS_FOUNDERS;
  if (raw === undefined || raw.trim().length === 0) {
    return;
  }
  for (const entry of raw.split(",")) {
    const separator = entry.indexOf(":");
    if (separator === -1) {
      console.warn(`[rcs-api] RCS_FOUNDERS entry "${entry.trim()}" is not "Name:email"; skipped`);
      continue;
    }
    const name = entry.slice(0, separator).trim();
    const email = entry.slice(separator + 1).trim();
    if (name.length === 0 || email.length === 0) {
      console.warn(`[rcs-api] RCS_FOUNDERS entry "${entry.trim()}" is missing a name or email; skipped`);
      continue;
    }
    if ((await store.findUserByEmail(email)) !== undefined) {
      continue;
    }
    const password = generatePassword();
    await store.createUser({ email, name, role: "admin", skillLevel: "senior", password });
    await store.log("api", "founder_seeded", `Founder admin account provisioned for ${name} (${email})`);
    console.log(`[rcs-api] Founder admin: ${name} <${email}>`);
    console.log(`[rcs-api] ${email} password (generated this boot): ${password}`);
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
await seedFounders();
if (process.env.RCS_SEED_DEMO === "true") {
  await seedDemoTickets();
  await store.log("api", "demo_seeded", "Demo tickets seeded (RCS_SEED_DEMO=true)");
}

/**
 * An origin is allowed when it exactly matches RCS_WEB_ORIGIN, or when it is
 * an HTTPS origin whose hostname is RCS_TRUSTED_DOMAIN or one of its
 * subdomains. A plain suffix check is not enough: "evil-risecorestudio.com"
 * must never pass.
 */
function isAllowedOrigin(origin: string): boolean {
  if (!origin) return true;
  if (config.webOrigins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    const domain = (config.trustedDomain || "risecorestudio.com").toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

const app = express();
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "x-guest-session", "x-requested-with"]
}));
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
  let dbStatus: "memory" | "postgres";
  try {
      dbStatus = await store.ping();
    } catch {
      res.status(503).json({ ok: false, error: "Database not ready" });
      return;
  }
  res.json({ ok: true, storage: dbStatus, otp: config.redisUrl === null ? "memory" : "redis" });
});
app.get("/metrics", (_req, res) => {
  res.type("text/plain; version=0.0.4").send(metrics());
});

app.get("/operations/status", requireAuth(config.jwtSecret), requireRole("admin", "pm"), async (_req, res) => {
  const memory = process.memoryUsage();
  let storage: "postgres" | "memory" | "unavailable" = "unavailable";
  try { storage = await store.ping(); } catch { /* surfaced in response */ }
  res.json({
    generatedAt: new Date().toISOString(),
    api: { status: "online", uptimeSeconds: Math.floor(process.uptime()), memoryRssBytes: memory.rss, heapUsedBytes: memory.heapUsed },
    storage: { status: storage === "unavailable" ? "unavailable" : "online", driver: storage },
    redis: { status: redisClient === null ? "development-fallback" : redisClient.status },
    telegram: { configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) },
  });
});

app.get("/leaderboard", requireAuth(config.jwtSecret), async (_req, res) => {
  res.json({ season: 1, entries: await store.leaderboard(10) });
});

app.use("/auth", authRoutes(config, store, otpStore, mailer, redisClient));
app.use("/certificates", certificateRoutes(store));
app.use("/admin", adminRoutes(config, store, mailer));
app.use("/tickets", ticketRoutes(config, store));
app.use("/projects", projectRoutes(config, store));
app.use("/orders", orderRoutes(config, store));
app.use("/stock", stockRoutes(config, store));
app.use("/proposals", proposalRoutes(config, store));
app.use("/chat", chatRoutes(config, store));
app.use("/telegram", telegramRoutes(config, store));
app.use("/webhooks", webhookRoutes(config, store, redisClient));

// Public, client-facing: only is_public projects, client-safe fields.
app.get("/showcase", async (req, res) => {
  let sessionOrGuestId = req.headers["x-guest-session"] as string | undefined;
  
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const claims = verifyToken(config.jwtSecret, authHeader.substring(7), "session");
      if (claims) sessionOrGuestId = claims.sub;
    } catch {
      // Ignore token verification errors for public endpoints
    }
  }
  
  res.json({ projects: await store.listShowcase(sessionOrGuestId || null) });
});

app.get("/showcase/:id", async (req, res) => {
  const projectId = req.params.id;
  if (!projectId) {
    res.status(400).json({ error: "project id required" });
    return;
  }
  let sessionOrGuestId = req.headers["x-guest-session"] as string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const claims = verifyToken(config.jwtSecret, authHeader.substring(7), "session");
      if (claims) sessionOrGuestId = claims.sub;
    } catch {
      // Ignore token verification errors
    }
  }
  const showcaseList = await store.listShowcase(sessionOrGuestId || null);
  const found = showcaseList.find(p => p.id === projectId);
  if (!found) {
    res.status(404).json({ error: "showcase project not found" });
    return;
  }
  res.json({ project: found });
});

// Reactions are guest-writable, so cap them per IP; counts stay approximate.
const reactionLimit = rateLimit({ name: "react", windowMs: 5 * 60 * 1000, limit: 30, redisClient });

app.post("/showcase/:id/react", reactionLimit, async (req, res) => {
  const projectId = req.params.id;
  if (projectId === undefined) {
    res.status(400).json({ error: "project id required" });
    return;
  }
  const { reactionType } = req.body;
  if (!reactionType || !["star", "like", "love", "fire"].includes(reactionType)) {
    res.status(400).json({ error: "invalid reaction type" });
    return;
  }

  let sessionOrGuestId = req.headers["x-guest-session"] as string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const claims = verifyToken(config.jwtSecret, authHeader.substring(7), "session");
      if (claims) sessionOrGuestId = claims.sub;
    } catch {
      // Ignore token verification errors
    }
  }

  if (!sessionOrGuestId) {
    res.status(400).json({ error: "guest session id or user authorization is required to react" });
    return;
  }

  const result = await store.reactToShowcase(projectId, sessionOrGuestId, reactionType);
  res.json(result);
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
