// 简体中文：空间索引，使用网格桶（Grid Bucket）算法
export interface CanvasNodeBounds {
  x: number;      // 节点左上角的 x 坐标
  y: number;      // 节点左上角的 y 坐标
  width: number;  // 节点宽度
  height: number; // 节点高度
}

export class CanvasSpatialIndex {
  private bucketSize: number;
  // 简体中文：使用桶 key（格式为 x:y）映射到节点 ID 集合
  private buckets = new Map<string, Set<string>>();
  // 简体中文：映射节点 ID 到其最新的 bounds
  private nodeBounds = new Map<string, CanvasNodeBounds>();

  constructor(bucketSize = 1000) {
    this.bucketSize = bucketSize;
  }

  // 简体中文：更新或插入节点的位置及尺寸
  updateNode(nodeId: string, bounds: CanvasNodeBounds) {
    this.removeNode(nodeId);

    this.nodeBounds.set(nodeId, bounds);

    const startX = Math.floor(bounds.x / this.bucketSize);
    const endX = Math.floor((bounds.x + bounds.width) / this.bucketSize);
    const startY = Math.floor(bounds.y / this.bucketSize);
    const endY = Math.floor((bounds.y + bounds.height) / this.bucketSize);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = `${x}:${y}`;
        let bucket = this.buckets.get(key);
        if (!bucket) {
          bucket = new Set<string>();
          this.buckets.set(key, bucket);
        }
        bucket.add(nodeId);
      }
    }
  }

  // 简体中文：移除指定节点
  removeNode(nodeId: string) {
    const bounds = this.nodeBounds.get(nodeId);
    if (!bounds) return;

    this.nodeBounds.delete(nodeId);

    const startX = Math.floor(bounds.x / this.bucketSize);
    const endX = Math.floor((bounds.x + bounds.width) / this.bucketSize);
    const startY = Math.floor(bounds.y / this.bucketSize);
    const endY = Math.floor((bounds.y + bounds.height) / this.bucketSize);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = `${x}:${y}`;
        const bucket = this.buckets.get(key);
        if (bucket) {
          bucket.delete(nodeId);
          if (bucket.size === 0) {
            this.buckets.delete(key);
          }
        }
      }
    }
  }

  // 简体中文：清空空间索引
  clear() {
    this.buckets.clear();
    this.nodeBounds.clear();
  }

  // 简体中文：获取当前存储的节点数量
  size(): number {
    return this.nodeBounds.size;
  }

  // 简体中文：获取指定节点的 bounds
  getNodeBounds(nodeId: string): CanvasNodeBounds | undefined {
    return this.nodeBounds.get(nodeId);
  }

  getAllBounds(): CanvasNodeBounds[] {
    return Array.from(this.nodeBounds.values());
  }

  // 简体中文：查询视口边界（包含 buffer）内的所有可见节点 ID
  query(vLeft: number, vTop: number, vRight: number, vBottom: number): Set<string> {
    const result = new Set<string>();
    const startX = Math.floor(vLeft / this.bucketSize);
    const endX = Math.floor(vRight / this.bucketSize);
    const startY = Math.floor(vTop / this.bucketSize);
    const endY = Math.floor(vBottom / this.bucketSize);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = `${x}:${y}`;
        const bucket = this.buckets.get(key);
        if (bucket) {
          bucket.forEach((nodeId) => result.add(nodeId));
        }
      }
    }
    return result;
  }
}
