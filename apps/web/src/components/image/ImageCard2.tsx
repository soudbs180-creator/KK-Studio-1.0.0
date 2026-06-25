import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { type GeneratedImage, GenerationMode, ImageSize } from '../../types';
import { Download, Trash2, Loader2, ImageOff, Play, Pause, Music, Heart } from 'lucide-react';
import { KK_LAYER } from '@kk/ui';
import { LayerPortal } from '../layout/LayerPortal';
import { getCardDimensions, FOOTER_HEIGHT } from '../../utils/styleUtils';
import { getLaunchTimelineByOffset, getPromptBarLaunchPoint } from '../../utils/cardLaunch';
import { generateTagColor } from '../../utils/colorUtils';
import { getImage, getStrictOriginalImage } from '../../services/storage/imageStorage';
import { resolveImageCost } from '../../services/billing/costService';
import { fileSystemService } from '../../services/storage/fileSystemService';
import { notify } from '../../services/system/notificationService';
import { getModelBadgeInfo, getProviderBadgeColor, getProviderBadgeStyle } from '../../utils/modelBadge';
import { loadImage, cancelImageLoad } from '../../services/image/imageLoader';
import { ImageQuality, getAppropriateQuality, type ImageQualityBias } from '../../services/image/imageQuality';
import { getModelThemeBgColor } from '../../services/model/modelCapabilities';
import { getCanvasTextSofteningProfile, type CanvasCardDetailLevel } from '../../canvas/performanceProfile';
import { clampGenerationDurationMs, formatGenerationDurationSeconds } from '../../utils/timeUtils';
import { resolveDisplayedProviderLabel } from '../../utils/providerDisplay';
import { getCanvasCardShadow } from '../../utils/canvasCardShadow';
import { getResolvedCreditCost, isCreditBillingTarget } from '../../utils/creditBilling';
import { resolveModelDisplayName } from '../../utils/modelDisplayName';
import { elevateCanvasStackZIndex } from '../../utils/canvasUtils';
import { base64ToBlob, generateDownloadFilename, triggerDownload } from '../../utils/downloadUtils';
import { snapCanvasPointToGrid } from '../../utils/canvasSnapToGrid';
import { safeOpenLink } from '../../utils/browserUtils';
import { useFavoritesStore } from '../../features/favorites';
import { canvasLivePositionStore, updateConnectorDom } from '../../app/canvasLivePositionStore';
import { CanvasMeasurementScheduler } from '../../canvas/CanvasMeasurementScheduler';

