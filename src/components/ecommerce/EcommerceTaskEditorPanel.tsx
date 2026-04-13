import React from 'react';

import type { EcommerceEditableTaskState } from '../../types';

export type EcommerceTaskStateUpdater =
  | EcommerceEditableTaskState
  | ((previous: EcommerceEditableTaskState) => EcommerceEditableTaskState);

export type EcommerceTaskStateChangeHandler = (
  taskId: string,
  updater: EcommerceTaskStateUpdater,
) => void;

interface EcommerceTaskEditorPanelProps {
  taskState: EcommerceEditableTaskState;
  onTaskStateChange: (
    taskId: string,
    updater: EcommerceTaskStateUpdater,
  ) => void;
  compact?: boolean;
}

const inputClassName = 'w-full rounded-lg border bg-transparent px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-[rgba(59,130,246,0.45)]';
const textareaClassName = `${inputClassName} min-h-[72px] resize-y`;
const toggleClassName = 'flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors';

const toneOptions = ['专业冷静', '清新轻盈', '高级质感', '活力种草', '科技理性'];
const effectOptions = ['无特效', '柔光氛围', '速度动势', '高光质感', '层次景深'];
const productSizeOptions: Array<EcommerceEditableTaskState['layout']['productSize']> = ['small', 'balanced', 'large'];

const productSizeLabels: Record<EcommerceEditableTaskState['layout']['productSize'], string> = {
  small: '产品偏小',
  balanced: '产品均衡',
  large: '产品主体偏大',
};

const inheritanceToggles: Array<{
  key: keyof EcommerceEditableTaskState['inherit'];
  label: string;
  description: string;
}> = [
  { key: 'keepSeriesStyle', label: '继承系列风格', description: '保留系列整体视觉调性' },
  { key: 'keepFontStyle', label: '继承字体风格', description: '沿用当前系列字体语气' },
  { key: 'keepLayoutStyle', label: '继承构图布局', description: '保留版式与空间关系' },
  { key: 'keepCopyStyle', label: '继承文案节奏', description: '保留标题与卖点写法' },
  { key: 'keepPalette', label: '继承配色基调', description: '尽量保持同系列颜色印象' },
];

const fieldContainerStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  borderColor: 'var(--border-light)',
};

const summaryChipStyle: React.CSSProperties = {
  background: 'rgba(59, 130, 246, 0.10)',
  borderColor: 'rgba(59, 130, 246, 0.20)',
  color: 'var(--text-secondary)',
};

