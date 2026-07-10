# Infrastructure

## Recommended production topology

```text
Internet
   │
CDN / reverse proxy / TLS
   ├── / and static assets ──> Next.js service
   └── /api and /chat ───────> Express API service
                                  ├── PostgreSQL
                                  └── Redis
```

Run the web and API as separate, non-root processes. Terminate TLS at a managed load balancer or Nginx and preserve WebSocket upgrade headers for `/chat`.

## Environments

- **Local** — in-memory entities, in-memory OTPs, optional demo seed.
- **Staging** — production-like domain, Redis and PostgreSQL; synthetic data only.
- **Production** — isolated database and Redis, managed secrets, backups and monitoring.

Never reuse credentials, databases or JWT secrets between environments.

## Configuration

Runtime configuration is environment-based and documented in `.env.example`. Production requires a strong `RCS_JWT_SECRET`. `NEXT_PUBLIC_RCS_API` is embedded into the web build and must point to the public API origin.

Treat the following as secrets:

- JWT signing key
- Admin bootstrap credential
- PostgreSQL connection string
- Redis connection string when it contains credentials

## Deployment behavior

The API handles `SIGTERM` and `SIGINT`, stops accepting connections and closes its OTP store. The process should receive a termination grace period from the service manager before forced shutdown.

The current `/health` endpoint proves that the HTTP process is alive. A future readiness endpoint should verify database and Redis access after those production adapters are implemented.

## Security baseline

- HTTPS and secure WebSockets only outside local development.
- Restrictive CORS origins; never use a wildcard with authenticated endpoints.
- Network access to PostgreSQL and Redis limited to application hosts.
- Rate limiting on login, OTP and public request routes before public launch.
- Password hashing, short-lived one-time delivery records and secret rotation before production use.
- Validated GitHub webhook signatures before accepting automated transitions.

## Reliability baseline

- Daily encrypted PostgreSQL backups with tested restore procedures.
- Redis persistence according to the accepted OTP-loss risk.
- Structured logs shipped outside the application host.
- Alerts for elevated 5xx responses, login failures, process restarts and datastore saturation.
- Rolling or blue/green deployments once more than one API instance is used.

## Scaling notes

The in-memory entity store and in-process chat fan-out constrain the current API to one instance. Horizontal scaling requires PostgreSQL persistence and a Redis-backed chat pub/sub layer. Do not add API replicas before both are in place.
