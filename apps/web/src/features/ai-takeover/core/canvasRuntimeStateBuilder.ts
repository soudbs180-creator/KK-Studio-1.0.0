// 简体中文：画布实时运行态构建器 (Canvas Runtime State Builder)

import type { CanvasRuntimeState } from '../types.ts';

const MAX_RUNTIME_TEXT_LENGTH = 500;
const LONG_SECRET_PATTERN = /(?:Bearer\s+[a-zA-Z0-9_\-.]+|sk-[a-zA-Z0-9_\-]{8,}|[A-Za-z0-9+/=_-]{80,})/g;

const sanitizeRuntimeText = (value: unknown, maxLength = MAX_RUNTIME_TEXT_LENGTH): string => {
  if (typeof value !== 'string') return '';
  const sanitized = value
    .replace(LONG_SECRET_PATTERN, '***')
    .replace(/data:[^;\s]+;base64,[A-Za-z0-9+/=]+/g, 'data:***');
  return sanitized.length > maxLength ? `${sanitized.slice(0, maxLength)}...` : sanitized;
};

const toArray = <T>(value: T[] | undefined | null): T[] => Array.isArray(value) ? value : [];

const getNodeTags = (nodeById: Map<string, any>, ids: unknown): string[] => {
  if (!Array.isArray(ids)) return [];
  const tags = new Set<string>();
  for (const id of ids) {
    const node = typeof id === 'string' ? nodeById.get(id) : undefined;
    if (!node || !Array.isArray(node.tags)) continue;
    for (const tag of node.tags) {
      if (typeof tag === 'string' && tag.trim()) {
        tags.add(tag);
      }
    }
  }
  return Array.from(tags);
};

export interface CanvasRuntimeStateBuilderParams {
  currentPage: 'canvas' | 'settings' | 'agent' | 'unknown';
  activeCanvas: any;
  selectedNodeIds: string[];
  canvasTransform?: { x: number; y: number; scale: number } | null;
  canvasRef?: any;
  config?: any;
}

/**
 * 构建脱敏的画布运行态 CanvasRuntimeState，供 AI 助手了解实时的画布、视口与选区。
 */
