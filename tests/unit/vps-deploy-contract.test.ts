import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

// 中文注释：此测试验证 VPS 部署契约与静态文件的正确性

const ROOT_DIR = process.cwd();



test("VPS bootstrap and deploy assets exist for the postgres-first runtime", () => {
  const bootstrapScript = "scripts/vps/bootstrap-kk-vps.sh";
  const deployScript = "scripts/vps/deploy-kk-vps.sh";
  const apiEnv = "scripts/vps/kk-vps.env.example";
  const webEnv = "scripts/vps/kk-web.env.example";
  const adminWebEnv = "scripts/vps/kk-admin.env.example";
  const apiService = "config/deploy/systemd/kk-api.service";
  const nginxConfig = "config/deploy/nginx/kk-vps-gateway.conf";
  const postgresBootstrap = "scripts/postgres/bootstrap-kk-vps.sql";

  [
    bootstrapScript,
    deployScript,
    apiEnv,
    webEnv,
    adminWebEnv,
    apiService,
    nginxConfig,
    postgresBootstrap,
  ].forEach((relativePath) => {
    assert.equal(existsSync(path.join(ROOT_DIR, relativePath)), true, `${relativePath} should exist`);
  });

  const bootstrapSource = readSource(bootstrapScript);
  const apiEnvSource = readSource(apiEnv);
  assert.match(bootstrapSource, /apt-get install -y[\s\S]*nginx/);
  assert.match(bootstrapSource, /apt-get install -y[\s\S]*postgresql/);
  assert.match(bootstrapSource, /config\/deploy\/systemd\/\*\.service/);
  assert.match(readSource(deployScript), /bootstrap-kk-vps\.sql/);
  assert.match(apiEnvSource, /TURNSTILE_SECRET_KEY=/);
  assert.match(apiEnvSource, /KK_AUTH_REQUIRE_TURNSTILE=/);
  assert.match(apiEnvSource, /KK_SESSION_COOKIE_SECURE=true/);
  assert.match(apiEnvSource, /KK_SESSION_COOKIE_SAME_SITE=none/);
  assert.match(apiEnvSource, /STRIPE_SECRET_KEY=/);
  assert.match(apiEnvSource, /STRIPE_WEBHOOK_SECRET=/);
  assert.match(readSource(webEnv), /VITE_KK_API_BASE_URL=/);
  assert.match(readSource(webEnv), /VITE_KK_ADMIN_URL=/);
  assert.match(readSource(adminWebEnv), /VITE_KK_ADMIN_API_BASE_URL=/);
  assert.match(readSource(apiService), /kk-api\.env/);
  assert.match(readSource(apiService), /server\/index\.js/);
  assert.match(readSource(nginxConfig), /127\.0\.0\.1:3001/);
  assert.doesNotMatch(readSource(nginxConfig), /127\.0\.0\.1:8080/);
});

