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

type PortDrag = { sourceNodeId: string; sourcePort: CanvasConnectionSide; x: number; y: number };

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

export const CanvasConnectionLayer: React.FC<CanvasConnectionLayerProps> = ({ nodes, connections, onCreateConnection }) => {
  const [portDrag, setPortDrag] = useState<PortDrag | null>(null);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const handlePortPointerDown = (event: React.PointerEvent<SVGCircleElement>, nodeId: string, port: CanvasConnectionSide) => {
    event.stopPropagation();
    const node = nodeById.get(nodeId);
    if (!node) return;
    const point = getPortPoint(node, port);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setPortDrag({ sourceNodeId: nodeId, sourcePort: port, x: point.x, y: point.y });
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!portDrag) return;
    event.stopPropagation();
    const svg = event.currentTarget.getBoundingClientRect();
    setPortDrag((current) => current ? { ...current, x: event.clientX - svg.left, y: event.clientY - svg.top } : current);
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!portDrag) return;
    const target = (event.target as Element).closest<SVGCircleElement>('[data-connection-target="true"]');
    const targetNodeId = target?.getAttribute('data-node-id');
    const targetPort = target?.getAttribute('data-port') as CanvasConnectionSide | null;
    if (targetNodeId && targetPort && targetNodeId !== portDrag.sourceNodeId) {
      onCreateConnection(portDrag.sourceNodeId, targetNodeId, portDrag.sourcePort, targetPort);
    }
    setPortDrag(null);
  };

  return (
    <svg
      className="absolute inset-0 overflow-visible"
      style={{ width: '1px', height: '1px', zIndex: KK_LAYER.connector, pointerEvents: 'none' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
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
            style={{ pointerEvents: 'auto', cursor: 'crosshair', opacity: 0.55 }}
            onPointerDown={(event) => handlePortPointerDown(event, node.id, port)}
          />
        );
      }))}
      {portDrag && (
        <path d={`M ${portDrag.x} ${portDrag.y} L ${portDrag.x + 1} ${portDrag.y + 1}`} fill="none" stroke="var(--kk-morphic-action)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
};

export default CanvasConnectionLayer;
