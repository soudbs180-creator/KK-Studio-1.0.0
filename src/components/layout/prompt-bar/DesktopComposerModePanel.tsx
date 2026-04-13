import React from 'react';
import { AspectRatio, GenerationConfig, GenerationMode } from '../../../types';

interface DesktopComposerModePanelProps {
  isMobile: boolean;
  config: GenerationConfig;
  showOptionsPanel: boolean;
  optionsPanelRef: React.RefObject<HTMLDivElement | null>;
  mobileFloatingSheetBottom: string;
  mobileFloatingSheetMaxHeight: string;
  onToggleOptionsPanel: () => void;
  optionsPanelContent: React.ReactNode;
  networkControls?: React.ReactNode;
}

const DesktopComposerModePanel: React.FC<DesktopComposerModePanelProps> = ({
  isMobile,
  config,
  showOptionsPanel,
  optionsPanelRef,
  mobileFloatingSheetBottom,
  mobileFloatingSheetMaxHeight,
  onToggleOptionsPanel,
  optionsPanelContent,
  networkControls,
}) => {
  const summary = (() => {
    if (config.mode === GenerationMode.AUDIO) {
      return <span>{config.audioDuration || '自动'}</span>;
    }

    const sharedIcon =
      config.aspectRatio === AspectRatio.AUTO ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <rect width="10" height="8" x="7" y="8" rx="1" />
        </svg>
      ) : (
        <span className="inline-flex min-w-[24px] items-center justify-center text-[11px] font-semibold">
          {config.aspectRatio}
        </span>
      );

    if (config.mode === GenerationMode.IMAGE || config.mode === GenerationMode.PPT || config.mode === GenerationMode.ECOMMERCE) {
      return (
        <>
          {sharedIcon}
          <span className="whitespace-nowrap">
            {config.aspectRatio === AspectRatio.AUTO ? '自适应' : config.aspectRatio} · {config.imageSize}
          </span>
        </>
      );
    }

    return (
      <>
        {sharedIcon}
        <span className="whitespace-nowrap">
          {config.aspectRatio === AspectRatio.AUTO ? '自适应' : config.aspectRatio} · {config.videoResolution || '720p'}
        </span>
      </>
    );
  })();

  return (
    <>
      <div className={`relative inline-flex ${isMobile ? 'row-start-2 min-w-0' : 'min-w-fit flex-shrink-0'}`}>
        <button
          data-options-toggle
          className={`flex w-full items-center justify-center gap-1.5 h-10 rounded-lg border transition-all text-xs font-medium whitespace-nowrap ${isMobile ? 'px-2.5 max-w-none' : 'px-3.5 flex-shrink-0'}`}
          style={{
            background: showOptionsPanel ? 'var(--prompt-bar-shell-hover)' : 'var(--prompt-bar-shell-bg)',
            color: 'var(--text-secondary)',
            borderColor: showOptionsPanel ? 'var(--prompt-bar-shell-border-strong)' : 'var(--prompt-bar-shell-border)',
          }}
          onClick={(event) => {
            event.stopPropagation();
            onToggleOptionsPanel();
          }}
          title="图片/视频选项"
        >
          {summary}
          <svg className={`w-3 h-3 transition-transform ${showOptionsPanel ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {showOptionsPanel ? (
          <div
            className={isMobile ? 'fixed left-3 right-3 z-[1005] ios-mobile-floating-sheet p-2 animate-scaleIn origin-bottom overflow-hidden' : 'absolute bottom-full mb-2 z-30'}
            style={
              isMobile
                ? {
                    bottom: mobileFloatingSheetBottom,
                    maxHeight: mobileFloatingSheetMaxHeight,
                    overscrollBehavior: 'contain',
                  }
                : { left: '50%', transform: 'translateX(-50%)' }
            }
          >
            <div ref={optionsPanelRef}>{optionsPanelContent}</div>
          </div>
        ) : null}
      </div>

      {!isMobile && networkControls ? (
        <div className="flex min-w-0 max-w-full items-center gap-1.5">{networkControls}</div>
      ) : null}
    </>
  );
};

export default DesktopComposerModePanel;
