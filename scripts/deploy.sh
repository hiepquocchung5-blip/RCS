#!/usr/bin/env bash
# RCS Production Deployer — syncs latest changes and deploys to the VPS.
set -euo pipefail

VPS_HOST="198.177.123.151"
VPS_USER="RCS_user"
APP_DIR="/opt/rcs"

echo "==> [1/4] Running local tests..."
npm run typecheck
npm run test

echo "==> [2/4] Syncing files to VPS via SSH tar..."
tar --exclude='node_modules' --exclude='.git' --exclude='.next' --exclude='dist' -czf - . | \
  ssh -i ~/.ssh/id_ed25519 -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no "root@${VPS_HOST}" \
  "tar -xzf - -C ${APP_DIR} && chown -R ${VPS_USER}:${VPS_USER} ${APP_DIR}"

echo "==> [3/4] Installing dependencies and building on VPS..."
ssh -i ~/.ssh/id_ed25519 -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no "root@${VPS_HOST}" \
  "sudo -u ${VPS_USER} bash -c 'export PATH=\$PATH:/usr/bin; cd ${APP_DIR} && npm ci && env NEXT_PUBLIC_RCS_API=https://risecorestudio.com/api NEXT_PUBLIC_RCS_COOKIE_DOMAIN=risecorestudio.com npm run build && npx tsx scripts/seed-founders.ts'"

echo "==> [4/4] Restarting PM2 processes on VPS..."
ssh -i ~/.ssh/id_ed25519 -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no "root@${VPS_HOST}" \
  "sudo -u ${VPS_USER} bash -c 'export PATH=\$PATH:/usr/bin; cd ${APP_DIR} && pm2 restart rcs-api rcs-web --update-env'"

echo "==> Deployment completed successfully! All services online at https://risecorestudio.com"
