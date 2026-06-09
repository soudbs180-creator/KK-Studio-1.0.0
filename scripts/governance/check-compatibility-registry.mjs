import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryPath = path.join(root, "docs", "architecture", "COMPATIBILITY_LAYER_REGISTRY.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const registeredPaths = new Set();
const registryEntriesByPath = new Map();
const failures = [];
const discoveryMatches = [];

function fail(message) {
  failures.push(`[compat:check] ${message}`);
}

for (const entry of registry.entries) {
  registeredPaths.add(entry.path);
  registryEntriesByPath.set(entry.path, entry);

  if (!entry.path || !entry.currentPurpose || !entry.upstreamCanonicalSource || !entry.removalCondition) {
    fail(`Registry entry is missing required metadata: ${JSON.stringify(entry)}`);
    continue;
  }

  if (!Array.isArray(entry.downstreamDependents) || entry.downstreamDependents.length === 0) {
    fail(`${entry.path} must list at least one downstream dependent`);
  }

  if (!Array.isArray(entry.regressionTests) || entry.regressionTests.length === 0) {
    fail(`${entry.path} must list at least one regression test`);
  }

  for (const regressionTest of entry.regressionTests || []) {
    if (typeof regressionTest !== "string" || regressionTest.trim().length === 0) {
      fail(`${entry.path} has an invalid regression test entry`);
      continue;
    }

    if (!regressionTest.startsWith("tests/")) {
      fail(`${entry.path} regression test must live under tests/: ${regressionTest}`);
      continue;
    }

    if (!fs.existsSync(path.join(root, regressionTest))) {
      fail(`${entry.path} regression test is missing: ${regressionTest}`);
    }
  }

  if (!fs.existsSync(path.join(root, entry.path))) {
    fail(`${entry.path} is registered but does not exist`);
  }
}

const includeRoots = ["apps", "packages", "server"];
const excludeSegments = new Set(["node_modules", "dist", "release", ".git", "build"]);

function hasCompatibilityMarker(relativePath) {
  const normalizedPath = relativePath.toLowerCase();
  return (
    normalizedPath.includes("legacy")
    || normalizedPath.includes("fallback")
    || normalizedPath.includes("bridge")
    || normalizedPath.includes("scaffold")
    || normalizedPath.includes(".v2")
  );
}

function walk(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return;
  }

  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (excludeSegments.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(absoluteDir, entry.name);
    const relativePath = path.relative(root, entryPath).split(path.sep).join("/");

    if (entry.isDirectory()) {
      walk(relativePath);
      continue;
    }

    if (!hasCompatibilityMarker(relativePath)) {
      continue;
    }

    discoveryMatches.push(relativePath);
    if (!registeredPaths.has(relativePath)) {
      fail(`${relativePath} matches compatibility naming patterns but is not registered`);
    }
  }
}

for (const includeRoot of includeRoots) {
  walk(includeRoot);
}

for (const registeredPath of registeredPaths) {
  const registeredEntry = registryEntriesByPath.get(registeredPath);
  const hasExplicitRegistryMarker = registeredEntry?.role === "compatibility-layer";
  if (!discoveryMatches.includes(registeredPath) && !hasExplicitRegistryMarker) {
    console.log(`[compat:check] registered compatibility layer without naming marker: ${registeredPath}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log(`[compat:check] Compatibility registry covers ${registry.entries.length} registered layers.`);
