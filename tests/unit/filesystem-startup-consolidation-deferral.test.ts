import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('workspace consolidation is deferred out of the startup load path', () => {
  const source = readSource('apps/web/src/services/storage/fileSystemService.ts');

  assert.match(source, /void this\.consolidateWorkspaceLayout\(handle, canvases, activeCanvasId\)/);
  assert.doesNotMatch(source, /await this\.consolidateWorkspaceLayout\(handle, canvases, activeCanvasId\)/);
});
