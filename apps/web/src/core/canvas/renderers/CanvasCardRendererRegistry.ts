import React from 'react';
import type { CanvasCardDetailLevel } from '../../../canvas/performanceProfile';

import ImageGenerationGroupRenderer from './ImageGenerationGroupRenderer';
import VideoGenerationGroupRenderer from './VideoGenerationGroupRenderer';
import EcommerceTaskCardRenderer from './EcommerceTaskCardRenderer';
import PptSlideCardRenderer from './PptSlideCardRenderer';
import PptDeckCardRenderer from './PptDeckCardRenderer';
import MusicTaskCardRenderer from './MusicTaskCardRenderer';
import BrowserTaskCardRenderer from './BrowserTaskCardRenderer';
import AssetCardRenderer from './AssetCardRenderer';
import WorkflowCardRenderer from './WorkflowCardRenderer';
import AgentCardRenderer from './AgentCardRenderer';
import ExportCardRenderer from './ExportCardRenderer';

export type CanvasCardKind =
  | 'image-generation-group'
  | 'video-generation-group'
  | 'ecommerce-task-card'
  | 'ppt-slide-card'
  | 'ppt-deck-card'
  | 'music-task-card'
  | 'browser-task-card'
  | 'asset-card'
  | 'workflow-card'
  | 'agent-card'
  | 'export-card';

export type CardDisplayPattern =
  | 'prompt-result-group'
  | 'standalone-task-card'
  | 'standalone-media-card'
  | 'multi-page-card'
  | 'workflow-utility-card';

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
    this.register('ecommerce-task-card', createPolicy('ecommerce-task-card', 'standalone-task-card'), EcommerceTaskCardRenderer);
    this.register('ppt-slide-card', createPolicy('ppt-slide-card', 'multi-page-card'), PptSlideCardRenderer);
    this.register('ppt-deck-card', createPolicy('ppt-deck-card', 'multi-page-card'), PptDeckCardRenderer);
    this.register('music-task-card', createPolicy('music-task-card', 'standalone-media-card'), MusicTaskCardRenderer);
    this.register('browser-task-card', createPolicy('browser-task-card', 'standalone-task-card'), BrowserTaskCardRenderer);
    this.register('asset-card', createPolicy('asset-card', 'standalone-media-card'), AssetCardRenderer);
    this.register('workflow-card', createPolicy('workflow-card', 'workflow-utility-card'), WorkflowCardRenderer);
    this.register('agent-card', createPolicy('agent-card', 'workflow-utility-card'), AgentCardRenderer);
    this.register('export-card', createPolicy('export-card', 'workflow-utility-card'), ExportCardRenderer);
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
    if (!node) return 'image-generation-group';
    
    // According to GenerationMode (IMAGE=1, VIDEO=2, AUDIO=3, PPT=4, ECOMMERCE=5)
    const mode = node.mode;
    if (mode === 5 || mode === 'ecommerce') {
      return 'ecommerce-task-card';
    }
    if (mode === 4 || mode === 'ppt') {
      return node.pptDeck ? 'ppt-deck-card' : 'ppt-slide-card';
    }
    if (mode === 3 || mode === 'audio' || mode === 'music') {
      return 'music-task-card';
    }
    if (mode === 2 || mode === 'video') {
      return 'video-generation-group';
    }
    if (node.kind === 'agent') {
      return 'agent-card';
    }
    if (node.kind === 'workflow') {
      return 'workflow-card';
    }
    return 'image-generation-group';
  }

  resolveDisplayPattern(kind: CanvasCardKind): CardDisplayPattern {
    switch (kind) {
      case 'image-generation-group':
      case 'video-generation-group':
        return 'prompt-result-group';
      case 'ecommerce-task-card':
      case 'music-task-card':
      case 'browser-task-card':
        return 'standalone-task-card';
      case 'ppt-deck-card':
      case 'ppt-slide-card':
        return 'multi-page-card';
      case 'agent-card':
      case 'workflow-card':
      case 'export-card':
        return 'workflow-utility-card';
      default:
        return 'prompt-result-group';
    }
  }
}

export const canvasCardRendererRegistry = new CanvasCardRendererRegistry();
