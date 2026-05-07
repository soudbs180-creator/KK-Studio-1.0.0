import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("VPS bootstrap and deploy assets exist for the postgres-first runtime", () => {
  const bootstrapScript = "scripts/vps/bootstrap-kk-vps.sh";
  const deployScript = "scripts/vps/deploy-kk-vps.sh";
  const apiEnv = "scripts/vps/kk-vps.env.example";
  const webEnv = "scripts/vps/kk-web.env.example";
  const adminWebEnv = "scripts/vps/kk-admin.env.example";
  const apiService = "deploy/systemd/kk-api.service";
  const paymentService = "deploy/systemd/kk-payment-sidecar.service";
  const nginxConfig = "deploy/nginx/kk-vps-gateway.conf";
  const postgresBootstrap = "scripts/postgres/bootstrap-kk-vps.sql";

  [
    bootstrapScript,
    deployScript,
    apiEnv,
    webEnv,
    adminWebEnv,
    apiService,
    paymentService,
    nginxConfig,
    postgresBootstrap,
  ].forEach((relativePath) => {
    assert.equal(existsSync(path.join(ROOT_DIR, relativePath)), true, `${relativePath} should exist`);
  });

  const bootstrapSource = readSource(bootstrapScript);
  const apiEnvSource = readSource(apiEnv);
  assert.match(bootstrapSource, /apt-get install -y[\s\S]*nginx/);
  assert.match(bootstrapSource, /apt-get install -y[\s\S]*postgresql/);
  assert.match(bootstrapSource, /deploy\/systemd\/\*\.service/);
  assert.match(readSource(deployScript), /npm run admin:build/);
  assert.match(readSource(deployScript), /bootstrap-kk-vps\.sql/);
  assert.match(apiEnvSource, /TURNSTILE_SECRET_KEY=/);
  assert.match(apiEnvSource, /KK_AUTH_REQUIRE_TURNSTILE=/);
  assert.match(readSource(webEnv), /VITE_KK_API_BASE_URL=/);
  assert.match(readSource(webEnv), /VITE_KK_ADMIN_URL=/);
  assert.match(readSource(adminWebEnv), /VITE_KK_ADMIN_API_BASE_URL=/);
  assert.match(readSource(apiService), /kk-api\.env/);
  assert.match(readSource(apiService), /scripts\/run-api-vps\.mjs/);
  assert.match(readSource(paymentService), /kk-payment-sidecar\.env/);
  assert.match(readSource(paymentService), /scripts\/run-payment-sidecar-vps\.mjs/);
  assert.match(readSource(nginxConfig), /127\.0\.0\.1:3001/);
  assert.match(readSource(nginxConfig), /127\.0\.0\.1:8080/);
});

test("VPS default web entry serves the main login app while admin stays separate", () => {
  const deploySource = readSource("scripts/vps/deploy-kk-vps.sh");
  const bootstrapSource = readSource("scripts/vps/bootstrap-kk-vps.sh");
  const nginxSource = readSource("deploy/nginx/kk-vps-gateway.conf");

  assert.match(deploySource, /APP_SITE_ROOT="\$\{KK_APP_SITE_ROOT:-\/var\/www\/kk-app\}"/);
  assert.match(deploySource, /WEB_ENV_FILE="\$\{KK_WEB_ENV_FILE:-\$ENV_DIR\/kk-web\.env\}"/);
  assert.match(deploySource, /ADMIN_ENV_FILE="\$\{KK_ADMIN_ENV_FILE:-\$ENV_DIR\/kk-admin\.env\}"/);
  assert.match(deploySource, /install -m 0644 "\$\{CURRENT_DIR\}\/deploy\/nginx\/kk-vps-gateway\.conf" \/etc\/nginx\/sites-available\/kk-vps-gateway\.conf/);
  assert.match(deploySource, /ln -sf \/etc\/nginx\/sites-available\/kk-vps-gateway\.conf \/etc\/nginx\/sites-enabled\/kk-vps-gateway\.conf/);
  assert.match(deploySource, /rm -f \/etc\/nginx\/sites-enabled\/kk-api\.conf/);
  assert.match(deploySource, /rm -f \/etc\/nginx\/sites-enabled\/kk-admin-4174\.conf/);
  assert.match(deploySource, /nginx -t/);
  assert.match(bootstrapSource, /rm -f \/etc\/nginx\/sites-enabled\/kk-api\.conf/);
  assert.match(bootstrapSource, /rm -f \/etc\/nginx\/sites-enabled\/kk-admin-4174\.conf/);
  assert.match(deploySource, /rsync -a --delete "\$\{CURRENT_DIR\}\/dist\/" "\$\{APP_SITE_ROOT\}\/"/);
  assert.match(deploySource, /rsync -a --delete "\$\{CURRENT_DIR\}\/apps\/admin\/dist\/" "\$\{ADMIN_SITE_ROOT\}\/"/);
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
  assert.match(nginxSource, /server_name api\.example\.com;[\s\S]*location \/payment\/ \{\s*proxy_pass http:\/\/kk_payment_upstream\/payment\/;/);
  assert.match(nginxSource, /server_name api\.example\.com;[\s\S]*location \/internal\/ \{\s*proxy_pass http:\/\/kk_payment_upstream\/internal\/;/);
  assert.ok(
    nginxSource.indexOf("server_name _ app.example.com;") < nginxSource.indexOf("server_name api.example.com;"),
    "the default app server must appear before the API virtual host",
  );
});
