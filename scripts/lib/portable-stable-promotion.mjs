import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { parseReleaseManifest } from "./release-manifest.mjs";

const PROMOTION_SCHEMA_VERSION = 1;
const PROMOTION_KIND = "kk-studio-portable-stable-promotion";

function promotionError(field, message) {
  return new Error(`[portable-stable-promotion] ${field} ${message}`);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertDigest(field, value) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    throw promotionError(field, "must be a lowercase SHA-256 digest.");
  }
}

function assertRecordField(source, field, expected, label) {
  if (source[field] !== expected) {
    throw promotionError(`${label}.${field}`, `is ${source[field]}, expected ${expected}.`);
  }
}

function resolveContainedFile(rootDir, declaredPath, label) {
  if (typeof declaredPath !== "string" || declaredPath.trim() !== declaredPath || !declaredPath) {
    throw promotionError(label, "must be a non-empty path.");
  }
  const rootPath = fs.realpathSync(rootDir);
  const requestedPath = path.resolve(rootPath, declaredPath);
  if (!fs.existsSync(requestedPath) || !fs.statSync(requestedPath).isFile()) {
    throw promotionError(label, `does not identify an existing file: ${declaredPath}.`);
  }
  const filePath = fs.realpathSync(requestedPath);
  const relativePath = path.relative(rootPath, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw promotionError(label, "must remain inside the release workspace.");
  }
  return filePath;
}

function parseCandidateReleaseProjection(manifest) {
  try {
    return parseReleaseManifest({
      appName: manifest.appName,
      schemaVersion: manifest.schemaVersion,
      version: manifest.version,
      releasedVersion: manifest.releasedVersion,
      displayVersion: manifest.displayVersion,
      releaseTarget: manifest.releaseTarget,
      releasePhase: manifest.releasePhase,
      releaseSequence: manifest.releaseSequence,
      artifactVersion: manifest.artifactVersion,
      releaseDate: manifest.releaseDate,
      releaseNotes: manifest.releaseNotes,
      versionTargets: { releaseManifest: "config/release-manifest.json" },
    });
  } catch (error) {
    throw promotionError(
      "candidate.manifest",
      `is not a valid release projection: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function validateCandidateRecord(record, manifest, stableManifest) {
  if (manifest.schemaVersion !== 1 || manifest.provenance?.kind !== "kk-studio-web-build") {
    throw promotionError("candidate.manifest", "must be a schema v1 kk-studio-web-build.");
  }
  const candidate = parseCandidateReleaseProjection(manifest);
  if (candidate.releasePhase !== "release-candidate" || manifest.channel !== candidate.releasePhase) {
    throw promotionError("candidate.releasePhase", "must identify a release-candidate build.");
  }
  for (const field of ["releaseTarget", "releasePhase", "releaseSequence", "artifactVersion", "commitSha"]) {
    assertRecordField(record, field, manifest[field], "candidate");
  }
  if (candidate.releaseTarget !== stableManifest.releaseTarget) {
    throw promotionError("candidate.releaseTarget", "must equal the stable release target.");
  }
  if (typeof manifest.commitSha !== "string"
    || manifest.commitSha.trim() !== manifest.commitSha
    || !manifest.commitSha) {
    throw promotionError("candidate.commitSha", "must identify the frozen source commit.");
  }
}

function validateFinalRecord(record, stableManifest, artifactBuffer) {
  for (const field of ["releaseTarget", "releasePhase", "releaseSequence", "artifactVersion"]) {
    assertRecordField(record, field, stableManifest[field], "finalArtifact");
  }
  assertDigest("finalArtifact.sha256", record.sha256);
  const artifactHash = sha256(artifactBuffer);
  if (record.sha256 !== artifactHash) {
    throw promotionError("final artifact hash", `is ${artifactHash}, expected ${record.sha256}.`);
  }
  if (!Number.isSafeInteger(record.size) || record.size <= 0 || record.size !== artifactBuffer.byteLength) {
    throw promotionError("finalArtifact.size", "must equal the frozen final artifact byte length.");
  }
}

/** Loads and verifies the frozen candidate provenance and exact final bytes to promote. */
export function loadPortableStablePromotion({ rootDir, promotionRecordPath, stableManifest }) {
  if (!promotionRecordPath) {
    throw promotionError(
      "promotion record",
      "is required. Pass --promotion-record or set KK_PORTABLE_PROMOTION_RECORD.",
    );
  }
  const recordPath = resolveContainedFile(rootDir, promotionRecordPath, "promotion record");
  const record = JSON.parse(fs.readFileSync(recordPath, "utf8"));
  if (!isRecord(record) || record.schemaVersion !== PROMOTION_SCHEMA_VERSION
    || record.provenance?.kind !== PROMOTION_KIND
    || !isRecord(record.candidate) || !isRecord(record.finalArtifact)) {
    throw promotionError("promotion record", "must use the supported schema and provenance kind.");
  }
  const candidatePath = resolveContainedFile(rootDir, record.candidate.manifestPath, "candidate.manifestPath");
  const candidateBytes = fs.readFileSync(candidatePath);
  assertDigest("candidate.manifestSha256", record.candidate.manifestSha256);
  if (sha256(candidateBytes) !== record.candidate.manifestSha256) {
    throw promotionError("candidate manifest hash", "does not match the frozen candidate bytes.");
  }
  const candidateManifest = JSON.parse(candidateBytes.toString("utf8"));
  validateCandidateRecord(record.candidate, candidateManifest, stableManifest);
  const artifactPath = resolveContainedFile(rootDir, record.finalArtifact.path, "finalArtifact.path");
  const artifactBuffer = fs.readFileSync(artifactPath);
  validateFinalRecord(record.finalArtifact, stableManifest, artifactBuffer);
  if (stableManifest.releaseSequence <= candidateManifest.releaseSequence) {
    throw promotionError("finalArtifact.releaseSequence", "must advance beyond the frozen candidate.");
  }
  return Object.freeze({
    artifactBuffer,
    candidateCommitSha: candidateManifest.commitSha,
    candidateManifest,
    promotionRecord: record,
  });
}
