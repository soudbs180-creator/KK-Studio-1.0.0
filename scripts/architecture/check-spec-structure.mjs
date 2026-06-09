import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredPaths = [
  "docs/specs/project-spec.md",
  "docs/specs/openapi.yaml",
  "docs/specs/data-spec.md",
  "docs/specs/current-state-inventory.md",
  "apps/web/package.json",
  "apps/mobile/package.json",
  "packages/shared/src/index.ts",
  "packages/api-client/package.json",
  "packages/ui/src/index.ts",
  "scripts/postgres/bootstrap-kk-vps.sql",
  "tests/unit/README.md",
  "tests/contract/README.md",
  "tests/e2e/README.md",
];

const requiredMarkers = [
  {
    file: "docs/specs/project-spec.md",
    includes: ["模块化单体", "MVC", "typed client", "server/"],
  },
  {
    file: "docs/specs/openapi.yaml",
    includes: ["openapi: 3.1.0", "/api/v1/generation-tasks", "/payment/v1/orders"],
  },
  {
    file: "docs/specs/data-spec.md",
    includes: ["credit_ledger", "generation_tasks", "payment_orders", "RLS"],
  },
];

function fail(message) {
  console.error(`[spec:check] ${message}`);
  process.exitCode = 1;
}

for (const relativePath of requiredPaths) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    fail(`Missing required path: ${relativePath}`);
  }
}

for (const marker of requiredMarkers) {
  const fullPath = path.join(root, marker.file);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, "utf8");
  for (const token of marker.includes) {
    if (!content.includes(token)) {
      fail(`Missing marker "${token}" in ${marker.file}`);
    }
  }
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}

console.log("[spec:check] Architecture specification scaffold is present.");
