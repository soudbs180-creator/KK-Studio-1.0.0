import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";

import {
  assertStableReleaseProjection,
  parseReleaseManifest,
} from "../lib/release-manifest.mjs";
import {
  assertPortablePublicationTransition,
  createPortablePublicationState,
} from "../lib/portable-publication.mjs";
import { assertVersionConsistency } from "../lib/version-gate.mjs";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function printUsage() {
  process.stdout.write([
    "Usage: node scripts/release/publish-portable-release.mjs [--base-url <url>] [--channel <name>] [--allow-server-env]",
    "",
    "Options:",
    "  --base-url <url>        Public URL prefix for portable artifacts.",
    "  --channel <name>        Output channel under release/publish/. Default: stable.",
    "  --allow-server-env      Allow publishing a portable bundle that still contains app/server/.env.",
    "",
  ].join("\n"));
}

function parseArgs(argv) {
  const options = {
    allowServerEnv: false,
    baseUrl: "",
    channel: "stable",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--base-url":
        options.baseUrl = argv[index + 1] || "";
        index += 1;
        break;
      case "--channel":
        options.channel = argv[index + 1] || options.channel;
        index += 1;
        break;
      case "--allow-server-env":
        options.allowServerEnv = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/u, "");
}

function deriveBaseUrlFromManifest(existingManifest) {
  const downloadUrl = String(existingManifest?.downloadUrl || "").trim();
  if (!downloadUrl) {
    return "";
  }

  try {
    return downloadUrl.slice(0, downloadUrl.lastIndexOf("/"));
  } catch {
    return "";
  }
}

function ensureExists(targetPath, message) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(message);
  }
}

function assertPublishChannel(manifest, channel) {
  if (channel !== "stable") {
    throw new Error("Gate 0 supports stable Portable publication only; candidate channels are rejected.");
  }
  assertStableReleaseProjection(manifest);
}

function assertPortableBundleProvenance(manifest, portableManifest) {
  if (portableManifest.schemaVersion !== 1
    || portableManifest.provenance?.kind !== "kk-studio-web-build") {
    throw new Error(
      "Portable bundle provenance must identify a schema v1 kk-studio-web-build. Run npm run package:portable.",
    );
  }
  for (const field of [
    "releasedVersion",
    "releaseTarget",
    "releasePhase",
    "releaseSequence",
    "artifactVersion",
  ]) {
    if (portableManifest[field] !== manifest[field]) {
      throw new Error(
        `Portable bundle ${field} is ${portableManifest[field]}, expected ${manifest[field]}. Run npm run package:portable.`,
      );
    }
  }
}

function normalizePublishedEnvelope(existingManifest) {
  if (!existingManifest) return null;
  const version = existingManifest.artifactVersion || existingManifest.version;
  const channel = existingManifest.channel || existingManifest.releasePhase || "stable";
  return {
    ...existingManifest,
    schemaVersion: 1,
    provenance: { kind: "kk-studio-portable-publication" },
    version: existingManifest.version || version,
    releasedVersion: existingManifest.releasedVersion || existingManifest.version || version,
    displayVersion: existingManifest.displayVersion || `v${version}`,
    releaseTarget: existingManifest.releaseTarget || version,
    releasePhase: existingManifest.releasePhase || channel,
    releaseSequence: Number.isSafeInteger(existingManifest.releaseSequence)
      ? existingManifest.releaseSequence
      : 0,
    artifactVersion: version,
    channel,
  };
}

function readPreviousPublicationState(statePath, manifestPath) {
  if (fs.existsSync(statePath)) {
    return readJson(statePath);
  }
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  return createPortablePublicationState(normalizePublishedEnvelope(readJson(manifestPath)));
}

async function writeJsonAtomic(targetPath, value) {
  const temporaryPath = `${targetPath}.tmp-${process.pid}`;
  await fs.promises.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.promises.rename(temporaryPath, targetPath);
}

async function writeBufferAtomic(targetPath, value) {
  const temporaryPath = `${targetPath}.tmp-${process.pid}`;
  await fs.promises.writeFile(temporaryPath, value);
  await fs.promises.rename(temporaryPath, targetPath);
}

async function addDirectoryToZip(zip, absoluteDir, relativeDir = "") {
  const entries = await fs.promises.readdir(absoluteDir, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (!relativeDir && (entry.name === "logs" || entry.name === "run")) {
      continue;
    }

    const absoluteEntry = path.join(absoluteDir, entry.name);
    const relativeEntry = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    const zipPath = relativeEntry.replace(/\\/g, "/");

    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, absoluteEntry, relativeEntry);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const stat = await fs.promises.stat(absoluteEntry);
    const content = await fs.promises.readFile(absoluteEntry);
    zip.file(zipPath, content, { binary: true, date: stat.mtime });
  }
}

