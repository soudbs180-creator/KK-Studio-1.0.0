import React from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

import { optimizePromptForImage } from '../../services/llm/promptOptimizerService';
import type { EcommerceAPlusControlMode, EcommerceEditableTaskState, ReferenceImage } from '../../types';

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
  referenceImages?: ReferenceImage[];
  onOptimizePrompt?: (taskState: EcommerceEditableTaskState) => Promise<void> | void;
}

const inputClassName = 'w-full rounded-lg border bg-transparent px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-[var(--clay-brand-pink)]';
const toggleClassName = 'flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors';
const clayPinkBorder = 'var(--clay-brand-pink)';
const clayPeachBorder = 'var(--clay-brand-peach)';

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

const rootSurfaceStyle: React.CSSProperties = {
  background: 'var(--frost-card-framework-bg)',
  borderColor: 'var(--frost-card-framework-border)',
  boxShadow: 'var(--frost-card-framework-shadow)',
  WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
  backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
};

const panelSurfaceStyle: React.CSSProperties = {
  background: 'var(--frost-card-main-bg)',
  borderColor: 'var(--frost-card-main-border)',
  boxShadow: 'var(--frost-card-main-shadow)',
  WebkitBackdropFilter: 'blur(var(--frost-card-main-blur)) saturate(1.12)',
  backdropFilter: 'blur(var(--frost-card-main-blur)) saturate(1.12)',
};

const subSurfaceStyle: React.CSSProperties = {
  background: 'var(--frost-card-sub-bg)',
  borderColor: 'var(--frost-card-sub-border)',
  boxShadow: 'var(--frost-card-sub-shadow)',
  WebkitBackdropFilter: 'blur(var(--frost-card-sub-blur)) saturate(1.08)',
  backdropFilter: 'blur(var(--frost-card-sub-blur)) saturate(1.08)',
};

const inputSurfaceStyle: React.CSSProperties = {
  background: 'var(--frost-input-bg)',
  borderColor: 'var(--frost-input-border)',
  boxShadow: 'var(--frost-input-shadow)',
  WebkitBackdropFilter: 'blur(var(--frost-input-blur)) saturate(1.12)',
  backdropFilter: 'blur(var(--frost-input-blur)) saturate(1.12)',
};

const summaryChipStyle: React.CSSProperties = {
  ...subSurfaceStyle,
  color: 'var(--text-secondary)',
};

const selectedFieldContainerStyle: React.CSSProperties = {
  ...panelSurfaceStyle,
  borderColor: clayPinkBorder,
  color: 'var(--text-primary)',
};

const warningChipStyle: React.CSSProperties = {
  ...subSurfaceStyle,
  borderColor: clayPeachBorder,
  color: 'var(--clay-brand-peach)',
};

const infoChipStyle: React.CSSProperties = {
  ...subSurfaceStyle,
  borderColor: clayPinkBorder,
  color: 'var(--clay-brand-pink)',
};

const aPlusOverrideOptions: Array<{ value: EcommerceAPlusControlMode | null; label: string }> = [
  { value: null, label: '跟随全局' },
  { value: '1464x600', label: '1464x600' },
  { value: '970x600', label: '970x600' },
  { value: '600x450', label: '600x450' },
];

function resolveReferenceImageSrc(image?: ReferenceImage): string {
  const data = image?.url || image?.data || '';
  if (!data) return '';
  return data.startsWith('data:') || data.startsWith('blob:') || data.startsWith('http')
    ? data
    : `data:${image?.mimeType || 'image/png'};base64,${data}`;
}

function buildPromptOptimizerReferenceImages(referenceImages: ReferenceImage[]) {
  return referenceImages
    .filter((image) => image.data || image.url)
    .map((image) => {
      const mimeType = image.mimeType || 'image/png';
      const data = image.data || image.url || '';
      const match = data.match(/^data:([^;]+);base64,(.+)$/);
      return {
        mimeType: match?.[1] || mimeType,
        data: match?.[2] || data,
      };
    });
}

