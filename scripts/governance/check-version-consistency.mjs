import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "config", "release-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const expectedVersion = manifest.version;
const expectedDisplayVersion = manifest.displayVersion;
const expectedReleaseDate = manifest.releaseDate;
const expectedReleaseNotes = manifest.releaseNotes || [];
const targets = manifest.versionTargets;
const workspacePackageTargets = targets.workspacePackages || [
  "packages/contracts/package.json",
  "packages/domain/package.json",
  "packages/shared/package.json",
];

const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readIfExists(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function readJsonIfExists(relativePath) {
  const source = readIfExists(relativePath);
  return source ? JSON.parse(source) : null;
}

function fail(message) {
  failures.push(`[version:check] ${message}`);
}

function expectRegex(relativePath, pattern, message) {
  if (!pattern.test(read(relativePath))) {
    fail(message);
  }
}

function expectNoRegex(relativePath, pattern, message) {
  if (pattern.test(read(relativePath))) {
    fail(message);
  }
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const releaseManifestTarget = targets.releaseManifest || "config/release-manifest.json";
if (releaseManifestTarget !== "config/release-manifest.json") {
  fail(`versionTargets.releaseManifest must stay aligned to config/release-manifest.json, found ${releaseManifestTarget}`);
}

const rootPackage = JSON.parse(read(targets.rootPackage));
if (rootPackage.version !== expectedVersion) {
  fail(`${targets.rootPackage} version is ${rootPackage.version}, expected ${expectedVersion}`);
}

const paymentPackage = JSON.parse(read(targets.paymentServerPackage));
if (paymentPackage.version !== expectedVersion) {
  fail(`${targets.paymentServerPackage} version is ${paymentPackage.version}, expected ${expectedVersion}`);
}

for (const target of workspacePackageTargets) {
  const pkg = JSON.parse(read(target));
  if (pkg.version !== expectedVersion) {
    fail(`${target} version is ${pkg.version}, expected ${expectedVersion}`);
  }
}

const runtimeAppInfoTarget = targets.runtimeAppInfo || targets.webAppInfo;
const appInfoSource = read(runtimeAppInfoTarget);
const appInfoUsesManifest = appInfoSource.includes("release-manifest.json");
if (!appInfoUsesManifest) {
  fail(`${runtimeAppInfoTarget} must import the release manifest as the version source of truth`);
}
for (const [exportName, manifestExpression] of [
  ["APP_NAME", "releaseManifest.appName"],
  ["APP_VERSION", "releaseManifest.version"],
  ["APP_DISPLAY_VERSION", "releaseManifest.displayVersion"],
  ["APP_RELEASE_DATE", "releaseManifest.releaseDate"],
  ["APP_RELEASE_NOTES", "releaseManifest.releaseNotes"],
]) {
  if (!appInfoSource.includes(`export const ${exportName} = ${manifestExpression};`)) {
    fail(`${runtimeAppInfoTarget} must derive ${exportName} from ${manifestExpression}`);
  }
}

for (const target of [targets.readme, targets.agentReadme, targets.sessionHandoff, targets.progressReport]) {
  const source = read(target);
  if (!source.includes(expectedVersion)) {
    fail(`${target} does not mention the current version ${expectedVersion}`);
  }
}

const documentationExpectations = [
  {
    path: targets.agentReadme,
    requiredPatterns: [
      /`config\/release-manifest\.json`[^\n]*版本真相/u,
      /`src\/config\/appInfo\.ts`[^\n]*运行时只读导出/u,
      /`release\/publish\/stable\/manifest\.json`[^\n]*stable 发布清单/u,
    ],
  },
  {
    path: targets.progressReport,
    requiredPatterns: [
      /`config\/release-manifest\.json`[^\n]*版本真相/u,
      /`src\/config\/appInfo\.ts`[^\n]*运行时只读导出/u,
      /`release\/publish\/stable\/manifest\.json`[^\n]*stable 发布清单/u,
    ],
  },
  {
    path: targets.sessionHandoff,
    requiredPatterns: [
      /`config\/release-manifest\.json`[^\n]*主版本源/u,
      /`src\/config\/appInfo\.ts`[^\n]*运行时只读导出/u,
      /`release\/publish\/stable\/manifest\.json`[^\n]*portable stable 发布清单/u,
    ],
  },
];

for (const { path: target, requiredPatterns } of documentationExpectations) {
  for (const pattern of requiredPatterns) {
    expectRegex(target, pattern, `${target} is missing required version-governance statement ${pattern}`);
  }
  expectNoRegex(target, /payment-server\/mcpClient\.js/u, `${target} still references deleted payment-server/mcpClient.js`);
}

const distManifest = readJsonIfExists("dist/app-version.json");
if (distManifest) {
  if (distManifest.version !== expectedVersion) {
    fail(`dist/app-version.json version is ${distManifest.version}, expected ${expectedVersion}`);
  }
  if (distManifest.releaseDate !== expectedReleaseDate) {
    fail(`dist/app-version.json releaseDate is ${distManifest.releaseDate}, expected ${expectedReleaseDate}`);
  }
}

const portableManifestPath = "release/KK-Studio-Portable/app/dist/app-version.json";
const portableManifest = readJsonIfExists(portableManifestPath);
if (portableManifest) {
  if (portableManifest.version !== expectedVersion) {
    fail(`${portableManifestPath} version is ${portableManifest.version}, expected ${expectedVersion}. Run npm run package:portable.`);
  }
  const normalizeManifest = (manifest) => manifest
    ? {
      ...manifest,
      buildTime: undefined,
    }
    : manifest;
  if (distManifest && JSON.stringify(normalizeManifest(portableManifest)) !== JSON.stringify(normalizeManifest(distManifest))) {
    fail(`${portableManifestPath} does not match dist/app-version.json. Run npm run package:portable.`);
  }
}

const stablePortableManifestPath = targets.stablePortableManifest;
const stablePortableManifest = JSON.parse(read(stablePortableManifestPath));
const expectedPortableArchiveName = `KK-Studio-Portable-${expectedVersion}.zip`;

if (stablePortableManifest.version !== expectedVersion) {
  fail(`${stablePortableManifestPath} version is ${stablePortableManifest.version}, expected ${expectedVersion}`);
}
if (stablePortableManifest.releaseDate !== expectedReleaseDate) {
  fail(`${stablePortableManifestPath} releaseDate is ${stablePortableManifest.releaseDate}, expected ${expectedReleaseDate}`);
}
if (!sameJson(stablePortableManifest.releaseNotes || [], expectedReleaseNotes)) {
  fail(`${stablePortableManifestPath} releaseNotes do not match config/release-manifest.json`);
}
if (stablePortableManifest.packageFile !== expectedPortableArchiveName) {
  fail(`${stablePortableManifestPath} packageFile is ${stablePortableManifest.packageFile}, expected ${expectedPortableArchiveName}`);
}
if (typeof stablePortableManifest.downloadUrl !== "string" || !stablePortableManifest.downloadUrl.endsWith(expectedPortableArchiveName)) {
  fail(`${stablePortableManifestPath} downloadUrl must end with ${expectedPortableArchiveName}`);
}
if (typeof stablePortableManifest.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(stablePortableManifest.sha256)) {
  fail(`${stablePortableManifestPath} sha256 must be a 64-character hexadecimal digest`);
}
if (!Number.isInteger(stablePortableManifest.size) || stablePortableManifest.size <= 0) {
  fail(`${stablePortableManifestPath} size must be a positive integer`);
}

if (portableManifest) {
  const comparableStablePortableManifest = {
    appName: stablePortableManifest.appName,
    version: stablePortableManifest.version,
    buildTime: stablePortableManifest.buildTime ?? null,
    releaseDate: stablePortableManifest.releaseDate ?? null,
    releaseNotes: stablePortableManifest.releaseNotes || [],
    channel: stablePortableManifest.channel ?? null,
  };
  const comparableLocalPortableManifest = {
    appName: portableManifest.appName,
    version: portableManifest.version,
    buildTime: portableManifest.buildTime ?? null,
    releaseDate: portableManifest.releaseDate ?? null,
    releaseNotes: portableManifest.releaseNotes || [],
    channel: portableManifest.channel ?? null,
  };

  if (!sameJson(comparableStablePortableManifest, comparableLocalPortableManifest)) {
    fail(`${stablePortableManifestPath} does not match release/KK-Studio-Portable/app/dist/app-version.json for version metadata. Run npm run publish:portable after packaging.`);
  }
}

for (const [workspacePath, portablePath] of [
  ["scripts/portable-app-server.cjs", "release/KK-Studio-Portable/app/portable-app-server.cjs"],
  ["scripts/portable-launch.ps1", "release/KK-Studio-Portable/support/portable-launch.ps1"],
  ["scripts/portable-stop.ps1", "release/KK-Studio-Portable/support/portable-stop.ps1"],
  ["scripts/portable-self-update.ps1", "release/KK-Studio-Portable/support/portable-self-update.ps1"],
]) {
  const portableSource = readIfExists(portablePath);
  if (!portableSource) {
    continue;
  }

  if (portableSource !== read(workspacePath)) {
    fail(`${portablePath} is stale compared with ${workspacePath}. Run npm run package:portable.`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log(`[version:check] Version metadata is aligned to ${expectedVersion}.`);
