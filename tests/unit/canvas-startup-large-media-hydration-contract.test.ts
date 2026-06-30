import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('large canvas startup does not recover every generated image in the background', () => {
  const source = readSource('apps/web/src/context/CanvasContext.tsx');
  const hydrationSource = source.slice(
    source.indexOf('const applyStartupHydratedImages'),
    source.indexOf('const hydrateStartupPreviewImages')
  );

  assert.match(source, /STARTUP_GENERATED_PREVIEW_LIMIT/);
  assert.match(source, /const LARGE_CANVAS_DATA_URL_MIGRATION_NODE_THRESHOLD = 1000;/);
  assert.match(source, /const LARGE_CANVAS_STARTUP_DATA_URL_MIGRATION_LIMIT = 5;/);
  assert.match(source, /const LARGE_CANVAS_DATA_URL_MIGRATION_DELAY_MS = 30000;/);
  assert.match(source, /const LARGE_CANVAS_DATA_URL_MIGRATION_BATCH_SIZE = 1;/);
  assert.match(source, /generatedPreviewMap/);
  assert.match(source, /applyStartupHydratedImages\(generatedPreviewMap\)/);
  assert.match(source, /skippedGeneratedHydrationCount/);
  assert.match(source, /const startupCanvasNodeCount = startupState\.canvases\.reduce/);
  assert.match(source, /const isLargeStartupCanvas = startupCanvasNodeCount > LARGE_CANVAS_DATA_URL_MIGRATION_NODE_THRESHOLD;/);
  assert.match(source, /const startupDataUrlMigrationLimit = isLargeStartupCanvas[\s\S]*LARGE_CANVAS_STARTUP_DATA_URL_MIGRATION_LIMIT[\s\S]*STARTUP_DATA_URL_MIGRATION_LIMIT;/);
  assert.match(source, /Large canvas data URL migration scheduled after startup/);
  assert.match(source, /LARGE_CANVAS_DATA_URL_MIGRATION_DELAY_MS/);
  assert.match(hydrationSource, /let stateChanged = false;/);
  assert.match(hydrationSource, /return img;/);
  assert.match(hydrationSource, /return pn;/);

  assert.doesNotMatch(source, /remainingGeneratedIds/);
  assert.doesNotMatch(source, /recovering the remaining/);
  assert.doesNotMatch(source, /background generated images/);
  assert.doesNotMatch(source, /concat\(remainingGeneratedIds\)/);
  assert.doesNotMatch(hydrationSource, /setState\(prev => \(\{\s*\.\.\.prev,\s*canvases: prev\.canvases\.map/);
});
