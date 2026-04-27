import React from 'react';

import type { EcommerceEditableTaskState, PromptNode } from '../../types';

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

interface EcommerceCardActionsProps {
  node: PromptNode;
  taskState?: EcommerceEditableTaskState;
  activeTaskState?: EcommerceEditableTaskState | null;
  frameworkStatus?: EcommerceFrameworkStatus | null;
  onActivateTask?: (node: PromptNode) => void;
  onTaskStateChange?: (
    taskId: string,
    updater:
      | EcommerceEditableTaskState
      | ((previous: EcommerceEditableTaskState) => EcommerceEditableTaskState),
  ) => void;
  onToggleSelected: (node: PromptNode, selected: boolean) => void;
  onSetGroupSelection?: (node: PromptNode, selected: boolean) => void;
  onGenerateNode: (node: PromptNode) => void;
  onGenerateGroup: (node: PromptNode, phase: 'desktop' | 'mobile') => void;
  onGenerateFramework?: (node: PromptNode) => void;
  onPauseFramework?: (node: PromptNode) => void;
  onResumeFramework?: (node: PromptNode) => void;
  onCancelNodeQueue?: (node: PromptNode) => void;
  onConfirmDesktop: (node: PromptNode) => void;
  onGenerateMobile: (node: PromptNode) => void;
}

const actionClass = 'rounded-md border px-2 py-1 text-[11px] leading-none transition-colors';