const EcommerceTaskEditorPanel: React.FC<EcommerceTaskEditorPanelProps> = ({
  taskState,
  onTaskStateChange,
  compact = false,
}) => {
  const updateTaskState = (updater: EcommerceTaskStateUpdater) => {
    onTaskStateChange(taskState.taskId, updater);
  };

  const updateCopyField = (
    key: keyof EcommerceEditableTaskState['copy'],
    value: string,
  ) => {
    updateTaskState((previous) => ({
      ...previous,
      copy: {
        ...previous.copy,
        [key]: value,
      },
    }));
  };

  const updateStyleField = (
    key: keyof EcommerceEditableTaskState['style'],
    value: string,
  ) => {
    updateTaskState((previous) => ({
      ...previous,
      style: {
        ...previous.style,
        [key]: value,
      },
    }));
  };

  const updateLayoutField = (
    key: keyof EcommerceEditableTaskState['layout'],
    value: string,
  ) => {
    updateTaskState((previous) => ({
      ...previous,
      layout: {
        ...previous.layout,
        [key]: value,
      },
    }));
  };

  const updateInheritField = (
    key: keyof EcommerceEditableTaskState['inherit'],
    value: boolean,
  ) => {
    updateTaskState((previous) => ({
      ...previous,
      inherit: {
        ...previous.inherit,
        [key]: value,
      },
    }));
  };

  return (
    <div
      className="rounded-xl border p-3"
      style={{ background: 'rgba(15, 23, 42, 0.18)', borderColor: 'rgba(59, 130, 246, 0.16)' }}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-[var(--text-primary)]">
            {taskState.displayLabel || taskState.outputTypeLabel || taskState.theme}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
            {taskState.sourceSheet} · {taskState.theme} · {taskState.outputTypeLabel}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {taskState.imageRoleSummary.slice(0, compact ? 2 : 4).map((summary) => (
            <span
              key={summary}
              className="rounded-full border px-2 py-1 text-[10px]"
              style={summaryChipStyle}
            >
              {summary}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="block">
          <div className="mb-1 text-[11px] font-medium text-[var(--text-secondary)]">主标题</div>
          <input
            type="text"
            value={taskState.copy.headline}
            onChange={(event) => updateCopyField('headline', event.target.value)}
            className={inputClassName}
            style={fieldContainerStyle}
            placeholder="例如：高效收纳，桌面更清爽"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-[11px] font-medium text-[var(--text-secondary)]">副标题</div>
          <input
            type="text"
            value={taskState.copy.subheadline}
            onChange={(event) => updateCopyField('subheadline', event.target.value)}
            className={inputClassName}
            style={fieldContainerStyle}
            placeholder="补充规格、优势或场景"
          />
        </label>

        <label className="block md:col-span-2">
          <div className="mb-1 text-[11px] font-medium text-[var(--text-secondary)]">高亮卖点</div>
          <textarea
            value={taskState.copy.highlight}
            onChange={(event) => updateCopyField('highlight', event.target.value)}
            className={textareaClassName}
            style={fieldContainerStyle}
            placeholder="例如：防泼水面料、双层隔热、3 秒速开"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-[11px] font-medium text-[var(--text-secondary)]">整体语气</div>
          <select
            value={taskState.style.tone}
            onChange={(event) => updateStyleField('tone', event.target.value)}
            className={inputClassName}
            style={fieldContainerStyle}
          >
            {[taskState.style.tone, ...toneOptions]
              .filter((value, index, array) => value && array.indexOf(value) === index)
              .map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-1 text-[11px] font-medium text-[var(--text-secondary)]">视觉效果</div>
          <select
            value={taskState.style.effect}
            onChange={(event) => updateStyleField('effect', event.target.value)}
            className={inputClassName}
            style={fieldContainerStyle}
          >
            {[taskState.style.effect, ...effectOptions]
              .filter((value, index, array) => value && array.indexOf(value) === index)
              .map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-1 text-[11px] font-medium text-[var(--text-secondary)]">产品占比</div>
          <select
            value={taskState.layout.productSize}
            onChange={(event) => updateLayoutField(
              'productSize',
              event.target.value as EcommerceEditableTaskState['layout']['productSize'],
            )}
            className={inputClassName}
            style={fieldContainerStyle}
          >
            {productSizeOptions.map((value) => (
              <option key={value} value={value}>
                {productSizeLabels[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {inheritanceToggles.map((toggle) => {
          const enabled = taskState.inherit[toggle.key];
          return (
            <button
              key={toggle.key}
              type="button"
              className={toggleClassName}
              style={{
                ...fieldContainerStyle,
                borderColor: enabled ? 'rgba(16, 185, 129, 0.28)' : 'var(--border-light)',
                background: enabled ? 'rgba(16, 185, 129, 0.10)' : 'var(--bg-secondary)',
              }}
              onClick={() => updateInheritField(toggle.key, !enabled)}
            >
              <span className="min-w-0 text-left">
                <span className="block text-[11px] font-medium text-[var(--text-primary)]">
                  {toggle.label}
                </span>
                <span className="mt-0.5 block text-[10px] text-[var(--text-secondary)]">
                  {toggle.description}
                </span>
              </span>
              <span
                className="ml-3 rounded-full border px-2 py-1 text-[10px]"
                style={{
                  borderColor: enabled ? 'rgba(16, 185, 129, 0.28)' : 'var(--border-light)',
                  color: enabled ? 'rgb(52, 211, 153)' : 'var(--text-tertiary)',
                }}
              >
                {enabled ? '已开启' : '关闭'}
              </span>
            </button>
          );
        })}
      </div>

      {(taskState.missingFields.length > 0 || taskState.consistencyChecks.length > 0) ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {taskState.missingFields.slice(0, 3).map((field) => (
            <span
              key={`missing-${field}`}
              className="rounded-full border px-2 py-1 text-[10px]"
              style={{
                background: 'rgba(245, 158, 11, 0.10)',
                borderColor: 'rgba(245, 158, 11, 0.22)',
                color: 'rgb(251, 191, 36)',
              }}
            >
              待补充：{field}
            </span>
          ))}
          {taskState.consistencyChecks.slice(0, 2).map((check) => (
            <span
              key={`check-${check}`}
              className="rounded-full border px-2 py-1 text-[10px]"
              style={{
                background: 'rgba(59, 130, 246, 0.10)',
                borderColor: 'rgba(59, 130, 246, 0.22)',
                color: 'rgb(147, 197, 253)',
              }}
            >
              校验：{check}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default EcommerceTaskEditorPanel;
