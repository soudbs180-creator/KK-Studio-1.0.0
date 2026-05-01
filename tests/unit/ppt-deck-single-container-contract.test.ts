import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('PPT prompt nodes expose a deck module state and stop rendering PPT child pages as canvas sub-cards', () => {
  const typesSource = readSource('src/types.ts');
  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/usePptRuntime.ts');
  const helperSource = readSource('src/app/pptRuntimeHelpers.ts');
  const promptNodeSource = readSource('src/components/canvas/PromptNodeComponent.tsx');
  const deckSource = readSource('src/utils/pptDeckModules.ts');

  assert.match(typesSource, /export interface PptDeckModuleState/);
  assert.match(typesSource, /export interface PptDeckPageModule/);
  assert.match(typesSource, /pptDeck\?: PptDeckModuleState/);

  assert.match(deckSource, /export const buildPptDeckModuleState =/);
  assert.match(hookSource, /const isPptDeckChildImageNode =/);
  assert.match(hookSource, /return isPptDeckChildImageNodeFromCanvas\(imageNode, activeCanvasRef\.current\);/);
  assert.match(helperSource, /if \(promptNode\.mode === GenerationMode\.PPT\) return \[\] as GeneratedImage\[\];/);
  assert.match(appSource, /if \(isPptDeckChildImageNode\(n\)\) \{\s*return false;\s*\}/);

  assert.match(promptNodeSource, /data-testid="ppt-deck-container"/);
  assert.match(promptNodeSource, /pptDeck\.pages\.slice\(0, 6\)\.map/);
  assert.doesNotMatch(
    promptNodeSource,
    /单页重生[\s\S]*Array\.from\(\{ length: Math\.min\(20, node\.childImageIds\.length\) \}\)/,
  );
});

test('PromptBar keeps the PPT workflow framed as topic to outline to page descriptions before generation', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');

  assert.match(promptBarSource, /主题 → 大纲 → 页面描述 → 生成前检查/);
  assert.match(promptBarSource, /Markdown \/ JSON 页纲导入/);
  assert.match(promptBarSource, /页面描述列表/);
  assert.match(promptBarSource, /生成前检查/);
});
