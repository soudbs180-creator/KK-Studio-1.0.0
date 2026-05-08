import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, test } from 'node:test'
import type {
  ConnectorRenderSnapshot,
  UseConnectorRendererDeps,
  UseConnectorRendererResult,
} from '../../src/app/useConnectorRenderer.ts'

type ConnectorRendererPublicBoundary = {
  snapshot: ConnectorRenderSnapshot
  deps: UseConnectorRendererDeps
  result: UseConnectorRendererResult
}

const ROOT_DIR = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf8')
}

describe('canvas connector throttling contract', () => {
  test('connector renderer exposes explicit hook boundary types', () => {
    const hookSource = readSource('src/app/useConnectorRenderer.ts')
    const appSource = readSource('src/App.tsx')
    const boundaryIsTypechecked: ConnectorRendererPublicBoundary | null = null

    assert.equal(boundaryIsTypechecked, null)
    assert.match(hookSource, /export type ConnectorRenderSnapshot = \{/)
    assert.match(hookSource, /export interface UseConnectorRendererDeps \{/)
    assert.match(hookSource, /export interface UseConnectorRendererResult \{/)
    assert.doesNotMatch(appSource, /buildConnectorRenderSnapshot/)
    assert.doesNotMatch(appSource, /commitConnectorRenderSnapshot/)
    assert.doesNotMatch(appSource, /scheduleConnectorRenderSnapshot/)
  })

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
