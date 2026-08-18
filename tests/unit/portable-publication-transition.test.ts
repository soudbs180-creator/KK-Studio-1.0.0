import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';

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

interface PublisherFixture {
  rootDir: string;
  appManifestPath: string;
  bundleDir: string;
  candidateManifestPath: string;
  finalArtifactPath: string;
  promotionRecordPath: string;
}

async function createPublisherFixture(releaseSequence = 10) {
  const rootDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kk-portable-publish-'));
  const bundleDir = path.join(rootDir, 'release', 'KK-Studio-Portable');
  const appManifestPath = path.join(bundleDir, 'app', 'dist', 'app-version.json');
  const candidateManifestPath = path.join(rootDir, 'release', 'promotion', 'candidate-app-version.json');
  const finalArtifactPath = path.join(rootDir, 'release', 'promotion', 'final-portable.zip');
  const promotionRecordPath = path.join(rootDir, 'release', 'promotion', 'promotion-record.json');
  await fs.promises.mkdir(path.dirname(appManifestPath), { recursive: true });
  await fs.promises.mkdir(path.dirname(candidateManifestPath), { recursive: true });
  await fs.promises.mkdir(path.join(rootDir, 'config'), { recursive: true });
  await fs.promises.writeFile(
    path.join(rootDir, 'config', 'release-manifest.json'),
    `${JSON.stringify(stableManifest(releaseSequence), null, 2)}\n`,
  );
  const stableAppManifest = {
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
  };
  await fs.promises.writeFile(appManifestPath, `${JSON.stringify(stableAppManifest, null, 2)}\n`);
  await fs.promises.writeFile(path.join(bundleDir, 'payload.txt'), 'first bytes');
  const candidateSequence = releaseSequence - 1;
  const candidateManifest = {
    ...stableAppManifest,
    version: '1.6.1',
    releasedVersion: '1.6.1',
    displayVersion: 'v1.6.1',
    releasePhase: 'release-candidate',
    releaseSequence: candidateSequence,
    artifactVersion: `1.7.0-rc.${candidateSequence}`,
    channel: 'release-candidate',
  };
  await fs.promises.writeFile(candidateManifestPath, `${JSON.stringify(candidateManifest, null, 2)}\n`);
  const fixture = {
    rootDir,
    appManifestPath,
    bundleDir,
    candidateManifestPath,
    finalArtifactPath,
    promotionRecordPath,
  };
  await refreshPromotionArtifact(fixture, releaseSequence);
  return fixture;
}

async function createFinalArtifact(fixture: Pick<PublisherFixture, 'appManifestPath' | 'bundleDir'>) {
  const zip = new JSZip();
  zip.file(
    'app/dist/app-version.json',
    await fs.promises.readFile(fixture.appManifestPath),
  );
  zip.file('payload.txt', await fs.promises.readFile(path.join(fixture.bundleDir, 'payload.txt')));
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function refreshPromotionArtifact(
  fixture: PublisherFixture,
  releaseSequence: number,
) {
  const artifactBuffer = await createFinalArtifact(fixture);
  await fs.promises.writeFile(fixture.finalArtifactPath, artifactBuffer);
  const candidateBytes = await fs.promises.readFile(fixture.candidateManifestPath);
  const candidateManifest = JSON.parse(candidateBytes.toString('utf8'));
  const promotionRecord = {
    schemaVersion: 1,
    provenance: { kind: 'kk-studio-portable-stable-promotion' },
    candidate: {
      manifestPath: path.relative(fixture.rootDir, fixture.candidateManifestPath).split('\\').join('/'),
      manifestSha256: createHash('sha256').update(candidateBytes).digest('hex'),
      releaseTarget: candidateManifest.releaseTarget,
      releasePhase: candidateManifest.releasePhase,
      releaseSequence: candidateManifest.releaseSequence,
      artifactVersion: candidateManifest.artifactVersion,
      commitSha: candidateManifest.commitSha,
    },
    finalArtifact: {
      path: path.relative(fixture.rootDir, fixture.finalArtifactPath).split('\\').join('/'),
      sha256: createHash('sha256').update(artifactBuffer).digest('hex'),
      size: artifactBuffer.byteLength,
      releaseTarget: '1.7.0',
      releasePhase: 'stable',
      releaseSequence,
      artifactVersion: '1.7.0',
    },
  };
  await fs.promises.writeFile(
    fixture.promotionRecordPath,
    `${JSON.stringify(promotionRecord, null, 2)}\n`,
  );
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
    promotionRecordPath: fixture.promotionRecordPath,
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
  await refreshPromotionArtifact(fixture, 10);
  await assert.rejects(() => publishPortableRelease(publisherOptions), /releaseSequence.*different artifact bytes/);

  const correctedManifest = stableManifest(11);
  await fs.promises.writeFile(
    path.join(fixture.rootDir, 'config', 'release-manifest.json'),
    `${JSON.stringify(correctedManifest, null, 2)}\n`,
  );
  const localManifest = JSON.parse(await fs.promises.readFile(fixture.appManifestPath, 'utf8'));
  localManifest.releaseSequence = 11;
  await fs.promises.writeFile(fixture.appManifestPath, `${JSON.stringify(localManifest, null, 2)}\n`);
  await refreshPromotionArtifact(fixture, 11);
  const corrected = await publishPortableRelease(publisherOptions);
  assert.equal(corrected.releaseSequence, 11);
  assert.equal(corrected.artifactVersion, '1.7.0');
});

