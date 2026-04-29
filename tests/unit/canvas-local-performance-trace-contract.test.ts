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
    const promptGroupLayoutSource = readSource('src/app/usePromptGroupLayout.ts')

    assert.match(
      promptGroupLayoutSource,
      /traceLocalPerformance\('canvas-interaction\.prompt-group-regroup-layouts', \(\) => \{/
    )
    assert.match(
      promptGroupLayoutSource,
      /activeLayoutStateCount: promptGroupLayoutEntries\.length/
    )
  })

  test('App instruments connector render snapshot rebuilds', () => {
    const hookSource = readSource('src/app/useConnectorRenderer.ts')

    assert.match(
      hookSource,
      /traceLocalPerformance\('canvas-interaction\.connector-render-snapshot', \(\) => \{/
    )
    assert.match(
      hookSource,
      /promptCount: visiblePromptNodes\.length,/
    )
    assert.match(
      hookSource,
      /imageCount: visibleImageNodes\.length,/
    )
    assert.match(
      hookSource,
      /workflowUtilityCount: visibleWorkflowUtilityNodes\.length,/
    )
  })
})
