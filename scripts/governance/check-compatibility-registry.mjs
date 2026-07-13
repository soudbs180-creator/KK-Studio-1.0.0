import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryPath = path.join(root, "docs", "architecture", "COMPATIBILITY_LAYER_REGISTRY.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const registeredPaths = new Set();
const registeredDirectories = new Set();
const registryEntriesByPath = new Map();
const failures = [];
const discoveryMatches = [];

function fail(message) {
  failures.push(`[compat:check] ${message}`);
}

function normalizeRelativePath(relativePath) {
  return String(relativePath || "")
    .split(path.sep)
    .join("/")
    .replace(/^\.\//, "")
    .replace(/\/$/, "");
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

for (const entry of registry.entries) {
  const normalizedEntryPath = normalizeRelativePath(entry.path);
  registeredPaths.add(normalizedEntryPath);
  registryEntriesByPath.set(normalizedEntryPath, entry);

  if (!entry.path || !entry.currentPurpose || !entry.upstreamCanonicalSource || !entry.removalCondition) {
    fail(`Registry entry is missing required metadata: ${JSON.stringify(entry)}`);
    continue;
  }

  if (typeof entry.owner !== "string" || entry.owner.trim().length === 0) {
    fail(`${entry.path} must declare a non-empty owner`);
  }

  if (!isIsoDate(entry.reviewBy)) {
    fail(`${entry.path} must declare reviewBy as a valid ISO date (YYYY-MM-DD)`);
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

  const absoluteEntryPath = path.join(root, entry.path);
  if (!fs.existsSync(absoluteEntryPath)) {
    fail(`${entry.path} is registered but does not exist`);
  } else if (fs.statSync(absoluteEntryPath).isDirectory()) {
    registeredDirectories.add(normalizedEntryPath);
  }
}

const includeRoots = ["apps", "packages", "server"];
const excludeSegments = new Set(["node_modules", "dist", "release", ".git", "build"]);

function hasCompatibilityMarker(relativePath) {
  const normalizedPath = relativePath.toLowerCase();
  const pathSegments = normalizedPath.split("/");
  return (
    pathSegments.includes("compat")
    || normalizedPath.includes("legacy")
    || normalizedPath.includes("fallback")
    || normalizedPath.includes("bridge")
    || normalizedPath.includes("scaffold")
    || normalizedPath.includes(".v2")
  );
}

function isRegisteredCompatibilityPath(relativePath) {
  const normalizedPath = normalizeRelativePath(relativePath);
  if (registeredPaths.has(normalizedPath)) {
    return true;
  }

  for (const registeredDirectory of registeredDirectories) {
    if (normalizedPath.startsWith(`${registeredDirectory}/`)) {
      return true;
    }
  }

  return false;
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
    if (!isRegisteredCompatibilityPath(relativePath)) {
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
  const coversDiscoveryMatch = discoveryMatches.some((discoveredPath) => (
    discoveredPath === registeredPath
    || (registeredDirectories.has(registeredPath) && discoveredPath.startsWith(`${registeredPath}/`))
  ));
  if (!coversDiscoveryMatch && !hasExplicitRegistryMarker) {
    console.log(`[compat:check] registered compatibility layer without naming marker: ${registeredPath}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

const layerLabel = registry.entries.length === 1 ? "layer" : "layers";
const fileLabel = discoveryMatches.length === 1 ? "file" : "files";
console.log(
  `[compat:check] Compatibility registry covers ${registry.entries.length} registered ${layerLabel} and ${discoveryMatches.length} discovered compatibility ${fileLabel}.`,
);
