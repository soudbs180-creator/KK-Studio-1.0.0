import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  getCanvasPerformanceProfile,
  getCanvasProjectSize,
  getCanvasZoomBand,
  shouldSimplifyCard,
  shouldThrottleEdges,
} from '../../src/canvas/performanceProfile.ts'

describe('canvas performance profile', () => {
  test('classifies project sizes using locked thresholds', () => {
    assert.equal(getCanvasProjectSize(79), 'normal')
    assert.equal(getCanvasProjectSize(80), 'large')
    assert.equal(getCanvasProjectSize(200), 'huge')
  })

  test('classifies zoom bands using locked thresholds', () => {
    assert.equal(getCanvasZoomBand(1), 'near')
    assert.equal(getCanvasZoomBand(0.5), 'mid')
    assert.equal(getCanvasZoomBand(0.2), 'tiny')
  })

  test('keeps normal near view fully detailed', () => {
    const profile = getCanvasPerformanceProfile({
      scale: 1,
      isInteracting: false,
      nodeCount: 50,
      connectionCount: 18,
      viewportWidth: 1440,
      viewportHeight: 900,
    })

    assert.equal(profile.projectSize, 'normal')
    assert.equal(profile.overscanBuffer, 900)
    assert.equal(profile.cardDetailLevel, 'full')
    assert.equal(profile.renderMode, 'standard')
    assert.equal(shouldSimplifyCard(profile), false)
    assert.equal(shouldThrottleEdges(profile), false)
  })

  test('downgrades overscan one tier during interaction', () => {
    const profile = getCanvasPerformanceProfile({
      scale: 1,
      isInteracting: true,
      nodeCount: 50,
      connectionCount: 18,
      viewportWidth: 1440,
      viewportHeight: 900,
    })

    assert.equal(profile.overscanBuffer, 500)
    assert.equal(profile.renderMode, 'interactive')
    assert.equal(shouldThrottleEdges(profile), true)
  })

  test('keeps near-view cards fully detailed during interaction on large canvases', () => {
    const profile = getCanvasPerformanceProfile({
      scale: 1,
      isInteracting: true,
      nodeCount: 120,
      connectionCount: 80,
      viewportWidth: 1440,
      viewportHeight: 900,
    })

    assert.equal(profile.projectSize, 'large')
    assert.equal(profile.overscanBuffer, 220)
    assert.equal(profile.cardDetailLevel, 'full')
    assert.equal(profile.renderMode, 'interactive')
  })

  test('uses compact detail for large mid zoom canvases', () => {
    const profile = getCanvasPerformanceProfile({
      scale: 0.6,
      isInteracting: false,
      nodeCount: 120,
      connectionCount: 80,
      viewportWidth: 1440,
      viewportHeight: 900,
    })

    assert.equal(profile.projectSize, 'large')
    assert.equal(profile.cardDetailLevel, 'compact')
    assert.equal(profile.edgeThrottleMs, 16)
    assert.equal(shouldSimplifyCard(profile), false)
    assert.equal(shouldThrottleEdges(profile), true)
  })

  test('uses thumbnail shells for tiny zoom regardless of project size', () => {
    const profile = getCanvasPerformanceProfile({
      scale: 0.2,
      isInteracting: false,
      nodeCount: 32,
      connectionCount: 12,
      viewportWidth: 1440,
      viewportHeight: 900,
    })

    assert.equal(profile.cardDetailLevel, 'thumbnail-shell')
    assert.equal(profile.renderMode, 'performance')
    assert.equal(shouldSimplifyCard(profile), true)
  })
})
