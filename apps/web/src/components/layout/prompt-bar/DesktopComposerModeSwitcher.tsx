import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { KK_LAYER } from '@kk/ui';

import { PROMPT_COMPOSER_ACTIONS } from '../../../features/ai-assistant-runtime';
import { GenerationMode } from '../../../types';
import type { PromptBarModeOption } from './composerModeRegistry';

interface DesktopComposerModeSwitcherProps {
  isMobile: boolean;
  activeMode: GenerationMode;
  modeOptions: PromptBarModeOption[];
  onSelectMode: (mode: GenerationMode) => void;
}

/**
 * A single creative-type picker keeps the Composer quiet while retaining
 * direct access to every generation mode.
 */
const DesktopComposerModeSwitcher: React.FC<DesktopComposerModeSwitcherProps> = ({
  isMobile,
  activeMode,
  modeOptions,
  onSelectMode,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeOption = modeOptions.find((item) => item.mode === activeMode) ?? modeOptions[0];
  const ActiveIcon = activeOption.icon;

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`kk-composer-type-picker relative ${isMobile ? 'w-full' : 'w-auto'}`}>
      <button
        type="button"
        className={`kk-composer-type-picker__trigger inline-flex items-center gap-1.5 rounded-full border border-[var(--prompt-bar-shell-border)] bg-[var(--prompt-bar-shell-bg)] px-3 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--prompt-bar-shell-hover)] ${isMobile ? 'w-full justify-between' : ''}`}
        style={isMobile ? undefined : { width: 84, minWidth: 84, paddingInline: 8 }}
        data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.toggleMode.uiAction}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`当前创作类型：${activeOption.label}`}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((current) => !current);
        }}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <ActiveIcon size={14} aria-hidden="true" />
          <span className="truncate">{activeOption.label}</span>
        </span>
        <ChevronDown size={13} className={`shrink-0 transition-transform duration-[125ms] ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className="kk-composer-type-picker__menu absolute bottom-[calc(100%+8px)] left-0 z-[var(--kk-layer-dropdown)] min-w-[196px] rounded-[14px] border border-[var(--prompt-bar-shell-border)] bg-[var(--kk-morphic-panel)] p-1.5"
          style={{ zIndex: KK_LAYER.dropdown }}
          role="listbox"
          aria-label="创作类型"
        >
          {modeOptions.map((item) => {
            const isActive = activeMode === item.mode;
            const Icon = item.icon;
            return (
              <button
                key={item.mode}
                type="button"
                role="option"
                aria-selected={isActive}
                data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.toggleMode.uiAction}
                className="kk-composer-type-picker__option flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--prompt-bar-shell-hover)] hover:text-[var(--text-primary)]"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectMode(item.mode);
                  setIsOpen(false);
                }}
              >
                <Icon size={14} aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {isActive && <Check size={13} className="text-[var(--kk-morphic-action)]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DesktopComposerModeSwitcher;
