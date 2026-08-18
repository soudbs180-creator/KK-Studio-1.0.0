import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';

import { computePortablePublicationEnvelopeHash } from '../../scripts/lib/portable-publication.mjs';

const ROOT_DIR = process.cwd();
const WINDOWS_ONLY = process.platform !== 'win32';
const POLICY_PATH = path.join(ROOT_DIR, 'scripts', 'lib', 'portable-update-policy.ps1');
const RUNNER_PATH = path.join(ROOT_DIR, 'tests', 'fixtures', 'portable-update', 'assert-transition.ps1');
const UPDATER_RUNNER_PATH = path.join(ROOT_DIR, 'tests', 'fixtures', 'portable-update', 'run-updater.ps1');
const UPDATER_PATH = path.join(ROOT_DIR, 'scripts', 'release', 'portable-self-update.ps1');

function localManifest(artifactVersion: string, releaseSequence: number, channel: string) {
  return {
    schemaVersion: 1,
    provenance: { kind: 'kk-studio-web-build' },
    releaseTarget: '1.7.0',
    releasePhase: channel,
    releaseSequence,
    artifactVersion,
    channel,
  };
}

function remoteManifest(artifactVersion: string, releaseSequence: number, channel: string) {
  const releasedVersion = channel === 'stable' ? '1.7.0' : '1.6.1';
  const envelope = {
    schemaVersion: 1,
    provenance: { kind: 'kk-studio-portable-publication' },
    appName: 'KK Studio',
    version: releasedVersion,
    releasedVersion,
    displayVersion: `v${releasedVersion}`,
    releaseTarget: '1.7.0',
    releasePhase: channel,
    releaseSequence,
    artifactVersion,
    buildTime: '2026-08-13T00:00:00.000Z',
    releaseDate: '2026-08-13',
    releaseNotes: ['fixture'],
    channel,
    commitSha: '0123456789abcdef',
    commitShortSha: '0123456',
    packageFile: `KK-Studio-Portable-${artifactVersion}-s${releaseSequence}.zip`,
    downloadUrl: `https://updates.example/${channel}/KK-Studio-Portable-${artifactVersion}-s${releaseSequence}.zip`,
    sha256: 'a'.repeat(64),
    size: 12,
  };
  return {
    ...envelope,
    envelopeHash: computePortablePublicationEnvelopeHash(envelope),
  };
}

function withCanonicalEnvelopeHash<T extends Record<string, unknown>>(envelope: T) {
  const { envelopeHash: _ignored, ...hashableEnvelope } = envelope;
  return {
    ...hashableEnvelope,
    envelopeHash: computePortablePublicationEnvelopeHash(hashableEnvelope),
  };
}

async function evaluateTransition(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  expectedChannel: string,
  acceptedState?: Record<string, unknown>,
) {
  const fixtureDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kk-update-policy-'));
  const localPath = path.join(fixtureDir, 'local.json');
  const remotePath = path.join(fixtureDir, 'remote.json');
  const statePath = path.join(fixtureDir, 'state.json');
  await fs.promises.writeFile(localPath, JSON.stringify(local));
  await fs.promises.writeFile(remotePath, JSON.stringify(remote));
  if (acceptedState) await fs.promises.writeFile(statePath, JSON.stringify(acceptedState));

  const args = [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', RUNNER_PATH,
    '-PolicyPath', POLICY_PATH,
    '-LocalManifestPath', localPath,
    '-RemoteManifestPath', remotePath,
    '-ExpectedChannel', expectedChannel,
  ];
  if (acceptedState) args.push('-AcceptedStatePath', statePath);
  const result = spawnSync('powershell.exe', args, { cwd: ROOT_DIR, encoding: 'utf8' });
  await fs.promises.rm(fixtureDir, { recursive: true, force: true });
  return result;
}

test('Portable update policy compares prerelease SemVer without System.Version', { skip: WINDOWS_ONLY }, async () => {
  const result = await evaluateTransition(
    localManifest('1.7.0-rc.8', 8, 'release-candidate'),
    remoteManifest('1.7.0-rc.9', 9, 'release-candidate'),
    'release-candidate',
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /accepted/);
});

