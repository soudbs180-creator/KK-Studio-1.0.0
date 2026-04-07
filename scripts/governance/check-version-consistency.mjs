import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "config", "release-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const expectedVersion = manifest.version;
const expectedDisplayVersion = manifest.displayVersion;
const expectedReleaseDate = manifest.releaseDate;
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

for (const target of workspacePackageTargets) {
  const pkg = JSON.parse(read(target));
  if (pkg.version !== expectedVersion) {
    fail(`${target} version is ${pkg.version}, expected ${expectedVersion}`);
  }
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

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log(`[version:check] Version metadata is aligned to ${expectedVersion}.`);
