import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const roots = ["src", "apps/web/src"];
const supportedExtensions = new Set([".ts", ".tsx", ".mts", ".cts"]);

const fromPattern = /\.\s*from\(\s*["']([^"']+)["']\s*\)/g;
const rpcPattern = /\.\s*rpc\(\s*["']([^"']+)["']/g;

const transitionalAllowlist = new Map([
  [
    "src/context/BillingContext.tsx",
    new Set(["billing_account_snapshot_v1", "user_credits", "credit_transactions"]),
  ],
  [
    "src/services/billing/creditExchangeRateService.ts",
    new Set(["credit_exchange_rates"]),
  ],
  [
    "src/services/billing/newApiPricingService.ts",
    new Set(["provider_pricing_cache"]),
  ],
]);

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function walk(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(path.relative(root, absolutePath)));
      continue;
    }

    if (supportedExtensions.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }

  return files;
}

function collectMatches(fileContent, pattern) {
  const matches = [];
  for (const match of fileContent.matchAll(pattern)) {
    if (match[1]) {
      matches.push(match[1]);
    }
  }
  return matches;
}

const failures = [];
const allowlistedDebt = [];

for (const file of roots.flatMap((relativeDir) => walk(relativeDir))) {
  const relativePath = toPosix(path.relative(root, file));
  const fileContent = fs.readFileSync(file, "utf8");
  const tables = collectMatches(fileContent, fromPattern);
  const procedures = collectMatches(fileContent, rpcPattern);
  const allowedTables = transitionalAllowlist.get(relativePath) || new Set();

  for (const table of tables) {
    if (allowedTables.has(table)) {
      allowlistedDebt.push(`${relativePath} -> table:${table}`);
      continue;
    }

    failures.push(
      `${relativePath} directly accesses Supabase table "${table}". Route web data access through typed API/contracts instead.`,
    );
  }

  for (const procedure of procedures) {
    failures.push(
      `${relativePath} directly calls Supabase RPC "${procedure}". Route web business logic through the API layer instead.`,
    );
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[architecture:check] ${failure}`);
  }
  process.exit(1);
}

if (allowlistedDebt.length > 0) {
  console.log(
    `[architecture:check] Frontend Supabase boundary check passed with ${allowlistedDebt.length} allowlisted migration exceptions.`,
  );
  for (const item of allowlistedDebt) {
    console.log(`[architecture:check] allowlisted transitional access: ${item}`);
  }
} else {
  console.log("[architecture:check] Frontend Supabase boundary check passed with no migration exceptions.");
}
