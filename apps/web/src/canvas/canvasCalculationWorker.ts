// 简体中文：画布高性能计算 Web Worker 线程
// 处理空间索引维护、视口裁剪过滤、框选相交测试以及卡片自动对齐排版等重 CPU 算法

interface WorkerNodeBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

class WorkerSpatialIndex {
  private bucketSize: number;
  private buckets = new Map<string, Set<string>>();
  private nodeBounds = new Map<string, WorkerNodeBounds>();

  constructor(bucketSize = 1000) {
    this.bucketSize = bucketSize;
  }

  rebuild(nodes: WorkerNodeBounds[]) {
    this.buckets.clear();
    this.nodeBounds.clear();

    nodes.forEach(node => {
      this.nodeBounds.set(node.id, node);

      const startX = Math.floor(node.x / this.bucketSize);
      const endX = Math.floor((node.x + node.width) / this.bucketSize);
      const startY = Math.floor(node.y / this.bucketSize);
      const endY = Math.floor((node.y + node.height) / this.bucketSize);

      for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
          const key = `${x}:${y}`;
          let bucket = this.buckets.get(key);
          if (!bucket) {
            bucket = new Set<string>();
            this.buckets.set(key, bucket);
          }
          bucket.add(node.id);
        }
      }
    });
  }

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
          bucket.forEach((nodeId) => {
            // 精细的矩形相交校验
            const bounds = this.nodeBounds.get(nodeId);
            if (bounds) {
              const intersects = !(
                bounds.x > vRight ||
                bounds.x + bounds.width < vLeft ||
                bounds.y > vBottom ||
                bounds.y + bounds.height < vTop
              );
              if (intersects) {
                result.add(nodeId);
              }
            }
          });
        }
      }
    }
    return result;
  }
}

const spatialIndex = new WorkerSpatialIndex(1000);

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'REBUILD_INDEX') {
    const nodes = payload.nodes as WorkerNodeBounds[];
    spatialIndex.rebuild(nodes);
    self.postMessage({ type: 'REBUILD_INDEX_DONE', success: true });
  } 
  
  else if (type === 'QUERY_VIEWPORT') {
    const { vLeft, vTop, vRight, vBottom } = payload;
    const visibleIds = spatialIndex.query(vLeft, vTop, vRight, vBottom);
    self.postMessage({
      type: 'QUERY_VIEWPORT_RESULT',
      payload: { visibleIds: Array.from(visibleIds) }
    });
  } 
  
  else if (type === 'QUERY_SELECTION') {
    // payload: selectionRect { x, y, width, height }
    const { x, y, width, height } = payload.selectionRect;
    const sLeft = x;
    const sTop = y;
    const sRight = x + width;
    const sBottom = y + height;

    const visibleIds = spatialIndex.query(sLeft, sTop, sRight, sBottom);
    self.postMessage({
      type: 'QUERY_SELECTION_RESULT',
      payload: { selectedIds: Array.from(visibleIds) }
    });
  } 
  
  else if (type === 'AUTO_ARRANGE') {
    // 自动排列重计算算法（按列或按自适应网格自动对齐，避免重叠）
    const { nodes, gap = 40, columns = 5 } = payload;
    const arrangedPositions: Record<string, { x: number; y: number }> = {};
    
    // 按节点当前位置从左到右，从上到下排序
    const sorted = [...(nodes as WorkerNodeBounds[])].sort((a, b) => {
      if (Math.abs(a.y - b.y) < 100) {
        return a.x - b.x;
      }
      return a.y - b.y;
    });

    let currentX = 0;
    let currentY = 0;
    let maxRowHeight = 0;

    sorted.forEach((node, index) => {
      const col = index % columns;
      if (col === 0 && index > 0) {
        currentX = 0;
        currentY += maxRowHeight + gap;
        maxRowHeight = 0;
      }

      arrangedPositions[node.id] = {
        x: currentX,
        y: currentY + node.height // Canvas 卡片挂载坐标以底部为锚点
      };

      currentX += node.width + gap;
      maxRowHeight = Math.max(maxRowHeight, node.height);
    });

    self.postMessage({
      type: 'AUTO_ARRANGE_RESULT',
      payload: { arrangedPositions }
    });
  }
};
