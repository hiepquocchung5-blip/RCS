# Infrastructure

## Production topology (as deployed)

```text
Internet
   │
Nginx + TLS (Certbot)
   ├── <apex> and www ─────────────> Next.js web (:3000), /api/ → API (:4000)
   ├── developers.<apex> ──────────> Next.js web (:3000)
   ├── api.<apex> ─────────────────> Express API (:4000)
   └── auth.<apex> ────────────────> API /auth/* (browser GETs redirect to login)
                                        ├── PostgreSQL (entities + chat history)
                                        └── Redis (OTPs, rate limits, webhook dedup)
```

Both services run as the non-root deploy user under PM2 (`ecosystem.config.cjs`). Nginx preserves WebSocket upgrade headers for `/chat`. See `docs/OPERATIONS.md` for the full URL map and health checks.

## Environments

- **Local** — in-memory entities, in-memory OTPs, optional demo seed.
- **Staging** — production-like domain, Redis and PostgreSQL; synthetic data only.
- **Production** — isolated database and Redis, managed secrets, backups and monitoring.

Never reuse credentials, databases or JWT secrets between environments.

## Configuration

Runtime configuration is environment-based and documented in `.env.example`. Production requires a strong `RCS_JWT_SECRET`, `RCS_TRUSTED_DOMAIN` (CORS subdomain allowance) and `RCS_LOGIN_REDIRECT_URL`. `NEXT_PUBLIC_RCS_API`, `NEXT_PUBLIC_RCS_AUTH` and `NEXT_PUBLIC_RCS_COOKIE_DOMAIN` are embedded into the web build and must be exported when running `npm run build`.

Treat the following as secrets:

- JWT signing key
- Admin bootstrap credential
- PostgreSQL connection string
- Redis connection string when it contains credentials

## Deployment behavior

The API handles `SIGTERM` and `SIGINT`, stops accepting connections and closes its OTP store. The process should receive a termination grace period from the service manager before forced shutdown.

`/health` proves the HTTP process is alive; `/ready` verifies PostgreSQL and reports the active OTP store (`{"ok":true,"storage":"postgres","otp":"redis"}` in production). Run `/ready` after every deploy.

## Security baseline (implemented)

- HTTPS and secure WebSockets only outside local development.
- CORS allows exact configured origins plus HTTPS subdomains of `RCS_TRUSTED_DOMAIN`; never a wildcard, never a plain suffix match.
- Network access to PostgreSQL and Redis limited to the application host.
- Namespaced rate limits on login, application, OTP, magic-link and reaction routes; chat posts limited per socket.
- Scrypt password hashing, hashed one-time magic links with encrypted credential delivery.
- HMAC-validated GitHub webhook signatures with Redis-backed replay deduplication.

## Reliability baseline

- Daily encrypted PostgreSQL backups with tested restore procedures.
- Redis persistence according to the accepted OTP-loss risk.
- Structured logs shipped outside the application host.
- Alerts for elevated 5xx responses, login failures, process restarts and datastore saturation.
- Rolling or blue/green deployments once more than one API instance is used.

## Scaling notes

Entities persist in PostgreSQL, so the API process is stateless except for the in-process chat fan-out. Horizontal scaling to multiple API instances requires a Redis-backed chat pub/sub layer; do not add API replicas before it exists. On a single VPS, the in-process fan-out is correct and fast.
