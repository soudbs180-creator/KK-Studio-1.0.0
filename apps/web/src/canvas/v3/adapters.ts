import { getCanvasV3CardWidth } from './cardGeometry.ts';
import type {
  CanvasCardAction,
  CanvasCardStatus,
  CanvasCardViewModel,
  CanvasPortViewModel,
  CanvasV3CardKind,
} from './types.ts';

interface PromptCardSource {
  id: string;
  prompt?: string;
  originalPrompt?: string;
  position: { x: number; y: number };
  model?: string;
  modelLabel?: string;
  mode?: string;
  aspectRatio?: string;
  imageSize?: string;
  videoDuration?: string;
  videoResolution?: string;
  audioDuration?: string;
  pptSlides?: string[];
  childImageIds?: readonly string[];
  sourceImageId?: string;
  parallelCount?: number;
  creditCost?: number;
  cost?: number;
  isDraft?: boolean;
  isGenerating?: boolean;
  error?: string;
}

interface ImageCardSource {
  id: string;
  url?: string;
  originalUrl?: string;
  apiResultUrl?: string;
  prompt?: string;
  displayLabel?: string;
  fileName?: string;
  alias?: string;
  position: { x: number; y: number };
  timestamp?: number;
  canvasId?: string;
  parentPromptId?: string;
  model?: string;
  modelLabel?: string;
  mode?: string;
  aspectRatio?: string;
  imageSize?: string;
  generationTime?: number;
  creditCost?: number;
  cost?: number;
  isGenerating?: boolean;
  error?: string;
}

interface WorkflowCardSource {
  id: string;
  kind: string;
  label?: string;
  position: { x: number; y: number };
  width?: number;
  data?: Record<string, unknown>;
}

const STATUS_LABEL: Record<CanvasCardStatus, string> = {
  idle: '就绪',
  running: '运行中',
  succeeded: '已完成',
  paused: '已暂停',
  cancelled: '已取消',
  error: '失败',
};

const createPorts = (id: string): CanvasPortViewModel[] => [
  { id: `${id}:input`, nodeId: id, direction: 'input', side: 'left', role: 'input' },
  { id: `${id}:output`, nodeId: id, direction: 'output', side: 'right', role: 'result' },
];

const resolveStatus = (source: { isGenerating?: boolean; error?: string }): CanvasCardStatus => {
  if (source.error) return 'error';
  if (source.isGenerating) return 'running';
  return 'succeeded';
};

const resolvePromptKind = (source: PromptCardSource): CanvasV3CardKind => {
  if (source.error) return 'error';
  if (source.isDraft && !source.prompt?.trim()) return 'pending';
  if (source.mode === 'video') return 'video';
  if (source.mode === 'audio') return 'audio';
  if (source.mode === 'ppt') return 'ppt';
  if (source.mode === 'ecommerce') return 'ecommerce';
  return 'prompt';
};

const actionsForPrompt = (status: CanvasCardStatus): CanvasCardAction[] => [
  { id: 'edit', label: '编辑', priority: 'primary' },
  { id: status === 'error' ? 'retry' : 'run', label: status === 'error' ? '重试' : '运行', priority: 'primary', disabled: status === 'running' },
  { id: 'optimize', label: '优化', priority: 'secondary' },
  { id: 'copy', label: '复制', priority: 'overflow' },
  { id: 'connect', label: '连接', priority: 'overflow' },
];

const actionsForMedia = (kind: CanvasV3CardKind, status: CanvasCardStatus): CanvasCardAction[] => {
  if (status === 'error') return [{ id: 'retry', label: '重试', priority: 'primary' }, { id: 'details', label: '详情', priority: 'secondary' }];
  if (status === 'running') return [{ id: 'cancel', label: '取消', priority: 'primary' }, { id: 'details', label: '详情', priority: 'secondary' }];
  const leading: CanvasCardAction[] = kind === 'video' || kind === 'audio'
    ? [{ id: 'play', label: '播放', priority: 'primary' }]
    : [{ id: 'edit', label: '编辑', priority: 'primary' }];
  return [...leading, { id: 'download', label: '下载', priority: 'primary' }, { id: 'reuse', label: '复用', priority: 'secondary' }, { id: 'more', label: '更多', priority: 'overflow' }];
};

const compactValue = (value: unknown, fallback = '—'): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
};

/**
 * Builds presentation-only prompt state while retaining the exact persisted
 * object and parent/child relationship supplied by the canvas runtime.
 */
