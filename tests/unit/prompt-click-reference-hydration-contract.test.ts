import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8').replace(/\r\n/g, '\n');
}

test('handlePromptClick switches the composer before any reference-image hydration work', () => {
  const appSource = readSource('src/App.tsx');
  const handlePromptClickIndex = appSource.indexOf(
    'const handlePromptClick = useCallback((clickedNode: PromptNode, isOptimizedView?: boolean) => {',
  );
  const sharedActionPropsIndex = appSource.indexOf(
    'const getSharedPromptNodeActionProps = useCallback((node: PromptNode): SharedPromptNodeActionProps => ({',
  );

  assert.notEqual(handlePromptClickIndex, -1, 'expected App.tsx to declare handlePromptClick');
  assert.notEqual(sharedActionPropsIndex, -1, 'expected App.tsx to declare shared prompt action props');

  const handlePromptClickSource = appSource.slice(handlePromptClickIndex, sharedActionPropsIndex);

  assert.match(
    handlePromptClickSource,
    /referenceImages: clickedNode\.referenceImages \|\| \[\],/,
  );
  assert.doesNotMatch(
    handlePromptClickSource,
    /await import\('\.\/services\/storage\/imageStorage'\)/,
  );
  assert.doesNotMatch(
    handlePromptClickSource,
    /Promise\.all\(referenceImages\.map/,
  );
});

test('reference thumbnails render a lightweight skeleton while missing image data hydrates in the background', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');

  assert.match(
    promptBarSource,
    /if \(loading \|\| !data\) \{\s*return \(\s*<div[\s\S]*?aria-label="reference-thumbnail-skeleton"/,
  );
  assert.match(
    promptBarSource,
    /animate-pulse/,
  );
});
