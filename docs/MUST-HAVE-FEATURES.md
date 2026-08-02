# Must-have feature acceptance register

This register distinguishes repository implementation from production activation. A feature is **Live** only after its production dependency and acceptance check pass on `risecorestudio.com`.

| # | Capability | Repository status | Production acceptance |
|---:|---|---|---|
| 1 | Client request pipeline + Telegram handle | Implemented | Submit `/request`; confirm a persisted order |
| 2 | Non-blocking Telegram notification | Implemented | Configure bot/chat secrets; confirm delivery after HTTP 201 |
| 3 | Telegram Mini App boot | Implemented | Open from bot menu; confirm ready, expand and theme behavior |
| 4 | Interactive canvas shell | Implemented | Validate animation, reduced motion and mobile frame rate |
| 5 | Cybernetic vector brand asset | Implemented | Verify SVG at all target sizes (SVG is resolution-independent) |
| 6 | PWA offline shell | Implemented | Install PWA, disable network and reload a navigation |
| 7 | XP and rank badges | Implemented | Seed/award real XP and verify rank thresholds |
| 8 | Season 1 leaderboard | API-backed | Verify authenticated `/leaderboard` and `/board` rendering |
| 9 | Founder bot account lookup | Secure lookup implemented | Link Telegram usernames; credentials remain in the auth flow |
| 10 | Founder database seed | Implemented | Run with `DATABASE_URL` and `RCS_FOUNDERS`; rotate first-login passwords |
| 11 | Showcase device sandbox | Implemented | Test desktop/mobile modes against an approved live URL |
| 12 | Lighthouse badges | UI implemented | Replace baseline labels with CI-produced Lighthouse reports |
| 13 | Operations gauges and logs | API-backed | Verify `/operations/status` polling and PM2/VPS telemetry adapter |
| 14 | Milestone sign-off | Implemented | Sign off as an authorized client and verify audit history |
| 15 | Signed milestone certificate | Partial | Move signing to the API and persist signature metadata before production use |
| 16 | Mobile navigation dock | Implemented | Verify keyboard, safe-area and 320–430 px layouts |
| 17 | Trusted-subdomain CORS | Implemented | Confirm trusted origins pass and lookalike origins fail |
| 18 | Fast request acknowledgement | Non-blocking notification implemented | Load-test p95; database persistence still determines response latency |
| 19 | PostgreSQL storage | Implemented | Run migrations and `/ready` against the production database |
| 20 | Automated deployment | Implemented | Configure SSH/DNS/TLS and complete a tested deploy + rollback |

## Security decisions

- Telegram bot webhooks require `X-Telegram-Bot-Api-Secret-Token`.
- Bot commands never create accounts with shared passwords and never disclose passwords in chat.
- CORS accepts configured origins and exact HTTPS subdomains of the trusted apex only.
- Founder seed credentials are generated at runtime; no founder passwords live in source control.

## Remaining production gates

1. Configure DNS, TLS, PostgreSQL, Redis, SMTP, Telegram and GitHub secrets.
2. Replace display-only Lighthouse scores with artifacts emitted by CI.
3. Implement server-signed, persisted certificate records and client authorization for sign-off.
4. Connect the operations endpoint to PM2 host telemetry if per-process CPU is required.
5. Run HTTP load tests, accessibility checks, browser tests and a deployment rollback drill.