/** Publishes one validated stable Portable artifact and persists anti-replay state. */
export async function publishPortableRelease(options = {}) {
  // Keep this release transaction linear so archive bytes, transition checks,
  // persisted state, and the public pointer cannot be reordered accidentally.
  const rootDir = options.rootDir || process.cwd();
  const releaseManifestPath = path.join(rootDir, "config", "release-manifest.json");
  const portableBundleDir = path.join(rootDir, "release", "KK-Studio-Portable");
  const portableAppManifestPath = path.join(
    portableBundleDir,
    "app",
    "dist",
    "app-version.json",
  );
  const channel = options.channel || "stable";
  const assertSourceConsistency = options.assertSourceConsistency
    || (() => assertVersionConsistency({ context: "publish:portable", rootDir, scope: "source" }));
  const assertPostPublishConsistency = options.assertPostPublishConsistency
    || (() => assertVersionConsistency({ context: "publish:portable:post", rootDir, scope: "full" }));

  // 发布门禁：portable 发布不经 GitHub Actions，必须自行校验版本真理源一致性，
  // 否则子包 package.json 的版本漂移会被直接打进对外分发的 zip 与 manifest。
  ensureExists(releaseManifestPath, "config/release-manifest.json was not found.");
  const releaseManifest = parseReleaseManifest(readJson(releaseManifestPath));
  assertPublishChannel(releaseManifest, channel);
  assertSourceConsistency();
  ensureExists(portableBundleDir, "release/KK-Studio-Portable was not found. Run npm run package:portable first.");
  ensureExists(portableAppManifestPath, "release/KK-Studio-Portable/app/dist/app-version.json was not found. Run npm run package:portable first.");

  const portableAppManifest = readJson(portableAppManifestPath);
  assertPortableBundleProvenance(releaseManifest, portableAppManifest);
  const publishDir = path.join(rootDir, "release", "publish", channel);
  const publishManifestPath = path.join(publishDir, "manifest.json");
  const publicationStatePath = path.join(publishDir, "publication-state.json");
  const existingPublishManifest = fs.existsSync(publishManifestPath) ? readJson(publishManifestPath) : null;

  const serverEnvPath = path.join(portableBundleDir, "app", "server", ".env");
  if (fs.existsSync(serverEnvPath)
    && !options.allowServerEnv
    && process.env.KK_STUDIO_ALLOW_PORTABLE_SERVER_ENV !== "1") {
    throw new Error("Portable bundle still contains app/server/.env. Remove it or pass --allow-server-env.");
  }

  const baseUrl = normalizeBaseUrl(
    options.baseUrl
      || process.env.KK_PORTABLE_PUBLISH_BASE_URL
      || deriveBaseUrlFromManifest(existingPublishManifest),
  );
  if (!baseUrl) {
    throw new Error("Missing portable publish base URL. Pass --base-url or set KK_PORTABLE_PUBLISH_BASE_URL.");
  }

  const archiveName = [
    "KK-Studio-Portable",
    releaseManifest.artifactVersion,
    `s${releaseManifest.releaseSequence}.zip`,
  ].join("-");
  const archivePath = path.join(publishDir, archiveName);

  const zip = new JSZip();
  await addDirectoryToZip(zip, portableBundleDir);
  const archiveBuffer = await zip.generateAsync({
    compression: "DEFLATE",
    compressionOptions: { level: 1 },
    type: "nodebuffer",
  });

  const envelope = {
    schemaVersion: 1,
    provenance: { kind: "kk-studio-portable-publication" },
    appName: portableAppManifest.appName || "KK Studio",
    version: releaseManifest.artifactVersion,
    releasedVersion: releaseManifest.releasedVersion,
    displayVersion: releaseManifest.displayVersion,
    releaseTarget: releaseManifest.releaseTarget,
    releasePhase: releaseManifest.releasePhase,
    releaseSequence: releaseManifest.releaseSequence,
    artifactVersion: releaseManifest.artifactVersion,
    buildTime: portableAppManifest.buildTime ?? null,
    releaseDate: releaseManifest.releaseDate,
    releaseNotes: releaseManifest.releaseNotes || [],
    channel,
    commitSha: portableAppManifest.commitSha ?? null,
    commitShortSha: portableAppManifest.commitShortSha ?? null,
    packageFile: archiveName,
    downloadUrl: `${baseUrl}/${archiveName}`,
    sha256: createHash("sha256").update(archiveBuffer).digest("hex"),
    size: archiveBuffer.byteLength,
  };
  const previousState = readPreviousPublicationState(publicationStatePath, publishManifestPath);
  const transition = previousState
    ? assertPortablePublicationTransition(previousState, envelope)
    : { kind: "advance", state: createPortablePublicationState(envelope) };
  const manifestPayload = {
    ...envelope,
    envelopeHash: transition.state.envelopeHash,
  };

  await fs.promises.mkdir(publishDir, { recursive: true });
  await writeBufferAtomic(archivePath, archiveBuffer);
  await writeJsonAtomic(publicationStatePath, transition.state);
  await writeJsonAtomic(publishManifestPath, manifestPayload);
  assertPostPublishConsistency();

  process.stdout.write([
    `Portable archive published: ${archivePath}`,
    `Portable manifest updated: ${publishManifestPath}`,
    `Publication transition: ${transition.kind}`,
    `Download URL: ${manifestPayload.downloadUrl}`,
  ].join("\n") + "\n");
  return manifestPayload;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }
  await publishPortableRelease(options);
}

const isDirectInvocation = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectInvocation) {
  main().catch((error) => {
    process.stderr.write(`Portable publish failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
