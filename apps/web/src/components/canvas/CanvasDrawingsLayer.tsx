import React from 'react';
import { type CanvasDrawing } from '../../types';

interface CanvasDrawingsLayerProps {
    drawings: CanvasDrawing[];
}

export const CanvasDrawingsLayer: React.FC<CanvasDrawingsLayerProps> = ({ drawings }) => {
    if (!drawings || drawings.length === 0) return null;

    return (
        <g className="canvas-drawings-layer" style={{ pointerEvents: 'none' }}>
            {drawings.map((drawing) => {
                const { id, type, points, color, width, text, fontSize } = drawing;
                if (!points || points.length === 0) return null;

                const baseStrokeProps = {
                    stroke: color,
                    strokeWidth: width,
                    strokeLinecap: 'round' as const,
                    strokeLinejoin: 'round' as const,
                    fill: 'none',
                };

                if (type === 'pen' || type === 'marker') {
                    // 自由画笔：将点序列连成 SVG 路径
                    let d = `M ${points[0].x} ${points[0].y}`;
                    for (let i = 1; i < points.length; i++) {
                        d += ` L ${points[i].x} ${points[i].y}`;
                    }
                    return (
                        <path
                            key={id}
                            d={d}
                            {...baseStrokeProps}
                            opacity={type === 'marker' ? 0.45 : 1}
                        />
                    );
                }

                if (type === 'rect') {
                    if (points.length < 2) return null;
                    const p1 = points[0];
                    const p2 = points[1];
                    const x = Math.min(p1.x, p2.x);
                    const y = Math.min(p1.y, p2.y);
                    const w = Math.abs(p1.x - p2.x);
                    const h = Math.abs(p1.y - p2.y);
                    return (
                        <rect
                            key={id}
                            x={x}
                            y={y}
                            width={w}
                            height={h}
                            rx={4}
                            ry={4}
                            stroke={color}
                            strokeWidth={width}
                            fill={drawing.fillColor || 'none'}
                        />
                    );
                }

                if (type === 'circle') {
                    if (points.length < 2) return null;
                    const p1 = points[0];
                    const p2 = points[1];
                    const cx = (p1.x + p2.x) / 2;
                    const cy = (p1.y + p2.y) / 2;
                    const r = Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2;
                    return (
                        <circle
                            key={id}
                            cx={cx}
                            cy={cy}
                            r={r}
                            stroke={color}
                            strokeWidth={width}
                            fill={drawing.fillColor || 'none'}
                        />
                    );
                }

                if (type === 'line') {
                    if (points.length < 2) return null;
                    const p1 = points[0];
                    const p2 = points[1];
                    return (
                        <line
                            key={id}
                            x1={p1.x}
                            y1={p1.y}
                            x2={p2.x}
                            y2={p2.y}
                            {...baseStrokeProps}
                        />
                    );
                }

                if (type === 'arrow') {
                    if (points.length < 2) return null;
                    const p1 = points[0];
                    const p2 = points[1];
                    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                    const arrowLength = 14 + width * 1.5; // 根据线宽自适应箭头长度
                    const arrowAngle = Math.PI / 6; // 30度角
                    
                    const x3 = p2.x - arrowLength * Math.cos(angle - arrowAngle);
                    const y3 = p2.y - arrowLength * Math.sin(angle - arrowAngle);
                    const x4 = p2.x - arrowLength * Math.cos(angle + arrowAngle);
                    const y4 = p2.y - arrowLength * Math.sin(angle + arrowAngle);

                    return (
                        <g key={id}>
                            <line
                                x1={p1.x}
                                y1={p1.y}
                                x2={p2.x}
                                y2={p2.y}
                                {...baseStrokeProps}
                            />
                            <line
                                x1={p2.x}
                                y1={p2.y}
                                x2={x3}
                                y2={y3}
                                {...baseStrokeProps}
                            />
                            <line
                                x1={p2.x}
                                y1={p2.y}
                                x2={x4}
                                y2={y4}
                                {...baseStrokeProps}
                            />
                        </g>
                    );
                }

                if (type === 'text') {
                    const p = points[0];
                    return (
                        <text
                            key={id}
                            x={p.x}
                            y={p.y}
                            fill={color}
                            fontSize={fontSize || 16}
                            fontFamily="Inter, system-ui, sans-serif"
                            fontWeight="500"
                            dominantBaseline="text-before-edge"
                            style={{ userSelect: 'none' }}
                        >
                            {text}
                        </text>
                    );
                }

                return null;
            })}
        </g>
    );
};

export default CanvasDrawingsLayer;
