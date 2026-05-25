import React from 'react';
import { Pause, Play, RotateCw, Sparkles } from 'lucide-react';

import { useLocale } from '../../context/LocaleContext';
import type { EcommerceEditableTaskState, PromptNode } from '../../types';
import EcommerceTaskEditorPanel from './EcommerceTaskEditorPanel';

type EcommerceFrameworkStatus = {
  activeSheet: string;
  paused: boolean;
  queued: number;
  dispatching: number;
  running: number;
  completed: number;
  failed: number;
  pausedItems: number;
  total: number;
};

interface EcommerceCanvasWorkbenchCardProps {
  node: PromptNode;
  taskNodes: PromptNode[];
  activeTaskState?: EcommerceEditableTaskState | null;
  frameworkStatus?: EcommerceFrameworkStatus | null;
  onActivateTask?: (node: PromptNode) => void;
  onTaskStateChange?: (
    taskId: string,
    updater:
      | EcommerceEditableTaskState
      | ((previous: EcommerceEditableTaskState) => EcommerceEditableTaskState),
  ) => void;
  onToggleSelected?: (node: PromptNode, selected: boolean) => void;
  onGenerateNode?: (node: PromptNode) => void;
  onGenerateFramework?: (node: PromptNode) => void;
  onPauseFramework?: (node: PromptNode) => void;
  onResumeFramework?: (node: PromptNode) => void;
  onCancelNodeQueue?: (node: PromptNode) => void;
  onConfirmDesktop?: (node: PromptNode) => void;
  onGenerateMobile?: (node: PromptNode) => void;
  onDeleteTask?: (node: PromptNode) => void;
}

const panelStyle: React.CSSProperties = {
  background: 'var(--frost-card-sub-bg)',
  borderColor: 'var(--frost-card-sub-border)',
  boxShadow: 'none',
};

const activePanelStyle: React.CSSProperties = {
  ...panelStyle,
  background: 'var(--frost-card-main-bg)',
  borderColor: 'var(--clay-brand-pink)',
};

const actionButtonStyle: React.CSSProperties = {
  background: 'var(--frost-card-sub-bg)',
  borderColor: 'var(--frost-card-sub-border)',
  boxShadow: 'none',
  color: 'var(--text-primary)',
};

const WORKBENCH_INTERACTIVE_SELECTOR = [
  'button',
  'input',
  'textarea',
  'select',
  'label',
  '[contenteditable="true"]',
  '[role="button"]',
  '[data-workbench-interactive]',
].join(',');

const isWorkbenchInteractiveTarget = (target: EventTarget | null): target is Element => (
  target instanceof Element && Boolean(target.closest(WORKBENCH_INTERACTIVE_SELECTOR))
);

function resolveTaskTitle(taskNode: PromptNode, index: number): string {
  return taskNode.ecommerce?.displayLabel
    || taskNode.ecommerce?.editableTask?.displayLabel
    || taskNode.ecommerce?.theme
    || `${index + 1}. 电商任务`;
}

function resolveTaskSummary(taskNode: PromptNode): string {
  const ecommerce = taskNode.ecommerce;
  const editableTask = ecommerce?.editableTask;
  return [
    ecommerce?.sourceSheet,
    editableTask?.declaredSizeText || editableTask?.effectiveSizeTier || editableTask?.sizeTier,
    editableTask?.copy?.headline || ecommerce?.copyText,
    ecommerce?.designRequirements,
  ].filter(Boolean).join(' · ');
}

