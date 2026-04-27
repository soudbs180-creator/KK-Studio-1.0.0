import React, { useEffect, useState } from 'react';
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
  summaryContent?: React.ReactNode;
}

function resolveAspectRatioSummaryDimensions(ratio: AspectRatio): { width: number; height: number } {
  const [rawWidth, rawHeight] = String(ratio).split(':').map((value) => Number(value));
  const widthRatio = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : 1;
  const heightRatio = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 1;
  const maxSize = 14;

  if (widthRatio > heightRatio) {
    return {
      width: maxSize,
      height: (maxSize * heightRatio) / widthRatio,
    };
  }

  return {
    width: (maxSize * widthRatio) / heightRatio,
    height: maxSize,
  };
}

const renderAspectRatioSummaryIcon = (ratio: AspectRatio) => {
  if (ratio === AspectRatio.AUTO) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        <rect width="10" height="8" x="7" y="8" rx="1" />
      </svg>
    );
  }

  const dimensions = resolveAspectRatioSummaryDimensions(ratio);

  return (
    <span className="inline-flex h-[14px] w-[14px] items-center justify-center" aria-hidden="true">
      <span
        className="rounded-[2px] border-[1.5px] border-current"
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
        }}
      />
    </span>
  );
};

const DESKTOP_PANEL_EXIT_MS = 180;

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
  summaryContent,
}) => {
  const [isDesktopPanelVisible, setIsDesktopPanelVisible] = useState(showOptionsPanel);
  const [isDesktopPanelClosing, setIsDesktopPanelClosing] = useState(false);

  useEffect(() => {
    if (isMobile) {
      setIsDesktopPanelVisible(showOptionsPanel);
      setIsDesktopPanelClosing(false);
      return;
    }

    if (showOptionsPanel) {
      setIsDesktopPanelVisible(true);
      setIsDesktopPanelClosing(false);
      return;
    }

    if (!isDesktopPanelVisible) {
      return;
    }

    setIsDesktopPanelClosing(true);
    const timerId = window.setTimeout(() => {
      setIsDesktopPanelVisible(false);
      setIsDesktopPanelClosing(false);
    }, DESKTOP_PANEL_EXIT_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isDesktopPanelVisible, isMobile, showOptionsPanel]);

  const summary = summaryContent ?? (() => {
    if (config.mode === GenerationMode.AUDIO) {
      return <span>{config.audioDuration || '自动'}</span>;
    }

    const sharedIcon = renderAspectRatioSummaryIcon(config.aspectRatio);

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

  const shouldRenderDesktopPanel = !isMobile && (showOptionsPanel || isDesktopPanelVisible);

  return (
    <>
      <div className={`relative inline-flex ${isMobile ? 'row-start-2 min-w-0' : 'min-w-fit flex-shrink-0'}`}>
        <button
          data-options-toggle
          className={`${isMobile ? '' : 'prompt-bar-liquid-button'} flex w-full items-center justify-center gap-1.5 h-10 rounded-lg border transition-all text-xs font-medium whitespace-nowrap ${isMobile ? 'px-2.5 max-w-none' : 'px-3.5 flex-shrink-0'}`}
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

        {showOptionsPanel && isMobile ? (
          <div
            className={isMobile ? 'fixed left-3 right-3 z-[1005] ios-mobile-floating-sheet p-2 animate-fadeIn overflow-hidden' : 'absolute bottom-full mb-2 z-30 animate-fadeIn origin-bottom'}
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
        {shouldRenderDesktopPanel ? (
          <div
            className={`absolute z-30 origin-bottom ${isDesktopPanelClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}
            style={{
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: 'calc(100% - 4px)',
              pointerEvents: isDesktopPanelClosing ? 'none' : 'auto',
            }}
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
