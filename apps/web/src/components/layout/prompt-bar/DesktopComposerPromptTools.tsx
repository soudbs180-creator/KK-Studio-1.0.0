import React, { useEffect, useRef, useState } from 'react';
import { Columns3, Network, Rows3, SlidersHorizontal, Wand2 } from 'lucide-react';

import { PROMPT_COMPOSER_ACTIONS } from '../../../features/ai-assistant-runtime';
import { type GenerationConfig, GenerationMode } from '../../../types';
import { requestWorkflowBrowser } from './composerEvents';

export const OPTIMIZER_ARCHETYPES = [
  { id: 'auto', label_zh: '自动路由', label_en: 'Auto' },
  { id: 'balanced', label_zh: '通用增强', label_en: 'General' },
  { id: 'product-hero', label_zh: '电商主图', label_en: 'E-commerce' },
  { id: 'portrait-photo', label_zh: '人像摄影', label_en: 'Portrait' },
  { id: 'cinematic-scene', label_zh: '电影感场景', label_en: 'Cinematic' },
  { id: 'ui-infographic', label_zh: '界面与版式', label_en: 'UI & Layout' },
  { id: 'ppt-narrative', label_zh: 'PPT 叙事', label_en: 'PPT Deck' },
  { id: 'creative-composite', label_zh: '创意合成', label_en: 'Composite' },
  { id: 'image-editing', label_zh: '编辑修复', label_en: 'Editing' },
  { id: 'interior-space', label_zh: '室内空间', label_en: 'Interior' },
  { id: 'social-marketing', label_zh: '社媒营销', label_en: 'Marketing' },
] as const;

type DesktopComposerPromptToolsProps = {
  isMobile: boolean;
  config: GenerationConfig;
  showPromptLibrary?: boolean;
  showPptOutlinePanel: boolean;
  onTogglePromptLibrary?: () => void;
  onTogglePptOutlinePanel: () => void;
  onTogglePromptOptimization: () => void;
  onSelectPromptOptimizerArchetype?: (archetype: string) => void;
  onArrangeCanvas?: (mode: 'grid' | 'row' | 'column') => void;
  promptLibraryPanel?: React.ReactNode;
  pptOutlinePanel?: React.ReactNode;
};

const composerPillClass = 'inline-flex h-[30px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors duration-[125ms] hover:bg-[var(--prompt-bar-shell-hover)] hover:text-[var(--text-primary)]';

