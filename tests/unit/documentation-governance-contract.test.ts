import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { readSource } from '../support/workspacePaths.js';

test('documentation governance indexes hidden Agent docs and active Markdown', () => {
  const packageSource = readSource('package.json');
  const checkerSource = readSource('scripts/governance/check-documentation-governance.mjs');
  const indexSource = readSource('docs/governance/DOCUMENTATION_INDEX.md');

  assert.match(packageSource, /"governance:docs":\s*"node scripts\/governance\/check-documentation-governance\.mjs"/);
  assert.match(packageSource, /"governance:check":[^\n]+governance:docs/);
  assert.doesNotMatch(checkerSource, /ignoredDirectories[\s\S]{0,300}["']\.agents["']/);
  assert.match(checkerSource, /pending-archive/);
  assert.match(indexSource, /`\.agents\/AGENTS\.md`/);
  assert.match(indexSource, /## Conflict \(0\)/);

  const result = spawnSync(process.execPath, ['scripts/governance/check-documentation-governance.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
