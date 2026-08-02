import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
) as { scripts?: Record<string, string> };
const scripts = packageJson.scripts ?? {};

test('CodeGraph commands use the pinned CLI and project-local index path', () => {
  assert.equal(scripts.codegraph, 'npx --yes @colbymchenry/codegraph@1.5.0');
  assert.equal(scripts['codegraph:init'], 'npm run codegraph -- init .');
  assert.equal(scripts['codegraph:sync'], 'npm run codegraph -- sync .');
  assert.equal(scripts['codegraph:status'], 'npm run codegraph -- status .');
  assert.equal(scripts['codegraph:query'], 'npm run codegraph -- query');
  assert.equal(scripts['codegraph:explore'], 'npm run codegraph -- explore');
  assert.equal(scripts['codegraph:impact'], 'npm run codegraph -- impact');
  assert.equal(scripts['codegraph:affected'], 'npm run codegraph -- affected');
  assert.equal(
    scripts['codegraph:mcp:print'],
    'node scripts/maintenance/print-codegraph-mcp-config.mjs',
  );
});

test('CodeGraph MCP config uses the pinned npx launcher instead of an untracked global binary', () => {
  const configScript = fs.readFileSync(
    path.join(root, 'scripts/maintenance/print-codegraph-mcp-config.mjs'),
    'utf8',
  );

  assert.match(configScript, /command = "npx"/);
  assert.match(configScript, /codegraphVersion = '1\.5\.0'/);
  assert.match(configScript, /@colbymchenry\/codegraph@\$\{codegraphVersion\}/);
  assert.match(configScript, /"serve", "--mcp"/);
});

test('CodeGraph runtime data stays outside version control', () => {
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(gitignore, /^\.codegraph\/$/m);
});