const EcommerceCanvasWorkbenchCard: React.FC<EcommerceCanvasWorkbenchCardProps> = ({
  node,
  taskNodes,
  activeTaskState = null,
  frameworkStatus = null,
  onActivateTask,
  onTaskStateChange,
  onToggleSelected,
  onGenerateNode,
  onGenerateFramework,
  onPauseFramework,
  onResumeFramework,
  onCancelNodeQueue,
  onConfirmDesktop,
  onGenerateMobile,
  onDeleteTask,
}) => {
  const { pick } = useLocale();
  const editableTaskNodes = React.useMemo(() => (
    taskNodes.filter((taskNode) => (
      taskNode.ecommerce?.kind === 'main-image'
      || taskNode.ecommerce?.kind === 'a-plus-module'
    ))
  ), [taskNodes]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(() => editableTaskNodes[0]?.id || null);

  React.useEffect(() => {
    if (activeTaskState) {
      const activeNode = editableTaskNodes.find((taskNode) => (
        taskNode.ecommerce?.editableTask?.taskId === activeTaskState.taskId
        || taskNode.ecommerce?.sourceRowKey === activeTaskState.sourceRowKey
      ));
      if (activeNode) {
        setSelectedNodeId(activeNode.id);
        return;
      }
    }

    if (!selectedNodeId || !editableTaskNodes.some((taskNode) => taskNode.id === selectedNodeId)) {
      setSelectedNodeId(editableTaskNodes[0]?.id || null);
    }
  }, [activeTaskState, editableTaskNodes, selectedNodeId]);

  const selectedTaskNode = editableTaskNodes.find((taskNode) => taskNode.id === selectedNodeId)
    || editableTaskNodes[0]
    || null;
  const selectedTaskState = selectedTaskNode?.ecommerce?.editableTask || null;
  const selectedCount = editableTaskNodes.filter((taskNode) => taskNode.ecommerce?.selectedForGeneration !== false).length;
  const skippedCount = editableTaskNodes.length - selectedCount;
  const activeCount = (frameworkStatus?.dispatching || 0) + (frameworkStatus?.running || 0);
  const frameworkInputSummary = node.ecommerce?.frameworkMeta?.inputSummary || [];
  const referenceSummaryItems = [
    `${editableTaskNodes.reduce((count, taskNode) => count + (taskNode.referenceImages?.length || 0), 0)} ${pick('参考图', 'refs')}`,
    `${editableTaskNodes.reduce((count, taskNode) => count + (taskNode.ecommerce?.editableTask?.assetRoles?.filter((asset) => asset.role === 'product').length || 0), 0)} ${pick('产品图', 'product')}`,
    `${editableTaskNodes.filter((taskNode) => taskNode.ecommerce?.editableTask?.copy?.headline || taskNode.ecommerce?.copyText).length} ${pick('文案', 'copy')}`,
  ];

  React.useEffect(() => {
    if (!selectedTaskNode || activeTaskState) return;
    onActivateTask?.(selectedTaskNode);
  }, [activeTaskState, onActivateTask, selectedTaskNode]);

  const handleWorkbenchPointerDownCapture = React.useCallback((event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (isWorkbenchInteractiveTarget(event.target)) {
      event.stopPropagation();
    }
  }, []);

  const handleSelectTask = (taskNode: PromptNode) => {
    setSelectedNodeId(taskNode.id);
    onActivateTask?.(taskNode);
  };

  const handleGenerateSelected = () => {
    if (!selectedTaskNode) return;
    onGenerateNode?.(selectedTaskNode);
  };

  const handleGenerateMobileForSelected = () => {
    if (!selectedTaskNode) return;
    if (selectedTaskNode.ecommerce?.desktopStage === 'generated') {
      onConfirmDesktop?.(selectedTaskNode);
      return;
    }
    onGenerateMobile?.(selectedTaskNode);
  };

  return (
    <div
      className="flex min-h-0 flex-col gap-3"
      data-testid="ecommerce-canvas-framework-workbench"
      onMouseDownCapture={handleWorkbenchPointerDownCapture}
      onTouchStartCapture={handleWorkbenchPointerDownCapture}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase text-[var(--text-tertiary)]">
            {pick('电商画布卡片', 'Ecommerce canvas card')}
          </div>
          <div className="mt-1 truncate text-base font-semibold text-[var(--text-primary)]">
            {node.ecommerce?.displayLabel || node.ecommerce?.theme || pick('电商框架', 'Ecommerce framework')}
          </div>
          <div className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            {pick('输入框已回到初始状态，当前批量任务在这张画布卡里继续修改和生成。', 'The composer is reset; continue editing and generating this batch from this canvas card.')}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] text-[var(--text-secondary)]">
          <span className="rounded-full border px-2 py-1" style={panelStyle}>
            {pick('任务', 'Tasks')} {editableTaskNodes.length}
          </span>
          <span className="rounded-full border px-2 py-1" style={panelStyle}>
            {pick('已选', 'Selected')} {selectedCount}
          </span>
          <span className="rounded-full border px-2 py-1" style={panelStyle}>
            {pick('跳过', 'Skipped')} {skippedCount}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 text-[11px]">
        {[
          { label: pick('排队', 'Queued'), value: frameworkStatus?.queued || 0 },
          { label: pick('运行', 'Active'), value: activeCount },
          { label: pick('完成', 'Done'), value: frameworkStatus?.completed || 0 },
          { label: pick('失败', 'Failed'), value: frameworkStatus?.failed || 0 },
          { label: pick('暂停', 'Paused'), value: frameworkStatus?.pausedItems || 0 },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border px-2 py-2" style={panelStyle}>
            <div className="text-[10px] text-[var(--text-tertiary)]">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
        <div
          className="rounded-lg border px-3 py-2"
          style={panelStyle}
          data-testid="ecommerce-canvas-framework-input-summary"
        >
          <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
            {pick('输入内容', 'Input')}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(frameworkInputSummary.length > 0 ? frameworkInputSummary : [node.prompt.split('\n')[0] || node.ecommerce?.displayLabel || node.id]).map((item) => (
              <span key={item} className="max-w-full truncate rounded-full border px-2 py-1 text-[10px] text-[var(--text-secondary)]" style={panelStyle}>
                {item}
              </span>
            ))}
          </div>
        </div>
        <div
          className="rounded-lg border px-3 py-2"
          style={panelStyle}
          data-testid="ecommerce-canvas-framework-reference-summary"
        >
          <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
            {pick('素材', 'Assets')}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {referenceSummaryItems.map((item) => (
              <span key={item} className="rounded-full border px-2 py-1 text-[10px] text-[var(--text-secondary)]" style={panelStyle}>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-medium"
          style={{ ...actionButtonStyle, borderColor: 'var(--clay-brand-coral)' }}
          onClick={(event) => {
            event.stopPropagation();
            onGenerateFramework?.(node);
          }}
        >
          <Sparkles size={13} />
          {pick('开始队列', 'Start queue')}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-medium"
          style={{ ...actionButtonStyle, borderColor: 'var(--clay-brand-peach)' }}
          onClick={(event) => {
            event.stopPropagation();
            if (frameworkStatus?.paused) {
              onResumeFramework?.(node);
            } else {
              onPauseFramework?.(node);
            }
          }}
        >
          {frameworkStatus?.paused ? <Play size={13} /> : <Pause size={13} />}
          {frameworkStatus?.paused ? pick('继续', 'Resume') : pick('暂停', 'Pause')}
        </button>
        {selectedTaskNode ? (
          <>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-medium"
              style={actionButtonStyle}
              onClick={(event) => {
                event.stopPropagation();
                handleGenerateSelected();
              }}
            >
              <RotateCw size={13} />
              {pick('生成当前', 'Generate selected')}
            </button>
            {selectedTaskNode.ecommerce?.kind === 'a-plus-module' ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-medium"
                style={actionButtonStyle}
                onClick={(event) => {
                  event.stopPropagation();
                  handleGenerateMobileForSelected();
                }}
              >
                {selectedTaskNode.ecommerce.desktopStage === 'generated'
                  ? pick('确认桌面版', 'Confirm desktop')
                  : pick('生成移动版', 'Generate mobile')}
              </button>
            ) : null}
            {onCancelNodeQueue ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-medium"
                style={actionButtonStyle}
                onClick={(event) => {
                  event.stopPropagation();
                  onCancelNodeQueue(selectedTaskNode);
                }}
              >
                {pick('取消排队', 'Cancel queued')}
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="grid min-h-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div
          className="custom-scrollbar max-h-[430px] space-y-2 overflow-y-auto pr-1"
          data-testid="ecommerce-canvas-framework-task-list"
        >
          {editableTaskNodes.length > 0 ? editableTaskNodes.map((taskNode, index) => {
            const isActive = taskNode.id === selectedTaskNode?.id;
            const selected = taskNode.ecommerce?.selectedForGeneration !== false;
            return (
              <button
                key={taskNode.id}
                type="button"
                className="w-full rounded-lg border px-3 py-2 text-left transition-colors"
                style={isActive ? activePanelStyle : panelStyle}
                onClick={(event) => {
                  event.stopPropagation();
                  handleSelectTask(taskNode);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-[var(--text-primary)]">
                      {resolveTaskTitle(taskNode, index)}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-[var(--text-secondary)]">
                      {resolveTaskSummary(taskNode) || pick('等待补充任务参数', 'Waiting for task details')}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border px-2 py-0.5 text-[9px]" style={panelStyle}>
                    {selected ? pick('已选', 'In') : pick('跳过', 'Out')}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] text-[var(--text-tertiary)]">
                  <span>{taskNode.ecommerce?.sourceSheet}</span>
                  <span>{taskNode.referenceImages?.length || 0} {pick('参考图', 'refs')}</span>
                </div>
              </button>
            );
          }) : (
            <div className="rounded-lg border px-3 py-6 text-center text-xs text-[var(--text-tertiary)]" style={panelStyle}>
              {pick('还没有任务节点', 'No task nodes yet')}
            </div>
          )}
        </div>

        <div
          className="min-h-0 rounded-lg border p-3"
          style={panelStyle}
          data-testid="ecommerce-canvas-framework-task-editor"
        >
          {selectedTaskNode && selectedTaskState && onTaskStateChange ? (
            <div className="flex min-h-0 flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {resolveTaskTitle(selectedTaskNode, editableTaskNodes.indexOf(selectedTaskNode))}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    {resolveTaskSummary(selectedTaskNode)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onToggleSelected ? (
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-2 text-[11px] font-medium"
                      style={actionButtonStyle}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleSelected(selectedTaskNode, selectedTaskNode.ecommerce?.selectedForGeneration === false);
                      }}
                    >
                      {selectedTaskNode.ecommerce?.selectedForGeneration === false ? pick('纳入生成', 'Include') : pick('跳过生成', 'Skip')}
                    </button>
                  ) : null}
                  {onDeleteTask ? (
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-2 text-[11px] font-medium transition-colors text-[var(--clay-brand-coral)] hover:bg-[rgba(239,68,68,0.10)]"
                      style={{ ...actionButtonStyle, borderColor: 'var(--clay-brand-coral)' }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteTask(selectedTaskNode);
                      }}
                    >
                      {pick('删除卡片', 'Delete')}
                    </button>
                  ) : null}
                </div>
              </div>
              <EcommerceTaskEditorPanel
                taskState={activeTaskState?.taskId === selectedTaskState.taskId ? activeTaskState : selectedTaskState}
                onTaskStateChange={onTaskStateChange}
                compact
                collapsible
                defaultExpanded
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-[var(--text-tertiary)]" style={panelStyle}>
              {pick('选择左侧任务后编辑文案、参考图说明和构图参数。', 'Select a task on the left to edit copy, reference notes, and layout settings.')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EcommerceCanvasWorkbenchCard;
