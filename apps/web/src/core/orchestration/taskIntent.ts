import { AspectRatio, ImageSize } from '../../types';
import { BrowserTaskIntent as BaseBrowserTaskIntent } from '../../features/browser-assistant/browserAssistantTypes';

export type KKIntent =
  | GenerationIntent
  | BrowserTaskIntent
  | SlidesIntent
  | EcommerceIntent
  | CanvasIntent;

export interface GenerationIntent {
  type: 'generation';
  mediaType: 'image' | 'text' | 'video' | 'batch' | 'audio';
  modelId: string;
  prompt: string;
  params?: Record<string, any>;
  preferredKeyId?: string;
  requestId?: string;
  creditRouteSpecId?: string;
  creditRouteUnitId?: string;
}

export type BrowserTaskIntent = Partial<BaseBrowserTaskIntent> & {
  type?: 'browser';
  payload?: Record<string, any>;
};

export interface SlidesIntent {
  type: 'slides';
  topic: string;
  outlineText?: string;
  slideCount: number;
  stylePreset?: string;
}

export interface EcommerceIntent {
  type: 'ecommerce';
  productImageId: string;
  scenePrompt: string;
  batchSize: number;
  layoutTemplate?: string;
}

export interface CanvasIntent {
  type: 'canvas';
  action: 'create-node' | 'update-node' | 'group-nodes' | 'arrange-nodes';
  nodes: any[];
}
