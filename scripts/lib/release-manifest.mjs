/**
 * Canonical release-manifest parser and candidate-version derivation.
 *
 * Release tooling shares this module so malformed or hand-authored candidate
 * metadata cannot be interpreted differently by governance, builds, and publishers.
 */

/** Schema understood by every Gate 0 release consumer. */
export const RELEASE_MANIFEST_SCHEMA_VERSION = 1;

/** Ordered delivery phases; changing this order changes anti-downgrade semantics. */
export const RELEASE_PHASES = Object.freeze([
  "development",
  "internal",
  "canary",
  "release-candidate",
  "stable",
]);

const PHASE_TAGS = Object.freeze({
  development: "alpha.0",
  internal: "alpha.1",
  canary: "beta",
  "release-candidate": "rc",
});

const TOP_LEVEL_FIELDS = new Set([
  "appName",
  "schemaVersion",
  "version",
  "releasedVersion",
  "displayVersion",
  "releaseTarget",
  "releasePhase",
  "releaseSequence",
  "artifactVersion",
  "releaseDate",
  "releaseNotes",
  "versionTargets",
]);

const CORE_SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;
const RELEASE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const EXPO_PHASE_CAPACITY = 2_000;
const EXPO_CORE_CAPACITY = EXPO_PHASE_CAPACITY * RELEASE_PHASES.length;
const ANDROID_VERSION_CODE_MAX = 2_100_000_000;

function manifestError(field, message) {
  return new Error(`[release-manifest] ${field} ${message}`);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source, field) {
  const value = source[field];
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw manifestError(field, "must be a non-empty trimmed string.");
  }
  return value;
}

function readCoreSemVer(source, field) {
  const value = readString(source, field);
  if (!CORE_SEMVER_PATTERN.test(value)) {
    throw manifestError(field, `must be a core SemVer value, received ${value}.`);
  }
  return value;
}

function compareCoreSemVer(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
}

function parseComparableSemVer(value) {
  const match = SEMVER_PATTERN.exec(value);
  if (!match) {
    throw manifestError("artifactVersion", `must be valid SemVer, received ${value}.`);
  }
  const prerelease = match[4]
    ? match[4].split(".").map((identifier) => {
      if (!/^\d+$/u.test(identifier)) return identifier;
      if (identifier.length > 1 && identifier.startsWith("0")) {
        throw manifestError("artifactVersion", "numeric prerelease identifiers must not have leading zeroes.");
      }
      const numericIdentifier = Number(identifier);
      if (!Number.isSafeInteger(numericIdentifier)) {
        throw manifestError("artifactVersion", "numeric prerelease identifiers must be safe integers.");
      }
      return numericIdentifier;
    })
    : [];
  return { core: match.slice(1, 4).map(Number), prerelease };
}

function comparePrerelease(left, right) {
  if (left.length === 0 || right.length === 0) {
    return left.length === right.length ? 0 : left.length === 0 ? 1 : -1;
  }
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if (left[index] === undefined || right[index] === undefined) {
      return left[index] === undefined ? -1 : 1;
    }
    if (left[index] === right[index]) continue;
    if (typeof left[index] === "number" && typeof right[index] !== "number") return -1;
    if (typeof left[index] !== "number" && typeof right[index] === "number") return 1;
    return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

/** Compares the restricted SemVer values emitted for application artifacts. */
export function compareArtifactVersions(left, right) {
  const leftVersion = parseComparableSemVer(left);
  const rightVersion = parseComparableSemVer(right);
  for (let index = 0; index < leftVersion.core.length; index += 1) {
    if (leftVersion.core[index] !== rightVersion.core[index]) {
      return leftVersion.core[index] - rightVersion.core[index];
    }
  }
  return comparePrerelease(leftVersion.prerelease, rightVersion.prerelease);
}

function validateKnownFields(source) {
  for (const field of Object.keys(source)) {
    if (!TOP_LEVEL_FIELDS.has(field)) {
      throw manifestError(field, "is not recognized by this schema version.");
    }
  }
}

function validateReleaseNotes(source) {
  if (!Array.isArray(source.releaseNotes)
    || source.releaseNotes.some((note) => typeof note !== "string")) {
    throw manifestError("releaseNotes", "must be an array of strings.");
  }
  return [...source.releaseNotes];
}

function validateVersionTargets(source) {
  if (!isRecord(source.versionTargets)) {
    throw manifestError("versionTargets", "must be an object.");
  }
  const entries = Object.entries(source.versionTargets);
  for (const [field, value] of entries) {
    const valid = typeof value === "string"
      || (Array.isArray(value) && value.every((item) => typeof item === "string"));
    if (!valid) {
      throw manifestError(`versionTargets.${field}`, "must be a string or an array of strings.");
    }
  }
  return Object.fromEntries(entries.map(([field, value]) => [
    field,
    Array.isArray(value) ? [...value] : value,
  ]));
}

function readPhase(source) {
  const phase = readString(source, "releasePhase");
  if (!RELEASE_PHASES.includes(phase)) {
    throw manifestError("releasePhase", `must be one of ${RELEASE_PHASES.join(", ")}.`);
  }
  return phase;
}

function readSequence(source) {
  const sequence = source.releaseSequence;
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw manifestError("releaseSequence", "must be a non-negative safe integer.");
  }
  return sequence;
}

