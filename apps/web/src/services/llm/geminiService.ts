/**
 * @deprecated 建议直接从 './generationService' 导入 generationService。
 * 本文件仅为了向前兼容，将所有调用代理分流至 generationService。
 */
import { generationService, type GenerateImageResult } from './generationService';
import { AspectRatio, ImageSize, type ModelType, type ReferenceImage } from '../../types';

export type { GenerateImageResult };

export function normalizeProxyBaseUrl(baseUrl: string): string {
  return generationService.normalizeProxyBaseUrl(baseUrl);
}

export const cancelGeneration = (id: string) => {
  generationService.cancelGeneration(id);
};

export const generateImage = async (
  prompt: string,
  aspectRatio: AspectRatio,
  imageSize: ImageSize,
  referenceImages: ReferenceImage[] = [],
  model: ModelType = 'gemini-2.5-flash-image',
  _negativePrompt: string = '',
  requestId?: string,
  grounding: boolean = false,
  options?: {
    size?: string;
    quality?: 'standard' | 'hd' | 'medium';
    maskUrl?: string;
    editMode?: 'inpaint' | 'outpaint' | 'vectorize' | 'reframe' | 'upscale' | 'replace-background' | 'edit';
    preferredKeyId?: string;
    executionLane?: 'local-user-api' | 'cloud-credit-model';
    creditRouteSpecId?: string;
    creditRouteUnitId?: string;
    enableWebSearch?: boolean;
    enableImageSearch?: boolean;
    thinkingMode?: 'minimal' | 'high';
    onTaskId?: (id: string) => void;
    onSyncBridgeRegistered?: (requestId: string, startedAt?: number) => void;
  }
): Promise<GenerateImageResult> => {
  return generationService.generateImage(
    prompt,
    aspectRatio,
    imageSize,
    referenceImages,
    model,
    _negativePrompt,
    requestId,
    grounding,
    options
  );
};
