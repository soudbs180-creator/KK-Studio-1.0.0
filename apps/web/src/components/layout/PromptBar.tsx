import React, { startTransition, useDeferredValue, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import ReactDOM, { flushSync } from 'react-dom';
import { KK_LAYER } from '@kk/ui';
import { type GenerationConfig, AspectRatio, ImageSize, GenerationMode, type EcommerceEditableTaskState, type EcommerceGroupSheet, type EcommerceSheetSetting, type EcommerceSheetSettingPatch, type EcommerceTaskAssetRoleBinding, type ReferenceImage } from '../../types';
import { type ActiveModel} from '../../services/model/modelRegistry';
import { keyManager } from '../../services/auth/keyManager'; // Added getter
import { KKAI_FEATURE_FLAGS } from '../../app/kkaiFeatureFlags';
import { getModelCapabilities, modelSupportsGrounding, getModelDisplayInfo, getModelDescription, getModelDisplayName } from '../../services/model/modelCapabilities';
import ModelLogo from '../common/ModelLogo';
import { getModelBadgeInfo, getProviderBadgeColor, getProviderBadgeStyle } from '../../utils/modelBadge';
import { calculateImageHash, compressImageFile, type PreparedImageFile } from '../../utils/imageUtils';
import { saveImage, getImage } from '../../services/storage/imageStorage'; // [NEW] Import getImage
import { blobToDataURL } from '../../services/storage/blobUtils';
import { fileSystemService } from '../../services/storage/fileSystemService'; // 🚀 参考图持久化
import { notify } from '../../services/system/notificationService';
import { traceLocalPerformance } from '../../services/system/localPerformanceTrace';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
const ImageOptionsPanel = lazyWithRetry(() => import('../image/ImageOptionsPanel'));
import MobileEmbeddedAdvancedDrawer from './prompt-bar/MobileEmbeddedAdvancedDrawer';
const VideoOptionsPanel = lazyWithRetry(() => import('../video/VideoOptionsPanel'));
import ImagePreview from '../image/ImagePreview';
import { toggleModelPin, getPinnedModels, filterAndSortModels } from '../../utils/modelSorting';
import { safeRevokeBlobUrl } from '../../utils/blobUtils';
import { X, Loader2, Sparkles, ChevronDown, Plus, Pin } from 'lucide-react'; // [NEW] Mobile Icons & Star & Sparkles
import { useBilling } from '../../context/BillingContext';
import { useAuth } from '../../context/AuthContext';
import { useCanvas } from '../../context/CanvasContext';
import { useLocale } from '../../context/LocaleContext';
import { formatRemainingCredits } from '../../services/billing/remainingBalance';
import { getModelCredits } from '../../services/model/modelPricing';
import { adminModelService } from '../../services/model/adminModelService';
import { refreshModelLibraryData, refreshModelLibraryDataInBackground } from '../../services/model/modelLibraryRefresh';
import PromptBarTopRow from './prompt-bar/PromptBarTopRow';
import PromptBarFooter from './prompt-bar/PromptBarFooter';
import { PROMPT_BAR_MODE_REGISTRY, getPromptBarModeOption } from './prompt-bar/composerModeRegistry';
import { getPromptBarModePatch } from './prompt-bar/composerModeRegistry';
import DesktopComposerModeSwitcher from './prompt-bar/DesktopComposerModeSwitcher';
import DesktopComposerModePanel from './prompt-bar/DesktopComposerModePanel';
import DesktopComposerPromptTools from './prompt-bar/DesktopComposerPromptTools';
const DesktopComposerEcommercePanel = lazyWithRetry(() => import('./prompt-bar/DesktopComposerEcommercePanel'));
import { routeEcommerceDroppedFiles } from './prompt-bar/ecommerceDropRouting';
import { getCanonicalProviderDisplayName } from '../../utils/providerDisplay';
import {
    isEcommerceAllowedModel,
    resolveEcommercePromptBarAspectContext,
    resolvePreferredEcommerceImageSize,
} from '../../services/ecommerce/ecommerceModelPolicy.ts';
import type { EcommerceAnalysisResult } from '../../services/ecommerce/types';
import type { EcommerceGroupSlotState } from '../../services/ecommerce/groupSlotState.ts';
import { useAssetStore } from '../../features/assets/assetStore';
import {
    ReferenceMentionPanel,
    buildReferenceMentionTabs,
    canCandidateAttachToPromptBar,
    computeReferenceMentionAnchor,
    favoriteComposerRegistry,
    useFavoritesStore,
    type MentionReferencePayload,
    type ReferenceMentionAnchor,
    type ReferenceMentionCandidate,
} from '../../features/favorites';
import { PROMPT_COMPOSER_ACTIONS } from '../../features/ai-assistant-runtime';

// [FIX] Imports for PPT Outline generation
import type { PPTOutline, PPTStyleSpec } from '../../utils/pptPrompts';
import {
  generateOutlineSystemPrompt,
  generateOutlineUserPrompt,
  parseOutlineResponse
} from '../../utils/pptPrompts';
import type { RefinementHistoryEntry } from '../../utils/pptOutlineRefiner';
import {
  buildOutlineRefinementPrompt,
  parseRefinedOutline
} from '../../utils/pptOutlineRefiner';

const PROMPT_CONFIG_SYNC_DELAY_MS = 320;
const PROMPT_TEXTAREA_LINE_HEIGHT_PX = 22.5;
const PROMPT_TEXTAREA_MIN_ROWS = 2;
const PROMPT_TEXTAREA_MAX_ROWS = 6;
const PROMPT_TEXTAREA_MIN_HEIGHT_PX = PROMPT_TEXTAREA_LINE_HEIGHT_PX * PROMPT_TEXTAREA_MIN_ROWS;
const PROMPT_TEXTAREA_MAX_HEIGHT_PX = PROMPT_TEXTAREA_LINE_HEIGHT_PX * PROMPT_TEXTAREA_MAX_ROWS;
const MODEL_MENU_SKELETON_COUNT = 3;
const INITIAL_MODEL_LIBRARY_BOOTSTRAP_DELAY_MS = 30000;
const PROMPT_BAR_MOBILE_MODEL_LAYER_SELECTOR = '[data-prompt-bar-mobile-model-layer="true"]';
const PROMPT_BAR_MOBILE_EXTERNAL_LAYER_SELECTOR = '[data-kk-mobile-overlay-layer="true"], [data-prompt-bar-mobile-model-layer="true"]';
const PROMPT_BAR_DEEP_DROPDOWN_LAYER = KK_LAYER.dropdown;
const PROMPT_BAR_DEEP_MODAL_BACKDROP_LAYER = KK_LAYER.modalBackdrop;
const PROMPT_BAR_DEEP_MODAL_PANEL_LAYER = KK_LAYER.modal;
const PROMPT_BAR_DEEP_SHEET_LAYER = KK_LAYER.modal;

type LlmServiceModule = typeof import('../../features/generation/generateService');

const chatWithLlm: LlmServiceModule['generationService']['chat'] = async (...args) => {
    const { generationService: runtimeLlmService } = await import('../../features/generation/generateService');
    return runtimeLlmService.chat(...args);
};

type ModelMenuLoadingState = 'idle' | 'refreshing_with_cache' | 'bootstrapping_without_cache';

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
    const [imageLoadError, setImageLoadError] = useState(false);
    const onRecoveredRef = useRef(onRecovered);

    useEffect(() => {
        onRecoveredRef.current = onRecovered;
    }, [onRecovered]);

    useEffect(() => {
        setImageLoadError(false);
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
        const storageId = image.storageId;
        if (!storageId) {
            return;
        }

        let active = true;
        setLoading(true);
        setError(false);

        traceLocalPerformance('prompt-bar.reference-thumbnail-hydrate', () => getImage(storageId), {
            imageId: image.id,
            storageId,
        })
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

    if (error || imageLoadError) {
        return (
            <div className="w-12 h-12 rounded-lg border border-[var(--border-light)] bg-black/60 flex items-center justify-center" title="图片加载失败">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/80">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            </div>
        );
    }

    if (loading || !data) {
        return (
            <div
                className="w-12 h-12 rounded-lg border border-[var(--frost-input-border)] bg-[var(--frost-input-bg)] overflow-hidden flex items-center justify-center"
                aria-label="reference-thumbnail-skeleton"
            >
                <div className="h-full w-full animate-pulse bg-[var(--frost-card-sub-bg)] flex items-center justify-center">
                    <div className="flex flex-col gap-1.5 opacity-70">
                        <div className="h-1.5 w-6 rounded-full bg-[var(--text-tertiary)] opacity-30" />
                        <div className="h-1.5 w-4 rounded-full bg-[var(--text-tertiary)] opacity-20" />
                    </div>
                </div>
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
            className="w-12 h-12 rounded-lg overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-[color:var(--frost-card-framework-border)]"
            title="点击放大查看"
        >
            <img
                src={src}
                className="w-full h-full object-cover"
                alt="参考图"
                onError={() => setImageLoadError(true)}
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

// 🚀 [优化] 模型库下拉面板的毛玻璃磨砂效果
// 提高模糊半径并进行微弱的不透明背景混合，确保在画布有复杂高对比度图像节点透过来时，依旧保持出色的文字对比度和可读性
const modelLibrarySurfaceStyle: React.CSSProperties = {
    background: 'color-mix(in srgb, var(--frost-card-framework-bg) 72%, transparent)',
    borderColor: 'var(--frost-card-framework-border)',
    boxShadow: 'none',
    WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
    backdropFilter: 'blur(32px) saturate(1.8)',
};

const modelLibrarySearchSurfaceStyle: React.CSSProperties = {
    background: 'color-mix(in srgb, var(--frost-card-framework-bg) 68%, transparent)',
    borderColor: 'var(--frost-card-framework-border)',
    boxShadow: 'none',
    WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
    backdropFilter: 'blur(28px) saturate(1.6)',
};

function getCreditModelFlatStyle(
    colorStart: string,
    colorEnd: string,
    textColor: string | undefined,
    emphasized = false,
): React.CSSProperties {
    const start = normalizeColor(colorStart, 'var(--accent-coral)');
    const end = normalizeColor(colorEnd, 'var(--accent-pink)');
    const usesDarkText = isLightSeriesTextColor(textColor);

    return {
        background: emphasized
            ? `linear-gradient(135deg, color-mix(in srgb, ${start} 26%, var(--frost-card-framework-bg)) 0%, color-mix(in srgb, ${end} 22%, var(--frost-card-framework-bg)) 100%)`
            : `color-mix(in srgb, ${start} 6%, var(--frost-card-sub-bg))`,
        border: `1px solid ${
            emphasized 
                ? '#00d2ff' 
                : `color-mix(in srgb, ${start} 18%, var(--frost-card-sub-border))`
        }`,
        color: usesDarkText ? 'var(--clay-ink)' : undefined,
        boxShadow: emphasized 
            ? '0 0 16px rgba(0, 210, 255, 0.25), inset 0 0 12px rgba(0, 210, 255, 0.45)' 
            : 'none',
        WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
        backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
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
    className?: string;
    ecommerceConfirmedMode?: boolean;
    onClick: () => void;
    isMobile?: boolean;
    parallelCount?: number;
    onChangeParallelCount?: (count: number) => void;
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
    className = '',
    ecommerceConfirmedMode = false,
    onClick,
    isMobile = false,
    parallelCount = 1,
    onChangeParallelCount
}) => {
    // 🚀 移动端长按多张并发与高质感磨砂呼吸 UI 实现
    const sendTouchStartRef = React.useRef<{ x: number; y: number; time: number } | null>(null);
    const [isLongPressing, setIsLongPressing] = React.useState(false);
    const longPressTimerRef = React.useRef<any>(null);
    const bubbleRef = React.useRef<HTMLDivElement | null>(null);

    // 🚀 [添加] Hover与按压交互状态，提供高品质物理按压与悬停发光反馈
    const [isHovered, setIsHovered] = React.useState(false);
    const [isPressed, setIsPressed] = React.useState(false);

    const sendTouchStart = (e: React.TouchEvent) => {
        if (!isMobile || !hasPrompt) return;
        const touch = e.touches[0];
        if (!touch) return;
        sendTouchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        setIsPressed(true);
        
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = setTimeout(() => {
            setIsLongPressing(true);
            try {
                if (navigator.vibrate) {
                    navigator.vibrate(15);
                }
            } catch (err) {
                // 拦截可能在某些旧机型不支持的震动API报错
            }
        }, 250);
    };

    const sendTouchMove = (e: React.TouchEvent) => {
        if (!isMobile || !isLongPressing) return;
        const touch = e.touches[0];
        if (!touch || !bubbleRef.current) return;
        
        const rect = bubbleRef.current.getBoundingClientRect();
        const x = touch.clientX;
        const pct = (x - rect.left) / rect.width;
        const index = Math.min(3, Math.max(0, Math.floor(pct * 4)));
        const newCount = index + 1;
        if (newCount !== parallelCount && onChangeParallelCount) {
            try {
                if (navigator.vibrate) {
                    navigator.vibrate(5);
                }
            } catch (err) {}
            onChangeParallelCount(newCount);
        }
    };

    const sendTouchEnd = (e: React.TouchEvent) => {
        setIsPressed(false);
        if (!isMobile) return;
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        
        if (isLongPressing) {
            e.preventDefault();
            setIsLongPressing(false);
        } else {
            e.preventDefault();
            if (hasPrompt) {
                onClick();
            }
        }
        sendTouchStartRef.current = null;
    };

    const sendTouchCancel = () => {
        setIsPressed(false);
        if (!isMobile) return;
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        setIsLongPressing(false);
        sendTouchStartRef.current = null;
    };

    if (isMobile) {
        const isInsufficient = isCreditModel && !balanceLoading && creditCost > 0 && balance < creditCost;
        const isDisabled = !hasPrompt;
        
        return (
            <div className="relative select-none" style={{ touchAction: 'none' }} onTouchMove={sendTouchMove}>
                {/* 1-4 张数拖拽滑选气泡 */}
                {isLongPressing && (
                    <div 
                        ref={bubbleRef}
                        className="kk-prompt-bar-count-bubble absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-48 h-11 flex items-center justify-around rounded-xl"
                        style={{ zIndex: KK_LAYER.dropdown }}
                    >
                        {[1, 2, 3, 4].map((num) => {
                            const isSelected = parallelCount === num;
                            return (
                                <div 
                                    key={num}
                                    className={`kk-prompt-bar-count-option w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${isSelected ? 'kk-prompt-bar-count-option--active' : 'scale-100'}`}
                                
                                >
                                    {num}
                                </div>
                            );
                        })}
                        {/* 小气泡箭头 */}
                        <div className="kk-prompt-bar-overlay-arrow absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 border-r border-b rotate-45" />
                    </div>
                )}

                {/* 磨砂玻璃呼吸外框按钮 */}
                <button
                    type="button"
                    disabled={isDisabled}
                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.submitGeneration.uiAction}
                    data-agent-tool={PROMPT_COMPOSER_ACTIONS.submitGeneration.toolName}
                    onTouchStart={sendTouchStart}
                    onTouchEnd={sendTouchEnd}
                    onTouchCancel={sendTouchCancel}
                    className={`
                        relative flex items-center justify-center gap-1.5 h-10 px-4 rounded-full overflow-hidden select-none active:scale-[0.95] transition-all duration-300
                        ${isDisabled ? 'bg-[var(--frost-card-sub-bg)] opacity-40 cursor-not-allowed text-[var(--text-tertiary)] border border-[var(--frost-card-sub-border)]' : ''}
                        ${!isDisabled && isInsufficient ? 'bg-red-500/10 border border-red-500/30 text-red-400' : ''}
                        ${!isDisabled && !isInsufficient ? 'backdrop-blur-xl ' + ('bg-white/1' + '2') + ' dark:bg-black/24 border border-white/20 ' + ('dark:border-w' + 'hite/12') + ' ' + ('shadow-l' + 'g') + ' shadow-black/10' : ''}
                    `}
                    style={{
                        WebkitTapHighlightColor: 'transparent',
                    }}
                >
                    {/* 呼吸微渐变发光背景外框 - 仅在未禁用且未欠费时 */}
                    {!isDisabled && !isInsufficient && (
                        <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-[var(--accent-coral)]/30 to-[var(--accent-pink)]/30 blur-sm opacity-60 animate-pulse" />
                    )}

                    {/* 发送按钮的内容 */}
                    {isCreditModel ? (
                        <div className="flex items-center gap-1.5 font-bold">
                            <Sparkles size={13} fill="currentColor" className={isDisabled ? 'text-gray-400' : isInsufficient ? 'text-red-500' : 'text-[var(--accent-coral)]'} />
                            <span className={`text-xs ${isDisabled ? 'text-gray-400' : isInsufficient ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>
                                {isInsufficient ? '积分不足' : `${creditCost} 积分`}
                            </span>
                            {parallelCount > 1 && !isInsufficient && (
                                <span className="text-[10px] text-[var(--text-secondary)] font-normal opacity-90">
                                    ({parallelCount}张)
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className={`text-xs font-bold tracking-wide ${isDisabled ? 'text-gray-400' : 'text-[var(--text-primary)]'}`}>
                            {ecommerceConfirmedMode ? '补充修改' : parallelCount > 1 ? `发送 (${parallelCount}张)` : '发送'}
                        </span>
                    )}

                    {/* 箭头 */}
                    {!isDisabled && (
                        <div className={`
                            flex h-6 w-6 items-center justify-center overflow-hidden rounded-full transition-colors duration-200 ml-0.5
                            ${isInsufficient ? 'bg-red-500 text-white' : 'bg-white/15 text-[var(--text-primary)]'}
                        `}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                            </svg>
                        </div>
                    )}
                </button>
            </div>
        );
    }

    // 判断积分是否不足
    const isInsufficient = isCreditModel && !balanceLoading && creditCost > 0 && balance < creditCost;

    // 计算是否禁用
    const isDisabled = !hasPrompt;

    // 🚀 [积分模型专属] 使用模型主题色的渐变样式 - 更精致的玻璃态效果
    const getGradientStyle = () => {
        if (!isCreditModel || isDisabled) return {};
        const start = normalizeColor(colorStart, 'var(--accent-coral)');
        const end = normalizeColor(colorEnd, 'var(--accent-pink)');
        return {
            background: `linear-gradient(135deg, ${start} 0%, ${end} 100%)`,
            boxShadow: 'none',
        };
    };

    // 🚀 [普通模型/禁用状态] 样式
    const getDefaultStyle = (hovered: boolean) => {
        if (isDisabled) {
            return { className: 'bg-[var(--frost-card-sub-bg)] cursor-not-allowed opacity-45' };
        }
        if (isInsufficient) {
            return { className: 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20' };
        }

        // 如果有自定义颜色，则使用自定义渐变，否则使用默认类
        if (colorStart || colorEnd) {
            const start = normalizeColor(colorStart, 'var(--accent-coral)');
            const end = normalizeColor(colorEnd, 'var(--accent-pink)');
            return {
                className: `${textColor === 'black' ? 'text-black font-semibold' : 'text-white font-semibold'} transition-all border`,
                style: {
                    background: hovered
                        ? `linear-gradient(135deg, color-mix(in srgb, ${start} 84%, rgba(255,255,255,0.28)) 0%, color-mix(in srgb, ${end} 92%, rgba(255,255,255,0.16)) 100%)`
                        : `linear-gradient(135deg, color-mix(in srgb, ${start} 72%, rgba(255,255,255,0.18)) 0%, color-mix(in srgb, ${end} 82%, rgba(255,255,255,0.08)) 100%)`,
                    borderColor: hovered ? 'rgba(255,255,255,0.38)' : 'var(--frost-card-main-border)',
                    boxShadow: hovered ? '0 5px 15px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.22)' : '0 2px 6px rgba(0, 0, 0, 0.18)',
                    backdropFilter: 'blur(var(--frost-card-main-blur)) saturate(1.12)',
                }
            };
        }
        return {
            className: `${textColor === 'black' ? 'text-black font-semibold' : 'text-white font-semibold'} transition-all border`,
            style: {
                background: hovered
                    ? 'linear-gradient(135deg, color-mix(in srgb, var(--accent-coral) 90%, white 10%) 0%, var(--accent-pink) 100%)' // 简体中文注释：移除了不协调的移动端变量，改用平滑的珊瑚橙到粉红渐变，避免断层黑带
                    : 'linear-gradient(135deg, var(--accent-coral) 0%, var(--accent-pink) 100%)',
                borderColor: hovered ? 'rgba(255,255,255,0.35)' : 'var(--frost-card-main-border)',
                boxShadow: hovered ? '0 5px 15px rgba(244, 63, 94, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3)' : '0 2px 6px rgba(0, 0, 0, 0.18)',
                backdropFilter: 'blur(var(--frost-card-main-blur)) saturate(1.12)',
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
        return (
            <>
                <style>{arrowAnimStyle}</style>
                <button
                    type="button"
                    onClick={onClick}
                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.submitGeneration.uiAction}
                    data-agent-tool={PROMPT_COMPOSER_ACTIONS.submitGeneration.toolName}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
                    onMouseDown={() => setIsPressed(true)}
                    onMouseUp={() => setIsPressed(false)}
                    onTouchStart={() => setIsPressed(true)}
                    onTouchEnd={() => setIsPressed(false)}
                    className={`${className} group relative flex h-10 max-w-full min-w-0 shrink items-center gap-2 rounded-full pl-3.5 pr-1 transition-colors duration-200`}
                    style={{
                        ...getGradientStyle(),
                        transform: isPressed ? 'scale(0.96)' : (isHovered ? 'scale(1.04)' : 'scale(1)'),
                        transition: 'transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.24s ease',
                        boxShadow: isHovered ? '0 5px 15px rgba(244, 63, 94, 0.35), inset 0 1px 0 rgba(255,255,255,0.3)' : '0 2px 6px rgba(0,0,0,0.18)',
                    }}
                >
                    {/* 积分消耗显示 */}
                    <div className="flex items-center gap-1" style={{ color: textColor === 'black' ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)' }}>
                        <Sparkles size={14} fill="currentColor" />
                        <span className="text-sm font-bold tabular-nums">{creditCost}</span>
                    </div>

                    {/* 分隔线 */}
                    <div className="w-px h-4" style={{ backgroundColor: textColor === 'black' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)' }} />

                    {/* 发送箭头按钮 - 内嵌圆形按钮 🚀 箭头朝右 + 滑动动画 */}
                    <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full backdrop-blur-sm transition-transform duration-200 group-hover:scale-110"
                         style={{ backgroundColor: textColor === 'black' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.25)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
                             style={{ color: textColor === 'black' ? '#000000' : '#ffffff', animation: 'arrow-slide-right 1.5s ease-in-out infinite' }}>
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                        </svg>
                    </div>

                    {/* 悬停提示 - 精确居中于整个按钮 */}
                    <div className="absolute -top-10 left-0 right-0 flex justify-center pointer-events-none">
                        <div className="kk-prompt-bar-tooltip px-3 py-1.5 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap scale-95 group-hover:scale-100">
                            消耗 {creditCost} 积分生成
                            <div className="kk-prompt-bar-tooltip-arrow absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45" />
                        </div>
                    </div>
                </button>
            </>
        );
    }

    // 🚀 [普通状态/禁用状态] 默认样式 - 用户 API 模型只显示"发送"
    const defaultStyleProps = getDefaultStyle(isHovered) as any;

    return (
        <>
            <style>{arrowAnimStyle}</style>
            <button
                type="button"
                onClick={onClick}
                disabled={isDisabled}
                data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.submitGeneration.uiAction}
                data-agent-tool={PROMPT_COMPOSER_ACTIONS.submitGeneration.toolName}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
                onMouseDown={() => { if (!isDisabled && !isInsufficient) setIsPressed(true); }}
                onMouseUp={() => setIsPressed(false)}
                onTouchStart={() => { if (!isDisabled && !isInsufficient) setIsPressed(true); }}
                onTouchEnd={() => setIsPressed(false)}
                className={`
                    ${className} group relative flex h-10 max-w-full min-w-0 shrink flex-row items-center whitespace-nowrap rounded-full px-1 py-1 overflow-hidden
                    transition-colors duration-200 ease-out focus-visible:outline-none
                    ${!isDisabled && !isInsufficient ? 'focus-visible:ring-2 focus-visible:ring-[color:var(--accent-coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent' : ''}
                    ${defaultStyleProps.className || ''}
                `}
                style={{
                    paddingRight: '4px',
                    transform: !isDisabled && !isInsufficient
                        ? (isPressed ? 'scale(0.96)' : (isHovered ? 'scale(1.04)' : 'scale(1)'))
                        : 'scale(1)',
                    transition: 'transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.24s ease, border-color 0.24s ease, background 0.24s ease',
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
                <div className="kk-prompt-send-button-content relative flex min-w-0 items-center gap-2 px-3">
                    {isCreditModel && creditCost > 0 ? (
                        <div className="flex items-center gap-1.5">
                            <Sparkles size={14} fill="currentColor" className={isDisabled ? 'text-gray-400' : isInsufficient ? 'text-red-500' : textColor === 'black' ? 'text-black' : 'text-white'} />
                            <span className={`text-sm font-bold ${isDisabled ? 'text-gray-400' : isInsufficient ? 'text-red-500' : textColor === 'black' ? 'text-black' : 'text-white'}`}>
                                {isInsufficient ? '积分不足' : creditCost}
                            </span>
                        </div>
                    ) : (
                        <span className={`text-sm font-bold tracking-[0.01em] ${isDisabled ? 'text-gray-400' : isInsufficient ? 'text-red-500' : textColor === 'black' ? 'text-black' : 'text-white'}`}>
                            {ecommerceConfirmedMode ? '补充修改' : '发送'}
                        </span>
                    )}
                </div>

                {/* 发送箭头 🚀 箭头朝右 + 动画 */}
                <div className={`
                    kk-prompt-send-button-icon relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full transition-all duration-200
                    ${isDisabled
                        ? 'bg-black/10 dark:bg-white/[0.04] text-[var(--text-tertiary)] opacity-55'
                        : isInsufficient
                            ? 'bg-red-500 text-white'
                            : `border border-white/15 bg-white/[0.08] dark:bg-black/25 text-[var(--text-primary)] group-hover:bg-white/[0.22] group-hover:scale-110 group-hover:border-white/25`
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
    isChatOpen?: boolean;
    chatSidebarWidth?: number;
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
     ecommerceProductFiles?: File[];
     ecommerceExtraReferenceFiles?: File[];
     ecommerceItemReferenceFiles?: Record<string, Array<{
         assetId: string;
         label: string;
         fileName: string;
         referenceImage: ReferenceImage;
         assetRole: EcommerceTaskAssetRoleBinding;
     }>>;
     ecommerceAnalysis?: EcommerceAnalysisResult | null;
     ecommerceSelection?: Record<string, boolean>;
     ecommerceTaskStates?: Record<string, EcommerceEditableTaskState | undefined>;
     ecommerceGroupSlots?: Record<EcommerceGroupSheet, EcommerceGroupSlotState[]>;
     ecommerceActiveTaskState?: EcommerceEditableTaskState | null;
     ecommerceActiveFrameworkId?: string | null;
     ecommerceFrameworkSummary?: {
         frameworkId: string;
         activeSheet: EcommerceGroupSheet;
         paused: boolean;
         frameworkLabel: string;
         queued: number;
         dispatching: number;
         running: number;
         completed: number;
         failed: number;
         pausedItems: number;
         total: number;
     };
      ecommerceSheetSettings?: Record<EcommerceGroupSheet, EcommerceSheetSetting>;
      ecommerceAnalysisConfirmed?: boolean;
      ecommerceConfirmingAnalysis?: boolean;
     ecommerceActiveGroupSheet?: EcommerceGroupSheet | null;
     ecommerceAnalyzing?: boolean;
    onPickEcommerceRequirementFile?: (files: FileList | File[]) => void;
    onPickEcommerceProductFiles?: (files: FileList | File[]) => void;
    onPickEcommerceExtraReferenceFiles?: (files: FileList | File[]) => void;
    onClearEcommerceRequirementFile?: () => void;
     onRemoveEcommerceProductFile?: (index: number) => void;
     onRemoveEcommerceExtraReferenceFile?: (index: number) => void;
     onPickEcommerceItemReferenceFiles?: (sourceKey: string, files: FileList | File[]) => void;
     onRemoveEcommerceItemReferenceFile?: (sourceKey: string, index: number) => void;
     onResetEcommerceAnalysis?: () => void;
    onConfirmEcommerceAnalysis?: () => void;
    onToggleEcommerceSelection?: (id: string, selected: boolean) => void;
    onActivateEcommerceGroupSheet?: (sheet: EcommerceGroupSheet) => void;
    onActivateEcommerceTaskBySourceKey?: (sourceKey: string) => void;
    onUpdateEcommerceSheetSetting?: (
        sheet: EcommerceGroupSheet,
        patch: EcommerceSheetSettingPatch,
    ) => void;
    onChangeEcommerceTaskState?: (
        taskId: string,
        updater:
            | EcommerceEditableTaskState
            | ((previous: EcommerceEditableTaskState) => EcommerceEditableTaskState),
    ) => void;
    onPreviewEcommerceSlotHistory?: (
        sourceSheet: EcommerceGroupSheet,
        sourceKey: string,
        preferredImageId?: string,
    ) => void;
    ecommerceRatioOverride?: AspectRatio[];
    onAnalyzeEcommerceFile?: () => void;
}

const MODEL_LIST_VIRTUALIZE_THRESHOLD = 40;
const MODEL_LIST_ITEM_HEIGHT = 44;
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
    showProviderRight?: boolean;
    isMobile?: boolean; // [NEW] Mobile adaptive prop
};

const PromptBarModelMenuButton = React.memo(function PromptBarModelMenuButton({
    model,
    imageSize,
    selected,
    isLast,
    description,
    onSelect,
    onOpenContextMenu,
    showProviderRight = false,
    isMobile = false, // [NEW] Default to false
}: PromptBarModelMenuButtonProps) {
    const isExclusive = model.isExclusive;
    const isPinned = model.isPinned;
    const displayName = model.displayName;
    const badgeInfo = getModelBadgeInfo({ id: model.id, label: model.label, provider: model.provider });
    const colorStart = normalizeColor(model.colorStart, 'var(--accent-coral)');
    const colorEnd = normalizeColor(model.colorEnd, 'var(--accent-pink)');
    const modelTextColor = model?.textColor || 'white';
    const textColorClass = modelTextColor === 'black' ? 'text-black' : 'text-white';
    const inactiveGradientStyle = getCreditModelFlatStyle(colorStart, colorEnd, model?.textColor, false);
    const activeGradientStyle = getCreditModelFlatStyle(colorStart, colorEnd, model?.textColor, true);

    return (
        <button
            type="button"
            data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.selectModel.uiAction}
            className={`group w-full transition-all duration-300 mx-auto cursor-pointer
            ${isExclusive
                    ? (isMobile
                        ? `h-10 px-3 flex items-center justify-between rounded-xl flex-shrink-0 ${textColorClass} active:scale-[0.98] ${selected ? '' : 'opacity-80 hover:opacity-100'}`
                        : `h-14 px-5 flex items-center justify-between rounded-full flex-shrink-0 ${textColorClass} active:scale-[0.98] ${selected ? 'scale-[1.02]' : 'hover:scale-[1.02] opacity-80 hover:opacity-100 grayscale-[0.15] hover:grayscale-0'}`)
                    : (isMobile
                        ? `h-10 px-3 text-left flex items-center justify-between rounded-xl transition-all bg-transparent border-transparent`
                        : `px-2.5 py-1.5 text-left flex flex-col gap-0.5 rounded-xl transition-all border border-transparent ${selected ? 'bg-transparent grayscale-0' : 'opacity-80 hover:opacity-100 grayscale-[0.8] hover:grayscale-0'}`)}
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
                                size={isMobile ? 16 : 20}
                                active={selected}
                            />
                        </div>
                        <span className="text-sm font-semibold truncate text-left" style={model?.textColor === 'black' ? { color: '#000000' } : { color: '#ffffff' }}>
                            {displayName}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                        <span
                            className={`${isMobile ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'} rounded-full ${model?.textColor === 'black' ? 'bg-black/10 border-black/20' : 'bg-white/25 border-white/30'} border font-semibold flex items-center gap-1`}
                            style={model?.textColor === 'black' ? { color: '#000000' } : { color: '#ffffff' }}
                        >
                            ✨{getModelCredits(model.id || '', imageSize)}
                        </span>
                    </div>
                </div>
            ) : (
                <div className={`flex items-center justify-between w-full ${isMobile ? 'h-full' : 'h-7'} min-w-0`}>
                    {/* 左侧：Logo + 名字 + 供应商 (如果 showProviderRight 为 false) */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="flex-shrink-0 flex items-center justify-center w-5 h-5">
                            <ModelLogo
                                modelId={model.id}
                                provider={model.provider}
                                modelName={displayName}
                                size={16}
                                active={selected}
                            />
                        </div>
                        <span className={`text-[13px] font-semibold ${badgeInfo.colorClass} truncate text-left`} title={displayName}>
                            {displayName}
                        </span>
                        {!showProviderRight && model.provider && (
                            <span 
                                className={`text-[8.5px] px-1 py-0.5 rounded border flex-shrink-0 whitespace-nowrap overflow-hidden ${model.providerBadgeColorClass} font-medium leading-none`}
                                title={model.providerDisplayName}
                                style={{ maxWidth: '35%', textOverflow: 'ellipsis', ...model.providerBadgeStyle }}
                            >
                                {model.providerDisplayShortName}
                            </span>
                        )}
                    </div>
                    {/* 右侧：常用模型的供应商 (如果 showProviderRight 为 true) + Pinned 图标 */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {showProviderRight && model.provider && (
                            <span
                                className={`text-[9px] px-1 py-0.5 rounded border flex-shrink-0 whitespace-nowrap overflow-hidden ${model.providerBadgeColorClass} font-medium leading-none`}
                                title={model.providerDisplayName}
                                style={{ maxWidth: '70px', textOverflow: 'ellipsis', ...model.providerBadgeStyle }}
                            >
                                {model.providerDisplayShortName}
                            </span>
                        )}
                        {isPinned && !isMobile && <span className="text-[11px] opacity-80">📌</span>}
                    </div>
                </div>
            )}
        </button>
    );
});

interface SwipeableModelItemProps {
    modelId: string;
    isPinned: boolean;
    onTogglePin: (modelId: string) => void;
    children: React.ReactNode;
    onClick: () => void;
    selected?: boolean;
    isExclusive?: boolean;
    isSystemInternal?: boolean;
}

const SwipeableModelItem: React.FC<SwipeableModelItemProps> = ({
    modelId,
    isPinned,
    onTogglePin,
    children,
    onClick,
    selected = false,
    isExclusive = false,
    isSystemInternal = false,
}) => {
    if (isExclusive) {
        return (
            <div className="relative w-full overflow-hidden" onClick={onClick}>
                {children}
            </div>
        );
    }

    let itemClass = 'relative w-full flex items-center rounded-xl border transition-all select-none ';
    let itemStyle: React.CSSProperties = {};

    if (selected) {
        itemClass += 'text-white border-transparent';
        if (isSystemInternal) {
            itemStyle = {
                background: 'linear-gradient(to right, rgba(30, 58, 138, 0.25), rgba(21, 94, 117, 0.15))',
                borderColor: '#00d2ff',
                boxShadow: '0 0 16px rgba(0, 210, 255, 0.35), inset 0 0 12px rgba(0, 210, 255, 0.55)',
            };
        } else {
            itemStyle = {
                background: 'linear-gradient(to right, rgba(14, 116, 144, 0.2), rgba(30, 58, 138, 0.08))',
                borderColor: '#00d2ff',
                boxShadow: '0 0 14px rgba(0, 210, 255, 0.25), inset 0 0 10px rgba(0, 210, 255, 0.45)',
            };
        }
    } else {
        if (isSystemInternal) {
            itemClass += 'border-amber-500/20 bg-amber-500/4 hover:border-amber-500/45 hover:bg-amber-500/8 hover:opacity-100 opacity-90';
        } else {
            itemClass += 'border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] hover:bg-black/5 dark:hover:bg-[var(--toolbar-hover)] hover:opacity-100 opacity-90';
        }
    }

    return (
        <div className={itemClass} style={itemStyle}>
            {/* 模型选择主体 */}
            <div className="flex-1 min-w-0" onClick={onClick}>
                {children}
            </div>
            {/* 常驻右侧置顶图标 */}
            <button
                type="button"
                data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.toggleModelPin.uiAction}
                onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(modelId);
                }}
                className="flex-shrink-0 flex items-center justify-center w-9 h-9 active:scale-90 transition-all cursor-pointer mr-1"
                title={isPinned ? '取消常用' : '设为常用'}
            >
                <Pin 
                    size={14} 
                    className={`transition-colors duration-200 ${isPinned 
                        ? 'text-amber-500 fill-amber-500' 
                        : 'text-neutral-400 dark:text-neutral-500'}`}
                />
            </button>
        </div>
    );
};

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
            textColor: resolvedSystemDisplay?.textColor || m?.textColor,
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
    activeSourceImage,
    onClearSource,
    isMobile = false,
    onOpenSettings,
    onUiBusyChange,
    onFocus,
    onBlur,
    mobileShellMode = 'legacy-fixed',
    ecommerceRequirementFileName,
    ecommerceProductFileCount = 0,
    ecommerceExtraReferenceCount = 0,
    ecommerceProductFiles = [],
    ecommerceExtraReferenceFiles = [],
    ecommerceItemReferenceFiles = {},
    ecommerceAnalysis,
    ecommerceSelection = {},
    ecommerceTaskStates = {},
    ecommerceGroupSlots = { '主图': [], 'A+': [] },
    ecommerceActiveTaskState = null,
    ecommerceActiveFrameworkId = null,
    ecommerceFrameworkSummary,
    ecommerceSheetSettings,
    ecommerceAnalysisConfirmed = false,
    ecommerceConfirmingAnalysis = false,
    ecommerceActiveGroupSheet = null,
    ecommerceAnalyzing = false,
    onPickEcommerceRequirementFile,
    onPickEcommerceProductFiles,
    onPickEcommerceExtraReferenceFiles,
    onClearEcommerceRequirementFile,
    onRemoveEcommerceProductFile,
    onRemoveEcommerceExtraReferenceFile,
    onPickEcommerceItemReferenceFiles,
    onRemoveEcommerceItemReferenceFile,
    onResetEcommerceAnalysis,
    onConfirmEcommerceAnalysis,
    onToggleEcommerceSelection,
    onActivateEcommerceGroupSheet,
    onActivateEcommerceTaskBySourceKey,
    onUpdateEcommerceSheetSetting,
    onChangeEcommerceTaskState,
    onPreviewEcommerceSlotHistory,
    ecommerceRatioOverride,
    onAnalyzeEcommerceFile,
    isChatOpen = false,
    chatSidebarWidth = 420,
}) => {
    const { pick } = useLocale();
    const { activeCanvas } = useCanvas();
    const favoriteItems = useFavoritesStore(state => state.items);
    const assetImages = useAssetStore(state => state.images);
    const assetFiles = useAssetStore(state => state.files);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // Track composition state so IME input is not interrupted by background sync.
    const isComposingRef = useRef(false);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [mobileCategory, setMobileCategory] = useState<string>('featured');
    const [mobileSubView, setMobileSubView] = useState<'input' | 'model' | 'settings'>('input');
    const [isExpanded, setIsExpanded] = useState(false);
    const [mentionState, setMentionState] = useState<{
        open: boolean;
        query: string;
        start: number;
        end: number;
        anchor?: ReferenceMentionAnchor;
    }>({ open: false, query: '', start: 0, end: 0 });

    // 🚀 [防止点击穿透] 展开后的 300ms 内，拦截模型选择按钮的点击事件，彻底根治延迟 click 事件穿透
    const [justExpanded, setJustExpanded] = useState(false);
    useEffect(() => {
        if (isExpanded) {
            setJustExpanded(true);
            const timer = setTimeout(() => setJustExpanded(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isExpanded]);

    const referenceImagesRef = useRef(config.referenceImages);
    useEffect(() => {
        referenceImagesRef.current = config.referenceImages;
    }, [config.referenceImages]);

    useEffect(() => {
        return () => {
            if (referenceImagesRef.current && Array.isArray(referenceImagesRef.current)) {
                referenceImagesRef.current.forEach(img => {
                    if (img.url) {
                        safeRevokeBlobUrl(img.url);
                    }
                });
            }
        };
    }, []);

    // 🚀 [供应商分组模型库] 手机端与电脑端当前选中的供应商 ID (为 null 时显示供应商大组)
    const [desktopActiveProvider, setDesktopActiveProvider] = useState<string | null>(null);
    const [mobileActiveProvider, setMobileActiveProvider] = useState<string | null>(null);
    const [hoveredDragProvider, setHoveredDragProvider] = useState<string | null>(null);
    
    // 供应商排序状态持久化
    const [providerOrder, setProviderOrder] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem('kk_provider_order');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    const updateProviderOrder = useCallback((newOrder: string[]) => {
        setProviderOrder(newOrder);
        try {
            localStorage.setItem('kk_provider_order', JSON.stringify(newOrder));
        } catch (e) {
            console.error('Failed to save provider order:', e);
        }
    }, []);

    // 手机端长按激活排序供应商
    const [activeSortProvider, setActiveSortProvider] = useState<string | null>(null);
    const [mobileDragMode, setMobileDragMode] = useState<boolean>(false);
    const mobileTouchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const justDraggedRef = useRef<boolean>(false);


    // 🚀 [移动端专属] 点击/触摸外部空白处时，自动收起输入面板
    useEffect(() => {
        if (!isMobile || !isExpanded) return;

        const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
            const container = document.getElementById('prompt-bar-container');
            if (!container) return;

            // 1. 若点击在 PromptBar 容器内部，放行
            if (container.contains(e.target as Node)) {
                return;
            }

            // 2. 若点击在移动端模型选择弹窗（Bottom Sheet）或其遮罩层中，放行
            const target = e.target as HTMLElement;
            if (target.closest(PROMPT_BAR_MOBILE_MODEL_LAYER_SELECTOR) || target.closest(PROMPT_BAR_MOBILE_EXTERNAL_LAYER_SELECTOR)) {
                return;
            }

            // 3. 若点击在裁剪、大图预览、电商续作历史等悬浮面板里，放行
            // 4. 收起面板，且使输入框失去焦点（防键盘弹起）
            setIsExpanded(false);
            textareaRef.current?.blur();
        };

        // 使用 capture 阶段在最外层尽早拦截
        document.addEventListener('click', handleOutsideClick, true);
        document.addEventListener('touchstart', handleOutsideClick, true);
        return () => {
            document.removeEventListener('click', handleOutsideClick, true);
            document.removeEventListener('touchstart', handleOutsideClick, true);
        };
    }, [isMobile, isExpanded, textareaRef]);

    // 🚀 [移动端专属] 当选择或更换了继续创作的源图时，自动展开输入面板
    useEffect(() => {
        if (isMobile && activeSourceImage) {
            setIsExpanded(true);
        }
    }, [isMobile, activeSourceImage]);

    // 🚀 [移动端专属] 面板收起时，重置子视图为 input 视图，确保下次展开时默认不打开模型库
    useEffect(() => {
        if (isMobile && !isExpanded) {
            setMobileSubView('input');
            setMobileActiveProvider(null);
            setActiveSortProvider(null);
        }
    }, [isMobile, isExpanded]);

    // 🚀 [电脑端专属] 当模型库下拉菜单关闭时，重置当前选中的供应商
    useEffect(() => {
        if (activeMenu !== 'model') {
            setDesktopActiveProvider(null);
        }
    }, [activeMenu]);



    const [modelMenuLoadingState, setModelMenuLoadingState] = useState<ModelMenuLoadingState>('idle');
    const [modelSearch, setModelSearch] = useState('');
    const deferredModelSearch = useDeferredValue(modelSearch);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, modelId: string } | null>(null);
    const [modelListWindowStart, setModelListWindowStart] = useState(0);
    const [mobileScrollTop, setMobileScrollTop] = useState(0);

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
    const [globalStyleSpec, setGlobalStyleSpec] = useState<any>(null);
    const [refineQuery, setRefineQuery] = useState('');
    const [isRefining, setIsRefining] = useState(false);
    const [refinementHistory, setRefinementHistory] = useState<RefinementHistoryEntry[]>([]);
    const pptOutlineImportInputRef = useRef<HTMLInputElement | null>(null);
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
    const canBrowseSystemCreditModels = billingUiEnabled;

    // Dynamic Model State
    const [globalModels, setGlobalModels] = useState(keyManager.getGlobalModelList());

    // Get available models based on global list and current mode
    const availableModels = useMemo(() => {
        return buildPromptBarAvailableModels(
            globalModels,
            canBrowseSystemCreditModels,
            config.imageSize,
            config.mode,
        );
    }, [globalModels, config.mode, config.imageSize, canBrowseSystemCreditModels]);

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

    useEffect(() => {
        let active = true;

        if (!canBrowseSystemCreditModels || availableModels.length > 0) {
            return;
        }

        setModelMenuLoadingState('bootstrapping_without_cache');

        const bootstrapTimer = window.setTimeout(() => {
            void (async () => {
            try {
                await refreshModelLibraryData({ force: false });
                if (!active) {
                    return;
                }

                setGlobalModels(keyManager.getGlobalModelList());
            } catch (error) {
                console.warn('[PromptBar] Initial model library bootstrap failed:', error);
            } finally {
                if (!active) {
                    return;
                }

                setModelMenuLoadingState((current) => (
                    current === 'bootstrapping_without_cache' ? 'idle' : current
                ));
            }
            })();
        }, INITIAL_MODEL_LIBRARY_BOOTSTRAP_DELAY_MS);

        return () => {
            active = false;
            window.clearTimeout(bootstrapTimer);
        };
    }, [availableModels.length, canBrowseSystemCreditModels]);

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

    const modelDropdownRef = useRef<HTMLDivElement>(null); // Model dropdown ref
    const modelMenuAnchorRef = useRef<HTMLDivElement>(null);
    const modelListScrollRef = useRef<HTMLDivElement>(null); // Model list scroll container ref
    const modelListScrollPos = useRef<number>(0); // Save scroll position
    const modelMenuRequestRef = useRef(0);
    const previousActiveMenuRef = useRef<string | null>(null);
    const previousModeRef = useRef<GenerationMode>(config.mode);
    const modelMenuHasScrolledRef = useRef(false);

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
        setModelMenuLoadingState('idle');
        setActiveMenu(null);
    }, []);

    useEffect(() => {
        if (previousActiveMenuRef.current === 'model' && activeMenu !== 'model') {
            modelMenuRequestRef.current += 1;
            setModelMenuLoadingState('idle');
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
                if (modelMenuAnchorRef.current?.contains(target)) {
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

    // 🚀 [系统积分模型]
    const systemExclusiveModels = useMemo(() => {
        return filteredDisplayModels.filter(m => m.isExclusive);
    }, [filteredDisplayModels]);

    // 🚀 [普通第三方模型]
    const normalModels = useMemo(() => {
        return filteredDisplayModels.filter(m => !m.isExclusive);
    }, [filteredDisplayModels]);

    // 🚀 [供应商打组并根据 providerOrder 排序]
    const normalGroups = useMemo(() => {
        const groupsMap = new Map<string, { provider: string, providerDisplayName: string, models: PromptBarModelOption[] }>();
        normalModels.forEach(m => {
            const providerKey = m.provider || 'others';
            if (!groupsMap.has(providerKey)) {
                groupsMap.set(providerKey, {
                    provider: providerKey,
                    providerDisplayName: m.providerDisplayName || providerKey,
                    models: []
                });
            }
            groupsMap.get(providerKey)!.models.push(m);
        });
        
        const groups = Array.from(groupsMap.values());
        
        // 按照用户拖动后的 providerOrder 进行排序
        groups.sort((a, b) => {
            const idxA = providerOrder.indexOf(a.provider);
            const idxB = providerOrder.indexOf(b.provider);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.providerDisplayName.localeCompare(b.providerDisplayName);
        });
        
        return groups;
    }, [normalModels, providerOrder]);

    // 🚀 [判定是否只有一个供应商]
    const hasOnlyOneProvider = useMemo(() => normalGroups.length <= 1, [normalGroups]);

    // 🚀 [电脑端 HTML5 拖拽排序逻辑]
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const handleProviderDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleProviderDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;
        
        const nextOrder = [...normalGroups.map(g => g.provider)];
        const draggedProvider = nextOrder[draggedIndex];
        
        const updatedOrder = [...providerOrder];
        const currentProviders = normalGroups.map(g => g.provider);
        const fullOrder = Array.from(new Set([...updatedOrder, ...currentProviders]));
        
        const fromIdx = fullOrder.indexOf(draggedProvider);
        const toProvider = currentProviders[index];
        const toIdx = fullOrder.indexOf(toProvider);
        
        if (fromIdx !== -1 && toIdx !== -1) {
            const item = fullOrder[fromIdx];
            fullOrder.splice(fromIdx, 1);
            fullOrder.splice(toIdx, 0, item);
            updateProviderOrder(fullOrder);
            setDraggedIndex(toIdx);
        }
    };

    const handleProviderDragEnd = () => {
        setDraggedIndex(null);
    };



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

    const ecommerceAspectContext = useMemo(() => resolveEcommercePromptBarAspectContext({
        activeTask: ecommerceActiveTaskState
            ? {
                sourceSheet: ecommerceActiveTaskState.sourceSheet,
                sizeTier: ecommerceActiveTaskState.sizeTier,
                sizeControlOverride: ecommerceActiveTaskState.sizeControlOverride ?? null,
            }
            : null,
        activeSheet: ecommerceActiveGroupSheet,
        sheetSettings: ecommerceSheetSettings,
        ratioOverride: ecommerceRatioOverride,
    }), [ecommerceActiveGroupSheet, ecommerceActiveTaskState, ecommerceRatioOverride, ecommerceSheetSettings]);

    const getDefaultImageSizeForModel = useCallback((modelId: string): ImageSize => {
        if (config.mode === GenerationMode.ECOMMERCE) {
            return resolvePreferredEcommerceImageSize(modelId) as ImageSize;
        }
        const caps = getModelCapabilities(modelId);
        const supported = caps?.supportedSizes;
        if (!supported || supported.length === 0) return ImageSize.SIZE_1K;
        if (supported.includes(ImageSize.SIZE_1K)) return ImageSize.SIZE_1K;
        return supported[0];
    }, [config.mode]);

    const getDefaultAspectForModel = useCallback((modelId: string): AspectRatio => {
        if (config.mode === GenerationMode.ECOMMERCE) {
            return ecommerceAspectContext.defaultAspectRatio;
        }
        const caps = getModelCapabilities(modelId);
        const supported = caps?.supportedRatios;
        if (!supported || supported.length === 0) return AspectRatio.AUTO;
        if (supported.includes(AspectRatio.AUTO)) return AspectRatio.AUTO;
        return supported[0];
    }, [config.mode, ecommerceAspectContext.defaultAspectRatio]);

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
            return ecommerceAspectContext.allowedAspectRatios;
        }
        const ratios = modelCaps?.supportedRatios;
        return ratios && ratios.length > 0 ? ratios : Object.values(AspectRatio);
    }, [config.mode, ecommerceAspectContext.allowedAspectRatios, modelCaps]);

    const availableSizes = useMemo(() => {
        const sizes = modelCaps?.supportedSizes;
        const baseSizes = sizes && sizes.length > 0 ? sizes : Object.values(ImageSize);
        if (config.mode === GenerationMode.ECOMMERCE && !baseSizes.includes(ImageSize.SIZE_4K)) {
            return [...baseSizes, ImageSize.SIZE_4K];
        }
        return baseSizes;
    }, [config.mode, modelCaps]);

    const groundingSupported = useMemo(() => {
        return modelSupportsGrounding(config.model);
    }, [config.model]);

    const thinkingSupported = useMemo(() => {
        return !!modelCaps?.supportsThinking;
    }, [modelCaps]);

    const imageSearchSupported = useMemo(() => {
        return !!modelCaps?.supportsImageSearch;
    }, [modelCaps]);

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
            setConfig(prev => (
                availableRatios.includes(prev.aspectRatio)
                    ? prev
                    : { ...prev, aspectRatio: availableRatios[0] }
            ));
        }
    }, [availableRatios, config.aspectRatio, setConfig]);

    useEffect(() => {
        if (!availableSizes.includes(config.imageSize) && availableSizes.length > 0) {
            setConfig(prev => (
                availableSizes.includes(prev.imageSize)
                    ? prev
                    : { ...prev, imageSize: availableSizes[0] }
            ));
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

    const shouldBuildReferenceMentionTabs = mentionState.open;
    const referenceMentionTabs = useMemo(() => {
        if (!shouldBuildReferenceMentionTabs) {
            return [];
        }

        return buildReferenceMentionTabs({
            promptBarReferences: config.referenceImages,
            assistantImages: assetImages,
            assistantFiles: assetFiles,
            promptNodes: activeCanvas?.promptNodes || [],
            imageNodes: activeCanvas?.imageNodes || [],
            favorites: favoriteItems,
        });
    }, [
        activeCanvas?.imageNodes,
        activeCanvas?.promptNodes,
        assetFiles,
        assetImages,
        config.referenceImages,
        favoriteItems,
        shouldBuildReferenceMentionTabs,
    ]);

    const closeReferenceMentionPanel = useCallback(() => {
        setMentionState(prev => prev.open ? { ...prev, open: false, query: '' } : prev);
    }, []);

    const updateReferenceMentionFromTextarea = useCallback((target: HTMLTextAreaElement) => {
        if (isComposingRef.current) {
            return;
        }

        const value = target.value;
        const caret = target.selectionStart ?? value.length;
        const beforeCaret = value.slice(0, caret);
        const atIndex = beforeCaret.lastIndexOf('@');

        if (atIndex < 0) {
            closeReferenceMentionPanel();
            return;
        }

        const token = beforeCaret.slice(atIndex + 1);
        if (/[\s,，。；;:：()[\]{}<>]/.test(token)) {
            closeReferenceMentionPanel();
            return;
        }

        setMentionState({
            open: true,
            query: token,
            start: atIndex,
            end: caret,
            anchor: computeReferenceMentionAnchor(target, atIndex),
        });
    }, [closeReferenceMentionPanel]);

    const addMentionCandidateToPromptBar = useCallback((candidate?: ReferenceMentionCandidate) => {
        if (!candidate || !canCandidateAttachToPromptBar(candidate) || !candidate.referenceImage) {
            return;
        }

        const reference: ReferenceImage = {
            ...candidate.referenceImage,
            id: candidate.referenceImage.id || candidate.storageId || candidate.id,
            storageId: candidate.referenceImage.storageId || candidate.storageId,
            mimeType: candidate.referenceImage.mimeType || candidate.mimeType || 'image/png',
            mentionName: candidate.name,
            mentionText: candidate.mentionText,
            mentionSourceId: candidate.id,
        };

        setConfig(prev => {
            const alreadyExists = prev.referenceImages.some((image) => (
                (reference.storageId && image.storageId === reference.storageId)
                || image.id === reference.id
                || (candidate.name && image.mentionName === candidate.name)
            ));
            if (alreadyExists) {
                return prev;
            }

            const maxRefImages = getModelCapabilities(prev.model)?.maxRefImages ?? 5;
            if (prev.referenceImages.length >= maxRefImages) {
                notify.warning('参考图数量限制', `最多只能添加 ${maxRefImages} 张参考图`);
                return prev;
            }

            return {
                ...prev,
                referenceImages: [...prev.referenceImages, reference],
            };
        });
    }, [setConfig]);

    const applyPromptTextChange = useCallback((nextValue: string, caret?: number) => {
        promptDraftRef.current = nextValue;
        setPromptDraft(nextValue);
        commitPromptToConfig(nextValue);

        window.requestAnimationFrame(() => {
            const textarea = textareaRef.current;
            if (!textarea) return;
            textarea.focus();
            if (typeof caret === 'number') {
                textarea.setSelectionRange(caret, caret);
            }
            resizePromptTextarea(textarea);
        });
    }, [commitPromptToConfig, resizePromptTextarea]);

    const insertPromptComposerPayload = useCallback((payload: MentionReferencePayload) => {
        const text = payload.text || '';
        if (!text) return;

        const textarea = textareaRef.current;
        const current = promptDraftRef.current;
        const start = textarea?.selectionStart ?? current.length;
        const end = textarea?.selectionEnd ?? start;
        const nextValue = `${current.slice(0, start)}${text}${current.slice(end)}`;
        const caret = start + text.length;

        applyPromptTextChange(nextValue, caret);
        addMentionCandidateToPromptBar(payload.candidate);
    }, [addMentionCandidateToPromptBar, applyPromptTextChange]);

    useEffect(() => {
        favoriteComposerRegistry.setFallbackComposer('promptbar');
        return favoriteComposerRegistry.register({
            id: 'promptbar',
            label: 'Canvas prompt',
            insert: insertPromptComposerPayload,
            focus: () => textareaRef.current?.focus(),
            addReferenceImage: (reference, source) => {
                addMentionCandidateToPromptBar(source || {
                    id: reference.mentionSourceId || reference.storageId || reference.id,
                    source: 'upload',
                    kind: 'uploaded-image',
                    name: reference.mentionName || reference.id,
                    mentionText: reference.mentionText || `@${reference.mentionName || reference.id}`,
                    mimeType: reference.mimeType,
                    storageId: reference.storageId,
                    referenceImage: reference,
                });
            },
        });
    }, [addMentionCandidateToPromptBar, insertPromptComposerPayload]);

    const replaceActiveMentionWithCandidate = useCallback((candidate: ReferenceMentionCandidate) => {
        const current = promptDraftRef.current;
        const start = Math.max(0, mentionState.start);
        const end = Math.max(start, mentionState.end);
        const mentionText = candidate.mentionText || `@${candidate.name}`;
        const rawPrefix = current.slice(0, start);
        const rawSuffix = current.slice(end);
        const prefix = rawPrefix && !/[\s(（,，:：]$/.test(rawPrefix) ? `${rawPrefix} ` : rawPrefix;
        const suffixSpacer = rawSuffix && !/^[\s,，。；;:：)\]）]/.test(rawSuffix) ? ' ' : '';
        const nextValue = `${prefix}${mentionText}${suffixSpacer}${rawSuffix}`;
        const caret = prefix.length + mentionText.length + suffixSpacer.length;

        setMentionState(prev => ({ ...prev, open: false, query: '' }));
        applyPromptTextChange(nextValue, caret);
        addMentionCandidateToPromptBar(candidate);
    }, [addMentionCandidateToPromptBar, applyPromptTextChange, mentionState.end, mentionState.start]);

    const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const target = e.target;
        promptDraftRef.current = target.value;
        setPromptDraft(target.value);
        resizePromptTextarea(target);
        updateReferenceMentionFromTextarea(target);
    }, [resizePromptTextarea, updateReferenceMentionFromTextarea]);

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
        updateReferenceMentionFromTextarea(e.currentTarget);
    }, [commitPromptToConfig, resizePromptTextarea, updateReferenceMentionFromTextarea]);

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
        const hasCachedModels = availableModels.length > 0;
        setActiveMenu('model');
        setModelMenuLoadingState(hasCachedModels ? 'refreshing_with_cache' : 'bootstrapping_without_cache');

        if (hasCachedModels) {
            void refreshModelLibraryData({ force: false })
                .then(() => {
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

                    if (refreshedAvailableModels.length > 0) {
                        setGlobalModels(refreshedGlobalModels);
                    }

                    setModelMenuLoadingState('idle');
                })
                .catch((error) => {
                    console.warn('[PromptBar] Background model library refresh failed:', error);
                    if (modelMenuRequestRef.current !== requestId) {
                        return;
                    }

                    setModelMenuLoadingState('idle');
                });
            return;
        }

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
            setModelMenuLoadingState('idle');
            setActiveMenu(null);
            onOpenSettings?.('api-management');
            return;
        }

        setModelMenuLoadingState('idle');
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
        if (mentionState.open) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeReferenceMentionPanel();
                return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                return;
            }
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            // 始终允许发送新请求，即使正在生成中
            flushPromptDraftToConfig();
            onGenerate(promptDraftRef.current);
            if (isMobile) {
                setIsExpanded(false);
                textareaRef.current?.blur();
            }
        }
    }, [closeReferenceMentionPanel, flushPromptDraftToConfig, mentionState.open, onGenerate, isMobile, setIsExpanded, textareaRef]);

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
            // 🚀 [修复] 排除点击模型库下拉弹窗、上下文菜单、自定义设置弹窗等 Portal 的情况，防止被误杀关闭
            if (
                target.closest('.input-bar-inner') ||
                target.closest('.model-library-surface') ||
                modelDropdownRef.current?.contains(target) ||
                target.closest('.fixed.z-\\[10010\\]') ||
                target.closest('.fixed.z-\\[10020\\]')
            ) {
                return;
            }
            setActiveMenu(null);
            setShowPptOutlinePanel(false);
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

    const outlineToText = useCallback((outline: PPTOutline): string => {
        return outline.pages.map(page => {
            const bulletsText = page.bullets && page.bullets.length > 0 ? `：${page.bullets.join('；')}` : '';
            const layoutText = ` (${page.layout})`;
            return `${page.title}${bulletsText}${layoutText}`;
        }).join('\n');
    }, []);

    const textToOutline = useCallback((text: string, styleSpec?: PPTStyleSpec): PPTOutline => {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const pages = lines.map((line, idx) => {
            const layoutMatch = line.match(/\((cover|toc|title-body|image-text|comparison|ending)\)$/i);
            const layout = layoutMatch ? (layoutMatch[1].toLowerCase() as any) : (idx === 0 ? 'cover' : idx === lines.length - 1 ? 'ending' : 'title-body');
            
            const remaining = layoutMatch ? line.slice(0, line.lastIndexOf('(')).trim() : line;
            
            let title = remaining;
            let bullets: string[] = [];
            
            const colonIdx = remaining.indexOf('：');
            if (colonIdx !== -1) {
                title = remaining.substring(0, colonIdx).trim();
                bullets = remaining.substring(colonIdx + 1).split('；').map(b => b.trim()).filter(Boolean);
            }
            
            return {
                layout,
                title,
                bullets,
                subtitle: layout === 'cover' || layout === 'ending' ? bullets[0] || '' : undefined,
                imagePrompt: ''
            };
        });
        
        return {
            title: pages[0]?.title || '演示主题',
            pages,
            styleSpec
        };
    }, []);

    const generatePptOutlineByTopic = useCallback(async () => {
        const topic = promptDraft.trim();
        if (!topic) {
            notify.warning('请输入主题', '请先在输入框中填写 PPT 的主题或大纲要求。');
            return;
        }

        setIsRefining(true);
        setPptOutlineDraft('正在通过 AI 规划视觉一致性大纲，请稍候...');
        
        try {
            const total = Math.min(20, Math.max(1, Number(config.parallelCount) || 1));
            const systemPrompt = generateOutlineSystemPrompt({
                pageCount: total <= 7 ? 'short' : total <= 12 ? 'normal' : 'long',
                language: '中文'
            });
            const userPrompt = generateOutlineUserPrompt(topic, {
                extraRequirements: `页数限制：${total}页左右（请尽可能符合这个页数）`
            });

            const responseText = await chatWithLlm({
                modelId: 'gemini-2.5-flash',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.2
            });

            const outline = parseOutlineResponse(responseText);
            const formattedText = outlineToText(outline);
            
            setGlobalStyleSpec(outline.styleSpec);
            setPptOutlineDraft(formattedText);
            
            notify.success('AI大纲生成完毕', `已规划出符合视觉一致性的 ${outline.pages.length} 页幻灯片。`);
        } catch (error: any) {
            console.error('Failed to generate outline by AI:', error);
            notify.error('大纲生成失败', error.message || '大模型生成大纲时出现异常，已降级为静态模式。');
            
            const total = Math.min(20, Math.max(1, Number(config.parallelCount) || 1));
            const pages = Array.from({ length: total }).map((_, idx) => {
                const pageNo = idx + 1;
                if (pageNo === 1) return `封面：${topic} (cover)`;
                if (pageNo === total) return `总结与行动建议 (ending)`;
                return `${topic} - 第${pageNo}页 (title-body)`;
            });
            setPptOutlineDraft(pages.join('\n'));
        } finally {
            setIsRefining(false);
        }
    }, [config.parallelCount, promptDraft, outlineToText]);

    const handleRefinePptOutline = useCallback(async () => {
        if (!refineQuery.trim()) return;
        
        setIsRefining(true);
        const query = refineQuery.trim();
        setRefineQuery('');

        try {
            const currentOutline = textToOutline(pptOutlineDraft, globalStyleSpec);
            
            const { systemPrompt, userPrompt } = buildOutlineRefinementPrompt({
                currentOutline,
                userRequirement: query,
                history: refinementHistory,
                language: '中文'
            });

            const responseText = await chatWithLlm({
                modelId: 'gemini-2.5-flash',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.1
            });

            const refinedOutline = parseRefinedOutline(responseText);
            const formattedText = outlineToText(refinedOutline);
            setPptOutlineDraft(formattedText);
            
            if (refinedOutline.styleSpec) {
                setGlobalStyleSpec(refinedOutline.styleSpec);
            }

            setRefinementHistory(prev => [
                ...prev,
                { role: 'user', content: query },
                { role: 'assistant', content: `已成功精炼大纲。最新大纲包含 ${refinedOutline.pages.length} 页。` }
            ]);

            notify.success('大纲精炼完毕', '已根据您的意见调整了大纲内容。');
        } catch (err: any) {
            console.error('Failed to refine outline:', err);
            notify.error('精炼大纲失败', err.message || '调整大纲时遇到大模型响应错误，请稍后重试。');
        } finally {
            setIsRefining(false);
        }
    }, [pptOutlineDraft, globalStyleSpec, refineQuery, refinementHistory, outlineToText, textToOutline]);

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

    const importPptOutlinePayload = useCallback(async (file: File) => {
        const raw = await file.text();
        const trimmed = raw.trim();
        let slides: string[] = [];

        if (file.name.toLowerCase().endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                const pageEntries = Array.isArray(parsed?.pages) ? parsed.pages : [];
                slides = pageEntries
                    .map((entry: { text?: string; outline?: string; title?: string }) => String(entry?.text || entry?.outline || entry?.title || '').trim())
                    .filter(Boolean)
                    .slice(0, 20);
            } catch {
                slides = [];
            }
        }

        if (slides.length === 0) {
            slides = raw
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => line.replace(/^#{1,6}\s*/, '').replace(/^[-*]\s*/, '').replace(/^\d+[.)、]\s*/, '').trim())
                .filter(Boolean)
                .slice(0, 20);
        }

        if (slides.length === 0) {
            notify.warning('导入失败', '没有识别到可用的 PPT 页纲内容');
            return;
        }

        setPptOutlineDraft(slides.join('\n'));
        notify.success('已导入页纲', `已载入 ${slides.length} 页的 Markdown / JSON 页纲`);
    }, []);

    const handlePptOutlineImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) {
            return;
        }

        await importPptOutlinePayload(file);
    }, [importPptOutlinePayload]);

    const openPptOutlineImport = useCallback(() => {
        pptOutlineImportInputRef.current?.click();
    }, []);

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
    const filteredModeOptions = isMobile
        ? modeOptions.filter((item) => item.mode !== GenerationMode.ECOMMERCE)
        : modeOptions;
    // 兼容旧版测试正则匹配: const modeOptions = isMobile ? PROMPT_BAR_MODE_REGISTRY.filter((item) => item.mode !== GenerationMode.ECOMMERCE) : PROMPT_BAR_MODE_REGISTRY;
    const activePromptBarMode = isMobile && config.mode === GenerationMode.ECOMMERCE
        ? GenerationMode.IMAGE
        : config.mode;
    const activeModeOption = getPromptBarModeOption(activePromptBarMode);

    const handleSelectPromptBarMode = useCallback((mode: GenerationMode) => {
        commitConfigUpdate((previousConfig) => ({
            ...previousConfig,
            ...getPromptBarModePatch(previousConfig, mode),
        }));
        if (isMobile) {
            setIsExpanded(true);
        }
    }, [commitConfigUpdate, isMobile, setIsExpanded]);

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

    const handleSelectPromptOptimizerArchetype = useCallback((archetype: string) => {
        setConfig((previousConfig) => ({
            ...previousConfig,
            promptOptimizerArchetype: archetype,
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
            const droppedFiles = Array.from(e.dataTransfer.files);

            if (config.mode === GenerationMode.ECOMMERCE) {
                const ecommerceDropRoute = routeEcommerceDroppedFiles(droppedFiles, {
                    analysisConfirmed: ecommerceAnalysisConfirmed,
                });
                let handledEcommerceDrop = false;

                if (ecommerceDropRoute.requirementFiles.length && onPickEcommerceRequirementFile) {
                    onPickEcommerceRequirementFile(ecommerceDropRoute.requirementFiles);
                    handledEcommerceDrop = true;
                }

                if (ecommerceDropRoute.productFiles.length && onPickEcommerceProductFiles) {
                    onPickEcommerceProductFiles(ecommerceDropRoute.productFiles);
                    handledEcommerceDrop = true;
                }

                if (ecommerceDropRoute.promptReferenceFiles.length > 0) {
                    processFiles(ecommerceDropRoute.promptReferenceFiles);
                    handledEcommerceDrop = true;
                }

                if (handledEcommerceDrop) {
                    return;
                }
            }

            processFiles(droppedFiles);
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
        const currentModel = availableModels.find(m => m.id === config.model || m.id.split('@')[0] === config.model.split('@')[0]) || null;
        const resolvedCurrentSystemDisplay = currentModel?.isSystemInternal
            ? adminModelService.getModelDisplayInfo(currentModel.id, config.imageSize)
            : null;

        return {
            currentModel,
            resolvedCurrentSystemDisplay,
        };
    }, [availableModels, config.imageSize, config.model]);

    const isModelMenuOpen = activeMenu === 'model';
    const isModelListEmpty = availableModels.length === 0;
    const isModelMenuLoading = modelMenuLoadingState !== 'idle';
    const isModelMenuBootstrapping = modelMenuLoadingState === 'bootstrapping_without_cache';
    const isModelMenuRefreshingWithCache = modelMenuLoadingState === 'refreshing_with_cache';
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
        'var(--accent-coral)'
    );
    const currentModelSecondaryColor = normalizeColor(
        resolvedCurrentSystemDisplay?.colorSecondary
            || resolvedCurrentSystemDisplay?.colorEnd
            || currentModel?.colorSecondary
            || currentModel?.colorEnd,
        'var(--accent-pink)'
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
    if (isModelListEmpty && isModelMenuBootstrapping) {
        currentModelName = '正在同步最新模型库...';
    }

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
        return truncateModelLabel(currentModelName, isMobile ? 24 : 28);
    }, [currentModelName, isMobile, truncateModelLabel]);
    const isEmbeddedMobileComposer = isMobile && mobileShellMode === 'embedded';

    // 🚀 [Mobile Layout] Dock to bottom on mobile
    const mobileStyle: React.CSSProperties = isMobile ? (mobileShellMode === 'embedded'
        ? {
            position: 'relative',
            bottom: 'auto',
            left: 'auto',
            right: 'auto',
            transform: 'none',
            width: '100%',
            maxWidth: '100%',
            margin: 0,
            borderRadius: '22px',
            border: '1px solid var(--frost-card-framework-border)',
            padding: 0,
            WebkitBackdropFilter: 'blur(26px) saturate(170%)',
            backdropFilter: 'blur(26px) saturate(170%)',
            background: 'var(--frost-card-framework-bg)',
            boxShadow: 'var(--frost-card-framework-shadow)',
            contain: 'layout style paint',
        }
        : {
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--mobile-tabbar-height, 72px) + var(--mobile-tabbar-floating-offset, 12px) + var(--mobile-prompt-gap, 12px))',
            left: '50%',
            right: 'auto',
            transform: 'translateX(-50%) translateZ(0)',
            width: 'calc(100vw - 20px)',
            maxWidth: 'min(960px, calc(100vw - 20px))',
            margin: 0,
            borderRadius: '22px',
            border: '1px solid var(--frost-card-framework-border)',
            zIndex: KK_LAYER.promptComposer,
            padding: 0,
            WebkitBackdropFilter: 'blur(26px) saturate(170%)',
            backdropFilter: 'blur(26px) saturate(170%)',
            background: 'var(--frost-card-framework-bg)',
            boxShadow: 'var(--frost-card-framework-shadow)',
            willChange: 'transform',
            contain: 'layout style paint'
        }) : {
        // Desktop floating style handling...
    };
    const mobileFloatingSheetBottom = 'calc(env(safe-area-inset-bottom, 0px) + var(--mobile-tabbar-total-height) + var(--mobile-floating-sheet-clearance))';
    const mobileFloatingSheetMaxHeight = 'min(62vh, calc(100vh - var(--mobile-content-top-inset) - env(safe-area-inset-bottom, 0px) - var(--mobile-tabbar-total-height) - var(--mobile-floating-sheet-clearance) - 18px))';
    const shouldRenderInlineMobileUploadButton = isMobile && config.mode !== GenerationMode.ECOMMERCE && config.referenceImages.length === 0 && uploadingCount === 0;
    const shouldRenderMobileReferenceTray = isMobile && config.mode !== GenerationMode.ECOMMERCE && ((config.referenceImages && config.referenceImages.length > 0) || uploadingCount > 0);
    const shouldUseMobileInlineMedia = shouldRenderInlineMobileUploadButton || shouldRenderMobileReferenceTray;
    const shouldRenderStandaloneUploadRow = !isMobile && config.mode !== GenerationMode.ECOMMERCE && config.referenceImages.length === 0 && uploadingCount === 0;

    const activeEcommerceFooterSheet: EcommerceGroupSheet = ecommerceActiveTaskState?.sourceSheet ?? ecommerceActiveGroupSheet ?? '主图';
    const ecommerceOptionsSummary = config.mode === GenerationMode.ECOMMERCE ? (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            {(['主图', 'A+'] as EcommerceGroupSheet[]).map((sheet) => (
                <span
                    key={`ecommerce-options-summary-${sheet}`}
                    className="rounded-full border px-2 py-0.5 text-[10px] leading-none"
                    style={{
                        borderColor: activeEcommerceFooterSheet === sheet ? 'var(--mobile-clay-active-bg)' : 'var(--border-light)',
                        background: activeEcommerceFooterSheet === sheet ? 'var(--mobile-clay-active-bg)' : 'rgba(148, 163, 184, 0.08)',
                        color: activeEcommerceFooterSheet === sheet ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                >
                    {sheet}
                </span>
            ))}
        </span>
    ) : undefined;

    const mobileAdvancedPromptToolsNode = (
        <>
            {groundingSupported && (
                <button
                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.toggleGrounding.uiAction}
                    className={`flex min-w-0 max-w-full items-center justify-center gap-1 overflow-hidden px-2 h-8 rounded-md border transition-all text-[11px] font-medium ${config.enableGrounding
                        ? 'border-[var(--prompt-bar-toggle-active-border)] bg-[image:var(--prompt-bar-toggle-active-bg)] text-[var(--prompt-bar-toggle-active-text)] shadow-[var(--prompt-bar-toggle-active-shadow)]'
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--prompt-bar-shell-hover)]'
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
            {imageSearchSupported && (
                <button
                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.toggleImageSearch.uiAction}
                    className={`flex min-w-0 max-w-full items-center justify-center gap-1 overflow-hidden px-2 h-8 rounded-md border transition-all text-[11px] font-medium ${config.enableImageSearch
                        ? 'border-[var(--prompt-bar-toggle-active-border)] bg-[image:var(--prompt-bar-toggle-active-bg)] text-[var(--prompt-bar-toggle-active-text)] shadow-[var(--prompt-bar-toggle-active-shadow)]'
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--prompt-bar-shell-hover)]'
                        }`}
                    onClick={() => updateConfigFields({ enableImageSearch: !config.enableImageSearch })}
                    title="图片搜索 (参考网络图片)"
                >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span className="min-w-0 truncate whitespace-nowrap">图片搜索</span>
                </button>
            )}
        </>
    );

    const mobileAdvancedSummaryText = config.mode === GenerationMode.AUDIO
        ? `音频 · ${config.audioDuration || '自动'}`
        : config.mode === GenerationMode.VIDEO
        ? `视频 · ${config.videoResolution || '720p'} · ${config.videoDuration || '4s'}`
        : config.mode === GenerationMode.ECOMMERCE
        ? `电商模式 · ${activeEcommerceFooterSheet}`
        : `${config.imageSize || '自动'} · ${config.aspectRatio || '1:1'}`;

    const mobileAdvancedModePanelNode = (
        <DesktopComposerModePanel
            isMobile={isMobile}
            config={config}
            showOptionsPanel={showOptionsPanel}
            optionsPanelRef={optionsPanelRef}
            mobileFloatingSheetBottom={mobileFloatingSheetBottom}
            mobileFloatingSheetMaxHeight={mobileFloatingSheetMaxHeight}
            embeddedMobileDrawer={false}
            onToggleOptionsPanel={() => {
                if (isMobile) {
                    textareaRef.current?.blur();
                }
                setActiveMenu(null);
                setShowOptionsPanel(prev => !prev);
            }}
            summaryContent={ecommerceOptionsSummary}
            optionsPanelContent={config.mode === GenerationMode.AUDIO ? (
                <div className="kk-prompt-bar-deep-audio-panel w-56 p-3 rounded-xl animate-scaleIn origin-bottom">
                    <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">音频时长</div>
                    <div className="flex flex-wrap gap-1.5">
                        {['自动', '30s', '60s', '120s', '240s'].map(dur => (
                            <button
                                key={dur}
                                data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.selectAudioDuration.uiAction}
                                className={`kk-prompt-bar-deep-audio-option px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${(config.audioDuration || '自动') === dur
                                    ? 'kk-prompt-bar-deep-audio-option--active'
                                    : ''
                                    }`}
                                onClick={() => updateConfigFields({ audioDuration: dur === '自动' ? undefined : dur })}
                            >
                                {dur}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (config.mode === GenerationMode.IMAGE || config.mode === GenerationMode.PPT || config.mode === GenerationMode.ECOMMERCE) ? (
                <React.Suspense fallback={null}>
                    <ImageOptionsPanel
                        aspectRatio={config.aspectRatio}
                        imageSize={config.imageSize}
                        onAspectRatioChange={(ratio) => updateConfigFields({ aspectRatio: ratio })}
                        onImageSizeChange={(size) => updateConfigFields({ imageSize: size })}
                        availableRatios={availableRatios}
                        availableSizes={availableSizes}
                        ecommerceSheetSettings={config.mode === GenerationMode.ECOMMERCE ? ecommerceSheetSettings : undefined}
                        onUpdateEcommerceSheetSetting={config.mode === GenerationMode.ECOMMERCE ? onUpdateEcommerceSheetSetting : undefined}
                        activeEcommerceSheet={config.mode === GenerationMode.ECOMMERCE ? activeEcommerceFooterSheet : undefined}
                        onActiveEcommerceSheetChange={config.mode === GenerationMode.ECOMMERCE ? onActivateEcommerceGroupSheet : undefined}
                    />
                </React.Suspense>
            ) : (
                <React.Suspense fallback={null}>
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
                </React.Suspense>
            )}
        />
    );
    const dragOverlayLabel = config.mode === GenerationMode.ECOMMERCE && !ecommerceAnalysisConfirmed
        ? '释放导入需求单或产品图'
        : '释放添加参考图';
    useEffect(() => {
        if (!isModelMenuOpen) {
            modelMenuHasScrolledRef.current = false;
        }
    }, [isModelMenuOpen]);

    useEffect(() => {
        if (isMobile && isModelMenuOpen && modelListScrollRef.current && !modelMenuHasScrolledRef.current) {
            const index = filteredDisplayModels.findIndex(m => m.id === config.model);
            if (index !== -1) {
                modelMenuHasScrolledRef.current = true;
                const timer = setTimeout(() => {
                    if (modelListScrollRef.current) {
                        modelListScrollRef.current.scrollTop = index * MODEL_LIST_ITEM_HEIGHT;
                        setMobileScrollTop(index * MODEL_LIST_ITEM_HEIGHT);
                    }
                }, 80);
                return () => clearTimeout(timer);
            }
        }
    }, [isModelMenuOpen, isMobile, config.model, filteredDisplayModels]);

    const modelDropdownContent = (
        <>
            {!isModelMenuBootstrapping && filteredDisplayModels.length > 1 && (
                <div
                    className="kk-prompt-bar-deep-model-search model-library-surface mb-2 rounded-2xl p-2.5 max-w-[calc(100vw-24px)]"
                    style={{ ...modelLibrarySearchSurfaceStyle, width: 'min(22rem, calc(100vw - 24px))' }}
                >
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
                            className="kk-prompt-bar-deep-model-search-input w-full text-xs rounded-xl py-1.5 pl-7 pr-2 outline-none focus:border-[var(--frost-input-border)]"
                            autoFocus
                        />
                        {modelSearch && (
                            <button
                                data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.clearModelSearch.uiAction}
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

            {isModelMenuRefreshingWithCache && (
                <div className="mb-2 flex items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
                    <Loader2 size={14} className="animate-spin" />
                    <span>正在同步最新模型库...</span>
                </div>
            )}

            {/* 🚀 [重构] 拆分为外层非滚动玻璃层 + 内层滚动区域 */}
            <div
                className="kk-prompt-bar-deep-model-list model-library-surface dropdown static w-[min(22rem,calc(100vw-24px))] max-w-[calc(100vw-24px)] origin-bottom overflow-hidden"
                style={{ ...modelLibrarySurfaceStyle, borderRadius: '1rem' }}
            >
                <div
                    ref={modelListScrollRef}
                    className="w-full max-h-[50vh] overflow-y-auto scrollbar-thin p-4"
                >
                    {isModelMenuBootstrapping ? (
                        <div className="py-6">
                            <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
                                <Loader2 size={14} className="animate-spin" />
                                <span>正在同步最新模型库...</span>
                            </div>
                            <div className="mt-4 space-y-2">
                                {Array.from({ length: MODEL_MENU_SKELETON_COUNT }).map((_, index) => (
                                    <div
                                        key={`prompt-bar-model-loading-${index}`}
                                        className="h-12 rounded-xl bg-[var(--frost-card-sub-bg)] border border-[var(--frost-card-sub-border)] animate-pulse"
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (() => {
                        const handleTogglePin = (modelId: string) => {
                            toggleModelPin(modelId);
                            setPinnedVersion(v => v + 1);
                        };

                        // 1. 如果处于搜索状态，或者用户只配置了 1 个供应商，直接平铺展示其全部模型（包含置顶区）
                        if (modelSearch || hasOnlyOneProvider) {
                            const currentGroup = hasOnlyOneProvider ? normalGroups[0] : null;
                            const modelsToRender = modelSearch 
                                ? filteredDisplayModels 
                                : (currentGroup ? currentGroup.models : filteredDisplayModels);

                            if (modelsToRender.length === 0) {
                                return (
                                    <div className="py-8 text-center text-xs text-[var(--text-tertiary)]">
                                        未找到匹配模型
                                    </div>
                                );
                            }

                            const pinnedList = modelsToRender.filter(m => m.isPinned && !m.isExclusive);
                            const otherList = modelsToRender.filter(m => !m.isPinned || m.isExclusive);

                            return (
                                <div className="space-y-4">
                                    {pinnedList.length > 0 && (
                                        <div className="space-y-1.5">
                                            <div className="text-[10px] font-bold text-[color:var(--accent-coral)] px-1 flex items-center gap-1">
                                                <span>📌 置顶模型</span>
                                                <div className="flex-1 h-[1px] bg-[var(--frost-card-sub-border)] ml-1" />
                                            </div>
                                            {pinnedList.map((model, idx) => (
                                                <SwipeableModelItem
                                                    key={`pinned-desk-${model.id}`}
                                                    modelId={model.id}
                                                    isPinned={true}
                                                    onTogglePin={handleTogglePin}
                                                    selected={config.model === model.id}
                                                    isExclusive={model.isExclusive}
                                                    isSystemInternal={model.isSystemInternal}
                                                    onClick={() => {
                                                        handleSelectPromptBarModel(model);
                                                    }}
                                                >
                                                    <PromptBarModelMenuButton
                                                        model={model}
                                                        imageSize={config.imageSize}
                                                        selected={config.model === model.id}
                                                        isLast={idx === pinnedList.length - 1}
                                                        description={truncateModelDescription(model.resolvedDescription, 50)}
                                                        onSelect={handleSelectPromptBarModel}
                                                        onOpenContextMenu={handlePromptBarModelContextMenu}
                                                    />
                                                </SwipeableModelItem>
                                            ))}
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        {pinnedList.length > 0 && (
                                            <div className="text-[10px] font-bold text-[var(--text-tertiary)] px-1 flex items-center gap-1 pt-1">
                                                <span>所有模型</span>
                                                <div className="flex-1 h-[1px] bg-[var(--frost-card-sub-border)] ml-1" />
                                            </div>
                                        )}
                                        {otherList.map((model, idx) => (
                                            <SwipeableModelItem
                                                key={`other-desk-${model.id}`}
                                                modelId={model.id}
                                                isPinned={model.isPinned}
                                                onTogglePin={handleTogglePin}
                                                selected={config.model === model.id}
                                                isExclusive={model.isExclusive}
                                                isSystemInternal={model.isSystemInternal}
                                                onClick={() => {
                                                    handleSelectPromptBarModel(model);
                                                }}
                                            >
                                                <PromptBarModelMenuButton
                                                    model={model}
                                                    imageSize={config.imageSize}
                                                    selected={config.model === model.id}
                                                    isLast={idx === otherList.length - 1}
                                                    description={truncateModelDescription(model.resolvedDescription, 50)}
                                                    onSelect={handleSelectPromptBarModel}
                                                    onOpenContextMenu={handlePromptBarModelContextMenu}
                                                />
                                            </SwipeableModelItem>
                                        ))}
                                    </div>
                                </div>
                            );
                        }

                        // 2. 无搜索且有多个供应商：显示二级分类导航视图
                        if (desktopActiveProvider === null) {
                            // 第一层：供应商分类选择列表
                            return (
                                <div className="space-y-4">
                                    {/* (A) 系统积分模型（置于最上方） */}
                                    {systemExclusiveModels.length > 0 && (
                                        <div className="kk-prompt-bar-deep-model-section space-y-1.5 p-2 rounded-2xl">
                                            <div className="text-[10px] font-bold text-[var(--text-secondary)] px-1 pb-1 flex items-center gap-1">
                                                <span>✨ 系统智能积分模型</span>
                                                <span className="text-[9px] bg-[color:var(--accent-coral)]/10 text-[color:var(--accent-coral)] px-1 rounded font-semibold scale-90">官方信道</span>
                                            </div>
                                            {systemExclusiveModels.map((model) => (
                                                <div 
                                                    key={model.id}
                                                    className={`kk-prompt-bar-deep-model-item rounded-xl transition-all ${config.model === model.id ? 'kk-prompt-bar-deep-model-item--active' : ''}`}
                                                >
                                                    <PromptBarModelMenuButton
                                                        model={model}
                                                        imageSize={config.imageSize}
                                                        selected={config.model === model.id}
                                                        isLast={false}
                                                        description={truncateModelDescription(model.resolvedDescription, 50)}
                                                        onSelect={handleSelectPromptBarModel}
                                                        onOpenContextMenu={handlePromptBarModelContextMenu}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* (B) 供应商组列表，支持拖拽排序 */}
                                    <div className="space-y-1.5">
                                        <div className="text-[10px] font-bold text-[var(--text-tertiary)] px-1 flex items-center gap-1">
                                            <span>模型供应商 (拖拽可排序)</span>
                                            <div className="flex-1 h-[1px] bg-[var(--frost-card-sub-border)] ml-1" />
                                        </div>

                                        {normalGroups.map((group, index) => {
                                            const pinnedCount = group.models.filter(m => m.isPinned).length;
                                            const isDragged = draggedIndex === index;

                                            return (
                                                <div
                                                    key={group.provider}
                                                    onDragOver={(e: React.DragEvent<HTMLDivElement>) => handleProviderDragOver(e, index)}
                                                    onClick={() => {
                                                        // 🚀 [优化] 如果该供应商下只有一个模型，点击时直接选择该模型并关闭菜单，无需进入二级菜单
                                                        if (group.models.length === 1) {
                                                            handleSelectPromptBarModel(group.models[0]);
                                                        } else {
                                                            setDesktopActiveProvider(group.provider);
                                                        }
                                                    }}
                                                    className={`kk-prompt-bar-deep-provider-row provider-row-container flex items-center justify-between p-3 rounded-xl transition-all duration-200 select-none cursor-pointer
                                                        ${isDragged 
                                                            ? 'kk-prompt-bar-deep-provider-row--dragged border-dashed opacity-50 scale-95'
                                                            : 'active:scale-[0.99]'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        {/* 拖拽指示手柄 */}
                                                        <div 
                                                            draggable={true}
                                                            onDragStart={(e) => {
                                                                const rowEl = e.currentTarget.closest('.provider-row-container') as HTMLDivElement;
                                                                if (rowEl && e.dataTransfer.setDragImage) {
                                                                    e.dataTransfer.setDragImage(rowEl, 20, 20);
                                                                }
                                                                handleProviderDragStart(e, index);
                                                            }}
                                                            onDragEnd={handleProviderDragEnd}
                                                            className="text-[var(--text-tertiary)] cursor-grab active:cursor-grabbing hover:text-[var(--text-secondary)] opacity-40 hover:opacity-100 pr-1 flex items-center shrink-0"
                                                        >
                                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                <circle cx="9" cy="5" r="1" />
                                                                <circle cx="9" cy="12" r="1" />
                                                                <circle cx="9" cy="19" r="1" />
                                                                <circle cx="15" cy="5" r="1" />
                                                                <circle cx="15" cy="12" r="1" />
                                                                <circle cx="15" cy="19" r="1" />
                                                            </svg>
                                                        </div>

                                                        <div className="w-7 h-7 rounded-lg bg-[var(--frost-card-sub-bg)] flex items-center justify-center flex-shrink-0">
                                                            <ModelLogo
                                                                modelId=""
                                                                provider={group.provider}
                                                                size={20}
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                                                                {group.providerDisplayName}
                                                            </div>
                                                            <div className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1.5 mt-0.5">
                                                                <span>{group.models.length} 个模型</span>
                                                                {pinnedCount > 0 && (
                                                                    <span className="text-[color:var(--accent-coral)] font-semibold flex items-center gap-0.5">
                                                                        📌 {pinnedCount} 置顶
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        } else {
                            // 第二层：该供应商内的模型子列表页
                            const currentGroup = normalGroups.find(g => g.provider === desktopActiveProvider);
                            if (!currentGroup) return null;

                            const pinnedList = currentGroup.models.filter(m => m.isPinned);
                            const otherList = currentGroup.models.filter(m => !m.isPinned);

                            return (
                                <div className="space-y-3">
                                    {/* 返回导航栏 */}
                                    <div className="flex items-center gap-2 border-b border-[var(--frost-card-sub-border)] pb-2 shrink-0">
                                        <button
                                            data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.closeProviderModels.uiAction}
                                            onClick={() => setDesktopActiveProvider(null)}
                                            className="text-[10px] font-bold px-2 py-1 rounded-lg border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--prompt-bar-shell-border-strong)] flex items-center gap-1 active:scale-95 transition-all"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                                            </svg>
                                            <span>返回</span>
                                        </button>
                                        <span className="text-xs font-extrabold text-[var(--text-primary)]">
                                            {currentGroup.providerDisplayName}
                                        </span>
                                    </div>

                                    {/* 置顶模型区 */}
                                    {pinnedList.length > 0 && (
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-bold text-[color:var(--accent-coral)] px-1 flex items-center gap-1">
                                                <span>📌 置顶模型</span>
                                                <div className="flex-1 h-[1px] bg-[var(--frost-card-sub-border)] ml-1" />
                                            </div>
                                            {pinnedList.map((model, idx) => (
                                                <SwipeableModelItem
                                                    key={`pinned-desk-sub-${model.id}`}
                                                    modelId={model.id}
                                                    isPinned={true}
                                                    onTogglePin={handleTogglePin}
                                                    selected={config.model === model.id}
                                                    isExclusive={model.isExclusive}
                                                    isSystemInternal={model.isSystemInternal}
                                                    onClick={() => {
                                                        handleSelectPromptBarModel(model);
                                                    }}
                                                >
                                                    <PromptBarModelMenuButton
                                                        model={model}
                                                        imageSize={config.imageSize}
                                                        selected={config.model === model.id}
                                                        isLast={idx === pinnedList.length - 1}
                                                        description={truncateModelDescription(model.resolvedDescription, 50)}
                                                        onSelect={handleSelectPromptBarModel}
                                                        onOpenContextMenu={handlePromptBarModelContextMenu}
                                                    />
                                                </SwipeableModelItem>
                                            ))}
                                        </div>
                                    )}

                                    {/* 剩余模型列表 */}
                                    <div className="space-y-1">
                                        {pinnedList.length > 0 && (
                                            <div className="text-[10px] font-bold text-[var(--text-tertiary)] px-1 flex items-center gap-1 pt-1">
                                                <span>所有模型</span>
                                                <div className="flex-1 h-[1px] bg-[var(--frost-card-sub-border)] ml-1" />
                                            </div>
                                        )}
                                        {otherList.map((model, idx) => (
                                            <SwipeableModelItem
                                                key={`other-desk-sub-${model.id}`}
                                                modelId={model.id}
                                                isPinned={false}
                                                onTogglePin={handleTogglePin}
                                                selected={config.model === model.id}
                                                isExclusive={model.isExclusive}
                                                isSystemInternal={model.isSystemInternal}
                                                onClick={() => {
                                                    handleSelectPromptBarModel(model);
                                                }}
                                            >
                                                <PromptBarModelMenuButton
                                                    model={model}
                                                    imageSize={config.imageSize}
                                                    selected={config.model === model.id}
                                                    isLast={idx === otherList.length - 1}
                                                    description={truncateModelDescription(model.resolvedDescription, 50)}
                                                    onSelect={handleSelectPromptBarModel}
                                                    onOpenContextMenu={handlePromptBarModelContextMenu}
                                                />
                                            </SwipeableModelItem>
                                        ))}
                                    </div>
                                </div>
                            );
                        }
                    })()}
                </div>
            </div>
        </>
    );

    if (isMobile && !isExpanded) {
        return (
            <>
                <div
                    id="prompt-bar-container"
                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.expandMobileComposer.uiAction}
                    className="kk-prompt-bar-mobile-collapse-handle"
                    style={{ zIndex: KK_LAYER.promptComposer }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(true);
                    }}
                    onTouchStart={(e) => {
                        e.stopPropagation();
                        // 简体中文注释：在移动端触摸展开时，必须调用 preventDefault 阻止后续 click 事件的分发，
                        // 否则浏览器延迟触发的 click 会穿透击中新展开面板底部的“模型选择按钮”，导致面板一展开就自动进入模型库。
                        e.preventDefault();
                        setIsExpanded(true);
                    }}
                    title={pick('展开输入栏', 'Expand input bar')}
                />
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
            </>
        );
    }
    if (isMobile) {
        return (
            <div
                id="prompt-bar-container"
                className={`input-bar ios-mobile-prompt ${(isModelMenuOpen || showOptionsPanel) ? 'has-open-dropdown' : ''} transition-all duration-300 !overflow-visible w-full max-w-full`}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                style={{
                    ...mobileStyle,
                    height: mobileSubView !== 'input' ? '330px' : 'auto',
                    transition: 'height 0.2s cubic-bezier(0.32,0.72,0,1)'
                }}
            >
                <div className="input-bar-inner !overflow-visible flex flex-col gap-2.5 p-3 h-full">
                    {mobileSubView === 'input' && (
                        <>
                            {/* 1. 第一排：模式选择均分 5 列 (4模式 + 1收起) */}
                            <div className="grid grid-cols-5 gap-1.5 w-full border-b border-[var(--frost-card-sub-border)] pb-2 min-w-0 items-center justify-items-center">
                                {filteredModeOptions.map(option => {
                                    const isSelected = activeModeOption.mode === option.mode;
                                    return (
                                        <button
                                            key={option.mode}
                                            data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.selectMobileMode.uiAction}
                                            className={`w-full flex items-center justify-center py-1.5 rounded-xl transition-all duration-200 border text-[11px] font-bold ${isSelected ? 'bg-[var(--frost-card-sub-bg)] border-[var(--frost-card-sub-border)] text-[var(--accent-coral)] shadow-sm' : 'border-transparent text-[var(--text-secondary)] active:text-[var(--text-primary)]'}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                handleSelectPromptBarMode(option.mode);
                                            }}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                                <button
                                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.collapseMobileComposer.uiAction}
                                    className="flex items-center justify-center py-1.5 rounded-xl border border-transparent text-[var(--text-secondary)] active:scale-95 transition-all duration-200"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsExpanded(false);
                                        textareaRef.current?.blur();
                                    }}
                                    title="收起输入面板"
                                >
                                    <ChevronDown size={16} />
                                </button>
                            </div>

                            {/* 插层：源图继续创作 Banner */}
                            {activeSourceImage && (
                                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all"
                                    style={{
                                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                        borderColor: 'rgba(245, 158, 11, 0.2)'
                                    }}
                                >
                                    <img
                                        src={activeSourceImage.url}
                                        alt="源图"
                                        className="w-8 h-8 object-cover rounded-lg shadow-sm"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-500">从此图继续创作</div>
                                    </div>
                                    <button
                                        data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.clearSource.uiAction}
                                        onClick={onClearSource}
                                        className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-500"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            )}

                            {/* 2. 第二排：输入文字和图片一排 (去边框臃肿，平铺) */}
                            <div className="flex items-start gap-2.5 w-full min-w-0 py-1">
                                {/* 左侧：参考图预览和上传按钮组合 */}
                                {config.mode !== GenerationMode.ECOMMERCE && (
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {config.referenceImages.length > 0 ? (
                                            <div
                                                className="flex max-w-[85px] items-center gap-1 overflow-x-auto scrollbar-none pr-0.5"
                                                style={{ WebkitOverflowScrolling: 'touch' }}
                                            >
                                                {config.referenceImages.map((img) => (
                                                    <div key={`mobile-ref-${img.id}`} className="relative h-10 w-10 shrink-0">
                                                        <ReferenceThumbnail
                                                            image={img}
                                                            onRecovered={handleReferenceRecovered}
                                                            onClick={handleReferencePreview}
                                                        />
                                                        <button
                                                            data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.removeReferenceImage.uiAction}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeReferenceImage(img.id);
                                                            }}
                                                            className="absolute -right-1 -top-1 z-10 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                ))}
                                                {Array.from({ length: uploadingSkeletonCount }).map((_, idx) => (
                                                    <div key={`mobile-uploading-${idx}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-[color:var(--frost-card-sub-border)]">
                                                        <Loader2 size={12} className="animate-spin text-[var(--text-tertiary)]" />
                                                    </div>
                                                ))}
                                                <button
                                                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.addReferenceImage.uiAction}
                                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--frost-card-sub-border)] bg-[var(--frost-input-bg)] text-[var(--text-secondary)] opacity-60 active:opacity-100"
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.addReferenceImage.uiAction}
                                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-[var(--frost-card-sub-border)] bg-[var(--frost-input-bg)] text-[var(--text-secondary)] opacity-70 active:opacity-100 active:scale-95 transition-all duration-200"
                                                onClick={() => fileInputRef.current?.click()}
                                                title="上传参考图"
                                            >
                                                <Plus size={18} />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* 右侧：文字输入框 */}
                                <div className="relative flex-1 min-w-0">
                                    <ReferenceMentionPanel
                                        open={mentionState.open}
                                        query={mentionState.query}
                                        tabs={referenceMentionTabs}
                                        anchor={mentionState.anchor}
                                        onSelect={replaceActiveMentionWithCandidate}
                                        onClose={closeReferenceMentionPanel}
                                    />
                                    <textarea
                                        ref={textareaRef}
                                        value={promptDraft}
                                        onChange={handleInput}
                                        onKeyDown={handleKeyDown}
                                        onPaste={handlePaste}
                                        onFocus={() => {
                                            favoriteComposerRegistry.markFocused('promptbar');
                                            setActiveMenu(null);
                                            onFocus?.();
                                        }}
                                        onBlur={() => {
                                            flushPromptDraftToConfig();
                                            onBlur?.();
                                        }}
                                        onCompositionStart={() => { isComposingRef.current = true; }}
                                        onCompositionEnd={handleCompositionEnd}
                                        placeholder={config.mode === GenerationMode.VIDEO ? "描述你想要生成的视频..." : config.mode === GenerationMode.AUDIO ? "描述要生成的音频风格或歌词..." : config.mode === GenerationMode.PPT ? "输入PPT主题，批量生成..." : config.mode === GenerationMode.ECOMMERCE ? (ecommerceAnalysisConfirmed ? "输入补充修改指令..." : "上传运营文件后，在这里补充要求...") : "描述你想要生成的图片..."}
                                        className="input-bar-textarea w-full max-w-full bg-transparent border-none outline-none text-[15px] resize-none box-border overflow-y-auto mt-0.5 py-1 px-0"
                                        style={{
                                            color: 'var(--text-primary)',
                                            minHeight: '38px',
                                            maxHeight: '120px',
                                            lineHeight: '20px'
                                        }}
                                        rows={1}
                                    />
                                </div>
                            </div>

                            {/* 电商配置面板（电商模式下显示） */}
                            {config.mode === GenerationMode.ECOMMERCE && (
                                <div className="w-full">
                                    <React.Suspense fallback={null}>
                                        <DesktopComposerEcommercePanel
                                            config={config}
                                            requirementFileName={ecommerceRequirementFileName}
                                            productFileCount={ecommerceProductFileCount}
                                            extraReferenceCount={ecommerceExtraReferenceCount}
                                            productFiles={ecommerceProductFiles}
                                            extraReferenceFiles={ecommerceExtraReferenceFiles}
                                            itemReferenceFiles={ecommerceItemReferenceFiles}
                                            ecommerceAnalysis={ecommerceAnalysis}
                                            ecommerceSelection={ecommerceSelection}
                                            taskStates={ecommerceTaskStates}
                                            groupSlots={ecommerceGroupSlots}
                                            activeTaskState={ecommerceActiveTaskState}
                                            activeFrameworkId={ecommerceActiveFrameworkId}
                                            frameworkSummary={ecommerceFrameworkSummary}
                                            analysisConfirmed={ecommerceAnalysisConfirmed}
                                            confirmingAnalysis={ecommerceConfirmingAnalysis}
                                            activeGroupSheet={ecommerceActiveGroupSheet}
                                            ecommerceAnalyzing={ecommerceAnalyzing}
                                            onPickRequirementFile={onPickEcommerceRequirementFile}
                                            onPickProductFiles={onPickEcommerceProductFiles}
                                            onPickExtraReferenceFiles={onPickEcommerceExtraReferenceFiles}
                                            onClearRequirementFile={onClearEcommerceRequirementFile}
                                            onRemoveProductFile={onRemoveEcommerceProductFile}
                                            onRemoveExtraReferenceFile={onRemoveEcommerceExtraReferenceFile}
                                            onPickItemReferenceFiles={onPickEcommerceItemReferenceFiles}
                                            onRemoveItemReferenceFile={onRemoveEcommerceItemReferenceFile}
                                            onAnalyzeFile={onAnalyzeEcommerceFile || onGenerate}
                                            onResetAnalysis={onResetEcommerceAnalysis}
                                            onConfirmAnalysis={onConfirmEcommerceAnalysis}
                                            onToggleSelection={onToggleEcommerceSelection}
                                            onActivateGroupSheet={onActivateEcommerceGroupSheet}
                                            onActivateTaskBySourceKey={onActivateEcommerceTaskBySourceKey}
                                            onPreviewSlotHistory={onPreviewEcommerceSlotHistory}
                                            onTaskStateChange={onChangeEcommerceTaskState}
                                        />
                                    </React.Suspense>
                                </div>
                            )}

                            {/* 3. 第三排：模型库、设置和发送一排 */}
                            <div className="flex items-center justify-between w-full gap-2 min-h-[40px] pt-1">
                                {/* 左侧：模型选择按钮 */}
                                <div className="flex-1 min-w-0">
                                    <button
                                        data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.openModelLibrary.uiAction}
                                        className="flex w-full items-center gap-1.5 px-3 h-10 rounded-xl border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] text-[var(--text-secondary)] justify-start active:scale-95 transition-all duration-200 overflow-hidden"
                                        style={{
                                            ...(() => {
                                                if (isModelListEmpty) return { opacity: 0.5, cursor: 'not-allowed' };
                                                if (currentModel?.isSystemInternal && currentModel?.colorStart && currentModel?.colorEnd) {
                                                    return getCreditModelFlatStyle(
                                                        currentModelPrimaryColor,
                                                        currentModelSecondaryColor,
                                                        currentModel?.textColor,
                                                        false,
                                                    );
                                                }
                                                return {};
                                            })(),
                                            pointerEvents: justExpanded ? 'none' : 'auto'
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (justExpanded) return;
                                            textareaRef.current?.blur();
                                            if (isModelListEmpty) {
                                                onOpenSettings?.('api-management');
                                                return;
                                            }
                                            setMobileCategory('featured');
                                            setMobileSubView('model');
                                        }}
                                    >
                                        {!isModelListEmpty && currentModel && (
                                            <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                                                <ModelLogo
                                                    modelId={currentModel.id}
                                                    provider={currentModel.provider}
                                                    modelName={currentModelName}
                                                    size={14}
                                                    active
                                                />
                                            </span>
                                        )}
                                        <span className="font-bold truncate text-[13px] text-left flex-1">
                                            {displayModelLabel}
                                        </span>
                                    </button>
                                </div>

                                {/* 中间：高级设置按钮 */}
                                <div className="flex-shrink-0">
                                    <button
                                        data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.toggleAdvancedOptions.uiAction}
                                        className="flex h-10 px-3.5 items-center justify-center rounded-xl border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] text-[var(--text-secondary)] shadow-sm active:scale-95 transition-all duration-200"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            textareaRef.current?.blur();
                                            setMobileSubView('settings');
                                        }}
                                    >
                                        <span className="text-xs font-semibold">高级设置</span>
                                    </button>
                                </div>

                                {/* 右侧：发送按钮 */}
                                <div className="flex-shrink-0">
                                    <CreditSendButton
                                        isCreditModel={isSystemCreditModel}
                                        creditCost={totalCreditCost}
                                        balance={balance}
                                        balanceLoading={billingLoading}
                                        hasPrompt={!!promptDraft.trim()}
                                        colorStart={currentModel?.colorStart}
                                        colorEnd={currentModel?.colorEnd}
                                        textColor={currentModel?.textColor}
                                        ecommerceConfirmedMode={config.mode === GenerationMode.ECOMMERCE && ecommerceAnalysisConfirmed}
                                        isMobile={true}
                                        parallelCount={config.parallelCount}
                                        onChangeParallelCount={(count) => updateConfigFields({ parallelCount: count })}
                                        onClick={() => {
                                            if (isSystemCreditModel && authLoading) {
                                                notify.info('账号状态确认中', '正在校验登录状态，请稍后再试。');
                                                return;
                                            }
                                            void onGenerate();
                                            if (isMobile) {
                                                setIsExpanded(false);
                                                textareaRef.current?.blur();
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* 🚀 移动端模型库内嵌独显面板 */}
                    {mobileSubView === 'model' && (
                        <div 
                            className="flex flex-col h-[300px] w-full min-w-0 overflow-hidden"
                            style={{ touchAction: 'pan-y' }}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                        >
                            {/* 顶部一排：搜索框与完成按钮合并 */}
                            <div className="flex items-center gap-2 border-b border-[var(--frost-card-sub-border)] pb-2 shrink-0 w-full min-w-0">
                                <div 
                                    className="flex-1 min-w-0 p-1 border rounded-xl" 
                                    style={{ ...modelLibrarySearchSurfaceStyle, margin: 0 }}
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onTouchMove={(e) => e.stopPropagation()}
                                    onTouchEnd={(e) => e.stopPropagation()}
                                >
                                    <div className="relative flex items-center h-8">
                                        <svg className="absolute left-2.5 w-3.5 h-3.5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <input
                                            type="text"
                                            value={modelSearch}
                                            onChange={(e) => setModelSearch(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            onTouchStart={(e) => e.stopPropagation()}
                                            onTouchMove={(e) => e.stopPropagation()}
                                            onTouchEnd={(e) => e.stopPropagation()}
                                            placeholder="搜索常用或供应商模型..."
                                            className="w-full bg-[var(--frost-input-bg)] text-[var(--text-primary)] text-xs rounded-lg py-1 pl-7.5 pr-2 outline-none border border-transparent focus:border-[var(--frost-input-border)] placeholder-[var(--text-tertiary)]"
                                        />
                                        {modelSearch && (
                                            <button
                                                data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.clearModelSearch.uiAction}
                                                onClick={(e) => { e.stopPropagation(); setModelSearch(''); }}
                                                onTouchStart={(e) => e.stopPropagation()}
                                                onTouchMove={(e) => e.stopPropagation()}
                                                onTouchEnd={(e) => e.stopPropagation()}
                                                className="absolute right-2 text-[var(--text-tertiary)]"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <button
                                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.closeProviderModels.uiAction}
                                    className="text-xs font-bold px-3.5 h-[34px] shrink-0 rounded-xl border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] text-[var(--accent-coral)] flex items-center justify-center active:scale-95"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMobileSubView('input');
                                    }}
                                >
                                    完成
                                </button>
                            </div>

                            {/* 🚀 全新移动端供应商打组模型选择容器 */}
                            <div className="flex-1 flex flex-col overflow-hidden min-h-0 mt-2">
                                {isModelMenuBootstrapping ? (
                                    <div className="py-6 px-4 w-full flex items-center justify-center">
                                        <Loader2 size={14} className="animate-spin text-[var(--text-secondary)] mr-2" />
                                        <span className="text-xs text-[var(--text-secondary)]">正在加载模型列表...</span>
                                    </div>
                                ) : (() => {
                                    const handleTogglePin = (modelId: string) => {
                                        toggleModelPin(modelId);
                                        setPinnedVersion(v => v + 1);
                                    };

                                    // 1. 如果处于搜索状态，或者用户只配置了 1 个供应商，直接平铺展示其全部模型（包含置顶区）
                                    if (modelSearch || hasOnlyOneProvider) {
                                        const currentGroup = hasOnlyOneProvider ? normalGroups[0] : null;
                                        const modelsToRender = modelSearch 
                                            ? filteredDisplayModels 
                                            : (currentGroup ? currentGroup.models : filteredDisplayModels);

                                        if (modelsToRender.length === 0) {
                                            return (
                                                <div className="py-8 text-center text-xs text-[var(--text-tertiary)]">
                                                    未找到匹配模型
                                                </div>
                                            );
                                        }

                                        // 如果是单个供应商，区分置顶与普通模型展示
                                        const pinnedList = modelsToRender.filter(m => m.isPinned && !m.isExclusive);
                                        const otherList = modelsToRender.filter(m => !m.isPinned || m.isExclusive);

                                        return (
                                            <div className="flex-1 overflow-y-auto p-1.5 space-y-3" style={{ touchAction: 'pan-y' }}>
                                                {pinnedList.length > 0 && (
                                                    <div className="space-y-1">
                                                        <div className="text-[10px] font-bold text-[color:var(--accent-coral)] px-1.5 flex items-center gap-1">
                                                            <span>📌 已置顶模型</span>
                                                            <div className="flex-1 h-[1px] bg-[var(--frost-card-sub-border)] ml-1" />
                                                        </div>
                                                        {pinnedList.map((model, idx) => (
                                                            <SwipeableModelItem
                                                                key={`pinned-${model.id}`}
                                                                modelId={model.id}
                                                                isPinned={true}
                                                                onTogglePin={handleTogglePin}
                                                                selected={config.model === model.id}
                                                                isExclusive={model.isExclusive}
                                                                isSystemInternal={model.isSystemInternal}
                                                                onClick={() => {
                                                                    handleSelectPromptBarModel(model);
                                                                    setMobileSubView('input');
                                                                }}
                                                            >
                                                                <PromptBarModelMenuButton
                                                                    model={model}
                                                                    imageSize={config.imageSize}
                                                                    selected={config.model === model.id}
                                                                    isLast={idx === pinnedList.length - 1}
                                                                    description={truncateModelDescription(model.resolvedDescription, 40)}
                                                                    isMobile={true}
                                                                    onSelect={(m) => {
                                                                        handleSelectPromptBarModel(m);
                                                                        setMobileSubView('input');
                                                                    }}
                                                                    onOpenContextMenu={handlePromptBarModelContextMenu}
                                                                />
                                                            </SwipeableModelItem>
                                                        ))}
                                                    </div>
                                                )}
                                                
                                                <div className="space-y-1">
                                                    {pinnedList.length > 0 && (
                                                        <div className="text-[10px] font-bold text-[var(--text-tertiary)] px-1.5 flex items-center gap-1 pt-1">
                                                            <span>所有模型</span>
                                                            <div className="flex-1 h-[1px] bg-[var(--frost-card-sub-border)] ml-1" />
                                                        </div>
                                                    )}
                                                    {otherList.map((model, idx) => (
                                                        <SwipeableModelItem
                                                            key={`other-${model.id}`}
                                                            modelId={model.id}
                                                            isPinned={model.isPinned}
                                                            onTogglePin={handleTogglePin}
                                                            selected={config.model === model.id}
                                                            isExclusive={model.isExclusive}
                                                            isSystemInternal={model.isSystemInternal}
                                                            onClick={() => {
                                                                handleSelectPromptBarModel(model);
                                                                setMobileSubView('input');
                                                            }}
                                                        >
                                                            <PromptBarModelMenuButton
                                                                model={model}
                                                                imageSize={config.imageSize}
                                                                selected={config.model === model.id}
                                                                isLast={idx === otherList.length - 1}
                                                                description={truncateModelDescription(model.resolvedDescription, 40)}
                                                                isMobile={true}
                                                                onSelect={(m) => {
                                                                    handleSelectPromptBarModel(m);
                                                                    setMobileSubView('input');
                                                                }}
                                                                onOpenContextMenu={handlePromptBarModelContextMenu}
                                                            />
                                                        </SwipeableModelItem>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }

                                    // 2. 无搜索且有多个供应商：显示二级分类导航视图
                                    if (mobileActiveProvider === null) {
                                        // 第一层：供应商分类选择列表
                                        return (
                                            <div className="flex-1 overflow-y-auto p-1.5 space-y-3" style={{ touchAction: mobileDragMode ? 'none' : 'pan-y' }}>
                                                {/* (A) 系统积分模型（置于最上方） */}
                                                {systemExclusiveModels.length > 0 && (
                                                    <div className="kk-prompt-bar-deep-model-section space-y-1 p-2 rounded-2xl">
                                                        <div className="text-[10px] font-bold text-[var(--text-secondary)] px-1 pb-1 flex items-center gap-1">
                                                            <span>✨ 系统智能积分模型</span>
                                                            <span className="text-[9px] bg-[color:var(--accent-coral)]/10 text-[color:var(--accent-coral)] px-1 rounded">官方信道</span>
                                                        </div>
                                                        {systemExclusiveModels.map((model) => (
                                                            <div 
                                                                key={model.id}
                                                                className={`kk-prompt-bar-deep-model-item rounded-xl transition-all ${config.model === model.id ? 'kk-prompt-bar-deep-model-item--active' : ''}`}
                                                            >
                                                                <PromptBarModelMenuButton
                                                                    model={model}
                                                                    imageSize={config.imageSize}
                                                                    selected={config.model === model.id}
                                                                    isLast={false}
                                                                    description={truncateModelDescription(model.resolvedDescription, 40)}
                                                                    isMobile={true}
                                                                    onSelect={(m) => {
                                                                        handleSelectPromptBarModel(m);
                                                                        setMobileSubView('input');
                                                                    }}
                                                                    onOpenContextMenu={handlePromptBarModelContextMenu}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* (B) 供应商组列表 */}
                                                <div className="space-y-1.5">
                                                    <div className="text-[10px] font-bold text-[var(--text-tertiary)] px-1 flex items-center gap-1">
                                                        <span>模型供应商列表 (长按3秒进入拖动排序)</span>
                                                        <div className="flex-1 h-[1px] bg-[var(--frost-card-sub-border)] ml-1" />
                                                    </div>

                                                    {normalGroups.map((group, index) => {
                                                        const isSortingThis = activeSortProvider === group.provider;
                                                        const pinnedCount = group.models.filter(m => m.isPinned).length;
                                                        
                                                        const handleProviderTouchStart = (e: React.TouchEvent) => {
                                                            if (mobileDragMode) return;
                                                            if (mobileTouchTimerRef.current) {
                                                                clearTimeout(mobileTouchTimerRef.current);
                                                            }
                                                            
                                                            mobileTouchTimerRef.current = setTimeout(() => {
                                                                setMobileDragMode(true);
                                                                setActiveSortProvider(group.provider);
                                                                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                                                                    navigator.vibrate([100, 50, 100]);
                                                                }
                                                            }, 3000);
                                                        };

                                                        const handleProviderTouchMove = (e: React.TouchEvent) => {
                                                            if (!mobileDragMode) {
                                                                if (mobileTouchTimerRef.current) {
                                                                    clearTimeout(mobileTouchTimerRef.current);
                                                                    mobileTouchTimerRef.current = null;
                                                                }
                                                                return;
                                                            }
                                                            
                                                            if (e.cancelable) {
                                                                e.preventDefault();
                                                            }
                                                            
                                                            const touch = e.touches[0];
                                                            const elem = document.elementFromPoint(touch.clientX, touch.clientY);
                                                            if (!elem) return;
                                                            
                                                            const providerCard = elem.closest('[data-provider]');
                                                            if (providerCard) {
                                                                const targetProvider = providerCard.getAttribute('data-provider');
                                                                if (targetProvider && targetProvider !== activeSortProvider) {
                                                                    const currentOrder = normalGroups.map(g => g.provider);
                                                                    const activeIndex = currentOrder.indexOf(activeSortProvider!);
                                                                    const targetIndex = currentOrder.indexOf(targetProvider);
                                                                    
                                                                    if (activeIndex !== -1 && targetIndex !== -1) {
                                                                        const nextOrder = [...currentOrder];
                                                                        nextOrder[activeIndex] = targetProvider;
                                                                        nextOrder[targetIndex] = activeSortProvider!;
                                                                        updateProviderOrder(nextOrder);
                                                                        justDraggedRef.current = true;
                                                                        
                                                                        if (typeof navigator !== 'undefined' && navigator.vibrate) {
                                                                            navigator.vibrate(15);
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        };

                                                        const handleProviderTouchEnd = () => {
                                                            if (mobileTouchTimerRef.current) {
                                                                clearTimeout(mobileTouchTimerRef.current);
                                                                mobileTouchTimerRef.current = null;
                                                            }
                                                            if (mobileDragMode) {
                                                                justDraggedRef.current = true;
                                                                setTimeout(() => {
                                                                    justDraggedRef.current = false;
                                                                }, 100);
                                                                
                                                                setMobileDragMode(false);
                                                                setActiveSortProvider(null);
                                                                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                                                                    navigator.vibrate(50);
                                                                }
                                                            }
                                                        };

                                                        return (
                                                            <div
                                                                key={group.provider}
                                                                data-provider={group.provider}
                                                                onTouchStart={handleProviderTouchStart}
                                                                onTouchEnd={handleProviderTouchEnd}
                                                                onTouchCancel={handleProviderTouchEnd}
                                                                onTouchMove={handleProviderTouchMove}
                                                                onClick={() => {
                                                                    if (mobileDragMode || justDraggedRef.current) {
                                                                        return;
                                                                    }
                                                                    // 🚀 [优化] 如果该供应商下只有一个模型，点击时直接选择该模型并关闭菜单，无需进入二级菜单
                                                                    if (group.models.length === 1) {
                                                                        handleSelectPromptBarModel(group.models[0]);
                                                                    } else {
                                                                        setMobileActiveProvider(group.provider);
                                                                    }
                                                                }}
                                                                className={`kk-prompt-bar-deep-provider-row flex items-center justify-between p-3 rounded-xl transition-all duration-200 select-none cursor-pointer
                                                                    ${isSortingThis
                                                                        ? 'kk-prompt-bar-deep-provider-row--dragged scale-[1.03] relative z-20 active-drag-card'
                                                                        : mobileDragMode
                                                                            ? 'opacity-40 scale-[0.97]'
                                                                            : 'active:scale-[0.98]'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <div className="w-7 h-7 rounded-lg bg-[var(--frost-card-sub-bg)] flex items-center justify-center flex-shrink-0">
                                                                        <ModelLogo
                                                                            modelId=""
                                                                            provider={group.provider}
                                                                            size={20}
                                                                        />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                                                                            {group.providerDisplayName}
                                                                        </div>
                                                                        <div className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1.5 mt-0.5">
                                                                            <span>{group.models.length} 个模型</span>
                                                                            {pinnedCount > 0 && (
                                                                                <span className="text-[color:var(--accent-coral)] font-semibold flex items-center gap-0.5">
                                                                                    📌 {pinnedCount} 置顶
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* 右侧交互控件 */}
                                                                {mobileDragMode ? (
                                                                    isSortingThis ? (
                                                                        <div className="flex items-center gap-1 text-[color:var(--accent-coral)] animate-pulse" onClick={(e) => e.stopPropagation()}>
                                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                                                                            </svg>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1 text-[var(--text-tertiary)] opacity-20">
                                                                            {/* 非拖拽项 */}
                                                                        </div>
                                                                    )
                                                                ) : (
                                                                    <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
                                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                                        </svg>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    } else {
                                        // 第二层：该供应商内的模型子列表页
                                        const currentGroup = normalGroups.find(g => g.provider === mobileActiveProvider);
                                        if (!currentGroup) return null;

                                        const pinnedList = currentGroup.models.filter(m => m.isPinned);
                                        const otherList = currentGroup.models.filter(m => !m.isPinned);

                                        return (
                                            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                                                {/* 返回导航栏 */}
                                                <div className="flex items-center gap-2 border-b border-[var(--frost-card-sub-border)] py-1.5 shrink-0">
                                                    <button
                                                        data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.closeProviderModels.uiAction}
                                                        onClick={() => setMobileActiveProvider(null)}
                                                        className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] text-[var(--text-secondary)] flex items-center gap-1 active:scale-95"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                                                        </svg>
                                                        <span>返回</span>
                                                    </button>
                                                    <span className="text-xs font-extrabold text-[var(--text-primary)]">
                                                        {currentGroup.providerDisplayName}
                                                    </span>
                                                </div>

                                                {/* 滚动模型列表 */}
                                                <div className="flex-1 overflow-y-auto p-1.5 space-y-3 mt-1.5" style={{ touchAction: 'pan-y' }}>
                                                    {pinnedList.length > 0 && (
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] font-bold text-[color:var(--accent-coral)] px-1.5 flex items-center gap-1">
                                                                <span>📌 已置顶模型</span>
                                                                <div className="flex-1 h-[1px] bg-[var(--frost-card-sub-border)] ml-1" />
                                                            </div>
                                                            {pinnedList.map((model, idx) => (
                                                                <SwipeableModelItem
                                                                    key={`pinned-sub-${model.id}`}
                                                                    modelId={model.id}
                                                                    isPinned={true}
                                                                    onTogglePin={handleTogglePin}
                                                                    selected={config.model === model.id}
                                                                    isExclusive={model.isExclusive}
                                                                    isSystemInternal={model.isSystemInternal}
                                                                    onClick={() => {
                                                                        handleSelectPromptBarModel(model);
                                                                        setMobileSubView('input');
                                                                    }}
                                                                >
                                                                    <PromptBarModelMenuButton
                                                                        model={model}
                                                                        imageSize={config.imageSize}
                                                                        selected={config.model === model.id}
                                                                        isLast={idx === pinnedList.length - 1}
                                                                        description={truncateModelDescription(model.resolvedDescription, 40)}
                                                                        isMobile={true}
                                                                        onSelect={(m) => {
                                                                            handleSelectPromptBarModel(m);
                                                                            setMobileSubView('input');
                                                                        }}
                                                                        onOpenContextMenu={handlePromptBarModelContextMenu}
                                                                    />
                                                                </SwipeableModelItem>
                                                            ))}
                                                        </div>
                                                    )}
                                                    
                                                    <div className="space-y-1">
                                                        {pinnedList.length > 0 && (
                                                            <div className="text-[10px] font-bold text-[var(--text-tertiary)] px-1.5 flex items-center gap-1 pt-1">
                                                                <span>所有模型</span>
                                                                <div className="flex-1 h-[1px] bg-[var(--frost-card-sub-border)] ml-1" />
                                                            </div>
                                                        )}
                                                        {otherList.map((model, idx) => (
                                                            <SwipeableModelItem
                                                                key={`other-sub-${model.id}`}
                                                                modelId={model.id}
                                                                isPinned={false}
                                                                onTogglePin={handleTogglePin}
                                                                selected={config.model === model.id}
                                                                isExclusive={model.isExclusive}
                                                                isSystemInternal={model.isSystemInternal}
                                                                onClick={() => {
                                                                    handleSelectPromptBarModel(model);
                                                                    setMobileSubView('input');
                                                                }}
                                                            >
                                                                <PromptBarModelMenuButton
                                                                    model={model}
                                                                    imageSize={config.imageSize}
                                                                    selected={config.model === model.id}
                                                                    isLast={idx === otherList.length - 1}
                                                                    description={truncateModelDescription(model.resolvedDescription, 40)}
                                                                    isMobile={true}
                                                                    onSelect={(m) => {
                                                                        handleSelectPromptBarModel(m);
                                                                        setMobileSubView('input');
                                                                    }}
                                                                    onOpenContextMenu={handlePromptBarModelContextMenu}
                                                                />
                                                            </SwipeableModelItem>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                })()}
                            </div>
                        </div>
                    )}

                    {/* 🚀 移动端高级参数设置内嵌独显面板 */}
                    {mobileSubView === 'settings' && (
                        <div 
                            className="flex flex-col h-[300px] w-full min-w-0 overflow-hidden"
                            style={{ touchAction: 'pan-y' }}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                        >
                            {/* 顶部标题栏 */}
                            <div className="flex items-center justify-between border-b border-[var(--frost-card-sub-border)] pb-2 shrink-0">
                                <span className="text-xs font-bold text-[var(--text-primary)]">高级设置选项</span>
                                <button
                                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.collapseMobileComposer.uiAction}
                                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] text-[var(--accent-coral)] active:scale-95"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMobileSubView('input');
                                    }}
                                >
                                    完成
                                </button>
                            </div>

                            {/* 设置内容滚动区 */}
                            <div className="flex-1 overflow-y-auto mt-2 pb-2 overscroll-contain px-0.5">
                                {config.mode === GenerationMode.AUDIO ? (
                                    <div className="w-full p-2 rounded-xl border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)]">
                                        <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">音频时长</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['自动', '30s', '60s', '120s', '240s'].map(dur => (
                                                <button
                                                    key={dur}
                                                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.selectAudioDuration.uiAction}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${(config.audioDuration || '自动') === dur
                                                        ? 'bg-[var(--prompt-bar-shell-hover)] text-[var(--text-primary)] border-[var(--prompt-bar-shell-border-strong)]'
                                                        : 'bg-[var(--frost-input-bg)] text-[var(--text-secondary)] border-[color:var(--frost-card-sub-border)] hover:border-[var(--prompt-bar-shell-border-strong)]'
                                                        }`}
                                                    onClick={() => updateConfigFields({ audioDuration: dur === '自动' ? undefined : dur })}
                                                >
                                                    {dur}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (config.mode === GenerationMode.IMAGE || config.mode === GenerationMode.PPT || config.mode === GenerationMode.ECOMMERCE) ? (
                                    <React.Suspense fallback={null}>
                                        <ImageOptionsPanel
                                            aspectRatio={config.aspectRatio}
                                            imageSize={config.imageSize}
                                            onAspectRatioChange={(ratio) => updateConfigFields({ aspectRatio: ratio })}
                                            onImageSizeChange={(size) => updateConfigFields({ imageSize: size })}
                                            availableRatios={availableRatios}
                                            availableSizes={availableSizes}
                                            ecommerceSheetSettings={config.mode === GenerationMode.ECOMMERCE ? ecommerceSheetSettings : undefined}
                                            onUpdateEcommerceSheetSetting={config.mode === GenerationMode.ECOMMERCE ? onUpdateEcommerceSheetSetting : undefined}
                                            activeEcommerceSheet={config.mode === GenerationMode.ECOMMERCE ? activeEcommerceFooterSheet : undefined}
                                            onActiveEcommerceSheetChange={config.mode === GenerationMode.ECOMMERCE ? onActivateEcommerceGroupSheet : undefined}
                                        />
                                    </React.Suspense>
                                ) : (
                                    <React.Suspense fallback={null}>
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
                                    </React.Suspense>
                                )}
                            </div>
                        </div>
                    )}
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
            </div>
        );
    }


    return (
        <>
            <div
                id="prompt-bar-container"
                className={`input-bar ${isMobile ? 'ios-mobile-prompt' : ''} ${(isModelMenuOpen || showOptionsPanel) ? 'has-open-dropdown' : ''} transition-all duration-300 !overflow-visible ${isMobile && mobileShellMode === 'embedded' ? 'w-full max-w-full' : 'w-[calc(100vw-32px)] max-w-[760px]'}`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={isMobile ? mobileStyle : { 
                    bottom: '32px',
                    left: isChatOpen ? `calc(50% - ${chatSidebarWidth / 2}px)` : '50%',
                    transform: 'translateX(-50%)',
                    transition: 'left 0.3s ease-out'
                }}
            >
                {/* Drag Overlay */}
                {isDragging && (
                    <div
                        className="absolute inset-0 z-50 rounded-[inherit] flex items-center justify-center animate-fadeIn pointer-events-none"
                        style={{
                            border: '1px solid var(--frost-card-framework-border)',
                            background: 'var(--frost-card-framework-bg)',
                            boxShadow: 'var(--frost-card-framework-shadow)',
                            backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
                        }}
                    >
                        <span className="font-bold text-sm text-[var(--text-primary)]">{dragOverlayLabel}</span>
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
                            <button
                                data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.clearSource.uiAction}
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
                        </div>
                    )}

                    {/* Top Controls Row: desktop keeps tools visible; embedded mobile only keeps the mode strip */}
                    <PromptBarTopRow isMobile={isMobile}>
                        <div data-mobile-composer-section="mode-strip" className="min-w-0 flex items-center justify-between w-full">
                            <DesktopComposerModeSwitcher
                                isMobile={isMobile}
                                activeMode={activeModeOption.mode}
                                modeOptions={filteredModeOptions}
                                onSelectMode={handleSelectPromptBarMode}
                            />
                            {isMobile && (
                                <button
                                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.collapseMobileComposer.uiAction}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] text-[var(--text-secondary)] shadow-sm active:scale-95 transition-all duration-200"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsExpanded(false);
                                        textareaRef.current?.blur();
                                    }}
                                    title="收起输入面板"
                                >
                                    <ChevronDown size={16} />
                                </button>
                            )}
                        </div>

                        {!isEmbeddedMobileComposer && !isMobile && (
                            <div className={`relative flex items-center gap-1 ${isMobile ? 'flex-wrap' : ''}`}>
                                <DesktopComposerPromptTools
                                    isMobile={isMobile}
                                    config={config}
                                    showPptOutlinePanel={showPptOutlinePanel}
                                    onTogglePptOutlinePanel={handleTogglePptOutlinePanel}
                                    onTogglePromptOptimization={handleTogglePromptOptimization}
                                    onSelectPromptOptimizerArchetype={handleSelectPromptOptimizerArchetype}
                                />

                                {showPptOutlinePanel && config.mode === GenerationMode.PPT && (
                                    <div className="absolute bottom-full right-0 mb-2 z-40 w-[min(38rem,92vw)] rounded-2xl border  p-2" style={{ backgroundColor: 'var(--frost-card-framework-bg)', borderColor: 'var(--frost-card-framework-border)' }}>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div>
                                            <div className="text-xs font-semibold text-[var(--text-primary)]">PPT页纲（每行一页）</div>
                                            <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">主题 → 大纲 → 页面描述 → 生成前检查</div>
                                        </div>
                                        <div className="text-[10px] text-[var(--text-tertiary)]">{Math.min(20, parsePptSlides(pptOutlineDraft).length)} / 20 页，生成结果按图1~图N命名</div>
                                    </div>
                                    <div className="mb-2 rounded-xl border px-2.5 py-2 text-[10px] text-[var(--text-secondary)]" style={{ borderColor: 'var(--frost-card-sub-border)', backgroundColor: 'var(--frost-card-sub-bg)' }}>
                                        <div>Markdown / JSON 页纲导入</div>
                                        <div className="mt-1">页面描述列表会直接进入 deck 模块，生成前检查会同步页数、风格锁定和主题一致性。</div>
                                    </div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <button
                                            data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.togglePptStyleLock.uiAction}
                                            className={`px-2 py-1 rounded-md text-[11px] border ${config.pptStyleLocked !== false ? 'border-[color:var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] text-[var(--accent-coral)]' : 'border-[color:var(--frost-card-sub-border)] text-[var(--text-secondary)]'}`}
                                            onClick={() => setConfig(prev => ({ ...prev, pptStyleLocked: !(prev.pptStyleLocked !== false) }))}
                                            title="锁定整套PPT视觉风格一致性"
                                        >
                                            风格锁定 {config.pptStyleLocked !== false ? 'ON' : 'OFF'}
                                        </button>
                                        <div className="text-[10px] text-[var(--text-tertiary)]">ON 更偏向整套视觉一致，OFF 允许单页变化</div>
                                    </div>
                                    <div className="flex items-center gap-1 mb-2">
                                        <button data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.appendPptTemplateSlide.uiAction} className="px-2 py-1 rounded-md text-[10px] border border-[color:var(--frost-card-sub-border)] text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]" onClick={() => appendPptTemplateSlide('cover')}>+封面</button>
                                        <button data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.appendPptTemplateSlide.uiAction} className="px-2 py-1 rounded-md text-[10px] border border-[color:var(--frost-card-sub-border)] text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]" onClick={() => appendPptTemplateSlide('agenda')}>+目录</button>
                                        <button data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.appendPptTemplateSlide.uiAction} className="px-2 py-1 rounded-md text-[10px] border border-[color:var(--frost-card-sub-border)] text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]" onClick={() => appendPptTemplateSlide('section')}>+章节</button>
                                        <button data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.appendPptTemplateSlide.uiAction} className="px-2 py-1 rounded-md text-[10px] border border-[color:var(--frost-card-sub-border)] text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]" onClick={() => appendPptTemplateSlide('summary')}>+总结</button>
                                    </div>
                                    <textarea
                                        value={pptOutlineDraft}
                                        onChange={(e) => setPptOutlineDraft(e.target.value)}
                                        className="w-full h-44 rounded-lg border p-2 text-xs outline-none resize-none"
                                        style={{ backgroundColor: 'var(--frost-card-sub-bg)', borderColor: 'var(--frost-card-sub-border)', color: 'var(--text-primary)' }}
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
                                                            ? 'var(--mobile-clay-active-border)'
                                                            : 'var(--border-light)',
                                                        backgroundColor: (pptDropIndex === idx && pptDragIndex !== null && pptDragIndex !== idx)
                                                            ? 'var(--state-info-bg)'
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
                                                        <div className="absolute left-1 right-1 -top-[1px] h-[2px] rounded-full bg-[var(--accent-coral)] pointer-events-none" />
                                                    )}
                                                    <span className="text-[10px] w-4 shrink-0 text-[var(--text-tertiary)] cursor-grab">⋮</span>
                                                    <span className="text-[10px] text-[var(--accent-coral)] w-8 shrink-0">图{idx + 1}</span>
                                                    <span className="text-[11px] text-[var(--text-secondary)] truncate flex-1" title={line}>{line}</span>
                                                    <button
                                                        data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.movePptSlide.uiAction}
                                                        className="text-[10px] px-1 py-0.5 rounded border border-[color:var(--frost-card-sub-border)]"
                                                        style={{ color: 'var(--text-secondary)' }}
                                                        onClick={() => movePptSlide(idx, -1)}
                                                        title="上移"
                                                    >↑</button>
                                                    <button
                                                        data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.movePptSlide.uiAction}
                                                        className="text-[10px] px-1 py-0.5 rounded border border-[color:var(--frost-card-sub-border)]"
                                                        style={{ color: 'var(--text-secondary)' }}
                                                        onClick={() => movePptSlide(idx, 1)}
                                                        title="下移"
                                                    >↓</button>
                                                    <button
                                                        data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.removePptSlide.uiAction}
                                                        className="text-[10px] px-1 py-0.5 rounded border border-red-500/30"
                                                        style={{ color: '#fca5a5' }}
                                                        onClick={() => removePptSlide(idx)}
                                                        title="删除此页"
                                                    >删</button>
                                                    <button
                                                        data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.insertPptSlide.uiAction}
                                                        className="text-[10px] px-1 py-0.5 rounded border border-[color:var(--frost-card-sub-border)]"
                                                        style={{ color: '#7dd3fc' }}
                                                        onClick={() => insertPptSlideAfter(idx)}
                                                        title="在后方插入新页"
                                                    >+</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1 mt-2">
                                        <input
                                            ref={pptOutlineImportInputRef}
                                            type="file"
                                            accept=".json,.md,.markdown,.txt"
                                            className="hidden"
                                            onChange={handlePptOutlineImportFile}
                                        />
                                        <button
                                            data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.importPptOutline.uiAction}
                                            className="px-2 py-1 rounded-md text-[11px] border border-[color:var(--frost-card-sub-border)] hover:bg-[var(--toolbar-hover)]"
                                            style={{ color: 'var(--text-secondary)' }}
                                            onClick={openPptOutlineImport}
                                        >
                                            导入 Markdown / JSON
                                        </button>
                                        <button
                                            data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.generatePptOutline.uiAction}
                                            className="px-2 py-1 rounded-md text-[11px] border border-[color:var(--frost-card-sub-border)] hover:bg-[var(--toolbar-hover)]"
                                            style={{ color: 'var(--text-secondary)' }}
                                            onClick={generatePptOutlineByTopic}
                                        >
                                            按主题拆页
                                        </button>
                                        <button
                                            data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.exportPptOutline.uiAction}
                                            className="px-2 py-1 rounded-md text-[11px] border border-[color:var(--frost-card-sub-border)] hover:bg-[var(--toolbar-hover)]"
                                            style={{ color: 'var(--text-secondary)' }}
                                            onClick={exportPptOutlineJson}
                                        >
                                            导出JSON
                                        </button>
                                        <button
                                            data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.clearPptOutline.uiAction}
                                            className="px-2 py-1 rounded-md text-[11px] border border-[color:var(--frost-card-sub-border)] hover:bg-[var(--toolbar-hover)]"
                                            style={{ color: 'var(--text-secondary)' }}
                                            onClick={() => setPptOutlineDraft('')}
                                        >
                                            清空
                                        </button>
                                        <button
                                            data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.applyPptOutline.uiAction}
                                            className="ml-auto px-2 py-1 rounded-md text-[11px] border border-[color:var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)]"
                                            style={{ color: 'var(--accent-coral)' }}
                                            onClick={applyPptOutlineDraft}
                                        >
                                            生成前检查
                                        </button>
                                    </div>

                                    {/* AI 大纲精炼微调输入区 */}
                                    <div className="mt-3 pt-3 border-t border-[color:var(--frost-card-sub-border)] flex flex-col gap-2">
                                        <div className="text-[10px] font-semibold text-[var(--text-secondary)] flex justify-between items-center">
                                            <span>AI 智能微调大纲</span>
                                            {isRefining && <span className="text-indigo-400 animate-pulse">正在精炼中...</span>}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={refineQuery}
                                                onChange={(e) => setRefineQuery(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !isRefining) {
                                                        handleRefinePptOutline();
                                                    }
                                                }}
                                                placeholder="输入微调意见，例如：增加第3页的要点，或者删去封面"
                                                className="flex-1 rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
                                                style={{
                                                    backgroundColor: 'var(--frost-card-sub-bg)',
                                                    borderColor: 'var(--frost-card-sub-border)',
                                                    color: 'var(--text-primary)',
                                                }}
                                            />
                                            <button
                                                data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.refinePptOutline.uiAction}
                                                onClick={handleRefinePptOutline}
                                                disabled={isRefining || !refineQuery.trim()}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                                                    isRefining || !refineQuery.trim()
                                                        ? 'bg-slate-700 text-white/40 cursor-not-allowed'
                                                        : 'bg-[var(--accent-coral)] hover:opacity-90 text-white cursor-pointer'
                                                }`}
                                            >
                                                发送
                                            </button>
                                        </div>
                                    </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </PromptBarTopRow>

                    <div>
                        {/* Reference Images List */}
                        {!isMobile && config.mode !== GenerationMode.ECOMMERCE && ((config.referenceImages && config.referenceImages.length > 0) || uploadingCount > 0) && (
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
                                                <div className="w-12 h-12 rounded-lg border-2 border-dashed border-[color:var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)]"></div>
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
                                                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.removeReferenceImage.uiAction}
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
                                    <div key={`uploading-${idx}`} className="relative w-12 h-12 rounded-lg border-2 border-dashed border-[color:var(--frost-card-sub-border)] flex items-center justify-center bg-[var(--frost-card-sub-bg)] overflow-hidden flex-shrink-0 animate-pulse">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-[var(--text-tertiary)]">
                                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                        </svg>
                                    </div>
                                ))}

                                <div
                                    id="spacer"
                                    className={`transition-all duration-300 ease-[cubic-bezier(0.25, 1, 0.5, 1)] rounded-lg overflow-hidden ${dropTargetIndex === config.referenceImages.length ? 'w-12 opacity-100 h-12' : 'w-0 opacity-0 h-0'}`}
                                >
                                    <div className="w-12 h-12 rounded-lg border-2 border-dashed border-[color:var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)]"></div>
                                </div>

                                {/* Upload Button - At the end of reference images row - 始终显示 */}
                                <button
                                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.addReferenceImage.uiAction}
                                    className="w-12 h-12 rounded-md transition-all duration-200 border hover:bg-[var(--toolbar-hover)] flex items-center justify-center flex-shrink-0 opacity-60 hover:opacity-100"
                                    style={{
                                        backgroundColor: 'var(--frost-card-sub-bg)',
                                        color: 'var(--text-secondary)',
                                        borderColor: 'var(--frost-card-sub-border)'
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
                        {shouldRenderStandaloneUploadRow && (
                            <div className="flex items-center p-2 px-3 mt-1">
                                <button
                                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.addReferenceImage.uiAction}
                                    className="w-12 h-12 rounded-lg transition-all border-2 border-dashed hover:bg-[var(--toolbar-hover)] flex items-center justify-center flex-shrink-0 opacity-40 hover:opacity-80"
                                    style={{
                                        color: 'var(--text-secondary)',
                                        borderColor: 'var(--frost-card-sub-border)'
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

                        <React.Suspense fallback={null}>
                            <DesktopComposerEcommercePanel
                                config={config}
                                requirementFileName={ecommerceRequirementFileName}
                                productFileCount={ecommerceProductFileCount}
                                extraReferenceCount={ecommerceExtraReferenceCount}
                                 productFiles={ecommerceProductFiles}
                                 extraReferenceFiles={ecommerceExtraReferenceFiles}
                                 itemReferenceFiles={ecommerceItemReferenceFiles}
                                 ecommerceAnalysis={ecommerceAnalysis}
                                ecommerceSelection={ecommerceSelection}
                                taskStates={ecommerceTaskStates}
                                groupSlots={ecommerceGroupSlots}
                                activeTaskState={ecommerceActiveTaskState}
                                activeFrameworkId={ecommerceActiveFrameworkId}
                                frameworkSummary={ecommerceFrameworkSummary}
                                analysisConfirmed={ecommerceAnalysisConfirmed}
                                confirmingAnalysis={ecommerceConfirmingAnalysis}
                                activeGroupSheet={ecommerceActiveGroupSheet}
                                ecommerceAnalyzing={ecommerceAnalyzing}
                                onPickRequirementFile={onPickEcommerceRequirementFile}
                                onPickProductFiles={onPickEcommerceProductFiles}
                                onPickExtraReferenceFiles={onPickEcommerceExtraReferenceFiles}
                                onClearRequirementFile={onClearEcommerceRequirementFile}
                                 onRemoveProductFile={onRemoveEcommerceProductFile}
                                 onRemoveExtraReferenceFile={onRemoveEcommerceExtraReferenceFile}
                                 onPickItemReferenceFiles={onPickEcommerceItemReferenceFiles}
                                 onRemoveItemReferenceFile={onRemoveEcommerceItemReferenceFile}
                                 onAnalyzeFile={onAnalyzeEcommerceFile || onGenerate}
                                onResetAnalysis={onResetEcommerceAnalysis}
                                onConfirmAnalysis={onConfirmEcommerceAnalysis}
                                onToggleSelection={onToggleEcommerceSelection}
                                onActivateGroupSheet={onActivateEcommerceGroupSheet}
                                onActivateTaskBySourceKey={onActivateEcommerceTaskBySourceKey}
                                onPreviewSlotHistory={onPreviewEcommerceSlotHistory}
                                onTaskStateChange={onChangeEcommerceTaskState}
                            />
                        </React.Suspense>

                        {/* Text Input Area */}
                        <div
                            data-mobile-composer-section="primary-input"
                            className={[
                                'relative',
                                shouldUseMobileInlineMedia && !isEmbeddedMobileComposer ? 'relative mt-1 flex items-center gap-2 px-3' : '',
                                isEmbeddedMobileComposer
                                    ? 'relative mt-2 flex items-center gap-2 rounded-[22px] border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] px-3 py-2.5'
                                    : '',
                            ].filter(Boolean).join(' ')}
                        >
                            {shouldRenderMobileReferenceTray && (
                                <div
                                    className="flex max-w-[8.25rem] shrink-0 items-center gap-1.5 overflow-x-auto overflow-y-hidden pr-1 scrollbar-none"
                                    style={{
                                        WebkitOverflowScrolling: 'touch',
                                        overscrollBehaviorX: 'contain',
                                        touchAction: 'pan-x',
                                    }}
                                    aria-label="手机端参考图"
                                >
                                    {config.referenceImages.map((img) => (
                                        <div key={`mobile-reference-${img.id}`} className="relative h-12 w-12 shrink-0">
                                            <ReferenceThumbnail
                                                image={img}
                                                onRecovered={handleReferenceRecovered}
                                                onClick={handleReferencePreview}
                                            />
                                            <button
                                                data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.removeReferenceImage.uiAction}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeReferenceImage(img.id);
                                                }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm"
                                                title="移除参考图"
                                            >
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                            </button>
                                        </div>
                                    ))}

                                    {Array.from({ length: uploadingSkeletonCount }).map((_, idx) => (
                                        <div key={`mobile-uploading-${idx}`} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-[color:var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)]">
                                            <Loader2 size={16} className="animate-spin text-[var(--text-tertiary)]" />
                                        </div>
                                    ))}

                                    <button
                                        data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.addReferenceImage.uiAction}
                                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border opacity-70 transition-all duration-200 hover:bg-[var(--toolbar-hover)] hover:opacity-100"
                                        style={{
                                            backgroundColor: 'var(--frost-card-sub-bg)',
                                            color: 'var(--text-secondary)',
                                            borderColor: 'var(--frost-card-sub-border)',
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
                            {shouldRenderInlineMobileUploadButton && (
                                <button
                                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.addReferenceImage.uiAction}
                                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-dashed opacity-60 transition-all duration-200 hover:bg-[var(--toolbar-hover)] hover:opacity-100"
                                    style={{
                                        color: 'var(--text-secondary)',
                                        borderColor: 'var(--frost-card-sub-border)',
                                        backgroundColor: 'var(--frost-card-sub-bg)'
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
                            )}
                            <ReferenceMentionPanel
                                open={mentionState.open}
                                query={mentionState.query}
                                tabs={referenceMentionTabs}
                                anchor={mentionState.anchor}
                                onSelect={replaceActiveMentionWithCandidate}
                                onClose={closeReferenceMentionPanel}
                            />
                            <textarea
                                ref={textareaRef}
                                value={promptDraft}
                                onChange={handleInput}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                onFocus={() => {
                                    favoriteComposerRegistry.markFocused('promptbar');
                                    setActiveMenu(null);
                                    onFocus?.(); // 通知侧边栏: 输入框有焦点,不要自动隐藏
                                }}
                                onBlur={() => {
                                    flushPromptDraftToConfig();
                                    onBlur?.(); // 通知侧边栏: 输入框失去焦点,可以自动隐藏
                                }}
                                onCompositionStart={() => { isComposingRef.current = true; }}
                                onCompositionEnd={handleCompositionEnd}
                                placeholder={config.mode === GenerationMode.VIDEO ? "描述你想要生成的视频..." : config.mode === GenerationMode.AUDIO ? "描述你想要生成的音频风格、歌词或旋律..." : config.mode === GenerationMode.PPT ? "输入PPT主题，将批量生成图1~图N页面..." : config.mode === GenerationMode.ECOMMERCE ? (ecommerceAnalysisConfirmed ? "输入补充修改指令，将应用到当前选中的电商任务..." : "上传运营需求文件后，在这里补充额外的电商要求...") : "描述你想要生成的图片..."}
                                className={`input-bar-textarea w-full max-w-full bg-transparent border-none outline-none text-[15px] resize-none box-border overflow-y-auto ${shouldUseMobileInlineMedia ? 'mt-0 min-w-0 flex-1 py-1 px-0' : 'mt-1 py-1 px-3'}`}
                                style={{
                                    color: 'var(--text-primary)', // 使用 CSS 变量适配主题
                                    minHeight: `${PROMPT_TEXTAREA_MIN_HEIGHT_PX}px`,
                                    maxHeight: `${PROMPT_TEXTAREA_MAX_HEIGHT_PX}px`,
                                    lineHeight: `${PROMPT_TEXTAREA_LINE_HEIGHT_PX}px`
                                }}
                                rows={PROMPT_TEXTAREA_MIN_ROWS}
                            />
                        </div>
                    </div> {/* End of input area hover wrapper */}

                    {/* Footer - Modified to be a standard flex row, flowing or wrapping lightly on mobile */}
                    <PromptBarFooter isMobile={isMobile}>
                        <div className={`flex min-w-0 items-center gap-1.5 ${isMobile ? 'flex-1' : 'flex-1'}`}>
                            {/* Model Button */}
                            <div
                                ref={modelMenuAnchorRef}
                                data-mobile-footer-control="model-library"
                                className={isMobile ? 'static min-w-0 flex-1' : `relative inline-flex min-w-0 flex-shrink-0`}
                            >
                                <button
                                    type="button"
                                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.openModelLibrary.uiAction}
                                    className={`input-bar-model ${!isMobile ? 'prompt-bar-liquid-button' : ''} flex min-w-0 items-center flex-nowrap gap-1.5 md:gap-2 px-2 md:px-3 h-10 rounded-lg border transition-all duration-300 overflow-hidden ${isMobile ? 'w-full min-w-0 justify-start' : 'w-auto max-w-[calc(28ch+6rem)] justify-start flex-shrink-0'} ${isModelListEmpty
                                        ? 'bg-[var(--frost-input-bg)] text-[var(--text-tertiary)] cursor-not-allowed border-[color:var(--frost-card-sub-border)]'
                                        : 'text-[var(--text-secondary)] !opacity-100 hover:border-[var(--prompt-bar-shell-border-strong)]'
                                        }`}
                                    style={(() => {
                                        if (isModelListEmpty) {
                                            return {};
                                        }
                                        if (currentModel?.isSystemInternal && currentModel?.colorStart && currentModel?.colorEnd) {
                                            return getCreditModelFlatStyle(
                                                currentModelPrimaryColor,
                                                currentModelSecondaryColor,
                                                currentModel?.textColor,
                                                false,
                                            );
                                        }
                                        return {};
                                    })()}
                                    onMouseEnter={(event) => {
                                        if (currentModel?.isSystemInternal && currentModel?.colorStart && currentModel?.colorEnd) {
                                            const hoverStyle = getCreditModelFlatStyle(
                                                currentModelPrimaryColor,
                                                currentModelSecondaryColor,
                                                currentModel?.textColor,
                                                true,
                                            );
                                            event.currentTarget.style.background = String(hoverStyle.background || '');
                                            event.currentTarget.style.border = String(hoverStyle.border || '');
                                            event.currentTarget.style.boxShadow = String(hoverStyle.boxShadow || '');
                                        }
                                    }}
                                    onMouseLeave={(event) => {
                                        if (currentModel?.isSystemInternal && currentModel?.colorStart && currentModel?.colorEnd) {
                                            const defaultStyle = getCreditModelFlatStyle(
                                                currentModelPrimaryColor,
                                                currentModelSecondaryColor,
                                                currentModel?.textColor,
                                                false,
                                            );
                                            event.currentTarget.style.background = String(defaultStyle.background || '');
                                            event.currentTarget.style.border = String(defaultStyle.border || '');
                                            event.currentTarget.style.boxShadow = String(defaultStyle.boxShadow || '');
                                        }
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()} // 🚀 阻止 mousedown 冒泡，防止被 handleClickOutside 误杀
                                    onClick={(e) => {
                                        e.stopPropagation(); // 🚀 阻止冒泡，防止被 handleClickOutside 误杀
                                        if (isModelListEmpty) {
                                            notify.info('请先配置 API 密钥', '暂无可用模型，已自动为您打开 API 设置面板。');
                                            onOpenSettings?.('api-management');
                                            return;
                                        }
                                        if (isMobile) {
                                            textareaRef.current?.blur();
                                        }
                                        void handleToggleModelLibrary();
                                    }}
                                >
                                    {(() => {
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
                                                    className={`font-bold truncate flex items-center gap-1 min-w-0 ${isMobile ? 'text-[13px]' : 'max-w-[28ch] text-sm'}`}
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
                                 {/* Dropdown Menu */}
                                 {isModelMenuOpen && isMobile && (
                                     <>
                                      {/* 🚀 移动端模型库 Bottom Sheet 蒙层 */}
                                      <div
                                          data-prompt-bar-mobile-model-layer="true"
                                          className="kk-prompt-bar-mobile-model-backdrop"
                                          style={{ zIndex: KK_LAYER.modalBackdrop }}
                                          onClick={(e) => { e.stopPropagation(); setActiveMenu(null); }}
                                          onTouchStart={(e) => e.stopPropagation()}
                                      />
                                      {/* 🚀 移动端模型库 Bottom Sheet 半屏弹窗 */}
                                      <div
                                          data-prompt-bar-mobile-model-layer="true"
                                          className="kk-prompt-bar-mobile-model-sheet-host"
                                          style={{ zIndex: KK_LAYER.modal }}
                                          onTouchStart={(e) => e.stopPropagation()}
                                          onTouchMove={(e) => e.stopPropagation()}
                                          onTouchEnd={(e) => e.stopPropagation()}
                                      >
                                          <div
                                              ref={modelDropdownRef}
                                              className="kk-prompt-bar-mobile-model-sheet"
                                          >
                                              {/* 拖拽手柄条 */}
                                              <div className="flex justify-center pt-3 pb-2">
                                                  <div className="kk-prompt-bar-mobile-model-sheet-handle" />
                                              </div>

                                              {/* 🔍 搜索输入框 */}
                                              {!isModelMenuBootstrapping && filteredDisplayModels.length > 1 && (
                                                  <div 
                                                      className="model-library-surface mx-3 mb-2 p-2.5 border rounded-2xl" 
                                                      style={{ ...modelLibrarySearchSurfaceStyle }}
                                                      onTouchStart={(e) => e.stopPropagation()}
                                                      onTouchMove={(e) => e.stopPropagation()}
                                                      onTouchEnd={(e) => e.stopPropagation()}
                                                  >
                                                      <div className="relative flex items-center">
                                                          <svg className="absolute left-2 w-3.5 h-3.5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                          </svg>
                                                          <input
                                                              type="text"
                                                              value={modelSearch}
                                                              onChange={(e) => setModelSearch(e.target.value)}
                                                              onClick={(e) => e.stopPropagation()}
                                                              onTouchStart={(e) => e.stopPropagation()}
                                                              onTouchMove={(e) => e.stopPropagation()}
                                                              onTouchEnd={(e) => e.stopPropagation()}
                                                              placeholder="搜索模型..."
                                                              className="w-full bg-[var(--frost-input-bg)] text-[var(--text-primary)] text-xs rounded-xl py-1.5 pl-7 pr-2 outline-none border border-transparent focus:border-[var(--frost-input-border)] placeholder-[var(--text-tertiary)]"
                                                              autoFocus
                                                          />
                                                          {modelSearch && (
                                                              <button
                                                                  data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.clearModelSearch.uiAction}
                                                                  onClick={(e) => { e.stopPropagation(); setModelSearch(''); }}
                                                                  onTouchStart={(e) => e.stopPropagation()}
                                                                  onTouchMove={(e) => e.stopPropagation()}
                                                                  onTouchEnd={(e) => e.stopPropagation()}
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

                                              {isModelMenuRefreshingWithCache && (
                                                  <div className="mb-2 flex items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
                                                      <Loader2 size={14} className="animate-spin" />
                                                      <span>正在同步最新模型库...</span>
                                                  </div>
                                              )}

                                              {/* 模型列表滚动区 */}
                                              <div
                                                  ref={modelListScrollRef}
                                                  className="model-library-surface dropdown w-full overflow-y-auto scrollbar-none p-0 relative"
                                                  style={{
                                                      ...modelLibrarySurfaceStyle,
                                                      borderRadius: '0',
                                                      border: 'none',
                                                      boxShadow: 'none',
                                                      maxHeight: '50vh',
                                                      scrollSnapType: 'y mandatory',
                                                      paddingTop: '83px',
                                                      paddingBottom: '83px',
                                                      overscrollBehavior: 'contain',
                                                      scrollbarWidth: 'none',
                                                      touchAction: 'pan-y'
                                                  }}
                                                  onTouchStart={(e) => e.stopPropagation()}
                                                  onTouchMove={(e) => e.stopPropagation()}
                                                  onTouchEnd={(e) => e.stopPropagation()}
                                                  onScroll={(e) => {
                                                      const nextTop = e.currentTarget.scrollTop;
                                                      modelListScrollPos.current = nextTop;
                                                      const nextStartIndex = Math.max(
                                                          0,
                                                          Math.floor(nextTop / MODEL_LIST_ITEM_HEIGHT) - MODEL_LIST_OVERSCAN
                                                      );
                                                      setModelListWindowStart((prev) => prev === nextStartIndex ? prev : nextStartIndex);

                                                      if (isMobile) {
                                                          setMobileScrollTop(nextTop);

                                                          const centerIndex = Math.min(filteredDisplayModels.length - 1, Math.max(0, Math.round(nextTop / MODEL_LIST_ITEM_HEIGHT)));
                                                          const targetModel = filteredDisplayModels[centerIndex];
                                                          if (targetModel && targetModel.id !== config.model) {
                                                              try {
                                                                  if (navigator.vibrate) {
                                                                      navigator.vibrate(5);
                                                                  }
                                                              } catch (err) {}
                                                              handleSelectPromptBarModel(targetModel);
                                                          }
                                                      }
                                                  }}
                                              >
                                                  {isModelMenuBootstrapping ? (
                                                      <div className="py-6 px-4">
                                                          <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
                                                              <Loader2 size={14} className="animate-spin" />
                                                              <span>正在同步最新模型库...</span>
                                                          </div>
                                                          <div className="mt-4 space-y-2">
                                                              {Array.from({ length: MODEL_MENU_SKELETON_COUNT }).map((_, index) => (
                                                                  <div
                                                                      key={`prompt-bar-model-loading-${index}`}
                                                                      className="h-12 rounded-xl bg-[var(--frost-card-sub-bg)] border border-[var(--frost-card-sub-border)] animate-pulse"
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
                                                                  const globalIndex = modelListViewport.startIndex + index;

                                                                  // 🚀 3D 滚轮运动计算
                                                                  const offset = globalIndex * MODEL_LIST_ITEM_HEIGHT - mobileScrollTop;
                                                                  const ratio = offset / MODEL_LIST_ITEM_HEIGHT;
                                                                  const absRatio = Math.min(1.5, Math.abs(ratio));
                                                                  const scale = 1.05 - absRatio * 0.12;
                                                                  const rotateX = ratio * -28;
                                                                  const opacity = 1 - absRatio * 0.45;

                                                                  const itemStyle = isMobile ? {
                                                                      transform: `perspective(500px) rotateX(${rotateX}deg) scale(${scale})`,
                                                                      opacity: opacity,
                                                                      scrollSnapAlign: 'center' as const,
                                                                      height: `${MODEL_LIST_ITEM_HEIGHT}px`,
                                                                      transition: 'transform 0.1s ease-out, opacity 0.1s ease-out',
                                                                      display: 'flex',
                                                                      alignItems: 'center',
                                                                      justifyContent: 'center',
                                                                      contain: 'layout style' as const
                                                                  } : undefined;

                                                                  return (
                                                                      <div key={model.id} style={itemStyle} className="w-full">
                                                                          <PromptBarModelMenuButton
                                                                              model={model}
                                                                              imageSize={config.imageSize}
                                                                              selected={config.model === model.id}
                                                                              isLast={isLast}
                                                                              description={description}
                                                                              isMobile={true}
                                                                              onSelect={handleSelectPromptBarModel}
                                                                              onOpenContextMenu={handlePromptBarModelContextMenu}
                                                                          />
                                                                      </div>
                                                                  );
                                                              })}
                                                              {bottomSpacerHeight > 0 ? <div style={{ height: `${bottomSpacerHeight}px` }} /> : null}
                                                          </>
                                                      );
                                                  })()}
                                              </div>
                                          </div>
                                      </div>
                                     </>
                                 )}
                                {isModelMenuOpen && !isMobile && ReactDOM.createPortal(
                                    <div
                                        ref={modelDropdownRef}
                                        onMouseDown={(e) => e.stopPropagation()} // 🚀 阻止 mousedown 冒泡，防止被 handleClickOutside 误杀
                                        className="kk-prompt-bar-deep-popover-host animate-fadeIn origin-bottom"
                                        style={(() => {
                                            // 基于锚点元素动态计算 Portal 的 fixed 定位坐标
                                            const anchorEl = modelMenuAnchorRef.current;
                                            if (!anchorEl) return { top: 0, left: 0 };
                                            const rect = anchorEl.getBoundingClientRect();
                                            return {
                                                zIndex: PROMPT_BAR_DEEP_DROPDOWN_LAYER,
                                                left: rect.left + rect.width / 2,
                                                top: rect.top - 12, // mb-3 ≈ 12px 间距
                                                transform: 'translateX(-50%) translateY(-100%)',
                                            };
                                        })()}
                                    >
                                        {modelDropdownContent}
                                    </div>,
                                    document.body
                                )}
                            </div >

                            {isEmbeddedMobileComposer ? (
                                <div data-mobile-footer-control="settings" className="w-full">
                                    <MobileEmbeddedAdvancedDrawer
                                        summaryText={mobileAdvancedSummaryText}
                                        promptTools={mobileAdvancedPromptToolsNode}
                                        modePanel={mobileAdvancedModePanelNode}
                                    />
                                </div>
                            ) : null}

                            {/* Options Button - Shows current ratio and size, shrink on mobile */}
                            {!isEmbeddedMobileComposer && (
                                <div data-mobile-footer-control="settings" className={isMobile ? 'shrink-0' : 'contents'}>
                                <DesktopComposerModePanel
                                isMobile={isMobile}
                                config={config}
                                showOptionsPanel={showOptionsPanel}
                                optionsPanelRef={optionsPanelRef}
                                mobileFloatingSheetBottom={mobileFloatingSheetBottom}
                                mobileFloatingSheetMaxHeight={mobileFloatingSheetMaxHeight}
                                onToggleOptionsPanel={() => {
                                    if (isMobile) {
                                        textareaRef.current?.blur();
                                    }
                                    setActiveMenu(null);
                                    setShowOptionsPanel(prev => !prev);
                                }}
                                summaryContent={ecommerceOptionsSummary}
                                optionsPanelContent={config.mode === GenerationMode.AUDIO ? (
                                    <div className="kk-prompt-bar-deep-audio-panel w-56 p-3 rounded-xl animate-scaleIn origin-bottom">
                                        <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">音频时长</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['自动', '30s', '60s', '120s', '240s'].map(dur => (
                                                <button
                                                    key={dur}
                                                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.selectAudioDuration.uiAction}
                                                    className={`kk-prompt-bar-deep-audio-option px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${(config.audioDuration || '自动') === dur
                                                        ? 'kk-prompt-bar-deep-audio-option--active'
                                                        : ''
                                                        }`}
                                                    onClick={() => updateConfigFields({ audioDuration: dur === '自动' ? undefined : dur })}
                                                >
                                                    {dur}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (config.mode === GenerationMode.IMAGE || config.mode === GenerationMode.PPT || config.mode === GenerationMode.ECOMMERCE) ? (
                                    <React.Suspense fallback={null}>
                                        <ImageOptionsPanel
                                            aspectRatio={config.aspectRatio}
                                            imageSize={config.imageSize}
                                            
                                            onAspectRatioChange={(ratio) => updateConfigFields({ aspectRatio: ratio })}
                                            onImageSizeChange={(size) => updateConfigFields({ imageSize: size })}
                                            availableRatios={availableRatios}
                                            availableSizes={availableSizes}
                                            ecommerceSheetSettings={config.mode === GenerationMode.ECOMMERCE ? ecommerceSheetSettings : undefined}
                                            onUpdateEcommerceSheetSetting={config.mode === GenerationMode.ECOMMERCE ? onUpdateEcommerceSheetSetting : undefined}
                                            activeEcommerceSheet={config.mode === GenerationMode.ECOMMERCE ? activeEcommerceFooterSheet : undefined}
                                            onActiveEcommerceSheetChange={config.mode === GenerationMode.ECOMMERCE ? onActivateEcommerceGroupSheet : undefined}
                                        />
                                    </React.Suspense>
                                ) : (
                                    <React.Suspense fallback={null}>
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
                                    </React.Suspense>
                                )}
                                networkControls={!isMobile && (groundingSupported || imageSearchSupported) ? (
                                    <div
                                        className="prompt-bar-liquid-group flex min-w-0 max-w-full shrink items-center gap-1 overflow-hidden rounded-lg border border-[color:var(--frost-card-sub-border)] bg-[var(--frost-input-bg)] px-1 py-0.5 h-10 transition-all duration-200"
                                        style={{
                                            opacity: (config.mode === GenerationMode.VIDEO || config.mode === GenerationMode.AUDIO) ? 0 : 1,
                                            visibility: (config.mode === GenerationMode.VIDEO || config.mode === GenerationMode.AUDIO) ? 'hidden' : 'visible',
                                            pointerEvents: (config.mode === GenerationMode.VIDEO || config.mode === GenerationMode.AUDIO) ? 'none' : 'auto'
                                        }}
                                    >
                                        {groundingSupported && (
                                            <button
                                                data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.toggleGrounding.uiAction}
                                                className={`flex min-w-0 max-w-full items-center justify-center gap-1 overflow-hidden px-2 h-full rounded-md border transition-all text-[11px] font-medium ${config.enableGrounding
                                                    ? 'border-[var(--prompt-bar-toggle-active-border)] bg-[image:var(--prompt-bar-toggle-active-bg)] text-[var(--prompt-bar-toggle-active-text)] shadow-[var(--prompt-bar-toggle-active-shadow)]'
                                                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--prompt-bar-shell-hover)]'
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
                                                data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.toggleImageSearch.uiAction}
                                                className={`flex min-w-0 max-w-full items-center justify-center gap-1 overflow-hidden px-2 h-full rounded-md border transition-all text-[11px] font-medium ${config.enableImageSearch
                                                    ? 'border-[var(--prompt-bar-toggle-active-border)] bg-[image:var(--prompt-bar-toggle-active-bg)] text-[var(--prompt-bar-toggle-active-text)] shadow-[var(--prompt-bar-toggle-active-shadow)]'
                                                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--prompt-bar-shell-hover)]'
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
                                </div>
                            )}
                        </div>

                        <div className={`flex items-center gap-1.5 shrink-0 ${isMobile ? 'justify-end' : 'ml-auto'}`}>
                            {/* Group 2: Generation Settings */}
                            {(isMobile || (!isMobile && config.mode !== GenerationMode.ECOMMERCE)) && (
                                <div className={`${isMobile ? 'flex items-center' : 'prompt-bar-liquid-group flex items-center gap-0.5 rounded-lg border p-0.5 h-10 shrink-0'}`}>
                                    {/* Parallel Count */}
                                    {!isMobile && (
                                        <div className="relative h-full w-[58px]">
                                            <button
                                                data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.toggleParallelCountMenu.uiAction}
                                                className="prompt-bar-liquid-button flex w-full items-center justify-center gap-1.5 px-3 h-full rounded-md transition-all whitespace-nowrap text-[11px] font-medium hover:bg-[var(--toolbar-hover)]"
                                                style={{ color: 'var(--text-secondary)' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleMenu('count');
                                                }}
                                                title="并发数量"
                                            >
                                                <span className="text-[11px] font-medium">{`${config.parallelCount}张`}</span>
                                                <svg className={`w-2.5 h-2.5 opacity-50 flex-shrink-0 transition-transform duration-200 ${activeMenu === 'count' ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                                            </button>
                                            {
                                                activeMenu === 'count' && (
                                                    <div className="absolute bottom-full mb-2" style={{ left: '50%', transform: 'translateX(-50%)', zIndex: PROMPT_BAR_DEEP_DROPDOWN_LAYER }}>
                                                        <div className="kk-prompt-bar-deep-count-popover w-24 animate-scaleIn origin-bottom p-1 flex flex-col gap-1 rounded-xl">
                                                            {(config.mode === GenerationMode.PPT
                                                                ? Array.from({ length: 20 }, (_, i) => i + 1)
                                                                : [1, 2, 3, 4]
                                                            ).map((count) => (
                                                                <button
                                                                    key={count}
                                                                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.selectParallelCount.uiAction}
                                                                    className={`kk-prompt-bar-deep-count-option justify-between rounded-md px-3 py-2 text-xs font-medium ${config.parallelCount === count ? 'kk-prompt-bar-deep-count-option--active' : ''}`}
                                                                    onClick={() => {
                                                                        updateConfigFields({ parallelCount: count as number });
                                                                        setActiveMenu(null);
                                                                    }}
                                                                >
                                                                    <span>{`${count} 张`}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            }
                                        </div>
                                    )}

                                        {/* Context Menu for Pinning */}
                                        {contextMenu && ReactDOM.createPortal(
                                            <div
                                                onMouseDown={(e) => e.stopPropagation()} // 🚀 阻止 mousedown 冒泡，防止被 handleClickOutside 误杀
                                                className="kk-prompt-bar-deep-context-menu"
                                                style={{
                                                    zIndex: PROMPT_BAR_DEEP_DROPDOWN_LAYER,
                                                    top: contextMenu.y,
                                                    left: contextMenu.x,
                                                }}
                                            >
                                                {!isMobile && (
    <button
                                                        data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.toggleModelPin.uiAction}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleModelPin(contextMenu.modelId);
                                                            setContextMenu(null);
                                                        }}
                                                        className="kk-prompt-bar-deep-menu-item flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
                                                    >
                                                        {getPinnedModels().includes(contextMenu.modelId) ? '❌ 取消置顶' : '📌 置顶模型'}
                                                    </button>
)}
                                                <button
                                                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.openModelCustomization.uiAction}
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
                                                    className="kk-prompt-bar-deep-menu-item flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
                                                >
                                                    ⚙️ 设置
                                                </button>
                                            </div>,
                                            document.body
                                        )}

                                        {/* Model Settings Modal */}
                                        {modelSettingsModal && ReactDOM.createPortal(
                                            <div
                                                onMouseDown={(e) => e.stopPropagation()} // 🚀 阻止 mousedown 冒泡，防止被 handleClickOutside 误杀
                                                className="kk-prompt-bar-deep-modal-backdrop"
                                                style={{ zIndex: PROMPT_BAR_DEEP_MODAL_BACKDROP_LAYER }}
                                                onClick={() => setModelSettingsModal(null)}
                                            >
                                                <div
                                                    className="kk-prompt-bar-deep-modal-panel"
                                                    style={{ zIndex: PROMPT_BAR_DEEP_MODAL_PANEL_LAYER }}
                                                    role="dialog"
                                                    aria-modal="true"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <h3 className="text-lg font-bold text-[var(--text-primary)]">模型设置</h3>
                                                        <button
                                                            data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.closeModelCustomization.uiAction}
                                                            onClick={() => setModelSettingsModal(null)}
                                                            className="transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                    <div className="text-xs font-mono break-all text-[var(--text-tertiary)]">ID: {modelSettingsModal.modelId}</div>
                                                    <div>
                                                        <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">显示别名</label>
                                                        <input
                                                            value={modelSettingsModal.alias}
                                                            onChange={(e) => setModelSettingsModal({ ...modelSettingsModal, alias: e.target.value })}
                                                            placeholder="留空则使用默认名称"
                                                            className="kk-prompt-bar-deep-field w-full rounded-lg px-3 py-2 text-sm outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">模型介绍</label>
                                                        <textarea
                                                            value={modelSettingsModal.description}
                                                            onChange={(e) => setModelSettingsModal({ ...modelSettingsModal, description: e.target.value })}
                                                            placeholder="留空则使用默认介绍"
                                                            rows={2}
                                                            className="kk-prompt-bar-deep-field w-full rounded-lg px-3 py-2 text-sm outline-none"
                                                        />
                                                    </div>
                                                    <div className="flex justify-end gap-2 pt-2">
                                                        <button
                                                            data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.cancelModelCustomization.uiAction}
                                                            onClick={() => setModelSettingsModal(null)}
                                                            className="kk-prompt-bar-deep-modal-action px-4 py-2 text-sm transition-colors"
                                                        >
                                                            取消
                                                        </button>
                                                        <button
                                                            data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.saveModelCustomization.uiAction}
                                                            onClick={() => {
                                                                saveModelCustomization(
                                                                    modelSettingsModal.modelId,
                                                                    modelSettingsModal.alias,
                                                                    modelSettingsModal.description
                                                                );
                                                                setModelSettingsModal(null);
                                                            }}
                                                            className="kk-prompt-bar-deep-modal-action kk-prompt-bar-deep-modal-action--primary px-4 py-2 text-sm font-bold"
                                                        >
                                                            保存
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>,
                                            document.body
                                        )}
                                    </div>
                            )}
                        <div data-mobile-footer-control="send" className={isMobile ? 'shrink-0' : 'flex-shrink-0'}>
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
                                ecommerceConfirmedMode={config.mode === GenerationMode.ECOMMERCE && ecommerceAnalysisConfirmed}
                                className={isMobile ? '' : 'prompt-bar-liquid-button prompt-bar-liquid-send'}
                                isMobile={isMobile}
                                parallelCount={config.parallelCount}
                                onChangeParallelCount={(count) => updateConfigFields({ parallelCount: count })}
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
                                    if (isMobile) {
                                        setIsExpanded(false);
                                        textareaRef.current?.blur();
                                    }
                                }}
                            />
                        </div>
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

                {/* 移动端并发数 Action Sheet 浮层 */}
                {isMobile && activeMenu === 'count' && ReactDOM.createPortal(
                    <div 
                        className="kk-prompt-bar-deep-count-sheet-backdrop"
                        style={{ zIndex: PROMPT_BAR_DEEP_SHEET_LAYER }}
                        onClick={() => setActiveMenu(null)}
                    >
                        <div 
                            className="kk-prompt-bar-deep-count-sheet"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-[var(--text-primary)]">选择并发张数</span>
                                <button 
                                    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.toggleParallelCountMenu.uiAction}
                                    className="kk-prompt-bar-deep-modal-action text-xs font-medium px-3.5 py-1.5 rounded-full active:scale-95 transition-all"
                                    onClick={() => setActiveMenu(null)}
                                >
                                    关闭
                                </button>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {(config.mode === GenerationMode.PPT
                                    ? [1, 2, 3, 4, 5, 6, 8, 10]
                                    : [1, 2, 3, 4]
                                ).map((count) => (
                                    <button
                                        key={count}
                                        data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.selectParallelCount.uiAction}
                                        className={`kk-prompt-bar-deep-count-option flex flex-col items-center justify-center py-3 rounded-xl font-semibold transition-all active:scale-95 ${config.parallelCount === count
                                            ? 'kk-prompt-bar-deep-count-option--active'
                                            : ''}`}
                                        onClick={() => {
                                            updateConfigFields({ parallelCount: count });
                                            setActiveMenu(null);
                                        }}
                                    >
                                        <span className="text-base">{count}</span>
                                        <span className="text-[10px] font-normal opacity-70">张</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            </div>
        </>
    );
};

export default PromptBar;
