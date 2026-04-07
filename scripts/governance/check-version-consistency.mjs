import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "config", "release-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const expectedVersion = manifest.version;
const expectedDisplayVersion = manifest.displayVersion;
const expectedReleaseDate = manifest.releaseDate;
const targets = manifest.versionTargets;

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

const rootPackage = JSON.parse(read(targets.rootPackage));
if (rootPackage.version !== expectedVersion) {
  fail(`${targets.rootPackage} version is ${rootPackage.version}, expected ${expectedVersion}`);
}

const paymentPackage = JSON.parse(read(targets.paymentServerPackage));
if (paymentPackage.version !== expectedVersion) {
  fail(`${targets.paymentServerPackage} version is ${paymentPackage.version}, expected ${expectedVersion}`);
}

const appInfoSource = read(targets.webAppInfo);
const appInfoUsesManifest = appInfoSource.includes("release-manifest.json");
if (!appInfoUsesManifest) {
  fail(`${targets.webAppInfo} must import the release manifest as the version source of truth`);
}
for (const [exportName, manifestExpression] of [
  ["APP_NAME", "releaseManifest.appName"],
  ["APP_VERSION", "releaseManifest.version"],
  ["APP_DISPLAY_VERSION", "releaseManifest.displayVersion"],
  ["APP_RELEASE_DATE", "releaseManifest.releaseDate"],
  ["APP_RELEASE_NOTES", "releaseManifest.releaseNotes"],
]) {
  if (!appInfoSource.includes(`export const ${exportName} = ${manifestExpression};`)) {
    fail(`${targets.webAppInfo} must derive ${exportName} from ${manifestExpression}`);
  }
}

for (const target of [targets.readme, targets.sessionHandoff, targets.progressReport]) {
  const source = read(target);
  if (!source.includes(expectedVersion)) {
    fail(`${target} does not mention the current version ${expectedVersion}`);
  }
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
