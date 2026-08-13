import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertPortablePublicationTransition,
  createPortablePublicationState,
} from '../../scripts/lib/portable-publication.mjs';
import { publishPortableRelease } from '../../scripts/release/publish-portable-release.mjs';

function stableManifest(releaseSequence: number) {
  return {
    appName: 'KK Studio',
    schemaVersion: 1,
    version: '1.7.0',
    releasedVersion: '1.7.0',
    displayVersion: 'v1.7.0',
    releaseTarget: '1.7.0',
    releasePhase: 'stable',
    releaseSequence,
    artifactVersion: '1.7.0',
    releaseDate: '2026-08-13',
    releaseNotes: ['fixture'],
    versionTargets: {
      releaseManifest: 'config/release-manifest.json',
      rootPackage: 'package.json',
      serverPackage: 'services/api/package.json',
      stablePortableManifest: 'release/publish/stable/manifest.json',
    },
  };
}

function publishedEnvelope(releaseSequence: number, sha256: string) {
  return {
    schemaVersion: 1,
    provenance: { kind: 'kk-studio-portable-publication' },
    appName: 'KK Studio',
    version: '1.7.0',
    releasedVersion: '1.7.0',
    displayVersion: 'v1.7.0',
    releaseTarget: '1.7.0',
    releasePhase: 'stable',
    releaseSequence,
    artifactVersion: '1.7.0',
    releaseDate: '2026-08-13',
    releaseNotes: ['fixture'],
    channel: 'stable',
    packageFile: 'KK-Studio-Portable-1.7.0.zip',
    downloadUrl: 'https://downloads.example/KK-Studio-Portable-1.7.0.zip',
    sha256,
    size: 12,
  };
}

async function createPublisherFixture(releaseSequence = 10) {
  const rootDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kk-portable-publish-'));
  const bundleDir = path.join(rootDir, 'release', 'KK-Studio-Portable');
  const appManifestPath = path.join(bundleDir, 'app', 'dist', 'app-version.json');
  await fs.promises.mkdir(path.dirname(appManifestPath), { recursive: true });
  await fs.promises.mkdir(path.join(rootDir, 'config'), { recursive: true });
  await fs.promises.writeFile(
    path.join(rootDir, 'config', 'release-manifest.json'),
    `${JSON.stringify(stableManifest(releaseSequence), null, 2)}\n`,
  );
  await fs.promises.writeFile(appManifestPath, `${JSON.stringify({
    schemaVersion: 1,
    provenance: { kind: 'kk-studio-web-build' },
    appName: 'KK Studio',
    version: '1.7.0',
    releasedVersion: '1.7.0',
    displayVersion: 'v1.7.0',
    releaseTarget: '1.7.0',
    releasePhase: 'stable',
    releaseSequence,
    artifactVersion: '1.7.0',
    buildTime: '2026-08-13T00:00:00.000Z',
    releaseDate: '2026-08-13',
    releaseNotes: ['fixture'],
    channel: 'stable',
    commitSha: '0123456789abcdef',
    commitShortSha: '0123456',
  }, null, 2)}\n`);
  await fs.promises.writeFile(path.join(bundleDir, 'payload.txt'), 'first bytes');
  return { rootDir, appManifestPath, bundleDir };
}

test('publication state rejects a reused tuple with different artifact bytes', () => {
  const first = createPortablePublicationState(publishedEnvelope(10, 'a'.repeat(64)));
  assert.throws(
    () => assertPortablePublicationTransition(first, publishedEnvelope(10, 'b'.repeat(64))),
    /releaseSequence.*different artifact bytes/,
  );
  assert.equal(
    assertPortablePublicationTransition(first, publishedEnvelope(10, 'a'.repeat(64))).kind,
    'idempotent',
  );
  assert.equal(
    assertPortablePublicationTransition(first, publishedEnvelope(11, 'b'.repeat(64))).kind,
    'advance',
  );
});

test('the real publisher persists provenance and blocks byte mutation until sequence advances', async (context) => {
  const fixture = await createPublisherFixture();
  context.after(async () => fs.promises.rm(fixture.rootDir, { recursive: true, force: true }));
  const validationCalls: string[] = [];
  const publisherOptions = {
    rootDir: fixture.rootDir,
    baseUrl: 'https://downloads.example',
    channel: 'stable',
    assertSourceConsistency: () => { validationCalls.push('source'); },
    assertPostPublishConsistency: () => { validationCalls.push('full'); },
  };

  const first = await publishPortableRelease(publisherOptions);
  assert.deepEqual(validationCalls, ['source', 'full']);
  const statePath = path.join(fixture.rootDir, 'release', 'publish', 'stable', 'publication-state.json');
  const state = JSON.parse(await fs.promises.readFile(statePath, 'utf8')) as {
    artifactSha256: string;
    envelopeHash: string;
    envelope: { provenance?: { kind?: string } };
  };
  assert.equal(state.artifactSha256, first.sha256);
  assert.match(state.envelopeHash, /^[a-f0-9]{64}$/);
  assert.equal(state.envelope.provenance?.kind, 'kk-studio-portable-publication');

  await fs.promises.writeFile(path.join(fixture.bundleDir, 'payload.txt'), 'mutated bytes');
  await assert.rejects(() => publishPortableRelease(publisherOptions), /releaseSequence.*different artifact bytes/);

  const correctedManifest = stableManifest(11);
  await fs.promises.writeFile(
    path.join(fixture.rootDir, 'config', 'release-manifest.json'),
    `${JSON.stringify(correctedManifest, null, 2)}\n`,
  );
  const localManifest = JSON.parse(await fs.promises.readFile(fixture.appManifestPath, 'utf8'));
  localManifest.releaseSequence = 11;
  await fs.promises.writeFile(fixture.appManifestPath, `${JSON.stringify(localManifest, null, 2)}\n`);
  const corrected = await publishPortableRelease(publisherOptions);
  assert.equal(corrected.releaseSequence, 11);
  assert.equal(corrected.artifactVersion, '1.7.0');
});

test('the real Portable publisher explicitly rejects candidate channels in Gate 0', async (context) => {
  const fixture = await createPublisherFixture();
  context.after(async () => fs.promises.rm(fixture.rootDir, { recursive: true, force: true }));
  const candidate = stableManifest(12);
  candidate.version = '1.6.1';
  candidate.releasedVersion = '1.6.1';
  candidate.displayVersion = 'v1.6.1';
  candidate.releasePhase = 'release-candidate';
  candidate.artifactVersion = '1.7.0-rc.12';
  await fs.promises.writeFile(
    path.join(fixture.rootDir, 'config', 'release-manifest.json'),
    `${JSON.stringify(candidate, null, 2)}\n`,
  );

  await assert.rejects(
    () => publishPortableRelease({
      rootDir: fixture.rootDir,
      baseUrl: 'https://downloads.example',
      channel: 'release-candidate',
      assertSourceConsistency: () => undefined,
      assertPostPublishConsistency: () => undefined,
    }),
    /Gate 0.*stable Portable/i,
  );
});
