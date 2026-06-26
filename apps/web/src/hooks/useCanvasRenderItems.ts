// 简体中文：画布卡片 LOD（精细度）与 DOM 裁剪管理 Hook
// 根据当前的缩放比例、是否正在交互平移拖拽、以及节点是否可见，计算出每张卡片应该以 full、compact 或 ghost 渲染。

import { useMemo } from 'react';
import type { CanvasPerformanceProfile } from '../canvas/performanceProfile';

export type CanvasDetailLevel = 'full' | 'compact' | 'ghost';

export interface CanvasRenderItemInput {
  id: string;
  kind: 'prompt-group' | 'image' | 'preview' | 'save' | 'agent';
  node: any;
  childNodes?: any[];
  groupView?: any;
}

export interface CanvasRenderItemOutput extends CanvasRenderItemInput {
  detailLevel: CanvasDetailLevel;
  shouldRenderDom: boolean;
}

interface UseCanvasRenderItemsProps {
  items: CanvasRenderItemInput[];
  selectedNodeIds: string[];
  activeSourceImage: string | null;
  draftNodeId: string | null;
  isCanvasTransforming: boolean;
  scale: number;
  canvasPerformanceProfile: CanvasPerformanceProfile;
}

export function useCanvasRenderItems(props: UseCanvasRenderItemsProps): CanvasRenderItemOutput[] {
  const {
    items,
    selectedNodeIds,
    activeSourceImage,
    draftNodeId,
    isCanvasTransforming,
    scale,
    canvasPerformanceProfile,
  } = props;

  const selectedSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  return useMemo(() => {
    return items.map((item) => {
      // 1. 判断是否被选中或处于激活状态
      const isSelected = selectedSet.has(item.id)
        || item.id === activeSourceImage
        || item.id === draftNodeId
        || (item.childNodes && item.childNodes.some(child => selectedSet.has(child.id)));

      // 2. 计算卡片精细度 (Detail Level / LOD)
      let detailLevel: CanvasDetailLevel = 'full';

      const isGenerating = item.node?.isGenerating || (item.childNodes && item.childNodes.some((child: any) => child.isGenerating));
      const isRecent = item.node?.isNew || (item.childNodes && item.childNodes.some((child: any) => child.isNew));
      const isHighPriority = isSelected || isGenerating || isRecent;

      if (isCanvasTransforming) {
        // 🚀 画布在拖拽、缩放、平移等高频交互中，非选中卡片全部退化为极其轻量的 ghost，保障 60 FPS
        detailLevel = isHighPriority ? 'compact' : 'ghost';
      } else {
        // 静态下根据缩放比例 (scale) 决定 LOD
        if (scale >= 0.7) {
          detailLevel = 'full';
        } else if (scale >= 0.35) {
          detailLevel = 'compact';
        } else {
          detailLevel = isHighPriority ? 'compact' : 'ghost';
        }
      }

      // 根据性能配置，如果是极差的设备，可进一步限制 LOD
      if (canvasPerformanceProfile.cardDetailLevel === 'thumbnail-shell' && detailLevel === 'full') {
        detailLevel = 'compact';
      }

      return {
        ...item,
        detailLevel,
        shouldRenderDom: true, // 在视口内（items 已经是被 useVisibleCanvasItems 裁剪过的）的卡片均渲染
      };
    });
  }, [
    items,
    selectedSet,
    activeSourceImage,
    draftNodeId,
    isCanvasTransforming,
    scale,
    canvasPerformanceProfile.cardDetailLevel,
  ]);
}
