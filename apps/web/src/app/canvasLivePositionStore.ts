import { buildDockedVerticalConnectorPath } from '../canvas/connectorGeometry';
import { CanvasConnectorScheduler } from '../canvas/CanvasConnectorScheduler';

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

// 简体中文：实时局部重绘 SVG 连接线 DOM 的属性，向下兼容接口，统一转发给批量调度器
export function updateConnectorDom(promptId: string, imageId: string, sync = true) {
  CanvasConnectorScheduler.request(promptId, imageId, sync);
}
