import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('Canvas startup begins preview hydration before local folder restore work', () => {
  const source = readSource('src/context/CanvasContext.tsx');

  const hydrationIndex = source.indexOf("'canvas-startup.preview-hydration'");
  const folderRestoreIndex = source.indexOf("'canvas-startup.restore-folder-handle'");

  assert.notEqual(hydrationIndex, -1);
  assert.notEqual(folderRestoreIndex, -1);
  assert.ok(
    hydrationIndex < folderRestoreIndex,
    'preview hydration should start before local folder restore so thumbnails can appear sooner',
  );
});
