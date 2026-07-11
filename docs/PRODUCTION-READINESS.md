# Production Readiness

This document distinguishes implemented behavior from required production work.

## Implemented

- Strict TypeScript builds and automated domain tests.
- Role-based API middleware.
- Cryptographic credential and OTP generation.
- Fixed OTP expiry with Redis support.
- Forward-only ticket transitions.
- Project-aware chat authorization.
- CORS allow-list configuration.
- Graceful HTTP and OTP-store shutdown.
- Public/client-safe showcase projection.
- Scrypt password hashing and constant-time credential verification.
- Hashed, expiring one-time tokens with encrypted credential delivery.
- Zod validation for authentication and public client requests.
- Authentication and OTP attempt rate limits.
- HMAC verification and replay detection for GitHub webhooks.
- Request IDs, structured HTTP logs, readiness and metrics endpoints.
- HTTP-level project and ticket isolation tests.
- Global activity history restricted to Admin and PM roles.
- PostgreSQL persistence for all entities, activated at runtime via `DATABASE_URL`.
- Redis-backed rate limiting and webhook delivery deduplication (in-memory dev fallback).
- Strict CORS origin validation: exact origins plus HTTPS subdomains of `RCS_TRUSTED_DOMAIN`.
- Rate limits on login, application, OTP, magic-link and showcase-reaction endpoints.
- Durable chat history in PostgreSQL with per-socket flood protection.
- Cross-subdomain cookie sessions with a build-time configurable domain.

## Required before real client data

- Extend Zod validation to every project, ticket and administration mutation.
- Add CSRF-aware cookie sessions or document and harden the bearer-token model.
- Add backup/restore testing for PostgreSQL.
- Complete accessibility, browser and end-to-end authorization testing.

## Delivery sequence

1. Complete validation coverage and cookie-session hardening.
2. Add observability export and backup/restore tests.
3. Complete end-to-end security and permission testing.
4. Run a staging soak test followed by a controlled production launch.

No document should claim production readiness until every required item is implemented and verified.
