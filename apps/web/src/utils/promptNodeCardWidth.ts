import { GenerationMode, type PromptNode } from '../types/index.ts';
import { getCanvasCardWidth } from '../canvas/canvasCardMetrics.ts';

export const DEFAULT_PROMPT_CARD_WIDTH = 320;
export const PROMPT_NODE_BOUNDS_WIDTH = 380;
export const ECOMMERCE_FRAMEWORK_PROMPT_CARD_WIDTH = 420;

export function isEcommerceFrameworkPromptNode(node: Pick<PromptNode, 'mode' | 'ecommerce'>): boolean {
  return node.mode === GenerationMode.ECOMMERCE && node.ecommerce?.kind === 'framework';
}

export function getPromptNodeBaseCardWidth(node: Pick<PromptNode, 'mode' | 'ecommerce' | 'presentation'>): number {
  return isEcommerceFrameworkPromptNode(node)
    ? ECOMMERCE_FRAMEWORK_PROMPT_CARD_WIDTH
    : getCanvasCardWidth(node.presentation);
}

export function getPromptNodeCardWidth(
  node: Pick<PromptNode, 'mode' | 'ecommerce' | 'presentation'>,
  isMobile: boolean,
  viewportWidth?: number,
): number {
  const baseCardWidth = getPromptNodeBaseCardWidth(node);
  if (!isMobile) {
    return baseCardWidth;
  }

  const safeViewportWidth = Number.isFinite(viewportWidth) && viewportWidth
    ? viewportWidth
    : baseCardWidth;
  return Math.min(baseCardWidth, Math.max(248, safeViewportWidth - 24));
}

export function getPromptNodeBoundsWidth(
  node: Pick<PromptNode, 'mode' | 'ecommerce' | 'presentation'>,
  isMobile: boolean,
): number {
  if (isEcommerceFrameworkPromptNode(node)) {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : undefined;
    return getPromptNodeCardWidth(node, isMobile, viewportWidth);
  }

  return getPromptNodeBaseCardWidth(node);
}
