import React, { startTransition, useDeferredValue, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import ReactDOM, { flushSync } from 'react-dom';
import { GenerationConfig, AspectRatio, ImageSize, GenerationMode, ModelType } from '../../types';
import { modelRegistry, ActiveModel } from '../../services/model/modelRegistry';
import { keyManager, getModelMetadata } from '../../services/auth/keyManager'; // Added getter
import { KKAI_FEATURE_FLAGS } from '../../app/kkaiFeatureFlags';
import { getModelCapabilities, modelSupportsGrounding, getModelDisplayInfo, getModelDescription, getModelThemeColor, getModelThemeBgColor, getModelDisplayName } from '../../services/model/modelCapabilities';
import ModelLogo from '../common/ModelLogo';
import { getModelBadgeInfo, getProviderBadgeColor, getProviderBadgeStyle } from '../../utils/modelBadge';
import { calculateImageHash, compressImageFile, type PreparedImageFile } from '../../utils/imageUtils';
import { saveImage, getImage } from '../../services/storage/imageStorage'; // [NEW] Import getImage
import { blobToDataURL } from '../../services/storage/blobUtils';
import { fileSystemService } from '../../services/storage/fileSystemService'; // 🚀 参考图持久化
import { notify } from '../../services/system/notificationService';
import ImageOptionsPanel from '../image/ImageOptionsPanel';
import VideoOptionsPanel from '../video/VideoOptionsPanel';
import ImagePreview from '../image/ImagePreview';
import { sortModels, toggleModelPin, getPinnedModels, filterAndSortModels } from '../../utils/modelSorting';
import { X, Search, Key, DollarSign, HardDrive, ChevronRight, ChevronUp, Activity, AlertTriangle, Plus, Trash2, FolderOpen, Globe, Loader2, RefreshCw, Copy, Check, Pause, Play, Zap, Brain, Star, Sparkles, ArrowUp } from 'lucide-react'; // [NEW] Mobile Icons & Star & Sparkles
import { useBilling } from '../../context/BillingContext';
import { useAuth } from '../../context/AuthContext';
import { calculateCost } from '../../services/billing/costService';
import { formatRemainingCredits } from '../../services/billing/remainingBalance';
import { isCreditBasedModel, getModelCredits } from '../../services/model/modelPricing';
import { adminModelService } from '../../services/model/adminModelService';
import { refreshModelLibraryData, refreshModelLibraryDataInBackground } from '../../services/model/modelLibraryRefresh';
import PromptBarTopRow from './prompt-bar/PromptBarTopRow';
import PromptBarFooter from './prompt-bar/PromptBarFooter';
import { PROMPT_BAR_MODE_REGISTRY, getPromptBarModeOption } from './prompt-bar/composerModeRegistry';
import { getPromptBarModePatch } from './prompt-bar/composerModeRegistry';
import DesktopComposerModeSwitcher from './prompt-bar/DesktopComposerModeSwitcher';
import DesktopComposerModePanel from './prompt-bar/DesktopComposerModePanel';
import DesktopComposerPromptTools from './prompt-bar/DesktopComposerPromptTools';
import DesktopComposerEcommercePanel from './prompt-bar/DesktopComposerEcommercePanel';
import { getCanonicalProviderDisplayName } from '../../utils/providerDisplay';
import { isEcommerceAllowedModel, resolveEcommerceAspectPolicy } from '../../services/ecommerce/ecommerceModelPolicy.ts';
import type { EcommerceAnalysisResult } from '../../services/ecommerce/types.ts';

const PROMPT_CONFIG_SYNC_DELAY_MS = 320;
const PROMPT_TEXTAREA_LINE_HEIGHT_PX = 22.5;
const PROMPT_TEXTAREA_MIN_ROWS = 2;
const PROMPT_TEXTAREA_MAX_ROWS = 6;
const PROMPT_TEXTAREA_MIN_HEIGHT_PX = PROMPT_TEXTAREA_LINE_HEIGHT_PX * PROMPT_TEXTAREA_MIN_ROWS;
const PROMPT_TEXTAREA_MAX_HEIGHT_PX = PROMPT_TEXTAREA_LINE_HEIGHT_PX * PROMPT_TEXTAREA_MAX_ROWS;

type ReferenceThumbnailProps = {
    image: { id: string, data?: string, mimeType?: string, storageId?: string, url?: string };
    onClick?: (e: React.MouseEvent<HTMLDivElement>, resolvedSrc: string) => void;
    onRecovered?: (payload: { id: string; data: string; mimeType?: string; storageId?: string }) => void;
};

// [FIX] Robust Image Component that self-heals from Storage if data is missing
const ReferenceThumbnail = React.memo(({
    image,
    onClick,
    onRecovered,
}: ReferenceThumbnailProps) => {
    const [data, setData] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const onRecoveredRef = useRef(onRecovered);

    useEffect(() => {
        onRecoveredRef.current = onRecovered;
    }, [onRecovered]);

    useEffect(() => {
        // 🚀 [Fix] If parent provided data and it's NOT a blob URL, use it directly
        // Blob URLs can expire after page refresh, so we should always try to recover from IDB
        if (image.data && !image.data.startsWith('blob:')) {
            setData(image.data);
            setLoading(false);
            setError(false);
            return;
        }

        // If no storageId, try using data directly (even if blob) or mark as error
        if (!image.storageId) {
            if (image.data || image.url) {
                setData(image.data || image.url);
                setLoading(false);
                setError(false);
            } else {
                setLoading(false);
                setError(true);
            }
            return;
        }

        // Try to recover from IDB
        let active = true;
        setLoading(true);
        setError(false);

        getImage(image.storageId)
            .then(cached => {
                if (active) {
                    if (cached) {
                        setData(cached);
                        if (!cached.startsWith('blob:') && cached !== image.data) {
                            onRecoveredRef.current?.({
                                id: image.id,
                                data: cached,
                                mimeType: image.mimeType,
                                storageId: image.storageId,
                            });
                        }
                    } else if (image.data || image.url) {
                        setData(image.data || image.url);
                    } else {
                        setError(true); // truly missing
                    }
                    setLoading(false);
                }
            })
            .catch(() => {
                if (active) {
                    if (image.data || image.url) {
                        setData(image.data || image.url);
                    } else {
                        setError(true);
                    }
                    setLoading(false);
                }
            });

        return () => { active = false; };
    }, [image.data, image.url, image.storageId, image.id, image.mimeType]);

    if (error) {
        return (
            <div className="w-12 h-12 rounded-lg border border-red-500/30 bg-red-500/10 flex items-center justify-center flex-col gap-0.5" title="图片加载失败">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 opacity-70">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            </div>
        );
    }

    if (loading || !data) {
        return (
            <div className="w-12 h-12 rounded-lg border border-white/10 shadow-sm bg-[var(--bg-tertiary)] flex items-center justify-center">
                <div className="w-4 h-4 rounded-full border-2 border-white/85 border-t-transparent animate-spin" />
            </div>
        );
    }

    // Robust Src Construction
    const src = (data.startsWith('data:') || data.startsWith('blob:') || data.startsWith('http'))
        ? data
        : `data:${image.mimeType || 'image/png'};base64,${data}`;

    return (
        <div
            onClick={(e) => onClick?.(e, src)}
            className="w-12 h-12 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-white/80 transition-all"
            title="点击放大查看"
        >
            <img
                src={src}
                className="w-full h-full object-cover"
                alt="参考图"
            />
        </div>
    );
}, (prev, next) => (
    prev.onClick === next.onClick
    && prev.onRecovered === next.onRecovered
    && prev.image.id === next.image.id
    && prev.image.data === next.image.data
    && prev.image.url === next.image.url
    && prev.image.mimeType === next.image.mimeType
    && prev.image.storageId === next.image.storageId
));

// 计算比例图标的尺寸
const getRatioDimensions = (ratio: AspectRatio): { width: number; height: number } => {
    const maxSize = 14;

    const ratioMap: Record<string, [number, number]> = {
        [AspectRatio.SQUARE]: [1, 1],
        [AspectRatio.PORTRAIT_9_16]: [9, 16],
        [AspectRatio.LANDSCAPE_16_9]: [16, 9],
        [AspectRatio.PORTRAIT_3_4]: [3, 4],
        [AspectRatio.LANDSCAPE_4_3]: [4, 3],
        [AspectRatio.LANDSCAPE_3_2]: [3, 2],
        [AspectRatio.PORTRAIT_2_3]: [2, 3],
        [AspectRatio.LANDSCAPE_5_4]: [5, 4],
        [AspectRatio.PORTRAIT_4_5]: [4, 5],
        [AspectRatio.LANDSCAPE_21_9]: [21, 9],
        [AspectRatio.PORTRAIT_9_21]: [9, 21],
        [AspectRatio.LANDSCAPE_4_1]: [4, 1],
        [AspectRatio.PORTRAIT_1_4]: [1, 4],
        [AspectRatio.LANDSCAPE_8_1]: [8, 1],
        [AspectRatio.PORTRAIT_1_8]: [1, 8]
    };

    const [w, h] = ratioMap[ratio] || [1, 1];

    if (w > h) {
        return { width: maxSize, height: (maxSize * h) / w };
    } else {
        return { height: maxSize, width: (maxSize * w) / h };
    }
};

// 渲染比例图标
const getRatioIcon = (ratio: AspectRatio) => {
    const dims = getRatioDimensions(ratio);

    return (
        <div className="flex items-center justify-center" style={{ width: 14, height: 14 }}>
            <div
                className="border-[1.5px] border-current rounded-[2px]"
                style={{ width: dims.width, height: dims.height }}
            />
        </div>
    );
};

/**
 * 🚀 [统一] 颜色格式标准化函数
 * 确保触发按钮、下拉列表、发送按钮的颜色渲染完全一致
 * 支持 HEX (带/不带 #)、HSL、rgb() 等格式
 */
function normalizeColor(color: string | undefined, fallback: string): string {
    if (!color || color === 'undefined' || color === 'null' || color.trim() === '') {
        return fallback;
    }
    const trimmed = color.trim();
    // 已经是合法 CSS 颜色格式（hsl/rgb/rgba/var 等），直接返回
    if (trimmed.startsWith('hsl') || trimmed.startsWith('rgb') || trimmed.startsWith('var')) {
        return trimmed;
    }
    // HEX 格式：确保有 # 前缀
    if (trimmed.startsWith('#')) {
        return trimmed;
    }
    // 纯 hex 数字（无 # 前缀），补上 #
    if (/^[A-Fa-f0-9]{3,8}$/.test(trimmed)) {
        return `#${trimmed}`;
    }
    // 其他情况原样返回（可能是合法的 CSS 颜色名 如 'orange'）
    return trimmed;
}

function normalizeModelTextColor(textColor: string | undefined): string {
    return textColor === 'black' ? '#111827' : '#ffffff';
}

function isLightSeriesTextColor(textColor: string | undefined): boolean {
    const normalized = (textColor || '').trim().toLowerCase();
    return normalized === 'black'
        || normalized === '#000'
        || normalized === '#000000'
        || normalized === '#111827';
}

function getLightSeriesSurfaceStyle(colorStart: string, emphasized = false): React.CSSProperties {
    const borderColor = emphasized
        ? `color-mix(in srgb, ${colorStart} 8%, var(--prompt-bar-shell-border-strong))`
        : 'var(--prompt-bar-shell-border)';

    return {
        background: emphasized ? 'var(--prompt-bar-shell-hover)' : 'var(--prompt-bar-shell-bg)',
        border: `1px solid ${borderColor}`,
        boxShadow: 'none',
    };
}

function getCreditModelSurfaceStyle(
    colorStart: string,
    colorEnd: string,
    textColor: string | undefined,
    emphasized = false,
): React.CSSProperties {
    const usesDarkText = isLightSeriesTextColor(textColor);

    return {
        background: usesDarkText
            ? `color-mix(in srgb, ${colorStart} ${emphasized ? 34 : 24}%, white ${emphasized ? 66 : 76}%)`
            : `color-mix(in srgb, ${colorEnd} ${emphasized ? 92 : 78}%, #111827 ${emphasized ? 8 : 22}%)`,
        border: usesDarkText
            ? `1px solid color-mix(in srgb, ${colorStart} 48%, rgba(15, 23, 42, 0.18))`
            : `1px solid color-mix(in srgb, ${colorStart} 76%, rgba(255, 255, 255, 0.18))`,
        boxShadow: 'none',
    };
}

// 🚀 [添加] 积分专属发送按钮组件
interface CreditSendButtonProps {
    isCreditModel: boolean;
    creditCost: number;
    balance: number;
    balanceLoading?: boolean;
    hasPrompt: boolean;
    colorStart?: string;
    colorEnd?: string;
    textColor?: 'white' | 'black';
    onClick: () => void;
}

const CreditSendButton: React.FC<CreditSendButtonProps> = ({
    isCreditModel,
    creditCost,
    balance,
    balanceLoading = false,
    hasPrompt,
    colorStart,
    colorEnd,
    textColor = 'white',
    onClick
}) => {
    // 判断积分是否不足
    const isInsufficient = isCreditModel && !balanceLoading && creditCost > 0 && balance < creditCost;

    // 计算是否禁用
    const isDisabled = !hasPrompt;

    // 🚀 [积分模型专属] 使用模型主题色的渐变样式 - 更精致的玻璃态效果
    const getGradientStyle = () => {
        if (!isCreditModel || isDisabled) return {};
        const start = normalizeColor(colorStart, '#3B82F6');
        const end = normalizeColor(colorEnd, '#2563EB');
        return {
            background: `linear-gradient(135deg, ${start} 0%, ${end} 100%)`,
            boxShadow: `0 2px 8px 0 ${start}50, inset 0 1px 0 0 rgba(255,255,255,0.2)`
        };
    };

    // 🚀 [普通模型/禁用状态] 样式
    const getDefaultStyle = () => {
        if (isDisabled) {
            return { className: 'bg-gray-100 dark:bg-zinc-800/50 cursor-not-allowed opacity-50' };
        }
        if (isInsufficient) {
            return { className: 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20' };
        }

        // 如果有自定义颜色，则使用自定义渐变，否则使用默认类
        if (colorStart || colorEnd) {
            const start = normalizeColor(colorStart, '#3B82F6');
            const end = normalizeColor(colorEnd, '#2563EB');
            return {
                className: `${textColor === 'black' ? 'text-black' : 'text-white'} shadow-md hover:shadow-lg transition-shadow border border-white/20 backdrop-blur-xl`,
                style: {
                    background: `linear-gradient(135deg, color-mix(in srgb, ${start} 72%, rgba(255,255,255,0.18)) 0%, color-mix(in srgb, ${end} 82%, rgba(255,255,255,0.08)) 100%)`,
                    boxShadow: `0 16px 32px -18px ${start}85, inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(255,255,255,0.08)`
                }
            };
        }
        return {
            className: `${textColor === 'black' ? 'text-black' : 'text-white'} shadow-md hover:shadow-lg transition-shadow border border-white/20 backdrop-blur-xl`,
            style: {
                background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.92) 0%, rgba(59, 130, 246, 0.88) 45%, rgba(29, 78, 216, 0.82) 100%)',
                boxShadow: '0 16px 32px -18px rgba(37, 99, 235, 0.88), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(255,255,255,0.08)'
            }
        };
    };

    // 🚀 [动画] 箭头从左到右的滑动动画关键帧
    const arrowAnimStyle = `
        @keyframes arrow-slide-right {
            0% { transform: translateX(-3px); opacity: 0.4; }
            50% { transform: translateX(2px); opacity: 1; }
            100% { transform: translateX(-3px); opacity: 0.4; }
        }

        @keyframes send-button-sheen {
            0% { transform: translateX(-130%); opacity: 0; }
            18% { opacity: 0.9; }
            48% { transform: translateX(160%); opacity: 0; }
            100% { transform: translateX(160%); opacity: 0; }
        }
    `;

    // 如果是积分模型且有提示词，使用胶囊渐变样式
    if (isCreditModel && hasPrompt && !isInsufficient) {
        const textColorClass = textColor === 'black' ? 'text-black' : 'text-white';
        const textColorStyle = textColor === 'black' ? { color: '#000000' } : { color: '#ffffff' };
        
        return (
            <>
                <style>{arrowAnimStyle}</style>
                <button
                    onClick={onClick}
                    className="group relative flex h-10 max-w-full min-w-0 shrink items-center gap-2 rounded-full pl-3.5 pr-1 transition-colors duration-200"
                    style={getGradientStyle()}
                >
                    {/* 积分消耗显示 */}
                    <div className="flex items-center gap-1" style={{ color: textColor === 'black' ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)' }}>
                        <Sparkles size={14} fill="currentColor" />
                        <span className="text-sm font-bold tabular-nums">{creditCost}</span>
                    </div>

                    {/* 分隔线 */}
                    <div className="w-px h-4" style={{ backgroundColor: textColor === 'black' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)' }} />

                    {/* 发送箭头按钮 - 内嵌圆形按钮 🚀 箭头朝右 + 滑动动画 */}
                    <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full backdrop-blur-sm"
                         style={{ backgroundColor: textColor === 'black' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.25)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
                             style={{ color: textColor === 'black' ? '#000000' : '#ffffff', animation: 'arrow-slide-right 1.5s ease-in-out infinite' }}>
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                        </svg>
                    </div>

                    {/* 悬停提示 - 精确居中于整个按钮 */}
                    <div className="absolute -top-10 left-0 right-0 flex justify-center pointer-events-none">
                        <div className="px-3 py-1.5 bg-black/85 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap scale-95 group-hover:scale-100">
                            消耗 {creditCost} 积分生成
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/85 rotate-45" />
                        </div>
                    </div>
                </button>
            </>
        );
    }

    // 🚀 [普通状态/禁用状态] 默认样式 - 用户 API 模型只显示"发送"
    const defaultStyleProps = getDefaultStyle() as any;

    return (
        <>
            <style>{arrowAnimStyle}</style>
            <button
                onClick={onClick}
                disabled={isDisabled}
                className={`
                    group relative flex h-10 max-w-full min-w-0 shrink flex-row items-center whitespace-nowrap rounded-full px-1 py-1 overflow-hidden
                    transition-colors duration-200 ease-out focus-visible:outline-none
                    ${!isDisabled && !isInsufficient ? 'focus-visible:ring-2 focus-visible:ring-blue-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent' : ''}
                    ${defaultStyleProps.className || ''}
                `}
                style={{
                    paddingRight: '4px',
                    ...(defaultStyleProps.style || {}),
                }}
            >
                {!isDisabled && !isInsufficient && (
                    <>
                        <div className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.08)_34%,rgba(255,255,255,0.03)_58%,rgba(255,255,255,0.12)_100%)] opacity-95" />
                        <div className="pointer-events-none absolute inset-x-[10px] top-[3px] h-[42%] rounded-full bg-white/18 blur-[3px]" />
                        <div
                            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/2 skew-x-[-20deg] bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.42)_50%,rgba(255,255,255,0)_100%)]"
                            style={{ animation: 'send-button-sheen 3.4s ease-in-out infinite' }}
                        />
                    </>
                )}
                <div className="relative z-[1] flex min-w-0 items-center gap-2 px-3">
                    {isCreditModel && creditCost > 0 ? (
                        <div className="flex items-center gap-1.5">
                            <Sparkles size={14} fill="currentColor" className={isDisabled ? 'text-gray-400' : isInsufficient ? 'text-red-500' : textColor === 'black' ? 'text-black' : 'text-white'} />
                            <span className={`text-sm font-bold ${isDisabled ? 'text-gray-400' : isInsufficient ? 'text-red-500' : textColor === 'black' ? 'text-black' : 'text-white'}`}>
                                {isInsufficient ? '积分不足' : creditCost}
                            </span>
                        </div>
                    ) : (
                        <span className={`text-sm font-bold tracking-[0.01em] ${isDisabled ? 'text-gray-400' : isInsufficient ? 'text-red-500' : textColor === 'black' ? 'text-black drop-shadow-[0_1px_10px_rgba(0,0,0,0.28)]' : 'text-white drop-shadow-[0_1px_10px_rgba(255,255,255,0.28)]'}`}>
                            发送
                        </span>
                    )}
                </div>

                {/* 发送箭头 🚀 箭头朝右 + 动画 */}
                <div className={`
                    relative z-[1] flex h-8 w-8 items-center justify-center overflow-hidden rounded-full transition-colors duration-200
                    ${isDisabled
                        ? 'bg-gray-300 dark:bg-zinc-700 text-gray-500'
                        : isInsufficient
                            ? 'bg-red-500 text-white'
                            : `border ${textColor === 'black' ? 'border-black/20 bg-black/10 text-black' : 'border-white/20 bg-white/22 text-white'} shadow-[inset_0_1px_0_rgba(255,255,255,0.36),inset_0_-1px_0_rgba(255,255,255,0.08),0_6px_14px_rgba(15,23,42,0.14)] backdrop-blur-md group-hover:bg-white/30`
                    }
                `}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className="transition-transform duration-200 ease-out"
                        style={!isDisabled ? { animation: 'arrow-slide-right 1.5s ease-in-out infinite' } : undefined}
                    >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                    </svg>
                </div>
            </button>
        </>
    );
};

