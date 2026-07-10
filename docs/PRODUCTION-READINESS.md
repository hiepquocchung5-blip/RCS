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
- Initial PostgreSQL schema and repository contracts.

## Required before real client data

- Implement the PostgreSQL repository contracts and activate them at runtime; the schema and migration runner now exist, but entities still use the in-memory adapter.
- Extend Zod validation to every project, ticket and administration mutation.
- Move rate-limit counters and webhook delivery deduplication to Redis for multi-instance operation.
- Add CSRF-aware cookie sessions or document and harden the bearer-token model.
- Move browser tokens away from long-lived `localStorage` if the authentication model permits.
- Add readiness checks, structured logging, metrics and request correlation IDs.
- Add durable chat history if project communication must be retained.
- Complete accessibility, browser and end-to-end authorization testing.

## Delivery sequence

1. Complete and activate PostgreSQL repository implementations.
2. Move distributed rate-limit and webhook replay state to Redis.
3. Complete validation coverage and cookie-session hardening.
4. Add observability export, backup/restore tests and durable chat history.
5. Complete end-to-end security and permission testing.
6. Run a staging soak test followed by a controlled production launch.

No document should claim production readiness until every required item is implemented and verified.
