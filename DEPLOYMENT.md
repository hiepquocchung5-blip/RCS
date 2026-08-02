# RCS Production Deployment

Target: `https://risecorestudio.com`. Nginx serves the web app and routes `/api/*` to the API.

## DNS prerequisite

```text
risecorestudio.com      A      <VPS IPv4>
www.risecorestudio.com  A      <VPS IPv4>
```

TLS cannot be issued until these records resolve. Credentials remain in `confidentials/`; never commit or print them.

## Provision

```bash
ssh root@<VPS-IP> 'bash -s' < scripts/provision-vps.sh
```

The script creates `RCS_user`, installs Node.js 22, PM2, Nginx, Redis, PostgreSQL, Certbot and Git, enables the firewall, and prepares `/opt/rcs`. The generated initial password is stored root-only at `/root/RCS_user-initial-password`. Prefer SSH keys for normal access.

## Checkout

```bash
sudo -u RCS_user git clone https://github.com/hiepquocchung5-blip/RCS.git /opt/rcs
cd /opt/rcs
npm ci
```

Use a read-only deploy key if the repository is private.

## Database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER rcs_app WITH PASSWORD '<strong-random-password>';
CREATE DATABASE rcs_production OWNER rcs_app;
SQL

sudo -u RCS_user env DATABASE_URL='postgres://rcs_app:<password>@127.0.0.1:5432/rcs_production' npm run db:migrate -w apps/api
```

When `DATABASE_URL` is set, the API persists all entities (users, projects, tickets, orders, chat history and the activity log) in PostgreSQL. Without it, the API falls back to the in-memory development adapter and data is lost on restart — never run production without `DATABASE_URL`.

## Environment

Create `/opt/rcs/.env`, mode `600`, owned by `RCS_user:RCS_user`:

```dotenv
NODE_ENV=production
PORT=4000
RCS_API_BASE_URL=https://risecorestudio.com/api
RCS_WEB_ORIGIN=https://risecorestudio.com,https://www.risecorestudio.com
RCS_TRUSTED_DOMAIN=risecorestudio.com
RCS_LOGIN_REDIRECT_URL=https://developers.risecorestudio.com/login
RCS_JWT_SECRET=<openssl-rand-hex-32>
RCS_GITHUB_WEBHOOK_SECRET=<openssl-rand-hex-32>
RCS_ADMIN_EMAIL=<admin-email>
RCS_ADMIN_PASSWORD=<exactly-16-characters>
# Founder Admin accounts — each gets a generated 16-char credential printed
# once in the API log at boot; deliver it privately and change it after first login.
RCS_FOUNDERS=Filip:filip@risecorestudio.com,Shayy:shayy@risecorestudio.com,Pai Htoo Khant:paihtookhant@risecorestudio.com
REDIS_URL=redis://127.0.0.1:6379
DATABASE_URL=postgres://rcs_app:<password>@127.0.0.1:5432/rcs_production

# SMTP configuration for verification OTP and credentials delivery
RCS_SMTP_HOST=127.0.0.1
RCS_SMTP_PORT=25
RCS_SMTP_FROM=no-reply@risecorestudio.com
# (Optional) If using remote SMTP relay:
# RCS_SMTP_USER=<user>
# RCS_SMTP_PASS=<pass>
# RCS_SMTP_SECURE=false
```

```bash
sudo -u RCS_user env \
  NEXT_PUBLIC_RCS_API=https://risecorestudio.com/api \
  NEXT_PUBLIC_RCS_COOKIE_DOMAIN=risecorestudio.com \
  npm run build
sudo -u RCS_user pm2 start ecosystem.config.cjs
sudo -u RCS_user pm2 save
pm2 startup systemd -u RCS_user --hp /home/RCS_user
```

Both processes are defined in `ecosystem.config.cjs`; do not start them with ad-hoc `pm2 start` commands.

## Nginx

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name risecorestudio.com www.risecorestudio.com;

    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

After DNS resolves:

```bash
certbot --nginx -d risecorestudio.com -d www.risecorestudio.com
```

## Update and rollback

```bash
cd /opt/rcs
sudo -u RCS_user git pull --ff-only origin main
npm ci
npm run typecheck && npm run test
sudo -u RCS_user env \
  NEXT_PUBLIC_RCS_API=https://risecorestudio.com/api \
  NEXT_PUBLIC_RCS_COOKIE_DOMAIN=risecorestudio.com \
  npm run build
sudo -u RCS_user pm2 restart rcs-api rcs-web --update-env
```

Never restart production from a build whose typecheck or tests failed.

Record `git rev-parse HEAD` before every update. Roll back by checking out that revision, rebuilding and restarting both services.

## Docker Deployment (Alternative/Recommended)

Instead of managing PM2 and manual services on the host, you can deploy using Docker and Docker Compose. This containerizes the API, Web app, PostgreSQL database, and Redis.

### 1. Install Docker on the VPS
Connect to the VPS and run:
```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com | sh

# Add the deploy user to the docker group so sudo isn't required
sudo usermod -aG docker rcs
```

### 2. Configure Environment
Create `/opt/rcs/.env` on the VPS. It will be loaded by Docker Compose automatically:
```dotenv
NODE_ENV=production
RCS_JWT_SECRET=<openssl-rand-hex-32>
RCS_GITHUB_WEBHOOK_SECRET=<openssl-rand-hex-32>
RCS_ADMIN_EMAIL=<admin-email>
RCS_ADMIN_PASSWORD=<exactly-16-characters>
RCS_FOUNDERS=Filip:filip@risecorestudio.com,Shayy:shayy@risecorestudio.com,Pai Htoo Khant:paihtookhant@risecorestudio.com
DATABASE_PASSWORD=<strong-random-db-password>
```

### 3. Deploy
```bash
cd /opt/rcs
docker compose up -d --build
```
Database migrations will automatically run inside the `rcs-api` container on boot before starting the Express API.

---

## CI/CD Pipeline

A GitHub Actions workflow is configured in `.github/workflows/deploy.yml`. On every push to the `main` branch, it runs:
1. `npm run typecheck`
2. `npm run test`
3. Connects to the VPS via SSH to pull the latest commit and runs `docker compose up -d --build`.

To enable this, configure the following secrets in your GitHub repository (`Settings -> Secrets and variables -> Actions`):
* `VPS_SSH_HOST`: The IP address of your VPS (`198.177.123.151`).
* `VPS_SSH_USER`: The deployment user (`rcs`).
* `VPS_SSH_KEY`: The contents of the private SSH key corresponding to the public key in `authorized_keys`.

---

## Staging on the same VPS (recommended)

Verify changes on the real server before the public sees them: keep a second checkout at `/opt/rcs-staging` with its own `.env` (ports `4001`/`3001`, a separate `rcs_staging` database) and a `staging.risecorestudio.com` Nginx server block pointing at those ports. Deploy there first, click through the change, then promote the same commit to `/opt/rcs`. Staging costs nothing extra and keeps mistakes away from the live domain.
