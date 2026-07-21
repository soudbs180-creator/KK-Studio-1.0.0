import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
// 中文注释：仅扫描 apps、packages 和 tests 目录，根目录的 src 已被收敛
const sourceRoots = ["apps", "packages", "tests"];
const supportedExtensions = [".ts", ".tsx", ".mts", ".cts"];

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

function assertMigrationAllowlistIsEmpty() {
  const registry = readJson("docs/architecture/MIGRATION_ALLOWLIST_REGISTRY.json");
  if ((registry.serviceAppImports || []).length > 0 || (registry.legacyZoneModuleImports || []).length > 0) {
    throw new Error("[architecture:check] migration allowlists must stay empty after old runtimes are retired.");
  }
}

assertMigrationAllowlistIsEmpty();

function walkDirectory(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDirectory(path.relative(root, absolutePath)));
      continue;
    }

    if (supportedExtensions.includes(path.extname(entry.name))) {
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
    if (!fs.existsSync(candidate)) continue;
    const stat = fs.statSync(candidate);
    if (stat.isFile()) {
      return toPosix(path.relative(root, candidate));
    }
  }

  return null;
}

function classifyFile(relativePath) {
  const normalizedPath = toPosix(relativePath);

  const webModuleMatch = normalizedPath.match(/^apps\/web\/src\/modules\/([^/]+)\//);
  if (webModuleMatch) {
    return {
      kind: "web-module",
      app: "web",
      moduleName: webModuleMatch[1],
      normalizedPath,
    };
  }

  if (normalizedPath.startsWith("apps/web/src/")) {
    return { kind: "web-app", app: "web", normalizedPath };
  }

  if (normalizedPath.startsWith("packages/contracts/src/")) {
    return { kind: "contracts-package", normalizedPath };
  }

  if (normalizedPath.startsWith("packages/domain/src/")) {
    return { kind: "domain-package", normalizedPath };
  }

  if (normalizedPath.startsWith("src/")) {
    return { kind: "legacy-src", normalizedPath };
  }

  if (normalizedPath.startsWith("tests/")) {
    return { kind: "test-file", normalizedPath };
  }

  return { kind: "other", normalizedPath };
}

function classifyTarget(relativePath) {
  const normalizedPath = toPosix(relativePath);
  const webModuleMatch = normalizedPath.match(/^apps\/web\/src\/modules\/([^/]+)\//);
  if (webModuleMatch) {
    return { kind: "web-module-target", moduleName: webModuleMatch[1], normalizedPath };
  }

  if (normalizedPath.startsWith("apps/web/src/")) {
    return { kind: "web-app-target", normalizedPath };
  }

  if (normalizedPath.startsWith("packages/contracts/src/")) {
    return { kind: "contracts-package-target", normalizedPath };
  }

  if (normalizedPath.startsWith("packages/domain/src/")) {
    return { kind: "domain-package-target", normalizedPath };
  }

  if (normalizedPath.startsWith("packages/shared/src/")) {
    return { kind: "shared-package-target", normalizedPath };
  }

  if (normalizedPath.startsWith("packages/ui/")) {
    return { kind: "ui-package-target", normalizedPath };
  }

  if (normalizedPath.startsWith("src/")) {
    return { kind: "legacy-src-target", normalizedPath };
  }

  return { kind: "other-target", normalizedPath };
}

function getPackageName(normalizedPath) {
  const packageMatch = normalizedPath.match(/^packages\/([^/]+)\//);
  return packageMatch ? packageMatch[1] : null;
}

function isPackagePublicEntry(normalizedPath) {
  return /^packages\/[^/]+\/src\/index\.(?:ts|tsx|mts|cts)$/.test(normalizedPath);
}

function fail(filePath, specifier, reason) {
  failures.push(`${filePath} -> ${specifier}: ${reason}`);
}

function checkWebFile(source, target, specifier) {
  if (target.kind === "legacy-src-target") {
    fail(source.normalizedPath, specifier, "web code must not import retired root src/* implementation files");
  }
}

function checkContractsPackage(source, target, specifier) {
  if (
    target.kind === "web-app-target" ||
    target.kind === "domain-package-target" ||
    target.kind === "shared-package-target" ||
    target.kind === "ui-package-target"
  ) {
    fail(source.normalizedPath, specifier, "contracts package must stay independent from apps and sibling packages");
  }
}

function checkDomainPackage(source, target, specifier) {
  if (
    target.kind === "web-app-target" ||
    target.kind === "contracts-package-target" ||
    target.kind === "ui-package-target"
  ) {
    fail(source.normalizedPath, specifier, "domain package must stay independent from apps, contracts, and ui");
  }
}

const files = sourceRoots.flatMap((relativeDir) => walkDirectory(relativeDir));

for (const file of files) {
  const fileContent = fs.readFileSync(file, "utf8");
  const imports = readImports(fileContent);
  const source = classifyFile(path.relative(root, file));

  for (const specifier of imports) {
    const resolvedTargetPath = resolveRepoImport(file, specifier);
    if (!resolvedTargetPath) continue;

    const target = classifyTarget(resolvedTargetPath);
    const sourcePackageName = getPackageName(source.normalizedPath);
    const targetPackageName = getPackageName(target.normalizedPath);

    if (
      targetPackageName
      && sourcePackageName !== targetPackageName
      && !isPackagePublicEntry(target.normalizedPath)
    ) {
      fail(
        source.normalizedPath,
        specifier,
        `package consumers must import ${targetPackageName} through its public index entrypoint, not ${target.normalizedPath}`,
      );
      continue;
    }

    if (source.kind === "web-app" || source.kind === "web-module") {
      checkWebFile(source, target, specifier);
      continue;
    }

    if (source.kind === "contracts-package") {
      checkContractsPackage(source, target, specifier);
      continue;
    }

    if (source.kind === "domain-package") {
      checkDomainPackage(source, target, specifier);
      continue;
    }

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
    `[architecture:check] Import boundaries passed with ${allowlistedDebt.length} allowlisted migration exceptions.`,
  );
  for (const item of allowlistedDebt) {
    console.log(`[architecture:check] allowlisted transitional import: ${item}`);
  }
}

console.log("[architecture:check] Import boundaries satisfy the current modular architecture rules.");
