import React from 'react';

import type { DragConnectionState } from './appCanvasTypes';

interface CanvasTransformState {
  x: number;
  y: number;
  scale: number;
}

interface UseCanvasDragConnectionArgs {
  canvasTransform: CanvasTransformState;
  linkNodes: (startId: string, targetId: string) => void;
}

interface UseCanvasDragConnectionResult {
  dragConnection: DragConnectionState;
  handleConnectStart: (id: string, startPos: { x: number; y: number }) => void;
  handleConnectEnd: (targetId: string) => void;
  handleDragConnectionMouseMove: (event: React.MouseEvent) => void;
  handleDragConnectionMouseUp: () => void;
}

export function useCanvasDragConnection({
  canvasTransform,
  linkNodes,
}: UseCanvasDragConnectionArgs): UseCanvasDragConnectionResult {
  const [dragConnection, setDragConnection] = React.useState<DragConnectionState>(null);
  const dragConnectionRef = React.useRef<DragConnectionState>(null);

  const updateDragConnection = React.useCallback((nextDragConnection: DragConnectionState) => {
    dragConnectionRef.current = nextDragConnection;
    setDragConnection(nextDragConnection);
  }, []);

  const handleConnectStart = React.useCallback((id: string, startPos: { x: number; y: number }) => {
    const nextDragConnection = {
      active: true,
      startId: id,
      startPos,
      currentPos: startPos,
    } satisfies NonNullable<DragConnectionState>;

    updateDragConnection(nextDragConnection);
  }, [updateDragConnection]);

  const handleConnectEnd = React.useCallback((targetId: string) => {
    const currentDragConnection = dragConnectionRef.current;
    if (currentDragConnection?.active) {
      linkNodes(currentDragConnection.startId, targetId);
    }

    updateDragConnection(null);
  }, [linkNodes, updateDragConnection]);

  const handleDragConnectionMouseMove = React.useCallback((event: React.MouseEvent) => {
    const currentDragConnection = dragConnectionRef.current;
    if (!currentDragConnection?.active) {
      return;
    }

    updateDragConnection({
      ...currentDragConnection,
      currentPos: {
        x: (event.clientX - canvasTransform.x) / canvasTransform.scale,
        y: (event.clientY - canvasTransform.y) / canvasTransform.scale,
      },
    });
  }, [canvasTransform, updateDragConnection]);

  const handleDragConnectionMouseUp = React.useCallback(() => {
    if (!dragConnectionRef.current?.active) {
      return;
    }

    updateDragConnection(null);
  }, [updateDragConnection]);

  React.useEffect(() => {
    dragConnectionRef.current = dragConnection;
  }, [dragConnection]);

  return {
    dragConnection,
    handleConnectStart,
    handleConnectEnd,
    handleDragConnectionMouseMove,
    handleDragConnectionMouseUp,
  };
}
