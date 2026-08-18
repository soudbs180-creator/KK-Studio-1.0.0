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

function encodeCanonicalString(field, value, nullable = false) {
  if (nullable && (value === null || value === undefined)) {
    return `${field}|null|`;
  }
  if (typeof value !== "string") {
    throw publicationError(field, "must be a string for canonical hashing.");
  }
  return `${field}|string|${Buffer.from(value, "utf8").toString("base64")}`;
}

function encodeCanonicalInteger(field, value) {
  if (!Number.isSafeInteger(value)) {
    throw publicationError(field, "must be a safe integer for canonical hashing.");
  }
  return `${field}|integer|${value}`;
}

function encodeCanonicalReleaseNotes(value) {
  if (!Array.isArray(value) || value.some((note) => typeof note !== "string")) {
    throw publicationError("releaseNotes", "must be a string array for canonical hashing.");
  }
  return [
    `releaseNotes|array|${value.length}`,
    ...value.map((note, index) => encodeCanonicalString(`releaseNotes[${index}]`, note)),
  ];
}

/**
 * Serializes the fixed v1 envelope fields using UTF-8 Base64 strings and LF
 * separators so Node and Windows PowerShell hash identical bytes.
 */
export function serializePortablePublicationEnvelope(envelope) {
  if (!isRecord(envelope) || !isRecord(envelope.provenance)) {
    throw publicationError("envelope", "must be an object with provenance for canonical hashing.");
  }
  return [
    "kk-studio-portable-publication-envelope-v1",
    encodeCanonicalInteger("schemaVersion", envelope.schemaVersion),
    encodeCanonicalString("provenance.kind", envelope.provenance.kind),
    encodeCanonicalString("appName", envelope.appName),
    encodeCanonicalString("version", envelope.version),
    encodeCanonicalString("releasedVersion", envelope.releasedVersion),
    encodeCanonicalString("displayVersion", envelope.displayVersion),
    encodeCanonicalString("releaseTarget", envelope.releaseTarget),
    encodeCanonicalString("releasePhase", envelope.releasePhase),
    encodeCanonicalInteger("releaseSequence", envelope.releaseSequence),
    encodeCanonicalString("artifactVersion", envelope.artifactVersion),
    encodeCanonicalString("buildTime", envelope.buildTime, true),
    encodeCanonicalString("releaseDate", envelope.releaseDate),
    ...encodeCanonicalReleaseNotes(envelope.releaseNotes),
    encodeCanonicalString("channel", envelope.channel),
    encodeCanonicalString("commitSha", envelope.commitSha, true),
    encodeCanonicalString("commitShortSha", envelope.commitShortSha, true),
    encodeCanonicalString("packageFile", envelope.packageFile),
    encodeCanonicalString("downloadUrl", envelope.downloadUrl),
    encodeCanonicalString("sha256", envelope.sha256),
    encodeCanonicalInteger("size", envelope.size),
  ].join("\n");
}

/** Computes the integrity hash carried alongside a Portable publication envelope. */
export function computePortablePublicationEnvelopeHash(envelope) {
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
    envelopeHash: computePortablePublicationEnvelopeHash(envelope),
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
