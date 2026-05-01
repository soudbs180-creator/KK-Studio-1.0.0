import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('PPT runtime ordering helpers merge childImageIds with parentPromptId fallback', () => {
  const helperSource = readSource('src/app/pptRuntimeHelpers.ts');

  assert.match(helperSource, /function resolveOrderedPptImagesForPrompt\(/);
  assert.match(helperSource, /const safeImageNodes = imageNodes \|\| \[\];/);
  assert.match(helperSource, /\(promptNode\.childImageIds \|\| \[\]\)\.filter\(Boolean\)\.forEach/);
  assert.match(helperSource, /getPromptPptImageNodes\(safeImageNodes, promptNode\.id\)\.forEach\(pushImage\);/);
  assert.match(helperSource, /if \(seenIds\.has\(candidate\.id\)\) return;/);
});

test('PPT runtime helpers reject missing parent prompt and null canvas state', () => {
  const helperSource = readSource('src/app/pptRuntimeHelpers.ts');

  assert.match(helperSource, /const promptNode = canvas\.promptNodes\.find\(\(node\) => node\.id === target\.parentPromptId\);/);
  assert.match(helperSource, /if \(!promptNode \|\| promptNode\.mode !== GenerationMode\.PPT\) \{/);
  assert.match(helperSource, /if \(!imageNode\.parentPromptId \|\| !canvas\) \{/);
});

test('PPT runtime child image helper owns nullish image array guards', () => {
  const helperSource = readSource('src/app/pptRuntimeHelpers.ts');

  assert.match(helperSource, /promptNode: PromptNode \| undefined \| null/);
  assert.match(helperSource, /imageNodes: GeneratedImage\[\] \| undefined \| null/);
  assert.match(helperSource, /if \(!promptNode\) return \[\] as GeneratedImage\[\];/);
  assert.match(helperSource, /const safeImageNodes = imageNodes \|\| \[\];/);
});
