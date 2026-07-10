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

The schema exists, but the API entity repository is still in-memory. Do not consider this durable production until the PostgreSQL repository implementation is activated.

## Environment

Create `/opt/rcs/.env`, mode `600`, owned by `RCS_user:RCS_user`:

```dotenv
NODE_ENV=production
PORT=4000
RCS_API_BASE_URL=https://risecorestudio.com/api
RCS_WEB_ORIGIN=https://risecorestudio.com,https://www.risecorestudio.com
RCS_JWT_SECRET=<openssl-rand-hex-32>
RCS_GITHUB_WEBHOOK_SECRET=<openssl-rand-hex-32>
RCS_ADMIN_EMAIL=<admin-email>
RCS_ADMIN_PASSWORD=<exactly-16-characters>
REDIS_URL=redis://127.0.0.1:6379
DATABASE_URL=postgres://rcs_app:<password>@127.0.0.1:5432/rcs_production
```

```bash
sudo -u RCS_user env NEXT_PUBLIC_RCS_API=https://risecorestudio.com/api npm run build
sudo -u RCS_user pm2 start "node apps/api/dist/index.js" --name rcs-api
sudo -u RCS_user pm2 start "npm run start -w apps/web" --name rcs-web
sudo -u RCS_user pm2 save
pm2 startup systemd -u RCS_user --hp /home/RCS_user
```

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
sudo -u RCS_user env NEXT_PUBLIC_RCS_API=https://risecorestudio.com/api npm run build
sudo -u RCS_user pm2 restart rcs-api rcs-web --update-env
```

Record `git rev-parse HEAD` before every update. Roll back by checking out that revision, rebuilding and restarting both services.