test('Portable update policy accepts a corrected stable build only with a higher sequence', { skip: WINDOWS_ONLY }, async () => {
  const result = await evaluateTransition(
    localManifest('1.7.0', 10, 'stable'),
    remoteManifest('1.7.0', 11, 'stable'),
    'stable',
  );
  assert.equal(result.status, 0, result.stderr);
});

test('Portable update policy enforces the deterministic phase artifact mapping', { skip: WINDOWS_ONLY }, async () => {
  const cases = [
    ['development', '1.7.0-alpha.0.3', '1.7.0-alpha.1.3'],
    ['internal', '1.7.0-alpha.1.4', '1.7.0-alpha.0.4'],
    ['canary', '1.7.0-beta.5', '1.7.0-rc.5'],
    ['release-candidate', '1.7.0-rc.6', '1.7.0-beta.6'],
    ['stable', '1.7.0', '1.7.0-rc.7'],
  ] as const;

  for (const [channel, expectedArtifact, mismatchedArtifact] of cases) {
    const artifactParts = expectedArtifact.split('.');
    const sequence = Number(artifactParts[artifactParts.length - 1]) || 7;
    const localSequence = Math.max(0, sequence - 1);
    const localArtifact = channel === 'stable'
      ? '1.7.0'
      : expectedArtifact.replace(/\d+$/, String(localSequence));
    const valid = await evaluateTransition(
      localManifest(localArtifact, localSequence, channel),
      remoteManifest(expectedArtifact, sequence, channel),
      channel,
    );
    assert.equal(valid.status, 0, `${channel}: ${valid.stderr}`);

    const invalidEnvelope = remoteManifest(expectedArtifact, sequence, channel);
    const invalid = await evaluateTransition(
      localManifest(localArtifact, localSequence, channel),
      withCanonicalEnvelopeHash({ ...invalidEnvelope, artifactVersion: mismatchedArtifact }),
      channel,
    );
    assert.equal(invalid.status, 17, `${channel} should reject mismatched artifactVersion`);
    assert.match(invalid.stderr, /artifactVersion/i);
  }
});

test('Portable update policy rejects tampering covered by the canonical envelope hash', { skip: WINDOWS_ONLY }, async () => {
  const local = localManifest('1.7.0', 10, 'stable');
  const validRemote = remoteManifest('1.7.0', 11, 'stable');
  const tamperedManifests = [
    { ...validRemote, channel: 'canary', releasePhase: 'canary', artifactVersion: '1.7.0-beta.11' },
    { ...validRemote, downloadUrl: 'https://updates.example/stable/replaced.zip' },
    { ...validRemote, size: 13 },
    { ...validRemote, sha256: 'c'.repeat(64) },
    { ...validRemote, releaseSequence: 12 },
    { ...validRemote, envelopeHash: 'd'.repeat(64) },
  ];

  for (const tampered of tamperedManifests) {
    const result = await evaluateTransition(local, tampered, 'stable');
    assert.equal(result.status, 17, `tampered manifest should fail: ${JSON.stringify(tampered)}`);
  }
});

test('Portable update policy rejects wrong channels, downgrades, and replay', { skip: WINDOWS_ONLY }, async () => {
  const wrongChannel = await evaluateTransition(
    localManifest('1.7.0', 10, 'stable'),
    remoteManifest('1.7.0-beta.11', 11, 'canary'),
    'stable',
  );
  assert.equal(wrongChannel.status, 17);
  assert.match(wrongChannel.stderr, /channel/i);

  const downgrade = await evaluateTransition(
    localManifest('1.7.0-rc.9', 9, 'release-candidate'),
    withCanonicalEnvelopeHash({
      ...remoteManifest('1.7.0-rc.10', 10, 'release-candidate'),
      releaseTarget: '1.6.9',
      artifactVersion: '1.6.9-rc.10',
    }),
    'release-candidate',
  );
  assert.equal(downgrade.status, 17);
  assert.match(downgrade.stderr, /downgrade/i);

  const replay = await evaluateTransition(
    localManifest('1.7.0-rc.8', 8, 'release-candidate'),
    remoteManifest('1.7.0-rc.9', 9, 'release-candidate'),
    'release-candidate',
    {
      channel: 'release-candidate',
      releaseTarget: '1.7.0',
      releaseSequence: 9,
      artifactVersion: '1.7.0-rc.9',
      artifactSha256: 'c'.repeat(64),
      envelopeHash: 'd'.repeat(64),
    },
  );
  assert.equal(replay.status, 17);
  assert.match(replay.stderr, /replay|accepted sequence/i);
});

