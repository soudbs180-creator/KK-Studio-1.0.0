import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('dark canvas keeps the dot grid visible instead of collapsing into pure black', () => {
  const cssSource = readSource('src/index.css');

  assert.doesNotMatch(
    cssSource,
    /body\.dark-mode\s*\{[\s\S]*--bg-canvas:\s*#000000;/,
  );
  assert.doesNotMatch(
    cssSource,
    /body\.dark-mode\s*\{[\s\S]*--grid-dot:\s*rgba\(255,\s*255,\s*255,\s*0\.08\);/,
  );
});

test('canvas panning does not disable frosted card surfaces while zooming still keeps the fast-path fallback', () => {
  const cssSource = readSource('src/index.css');

  assert.doesNotMatch(
    cssSource,
    /\.canvas-container\.is-dragging\s+\[data-canvas-surface\][\s\S]*backdrop-filter:\s*none\s*!important;/,
  );
  assert.match(
    cssSource,
    /\.canvas-container\.is-zooming\s+\[data-canvas-surface\][\s\S]*backdrop-filter:\s*none\s*!important;/,
  );
});

test('prompt cards keep a denser frosted tint while dragging so glass does not read as transparent in motion', () => {
  const source = readSource('src/components/canvas/PromptNodeComponent.tsx');

  assert.match(
    source,
    /const promptGlassFill = isDragging\s*\?\s*'rgba\(20,\s*20,\s*24,\s*0\.62\)'\s*:\s*'rgba\(20,\s*20,\s*24,\s*0\.45\)';/,
  );
  assert.match(source, /backgroundColor:\s*promptGlassFill,/);
});

test('prompt cards avoid transform-focused will-change hints during drag so backdrop blur stays attached to the canvas', () => {
  const source = readSource('src/components/canvas/PromptNodeComponent.tsx');

  assert.doesNotMatch(
    source,
    /willChange:\s*isDragging\s*\?\s*'transform,\s*left,\s*top'\s*:\s*'auto'/,
  );
  assert.match(
    source,
    /willChange:\s*isDragging\s*\?\s*'left,\s*top'\s*:\s*'auto'/,
  );
});

test('canvas groups avoid transform-only will-change hints while dragging their frosted shells', () => {
  const source = readSource('src/components/canvas/CanvasGroupComponent.tsx');

  assert.doesNotMatch(
    source,
    /willChange:\s*isDragging\s*\?\s*'transform'\s*:\s*'auto'/,
  );
  assert.match(
    source,
    /willChange:\s*isDragging\s*\?\s*'width,\s*height'\s*:\s*'auto'/,
  );
});

test('canvas groups thicken both shell and label frosted fills while dragging to avoid a washed-out overlay', () => {
  const source = readSource('src/components/canvas/CanvasGroupComponent.tsx');

  assert.match(
    source,
    /const groupGlassFill = highlighted\s*\?\s*'rgba\(99,\s*102,\s*241,\s*0\.10\)'\s*:\s*isDragging\s*\?\s*'rgba\(20,\s*20,\s*24,\s*0\.18\)'\s*:\s*'rgba\(0,\s*0,\s*0,\s*0\.10\)';/,
  );
  assert.match(
    source,
    /const groupHeaderGlassFill = highlighted\s*\?\s*'rgba\(99,\s*102,\s*241,\s*0\.15\)'\s*:\s*isDragging\s*\?\s*'rgba\(20,\s*20,\s*24,\s*0\.62\)'\s*:\s*'rgba\(20,\s*20,\s*24,\s*0\.45\)';/,
  );
  assert.match(source, /backgroundColor:\s*groupGlassFill,/);
  assert.match(source, /backgroundColor:\s*groupHeaderGlassFill,/);
});
