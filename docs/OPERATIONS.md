# RCS Operations Guide — URLs, Checks and Tests

This page lists every route of the live platform, who can use it, and the exact
commands to check that production is healthy. Written so any developer on the
team can operate the platform without asking.

## Live web pages

| URL | Page | Who |
| --- | --- | --- |
| https://risecorestudio.com/ | Landing page | Everyone |
| https://risecorestudio.com/showcase | Project gallery with reactions and views | Everyone |
| https://risecorestudio.com/about | Company story, founders and mission | Everyone |
| https://risecorestudio.com/request | Client "start a project" form | Everyone |
| https://risecorestudio.com/apply | Developer application (OTP by email) | Everyone |
| https://developers.risecorestudio.com/login | Team login | Provisioned users |
| https://developers.risecorestudio.com/portal | Delivery portal home | Logged-in team |
| https://developers.risecorestudio.com/projects | Projects, teams, milestones | Logged-in team |
| https://developers.risecorestudio.com/board | Ticket board (`todo → in_progress → review → complete`) | Logged-in team |
| https://developers.risecorestudio.com/admin | Applications, users, client orders | Admin |
| https://developers.risecorestudio.com/logs | Activity history | Admin, PM |

## API endpoints (base: `https://api.risecorestudio.com`)

| Method + path | Purpose | Access |
| --- | --- | --- |
| `GET /health` | Process is alive | Public |
| `GET /ready` | Postgres + Redis are connected | Public |
| `GET /metrics` | Prometheus metrics | Public |
| `GET /showcase` | Public project list | Public |
| `POST /showcase/:id/react` | Toggle star/like/love/fire | Public, 30 per 5 min per IP |
| `POST /orders` | Client project request | Public |
| `POST /auth/apply` | Developer application | Public, 10 per hour per IP |
| `POST /auth/verify-otp` | Confirm the 6-digit OTP (5-min expiry) | Public, 5 per 5 min |
| `GET /auth/magic/:token` | One-time credential delivery link | Public, 10 per 15 min |
| `POST /auth/login` | Login, returns JWT session | Public, 10 per 15 min |
| `GET /chat/channels` | Channels the user may join | Any logged-in user |
| `WS /chat` | Real-time chat (join with JWT; replays last 50 messages; max 5 posts per 10 s) | Team members of the channel |
| `GET/POST /projects…` | Projects, teams, tech stack, milestones | Role-checked per route |
| `GET/POST /tickets…` | Tickets and transitions | Role-checked per route |
| `GET /orders`, `POST /orders/:id/review`, `POST /orders/:id/convert` | Order pipeline | Admin, PM |
| `GET/POST /admin/…` | Applications and users | Admin only |
| `GET /logs` | Activity history | Admin, PM |
| `POST /webhooks/github` | Merged PR advances the referenced `RCS-<n>` ticket | GitHub (HMAC-signed) |

The auth subdomain `https://auth.risecorestudio.com/` serves the same `/auth/*`
routes (nginx maps it to the API's `/auth/` prefix).

## Production health check (run after every deploy)

```bash
# 1. API is alive and connected to Postgres + Redis
curl -s https://api.risecorestudio.com/ready
# expect: {"ok":true,"storage":"postgres","otp":"redis"}

# 2. Web pages answer
curl -s -o /dev/null -w "%{http_code}\n" https://risecorestudio.com/
curl -s -o /dev/null -w "%{http_code}\n" https://risecorestudio.com/showcase
curl -s -o /dev/null -w "%{http_code}\n" https://developers.risecorestudio.com/login
# expect: 200 for each

# 3. CORS protects against lookalike domains
curl -s -o /dev/null -D - -X OPTIONS https://api.risecorestudio.com/auth/login \
  -H "Origin: https://evil-risecorestudio.com" -H "Access-Control-Request-Method: POST" \
  | grep -ci "access-control-allow-origin"
# expect: 0 (blocked)
```

## Server checks (over SSH)

```bash
pm2 ls                          # both rcs-api and rcs-web must be "online"
pm2 logs rcs-api --lines 50     # recent API log
sudo systemctl status nginx     # reverse proxy
```

## Deploy procedure

Follow [DEPLOYMENT.md](../DEPLOYMENT.md). The short version: never restart
production from a build whose `npm run typecheck`, `npm run test` or
`npm run build` failed, and run the health check above immediately after
`pm2 restart`.
