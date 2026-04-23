import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, test } from 'node:test'

import {
  buildPromptGroupLiveSceneSnapshot,
  getRegroupTransitionProgress,
  resolveLiveSceneNodePosition,
  type LiveSceneSnapshot,
  type PromptGroupLayoutMode,
} from '../../src/canvas/liveScene.ts'

const ROOT_DIR = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf8')
}

describe('canvas live scene contract', () => {
  test('expanded mode keeps child render positions on logical positions', () => {
    const snapshot = buildPromptGroupLiveSceneSnapshot({
      promptId: 'prompt-1',
      promptPosition: { x: 320, y: 240 },
      childNodes: [
        {
          id: 'image-a',
          logicalPosition: { x: 220, y: 430 },
          dockedPosition: { x: 320, y: 360 },
        },
        {
          id: 'image-b',
          logicalPosition: { x: 420, y: 430 },
          dockedPosition: { x: 320, y: 520 },
        },
      ],
      layoutMode: 'expanded',
      regroupProgress: 0,
      interactionPhase: 'idle',
      liveNodePositionById: {
        'prompt-1': { x: 320, y: 240 },
        'image-a': { x: 220, y: 430 },
        'image-b': { x: 420, y: 430 },
      },
    })

    assert.equal(snapshot.promptGroups['prompt-1']?.layoutMode, 'expanded')
    assert.deepEqual(
      snapshot.promptGroups['prompt-1']?.childRenderPositionsById['image-a'],
      { x: 220, y: 430 },
    )
    assert.deepEqual(resolveLiveSceneNodePosition(snapshot, 'image-b', { x: 0, y: 0 }), { x: 420, y: 430 })
  })

  test('regrouping mode interpolates child render positions toward docked positions', () => {
    const snapshot = buildPromptGroupLiveSceneSnapshot({
      promptId: 'prompt-1',
      promptPosition: { x: 320, y: 240 },
      childNodes: [
        {
          id: 'image-a',
          logicalPosition: { x: 200, y: 420 },
          dockedPosition: { x: 320, y: 360 },
        },
      ],
      layoutMode: 'regrouping',
      regroupProgress: 0.5,
      interactionPhase: 'node-drag',
      liveNodePositionById: {
        'prompt-1': { x: 320, y: 240 },
        'image-a': { x: 200, y: 420 },
      },
    })

    const renderPosition = snapshot.promptGroups['prompt-1']?.childRenderPositionsById['image-a']
    assert.ok(renderPosition)
    assert.notDeepEqual(renderPosition, { x: 200, y: 420 })
    assert.notDeepEqual(renderPosition, { x: 320, y: 360 })
    assert.ok(renderPosition!.x > 200)
    assert.ok(renderPosition!.y < 420)
    assert.deepEqual(resolveLiveSceneNodePosition(snapshot, 'image-a', { x: 0, y: 0 }), renderPosition)
  })

  test('docked mode resolves node positions from docked render state before live fallback', () => {
    const snapshot: LiveSceneSnapshot = buildPromptGroupLiveSceneSnapshot({
      promptId: 'prompt-1',
      promptPosition: { x: 320, y: 240 },
      childNodes: [
        {
          id: 'image-a',
          logicalPosition: { x: 180, y: 420 },
          dockedPosition: { x: 320, y: 360 },
        },
      ],
      layoutMode: 'docked',
      regroupProgress: 1,
      interactionPhase: 'regroup-settle',
      liveNodePositionById: {
        'prompt-1': { x: 320, y: 240 },
        'image-a': { x: 180, y: 420 },
      },
    })

    assert.equal(snapshot.promptGroups['prompt-1']?.layoutMode, 'docked')
    assert.deepEqual(resolveLiveSceneNodePosition(snapshot, 'image-a', { x: 0, y: 0 }), { x: 320, y: 360 })
    assert.deepEqual(resolveLiveSceneNodePosition(snapshot, 'prompt-1', { x: 0, y: 0 }), { x: 320, y: 240 })
  })

  test('regroup transition progress uses fast-then-slow easing', () => {
    const low = getRegroupTransitionProgress(0.15)
    const mid = getRegroupTransitionProgress(0.5)
    const high = getRegroupTransitionProgress(0.85)

    assert.ok(low > 0.15)
    assert.ok(mid > low)
    assert.ok(high > mid)
    assert.ok(high < 1)
  })

  test('App uses live scene state instead of connector snapshot state', () => {
    const appSource = readSource('src/App.tsx')

    assert.match(appSource, /liveSceneRef/)
    assert.match(appSource, /liveSceneState/)
    assert.match(appSource, /liveNodePositionVersion/)
    assert.match(appSource, /promptGroupLayoutVersion/)
    assert.doesNotMatch(appSource, /const \[liveNodePositionById, setLiveNodePositionById\] = useState/)
    assert.doesNotMatch(appSource, /connectorPromptNodes/)
    assert.doesNotMatch(appSource, /connectorVisibleImageNodes/)
    assert.doesNotMatch(appSource, /connectorPendingSnapshotRef/)
  })

  test('App tracks prompt-group regrouping states explicitly', () => {
    const appSource = readSource('src/App.tsx')

    assert.match(appSource, /layoutMode:\s*'expanded'\s*\|\s*'regrouping'\s*\|\s*'docked'/)
    assert.match(appSource, /regroupProgress/)
    assert.match(appSource, /onDragCommit/)
    assert.match(appSource, /promptGroupRegroupLayoutsById/)
    assert.equal(appSource.match(/buildPromptGroupRegroupLayouts\(/g)?.length ?? 0, 1)
  })

  test('card components expose drag commit callbacks for final persistence', () => {
    const promptSource = readSource('src/components/canvas/PromptNodeComponent.tsx')
    const imageSource = readSource('src/components/image/ImageCard2.tsx')

    assert.match(promptSource, /onDragCommit\?:/)
    assert.match(promptSource, /onDragCommitRef/)
    assert.match(imageSource, /onDragCommit\?:/)
    assert.match(imageSource, /onDragCommitRef\.current\?\.\(/)
  })

  test('draggable card surfaces scale from the bottom-center anchor to keep drag alignment stable', () => {
    const promptSource = readSource('src/components/canvas/PromptNodeComponent.tsx')
    const imageSource = readSource('src/components/image/ImageCard2.tsx')

    assert.match(promptSource, /data-canvas-surface="prompt"[\s\S]*transformOrigin:\s*'50% 100%'/)
    assert.match(imageSource, /data-canvas-surface="image"[\s\S]*transformOrigin:\s*'50% 100%'/)
    assert.doesNotMatch(promptSource, /data-canvas-surface="prompt"[\s\S]*transformOrigin:\s*'50% 50%'/)
    assert.doesNotMatch(imageSource, /data-canvas-surface="image"[\s\S]*transformOrigin:\s*'50% 50%'/)
  })
})