/** Derives the only permitted artifact SemVer for a target, phase, and sequence. */
export function deriveArtifactVersion(releaseTarget, releasePhase, releaseSequence) {
  if (!CORE_SEMVER_PATTERN.test(releaseTarget)) {
    throw manifestError("releaseTarget", "must be a core SemVer value.");
  }
  if (!RELEASE_PHASES.includes(releasePhase)) {
    throw manifestError("releasePhase", `must be one of ${RELEASE_PHASES.join(", ")}.`);
  }
  if (!Number.isSafeInteger(releaseSequence) || releaseSequence < 0) {
    throw manifestError("releaseSequence", "must be a non-negative safe integer.");
  }
  return releasePhase === "stable"
    ? releaseTarget
    : `${releaseTarget}-${PHASE_TAGS[releasePhase]}.${releaseSequence}`;
}

function deriveExpoBuildOrdinal(releaseTarget, releasePhase, releaseSequence) {
  const coreParts = releaseTarget.split(".").map(Number);
  const [major, minor, patch] = coreParts;
  if (major > 20 || minor > 99 || patch > 99) {
    throw manifestError(
      "releaseTarget",
      "cannot be represented by the bounded Android versionCode mapping.",
    );
  }
  if (releaseSequence >= EXPO_PHASE_CAPACITY) {
    throw manifestError(
      "releaseSequence",
      `must be below ${EXPO_PHASE_CAPACITY} for Expo build metadata.`,
    );
  }
  const coreOrdinal = ((major * 100) + minor) * 100 + patch;
  const phaseOrdinal = RELEASE_PHASES.indexOf(releasePhase);
  const buildOrdinal = (coreOrdinal * EXPO_CORE_CAPACITY)
    + (phaseOrdinal * EXPO_PHASE_CAPACITY)
    + releaseSequence
    + 1;
  if (buildOrdinal > ANDROID_VERSION_CODE_MAX) {
    throw manifestError("releaseTarget", "exceeds the Android versionCode limit.");
  }
  return buildOrdinal;
}

/** Derives Expo metadata without placing a prerelease string in expo.version. */
export function deriveExpoReleaseMetadata(
  releaseTarget,
  releasePhase,
  releaseSequence,
  artifactVersion,
) {
  const expectedArtifactVersion = deriveArtifactVersion(
    releaseTarget,
    releasePhase,
    releaseSequence,
  );
  if (artifactVersion !== expectedArtifactVersion) {
    throw manifestError("artifactVersion", `must equal the derived value ${expectedArtifactVersion}.`);
  }
  const buildOrdinal = deriveExpoBuildOrdinal(releaseTarget, releasePhase, releaseSequence);
  return Object.freeze({
    version: releaseTarget,
    ios: Object.freeze({ buildNumber: String(buildOrdinal) }),
    android: Object.freeze({ versionCode: buildOrdinal }),
    runtimeVersion: artifactVersion,
  });
}

function validateProjection(manifest) {
  if (manifest.version !== manifest.releasedVersion) {
    throw manifestError("version", "must equal releasedVersion.");
  }
  if (manifest.displayVersion !== `v${manifest.releasedVersion}`) {
    throw manifestError("displayVersion", "must be derived from releasedVersion.");
  }
  const targetOrder = compareCoreSemVer(manifest.releaseTarget, manifest.releasedVersion);
  if (manifest.releasePhase === "stable" && targetOrder !== 0) {
    throw manifestError("releasedVersion", "must equal releaseTarget for a stable release.");
  }
  if (manifest.releasePhase !== "stable" && targetOrder <= 0) {
    throw manifestError("releaseTarget", "must be newer than releasedVersion before stable promotion.");
  }
  const derived = deriveArtifactVersion(
    manifest.releaseTarget,
    manifest.releasePhase,
    manifest.releaseSequence,
  );
  if (manifest.artifactVersion !== derived) {
    throw manifestError("artifactVersion", `must equal the derived value ${derived}.`);
  }
}

/**
 * Parses a manifest without coercion. Rejecting unknown schema shapes prevents
 * release tools from silently falling back to incompatible interpretations.
 */
