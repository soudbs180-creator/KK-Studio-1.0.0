import React from 'react';
import { KK_LAYER } from '@kk/ui';
import { ChevronDown } from 'lucide-react';

import { GenerationMode } from '../../../types';
import { PROMPT_COMPOSER_ACTIONS } from '../../../features/ai-assistant-runtime';

interface DesktopComposerCountControlProps {
  mode: GenerationMode;
  parallelCount: number;
  open: boolean;
  onToggle: () => void;
  onSelect: (count: number) => void;
}

/**
 * Keeps the desktop generation-count control isolated from PromptBar's business state.
 */
const DesktopComposerCountControl: React.FC<DesktopComposerCountControlProps> = ({
  mode,
  parallelCount,
  open,
  onToggle,
  onSelect,
}) => {
  const countOptions = mode === GenerationMode.PPT
    ? Array.from({ length: 20 }, (_, index) => index + 1)
    : [1, 2, 3, 4];

  return (
    <div className="relative h-full w-[74px]">
      <button
        type="button"
        data-open={open}
        data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.toggleParallelCountMenu.uiAction}
        className="kk-composer-config-control kk-composer-count-control prompt-bar-liquid-button flex w-full items-center justify-center whitespace-nowrap"
        aria-label={`生成张数：${parallelCount} 张`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="生成张数"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        <span className="kk-composer-count-control__value">{parallelCount}</span>
        <span className="kk-composer-count-control__unit">张</span>
        <ChevronDown
          className={`kk-composer-config-control__chevron h-3 w-3 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          className="absolute bottom-full mb-2"
          style={{ left: '50%', transform: 'translateX(-50%)', zIndex: KK_LAYER.dropdown }}
        >
          <div className="kk-prompt-bar-deep-count-popover" role="listbox" aria-label="生成张数">
            <div className="kk-composer-count-menu__heading">
              <span className="kk-composer-count-menu__title">生成张数</span>
              <span>单次任务</span>
            </div>
            <div className="kk-composer-count-menu__grid">
              {countOptions.map((count) => (
                <button
                  key={count}
                  type="button"
                  role="option"
                  aria-selected={parallelCount === count}
                  data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.selectParallelCount.uiAction}
                  className={`kk-prompt-bar-deep-count-option ${parallelCount === count ? 'kk-prompt-bar-deep-count-option--active' : ''}`}
                  onClick={() => onSelect(count)}
                >
                  <strong>{count}</strong>
                  <span>张</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DesktopComposerCountControl;