export function buildCanvasRuntimeState(params: CanvasRuntimeStateBuilderParams): CanvasRuntimeState {
  const {
    currentPage,
    activeCanvas,
    selectedNodeIds = [],
    canvasTransform,
    canvasRef,
    config
  } = params;

  // 1. 获取画布基础信息
  const canvasId = activeCanvas?.id || 'default';
  const canvasName = activeCanvas?.name || '新画布';
  const promptNodes = toArray<Record<string, any>>(activeCanvas?.promptNodes);
  const imageNodes = toArray<Record<string, any>>(activeCanvas?.imageNodes);
  const groups = toArray<Record<string, any>>(activeCanvas?.groups);
  const selectedNodeIdsSafe = toArray(selectedNodeIds).filter((id): id is string => typeof id === 'string' && id.trim().length > 0);

  // 2. 提取 viewport 和 transform
  let transform = { x: 0, y: 0, scale: 1 };
  if (canvasTransform) {
    transform = canvasTransform;
  } else if (canvasRef?.current?.getCurrentTransform) {
    try {
      transform = canvasRef.current.getCurrentTransform();
    } catch (e) {
      console.warn('[RuntimeStateBuilder] 无法从 ref 获取 transform:', e);
    }
  }

  let rect: { width: number; height: number } | undefined = undefined;
  if (canvasRef?.current?.getCanvasRect) {
    try {
      const domRect = canvasRef.current.getCanvasRect();
      if (domRect) {
        rect = { width: domRect.width, height: domRect.height };
      }
    } catch (e) {
      console.warn('[RuntimeStateBuilder] 无法从 ref 获取 canvasRect:', e);
    }
  }

  // 根据 viewport 计算视口中心坐标 (对应画布中的物理坐标系)
  let center = { x: 0, y: 0 };
  if (rect) {
    center = {
      x: (rect.width / 2 - transform.x) / transform.scale,
      y: (rect.height / 2 - transform.y) / transform.scale
    };
  } else {
    center = activeCanvas?.viewportCenter || { x: 0, y: 0 };
  }

  // 3. 计算选区和分类去重
  const selectedNodeIdsSet = new Set(selectedNodeIdsSafe);
  const nodeById = new Map<string, any>();
  for (const node of promptNodes) {
    if (node?.id) nodeById.set(node.id, node);
  }
  for (const node of imageNodes) {
    if (node?.id) nodeById.set(node.id, node);
  }

  const selectedPrompts = promptNodes.filter((n: any) => selectedNodeIdsSet.has(n.id));
  const selectedPromptIds = selectedPrompts.map((n: any) => n.id);
  
  const selectedImages = imageNodes.filter((img: any) => selectedNodeIdsSet.has(img.id));
  const selectedImageIds = selectedImages.map((img: any) => img.id);

  // 收集选中 prompts 的子图 ID
  const childImageNodeIdsFromSelectedPromptsSet = new Set<string>();
  selectedPrompts.forEach((p: any) => {
    if (p.childImageIds) {
      p.childImageIds.forEach((id: string) => childImageNodeIdsFromSelectedPromptsSet.add(id));
    }
  });
  const childImageNodeIdsFromSelectedPrompts = Array.from(childImageNodeIdsFromSelectedPromptsSet);
  const selectedGroupIds = groups
    .filter((group: any) => selectedNodeIdsSet.has(group.id))
    .map((group: any) => group.id);
  const runtimeGroups = groups.map((group: any) => {
    const memberTags = getNodeTags(nodeById, group.nodeIds);
    const tags = Array.from(new Set([...(Array.isArray(group.tags) ? group.tags : []), ...memberTags]));

    return {
      id: group.id,
      label: sanitizeRuntimeText(group.label, 80),
      hidden: Boolean(group.hidden),
      collapsed: Boolean(group.collapsed),
      color: group.color,
      nodeCount: Array.isArray(group.nodeIds) ? group.nodeIds.length : 0,
      tags
    };
  });

  // 4. 模拟 recentEvents 列表
  const recentEvents: any[] = [];
  let latest: any | null = null;
  for (const node of promptNodes) {
    if (!latest || (Number(node?.timestamp) || 0) > (Number(latest?.timestamp) || 0)) {
      latest = node;
    }
  }
  for (const node of imageNodes) {
    if (!latest || (Number(node?.timestamp) || 0) > (Number(latest?.timestamp) || 0)) {
      latest = node;
    }
  }
  if (latest) {
    recentEvents.push({
      id: 'event_' + latest.id,
      type: latest.childImageIds ? 'prompt_created' : 'image_created',
      targetIds: [latest.id],
      timestamp: latest.timestamp || Date.now(),
      summary: latest.childImageIds 
        ? `创建了提示词卡片: "${sanitizeRuntimeText(latest.prompt, 20)}"` 
        : `生成了图像卡片`
    });
  }

  return {
    projectVersion: '1.5.4',
    currentPage,
    canvas: {
      id: canvasId,
      name: canvasName,
      promptCount: promptNodes.length,
      imageCount: imageNodes.length,
      groupCount: groups.length,
      lastModified: activeCanvas?.lastModified
    },
    viewport: {
      x: transform.x,
      y: transform.y,
      scale: transform.scale,
      center,
      rect
    },
    selection: {
      selectedNodeIds: selectedNodeIdsSafe,
      promptNodeIds: selectedPromptIds,
      imageNodeIds: selectedImageIds,
      childImageNodeIdsFromSelectedPrompts,
      groupIds: selectedGroupIds,
      count: selectedNodeIds.length
    },
    groups: runtimeGroups,
    selectedNodes: {
      prompts: selectedPrompts.map((n: any) => ({
        id: n.id,
        prompt: sanitizeRuntimeText(n.prompt),
        status: n.isGenerating ? 'generating' : (n.error ? 'failed' : (n.childImageIds?.length > 0 ? 'done' : 'idle')),
        childImageIds: n.childImageIds || [],
        tags: n.tags || []
      })),
      images: selectedImages.map((img: any) => ({
        id: img.id,
        parentPromptId: img.parentPromptId,
        urlPresent: !!img.url,
        originalUrlPresent: !!img.originalUrl,
        apiResultUrlPresent: !!img.apiResultUrl,
        storageIdPresent: !!img.storageId,
        tags: img.tags || []
      }))
    },
    promptBarInput: config ? {
      prompt: sanitizeRuntimeText(config.prompt),
      mode: config.mode || 'image',
      referenceImagesCount: config.referenceImages?.length || 0
    } : undefined,
    recentEvents
  };
}
