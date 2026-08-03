import React, { useMemo, useState } from 'react';
import { KK_LAYER } from '@kk/ui';
import type { CanvasConnection, CanvasConnectionSide } from '@kk/shared';
import { buildSoftConnectorPath } from '../../canvas/connectorGeometry';

export interface CanvasConnectionNode {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
}

interface CanvasConnectionLayerProps {
  nodes: CanvasConnectionNode[];
  connections: CanvasConnection[];
  onCreateConnection: (sourceNodeId: string, targetNodeId: string, sourcePort: CanvasConnectionSide, targetPort: CanvasConnectionSide) => void;
}

type PortDrag = {
  sourceNodeId: string;
  sourcePort: CanvasConnectionSide;
  start: { x: number; y: number };
  current: { x: number; y: number };
  targetNodeId?: string;
  targetPort?: CanvasConnectionSide;
};

const getNodeBounds = (node: CanvasConnectionNode) => ({
  left: node.position.x - node.width / 2,
  top: node.position.y - node.height,
  right: node.position.x + node.width / 2,
  bottom: node.position.y,
});

const getPortPoint = (node: CanvasConnectionNode, side: CanvasConnectionSide) => {
  const bounds = getNodeBounds(node);
  if (side === 'top') return { x: node.position.x, y: bounds.top };
  if (side === 'bottom') return { x: node.position.x, y: bounds.bottom };
  if (side === 'left') return { x: bounds.left, y: node.position.y - node.height / 2 };
  return { x: bounds.right, y: node.position.y - node.height / 2 };
};

const PORTS: CanvasConnectionSide[] = ['top', 'right', 'bottom', 'left'];

const getCanvasPoint = (svg: SVGSVGElement, clientX: number, clientY: number) => {
  const screenMatrix = svg.getScreenCTM?.();
  if (screenMatrix) {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const canvasPoint = point.matrixTransform(screenMatrix.inverse());
    return {
      point: { x: canvasPoint.x, y: canvasPoint.y },
      scale: Math.max(0.01, Math.hypot(screenMatrix.a, screenMatrix.b)),
    };
  }

  // Older embedded webviews may not expose an SVG screen matrix. Keep a
  // conservative local fallback instead of making port dragging unusable.
  const rect = svg.getBoundingClientRect();
  return {
    point: { x: clientX - rect.left, y: clientY - rect.top },
    scale: 1,
  };
};

const findPortHit = (
  point: { x: number; y: number },
  nodes: CanvasConnectionNode[],
  sourceNodeId: string,
  scale: number,
) => {
  const tolerance = Math.max(8, 14 / Math.max(scale, 0.1));
  let closest: { nodeId: string; port: CanvasConnectionSide; distance: number } | null = null;
  for (const node of nodes) {
    if (node.id === sourceNodeId) continue;
    for (const port of PORTS) {
      const portPoint = getPortPoint(node, port);
      const distance = Math.hypot(point.x - portPoint.x, point.y - portPoint.y);
      if (distance > tolerance || (closest && distance >= closest.distance)) continue;
      closest = { nodeId: node.id, port, distance };
    }
  }
  return closest;
};

export const CanvasConnectionLayer: React.FC<CanvasConnectionLayerProps> = ({ nodes, connections, onCreateConnection }) => {
  const [portDrag, setPortDrag] = useState<PortDrag | null>(null);
  const portDragRef = React.useRef<PortDrag | null>(null);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const handlePortPointerDown = (event: React.PointerEvent<SVGCircleElement>, nodeId: string, port: CanvasConnectionSide) => {
    event.preventDefault();
    event.stopPropagation();
    const node = nodeById.get(nodeId);
    if (!node) return;
    const point = getPortPoint(node, port);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const next = { sourceNodeId: nodeId, sourcePort: port, start: point, current: point };
    portDragRef.current = next;
    setPortDrag(next);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = portDragRef.current;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    const { point, scale } = getCanvasPoint(event.currentTarget, event.clientX, event.clientY);
    const target = findPortHit(point, nodes, drag.sourceNodeId, scale);
    const next = {
      ...drag,
      current: point,
      targetNodeId: target?.nodeId,
      targetPort: target?.port,
    };
    portDragRef.current = next;
    setPortDrag(next);
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = portDragRef.current;
    if (!drag) return;
    event.preventDefault();
    if (drag.targetNodeId && drag.targetPort) {
      onCreateConnection(drag.sourceNodeId, drag.targetNodeId, drag.sourcePort, drag.targetPort);
    }
    portDragRef.current = null;
    setPortDrag(null);
  };

  return (
    <svg
      className="absolute inset-0 overflow-visible"
      style={{ width: '1px', height: '1px', zIndex: KK_LAYER.connector, pointerEvents: 'none' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {connections.map((connection) => {
        const sourceNode = nodeById.get(connection.sourceNodeId);
        const targetNode = nodeById.get(connection.targetNodeId);
        if (!sourceNode || !targetNode) return null;
        const source = getPortPoint(sourceNode, connection.sourcePort);
        const target = getPortPoint(targetNode, connection.targetPort);
        return (
          <path
            key={connection.id}
            d={buildSoftConnectorPath(source.x, source.y, target.x, target.y)}
            fill="none"
            stroke="var(--kk-morphic-action)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            opacity={0.55}
            className={connection.style === 'animated' ? 'kk-canvas-connection-flow' : undefined}
          />
        );
      })}
      {nodes.flatMap((node) => PORTS.map((port) => {
        const point = getPortPoint(node, port);
        return (
          <circle
            key={`${node.id}:${port}`}
            cx={point.x}
            cy={point.y}
            r={4}
            fill="var(--kk-morphic-panel)"
            stroke="var(--kk-morphic-action)"
            strokeWidth={1.5}
            data-connection-target="true"
            data-node-id={node.id}
            data-port={port}
            aria-label={`Connect ${port} port of ${node.id}`}
            style={{
              pointerEvents: 'auto',
              cursor: 'crosshair',
              opacity: portDrag?.targetNodeId === node.id && portDrag.targetPort === port ? 1 : 0.55,
            }}
            onPointerDown={(event) => handlePortPointerDown(event, node.id, port)}
          />
        );
      }))}
      {portDrag && (
        <path
          d={`M ${portDrag.start.x} ${portDrag.start.y} L ${portDrag.current.x} ${portDrag.current.y}`}
          fill="none"
          stroke="var(--kk-morphic-action)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeDasharray="5 4"
        />
      )}
    </svg>
  );
};

export default CanvasConnectionLayer;
