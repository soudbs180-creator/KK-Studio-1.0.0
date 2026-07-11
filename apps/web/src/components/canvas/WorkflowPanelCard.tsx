import React, { useRef } from 'react';
import { ArrowDown, ArrowUp, Pause, Play, Plus, RotateCcw, Square, Trash2 } from 'lucide-react';
import type { GeneratedImage, WorkflowPanelData, WorkflowPanelNode, WorkflowPanelStep } from '../../types.ts';
import CanvasCardShell from './CanvasCardShell.tsx';
import type { CanvasCardDetailLevel } from '../../canvas/performanceProfile.ts';

interface WorkflowPanelCardProps {
  node: WorkflowPanelNode;
  selected: boolean;
  zoomScale: number;
  onSelect: () => void;
  onDelete: () => void;
  onPositionChange: (position: { x: number; y: number }) => void;
  onDataChange: (data: WorkflowPanelData) => void;
  onCommand: (action: 'run' | 'pause' | 'cancel' | 'retry') => void;
  outputMedia?: GeneratedImage[];
  detailLevel?: CanvasCardDetailLevel;
}

const moveStep = (steps: WorkflowPanelStep[], index: number, delta: -1 | 1) => {
  const target = index + delta;
  if (target < 0 || target >= steps.length) return steps;
  const next = [...steps];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

export const WorkflowPanelCard: React.FC<WorkflowPanelCardProps> = ({
  node,
  selected,
  zoomScale,
  onSelect,
  onDelete,
  onPositionChange,
  onDataChange,
  onCommand,
  outputMedia = [],
  detailLevel = 'full',
}) => {
  const dragRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const data = node.data;
  const updateSteps = (steps: WorkflowPanelStep[]) => onDataChange({ ...data, steps });

  return (
    <CanvasCardShell
      id={node.id}
      position={node.position}
      presentation={node.presentation!}
      height={node.height || 420}
      zIndex={node.zIndex}
      selected={selected}
      detailLevel={detailLevel}
      className="pointer-events-auto bg-zinc-950/95"
    >
      <header
        className="flex h-11 cursor-grab items-center justify-between border-b border-white/10 px-3"
        onPointerDown={(event) => {
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, y: event.clientY, originX: node.position.x, originY: node.position.y };
          onSelect();
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag) return;
          onPositionChange({
            x: drag.originX + (event.clientX - drag.x) / Math.max(zoomScale, 0.1),
            y: drag.originY + (event.clientY - drag.y) / Math.max(zoomScale, 0.1),
          });
        }}
        onPointerUp={(event) => {
          dragRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-zinc-100">{data.title}</div>
          <div className="text-[10px] text-zinc-500">{data.status}</div>
        </div>
        <button type="button" title="Delete workflow" className="h-11 w-11 text-zinc-500 hover:text-red-300" onPointerDown={(event) => event.stopPropagation()} onClick={onDelete}>
          <Trash2 className="mx-auto h-4 w-4" />
        </button>
      </header>

      <div className="flex h-[309px] flex-col overflow-y-auto px-3 py-2">
        {data.steps.map((step, index) => (
          <div key={step.id} className="grid grid-cols-[24px_minmax(0,1fr)_132px] items-center gap-2 border-b border-white/5 py-2">
            <input
              type="checkbox"
              aria-label={`Enable ${step.label}`}
              checked={step.enabled}
              onChange={(event) => updateSteps(data.steps.map((item) => item.id === step.id ? { ...item, enabled: event.target.checked } : item))}
            />
            <div className="min-w-0">
              <input
                value={step.label}
                onChange={(event) => updateSteps(data.steps.map((item) => item.id === step.id ? { ...item, label: event.target.value } : item))}
                className="h-7 w-full border-0 bg-transparent text-xs text-zinc-200 outline-none"
              />
              <input
                placeholder="Tool name"
                value={String(step.parameters.toolName || '')}
                onChange={(event) => updateSteps(data.steps.map((item) => item.id === step.id ? { ...item, parameters: { ...item.parameters, toolName: event.target.value } } : item))}
                className="h-7 w-full border-0 bg-transparent text-[11px] text-zinc-500 outline-none"
              />
              <input
                value={String(step.parameters.input || '')}
                placeholder="Tool input JSON"
                onChange={(event) => updateSteps(data.steps.map((item) => item.id === step.id ? { ...item, parameters: { ...item.parameters, input: event.target.value } } : item))}
                className="h-7 w-full border-0 bg-transparent text-[11px] text-zinc-500 outline-none"
              />
            </div>
            <div className="flex items-center justify-end">
              <button type="button" title="Move up" className="h-11 w-11 text-zinc-500 hover:text-zinc-200" onClick={() => updateSteps(moveStep(data.steps, index, -1))}><ArrowUp className="mx-auto h-3.5 w-3.5" /></button>
              <button type="button" title="Move down" className="h-11 w-11 text-zinc-500 hover:text-zinc-200" onClick={() => updateSteps(moveStep(data.steps, index, 1))}><ArrowDown className="mx-auto h-3.5 w-3.5" /></button>
              <button type="button" title="Remove step" className="h-11 w-11 text-zinc-500 hover:text-red-300" onClick={() => updateSteps(data.steps.filter((item) => item.id !== step.id))}><Trash2 className="mx-auto h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="mt-2 flex h-11 items-center justify-center gap-1 text-xs text-zinc-400 hover:text-zinc-100"
          onClick={() => updateSteps([...data.steps, { id: `step-${Date.now().toString(36)}`, label: 'New step', enabled: true, parameters: {} }])}
        >
          <Plus className="h-4 w-4" /> Add step
        </button>
      </div>

      <footer className="flex h-[60px] items-center justify-between gap-2 border-t border-white/10 px-3">
        <div className="flex min-w-0 items-center gap-1.5" aria-label={`${data.outputNodeIds.length} workflow outputs`}>
          {outputMedia.slice(0, 4).map((media) => {
            const source = media.originalUrl || media.apiResultUrl || media.url;
            return source ? (
              <img key={media.id} src={source} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
            ) : (
              <div key={media.id} className="h-8 w-8 shrink-0 rounded border border-white/10 bg-white/5" />
            );
          })}
          <span className="truncate text-[10px] text-zinc-500">{data.outputNodeIds.length} outputs</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" title="Run" className="h-11 w-11 text-emerald-400" onClick={() => onCommand('run')}><Play className="mx-auto h-4 w-4" /></button>
          <button type="button" title="Pause" className="h-11 w-11 text-amber-300" onClick={() => onCommand('pause')}><Pause className="mx-auto h-4 w-4" /></button>
          <button type="button" title="Cancel" className="h-11 w-11 text-zinc-400" onClick={() => onCommand('cancel')}><Square className="mx-auto h-4 w-4" /></button>
          {data.status === 'failed' && <button type="button" title="Retry failed workflow" className="h-11 w-11 text-sky-300" onClick={() => onCommand('retry')}><RotateCcw className="mx-auto h-4 w-4" /></button>}
        </div>
      </footer>
    </CanvasCardShell>
  );
};

export default WorkflowPanelCard;
