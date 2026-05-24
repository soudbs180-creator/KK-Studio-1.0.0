import React, { useMemo, useRef } from 'react';
import {
  AspectRatio,
  EcommerceAPlusControlMode,
  EcommerceGroupSheet,
  EcommerceSheetSetting,
  EcommerceSheetSettingPatch,
  ImageSize,
} from '../../types';
import { Fullscreen, ChevronDown } from 'lucide-react';

interface ImageOptionsPanelProps {
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  onImageSizeChange: (size: ImageSize) => void;
  availableRatios?: AspectRatio[];
  availableSizes?: ImageSize[];
  ecommerceSheetSettings?: Record<EcommerceGroupSheet, EcommerceSheetSetting>;
  onUpdateEcommerceSheetSetting?: (sheet: EcommerceGroupSheet, patch: EcommerceSheetSettingPatch) => void;
  activeEcommerceSheet?: EcommerceGroupSheet;
  onActiveEcommerceSheetChange?: (sheet: EcommerceGroupSheet) => void;
  quality?: 'auto' | 'low' | 'medium' | 'high' | 'standard' | 'hd';
  background?: 'auto' | 'opaque' | 'transparent';
  outputFormat?: 'png' | 'jpeg' | 'webp';
  outputCompression?: number;
  moderation?: 'auto' | 'low';
  onQualityChange?: (quality: 'auto' | 'low' | 'medium' | 'high' | 'standard' | 'hd') => void;
  onBackgroundChange?: (background: 'auto' | 'opaque' | 'transparent') => void;
  onOutputFormatChange?: (format: 'png' | 'jpeg' | 'webp') => void;
  onOutputCompressionChange?: (compression: number) => void;
  onModerationChange?: (moderation: 'auto' | 'low') => void;
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
    <div className="relative flex rounded-xl p-0.5" style={SEGMENT_STYLE}>
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
      className="flex gap-1.5 overflow-hidden rounded-xl p-1.5"
      style={SEGMENT_STYLE}
    >
      {layout.hasAuto && !layout.autoInGrid ? (
        <button
          type="button"
          onClick={() => onChange(AspectRatio.AUTO)}
          className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200"
          style={{
            width: '58px',
            height: layout.useDoubleRow ? '100px' : '48px',
            color: selectedAspectRatio === AspectRatio.AUTO ? 'var(--text-primary)' : 'var(--text-tertiary)',
            backgroundColor: selectedAspectRatio === AspectRatio.AUTO ? 'color-mix(in srgb, var(--bg-hover) 92%, transparent)' : 'transparent',
          }}
        >
          <Fullscreen size={18} />
          <span className="text-xs">自适应</span>
        </button>
      ) : null}

      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        className={`grid min-w-0 flex-1 overflow-y-hidden ${layout.needsScroll ? 'custom-scrollbar overflow-x-auto' : 'overflow-x-hidden'}`}
        style={{
          gridTemplateColumns: layout.needsScroll ? `repeat(${layout.columns}, minmax(54px, 1fr))` : `repeat(${layout.columns}, minmax(0, 1fr))`,
          gridTemplateRows: layout.useDoubleRow ? 'repeat(2, 48px)' : '48px',
          gap: '4px',
          paddingBottom: layout.needsScroll ? '4px' : '0',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
        }}
      >
        {layout.autoInGrid ? (
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
  onAspectRatioChange,
  onImageSizeChange,
  availableRatios = Object.values(AspectRatio),
  availableSizes = Object.values(ImageSize),
  ecommerceSheetSettings,
  onUpdateEcommerceSheetSetting,
  activeEcommerceSheet,
  onActiveEcommerceSheetChange,
  quality,
  background,
  outputFormat,
  outputCompression,
  moderation,
  onQualityChange,
  onBackgroundChange,
  onOutputFormatChange,
  onOutputCompressionChange,
  onModerationChange,
}) => {
  const [showAdvanced, setShowAdvanced] = React.useState(false);
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

  return (
    <div
      className="custom-scrollbar overflow-y-auto rounded-[28px] border p-4"
      style={{
        width: 'min(420px, calc(100vw - 24px))',
        maxHeight: 'min(60vh, 520px)',
        ...PANEL_STYLE,
      }}
    >


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

      {/* 比例与画质之后，折叠高级面板 */}
      <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full py-1 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus:outline-none"
        >
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            高级图像参数
          </span>
          <ChevronDown
            size={16}
            className="transition-transform duration-200"
            style={{ transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-3.5 p-3 rounded-2xl" style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-input) 36%, transparent)',
            border: '1px solid var(--border-subtle)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}>
            {/* 1. 画质选择 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[var(--text-secondary)] font-medium">画面质量 (Quality)</label>
              <select
                value={quality || 'auto'}
                onChange={(e) => onQualityChange?.(e.target.value as any)}
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--bg-input) 80%, transparent)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  outline: 'none',
                  width: '100%',
                }}
              >
                <option value="auto">自适应 (auto)</option>
                <option value="low">低质量 (low)</option>
                <option value="medium">中等 (medium)</option>
                <option value="high">高质量 (high)</option>
                <option value="standard">标准 (standard)</option>
                <option value="hd">超清 HD (hd)</option>
              </select>
            </div>

            {/* 2. 背景选择 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[var(--text-secondary)] font-medium">背景模式 (Background)</label>
              <select
                value={background || 'auto'}
                onChange={(e) => onBackgroundChange?.(e.target.value as any)}
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--bg-input) 80%, transparent)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  outline: 'none',
                  width: '100%',
                }}
              >
                <option value="auto">自适应 (auto)</option>
                <option value="opaque">不透明 (opaque)</option>
                <option value="transparent">透明背景 (transparent)</option>
              </select>
            </div>

            {/* 3. 输出格式 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[var(--text-secondary)] font-medium">输出格式 (Format)</label>
              <select
                value={outputFormat || 'webp'}
                onChange={(e) => onOutputFormatChange?.(e.target.value as any)}
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--bg-input) 80%, transparent)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  outline: 'none',
                  width: '100%',
                }}
              >
                <option value="webp">WebP (推荐)</option>
                <option value="jpeg">JPEG</option>
                <option value="png">PNG (无损)</option>
              </select>
            </div>

            {/* 4. 压缩率 (仅在 webp/jpeg 下展示) */}
            {(outputFormat === 'jpeg' || outputFormat === 'webp' || !outputFormat) && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-[var(--text-secondary)] font-medium">画质压缩率 (Compression)</label>
                  <span className="text-xs font-mono text-[var(--text-primary)]">{outputCompression ?? 80}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={outputCompression ?? 80}
                  onChange={(e) => onOutputCompressionChange?.(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: 'var(--accent-coral)',
                    height: '4px',
                    borderRadius: '2px',
                    cursor: 'pointer',
                  }}
                />
              </div>
            )}

            {/* 5. 内容审核 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[var(--text-secondary)] font-medium">安全过滤级别 (Moderation)</label>
              <select
                value={moderation || 'auto'}
                onChange={(e) => onModerationChange?.(e.target.value as any)}
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--bg-input) 80%, transparent)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  outline: 'none',
                  width: '100%',
                }}
              >
                <option value="auto">自适应/严格 (auto)</option>
                <option value="low">宽松 (low)</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageOptionsPanel;