test('the real Portable updater installs a corrected stable sequence and persists acceptance', { skip: WINDOWS_ONLY }, async (context) => {
  const fixtureDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kk-updater-e2e-'));
  context.after(async () => fs.promises.rm(fixtureDir, { recursive: true, force: true }));
  const releaseRoot = path.join(fixtureDir, 'KK Studio Portable');
  const configPath = path.join(releaseRoot, 'support', 'update-config.json');
  const remotePath = path.join(fixtureDir, 'remote-manifest.json');
  const archivePath = path.join(fixtureDir, 'update.zip');
  const installedManifestPath = path.join(releaseRoot, 'app', 'dist', 'app-version.json');
  const installedUpdaterPath = path.join(releaseRoot, 'support', 'portable-self-update.ps1');
  const local = localManifest('1.7.0', 10, 'stable');
  const packaged = localManifest('1.7.0', 11, 'stable');
  await fs.promises.mkdir(path.dirname(installedManifestPath), { recursive: true });
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.copyFile(POLICY_PATH, path.join(releaseRoot, 'support', 'portable-update-policy.ps1'));
  await fs.promises.copyFile(UPDATER_PATH, installedUpdaterPath);
  await fs.promises.writeFile(installedManifestPath, JSON.stringify(local));
  await fs.promises.writeFile(configPath, JSON.stringify({
    enabled: true,
    channel: 'stable',
    manifestUrl: 'https://updates.example/stable/manifest.json',
  }));

  const zip = new JSZip();
  zip.file('app/dist/app-version.json', JSON.stringify(packaged));
  zip.file('runtime/node.exe', 'fixture');
  zip.file('support/process-launch.ps1', '# fixture');
  zip.file('support/portable-update-policy.ps1', await fs.promises.readFile(POLICY_PATH));
  zip.file('Start KK Studio.bat', '@echo off');
  const archive = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.promises.writeFile(archivePath, archive);
  const remote = withCanonicalEnvelopeHash({
    ...remoteManifest('1.7.0', 11, 'stable'),
    downloadUrl: 'https://updates.example/stable/KK-Studio-Portable-1.7.0-s11.zip',
    sha256: createHash('sha256').update(archive).digest('hex'),
    size: archive.byteLength,
  });
  await fs.promises.writeFile(remotePath, JSON.stringify(remote));

  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', UPDATER_RUNNER_PATH,
    '-UpdaterPath', installedUpdaterPath,
    '-ReleaseRoot', releaseRoot,
    '-ConfigPath', configPath,
    '-RemoteManifestPath', remotePath,
    '-ArchiveFixturePath', archivePath,
  ], { cwd: ROOT_DIR, encoding: 'utf8' });
  const updateLogPath = path.join(releaseRoot, 'logs', 'update.log');
  const updateLog = fs.existsSync(updateLogPath)
    ? await fs.promises.readFile(updateLogPath, 'utf8')
    : '';
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}\n${updateLog}`);
  const installed = JSON.parse(await fs.promises.readFile(installedManifestPath, 'utf8'));
  const accepted = JSON.parse(
    await fs.promises.readFile(path.join(releaseRoot, 'run', 'update-state.json'), 'utf8'),
  );
  assert.equal(installed.releaseSequence, 11);
  assert.equal(accepted.releaseSequence, 11);
  assert.equal(accepted.artifactSha256, remote.sha256);
  assert.equal(accepted.envelopeHash, remote.envelopeHash);
});
