import React, { useRef } from 'react';
import { ArrowDown, ArrowUp, Pause, Play, Plus, RotateCcw, Square, Trash2 } from 'lucide-react';

import type { CanvasCardDetailLevel } from '../../canvas/performanceProfile.ts';
import { createWorkflowCardViewModel } from '../../canvas/v3/adapters.ts';
import type { GeneratedImage, WorkflowPanelData, WorkflowPanelNode, WorkflowPanelStep } from '../../types.ts';
import CanvasCardShell from './CanvasCardShell.tsx';

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

interface WorkflowStepRowProps {
  step: WorkflowPanelStep;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (step: WorkflowPanelStep) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}

const iconButtonClass = 'h-[30px] w-[30px] rounded-[7px] text-[var(--text-tertiary)] transition-colors duration-[125ms] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)] disabled:opacity-30';
const fieldClass = 'h-7 w-full rounded-md border border-transparent bg-transparent px-2 text-[11px] text-[var(--text-secondary)] outline-none transition-colors duration-[125ms] placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-medium)] focus:bg-[var(--bg-overlay)]';

const moveStep = (steps: WorkflowPanelStep[], index: number, delta: -1 | 1) => {
  const target = index + delta;
  if (target < 0 || target >= steps.length) return steps;
  const next = [...steps];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

const WorkflowStepRow: React.FC<WorkflowStepRowProps> = ({
  step,
  canMoveUp,
  canMoveDown,
  onChange,
  onMove,
  onRemove,
}) => (
  <div className="grid grid-cols-[20px_minmax(0,1fr)_90px] items-center gap-2 rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] p-2">
    <input
      type="checkbox"
      aria-label={`Enable ${step.label}`}
      checked={step.enabled}
      className="h-4 w-4 accent-[var(--kk-morphic-action)]"
      onChange={(event) => onChange({ ...step, enabled: event.target.checked })}
    />
    <div className="min-w-0 space-y-0.5">
      <input
        aria-label="Step label"
        value={step.label}
        className={`${fieldClass} font-medium text-[var(--text-primary)]`}
        onChange={(event) => onChange({ ...step, label: event.target.value })}
      />
      <input
        aria-label="Tool name"
        placeholder="Tool name"
        value={String(step.parameters.toolName || '')}
        className={fieldClass}
        onChange={(event) => onChange({ ...step, parameters: { ...step.parameters, toolName: event.target.value } })}
      />
      <input
        aria-label="Tool input JSON"
        placeholder="Tool input JSON"
        value={String(step.parameters.input || '')}
        className={fieldClass}
        onChange={(event) => onChange({ ...step, parameters: { ...step.parameters, input: event.target.value } })}
      />
    </div>
    <div className="flex items-center justify-end">
      <button type="button" title="Move up" className={iconButtonClass} disabled={!canMoveUp} onClick={() => onMove(-1)}>
        <ArrowUp className="mx-auto h-3.5 w-3.5" />
      </button>
      <button type="button" title="Move down" className={iconButtonClass} disabled={!canMoveDown} onClick={() => onMove(1)}>
        <ArrowDown className="mx-auto h-3.5 w-3.5" />
      </button>
      <button type="button" title="Remove step" className={`${iconButtonClass} hover:text-[var(--state-error-text)]`} onClick={onRemove}>
        <Trash2 className="mx-auto h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);

/**
 * Canvas V3 workflow editor keeps execution controls available while allowing
 * the card body to shrink to its actual step count.
 */
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
  const viewModel = createWorkflowCardViewModel({
    id: node.id,
    kind: 'workflow-panel',
    label: data.title,
    position: node.position,
    data: { ...data },
  });
  const estimatedHeight = 72 + Math.min(352, (data.steps.length * 104) + 44);

  return (
    <CanvasCardShell
      id={node.id}
      position={node.position}
      presentation={node.presentation!}
      width={viewModel.width}
      height={estimatedHeight}
      zIndex={node.zIndex}
      selected={selected}
      detailLevel={detailLevel}
      data-card-v3-kind={viewModel.kind}
      data-card-v3-status={viewModel.status}
      className="kk-canvas-v3-workflow-editor pointer-events-auto"
    >
      <header
        className="flex h-9 cursor-grab items-center justify-between border-b border-[var(--border-light)] px-3"
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
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--kk-morphic-action)]" />
          <span className="truncate text-xs font-medium text-[var(--text-primary)]">{viewModel.title}</span>
          <span className="shrink-0 text-[10px] text-[var(--text-tertiary)]">{viewModel.statusLabel}</span>
        </div>
        <button
          type="button"
          title="Delete workflow"
          className={`${iconButtonClass} hover:text-[var(--state-error-text)]`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onDelete}
        >
          <Trash2 className="mx-auto h-4 w-4" />
        </button>
      </header>

      <div className="flex max-h-[min(50vh,352px)] flex-col gap-1.5 overflow-y-auto p-2">
        {data.steps.map((step, index) => (
          <WorkflowStepRow
            key={step.id}
            step={step}
            canMoveUp={index > 0}
            canMoveDown={index < data.steps.length - 1}
            onChange={(nextStep) => updateSteps(data.steps.map((item) => item.id === step.id ? nextStep : item))}
            onMove={(delta) => updateSteps(moveStep(data.steps, index, delta))}
            onRemove={() => updateSteps(data.steps.filter((item) => item.id !== step.id))}
          />
        ))}
        <button
          type="button"
          className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg text-xs text-[var(--text-secondary)] transition-colors duration-[125ms] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]"
          onClick={() => updateSteps([...data.steps, { id: `step-${Date.now().toString(36)}`, label: 'New step', enabled: true, parameters: {} }])}
        >
          <Plus className="h-4 w-4" /> Add step
        </button>
      </div>

      <footer className="flex h-9 items-center justify-between gap-2 border-t border-[var(--border-light)] px-2">
        <div className="flex min-w-0 items-center gap-1" aria-label={`${data.outputNodeIds.length} workflow outputs`}>
          {outputMedia.slice(0, 3).map((media) => {
            const source = media.originalUrl || media.apiResultUrl || media.url;
            return source ? (
              <img key={media.id} src={source} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
            ) : (
              <div key={media.id} className="h-6 w-6 shrink-0 rounded border border-[var(--border-light)] bg-[var(--bg-tertiary)]" />
            );
          })}
          <span className="truncate text-[10px] text-[var(--text-tertiary)]">{data.outputNodeIds.length} outputs</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" title="Run" className={`${iconButtonClass} text-[var(--state-success-text)]`} onClick={() => onCommand('run')}><Play className="mx-auto h-4 w-4" /></button>
          <button type="button" title="Pause" className={iconButtonClass} onClick={() => onCommand('pause')}><Pause className="mx-auto h-4 w-4" /></button>
          <button type="button" title="Cancel" className={iconButtonClass} onClick={() => onCommand('cancel')}><Square className="mx-auto h-4 w-4" /></button>
          {data.status === 'failed' && (
            <button type="button" title="Retry failed workflow" className={iconButtonClass} onClick={() => onCommand('retry')}>
              <RotateCcw className="mx-auto h-4 w-4" />
            </button>
          )}
        </div>
      </footer>
    </CanvasCardShell>
  );
};

export default WorkflowPanelCard;