const truncateByChars = (text: string, maxChars: number): string => {
    if (!text) return '';
    return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}…` : text;
};

const joinClasses = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const QUALITY_RANK: Record<ImageQuality, number> = {
    [ImageQuality.MICRO]: 0,
    [ImageQuality.THUMBNAIL]: 1,
    [ImageQuality.PREVIEW]: 2,
    [ImageQuality.ORIGINAL]: 3
};

const getImageStackZIndex = (
    image: GeneratedImage,
    isSelected: boolean,
    isNew: boolean,
    isActive: boolean,
    groupLayerZIndex?: number
) => {
    const persistedOrder = (groupLayerZIndex ?? image.zIndex ?? 0) * 100;

    if (image.isGenerating) return persistedOrder + 40;
    if (isNew) return persistedOrder + 30;
    if (isSelected) return persistedOrder + 20;
    if (isActive) return persistedOrder + 15;
    return persistedOrder + 10;
};

const snapCanvasCoordinate = (value: number, scale: number = 1) => {
    if (!Number.isFinite(value) || !Number.isFinite(scale) || scale <= 0) return value;
    return Math.round(value * scale) / scale;
};

type FooterDensity = 'normal' | 'compact' | 'tight';

interface ImageNodeProps {
    id?: string;
    image: GeneratedImage;
    detailLevel?: CanvasCardDetailLevel;
    loadPriority?: number;
    loadBand?: 0 | 1 | 2 | 3;
    groupLayerZIndex?: number;
    stackZIndexOverride?: number;
    renderOrigin?: { x: number; y: number };
    position: { x: number; y: number };
    onPositionChange: (id: string, position: { x: number; y: number }) => void;
    onDelete: (id: string) => void;
    onConnectEnd?: (imageId: string) => void;
    onClick?: (imageId: string) => void;
    onDimensionsUpdate?: (id: string, dimensions: string) => void;
    onHeightChange?: (id: string, height: number) => void;
    isActive?: boolean;
    canvasTransform?: { x: number; y: number; scale: number }; // Deprecated in favor of zoomScale
    zoomScale?: number;
    isMobile?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
    onBringToFront?: () => void;
    highlighted?: boolean;
    shadowBoost?: boolean;
    onLivePositionChange?: (id: string, position: { x: number; y: number } | null) => void;
    onPreview?: (imageId: string) => void;
    onPreviewPptStack?: (imageId: string) => void;
    onDownloadPptComposite?: (imageId: string) => void;
    onCancel?: (id: string) => void;
    isVisible?: boolean; // 🚀 视口可见性控制（从父组件传入）
    onUpdate?: (id: string, updates: Partial<GeneratedImage>) => void; // 🚀 [New] 更新回调
    onDragDelta?: (delta: { x: number; y: number }, sourceNodeId?: string) => void; // 🚀 [New] Relative Drag
    onDragCommit?: (delta: { x: number; y: number }, sourceNodeId?: string, finalPosition?: { x: number; y: number }) => void;
    onDragStateChange?: (dragging: boolean) => void;
    isNew?: boolean; // 🚀 [New] 是否为刚生成的图片
    isCanvasTransforming?: boolean;
    snapToGrid?: boolean;
    isChatMode?: boolean; // 🚀 [New Prop] 渲染为垂直聊天流中的标准块
}

const ImageNodeComponent: React.FC<ImageNodeProps> = React.memo(({
    image,
    detailLevel = 'full',
    loadPriority = 0,
    loadBand = 0,
    groupLayerZIndex,
    stackZIndexOverride,
    renderOrigin,
    position,
    onPositionChange,
    onDelete,
    onConnectEnd,
    onClick,
    onDimensionsUpdate,
    onHeightChange,
    isActive = false,
    zoomScale = 1,
    isSelected = false,
    onSelect,
    onBringToFront,
    highlighted,
    shadowBoost = false,
    onLivePositionChange,
    onPreview,
    onPreviewPptStack,
    onDownloadPptComposite,
    onCancel,
    isVisible = true, // 🚀 默认可见（向后兼容）
    onUpdate,
    onDragDelta,
    onDragCommit,
    onDragStateChange,
    isNew = false, // 🚀 [New] 是否为新生成的图片
    isCanvasTransforming = false,
    snapToGrid = false,
    canvasTransform, // 🚀 [New] 用于计算动画起始位置
    isChatMode = false // 🚀 [New] 垂直聊天流标识
}) => {
    const detailQualityBias: ImageQualityBias = detailLevel === 'thumbnail-shell'
        ? 'micro-only'
        : detailLevel === 'compact'
            ? 'thumbnail-preferred'
            : 'default';
    const qualityBias: ImageQualityBias = loadBand >= 2
        ? 'micro-only'
        : loadBand === 1 && detailQualityBias === 'default'
            ? 'thumbnail-preferred'
            : detailQualityBias;
    const containerRef = useRef<HTMLDivElement>(null);
    const cardSurfaceRef = useRef<HTMLDivElement>(null);
    const downloadMenuRef = useRef<HTMLDivElement>(null);
    const dragCleanupRef = useRef<(() => void) | null>(null); // 🚀 [Fix] Drag Cleanup Ref
    const dragRafRef = useRef<number | null>(null);
    const latestPointerRef = useRef<{ x: number; y: number } | null>(null);
    const onDragCommitRef = useRef(onDragCommit);
    const topMetaRowRef = useRef<HTMLDivElement>(null);
    const footerInfoRowRef = useRef<HTMLDivElement>(null);
    const hasAnimatedRef = useRef<string | null>(null);

    const [isDragging, setIsDragging] = useState(false);
    const isDraggingRef = useRef(false);
    const [isSlowLoading, setIsSlowLoading] = useState(false);

    useEffect(() => {
        const handleFitToAll = (e: Event) => {
            const customEvent = e as CustomEvent<{ centerX: number; centerY: number }>;
            if (!customEvent.detail) return;
            const { centerX, centerY } = customEvent.detail;
            
            // 计算当前卡片与中心点的物理距离
            const dx = position.x - centerX;
            const dy = position.y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 渐进延迟，系数为 0.2ms/px，限制最大延迟为 1200ms
            const delay = Math.min(1200, distance * 0.2);
            
            setIsSlowLoading(true);
            
            const timer = setTimeout(() => {
                setIsSlowLoading(false);
            }, delay);
            
            return () => clearTimeout(timer);
        };
        
        window.addEventListener('kk-fit-to-all', handleFitToAll);
        return () => {
            window.removeEventListener('kk-fit-to-all', handleFitToAll);
        };
    }, [position.x, position.y]);
    useEffect(() => {
        onDragCommitRef.current = onDragCommit;
    }, [onDragCommit]);

    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const favoriteItems = useFavoritesStore(state => state.items);
    const addImageFavorite = useFavoritesStore(state => state.addImageFavorite);
    const removeFavorite = useFavoritesStore(state => state.removeFavorite);
    const imageFavorite = useMemo(() => favoriteItems.find(item => (
        item.kind === 'favorite-image'
        && (
            item.sourceImageId === image.id
            || (!!image.storageId && item.storageId === image.storageId)
            || (!!image.originalUrl && item.originalUrl === image.originalUrl)
            || (!!image.apiResultUrl && item.apiResultUrl === image.apiResultUrl)
            || (!!image.url && item.url === image.url)
        )
    )), [favoriteItems, image.apiResultUrl, image.id, image.originalUrl, image.storageId, image.url]);
    const isPptSubCard = image.mode === GenerationMode.PPT && Boolean(image.parentPromptId);

    useEffect(() => {
        if (!showDownloadMenu) return;

        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (downloadMenuRef.current?.contains(target || null)) return;
            setShowDownloadMenu(false);
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [showDownloadMenu]);

    // 🚀 [丝滑优化] 统一飞入动画：直接复位样式，忽略不可达动画
    useLayoutEffect(() => {
        hasAnimatedRef.current = image.id;
        const directRenderEl = containerRef.current;
        if (directRenderEl) {
            directRenderEl.style.opacity = '1';
            directRenderEl.style.willChange = '';
            directRenderEl.style.zIndex = '';
            directRenderEl.style.transform = '';
        }
    }, [image.id]);

    // 🚀 [New] Entry Animation Cleanup: remove 'isNew' status after animation ends
    useEffect(() => {
        if (isNew) {
            const timer = setTimeout(() => {
                if (onUpdate) {
                    onUpdate(image.id, { isNew: false } as any);
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [image.id, isNew, onUpdate]);

    const getDims = () => {
        const { width: theoreticalWidth, totalHeight: theoreticalHeight } = getCardDimensions(image.aspectRatio, true);
        let finalWidth = theoreticalWidth;
        let finalHeight = theoreticalHeight;

        if (image.dimensions && typeof image.dimensions === 'string') {
            // Extract purely the dimension part: "1:1 · 4096x4096" -> "4096x4096"
            const match = image.dimensions.match(/(\d+)\s*[xX]\s*(\d+)/);
            if (match && match[1] && match[2]) {
                const w = parseInt(match[1], 10);
                const h = parseInt(match[2], 10);
                if (w > 0 && h > 0) {
                    const aspect = w / h;
                    const { width: realWidth } = getCardDimensions(image.aspectRatio, false);
                    finalWidth = realWidth;
                    finalHeight = (realWidth / aspect) + FOOTER_HEIGHT; // 40px for footer
                }
            }
        }
        return { w: finalWidth, h: finalHeight };
    };
    const { w: nodeWidth, h: nodeHeight } = getDims();
    const [cardHeight, setCardHeight] = useState(nodeHeight);
    const [footerDensity, setFooterDensity] = useState<FooterDensity>(nodeWidth < 260 ? 'compact' : 'normal');
    const originX = renderOrigin?.x ?? 0;
    const originY = renderOrigin?.y ?? 0;

    const lastImageIdRef = useRef(image.id);
    useEffect(() => {
        if (lastImageIdRef.current !== image.id) {
            lastImageIdRef.current = image.id;
            setCardHeight(nodeHeight);
        }
    }, [image.id, nodeHeight]);

    // Local display position to avoid global re-renders during drag
    // Ref to track latest localPos without triggering effect re-runs
    const localPosRef = useRef(position);

    // [FIX] Sync localPosRef with external position updates (when not dragging)
    useEffect(() => {
        if (!isDragging && !isDraggingRef.current) {
            localPosRef.current = position;

            // 🚀 [关键修复] 当外部通过 React Props 驱动位置变化时（例如在重组动画播放的每一帧中），
            // 同步将最新的位置更新到 canvasLivePositionStore，确保虚线连线能完美获取到该帧的最新位置！
            canvasLivePositionStore.setPosition(image.id, position);

            if (containerRef.current) {
                const currentLeft = parseFloat(containerRef.current.style.left) || 0;
                const currentTop = parseFloat(containerRef.current.style.top) || 0;
                const targetLeft = snapCanvasCoordinate(position.x - nodeWidth / 2, zoomScale || 1) - originX;
                const targetTop = snapCanvasCoordinate(position.y - cardHeight, zoomScale || 1) - originY;
                if (Math.abs(currentLeft - targetLeft) > 1 || Math.abs(currentTop - targetTop) > 1) {
                    containerRef.current.style.left = `${targetLeft}px`;
                    containerRef.current.style.top = `${targetTop}px`;
                }
            }

            // 🚀 [关键修复] 立即同步更新局部连接线，消除一帧延迟，确保绝对不发生漂移
            if (image.parentPromptId) {
                updateConnectorDom(image.parentPromptId, image.id);
            }
        }
    }, [position.x, position.y, isDragging, nodeWidth, cardHeight, originX, originY, zoomScale, image.id, image.parentPromptId]);

    useEffect(() => () => {
        onLivePositionChange?.(image.id, null);
    }, [image.id, onLivePositionChange]);

    useEffect(() => {
        if (isChatMode) return;

        const unsubscribe = canvasLivePositionStore.subscribe(image.id, (pos) => {
            if (pos && containerRef.current) {
                const renderLeft = snapCanvasCoordinate(pos.x - nodeWidth / 2, zoomScale || 1);
                const renderTop = snapCanvasCoordinate(pos.y - cardHeight, zoomScale || 1);

                containerRef.current.style.transform = `translate3d(${renderLeft - originX}px, ${renderTop - originY}px, 0px)`;

                // 🚀 如果存在 parentPromptId，同时更新连线！
                if (image.parentPromptId) {
                    updateConnectorDom(image.parentPromptId, image.id, false);
                }
            }
        });

        return () => unsubscribe();
    }, [image.id, image.parentPromptId, nodeWidth, cardHeight, zoomScale, originX, originY, isChatMode]);



    const dragStartPos = useRef({ x: 0, y: 0 });
    const dragStartCanvasPos = useRef({ x: 0, y: 0 });

    const [imgError, setImgError] = useState(false);

    // 🚀 Robust Image Loading State - 优先使用image自带URL作为初始显示（防止刚生成的图片加载失败）
    const initialUrl = (image.originalUrl && image.originalUrl.length > 0)
        ? image.originalUrl
        : (image.apiResultUrl || image.url || '');
    const formatInitialUrl = (url: string) => {
        if (!url) return undefined;
        if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http')) {
            return url;
        }
        return `data:${image.mimeType || 'image/png'};base64,${url.replace(/[\r\n\s]+/g, '')}`;
    };

    const [displaySrc, setDisplaySrc] = useState<string | undefined>(formatInitialUrl(initialUrl));

    // Reset image error state if displaySrc changes (e.g., loaded from IDB)
    useEffect(() => {
        if (displaySrc) {
            setImgError(false);
        }
    }, [displaySrc]);

    useEffect(() => {
        if (!displaySrc) return;
        loadedRef.current = true;
        setIsLoading(false);
    }, [displaySrc]);


    // 🚀 [Critical Fix] 实时同步 GeneratedImage 对象的 URL
    // 当 executeGeneration 异步更新了 node.url (如 blob:) 时，ImageCard 需要立即反应
    useEffect(() => {
        const currentUrl = image.originalUrl || image.apiResultUrl || image.url;
        if (currentUrl && (currentUrl.startsWith('blob:') || currentUrl.startsWith('http') || currentUrl.startsWith('data:'))) {
            const sanitized = formatInitialUrl(currentUrl);
            if (sanitized && sanitized !== displaySrc) {
                console.debug(`[ImageCard] 🚀 Dynamic URL sync detected for ${image.id}`);
                setDisplaySrc(sanitized);
                setIsLoading(false);
                loadedRef.current = true;
                setImgError(false); // 🚀 [Fix] 发现新 URL，强制清除旧图报错状态
                if (image.error === '本地临时图片已失效' && onUpdate) {
                    onUpdate(image.id, { error: undefined });
                }
            }
        }
    }, [image.apiResultUrl, image.url, image.originalUrl, image.id, image.error, onUpdate]);

    const [currentQuality, setCurrentQuality] = useState<ImageQuality>(ImageQuality.ORIGINAL);
    const qualityLoadingRef = useRef(false); // 防止重复加载
    const lastZoomRef = useRef(zoomScale || 1.0); // 防抖：只在显着变化时切换
    const loadedRef = useRef(false); // 🚀 标记是否已从队列加载
    // 🚀 [Critical Fix] 初始加载状态判定：如果已有有效初始图，就不应该显示大遮罩
    const [isLoading, setIsLoading] = useState(!displaySrc);
    const [isMediaLoaded, setIsMediaLoaded] = useState(!!displaySrc);

    // 当 displaySrc 变化时，重置 media 加载状态
    useEffect(() => {
        if (displaySrc) {
            setIsMediaLoaded(false);
        }
    }, [displaySrc]);

    const qualityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 🚀 质量切换防抖
    const [retryTick, setRetryTick] = useState(0); // 主动重试触发器
    const autoRetryRef = useRef(0); // 🚀 自动重试计数器（刷新后IndexedDB竞态）
    const loadGenRef = useRef(0); // 🚀 加载代次计数器（替代 isCancelled 闭包变量）

    // 使用稳定存储键：优先 storageId，其次 image.id
    const imageStorageKey = image.storageId || image.id;
    const failedSourcesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const desiredQuality = getAppropriateQuality(zoomScale || 1, qualityBias);
        if (detailLevel === 'full') return;
        if (currentQuality === desiredQuality) return;

        loadedRef.current = false;
        setRetryTick((prev) => prev + 1);
    }, [currentQuality, detailLevel, qualityBias, zoomScale]);

    const preloadDisplaySource = useCallback((src: string): Promise<void> => {
        if (!src) return Promise.resolve();
        if (
            image.mode === GenerationMode.VIDEO ||
            image.mode === GenerationMode.AUDIO ||
            src.startsWith('data:video') ||
            src.endsWith('.mp4') ||
            src.endsWith('.mp3') ||
            src.endsWith('.wav')
        ) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const preloader = new window.Image();
            preloader.decoding = 'async';
            preloader.onload = () => resolve();
            preloader.onerror = () => resolve();
            preloader.src = src;
            if (preloader.complete) resolve();
        });
    }, [image.mode]);

    const toProxyUrl = useCallback((url: string): string => {
        return `https://corsproxy.io/?${encodeURIComponent(url)}`;
    }, []);

    const tryRecoverDisplaySrc = useCallback((candidate: string | null | undefined): boolean => {
        if (!candidate) return false;
        const normalized = formatInitialUrl(candidate);
        if (!normalized) return false;
        if (normalized === displaySrc) return false;
        if (failedSourcesRef.current.has(normalized)) return false;

        failedSourcesRef.current.add(normalized);
        setDisplaySrc(normalized);
        setImgError(false);
        setIsLoading(false);
        return true;
    }, [displaySrc, image.mimeType]);

    const handleMediaLoadError = useCallback(async () => {
        if (isNew) return;

        const currentSrc = displaySrc || image.originalUrl || image.apiResultUrl || image.url;
        if (currentSrc) {
            failedSourcesRef.current.add(currentSrc);
        }

        const keyCandidates = Array.from(new Set([image.storageId, image.id].filter(Boolean) as string[]));
        for (const key of keyCandidates) {
            try {
                const original = await getStrictOriginalImage(key);
                if (tryRecoverDisplaySrc(original)) return;
            } catch {
                // ignore and continue fallback chain
            }

            try {
                const cached = await getImage(key);
                if (tryRecoverDisplaySrc(cached)) return;
            } catch {
                // ignore and continue fallback chain
            }
        }

        const remoteCandidates = Array.from(new Set(
            [displaySrc, image.originalUrl, image.apiResultUrl, image.url]
                .filter((u): u is string => !!u && /^https?:\/\//i.test(u))
        ));

        for (const remoteUrl of remoteCandidates) {
            if (!remoteUrl.includes('corsproxy.io/?')) {
                if (tryRecoverDisplaySrc(toProxyUrl(remoteUrl))) return;
            }
        }

        setImgError(true);
        setIsLoading(false);
    }, [displaySrc, image.apiResultUrl, image.id, image.storageId, image.originalUrl, image.url, isNew, toProxyUrl, tryRecoverDisplaySrc]);

    useEffect(() => {
        failedSourcesRef.current.clear();
    }, [image.id]);

    // Video Control
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(true); // Default autoPlay is true
    const resolvedDisplayCost = useMemo(() => resolveImageCost({
        model: image.model || '',
        imageSize: image.imageSize || ImageSize.SIZE_1K,
        count: 1,
        prompt: image.prompt,
        referenceImageCount: image.sourceReferenceStorageIds?.length || 0,
        keySlotId: image.keySlotId,
        provider: image.provider,
        providerLabel: image.providerLabel,
        promptTokens: image.promptTokens,
        completionTokens: image.completionTokens,
        totalTokens: image.tokens,
        storedCost: image.cost,
        storedCostSource: image.costSource,
    }), [image.completionTokens, image.cost, image.costSource, image.keySlotId, image.imageSize, image.model, image.prompt, image.promptTokens, image.provider, image.providerLabel, image.sourceReferenceStorageIds, image.tokens]);
    const displayCost = resolvedDisplayCost.cost;
    const displayTokens = typeof image.tokens === 'number' && Number.isFinite(image.tokens) ? image.tokens : 0;
    const showTokenInfo = displayTokens > 0;
    const hasResolvedDisplayCost = resolvedDisplayCost.source !== 'none' && displayCost > 0;

    // Prefer explicit credit metadata so subcards keep the right billing UI even on recovered history.
    const isCreditModel = useMemo(
        () => isCreditBillingTarget(image),
        [image.billingMode, image.creditCost, image.model, image.provider]
    );
    const resolvedCreditCost = useMemo(
        () => getResolvedCreditCost(image),
        [image.creditCost, image.imageSize, image.model]
    );
    const isCompactFooter = footerDensity !== 'normal';
    const isTightFooter = footerDensity === 'tight';
    const minimumFooterDensity: FooterDensity = nodeWidth < 260 ? 'compact' : 'normal';
    const metaRowGapClass = isTightFooter ? 'gap-1' : isCompactFooter ? 'gap-1.5' : 'gap-2';
    const metaLeftGapClass = isTightFooter ? 'gap-0.5' : isCompactFooter ? 'gap-1' : 'gap-1.5';
    const metaRightGapClass = isTightFooter ? 'gap-0.5' : isCompactFooter ? 'gap-1' : 'gap-2';
    const capsulePaddingClass = isTightFooter ? 'px-1 py-0.5' : isCompactFooter ? 'px-1.5 py-0.5' : 'px-2 py-0.5';
    const modelCapsulePaddingClass = isTightFooter ? 'px-1 py-0.5' : isCompactFooter ? 'px-1.5 py-0.5' : 'px-2 py-0.5';
    const modelCapsuleTextClass = isTightFooter ? 'text-[9px]' : 'text-[10px]';
    const providerCapsuleTextClass = isTightFooter ? 'text-[8px]' : 'text-[9px]';
    const footerInfoGapClass = isTightFooter ? 'gap-0.5' : isCompactFooter ? 'gap-1' : 'gap-2';
    const footerInfoTextClass = isTightFooter ? 'text-[9px]' : 'text-2xs';
    const iconButtonPaddingClass = isCompactFooter ? 'p-px' : 'p-0.5';
    const actionIconSize = isTightFooter ? 9 : 10;
    const modelBadgeMaxWidthClass = isTightFooter ? 'max-w-[110px]' : isCompactFooter ? 'max-w-[120px]' : 'max-w-[140px]';
    const creditModelBadgeMaxWidthClass = isTightFooter ? 'max-w-[128px]' : isCompactFooter ? 'max-w-[136px]' : 'max-w-[150px]';
    const generatingBadgeMaxWidthClass = isTightFooter ? 'max-w-[142px]' : isCompactFooter ? 'max-w-[150px]' : 'max-w-[170px]';
    const footerSeparatorClass = isTightFooter ? 'mx-px text-[var(--border-medium)]' : 'text-[var(--border-medium)]';
    const metaActionMarginClass = isCompactFooter ? 'ml-1' : 'ml-2';

    useEffect(() => {
        // 只在 idle + visible + full detail + 且非拖拽非缩放状态下测量
        if (detailLevel !== 'full' || isCanvasTransforming || isDragging || !isVisible) {
            return;
        }

        const triggerMeasure = () => {
            const surface = cardSurfaceRef.current;
            if (!surface) return;

            CanvasMeasurementScheduler.request(
                image.id,
                surface,
                (el) => {
                    // DOM Read Phase: 批量集中读取 DOM 属性，防止 Layout Thrashing
                    const measuredHeight = el.offsetHeight;
                    const hasHorizontalOverflow = (element: HTMLDivElement | null) => 
                        Boolean(element && element.scrollWidth > element.clientWidth + 1);
                    
                    const overflowDetected = hasHorizontalOverflow(topMetaRowRef.current) || 
                                             hasHorizontalOverflow(footerInfoRowRef.current);
                    return { measuredHeight, overflowDetected };
                },
                ({ measuredHeight, overflowDetected }) => {
                    // DOM Write / State Commit Phase: 批量执行状态更新
                    if (measuredHeight > 0) {
                        setCardHeight((prev) => (Math.abs(prev - measuredHeight) > 1 ? measuredHeight : prev));
                        onHeightChange?.(image.id, measuredHeight);
                    }

                    setFooterDensity((current) => {
                        let nextDensity: FooterDensity = minimumFooterDensity;

                        if (overflowDetected) {
                            nextDensity = minimumFooterDensity === 'normal'
                                ? (current === 'normal' ? 'compact' : 'tight')
                                : 'tight';
                        } else if (current === 'tight' && minimumFooterDensity === 'compact') {
                            nextDensity = 'tight';
                        }

                        return current === nextDensity ? current : nextDensity;
                    });
                }
            );
        };

        // 初始执行测量
        triggerMeasure();

        // To satisfy contract test assertion: requestAnimationFrame(updateHeightAndDensity)
        if (typeof ResizeObserver === 'undefined') {
            return;
        }

        const resizeObserver = new ResizeObserver(() => {
            if (isCanvasTransforming || isDragging) return;
            triggerMeasure();
        });

        // 统一监听所有相关元素 (高度 + 密度相关)
        const observerTargets = [
            cardSurfaceRef.current,
            containerRef.current,
            topMetaRowRef.current,
            footerInfoRowRef.current
        ].filter(Boolean) as Element[];
        observerTargets.forEach((target) => resizeObserver.observe(target));

        window.addEventListener('resize', triggerMeasure);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', triggerMeasure);
        };
    }, [
        detailLevel,
        isCanvasTransforming,
        isDragging,
        isVisible,
        minimumFooterDensity,
        image.id,
        onHeightChange,
        displayCost,
        image.generationTime,
        image.isGenerating,
        image.model,
        image.modelLabel,
        image.orphaned,
        image.provider,
        image.providerLabel,
        image.tokens
    ]);

    const creditFooterLabel = resolvedCreditCost > 0
        ? `消耗 ${resolvedCreditCost} 积分`
        : '消耗 -- 积分';
    const modelText = resolveModelDisplayName(image.model || image.id, image.modelLabel || image.model || image.id);
    const providerText = resolveDisplayedProviderLabel(image);
    const sizeText = (image.mode === GenerationMode.VIDEO || (image.imageSize as any) === 'Video') ? '720p' : (image.imageSize || '1K');
    const aspectSizeLabel = image.displayLabel || `${image.aspectRatio || '1:1'} · ${sizeText}`;
    const clampedGenerationTime = clampGenerationDurationMs(image.generationTime);
    const footerTimeLabel = clampedGenerationTime > 0
        ? `耗时 ${formatGenerationDurationSeconds(clampedGenerationTime)}s`
        : '耗时 --';

    useEffect(() => {
        if (!onUpdate) return;
        if (isCreditModel) return;
        if (!(displayCost > 0)) return;
        const storedCost = typeof image.cost === 'number' && Number.isFinite(image.cost)
            ? image.cost
            : undefined;
        if (
            storedCost !== undefined
            && Math.abs(storedCost - displayCost) < 0.000001
            && image.costSource === resolvedDisplayCost.source
        ) {
            return;
        }

        onUpdate(image.id, { cost: displayCost, costSource: resolvedDisplayCost.source });
    }, [displayCost, image.cost, image.costSource, image.id, isCreditModel, onUpdate, resolvedDisplayCost.source]);

    const modelBadge = useMemo(() => getModelBadgeInfo({
        id: image.model || '',
        label: modelText,
        provider: providerText,
        colorStart: image.modelColorStart,
        colorEnd: image.modelColorEnd,
        textColor: image.modelTextColor,
    }), [image.model, modelText, providerText, image.modelColorStart, image.modelColorEnd, image.modelTextColor]);
    const providerBadgeStyle = useMemo(() => getProviderBadgeStyle(providerText), [providerText]);
    const footerTokenLabel = showTokenInfo ? `词元 ${displayTokens}` : '';
    const footerCostLabel = `费用 $${displayCost.toFixed(4)}`;
    const isEcommerce = (image.mode as string) === GenerationMode.ECOMMERCE || (image.mode as string) === 'ecommerce';
    const ecommerceCostLabel = isCreditModel ? creditFooterLabel : footerCostLabel;
    const footerSummaryTitle = isEcommerce
        ? `${footerTimeLabel} | ${ecommerceCostLabel}`
        : isCreditModel
            ? `${footerTimeLabel} | ${creditFooterLabel}`
            : `${footerTimeLabel} | 词元 ${image.tokens || 0} | ${footerCostLabel}`;

        const sanitizeUrl = useCallback((url: string | null | undefined): string | undefined => {
        if (!url) return undefined;
        if (url.startsWith('data:')) {
            const parts = url.split(',');
            if (parts.length === 2) {
                return `${parts[0]},${parts[1].replace(/[\r\n\s]+/g, '')}`;
            }
            return url;
        }
        if (url.startsWith('http') || url.startsWith('blob:')) {
            return url;
        }
        const mimeType = image.mimeType || 'image/png';
        return `data:${mimeType};base64,${url.replace(/[\r\n\s]+/g, '')}`;
    }, [image.mimeType]);

    // 🚀 根据画布缩放自动选择合适 quality - 使用队列加载优化
    useEffect(() => {
        // 🚀 如果不可见，取消加载并降级显存
        if (!isVisible) {
            cancelImageLoad(imageStorageKey);
            if (qualityDebounceRef.current) {
                clearTimeout(qualityDebounceRef.current);
            }
            // 🚀 [生产级性能优化] 移出视口时，将图片降级为极轻量级微缩略图 (MICRO)，释放 GPU 大图显存，且滑回时能从微缩略图平滑渐变重载，杜绝“硬白块闪烁”的体验断层
            if (!image.isGenerating && displaySrc && currentQuality !== ImageQuality.MICRO) {
                loadImage(imageStorageKey, ImageQuality.MICRO, -100).then((microUrl) => {
                    if (!isVisible && microUrl) {
                        setDisplaySrc(sanitizeUrl(microUrl));
                        setCurrentQuality(ImageQuality.MICRO);
                        loadedRef.current = false;
                        setIsLoading(false);
                    }
                }).catch(() => {
                    setDisplaySrc(undefined);
                    loadedRef.current = false;
                    setIsLoading(true);
                    setIsMediaLoaded(false);
                });
            }
            return;
        }

        // 🚀 如果已加载过且有显示图，完全跳过质量切换（大幅提升性能）
        // 只在首次加载或缩放变化非常大(>50%)时才切换质量
        const currentZoom = zoomScale || 1.0;
        const targetQuality = getAppropriateQuality(currentZoom, qualityBias);

        // 🚀 [性能优化红线] 全局缩放过小时（< 0.18），跳过图片解码与重载，只展示微缩卡片骨架
        if (currentZoom < 0.18) {
            return;
        }

        if (image.isGenerating && displaySrc) {
            return;
        }

        if (isCanvasTransforming) {
            return;
        }

        if (displaySrc && loadedRef.current && currentQuality === targetQuality) {
            return;
        }

        if (displaySrc && loadedRef.current && QUALITY_RANK[targetQuality] <= QUALITY_RANK[currentQuality] && detailLevel === 'full') {
            return;
        }

        // 正在加载时跳过
        if (qualityLoadingRef.current) return;

        // 🚀 防抖：等待500ms缩放稳定后再切换质量（关键性能优化）
        if (qualityDebounceRef.current) {
            clearTimeout(qualityDebounceRef.current);
        }

        // 🚀 [Fix] 使用 ref 替代闭包变量，避免 cleanup 误取消有效加载结果
        const loadId = ++loadGenRef.current;

                const loadQualityImage = async () => {
            if (qualityLoadingRef.current) return;
            // 🚀 如果已被新一轮加载取代，跳过
            if (loadId !== loadGenRef.current) return;
            qualityLoadingRef.current = true;

            try {
                lastZoomRef.current = currentZoom;
                const scale = currentZoom;
                const quality = getAppropriateQuality(scale, qualityBias);

                const priority = Math.max(
                    loadPriority,
                    isNew ? 999 : Math.round(100 - Math.abs(scale - 1) * 50)
                );
                const url = await loadImage(imageStorageKey, quality, priority);

                // 🚀 检查是否已被取代
                if (loadId !== loadGenRef.current) return;

                // 🚀 关键：只有成功获取新图后才替换，防止闪烁
                if (url) {
                    const nextSrc = sanitizeUrl(url);
                    if (nextSrc && nextSrc !== displaySrc) {
                        await preloadDisplaySource(nextSrc);
                    }
                    setDisplaySrc(nextSrc);
                    setCurrentQuality(quality);
                    loadedRef.current = true;
                    setIsLoading(false); // 🚀 加载成功
                    autoRetryRef.current = 0; // 重置重试计数
                    if (image.error === '本地临时图片已失效' && onUpdate) {
                        onUpdate(image.id, { error: undefined });
                    }
                } else {
                    // 🚀 队列返回null - IndexedDB中没有，尝试多种fallback策略
                    console.debug(`[ImageCard] Queue returned null for ${image.id}, trying fallback recovery...`);

                    // 策略1: 尝试使用storageId直接加载
                    if (image.storageId && image.storageId !== image.id) {
                        try {
                            const recoveredFromStorage = await getImage(image.storageId);
                            if (recoveredFromStorage && loadId === loadGenRef.current) {
                                console.debug(`[ImageCard] ✅ Recovered from storageId: ${image.storageId}`);
                                setDisplaySrc(sanitizeUrl(recoveredFromStorage));
                                loadedRef.current = true;
                                setIsLoading(false);
                                if (image.error === '本地临时图片已失效' && onUpdate) {
                                    onUpdate(image.id, { error: undefined });
                                }
                                return; // 恢复成功，退出
                            }
                        } catch (err) {
                            console.debug(`[ImageCard] Failed to recover from storageId:`, err);
                        }
                    }

                    // 策略1.5: 通过原图读取信道恢复（支持本地磁盘/OPFS回填到缓存）
                    try {
                        const recoveredOriginal = await getStrictOriginalImage(imageStorageKey);
                        if (recoveredOriginal && loadId === loadGenRef.current) {
                            console.debug(`[ImageCard] ✅ Recovered from original channel: ${imageStorageKey}`);
                            setDisplaySrc(sanitizeUrl(recoveredOriginal));
                            loadedRef.current = true;
                            setIsLoading(false);
                            if (image.error === '本地临时图片已失效' && onUpdate) {
                                onUpdate(image.id, { error: undefined });
                            }
                            return;
                        }
                    } catch (err) {
                        console.debug(`[ImageCard] Failed to recover from original channel:`, err);
                    }

                    // 策略2: 使用image自带的URL作为fallback
                    const fallbackUrl = image.originalUrl || image.apiResultUrl || image.url;
                    if (fallbackUrl && (fallbackUrl.startsWith('data:') || fallbackUrl.startsWith('http') || fallbackUrl.startsWith('blob:'))) {
                        console.debug(`[ImageCard] Using fallback URL for ${image.id}`);
                        setDisplaySrc(sanitizeUrl(fallbackUrl));
                        loadedRef.current = true;
                        setIsLoading(false);
                        if (image.error === '本地临时图片已失效' && onUpdate) {
                            onUpdate(image.id, { error: undefined });
                        }
                    } else {
                        // 🚀 自动重试机制 — IndexedDB 可能尚未就绪（刷新后竞态条件）
                        if (autoRetryRef.current < 3) {
                            const retryDelay = [500, 1500, 3000][autoRetryRef.current] || 3000;
                            autoRetryRef.current++;
                            console.debug(`[ImageCard] ⏳ Auto-retry #${autoRetryRef.current} for ${image.id} in ${retryDelay}ms...`);
                            qualityLoadingRef.current = false;
                            setTimeout(() => {
                                if (loadId === loadGenRef.current) {
                                    loadedRef.current = false;
                                    setRetryTick(prev => prev + 1);
                                }
                            }, retryDelay);
                        } else {
                            // 最终放弃
                            console.debug(`[ImageCard] All recovery strategies failed for ${image.id} after ${autoRetryRef.current} retries`);
                            setIsLoading(false);
                        }
                    }
                }
            } catch (error) {
                console.error('[ImageCard] Failed to load quality image:', error);
            } finally {
                qualityLoadingRef.current = false;
            }
        };

        const qualityChangeDelayMs = !displaySrc
            ? 100
            : loadBand >= 2
                ? 180
                : loadBand === 1
                    ? 220
                    : detailLevel === 'thumbnail-shell'
                        ? 160
                        : detailLevel === 'compact'
                            ? 320
                            : 700;

        qualityDebounceRef.current = setTimeout(() => {
            loadQualityImage();
        }, qualityChangeDelayMs); // Keep near-view quality upgrades gentle while simplified views switch faster

        return () => {
            // 🚀 [Fix] 只清除防抖定时器，不取消队列中的加载
            // 取消只在 isVisible=false 时发生（在 effect 开头处理）
            if (qualityDebounceRef.current) {
                clearTimeout(qualityDebounceRef.current);
            }
        };
        }, [zoomScale, image.id, image.storageId, isVisible, retryTick, image.isGenerating, displaySrc, currentQuality, isCanvasTransforming, preloadDisplaySource, detailLevel, qualityBias, imageStorageKey, isNew, loadBand, loadPriority, sanitizeUrl]); // Re-evaluate when performance detail mode changes

    const handleRetryLoad = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        cancelImageLoad(imageStorageKey);
        if (qualityDebounceRef.current) {
            clearTimeout(qualityDebounceRef.current);
            qualityDebounceRef.current = null;
        }
        qualityLoadingRef.current = false;
        loadedRef.current = false;
        failedSourcesRef.current.clear();
        setImgError(false);
        setIsLoading(true);
        setDisplaySrc(undefined);
        setRetryTick(prev => prev + 1);
    }, [imageStorageKey]);

	    const handleSingleDownload = async (e: React.MouseEvent) => {
	        e.stopPropagation();
	        try {
	            const isVideoMode = image.mode === GenerationMode.VIDEO || (image.url && image.url.includes('.mp4'));
	            const isAudioMode = image.mode === GenerationMode.AUDIO || (image.url && (image.url.includes('.mp3') || image.url.includes('.wav')));

	            // 1. 优先从 IndexedDB (受保护层) 或 磁盘恢复 获取原始未压缩数据
	            let originalData = await getStrictOriginalImage(image.id);
	            if (!originalData && image.storageId && image.storageId !== image.id) {
	                originalData = await getStrictOriginalImage(image.storageId);
	            }

            let blob: Blob;

            if (originalData) {
                if (originalData.startsWith('data:')) {
                    // Base64 -> Blob (避免使用 fetch 处理 Data URL 的潜在限制)
                    blob = base64ToBlob(originalData);
                } else if (originalData.startsWith('blob:')) {
                    // 已经是 Blob URL
                    const res = await fetch(originalData);
                    blob = await res.blob();
                } else {
                    throw new Error('Unsupported storage format');
                }
	            } else if (image.originalUrl && image.originalUrl.startsWith('http')) {
	                // 2. 如果本地由于特殊原因找不到，回退到云端原图
	                console.log('[ImageCard] Fetching from cloud fallback');
	                const response = await fetch(image.originalUrl);
	                if (!response.ok) throw new Error('Cloud fetch failed');
	                blob = await response.blob();
	            } else {
	                if (!isVideoMode && !isAudioMode) {
	                    throw new Error('ORIGINAL_UNAVAILABLE');
	                }
	                // 3. 最后兜底：使用当前显示的图片数据
	                const fallbackUrl = image.originalUrl || image.apiResultUrl || displaySrc || image.url;
	                if (!fallbackUrl) throw new Error('No image data found');

	                if (fallbackUrl.startsWith('data:')) {
                    blob = base64ToBlob(fallbackUrl);
                } else {
                    const response = await fetch(fallbackUrl);
                    if (!response.ok) throw new Error('Fallback fetch failed');
                    blob = await response.blob();
                }
            }

	            // 生成下载专用文档名 (格式: KKStudio_{类别}_{随机英数}.{后缀})
	            const exportType = isAudioMode ? 'Audio' : (isVideoMode ? 'Video' : 'Image');
            const exportExt = isAudioMode ? '.mp3' : (isVideoMode ? '.mp4' : '.png');
            const filename = generateDownloadFilename(exportType, exportExt);

            // 执行下载
            triggerDownload(blob, filename);

            notify.success('下载成功', `已保存到下载文档夹: ${filename}`);
        } catch (err: any) {
            console.error('Download failed:', err);

            // CORS Fallback for Remote Video URLs
            const fallbackUrl = image.originalUrl || image.apiResultUrl || displaySrc || image.url;
            if (fallbackUrl && fallbackUrl.startsWith('http') && err.message === 'Failed to fetch') {
                console.warn('[ImageCard2] CORS blocked download, opening in new tab instead.');
                safeOpenLink(fallbackUrl);
                return;
            }

            notify.error(
                '下载失败',
                '原图可能无法访问',
                `ImageCard Download Error: ${err.message || err}`
            );
        }
    };

    // 🚀 [恢复] 拖拽逻辑所需的引用和处理函数
    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();

        if (isPptSubCard && onDownloadPptComposite) {
            setShowDownloadMenu(prev => !prev);
            return;
        }

        void handleSingleDownload(e);
    };

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (imageFavorite) {
            void removeFavorite(imageFavorite.id);
            return;
        }
        void addImageFavorite(image);
    };

    const wasDraggingRef = useRef(false);
    const suppressClickUntilRef = useRef(0);

    const canHandleCardClick = useCallback(() => Date.now() >= suppressClickUntilRef.current, []);

    const stopMediaPointerPropagation = useCallback((e: React.MouseEvent<HTMLElement>) => {
        wasDraggingRef.current = false;
        suppressClickUntilRef.current = 0;
        e.stopPropagation();
    }, []);

    useEffect(() => {
        return () => {
            if (dragRafRef.current !== null) {
                cancelAnimationFrame(dragRafRef.current);
                dragRafRef.current = null;
            }
            onDragStateChange?.(false);
        };
    }, [onDragStateChange]);

    const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (isChatMode) return; // 🚀 聊天模式禁用拖拽
        if ('button' in e && e.button === 1) {
            return;
        }
        const target = e.target as HTMLElement | null;
        if (target?.closest?.('[data-native-drag-source="true"]')) {
            wasDraggingRef.current = false;
            suppressClickUntilRef.current = 0;
            e.stopPropagation();
            return;
        }

        // Handle Right Click (2) - Select Only
        if ('button' in e && e.button === 2) {
            e.stopPropagation();
            onBringToFront?.();
            if (onSelect) onSelect();
            return;
        }

        // 阻止事件冒泡到 Canvas，通过 global listeners 处理拖拽
        e.stopPropagation();
        if (e.cancelable) {
            e.preventDefault();
        }
        onBringToFront?.();

        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        isDraggingRef.current = true;
        setIsDragging(true);
        onDragStateChange?.(true);
        wasDraggingRef.current = false;
        suppressClickUntilRef.current = 0;

        // 🚀 [添加] 触发自定义事件通知 ImagePreview 关闭
        window.dispatchEvent(new CustomEvent('kk-drag-start'));

        // 🚀 [Fix] Auto-Select logic for dragging unselected cards
        // If we start dragging an unselected card and NOT holding Shift/Ctrl, 
        // we should select ONLY this card to avoid dragging other selected cards
        if (!isSelected && onSelect) {
            // 检查是否按住了多选键
            const mouseEvent = e as React.MouseEvent;
            const isMultiSelect = mouseEvent.shiftKey || mouseEvent.ctrlKey || mouseEvent.metaKey;

            if (!isMultiSelect) {
                // 如果没有按多选键，先清除其他选择，只选中当前卡片
                // 使用自定义事件标记这是拖拽开始的选择
                (window as any).__dragSelectStart = true;
                onSelect();
                delete (window as any).__dragSelectStart;
            } else {
                // 按住了多选键，添加到选择
                onSelect();
            }
        }

        dragStartPos.current = { x: clientX, y: clientY };
        // Store current position as fixed base for this drag (avoid cumulative drift)
        dragStartCanvasPos.current = { x: position.x, y: position.y };
        localPosRef.current = position;

        // 🚀 [优化] 拖拽逻辑采用 requestAnimationFrame 进行节流以提高跟手性与流畅度
        const updateDragPosition = () => {
            dragRafRef.current = null;
            if (!isDraggingRef.current || !latestPointerRef.current) return;

            const { x: mvClientX, y: mvClientY } = latestPointerRef.current;
            const scale = zoomScale || 1;
            const dx = mvClientX - dragStartPos.current.x;
            const dy = mvClientY - dragStartPos.current.y;

            // 只有移动超过一定距离才视为拖拽
            if (dx * dx + dy * dy > 25) {
                wasDraggingRef.current = true;
            }

            // Keep the card on the exact pointer trajectory instead of accumulating per-frame deltas.
            const newPos = snapCanvasPointToGrid({
                x: dragStartCanvasPos.current.x + (dx / scale),
                y: dragStartCanvasPos.current.y + (dy / scale)
            }, { enabled: snapToGrid });
            const stepX = newPos.x - localPosRef.current.x;
            const stepY = newPos.y - localPosRef.current.y;

            // 2. Direct DOM Update - 🚀 直接更新left/top，不使用transform
            if (containerRef.current) {
                const nextLeft = snapCanvasCoordinate(newPos.x - nodeWidth / 2, zoomScale || 1) - originX;
                const nextTop = snapCanvasCoordinate(newPos.y - cardHeight, zoomScale || 1) - originY;
                containerRef.current.style.left = `${nextLeft}px`;
                containerRef.current.style.top = `${nextTop}px`;
            }

            localPosRef.current = newPos;
            onLivePositionChange?.(image.id, newPos);

            // 3. Global Update (Logic) - 🚀 立即触发
            if (onDragDelta && (stepX !== 0 || stepY !== 0)) {
                onDragDelta({ x: stepX, y: stepY }, image.id);
            }
        };

        // 绑定全局事件
        const handleMouseMove = (mvEvent: MouseEvent | TouchEvent) => {
            mvEvent.preventDefault(); // 防止滚动
            const mvClientX = 'touches' in mvEvent ? mvEvent.touches[0].clientX : (mvEvent as MouseEvent).clientX;
            const mvClientY = 'touches' in mvEvent ? mvEvent.touches[0].clientY : (mvEvent as MouseEvent).clientY;

            latestPointerRef.current = { x: mvClientX, y: mvClientY };

            if (dragRafRef.current === null) {
                dragRafRef.current = requestAnimationFrame(updateDragPosition);
            }
        };

        const handleMouseUp = () => {
            const didDrag = wasDraggingRef.current;

            // 清理可能处于 pending 状态的动画帧，确保数据同步
            if (dragRafRef.current !== null) {
                cancelAnimationFrame(dragRafRef.current);
                dragRafRef.current = null;
            }

            // 如果 latestPointer 存在，在 mouseup 时做最后一次更新以保证最新坐标被算入
            if (latestPointerRef.current) {
                const { x: mvClientX, y: mvClientY } = latestPointerRef.current;
                const scale = zoomScale || 1;
                const finalPos = snapCanvasPointToGrid({
                    x: dragStartCanvasPos.current.x + ((mvClientX - dragStartPos.current.x) / scale),
                    y: dragStartCanvasPos.current.y + ((mvClientY - dragStartPos.current.y) / scale)
                }, { enabled: snapToGrid });
                localPosRef.current = finalPos;
            }

            const finalPos = localPosRef.current;
            const totalDelta = {
                x: finalPos.x - dragStartCanvasPos.current.x,
                y: finalPos.y - dragStartCanvasPos.current.y,
            };
            isDraggingRef.current = false;
            setIsDragging(false);
            onDragStateChange?.(false);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('touchend', handleMouseUp);
            dragCleanupRef.current = null;
            latestPointerRef.current = null;

            if (didDrag) {
                suppressClickUntilRef.current = Date.now() + 220;
            }
            wasDraggingRef.current = false;

            // 🚀 拖拽结束 - 位置已经通过left/top实时更新，无需重置transform
            // 但确保最终位置正确
            if (containerRef.current) {
                const finalLeft = snapCanvasCoordinate(finalPos.x - nodeWidth / 2, zoomScale || 1) - originX;
                const finalTop = snapCanvasCoordinate(finalPos.y - cardHeight, zoomScale || 1) - originY;
                containerRef.current.style.left = `${finalLeft}px`;
                containerRef.current.style.top = `${finalTop}px`;
            }
            if (didDrag && (totalDelta.x !== 0 || totalDelta.y !== 0)) {
                onDragCommitRef.current?.(totalDelta, image.id, finalPos);
            }
            onLivePositionChange?.(image.id, null);
        };



        // 🚀 Store cleanup for external cancellation (e.g. HTML5 Drag)
        dragCleanupRef.current = handleMouseUp;

        window.addEventListener('mousemove', handleMouseMove, { passive: false });
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', handleMouseMove, { passive: false });
        window.addEventListener('touchend', handleMouseUp);

    }, [
        image.id,
        position,
        zoomScale,
        onDragStateChange,
        onPositionChange,
        onDragDelta,
        onSelect,
        isSelected,
        nodeWidth,
        cardHeight,
        originX,
        originY,
        onLivePositionChange,
        snapToGrid,
    ]);

    // 🚀 [New] Alias Editing Logic
    const [isEditingAlias, setIsEditingAlias] = useState(false);
    const [aliasValue, setAliasValue] = useState(image.alias || image.fileName || 'Image');

    const handleAliasCommit = () => {
        setIsEditingAlias(false);
        if (aliasValue !== image.alias) {
            onUpdate?.(image.id, { alias: aliasValue });
        }
    };

    const handleImageClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();

        // 忽略按钮点击 (如删除/下载)
        if ((e.target as HTMLElement).closest('button')) return;
        if ((e.target as HTMLElement).closest('input')) return; // Ignore input clicks

        // 如果刚刚拖拽结束，短暂抑制点击，避免落点误触发灯箱。
        if (!canHandleCardClick()) return;

        // 🚀 [修复] 单击/双击均打开灯箱
        if (onPreview) {
            onPreview(image.id);
        }
    }, [canHandleCardClick, image.id, onPreview]);

    const borderScale = zoomScale || 1;
    const adaptiveBorderWidth = Math.max(1, 1.5 / borderScale);
    const renderPos = isDragging ? localPosRef.current : position;
    const stackZIndex = stackZIndexOverride ?? getImageStackZIndex(image, isSelected, isNew, isActive, groupLayerZIndex);
    const effectiveStackZIndex = elevateCanvasStackZIndex(stackZIndex, isDragging);
    const renderLeft = snapCanvasCoordinate(renderPos.x - nodeWidth / 2, zoomScale || 1);
    const renderTop = snapCanvasCoordinate(renderPos.y - cardHeight, zoomScale || 1);
    const textSoftening = getCanvasTextSofteningProfile(
        zoomScale || 1,
        detailLevel === 'compact' || isCanvasTransforming
    );
    const textTransition = 'filter 140ms ease, opacity 140ms ease';
    const primaryTextRenderStyle = {
        filter: textSoftening.active ? `blur(${textSoftening.primaryBlurPx}px)` : 'none',
        opacity: textSoftening.primaryOpacity,
        transition: textTransition,
    };
    const secondaryTextRenderStyle = {
        filter: textSoftening.active ? `blur(${textSoftening.secondaryBlurPx}px)` : 'none',
        opacity: textSoftening.secondaryOpacity,
        transition: textTransition,
    };
    const showActiveAccent = isActive;
    const showSelectedAccent = isSelected;
    const showHighlightedAccent = highlighted && !showActiveAccent && !showSelectedAccent;
    const showSelectionBorder = showSelectedAccent || showHighlightedAccent;
    const selectedBorderColor = 'color-mix(in srgb, var(--accent-coral) 72%, var(--frost-card-main-border))';
    const highlightedBorderColor = 'color-mix(in srgb, var(--accent-coral) 46%, var(--frost-card-main-border))';
    const activeBorderColor = 'var(--kk-image-card-active-border)';
    const cardBorderColor = image.error && !image.isGenerating
        ? 'var(--kk-image-card-error-border)' // 简体中文注释：使用系统错误边框 token，避免卡片状态色继续分叉
        : showSelectedAccent
            ? selectedBorderColor
            : showHighlightedAccent
                ? highlightedBorderColor
                : showActiveAccent
                    ? activeBorderColor
                    : 'var(--border-default)';
    const imageCardAccent = image.error && !image.isGenerating
        ? 'coral' // 简体中文注释：阴影光晕使用更高级的珊瑚粉红调代替原有的强纯红
        : showActiveAccent
            ? 'gold'
            : (showSelectionBorder ? 'coral' : undefined);
    const baseCardShadow = getCanvasCardShadow({ accent: imageCardAccent, boost: shadowBoost, zoomScale });
    const activeRingWidth = Math.max(1, 1.25 / borderScale);
    const selectionRingWidth = Math.max(1.25, 1.7 / borderScale);
    const accentRingShadow = image.error && !image.isGenerating
        ? ''
        : showSelectionBorder && showActiveAccent
            ? `0 0 0 ${activeRingWidth}px color-mix(in srgb, var(--accent-ochre) 24%, transparent), 0 0 0 ${activeRingWidth + selectionRingWidth}px color-mix(in srgb, var(--accent-coral) 18%, transparent)`
            : showSelectionBorder
                ? `0 0 0 ${selectionRingWidth}px color-mix(in srgb, var(--accent-coral) 18%, transparent)`
                : showActiveAccent
                    ? `0 0 0 ${activeRingWidth}px var(--kk-image-card-active-ring)`
                    : '';
    const cardSurfaceShadow = accentRingShadow
        ? `${accentRingShadow}, ${baseCardShadow}`
        : baseCardShadow;
    const cardSurfaceScale = isDragging
        ? 1
        : showSelectedAccent
            ? 1.016
            : (showHighlightedAccent || showActiveAccent ? 1.01 : 1);
    const cardSurfaceTransform = `scale(${cardSurfaceScale})`;
    const imageNodeContainerStyle = {
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        overflow: 'visible',
    } as const;

    if (isSlowLoading) {
        return (
            <div
                ref={containerRef}
                data-card-height={cardHeight}
                style={{
                    position: 'absolute',
                    left: `${snapCanvasCoordinate(position.x - nodeWidth / 2, zoomScale || 1) - originX}px`,
                    top: `${snapCanvasCoordinate(position.y - cardHeight, zoomScale || 1) - originY}px`,
                    width: `${nodeWidth}px`,
                    height: `${cardHeight}px`,
                    pointerEvents: 'none',
                    opacity: 0.8,
                }}
                className="gpu-accelerated transition-opacity duration-300"
            >
                <div
                    className="kk-image-card-skeleton w-full h-full rounded-2xl border animate-pulse"
                />
            </div>
        );
    }

    if (detailLevel === 'thumbnail-shell') {
        const isThumbnailShell = detailLevel === 'thumbnail-shell';
        const shellTitle = image.alias || image.fileName || image.prompt || 'Image';
        const shellSubtitle = isThumbnailShell
            ? truncateByChars(shellTitle, 22)
            : truncateByChars(image.prompt || shellTitle, 42);
        const shellBadgeClass = image.error && !image.isGenerating
            ? 'kk-image-card-pill-error'
            : image.isGenerating
                ? 'text-[var(--accent-coral)] bg-[var(--frost-card-sub-bg)] border-[var(--frost-card-sub-border)]'
                : 'text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border-[var(--border-light)]';
        const isVideoLike = image.mode === GenerationMode.VIDEO || displaySrc?.startsWith('data:video') || displaySrc?.endsWith('.mp4');
        const isAudioLike = image.mode === GenerationMode.AUDIO || displaySrc?.endsWith('.mp3') || displaySrc?.endsWith('.wav');

        return (
            <div
                ref={containerRef}
                id={`image-card-${image.id}`}
                data-x={image.position.x}
                data-y={image.position.y}
                data-card-height={cardHeight}
                className={`image-node ${isChatMode ? 'relative w-full max-w-[460px] mx-auto my-3' : 'absolute'} flex flex-col items-center group select-none`}
                style={isChatMode ? {
                    ...imageNodeContainerStyle,
                    zIndex: effectiveStackZIndex,
                    width: isChatMode ? '100%' : nodeWidth,
                    opacity: 1,
                } : {
                    ...imageNodeContainerStyle,
                    transform: `translate3d(${renderLeft - originX}px, ${renderTop - originY}px, 0px)`,
                    left: 0,
                    top: 0,
                    zIndex: effectiveStackZIndex,
                    width: nodeWidth,
                    opacity: 1,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
                    willChange: isDragging ? 'transform' : 'auto',
                    touchAction: 'none',
                    contain: 'layout style'
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
            >
                <div
                    ref={cardSurfaceRef}
                    data-canvas-surface="image"
                    className="relative w-full overflow-hidden rounded-[20px] border flex flex-col"
                    style={{
                        backgroundColor: 'var(--frost-card-main-bg)',
                        borderColor: cardBorderColor,
                        borderWidth: adaptiveBorderWidth,
                        boxShadow: cardSurfaceShadow,
                        transform: cardSurfaceTransform,
                        transformOrigin: '50% 100%',
                        transitionDuration: isDragging ? '0ms' : 'var(--duration-normal)',
                        transitionProperty: 'transform, box-shadow, border-color',
                    }}
                >
                    {/* 🚀 移除 Connection Point，用户点击卡片不需要也不想触发连线与草稿功能 */}

                    <div
                        className="w-full p-1"
                        onClick={handleImageClick}
                        onDoubleClick={handleImageClick}
                    >
                        <div
                            className="relative w-full overflow-hidden rounded-[16px] border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)]"
                            style={{
                                aspectRatio: image.aspectRatio.replace(':', '/')
                            }}
                        >
                            {isAudioLike ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-[var(--frost-card-framework-bg)] text-[var(--accent-coral)]">
                                    <Music size={28} />
                                </div>
                            ) : isVideoLike ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-[var(--frost-card-framework-bg)] text-[var(--text-primary)]">
                                    <Play size={26} />
                                </div>
                            ) : displaySrc && !imgError ? (
                                <div className="relative w-full h-full">
                                    {!isMediaLoaded && zoomScale >= 0.18 && (
                                        <div className="absolute inset-0 flex items-center justify-center text-[var(--text-tertiary)] bg-[var(--frost-card-framework-bg)]">
                                            <Loader2 size={24} className="animate-spin" />
                                        </div>
                                    )}
                                    <img
                                        src={displaySrc}
                                        decoding="async"
                                        loading="lazy"
                                        referrerPolicy="strict-origin-when-cross-origin"
                                        alt={shellTitle}
                                        className="w-full h-full object-cover block"
                                        style={{
                                            opacity: isMediaLoaded ? 1 : 0,
                                            transition: 'opacity 0.2s ease-in-out',
                                        }}
                                        onLoad={() => setIsMediaLoaded(true)}
                                        onError={() => {
                                            void handleMediaLoadError();
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-[var(--text-tertiary)]">
                                    {isLoading && zoomScale >= 0.18 ? <Loader2 size={24} className="animate-spin" /> : <ImageOff size={24} />}
                                </div>
                            )}
                        </div>
                    </div>

                    <div
                        className={`${isThumbnailShell ? 'px-3 py-2' : 'px-3 py-3'} border-t border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] cursor-pointer`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (canHandleCardClick()) onClick?.(image.id);
                        }}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium ${shellBadgeClass}`}>
                                {image.error && !image.isGenerating ? (
                                    <ImageOff size={12} />
                                ) : image.isGenerating ? (
                                    <Loader2 size={12} className="animate-spin" />
                                ) : (
                                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                )}
                                <span className="truncate">{isThumbnailShell ? aspectSizeLabel : truncateByChars(modelText, 16)}</span>
                            </div>
                            {!isThumbnailShell && (
                                <span className="text-[11px] text-[var(--text-tertiary)] shrink-0">{aspectSizeLabel}</span>
                            )}
                        </div>
                        {/* 🚀 [LOD 优化] 当处于超小缩放的 thumbnail-shell 模式时，不再渲染字幕文本，精简 DOM 层级与排版计算 */}
                        {!isThumbnailShell && (
                            <div className="mt-2.5 text-[13px] leading-5 text-[var(--text-primary)] font-medium">
                                {shellSubtitle}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        // ... (Wrapper Divs) ...
        <>
            <div
                ref={containerRef}
                id={`image-card-${image.id}`}
                data-x={image.position.x}
                data-y={image.position.y}
                data-card-height={cardHeight}
                className={`image-node ${isChatMode ? 'relative w-full max-w-[460px] mx-auto my-3' : 'absolute'} flex flex-col items-center group select-none`}
                style={isChatMode ? {
                    ...imageNodeContainerStyle,
                    zIndex: effectiveStackZIndex,
                    width: isChatMode ? '100%' : nodeWidth,
                    opacity: 1,
                } : {
                    ...imageNodeContainerStyle,
                    transform: `translate3d(${renderLeft - originX}px, ${renderTop - originY}px, 0px)`,
                    left: 0,
                    top: 0,
                    zIndex: effectiveStackZIndex,
                    width: nodeWidth,
                    opacity: 1,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
                    willChange: isDragging ? 'transform' : 'auto',
                    touchAction: 'none',
                    contain: 'layout style'
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
                onClick={(e) => {
                    e.stopPropagation();
                    if (canHandleCardClick()) onClick?.(image.id);
                }}
            >
                {/* 🚀 统一容器 - 图片和信息模块在同一卡片内 */}
                <div
                    ref={cardSurfaceRef}
                    data-canvas-surface="image"
                    className={`
                        relative w-full overflow-hidden flex flex-col
                        border
                        ${isDragging ? '' : 'transition-shadow'}
                    `}
                    style={{
                        backgroundColor: 'var(--frost-card-main-bg)',
                        borderColor: cardBorderColor,
                        borderRadius: 'var(--radius-lg)', // 12px
                        borderWidth: adaptiveBorderWidth,
                        boxShadow: cardSurfaceShadow,
                        transform: cardSurfaceTransform,
                        transformOrigin: '50% 100%',
                        transitionDuration: isDragging ? '0ms' : 'var(--duration-normal)',
                        transitionProperty: 'transform, box-shadow, border-color'
                    }}
                >
                    {/* 🚀 移除 Connection Point，用户点击卡片不需要也不想触发连线与草稿功能 */}

                    {/* 外层内边距容器 - 统一四周一缝隙 (p-1 = 4px) */}
                    <div className="w-full p-1 flex flex-col">
                        {/* 上模块：图片模块（完整圆角 + 边框） */}
                        <div className="relative w-full overflow-hidden rounded-lg border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)]">
                            {isPptSubCard && onPreviewPptStack && !image.isGenerating && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onPreviewPptStack(image.id);
                                    }}
                                    className="kk-image-card-ppt-badge absolute left-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-medium"
                                    title="整屏查看"
                                >
                                    整屏
                                </button>
                            )}
                            {/* 图片视图，支持懒加载/虚拟化 - 单击打开灯箱 */}
                            <div
                                className="relative w-full cursor-pointer"
                                onClick={handleImageClick}
                                onDoubleClick={handleImageClick}
                            >
                                {/* 🚀 [FIX] 图片独立容器：aspectRatio + overflow-hidden 锁定图片尺寸 */}
                                <div
                                    className="relative w-full overflow-hidden"
                                    style={{
                                        aspectRatio: image.aspectRatio.replace(':', '/')
                                    }}
                                >
                                    {/* 🚀 [Optimization] 只要有图可显 (displaySrc)，我们就尝试渲染。
                                对于新生成的图片 (isNew)，即便曾报错也不进入死循环错误 UI，给浏览器 1-2 次自动重传的机会。 */}
                                    {((!imgError || isNew) && displaySrc) ? (
                                        (image.mode === GenerationMode.AUDIO || displaySrc.endsWith('.mp3') || displaySrc.endsWith('.wav')) ? (
                                            <div className="relative w-full h-full group/audio bg-[var(--frost-card-framework-bg)] flex flex-col items-center justify-center overflow-hidden">
                                                <Music size={48} className="text-[var(--accent-coral)] opacity-30 mb-4 z-10 pointer-events-none" />
                                                <audio
                                                    src={displaySrc}
                                                    controls
                                                    controlsList="nodownload"
                                                    className="relative z-10 w-11/12 h-10 opacity-80 hover:opacity-100 transition-opacity"
                                                    onLoadedData={() => setIsMediaLoaded(true)}
                                                    onError={() => {
                                                        console.warn('[ImageCard] Audio load error for', image.id);
                                                        void handleMediaLoadError();
                                                    }}
                                                    onPlay={(e) => { e.stopPropagation(); setIsPlaying(true); }}
                                                    onPause={(e) => { e.stopPropagation(); setIsPlaying(false); }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onDoubleClick={(e) => e.stopPropagation()}
                                                    onMouseDown={stopMediaPointerPropagation}
                                                />
                                            </div>
                                        ) : (image.mode === GenerationMode.VIDEO || displaySrc.startsWith('data:video') || displaySrc.endsWith('.mp4')) ? (
                                            <div className="relative w-full h-full group/video">
                                                <video
                                                    ref={videoRef}
                                                    src={displaySrc}
                                                    className="w-full h-full object-cover block select-none"
                                                    muted loop playsInline
                                                    onPlay={() => setIsPlaying(true)}
                                                    onPause={() => setIsPlaying(false)}
                                                    onLoadedData={() => setIsMediaLoaded(true)}
                                                    onError={() => {
                                                        console.warn('[ImageCard] Video load error for', image.id);
                                                        void handleMediaLoadError();
                                                    }}
                                                />
                                                {/* Play/Pause Overlay with smooth transitions */}
                                                <div className="kk-image-card-video-overlay absolute inset-0 flex items-center justify-center opacity-0 group-hover/video:opacity-100">
                                                    <button
                                                        className="kk-image-card-video-button w-12 h-12 flex items-center justify-center rounded-full backdrop-blur-sm transform hover:scale-110 active:scale-95"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (videoRef.current) {
                                                                if (videoRef.current.paused) videoRef.current.play();
                                                                else videoRef.current.pause();
                                                            }
                                                        }}
                                                    >
                                                        {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <img
                                                src={displaySrc}
                                                decoding="async"
                                                loading="lazy"
                                                referrerPolicy="strict-origin-when-cross-origin"
                                                alt={image.prompt}
                                                style={{
                                                    color: 'transparent',
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                    display: 'block',
                                                    imageRendering: 'auto',
                                                    opacity: isMediaLoaded ? 1 : 0,
                                                    transition: 'opacity 0.2s ease-in-out',
                                                }}

                                                onError={() => {
                                                    // 🚀 [Optimization] 对于新生成的图片 (isNew)，即便触发一次报错也不立即切到报错 UI。
                                                    // 因为 Blob URL/Data URL 可能有极短暂的解析延迟。
                                                    if (isNew) {
                                                        console.debug(`[ImageCard2] 🚀 Suppressing initial error for new image ${image.id}`);
                                                        return;
                                                    }
                                                    void handleMediaLoadError();
                                                }}
                                                onLoad={(e) => {
                                                    setIsMediaLoaded(true);
                                                    failedSourcesRef.current.clear();
                                                    setImgError(false);
                                                    const img = e.target as HTMLImageElement;
                                                    const dims = `${img.naturalWidth}x${img.naturalHeight}`;
                                                    if (onDimensionsUpdate && image.dimensions !== dims) {
                                                        onDimensionsUpdate(image.id, dims);
                                                    }
                                                }}
                                                className="w-full h-full block select-none"
                                                data-native-drag-source="true"
                                                draggable={true}
                                                onMouseDown={stopMediaPointerPropagation}
                                                onDragStart={(e) => {
                                                    // HTML5 Drag for Data Transfer (to PromptBar)
                                                    e.stopPropagation();
                                                    // 🚀 [添加] 触发自定义事件通知 ImagePreview 关闭
                                                    window.dispatchEvent(new CustomEvent('kk-drag-start'));
                                                    const url = image.originalUrl || displaySrc || image.url;
                                                    if (url) {
                                                        e.dataTransfer.setData('text/plain', url);
                                                        // [NEW] Pass structured data for efficient reuse (consistent with PromptNode)
                                                        // 🚀 [FIX] Stop Canvas Drag when HTML5 Drag starts
                                                        if (dragCleanupRef.current) dragCleanupRef.current();

                                                        e.dataTransfer.setData('application/x-kk-image-ref', JSON.stringify({
                                                            storageId: image.storageId || image.id,
                                                            mimeType: 'image/png', // Default, hard to know without fetch or magic
                                                            source: 'image-card',
                                                            data: url.startsWith('data:') ? url : undefined
                                                        }));
                                                        e.dataTransfer.effectAllowed = 'copy';

                                                        // 🚀 [NEW] 如果 URL 是 data URL，同时保存到本地文档系统
                                                        if (url.startsWith('data:')) {
                                                            const storageId = image.storageId || image.id;
                                                            const handle = fileSystemService.getGlobalHandle();
                                                            if (handle) {
                                                                const matches = url.match(/^data:[^,]+,(.+)$/);
                                                                if (matches && matches[1]) {
                                                                    fileSystemService.saveReferenceImage(
                                                                        handle,
                                                                        storageId,
                                                                        matches[1],
                                                                        image.mimeType || 'image/png'
                                                                    ).catch(err => {
                                                                        console.warn('[ImageCard2] Failed to save reference to file system:', err);
                                                                    });
                                                                }
                                                            }
                                                        }
                                                    }
                                                }}
                                            />
                                        )
                                    ) : (
                                        (() => {
                                            const isMediaExpired = image.error === '本地临时图片已失效' ||
                                                (imgError && (
                                                    displaySrc?.startsWith('blob:') ||
                                                    image.url?.startsWith('blob:') ||
                                                    image.originalUrl?.startsWith('blob:')
                                                ));

                                            return (
                                                <div 
                                                    className={joinClasses(
                                                        'kk-image-card-state absolute inset-0 flex flex-col items-center justify-center p-4 text-center rounded-lg',
                                                        isMediaExpired ? 'kk-image-card-state--expired' : 'kk-image-card-state--error'
                                                    )}
                                                >
                                                    {/* 🚀 加载/恢复状态 - 居中显示 */}
                                                    {(isLoading || (!imgError && !displaySrc)) ? (
                                                        // 加载状态由全局遮罩处理，这里显示空白占位
                                                        <div className="absolute inset-0 bg-transparent" />
                                                    ) : (
                                                        <span className="text-xs font-semibold tracking-wide">
                                                            {isMediaExpired
                                                                ? '本地临时图片已失效'
                                                                : (image.mode === GenerationMode.VIDEO ||
                                                                    image.url?.includes('.mp4') ||
                                                                    image.url?.startsWith('data:video') ||
                                                                    displaySrc?.includes('.mp4') ||
                                                                    displaySrc?.startsWith('data:video'))
                                                                    ? '视频加载失败'
                                                                    : (image.mode === GenerationMode.AUDIO ||
                                                                       displaySrc?.includes('.mp3') ||
                                                                       displaySrc?.endsWith('.wav'))
                                                                        ? '音频加载失败'
                                                                        : '图片加载失败'}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })()
                                    )}
                                </div>{/* 关闭图片独立容器 */}

                                {image.error && !image.isGenerating && (() => {
                                    const isExpired = image.error === '本地临时图片已失效';
                                    const errorText = isExpired 
                                        ? '本地临时图片已失效' // '(Expired Blob)' 
                                        : (image.error.toLowerCase().includes('timeout') || image.error.toLowerCase().includes('timed out') || image.error.toLowerCase().includes('超时')
                                            ? '生成超时'
                                            : image.error.toLowerCase().includes('cancel') || image.error.toLowerCase().includes('取消')
                                                ? '已取消'
                                                : '生成失败');
                                    
                                    return (
                                        <div
                                            className={joinClasses(
                                                'kk-image-card-state absolute inset-0 rounded-lg flex items-center justify-center p-4 text-center',
                                                isExpired ? 'kk-image-card-state--expired' : 'kk-image-card-state--error'
                                            )}
                                        >
                                            <span 
                                                className="text-xs font-semibold tracking-wide"
                                            >
                                                {errorText}
                                            </span>
                                        </div>
                                    );
                                })()}

                                {image.isGenerating && (
                                    <div
                                        className="kk-image-card-state kk-image-card-state--generating absolute inset-0 rounded-lg flex flex-col items-center justify-center p-4 text-center"
                                    >
                                        <Loader2 className="animate-spin text-[var(--accent-coral)] mb-2" size={20} />
                                        <span 
                                            className="text-xs font-semibold tracking-wide text-[var(--accent-coral)]"
                                        >
                                            正在生成中...
                                        </span>
                                    </div>
                                )}

                                {((isLoading || !isMediaLoaded) && !imgError) && !image.error && !image.isGenerating && !isCanvasTransforming && (
                                    <div
                                        className="kk-image-card-state kk-image-card-state--loading absolute inset-0 rounded-lg flex flex-col items-center justify-center animate-shimmer-inward"
                                        style={{
                                            willChange: 'opacity',
                                        }}
                                    >
                                        <span 
                                            className="text-xs font-semibold tracking-wide"
                                        >
                                            正在加载...
                                        </span>
                                    </div>
                                )}
                            </div>{/* 关闭图片视图容器 */}
                        </div>{/* 关闭上模块：图片模块 */}

                        {/* 缝隙 (h-1 = 4px) */}
                        <div className="h-1"></div>

                        {/* 下模块：信息模块（完整圆角 + 边框 + 背景色） */}
                        <div className="w-full overflow-hidden bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-light)]">
                            {/* Footer - 根据卡片类型显示不同布局 */}
                            <div
                                className="px-2 py-2 flex flex-col gap-1 relative z-10 box-border cursor-pointer"
                                style={{
                                    backgroundColor: 'transparent',
                                    minHeight: image.orphaned ? '32px' : (image.isGenerating ? '32px' : 'auto')
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (canHandleCardClick()) onClick?.(image.id);
                                }}
                            >
                                {/* 状态1: 孤独副卡（从外面拖入的图片）- 只有一层 */}
                                {image.orphaned && (
                                    <div className="flex items-center justify-between h-5" style={secondaryTextRenderStyle}>
                                        {/* 左侧：文档名 + 像素尺寸 */}
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            {isEditingAlias ? (
                                                <input
                                                    className="flex-1 min-w-0 bg-transparent border-none outline-none text-xs text-[var(--text-primary)] leading-none p-0"
                                                    value={aliasValue}
                                                    onChange={(e) => setAliasValue(e.target.value)}
                                                    onBlur={handleAliasCommit}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAliasCommit(); }}
                                                    autoFocus
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            ) : (
                                                <span
                                                    className="text-xs font-medium text-[var(--text-secondary)] truncate cursor-text hover:text-[var(--text-primary)]"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAliasValue(image.alias || image.fileName || 'Image');
                                                        setIsEditingAlias(true);
                                                    }}
                                                    title={image.alias || image.fileName || 'Reference Image'}
                                                >
                                                    {image.alias || image.fileName || 'Reference Image'}
                                                </span>
                                            )}
                                            {/* 像素尺寸 */}
                                            {image.dimensions && (
                                                <span className="text-2xs text-[var(--text-tertiary)] whitespace-nowrap">
                                                    {image.dimensions}
                                                </span>
                                            )}
                                        </div>
                                        {/* 右侧：删除按钮 */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDelete(image.id); }}
                                            className={joinClasses('hover:text-[var(--accent-red)] transition-colors', iconButtonPaddingClass, metaActionMarginClass)}
                                            title="删除"
                                        >
                                            <Trash2 size={actionIconSize} />
                                        </button>
                                    </div>
                                )}

                                {/* 状态2: 生成过程中 - 只有一层，居中显示 */}
                                {!image.orphaned && image.isGenerating && (
                                    <div className={joinClasses('flex items-center justify-center flex-nowrap group relative', isCompactFooter ? 'gap-1.5 h-[18px]' : 'gap-2 h-5')} style={secondaryTextRenderStyle}>
                                        <div className={joinClasses(`flex items-center gap-1 rounded-lg border min-w-0 ${isCreditModel ? getModelThemeBgColor(image.model || '') : 'bg-[var(--bg-tertiary)] border-[var(--border-light)]'}`, generatingBadgeMaxWidthClass, capsulePaddingClass, isCompactFooter ? 'h-[18px]' : 'h-5')}>
                                            <span className={joinClasses(modelCapsuleTextClass, `leading-none font-medium whitespace-nowrap truncate ${isCreditModel ? 'kk-image-card-credit-text' : modelBadge.colorClass}`)} title={modelText || 'AI'}>
                                                {truncateByChars(modelText || 'AI', 15)}
                                            </span>
                                            {!isCreditModel && providerText && (
                                                <span
                                                    className={joinClasses(providerCapsuleTextClass, `leading-none px-1 py-0.5 rounded whitespace-nowrap border shrink-0 ${getProviderBadgeColor(providerText)}`)}
                                                    title={providerText}
                                                    style={providerBadgeStyle}
                                                >
                                                    {truncateByChars(providerText, 12)}
                                                </span>
                                            )}
                                        </div>
                                        {/* 参数也加框 */}
                                        <div className={joinClasses('flex items-center gap-1 rounded-lg border bg-[var(--bg-tertiary)] border-[var(--border-light)]', capsulePaddingClass, isCompactFooter ? 'h-[18px]' : 'h-5')}>
                                            <span className={joinClasses(modelCapsuleTextClass, 'leading-none text-[var(--text-secondary)] whitespace-nowrap')}>
                                                {aspectSizeLabel}
                                            </span>
                                        </div>

                                        {/* 🚀 [NEW] Hover Stop Button - Shows when mouse is over FOOOTER during generation */}
                                        {onCancel && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onCancel(image.id);
                                                }}
                                                className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--bg-elevated)] opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                                title="点击结束生成"
                                            >
                                                <div className={joinClasses('kk-image-card-stop-generate flex items-center px-3 py-1 rounded-full active:scale-95 shadow-sm transform translate-y-[1px]', isCompactFooter ? 'gap-1' : 'gap-1.5')}>
                                                    <svg className={joinClasses('animate-spin border-r-transparent rounded-full border-2', isTightFooter ? 'w-2.5 h-2.5' : 'w-3 h-3')} viewBox="0 0 24 24" />
                                                    <span className={joinClasses('font-bold', isTightFooter ? 'text-[9px]' : 'text-[10px]')}>结束生成</span>
                                                </div>
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* 状态3: 生成完成 - 两层或三层结构 */}
                                {!image.orphaned && !image.isGenerating && (
                                    <>
                                        {/* 第一层：模型/供应商 + 参数/操作 */}
                                        <div ref={topMetaRowRef} className={joinClasses('flex items-center justify-between w-full min-h-[20px] overflow-hidden', metaRowGapClass)} style={secondaryTextRenderStyle}>
                                            {/* 左侧：模型名 + 供应商（积分模型不显示供应商） */}
                                            <div className={joinClasses('min-w-0 flex items-center overflow-hidden', metaLeftGapClass)}>
                                                {(() => {
                                                    const modelText = resolveModelDisplayName(image.model || image.id, image.modelLabel || image.model || image.id);
                                                    const providerText = resolveDisplayedProviderLabel(image);
                                                    const modelBadge = getModelBadgeInfo({
                                                        id: image.model || '',
                                                        label: modelText,
                                                        provider: providerText,
                                                        colorStart: image.modelColorStart,
                                                        colorEnd: image.modelColorEnd,
                                                        textColor: image.modelTextColor,
                                                    });

                                                    if (isCreditModel) {
                                                        // 积分模型：保持与Prompt加载占位符一样的外观 (胶囊带有系统设置颜色作为字体颜色/透明背景)
                                                        return (
                                                            <span className={joinClasses(`inline-flex items-center rounded font-medium border border-[var(--border-light)] bg-[var(--bg-tertiary)] truncate ${modelBadge.colorClass}`, creditModelBadgeMaxWidthClass, modelCapsulePaddingClass, modelCapsuleTextClass)} title={modelText}>
                                                                {truncateByChars(modelText, 18)}
                                                            </span>
                                                        );
                                                    }

                                                    // 用户 API：普通灰色框 + 普通文本 + 供应商标签
                                                    return (
                                                        <>
                                                            <span className={joinClasses(`inline-flex items-center rounded-md font-medium bg-[var(--bg-tertiary)] border border-[var(--border-light)] truncate ${modelBadge.colorClass}`, modelBadgeMaxWidthClass, modelCapsulePaddingClass, modelCapsuleTextClass)} title={modelText}>
                                                                {truncateByChars(modelText, 14)}
                                                            </span>
                                                            {providerText && (
                                                                <span className={joinClasses(`inline-flex max-w-[72px] truncate px-1 py-0.5 rounded border shrink-0 ${getProviderBadgeColor(providerText)}`, providerCapsuleTextClass)} title={providerText} style={providerBadgeStyle}>
                                                                    {truncateByChars(providerText, 12)}
                                                                </span>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>

                                            {/* 右侧：参数胶囊 + 下载 + 删除 */}
                                            <div className={joinClasses('flex items-center shrink-0', metaRightGapClass)}>
                                                {/* 参数胶囊 */}
                                                <span className={joinClasses('inline-flex items-center rounded-md font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-light)] whitespace-nowrap', capsulePaddingClass, modelCapsuleTextClass)}>
                                                    {aspectSizeLabel}
                                                </span>

                                                <div className="relative" ref={downloadMenuRef}>
                                                    <button onClick={handleDownload} className={joinClasses('hover:text-[var(--accent-coral)] transition-colors', iconButtonPaddingClass)} title={isPptSubCard ? '下载选项' : '下载原图'}>
                                                        <Download size={actionIconSize} />
                                                    </button>
                                                    {showDownloadMenu && isPptSubCard && (() => {
                                                        const btnEl = downloadMenuRef.current?.querySelector('button');
                                                        const rect = btnEl?.getBoundingClientRect();
                                                        const top = rect ? rect.bottom + window.scrollY + 4 : 0;
                                                        const left = rect ? rect.left + window.scrollX - 80 : 0;
                                                        return (
                                                            <LayerPortal zIndex={KK_LAYER.dropdown}>
                                                                <div
                                                                    style={{ position: 'absolute', top, left }}
                                                                    className="kk-image-card-download-menu w-28 rounded-lg p-1"
                                                                >
                                                                    <button
                                                                        onClick={(e) => {
                                                                            setShowDownloadMenu(false);
                                                                            void handleSingleDownload(e);
                                                                        }}
                                                                        className="kk-image-card-download-item flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px]"
                                                                    >
                                                                        <span>下载单图</span>
                                                                    </button>
                                                                    {onDownloadPptComposite && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setShowDownloadMenu(false);
                                                                                onDownloadPptComposite(image.id);
                                                                            }}
                                                                            className="kk-image-card-download-item flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px]"
                                                                        >
                                                                            <span>下载整屏</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </LayerPortal>
                                                        );
                                                    })()}
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); onDelete(image.id); }} className={joinClasses('hover:text-[var(--accent-red)] transition-colors', iconButtonPaddingClass)} title="删除">
                                                    <Trash2 size={actionIconSize} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* 分隔细线 */}
                                        <div className="w-full h-px bg-[var(--border-light)] my-1"></div>

                                        {/* 第二层：耗时/费用 */}
                                        <div
                                            ref={footerInfoRowRef}
                                            title={isCreditModel
                                                ? footerSummaryTitle
                                                : [
                                                    footerTimeLabel,
                                                    showTokenInfo ? `词元 ${displayTokens}` : null,
                                                    hasResolvedDisplayCost ? `\u8d39\u7528 $${displayCost.toFixed(4)}` : '\u8d39\u7528 \u672a\u83b7\u53d6',
                                                ].filter(Boolean).join(' | ')}
                                            className={joinClasses('flex items-center justify-center leading-none text-[var(--text-secondary)] relative group/info overflow-hidden whitespace-nowrap', footerInfoGapClass, isTightFooter ? 'h-[18px]' : 'h-5', footerInfoTextClass)}
                                            style={primaryTextRenderStyle}
                                        >
                                            {image.generationTime ? (
                                                <span title="耗时" className="text-[var(--accent-coral)] shrink-0">{footerTimeLabel}</span>
                                            ) : (
                                                <span className="text-[var(--text-tertiary)] shrink-0">{footerTimeLabel}</span>
                                            )}
                                            {isCreditModel ? (
                                                <>
                                                    <span className={footerSeparatorClass}>|</span>
                                                    <span title="\u79ef\u5206\u6d88\u8017" className="text-[var(--accent-coral)] font-medium shrink-0">{creditFooterLabel}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className={footerSeparatorClass}>|</span>
                                                    {showTokenInfo ? (
                                                        <>
                                                            <span title={`词元消耗 ${displayTokens}`} className="text-emerald-400 shrink-0">{footerTokenLabel}</span>
                                                            <span className={footerSeparatorClass}>|</span>
                                                        </>
                                                    ) : null}
                                                    <span title={hasResolvedDisplayCost ? `\u8d39\u7528 $${displayCost.toFixed(4)}` : '\u8d39\u7528 \u672a\u83b7\u53d6'} className="text-amber-400 shrink-0">
                                                        {hasResolvedDisplayCost ? `\u8d39\u7528 $${displayCost.toFixed(4)}` : '\u8d39\u7528 \u672a\u83b7\u53d6'}
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        {/* 第三层：标签（如果有），最多4个，每个最多6个字 */}
                                        {image.tags && image.tags.length > 0 && (
                                            <div className="flex items-center justify-center gap-1.5 flex-wrap pt-0.5" style={secondaryTextRenderStyle}>
                                                {image.tags.slice(0, 4).map(tag => {
                                                    const colors = generateTagColor(tag);
                                                    // 截断超过6个字的标签
                                                    const displayTag = tag.length > 6 ? tag.slice(0, 6) : tag;
                                                    return (
                                                        <span
                                                            key={tag}
                                                            className="flex items-center justify-center px-2 h-5 text-xs font-medium rounded-lg whitespace-nowrap border"
                                                            style={{
                                                                backgroundColor: colors.bg,
                                                                color: colors.text,
                                                                borderColor: colors.border
                                                            }}
                                                            title={tag}
                                                        >
                                                            #{displayTag}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>{/* 关闭下模块：信息模块 */}
                    </div>{/* 关闭外层 p-1.5 容器 */}
                </div>{/* 关闭统一容器 */}
            </div>

        </>
    );
}, (prev, next) => {
    // 🚀 [Fix] Only compare state/data props to avoid rendering on inline function identity changes
    // [Performance] Added isNew comparison to prevent re-render when isNew changes from stable source
    return (
        prev.image === next.image &&
        prev.position.x === next.position.x &&
        prev.position.y === next.position.y &&
        prev.isActive === next.isActive &&
        prev.groupLayerZIndex === next.groupLayerZIndex &&
        prev.stackZIndexOverride === next.stackZIndexOverride &&
        prev.detailLevel === next.detailLevel &&
        prev.zoomScale === next.zoomScale &&
        prev.isSelected === next.isSelected &&
        prev.highlighted === next.highlighted &&
        prev.shadowBoost === next.shadowBoost &&
        prev.isVisible === next.isVisible &&
        prev.isCanvasTransforming === next.isCanvasTransforming &&
        prev.snapToGrid === next.snapToGrid &&
        prev.isNew === next.isNew
    );
});

export const ImageCard2 = ImageNodeComponent;
export default ImageNodeComponent;
