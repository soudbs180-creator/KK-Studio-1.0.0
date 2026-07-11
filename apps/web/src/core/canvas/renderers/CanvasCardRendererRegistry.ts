import React from 'react';
import type { CanvasCardKind as CanvasPresentationKind } from '@kk/shared';
import type { CanvasCardDetailLevel } from '../../../canvas/performanceProfile';

import ImageGenerationGroupRenderer from './ImageGenerationGroupRenderer';
import VideoGenerationGroupRenderer from './VideoGenerationGroupRenderer';
import UnknownCardRenderer from './UnknownCardRenderer';
import MultiImageGroupRenderer from './MultiImageGroupRenderer.tsx';

export type CanvasCardKind =
  | 'image-generation-group'
  | 'video-generation-group'
  | 'multi-image-group'
  | 'unknown-card';

export type CardDisplayPattern =
  | 'prompt-result-group'
  | 'standalone-task-card';

export interface CardRenderPolicy {
  kind: CanvasCardKind;
  displayPattern: CardDisplayPattern;
  hasMainCard: boolean;
  hasResultCards: boolean;
  atomicGroup: boolean;
  supportsFull: boolean;
  supportsCompact: boolean;
  supportsGhost: boolean;
  canRenderSkeleton: boolean;
  canRenderThumbnail: boolean;
  canRenderPreview: boolean;
}

export interface CanvasCardRenderContext<T = any> {
  item: T;
  detailLevel: CanvasCardDetailLevel;
  isSelected: boolean;
  highlighted: boolean;
  zoomScale: number;
  [key: string]: any;
}

export type CanvasCardRenderer = (context: CanvasCardRenderContext) => any;

class CanvasCardRendererRegistry {
  private renderers = new Map<CanvasCardKind, CanvasCardRenderer>();
  private policies = new Map<CanvasCardKind, CardRenderPolicy>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    const createPolicy = (
      kind: CanvasCardKind,
      pattern: CardDisplayPattern,
      overrides: Partial<CardRenderPolicy> = {}
    ): CardRenderPolicy => ({
      kind,
      displayPattern: pattern,
      hasMainCard: false,
      hasResultCards: false,
      atomicGroup: false,
      supportsFull: true,
      supportsCompact: true,
      supportsGhost: true,
      canRenderSkeleton: true,
      canRenderThumbnail: true,
      canRenderPreview: true,
      ...overrides,
    });

    this.register('image-generation-group', createPolicy('image-generation-group', 'prompt-result-group', { hasMainCard: true, hasResultCards: true, atomicGroup: true }), ImageGenerationGroupRenderer);
    this.register('video-generation-group', createPolicy('video-generation-group', 'prompt-result-group', { hasMainCard: true, hasResultCards: true, atomicGroup: true }), VideoGenerationGroupRenderer);
    this.register('multi-image-group', createPolicy('multi-image-group', 'prompt-result-group', { hasMainCard: true, hasResultCards: true, atomicGroup: true }), MultiImageGroupRenderer);
    this.register('unknown-card', createPolicy('unknown-card', 'standalone-task-card'), UnknownCardRenderer);
  }


  register(kind: CanvasCardKind, policy: CardRenderPolicy, renderer: CanvasCardRenderer) {
    this.renderers.set(kind, renderer);
    this.policies.set(kind, policy);
  }

  getRenderer(kind: CanvasCardKind): CanvasCardRenderer | undefined {
    return this.renderers.get(kind);
  }

  getPolicy(kind: CanvasCardKind): CardRenderPolicy | undefined {
    return this.policies.get(kind);
  }

  resolveCardKind(node: any): CanvasCardKind {
    if (!node || node.presentation?.kind === 'unknown') return 'unknown-card';
    const presentationKind = node.presentation?.kind as CanvasPresentationKind | undefined;
    if (presentationKind === 'multi-image') return 'multi-image-group';
    
    // According to GenerationMode (IMAGE=1, VIDEO=2, AUDIO=3, PPT=4, ECOMMERCE=5)
    const mode = node.mode;
    if (mode === 2 || mode === 'video') {
      return 'video-generation-group';
    }
    return 'image-generation-group';
  }

  resolveDisplayPattern(kind: CanvasCardKind): CardDisplayPattern {
    switch (kind) {
      case 'image-generation-group':
      case 'video-generation-group':
      case 'multi-image-group':
        return 'prompt-result-group';
      default:
        return 'standalone-task-card';
    }
  }
}

export const canvasCardRendererRegistry = new CanvasCardRendererRegistry();
