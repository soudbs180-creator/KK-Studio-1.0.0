// 简体中文：统一测量调度器，将高频测高读取进行批处理，防止强制同步排版 (Layout Thrashing)
export class CanvasMeasurementScheduler {
  private static pendingHeightUpdates = new Map<string, number>();
  private static rafId: number | null = null;
  private static callbacks = new Set<(updates: Record<string, number>) => void>();

  // 简体中文：注册批量高度更新的监听器
  static registerCallback(cb: (updates: Record<string, number>) => void) {
    this.callbacks.add(cb);
  }

  // 简体中文：注销监听器
  static unregisterCallback(cb: (updates: Record<string, number>) => void) {
    this.callbacks.delete(cb);
  }

  // 简体中文：请求批量更新某个卡片高度
  static requestHeightUpdate(id: string, height: number) {
    this.pendingHeightUpdates.set(id, height);

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        if (this.pendingHeightUpdates.size === 0) return;

        const updates = Object.fromEntries(this.pendingHeightUpdates.entries());
        this.pendingHeightUpdates.clear();

        this.callbacks.forEach((cb) => cb(updates));
      });
    }
  }

  // 简体中文：取消所有正在等待的测量更新
  static cancel() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pendingHeightUpdates.clear();
  }
}
