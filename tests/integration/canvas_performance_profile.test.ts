import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  getCanvasDeviceTier,
  getCanvasInteractionIdleRelaxationMs,
  getCanvasPerformanceProfile,
  getCanvasProjectSize,
  getCanvasTextSofteningProfile,
  getCanvasZoomBand,
  resolveCanvasInteractionPhase,
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

  test('derives device tiers from caller-provided hardware hints', () => {
    assert.equal(getCanvasDeviceTier({ hardwareConcurrency: 4, deviceMemory: 6 }), 'low')
    assert.equal(getCanvasDeviceTier({ hardwareConcurrency: 8, deviceMemory: 6 }), 'medium')
    assert.equal(getCanvasDeviceTier({ hardwareConcurrency: 16, deviceMemory: 8 }), 'high')
  })

  test('resolves interaction phases from explicit phases and legacy flags', () => {
    assert.equal(resolveCanvasInteractionPhase({ isInteracting: false }), 'idle')
    assert.equal(resolveCanvasInteractionPhase({ isInteracting: true }), 'pan')
    assert.equal(resolveCanvasInteractionPhase({ isInteracting: true, isDragging: true, isZooming: false }), 'pan')
    assert.equal(resolveCanvasInteractionPhase({ isInteracting: true, isDragging: true, isZooming: true }), 'zoom')
    assert.equal(resolveCanvasInteractionPhase({ interactionPhase: 'zoom', isInteracting: false }), 'zoom')
  })

  test('uses longer idle relaxation for zoom than pan on weaker devices', () => {
    assert.equal(getCanvasInteractionIdleRelaxationMs('idle', 'medium'), 0)
    assert.equal(getCanvasInteractionIdleRelaxationMs('pan', 'high'), 120)
    assert.equal(getCanvasInteractionIdleRelaxationMs('zoom', 'medium'), 220)
    assert.equal(getCanvasInteractionIdleRelaxationMs('zoom', 'low'), 280)
  })

  test('keeps normal near view fully detailed', () => {
    const profile = getCanvasPerformanceProfile({
      scale: 1,
      isInteracting: false,
      interactionPhase: 'idle',
      nodeCount: 50,
      connectionCount: 18,
      viewportWidth: 1440,
      viewportHeight: 900,
      hardwareConcurrency: 16,
      deviceMemory: 8,
    })

    assert.equal(profile.projectSize, 'normal')
    assert.equal(profile.deviceTier, 'high')
    assert.equal(profile.interactionPhase, 'idle')
    assert.equal(profile.overscanBuffer, 900)
    assert.equal(profile.overscanMode, 'wide')
    assert.equal(profile.cardDetailLevel, 'full')
    assert.equal(profile.edgeMode, 'full')
    assert.equal(profile.frameBudgetMs, 12)
    assert.equal(profile.detailHysteresisMs, 0)
    assert.equal(profile.renderMode, 'standard')
    assert.equal(shouldSimplifyCard(profile), false)
    assert.equal(shouldThrottleEdges(profile), false)
  })

  test('downgrades overscan one tier during interaction', () => {
    const profile = getCanvasPerformanceProfile({
      scale: 1,
      isInteracting: true,
      interactionPhase: 'pan',
      nodeCount: 50,
      connectionCount: 18,
      viewportWidth: 1440,
      viewportHeight: 900,
      hardwareConcurrency: 8,
      deviceMemory: 6,
    })

    assert.equal(profile.overscanBuffer, 500)
    assert.equal(profile.interactionPhase, 'pan')
    assert.equal(profile.overscanMode, 'tight')
    assert.equal(profile.edgeMode, 'throttled')
    assert.equal(profile.frameBudgetMs, 9)
    assert.equal(profile.detailHysteresisMs, 160)
    assert.equal(profile.renderMode, 'interactive')
    assert.equal(shouldThrottleEdges(profile), true)
  })

  test('keeps near-view cards fully detailed during interaction on large canvases', () => {
    const profile = getCanvasPerformanceProfile({
      scale: 1,
      isInteracting: true,
      interactionPhase: 'pan',
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
      interactionPhase: 'idle',
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
      isInteracting: true,
      interactionPhase: 'zoom',
      nodeCount: 240,
      connectionCount: 120,
      viewportWidth: 1440,
      viewportHeight: 900,
      hardwareConcurrency: 4,
      deviceMemory: 4,
    })

    assert.equal(profile.deviceTier, 'low')
    assert.equal(profile.cardDetailLevel, 'thumbnail-shell')
    assert.equal(profile.edgeMode, 'minimal')
    assert.equal(profile.overscanMode, 'tight')
    assert.equal(profile.frameBudgetMs, 5)
    assert.equal(profile.detailHysteresisMs, 280)
    assert.equal(profile.renderMode, 'performance')
    assert.equal(shouldSimplifyCard(profile), true)
    assert.equal(shouldThrottleEdges(profile), true)
  })

  test('progressively softens text from 100% to 50% zoom', () => {
    const fullScale = getCanvasTextSofteningProfile(1, true)
    const midScale = getCanvasTextSofteningProfile(0.75, true)
    const minimumScale = getCanvasTextSofteningProfile(0.5, true)

    assert.equal(fullScale.active, false)
    assert.equal(fullScale.primaryBlurPx, 0)
    assert.equal(fullScale.primaryOpacity, 1)

    assert.equal(midScale.active, true)
    assert.ok(midScale.primaryBlurPx > 0)
    assert.ok(midScale.primaryBlurPx < minimumScale.primaryBlurPx)
    assert.ok(midScale.secondaryBlurPx < minimumScale.secondaryBlurPx)
    assert.ok(midScale.primaryOpacity < 1)
    assert.ok(midScale.primaryOpacity > minimumScale.primaryOpacity)

    assert.equal(minimumScale.active, true)
    assert.equal(minimumScale.primaryBlurPx, 0.72)
    assert.equal(minimumScale.secondaryBlurPx, 0.96)
    assert.equal(minimumScale.primaryOpacity, 0.9)
    assert.equal(minimumScale.secondaryOpacity, 0.7)
  })

  test('disables text softening entirely when not requested', () => {
    const profile = getCanvasTextSofteningProfile(0.5, false)

    assert.equal(profile.active, false)
    assert.equal(profile.primaryBlurPx, 0)
    assert.equal(profile.secondaryBlurPx, 0)
    assert.equal(profile.primaryOpacity, 1)
    assert.equal(profile.secondaryOpacity, 1)
  })
})
