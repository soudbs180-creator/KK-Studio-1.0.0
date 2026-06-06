import { buildDockedVerticalConnectorPath } from '../canvas/connectorGeometry';

export type Point = { x: number; y: number };
export type PositionListener = (position: Point) => void;
export type GlobalPositionListener = (id: string, position: Point | null) => void;

class CanvasLivePositionStore {
  private positions = new Map<string, Point>();
  private listeners = new Map<string, Set<PositionListener>>();
  private globalListeners = new Set<GlobalPositionListener>();

  setPosition(id: string, position: Point | null) {
    if (position === null) {
      this.positions.delete(id);
    } else {
      this.positions.set(id, position);
    }

    // 简体中文：通知单个节点的订阅者
    const nodeListeners = this.listeners.get(id);
    if (nodeListeners) {
      nodeListeners.forEach((listener) => listener(position || { x: 0, y: 0 }));
    }

    // 简体中文：通知全局订阅者
    this.globalListeners.forEach((listener) => listener(id, position));
  }

  getPosition(id: string): Point | null {
    return this.positions.get(id) || null;
  }

  subscribe(id: string, listener: PositionListener): () => void {
    if (!this.listeners.has(id)) {
      this.listeners.set(id, new Set());
    }
    this.listeners.get(id)!.add(listener);
    return () => {
      const set = this.listeners.get(id);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(id);
        }
      }
    };
  }

  subscribeGlobal(listener: GlobalPositionListener): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  clear() {
    this.positions.clear();
    this.globalListeners.forEach((listener) => {
      this.positions.forEach((_pos, id) => listener(id, null));
    });
  }
}

export const canvasLivePositionStore = new CanvasLivePositionStore();

// 简体中文：获取 Prompt 节点的原始坐标（从 DOM 元素 data-x / data-y 属性）
export function getPromptNodePositionFromDom(id: string): Point | null {
  const el = document.getElementById(`prompt-card-${id}`);
  if (!el) return null;
  const x = el.getAttribute('data-x');
  const y = el.getAttribute('data-y');
  return x && y ? { x: parseFloat(x), y: parseFloat(y) } : null;
}

// 简体中文：获取 Image 节点的原始坐标（从 DOM 元素 data-x / data-y 属性）
export function getImageNodePositionFromDom(id: string): Point | null {
  const el = document.getElementById(`image-card-${id}`);
  if (!el) return null;
  const x = el.getAttribute('data-x');
  const y = el.getAttribute('data-y');
  return x && y ? { x: parseFloat(x), y: parseFloat(y) } : null;
}

// 简体中文：实时局部重绘 SVG 连接线 DOM 的属性，零 React Diff
export function updateConnectorDom(promptId: string, imageId: string) {
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
      
      const imageCardHeight = Number(svgEl.getAttribute(`data-card-height-${imageId}`) || 0);

      const newPath = buildDockedVerticalConnectorPath(
        promptPos.x - svgLeft,
        promptPos.y - svgTop,
        imagePos.x - svgLeft,
        (imagePos.y - imageCardHeight) - svgTop
      );
      pathEl.setAttribute('d', newPath);
    }
  }
}
