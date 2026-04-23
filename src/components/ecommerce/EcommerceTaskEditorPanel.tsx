import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import type { EcommerceAPlusControlMode, EcommerceEditableTaskState } from '../../types';

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
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

const inputClassName = 'w-full rounded-lg border bg-transparent px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-[rgba(59,130,246,0.45)]';
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

const selectedFieldContainerStyle: React.CSSProperties = {
  background: 'rgba(59, 130, 246, 0.12)',
  borderColor: 'rgba(59, 130, 246, 0.30)',
  color: 'var(--text-primary)',
};

const aPlusOverrideOptions: Array<{ value: EcommerceAPlusControlMode | null; label: string }> = [
  { value: null, label: '跟随全局' },
  { value: '1464x600', label: '1464x600' },
  { value: '970x600', label: '970x600' },
  { value: '600x450', label: '600x450' },
];

const EcommerceTaskEditorPanel: React.FC<EcommerceTaskEditorPanelProps> = ({
  taskState,
  onTaskStateChange,
  compact = false,
  collapsible = false,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(() => !collapsible || defaultExpanded);
  const rootPaddingClassName = compact ? 'p-2.5' : 'p-3';
  const textareaMinHeightClassName = compact ? 'min-h-[56px]' : 'min-h-[72px]';
  const textareaClassName = `${inputClassName} ${textareaMinHeightClassName} resize-y`;
  const chipLimit = compact ? 2 : 4;
  const headerClassName = compact ? 'mb-2.5 flex flex-wrap items-start justify-between gap-2' : 'mb-3 flex flex-wrap items-start justify-between gap-2';
  const toggleGridClassName = compact ? 'mt-2.5 grid gap-2 md:grid-cols-2' : 'mt-3 grid gap-2 md:grid-cols-2';
  const statusClassName = compact ? 'mt-2.5 flex flex-wrap gap-1.5' : 'mt-3 flex flex-wrap gap-1.5';

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

  const promptOverrideValue = taskState.promptOverride && taskState.promptOverride.length > 0
    ? taskState.promptOverride
    : taskState.resolvedPromptPreview;
  const isAPlusModule = taskState.sourceSheet === 'A+' && taskState.sourceKind === 'a-plus-module';
  const collapsedSummary = [
    taskState.copy.headline || '待补主标题',
    taskState.copy.subheadline || '待补副标题',
    `语气 ${taskState.style.tone}`,
    `效果 ${taskState.style.effect}`,
    `占比 ${productSizeLabels[taskState.layout.productSize]}`,
  ].join(' · ');

  React.useEffect(() => {
    setIsExpanded(!collapsible || defaultExpanded);
  }, [collapsible, defaultExpanded, taskState.taskId]);

  return (
    <div
      className={`rounded-xl border ${rootPaddingClassName}`}
      style={{ background: 'rgba(15, 23, 42, 0.18)', borderColor: 'rgba(59, 130, 246, 0.16)' }}
    >
      <div className={headerClassName}>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-[var(--text-primary)]">
            {taskState.displayLabel || taskState.outputTypeLabel || taskState.theme}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
            {taskState.sourceSheet} · {taskState.theme} · {taskState.outputTypeLabel}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {collapsible ? (
            <button
              type="button"
              data-testid="ecommerce-task-editor-toggle"
              className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px]"
              style={summaryChipStyle}
              onClick={() => setIsExpanded((previous) => !previous)}
            >
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {isExpanded ? '收起编辑' : '展开编辑'}
            </button>
          ) : null}
          {taskState.imageRoleSummary.slice(0, chipLimit).map((summary) => (
            <span
              key={summary}
              className="rounded-full border px-2 py-1 text-[10px]"
              style={summaryChipStyle}
            >
              {summary}
            </span>
          ))}
          {isAPlusModule && taskState.sizeTier ? (
            <span className="rounded-full border px-2 py-1 text-[10px]" style={summaryChipStyle}>
              识别档位 {taskState.sizeTier}
            </span>
          ) : null}
          {isAPlusModule && taskState.effectiveSizeTier ? (
            <span className="rounded-full border px-2 py-1 text-[10px]" style={summaryChipStyle}>
              实际采用档位 {taskState.effectiveSizeTier}
            </span>
          ) : null}
        </div>
      </div>

      {!isExpanded ? (
        <div className="rounded-xl border p-3" style={fieldContainerStyle}>
          <div className="text-[11px] font-medium text-[var(--text-secondary)]">编辑摘要</div>
          <div className="mt-2 text-xs leading-5 text-[var(--text-primary)]">
            {collapsedSummary}
          </div>
          {(taskState.missingFields.length > 0 || taskState.consistencyChecks.length > 0) ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {taskState.missingFields.slice(0, 2).map((field) => (
                <span
                  key={`collapsed-missing-${field}`}
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
            </div>
          ) : null}
        </div>
      ) : (
        <>
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

        <label className="block md:col-span-2">
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-[var(--text-secondary)]">
            <span>提示词改写</span>
            {taskState.promptOverride ? (
              <button
                type="button"
                className="rounded-full border px-2 py-0.5 text-[10px]"
                style={summaryChipStyle}
                onClick={() => updateTaskState((previous) => ({
                  ...previous,
                  promptOverride: undefined,
                }))}
              >
                恢复自动
              </button>
            ) : null}
          </div>
          <textarea
            value={promptOverrideValue}
            onChange={(event) => updateTaskState((previous) => ({
              ...previous,
              promptOverride: event.target.value,
            }))}
            className={textareaClassName}
            style={fieldContainerStyle}
            placeholder="当前实际提示词，可直接人工重写后再生成"
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

      {isAPlusModule ? (
        <div className="mt-3 rounded-xl border p-3" style={fieldContainerStyle}>
          <div className="mb-2 text-[11px] font-medium text-[var(--text-secondary)]">A+ 尺寸覆盖</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {aPlusOverrideOptions.map((option) => {
              const isSelected = (taskState.sizeControlOverride ?? null) === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  className="rounded-lg border px-3 py-2 text-[11px] transition-colors"
                  style={isSelected ? selectedFieldContainerStyle : fieldContainerStyle}
                  onClick={() => updateTaskState((previous) => ({
                    ...previous,
                    sizeControlOverride: option.value,
                  }))}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className={toggleGridClassName}>
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
        <div className={statusClassName}>
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
        </>
      )}
    </div>
  );
};

export default EcommerceTaskEditorPanel;
