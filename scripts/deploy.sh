#!/usr/bin/env bash
# RCS Production Deployer — builds locally and deploys to the VPS via rsync.
# Runs on your local Mac.
set -euo pipefail

VPS_HOST="198.177.123.151"
VPS_USER="rcs"
APP_DIR="/opt/rcs"

echo "==> [1/4] Running local tests and production build..."
npm run typecheck
npm run test
npm run build

echo "==> [2/4] Syncing files to VPS via rsync..."
rsync -avz --delete \
  --exclude 'node_modules/' \
  --exclude '.git/' \
  --exclude '.env' \
  --exclude 'confidentials/' \
  --exclude '.github/' \
  ./ "${VPS_USER}@${VPS_HOST}:${APP_DIR}/"

echo "==> [3/5] Installing dependencies on VPS..."
ssh "${VPS_USER}@${VPS_HOST}" "cd ${APP_DIR} && npm install --omit=dev --ignore-scripts"

echo "==> [4/5] Restarting PM2 processes on VPS (sequentially)..."
ssh "${VPS_USER}@${VPS_HOST}" "pm2 restart rcs-api --update-env" || true
sleep 2
ssh "${VPS_USER}@${VPS_HOST}" "pm2 restart rcs-web --update-env" || true

echo "==> [5/5] Syncing Nginx config (requires sudo)..."
scp scripts/nginx-sites.conf "${VPS_USER}@${VPS_HOST}:/tmp/nginx-sites.conf"
ssh "${VPS_USER}@${VPS_HOST}" "sudo -n cp /tmp/nginx-sites.conf /etc/nginx/sites-enabled/default && sudo -n nginx -t && sudo -n systemctl reload nginx" 2>/dev/null && echo "    Nginx reloaded." || echo "    ⚠ Nginx update skipped (sudo password required). Run manually on VPS."

echo "==> Deployment completed successfully!"
