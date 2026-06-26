export interface CanvasNodeOptions {
  type: string;
  x: number;
  y: number;
  data: Record<string, any>;
}

export class CanvasRuntime {
  private static instance: CanvasRuntime;

  private constructor() {}

  public static getInstance(): CanvasRuntime {
    if (!CanvasRuntime.instance) {
      CanvasRuntime.instance = new CanvasRuntime();
    }
    return CanvasRuntime.instance;
  }

  /**
   * Safe interface to create a card node on the canvas
   */
  public createNode(canvasContext: any, options: CanvasNodeOptions): any {
    const id = `${options.type}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const newNode = {
      id,
      type: options.type,
      x: options.x,
      y: options.y,
      data: {
        ...options.data,
        createdAt: Date.now()
      }
    };
    
    if (typeof canvasContext?.addNode === 'function') {
      canvasContext.addNode(newNode);
    } else {
      console.warn(`[CanvasRuntime] addNode function not found in context. Mocking insertion:`, newNode);
    }
    return newNode;
  }

  /**
   * Arrange multiple nodes neatly on the canvas to avoid geometric overlaps
   */
  public arrangeNodes(canvasContext: any, nodeIds: string[]): void {
    if (typeof canvasContext?.arrangeNodes === 'function') {
      canvasContext.arrangeNodes(nodeIds);
    } else {
      console.log(`[CanvasRuntime] Arrange nodes triggered for:`, nodeIds);
    }
  }
}

export const canvasRuntime = CanvasRuntime.getInstance();
