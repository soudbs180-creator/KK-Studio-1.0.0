import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("VPS bootstrap and deploy scripts reference the expected runtime artifacts", () => {
  const bootstrapSource = readSource("scripts/vps/bootstrap-kk-vps.sh");
  const deploySource = readSource("scripts/vps/deploy-kk-vps.sh");
  const envSource = readSource("scripts/vps/kk-vps.env.example");
  const apiEntrySource = readSource("scripts/run-api-vps.mjs");
  const paymentEntrySource = readSource("scripts/run-payment-sidecar-vps.mjs");
  const movedApiEntrySource = readSource("scripts/dev/run-api-vps.mjs");
  const movedPaymentEntrySource = readSource("scripts/dev/run-payment-sidecar-vps.mjs");
  const apiServiceSource = readSource("deploy/systemd/kk-api.service");
  const paymentServiceSource = readSource("deploy/systemd/kk-payment-sidecar.service");
  const nginxSource = readSource("deploy/nginx/kk-vps.conf");
  const postgresAccessSource = readSource("scripts/vps/repair-postgres-client-access.sh");

  assert.match(bootstrapSource, /bootstrap-kk-vps\.sql/);
  assert.match(bootstrapSource, /postgresql/);
  assert.match(bootstrapSource, /kk-vps\.env\.example/);
  assert.match(deploySource, /npm ci/);
  assert.match(deploySource, /npm run build/);
  assert.match(deploySource, /npm run admin:build/);
  assert.match(deploySource, /bootstrap-kk-vps\.sql/);
  assert.match(deploySource, /SYSTEMD_SERVICES=\("kk-api" "kk-payment-sidecar"\)/);
  assert.match(deploySource, /systemctl restart "\$\{service\}"/);
  assert.match(envSource, /DATABASE_URL=/);
  assert.match(envSource, /KK_API_SESSION_SIGNING_SECRET=/);
  assert.match(envSource, /KK_SESSION_COOKIE_SECURE=true/);
  assert.match(envSource, /KK_SESSION_COOKIE_SAME_SITE=lax/);
  assert.match(envSource, /GOOGLE_OAUTH_CLIENT_ID=/);
  assert.match(envSource, /WECHAT_OPEN_APP_ID=/);
  assert.match(envSource, /PAYMENT_SIDECAR_INTERNAL_TOKEN=/);
  assert.match(envSource, /PAYMENT_SIDECAR_SETTLEMENT_TOKEN=/);
  assert.match(apiEntrySource, /startApiServer/);
  assert.match(paymentEntrySource, /createPaymentSidecarServer/);
  assert.match(movedApiEntrySource, /from "\.\.\/\.\.\/apps\/api\/src\/server\.ts";/);
  assert.match(movedPaymentEntrySource, /from "\.\.\/\.\.\/apps\/payment-sidecar\/src\/server\.ts";/);
  assert.match(apiServiceSource, /scripts\/run-api-vps\.mjs/);
  assert.match(paymentServiceSource, /scripts\/run-payment-sidecar-vps\.mjs/);
  assert.match(nginxSource, /server_name app\.example\.com/);
  assert.match(nginxSource, /server_name admin\.example\.com/);
  assert.match(nginxSource, /server_name api\.example\.com/);
  assert.match(postgresAccessSource, /KK_PG_CLIENT_CIDR/);
  assert.match(postgresAccessSource, /hostssl\s+\$\{POSTGRES_DB\}\s+\$\{POSTGRES_USER\}/);
  assert.match(postgresAccessSource, /DRY_RUN/);
  assert.match(postgresAccessSource, /cp\s+-p\s+"\$\{HBA_FILE\}"/);
  assert.match(postgresAccessSource, /pg_reload_conf/);
});
