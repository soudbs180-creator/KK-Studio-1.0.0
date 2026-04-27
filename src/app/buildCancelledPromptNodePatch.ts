import type { PromptNode } from '../types';

export function buildCancelledPromptNodePatch(modelId: string): Pick<
  PromptNode,
  'isGenerating' | 'error' | 'errorDetails'
> {
  return {
    isGenerating: false,
    error: 'Cancelled by user',
    errorDetails: {
      code: 'CANCELLED',
      responseBody: 'Generation cancelled by user',
      model: modelId,
      timestamp: Date.now(),
    },
  };
}
