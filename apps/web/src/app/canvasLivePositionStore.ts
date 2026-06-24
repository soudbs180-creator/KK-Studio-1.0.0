import { buildDockedVerticalConnectorPath } from '../canvas/connectorGeometry';

export type Point = { x: number; y: number };
export type PositionListener = (position: Point) => void;
export type GlobalPositionListener = (id: string, position: Point | null) => void;

class CanvasLivePositionStore {
  private positions = new Map<string, Point>();
  private listeners = new Map<string, Set<PositionListener>>();
  private globalListeners = new Set<GlobalPositionListener>();

  setPosition(id: string, position: Point | null) {
    const previous = this.positions.get(id) || null;

    if (position === null) {
      if (previous === null) {
        return;
      }
      this.positions.delete(id);
    } else {
      if (previous && previous.x === position.x && previous.y === position.y) {
        return;
      }
      this.positions.set(id, position);
    }

    // 简体中文：通知单个节点的订阅者。历史订阅签名不接受 null，因此清理时继续发送零点兜底值。
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
    if (this.positions.size === 0) {
      return;
    }

    const clearedIds = Array.from(this.positions.keys());
    this.positions.clear();

    clearedIds.forEach((id) => {
      const nodeListeners = this.listeners.get(id);
      if (nodeListeners) {
        nodeListeners.forEach((listener) => listener({ x: 0, y: 0 }));
      }
      this.globalListeners.forEach((listener) => listener(id, null));
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

// 简体中文：用来记录需要在下一帧更新的连线
const pendingConnectorUpdates = new Set<string>();
let isConnectorUpdateScheduled = false;

function flushConnectorUpdates() {
  isConnectorUpdateScheduled = false;

  pendingConnectorUpdates.forEach((key) => {
    const parts = key.split(':');
    if (parts.length === 2) {
      performUpdateConnectorDom(parts[0], parts[1]);
    }
  });
  pendingConnectorUpdates.clear();
}

function performUpdateConnectorDom(promptId: string, imageId: string) {
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
      
      // 🚀 简体中文：优化获取副卡卡片高度的逻辑，优先从子图像卡片自身的 DOM 元素上读取 data-card-height 或 offsetHeight
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
      pathEl.setAttribute('d', newPath);
    }
  }
}

// 简体中文：实时局部重绘 SVG 连接线 DOM 的属性。在拖拽的高频场景下，同步执行更新可以消除一帧的延迟，大幅提升跟手性。
export function updateConnectorDom(promptId: string, imageId: string, sync = true) {
  if (sync) {
    performUpdateConnectorDom(promptId, imageId);
    return;
  }

  pendingConnectorUpdates.add(`${promptId}:${imageId}`);
  if (!isConnectorUpdateScheduled) {
    isConnectorUpdateScheduled = true;
    requestAnimationFrame(flushConnectorUpdates);
  }
}
