import type { GeneratedImage, PromptNode, ReferenceImage } from '../../types';
import type { FileAsset, ImageAsset } from '../ai-takeover/types';

export type FavoriteKind = 'favorite-image' | 'favorite-prompt';

export interface FavoriteBase {
  id: string;
  kind: FavoriteKind;
  name: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface FavoriteImage extends FavoriteBase {
  kind: 'favorite-image';
  sourceImageId?: string;
  sourceCanvasId?: string;
  parentPromptId?: string;
  storageId?: string;
  mimeType?: string;
  url?: string;
  originalUrl?: string;
  apiResultUrl?: string;
  thumbnailUrl?: string;
  prompt?: string;
  model?: string;
  sourceKind?: 'originalUrl' | 'apiResultUrl' | 'url' | 'storageId' | 'blob' | 'missing';
  originalBlobKey?: string;
  thumbnailBlobKey?: string;
  originalObjectUrl?: string;
  thumbnailObjectUrl?: string;
}

export interface FavoritePrompt extends FavoriteBase {
  kind: 'favorite-prompt';
  prompt: string;
  sourcePromptId?: string;
  sourceCanvasId?: string;
}

export type FavoriteItem = FavoriteImage | FavoritePrompt;

export interface FavoriteManifest {
  version: 1;
  updatedAt: string;
  items: FavoriteItem[];
}

export type ComposerKind = 'promptbar' | 'assistant' | 'ai-dock';

export interface MentionReferencePayload {
  text: string;
  candidate?: ReferenceMentionCandidate;
}

export interface ComposerRegistration {
  id: ComposerKind;
  label: string;
  insert: (payload: MentionReferencePayload) => void | Promise<void>;
  focus?: () => void;
  addReferenceImage?: (reference: ReferenceImage, source?: ReferenceMentionCandidate) => void | Promise<void>;
  addAssistantAttachment?: (candidate: ReferenceMentionCandidate) => void | Promise<void>;
}

export type ReferenceMentionSource =
  | 'upload'
  | 'tag'
  | 'favorite';

export type ReferenceMentionKind =
  | 'uploaded-image'
  | 'uploaded-file'
  | 'tagged-image'
  | 'favorite-image';

export interface ReferenceMentionCandidate {
  id: string;
  source: ReferenceMentionSource;
  kind: ReferenceMentionKind;
  name: string;
  mentionText: string;
  previewUrl?: string;
  mimeType?: string;
  tags?: string[];
  sourceImageId?: string;
  sourcePromptId?: string;
  favoriteId?: string;
  storageId?: string;
  url?: string;
  originalUrl?: string;
  apiResultUrl?: string;
  referenceImage?: ReferenceImage;
  assistantAsset?: ImageAsset | FileAsset;
  prompt?: string;
  fileOnly?: boolean;
}

export interface ReferenceMentionTab {
  id: ReferenceMentionSource;
  label: string;
  items: ReferenceMentionCandidate[];
}

export interface ReferenceMentionBuildInput {
  promptBarReferences?: ReferenceImage[];
  assistantImages?: ImageAsset[];
  assistantFiles?: FileAsset[];
  promptNodes?: PromptNode[];
  imageNodes?: GeneratedImage[];
  favorites?: FavoriteItem[];
}
