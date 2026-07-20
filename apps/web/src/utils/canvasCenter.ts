// Centralized viewport center utilities
import { getViewportPreferredPosition } from './canvasUtils'
import { isPhoneResponsiveWidth } from './responsiveSurface'
import { KK_LAYOUT, normalizeAssistantSidebarWidth } from '@kk/ui';

// Simple typed alias for clarity
export type ViewportOffsets = { left: number; right: number };

export const getAssistantSidebarCenterLeft = (
  isChatOpen: boolean,
  chatSidebarWidth: number = KK_LAYOUT.workspace.assistantSidebarDefaultWidth,
): string => (
  isChatOpen
    ? `calc(50% - ${normalizeAssistantSidebarWidth(chatSidebarWidth) / 2}px)`
    : '50%'
);

const getPromptInputRect = (): DOMRect | null => {
  if (typeof document === 'undefined') return null;
  const promptBar = document.getElementById('prompt-bar-container');
  if (!promptBar) return null;

  const textarea =
    promptBar.querySelector<HTMLTextAreaElement>('textarea.input-bar-textarea') ||
    promptBar.querySelector<HTMLTextAreaElement>('textarea');

  return textarea?.getBoundingClientRect() || promptBar.getBoundingClientRect();
};

// Compute unified viewport offsets considering UI chrome (sidebar, chat, mobile)
export const getViewportOffsets = (
  isSidebarOpen: boolean,
  isChatOpen: boolean,
  isMobile: boolean,
  chatSidebarWidth: number = KK_LAYOUT.workspace.assistantSidebarDefaultWidth
): ViewportOffsets => {
  const left = isSidebarOpen && !isMobile
    ? KK_LAYOUT.workspace.navigationRailWidth
    : (isMobile ? 0 : KK_LAYOUT.workspace.compactRailWidth);
  const right = isChatOpen && !isMobile ? normalizeAssistantSidebarWidth(chatSidebarWidth) : 0;
  return { left, right };
};

// Compute live viewport center using current transform and canvas rect
export const getLiveViewportCenter = (
  currentTransform: { x: number; y: number; scale: number },
  viewportRect: DOMRect | null,
  offsets: ViewportOffsets
): { x: number; y: number } => {
  // radius can be tuned; keep 180 as used previously
  return getViewportPreferredPosition(currentTransform, viewportRect, 180, offsets);
};

export const getPromptBarFrontPosition = (
  currentTransform: { x: number; y: number; scale: number },
  viewportRect: DOMRect | null,
  offsets: ViewportOffsets,
  cardHeight: number = 180,
  gap: number = 44
): { x: number; y: number } => {
  const rect = getPromptInputRect();
  if (!rect) {
    return getLiveViewportCenter(currentTransform, viewportRect, offsets);
  }

  const scale = currentTransform?.scale && currentTransform.scale > 0 ? currentTransform.scale : 1;
  const tx = Number.isFinite(currentTransform?.x) ? currentTransform.x : 0;
  const ty = Number.isFinite(currentTransform?.y) ? currentTransform.y : 0;

  const isMobile = typeof window !== 'undefined' && isPhoneResponsiveWidth(window.innerWidth);
  const viewportLeft = viewportRect?.left ?? 0;

  // on mobile, strictly use center of viewport to avoid side-shifted input boxes throwing off the layout
  const screenX = isMobile && viewportRect
    ? viewportLeft + (viewportRect.width / 2)
    : rect.left + rect.width / 2;

  const viewportTop = viewportRect?.top ?? 0;
  const promptTop = rect.top;
  const availableHeight = Math.max(promptTop - viewportTop, cardHeight + gap);
  const upwardBias = Math.min(56, Math.max(28, availableHeight * 0.12));
  const frontCenterY = viewportTop + availableHeight * 0.46 - upwardBias;
  const maxCenterY = promptTop - gap - cardHeight / 2;
  const screenY = Math.min(frontCenterY, maxCenterY);

  return {
    x: Math.round((screenX - tx) / scale),
    y: Math.round((screenY - ty) / scale),
  };
};
