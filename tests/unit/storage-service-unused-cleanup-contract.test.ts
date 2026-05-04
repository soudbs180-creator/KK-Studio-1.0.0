import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('storage adapter does not retain compiler-proven unused OPFS import or promise reject parameter', () => {
  const adapterSource = readSource('src/services/storage/storageAdapter.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/storage-service-unused-cleanup-contract\.test\.ts/);
  assert.doesNotMatch(adapterSource, /\bcompressIfNeeded\b/);
  assert.doesNotMatch(adapterSource, /new Promise\(\(resolve, reject\) => \{/);
  assert.match(adapterSource, /async function getImageDimensionsFromFile\(file: File\): Promise<\{ width: number; height: number \}>/);
  assert.match(adapterSource, /return new Promise\(\(resolve\) => \{/);
  assert.match(adapterSource, /img\.onerror = \(\) => \{\s*URL\.revokeObjectURL\(url\);\s*\/\/ 默认尺寸\s*resolve\(\{ width: 1024, height: 1024 \}\);/);
});

test('storage preference keeps local-folder save arity while making the unused prompt parameter explicit', () => {
  const preferenceSource = readSource('src/services/storage/storagePreference.ts');

  assert.match(preferenceSource, /export async function saveOriginalToLocalFolder\(\s*imageId: string,\s*blob: Blob,\s*_prompt\?: string,\s*existingTimestamp\?: number\s*\): Promise<boolean>/);
  assert.doesNotMatch(preferenceSource, /\bprompt\?: string,/);
  assert.match(preferenceSource, /await saveOriginalToLocalFolder\(id, blob, undefined, timestamp\);/);
  assert.match(preferenceSource, /const filename = `\$\{year\}-\$\{month\}-\$\{imageId\}\.png`;/);
});
