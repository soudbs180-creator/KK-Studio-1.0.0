import React, { useEffect, useState } from 'react';
import { AspectRatio, GenerationConfig, GenerationMode } from '../../../types';

interface DesktopComposerModePanelProps {
  isMobile: boolean;
  config: GenerationConfig;
  showOptionsPanel: boolean;
  optionsPanelRef: React.RefObject<HTMLDivElement | null>;
  mobileFloatingSheetBottom: string;
  mobileFloatingSheetMaxHeight: string;
  embeddedMobileDrawer?: boolean;
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
  embeddedMobileDrawer = false,
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
            {config.aspectRatio === AspectRatio.AUTO ? '自适应' : config.aspectRatio}
            {!isMobile && ` · ${config.imageSize}`}
          </span>
        </>
      );
    }

    return (
      <>
        {sharedIcon}
        <span className="whitespace-nowrap">
          {config.aspectRatio === AspectRatio.AUTO ? '自适应' : config.aspectRatio}
          {!isMobile && ` · ${config.videoResolution || '720p'}`}
        </span>
      </>
    );
  })();

  const shouldRenderDesktopPanel = !isMobile && (showOptionsPanel || isDesktopPanelVisible);
  const isEmbeddedMobileDrawer = isMobile && embeddedMobileDrawer;

  return (
    <>
      <div className={isMobile ? 'static min-w-0 shrink-0' : `relative inline-flex min-w-fit flex-shrink-0`}>
        <button
          data-options-toggle
          className={`${isMobile ? '' : 'prompt-bar-liquid-button'} flex w-full items-center justify-center gap-1.5 h-10 rounded-lg border transition-all text-xs font-medium whitespace-nowrap ${isMobile ? (isEmbeddedMobileDrawer ? 'px-3 justify-between max-w-[34vw] min-w-0 overflow-hidden' : 'px-2.5 max-w-[32vw] min-w-0 overflow-hidden') : 'px-3.5 flex-shrink-0'}`}
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
          isEmbeddedMobileDrawer ? (
            <div
              className="mt-2 w-full animate-fadeIn overflow-y-auto"
              style={{
                maxHeight: mobileFloatingSheetMaxHeight,
                overscrollBehavior: 'contain',
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              <div ref={optionsPanelRef}>{optionsPanelContent}</div>
            </div>
          ) : (
            <>
              {/* 🚀 移动端 Bottom Sheet 蒙层 - 点击关闭 */}
              <div
                className="fixed inset-0 z-[1049] bg-black/40"
                style={{ backdropFilter: 'blur(2px)' }}
                onClick={(e) => { e.stopPropagation(); onToggleOptionsPanel(); }}
                onTouchStart={(e) => e.stopPropagation()}
              />
              {/* 🚀 移动端 Bottom Sheet 半屏弹窗 */}
              <div
                className="fixed left-0 right-0 bottom-0 z-[1050] flex flex-col items-center"
                style={{
                  animation: 'bottom-sheet-slide-up 0.28s cubic-bezier(0.32,0.72,0,1) forwards',
                  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <style>{`
                  @keyframes bottom-sheet-slide-up {
                    from { transform: translateY(100%); opacity: 0.6; }
                    to   { transform: translateY(0);    opacity: 1; }
                  }
                `}</style>
                <div
                  className="w-full max-w-[480px] rounded-t-2xl overflow-hidden"
                  style={{
                    background: 'var(--frost-card-framework-bg)',
                    borderTop: '1px solid var(--frost-card-framework-border)',
                    borderLeft: '1px solid var(--frost-card-framework-border)',
                    borderRight: '1px solid var(--frost-card-framework-border)',
                    boxShadow: '0 -8px 32px rgba(0,0,0,0.25)',
                    backdropFilter: 'blur(24px) saturate(1.2)',
                    WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
                  }}
                >
                  {/* 拖拽手柄条 */}
                  <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 rounded-full bg-[var(--text-tertiary)] opacity-30" />
                  </div>
                  {/* 内容滚动区 */}
                  <div
                    ref={optionsPanelRef}
                    className="px-3 pb-4 overflow-y-auto"
                    style={{ maxHeight: '50vh', overscrollBehavior: 'contain' }}
                  >
                    {optionsPanelContent}
                  </div>
                </div>
              </div>
            </>
          )
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
