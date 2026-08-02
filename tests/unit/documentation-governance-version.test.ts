import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'config/release-manifest.json'), 'utf8'),
) as { version: string; displayVersion?: string };
const displayVersion = manifest.displayVersion || `v${manifest.version}`;

test('documentation governance index follows the release manifest version', () => {
  const index = fs.readFileSync(
    path.join(root, 'docs/governance/DOCUMENTATION_INDEX.md'),
    'utf8',
  );

  assert.match(index, new RegExp(`active ${displayVersion} implementation`));
  assert.doesNotMatch(index, /active v1\.6\.0 implementation/);
});

test('documentation governance generator does not hardcode an old release version', () => {
  const generator = fs.readFileSync(
    path.join(root, 'scripts/governance/check-documentation-governance.mjs'),
    'utf8',
  );

  assert.match(generator, /activeDisplayVersion/);
  assert.doesNotMatch(generator, /active v1\.6\.0 implementation/);
});
