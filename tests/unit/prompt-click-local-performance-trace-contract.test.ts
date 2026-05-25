import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, test } from 'node:test'

const ROOT_DIR = process.cwd()



describe('prompt click local performance trace contract', () => {
  test('App instruments prompt-click selection handoff with local performance traces', () => {
    const appSource = readSource('src/App.tsx')

    assert.match(
      appSource,
      /import \{ traceLocalPerformance \} from '\.\/services\/system\/localPerformanceTrace';/
    )
    assert.match(
      appSource,
      /traceLocalPerformance\('canvas-interaction\.prompt-click', \(\) => \{/
    )
    assert.match(
      appSource,
      /referenceImageCount: clickedNode\.referenceImages\?\.length \|\| 0/
    )
  })

  test('PromptBar instruments reference thumbnail recovery from local storage', () => {
    const promptBarSource = readSource('src/components/layout/PromptBar.tsx')

    assert.match(
      promptBarSource,
      /import \{ traceLocalPerformance \} from '\.\.\/\.\.\/services\/system\/localPerformanceTrace';/
    )
    assert.match(
      promptBarSource,
      /const storageId = image\.storageId;/
    )
    assert.match(
      promptBarSource,
      /traceLocalPerformance\('prompt-bar\.reference-thumbnail-hydrate', \(\) => getImage\(storageId\), \{/
    )
    assert.match(
      promptBarSource,
      /storageId,/
    )
  })
})
