import fs from "node:fs";
import path from "node:path";

import {
  deriveExpoReleaseMetadata,
  parseReleaseManifest,
} from "../lib/release-manifest.mjs";
import {
  assertPortablePublicationTransition,
  createPortablePublicationState,
} from "../lib/portable-publication.mjs";

function parseValidationScope(argv) {
  if (argv.length === 0) return "full";
  if (argv.length === 2 && argv[0] === "--scope" && ["source", "full"].includes(argv[1])) {
    return argv[1];
  }
  throw new Error("Usage: check-version-consistency.mjs [--scope source|full]");
}

const root = process.cwd();
let validationScope;
try {
  validationScope = parseValidationScope(process.argv.slice(2));
} catch (error) {
  console.error(`[version:check] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
const manifestPath = path.join(root, "config", "release-manifest.json");
let manifest;
try {
  manifest = parseReleaseManifest(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[version:check] Invalid config/release-manifest.json: ${message}`);
  process.exit(1);
}

const expectedVersion = manifest.releasedVersion;
const expectedArtifactVersion = manifest.artifactVersion;
const expectedDisplayVersion = manifest.displayVersion;
const expectedReleaseDate = manifest.releaseDate;
const expectedReleaseNotes = manifest.releaseNotes || [];
const releasedExpoSequence = manifest.releasePhase === "stable" ? manifest.releaseSequence : 0;
const releasedExpoMetadata = deriveExpoReleaseMetadata(
  manifest.releasedVersion,
  "stable",
  releasedExpoSequence,
  manifest.releasedVersion,
);
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

