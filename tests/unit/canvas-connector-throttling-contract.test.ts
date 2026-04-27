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
    const appSource = readSource('src/App.tsx')

    assert.match(
      appSource,
      /const shouldThrottleConnectorSnapshot = canvasPerformanceProfile\.edgeMode !== 'full'\s*\|\|\s*canvasPerformanceProfile\.renderMode !== 'standard'/
    )
    assert.match(
      appSource,
      /const connectorSnapshotThrottleMs = shouldThrottleConnectorSnapshot\s*\?\s*canvasPerformanceProfile\.edgeThrottleMs\s*:\s*0/
    )
    assert.match(appSource, /window\.setTimeout\(\(\) => \{/)
  })

  test('App derives global connector render lists from the throttled snapshot ids', () => {
    const appSource = readSource('src/App.tsx')

    assert.match(
      appSource,
      /const connectorRenderPromptNodes = React\.useMemo\(\s*\(\) => connectorRenderSnapshot\.promptIds/
    )
    assert.match(
      appSource,
      /const connectorRenderVisibleImageNodes = React\.useMemo\(\s*\(\) => connectorRenderSnapshot\.imageIds/
    )
    assert.match(
      appSource,
      /const connectorRenderWorkflowUtilityNodesById = React\.useMemo\(\s*\(\) => new Map\(\s*connectorRenderSnapshot\.workflowUtilityIds/
    )
  })

  test('App resolves global connector geometry from the throttled snapshot positions', () => {
    const appSource = readSource('src/App.tsx')

    assert.match(appSource, /const resolveConnectorRenderPosition = useCallback\(/)
    assert.match(appSource, /connectorRenderSnapshot\.positionByNodeId\[nodeId\]/)
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
