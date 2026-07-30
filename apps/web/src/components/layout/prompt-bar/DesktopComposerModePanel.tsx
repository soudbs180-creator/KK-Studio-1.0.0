import React, { useEffect, useState } from 'react';
import { KK_LAYER } from '@kk/ui';
import { AspectRatio, type GenerationConfig, GenerationMode } from '../../../types';
import { PROMPT_COMPOSER_ACTIONS } from '../../../features/ai-assistant-runtime';
import ComposerGenerationCountField from './ComposerGenerationCountField';

interface DesktopComposerModePanelProps {
  isMobile: boolean;
  config: GenerationConfig;
  showOptionsPanel: boolean;
  optionsPanelRef: React.RefObject<HTMLDivElement | null>;
  mobileFloatingSheetBottom: string;
  mobileFloatingSheetMaxHeight: string;
  embeddedMobileDrawer?: boolean;
  onToggleOptionsPanel: () => void;
  onParallelCountChange?: (count: number) => void;
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
  embeddedMobileDrawer = false,
  onToggleOptionsPanel,
  onParallelCountChange,
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
  const isEmbeddedMobileDrawer = isMobile && embeddedMobileDrawer;
  const panelContentWithCount = (
    <div className="kk-composer-options-stack">
      {optionsPanelContent}
      {onParallelCountChange ? (
        <ComposerGenerationCountField
          mode={config.mode}
          parallelCount={config.parallelCount}
          onSelect={onParallelCountChange}
        />
      ) : null}
    </div>
  );

  return (
    <>
      <div className={`relative inline-flex ${isMobile ? 'min-w-0 shrink-0' : 'min-w-fit flex-shrink-0'}`}>
        <button
          data-options-toggle
          data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.toggleAdvancedOptions.uiAction}
          className={`kk-composer-config-control kk-composer-parameter-control ${isMobile ? '' : 'prompt-bar-liquid-button'} flex w-full items-center justify-center whitespace-nowrap ${isMobile ? (isEmbeddedMobileDrawer ? 'px-3 justify-between max-w-[42vw] min-w-0 overflow-hidden' : 'px-2.5 max-w-[40vw] min-w-0 overflow-hidden') : 'flex-shrink-0'}`}
          style={{
            background: showOptionsPanel ? 'var(--prompt-bar-shell-hover)' : 'var(--prompt-bar-shell-bg)',
            color: 'var(--text-secondary)',
            borderColor: showOptionsPanel ? 'var(--prompt-bar-shell-border-strong)' : 'var(--prompt-bar-shell-border)',
          }}
          aria-label="打开生成参数"
          aria-haspopup="dialog"
          aria-expanded={showOptionsPanel}
          onClick={(event) => {
            event.stopPropagation();
            onToggleOptionsPanel();
          }}
          title="生成参数"
        >
          <span className="kk-composer-parameter-control__summary">{summary}</span>
          <svg className={`kk-composer-config-control__chevron w-3 h-3 ${showOptionsPanel ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {showOptionsPanel && isMobile ? (
          <div
            className={isEmbeddedMobileDrawer ? 'mt-2 w-full animate-fadeIn overflow-y-auto' : 'kk-desktop-composer-mobile-sheet fixed left-3 right-3 ios-mobile-floating-sheet p-2 animate-fadeIn overflow-hidden'}
            style={
              isEmbeddedMobileDrawer
                ? {
                    maxHeight: mobileFloatingSheetMaxHeight,
                    overscrollBehavior: 'contain',
                  }
                : {
                    zIndex: KK_LAYER.modalBackdrop,
                    bottom: mobileFloatingSheetBottom,
                    maxHeight: mobileFloatingSheetMaxHeight,
                    overscrollBehavior: 'contain',
                  }
            }
          >
            <div ref={optionsPanelRef}>{panelContentWithCount}</div>
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
            <div ref={optionsPanelRef}>{panelContentWithCount}</div>
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
