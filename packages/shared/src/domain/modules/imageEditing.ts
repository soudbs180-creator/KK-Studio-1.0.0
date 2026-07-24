/**
 * Image Editing & Post-Processing Domain Contract (G3)
 * Part of Miora Creative Studio integration for KK Studio.
 */

export type ImagePostProcessingAction =
  | 'remove_background'
  | 'inpainting'
  | 'outpainting'
  | 'upscale'
  | 'vectorize'
  | 'mockup_embed';

export interface RemoveBackgroundParams {
  alphaMatting?: boolean;
  returnMaskOnly?: boolean;
}

export interface InpaintingParams {
  maskAssetId: string;
  prompt: string;
  negativePrompt?: string;
  strength?: number;
}

export interface OutpaintingParams {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  prompt?: string;
}

export interface UpscaleParams {
  scaleFactor: 2 | 4 | 8;
  denoiseStrength?: number;
  enhanceDetails?: boolean;
}

export interface VectorizeParams {
  colorMode?: 'color' | 'binary';
  maxColors?: number;
  outputFormat?: 'svg' | 'pdf';
}

export interface ImagePostProcessingJobDto {
  id: string;
  sourceAssetId: string;
  targetCanvasCardId?: string;
  action: ImagePostProcessingAction;
  params:
    | RemoveBackgroundParams
    | InpaintingParams
    | OutpaintingParams
    | UpscaleParams
    | VectorizeParams;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultAssetId?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}
