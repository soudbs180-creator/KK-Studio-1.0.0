import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, test } from 'node:test'

const ROOT_DIR = process.cwd()



describe('canvas startup local performance trace contract', () => {
  test('CanvasContext instruments startup restore phases with local performance traces', () => {
    const source = readSource('src/context/CanvasContext.tsx')

    assert.match(
      source,
      /import \{ traceLocalPerformance \} from '\.\.\/services\/system\/localPerformanceTrace';/
    )
    assert.match(
      source,
      /await traceLocalPerformance\('canvas-startup\.restore-total', async \(\) => \{/
    )
    assert.match(
      source,
      /const restoredState = traceLocalPerformance\('canvas-startup\.restore-local-state', \(\) => restoreCanvasStateFromLocalStorage\(STORAGE_KEY\)\);/
    )
    assert.match(
      source,
      /const startupImageHydrationPromise = traceLocalPerformance\('canvas-startup\.preview-hydration',\s*\(\)\s*=>\s*hydrateStartupPreviewImages\(startupState,\s*\(pct\)\s*=>\s*pushLoadingProgress\(pct\)\)\s*\);/
    )
    assert.match(
      source,
      /setLoadingProgress\(prev => options\?\.reset \? normalizedProgress : Math\.max\(prev, normalizedProgress\)\);/
    )
    assert.match(
      source,
      /startupLoadRunIdRef\.current !== options\.runId/
    )
    assert.match(
      source,
      /const handle = await traceLocalPerformance\('canvas-startup\.restore-folder-handle', \(\) => getLocalFolderHandle\(\)\);/
    )
    assert.match(
      source,
      /const projectLoadPromise = traceLocalPerformance\('canvas-startup\.disk-project-load', \(\) => fileSystemService\.loadProjectWithThumbs\(handle\)\);/
    )
    assert.match(
      source,
      /const referenceImageLoadPromise = traceLocalPerformance\('canvas-startup\.reference-image-load', \(\) => fileSystemService\.loadAllReferenceImages\(handle\)\);/
    )
  })

  test('local performance trace helper keeps bounded local-only records', () => {
    const source = readSource('src/services/system/localPerformanceTrace.ts')

    assert.match(source, /const GLOBAL_PERF_TRACE_KEY = '__KK_PERF__'/)
    assert.match(source, /const MAX_LOCAL_PERFORMANCE_MEASURES = 120/)
    assert.match(source, /export function traceLocalPerformance<T>\(/)
    assert.match(source, /records\.slice\(-MAX_LOCAL_PERFORMANCE_MEASURES\)/)
  })
})
