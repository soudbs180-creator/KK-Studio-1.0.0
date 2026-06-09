#!/usr/bin/env bash
set -euo pipefail

API_DOMAIN="${API_DOMAIN:-api.kkai.plus}"
EXPECTED_API_IPV4="${EXPECTED_API_IPV4:-172.245.156.16}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
ACME_WEBROOT="${ACME_WEBROOT:-/var/www/letsencrypt}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/kk-vps-api-tls.conf}"
NGINX_ENABLED="${NGINX_ENABLED:-/etc/nginx/sites-enabled/kk-vps-api-tls.conf}"
CERTBOT_STAGING="${CERTBOT_STAGING:-false}"

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "[configure-kk-vps-api-tls] Please run as root on the VPS." >&2
    exit 1
  fi
}

require_real_domain() {
  if [[ -z "${API_DOMAIN}" || "${API_DOMAIN}" == "api.example.com" || "${API_DOMAIN}" == *".local" ]]; then
    echo "[configure-kk-vps-api-tls] API_DOMAIN must be a real public domain." >&2
    exit 1
  fi
}

verify_dns_points_to_vps() {
  local resolved
  resolved="$(getent ahostsv4 "${API_DOMAIN}" || true)"
  resolved="$(printf '%s\n' "${resolved}" | awk '{print $1}' | sort -u | tr '\n' ' ')"

  if ! printf '%s\n' "${resolved}" | tr ' ' '\n' | grep -Fxq "${EXPECTED_API_IPV4}"; then
    echo "[configure-kk-vps-api-tls] DNS for ${API_DOMAIN} does not include ${EXPECTED_API_IPV4}." >&2
    echo "[configure-kk-vps-api-tls] Current A records from this VPS: ${resolved:-none}" >&2
    echo "[configure-kk-vps-api-tls] Add an A record for ${API_DOMAIN} -> ${EXPECTED_API_IPV4}, wait for propagation, then rerun." >&2
    exit 1
  fi
}

install_certbot_if_missing() {
  if command -v certbot >/dev/null 2>&1; then
    return
  fi

  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y certbot
}

write_http_challenge_site() {
  install -d -m 0755 "${ACME_WEBROOT}"

  cat >"${NGINX_SITE}" <<EOF
server {
  listen 80;
  server_name ${API_DOMAIN};

  location /.well-known/acme-challenge/ {
    root ${ACME_WEBROOT};
  }

  location = /internal {
    return 404;
  }

  location / {
    return 404;
  }
}
EOF

  ln -sf "${NGINX_SITE}" "${NGINX_ENABLED}"
  nginx -t
  systemctl reload nginx
}

request_certificate() {
  local email_args=()
  local staging_args=()

  if [[ -n "${LETSENCRYPT_EMAIL}" ]]; then
    email_args=(--email "${LETSENCRYPT_EMAIL}")
  else
    email_args=(--register-unsafely-without-email)
  fi

  if [[ "${CERTBOT_STAGING}" == "true" ]]; then
    staging_args=(--staging)
  fi

  certbot certonly \
    --webroot \
    --webroot-path "${ACME_WEBROOT}" \
    --domain "${API_DOMAIN}" \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring \
    "${email_args[@]}" \
    "${staging_args[@]}"
}

write_https_site() {
  cat >"${NGINX_SITE}" <<EOF
server {
  listen 80;
  server_name ${API_DOMAIN};

  location /.well-known/acme-challenge/ {
    root ${ACME_WEBROOT};
  }

  location / {
    return 301 https://\$host\$request_uri;
  }
}

server {
  listen 443 ssl;
  http2 on;
  server_name ${API_DOMAIN};

  client_max_body_size 20m;

  ssl_certificate /etc/letsencrypt/live/${API_DOMAIN}/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/${API_DOMAIN}/privkey.pem;

  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "same-origin" always;

  location = /internal {
    return 404;
  }

  location /internal/ {
    return 404;
  }

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF

  nginx -t
  systemctl reload nginx
}

smoke_https_api() {
  curl -fsS "https://${API_DOMAIN}/healthz" >/dev/null
  curl -fsS "https://${API_DOMAIN}/api/manifest" >/dev/null
  curl -fsS "https://${API_DOMAIN}/api/v1/auth/session" >/dev/null || true
}

require_root
require_real_domain
verify_dns_points_to_vps
install_certbot_if_missing
write_http_challenge_site
request_certificate
write_https_site
smoke_https_api

echo "[configure-kk-vps-api-tls] HTTPS API gateway ready at https://${API_DOMAIN}"
