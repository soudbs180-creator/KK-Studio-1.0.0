import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, test } from 'node:test'

const ROOT_DIR = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf8')
}

describe('canvas local performance trace contract', () => {
  test('App instruments prompt-group regroup layout recomputation', () => {
    const appSource = readSource('src/App.tsx')

    assert.match(
      appSource,
      /traceLocalPerformance\('canvas-interaction\.prompt-group-regroup-layouts', \(\) => \{/
    )
    assert.match(
      appSource,
      /activeLayoutStateCount: promptGroupLayoutEntries\.length/
    )
  })

  test('App instruments connector render snapshot rebuilds', () => {
    const appSource = readSource('src/App.tsx')

    assert.match(
      appSource,
      /traceLocalPerformance\('canvas-interaction\.connector-render-snapshot', \(\) => \{/
    )
    assert.match(
      appSource,
      /promptCount: visiblePromptNodes\.length,/
    )
    assert.match(
      appSource,
      /imageCount: visibleImageNodes\.length,/
    )
    assert.match(
      appSource,
      /workflowUtilityCount: visibleWorkflowUtilityNodes\.length,/
    )
  })
})