interface PromptBarProps {
    config: GenerationConfig;
    setConfig: React.Dispatch<React.SetStateAction<GenerationConfig>>;
    onGenerate: (promptOverride?: string) => void;
    isGenerating: boolean;
    onFilesDrop?: (files: File[]) => void;
    activeSourceImage?: { id: string; url: string; prompt: string } | null;
    onClearSource?: () => void;
    onCancel?: () => void;
    isMobile?: boolean;
    onOpenSettings?: (view?: 'api-management') => void;
    onInteract?: () => void;
    onUiBusyChange?: (busy: boolean) => void;
    onFocus?: () => void;  // 输入框获取焦点时调用
    onBlur?: () => void;   // 输入框失去焦点时调用
    onOpenMore?: () => void; // [NEW] Mobile More Menu
    mobileShellMode?: 'legacy-fixed' | 'embedded';
    ecommerceRequirementFileName?: string;
    ecommerceProductFileCount?: number;
    ecommerceExtraReferenceCount?: number;
    ecommerceAnalysis?: EcommerceAnalysisResult | null;
    ecommerceSelection?: Record<string, boolean>;
    ecommerceAnalyzing?: boolean;
    onPickEcommerceRequirementFile?: (files: FileList | File[]) => void;
    onPickEcommerceProductFiles?: (files: FileList | File[]) => void;
    onPickEcommerceExtraReferenceFiles?: (files: FileList | File[]) => void;
    onResetEcommerceAnalysis?: () => void;
    onConfirmEcommerceAnalysis?: () => void;
    onToggleEcommerceSelection?: (id: string, selected: boolean) => void;
    ecommerceRatioOverride?: AspectRatio[];
    onAnalyzeEcommerceFile?: () => void;
}

const MODEL_LIST_VIRTUALIZE_THRESHOLD = 40;
const MODEL_LIST_ITEM_HEIGHT = 74;
const MODEL_LIST_OVERSCAN = 6;

const getModelDisplayGroupKey = (model: ActiveModel) => {
    const displayName = String(getModelDisplayInfo(model).displayName || model.label || model.id || '')
        .trim()
        .toLowerCase();
    const providerKey = String(model.provider || model.providerLabel || '').trim().toLowerCase();
    return `${model.isSystemInternal ? 'system' : 'user'}:${displayName}:${providerKey}`;
};

const pickPreferredDisplayModel = (current: ActiveModel, candidate: ActiveModel) => {
    const currentDescription = String(current?.description || '').trim();
    const candidateDescription = String(candidate?.description || '').trim();
    const currentProviderLabel = String(current?.providerLabel || current?.provider || '').trim();
    const candidateProviderLabel = String(candidate?.providerLabel || candidate?.provider || '').trim();

    if (!currentDescription && candidateDescription) return candidate;
    if (candidateDescription.length > currentDescription.length) return candidate;
    if (!currentProviderLabel && candidateProviderLabel) return candidate;
    return current;
};

const getFallbackDescription = (model: ActiveModel) => {
    if (model.provider) return `由 ${model.provider} 信道提供的可用模型`;
    return '外部集成的第三方语言模型';
};

type PromptBarModelOption = ActiveModel & {
    advantage: string;
    isExclusive: boolean;
    isPinned: boolean;
    displayName: string;
    providerDisplayName: string;
    providerDisplayShortName: string;
    providerBadgeColorClass: string;
    providerBadgeStyle?: React.CSSProperties;
    resolvedDescription: string;
};

type PromptBarModelMenuButtonProps = {
    model: PromptBarModelOption;
    imageSize: ImageSize;
    selected: boolean;
    isLast: boolean;
    description: string;
    onSelect: (model: PromptBarModelOption) => void;
    onOpenContextMenu: (event: React.MouseEvent<HTMLButtonElement>, model: PromptBarModelOption) => void;
};

