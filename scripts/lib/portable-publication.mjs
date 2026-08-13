import { createHash } from "node:crypto";

import {
  assertReleaseTransition,
  parseReleaseManifest,
} from "./release-manifest.mjs";

export const PORTABLE_PUBLICATION_SCHEMA_VERSION = 1;

function publicationError(field, message) {
  return new Error(`[portable-publication] ${field} ${message}`);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(source, field) {
  const value = source[field];
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw publicationError(field, "must be a non-empty trimmed string.");
  }
  return value;
}

function canonicalizeJson(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalizeJson(value[key])]),
  );
}

/** Serializes release metadata with recursively sorted keys. */
export function serializePortablePublicationEnvelope(envelope) {
  return JSON.stringify(canonicalizeJson(envelope));
}

function hashEnvelope(envelope) {
  return createHash("sha256")
    .update(serializePortablePublicationEnvelope(envelope), "utf8")
    .digest("hex");
}

function toReleaseProjection(envelope) {
  return parseReleaseManifest({
    appName: envelope.appName,
    schemaVersion: envelope.schemaVersion,
    version: envelope.version,
    releasedVersion: envelope.releasedVersion,
    displayVersion: envelope.displayVersion,
    releaseTarget: envelope.releaseTarget,
    releasePhase: envelope.releasePhase,
    releaseSequence: envelope.releaseSequence,
    artifactVersion: envelope.artifactVersion,
    releaseDate: envelope.releaseDate,
    releaseNotes: envelope.releaseNotes,
    versionTargets: { releaseManifest: "config/release-manifest.json" },
  });
}

function validatePortablePublicationEnvelope(source) {
  if (!isRecord(source)) {
    throw publicationError("envelope", "must be an object.");
  }
  if (source.schemaVersion !== PORTABLE_PUBLICATION_SCHEMA_VERSION) {
    throw publicationError("schemaVersion", `must equal ${PORTABLE_PUBLICATION_SCHEMA_VERSION}.`);
  }
  if (source.provenance?.kind !== "kk-studio-portable-publication") {
    throw publicationError("provenance.kind", "must identify the Portable publisher.");
  }
  const releaseProjection = toReleaseProjection(source);
  if (source.channel !== releaseProjection.releasePhase) {
    throw publicationError("channel", "must equal releasePhase.");
  }
  requireString(source, "packageFile");
  requireString(source, "downloadUrl");
  if (!/^[a-f0-9]{64}$/u.test(String(source.sha256 || ""))) {
    throw publicationError("sha256", "must be a lowercase SHA-256 digest.");
  }
  if (!Number.isSafeInteger(source.size) || source.size <= 0) {
    throw publicationError("size", "must be a positive safe integer.");
  }
  return Object.freeze({ ...source, releaseNotes: [...releaseProjection.releaseNotes] });
}

/** Persists the exact envelope and both hashes used by the next publication. */
export function createPortablePublicationState(source) {
  const envelope = validatePortablePublicationEnvelope(source);
  return Object.freeze({
    schemaVersion: PORTABLE_PUBLICATION_SCHEMA_VERSION,
    channel: envelope.channel,
    releaseTarget: envelope.releaseTarget,
    releaseSequence: envelope.releaseSequence,
    artifactVersion: envelope.artifactVersion,
    artifactSha256: envelope.sha256,
    envelopeHash: hashEnvelope(envelope),
    envelope,
  });
}

function validatePublicationState(source) {
  if (!isRecord(source) || !isRecord(source.envelope)) {
    throw publicationError("publicationState", "must contain the previous envelope.");
  }
  const state = createPortablePublicationState(source.envelope);
  for (const field of ["channel", "releaseTarget", "releaseSequence", "artifactVersion"]) {
    if (source[field] !== state[field]) {
      throw publicationError(field, "does not match the persisted envelope.");
    }
  }
  if (source.artifactSha256 !== state.artifactSha256 || source.envelopeHash !== state.envelopeHash) {
    throw publicationError("publicationState", "hashes do not match the persisted envelope.");
  }
  return state;
}

/** Enforces idempotency, anti-replay, channel isolation, and release ordering. */
export function assertPortablePublicationTransition(previousSource, nextSource) {
  const previous = validatePublicationState(previousSource);
  const next = createPortablePublicationState(nextSource);
  if (previous.channel !== next.channel) {
    throw publicationError("channel", "must not change within a publication history.");
  }
  const reusedTuple = previous.releaseTarget === next.releaseTarget
    && previous.releaseSequence === next.releaseSequence;
  if (reusedTuple) {
    if (previous.artifactSha256 !== next.artifactSha256) {
      throw publicationError(
        "releaseSequence",
        "was reused for different artifact bytes; issue a corrected higher sequence.",
      );
    }
    if (previous.envelopeHash !== next.envelopeHash) {
      throw publicationError("releaseSequence", "was reused for a different release envelope.");
    }
    return Object.freeze({ kind: "idempotent", state: next });
  }
  assertReleaseTransition(
    toReleaseProjection(previous.envelope),
    toReleaseProjection(next.envelope),
  );
  return Object.freeze({ kind: "advance", state: next });
}