test('the real publisher fails closed without a frozen candidate promotion record', async (context) => {
  const fixture = await createPublisherFixture();
  context.after(async () => fs.promises.rm(fixture.rootDir, { recursive: true, force: true }));

  await assert.rejects(
    () => publishPortableRelease({
      rootDir: fixture.rootDir,
      baseUrl: 'https://downloads.example',
      channel: 'stable',
      assertSourceConsistency: () => undefined,
      assertPostPublishConsistency: () => undefined,
    }),
    /promotion record/i,
  );
});

test('the real publisher binds candidate source and final bytes to the promotion record', async (context) => {
  const candidateFixture = await createPublisherFixture();
  const artifactFixture = await createPublisherFixture();
  const commitFixture = await createPublisherFixture();
  context.after(async () => Promise.all([
    fs.promises.rm(candidateFixture.rootDir, { recursive: true, force: true }),
    fs.promises.rm(artifactFixture.rootDir, { recursive: true, force: true }),
    fs.promises.rm(commitFixture.rootDir, { recursive: true, force: true }),
  ]));

  await fs.promises.appendFile(candidateFixture.candidateManifestPath, ' ');
  await assert.rejects(
    () => publishPortableRelease({
      rootDir: candidateFixture.rootDir,
      baseUrl: 'https://downloads.example',
      promotionRecordPath: candidateFixture.promotionRecordPath,
      assertSourceConsistency: () => undefined,
      assertPostPublishConsistency: () => undefined,
    }),
    /candidate.*hash/i,
  );

  await fs.promises.appendFile(artifactFixture.finalArtifactPath, 'tampered');
  await assert.rejects(
    () => publishPortableRelease({
      rootDir: artifactFixture.rootDir,
      baseUrl: 'https://downloads.example',
      promotionRecordPath: artifactFixture.promotionRecordPath,
      assertSourceConsistency: () => undefined,
      assertPostPublishConsistency: () => undefined,
    }),
    /final artifact.*hash/i,
  );

  const finalManifest = JSON.parse(await fs.promises.readFile(commitFixture.appManifestPath, 'utf8'));
  finalManifest.commitSha = 'fedcba9876543210';
  await fs.promises.writeFile(commitFixture.appManifestPath, `${JSON.stringify(finalManifest, null, 2)}\n`);
  await refreshPromotionArtifact(commitFixture, 10);
  await assert.rejects(
    () => publishPortableRelease({
      rootDir: commitFixture.rootDir,
      baseUrl: 'https://downloads.example',
      promotionRecordPath: commitFixture.promotionRecordPath,
      assertSourceConsistency: () => undefined,
      assertPostPublishConsistency: () => undefined,
    }),
    /commitSha.*candidate promotion source/i,
  );
});

test('the real publisher rejects a frozen candidate with an invalid release projection', async (context) => {
  const fixture = await createPublisherFixture();
  context.after(async () => fs.promises.rm(fixture.rootDir, { recursive: true, force: true }));
  const candidateManifest = JSON.parse(
    await fs.promises.readFile(fixture.candidateManifestPath, 'utf8'),
  );
  candidateManifest.version = '1.7.0';
  candidateManifest.releasedVersion = '1.7.0';
  candidateManifest.displayVersion = 'v1.7.0';
  await fs.promises.writeFile(
    fixture.candidateManifestPath,
    `${JSON.stringify(candidateManifest, null, 2)}\n`,
  );
  await refreshPromotionArtifact(fixture, 10);

  await assert.rejects(
    () => publishPortableRelease({
      rootDir: fixture.rootDir,
      baseUrl: 'https://downloads.example',
      promotionRecordPath: fixture.promotionRecordPath,
      assertSourceConsistency: () => undefined,
      assertPostPublishConsistency: () => undefined,
    }),
    /releaseTarget.*newer than releasedVersion|candidate.*projection/i,
  );
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
      promotionRecordPath: fixture.promotionRecordPath,
      assertSourceConsistency: () => undefined,
      assertPostPublishConsistency: () => undefined,
    }),
    /Gate 0.*stable Portable/i,
  );
});
