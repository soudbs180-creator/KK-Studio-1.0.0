import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, test } from 'node:test'

const ROOT_DIR = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf8')
}

describe('canvas connector throttling contract', () => {
  test('App throttles connector snapshots from the performance profile', () => {
    const hookSource = readSource('src/app/useConnectorRenderer.ts')

    assert.match(
      hookSource,
      /const shouldThrottleConnectorSnapshot = canvasPerformanceProfile\.edgeMode !== 'full'\s*\|\|\s*canvasPerformanceProfile\.renderMode !== 'standard'/
    )
    assert.match(
      hookSource,
      /const connectorSnapshotThrottleMs = shouldThrottleConnectorSnapshot\s*\?\s*canvasPerformanceProfile\.edgeThrottleMs\s*:\s*0/
    )
    assert.match(hookSource, /window\.setTimeout\(\(\) => \{/)
  })

  test('App derives global connector render lists from the throttled snapshot ids', () => {
    const hookSource = readSource('src/app/useConnectorRenderer.ts')

    assert.match(
      hookSource,
      /const connectorRenderPromptNodes = React\.useMemo\(\s*\(\) => connectorRenderSnapshot\.promptIds/
    )
    assert.match(
      hookSource,
      /const connectorRenderVisibleImageNodes = React\.useMemo\(\s*\(\) => connectorRenderSnapshot\.imageIds/
    )
    assert.match(
      hookSource,
      /const connectorRenderWorkflowUtilityNodesById = React\.useMemo\(\s*\(\) => new Map\(\s*connectorRenderSnapshot\.workflowUtilityIds/
    )
  })

  test('App resolves global connector geometry from the throttled snapshot positions', () => {
    const hookSource = readSource('src/app/useConnectorRenderer.ts')
    const appSource = readSource('src/App.tsx')

    assert.match(hookSource, /const resolveConnectorRenderPosition = useCallback\(/)
    assert.match(hookSource, /connectorRenderSnapshot\.positionByNodeId\[nodeId\]/)
    assert.match(
      appSource,
      /const sourcePosition = resolveConnectorRenderPosition\(sourceNode\.id, sourceNode\.position\);/
    )
    assert.match(
      appSource,
      /const promptPosition = resolveConnectorRenderPosition\(pn\.id, pn\.position\);/
    )
    assert.match(
      appSource,
      /const targetPosition = resolveConnectorRenderPosition\(targetNode\.id, targetNode\.position\);/
    )
  })
})
