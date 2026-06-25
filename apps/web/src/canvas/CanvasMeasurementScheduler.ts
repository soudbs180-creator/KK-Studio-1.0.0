// 简体中文：统一测量调度器，将高频测高读取进行批处理，防止强制同步排版 (Layout Thrashing)
interface MeasurementTask {
  element: HTMLElement;
  measureFn: (el: HTMLElement) => any;
  callback: (val: any) => void;
}

export class CanvasMeasurementScheduler {
  private static pendingTasks = new Map<string, MeasurementTask>();
  private static pendingHeightUpdates = new Map<string, number>();
  private static rafId: number | null = null;
  private static callbacks = new Set<(updates: Record<string, number>) => void>();
  private static isLocked = false;

  // 简体中文：注册批量高度更新的监听器 (供 WorkspacePage 监听全局批量高度更新)
  static registerCallback(cb: (updates: Record<string, number>) => void) {
    this.callbacks.add(cb);
  }

  // 简体中文：注销监听器
  static unregisterCallback(cb: (updates: Record<string, number>) => void) {
    this.callbacks.delete(cb);
  }

  // 简体中文：在拖拽/缩放期间锁定调度器，忽略所有后续的测量并在锁定瞬间取消待处理测量
  static setLocked(locked: boolean) {
    this.isLocked = locked;
    if (locked) {
      this.cancel();
    }
  }

  // 简体中文：获取当前锁定状态
  static getLocked() {
    return this.isLocked;
  }

  // 简体中文：兼容老式的直接请求高度更新接口
  static requestHeightUpdate(id: string, height: number) {
    if (this.isLocked) return;
    this.pendingHeightUpdates.set(id, height);
    this.scheduleFlush();
  }

  // 简体中文：请求批量测量某个 DOM 元素，指定测量的具体读取函数 (measureFn) 和测量完成后的状态更新回调 (callback)
  static request<T>(
    id: string,
    element: HTMLElement,
    measureFn: (el: HTMLElement) => T,
    callback: (val: T) => void
  ) {
    if (this.isLocked) return;
    this.pendingTasks.set(id, { element, measureFn, callback });
    this.scheduleFlush();
  }

  // 简体中文：便利方法，仅请求批量测量某个卡片的高度
  static requestHeight(
    id: string,
    element: HTMLElement,
    callback: (height: number) => void
  ) {
    this.request(id, element, (el) => el.offsetHeight, callback);
  }

  private static scheduleFlush() {
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.flush();
      });
    }
  }

  private static flush() {
    if (this.isLocked) {
      this.pendingTasks.clear();
      this.pendingHeightUpdates.clear();
      return;
    }

    // 1. DOM Read Phase：集中读取所有待测量 DOM 节点的属性，无任何 DOM 写入操作，防止 Layout Thrashing
    const taskResults: Array<{ id: string; callback: (val: any) => void; value: any }> = [];
    const heightUpdates: Record<string, number> = {};

    for (const [id, task] of this.pendingTasks) {
      if (task.element) {
        try {
          const val = task.measureFn(task.element);
          taskResults.push({ id, callback: task.callback, value: val });

          // 简体中文：若测量的结果是高度，或者包含测得的高度值，则顺便合并到全局高度上报更新
          if (typeof val === 'number') {
            heightUpdates[id] = val;
          } else if (val && typeof val === 'object' && 'measuredHeight' in val && typeof val.measuredHeight === 'number') {
            heightUpdates[id] = val.measuredHeight;
          }
        } catch (e) {
          console.error(`[CanvasMeasurementScheduler] Failed to measure node ${id}:`, e);
        }
      }
    }

    // 简体中文：合并直接上报的高度
    for (const [id, height] of this.pendingHeightUpdates) {
      heightUpdates[id] = height;
    }

    // 清空当前待测量队列与高度更新
    this.pendingTasks.clear();
    this.pendingHeightUpdates.clear();

    // 2. DOM Write / State Commit Phase：批量回调，更新组件或全局的 React 状态
    // (a) 先触发各卡片独立的测量更新回调
    for (const res of taskResults) {
      try {
        res.callback(res.value);
      } catch (e) {
        console.error(`[CanvasMeasurementScheduler] Error in task callback for node ${res.id}:`, e);
      }
    }

    // (b) 再分发给全局注册的监听器 (如 WorkspacePage) 进行大画布状态同步
    if (Object.keys(heightUpdates).length > 0) {
      this.callbacks.forEach((cb) => {
        try {
          cb(heightUpdates);
        } catch (e) {
          console.error('[CanvasMeasurementScheduler] Error in global batch callback:', e);
        }
      });
    }
  }

  // 简体中文：取消所有正在等待的测量更新
  static cancel() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pendingTasks.clear();
    this.pendingHeightUpdates.clear();
  }
}
