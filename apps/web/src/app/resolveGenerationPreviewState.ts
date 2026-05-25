import { GenerationMode, type GenerationConfig } from '../types';
import { normalizePptSlidesForCount } from '../utils/pptUtils';
import { type PromptModelColorMeta, resolvePromptModelPresentation } from './resolvePromptModelPresentation';

type PreviewKeyLike = {
  id?: string;
  name?: string;
  provider?: string;
} | null | undefined;

interface ResolveGenerationPreviewStateArgs {
  config: Pick<GenerationConfig, 'imageSize' | 'model' | 'mode' | 'parallelCount' | 'pptSlides'>;
  rawPrompt: string;
  selectedKeyForBilling?: PreviewKeyLike;
  useServerSideCreditSettlement: boolean;
}

interface ResolveGenerationPreviewStateResult {
  keySlotId?: string;
  parallelCount: number;
  pptSlides: string[];
  previewColorMeta: PromptModelColorMeta;
  previewModelLabel: string;
  previewProvider: string;
  previewProviderLabel: string;
}

export function resolveGenerationPreviewState({
  config,
  rawPrompt,
  selectedKeyForBilling,
  useServerSideCreditSettlement,
}: ResolveGenerationPreviewStateArgs): ResolveGenerationPreviewStateResult {
  const modelSuffixForPreview = config.model.split('@')[1];
  const modelPresentation = resolvePromptModelPresentation(config.model, config.imageSize);
  const selectedKey = useServerSideCreditSettlement ? null : selectedKeyForBilling;
  const parallelCount = config.mode === GenerationMode.PPT
    ? Math.min(20, Math.max(1, config.parallelCount || 1))
    : Math.min(4, Math.max(1, config.parallelCount || 1));
  const normalizedSlides = (config.pptSlides || []).map((slide) => String(slide || '').trim()).filter(Boolean);

  return {
    previewModelLabel: modelPresentation.label,
    previewProvider: useServerSideCreditSettlement
      ? 'SystemProxy'
      : (selectedKey?.provider || modelPresentation.provider || (modelSuffixForPreview ? 'Custom' : 'Google')),
    previewProviderLabel: useServerSideCreditSettlement
      ? (modelPresentation.providerLabel || 'System Proxy')
      : (selectedKey?.name || modelPresentation.providerLabel || modelSuffixForPreview || 'Google'),
    previewColorMeta: modelPresentation.colorMeta,
    keySlotId: useServerSideCreditSettlement ? 'system_proxy_slot' : selectedKey?.id,
    parallelCount,
    pptSlides: config.mode === GenerationMode.PPT
      ? normalizePptSlidesForCount(normalizedSlides, rawPrompt, parallelCount)
      : [],
  };
}
