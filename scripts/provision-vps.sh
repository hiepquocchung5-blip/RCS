#!/usr/bin/env bash
# RCS VPS provisioning — run ONCE as root on the fresh Ubuntu 24.04 server.
#
#   From your machine:
#     ssh root@<vps-ip> 'bash -s' < scripts/provision-vps.sh
#   (connection details: confidentials/vpsinfoUSER.md — never commit that file)
#
# Creates the dedicated deploy user "RCS_user", installs the runtime stack
# (Node 22, pm2, nginx, redis, postgres, certbot) and prepares /opt/rcs.
# Deterministic and idempotent — safe to re-run.
set -euo pipefail

DEPLOY_USER="${RCS_DEPLOY_USER:-RCS_user}"
APP_DIR="/opt/rcs"
PASSWORD_FILE="/root/${DEPLOY_USER}-initial-password"

echo "==> [1/6] deploy user '${DEPLOY_USER}'"
if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${DEPLOY_USER}"
  DEPLOY_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-20)"
  echo "${DEPLOY_USER}:${DEPLOY_PASSWORD}" | chpasswd
  umask 077
  printf '%s\n' "${DEPLOY_PASSWORD}" > "${PASSWORD_FILE}"
  usermod -aG sudo "${DEPLOY_USER}"
  echo "    created user '${DEPLOY_USER}' (sudo); initial password stored at ${PASSWORD_FILE}"
else
  echo "    user '${DEPLOY_USER}' already exists — skipping"
fi
mkdir -p "/home/${DEPLOY_USER}/.ssh"
touch "/home/${DEPLOY_USER}/.ssh/authorized_keys"
if [[ -s /root/.ssh/authorized_keys && ! -s "/home/${DEPLOY_USER}/.ssh/authorized_keys" ]]; then
  cp /root/.ssh/authorized_keys "/home/${DEPLOY_USER}/.ssh/authorized_keys"
fi
chmod 700 "/home/${DEPLOY_USER}/.ssh"
chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"

echo "==> [2/6] system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx redis-server postgresql certbot python3-certbot-nginx ufw git curl

echo "==> [3/6] Node.js 22 + pm2"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
npm install -g pm2 >/dev/null

echo "==> [4/6] app directory ${APP_DIR}"
mkdir -p "${APP_DIR}"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"

echo "==> [5/6] firewall (OpenSSH + nginx only)"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

echo "==> [6/6] services"
systemctl enable --now redis-server postgresql nginx >/dev/null

cat <<EOF

Provisioning done. Next steps (as documented in DEPLOYMENT.md):
  1. From your machine:  ssh-copy-id ${DEPLOY_USER}@\$(hostname -I | awk '{print \$1}')
  2. Harden /etc/ssh/sshd_config: PermitRootLogin no, PasswordAuthentication no; then: systemctl reload ssh
  3. As ${DEPLOY_USER}: clone the GitHub repo into ${APP_DIR} and follow the Deploy section.
EOF
