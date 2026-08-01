import React, { useMemo, useRef } from 'react';
import {
  AspectRatio,
  type EcommerceAPlusControlMode,
  type EcommerceGroupSheet,
  type EcommerceSheetSetting,
  type EcommerceSheetSettingPatch,
  ImageSize,
} from '../../types';
import { Fullscreen } from 'lucide-react';

interface ImageOptionsPanelProps {
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  networkOptions?: Array<{
    id: string;
    label: string;
    active: boolean;
    onToggle: () => void;
  }>;
  showThinkingMode?: boolean;
  thinkingMode?: 'minimal' | 'high';
  onThinkingModeChange?: (mode: 'minimal' | 'high') => void;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  onImageSizeChange: (size: ImageSize) => void;
  availableRatios?: AspectRatio[];
  availableSizes?: ImageSize[];
  ecommerceSheetSettings?: Record<EcommerceGroupSheet, EcommerceSheetSetting>;
  onUpdateEcommerceSheetSetting?: (sheet: EcommerceGroupSheet, patch: EcommerceSheetSettingPatch) => void;
  activeEcommerceSheet?: EcommerceGroupSheet;
  onActiveEcommerceSheetChange?: (sheet: EcommerceGroupSheet) => void;
}

const aPlusControlModeLabels: Record<EcommerceAPlusControlMode, string> = {
  auto: '自动',
  '1464x600': '1464x600',
  '970x600': '970x600',
  '600x450': '600x450',
};

const TITLE_STYLE: React.CSSProperties = {
  color: 'var(--text-secondary)',
};

const PANEL_STYLE: React.CSSProperties = {
  background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg-overlay) 98%, transparent) 0%, color-mix(in srgb, var(--bg-base) 98%, transparent) 100%)',
  borderColor: 'var(--border-default)',
  boxShadow: 'var(--shadow-lg), inset 0 1px 0 color-mix(in srgb, var(--text-primary) 8%, transparent)',
  backdropFilter: 'blur(22px) saturate(165%)',
  WebkitBackdropFilter: 'blur(22px) saturate(165%)',
};

const SEGMENT_STYLE: React.CSSProperties = {
  backgroundColor: 'color-mix(in srgb, var(--bg-input) 76%, transparent)',
};

const ACTIVE_TOGGLE_STYLE: React.CSSProperties = {
  borderColor: 'var(--prompt-bar-toggle-active-border)',
  background: 'var(--prompt-bar-toggle-active-bg)',
  color: 'var(--prompt-bar-toggle-active-text)',
  boxShadow: 'var(--prompt-bar-toggle-active-shadow)',
};

const ACTIVE_BUTTON_STYLE = ACTIVE_TOGGLE_STYLE;

const INACTIVE_BUTTON_STYLE: React.CSSProperties = {
  borderColor: 'var(--border-subtle)',
  backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 72%, transparent)',
  color: 'var(--text-secondary)',
};

const getRatioDimensions = (ratio: AspectRatio): { width: number; height: number } => {
  const maxSize = 14;
  const ratioMap: Record<string, [number, number]> = {
    [AspectRatio.SQUARE]: [1, 1],
    [AspectRatio.PORTRAIT_1_8]: [1, 8],
    [AspectRatio.PORTRAIT_1_4]: [1, 4],
    [AspectRatio.PORTRAIT_2_3]: [2, 3],
    [AspectRatio.PORTRAIT_3_4]: [3, 4],
    [AspectRatio.PORTRAIT_4_5]: [4, 5],
    [AspectRatio.PORTRAIT_9_16]: [9, 16],
    [AspectRatio.PORTRAIT_9_21]: [9, 21],
    [AspectRatio.LANDSCAPE_3_2]: [3, 2],
    [AspectRatio.LANDSCAPE_4_3]: [4, 3],
    [AspectRatio.LANDSCAPE_5_4]: [5, 4],
    [AspectRatio.LANDSCAPE_16_9]: [16, 9],
    [AspectRatio.LANDSCAPE_21_9]: [21, 9],
    [AspectRatio.LANDSCAPE_4_1]: [4, 1],
    [AspectRatio.LANDSCAPE_8_1]: [8, 1],
  };
  const [w, h] = ratioMap[ratio] || [1, 1];

  if (w > h) {
    return { width: maxSize, height: (maxSize * h) / w };
  }

  return { height: maxSize, width: (maxSize * w) / h };
};

const getRatioIcon = (ratio: AspectRatio) => {
  const dimensions = getRatioDimensions(ratio);

  return (
    <div className="flex items-center justify-center" style={{ width: 14, height: 14 }}>
      <div
        className="rounded-[2px] border-[1.5px] border-current"
        style={{ width: dimensions.width, height: dimensions.height }}
      />
    </div>
  );
};

