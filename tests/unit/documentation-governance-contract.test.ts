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

test('reference architecture documents describe the current server and web topology', () => {
  const checkerSource = readSource('scripts/governance/architecture/check-docs-current-architecture.mjs');
  const routeTopology = readSource('docs/architecture/ROUTE_TOPOLOGY_AND_CONSOLIDATION.md');
  const databaseSchema = readSource('docs/architecture/DATABASE_SCHEMA.md');
  const databaseStructure = readSource('docs/architecture/DATABASE_STRUCTURE.md');
  const architectureSource = readSource('docs/architecture/NEW_ARCHITECTURE_SOURCE_OF_TRUTH.md');
  const activeSurfaces = readSource('docs/architecture/ACTIVE_UI_SURFACES.md');
  const deviceArchitecture = readSource('docs/architecture/DEVICE_UI_ARCHITECTURE.md');
  const capabilityMatrix = readSource('docs/governance/SOURCE_CAPABILITY_MATRIX.md');

  for (const guardedDocument of [
    'ROUTE_TOPOLOGY_AND_CONSOLIDATION.md',
    'DATABASE_SCHEMA.md',
    'DATABASE_STRUCTURE.md',
    'NEW_ARCHITECTURE_SOURCE_OF_TRUTH.md',
    'ACTIVE_UI_SURFACES.md',
    'DEVICE_UI_ARCHITECTURE.md',
    'SOURCE_CAPABILITY_MATRIX.md',
  ]) {
    assert.match(checkerSource, new RegExp(guardedDocument.replace(/\./g, '\\.')));
  }

  assert.match(routeTopology, /services\/api\/routes\/api\.js/);
  assert.match(routeTopology, /services\/api\/routes\/user\/(?:auth|profile|wuyin)\.js/);
  assert.doesNotMatch(routeTopology, /user\.js\(98KB\)|user \(legacy\).*98KB/);

  assert.match(databaseSchema, /generation_image_worker_leases/);
  assert.match(databaseStructure, /services\/api\/routes\/user\/auth\.js/);
  assert.match(databaseStructure, /services\/api\/routes\/user\/profile\.js/);
  assert.match(databaseStructure, /services\/api\/routes\/user\/wuyin\.js/);

  assert.match(architectureSource, /services\/api\/lib\/generation-v3\/routeEngine\.js/);
  assert.match(architectureSource, /浏览器.*投影|投影.*浏览器/s);
  assert.match(activeSurfaces, /apps\/web\/src\/components\/mobile\/index\.ts/);
  assert.match(deviceArchitecture, /apps\/web\/src\/components\/layout\/PromptBar\.tsx/);

  assert.match(capabilityMatrix, /local-runner build\/typecheck 已纳入 verify:changes/);
  assert.doesNotMatch(capabilityMatrix, /local-runner 独立构建未入 release 验证/);
});
