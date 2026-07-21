import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

// 中文注释：此测试验证 VPS 部署相关的构建脚本和配置文件引用正确性

const ROOT_DIR = process.cwd();



test("VPS bootstrap and deploy scripts reference the expected runtime artifacts", () => {
  const bootstrapSource = readSource("scripts/ops/vps/bootstrap-kk-vps.sh");
  const deploySource = readSource("scripts/ops/vps/deploy-kk-vps.sh");
  const envSource = readSource("scripts/ops/vps/kk-vps.env.example");
  const apiServiceSource = readSource("config/deploy/systemd/kk-api.service");
  const nginxSource = readSource("config/deploy/nginx/kk-vps.conf.legacy");
  const postgresAccessSource = readSource("scripts/ops/vps/repair-postgres-client-access.sh");

  assert.match(bootstrapSource, /bootstrap-kk-vps\.sql/);
  assert.match(bootstrapSource, /postgresql/);
  assert.match(bootstrapSource, /kk-vps\.env\.example/);
  assert.match(deploySource, /npm ci/);
  assert.match(deploySource, /npm run build/);
  assert.match(deploySource, /bootstrap-kk-vps\.sql/);
  assert.match(deploySource, /SYSTEMD_SERVICES=\("kk-api"\)/);
  assert.match(deploySource, /systemctl restart "\$\{service\}"/);
  assert.match(envSource, /DATABASE_URL=/);
  assert.match(envSource, /KK_API_SESSION_SIGNING_SECRET=/);
  assert.match(envSource, /KK_SESSION_COOKIE_SECURE=true/);
  assert.match(envSource, /KK_SESSION_COOKIE_SAME_SITE=none/);
  assert.match(envSource, /GOOGLE_OAUTH_CLIENT_ID=/);
  assert.match(envSource, /WECHAT_OPEN_APP_ID=/);
  assert.match(envSource, /STRIPE_SECRET_KEY=/);
  assert.match(envSource, /STRIPE_WEBHOOK_SECRET=/);
  assert.match(apiServiceSource, /server\/index\.js/);
  assert.match(nginxSource, /server_name app\.example\.com/);
  assert.match(nginxSource, /server_name admin\.example\.com/);
  assert.match(nginxSource, /server_name api\.example\.com/);
  assert.match(postgresAccessSource, /KK_PG_CLIENT_CIDR/);
  assert.match(postgresAccessSource, /hostssl\s+\$\{POSTGRES_DB\}\s+\$\{POSTGRES_USER\}/);
  assert.match(postgresAccessSource, /DRY_RUN/);
  assert.match(postgresAccessSource, /cp\s+-p\s+"\$\{HBA_FILE\}"/);
  assert.match(postgresAccessSource, /pg_reload_conf/);
});
