// 简体中文：画布实时运行态构建器 (Canvas Runtime State Builder)

import type { CanvasRuntimeState } from '../types.ts';



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
  const promptNodes = activeCanvas?.promptNodes || [];
  const imageNodes = activeCanvas?.imageNodes || [];
  const groups = activeCanvas?.groups || [];

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
  const selectedNodeIdsSet = new Set(selectedNodeIds);
  
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
    const memberTags = [...promptNodes, ...imageNodes]
      .filter((node: any) => (group.nodeIds || []).includes(node.id))
      .flatMap((node: any) => node.tags || []);
    const tags = Array.from(new Set([...(group.tags || []), ...memberTags]));

    return {
      id: group.id,
      label: group.label,
      hidden: Boolean(group.hidden),
      collapsed: Boolean(group.collapsed),
      color: group.color,
      nodeCount: Array.isArray(group.nodeIds) ? group.nodeIds.length : 0,
      tags
    };
  });

  // 4. 模拟 recentEvents 列表
  const recentEvents: any[] = [];
  const allNodesSorted = [...promptNodes, ...imageNodes].sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
  if (allNodesSorted.length > 0) {
    const latest = allNodesSorted[0];
    recentEvents.push({
      id: 'event_' + latest.id,
      type: latest.childImageIds ? 'prompt_created' : 'image_created',
      targetIds: [latest.id],
      timestamp: latest.timestamp || Date.now(),
      summary: latest.childImageIds 
        ? `创建了提示词卡片: "${(latest.prompt || '').substring(0, 20)}"` 
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
      selectedNodeIds,
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
        prompt: n.prompt || '',
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
      prompt: config.prompt || '',
      mode: config.mode || 'image',
      referenceImagesCount: config.referenceImages?.length || 0
    } : undefined,
    recentEvents
  };
}
