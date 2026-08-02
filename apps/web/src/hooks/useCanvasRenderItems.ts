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

interface StableCanvasDetailInput {
  scale: number;
  isCanvasTransforming: boolean;
}

/**
 * 已挂载卡片保持完整结构；缩放与平移只影响世界坐标变换。
 * 性能策略应通过视口裁剪、媒体档位和连线节流实现，而不是改写卡片内容。
 */
export function resolveStableCanvasDetailLevel(_input: StableCanvasDetailInput): CanvasDetailLevel {
  return 'full';
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
    isCanvasTransforming,
    scale,
  } = props;

  return useMemo(() => {
    const detailLevel = resolveStableCanvasDetailLevel({ scale, isCanvasTransforming });
    return items.map((item) => ({
      ...item,
      detailLevel,
      shouldRenderDom: true,
    }));
  }, [items, isCanvasTransforming, scale]);
}
