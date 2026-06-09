import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import JSZip from "jszip";

const rootDir = process.cwd();
const releaseManifestPath = path.join(rootDir, "config", "release-manifest.json");
const portableBundleDir = path.join(rootDir, "release", "KK-Studio-Portable");
const portableAppManifestPath = path.join(portableBundleDir, "app", "dist", "app-version.json");

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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  ensureExists(releaseManifestPath, "config/release-manifest.json was not found.");
  ensureExists(portableBundleDir, "release/KK-Studio-Portable was not found. Run npm run package:portable first.");
  ensureExists(portableAppManifestPath, "release/KK-Studio-Portable/app/dist/app-version.json was not found. Run npm run package:portable first.");

  const releaseManifest = readJson(releaseManifestPath);
  const portableAppManifest = readJson(portableAppManifestPath);
  const publishDir = path.join(rootDir, "release", "publish", options.channel);
  const publishManifestPath = path.join(publishDir, "manifest.json");
  const existingPublishManifest = fs.existsSync(publishManifestPath) ? readJson(publishManifestPath) : null;

  const serverEnvPath = path.join(portableBundleDir, "app", "server", ".env");
  if (fs.existsSync(serverEnvPath)
    && !options.allowServerEnv
    && process.env.KK_STUDIO_ALLOW_PORTABLE_SERVER_ENV !== "1") {
    throw new Error("Portable bundle still contains app/server/.env. Remove it or pass --allow-server-env.");
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl || process.env.KK_PORTABLE_PUBLISH_BASE_URL || deriveBaseUrlFromManifest(existingPublishManifest));
  if (!baseUrl) {
    throw new Error("Missing portable publish base URL. Pass --base-url or set KK_PORTABLE_PUBLISH_BASE_URL.");
  }

  const archiveName = `KK-Studio-Portable-${releaseManifest.version}.zip`;
  const archivePath = path.join(publishDir, archiveName);

  const zip = new JSZip();
  await addDirectoryToZip(zip, portableBundleDir);
  const archiveBuffer = await zip.generateAsync({
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    type: "nodebuffer",
  });

  await fs.promises.mkdir(publishDir, { recursive: true });
  await fs.promises.writeFile(archivePath, archiveBuffer);

  const manifestPayload = {
    appName: portableAppManifest.appName || "KK Studio",
    version: releaseManifest.version,
    displayVersion: releaseManifest.displayVersion,
    buildTime: portableAppManifest.buildTime ?? null,
    releaseDate: releaseManifest.releaseDate,
    releaseNotes: releaseManifest.releaseNotes || [],
    channel: options.channel,
    packageFile: archiveName,
    downloadUrl: `${baseUrl}/${archiveName}`,
    sha256: createHash("sha256").update(archiveBuffer).digest("hex"),
    size: archiveBuffer.byteLength,
  };

  await fs.promises.writeFile(`${publishManifestPath}`, `${JSON.stringify(manifestPayload, null, 2)}\n`, "utf8");

  process.stdout.write([
    `Portable archive published: ${archivePath}`,
    `Portable manifest updated: ${publishManifestPath}`,
    `Download URL: ${manifestPayload.downloadUrl}`,
  ].join("\n") + "\n");
}

main().catch((error) => {
  process.stderr.write(`Portable publish failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
