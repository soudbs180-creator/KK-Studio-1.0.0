import React from 'react';

import { useLocale } from '../../context/LocaleContext';
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
const clayCoralBorder = 'var(--clay-brand-coral)';
const clayPeachBorder = 'var(--clay-brand-peach)';
const clayPinkBorder = 'var(--clay-brand-pink)';

const actionSurfaceStyle: React.CSSProperties = {
  background: 'var(--frost-card-sub-bg)',
  borderColor: 'var(--frost-card-sub-border)',
  boxShadow: 'var(--frost-card-sub-shadow)',
  color: 'var(--text-primary)',
};

const frameworkChipStyle: React.CSSProperties = {
  background: 'var(--frost-card-sub-bg)',
  borderColor: 'var(--frost-card-sub-border)',
  boxShadow: 'var(--frost-card-sub-shadow)',
  color: 'var(--text-secondary)',
};

const coralActionStyle: React.CSSProperties = {
  ...actionSurfaceStyle,
  borderColor: clayCoralBorder,
};

const peachActionStyle: React.CSSProperties = {
  ...actionSurfaceStyle,
  borderColor: clayPeachBorder,
};

const pinkActionStyle: React.CSSProperties = {
  ...actionSurfaceStyle,
  borderColor: clayPinkBorder,
};

const selectedActionStyle: React.CSSProperties = {
  ...actionSurfaceStyle,
  background: 'var(--frost-card-main-bg)',
  borderColor: clayPinkBorder,
};

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
  const { pick } = useLocale();
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
    ? pick('生成移动版', 'Generate mobile')
    : effectiveSizeTier === '600x450'
      ? pick('重新生成移动版', 'Regenerate mobile')
      : pick('生成移动版', 'Generate mobile');

  if (isFramework) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        {frameworkStatus ? (
          <div className="flex flex-wrap gap-1 text-[10px] text-[var(--text-secondary)]">
            <span className="rounded-full border px-2 py-1" style={frameworkChipStyle}>
              {frameworkStatus.paused ? pick('已暂停', 'Paused') : pick('运行中', 'Running')}
            </span>
            <span className="rounded-full border px-2 py-1" style={frameworkChipStyle}>
              {pick('排队', 'Queue')} {frameworkStatus.queued}
            </span>
            <span className="rounded-full border px-2 py-1" style={frameworkChipStyle}>
              {pick('进行中', 'Active')} {frameworkStatus.dispatching + frameworkStatus.running}
            </span>
            <span className="rounded-full border px-2 py-1" style={frameworkChipStyle}>
              {pick('完成', 'Done')} {frameworkStatus.completed}
            </span>
            <span className="rounded-full border px-2 py-1" style={frameworkChipStyle}>
              {pick('失败', 'Failed')} {frameworkStatus.failed}
            </span>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={actionClass}
            style={coralActionStyle}
            onClick={(event) => {
              event.stopPropagation();
              onGenerateFramework?.(node);
            }}
          >
            {pick('开始队列', 'Start queue')}
          </button>
          <button
            type="button"
            className={actionClass}
            style={peachActionStyle}
            onClick={(event) => {
              event.stopPropagation();
              if (frameworkStatus?.paused) {
                onResumeFramework?.(node);
              } else {
                onPauseFramework?.(node);
              }
            }}
          >
            {frameworkStatus?.paused ? pick('继续', 'Resume') : pick('暂停', 'Pause')}
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
            ...actionSurfaceStyle,
            borderColor: selected ? clayPinkBorder : 'var(--frost-card-sub-border)',
            background: selected ? 'var(--frost-card-main-bg)' : 'var(--frost-card-sub-bg)',
          }}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelected(node, !selected);
          }}
        >
          {selected ? pick('跳过', 'Skip') : pick('纳入', 'Include')}
        </button>
      ) : null}

      {resolvedTaskState && onTaskStateChange ? (
        <button
          type="button"
          className={actionClass}
          style={taskIsActive ? selectedActionStyle : actionSurfaceStyle}
          onClick={(event) => {
            event.stopPropagation();
            onActivateTask?.(node);
            onTaskStateChange(resolvedTaskState.taskId, (previous) => ({ ...previous }));
          }}
        >
          {taskIsActive ? pick('编辑中', 'Editing') : pick('编辑任务', 'Edit task')}
        </button>
      ) : null}

      {!isGroup && onCancelNodeQueue ? (
        <button
          type="button"
          className={actionClass}
          style={peachActionStyle}
          onClick={(event) => {
            event.stopPropagation();
            onCancelNodeQueue(node);
          }}
        >
          {pick('取消排队', 'Cancel queued')}
        </button>
      ) : null}

      {ecommerce.kind === 'main-image' ? (
        <button
          type="button"
          className={actionClass}
          style={coralActionStyle}
          onClick={(event) => {
            event.stopPropagation();
            onGenerateNode(node);
          }}
        >
          {pick('生成', 'Generate')}
        </button>
      ) : null}

      {isGroup ? (
        <>
          {onSetGroupSelection ? (
            <>
              <button
                type="button"
                className={actionClass}
                style={pinkActionStyle}
                onClick={(event) => {
                  event.stopPropagation();
                  onSetGroupSelection(node, true);
                }}
              >
                {pick('全选', 'Select all')}
              </button>
              <button
                type="button"
                className={actionClass}
                style={actionSurfaceStyle}
                onClick={(event) => {
                  event.stopPropagation();
                  onSetGroupSelection(node, false);
                }}
              >
                {pick('清空', 'Clear all')}
              </button>
            </>
          ) : null}
          {ecommerce.sourceRowKey === 'main-group' ? (
            <button
              type="button"
              className={actionClass}
              style={coralActionStyle}
              onClick={(event) => {
                event.stopPropagation();
                onGenerateGroup(node, 'desktop');
              }}
            >
              {pick('主图入队', 'Queue main cards')}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={actionClass}
                style={coralActionStyle}
                onClick={(event) => {
                  event.stopPropagation();
                  onGenerateGroup(node, 'desktop');
                }}
              >
                {pick('桌面版入队', 'Queue desktop')}
              </button>
              <button
                type="button"
                className={actionClass}
                style={peachActionStyle}
                onClick={(event) => {
                  event.stopPropagation();
                  onGenerateGroup(node, 'mobile');
                }}
              >
                {pick('移动版入队', 'Queue mobile')}
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
            style={coralActionStyle}
            onClick={(event) => {
              event.stopPropagation();
              onGenerateNode(node);
            }}
          >
            {isDesktopThenMobile ? pick('生成桌面版', 'Generate desktop') : pick('生成', 'Generate')}
          </button>
          {isDesktopThenMobile ? (
            <>
              <button
                type="button"
                className={actionClass}
                style={pinkActionStyle}
                disabled={!desktopReadyToConfirm}
                onClick={(event) => {
                  event.stopPropagation();
                  onConfirmDesktop(node);
                }}
              >
                {pick('确认桌面版', 'Confirm desktop')}
              </button>
              <button
                type="button"
                className={actionClass}
                style={peachActionStyle}
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