test("VPS default web entry serves the main login app while admin stays separate", () => {
  const attributesSource = readSource(".gitattributes");
  const deploySource = readSource("scripts/vps/deploy-kk-vps.sh");
  const bootstrapSource = readSource("scripts/vps/bootstrap-kk-vps.sh");
  const nginxSource = readSource("config/deploy/nginx/kk-vps-gateway.conf");

  assert.match(attributesSource, /scripts\/vps\/\*\.sh text eol=lf/);
  assert.match(attributesSource, /config\/deploy\/nginx\/\*\.conf text eol=lf/);
  assert.match(deploySource, /APP_SITE_ROOT="\$\{KK_APP_SITE_ROOT:-\/var\/www\/kk-app\}"/);
  assert.match(deploySource, /WEB_ENV_FILE="\$\{KK_WEB_ENV_FILE:-\$ENV_DIR\/kk-web\.env\}"/);
  assert.match(deploySource, /install -m 0644 "\$\{CURRENT_DIR\}\/config\/deploy\/nginx\/kk-vps-gateway\.conf" \/etc\/nginx\/sites-available\/kk-vps-gateway\.conf/);
  assert.match(deploySource, /ln -sf \/etc\/nginx\/sites-available\/kk-vps-gateway\.conf \/etc\/nginx\/sites-enabled\/kk-vps-gateway\.conf/);
  assert.match(deploySource, /rm -f \/etc\/nginx\/sites-enabled\/kk-api\.conf/);
  assert.match(deploySource, /rm -f \/etc\/nginx\/sites-enabled\/kk-admin-4174\.conf/);
  assert.match(deploySource, /nginx -t/);
  assert.match(deploySource, /systemctl list-unit-files "\$\{service\}\.service"/);
  assert.match(deploySource, /Skipping missing optional service/);
  assert.match(deploySource, /chgrp "\$\{APP_GROUP\}" "\$\{ENV_DIR\}\/kk-api\.env"/);
  assert.match(deploySource, /chmod 0640 "\$\{ENV_DIR\}\/kk-api\.env"/);
  assert.match(bootstrapSource, /rm -f \/etc\/nginx\/sites-enabled\/kk-api\.conf/);
  assert.match(bootstrapSource, /rm -f \/etc\/nginx\/sites-enabled\/kk-admin-4174\.conf/);
  assert.match(deploySource, /rsync -a --delete "\$\{NEW_RELEASE_DIR\}\/apps\/web\/dist\/" "\$\{NEW_APP_RELEASE_DIR\}\/"/);
  assert.match(bootstrapSource, /APP_SITE_ROOT="\$\{KK_APP_SITE_ROOT:-\/var\/www\/kk-app\}"/);
  assert.match(bootstrapSource, /"\$\{APP_SITE_ROOT\}"/);

  assert.match(nginxSource, /server_name _ app\.example\.com;/);
  assert.match(nginxSource, /root \/var\/www\/kk-app;/);
  assert.match(nginxSource, /try_files \$uri \$uri\/ \/index\.html;/);
  assert.match(nginxSource, /server_name admin\.example\.com;/);
  assert.match(nginxSource, /root \/var\/www\/kk-admin;/);
  assert.match(nginxSource, /listen 4174;/);
  assert.match(nginxSource, /server_name _ 172\.245\.156\.16;/);
  assert.match(nginxSource, /server_name api\.example\.com;/);
  assert.match(nginxSource, /location \/api\/ \{\s*proxy_pass http:\/\/kk_api_upstream\/api\/;/);
  assert.doesNotMatch(nginxSource, /kk_payment_upstream/);
  assert.doesNotMatch(nginxSource, /location \/payment\//);
  assert.match(nginxSource, /server_name api\.example\.com;[\s\S]*location \/internal\/ \{\s*return 404;/);
  assert.ok(
    nginxSource.indexOf("server_name _ app.example.com;") < nginxSource.indexOf("server_name api.example.com;"),
    "the default app server must appear before the API virtual host",
  );
});

test("VPS nginx gateway does not expose internal payment routes on public virtual hosts", () => {
  const gatewaySource = readSource("config/deploy/nginx/kk-vps-gateway.conf");
  const legacySource = readSource("config/deploy/nginx/kk-vps.conf.legacy");

  for (const [label, source] of [
    ["gateway", gatewaySource],
    ["legacy", legacySource],
  ] as const) {
    assert.doesNotMatch(
      source,
      /location\s+\/internal\/\s*\{[\s\S]*?proxy_pass\s+http:\/\/[^;]+\/internal\//,
      `${label} nginx config must not proxy public /internal/ traffic`,
    );
    assert.match(
      source,
      /location\s+\/internal\/\s*\{[\s\S]*?return\s+404;/,
      `${label} nginx config should fail closed for public /internal/ traffic`,
    );
    assert.match(
      source,
      /location\s+=\s+\/internal\s*\{[\s\S]*?return\s+404;/,
      `${label} nginx config should fail closed for the exact public /internal path`,
    );
  }
});

test("VPS API TLS helper fails fast on DNS and keeps internal routes closed", () => {
  const tlsScriptPath = "scripts/vps/configure-kk-vps-api-tls.sh";
  assert.equal(existsSync(path.join(ROOT_DIR, tlsScriptPath)), true, `${tlsScriptPath} should exist`);

  const tlsSource = readSource(tlsScriptPath);

  assert.match(tlsSource, /API_DOMAIN="\$\{API_DOMAIN:-api\.kkai\.plus\}"/);
  assert.match(tlsSource, /EXPECTED_API_IPV4="\$\{EXPECTED_API_IPV4:-172\.245\.156\.16\}"/);
  assert.match(tlsSource, /getent ahostsv4 "\$\{API_DOMAIN\}" \|\| true/);
  assert.match(tlsSource, /DNS for \$\{API_DOMAIN\} does not include \$\{EXPECTED_API_IPV4\}/);
  assert.ok(
    tlsSource.indexOf("verify_dns_points_to_vps") < tlsSource.indexOf("write_http_challenge_site"),
    "DNS verification must run before nginx ACME site changes",
  );
  assert.ok(
    tlsSource.indexOf("verify_dns_points_to_vps") < tlsSource.indexOf("request_certificate"),
    "DNS verification must run before certbot requests",
  );
  const httpChallengeSite = tlsSource.slice(
    tlsSource.indexOf("write_http_challenge_site()"),
    tlsSource.indexOf("request_certificate()"),
  );
  assert.doesNotMatch(
    httpChallengeSite,
    /proxy_pass/,
    "temporary ACME HTTP site must not expose the API before HTTPS is issued",
  );
  assert.match(httpChallengeSite, /location \/ \{[\s\S]*return 404;/);
  assert.match(tlsSource, /apt-get install -y[\s\S]*certbot/);
  assert.match(tlsSource, /certbot certonly[\s\S]*--webroot/);
  assert.match(tlsSource, /kk-vps-api-tls\.conf/);
  assert.match(tlsSource, /listen 443 ssl/);
  assert.match(tlsSource, /ssl_certificate \/etc\/letsencrypt\/live\/\$\{API_DOMAIN\}\/fullchain\.pem;/);
  assert.match(tlsSource, /proxy_pass http:\/\/127\.0\.0\.1:3001/);
  assert.match(tlsSource, /location = \/internal \{[\s\S]*return 404;/);
  assert.match(tlsSource, /location \/internal\/ \{[\s\S]*return 404;/);
  assert.match(tlsSource, /curl -fsS "https:\/\/\$\{API_DOMAIN\}\/healthz"/);
});
