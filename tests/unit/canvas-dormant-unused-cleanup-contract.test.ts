import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



function readRelativeSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
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

  const pixiCanvasPath = path.join(ROOT_DIR, 'apps/web/src/components/canvas/PixiCanvas.tsx');
  assert.equal(existsSync(pixiCanvasPath), false);

  for (const sourceFile of listSourceFiles('apps/web/src')) {
    const source = readFileSync(sourceFile, 'utf-8');
    assert.doesNotMatch(source, /\b(PixiCanvas|preloadPixi|isPixiAvailable)\b/);
  }
});

test('dormant canvas support files do not retain compiler-proven unused destructures', () => {
  const pendingNodeSource = readRelativeSource('apps/web/src/components/canvas/PendingNode.tsx');

  assert.doesNotMatch(pendingNodeSource, /isMobile\s*=\s*false,\s*\n/);
  assert.doesNotMatch(pendingNodeSource, /sourcePosition,\s*\n\s*onDisconnect/);
  assert.doesNotMatch(pendingNodeSource, /const \[idleTime, setIdleTime\] = useState\(0\);/);
  assert.match(pendingNodeSource, /isMobile\?: boolean;/);
  assert.match(pendingNodeSource, /sourcePosition\?: \{ x: number; y: number \};/);
});
