import React from 'react';
import { Wand2 } from 'lucide-react';

import { GenerationConfig, GenerationMode } from '../../../types';

type DesktopComposerPromptToolsProps = {
  isMobile: boolean;
  config: GenerationConfig;
  showPromptLibrary?: boolean;
  showPptOutlinePanel: boolean;
  onTogglePromptLibrary?: () => void;
  onTogglePptOutlinePanel: () => void;
  onTogglePromptOptimization: () => void;
  promptLibraryPanel?: React.ReactNode;
  pptOutlinePanel?: React.ReactNode;
};

export default function DesktopComposerPromptTools({
  isMobile,
  config,
  showPptOutlinePanel,
  onTogglePptOutlinePanel,
  onTogglePromptOptimization,
  pptOutlinePanel,
}: DesktopComposerPromptToolsProps) {
  return (
    <div className={`relative flex items-center gap-1 ${isMobile ? 'flex-wrap' : ''}`}>
      {config.mode === GenerationMode.PPT ? (
        <button
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

      <button
        className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-[11px] font-medium whitespace-nowrap flex-shrink-0 ${
          config.enablePromptOptimization
            ? 'bg-[var(--prompt-bar-shell-hover)] text-[var(--text-primary)] border-[var(--prompt-bar-shell-border-strong)]'
            : 'text-[var(--text-secondary)] hover:border-[var(--prompt-bar-shell-border-strong)]'
        }`}
        style={{
          ...(!config.enablePromptOptimization
            ? {
                background: 'var(--prompt-bar-shell-bg)',
                borderColor: 'var(--prompt-bar-shell-border)',
              }
            : {}),
          opacity: config.mode === GenerationMode.IMAGE || config.mode === GenerationMode.PPT || config.mode === GenerationMode.ECOMMERCE ? 1 : 0.45,
          pointerEvents:
            config.mode === GenerationMode.IMAGE || config.mode === GenerationMode.PPT || config.mode === GenerationMode.ECOMMERCE ? 'auto' : 'none',
        }}
        onClick={onTogglePromptOptimization}
        title={
          config.mode === GenerationMode.IMAGE || config.mode === GenerationMode.PPT || config.mode === GenerationMode.ECOMMERCE
            ? '\u5f00\u542f\u540e\u5148\u4f18\u5316\u63d0\u793a\u8bcd\uff0c\u518d\u53d1\u9001\u751f\u6210'
            : '\u4ec5\u56fe\u7247/PPT/\u7535\u5546\u6a21\u5f0f\u652f\u6301\u63d0\u793a\u8bcd\u4f18\u5316'
        }
      >
        <Wand2 className={`w-3 h-3 ${config.enablePromptOptimization ? 'animate-pulse' : ''}`} />
        <span className="font-bold">{'\u4f18\u5316\u63d0\u793a\u8bcd'}</span>
      </button>

      {pptOutlinePanel}
    </div>
  );
}