const PromptBarModelMenuButton = React.memo(function PromptBarModelMenuButton({
    model,
    imageSize,
    selected,
    isLast,
    description,
    onSelect,
    onOpenContextMenu,
}: PromptBarModelMenuButtonProps) {
    const isExclusive = model.isExclusive;
    const isPinned = model.isPinned;
    const displayName = model.displayName;
    const badgeInfo = getModelBadgeInfo({ id: model.id, label: model.label, provider: model.provider });
    const colorStart = normalizeColor(model.colorStart, '#60a5fa');
    const colorEnd = normalizeColor(model.colorEnd, '#2563eb');
    const modelTextColor = model.textColor || 'white';
    const textColorClass = modelTextColor === 'black' ? 'text-black' : 'text-white';
    const inactiveGradientStyle = getCreditModelSurfaceStyle(colorStart, colorEnd, model.textColor, false);
    const activeGradientStyle = getCreditModelSurfaceStyle(colorStart, colorEnd, model.textColor, true);

    return (
        <button
            className={`group w-full transition-all duration-300 mx-auto cursor-pointer
            ${isExclusive
                    ? `h-14 px-5 flex items-center justify-between rounded-full flex-shrink-0 ${textColorClass} active:scale-[0.98] ${isLast ? '' : 'mb-3'} ${selected ? 'ring-2 ring-white/20 scale-[1.02]' : 'hover:scale-[1.02] opacity-80 hover:opacity-100 grayscale-[0.15] hover:grayscale-0'}`
                    : `px-3 py-2.5 text-left flex flex-col gap-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-all border-2 ${selected ? 'bg-blue-50 dark:bg-white/10 ring-2 ring-blue-500 dark:ring-white/40 border-blue-500 dark:border-white/20 shadow-md' : 'border-transparent opacity-80 hover:opacity-100 grayscale-[0.8] hover:grayscale-0'}`}
            `}
            style={isExclusive ? (selected ? activeGradientStyle : inactiveGradientStyle) : undefined}
            onMouseEnter={(event) => {
                if (isExclusive && !selected) {
                    event.currentTarget.style.background = String(activeGradientStyle.background || '');
                    event.currentTarget.style.border = String(activeGradientStyle.border || '');
                    event.currentTarget.style.boxShadow = String(activeGradientStyle.boxShadow || '');
                }
            }}
            onMouseLeave={(event) => {
                if (isExclusive && !selected) {
                    event.currentTarget.style.background = String(inactiveGradientStyle.background || '');
                    event.currentTarget.style.border = String(inactiveGradientStyle.border || '');
                    event.currentTarget.style.boxShadow = String(inactiveGradientStyle.boxShadow || '');
                }
            }}
            onClick={() => onSelect(model)}
            onContextMenu={(event) => onOpenContextMenu(event, model)}
        >
            {isExclusive ? (
                <div className="flex items-center justify-between w-full h-full">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex-shrink-0 flex items-center justify-center w-6 h-6">
                            <ModelLogo
                                modelId={model.id}
                                provider={model.provider}
                                modelName={displayName}
                                size={20}
                                active={selected}
                            />
                        </div>
                        <span className="text-sm font-semibold truncate text-left" style={model.textColor === 'black' ? { color: '#000000' } : { color: '#ffffff' }}>
                            {displayName}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                        <span
                            className={`text-xs px-2.5 py-1 rounded-full ${model.textColor === 'black' ? 'bg-black/10 border-black/20' : 'bg-white/25 border-white/30'} border font-semibold flex items-center gap-1`}
                            style={model.textColor === 'black' ? { color: '#000000' } : { color: '#ffffff' }}
                        >
                            ✨{getModelCredits(model.id || '', imageSize)}
                        </span>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="flex-shrink-0 flex items-center justify-center w-5 h-5">
                                <ModelLogo
                                    modelId={model.id}
                                    provider={model.provider}
                                    modelName={displayName}
                                    size={16}
                                    active={selected}
                                />
                            </div>
                            <span className={`text-sm font-medium ${badgeInfo.colorClass} break-all text-left`} title={displayName}>
                                {displayName}
                            </span>
                        </div>
                        {model.provider && (
                            <span
                                className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 whitespace-nowrap overflow-hidden ${model.providerBadgeColorClass}`}
                                title={model.providerDisplayName}
                                style={{ maxWidth: '40%', textOverflow: 'ellipsis', ...model.providerBadgeStyle }}
                            >
                                {model.providerDisplayShortName}
                            </span>
                        )}
                    </div>
                    <div className="flex justify-between items-start mt-1 gap-2">
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                            {description && (
                                <span className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                                    {description}
                                </span>
                            )}
                        </div>
                        {isPinned && <span className="text-[12px] opacity-80 flex-shrink-0 mr-1 mt-0.5">📌</span>}
                    </div>
                </>
            )}
        </button>
    );
});

const buildPromptBarAvailableModels = (
    globalModels: ReturnType<typeof keyManager.getGlobalModelList>,
    canBrowseSystemCreditModels: boolean,
    imageSize: ImageSize,
    mode: GenerationMode,
): ActiveModel[] => {
    const step1 = globalModels.filter(m => {
        if (m.isSystemInternal && !canBrowseSystemCreditModels) return false;
        if (m.type === 'chat') return false;
        return true;
    });

    const step2 = step1.map(m => {
        const lowerId = m.id.toLowerCase();
        const isVideo = lowerId.includes('video')
            || lowerId.includes('veo')
            || lowerId.includes('kling')
            || lowerId.includes('luma')
            || lowerId.includes('gen-3')
            || lowerId.includes('gen-2')
            || lowerId.includes('hailuo')
            || lowerId.includes('vidu');

        const isImage = lowerId.includes('image')
            || lowerId.includes('imagen')
            || lowerId.includes('flux')
            || lowerId.includes('midjourney')
            || lowerId.includes('dall-e')
            || lowerId.includes('sd-')
            || lowerId.includes('stable-diffusion')
            || lowerId.includes('ideogram');

        const inferredType = m.type || (isVideo ? 'video' : (isImage ? 'image' : 'chat'));
        const resolvedSystemDisplay = m.isSystemInternal
            ? adminModelService.getModelDisplayInfo(m.id, imageSize)
            : null;
        const resolvedProviderLabel = resolvedSystemDisplay?.providerName
            || resolvedSystemDisplay?.provider
            || m.providerLabel
            || m.provider;

        return {
            id: m.id,
            label: resolvedSystemDisplay?.displayName || m.name || m.id,
            provider: m.isSystemInternal ? 'SystemProxy' : m.provider,
            providerLabel: resolvedProviderLabel,
            isSystemInternal: m.isSystemInternal,
            sourceScope: m.isSystemInternal ? 'system' : 'user',
            sourceLabel: m.isSystemInternal ? '系统模型' : '用户 API',
            type: inferredType,
            enabled: true,
            description: m.description,
            creditCost: m.isSystemInternal
                ? (resolvedSystemDisplay?.creditCost ?? getModelCredits(m.id, imageSize))
                : undefined,
            colorStart: resolvedSystemDisplay?.colorStart || m.colorStart,
            colorEnd: resolvedSystemDisplay?.colorEnd || m.colorEnd,
            colorSecondary: resolvedSystemDisplay?.colorSecondary || m.colorSecondary,
            textColor: resolvedSystemDisplay?.textColor || m.textColor,
        } as ActiveModel;
    });

    const filteredModels = step2.filter(m => {
        const type = m.type || 'image';
        if (mode === GenerationMode.IMAGE) return type === 'image' || type === 'image+chat';
        if (mode === GenerationMode.PPT) return type === 'image' || type === 'image+chat';
        if (mode === GenerationMode.ECOMMERCE) return (type === 'image' || type === 'image+chat') && isEcommerceAllowedModel(m.id);
        if (mode === GenerationMode.VIDEO) return type === 'video';
        if (mode === GenerationMode.AUDIO) return type === 'audio';
        return type === mode;
    });

    const displayGroupedModels = new Map<string, ActiveModel>();
    filteredModels.forEach((model) => {
        const displayName = String(getModelDisplayInfo(model).displayName || model.label || model.id || '')
            .trim()
            .toLowerCase();
        const visibleProvider = String(model.provider || model.providerLabel || '').trim().toLowerCase();
        const groupKey = `${model.isSystemInternal ? 'system' : 'user'}:${displayName}:${visibleProvider}`;
        const existing = displayGroupedModels.get(groupKey);

        if (!existing) {
            displayGroupedModels.set(groupKey, model);
            return;
        }

        const existingDescription = String(existing.description || '').trim();
        const nextDescription = String(model.description || '').trim();
        if (!existingDescription && nextDescription) {
            displayGroupedModels.set(groupKey, model);
            return;
        }

        if (nextDescription.length > existingDescription.length) {
            displayGroupedModels.set(groupKey, model);
        }
    });

    return Array.from(displayGroupedModels.values());
};

const PromptBar: React.FC<PromptBarProps> = ({
    config,
    setConfig,
    onGenerate,
    isGenerating,
    onFilesDrop,
    activeSourceImage,
    onClearSource,
    onCancel,
    isMobile = false,
    onOpenSettings,
    onInteract,
    onUiBusyChange,
    onFocus,
    onBlur,
    onOpenMore,
    mobileShellMode = 'legacy-fixed',
    ecommerceRequirementFileName,
    ecommerceProductFileCount = 0,
    ecommerceExtraReferenceCount = 0,
    ecommerceAnalysis,
    ecommerceSelection = {},
    ecommerceAnalyzing = false,
    onPickEcommerceRequirementFile,
    onPickEcommerceProductFiles,
    onPickEcommerceExtraReferenceFiles,
    onResetEcommerceAnalysis,
    onConfirmEcommerceAnalysis,
    onToggleEcommerceSelection,
    ecommerceRatioOverride,
    onAnalyzeEcommerceFile,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // Track composition state so IME input is not interrupted by background sync.
    const isComposingRef = useRef(false);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [isModelMenuLoading, setIsModelMenuLoading] = useState(false);
    const [modelSearch, setModelSearch] = useState('');
    const deferredModelSearch = useDeferredValue(modelSearch);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, modelId: string } | null>(null);
    const [modelListWindowStart, setModelListWindowStart] = useState(0);

    // [NEW] Model Settings Modal State
    const [modelSettingsModal, setModelSettingsModal] = useState<{ modelId: string; alias: string; description: string } | null>(null);

    // [NEW] Model Customizations (stored in localStorage)
    const [modelCustomizations, setModelCustomizations] = useState<Record<string, { alias?: string; description?: string }>>(() => {
        try {
            const stored = localStorage.getItem('kk_model_customizations');
            return stored ? JSON.parse(stored) : {};
        } catch { return {}; }
    });

    // Save model customizations to localStorage
    const saveModelCustomization = (modelId: string, alias: string, description: string) => {
        const newCustomizations = {
            ...modelCustomizations,
            [modelId]: { alias: alias.trim() || undefined, description: description.trim() || undefined }
        };
        // Clean up empty entries
        if (!newCustomizations[modelId].alias && !newCustomizations[modelId].description) {
            delete newCustomizations[modelId];
        }
        setModelCustomizations(newCustomizations);
        localStorage.setItem('kk_model_customizations', JSON.stringify(newCustomizations));
    };

    // [NEW] Drag-to-Reorder State
    const [dragSourceId, setDragSourceId] = useState<string | null>(null);
    const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

    // [NEW] Flying Animation State
    const [flyingImage, setFlyingImage] = useState<{
        x: number;
        y: number;
        url: string;
        targetX: number;
        targetY: number;
    } | null>(null);

    // [NEW] 参考图放大状态
    const [previewImage, setPreviewImage] = useState<{ url: string; originRect: DOMRect } | null>(null);
    const handleReferenceRecovered = useCallback((payload: { id: string; data: string; mimeType?: string; storageId?: string }) => {
        setConfig(curr => ({
            ...curr,
            referenceImages: curr.referenceImages.map(ref =>
                ref.id === payload.id
                    ? {
                        ...ref,
                        data: payload.data,
                        mimeType: payload.mimeType || ref.mimeType,
                        storageId: payload.storageId || ref.storageId,
                    }
                    : ref
            )
        }));
    }, [setConfig]);

    const handleReferencePreview = useCallback((e: React.MouseEvent<HTMLDivElement>, resolvedSrc: string) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setPreviewImage({ url: resolvedSrc, originRect: rect });
    }, []);

    const refContainerRef = useRef<HTMLDivElement>(null);
    const optionsPanelRef = useRef<HTMLDivElement>(null); // [NEW] Ref for options panel

    // 状态：选项面板显示
    const [showOptionsPanel, setShowOptionsPanel] = useState(false);
    const [showPptOutlinePanel, setShowPptOutlinePanel] = useState(false);
    const [pptOutlineDraft, setPptOutlineDraft] = useState('');
    const [pptDragIndex, setPptDragIndex] = useState<number | null>(null);
    const [pptDropIndex, setPptDropIndex] = useState<number | null>(null);
    const [isInputAreaHovered, setIsInputAreaHovered] = useState(false); // Phase 3: hover state
    const [uploadingCount, setUploadingCount] = useState(0); // [NEW] Uploading indicator count
    const pendingReferenceUploads = useMemo(() => {
        return (config.referenceImages || []).filter(img => !img?.storageId).length;
    }, [config.referenceImages]);
    const uploadingSkeletonCount = Math.max(0, uploadingCount - pendingReferenceUploads);
    const { user, isTempUser, loading: authLoading } = useAuth();
    const { balance, loading: billingLoading, setShowRechargeModal } = useBilling();
    const remainingBalanceDisplay = billingLoading ? '...' : formatRemainingCredits(balance, 'zh-CN');
    const billingUiEnabled = KKAI_FEATURE_FLAGS.billing;
    const canAccessSystemCreditModels = billingUiEnabled && !!user && !isTempUser;
    const canBrowseSystemCreditModels = billingUiEnabled && (authLoading || canAccessSystemCreditModels);

    // 🚀 [NEW] 模型手动锁定标识 - 解决更换 API 或模式后自动跳第一个的需求
    const [isModelManuallyLocked, setIsModelManuallyLocked] = useState<boolean>(() => {
        try {
            return localStorage.getItem('kk_model_manually_locked') === 'true';
        } catch { return false; }
    });

    // 🚀 [Fix] 监听顶置变化事件，触发 sortedAvailableModels 重新排序
    const [pinnedVersion, setPinnedVersion] = useState(0);
    useEffect(() => {
        const handlePinChange = () => setPinnedVersion(v => v + 1);
        window.addEventListener('model-pinned-change', handlePinChange);
        return () => window.removeEventListener('model-pinned-change', handlePinChange);
    }, []);

    const setModelManualLock = (locked: boolean) => {
        setIsModelManuallyLocked(locked);
        localStorage.setItem('kk_model_manually_locked', locked ? 'true' : 'false');
    };

    // 🚀 [Deleted] enableOptimize state removed to use config.enablePromptOptimization instead

    const hoverTimerRef = useRef<NodeJS.Timeout | null>(null); // 3-second hover delay timer
    const touchStartY = useRef<number | null>(null);
    const modelDropdownRef = useRef<HTMLDivElement>(null); // Model dropdown ref
    const modelListScrollRef = useRef<HTMLDivElement>(null); // Model list scroll container ref
    const modelListScrollPos = useRef<number>(0); // Save scroll position
    const modelMenuRequestRef = useRef(0);
    const previousActiveMenuRef = useRef<string | null>(null);
    const previousModeRef = useRef<GenerationMode>(config.mode);

    const transitionConfigUpdate = useCallback((updater: React.SetStateAction<GenerationConfig>) => {
        startTransition(() => {
            setConfig(updater);
        });
    }, [setConfig]);

    const commitConfigUpdate = useCallback((updater: React.SetStateAction<GenerationConfig>) => {
        setConfig(updater);
    }, [setConfig]);

    const [promptDraft, setPromptDraft] = useState(config.prompt || '');
    const promptDraftRef = useRef(promptDraft);
    const deferredPromptDraft = useDeferredValue(promptDraft);

    useEffect(() => {
        promptDraftRef.current = promptDraft;
    }, [promptDraft]);

    const commitPromptToConfig = useCallback((nextPrompt: string, options?: { immediate?: boolean }) => {
        const normalizedPrompt = nextPrompt ?? '';

        if (options?.immediate) {
            flushSync(() => {
                setConfig(prev => prev.prompt === normalizedPrompt ? prev : { ...prev, prompt: normalizedPrompt });
            });
            return;
        }

        transitionConfigUpdate(prev => prev.prompt === normalizedPrompt ? prev : { ...prev, prompt: normalizedPrompt });
    }, [setConfig, transitionConfigUpdate]);

    useEffect(() => {
        const externalPrompt = config.prompt || '';
        if (externalPrompt === promptDraftRef.current) {
            return;
        }
        promptDraftRef.current = externalPrompt;
        setPromptDraft(externalPrompt);
    }, [config.prompt]);

    useEffect(() => {
        const committedPrompt = config.prompt || '';
        if (isComposingRef.current || deferredPromptDraft === committedPrompt) {
            return;
        }

        const timerId = window.setTimeout(() => {
            commitPromptToConfig(promptDraftRef.current);
        }, PROMPT_CONFIG_SYNC_DELAY_MS);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [commitPromptToConfig, config.prompt, deferredPromptDraft]);

    const flushPromptDraftToConfig = useCallback(() => {
        const nextPrompt = promptDraftRef.current;
        if ((config.prompt || '') !== nextPrompt) {
            commitPromptToConfig(nextPrompt, { immediate: true });
        }
        return nextPrompt;
    }, [commitPromptToConfig, config.prompt]);

    const updateConfigFields = useCallback((patch: Partial<GenerationConfig>) => {
        // These generation controls must commit immediately so a quick "change option -> send"
        // sequence always uses the latest settings (especially parallelCount for multi-image generation).
        setConfig(prev => ({ ...prev, ...patch }));
    }, [setConfig]);

    // [NEW] Click outside to close options panel
    useEffect(() => {
        if (!showOptionsPanel) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Element;
            // Check if click is outside panel AND not on the toggle button itself
            if (optionsPanelRef.current && !optionsPanelRef.current.contains(target)) {
                // Find the toggle button by checking if target is within it or is the button
                const toggleButton = document.querySelector('[data-options-toggle]');
                if (toggleButton && (toggleButton.contains(target) || toggleButton === target)) {
                    // Click was on toggle button, let onClick handle it
                    return;
                }
                setShowOptionsPanel(false);
            }
        };

        // Add a small delay to prevent immediate closing from the toggle click
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 100);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showOptionsPanel]);

    useEffect(() => {
        const closeMenu = () => setContextMenu(null);
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    useEffect(() => {
        const busy = Boolean(
            activeMenu
            || showOptionsPanel
            || contextMenu
            || modelSettingsModal
            || showPptOutlinePanel
        );
        onUiBusyChange?.(busy);
    }, [
        activeMenu,
        contextMenu,
        modelSettingsModal,
        onUiBusyChange,
        showOptionsPanel,
        showPptOutlinePanel,
    ]);

    useEffect(() => {
        return () => {
            onUiBusyChange?.(false);
        };
    }, [onUiBusyChange]);

    const closeModelLibraryMenu = useCallback(() => {
        modelMenuRequestRef.current += 1;
        setIsModelMenuLoading(false);
        setActiveMenu(null);
    }, []);

    useEffect(() => {
        if (previousActiveMenuRef.current === 'model' && activeMenu !== 'model') {
            modelMenuRequestRef.current += 1;
            setIsModelMenuLoading(false);
        }

        previousActiveMenuRef.current = activeMenu;
    }, [activeMenu]);

    // [NEW] Click outside to close model dropdown
    useEffect(() => {
        if (activeMenu !== 'model') return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Element;
            // Check if click is outside dropdown AND not on the model button trigger
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(target)) {
                const triggerButton = document.getElementById('models-dropdown-trigger');
                if (triggerButton && (triggerButton.contains(target) || triggerButton === target)) {
                    // Click was on trigger button, let onClick handle it
                    return;
                }
                closeModelLibraryMenu();
            }
        };

        // Add a small delay to prevent immediate closing from the toggle click
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            // 恢复滚动位置
            if (modelListScrollRef.current && modelListScrollPos.current > 0) {
                modelListScrollRef.current.scrollTop = modelListScrollPos.current;
            }
            const restoredStartIndex = Math.max(
                0,
                Math.floor(modelListScrollPos.current / MODEL_LIST_ITEM_HEIGHT) - MODEL_LIST_OVERSCAN
            );
            setModelListWindowStart(restoredStartIndex);
        }, 100);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activeMenu, closeModelLibraryMenu]);

    useEffect(() => {
        if (config.mode !== GenerationMode.PPT) {
            setShowPptOutlinePanel(false);
            return;
        }
        const slides = (config.pptSlides || []).map(s => String(s || '').trim()).filter(Boolean);
        if (slides.length > 0) {
            setPptOutlineDraft(slides.join('\n'));
            return;
        }
        const fromPrompt = (promptDraft || '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => line.replace(/^[-*\d.)、\s]+/, '').trim())
            .filter(Boolean);
        setPptOutlineDraft(fromPrompt.join('\n'));
    }, [config.mode, config.pptSlides, promptDraft]);

    useEffect(() => {
        if (config.mode !== GenerationMode.PPT) return;
        if ((config.pptSlides || []).length > 0) return;

        const desiredCount = Math.min(20, Math.max(1, Number(config.parallelCount) || 1));
        if (desiredCount <= 1) return;

        const currentDraftSlides = pptOutlineDraft
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .slice(0, 20);
        if (currentDraftSlides.length > 1) return;

        const topic = String(promptDraft || '').trim() || '主题演示';
        const basePool = [
            `背景与问题定义：${topic}`,
            `行业趋势与机会：${topic}`,
            `目标用户与核心场景：${topic}`,
            `解决方案概览：${topic}`,
            `核心能力与差异化：${topic}`,
            `关键数据与证据：${topic}`,
            `典型案例与应用示例：${topic}`,
            `落地路径与实施步骤：${topic}`,
            `风险评估与应对策略：${topic}`,
            `里程碑与路线图：${topic}`,
            `资源需求与协同机制：${topic}`,
            `预期收益与评估指标：${topic}`
        ];
        const nextSlides: string[] = [`封面：${topic}`];
        if (desiredCount >= 3) {
            nextSlides.push(`目录：${topic} 的核心章节`);
        }
        const remainForMiddle = Math.max(0, desiredCount - 1 - nextSlides.length);
        for (let i = 0; i < remainForMiddle; i++) {
            nextSlides.push(basePool[i % basePool.length]);
        }
        if (nextSlides.length < desiredCount) {
            nextSlides.push(`总结与行动建议：${topic}`);
        }
        const nextDraft = nextSlides.join('\n');
        if (nextDraft !== pptOutlineDraft) {
            setPptOutlineDraft(nextDraft);
        }
    }, [config.mode, config.parallelCount, config.pptSlides, pptOutlineDraft, promptDraft]);

    // Cleanup hover timer on unmount
    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current);
            }
        };
    }, []);

    // Swipe Detection


    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
        onInteract?.(); // General interaction
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartY.current === null) return;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;

        // Swipe Up (Negative delta)
        if (deltaY < -20) {
            onInteract?.();
        }
        touchStartY.current = null;
    };

    // Dynamic Model State
    const [globalModels, setGlobalModels] = useState(keyManager.getGlobalModelList());


    useEffect(() => {
        refreshModelLibraryDataInBackground();

        const unsubscribeKeyManager = keyManager.subscribe(() => {
            const newModels = keyManager.getGlobalModelList();
            setGlobalModels(newModels);
        });
        return () => {
            unsubscribeKeyManager();
        };
    }, []);

    // Get available models based on global list and current mode
    const availableModels = useMemo(() => {
        return buildPromptBarAvailableModels(
            globalModels,
            canBrowseSystemCreditModels,
            config.imageSize,
            config.mode,
        );
    }, [globalModels, config.mode, config.imageSize, canBrowseSystemCreditModels]);

    const sortedAvailableModels = useMemo(() => {
        const rawModels = filterAndSortModels(availableModels, '', modelCustomizations);
        if (config.mode !== GenerationMode.ECOMMERCE) {
            return rawModels;
        }
        return rawModels.filter((model) => isEcommerceAllowedModel(model.id));
        // 🚀 [Fix] 加入 pinnedVersion 依赖，确保顶置变化时重新排序
    }, [availableModels, config.mode, modelCustomizations, pinnedVersion]);

    const pinnedModels = useMemo(() => getPinnedModels(), [pinnedVersion]);

    const filteredDisplayModels = useMemo<PromptBarModelOption[]>(() => {
        const rawModels = filterAndSortModels(availableModels, deferredModelSearch, modelCustomizations)
            .filter((model) => config.mode !== GenerationMode.ECOMMERCE || isEcommerceAllowedModel(model.id));
        const uniqueModelMap = new Map<string, ActiveModel>();

        rawModels.forEach((model) => {
            const groupKey = getModelDisplayGroupKey(model);
            const existing = uniqueModelMap.get(groupKey);
            uniqueModelMap.set(groupKey, existing ? pickPreferredDisplayModel(existing, model) : model);
        });

        const uniqueModels = Array.from(uniqueModelMap.values());
        uniqueModels.sort((left, right) => {
            const leftExclusive = !!left.isSystemInternal;
            const rightExclusive = !!right.isSystemInternal;
            if (leftExclusive !== rightExclusive) {
                return leftExclusive ? -1 : 1;
            }

            const leftPinnedIndex = pinnedModels.indexOf(left.id);
            const rightPinnedIndex = pinnedModels.indexOf(right.id);
            if (leftPinnedIndex !== -1 || rightPinnedIndex !== -1) {
                if (leftPinnedIndex === -1) return 1;
                if (rightPinnedIndex === -1) return -1;
                return leftPinnedIndex - rightPinnedIndex;
            }

            return 0;
        });

        return uniqueModels.map((model) => {
            const custom = modelCustomizations[model.id] || {};
            const displayInfo = getModelDisplayInfo(model);
            const providerDisplayName = getCanonicalProviderDisplayName(model.provider);
            const resolvedDescription = getModelDescription(model.id)?.description || custom.description || model.description || getFallbackDescription(model);
            return {
                ...model,
                advantage: custom.description || model.description || getFallbackDescription(model),
                isExclusive: !!model.isSystemInternal,
                isPinned: pinnedModels.includes(model.id),
                displayName: displayInfo.displayName,
                providerDisplayName,
                providerDisplayShortName: providerDisplayName.length > 10 ? providerDisplayName.substring(0, 9) + '…' : providerDisplayName,
                providerBadgeColorClass: getProviderBadgeColor(model.provider),
                providerBadgeStyle: getProviderBadgeStyle(model.provider),
                resolvedDescription,
            };
        });
    }, [availableModels, config.mode, deferredModelSearch, modelCustomizations, pinnedModels]);

    const modelListViewport = useMemo(() => {
        const shouldWindow = filteredDisplayModels.length > MODEL_LIST_VIRTUALIZE_THRESHOLD;
        if (!shouldWindow) {
            return {
                shouldWindow: false,
                items: filteredDisplayModels,
                startIndex: 0,
                totalHeight: filteredDisplayModels.length * MODEL_LIST_ITEM_HEIGHT,
            };
        }

        const baseVisibleCount = isMobile ? 8 : 9;
        const startIndex = Math.max(0, modelListWindowStart);
        const endIndex = Math.min(
            filteredDisplayModels.length,
            startIndex + baseVisibleCount + MODEL_LIST_OVERSCAN * 2
        );

        return {
            shouldWindow: true,
            items: filteredDisplayModels.slice(startIndex, endIndex),
            startIndex,
            totalHeight: filteredDisplayModels.length * MODEL_LIST_ITEM_HEIGHT,
        };
    }, [filteredDisplayModels, isMobile, modelListWindowStart]);

    const getDefaultImageSizeForModel = useCallback((modelId: string): ImageSize => {
        const caps = getModelCapabilities(modelId);
        const supported = caps?.supportedSizes;
        if (!supported || supported.length === 0) return ImageSize.SIZE_1K;
        if (supported.includes(ImageSize.SIZE_1K)) return ImageSize.SIZE_1K;
        return supported[0];
    }, []);

    const getDefaultAspectForModel = useCallback((modelId: string): AspectRatio => {
        if (config.mode === GenerationMode.ECOMMERCE) {
            return AspectRatio.SQUARE;
        }
        const caps = getModelCapabilities(modelId);
        const supported = caps?.supportedRatios;
        if (!supported || supported.length === 0) return AspectRatio.AUTO;
        if (supported.includes(AspectRatio.AUTO)) return AspectRatio.AUTO;
        return supported[0];
    }, [config.mode]);

    // 🚀 [增强版模型自动选择逻辑]
    // 逻辑：1. 如果当前选中的模型已失效（不在当前可用列表中），则必须重新选一个。
    //       2. 如果当前模式发生变化（由 config.mode 触发），且用户并未“手动锁定”模型，则默认跳到第一个（满足“优先顶置”需求）。
    useEffect(() => {
        if (sortedAvailableModels.length === 0) return;

        const currentModelValid = sortedAvailableModels.find(m => m.id === config.model);
        const firstModelId = sortedAvailableModels[0].id;
        const modeChanged = previousModeRef.current !== config.mode;
        previousModeRef.current = config.mode;

        // 仅在以下情况重置为第一个模型：
        // 1. 当前模型完全失效
        // 2. 模式刚发生变化，且用户没有手动锁定选择
        const shouldResetToFirst = !currentModelValid || (modeChanged && !isModelManuallyLocked);
        if (!shouldResetToFirst || config.model === firstModelId) {
            return;
        }

        setConfig(prev => {
            const newModel = firstModelId;
            // 🚀 [Fix] 智能参数保持：获取新模型支持的参数
            const newModelCaps = getModelCapabilities(newModel);
            const supportedSizes = newModelCaps?.supportedSizes?.length ? newModelCaps.supportedSizes : Object.values(ImageSize);
            const supportedRatios = newModelCaps?.supportedRatios?.length ? newModelCaps.supportedRatios : Object.values(AspectRatio);

            // 检查当前参数是否被新模型支持，支持则保持，不支持则回退到默认值
            const newImageSize = supportedSizes.includes(prev.imageSize) ? prev.imageSize : getDefaultImageSizeForModel(newModel);
            const newAspectRatio = supportedRatios.includes(prev.aspectRatio) ? prev.aspectRatio : getDefaultAspectForModel(newModel);

            return { ...prev, model: newModel, imageSize: newImageSize, aspectRatio: newAspectRatio };
        });
    }, [config.mode, config.model, isModelManuallyLocked, sortedAvailableModels, setConfig, getDefaultImageSizeForModel, getDefaultAspectForModel]);

    // Get available ratios and sizes based on model capabilities
    const modelCaps = useMemo(() => {
        return getModelCapabilities(config.model);
    }, [config.model]);

    const availableRatios = useMemo(() => {
        if (config.mode === GenerationMode.ECOMMERCE) {
            const policy = resolveEcommerceAspectPolicy({
                kind: 'main-image',
                modelId: config.model,
            });
            const ratioWhitelist = ecommerceRatioOverride && ecommerceRatioOverride.length > 0
                ? ecommerceRatioOverride
                : policy.allowedAspectRatios;
            const ratioWhitelistSet = new Set<string>(ratioWhitelist.map((ratio) => String(ratio)));
            const supportedRatios = modelCaps?.supportedRatios && modelCaps.supportedRatios.length > 0
                ? modelCaps.supportedRatios
                : Object.values(AspectRatio);
            return supportedRatios.filter((ratio) => ratioWhitelistSet.has(String(ratio)));
        }
        const ratios = modelCaps?.supportedRatios;
        return ratios && ratios.length > 0 ? ratios : Object.values(AspectRatio);
    }, [config.mode, config.model, ecommerceRatioOverride, modelCaps]);

    const availableSizes = useMemo(() => {
        const sizes = modelCaps?.supportedSizes;
        return sizes && sizes.length > 0 ? sizes : Object.values(ImageSize);
    }, [modelCaps]);

    const groundingSupported = useMemo(() => {
        return modelSupportsGrounding(config.model);
    }, [config.model]);

    const thinkingSupported = useMemo(() => {
        return !!modelCaps?.supportsThinking;
    }, [modelCaps]);

    const imageSearchSupported = useMemo(() => {
        return !!modelCaps?.supportsImageSearch;
    }, [modelCaps]);

    // 🚀 [Note] 计费逻辑已移除，内置加速功能不再可用
    const estimatedCredits = 0;

    // Auto-reset grounding if not supported - REMOVED to allow preference persistence
    /*
    useEffect(() => {
        if (config.enableGrounding && !groundingSupported) {
            setConfig(prev => ({ ...prev, enableGrounding: false }));
        }
    }, [groundingSupported, config.enableGrounding, setConfig]);

    useEffect(() => {
        if (!thinkingSupported && config.thinkingMode === 'high') {
            setConfig(prev => ({ ...prev, thinkingMode: 'minimal' }));
        }
        if (!imageSearchSupported && config.enableImageSearch) {
            setConfig(prev => ({ ...prev, enableImageSearch: false }));
        }
    }, [thinkingSupported, imageSearchSupported, config.enableImageSearch, config.thinkingMode, setConfig]);

    useEffect(() => {
        if (thinkingSupported && !config.thinkingMode) {
            setConfig(prev => ({ ...prev, thinkingMode: 'minimal' }));
        }
    }, [thinkingSupported, config.thinkingMode, setConfig]);
    */

    // Auto-adjust ratio/size if current selection not available
    useEffect(() => {
        if (!availableRatios.includes(config.aspectRatio) && availableRatios.length > 0) {
            setConfig(prev => ({ ...prev, aspectRatio: availableRatios[0] }));
        }
    }, [availableRatios, config.aspectRatio, setConfig]);

    useEffect(() => {
        if (!availableSizes.includes(config.imageSize) && availableSizes.length > 0) {
            setConfig(prev => ({ ...prev, imageSize: availableSizes[0] }));
        }
    }, [availableSizes, config.imageSize, setConfig]);

    // NOTE: Legacy functions removed - now using modelCapabilities service

    // 🚀 [ID Healing] 自动迁移旧的内置模型 ID 到新的 @system 命名空间
    useEffect(() => {
        const currentModelId = config.model || '';
        if (!currentModelId || currentModelId.includes('@')) return;

        // 如果当前模型 ID 在列表中找不到，尝试加上 @system 查找
        const existsAsIs = availableModels.some(m => m.id === currentModelId);
        if (!existsAsIs) {
            const systemId = `${currentModelId}@system`;
            const existsWithSystem = availableModels.some(m => m.id === systemId);
            if (existsWithSystem) {
                setConfig(prev => ({ ...prev, model: systemId }));
            }
        }
    }, [availableModels, config.model, setConfig]);

    const resizePromptTextarea = useCallback((target: HTMLTextAreaElement) => {
        target.style.height = 'auto';
        const newHeight = Math.max(
            PROMPT_TEXTAREA_MIN_HEIGHT_PX,
            Math.min(target.scrollHeight, PROMPT_TEXTAREA_MAX_HEIGHT_PX)
        );
        target.style.height = `${newHeight}px`;
    }, []);

    const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const target = e.target;
        promptDraftRef.current = target.value;
        setPromptDraft(target.value);
        resizePromptTextarea(target);
    }, [resizePromptTextarea]);

    useEffect(() => {
        if (textareaRef.current) {
            if (document.activeElement === textareaRef.current) {
                return;
            }
            resizePromptTextarea(textareaRef.current);
        }
    }, [promptDraft, resizePromptTextarea]);

    const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLTextAreaElement>) => {
        const nextValue = e.currentTarget.value;
        isComposingRef.current = false;
        promptDraftRef.current = nextValue;
        setPromptDraft(nextValue);
        resizePromptTextarea(e.currentTarget);
        commitPromptToConfig(nextValue);
    }, [commitPromptToConfig, resizePromptTextarea]);

    const formatReferenceImageError = useCallback((err: unknown, fileName?: string) => {
        const fileLabel = fileName ? `“${fileName}”` : '当前文件';

        if (err instanceof DOMException) {
            if (err.name === 'NotReadableError') {
                return `${fileLabel} 无法读取。通常是因为文件来自临时位置、云盘占位文件，或被其他程序占用。请先保存到本地后再上传，或改用上传按钮/复制粘贴重试。`;
            }

            if (err.name === 'AbortError') {
                return `${fileLabel} 的读取被中断了，请再试一次。`;
            }
        }

        const message = err instanceof Error ? err.message : String(err || '');
        if (message === 'INVALID_IMAGE_DATA_FORMAT') {
            return `${fileLabel} 的图片数据格式无效，请换一张图片试试。`;
        }

        return `${fileLabel} 处理失败${message ? `：${message}` : '。'}`;
    }, []);

    const processFiles = useCallback(async (files: FileList | File[]) => {
        // 🚀 [修复] 根据模型动态获取最大参考图数量
        const modelCaps = getModelCapabilities(config.model);
        const maxRefImages = modelCaps?.maxRefImages ?? 5; // 默认 5 张，Gemini 3 Pro 支持 10 张

        if (config.referenceImages.length >= maxRefImages) {
            notify.warning('参考图数量限制', `最多只能上传 ${maxRefImages} 张参考图`);
            return;
        }

        const remainingSlots = maxRefImages - config.referenceImages.length;
        const fileArray = Array.from(files).filter(f => {
            // 根据当前模式决定接受什么类型的文档
            if (config.mode === GenerationMode.VIDEO) {
                return f.type.startsWith('video/');
            }
            return f.type.startsWith('image/');
        });

        if (fileArray.length > remainingSlots) {
            notify.info('参考图已调整', `最多只能上传 ${maxRefImages} 张参考图，已自动忽略 ${fileArray.length - remainingSlots} 张`);
        }

        const filesToProcess = fileArray.slice(0, remainingSlots);
        if (filesToProcess.length === 0) return;

        const existingStorageIds = new Set(
            config.referenceImages
                .map((img) => img.storageId)
                .filter((value): value is string => Boolean(value))
        );
        let duplicateCount = 0;

        setUploadingCount((prev) => prev + filesToProcess.length);

        try {
            const placeholders = filesToProcess.map((file) => ({
                id: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2),
                mimeType: file.type || 'image/png',
                data: '',
                url: (((file as File & { __kkSourceUrl?: string }).__kkSourceUrl || '').trim() || URL.createObjectURL(file))
            }));

            setConfig(prev => ({
                ...prev,
                referenceImages: [...prev.referenceImages, ...placeholders]
            }));

            const readAsDataUrl = (file: File | PreparedImageFile) =>
                new Promise<string>((resolve, reject) => {
                    const preparedDataUrl = (file as PreparedImageFile).__kkPreparedDataUrl;
                    if (preparedDataUrl && preparedDataUrl.startsWith('data:')) {
                        resolve(preparedDataUrl);
                        return;
                    }

                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = () => reject(reader.error ?? new Error('REFERENCE_IMAGE_READ_FAILED'));
                    reader.onabort = () => reject(reader.error ?? new DOMException('The file read was aborted.', 'AbortError'));
                    reader.readAsDataURL(file);
                });

            await Promise.allSettled(placeholders.map(async (placeholder, index) => {
                let file = filesToProcess[index] as File | PreparedImageFile;
                try {
                    // Downscale image if it is too massive, avoiding memory or size limit issues
                    if (file.type.startsWith('image/')) {
                        file = await compressImageFile(file);
                    }

                    const result = await readAsDataUrl(file);

                    // Robust Data URL parsing without greedy Regex to avoid Maximum Call Stack Size Exceeded
                    const commaIdx = result.indexOf(',');
                    if (commaIdx === -1) {
                        throw new Error('INVALID_IMAGE_DATA_FORMAT');
                    }

                    const header = result.substring(0, commaIdx);
                    const data = result.substring(commaIdx + 1);

                    let mimeType = 'image/png';
                    const mimeMatch = header.match(/^data:([^;]+);base64$/i);
                    if (mimeMatch && mimeMatch[1]) {
                        mimeType = mimeMatch[1];
                    }
                    const storageId = await calculateImageHash(data);
                    const fullDataUrl = `data:${mimeType};base64,${data}`;

                    if (existingStorageIds.has(storageId)) {
                        duplicateCount += 1;
                        if (placeholder.url.startsWith('blob:')) {
                            URL.revokeObjectURL(placeholder.url);
                        }
                        setConfig(prev => ({
                            ...prev,
                            referenceImages: prev.referenceImages.filter((img) => img.id !== placeholder.id)
                        }));
                        return;
                    }

                    existingStorageIds.add(storageId);

                    setConfig(prev => ({
                        ...prev,
                        referenceImages: prev.referenceImages.map((img) =>
                            img.id === placeholder.id
                                ? { ...img, storageId, mimeType, data }
                                : img
                        )
                    }));

                    if (placeholder.url.startsWith('blob:')) {
                        URL.revokeObjectURL(placeholder.url);
                    }

                    saveImage(storageId, fullDataUrl).catch((err) => {
                        console.error('[PromptBar] Failed to save image to IndexedDB:', err);
                    });

                    const handle = fileSystemService.getGlobalHandle();
                    if (handle) {
                        fileSystemService.saveReferenceImage(handle, storageId, data, mimeType).catch((err) =>
                            console.error('[PromptBar] Failed to save reference to file system:', err)
                        );
                    }
                } catch (err) {
                    console.error('[PromptBar] Failed to process reference image:', err);
                    notify.error('参考图处理失败', formatReferenceImageError(err, file.name));
                    if (placeholder.url.startsWith('blob:')) {
                        URL.revokeObjectURL(placeholder.url);
                    }
                    setConfig(prev => ({
                        ...prev,
                        referenceImages: prev.referenceImages.filter((img) => img.id !== placeholder.id)
                    }));
                } finally {
                    setUploadingCount((prev) => Math.max(0, prev - 1));
                }
            }));

            if (duplicateCount > 0) {
                notify.info('已跳过重复参考图', `检测到 ${duplicateCount} 张重复图片，未重复添加。`);
            }
        } finally {
        }
    }, [config.referenceImages, config.model, formatReferenceImageError, setConfig]);

    const toggleMenu = useCallback((menu: string) => {
        setShowOptionsPanel(false); // 关闭Options Panel
        setActiveMenu(prev => prev === menu ? null : menu);
    }, []);

    const handleToggleModelLibrary = useCallback(async () => {
        setShowOptionsPanel(false);

        if (activeMenu === 'model') {
            closeModelLibraryMenu();
            return;
        }

        const requestId = modelMenuRequestRef.current + 1;
        modelMenuRequestRef.current = requestId;
        setActiveMenu('model');
        setIsModelMenuLoading(true);

        try {
            await refreshModelLibraryData({ force: availableModels.length === 0 });
        } catch (error) {
            console.warn('[PromptBar] Model library refresh failed before empty-state open:', error);
        }

        if (modelMenuRequestRef.current !== requestId) {
            return;
        }

        const refreshedGlobalModels = keyManager.getGlobalModelList();
        const refreshedAvailableModels = buildPromptBarAvailableModels(
            refreshedGlobalModels,
            canBrowseSystemCreditModels,
            config.imageSize,
            config.mode,
        );

        setGlobalModels(refreshedGlobalModels);

        if (refreshedAvailableModels.length === 0) {
            setIsModelMenuLoading(false);
            setActiveMenu(null);
            onOpenSettings?.('api-management');
            return;
        }

        setIsModelMenuLoading(false);
    }, [
        activeMenu,
        availableModels.length,
        canBrowseSystemCreditModels,
        closeModelLibraryMenu,
        config.imageSize,
        config.mode,
        onOpenSettings,
    ]);

    const removeReferenceImage = useCallback((id: string) => {
        setConfig(prev => ({
            ...prev,
            referenceImages: prev.referenceImages.filter(img => {
                const shouldKeep = img.id !== id;
                if (!shouldKeep && img.url?.startsWith('blob:')) {
                    URL.revokeObjectURL(img.url);
                }
                return shouldKeep;
            })
        }));
    }, [setConfig]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (isComposingRef.current || (e.nativeEvent as KeyboardEvent).isComposing) {
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            // 始终允许发送新请求，即使正在生成中
            flushPromptDraftToConfig();
            onGenerate(promptDraftRef.current);
        }
    }, [flushPromptDraftToConfig, onGenerate]);

    const primeClipboardImageFiles = useCallback(async (files: File[]) => {
        const preparedFiles = await Promise.all(files.map(async (file) => {
            const preparedFile = file as PreparedImageFile;
            if (preparedFile.__kkPreparedDataUrl?.startsWith('data:')) {
                return preparedFile;
            }

            try {
                const dataUrl = await blobToDataURL(file);
                if (dataUrl.startsWith('data:')) {
                    preparedFile.__kkPreparedDataUrl = dataUrl;
                }
            } catch (error) {
                console.warn('[PromptBar] Failed to snapshot pasted image file:', error);
            }

            return preparedFile;
        }));

        return preparedFiles;
    }, []);

    const readClipboardImagesFromNavigator = useCallback(async () => {
        if (typeof navigator === 'undefined' || !navigator.clipboard?.read) {
            return [] as PreparedImageFile[];
        }

        try {
            const clipboardItems = await navigator.clipboard.read();
            const imageFiles = await Promise.all(clipboardItems.map(async (item, index) => {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (!imageType) {
                    return null;
                }

                try {
                    const blob = await item.getType(imageType);
                    if (!blob || blob.size === 0) {
                        return null;
                    }

                    const ext = (imageType.split('/')[1] || 'png').replace(/[^a-z0-9.+-]/gi, '') || 'png';
                    const file = new File([blob], `clipboard-image-${Date.now()}-${index}.${ext}`, {
                        type: imageType,
                        lastModified: Date.now(),
                    }) as PreparedImageFile;

                    try {
                        const dataUrl = await blobToDataURL(blob);
                        if (dataUrl.startsWith('data:')) {
                            file.__kkPreparedDataUrl = dataUrl;
                        }
                    } catch (error) {
                        console.warn('[PromptBar] Failed to materialize clipboard blob:', error);
                    }

                    return file;
                } catch (error) {
                    console.warn('[PromptBar] Failed to read clipboard image item:', error);
                    return null;
                }
            }));

            return imageFiles.filter((file): file is PreparedImageFile => Boolean(file));
        } catch (error) {
            console.warn('[PromptBar] navigator.clipboard.read failed:', error);
            return [] as PreparedImageFile[];
        }
    }, []);

    const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
        const imageFiles: File[] = [];
        let hasImage = false;
        const plainTextReaders: Array<Promise<string>> = [];

        // 1. Prioritize native files collection (OS copied files)
        if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
            for (let i = 0; i < e.clipboardData.files.length; i++) {
                const file = e.clipboardData.files[i];
                if (file.type.startsWith('image/')) {
                    imageFiles.push(file);
                    hasImage = true;
                }
            }
        }

        const items = e.clipboardData?.items;
        if (items) {
            for (let i = 0; i < items.length; i++) {
                // If we already got the image from .files, avoid duplicates, but items have no direct names usually.
                // However, items[i].getAsFile() returns the same file.
                // We just rely on items for text/plain URL fetching if no native image files were found.
                if (items[i].type.startsWith('image/')) {
                    const file = items[i].getAsFile();
                    if (file && !imageFiles.some(f => f.name === file.name && f.size === file.size)) {
                        imageFiles.push(file);
                        hasImage = true;
                    }
                } else if (!hasImage && items[i].type === 'text/plain') {
                    // Handle Image URL Paste if no image files were directly copied
                    plainTextReaders.push(new Promise((resolve) => {
                        items[i].getAsString((text) => resolve(text));
                    }));
                }
            }
        }

        if (hasImage) {
            e.preventDefault();
            const clipboardFiles = await readClipboardImagesFromNavigator();
            const fallbackFiles = await primeClipboardImageFiles(imageFiles);
            processFiles(clipboardFiles.length > 0 ? clipboardFiles : fallbackFiles);
            return;
        }

        const plainText = (e.clipboardData?.getData('text/plain') || '').trim();
        if (!plainText) {
            const clipboardFiles = await readClipboardImagesFromNavigator();
            if (clipboardFiles.length > 0) {
                e.preventDefault();
                processFiles(clipboardFiles);
                return;
            }
        }

        for (const textPromise of plainTextReaders) {
            const url = (await textPromise).trim();
            if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || url.startsWith('http')) {
                fetch(url)
                    .then(res => {
                        if (!res.ok) throw new Error('Fetch failed');
                        const contentType = res.headers.get('content-type');
                        if (contentType && contentType.startsWith('image/')) {
                            return res.blob();
                        }
                        throw new Error('Not an image');
                    })
                    .then(blob => {
                        const file = new File([blob], "pasted_image.png", { type: blob.type });
                        (file as File & { __kkSourceUrl?: string }).__kkSourceUrl = url;
                        processFiles([file]);
                    })
                    .catch(() => { });
                break;
            }
        }
    }, [primeClipboardImageFiles, processFiles, readClipboardImagesFromNavigator]);

    const dragCounter = useRef(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragSafetyTimer = useRef<NodeJS.Timeout | null>(null);

    // [FIX] 4秒无操作自动复位（防止卡顿）
    const resetDragSafetyTimer = useCallback(() => {
        if (dragSafetyTimer.current) clearTimeout(dragSafetyTimer.current);
        dragSafetyTimer.current = setTimeout(() => {
            console.warn('[PromptBar] Drag timeout - resetting state');
            setIsDragging(false);
            dragCounter.current = 0;
        }, 4000);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (!target.closest('.input-bar-inner')) {
                setActiveMenu(null);
                setShowPptOutlinePanel(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            if (dragSafetyTimer.current) clearTimeout(dragSafetyTimer.current);
        };
    }, []);

    const parsePptSlides = useCallback((text: string) => {
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .slice(0, 20);
    }, []);

    const generatePptOutlineByTopic = useCallback(() => {
        const topic = promptDraft.trim() || '主题演示';
        const total = Math.min(20, Math.max(1, Number(config.parallelCount) || 1));
        const pages = Array.from({ length: total }).map((_, idx) => {
            const pageNo = idx + 1;
            if (pageNo === 1) return `封面：${topic}`;
            if (pageNo === total) return `总结与行动建议：${topic}`;
            return `${topic} - 第${pageNo}页内核内容`;
        });
        setPptOutlineDraft(pages.join('\n'));
    }, [config.parallelCount, promptDraft]);

    const applyPptOutlineDraft = useCallback(() => {
        const slides = parsePptSlides(pptOutlineDraft);
        const nextCount = Math.max(1, Math.min(20, slides.length || Number(config.parallelCount) || 1));
        setConfig(prev => ({
            ...prev,
            pptSlides: slides,
            parallelCount: nextCount
        }));
        notify.success('PPT页纲已应用', `已设置 ${nextCount} 页，生成时将按图1~图${nextCount}输出`);
    }, [config.parallelCount, parsePptSlides, pptOutlineDraft, setConfig]);

    const exportPptOutlineJson = useCallback(() => {
        const slides = parsePptSlides(pptOutlineDraft);
        const payload = {
            topic: promptDraft.trim(),
            pageCount: slides.length,
            pages: slides.map((text, idx) => ({ page: idx + 1, text })),
            exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ppt-outline-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [parsePptSlides, pptOutlineDraft, promptDraft]);

    const movePptSlide = useCallback((index: number, direction: -1 | 1) => {
        const slides = parsePptSlides(pptOutlineDraft);
        const target = index + direction;
        if (target < 0 || target >= slides.length) return;
        const next = [...slides];
        const tmp = next[index];
        next[index] = next[target];
        next[target] = tmp;
        setPptOutlineDraft(next.join('\n'));
    }, [parsePptSlides, pptOutlineDraft]);

    const removePptSlide = useCallback((index: number) => {
        const slides = parsePptSlides(pptOutlineDraft);
        const next = slides.filter((_, i) => i !== index);
        setPptOutlineDraft(next.join('\n'));
    }, [parsePptSlides, pptOutlineDraft]);

    const insertPptSlideAfter = useCallback((index: number) => {
        const slides = parsePptSlides(pptOutlineDraft);
        if (slides.length >= 20) return;
        const next = [...slides];
        next.splice(index + 1, 0, `新页面 ${Math.min(20, index + 2)}`);
        setPptOutlineDraft(next.slice(0, 20).join('\n'));
    }, [parsePptSlides, pptOutlineDraft]);

    const appendPptTemplateSlide = useCallback((template: 'cover' | 'agenda' | 'section' | 'summary') => {
        const slides = parsePptSlides(pptOutlineDraft);
        if (slides.length >= 20) return;
        const topic = promptDraft.trim() || '主题演示';
        const text = template === 'cover'
            ? `封面：${topic}`
            : template === 'agenda'
                ? `目录页：${topic} 内核议题与章节安排`
                : template === 'section'
                    ? `章节过渡页：${topic} - 阶段重点`
                    : `总结页：${topic} 结论与下一步行动`;
        setPptOutlineDraft([...slides, text].join('\n'));
    }, [parsePptSlides, pptOutlineDraft, promptDraft]);

    const dropPptSlide = useCallback(() => {
        if (pptDragIndex === null || pptDropIndex === null) return;
        const slides = parsePptSlides(pptOutlineDraft);
        if (pptDragIndex < 0 || pptDragIndex >= slides.length) return;
        const target = Math.max(0, Math.min(slides.length - 1, pptDropIndex));
        if (target === pptDragIndex) return;
        const next = [...slides];
        const [moved] = next.splice(pptDragIndex, 1);
        next.splice(target, 0, moved);
        setPptOutlineDraft(next.join('\n'));
        setPptDragIndex(null);
        setPptDropIndex(null);
    }, [parsePptSlides, pptDragIndex, pptDropIndex, pptOutlineDraft]);

    useEffect(() => {
        if (config.mode !== GenerationMode.PPT) return;
        const slides = parsePptSlides(pptOutlineDraft);
        const current = (config.pptSlides || []).map(s => String(s || '').trim()).filter(Boolean);
        const draftKey = slides.join('\n');
        const currentKey = current.join('\n');
        if (draftKey === currentKey) return;

        setConfig(prev => ({
            ...prev,
            pptSlides: slides,
            parallelCount: slides.length > 0
                ? Math.max(Math.max(1, prev.parallelCount || 1), Math.min(20, slides.length))
                : Math.max(1, prev.parallelCount || 1)
        }));
    }, [config.mode, config.pptSlides, parsePptSlides, pptOutlineDraft, setConfig]);

    const modeOptions = PROMPT_BAR_MODE_REGISTRY;
    const activeModeOption = getPromptBarModeOption(config.mode);

    const handleSelectPromptBarMode = useCallback((mode: GenerationMode) => {
        commitConfigUpdate((previousConfig) => ({
            ...previousConfig,
            ...getPromptBarModePatch(previousConfig, mode),
        }));
    }, [commitConfigUpdate]);

    const handleTogglePptOutlinePanel = useCallback(() => {
        setShowPptOutlinePanel((previousValue) => !previousValue);
        setActiveMenu(null);
    }, []);

    const handleTogglePromptOptimization = useCallback(() => {
        setConfig((previousConfig) => ({
            ...previousConfig,
            enablePromptOptimization: !previousConfig.enablePromptOptimization,
        }));
    }, [setConfig]);

    // Drag & Drop handlers...
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;

        resetDragSafetyTimer(); // Start/Reset timer

        // [FIX] Ignore internal drags (e.g. reordering reference images)
        if (dragSourceId) return;

        // Check if it's a file drag from OS
        if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
            setIsDragging(true);
        }
    }, [dragSourceId, resetDragSafetyTimer]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        resetDragSafetyTimer(); // Keep alive
    }, [resetDragSafetyTimer]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;

        // Don't clear timer here immediately, allow slight buffer or let Over handle it?
        // Actually if we leave, we might want to kill it if count is 0.
        // But if we leave to a child, Over will fire there (bubbling?).
        // Safest is to rely on the counter logic + the fallback timer.

        if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setIsDragging(false);
            if (dragSafetyTimer.current) clearTimeout(dragSafetyTimer.current);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current = 0;
        setIsDragging(false);
        if (dragSafetyTimer.current) clearTimeout(dragSafetyTimer.current);

        // 1. [NEW] Handle Internal Image Reuse (Optimized) - Prioritize internal ref over files
        const internalRefData = e.dataTransfer.getData('application/x-kk-image-ref');
        if (internalRefData) {
            try {
                const { storageId, mimeType, data } = JSON.parse(internalRefData);
                if (storageId) {
                    // reuse existing storageId!
                    setConfig(prev => {
                        // Prevent duplicates
                        if (prev.referenceImages.some(img => img.storageId === storageId)) return prev;

                        // 🚀 [修复] 根据模型动态获取最大参考图数量
                        const modelCaps = getModelCapabilities(config.model);
                        const maxRefImages = modelCaps?.maxRefImages ?? 5;

                        if (prev.referenceImages.length >= maxRefImages) {
                            notify.warning('参考图数量限制', `最多只能上传 ${maxRefImages} 张参考图`);
                            return prev;
                        }

                        // [FIX] Use passed data if available to avoid loading state
                        let finalData = '';
                        if (data) {
                            if (data.startsWith('data:')) {
                                const matches = data.match(/^data:(.+);base64,(.+)$/);
                                if (matches && matches[2]) {
                                    finalData = matches[2];
                                } else {
                                    finalData = data; // Fallback for other data URIs
                                }
                            } else {
                                // Allow blob: URLs or raw base64 to pass through
                                finalData = data;
                            }
                        }

                        const newRef = {
                            id: Date.now() + Math.random().toString(),
                            storageId,
                            mimeType: mimeType || 'image/png',
                            data: finalData // Use pure data if available, else empty (triggers healing)
                        };

                        // [NEW] If no data but storageId exists, hydrate it!
                        if (!finalData && storageId) {
                            getImage(storageId).then((loadedData) => {
                                if (loadedData) {
                                    setConfig(curr => ({
                                        ...curr,
                                        referenceImages: curr.referenceImages.map(img =>
                                            img.id === newRef.id ? { ...img, data: loadedData } : img
                                        )
                                    }));
                                } else {
                                    // 🚀 [Fix] IndexedDB 中没有数据，尝试从 URL 获取
                                    const url = e.dataTransfer.getData('text/plain');
                                    if (url && (url.startsWith('data:') || url.startsWith('blob:'))) {
                                        fetch(url)
                                            .then(res => res.blob())
                                            .then(blob => {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    const result = reader.result as string;
                                                    const matches = result.match(/^data:(.+);base64,(.+)$/);
                                                    if (matches) {
                                                        const base64Data = matches[2];
                                                        // 保存到 IndexedDB 以便下次恢复
                                                        saveImage(storageId, result).catch(() => { });
                                                        setConfig(curr => ({
                                                            ...curr,
                                                            referenceImages: curr.referenceImages.map(img =>
                                                                img.id === newRef.id ? { ...img, data: base64Data, mimeType: matches[1] } : img
                                                            )
                                                        }));
                                                    }
                                                };
                                                reader.readAsDataURL(blob);
                                            })
                                            .catch(err => console.error('[PromptBar] Failed to fetch image from URL:', err));
                                    }
                                }
                            });
                        }

                        return {
                            ...prev,
                            referenceImages: [...prev.referenceImages, newRef]
                        };
                    });
                    return;
                }
            } catch (err) {
                console.error("Failed to parse internal image ref", err);
            }
        }

        // 2. 处理文档 (External files - only if not internal ref)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
            return;
        }

        // 3. 处理 URL (从图片卡片拖拽 - Fallback or External)
        const url = e.dataTransfer.getData('text/plain');
        if (url) {
            // [OPTIMIZATION] Handle Data URIs directly without fetch
            if (url.startsWith('data:')) {
                const matches = url.match(/^data:(.+);base64,(.+)$/);
                if (matches) {
                    const mimeType = matches[1];
                    const data = matches[2];
                    // Wrap in a fake File object-like structure or just call logic?
                    // Reuse direct logic to avoid File overhead if possible, but processFiles expects File[].
                    // Let's create a File. Fast enough.
                    fetch(url)
                        .then(res => res.blob())
                        .then(blob => {
                            const file = new File([blob], "dropped_image.png", { type: mimeType });
                            processFiles([file]);
                        });
                    return;
                }
            }

            // 检查是否为有效 URL 或 Data URI
            if (url.startsWith('http') || url.startsWith('blob:')) {
                // 获取并转换为 File 对象以复用 processFiles 逻辑
                fetch(url)
                    .then(res => res.blob())
                    .then(blob => {
                        const file = new File([blob], "dropped_image.png", { type: blob.type });
                        if (url.startsWith('http')) {
                            (file as File & { __kkSourceUrl?: string }).__kkSourceUrl = url;
                        }
                        processFiles([file]);
                    })
                    .catch(err => {
                        console.error("处理拖拽 URL 失败:", err);
                    });
            }
        }
    }, [processFiles]);

    const selectedModelMeta = useMemo(() => {
        const currentModel = availableModels.find(m => m.id === config.model) || null;
        const resolvedCurrentSystemDisplay = currentModel?.isSystemInternal
            ? adminModelService.getModelDisplayInfo(currentModel.id, config.imageSize)
            : null;

        return {
            currentModel,
            resolvedCurrentSystemDisplay,
        };
    }, [availableModels, config.imageSize, config.model]);

    const isModelListEmpty = availableModels.length === 0;
    const currentModel = selectedModelMeta.currentModel;

    // 🚀 [Fix] 判断是否为系统积分模型
    const isSystemCreditModel = billingUiEnabled && !!currentModel?.isSystemInternal;
    const currentCreditCost = isModelListEmpty
        ? 0
        : (currentModel?.isSystemInternal
            ? getModelCredits(currentModel?.id || '', config.imageSize)
            : 0);

    // 🚀 [NEW] 计算总成本 (单价 * 数量)
    const totalCreditCost = currentCreditCost * (config.parallelCount || 1);
    const resolvedCurrentSystemDisplay = selectedModelMeta.resolvedCurrentSystemDisplay;
    const currentModelPrimaryColor = normalizeColor(
        resolvedCurrentSystemDisplay?.colorStart || currentModel?.colorStart,
        '#3B82F6'
    );
    const currentModelSecondaryColor = normalizeColor(
        resolvedCurrentSystemDisplay?.colorSecondary
            || resolvedCurrentSystemDisplay?.colorEnd
            || currentModel?.colorSecondary
            || currentModel?.colorEnd,
        '#2563EB'
    );
    const currentModelUsesLightSurface = isLightSeriesTextColor(
        resolvedCurrentSystemDisplay?.textColor || currentModel?.textColor
    );
    const currentModelTextColor = normalizeModelTextColor(
        resolvedCurrentSystemDisplay?.textColor || currentModel?.textColor
    );

    // 统一当前选中模型与下拉列表的展示名称，避免一个显示别名、一个显示原始 ID。
    const modelDisplayInfo = currentModel
        ? (() => {
            const baseDisplayInfo = getModelDisplayInfo(currentModel);
            return {
                ...baseDisplayInfo,
                displayName: resolvedCurrentSystemDisplay?.displayName || baseDisplayInfo.displayName,
                providerName: resolvedCurrentSystemDisplay?.providerName || currentModel?.providerLabel || currentModel?.provider,
                sourceScope: currentModel?.sourceScope,
                sourceLabel: currentModel?.sourceLabel
            };
        })()
        : null;

    // 🚀 [Fix] 模型名称显示：与下拉列表共用同一套 displayName 解析逻辑
    let currentModelName = isModelListEmpty
        ? '无可用模型'
        : (modelDisplayInfo?.displayName || currentModel?.label || getModelDisplayName(currentModel?.id || '') || currentModel?.id || '未选择模型');

    // 隐藏模型名字中括号及括号内的内容，避免名称过长超出输入框
    if (typeof currentModelName === 'string') {
        currentModelName = currentModelName.replace(/\s*[（\(].*?[）\)]\s*/g, '');
    }

    const currentProviderDisplayName = currentModel?.provider
        ? getCanonicalProviderDisplayName(currentModel.provider)
        : '';
    const currentProviderDisplayShortName = currentProviderDisplayName.length > 10
        ? `${currentProviderDisplayName.substring(0, 9)}…`
        : currentProviderDisplayName;

    const truncateText = useCallback((text: string, max: number) => {
        const normalized = String(text || '').replace(/\s+/g, ' ').trim();
        if (normalized.length <= max) return normalized;
        return normalized.slice(0, Math.max(0, max - 1)) + '…';
    }, []);

    const truncateModelLabel = useCallback((label: string, max = 15) => {
        return truncateText(label, max);
    }, [truncateText]);

    const truncateModelDescription = useCallback((description: string, max = 50) => {
        return truncateText(description, max);
    }, [truncateText]);

    const handleSelectPromptBarModel = useCallback((model: PromptBarModelOption) => {
        setModelManualLock(true);
        transitionConfigUpdate(prev => {
            const newModelCaps = getModelCapabilities(model.id);
            const supportedSizes = newModelCaps?.supportedSizes?.length ? newModelCaps.supportedSizes : Object.values(ImageSize);
            const supportedRatios = newModelCaps?.supportedRatios?.length ? newModelCaps.supportedRatios : Object.values(AspectRatio);
            const newImageSize = supportedSizes.includes(prev.imageSize) ? prev.imageSize : getDefaultImageSizeForModel(model.id);
            const newAspectRatio = supportedRatios.includes(prev.aspectRatio) ? prev.aspectRatio : getDefaultAspectForModel(model.id);

            return { ...prev, model: model.id, imageSize: newImageSize, aspectRatio: newAspectRatio };
        });
        setActiveMenu(null);
        setModelSearch('');
        modelListScrollPos.current = 0;
        setModelListWindowStart(0);
    }, [getDefaultAspectForModel, getDefaultImageSizeForModel, transitionConfigUpdate]);

    const handlePromptBarModelContextMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>, model: PromptBarModelOption) => {
        if (model.isExclusive) {
            event.preventDefault();
            return;
        }
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY, modelId: model.id });
    }, []);

    // 桌面端模型按钮保持短名称，避免撑坏底部布局；移动端保留更多信息。
    const displayModelLabel = useMemo(() => {
        return truncateModelLabel(currentModelName, isMobile ? 24 : 15);
    }, [currentModelName, isMobile, truncateModelLabel]);

    // 🚀 [Mobile Layout] Dock to bottom on mobile
    const mobileStyle: React.CSSProperties = isMobile ? (mobileShellMode === 'embedded'
        ? {
            position: 'relative',
            bottom: 'auto',
            left: 'auto',
            transform: 'none',
            width: '100%',
            maxWidth: '100%',
            margin: 0,
            borderRadius: '22px',
            border: '1px solid var(--mobile-glass-border, rgba(255,255,255,0.16))',
            padding: 0,
            WebkitBackdropFilter: 'blur(26px) saturate(170%)',
            backdropFilter: 'blur(26px) saturate(170%)',
            background: 'var(--mobile-glass-bg, rgba(20, 20, 23, 0.84))',
            boxShadow: '0 18px 44px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.15)',
            contain: 'layout style paint',
        }
        : {
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--mobile-tabbar-height, 72px) + var(--mobile-tabbar-floating-offset, 12px) + var(--mobile-prompt-gap, 12px))',
            left: '50%',
            transform: 'translateX(-50%) translateZ(0)',
            width: 'calc(100vw - 20px)',
            maxWidth: 'min(960px, calc(100vw - 20px))',
            margin: 0,
            borderRadius: '22px',
            border: '1px solid var(--mobile-glass-border, rgba(255,255,255,0.16))',
            zIndex: 960,
            padding: 0,
            WebkitBackdropFilter: 'blur(26px) saturate(170%)',
            backdropFilter: 'blur(26px) saturate(170%)',
            background: 'var(--mobile-glass-bg, rgba(20, 20, 23, 0.84))',
            boxShadow: '0 24px 56px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.15)',
            willChange: 'transform',
            contain: 'layout style paint'
        }) : {
        // Desktop floating style handling...
    };
    const mobileFloatingSheetBottom = 'calc(env(safe-area-inset-bottom, 0px) + var(--mobile-tabbar-total-height) + var(--mobile-floating-sheet-clearance))';
    const mobileFloatingSheetMaxHeight = 'min(62vh, calc(100vh - var(--mobile-content-top-inset) - env(safe-area-inset-bottom, 0px) - var(--mobile-tabbar-total-height) - var(--mobile-floating-sheet-clearance) - 18px))';

    // Swipe Detection State
    const wrapperTouchStartY = useRef<number | null>(null);

    const handleContainerTouchStart = (e: React.TouchEvent) => {
        wrapperTouchStartY.current = e.touches[0].clientY;
        handleTouchStart(e); // Keep existing handler
    };

    const handleContainerTouchEnd = (e: React.TouchEvent) => {
        if (wrapperTouchStartY.current !== null) {
            const touchEndY = e.changedTouches[0].clientY;
            const deltaY = touchEndY - wrapperTouchStartY.current;

            // Swipe Up Detection (threshold 30px)
            if (deltaY < -30) {
                onInteract?.(); // Trigger Nav Show
            }
            wrapperTouchStartY.current = null;
        }
        handleTouchEnd(e); // Keep existing handler
    };

    // Desktop floating style handling is used for both now
    // 宽度策略：给底部工具区留出一点安全余量，并允许局部按钮在极限宽度下优雅收缩

    return (
        <>
            <div
                id="prompt-bar-container"
                className={`input-bar ${isMobile ? 'ios-mobile-prompt' : ''} transition-all duration-300 !overflow-visible ${isMobile && mobileShellMode === 'embedded' ? 'w-full max-w-full' : 'w-[calc(100vw-32px)] max-w-[760px]'} ${isDragging ? 'ring-2 ring-white/80 shadow-[0_0_36px_rgba(255,255,255,0.22)]' : ''}`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={isMobile ? mobileStyle : { bottom: '32px' }}
            >
                {/* Drag Overlay */}
                {isDragging && (
                    <div className="absolute inset-0 z-50 rounded-[inherit] border border-white/65 bg-white/55 backdrop-blur-md flex items-center justify-center animate-fadeIn pointer-events-none">
                        <span className="font-bold text-sm text-slate-900 drop-shadow-[0_1px_8px_rgba(255,255,255,0.45)]">释放添加参考图</span>
                    </div>
                )}

                {/* [NEW] Flying Image Animation */}
                {flyingImage && (
                    <div
                        className="fixed z-[9999] w-12 h-12 rounded-lg border-2 border-white shadow-[0_10px_30px_rgba(255,255,255,0.35)] overflow-hidden pointer-events-none transition-all ease-in-out duration-500"
                        style={{
                            left: 0,
                            top: 0,
                            backgroundImage: `url(${flyingImage.url})`,
                            backgroundSize: 'cover',
                            transform: `translate(${flyingImage.targetX}px, ${flyingImage.targetY}px) scale(1)`,
                            animation: `flyToTarget 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
                        }}
                    >
                        <style>{`
@keyframes flyToTarget {
    0% { transform: translate(${flyingImage.x}px, ${flyingImage.y}px) scale(1); opacity: 0.8; }
    50% { opacity: 1; scale: 1.2; }
    100% { transform: translate(${flyingImage.targetX}px, ${flyingImage.targetY}px) scale(1); opacity: 0; }
}
`}</style>
                    </div>
                )}

                <div
                    className="input-bar-inner !overflow-visible"
                    style={{
                        position: 'relative',
                        // Mobile: No capsule wrapper - keep it clean and flat
                    }}
                >

                    {/* Mode Toggle (Floating above on Desktop, or Integrated?)
                     Design choice: Put it inside "Tools" or main bar?
                     Main bar is better for visibility.
                     Let's add a small toggle at the top left of the input bar or left side.
                  */}



                    {/* Active Source Image Banner */}
                    {activeSourceImage && (
                        <div className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-xl border transition-all animate-in slide-in-from-bottom-2 group"
                            style={{
                                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                borderColor: 'rgba(245, 158, 11, 0.2)'
                            }}
                        >
                            <img
                                src={activeSourceImage.url}
                                alt="源图"
                                className="w-10 h-10 object-cover rounded-lg shadow-sm"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-amber-600 dark:text-amber-500">从此图继续创作</div>
                                <div className="text-xs text-[var(--text-tertiary)] truncate">{activeSourceImage.prompt}</div>
                            </div>
                            {!isMobile && (
                            <button
                                onClick={onClearSource}
                                className="
                                    flex items-center justify-center w-7 h-7 rounded-lg
                                    bg-amber-500/10 hover:bg-amber-500/20
                                    text-amber-600 dark:text-amber-500
                                    transition-all duration-200
                                    hover:scale-110 active:scale-95
                                    opacity-80 hover:opacity-100
                                "
                                title="取消继续创作"
                            >
                                <X size={14} />
                            </button>
                            )}
                        </div>
                    )}

                    {/* Top Controls Row: Mode toggle on left, prompt optimizer on right */}
                    <PromptBarTopRow isMobile={isMobile}>
                        <DesktopComposerModeSwitcher
                            isMobile={isMobile}
                            activeMode={activeModeOption.mode}
                            modeOptions={modeOptions}
                            onSelectMode={handleSelectPromptBarMode}
                        />

                        <div className={`relative flex items-center gap-1 ${isMobile ? 'flex-wrap' : ''}`}>
                            <DesktopComposerPromptTools
                                isMobile={isMobile}
                                config={config}
                                showPptOutlinePanel={showPptOutlinePanel}
                                onTogglePptOutlinePanel={handleTogglePptOutlinePanel}
                                onTogglePromptOptimization={handleTogglePromptOptimization}
                            />

                            {showPptOutlinePanel && config.mode === GenerationMode.PPT && (
                                <div className="absolute bottom-full right-0 mb-2 z-40 w-[min(38rem,92vw)] rounded-2xl border shadow-xl p-2" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-medium)' }}>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="text-xs font-semibold text-[var(--text-primary)]">PPT页纲（每行一页）</div>
                                        <div className="text-[10px] text-[var(--text-tertiary)]">{Math.min(20, parsePptSlides(pptOutlineDraft).length)} / 20 页，生成结果按图1~图N命名</div>
                                    </div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <button
                                            className={`px-2 py-1 rounded-md text-[11px] border ${config.pptStyleLocked !== false ? 'border-sky-500/40 bg-sky-500/10 text-sky-300' : 'border-[var(--border-light)] text-[var(--text-secondary)]'}`}
                                            onClick={() => setConfig(prev => ({ ...prev, pptStyleLocked: !(prev.pptStyleLocked !== false) }))}
                                            title="锁定整套PPT视觉风格一致性"
                                        >
                                            风格锁定 {config.pptStyleLocked !== false ? 'ON' : 'OFF'}
                                        </button>
                                        <div className="text-[10px] text-[var(--text-tertiary)]">ON 更偏向整套视觉一致，OFF 允许单页变化</div>
                                    </div>
                                    <div className="flex items-center gap-1 mb-2">
                                        <button className="px-2 py-1 rounded-md text-[10px] border border-[var(--border-light)] text-[var(--text-secondary)] hover:bg-white/5" onClick={() => appendPptTemplateSlide('cover')}>+封面</button>
                                        <button className="px-2 py-1 rounded-md text-[10px] border border-[var(--border-light)] text-[var(--text-secondary)] hover:bg-white/5" onClick={() => appendPptTemplateSlide('agenda')}>+目录</button>
                                        <button className="px-2 py-1 rounded-md text-[10px] border border-[var(--border-light)] text-[var(--text-secondary)] hover:bg-white/5" onClick={() => appendPptTemplateSlide('section')}>+章节</button>
                                        <button className="px-2 py-1 rounded-md text-[10px] border border-[var(--border-light)] text-[var(--text-secondary)] hover:bg-white/5" onClick={() => appendPptTemplateSlide('summary')}>+总结</button>
                                    </div>
                                    <textarea
                                        value={pptOutlineDraft}
                                        onChange={(e) => setPptOutlineDraft(e.target.value)}
                                        className="w-full h-44 rounded-lg border p-2 text-xs outline-none resize-none"
                                        style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
                                        placeholder="示例：\n封面：AI产品季度汇报\n市场洞察\n产品路线图\n关键案例\n总结与下一步"
                                    />
                                    {parsePptSlides(pptOutlineDraft).length > 0 && (
                                        <div className="mt-2 max-h-36 overflow-y-auto space-y-1 pr-1">
                                            {parsePptSlides(pptOutlineDraft).map((line, idx) => (
                                                <div
                                                    key={`${idx}-${line}`}
                                                    className="relative flex items-center gap-1 rounded-md border px-2 py-1"
                                                    style={{
                                                        borderColor: (pptDropIndex === idx && pptDragIndex !== null && pptDragIndex !== idx)
                                                            ? 'rgba(56,189,248,0.45)'
                                                            : 'var(--border-light)',
                                                        backgroundColor: (pptDropIndex === idx && pptDragIndex !== null && pptDragIndex !== idx)
                                                            ? 'rgba(14,165,233,0.12)'
                                                            : 'var(--bg-tertiary)',
                                                        opacity: pptDragIndex === idx ? 0.65 : 1
                                                    }}
                                                    draggable
                                                    onDragStart={() => {
                                                        setPptDragIndex(idx);
                                                        setPptDropIndex(idx);
                                                    }}
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                        setPptDropIndex(idx);
                                                    }}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        setPptDropIndex(idx);
                                                        setTimeout(() => dropPptSlide(), 0);
                                                    }}
                                                    onDragEnd={() => {
                                                        setPptDragIndex(null);
                                                        setPptDropIndex(null);
                                                    }}
                                                >
                                                    {(pptDropIndex === idx && pptDragIndex !== null && pptDragIndex !== idx) && (
                                                        <div className="absolute left-1 right-1 -top-[1px] h-[2px] rounded-full bg-sky-400/80 pointer-events-none" />
                                                    )}
                                                    <span className="text-[10px] w-4 shrink-0 text-[var(--text-tertiary)] cursor-grab">⋮</span>
                                                    <span className="text-[10px] text-sky-400 w-8 shrink-0">图{idx + 1}</span>
                                                    <span className="text-[11px] text-[var(--text-secondary)] truncate flex-1" title={line}>{line}</span>
                                                    <button
                                                        className="text-[10px] px-1 py-0.5 rounded border border-[var(--border-light)]"
                                                        style={{ color: 'var(--text-secondary)' }}
                                                        onClick={() => movePptSlide(idx, -1)}
                                                        title="上移"
                                                    >↑</button>
                                                    <button
                                                        className="text-[10px] px-1 py-0.5 rounded border border-[var(--border-light)]"
                                                        style={{ color: 'var(--text-secondary)' }}
                                                        onClick={() => movePptSlide(idx, 1)}
                                                        title="下移"
                                                    >↓</button>
                                                    <button
                                                        className="text-[10px] px-1 py-0.5 rounded border border-red-500/30"
                                                        style={{ color: '#fca5a5' }}
                                                        onClick={() => removePptSlide(idx)}
                                                        title="删除此页"
                                                    >删</button>
                                                    <button
                                                        className="text-[10px] px-1 py-0.5 rounded border border-sky-500/30"
                                                        style={{ color: '#7dd3fc' }}
                                                        onClick={() => insertPptSlideAfter(idx)}
                                                        title="在后方插入新页"
                                                    >+</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1 mt-2">
                                        <button
                                            className="px-2 py-1 rounded-md text-[11px] border border-[var(--border-light)] hover:bg-white/5"
                                            style={{ color: 'var(--text-secondary)' }}
                                            onClick={generatePptOutlineByTopic}
                                        >
                                            按主题拆页
                                        </button>
                                        <button
                                            className="px-2 py-1 rounded-md text-[11px] border border-[var(--border-light)] hover:bg-white/5"
                                            style={{ color: 'var(--text-secondary)' }}
                                            onClick={exportPptOutlineJson}
                                        >
                                            导出JSON
                                        </button>
                                        <button
                                            className="px-2 py-1 rounded-md text-[11px] border border-[var(--border-light)] hover:bg-white/5"
                                            style={{ color: 'var(--text-secondary)' }}
                                            onClick={() => setPptOutlineDraft('')}
                                        >
                                            清空
                                        </button>
                                        <button
                                            className="ml-auto px-2 py-1 rounded-md text-[11px] border border-sky-400/40 bg-sky-500/10"
                                            style={{ color: '#38bdf8' }}
                                            onClick={applyPptOutlineDraft}
                                        >
                                            应用页纲
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </PromptBarTopRow>

                    {/* Input Area Wrapper with hover detection */}
                    <div
                        onMouseEnter={() => {
                            // Clear existing timer
                            if (hoverTimerRef.current) {
                                clearTimeout(hoverTimerRef.current);
                            }
                            // Set 500ms delay before showing upload button
                            hoverTimerRef.current = setTimeout(() => {
                                setIsInputAreaHovered(true);
                            }, 500);
                        }}
                        onMouseLeave={() => {
                            // Clear timer on leave
                            if (hoverTimerRef.current) {
                                clearTimeout(hoverTimerRef.current);
                                hoverTimerRef.current = null;
                            }
                            // Immediately hide
                            setIsInputAreaHovered(false);
                        }}
                    >
                        {/* Reference Images List */}
                        {config.mode !== GenerationMode.ECOMMERCE && ((config.referenceImages && config.referenceImages.length > 0) || uploadingCount > 0) && (
                            <div
                                ref={refContainerRef}
                                className="flex flex-nowrap items-center gap-2 transition-all p-2 px-3 mt-1 rounded-lg overflow-x-auto overflow-y-hidden scrollbar-thin"
                                style={{
                                    WebkitOverflowScrolling: 'touch',
                                    overscrollBehaviorX: 'contain',
                                    touchAction: 'pan-x'
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';

                                    // Calculate insertion index based on mouse cursor X
                                    if (refContainerRef.current) {
                                        const children = Array.from(refContainerRef.current.children).filter(c => !c.id.includes('spacer'));
                                        let insertIndex = children.length;

                                        for (let i = 0; i < children.length; i++) {
                                            const rect = children[i].getBoundingClientRect();
                                            const centerX = rect.left + rect.width / 2;
                                            if (e.clientX < centerX) {
                                                insertIndex = i;
                                                break;
                                            }
                                        }

                                        // Don't show gap if we are hovering over the source itself or its immediate neighbor in a way that wouldn't change order
                                        if (dragSourceId) {
                                            const sourceIndex = config.referenceImages.findIndex(img => img.id === dragSourceId);
                                            if (insertIndex === sourceIndex || insertIndex === sourceIndex + 1) {
                                                setDropTargetIndex(null);
                                                return;
                                            }
                                        }

                                        setDropTargetIndex(insertIndex);
                                    }
                                }}
                                onDragLeave={(e) => {
                                    // Only clear if we actually left the container, not just entered a child
                                    if (refContainerRef.current && !refContainerRef.current.contains(e.relatedTarget as Node)) {
                                        setDropTargetIndex(null);
                                    }
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDropTargetIndex(null);

                                    // 1. Internal Reorder
                                    if (dragSourceId) {
                                        if (dropTargetIndex !== null) {
                                            setConfig(prev => {
                                                const newImages = [...prev.referenceImages];
                                                const sourceIndex = newImages.findIndex(i => i.id === dragSourceId);
                                                if (sourceIndex === -1) return prev;

                                                const [moved] = newImages.splice(sourceIndex, 1);
                                                // Adjust target index if we removed an item before it
                                                let finalTargetIndex = dropTargetIndex;
                                                if (sourceIndex < finalTargetIndex) {
                                                    finalTargetIndex -= 1;
                                                }

                                                newImages.splice(finalTargetIndex, 0, moved);
                                                return { ...prev, referenceImages: newImages };
                                            });
                                        }
                                        setDragSourceId(null);
                                        return;
                                    }

                                    // 2. Pass to parent (handleDrop) for file processing
                                    // We need to re-fire the drop event on the parent or call logic.
                                    // Since we stopped prop, we must call it manually or refactor.
                                    // Simplest: Call onFilesDrop if provided?
                                    // But existing architecture uses the parent <div> onDrop={handleDrop}.
                                    // If we stopPropagation here, the parent sees it.
                                    // If we DON'T stopPropagation, the parent sees it.
                                    // But we want to handle Internal Reorder here exclusively.

                                    // Solution: Check if it's Files. If so, let it bubble (remove e.stopPropagation()).
                                    // If it's internal dragSourceId, handle and stop.
                                }}
                            >
                                {config.referenceImages.map((img, index) => {
                                    const isSource = dragSourceId === img.id;

                                    // Spacer Logic
                                    const showSpacer = dropTargetIndex === index;

                                    return (
                                        <React.Fragment key={img.id}>
                                            {/* Spacer */}
                                            <div
                                                id="spacer"
                                                className={`transition-all duration-300 ease-[cubic-bezier(0.25, 1, 0.5, 1)] rounded-lg overflow-hidden ${showSpacer ? 'w-12 opacity-100 mr-2' : 'w-0 opacity-0 mr-0'}`}
                                                style={{ height: showSpacer ? '48px' : '0px' }}
                                            >
                                                <div className="w-12 h-12 rounded-lg border-2 border-dashed border-white/60 bg-white/12"></div>
                                            </div>

                                            <div
                                                className={`relative group cursor-move transition-all duration-300 ${isSource ? 'opacity-0 w-0 overflow-hidden m-0 p-0 scale-0' : 'hover:scale-105'} ${!isSource ? 'w-12' : ''}`}
                                                draggable
                                                onDragStart={(e) => {
                                                    e.stopPropagation();
                                                    setDragSourceId(img.id);
                                                    e.dataTransfer.setData('text/plain', img.id);
                                                    e.dataTransfer.effectAllowed = 'move';
                                                }}
                                                onDragEnd={() => {
                                                    setDragSourceId(null);
                                                    setDropTargetIndex(null);
                                                }}
                                            >
                                                <ReferenceThumbnail
                                                    image={img}
                                                    onRecovered={handleReferenceRecovered}
                                                    onClick={handleReferencePreview}
                                                />
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeReferenceImage(img.id);
                                                    }}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform hover:scale-110 z-10"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                </button>
                                            </div>
                                        </React.Fragment>
                                    );
                                })}

                                {/* [NEW] Uploading Skeletons */}
                                {Array.from({ length: uploadingSkeletonCount }).map((_, idx) => (
                                    <div key={`uploading-${idx}`} className="relative w-12 h-12 rounded-lg border-2 border-dashed border-gray-400/30 dark:border-zinc-500/30 flex items-center justify-center bg-gray-100/50 dark:bg-zinc-800/50 overflow-hidden flex-shrink-0 animate-pulse">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-gray-500 dark:text-zinc-400">
                                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                        </svg>
                                    </div>
                                ))}

                                <div
                                    id="spacer"
                                    className={`transition-all duration-300 ease-[cubic-bezier(0.25, 1, 0.5, 1)] rounded-lg overflow-hidden ${dropTargetIndex === config.referenceImages.length ? 'w-12 opacity-100 h-12' : 'w-0 opacity-0 h-0'}`}
                                >
                                    <div className="w-12 h-12 rounded-lg border-2 border-dashed border-white/60 bg-white/12"></div>
                                </div>

                                {/* Upload Button - At the end of reference images row - 始终显示 */}
                                <button
                                    className="w-12 h-12 rounded-md transition-all duration-200 border hover:bg-white/5 flex items-center justify-center flex-shrink-0 opacity-60 hover:opacity-100"
                                    style={{
                                        backgroundColor: 'var(--bg-tertiary)',
                                        color: 'var(--text-secondary)',
                                        borderColor: 'var(--border-light)'
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                    title="上传参考图"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        {/* Upload button when no reference images - 始终显示，与参考图同行对齐 */}
                        {config.mode !== GenerationMode.ECOMMERCE && config.referenceImages.length === 0 && uploadingCount === 0 && (
                            <div className="flex items-center p-2 px-3 mt-1">
                                <button
                                    className="w-12 h-12 rounded-lg transition-all border-2 border-dashed hover:bg-white/5 flex items-center justify-center flex-shrink-0 opacity-40 hover:opacity-80"
                                    style={{
                                        color: 'var(--text-secondary)',
                                        borderColor: 'var(--border-light)'
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                    title="上传参考图"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        <DesktopComposerEcommercePanel
                            config={config}
                            requirementFileName={ecommerceRequirementFileName}
                            productFileCount={ecommerceProductFileCount}
                            extraReferenceCount={ecommerceExtraReferenceCount}
                            ecommerceAnalysis={ecommerceAnalysis}
                            ecommerceSelection={ecommerceSelection}
                            ecommerceAnalyzing={ecommerceAnalyzing}
                            onPickRequirementFile={onPickEcommerceRequirementFile}
                            onPickProductFiles={onPickEcommerceProductFiles}
                            onPickExtraReferenceFiles={onPickEcommerceExtraReferenceFiles}
                            onAnalyzeFile={onAnalyzeEcommerceFile || onGenerate}
                            onResetAnalysis={onResetEcommerceAnalysis}
                            onConfirmAnalysis={onConfirmEcommerceAnalysis}
                            onToggleSelection={onToggleEcommerceSelection}
                        />

                        {/* Text Input Area */}
                        <textarea
                            ref={textareaRef}
                            value={promptDraft}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            onFocus={() => {
                                setActiveMenu(null);
                                onFocus?.(); // 通知侧边栏: 输入框有焦点,不要自动隐藏
                            }}
                            onBlur={() => {
                                flushPromptDraftToConfig();
                                onBlur?.(); // 通知侧边栏: 输入框失去焦点,可以自动隐藏
                            }}
                            onCompositionStart={() => { isComposingRef.current = true; }}
                            onCompositionEnd={handleCompositionEnd}
                            placeholder={config.mode === GenerationMode.VIDEO ? "描述你想要生成的视频..." : config.mode === GenerationMode.AUDIO ? "描述你想要生成的音频风格、歌词或旋律..." : config.mode === GenerationMode.PPT ? "输入PPT主题，将批量生成图1~图N页面..." : config.mode === GenerationMode.ECOMMERCE ? "上传运营需求文件后，在这里补充额外的电商要求..." : "描述你想要生成的图片..."}
                            className="input-bar-textarea w-full max-w-full bg-transparent border-none outline-none text-[15px] resize-none mt-1 py-1 px-3 box-border overflow-y-auto"
                            style={{
                                color: 'var(--text-primary)', // 使用 CSS 变量适配主题
                                minHeight: `${PROMPT_TEXTAREA_MIN_HEIGHT_PX}px`,
                                maxHeight: `${PROMPT_TEXTAREA_MAX_HEIGHT_PX}px`,
                                lineHeight: `${PROMPT_TEXTAREA_LINE_HEIGHT_PX}px`
                            }}
                            rows={PROMPT_TEXTAREA_MIN_ROWS}
                        />
                    </div> {/* End of input area hover wrapper */}

                    {/* Footer - Modified to be a standard flex row, flowing or wrapping lightly on mobile */}
                    <PromptBarFooter isMobile={isMobile}>
                        <div className={`flex min-w-0 items-center ${isMobile ? 'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2' : 'flex-1 gap-1.5'}`}>
                            {/* Model Button */}
                            <div className={`relative inline-flex min-w-0 ${isMobile ? 'col-span-2' : 'flex-shrink-0'}`}>
                                <button
                                    id="models-dropdown-trigger"
                                    className={`input-bar-model flex min-w-0 items-center flex-nowrap gap-1.5 md:gap-2 px-2 md:px-3 h-10 rounded-lg border transition-all duration-300 overflow-hidden ${isMobile ? 'w-full max-w-full justify-center' : 'w-auto max-w-[calc(15ch+6rem)] justify-start flex-shrink-0'} ${isModelListEmpty
                                        ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed border-[var(--border-light)]'
                                        : 'text-[var(--text-secondary)] !opacity-100 hover:border-[var(--prompt-bar-shell-border-strong)]'
                                        }`}
                                    style={(() => {
                                        if (isModelListEmpty) {
                                            return {};
                                        }
                                        if (currentModel?.isSystemInternal && currentModel?.colorStart && currentModel?.colorEnd) {
                                            return getCreditModelSurfaceStyle(
                                                currentModelPrimaryColor,
                                                currentModelSecondaryColor,
                                                currentModel?.textColor,
                                                true,
                                            );
                                        }
                                        return {
                                            background: 'var(--prompt-bar-shell-bg)',
                                            borderColor: 'var(--prompt-bar-shell-border)',
                                        };
                                    })()}
                                    onMouseDown={(e) => e.stopPropagation()} // 🚀 阻止 mousedown 冒泡，防止被 handleClickOutside 误杀
                                    onClick={(e) => {
                                        e.stopPropagation(); // 🚀 阻止冒泡，防止被 handleClickOutside 误杀
                                        void handleToggleModelLibrary();
                                    }}
                                >
                                    {(() => {
                                        const badgeInfo = getModelBadgeInfo({ id: currentModel?.id ?? '', label: currentModelName, provider: currentModel?.provider });
                                        return (
                                            <>
                                                {!isModelListEmpty && currentModel ? (
                                                    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                                                        <ModelLogo
                                                            modelId={currentModel.id}
                                                            provider={currentModel.provider}
                                                            modelName={currentModelName}
                                                            size={isMobile ? 14 : 16}
                                                            active
                                                        />
                                                    </span>
                                                ) : null}
                                                <span
                                                    className={`font-bold truncate flex items-center gap-1 min-w-0 ${isMobile ? 'text-[13px]' : 'max-w-[15ch] text-sm'}`}
                                                    style={{ color: currentModel?.isSystemInternal ? currentModelTextColor : 'var(--text-primary)' }}
                                                    title={currentModelName}
                                                >
                                                    {displayModelLabel}
                                                </span>
                                            </>
                                        );
                                    })()}

                                    {/* 🚀 [Fix] 区分标识：积分模型显示淡蓝色 ✨积分，用户API显示Provider标签 */}
                                    {!isModelListEmpty && !isMobile && (
                                        currentModel?.isSystemInternal ? (
                                            // 积分模型：仅显示 ✨积分，不显示供应商
                                            // 根据模型主题色动态调整积分标签颜色
                                            (() => {
                                                const isDarkText = currentModel?.textColor === 'black';
                                                return (
                                                    <span
                                                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 border ${isDarkText ? 'border-black/15 bg-black/12 text-black' : 'border-white/20 bg-white/14 text-white'}`}
                                                        style={{ marginLeft: '6px' }}
                                                        title="系统积分模型"
                                                    >
                                                        ✨{Math.max(1, currentCreditCost)}
                                                    </span>
                                                );
                                            })()
                                        ) : currentModel?.provider ? (
                                            // 用户API模型：显示Provider标签
                                            <span
                                                className="text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0 border-[var(--prompt-bar-shell-border-strong)] bg-[var(--prompt-bar-shell-hover)] text-[var(--text-secondary)]"
                                                style={{ marginLeft: '6px' }}
                                                title={currentProviderDisplayName}
                                            >
                                                <span className="whitespace-nowrap">{currentProviderDisplayShortName}</span>
                                            </span>
                                        ) : null
                                    )}
                                </button>

                                {/* Dropdown Menu */}
                                {activeMenu === 'model' && (!isModelListEmpty || isModelMenuLoading) && (
                                    <div
                                        ref={modelDropdownRef}
                                        className={isMobile ? 'fixed left-3 right-3 z-[1005] ios-mobile-floating-sheet p-2 animate-scaleIn origin-bottom overflow-hidden' : 'absolute bottom-full mb-3 z-50 animate-scaleIn origin-bottom'}
                                        style={isMobile
                                            ? { bottom: mobileFloatingSheetBottom, maxHeight: mobileFloatingSheetMaxHeight, overscrollBehavior: 'contain' }
                                            : { left: '50%', transform: 'translateX(-50%)' }}
                                    >
                                        {/* 🔍 Search Input Module - Above the list - 只在多个模型时显示 */}
                                        {!isModelMenuLoading && filteredDisplayModels.length > 1 && (
                                            <div className="mb-2 p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-medium)] rounded-2xl shadow-xl animate-scaleIn origin-bottom max-w-[calc(100vw-24px)]" style={{ width: 'min(22rem, calc(100vw - 24px))' }}>
                                                <div className="relative flex items-center">
                                                    <svg className="absolute left-2 w-3.5 h-3.5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                    </svg>
                                                    <input
                                                        type="text"
                                                        value={modelSearch}
                                                        onChange={(e) => setModelSearch(e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        placeholder="搜索模型..."
                                                        className="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs rounded-xl py-1.5 pl-7 pr-2 outline-none border border-transparent focus:border-indigo-500/50 placeholder-[var(--text-tertiary)]"
                                                        autoFocus
                                                    />
                                                    {modelSearch && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setModelSearch(''); }}
                                                            className="absolute right-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div
                                            ref={modelListScrollRef}
                                            className="dropdown static w-[min(22rem,calc(100vw-24px))] max-w-[calc(100vw-24px)] max-h-[50vh] overflow-y-auto scrollbar-thin animate-scaleIn origin-bottom p-4"
                                            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-medium)', boxShadow: 'var(--shadow-xl)', borderRadius: '1rem' }}
                                            onScroll={(e) => {
                                                const nextTop = e.currentTarget.scrollTop;
                                                modelListScrollPos.current = nextTop;
                                                const nextStartIndex = Math.max(
                                                    0,
                                                    Math.floor(nextTop / MODEL_LIST_ITEM_HEIGHT) - MODEL_LIST_OVERSCAN
                                                );
                                                setModelListWindowStart((prev) => prev === nextStartIndex ? prev : nextStartIndex);
                                            }}
                                        >
                                            {isModelMenuLoading ? (
                                                <div className="py-6">
                                                    <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
                                                        <Loader2 size={14} className="animate-spin" />
                                                        <span>正在同步最新模型库...</span>
                                                    </div>
                                                    <div className="mt-4 space-y-2">
                                                        {Array.from({ length: 5 }).map((_, index) => (
                                                            <div
                                                                key={`prompt-bar-model-loading-${index}`}
                                                                className="h-12 rounded-xl bg-white/5 border border-white/5 animate-pulse"
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (() => {
                                                const visibleModels = modelListViewport.items;
                                                const topSpacerHeight = modelListViewport.shouldWindow
                                                    ? modelListViewport.startIndex * MODEL_LIST_ITEM_HEIGHT
                                                    : 0;
                                                const bottomSpacerHeight = modelListViewport.shouldWindow
                                                    ? Math.max(0, modelListViewport.totalHeight - topSpacerHeight - visibleModels.length * MODEL_LIST_ITEM_HEIGHT)
                                                    : 0;

                                                return (
                                                    <>
                                                        {topSpacerHeight > 0 ? <div style={{ height: `${topSpacerHeight}px` }} /> : null}
                                                        {visibleModels.map((model: PromptBarModelOption, index: number) => {
                                                            const isLast = index === visibleModels.length - 1;
                                                            const description = model.isExclusive ? '' : truncateModelDescription(model.resolvedDescription, 50);

                                                            return (
                                                                <PromptBarModelMenuButton
                                                                    key={model.id}
                                                                    model={model}
                                                                    imageSize={config.imageSize}
                                                                    selected={config.model === model.id}
                                                                    isLast={isLast}
                                                                    description={description}
                                                                    onSelect={handleSelectPromptBarModel}
                                                                    onOpenContextMenu={handlePromptBarModelContextMenu}
                                                                />
                                                            );
                                                        })}
                                                        {bottomSpacerHeight > 0 ? <div style={{ height: `${bottomSpacerHeight}px` }} /> : null}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div >
                                )}
                            </div >

                            {/* Options Button - Shows current ratio and size, shrink on mobile */}
                            <DesktopComposerModePanel
                                isMobile={isMobile}
                                config={config}
                                showOptionsPanel={showOptionsPanel}
                                optionsPanelRef={optionsPanelRef}
                                mobileFloatingSheetBottom={mobileFloatingSheetBottom}
                                mobileFloatingSheetMaxHeight={mobileFloatingSheetMaxHeight}
                                onToggleOptionsPanel={() => {
                                    setActiveMenu(null);
                                    setShowOptionsPanel(prev => !prev);
                                }}
                                optionsPanelContent={config.mode === GenerationMode.AUDIO ? (
                                    <div className="w-56 p-3 rounded-xl border shadow-xl animate-scaleIn origin-bottom" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-medium)' }}>
                                        <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">音频时长</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['自动', '30s', '60s', '120s', '240s'].map(dur => (
                                                <button
                                                    key={dur}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${(config.audioDuration || '自动') === dur
                                                        ? 'bg-pink-500/20 text-pink-400 border-pink-500/30'
                                                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-light)] hover:border-pink-500/30'
                                                        }`}
                                                    onClick={() => updateConfigFields({ audioDuration: dur === '自动' ? undefined : dur })}
                                                >
                                                    {dur}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (config.mode === GenerationMode.IMAGE || config.mode === GenerationMode.PPT || config.mode === GenerationMode.ECOMMERCE) ? (
                                    <ImageOptionsPanel
                                        aspectRatio={config.aspectRatio}
                                        imageSize={config.imageSize}
                                        networkOptions={isMobile ? [
                                            ...(groundingSupported ? [{
                                                id: 'grounding',
                                                label: '联网搜索',
                                                active: !!config.enableGrounding,
                                                onToggle: () => updateConfigFields({ enableGrounding: !config.enableGrounding }),
                                            }] : []),
                                            ...(imageSearchSupported ? [{
                                                id: 'image-search',
                                                label: '图片搜索',
                                                active: !!config.enableImageSearch,
                                                onToggle: () => updateConfigFields({ enableImageSearch: !config.enableImageSearch }),
                                            }] : []),
                                        ] : []}
                                        showThinkingMode={thinkingSupported}
                                        thinkingMode={config.thinkingMode || 'minimal'}
                                        onThinkingModeChange={(mode) => updateConfigFields({ thinkingMode: mode })}
                                        onAspectRatioChange={(ratio) => updateConfigFields({ aspectRatio: ratio })}
                                        onImageSizeChange={(size) => updateConfigFields({ imageSize: size })}
                                        availableRatios={availableRatios}
                                        availableSizes={availableSizes}
                                    />
                                ) : (
                                    <VideoOptionsPanel
                                        aspectRatio={config.aspectRatio}
                                        resolution={config.videoResolution || '720p'}
                                        duration={config.videoDuration || '4s'}
                                        audio={config.videoAudio || false}
                                        onAspectRatioChange={(ratio) => updateConfigFields({ aspectRatio: ratio })}
                                        onResolutionChange={(res) => updateConfigFields({ videoResolution: res })}
                                        onDurationChange={(dur) => updateConfigFields({ videoDuration: dur })}
                                        onAudioChange={(audio) => updateConfigFields({ videoAudio: audio })}
                                        availableRatios={availableRatios}
                                        supportsAudio={!!getModelCapabilities(config.model)?.supportsVideoAudio}
                                    />
                                )}
                                networkControls={!isMobile && (groundingSupported || imageSearchSupported) ? (
                                    <div
                                        className="flex min-w-0 max-w-full shrink items-center gap-1 overflow-hidden rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-1 py-0.5 h-10 transition-all duration-200"
                                        style={{
                                            background: 'var(--prompt-bar-shell-bg)',
                                            borderColor: 'var(--prompt-bar-shell-border)',
                                            opacity: (config.mode === GenerationMode.VIDEO || config.mode === GenerationMode.AUDIO) ? 0 : 1,
                                            visibility: (config.mode === GenerationMode.VIDEO || config.mode === GenerationMode.AUDIO) ? 'hidden' : 'visible',
                                            pointerEvents: (config.mode === GenerationMode.VIDEO || config.mode === GenerationMode.AUDIO) ? 'none' : 'auto'
                                        }}
                                    >
                                        {groundingSupported && (
                                            <button
                                                className={`flex min-w-0 max-w-full items-center justify-center gap-1 overflow-hidden px-2 h-full rounded-md transition-all text-[11px] font-medium ${config.enableGrounding
                                                    ? 'bg-[var(--prompt-bar-shell-hover)] text-[var(--text-primary)]'
                                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--prompt-bar-shell-hover)]'
                                                    }`}
                                                onClick={() => updateConfigFields({ enableGrounding: !config.enableGrounding })}
                                                title="Google 搜索 (实时信息)"
                                            >
                                                <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M2 8.8a15 15 0 0 1 20 0" />
                                                    <path d="M5 12.5a10 10 0 0 1 14 0" />
                                                    <path d="M8.5 16.3a5 5 0 0 1 7 0" />
                                                    <line x1="12" y1="20" x2="12.01" y2="20" />
                                                </svg>
                                                <span className="min-w-0 truncate whitespace-nowrap">谷歌搜索</span>
                                            </button>
                                        )}

                                        {groundingSupported && imageSearchSupported && (
                                            <div className="w-[1px] h-4 bg-[var(--border-light)] mx-0.5" />
                                        )}

                                        {imageSearchSupported && (
                                            <button
                                                className={`flex min-w-0 max-w-full items-center justify-center gap-1 overflow-hidden px-2 h-full rounded-md transition-all text-[11px] font-medium ${config.enableImageSearch
                                                    ? 'bg-[var(--prompt-bar-shell-hover)] text-[var(--text-primary)]'
                                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--prompt-bar-shell-hover)]'
                                                    }`}
                                                onClick={() => updateConfigFields({ enableImageSearch: !config.enableImageSearch })}
                                                title="图片搜索 (参考网络图片)"
                                            >
                                                <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                                    <path d="M21 15l-5-5L5 21" />
                                                </svg>
                                                <span className="min-w-0 truncate whitespace-nowrap">图片搜索</span>
                                            </button>
                                        )}
                                    </div>
                                ) : undefined}
                            />

                            {/* Group 2: Generation Settings - Hidden on mobile for compact footer */}
                            {!isMobile && (
                                <div className="ml-auto flex items-center gap-0.5 rounded-lg border p-0.5 h-10 shrink-0" style={{ background: 'var(--prompt-bar-shell-bg)', borderColor: 'var(--prompt-bar-shell-border)', boxShadow: 'var(--prompt-bar-shell-shadow)' }}>
                                    {/* Parallel Count */}
                                    <div className="relative h-full w-[58px]">
                                        <button
                                            className="flex w-full items-center justify-center gap-1.5 px-3 h-full rounded-md transition-all whitespace-nowrap text-[11px] font-medium hover:bg-white/5"
                                            style={{ color: 'var(--text-secondary)' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleMenu('count');
                                            }}
                                            title="并发数量"
                                        >
                                            <span className="text-[11px] font-medium">{config.parallelCount} 张</span>
                                            <svg className={`w-2.5 h-2.5 opacity-50 flex-shrink-0 transition-transform duration-200 ${activeMenu === 'count' ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                                        </button>
                                        {
                                            activeMenu === 'count' && (
                                                <div className="absolute bottom-full mb-2 z-20" style={{ left: '50%', transform: 'translateX(-50%)' }}>
                                                    <div className="dropdown static w-24 animate-scaleIn origin-bottom p-1 flex flex-col gap-1" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-medium)', boxShadow: 'var(--shadow-lg)' }}>
                                                        {(config.mode === GenerationMode.PPT
                                                            ? Array.from({ length: 20 }, (_, i) => i + 1)
                                                            : [1, 2, 3, 4]
                                                        ).map(count => (
                                                            <button key={count} className={`dropdown-item justify-between rounded-md ${config.parallelCount === count ? 'active' : ''}`} onClick={() => { updateConfigFields({ parallelCount: count }); setActiveMenu(null); }}>
                                                                <span>{count} 张</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        }

                                        {/* Context Menu for Pinning */}
                                        {contextMenu && ReactDOM.createPortal(
                                            <div
                                                className="fixed z-[10010] w-32 rounded-[14px] border py-1 backdrop-blur-md"
                                                style={{
                                                    top: contextMenu.y,
                                                    left: contextMenu.x,
                                                    background: 'var(--prompt-bar-shell-bg)',
                                                    borderColor: 'var(--prompt-bar-shell-border)',
                                                    boxShadow: 'var(--shadow-lg)',
                                                }}
                                            >
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleModelPin(contextMenu.modelId);
                                                        setContextMenu(null);
                                                    }}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--prompt-bar-shell-hover)]"
                                                    style={{ color: 'var(--text-primary)' }}
                                                >
                                                    {getPinnedModels().includes(contextMenu.modelId) ? '❌ 取消置顶' : '📌 置顶模型'}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const custom = modelCustomizations[contextMenu.modelId] || {};
                                                        setModelSettingsModal({
                                                            modelId: contextMenu.modelId,
                                                            alias: custom.alias || '',
                                                            description: custom.description || ''
                                                        });
                                                        setContextMenu(null);
                                                    }}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--prompt-bar-shell-hover)]"
                                                    style={{ color: 'var(--text-primary)' }}
                                                >
                                                    ⚙️ 设置
                                                </button>
                                            </div>,
                                            document.body
                                        )}

                                        {/* Model Settings Modal */}
                                        {modelSettingsModal && ReactDOM.createPortal(
                                            <div
                                                className="fixed inset-0 z-[10020] flex items-center justify-center p-4"
                                                style={{
                                                    background: 'color-mix(in srgb, var(--bg-base) 52%, transparent)',
                                                    backdropFilter: 'blur(12px)',
                                                }}
                                                onClick={() => setModelSettingsModal(null)}
                                            >
                                                <div
                                                    className="w-full max-w-md rounded-[20px] border p-5 space-y-4"
                                                    style={{
                                                        background: 'var(--bg-overlay)',
                                                        borderColor: 'var(--prompt-bar-shell-border)',
                                                        boxShadow: 'var(--shadow-xl)',
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>模型设置</h3>
                                                        <button
                                                            onClick={() => setModelSettingsModal(null)}
                                                            className="transition-colors"
                                                            style={{ color: 'var(--text-tertiary)' }}
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                    <div className="text-xs font-mono break-all" style={{ color: 'var(--text-tertiary)' }}>ID: {modelSettingsModal.modelId}</div>
                                                    <div>
                                                        <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>显示别名</label>
                                                        <input
                                                            value={modelSettingsModal.alias}
                                                            onChange={(e) => setModelSettingsModal({ ...modelSettingsModal, alias: e.target.value })}
                                                            placeholder="留空则使用默认名称"
                                                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                                                            style={{
                                                                background: 'var(--bg-input)',
                                                                borderColor: 'var(--prompt-bar-shell-border)',
                                                                color: 'var(--text-primary)',
                                                            }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>模型介绍</label>
                                                        <textarea
                                                            value={modelSettingsModal.description}
                                                            onChange={(e) => setModelSettingsModal({ ...modelSettingsModal, description: e.target.value })}
                                                            placeholder="留空则使用默认介绍"
                                                            rows={2}
                                                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                                                            style={{
                                                                background: 'var(--bg-input)',
                                                                borderColor: 'var(--prompt-bar-shell-border)',
                                                                color: 'var(--text-primary)',
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-end gap-2 pt-2">
                                                        <button
                                                            onClick={() => setModelSettingsModal(null)}
                                                            className="rounded-lg px-4 py-2 text-sm transition-colors hover:bg-[var(--prompt-bar-shell-hover)]"
                                                            style={{ color: 'var(--text-secondary)' }}
                                                        >
                                                            取消
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                // Placeholder function
                                                                setModelSettingsModal(null);
                                                            }}
                                                            className="rounded-lg px-4 py-2 text-sm font-bold"
                                                            style={{
                                                                background: 'var(--settings-button-primary-bg)',
                                                                color: 'var(--text-inverse)',
                                                                boxShadow: 'var(--settings-button-primary-shadow)',
                                                            }}
                                                        >
                                                            保存
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>,
                                            document.body
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={isMobile ? '' : 'ml-2 flex-shrink-0'}>
                            {/* 🚀 发送按钮 - 积分专属样式 */}
                            <CreditSendButton
                                isCreditModel={isSystemCreditModel}
                                creditCost={totalCreditCost}
                                balance={balance}
                                balanceLoading={billingLoading}
                                hasPrompt={!!promptDraft.trim()}
                                colorStart={currentModel?.colorStart}
                                colorEnd={currentModel?.colorEnd}
                                textColor={currentModel?.textColor}
                                onClick={() => {
                                    if (isSystemCreditModel && authLoading) {
                                        notify.info('账号状态确认中', '正在校验登录状态，请稍后再试。');
                                        return;
                                    }
                                    if (isSystemCreditModel && !canAccessSystemCreditModels) {
                                        notify.error('请先登录', '管理员配置的积分模型需要登录账号后使用积分调用。');
                                        return;
                                    }
                                    if (isSystemCreditModel && totalCreditCost > 0 && balance < totalCreditCost) {
                                        notify.error('积分不足', `使用当前配置需要 ${totalCreditCost} 积分，当前余额: ${remainingBalanceDisplay}，请充值。`);
                                        setShowRechargeModal(true);
                                        return;
                                    }
                                    flushPromptDraftToConfig();
                                    onGenerate(promptDraftRef.current);
                                }}
                            />
                        </div>
                    </PromptBarFooter>
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                        if (e.target.files) {
                            processFiles(e.target.files);
                        }
                        // Allow retrying the exact same file after a failed read.
                        e.target.value = '';
                    }}
                />

                {/* 参考图放大浮层 */}
                {
                    previewImage && (
                        <ImagePreview
                            imageUrl={previewImage!.url}
                            originRect={previewImage!.originRect}
                            onClose={() => setPreviewImage(null)}
                        />
                    )
                }

            </div>
        </>
    );
};

export default PromptBar;
