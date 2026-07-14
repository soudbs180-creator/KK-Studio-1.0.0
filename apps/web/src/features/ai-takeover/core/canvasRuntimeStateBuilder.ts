// 简体中文：画布实时运行态构建器 (Canvas Runtime State Builder)

import type { CanvasRuntimeState } from '../types.ts';
import type { CanvasCardKind, CanvasLayoutMode } from '@kk/shared';
import { getCanvasSceneBoundsForNodeIds, getCanvasSceneNodes, unionCanvasSceneBounds } from '../../../canvas/canvasSceneGeometry.ts';
import { APP_VERSION } from '../../../config/appInfo.ts';

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
  currentPage: CanvasRuntimeState['currentPage'];
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
  const noteNodes = toArray<Record<string, any>>(activeCanvas?.noteNodes);
  const workflowNodes = toArray<Record<string, any>>(activeCanvas?.workflow?.nodes);
  const workflowPanels = workflowNodes.filter((node) => node?.kind === 'workflow-panel');
  const drawings = toArray<Record<string, any>>(activeCanvas?.drawings);
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
  for (const node of noteNodes) {
    if (node?.id) nodeById.set(node.id, node);
  }
  for (const node of workflowNodes) {
    if (node?.id) nodeById.set(node.id, node);
  }

  const selectedPrompts = promptNodes.filter((n: any) => selectedNodeIdsSet.has(n.id));
  const selectedPromptIds = selectedPrompts.map((n: any) => n.id);
  
  const selectedImages = imageNodes.filter((img: any) => selectedNodeIdsSet.has(img.id));
  const selectedImageIds = selectedImages.map((img: any) => img.id);
  const selectedNotes = noteNodes.filter((node: any) => selectedNodeIdsSet.has(node.id));
  const selectedWorkflowPanels = workflowPanels.filter((node: any) => selectedNodeIdsSet.has(node.id));
  const selectedNoteIds = selectedNotes.map((node: any) => node.id);
  const selectedWorkflowNodeIds = selectedWorkflowPanels.map((node: any) => node.id);

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

  const cardKinds: Partial<Record<CanvasCardKind, number>> = {};
  const layoutModes = new Set<CanvasLayoutMode>();
  const countCard = (kind: CanvasCardKind, layoutMode?: CanvasLayoutMode) => {
    cardKinds[kind] = (cardKinds[kind] || 0) + 1;
    if (layoutMode) layoutModes.add(layoutMode);
  };
  const geometryCanvas = activeCanvas ? {
    ...activeCanvas,
    promptNodes: promptNodes.filter((node: any) => node?.position),
    imageNodes: imageNodes.filter((node: any) => node?.position),
    noteNodes: noteNodes.filter((node: any) => node?.position),
    groups: groups.filter((group: any) => group?.bounds),
    workflow: activeCanvas.workflow ? {
      ...activeCanvas.workflow,
      nodes: workflowNodes.filter((node: any) => node?.position),
    } : undefined,
  } : undefined;
  const sceneNodes = getCanvasSceneNodes(geometryCanvas);
  sceneNodes.forEach((node) => {
    if (node.nodeType === 'group') return;
    if (node.nodeType === 'workflow' && node.presentation?.kind !== 'workflow-panel') return;
    const inferredKind: CanvasCardKind = node.nodeType === 'prompt'
      ? (node.childNodeIds?.length ? 'prompt-result-group' : 'prompt-only')
      : node.nodeType === 'media'
        ? 'media-only'
        : node.nodeType === 'note'
          ? 'notebook'
          : node.nodeType === 'workflow'
            ? 'workflow-panel'
            : 'unknown';
    countCard(node.presentation?.kind || inferredKind, node.presentation?.layoutMode);
  });
  const sceneBounds = unionCanvasSceneBounds(sceneNodes.map((node) => node.bounds));
  const selectionBounds = unionCanvasSceneBounds(
    getCanvasSceneBoundsForNodeIds(geometryCanvas, selectedNodeIdsSafe),
  );
  const selectedDrawingCount = drawings.filter((drawing: any) => selectedNodeIdsSet.has(drawing.id)).length;

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
    projectVersion: APP_VERSION,
    currentPage,
    canvas: {
      id: canvasId,
      name: canvasName,
      promptCount: promptNodes.length,
      imageCount: imageNodes.length,
      groupCount: groups.length,
      noteCount: noteNodes.length,
      workflowPanelCount: workflowPanels.length,
      cardKinds,
      layoutModes: Array.from(layoutModes),
      bounds: sceneBounds || undefined,
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
      noteNodeIds: selectedNoteIds,
      workflowNodeIds: selectedWorkflowNodeIds,
      bounds: selectionBounds || undefined,
      capabilities: {
        canArrange: selectedNodeIdsSafe.length > 0,
        canConvertDrawingsToNote: selectedDrawingCount > 0,
        canCreateCard: true,
        canCreateWorkflowPanel: true,
      },
      count: selectedNodeIdsSafe.length
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
      })),
      notes: selectedNotes.map((note: any) => ({
        id: note.id,
        title: sanitizeRuntimeText(note.title, 80),
        elementCount: Array.isArray(note.elements) ? note.elements.length : 0,
      })),
      workflowPanels: selectedWorkflowPanels.map((node: any) => ({
        id: node.id,
        title: sanitizeRuntimeText(node.data?.title, 80),
        status: node.data?.status || 'idle',
        enabledStepCount: toArray(node.data?.steps).filter((step: any) => step.enabled !== false).length,
        outputCount: toArray(node.data?.outputNodeIds).length,
      })),
    },
    promptBarInput: config ? {
      prompt: sanitizeRuntimeText(config.prompt),
      mode: config.mode || 'image',
      referenceImagesCount: config.referenceImages?.length || 0
    } : undefined,
    recentEvents
  };
}
