import { canvasLivePositionStore, getPromptNodePositionFromDom, getImageNodePositionFromDom } from '../app/canvasLivePositionStore';
import { buildDockedVerticalConnectorPath } from './connectorGeometry';

// 简体中文：Canvas 连接线批量更新调度器，采用批处理和缓存机制，防止高频重绘卡顿
export class CanvasConnectorScheduler {
  private static pendingUpdates = new Set<string>(); // 存储格式为 "promptId:imageId"
  private static rafId: number | null = null;
  private static pathCache = new Map<string, string>(); // 缓存格式为 "promptId:imageId" -> lastPathString

  // 简体中文：请求更新某条连接线
  static request(promptId: string, imageId: string, sync = false) {
    const key = `${promptId}:${imageId}`;

    if (sync) {
      // 简体中文：如果是同步且目前没有 pending 任务，为了极致跟手性可以直接重绘，但也走 path 缓存过滤
      this.updateConnectorPath(promptId, imageId);
      return;
    }

    this.pendingUpdates.add(key);

    if (this.rafId === null) {
      // 🚀 核心优化：利用 requestAnimationFrame 把这一帧中所有的连接线更新动作进行去重和批处理
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.flush();
      });
    }
  }

  // 简体中文：批量刷新所有待更新的连接线，交互期间每帧最多被 flush 调用一次
  private static flush() {
    if (this.pendingUpdates.size === 0) return;

    this.pendingUpdates.forEach((key) => {
      const parts = key.split(':');
      if (parts.length === 2) {
        this.updateConnectorPath(parts[0], parts[1]);
      }
    });

    this.pendingUpdates.clear();
  }

  // 简体中文：底层真正的 DOM 属性写入操作
  private static updateConnectorPath(promptId: string, imageId: string) {
    const pathEl = document.getElementById(`connector-${promptId}-${imageId}`) as SVGPathElement | null;
    if (!pathEl) return;

    const promptPos = canvasLivePositionStore.getPosition(promptId) || getPromptNodePositionFromDom(promptId);
    const imagePos = canvasLivePositionStore.getPosition(imageId) || getImageNodePositionFromDom(imageId);

    if (promptPos && imagePos) {
      const svgEl = pathEl.ownerSVGElement;
      if (svgEl) {
        const leftAttr = svgEl.getAttribute('data-left');
        const topAttr = svgEl.getAttribute('data-top');
        const svgLeft = leftAttr ? parseFloat(leftAttr) : 0;
        const svgTop = topAttr ? parseFloat(topAttr) : 0;

        // 优先从子图像卡片自身的 DOM 元素上读取 data-card-height 属性，防止多次 offsetHeight 重排
        const imageCardEl = document.getElementById(`image-card-${imageId}`);
        let imageCardHeight = 0;
        if (imageCardEl) {
          const hAttr = imageCardEl.getAttribute('data-card-height');
          imageCardHeight = hAttr ? Number(hAttr) : imageCardEl.offsetHeight;
          if (!hAttr && imageCardHeight > 0) {
            imageCardEl.setAttribute('data-card-height', String(imageCardHeight));
          }
        }
        if (!imageCardHeight) {
          imageCardHeight = Number(svgEl.getAttribute(`data-card-height-${imageId}`) || 0);
        }

        const newPath = buildDockedVerticalConnectorPath(
          promptPos.x - svgLeft,
          promptPos.y - svgTop,
          imagePos.x - svgLeft,
          (imagePos.y - imageCardHeight) - svgTop
        );

        // 🚀 核心优化：只在 path 字符串真正改变时才调用 setAttribute，防止重复渲染
        const cacheKey = `${promptId}:${imageId}`;
        const cachedPath = this.pathCache.get(cacheKey);
        if (cachedPath !== newPath) {
          pathEl.setAttribute('d', newPath);
          this.pathCache.set(cacheKey, newPath);
        }
      }
    }
  }

  // 简体中文：在切换画布或卸载时，清空调度器状态与缓存
  static clearCache() {
    this.pathCache.clear();
    this.pendingUpdates.clear();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
