import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
// 中文注释：仅保留 payment-server 作为遗留兼容区，下线 api 和 billing 兼容区检查
const legacyRoots = ["payment-server"];
const supportedExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".mts", ".cts"]);
const excludeSegments = new Set(["node_modules", "dist", "release", ".git"]);

const importPattern =
  /\bimport\s+(?:type\s+)?(?:[^"'`]*?\sfrom\s*)?["']([^"']+)["']|\bexport\s+(?:type\s+)?(?:[^"'`]*?\sfrom\s*)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

const failures = [];
const allowlistedDebt = [];

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function loadLegacyZoneAllowlist() {
  const registry = readJson("docs/architecture/MIGRATION_ALLOWLIST_REGISTRY.json");
  const allowlist = new Map();

  for (const entry of registry.legacyZoneModuleImports || []) {
    const source = toPosix(String(entry.source || ""));
    const targets = new Set((entry.targets || []).map((target) => toPosix(String(target))));

    if (!source) {
      throw new Error("[architecture:check] legacy-zone migration allowlist entry is missing a source path.");
    }
    if (targets.size === 0) {
      throw new Error(`[architecture:check] legacy-zone migration allowlist entry for ${source} must declare at least one target.`);
    }
    if (allowlist.has(source)) {
      throw new Error(`[architecture:check] duplicate legacy-zone migration allowlist entry for ${source}.`);
    }

    allowlist.set(source, targets);
  }

  return allowlist;
}

const legacyZoneAllowlist = loadLegacyZoneAllowlist();

function walk(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (excludeSegments.has(entry.name)) {
      continue;
    }

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

function readImports(fileContent) {
  const imports = [];
  for (const match of fileContent.matchAll(importPattern)) {
    const specifier = match[1] || match[2] || match[3];
    if (specifier) {
      imports.push(specifier);
    }
  }
  return imports;
}

function resolveRepoImport(fromFile, specifier) {
  if (specifier.startsWith("node:") || !specifier.startsWith(".")) {
    return null;
  }

  const basePath = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [basePath];

  for (const extension of supportedExtensions) {
    candidates.push(`${basePath}${extension}`);
  }

  for (const extension of supportedExtensions) {
    candidates.push(path.join(basePath, `index${extension}`));
  }

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    if (fs.statSync(candidate).isFile()) {
      return toPosix(path.relative(root, candidate));
    }
  }

  return null;
}

function isCanonicalModuleTarget(relativePath) {
  return /^apps\/(api|web|payment-sidecar)\/src\/modules\//.test(relativePath);
}

for (const file of legacyRoots.flatMap((relativeDir) => walk(relativeDir))) {
  const relativePath = toPosix(path.relative(root, file));
  const fileContent = fs.readFileSync(file, "utf8");
  const imports = readImports(fileContent);

  for (const specifier of imports) {
    const resolvedTargetPath = resolveRepoImport(file, specifier);
    if (!resolvedTargetPath || !isCanonicalModuleTarget(resolvedTargetPath)) {
      continue;
    }

    const allowlistedTargets = legacyZoneAllowlist.get(relativePath);
    if (allowlistedTargets?.has(resolvedTargetPath)) {
      allowlistedDebt.push(`${relativePath} -> ${resolvedTargetPath}`);
      continue;
    }

    failures.push(
      `${relativePath} directly imports canonical module implementation ${resolvedTargetPath}. Register it as a legacy-zone bridge or route the dependency through packages/contracts or packages/shared.`,
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
    `[architecture:check] Legacy-zone freeze passed with ${allowlistedDebt.length} allowlisted bridge exceptions.`,
  );
  for (const item of allowlistedDebt) {
    console.log(`[architecture:check] allowlisted legacy-zone bridge: ${item}`);
  }
} else {
  console.log("[architecture:check] Legacy-zone freeze passed with no bridge exceptions.");
}
