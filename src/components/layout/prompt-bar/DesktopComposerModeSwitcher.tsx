import React from 'react';
import { GenerationMode } from '../../../types';
import type { PromptBarModeOption } from './composerModeRegistry';

interface DesktopComposerModeSwitcherProps {
  isMobile: boolean;
  activeMode: GenerationMode;
  modeOptions: PromptBarModeOption[];
  onSelectMode: (mode: GenerationMode) => void;
}

const DesktopComposerModeSwitcher: React.FC<DesktopComposerModeSwitcherProps> = ({
  isMobile,
  activeMode,
  modeOptions,
  onSelectMode,
}) => {
  const activeModeIndex = modeOptions.findIndex((item) => item.mode === activeMode);
  const normalizedActiveIndex = activeModeIndex >= 0 ? activeModeIndex : 0;
  const modeSlotWidth = isMobile ? 72 : 82;
  const sliderWidth = isMobile ? 64 : 74;
  const sliderOffset =
    4 + normalizedActiveIndex * modeSlotWidth + (modeSlotWidth - sliderWidth) / 2;

  return (
    <div className={isMobile ? 'w-full overflow-x-auto scrollbar-none pb-0.5' : 'flex items-center gap-2'}>
      <div
        className={`relative inline-flex items-center rounded-xl border p-1 ${isMobile ? 'min-w-max' : ''}`}
        style={{
          background: 'var(--prompt-bar-shell-bg)',
          borderColor: 'var(--prompt-bar-shell-border)',
          boxShadow: 'var(--prompt-bar-shell-shadow)',
        }}
      >
        <div
          className="pointer-events-none absolute left-0 top-1 h-[calc(100%-8px)] rounded-lg transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{
            width: `${sliderWidth}px`,
            transform: `translate3d(${sliderOffset}px, 0, 0)`,
            backgroundColor: modeOptions[normalizedActiveIndex]?.activeBg || 'rgba(99,102,241,0.16)',
            border: `1px solid ${modeOptions[normalizedActiveIndex]?.activeBorder || 'var(--prompt-bar-shell-border-strong)'}`,
            boxShadow: 'none',
            willChange: 'transform, background-color, border-color, box-shadow',
          }}
        />

        {Array.from({ length: Math.max(0, modeOptions.length - 1) }, (_, index) => index + 1).map((splitIndex) => {
          const dividerCenter = 4 + splitIndex * modeSlotWidth;

          return (
            <span
              key={`split-${splitIndex}`}
              className="pointer-events-none absolute inset-y-0 my-auto h-[52%] w-px"
              style={{
                left: `${dividerCenter}px`,
                backgroundColor: 'var(--prompt-bar-shell-border)',
                opacity: 0.08,
              }}
            />
          );
        })}

        {modeOptions.map((item) => {
          const isActive = activeMode === item.mode;
          const Icon = item.icon;

          return (
            <div key={item.mode} className="relative z-10">
              <button
                type="button"
                className={`rounded-lg px-2 py-1.5 font-medium transition-colors duration-200 ease-out ${isMobile ? 'w-[72px] text-[12px]' : 'w-[82px] text-sm'} ${isActive ? 'font-semibold' : 'hover:text-[var(--text-primary)]'}`}
                style={{ color: isActive ? item.color : 'var(--text-secondary)' }}
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectMode(item.mode);
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Icon size={14} className="transition-colors duration-200 ease-out" />
                  <span className={`transition-colors duration-200 ${isActive ? 'tracking-[0.01em]' : ''}`}>
                    {item.label}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DesktopComposerModeSwitcher;
