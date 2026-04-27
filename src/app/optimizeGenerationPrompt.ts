import type { PromptNode, ReferenceImage } from '../types';
import { optimizePromptForImage } from '../services/llm/promptOptimizerService';

type PromptOptimizationOptions = NonNullable<Parameters<typeof optimizePromptForImage>[1]>;

interface OptimizeGenerationPromptArgs {
  enabled?: boolean;
  onError?: (error: unknown) => void;
  options: PromptOptimizationOptions;
  rawPrompt: string;
  referenceImages?: ReferenceImage[];
}

interface OptimizeGenerationPromptResult {
  optimizedPrompt: string;
  optimizedPromptEn?: string;
  optimizedPromptZh?: string;
  promptOptimizerResult?: PromptNode['promptOptimizerResult'];
}

function buildPromptOptimizerReferenceImages(referenceImages?: ReferenceImage[]): NonNullable<PromptOptimizationOptions['referenceImages']> {
  return (referenceImages || [])
    .filter((referenceImage) => referenceImage.data)
    .map((referenceImage) => {
      const mimeType = referenceImage.mimeType || 'image/png';
      let data = referenceImage.data || '';

      if (data.startsWith('data:')) {
        const match = data.match(/^data:([^;]+);base64,(.+)$/);
        if (match?.[2]) {
          data = match[2];
        }
      }

      return {
        mimeType,
        data,
      };
    });
}

export async function optimizeGenerationPrompt({
  enabled,
  onError,
  options,
  rawPrompt,
  referenceImages,
}: OptimizeGenerationPromptArgs): Promise<OptimizeGenerationPromptResult> {
  if (!enabled || !String(rawPrompt || '').trim()) {
    return { optimizedPrompt: rawPrompt };
  }

  try {
    const optimized = await optimizePromptForImage(rawPrompt, {
      ...options,
      referenceImages: buildPromptOptimizerReferenceImages(referenceImages),
    });

    return {
      optimizedPrompt: optimized.optimizedEn || rawPrompt,
      optimizedPromptEn: optimized.optimizedEn,
      optimizedPromptZh: optimized.optimizedZh,
      promptOptimizerResult: optimized.fullResult,
    };
  } catch (error) {
    onError?.(error);
    return { optimizedPrompt: rawPrompt };
  }
}