export function createPromptCardViewModel(source: PromptCardSource): CanvasCardViewModel {
  const kind = resolvePromptKind(source);
  const status = resolveStatus(source);
  const size = kind === 'ecommerce' || kind === 'ppt' ? 'wide' : 'standard';
  const modeDetail = kind === 'video'
    ? compactValue(source.videoDuration, compactValue(source.videoResolution))
    : kind === 'audio'
      ? compactValue(source.audioDuration)
      : `${compactValue(source.aspectRatio, '自适应')} · ${compactValue(source.imageSize, '1K')}`;
  return {
    id: source.id, kind, status, statusLabel: STATUS_LABEL[status], size,
    width: getCanvasV3CardWidth(size), heightMode: 'content', headerHeight: 36, footerHeight: 36,
    title: source.prompt?.trim() || source.originalPrompt?.trim() || (kind === 'pending' ? '新建创作' : '未命名创作'),
    summary: source.originalPrompt && source.originalPrompt !== source.prompt ? source.originalPrompt : undefined,
    position: source.position, parentId: source.sourceImageId, childIds: [...(source.childImageIds || [])],
    errorMessage: source.error,
    metadata: [
      { label: '模型', value: compactValue(source.modelLabel || source.model) },
      { label: '规格', value: modeDetail },
      { label: '消耗', value: source.creditCost ? `${source.creditCost} 积分` : compactValue(source.cost) },
    ],
    actions: actionsForPrompt(status),
    ports: createPorts(source.id),
  };
}

const resolveMediaKind = (source: ImageCardSource): CanvasV3CardKind => {
  if (source.error) return 'error';
  if (source.mode === 'video') return 'video';
  if (source.mode === 'audio') return 'audio';
  if (source.mode === 'ppt') return 'ppt';
  if (source.mode === 'ecommerce') return 'ecommerce';
  return 'image';
};

/**
 * Normalizes generated media into the same header/body/footer contract used
 * by prompt and workflow cards, without mutating storage URLs or billing data.
 */
export function createImageCardViewModel(source: ImageCardSource): CanvasCardViewModel {
  const kind = resolveMediaKind(source);
  const status = resolveStatus(source);
  const size = source.aspectRatio?.includes('16:9') ? 'standard' : 'compact';
  const sourceUrl = source.originalUrl || source.apiResultUrl || source.url;
  return {
    id: source.id, kind, status, statusLabel: STATUS_LABEL[status], size,
    width: getCanvasV3CardWidth(size), heightMode: 'content', headerHeight: 36, footerHeight: 36,
    title: source.alias || source.displayLabel || source.fileName || source.prompt || '生成结果',
    summary: source.prompt, position: source.position, parentId: source.parentPromptId, childIds: [],
    errorMessage: source.error,
    media: { type: kind === 'audio' ? 'audio' : kind === 'video' ? 'video' : 'image', sourceUrl, posterUrl: kind === 'video' ? sourceUrl : undefined, aspectRatio: source.aspectRatio },
    metadata: [
      { label: '模型', value: compactValue(source.modelLabel || source.model) },
      { label: '规格', value: `${compactValue(source.aspectRatio, '自适应')} · ${compactValue(source.imageSize, kind === 'video' ? '720p' : '1K')}` },
      { label: '消耗', value: source.creditCost ? `${source.creditCost} 积分` : compactValue(source.cost) },
    ],
    actions: actionsForMedia(kind, status),
    ports: createPorts(source.id),
  };
}

const WORKFLOW_KIND_MAP: Record<string, CanvasV3CardKind> = {
  agent: 'agent',
  preview: 'preview',
  save: 'save',
  storyboard: 'storyboard',
  'workflow-panel': 'workflow',
  'video-input': 'video',
  'video-analyze': 'agent',
};

const workflowActions = (kind: CanvasV3CardKind): CanvasCardAction[] => {
  if (kind === 'save') return [{ id: 'export', label: '导出', priority: 'primary' }, { id: 'details', label: '详情', priority: 'secondary' }];
  if (kind === 'preview') return [{ id: 'open', label: '打开', priority: 'primary' }, { id: 'compare', label: '对比', priority: 'secondary' }, { id: 'reuse', label: '复用', priority: 'secondary' }];
  return [{ id: 'run', label: '运行', priority: 'primary' }, { id: 'pause', label: '暂停', priority: 'secondary' }, { id: 'details', label: '步骤', priority: 'secondary' }];
};

/**
 * Converts utility/workflow nodes to compact task cards; the workflow graph
 * remains the source of truth for execution and persistence.
 */
export function createWorkflowCardViewModel(source: WorkflowCardSource): CanvasCardViewModel {
  const kind = WORKFLOW_KIND_MAP[source.kind] || 'workflow';
  const size = kind === 'storyboard' || kind === 'workflow' ? 'wide' : 'standard';
  const status = compactValue(source.data?.status, 'idle') as CanvasCardStatus;
  const safeStatus = STATUS_LABEL[status] ? status : 'idle';
  return {
    id: source.id, kind, status: safeStatus, statusLabel: STATUS_LABEL[safeStatus], size,
    width: getCanvasV3CardWidth(size), heightMode: 'content', headerHeight: 36, footerHeight: 36,
    title: source.label || compactValue(source.data?.title, source.kind),
    summary: compactValue(source.data?.summary || source.data?.instruction, ''),
    position: source.position, childIds: Array.isArray(source.data?.outputNodeIds) ? source.data.outputNodeIds as string[] : [],
    metadata: [
      { label: '类型', value: source.kind },
      { label: '状态', value: STATUS_LABEL[safeStatus] },
      { label: '输出', value: String(Array.isArray(source.data?.outputNodeIds) ? source.data.outputNodeIds.length : 0) },
    ],
    actions: workflowActions(kind),
    ports: createPorts(source.id),
  };
}