const EcommerceCardActions: React.FC<EcommerceCardActionsProps> = ({
  node,
  taskState,
  activeTaskState = null,
  frameworkStatus = null,
  onActivateTask,
  onTaskStateChange,
  onToggleSelected,
  onSetGroupSelection,
  onGenerateNode,
  onGenerateGroup,
  onGenerateFramework,
  onPauseFramework,
  onResumeFramework,
  onCancelNodeQueue,
  onConfirmDesktop,
  onGenerateMobile,
}) => {
  const ecommerce = node.ecommerce;
  if (!ecommerce) return null;

  const selected = ecommerce.selectedForGeneration !== false;
  const isFramework = ecommerce.kind === 'framework';
  const isModule = ecommerce.kind === 'a-plus-module';
  const isGroup = ecommerce.kind === 'a-plus-group';
  const effectiveSizePolicy = ecommerce.effectiveSizePolicy || ecommerce.sizePolicy;
  const effectiveSizeTier = ecommerce.effectiveSizeTier || ecommerce.sizeTier;
  const isDesktopThenMobile = effectiveSizePolicy === 'desktop-then-mobile';
  const desktopReadyToConfirm = ecommerce.desktopStage === 'generated';
  const mobileReady = ecommerce.desktopStage === 'confirmed';
  const resolvedTaskState = taskState ?? ecommerce.editableTask;
  const taskIsActive = Boolean(
    resolvedTaskState
      && activeTaskState
      && (
        activeTaskState.taskId === resolvedTaskState.taskId
        || activeTaskState.sourceRowKey === ecommerce.sourceRowKey
      ),
  );
  const mobileActionLabel = effectiveSizeTier === '1464x600'
    ? 'Generate mobile'
    : effectiveSizeTier === '600x450'
      ? 'Regenerate mobile'
      : 'Generate mobile';

  if (isFramework) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        {frameworkStatus ? (
          <div className="flex flex-wrap gap-1 text-[10px] text-[var(--text-secondary)]">
            <span className="rounded-full border border-[var(--border-light)] px-2 py-1">
              {frameworkStatus.paused ? 'Paused' : 'Running'}
            </span>
            <span className="rounded-full border border-[var(--border-light)] px-2 py-1">
              Queue {frameworkStatus.queued}
            </span>
            <span className="rounded-full border border-[var(--border-light)] px-2 py-1">
              Active {frameworkStatus.dispatching + frameworkStatus.running}
            </span>
            <span className="rounded-full border border-[var(--border-light)] px-2 py-1">
              Done {frameworkStatus.completed}
            </span>
            <span className="rounded-full border border-[var(--border-light)] px-2 py-1">
              Failed {frameworkStatus.failed}
            </span>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={actionClass}
            style={{ borderColor: 'rgba(16, 185, 129, 0.35)', color: 'var(--text-primary)' }}
            onClick={(event) => {
              event.stopPropagation();
              onGenerateFramework?.(node);
            }}
          >
            Start queue
          </button>
          <button
            type="button"
            className={actionClass}
            style={{ borderColor: 'rgba(245, 158, 11, 0.35)', color: 'var(--text-primary)' }}
            onClick={(event) => {
              event.stopPropagation();
              if (frameworkStatus?.paused) {
                onResumeFramework?.(node);
              } else {
                onPauseFramework?.(node);
              }
            }}
          >
            {frameworkStatus?.paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {!isGroup ? (
        <button
          type="button"
          className={actionClass}
          style={{
            borderColor: selected ? 'rgba(59, 130, 246, 0.35)' : 'var(--border-light)',
            background: selected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
            color: 'var(--text-primary)',
          }}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelected(node, !selected);
          }}
        >
          {selected ? 'Skip' : 'Include'}
        </button>
      ) : null}

      {resolvedTaskState && onTaskStateChange ? (
        <button
          type="button"
          className={actionClass}
          style={{
            borderColor: taskIsActive ? 'rgba(59, 130, 246, 0.35)' : 'var(--border-light)',
            background: taskIsActive ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
            color: 'var(--text-primary)',
          }}
          onClick={(event) => {
            event.stopPropagation();
            onActivateTask?.(node);
            onTaskStateChange(resolvedTaskState.taskId, (previous) => ({ ...previous }));
          }}
        >
          {taskIsActive ? 'Editing' : 'Edit task'}
        </button>
      ) : null}

      {!isGroup && onCancelNodeQueue ? (
        <button
          type="button"
          className={actionClass}
          style={{ borderColor: 'rgba(245, 158, 11, 0.35)', color: 'var(--text-primary)' }}
          onClick={(event) => {
            event.stopPropagation();
            onCancelNodeQueue(node);
          }}
        >
          Cancel queued
        </button>
      ) : null}

      {ecommerce.kind === 'main-image' ? (
        <button
          type="button"
          className={actionClass}
          style={{ borderColor: 'rgba(16, 185, 129, 0.35)', color: 'var(--text-primary)' }}
          onClick={(event) => {
            event.stopPropagation();
            onGenerateNode(node);
          }}
        >
          Generate
        </button>
      ) : null}

      {isGroup ? (
        <>
          {onSetGroupSelection ? (
            <>
              <button
                type="button"
                className={actionClass}
                style={{ borderColor: 'rgba(59, 130, 246, 0.35)', color: 'var(--text-primary)' }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSetGroupSelection(node, true);
                }}
              >
                Select all
              </button>
              <button
                type="button"
                className={actionClass}
                style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSetGroupSelection(node, false);
                }}
              >
                Clear all
              </button>
            </>
          ) : null}
          {ecommerce.sourceRowKey === 'main-group' ? (
            <button
              type="button"
              className={actionClass}
              style={{ borderColor: 'rgba(16, 185, 129, 0.35)', color: 'var(--text-primary)' }}
              onClick={(event) => {
                event.stopPropagation();
                onGenerateGroup(node, 'desktop');
              }}
            >
              Queue main cards
            </button>
          ) : (
            <>
              <button
                type="button"
                className={actionClass}
                style={{ borderColor: 'rgba(16, 185, 129, 0.35)', color: 'var(--text-primary)' }}
                onClick={(event) => {
                  event.stopPropagation();
                  onGenerateGroup(node, 'desktop');
                }}
              >
                Queue desktop
              </button>
              <button
                type="button"
                className={actionClass}
                style={{ borderColor: 'rgba(245, 158, 11, 0.35)', color: 'var(--text-primary)' }}
                onClick={(event) => {
                  event.stopPropagation();
                  onGenerateGroup(node, 'mobile');
                }}
              >
                Queue mobile
              </button>
            </>
          )}
        </>
      ) : null}

      {isModule ? (
        <>
          <button
            type="button"
            className={actionClass}
            style={{ borderColor: 'rgba(16, 185, 129, 0.35)', color: 'var(--text-primary)' }}
            onClick={(event) => {
              event.stopPropagation();
              onGenerateNode(node);
            }}
          >
            {isDesktopThenMobile ? 'Generate desktop' : 'Generate'}
          </button>
          {isDesktopThenMobile ? (
            <>
              <button
                type="button"
                className={actionClass}
                style={{ borderColor: 'rgba(59, 130, 246, 0.35)', color: 'var(--text-primary)' }}
                disabled={!desktopReadyToConfirm}
                onClick={(event) => {
                  event.stopPropagation();
                  onConfirmDesktop(node);
                }}
              >
                Confirm desktop
              </button>
              <button
                type="button"
                className={actionClass}
                style={{ borderColor: 'rgba(245, 158, 11, 0.35)', color: 'var(--text-primary)' }}
                disabled={!mobileReady}
                onClick={(event) => {
                  event.stopPropagation();
                  onGenerateMobile(node);
                }}
              >
                {mobileActionLabel}
              </button>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export default EcommerceCardActions;
