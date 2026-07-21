import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('agents:status fails closed when git is unavailable', () => {
  const repositoryRoot = process.cwd();
  const guardPath = path.join(repositoryRoot, 'scripts', 'maintenance', 'agent-sync-guard.mjs');
  const result = spawnSync(process.execPath, [guardPath, '--status'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: '',
      Path: '',
    },
  });

  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(output, /【干净】/);
  assert.match(output, /Git.*不可用|Git.*unavailable/i);
  assert.match(output, /PATH|安装|install/i);
});