export default function DesktopComposerPromptTools({
  config,
  showPptOutlinePanel,
  onTogglePptOutlinePanel,
  onTogglePromptOptimization,
  onSelectPromptOptimizerArchetype,
  onArrangeCanvas,
  pptOutlinePanel,
}: DesktopComposerPromptToolsProps) {
  const [showTools, setShowTools] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const supportsOptimization = (
    config.mode === GenerationMode.IMAGE
    || config.mode === GenerationMode.PPT
    || config.mode === GenerationMode.ECOMMERCE
  );

  useEffect(() => {
    if (!showTools) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setShowTools(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowTools(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showTools]);

  return (
    <div ref={rootRef} className="kk-composer-prompt-tools relative flex items-center">
      <div className="kk-composer-prompt-tools__group flex h-8 items-center rounded-full border border-[var(--prompt-bar-shell-border)] bg-[var(--prompt-bar-shell-bg)] p-px">
        <button
          type="button"
          data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.openWorkflowBrowser.uiAction}
          className={`kk-composer-prompt-tools__workflow ${composerPillClass}`}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            requestWorkflowBrowser();
          }}
        >
          <Network size={13} aria-hidden="true" />
          <span>工作流</span>
        </button>
        <span className="h-3.5 w-px bg-[var(--prompt-bar-shell-border)]" />
        <button
          type="button"
          data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.toggleComposerTools.uiAction}
          className={`kk-composer-prompt-tools__trigger ${composerPillClass} ${showTools ? 'bg-[var(--prompt-bar-shell-hover)] text-[var(--text-primary)]' : ''}`}
          aria-haspopup="menu"
          aria-expanded={showTools}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            setShowTools((current) => !current);
          }}
        >
          <SlidersHorizontal size={13} aria-hidden="true" />
          <span>工具</span>
        </button>
      </div>

      {showTools && (
        <div
          className="kk-composer-prompt-tools__menu absolute bottom-[calc(100%+8px)] right-0 z-[var(--kk-layer-dropdown)] w-[260px] rounded-[14px] border border-[var(--prompt-bar-shell-border)] bg-[var(--kk-morphic-panel)] p-2"
          role="menu"
          aria-label="创作工具"
        >
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={config.enablePromptOptimization}
            disabled={!supportsOptimization}
            data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.togglePromptOptimization.uiAction}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-left hover:bg-[var(--prompt-bar-shell-hover)] disabled:opacity-40"
            onClick={(event) => {
              event.stopPropagation();
              onTogglePromptOptimization();
            }}
          >
            <Wand2 size={15} className="text-[var(--text-secondary)]" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-[var(--text-primary)]">提示词优化</span>
              <span className="block truncate text-[10px] text-[var(--text-tertiary)]">发送前自动增强创作描述</span>
            </span>
            <span className={`h-4 w-7 rounded-full p-0.5 ${config.enablePromptOptimization ? 'bg-[var(--kk-morphic-action)]' : 'bg-[var(--kk-morphic-control)]'}`}>
              <span className={`block h-3 w-3 rounded-full bg-[var(--text-primary)] transition-transform duration-[125ms] ${config.enablePromptOptimization ? 'translate-x-3' : ''}`} />
            </span>
          </button>

          {supportsOptimization && config.enablePromptOptimization && (
            <label className="mt-1 block border-t border-[var(--prompt-bar-shell-border)] px-2.5 pt-2 text-[10px] text-[var(--text-tertiary)]">
              优化场景
              <select
                value={config.promptOptimizerArchetype || 'auto'}
                data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.selectPromptOptimizerArchetype.uiAction}
                onChange={(event) => onSelectPromptOptimizerArchetype?.(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                className="mt-1 h-9 w-full rounded-lg border border-[var(--prompt-bar-shell-border)] bg-[var(--kk-morphic-control)] px-2 text-xs text-[var(--text-primary)] outline-none"
              >
                {OPTIMIZER_ARCHETYPES.map((archetype) => (
                  <option key={archetype.id} value={archetype.id}>{archetype.label_zh}</option>
                ))}
              </select>
            </label>
          )}

          {onArrangeCanvas ? (
            <div className="kk-composer-layout-tools mt-1 border-t border-[var(--prompt-bar-shell-border)] pt-1">
              <span className="kk-composer-layout-tools__label">画布排布</span>
              <button
                type="button"
                role="menuitem"
                data-canvas-layout-mode="row"
                className="kk-composer-layout-tools__item"
                onClick={(event) => {
                  event.stopPropagation();
                  onArrangeCanvas('row');
                  setShowTools(false);
                }}
              >
                <Rows3 size={15} aria-hidden="true" />
                <span><strong>思维导图</strong><small>主卡向右连接副卡</small></span>
              </button>
              <button
                type="button"
                role="menuitem"
                data-canvas-layout-mode="column"
                className="kk-composer-layout-tools__item"
                onClick={(event) => {
                  event.stopPropagation();
                  onArrangeCanvas('column');
                  setShowTools(false);
                }}
              >
                <Columns3 size={15} aria-hidden="true" />
                <span><strong>瀑布式</strong><small>主卡向下连接副卡</small></span>
              </button>
            </div>
          ) : null}

          {config.mode === GenerationMode.PPT && (
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={showPptOutlinePanel}
              data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.togglePptOutline.uiAction}
              className="mt-1 flex h-10 w-full items-center rounded-lg border-t border-[var(--prompt-bar-shell-border)] px-2.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--prompt-bar-shell-hover)] hover:text-[var(--text-primary)]"
              onClick={(event) => {
                event.stopPropagation();
                onTogglePptOutlinePanel();
                setShowTools(false);
              }}
            >
              编辑 PPT 页纲
            </button>
          )}
        </div>
      )}

      {pptOutlinePanel}
    </div>
  );
}
