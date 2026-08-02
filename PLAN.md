# RCS Delivery Plan — to a fully working platform

_Last updated: 2026-07-13. This is the working plan from today's state to a
complete, verified platform. Check items off as they land; every phase ends
with the production health check from `docs/OPERATIONS.md`._

## Where the platform stands today

The subdomain split is live: the main domain serves the public site, the
delivery portal now lives on **auth.risecorestudio.com**, and the founder
ledger on **stock.risecorestudio.com**. Today's session fixed a broken
deployment (the web bundle had `localhost:4000` baked in as the API address —
`apps/web/.env.production` now bakes the real URLs into every production
build), polished the login and request pages, and redeployed. All 18 API
tests, typecheck and the production build pass.

**One step is still blocking:** nginx on the VPS still routes `auth.` and
`stock.` to the Express API instead of the web app, so the login page,
request form and stock ledger are unreachable in production until the config
is swapped (Step 0).

---

## Step 0 — apply the nginx config (blocks everything, needs sudo)

The correct config is already on the server at `/opt/rcs/scripts/nginx-sites.conf`.
Run from the Mac (sudo password required — retrieve per `confidentials/vpsinfoUSER.md`):

```bash
ssh -t rcs@198.177.123.151 'sudo cp /etc/nginx/sites-enabled/default /home/rcs/nginx-default.backup && sudo cp /opt/rcs/scripts/nginx-sites.conf /etc/nginx/sites-enabled/default && sudo nginx -t && sudo systemctl reload nginx'
```

Then verify:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://auth.risecorestudio.com/login      # expect 200
curl -s -o /dev/null -w "%{http_code}\n" https://auth.risecorestudio.com/request    # expect 200
curl -s -o /dev/null -w "%{http_code}\n" https://stock.risecorestudio.com/          # expect 200
curl -s https://api.risecorestudio.com/ready                                        # {"ok":true,...}
```

Finish with a real browser login using a founder account.

- [ ] nginx config applied and reloaded
- [ ] All four checks above pass
- [ ] Browser login on auth.risecorestudio.com works end to end

## Phase 1 — stabilize the new topology

Goal: production matches the documentation and nothing depends on a human
remembering a manual step.

- [ ] **Decide the fate of `developers.risecorestudio.com`.** The middleware
      now returns 404 for every portal path there, but nginx and the docs
      still present it as the portal. Recommended: 301-redirect the whole
      host to `auth.risecorestudio.com` in `apps/web/middleware.ts` so old
      bookmarks keep working.
- [ ] **Sync the docs to the new topology** — `docs/OPERATIONS.md` (login and
      request URLs, the auth-subdomain description), `docs/ARCHITECTURE.md`
      (auth flow note), `DEPLOYMENT.md`, `.env.example`
      (`RCS_LOGIN_REDIRECT_URL` example still points at developers.), and
      `apps/web/.env.local.example` (its `NEXT_PUBLIC_RCS_AUTH` suggestion now
      points at the web portal instead of the API — remove or correct it).
- [ ] **Harden `scripts/deploy.sh`**: fail loudly (exit non-zero) when the
      nginx step is skipped, and run the OPERATIONS.md health checks
      automatically after restart so a half-applied deploy can never look
      successful again.
- [ ] **Commit everything.** The entire new topology (middleware, stock
      pages, mail, deploy scripts, today's login/request polish and
      `apps/web/.env.production`) is uncommitted on `main`. Production is
      currently built from the working tree — until this is committed, a
      `git archive`-style deploy would silently roll the platform back.

## Phase 2 — refinements from today's review

Quality items found while reviewing; none block launch.

- [ ] **Session-aware middleware**: portal paths on the auth subdomain are
      served to anonymous visitors and only fail client-side. Check the
      `rcs_session` cookie in `apps/web/middleware.ts` and redirect to
      `/login` for a cleaner first paint.
- [ ] **Friendlier validation messages**: the API returns raw zod text
      ("Too small: expected string to have >=16 characters"). Add custom
      messages in `apps/api/src/schemas.ts` for the fields clients see
      (login, request, apply).
- [ ] **Apply-page polish**: give `apps/web/app/apply/page.tsx` the same
      treatment login and request received today (autocomplete, aria wiring,
      inline 401/429 handling, shared `fieldErrorsFrom` helper).
- [ ] **Guest id generation**: `apps/web/lib/api.ts` builds the showcase
      guest id from `Math.random()`; use `crypto.randomUUID()`.
- [ ] **Password change endpoint** — founders still cannot rotate their
      generated credentials. API route + a small settings page.
- [ ] **Session cookie exposure**: the JWT lives in a JS-readable cookie.
      Acceptable for now; revisit HttpOnly + a server-side session check when
      the portal grows.

## Phase 3 — Dev Hub roadmap (agreed earlier)

In order:

1. **Showcase OG pages** — public per-project pages with Open Graph metadata
   so shared links unfurl nicely.
2. **Developer proposals** — devs propose projects internally; admin/PM
   approve into the delivery pipeline.
3. **Chat presence** — online indicators and unread counts in the project
   chat.
4. **Telegram bot + mini app** — notifications for approvals, ticket
   transitions and new client orders; mini app for the board.

Each lands the same way: build → `npm run typecheck && npm run test &&
npm run build` → `scripts/deploy.sh` → OPERATIONS.md health check.

## Definition of "fully working"

- Every URL in `docs/OPERATIONS.md` answers with its documented status, on
  the documented host.
- A founder can log in, a client can submit a request, a candidate can apply
  and verify an OTP by email — all in production, all verified in a browser.
- `main` is committed and pushed; a fresh clone + `scripts/deploy.sh`
  reproduces production exactly.
- Docs describe the platform as it actually runs.