function toPackageLockTarget(packageTarget) {
  if (!packageTarget || !packageTarget.endsWith("package.json")) {
    return null;
  }

  return packageTarget === "package.json"
    ? "package-lock.json"
    : packageTarget.replace(/package\.json$/u, "package-lock.json");
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

function validatePublishedPortableState(manifestPath, publishedManifest) {
  const { envelopeHash, ...envelope } = publishedManifest;
  try {
    const expectedState = createPortablePublicationState(envelope);
    if (envelopeHash !== expectedState.envelopeHash) {
      fail(`${manifestPath} envelopeHash does not match its canonical envelope`);
    }
    const statePath = path.join(path.dirname(manifestPath), "publication-state.json");
    const storedState = readJsonIfExists(statePath);
    if (!storedState) {
      fail(`${statePath} is missing for schema v1 Portable publication`);
      return;
    }
    assertPortablePublicationTransition(storedState, envelope);
  } catch (error) {
    fail(`${manifestPath} publication state is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function comparableVersionMetadata(manifest) {
  if (!manifest) {
    return manifest;
  }

  return {
    appName: manifest.appName ?? null,
    version: manifest.version ?? null,
    releaseDate: manifest.releaseDate ?? null,
    releaseNotes: manifest.releaseNotes || [],
    channel: manifest.channel ?? null,
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const releaseManifestTarget = targets.releaseManifest || "config/release-manifest.json";
if (releaseManifestTarget !== "config/release-manifest.json") {
  fail(`versionTargets.releaseManifest must stay aligned to config/release-manifest.json, found ${releaseManifestTarget}`);
}

const rootPackage = JSON.parse(read(targets.rootPackage));
if (rootPackage.version !== expectedVersion) {
  fail(`${targets.rootPackage} version is ${rootPackage.version}, expected ${expectedVersion}`);
}

if (targets.paymentServerPackage) {
  fail("versionTargets.paymentServerPackage has been retired; use versionTargets.serverPackage for services/api/package.json");
}

const serverPackageTarget = targets.serverPackage || targets.paymentServerPackage;
if (!serverPackageTarget) {
  fail("versionTargets.serverPackage must point to services/api/package.json");
} else {
  const serverPackage = JSON.parse(read(serverPackageTarget));
  if (serverPackage.version !== expectedVersion) {
    fail(`${serverPackageTarget} version is ${serverPackage.version}, expected ${expectedVersion}`);
  }
}

for (const target of workspacePackageTargets) {
  const pkg = readJsonIfExists(target);
  if (pkg && pkg.version !== expectedVersion) {
    fail(`${target} version is ${pkg.version}, expected ${expectedVersion}`);
  }
}

const mobileAppConfigTarget = targets.mobileAppConfig || "apps/mobile/app.json";
const mobileAppConfig = readJsonIfExists(mobileAppConfigTarget);
if (mobileAppConfig?.expo) {
  if (mobileAppConfig.expo.version !== expectedVersion) {
    fail(`${mobileAppConfigTarget} expo.version is ${mobileAppConfig.expo.version}, expected ${expectedVersion}`);
  }
  if (
    typeof mobileAppConfig.expo.name !== "string"
    || !mobileAppConfig.expo.name.startsWith(manifest.appName)
  ) {
    fail(`${mobileAppConfigTarget} expo.name must start with ${manifest.appName}`);
  }
  if (mobileAppConfig.expo.runtimeVersion !== releasedExpoMetadata.runtimeVersion) {
    fail(`${mobileAppConfigTarget} expo.runtimeVersion must be ${releasedExpoMetadata.runtimeVersion}`);
  }
  if (mobileAppConfig.expo.ios?.buildNumber !== releasedExpoMetadata.ios.buildNumber) {
    fail(`${mobileAppConfigTarget} expo.ios.buildNumber must be ${releasedExpoMetadata.ios.buildNumber}`);
  }
  if (mobileAppConfig.expo.android?.versionCode !== releasedExpoMetadata.android.versionCode) {
    fail(`${mobileAppConfigTarget} expo.android.versionCode must be ${releasedExpoMetadata.android.versionCode}`);
  }
}

const openApiSpecTarget = targets.openApiSpec || "docs/specs/openapi-full.yaml";
const openApiSpec = readIfExists(openApiSpecTarget);
if (
  openApiSpec
  && !new RegExp(`^\\s+version:\\s*${escapeRegExp(expectedVersion)}\\s*$`, "m").test(openApiSpec)
) {
  fail(`${openApiSpecTarget} info.version must be ${expectedVersion}`);
}

const packageLockTargets = Array.from(new Set([
  "package-lock.json",
  "services/api/package-lock.json",
  "apps/mobile/package-lock.json",
  ...[
    targets.rootPackage,
    serverPackageTarget,
    ...workspacePackageTargets,
  ]
    .map(toPackageLockTarget)
    .filter(Boolean),
]));

for (const target of packageLockTargets) {
  const packageLock = readJsonIfExists(target);
  if (!packageLock) {
    continue;
  }

  const lockRootVersion = packageLock.packages?.[""]?.version;
  if (packageLock.version && packageLock.version !== expectedVersion) {
    fail(`${target} version is ${packageLock.version}, expected ${expectedVersion}`);
  }
  if (lockRootVersion && lockRootVersion !== expectedVersion) {
    fail(`${target} packages[""].version is ${lockRootVersion}, expected ${expectedVersion}`);
  }
}

const runtimeAppInfoTarget = targets.runtimeAppInfo || targets.webAppInfo;
const appInfoSource = runtimeAppInfoTarget ? readIfExists(runtimeAppInfoTarget) : null;
if (appInfoSource) {
  const appInfoUsesManifest = appInfoSource.includes("release-manifest.json");
  if (!appInfoUsesManifest) {
    fail(`${runtimeAppInfoTarget} must import the release manifest as the version source of truth`);
  }
  for (const [exportName, manifestExpression] of [
    ["APP_NAME", "releaseManifest.appName"],
    ["APP_VERSION", "releaseManifest.releasedVersion"],
    ["APP_DISPLAY_VERSION", "releaseManifest.displayVersion"],
    ["APP_RELEASE_TARGET", "releaseManifest.releaseTarget"],
    ["APP_RELEASE_PHASE", "releaseManifest.releasePhase"],
    ["APP_RELEASE_SEQUENCE", "releaseManifest.releaseSequence"],
    ["APP_ARTIFACT_VERSION", "releaseManifest.artifactVersion"],
    ["APP_RELEASE_DATE", "releaseManifest.releaseDate"],
    ["APP_RELEASE_NOTES", "releaseManifest.releaseNotes"],
  ]) {
    if (!appInfoSource.includes(`export const ${exportName} = ${manifestExpression};`)) {
      fail(`${runtimeAppInfoTarget} must derive ${exportName} from ${manifestExpression}`);
    }
  }
}

const checkTargets = [targets.readme, targets.sessionHandoff, targets.progressReport].filter(Boolean);
for (const target of checkTargets) {
  const source = readIfExists(target);
  if (source && !source.includes(expectedVersion)) {
    fail(`${target} does not mention the current version ${expectedVersion}`);
  }
}

const documentationExpectations = [];
const runtimeAppInfoPattern = new RegExp(`\`${escapeRegExp(runtimeAppInfoTarget || "")}\`[^\\n]*运行时只读导出`, "u");
if (targets.progressReport && fs.existsSync(path.join(root, targets.progressReport))) {
  documentationExpectations.push({
    path: targets.progressReport,
    requiredPatterns: [
      /`config\/release-manifest\.json`[^\n]*版本真相/u,
      runtimeAppInfoPattern,
      /`release\/publish\/stable\/manifest\.json`[^\n]*stable 发布清单/u,
    ],
  });
}
if (targets.sessionHandoff && fs.existsSync(path.join(root, targets.sessionHandoff))) {
  documentationExpectations.push({
    path: targets.sessionHandoff,
    requiredPatterns: [
      /`config\/release-manifest\.json`[^\n]*主版本源/u,
      runtimeAppInfoPattern,
      /`release\/publish\/stable\/manifest\.json`[^\n]*portable stable 发布清单/u,
    ],
  });
}

for (const { path: target, requiredPatterns } of documentationExpectations) {
  const source = read(target);
  for (const pattern of requiredPatterns) {
    if (!pattern.test(source)) {
      fail(`${target} is missing required version-governance statement ${pattern}`);
    }
  }
  expectNoRegex(target, /mcpClient\.js/u, `${target} still references a deleted runtime mcpClient.js file`);
}

const distManifestPath = "apps/web/dist/app-version.json";
const distManifest = readJsonIfExists(distManifestPath);
if (distManifest) {
  if (distManifest.schemaVersion !== 1 || distManifest.provenance?.kind !== "kk-studio-web-build") {
    fail(`${distManifestPath} must identify schema v1 kk-studio-web-build provenance`);
  }
  if (distManifest.version !== expectedVersion) {
    fail(`${distManifestPath} version is ${distManifest.version}, expected ${expectedVersion}`);
  }
  if (distManifest.releasedVersion !== expectedVersion) {
    fail(`${distManifestPath} releasedVersion is ${distManifest.releasedVersion}, expected ${expectedVersion}`);
  }
  if (distManifest.releaseTarget !== manifest.releaseTarget) {
    fail(`${distManifestPath} releaseTarget is ${distManifest.releaseTarget}, expected ${manifest.releaseTarget}`);
  }
  if (distManifest.releasePhase !== manifest.releasePhase) {
    fail(`${distManifestPath} releasePhase is ${distManifest.releasePhase}, expected ${manifest.releasePhase}`);
  }
  if (distManifest.releaseSequence !== manifest.releaseSequence) {
    fail(`${distManifestPath} releaseSequence is ${distManifest.releaseSequence}, expected ${manifest.releaseSequence}`);
  }
  if (distManifest.artifactVersion !== expectedArtifactVersion) {
    fail(`${distManifestPath} artifactVersion is ${distManifest.artifactVersion}, expected ${expectedArtifactVersion}`);
  }
  if (distManifest.releaseDate !== expectedReleaseDate) {
    fail(`${distManifestPath} releaseDate is ${distManifest.releaseDate}, expected ${expectedReleaseDate}`);
  }
}

const portableManifestPath = "release/KK-Studio-Portable/app/dist/app-version.json";
const portableManifest = readJsonIfExists(portableManifestPath);
if (portableManifest) {
  if (portableManifest.schemaVersion !== 1 || portableManifest.provenance?.kind !== "kk-studio-web-build") {
    fail(`${portableManifestPath} must identify schema v1 kk-studio-web-build provenance. Run npm run package:portable.`);
  }
  if (portableManifest.version !== expectedVersion) {
    fail(`${portableManifestPath} version is ${portableManifest.version}, expected ${expectedVersion}. Run npm run package:portable.`);
  }
  for (const [field, expectedValue] of [
    ["releasedVersion", expectedVersion],
    ["releaseTarget", manifest.releaseTarget],
    ["releasePhase", manifest.releasePhase],
    ["releaseSequence", manifest.releaseSequence],
    ["artifactVersion", expectedArtifactVersion],
  ]) {
    if (portableManifest[field] !== expectedValue) {
      fail(`${portableManifestPath} ${field} is ${portableManifest[field]}, expected ${expectedValue}. Run npm run package:portable.`);
    }
  }
  if (distManifest && !sameJson(comparableVersionMetadata(portableManifest), comparableVersionMetadata(distManifest))) {
    fail(`${portableManifestPath} does not match ${distManifestPath}. Run npm run package:portable.`);
  }
}

if (validationScope === "full") {
  const stablePortableManifestPath = targets.stablePortableManifest;
  const stablePortableManifest = readJsonIfExists(stablePortableManifestPath);
  if (!stablePortableManifest) {
    fail(`stablePortableManifest is missing at ${stablePortableManifestPath}`);
  } else {
    const stableArtifactVersion = stablePortableManifest.artifactVersion || stablePortableManifest.version;
    const sequenceSuffix = Number.isSafeInteger(stablePortableManifest.releaseSequence)
      ? `-s${stablePortableManifest.releaseSequence}`
      : "";
    const expectedPortableArchiveName = `KK-Studio-Portable-${stableArtifactVersion}${sequenceSuffix}.zip`;
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
    if (typeof stablePortableManifest.downloadUrl !== "string"
      || !stablePortableManifest.downloadUrl.endsWith(expectedPortableArchiveName)) {
      fail(`${stablePortableManifestPath} downloadUrl must end with ${expectedPortableArchiveName}`);
    }
    if (typeof stablePortableManifest.sha256 !== "string"
      || !/^[a-f0-9]{64}$/i.test(stablePortableManifest.sha256)) {
      fail(`${stablePortableManifestPath} sha256 must be a 64-character hexadecimal digest`);
    }
    if (!Number.isInteger(stablePortableManifest.size) || stablePortableManifest.size <= 0) {
      fail(`${stablePortableManifestPath} size must be a positive integer`);
    }
    const isLegacy161Manifest = stablePortableManifest.version === "1.6.1"
      && stablePortableManifest.schemaVersion === undefined;
    if (!isLegacy161Manifest && stablePortableManifest.schemaVersion !== 1) {
      fail(`${stablePortableManifestPath} must use the schema v1 publication envelope`);
    }
    if (stablePortableManifest.schemaVersion === 1) {
      if (stablePortableManifest.provenance?.kind !== "kk-studio-portable-publication") {
        fail(`${stablePortableManifestPath} provenance must identify the Portable publisher`);
      }
      if (manifest.releasePhase === "stable") {
        for (const [field, expectedValue] of [
          ["releasedVersion", manifest.releasedVersion],
          ["releaseTarget", manifest.releaseTarget],
          ["releasePhase", manifest.releasePhase],
          ["releaseSequence", manifest.releaseSequence],
          ["artifactVersion", manifest.artifactVersion],
          ["channel", manifest.releasePhase],
        ]) {
          if (stablePortableManifest[field] !== expectedValue) {
            fail(`${stablePortableManifestPath} ${field} is ${stablePortableManifest[field]}, expected ${expectedValue}`);
          }
        }
      }
      validatePublishedPortableState(stablePortableManifestPath, stablePortableManifest);
    }

    const portableStableVersion = portableManifest?.artifactVersion || portableManifest?.version;
    const portableStablePhase = portableManifest?.releasePhase || portableManifest?.channel;
    if (portableManifest && portableStableVersion === expectedVersion && portableStablePhase === "stable") {
      if (!sameJson(comparableVersionMetadata(stablePortableManifest), comparableVersionMetadata(portableManifest))) {
        fail(`${stablePortableManifestPath} does not match release/KK-Studio-Portable/app/dist/app-version.json for version metadata. Run npm run publish:portable after packaging.`);
      }
    }
  }
}

for (const [workspacePath, portablePath] of [
  ["scripts/release/portable-app-server.cjs", "release/KK-Studio-Portable/app/portable-app-server.cjs"],
  ["scripts/release/portable-launch.ps1", "release/KK-Studio-Portable/support/portable-launch.ps1"],
  ["scripts/release/portable-stop.ps1", "release/KK-Studio-Portable/support/portable-stop.ps1"],
  ["scripts/release/portable-self-update.ps1", "release/KK-Studio-Portable/support/portable-self-update.ps1"],
  ["scripts/lib/process-launch.ps1", "release/KK-Studio-Portable/support/process-launch.ps1"],
  ["scripts/lib/portable-update-policy.ps1", "release/KK-Studio-Portable/support/portable-update-policy.ps1"],
]) {
  const portableSource = readIfExists(portablePath);
  if (!portableSource) {
    if (portableManifest) {
      fail(`${portablePath} is missing from the packaged Portable release. Run npm run package:portable.`);
    }
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