const getDisplaySizes = (availableSizes: ImageSize[]) => {
  const sizeOrder = [ImageSize.SIZE_05K, ImageSize.SIZE_1K, ImageSize.SIZE_2K, ImageSize.SIZE_4K];
  return sizeOrder.filter((size, index) => availableSizes.includes(size) && sizeOrder.indexOf(size) === index);
};

const resolveSizeSlide = (displaySizes: ImageSize[], selectedSize: ImageSize) => {
  if (displaySizes.length === 0) {
    return { left: '0%', width: '0%' };
  }

  const index = displaySizes.indexOf(selectedSize);
  if (index === -1) {
    return { left: '2px', width: `calc(${100 / displaySizes.length}% - 4px)` };
  }

  const buttonWidthPercent = 100 / displaySizes.length;
  return {
    left: `calc(${buttonWidthPercent * index}% + 2px)`,
    width: `calc(${buttonWidthPercent}% - 4px)`,
  };
};

type RatioLayout = {
  uniqueRatios: AspectRatio[];
  gridRatios: AspectRatio[];
  hasAuto: boolean;
  autoInGrid: boolean;
  useDoubleRow: boolean;
  columns: number;
  needsScroll: boolean;
};

const resolveRatioLayout = (availableRatios: AspectRatio[]): RatioLayout => {
  const uniqueRatios = Array.from(new Set(availableRatios));
  const gridRatios = uniqueRatios
    .filter((ratio) => ratio !== AspectRatio.AUTO)
    .sort((left, right) => {
      const [leftWidth, leftHeight] = left.split(':').map(Number);
      const [rightWidth, rightHeight] = right.split(':').map(Number);
      const leftRatio = leftWidth / leftHeight;
      const rightRatio = rightWidth / rightHeight;
      return rightRatio - leftRatio;
    });

  const hasAuto = uniqueRatios.includes(AspectRatio.AUTO);
  const totalRatioCount = gridRatios.length + (hasAuto ? 1 : 0);
  const shouldUseSingleEqualRow = totalRatioCount <= 3;
  const isOddCount = gridRatios.length % 2 !== 0;
  const autoInGrid = hasAuto && (shouldUseSingleEqualRow || isOddCount);
  const totalGridItems = autoInGrid ? gridRatios.length + 1 : gridRatios.length;
  const useDoubleRow = !shouldUseSingleEqualRow && (totalGridItems > 3 || (hasAuto && !autoInGrid));
  const columns = shouldUseSingleEqualRow
    ? totalGridItems
    : (useDoubleRow ? Math.ceil(totalGridItems / 2) : Math.max(1, totalGridItems));
  const needsScroll = useDoubleRow ? columns > 5 : columns > 4;

  return {
    uniqueRatios,
    gridRatios,
    hasAuto,
    autoInGrid,
    useDoubleRow,
    columns,
    needsScroll,
  };
};

interface ImageSizeControlSegmentProps {
  selectedSize: ImageSize;
  displaySizes: ImageSize[];
  onChange: (size: ImageSize) => void;
}

const ImageSizeControlSegment: React.FC<ImageSizeControlSegmentProps> = ({
  selectedSize,
  displaySizes,
  onChange,
}) => {
  const sizeSlide = useMemo(
    () => resolveSizeSlide(displaySizes, selectedSize),
    [displaySizes, selectedSize],
  );

  if (displaySizes.length <= 1) {
    return null;
  }

  return (
    <div className="kk-image-size-segment relative flex rounded-xl p-0.5" style={SEGMENT_STYLE}>
      <div
        className="absolute bottom-0.5 top-0.5 rounded-[10px] transition-all duration-200 ease-out"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-hover) 92%, transparent)',
          left: sizeSlide.left,
          width: sizeSlide.width,
        }}
      />

      {displaySizes.map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => onChange(size)}
          className="relative z-10 flex-1 rounded-[10px] px-2 py-2 text-sm transition-colors duration-200"
          style={{
            color: selectedSize === size ? 'var(--text-primary)' : 'var(--text-tertiary)',
          }}
        >
          {size}
        </button>
      ))}
    </div>
  );
};

interface AspectRatioControlGridProps {
  selectedAspectRatio: AspectRatio;
  layout: RatioLayout;
  onChange: (ratio: AspectRatio) => void;
}

