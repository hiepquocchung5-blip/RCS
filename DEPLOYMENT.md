# RCS Deployment Guide (VPS)

Deploys the **API** and **web** apps from **GitHub** to the agency VPS. The **RCS-CLI daemon is never deployed** — it always runs on each developer's local machine (Local-Synced Workspace paradigm).

## 🔐 Credentials

SSH user, password, and host IP live in **`confidentials/vpsinfoUSER.md`** (gitignored — it will NOT be on GitHub, keep a local/password-manager copy). Never commit that directory, never paste its contents into code, commits, logs, or chat. Read the values locally when you need them:

```bash
# look up the connection details (local eyes only)
cat confidentials/vpsinfoUSER.md
ssh <user>@<vps-ip>        # values from the file above
```

Prefer switching the VPS to SSH-key auth and disabling password login once provisioned (checklist inside the file).

## 📦 Source of truth: GitHub

The whole codebase lives on GitHub; the VPS only ever pulls from it:

```bash
# once, from your machine — publish the repo (confidentials/ is gitignored)
git remote add origin git@github.com:<you>/RCS.git
git push -u origin main

# safety check BEFORE the first push: confidentials must not be tracked
git ls-files | grep confidentials && echo "STOP — secrets tracked!" || echo "clean"
```

For a private repo, give the VPS read-only access with a **deploy key**:

```bash
# on the VPS
ssh-keygen -t ed25519 -f ~/.ssh/rcs_deploy -N ""
cat ~/.ssh/rcs_deploy.pub   # add as a read-only Deploy Key in GitHub → repo Settings
```

## 🧱 One-time VPS provisioning

Run the idempotent provisioning script as root — it creates the dedicated
deploy user **`rcs`** (no day-to-day root), installs Node 22 + pm2 + nginx +
redis + postgres + certbot, prepares `/opt/rcs`, and enables the firewall:

```bash
# from your machine (credentials: confidentials/vpsinfoUSER.md)
ssh root@<vps-ip> 'bash -s' < scripts/provision-vps.sh
```

Then switch to key-based login and lock root out:

```bash
ssh-copy-id rcs@<vps-ip>
# on the VPS: /etc/ssh/sshd_config → PermitRootLogin no, PasswordAuthentication no
# then: systemctl reload ssh
```

## 🚀 Deploy (as the `rcs` user)

```bash
# on the VPS
git clone git@github.com:<you>/RCS.git /opt/rcs && cd /opt/rcs
npm install
npm run build

# environment — set REAL secrets on the server, never in the repo
# (full variable reference: .env.example)
cat > /opt/rcs/.env <<'EOF'
NODE_ENV=production
PORT=4000
RCS_API_BASE_URL=https://api.<your-domain>
RCS_JWT_SECRET=<generate: openssl rand -hex 32>
RCS_ADMIN_EMAIL=<admin email>
RCS_ADMIN_PASSWORD=<exactly 16 chars, cryptographically generated>
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgres://rcs:<db-password>@localhost:5432/rcs
RCS_WEB_ORIGIN=https://<your-domain>
EOF

# processes
pm2 start "node apps/api/dist/index.js" --name rcs-api
pm2 start "npm run start -w apps/web" --name rcs-web
pm2 save && pm2 startup
```

Notes:

- `RCS_JWT_SECRET` **must** be set in production — the API refuses to boot with the dev default.
- The web app needs `NEXT_PUBLIC_RCS_API=https://<api-domain>` at **build** time when the API isn't on `localhost:4000`.
- The `/auth/dev-bridge-token` endpoint auto-disables when `NODE_ENV=production`.

## 🌐 Nginx reverse proxy

```nginx
server {
    server_name rcs.example.com;
    location / { proxy_pass http://127.0.0.1:3000; }
}
server {
    server_name api.rcs.example.com;
    location / {
        proxy_pass http://127.0.0.1:4000;
        # WebSocket upgrade for /chat
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Then `certbot --nginx` for TLS.

## 🔄 Updating a deployment

```bash
cd /opt/rcs && git pull && npm install && npm run build
pm2 restart rcs-api rcs-web
```
