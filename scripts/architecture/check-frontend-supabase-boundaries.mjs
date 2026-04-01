import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const roots = ["src", "apps/web/src"];
const supportedExtensions = new Set([".ts", ".tsx", ".mts", ".cts"]);

const fromPattern = /(?<!storage)\.\s*from\(\s*["']([^"']+)["']\s*\)/g;
const rpcPattern = /\.\s*rpc\(\s*["']([^"']+)["']/g;
const storagePattern = /\.storage\s*\.\s*from\(\s*(?:["']([^"']+)["']|[^)]*)\s*\)/g;

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function loadFrontendSupabaseAllowlist() {
  const registry = readJson("docs/architecture/MIGRATION_ALLOWLIST_REGISTRY.json");
  const allowlist = new Map();

  for (const entry of registry.frontendSupabaseAccess || []) {
    const entryPath = toPosix(String(entry.path || ""));
    if (!entryPath) {
      throw new Error("[architecture:check] frontend Supabase migration allowlist entry is missing a path.");
    }
    if (allowlist.has(entryPath)) {
      throw new Error(`[architecture:check] duplicate frontend Supabase migration allowlist entry for ${entryPath}.`);
    }

    allowlist.set(entryPath, {
      tables: new Set((entry.tables || []).map((table) => String(table))),
      procedures: new Set((entry.procedures || []).map((procedure) => String(procedure))),
      buckets: new Set((entry.buckets || []).map((bucket) => String(bucket))),
    });
  }

  return allowlist;
}

const transitionalAllowlist = loadFrontendSupabaseAllowlist();

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

function collectMatches(fileContent, pattern, fallbackMatch) {
  const matches = [];
  for (const match of fileContent.matchAll(pattern)) {
    if (match[1]) {
      matches.push(match[1]);
      continue;
    }

    if (fallbackMatch) {
      matches.push(fallbackMatch);
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
  const buckets = collectMatches(fileContent, storagePattern, "<dynamic>");
  const allowlistedAccess = transitionalAllowlist.get(relativePath);
  const allowedTables = allowlistedAccess?.tables || new Set();
  const allowedProcedures = allowlistedAccess?.procedures || new Set();
  const allowedBuckets = allowlistedAccess?.buckets || new Set();

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
    if (allowedProcedures.has(procedure)) {
      allowlistedDebt.push(`${relativePath} -> rpc:${procedure}`);
      continue;
    }

    failures.push(
      `${relativePath} directly calls Supabase RPC "${procedure}". Route web business logic through the API layer instead.`,
    );
  }

  for (const bucket of buckets) {
    const bucketName = bucket || "<dynamic>";
    if (allowedBuckets.has(bucketName)) {
      allowlistedDebt.push(`${relativePath} -> storage:${bucketName}`);
      continue;
    }

    failures.push(
      `${relativePath} directly accesses Supabase Storage bucket "${bucketName}". Route browser file access through the API layer instead.`,
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