export function parseReleaseManifest(source) {
  if (!isRecord(source)) {
    throw manifestError("root", "must be an object.");
  }
  validateKnownFields(source);
  if (source.schemaVersion !== RELEASE_MANIFEST_SCHEMA_VERSION) {
    throw manifestError("schemaVersion", `must equal ${RELEASE_MANIFEST_SCHEMA_VERSION}.`);
  }
  const manifest = {
    appName: readString(source, "appName"),
    schemaVersion: source.schemaVersion,
    version: readCoreSemVer(source, "version"),
    releasedVersion: readCoreSemVer(source, "releasedVersion"),
    displayVersion: readString(source, "displayVersion"),
    releaseTarget: readCoreSemVer(source, "releaseTarget"),
    releasePhase: readPhase(source),
    releaseSequence: readSequence(source),
    artifactVersion: readString(source, "artifactVersion"),
    releaseDate: readString(source, "releaseDate"),
    releaseNotes: validateReleaseNotes(source),
    versionTargets: validateVersionTargets(source),
  };
  if (!RELEASE_DATE_PATTERN.test(manifest.releaseDate)) {
    throw manifestError("releaseDate", "must use YYYY-MM-DD format.");
  }
  validateProjection(manifest);
  return Object.freeze(manifest);
}

/** Prevents replay and phase rollback when advancing one target's release state. */
export function assertReleaseTransition(previousSource, nextSource) {
  const previous = parseReleaseManifest(previousSource);
  const next = parseReleaseManifest(nextSource);
  if (compareCoreSemVer(next.releasedVersion, previous.releasedVersion) < 0) {
    throw manifestError("releasedVersion", "must not downgrade.");
  }
  const targetOrder = compareCoreSemVer(next.releaseTarget, previous.releaseTarget);
  if (targetOrder < 0) {
    throw manifestError("releaseTarget", "must not downgrade.");
  }
  if (targetOrder > 0) {
    if (compareArtifactVersions(next.artifactVersion, previous.artifactVersion) <= 0) {
      throw manifestError("artifactVersion", "must increase across release transitions.");
    }
    return next;
  }
  if (next.releaseSequence <= previous.releaseSequence) {
    throw manifestError("releaseSequence", "must increase within one release target.");
  }
  if (RELEASE_PHASES.indexOf(next.releasePhase) < RELEASE_PHASES.indexOf(previous.releasePhase)) {
    throw manifestError("releasePhase", "must not move to an earlier channel.");
  }
  const artifactOrder = compareArtifactVersions(next.artifactVersion, previous.artifactVersion);
  const isCorrectedStableBuild = previous.releasePhase === "stable"
    && next.releasePhase === "stable"
    && artifactOrder === 0;
  if (artifactOrder < 0 || (artifactOrder === 0 && !isCorrectedStableBuild)) {
    throw manifestError("artifactVersion", "must increase across release transitions.");
  }
  return next;
}

/**
 * Creates the immutable final-byte projection tested before the public stable
 * pointer moves. A failed final build must call this again with a new sequence.
 */
export function deriveStablePromotionProjection(source, releaseSequence) {
  const candidate = parseReleaseManifest(source);
  if (candidate.releasePhase !== "release-candidate") {
    throw manifestError("releasePhase", "must be release-candidate before final-byte staging.");
  }
  if (!Number.isSafeInteger(releaseSequence) || releaseSequence <= candidate.releaseSequence) {
    throw manifestError("releaseSequence", "must increase for final-byte staging.");
  }
  return parseReleaseManifest({
    ...candidate,
    version: candidate.releaseTarget,
    releasedVersion: candidate.releaseTarget,
    displayVersion: `v${candidate.releaseTarget}`,
    releasePhase: "stable",
    releaseSequence,
    artifactVersion: candidate.releaseTarget,
  });
}

/** Stable publication is intentionally unavailable until candidate truth is promoted. */
export function assertStableReleaseProjection(source) {
  const manifest = parseReleaseManifest(source);
  if (manifest.releasePhase !== "stable") {
    throw manifestError("releasePhase", "must be stable for stable publication.");
  }
  if (manifest.artifactVersion !== manifest.releasedVersion) {
    throw manifestError("artifactVersion", "must equal releasedVersion for stable publication.");
  }
  return manifest;
}

/** Supplies future platform generators without creating platform config in Gate 0. */
export function derivePlatformReleaseMetadata(source) {
  const manifest = parseReleaseManifest(source);
  return Object.freeze({
    web: Object.freeze({
      releasedVersion: manifest.releasedVersion,
      artifactVersion: manifest.artifactVersion,
    }),
    tauri: Object.freeze({ version: manifest.artifactVersion }),
    expo: deriveExpoReleaseMetadata(
      manifest.releaseTarget,
      manifest.releasePhase,
      manifest.releaseSequence,
      manifest.artifactVersion,
    ),
  });
}
