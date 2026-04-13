import React from 'react';

import type { EcommerceEditableTaskState, PromptNode } from '../../types';

interface EcommerceCardActionsProps {
  node: PromptNode;
  taskState?: EcommerceEditableTaskState;
  activeTaskState?: EcommerceEditableTaskState | null;
  onActivateTask?: (node: PromptNode) => void;
  onTaskStateChange?: (
    taskId: string,
    updater:
      | EcommerceEditableTaskState
      | ((previous: EcommerceEditableTaskState) => EcommerceEditableTaskState),
  ) => void;
  onToggleSelected: (node: PromptNode, selected: boolean) => void;
  onGenerateNode: (node: PromptNode) => void;
  onGenerateGroup: (node: PromptNode, phase: 'desktop' | 'mobile') => void;
  onConfirmDesktop: (node: PromptNode) => void;
  onGenerateMobile: (node: PromptNode) => void;
}

const actionClass = 'rounded-md border px-2 py-1 text-[11px] leading-none transition-colors';

const EcommerceCardActions: React.FC<EcommerceCardActionsProps> = ({
  node,
  taskState,
  activeTaskState = null,
  onActivateTask,
  onTaskStateChange,
  onToggleSelected,
  onGenerateNode,
  onGenerateGroup,
  onConfirmDesktop,
  onGenerateMobile,
}) => {
  const ecommerce = node.ecommerce;
  if (!ecommerce) return null;

  const selected = ecommerce.selectedForGeneration !== false;
  const isModule = ecommerce.kind === 'a-plus-module';
  const isGroup = ecommerce.kind === 'a-plus-group';
  const isDesktopThenMobile = ecommerce.sizePolicy === 'desktop-then-mobile';
  const desktopReadyToConfirm = ecommerce.desktopStage === 'generated';
  const mobileReady = ecommerce.desktopStage === 'confirmed';
  const resolvedTaskState = taskState ?? ecommerce.editableTask;
  const taskIsActive = Boolean(
    resolvedTaskState &&
      activeTaskState &&
      (activeTaskState.taskId === resolvedTaskState.taskId ||
        activeTaskState.sourceRowKey === ecommerce.sourceRowKey),
  );

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
          {selected ? '已勾选生成' : '跳过此卡'}
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
          {taskIsActive ? '编辑中' : '编辑任务'}
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
          生成主图
        </button>
      ) : null}

      {isGroup ? (
        ecommerce.sourceSheet === '主图' ? (
          <button
            type="button"
            className={actionClass}
            style={{ borderColor: 'rgba(16, 185, 129, 0.35)', color: 'var(--text-primary)' }}
            onClick={(event) => {
              event.stopPropagation();
              onGenerateGroup(node, 'desktop');
            }}
          >
            批量生成主图
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
              批量生成桌面端
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
              批量生成手机版
            </button>
          </>
        )
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
            {isDesktopThenMobile ? '生成桌面端' : '生成模块图'}
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
                确认桌面版
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
                生成手机版
              </button>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export default EcommerceCardActions;
