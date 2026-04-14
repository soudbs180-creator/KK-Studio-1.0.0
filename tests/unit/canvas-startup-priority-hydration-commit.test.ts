import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('Canvas startup commits prioritized generated previews before the full hydration pass finishes', () => {
  const source = readSource('src/context/CanvasContext.tsx');

  assert.match(source, /const generatedPreviewMap = new Map<string, string>\(\);/);
  assert.match(source, /if \(generatedPreviewMap\.size > 0\) \{\s*applyStartupHydratedImages\(generatedPreviewMap\);\s*\}/);
});