const EcommerceTaskEditorPanel: React.FC<EcommerceTaskEditorPanelProps> = ({
  taskState,
  onTaskStateChange,
  compact = false,
  collapsible = false,
  defaultExpanded = true,
  referenceImages = [],
  onOptimizePrompt,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(() => !collapsible || defaultExpanded);
  const [isOptimizingPrompt, setIsOptimizingPrompt] = React.useState(false);
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

  const markPromptForAiAssist = async () => {
    setIsOptimizingPrompt(true);
    try {
      if (onOptimizePrompt) {
        await onOptimizePrompt(taskState);
        return;
      }

      const rawPrompt = taskState.promptOverride || taskState.resolvedPromptPreview || taskState.sparseUserIntent || taskState.displayLabel;
      const optimized = await optimizePromptForImage(rawPrompt, {
        mode: 'ecommerce',
        aspectRatio: taskState.effectiveSizeTier || taskState.declaredSizeText || taskState.outputTypeLabel,
        referenceImages: buildPromptOptimizerReferenceImages(referenceImages),
      });
      const source = optimized.usedModelId === 'local-rulebook' ? 'local-rulebook' : 'manual';
      updateTaskState((previous) => ({
        ...previous,
        promptOverride: optimized.optimizedEn || rawPrompt,
        resolvedPromptPreview: optimized.optimizedEn || rawPrompt,
        lastRenderPrompt: optimized.optimizedEn || rawPrompt,
        promptAssistState: {
          optimized: true,
          source,
          updatedAt: Date.now(),
          error: undefined,
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '提示词优化失败';
      updateTaskState((previous) => ({
        ...previous,
        promptAssistState: {
          ...previous.promptAssistState,
          optimized: false,
          updatedAt: Date.now(),
          error: message,
        },
      }));
    } finally {
      setIsOptimizingPrompt(false);
    }
  };

  const updateReferenceAnchorRole = (anchorId: string, nextRoleLabel: string) => {
    const roleLabel = nextRoleLabel.trim();
    updateTaskState((previous) => {
      const targetAnchor = (previous.referenceAnchors || []).find((anchor) => anchor.anchorId === anchorId);
      if (!targetAnchor) return previous;

      const resolvedRoleLabel = roleLabel || targetAnchor.roleLabel;
      const nextAssetRoles = previous.assetRoles.map((assetRole) => {
        const matchesAnchor = assetRole.anchorId === anchorId || assetRole.assetId === targetAnchor.assetId;
        return matchesAnchor
          ? {
              ...assetRole,
              roleLabel: resolvedRoleLabel,
            }
          : assetRole;
      });

      return {
        ...previous,
        assetRoles: nextAssetRoles,
        imageRoleSummary: nextAssetRoles.map((assetRole) => assetRole.roleLabel || assetRole.normalizedLabel),
        referenceAnchors: (previous.referenceAnchors || []).map((anchor) => (
          anchor.anchorId === anchorId
            ? {
                ...anchor,
                roleLabel: resolvedRoleLabel,
              }
            : anchor
        )),
      };
    });
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
      style={rootSurfaceStyle}
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
        <div className="rounded-xl border p-3" style={panelSurfaceStyle}>
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
                  style={warningChipStyle}
                >
                  待补充：{field}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <>
      {(taskState.referenceAnchors || []).length > 0 ? (
        <div className="mb-3 rounded-xl border p-3" style={panelSurfaceStyle}>
          <div className="mb-2 text-[11px] font-medium text-[var(--text-secondary)]">参考图 @ 锁定</div>
          <div className="grid gap-2 md:grid-cols-2">
            {(taskState.referenceAnchors || []).map((anchor) => {
              const previewImage = referenceImages.find((image) => (
                image.id === anchor.assetId || image.storageId === anchor.assetId
              ));
              const previewSrc = resolveReferenceImageSrc(previewImage);

              return (
                <div key={anchor.anchorId} className="flex items-center gap-2 rounded-lg border p-2" style={summaryChipStyle}>
                  {previewSrc ? (
                    <img
                      src={previewSrc}
                      alt={anchor.roleLabel}
                      className="h-10 w-10 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-[10px] text-[var(--text-tertiary)]" style={subSurfaceStyle}>
                      @
                    </div>
                  )}
                  <label className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] font-semibold text-[var(--clay-brand-pink)]">{anchor.token}</span>
                    <input
                      type="text"
                      value={anchor.roleLabel}
                      onChange={(event) => updateReferenceAnchorRole(anchor.anchorId, event.target.value)}
                      className="mt-1 w-full rounded-md border bg-transparent px-2 py-1 text-[10px] text-[var(--text-primary)] outline-none focus:border-[var(--clay-brand-pink)]"
                      style={inputSurfaceStyle}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="grid gap-2 md:grid-cols-2">
        <label className="block">
          <div className="mb-1 text-[11px] font-medium text-[var(--text-secondary)]">主标题</div>
          <input
            type="text"
            value={taskState.copy.headline}
            onChange={(event) => updateCopyField('headline', event.target.value)}
            className={inputClassName}
            style={inputSurfaceStyle}
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
            style={inputSurfaceStyle}
            placeholder="补充规格、优势或场景"
          />
        </label>

        <label className="block md:col-span-2">
          <div className="mb-1 text-[11px] font-medium text-[var(--text-secondary)]">高亮卖点</div>
          <textarea
            value={taskState.copy.highlight}
            onChange={(event) => updateCopyField('highlight', event.target.value)}
            className={textareaClassName}
            style={inputSurfaceStyle}
            placeholder="例如：防泼水面料、双层隔热、3 秒速开"
          />
        </label>

        <label className="block md:col-span-2">
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-[var(--text-secondary)]">
            <span>提示词改写</span>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
              style={taskState.promptAssistState?.optimized ? infoChipStyle : summaryChipStyle}
              onClick={markPromptForAiAssist}
              disabled={isOptimizingPrompt}
              title="点击后优化当前任务提示词，后续生成会使用优化结果"
            >
              <Sparkles size={11} />
              {isOptimizingPrompt ? '优化中' : taskState.promptAssistState?.optimized ? 'AI辅助已开' : '优化提示词'}
            </button>
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
          </div>
          <textarea
            value={promptOverrideValue}
            onChange={(event) => updateTaskState((previous) => ({
              ...previous,
              promptOverride: event.target.value,
            }))}
            className={textareaClassName}
            style={inputSurfaceStyle}
            placeholder="当前实际提示词，可直接人工重写后再生成"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-[11px] font-medium text-[var(--text-secondary)]">整体语气</div>
          <select
            value={taskState.style.tone}
            onChange={(event) => updateStyleField('tone', event.target.value)}
            className={inputClassName}
            style={inputSurfaceStyle}
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
            style={inputSurfaceStyle}
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
            style={inputSurfaceStyle}
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
        <div className="mt-3 rounded-xl border p-3" style={panelSurfaceStyle}>
          <div className="mb-2 text-[11px] font-medium text-[var(--text-secondary)]">A+ 尺寸覆盖</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {aPlusOverrideOptions.map((option) => {
              const isSelected = (taskState.sizeControlOverride ?? null) === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  className="rounded-lg border px-3 py-2 text-[11px] transition-colors"
                  style={isSelected ? selectedFieldContainerStyle : subSurfaceStyle}
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
                ...panelSurfaceStyle,
                borderColor: enabled ? clayPeachBorder : 'var(--frost-card-main-border)',
                background: enabled ? 'var(--frost-card-main-bg)' : 'var(--frost-card-sub-bg)',
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
                  borderColor: enabled ? clayPeachBorder : 'var(--frost-card-sub-border)',
                  color: enabled ? 'var(--clay-brand-peach)' : 'var(--text-tertiary)',
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
              style={warningChipStyle}
            >
              待补充：{field}
            </span>
          ))}
          {taskState.consistencyChecks.slice(0, 2).map((check) => (
            <span
              key={`check-${check}`}
              className="rounded-full border px-2 py-1 text-[10px]"
              style={infoChipStyle}
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
