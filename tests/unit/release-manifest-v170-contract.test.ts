import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  RELEASE_MANIFEST_SCHEMA_VERSION,
  assertReleaseTransition,
  assertStableReleaseProjection,
  compareArtifactVersions,
  deriveArtifactVersion,
  derivePlatformReleaseMetadata,
  deriveStablePromotionProjection,
  parseReleaseManifest,
} from '../../scripts/lib/release-manifest.mjs';
import { readSource } from '../support/workspacePaths.js';

const ROOT_DIR = process.cwd();

function readManifestSource(): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'config/release-manifest.json'), 'utf8'),
  );
}

function makeManifest(overrides: Record<string, unknown> = {}) {
  return {
    appName: 'KK Studio',
    schemaVersion: RELEASE_MANIFEST_SCHEMA_VERSION,
    version: '1.6.1',
    releasedVersion: '1.6.1',
    displayVersion: 'v1.6.1',
    releaseTarget: '1.7.0',
    releasePhase: 'development',
    releaseSequence: 0,
    artifactVersion: '1.7.0-alpha.0.0',
    releaseDate: '2026-07-25',
    releaseNotes: [],
    versionTargets: {
      releaseManifest: 'config/release-manifest.json',
      rootPackage: 'package.json',
    },
    ...overrides,
  };
}

test('Gate 0 keeps stable identity at 1.6.1 while declaring the 1.7.0 candidate', () => {
  const manifest = parseReleaseManifest(readManifestSource());

  assert.equal(manifest.schemaVersion, RELEASE_MANIFEST_SCHEMA_VERSION);
  assert.equal(manifest.version, '1.6.1');
  assert.equal(manifest.releasedVersion, '1.6.1');
  assert.equal(manifest.displayVersion, 'v1.6.1');
  assert.equal(manifest.releaseTarget, '1.7.0');
  assert.equal(manifest.releasePhase, 'development');
  assert.equal(manifest.releaseSequence, 0);
  assert.equal(manifest.artifactVersion, '1.7.0-alpha.0.0');
});

test('candidate phases derive deterministic platform-valid SemVer artifacts', () => {
  assert.equal(deriveArtifactVersion('1.7.0', 'development', 3), '1.7.0-alpha.0.3');
  assert.equal(deriveArtifactVersion('1.7.0', 'internal', 4), '1.7.0-alpha.1.4');
  assert.equal(deriveArtifactVersion('1.7.0', 'canary', 5), '1.7.0-beta.5');
  assert.equal(deriveArtifactVersion('1.7.0', 'release-candidate', 6), '1.7.0-rc.6');
  assert.equal(deriveArtifactVersion('1.7.0', 'stable', 7), '1.7.0');

  const ordered = [
    '1.7.0-alpha.0.3',
    '1.7.0-alpha.1.4',
    '1.7.0-beta.5',
    '1.7.0-rc.6',
    '1.7.0',
  ];
  for (let index = 1; index < ordered.length; index += 1) {
    assert.ok(compareArtifactVersions(ordered[index], ordered[index - 1]) > 0);
  }
});

test('the parser fails closed on schema, type, phase, sequence, and derivation drift', () => {
  assert.throws(() => parseReleaseManifest(makeManifest({ schemaVersion: 2 })), /schemaVersion/);
  assert.throws(() => parseReleaseManifest(makeManifest({ releasedVersion: 170 })), /releasedVersion/);
  assert.throws(() => parseReleaseManifest(makeManifest({ releasePhase: 'preview' })), /releasePhase/);
  assert.throws(() => parseReleaseManifest(makeManifest({ releaseSequence: -1 })), /releaseSequence/);
  assert.throws(
    () => parseReleaseManifest(makeManifest({ releaseSequence: Number.MAX_SAFE_INTEGER + 1 })),
    /releaseSequence/,
  );
  assert.throws(() => parseReleaseManifest(makeManifest({ artifactVersion: '1.7.0-dev.9' })), /artifactVersion/);
  assert.throws(() => parseReleaseManifest(makeManifest({ version: '1.7.0' })), /releasedVersion/);
  assert.throws(() => parseReleaseManifest(makeManifest({ unexpected: true })), /unexpected/);
});

test('release transitions reject sequence reuse, channel downgrade, and target downgrade', () => {
  const development = parseReleaseManifest(makeManifest());
  const internal = makeManifest({
    releasePhase: 'internal',
    releaseSequence: 1,
    artifactVersion: '1.7.0-alpha.1.1',
  });

  assert.doesNotThrow(() => assertReleaseTransition(development, internal));
  assert.throws(() => assertReleaseTransition(internal, internal), /releaseSequence/);
  assert.throws(
    () => assertReleaseTransition(internal, makeManifest({
      releaseSequence: 2,
      artifactVersion: '1.7.0-alpha.0.2',
    })),
    /releasePhase/,
  );
  assert.throws(
    () => assertReleaseTransition(internal, makeManifest({
      releaseTarget: '1.6.9',
      releaseSequence: 0,
      artifactVersion: '1.6.9-alpha.0.0',
    })),
    /releaseTarget/,
  );
  assert.throws(
    () => assertReleaseTransition(internal, makeManifest({
      version: '1.5.9',
      releasedVersion: '1.5.9',
      displayVersion: 'v1.5.9',
      releasePhase: 'canary',
      releaseSequence: 2,
      artifactVersion: '1.7.0-beta.2',
    })),
    /releasedVersion/,
  );
});

