import React, { useEffect, useRef } from 'react';

import { buildCanvasV3EdgePath, getCanvasV3EdgeStyle } from './edgeGeometry.ts';
import type { CanvasEdgeViewModel } from './types.ts';

export interface CanvasV3EdgeRenderItem {
  viewModel: CanvasEdgeViewModel;
  source: { x: number; y: number };
  target: { x: number; y: number };
}

export interface CanvasEdgeLayerProps {
  edges: CanvasV3EdgeRenderItem[];
  width: number;
  height: number;
  reducedMotion?: boolean;
}

const drawEdge = (
  context: CanvasRenderingContext2D,
  edge: CanvasV3EdgeRenderItem,
) => {
  const style = getCanvasV3EdgeStyle(edge.viewModel.state === 'disabled' ? 'disabled' : 'default');
  const handle = Math.max(48, Math.abs(edge.target.x - edge.source.x) * 0.44);
  context.beginPath();
  context.moveTo(edge.source.x, edge.source.y);
  context.bezierCurveTo(
    edge.source.x + handle,
    edge.source.y,
    edge.target.x - handle,
    edge.target.y,
    edge.target.x,
    edge.target.y,
  );
  context.strokeStyle = style.stroke;
  context.lineWidth = style.strokeWidth;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.stroke();
};

/**
 * The base Canvas2D pass keeps hundreds of normal edges out of the DOM; only
 * selected/running edges enter the SVG interaction overlay.
 */
export const CanvasEdgeLayer: React.FC<CanvasEdgeLayerProps> = ({
  edges,
  width,
  height,
  reducedMotion = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayEdges = edges.filter((edge) => edge.viewModel.selected || edge.viewModel.running);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context: CanvasRenderingContext2D | null = canvas?.getContext('2d') || null;
    if (!canvas || !context) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    edges.filter((edge) => !edge.viewModel.selected && !edge.viewModel.running).forEach((edge) => drawEdge(context, edge));
  }, [edges, height, width]);

  return (
    <div className="kk-canvas-v3-edge-layer" aria-hidden="true">
      <canvas ref={canvasRef} />
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {overlayEdges.map((edge) => {
          const style = getCanvasV3EdgeStyle(edge.viewModel.selected ? 'selected' : 'default');
          return (
            <g key={edge.viewModel.id}>
              <path
                d={buildCanvasV3EdgePath(edge.source, edge.target)}
                fill="none"
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {edge.viewModel.running && !reducedMotion && (
                <circle className="kk-canvas-v3-edge-bead" r="2.5" fill={style.stroke}>
                  <animateMotion dur="1.6s" repeatCount="indefinite" path={buildCanvasV3EdgePath(edge.source, edge.target)} />
                </circle>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default CanvasEdgeLayer;
