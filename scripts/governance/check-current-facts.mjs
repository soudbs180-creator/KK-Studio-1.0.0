import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function abs(relativePath) {
  return path.join(root, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(abs(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(abs(relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function fail(message) {
  failures.push(`[current-facts:check] ${message}`);
}

function expectFile(relativePath) {
  if (!exists(relativePath)) {
    fail(`Missing current project file or directory: ${relativePath}`);
  }
}

function expectMissing(relativePath, reason) {
  if (exists(relativePath)) {
    fail(`Legacy path must not exist: ${relativePath}. ${reason}`);
  }
}

function expectIncludes(relativePath, token, reason) {
  const source = exists(relativePath) ? read(relativePath) : "";
  if (!source.includes(token)) {
    fail(`${relativePath} must include ${JSON.stringify(token)}. ${reason}`);
  }
}

function expectNotIncludes(relativePath, token, reason) {
  const source = exists(relativePath) ? read(relativePath) : "";
  if (source.includes(token)) {
    fail(`${relativePath} must not include stale token ${JSON.stringify(token)}. ${reason}`);
  }
}

function collectFiles(relativeDir, options = {}) {
  const absoluteDir = abs(relativeDir);
  const collected = [];
  const allowedExtensions = options.allowedExtensions || new Set([".js", ".cjs", ".mjs", ".ts", ".tsx", ".json", ".md", ".sh", ".ps1"]);
  const ignoredSegments = options.ignoredSegments || new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"]);

  if (!fs.existsSync(absoluteDir)) {
    return collected;
  }

  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (ignoredSegments.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(absoluteDir, entry.name);
    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
    if (entry.isDirectory()) {
      collected.push(...collectFiles(relativePath, options));
      continue;
    }

    if (allowedExtensions.has(path.extname(entry.name))) {
      collected.push(relativePath);
    }
  }

  return collected.sort();
}

function expectActiveFilesDoNotReference(files, tokens, reason) {
  for (const file of files) {
    const source = read(file);
    for (const token of tokens) {
      if (source.includes(token)) {
        fail(`${file} must not reference ${JSON.stringify(token)}. ${reason}`);
      }
    }
  }
}

const manifest = readJson("config/release-manifest.json");
const rootPackage = readJson("package.json");
const expectedVersion = manifest.version;
const expectedDisplayVersion = manifest.displayVersion || `v${expectedVersion}`;
const expectedAppName = manifest.appName || "KK Studio";

if (rootPackage.version !== expectedVersion) {
  fail(`package.json version ${rootPackage.version} does not match release manifest ${expectedVersion}`);
}

if (!rootPackage.scripts?.["governance:current"]?.includes("check-current-facts.mjs")) {
  fail("package.json must expose governance:current so stale-current checks are runnable directly.");
}

if (!rootPackage.scripts?.["governance:check"]?.includes("governance:current")) {
  fail("package.json governance:check must include governance:current.");
}

for (const requiredPath of [
  "apps/web",
  "server",
  "packages/shared",
  "packages/api-client",
  "packages/ui",
  "migrations",
  "AGENTS.md",
  "config/release-manifest.json",
  "docs/governance/PROJECT_STATE_AND_VALIDATION.md",
]) {
  expectFile(requiredPath);
}

for (const [legacyPath, reason] of [
  ["src", "Web runtime has moved to apps/web/."],
  ["apps/admin", "Admin UI was removed from the active workspace."],
  ["apps/api", "Backend runtime is server/ Express / VPS."],
  ["apps/payment-sidecar", "Payment sidecar is not an active runtime."],
  ["billing", "Billing code must live behind current server/API boundaries."],
  ["payment-server", "Payment-server is historical and must not re-enter active runtime."],
  ["netlify/functions", "Netlify functions are historical and must not be the active backend."],
]) {
  expectMissing(legacyPath, reason);
}

for (const docPath of [
  "AGENTS.md",
  "docs/governance/PROJECT_STATE_AND_VALIDATION.md",
  "docs/README.md",
  "docs/development/session-handoff.md",
  "docs/development/progress.md",
]) {
  expectIncludes(docPath, expectedVersion, `Current version source is config/release-manifest.json (${expectedDisplayVersion}).`);
}

for (const currentFactDoc of ["AGENTS.md", "docs/governance/PROJECT_STATE_AND_VALIDATION.md"]) {
  for (const staleToken of ["v1.5.5", "KK Studio v1.5.5", "当前稳定版本：`v1.5.5`", "Project version: KK Studio v1.5.5"]) {
    expectNotIncludes(currentFactDoc, staleToken, `${currentFactDoc} is a current-fact document and cannot keep stale active assertions.`);
  }
  expectIncludes(currentFactDoc, expectedDisplayVersion, `${currentFactDoc} must state the current release line.`);
  expectIncludes(currentFactDoc, "config/release-manifest.json", `${currentFactDoc} must name the version source of truth.`);
}

expectIncludes("AGENTS.md", "apps/web/", "Current Web runtime must be explicit.");
expectIncludes("AGENTS.md", "server/", "Current backend runtime must be explicit.");
expectIncludes("docs/governance/PROJECT_STATE_AND_VALIDATION.md", "apps/web/", "Current Web runtime must be explicit.");
expectIncludes("docs/governance/PROJECT_STATE_AND_VALIDATION.md", "server/", "Current backend runtime must be explicit.");

const activeFiles = [
  "package.json",
  ...collectFiles("scripts"),
  ...collectFiles("tests"),
  ...collectFiles("apps/web"),
  ...collectFiles("packages"),
  ...collectFiles("server"),
];

expectActiveFilesDoNotReference(
  activeFiles,
  [
    "apps/api/src/server",
    "apps/api/.env",
    "apps/api/.env.local",
    "apps/api/.env.local.example",
    "payment-server",
    "netlify/functions",
  ],
  "Active code, scripts, and tests must use the current server/ backend baseline.",
);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log(`[current-facts:check] ${expectedAppName} ${expectedDisplayVersion} current-only baseline is aligned.`);