test('platform metadata exposes stable and candidate identity without mutating source versions', () => {
  const metadata = derivePlatformReleaseMetadata(parseReleaseManifest(makeManifest()));

  assert.deepEqual(metadata, {
    web: { releasedVersion: '1.6.1', artifactVersion: '1.7.0-alpha.0.0' },
    tauri: { version: '1.7.0-alpha.0.0' },
    expo: {
      version: '1.7.0',
      ios: { buildNumber: '107000001' },
      android: { versionCode: 107000001 },
      runtimeVersion: '1.7.0-alpha.0.0',
    },
  });
});

test('Expo metadata keeps a numeric core while build identities remain monotonic', async () => {
  const { deriveExpoReleaseMetadata } = await import('../../scripts/lib/release-manifest.mjs');
  const versions = [
    deriveExpoReleaseMetadata('1.7.0', 'development', 0, '1.7.0-alpha.0.0'),
    deriveExpoReleaseMetadata('1.7.0', 'internal', 1, '1.7.0-alpha.1.1'),
    deriveExpoReleaseMetadata('1.7.0', 'canary', 2, '1.7.0-beta.2'),
    deriveExpoReleaseMetadata('1.7.0', 'release-candidate', 3, '1.7.0-rc.3'),
    deriveExpoReleaseMetadata('1.7.0', 'stable', 4, '1.7.0'),
    deriveExpoReleaseMetadata('1.7.1', 'development', 0, '1.7.1-alpha.0.0'),
  ];

  for (const metadata of versions) {
    assert.match(metadata.version, /^\d+\.\d+\.\d+$/);
    assert.match(metadata.ios.buildNumber, /^\d+$/);
    assert.ok(Number.isSafeInteger(metadata.android.versionCode));
  }
  for (let index = 1; index < versions.length; index += 1) {
    assert.ok(versions[index].android.versionCode > versions[index - 1].android.versionCode);
  }

  const upperBound = deriveExpoReleaseMetadata('20.99.99', 'stable', 1999, '20.99.99');
  assert.equal(upperBound.android.versionCode, 2_100_000_000);
  assert.throws(
    () => deriveExpoReleaseMetadata('1.7.0', 'stable', 2000, '1.7.0'),
    /releaseSequence/,
  );
  assert.throws(
    () => deriveExpoReleaseMetadata('21.0.0', 'development', 0, '21.0.0-alpha.0.0'),
    /Android versionCode/,
  );
});

test('stable publication accepts only a fully promoted stable projection', () => {
  assert.throws(
    () => assertStableReleaseProjection(parseReleaseManifest(makeManifest())),
    /releasePhase/,
  );

  const stable = parseReleaseManifest(makeManifest({
    version: '1.7.0',
    releasedVersion: '1.7.0',
    displayVersion: 'v1.7.0',
    releasePhase: 'stable',
    releaseSequence: 10,
    artifactVersion: '1.7.0',
  }));
  assert.doesNotThrow(() => assertStableReleaseProjection(stable));
  assert.doesNotThrow(() => assertReleaseTransition(makeManifest({
    releasePhase: 'release-candidate',
    releaseSequence: 9,
    artifactVersion: '1.7.0-rc.9',
  }), stable));

  const correctedStable = makeManifest({
    version: '1.7.0',
    releasedVersion: '1.7.0',
    displayVersion: 'v1.7.0',
    releasePhase: 'stable',
    releaseSequence: 11,
    artifactVersion: '1.7.0',
  });
  assert.doesNotThrow(() => assertReleaseTransition(stable, correctedStable));
  assert.throws(
    () => assertReleaseTransition(stable, { ...correctedStable, releaseSequence: 10 }),
    /releaseSequence/,
  );
});

test('final stable bytes derive from a candidate without relabelling that source manifest', () => {
  const candidate = parseReleaseManifest(makeManifest({
    releasePhase: 'release-candidate',
    releaseSequence: 9,
    artifactVersion: '1.7.0-rc.9',
  }));
  const promotion = deriveStablePromotionProjection(candidate, 10);

  assert.equal(candidate.releasedVersion, '1.6.1');
  assert.equal(candidate.releasePhase, 'release-candidate');
  assert.equal(promotion.version, '1.7.0');
  assert.equal(promotion.releasedVersion, '1.7.0');
  assert.equal(promotion.displayVersion, 'v1.7.0');
  assert.equal(promotion.releasePhase, 'stable');
  assert.equal(promotion.releaseSequence, 10);
  assert.equal(promotion.artifactVersion, '1.7.0');
  assert.doesNotThrow(() => assertReleaseTransition(candidate, promotion));
  assert.throws(() => deriveStablePromotionProjection(candidate, 9), /releaseSequence/);
});

test('the stable Portable command fails before packaging while the manifest is a candidate', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/release/publish-portable-release.mjs', '--base-url', 'https://example.invalid'],
    { cwd: ROOT_DIR, encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /releasePhase.*stable/);
});

test('governance, Web build provenance, and Portable publishing share the parser', () => {
  const governanceSource = readSource('scripts/governance/check-version-consistency.mjs');
  const viteSource = readSource('apps/web/vite.config.ts');
  const appInfoSource = readSource('apps/web/src/config/appInfo.ts');
  const portablePublisherSource = readSource('scripts/release/publish-portable-release.mjs');

  assert.match(governanceSource, /parseReleaseManifest/);
  assert.match(viteSource, /parseReleaseManifest/);
  assert.match(viteSource, /version: RELEASE_MANIFEST\.releasedVersion/);
  assert.match(viteSource, /artifactVersion: RELEASE_MANIFEST\.artifactVersion/);
  assert.doesNotMatch(viteSource, /packageJson\.version/);
  assert.match(appInfoSource, /releaseManifest\.releasedVersion/);
  assert.match(appInfoSource, /APP_ARTIFACT_VERSION/);
  assert.match(portablePublisherSource, /assertStableReleaseProjection/);
  assert.match(portablePublisherSource, /artifactVersion/);
});
