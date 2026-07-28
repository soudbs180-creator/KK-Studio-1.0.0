import React from 'react';
import { Wand2 } from 'lucide-react';

import { type GenerationConfig, GenerationMode } from '../../../types';
import { PROMPT_COMPOSER_ACTIONS } from '../../../features/ai-assistant-runtime';

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
  promptLibraryPanel?: React.ReactNode;
  pptOutlinePanel?: React.ReactNode;
};

export default function DesktopComposerPromptTools({
  isMobile,
  config,
  showPptOutlinePanel,
  onTogglePptOutlinePanel,
  onTogglePromptOptimization,
  onSelectPromptOptimizerArchetype,
  pptOutlinePanel,
}: DesktopComposerPromptToolsProps) {
  return (
    <div className={`relative flex items-center gap-1.5 ${isMobile ? 'flex-wrap' : ''}`}>
      {config.mode === GenerationMode.PPT ? (
        <button
          type="button"
          data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.togglePptOutline.uiAction}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-all text-[11px] font-medium whitespace-nowrap flex-shrink-0"
          style={{
            background: showPptOutlinePanel ? 'var(--prompt-bar-shell-hover)' : 'var(--prompt-bar-shell-bg)',
            color: showPptOutlinePanel ? 'var(--text-primary)' : 'var(--text-secondary)',
            borderColor: showPptOutlinePanel ? 'var(--prompt-bar-shell-border-strong)' : 'var(--prompt-bar-shell-border)',
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePptOutlinePanel();
          }}
          title={'\u7f16\u8f91PPT\u9875\u7eb2'}
        >
          <span>{'\u9875\u7eb2'}</span>
        </button>
      ) : null}

      <div className="kk-composer-prompt-tools__group flex h-9 items-center gap-1 bg-[var(--prompt-bar-shell-bg)] rounded-lg border border-[var(--prompt-bar-shell-border)] p-[2px] transition-all">
        <button
          type="button"
          data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.togglePromptOptimization.uiAction}
          className={`kk-composer-prompt-tools__optimize flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all text-[11px] font-medium whitespace-nowrap flex-shrink-0 ${
            config.enablePromptOptimization
              ? 'bg-[var(--prompt-bar-shell-hover)] text-[var(--text-primary)] font-bold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          style={{
            opacity: config.mode === GenerationMode.IMAGE || config.mode === GenerationMode.PPT || config.mode === GenerationMode.ECOMMERCE ? 1 : 0.45,
            pointerEvents:
              config.mode === GenerationMode.IMAGE || config.mode === GenerationMode.PPT || config.mode === GenerationMode.ECOMMERCE ? 'auto' : 'none',
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePromptOptimization();
          }}
          title={
            config.mode === GenerationMode.IMAGE || config.mode === GenerationMode.PPT || config.mode === GenerationMode.ECOMMERCE
              ? '开启后先优化提示词，再发送生成'
              : '仅图片/PPT/电商模式支持提示词优化'
          }
        >
          <Wand2 className={`w-3 h-3 ${config.enablePromptOptimization ? 'animate-pulse' : ''}`} />
          <span>优化提示词</span>
        </button>

        {config.enablePromptOptimization && (
          <>
            <span className="h-3.5 w-px bg-[var(--prompt-bar-shell-border)] opacity-60" />
            <select
              value={config.promptOptimizerArchetype || 'auto'}
              data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.selectPromptOptimizerArchetype.uiAction}
              onChange={(e) => onSelectPromptOptimizerArchetype?.(e.target.value)}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              className="h-[22px] pl-1.5 pr-5 rounded text-[10px] font-bold appearance-none cursor-pointer outline-none transition-all hover:bg-[var(--prompt-bar-shell-hover)] hover:text-[var(--text-primary)] select-none border-0"
              style={{
                background: 'transparent',
                color: 'var(--text-secondary)',
                backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23a3a3a3\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 4px center',
                backgroundSize: '8px',
              }}
              title="选择提示词优化目标场景"
            >
              {OPTIMIZER_ARCHETYPES.map((arch) => (
                <option
                  key={arch.id}
                  value={arch.id}
                  style={{
                    background: 'var(--prompt-bar-shell-bg)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {arch.label_zh}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {pptOutlinePanel}
    </div>
  );
}
