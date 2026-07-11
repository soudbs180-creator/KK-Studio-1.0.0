import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('Card Ghost and Skeleton states stay interactive and lightweight', () => {
  const renderers = [
    'ImageGenerationGroupRenderer.tsx',
    'VideoGenerationGroupRenderer.tsx',
    'BrowserTaskCardRenderer.tsx',
    'AssetCardRenderer.tsx',
    'WorkflowCardRenderer.tsx',
    'AgentCardRenderer.tsx',
    'ExportCardRenderer.tsx',
  ];
  for (const filename of renderers) {
    const source = fs.readFileSync(path.resolve(`apps/web/src/core/canvas/renderers/${filename}`), 'utf8');
    assert.match(source, /ghost/);
    assert.match(source, /skeleton/);
    if (source.includes("detailLevel === 'skeleton'")) {
      const skeletonBlock = source.split("detailLevel === 'skeleton'")[1].split('}')[0];
      assert.doesNotMatch(skeletonBlock, /transition-all|backdrop-blur|backdropFilter/);
    }
  }

  const shellSource = fs.readFileSync(path.resolve('apps/web/src/components/canvas/CanvasCardShell.tsx'), 'utf8');
  assert.match(shellSource, /detailLevel === 'ghost' \|\| detailLevel === 'skeleton'/);
  assert.match(shellSource, /data-detail-level=\{detailLevel\}/);
  assert.doesNotMatch(shellSource, /pointer-events-none/);
});
