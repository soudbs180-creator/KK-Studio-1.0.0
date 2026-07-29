import type { CanvasCardKind, CanvasCardSizeToken } from '@kk/shared';

/** Stable visual families shared by every Canvas V3 renderer. */
export type CanvasCardFamily = 'prompt' | 'media' | 'structured' | 'utility' | 'fallback';

/** UI-only metadata that keeps card shells and QA labels consistent. */
export interface CanvasCardDefinition {
  label: string;
  family: CanvasCardFamily;
  defaultSize: CanvasCardSizeToken;
  primaryContent: 'prompt' | 'media' | 'task' | 'document' | 'canvas';
  footerFields: readonly string[];
}

/**
 * Defines the visible responsibility of every persisted card kind. Renderers
 * may specialize their body, but cannot invent a second shell hierarchy.
 */
export const CANVAS_CARD_CATALOG = {
  'prompt-result-group': {
    label: '生成任务',
    family: 'prompt',
    defaultSize: 'standard',
    primaryContent: 'prompt',
    footerFields: ['模型', '规格', '消耗'],
  },
  'prompt-only': {
    label: '提示词',
    family: 'prompt',
    defaultSize: 'standard',
    primaryContent: 'prompt',
    footerFields: ['模型', '模式', '消耗'],
  },
  'media-only': {
    label: '媒体结果',
    family: 'media',
    defaultSize: 'compact',
    primaryContent: 'media',
    footerFields: ['类型', '规格', '来源'],
  },
  'ecommerce': {
    label: '电商任务',
    family: 'structured',
    defaultSize: 'wide',
    primaryContent: 'task',
    footerFields: ['阶段', '输出', '状态'],
  },
  'ppt-deck': {
    label: '演示文稿',
    family: 'structured',
    defaultSize: 'wide',
    primaryContent: 'document',
    footerFields: ['页数', '风格', '状态'],
  },
  'audio': {
    label: '音频',
    family: 'media',
    defaultSize: 'standard',
    primaryContent: 'media',
    footerFields: ['时长', '模型', '状态'],
  },
  'text': {
    label: '文本',
    family: 'prompt',
    defaultSize: 'standard',
    primaryContent: 'prompt',
    footerFields: ['类型', '来源', '状态'],
  },
  'notebook': {
    label: '画布笔记',
    family: 'utility',
    defaultSize: 'standard',
    primaryContent: 'canvas',
    footerFields: ['元素', '来源', '更新'],
  },
  'multi-image': {
    label: '多图任务',
    family: 'media',
    defaultSize: 'wide',
    primaryContent: 'media',
    footerFields: ['数量', '模型', '规格'],
  },
  'workflow-panel': {
    label: '工作流',
    family: 'utility',
    defaultSize: 'wide',
    primaryContent: 'task',
    footerFields: ['步骤', '输出', '状态'],
  },
  'unknown': {
    label: '未知卡片',
    family: 'fallback',
    defaultSize: 'standard',
    primaryContent: 'task',
    footerFields: ['类型', '诊断', '状态'],
  },
} satisfies Record<CanvasCardKind, CanvasCardDefinition>;

/** Returns stable card semantics used by the shared shell and design QA. */
export function getCanvasCardDefinition(kind: CanvasCardKind): CanvasCardDefinition {
  return CANVAS_CARD_CATALOG[kind];
}
