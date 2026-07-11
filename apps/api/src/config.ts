import { loadDotEnv } from "./env.js";

export interface ApiConfig {
  /** Port the API listens on. */
  port: number;
  /** Public base URL of this API (used in emails/magic links). */
  apiBaseUrl: string;
  /** Secret used to sign and verify authenticated web sessions. */
  jwtSecret: string;
  /** Redis connection for OTPs (5-min TTL) and future pub/sub; null = in-memory dev fallback. */
  redisUrl: string | null;
  /** PostgreSQL connection for entity storage; null = in-memory dev fallback. */
  databaseUrl: string | null;
  githubWebhookSecret: string | null;
  /** Browser origins allowed by CORS (comma-separated in RCS_WEB_ORIGIN). */
  webOrigins: string[];
  /**
   * Apex domain whose HTTPS subdomains are also allowed by CORS
   * (RCS_TRUSTED_DOMAIN, e.g. "risecorestudio.com"); null = exact origins only.
   */
  trustedDomain: string | null;
  /**
   * Where browsers landing on the auth API (GET / or /login, e.g. via the
   * auth.<domain> proxy) are redirected (RCS_LOGIN_REDIRECT_URL); null = 404.
   */
  loginRedirectUrl: string | null;
  isProduction: boolean;
}

export function loadConfig(): ApiConfig {
  loadDotEnv();
  const isProduction = process.env.NODE_ENV === "production";
  const jwtSecret = process.env.RCS_JWT_SECRET ?? "rcs-dev-secret-change-me";
  if (isProduction && jwtSecret === "rcs-dev-secret-change-me") {
    throw new Error("RCS_JWT_SECRET must be set in production");
  }
  const port = Number(process.env.PORT ?? 4000);
  return {
    port,
    apiBaseUrl: process.env.RCS_API_BASE_URL ?? `http://localhost:${port}`,
    jwtSecret,
    redisUrl: process.env.REDIS_URL ?? null,
    databaseUrl: process.env.DATABASE_URL ?? null,
    githubWebhookSecret: process.env.RCS_GITHUB_WEBHOOK_SECRET ?? null,
    webOrigins: (process.env.RCS_WEB_ORIGIN ?? "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    trustedDomain: process.env.RCS_TRUSTED_DOMAIN ?? null,
    loginRedirectUrl: process.env.RCS_LOGIN_REDIRECT_URL ?? null,
    isProduction,
  };
}
