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
  const apiService = "deploy/systemd/kk-api.service";
  const paymentService = "deploy/systemd/kk-payment-sidecar.service";
  const nginxConfig = "deploy/nginx/kk-vps-gateway.conf";
  const postgresBootstrap = "scripts/postgres/bootstrap-kk-vps.sql";

  [
    bootstrapScript,
    deployScript,
    apiEnv,
    apiService,
    paymentService,
    nginxConfig,
    postgresBootstrap,
  ].forEach((relativePath) => {
    assert.equal(existsSync(path.join(ROOT_DIR, relativePath)), true, `${relativePath} should exist`);
  });

  const bootstrapSource = readSource(bootstrapScript);
  assert.match(bootstrapSource, /apt-get install -y[\s\S]*nginx/);
  assert.match(bootstrapSource, /apt-get install -y[\s\S]*postgresql/);
  assert.match(bootstrapSource, /deploy\/systemd\/\*\.service/);
  assert.match(readSource(deployScript), /npm run admin:build/);
  assert.match(readSource(deployScript), /bootstrap-kk-vps\.sql/);
  assert.match(readSource(apiService), /kk-api\.env/);
  assert.match(readSource(apiService), /scripts\/run-api-vps\.mjs/);
  assert.match(readSource(paymentService), /kk-payment-sidecar\.env/);
  assert.match(readSource(paymentService), /scripts\/run-payment-sidecar-vps\.mjs/);
  assert.match(readSource(nginxConfig), /127\.0\.0\.1:3001/);
  assert.match(readSource(nginxConfig), /127\.0\.0\.1:8080/);
});