const AspectRatioControlGrid: React.FC<AspectRatioControlGridProps> = ({
  selectedAspectRatio,
  layout,
  onChange,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (scrollContainerRef.current && event.deltaY !== 0) {
      scrollContainerRef.current.scrollLeft += event.deltaY;
    }
  };

  return (
    <div
      className="kk-aspect-ratio-control flex gap-1.5 overflow-hidden rounded-xl p-1.5"
      style={SEGMENT_STYLE}
    >
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        className={`kk-aspect-ratio-grid grid-auto-fit grid min-w-0 flex-1 overflow-y-hidden ${layout.needsScroll ? 'custom-scrollbar overflow-x-auto' : 'overflow-x-hidden'}`}
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(54px, 1fr))',
          gridTemplateRows: layout.useDoubleRow ? 'repeat(2, 48px)' : '48px',
          gap: '4px',
          paddingBottom: layout.needsScroll ? '4px' : '0',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
        }}
      >
        {layout.hasAuto ? (
          <button
            type="button"
            onClick={() => onChange(AspectRatio.AUTO)}
            className="flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200"
            style={{
              height: '46px',
              padding: '4px',
              color: selectedAspectRatio === AspectRatio.AUTO ? 'var(--text-primary)' : 'var(--text-tertiary)',
              backgroundColor: selectedAspectRatio === AspectRatio.AUTO ? 'color-mix(in srgb, var(--bg-hover) 92%, transparent)' : 'transparent',
            }}
          >
            <Fullscreen size={14} />
            <span className="whitespace-nowrap text-[10px] leading-none">自适应</span>
          </button>
        ) : null}

        {layout.gridRatios.map((ratio) => (
          <button
            key={ratio}
            type="button"
            onClick={() => onChange(ratio)}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl transition-all duration-200"
            style={{
              height: '46px',
              padding: '4px',
              color: selectedAspectRatio === ratio ? 'var(--text-primary)' : 'var(--text-tertiary)',
              backgroundColor: selectedAspectRatio === ratio ? 'color-mix(in srgb, var(--bg-hover) 92%, transparent)' : 'transparent',
            }}
          >
            {getRatioIcon(ratio)}
            <span className="whitespace-nowrap text-[10px] leading-none">{ratio}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const ImageOptionsPanel: React.FC<ImageOptionsPanelProps> = ({
  aspectRatio,
  imageSize,
  networkOptions = [],
  showThinkingMode = false,
  thinkingMode = 'minimal',
  onThinkingModeChange,
  onAspectRatioChange,
  onImageSizeChange,
  availableRatios = Object.values(AspectRatio),
  availableSizes = Object.values(ImageSize),
  ecommerceSheetSettings,
  onUpdateEcommerceSheetSetting,
  activeEcommerceSheet,
  onActiveEcommerceSheetChange,
}) => {
  const displaySizes = useMemo(() => getDisplaySizes(availableSizes), [availableSizes]);
  const isEcommercePanel = !!ecommerceSheetSettings && !!onUpdateEcommerceSheetSetting;
  const ecommerceDisplaySizes = useMemo(() => {
    if (!isEcommercePanel || displaySizes.includes(ImageSize.SIZE_4K)) {
      return displaySizes;
    }
    return getDisplaySizes([...displaySizes, ImageSize.SIZE_4K]);
  }, [displaySizes, isEcommercePanel]);
  const ratioLayout = useMemo(() => resolveRatioLayout(availableRatios), [availableRatios]);
  const resolvedEcommerceSheet: EcommerceGroupSheet = activeEcommerceSheet ?? '主图';
  const isAPlusControlSheet = isEcommercePanel && resolvedEcommerceSheet === 'A+';
  const activeEcommerceSheetSettings = isEcommercePanel
    ? ecommerceSheetSettings[resolvedEcommerceSheet] ?? {
      aspectRatio,
      imageSize,
      aPlusControlMode: 'auto',
    }
    : {
      aspectRatio,
      imageSize,
      aPlusControlMode: 'auto',
    };
  const shouldShowThinkingMode = !isEcommercePanel && showThinkingMode;

  return (
    <div
      className="kk-image-options-panel custom-scrollbar overflow-y-auto rounded-[28px] border p-4"
      style={{
        width: 'min(420px, calc(100vw - 24px))',
        maxHeight: 'min(60vh, 520px)',
        ...PANEL_STYLE,
      }}
    >
      {networkOptions.length > 0 ? (
        <section className="mb-4 last:mb-0">
          <div className="mb-2 text-sm font-medium" style={TITLE_STYLE}>
            搜索增强
          </div>
          <div className="grid grid-cols-1 gap-2">
            {networkOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={option.onToggle}
                className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors"
                style={option.active ? ACTIVE_BUTTON_STYLE : INACTIVE_BUTTON_STYLE}
              >
                <span>{option.label}</span>
                <span className="text-xs">{option.active ? '已开启' : '未开启'}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {shouldShowThinkingMode ? (
        <section className="mb-4 last:mb-0">
          <div className="mb-2 text-sm font-medium" style={TITLE_STYLE}>
            思考模式
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onThinkingModeChange?.('minimal')}
              className="rounded-xl border px-3 py-2 text-sm transition-colors"
              style={thinkingMode === 'minimal' ? ACTIVE_BUTTON_STYLE : {
                ...INACTIVE_BUTTON_STYLE,
                color: 'var(--text-tertiary)',
              }}
            >
              快速 (minimal)
            </button>
            <button
              type="button"
              onClick={() => onThinkingModeChange?.('high')}
              className="rounded-xl border px-3 py-2 text-sm transition-colors"
              style={thinkingMode === 'high' ? ACTIVE_BUTTON_STYLE : {
                ...INACTIVE_BUTTON_STYLE,
                color: 'var(--text-tertiary)',
              }}
            >
              深入 (high)
            </button>
          </div>
        </section>
      ) : null}

      {isEcommercePanel ? (
        <>
          <section className="mb-4 last:mb-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-medium" style={TITLE_STYLE}>
                选择模块
              </div>
              <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                主图与 A+ 独立参数
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['主图', 'A+'] as EcommerceGroupSheet[]).map((sheet) => (
                <button
                  key={sheet}
                  type="button"
                  onClick={() => onActiveEcommerceSheetChange?.(sheet)}
                  className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors"
                  style={resolvedEcommerceSheet === sheet ? ACTIVE_BUTTON_STYLE : INACTIVE_BUTTON_STYLE}
                >
                  <span>{sheet}</span>
                  <span className="text-[11px]">{resolvedEcommerceSheet === sheet ? '当前' : '切换'}</span>
                </button>
              ))}
            </div>
          </section>

          {ecommerceDisplaySizes.length > 1 ? (
            <section className="mb-4 last:mb-0">
              <div className="mb-2 text-sm font-medium" style={TITLE_STYLE}>
                {resolvedEcommerceSheet} 画质
              </div>
              <ImageSizeControlSegment
                selectedSize={isAPlusControlSheet ? ImageSize.SIZE_4K : activeEcommerceSheetSettings.imageSize}
                displaySizes={ecommerceDisplaySizes}
                onChange={(size) => onUpdateEcommerceSheetSetting(resolvedEcommerceSheet, {
                  imageSize: isAPlusControlSheet ? ImageSize.SIZE_4K : size,
                })}
              />
            </section>
          ) : null}

          {!isAPlusControlSheet && ratioLayout.uniqueRatios.length > 0 ? (
            <section className="mb-4 last:mb-0">
              <div className="mb-2 text-sm font-medium" style={TITLE_STYLE}>
                主图比例
              </div>
              <AspectRatioControlGrid
                selectedAspectRatio={activeEcommerceSheetSettings.aspectRatio}
                layout={ratioLayout}
                onChange={(ratio) => onUpdateEcommerceSheetSetting(resolvedEcommerceSheet, { aspectRatio: ratio })}
              />
            </section>
          ) : null}

          {isAPlusControlSheet ? (
            <section className="mb-4 last:mb-0">
              <div className="mb-2 text-sm font-medium" style={TITLE_STYLE}>
                A+ 尺寸档位
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['auto', '1464x600', '970x600', '600x450'] as EcommerceAPlusControlMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onUpdateEcommerceSheetSetting('A+', { aPlusControlMode: mode })}
                    className="rounded-xl border px-3 py-2 text-sm transition-colors"
                    style={activeEcommerceSheetSettings.aPlusControlMode === mode ? ACTIVE_BUTTON_STYLE : INACTIVE_BUTTON_STYLE}
                  >
                    {aPlusControlModeLabels[mode]}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <>
          {displaySizes.length > 1 ? (
            <section className="mb-4 last:mb-0">
              <div className="mb-2 text-sm font-medium" style={TITLE_STYLE}>
                画质
              </div>
              <ImageSizeControlSegment
                selectedSize={imageSize}
                displaySizes={displaySizes}
                onChange={onImageSizeChange}
              />
            </section>
          ) : null}

          <section className="mb-4 last:mb-0">
            <div className="mb-2 text-sm font-medium" style={TITLE_STYLE}>
              比例
            </div>
            <AspectRatioControlGrid
              selectedAspectRatio={aspectRatio}
              layout={ratioLayout}
              onChange={onAspectRatioChange}
            />
          </section>
        </>
      )}
    </div>
  );
};

export default ImageOptionsPanel;
