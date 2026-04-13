import React from 'react';
import { AlertTriangle, CheckSquare, Square } from 'lucide-react';

import type { EcommerceEditableTaskState } from '../../types';
import type { EcommerceAnalysisResult } from '../../services/ecommerce/types.ts';
import EcommerceTaskEditorPanel, {
  type EcommerceTaskStateChangeHandler,
} from './EcommerceTaskEditorPanel';

interface EcommerceAnalysisReviewPanelProps {
  analysis: EcommerceAnalysisResult;
  selection: Record<string, boolean>;
  taskStates?: Record<string, EcommerceEditableTaskState | undefined>;
  activeTaskState?: EcommerceEditableTaskState | null;
  onToggleSelection: (id: string, selected: boolean) => void;
  onTaskStateChange?: EcommerceTaskStateChangeHandler;
  onConfirm: () => void;
}

const containerStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)',
  borderColor: 'var(--border-light)',
};

const warningStyle: React.CSSProperties = {
  borderColor: 'rgba(245, 158, 11, 0.35)',
  background: 'rgba(245, 158, 11, 0.08)',
  color: 'var(--text-secondary)',
};

const EcommerceAnalysisReviewPanel: React.FC<EcommerceAnalysisReviewPanelProps> = ({
  analysis,
  selection,
  taskStates = {},
  activeTaskState = null,
  onToggleSelection,
  onTaskStateChange,
  onConfirm,
}) => {
  const resolveTaskState = (rowKey: string) => {
    const mappedTaskState = taskStates[rowKey];
    if (mappedTaskState) return mappedTaskState;
    if (!activeTaskState) return null;
    if (activeTaskState.sourceRowKey === rowKey || activeTaskState.taskId === rowKey) {
      return activeTaskState;
    }
    return null;
  };

  const configuredTaskCount = Object.values(taskStates).filter(Boolean).length;

  return (
    <div className="mb-2 rounded-xl border p-3" style={containerStyle}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">分析结果确认</div>
          <div className="text-xs text-[var(--text-secondary)]">
            主图 {analysis.mainImageItems.length} 条，A+ 模块 {analysis.aPlusGroup.modules.length} 条
            {configuredTaskCount > 0 ? `，已挂载任务 ${configuredTaskCount} 条` : ''}
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg border px-3 py-2 text-xs font-medium"
          style={{
            borderColor: 'rgba(16, 185, 129, 0.35)',
            background: 'rgba(16, 185, 129, 0.12)',
            color: 'var(--text-primary)',
          }}
          onClick={onConfirm}
        >
          确认并建卡
        </button>
      </div>

      {analysis.reviewWarnings.length > 0 ? (
        <div className="mb-3 rounded-lg border px-3 py-2 text-xs" style={warningStyle}>
          <div className="mb-1 flex items-center gap-2 font-medium text-[var(--text-primary)]">
            <AlertTriangle size={14} />
            需要人工确认
          </div>
          <div className="space-y-1">
            {analysis.reviewWarnings.slice(0, 4).map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        <section>
          <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">主图卡</div>
          <div className="space-y-2">
            {analysis.mainImageItems.map((item) => {
              const checked = selection[item.itemId] !== false;
              const taskState = taskStates[item.itemId] ?? resolveTaskState(item.itemId);
              const isTaskActive = Boolean(
                taskState && activeTaskState && taskState.taskId === activeTaskState.taskId,
              );

              return (
                <div key={item.itemId} className="rounded-lg border border-transparent">
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left"
                    style={{
                      borderColor: checked ? 'rgba(59, 130, 246, 0.35)' : 'var(--border-light)',
                      background: checked ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    }}
                    onClick={() => onToggleSelection(item.itemId, !checked)}
                  >
                    {checked ? <CheckSquare size={16} /> : <Square size={16} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-medium text-[var(--text-primary)]">
                          {item.sequence}. {item.theme || item.type}
                        </div>
                        {taskState ? (
                          <span
                            className="rounded-full border px-2 py-1 text-[10px]"
                            style={{
                              borderColor: isTaskActive
                                ? 'rgba(59, 130, 246, 0.30)'
                                : 'rgba(148, 163, 184, 0.22)',
                              background: isTaskActive
                                ? 'rgba(59, 130, 246, 0.10)'
                                : 'rgba(148, 163, 184, 0.08)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {isTaskActive ? '当前任务' : '已挂任务'}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-secondary)]">
                        {item.designRequirements}
                      </div>
                    </div>
                  </button>

                  {taskState && onTaskStateChange ? (
                    <div className="mt-2">
                      <EcommerceTaskEditorPanel
                        taskState={taskState}
                        onTaskStateChange={onTaskStateChange}
                        compact={!isTaskActive}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">A+ 模块卡</div>
          <div className="space-y-2">
            {analysis.aPlusGroup.modules.map((item) => {
              const checked = selection[item.moduleId] !== false;
              const taskState = taskStates[item.moduleId] ?? resolveTaskState(item.moduleId);
              const isTaskActive = Boolean(
                taskState && activeTaskState && taskState.taskId === activeTaskState.taskId,
              );

              return (
                <div key={item.moduleId} className="rounded-lg border border-transparent">
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left"
                    style={{
                      borderColor: checked ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-light)',
                      background: checked ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                    }}
                    onClick={() => onToggleSelection(item.moduleId, !checked)}
                  >
                    {checked ? <CheckSquare size={16} /> : <Square size={16} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-medium text-[var(--text-primary)]">
                          {item.moduleName}
                        </div>
                        {taskState ? (
                          <span
                            className="rounded-full border px-2 py-1 text-[10px]"
                            style={{
                              borderColor: isTaskActive
                                ? 'rgba(16, 185, 129, 0.28)'
                                : 'rgba(148, 163, 184, 0.22)',
                              background: isTaskActive
                                ? 'rgba(16, 185, 129, 0.10)'
                                : 'rgba(148, 163, 184, 0.08)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {isTaskActive ? '当前任务' : '已挂任务'}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-secondary)]">
                        {item.declaredSizeText ? `尺寸 ${item.declaredSizeText} · ` : ''}
                        {item.designRequirements}
                      </div>
                    </div>
                  </button>

                  {taskState && onTaskStateChange ? (
                    <div className="mt-2">
                      <EcommerceTaskEditorPanel
                        taskState={taskState}
                        onTaskStateChange={onTaskStateChange}
                        compact={!isTaskActive}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default EcommerceAnalysisReviewPanel;
