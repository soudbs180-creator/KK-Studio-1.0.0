export interface ReferenceMentionAnchor {
  x: number;
  y: number;
}

const PANEL_WIDTH = 360;
const VIEWPORT_MARGIN = 12;
const MIN_TOP_ROOM = 320;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function computeReferenceMentionAnchor(
  textarea: HTMLTextAreaElement,
  atIndex: number,
): ReferenceMentionAnchor {
  const rect = textarea.getBoundingClientRect();
  const style = window.getComputedStyle(textarea);
  const fontSize = Number.parseFloat(style.fontSize || '13') || 13;
  const lineHeight = Number.parseFloat(style.lineHeight || '') || fontSize * 1.45;
  const paddingLeft = Number.parseFloat(style.paddingLeft || '0') || 0;
  const paddingTop = Number.parseFloat(style.paddingTop || '0') || 0;
  const beforeMention = textarea.value.slice(0, Math.max(0, atIndex));
  const lines = beforeMention.split('\n');
  const lineIndex = Math.max(0, lines.length - 1);
  const column = Array.from(lines[lineIndex] || '').length;
  const approximateCharWidth = Math.max(7, fontSize * 0.56);
  const contentWidth = Math.max(24, rect.width - paddingLeft * 2);
  const relativeX = Math.min(column * approximateCharWidth - textarea.scrollLeft, contentWidth);
  const relativeY = (lineIndex + 1) * lineHeight - textarea.scrollTop;
  const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN);

  return {
    x: clamp(rect.left + paddingLeft + relativeX, VIEWPORT_MARGIN, maxLeft),
    y: clamp(rect.top + paddingTop + relativeY, MIN_TOP_ROOM, window.innerHeight - VIEWPORT_MARGIN),
  };
}
