import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(absolutePath: string): string {
  return readFileSync(absolutePath, 'utf-8');
}

function listSourceFiles(relativeDirectory: string): string[] {
  const directory = path.join(ROOT_DIR, relativeDirectory);
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(path.relative(ROOT_DIR, absolutePath)));
      continue;
    }

    if (/\.[cm]?[tj]sx?$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

test('dormant Pixi canvas renderer remains removed from source', () => {
  const testConfigSource = readFileSync(path.join(ROOT_DIR, 'tsconfig.tests.json'), 'utf-8');
  assert.match(testConfigSource, /tests\/unit\/canvas-dormant-unused-cleanup-contract\.test\.ts/);

  const pixiCanvasPath = path.join(ROOT_DIR, 'src/components/canvas/PixiCanvas.tsx');
  assert.equal(existsSync(pixiCanvasPath), false);

  for (const sourceFile of listSourceFiles('src')) {
    const source = readSource(sourceFile);
    assert.doesNotMatch(source, /\b(PixiCanvas|preloadPixi|isPixiAvailable)\b/);
  }
});
