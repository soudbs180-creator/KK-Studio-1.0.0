import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { type GeneratedImage, GenerationMode, type RedrawRequest, type ReferenceImage } from '../../types';
import { Download, ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, RotateCcw, Pen, Copy, Sparkles, Trash2, Heart } from 'lucide-react';
import { KK_LAYER } from '@kk/ui';
import { useNavigate, useInRouterContext } from 'react-router-dom';
import { resolveRedrawRouteAndModel } from '../../services/api/capabilityRouteAssignments';

// 简体中文：获取是否已经配置了图片生成的逻辑，根据能力路由配置是否有有效链路来判断
const isImageConfigured = () => {
    const { routeId, modelId } = resolveRedrawRouteAndModel();
    return Boolean(routeId && modelId);
};
import { notify } from '../../services/system/notificationService';
import { getImage, getStrictOriginalImage } from '../../services/storage/imageStorage';
import { writeTextToClipboard, writeImageToClipboard } from '../../utils/clipboard';
import { generateDownloadFilename, triggerDownload } from '../../utils/downloadUtils';
import { clampGenerationDurationMs, formatGenerationDurationSeconds } from '../../utils/timeUtils';
import { pickByDocumentLanguage } from '../../utils/localeText';
import { isPhoneResponsiveWidth } from '../../utils/responsiveSurface';
import { safeOpenLink } from '../../utils/browserUtils';
import { useFavoritesStore } from '../../features/favorites';

type LightboxCssProperties = React.CSSProperties & Record<`--${string}`, string | number>;

const RedrawWorkspace = React.lazy(() =>
    import('./RedrawWorkspace').then((module) => ({ default: module.RedrawWorkspace })),
);

interface GlobalLightboxProps {
    images: GeneratedImage[];
    initialIndex: number;
    onClose: () => void;
    onEditText?: (image: GeneratedImage) => void;
    onEditPptDeck?: (image: GeneratedImage) => void;
    onPartialRedraw?: (image: GeneratedImage, request: RedrawRequest) => void;
    onDeleteImage?: (imageId: string) => void;
    onDownloadPptComposite?: (imageId: string) => void;
    redrawCompleteUrl?: string | null;
    onRedrawAnimationDone?: () => void;
    onUseAsSource?: (image: GeneratedImage) => void; // 🚀 新增继续创作回调
    onOpenSettings?: () => void; // 🚀 新增可选回调，用于非路由上下文环境打开设置
}

/**
 * Global lightbox viewer.
 * Displays generated images or videos in fullscreen with zoom, pan, and gallery navigation.
 * @param images Media items to browse.
 * @param initialIndex Initially active item index.
 * @param onClose Close handler.
 */
export const GlobalLightbox: React.FC<GlobalLightboxProps> = ({ images, initialIndex, onClose, onEditText, onEditPptDeck, onPartialRedraw, onDeleteImage, onDownloadPptComposite, onUseAsSource, onOpenSettings }) => {
    const inRouterContext = useInRouterContext();
    const navigate = inRouterContext ? useNavigate() : null;
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [redrawWorkspaceMode, setRedrawWorkspaceMode] = useState<'fresh' | 'regenerate' | null>(null);
    const [regenerateReferenceImages, setRegenerateReferenceImages] = useState<ReferenceImage[]>([]);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const favoriteItems = useFavoritesStore(state => state.items);
    const addImageFavorite = useFavoritesStore(state => state.addImageFavorite);
    const removeFavorite = useFavoritesStore(state => state.removeFavorite);
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? isPhoneResponsiveWidth(window.innerWidth) : false
    );

    // Image loading state
    const [displaySrc, setDisplaySrc] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const triedSourcesRef = useRef<Set<string>>(new Set());
    const recoveringRef = useRef(false);
    const displaySrcRef = useRef<string | null>(null);
    const managedObjectUrlRef = useRef<string | null>(null);
    const sourceSessionRef = useRef(0);

    const image = images[currentIndex];
    const imageFavorite = favoriteItems.find(item => (
        item.kind === 'favorite-image'
        && (
            item.sourceImageId === image.id
            || (!!image.storageId && item.storageId === image.storageId)
            || (!!image.originalUrl && item.originalUrl === image.originalUrl)
            || (!!image.apiResultUrl && item.apiResultUrl === image.apiResultUrl)
            || (!!image.url && item.url === image.url)
        )
    ));
    const currentRedrawSourceId = image?.redraw?.sourceImageId || image?.partialRedraw?.sourceImageId;
    const sourceImageForRegenerate = currentRedrawSourceId
        ? images.find((item) => item.id === currentRedrawSourceId)
        : undefined;
    const sourceUrlForRegenerate = sourceImageForRegenerate
        ? (sourceImageForRegenerate.originalUrl || sourceImageForRegenerate.apiResultUrl || sourceImageForRegenerate.url)
        : null;
    const redrawWorkspaceImage = redrawWorkspaceMode === 'regenerate' && sourceImageForRegenerate
        ? sourceImageForRegenerate
        : image;
    const redrawWorkspaceImageUrl = redrawWorkspaceMode === 'regenerate' && sourceUrlForRegenerate
        ? sourceUrlForRegenerate
        : displaySrc;
    const clampedGenerationTime = clampGenerationDurationMs(image.generationTime);
    const isPptSubCard = image.mode === GenerationMode.PPT && Boolean(image.parentPromptId);
    const downloadMenuRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const touchGestureActiveRef = useRef(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const panStartPosRef = useRef({ x: 0, y: 0 });

    // Track the actual loaded media dimensions.
    const [realDimensions, setRealDimensions] = useState<string | null>(null);

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        if (img.naturalWidth && img.naturalHeight) {
            setRealDimensions(`${img.naturalWidth}x${img.naturalHeight}`);
        }
        setHasError(false);
        setIsLoading(false);
        recoveringRef.current = false;
        triedSourcesRef.current.clear();
    };

    const sanitizeUrl = useCallback((url: string | null) => {
        if (url && url.startsWith('data:')) {
            const parts = url.split(',');
            if (parts.length === 2) {
                return `${parts[0]},${parts[1].replace(/[\r\n\s]+/g, '')}`;
            }
        }
        return url;
    }, []);

    const toProxyUrl = useCallback((url: string): string => {
        return `https://corsproxy.io/?${encodeURIComponent(url)}`;
    }, []);

    const releaseManagedObjectUrl = useCallback((nextUrl?: string | null) => {
        const currentManagedUrl = managedObjectUrlRef.current;
        if (currentManagedUrl && currentManagedUrl !== nextUrl) {
            URL.revokeObjectURL(currentManagedUrl);
            managedObjectUrlRef.current = null;
        }
    }, []);

    useEffect(() => {
        displaySrcRef.current = displaySrc;
    }, [displaySrc]);

    useEffect(() => {
        const onResize = () => setIsMobile(isPhoneResponsiveWidth(window.innerWidth));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        return () => {
            releaseManagedObjectUrl();
        };
    }, [releaseManagedObjectUrl]);

    const applyDisplaySource = useCallback((nextSrc: string | null, options?: { loading?: boolean; managed?: boolean }) => {
        releaseManagedObjectUrl(nextSrc);
        if (options?.managed && nextSrc?.startsWith('blob:')) {
            managedObjectUrlRef.current = nextSrc;
        }
        displaySrcRef.current = nextSrc;
        setDisplaySrc(nextSrc);
        if (typeof options?.loading === 'boolean') {
            setIsLoading(options.loading);
        }
    }, [releaseManagedObjectUrl]);

    const fetchSourceBlob = useCallback(async (candidate: string): Promise<Blob | null> => {
        const normalized = sanitizeUrl(candidate);
        if (!normalized) return null;

        const requestUrls = /^https?:\/\//i.test(normalized) && !normalized.includes('corsproxy.io/?')
            ? [normalized, toProxyUrl(normalized)]
            : [normalized];

        for (const requestUrl of requestUrls) {
            try {
                const response = await fetch(requestUrl);
                if (!response.ok) continue;

                const blob = await response.blob();
                if (blob.size > 0) {
                    return blob;
                }
            } catch {
                // ignore and continue fallback chain
            }
        }

        return null;
    }, [sanitizeUrl, toProxyUrl]);

    const materializeDisplaySource = useCallback(async (candidate: string): Promise<{ src: string; managed: boolean }> => {
        const normalized = sanitizeUrl(candidate);
        if (!normalized) {
            throw new Error('INVALID_LIGHTBOX_SOURCE');
        }

        if (!/^https?:\/\//i.test(normalized)) {
            return { src: normalized, managed: false };
        }

        const blob = await fetchSourceBlob(normalized);
        if (!blob) {
            return { src: normalized, managed: false };
        }

        return {
            src: URL.createObjectURL(blob),
            managed: true,
        };
    }, [fetchSourceBlob, sanitizeUrl]);

    const trySwitchSource = useCallback(async (candidate: string | null | undefined, sessionId: number = sourceSessionRef.current): Promise<boolean> => {
        if (!candidate) return false;
        const normalized = sanitizeUrl(candidate);
        if (!normalized) return false;
        if (normalized === sanitizeUrl(displaySrcRef.current)) return false;
        if (triedSourcesRef.current.has(normalized)) return false;

        triedSourcesRef.current.add(normalized);
        const { src, managed } = await materializeDisplaySource(normalized);
        if (sessionId !== sourceSessionRef.current) {
            if (managed && src.startsWith('blob:')) {
                URL.revokeObjectURL(src);
            }
            return false;
        }
        const nextIsVideo = image.mode === GenerationMode.VIDEO || src.startsWith('data:video') || src.endsWith('.mp4');
        const nextIsAudio = image.mode === GenerationMode.AUDIO || src.endsWith('.mp3') || src.endsWith('.wav');
        applyDisplaySource(src, { managed, loading: !(nextIsVideo || nextIsAudio) });
        setHasError(false);
        return true;
    }, [applyDisplaySource, image.mode, materializeDisplaySource, sanitizeUrl]);

    const recoverLightboxSource = useCallback(async () => {
        if (recoveringRef.current) return;
        recoveringRef.current = true;

        try {
            const current = sanitizeUrl(displaySrcRef.current || image.originalUrl || image.apiResultUrl || image.url || null);
            if (current) {
                triedSourcesRef.current.add(current);
            }

            const keyCandidates = Array.from(new Set([image.storageId, image.id].filter(Boolean) as string[]));

            for (const key of keyCandidates) {
                try {
                    const original = await getStrictOriginalImage(key);
                    if (await trySwitchSource(original)) return;
                } catch {
                    // ignore
                }

                try {
                    const cached = await getImage(key);
                    if (await trySwitchSource(cached)) return;
                } catch {
                    // ignore
                }
            }

            const fallbackCandidates = Array.from(new Set(
                [displaySrcRef.current, image.originalUrl, image.apiResultUrl, image.url]
                    .map((u) => sanitizeUrl(u || null))
                    .filter((u): u is string => !!u)
            ));

            for (const source of fallbackCandidates) {
                if (await trySwitchSource(source)) return;
            }

            setHasError(true);
            setIsLoading(false);
        } finally {
            recoveringRef.current = false;
        }
    }, [image.apiResultUrl, image.id, image.storageId, image.url, image.originalUrl, sanitizeUrl, trySwitchSource]);

    const resolveOriginalBlob = useCallback(async (): Promise<Blob | null> => {
        const keyCandidates = Array.from(new Set([image.storageId, image.id].filter(Boolean) as string[]));

        for (const key of keyCandidates) {
            try {
                const original = await getStrictOriginalImage(key);
                if (original) {
                    const blob = await fetchSourceBlob(original);
                    if (blob) return blob;
                }
            } catch {
                // ignore
            }

            try {
                const cached = await getImage(key);
                if (cached) {
                    const blob = await fetchSourceBlob(cached);
                    if (blob) return blob;
                }
            } catch {
                // ignore
            }
        }

        const fallbackCandidates = [image.originalUrl, image.apiResultUrl, displaySrcRef.current, image.url]
            .map((value) => sanitizeUrl(value || null))
            .filter((value): value is string => !!value);

        for (const candidate of fallbackCandidates) {
            const blob = await fetchSourceBlob(candidate);
            if (blob) return blob;
        }

        return null;
    }, [fetchSourceBlob, image.apiResultUrl, image.id, image.originalUrl, image.storageId, image.url, sanitizeUrl]);

    // 1. 加载原图链路（可显示优先，失败回退）
    useEffect(() => {
        let active = true;
        const sessionId = sourceSessionRef.current + 1;
        sourceSessionRef.current = sessionId;
        setHasError(false);
        triedSourcesRef.current.clear();
        recoveringRef.current = false;
        setRealDimensions(null);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        applyDisplaySource(null, { loading: true });

        const initialOriginalHint = sanitizeUrl(image.originalUrl || image.apiResultUrl || null);
        const initialFallbackSrc = sanitizeUrl(image.url || image.apiResultUrl || null);

        const loadContent = async () => {
            try {
                const keyCandidates = Array.from(new Set([image.storageId, image.id].filter(Boolean) as string[]));
                let original: string | null = null;

                for (const key of keyCandidates) {
                    original = await getStrictOriginalImage(key);
                    if (original) break;
                }

                if (!original) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    for (const key of keyCandidates) {
                        original = await getStrictOriginalImage(key);
                        if (original) break;
                    }
                }

                if (!active) return;

                if (original) {
                    if (await trySwitchSource(original, sessionId)) {
                        if (sanitizeUrl(original) !== initialOriginalHint) {
                            console.log('[Lightbox] upgraded to original source');
                        }
                        return;
                    }
                }

                const bestAvailableSrc = initialOriginalHint || initialFallbackSrc;
                if (!bestAvailableSrc) {
                    await recoverLightboxSource();
                } else {
                    await trySwitchSource(bestAvailableSrc, sessionId);
                }
            } catch (e) {
                console.error('[Lightbox] loadContent error:', e);
                if (!active) return;
                const bestAvailableSrc = initialOriginalHint || initialFallbackSrc;
                if (!bestAvailableSrc) {
                    await recoverLightboxSource();
                } else {
                    await trySwitchSource(bestAvailableSrc, sessionId);
                }
            }
        };

        void loadContent();
        return () => { active = false; };
    }, [applyDisplaySource, image, recoverLightboxSource, sanitizeUrl, trySwitchSource]);

    // 3. Gallery navigation handlers
    const handlePrev = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
    }, [images.length]);

    const handleNext = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
    }, [images.length]);

    // 2. Keyboard event listeners
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (redrawWorkspaceMode !== null) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'ArrowRight') handleNext();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, images.length, redrawWorkspaceMode, onClose, handlePrev, handleNext]); // Rebind listeners when dependencies change.

    // 4. Zoom and pan interactions
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -0.25 : 0.25;
        setZoom(prev => Math.min(5, Math.max(0.25, prev + delta)));
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 2) return;
        e.preventDefault();
        e.stopPropagation();
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY };
        panStartPosRef.current = { x: pan.x, y: pan.y };
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isPanning) return;
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setPan({
            x: panStartPosRef.current.x + dx,
            y: panStartPosRef.current.y + dy
        });
    }, [isPanning]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    useEffect(() => {
        if (isPanning) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isPanning, handleMouseMove, handleMouseUp]);

    // 简体中文注释：桥接 Refs，保持事件处理器中能访问到最新的状态，避免事件流因 React 重绘闭包获取旧值
    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;
    const panRef = useRef(pan);
    panRef.current = pan;
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const redrawWorkspaceModeRef = useRef(redrawWorkspaceMode);
    redrawWorkspaceModeRef.current = redrawWorkspaceMode;
    const handlePrevRef = useRef(handlePrev);
    handlePrevRef.current = handlePrev;
    const handleNextRef = useRef(handleNext);
    handleNextRef.current = handleNext;
    const imagesRef = useRef(images);
    imagesRef.current = images;

    // 简体中文注释：阻止移动端页面双指缩放和背景滚动，接管大图的原生手势事件流
    useEffect(() => {
        if (!isMobile) return;

        const preventDefaultScale = (e: TouchEvent) => {
            if (e.touches && e.touches.length > 1) {
                if (e.cancelable) {
                    e.preventDefault();
                }
            }
        };

        const preventGesture = (e: Event) => {
            if (e.cancelable) {
                e.preventDefault();
            }
        };

        // 备份并隐藏背景滚动
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        document.addEventListener('touchstart', preventDefaultScale, { passive: false });
        document.addEventListener('touchmove', preventDefaultScale, { passive: false });
        document.addEventListener('gesturestart', preventGesture, { passive: false });
        document.addEventListener('gesturechange', preventGesture, { passive: false });

        return () => {
            document.body.style.overflow = originalOverflow;
            document.removeEventListener('touchstart', preventDefaultScale);
            document.removeEventListener('touchmove', preventDefaultScale);
            document.removeEventListener('gesturestart', preventGesture);
            document.removeEventListener('gesturechange', preventGesture);
        };
    }, [isMobile]);

    // 简体中文注释：移动端 Touch 事件原生绑定，支持单指跟手微缩拖拽、双 Tap 缩放、上下切换结果以及双指捏合捏放。
    const touchStartRef = useRef<{ x: number; y: number }[]>([]);
    const initialTouchDistanceRef = useRef(0);
    const initialTouchZoomRef = useRef(1);
    const initialTouchPanRef = useRef({ x: 0, y: 0 });
    const lastTapRef = useRef(0);

    // 简体中文注释：判断事件目标是否应该被排除在手势交互之外，避免干扰控制按钮或媒体控制条的点击
    const isExcludedFromGesture = (target: EventTarget | null): boolean => {
        if (!target || !(target instanceof Element)) return false;
        return (
            target.closest('.lightbox-exclude') !== null ||
            target.closest('button') !== null ||
            target.closest('a') !== null ||
            target.closest('audio') !== null ||
            target.closest('video') !== null ||
            target.closest('input') !== null ||
            target.closest('textarea') !== null
        );
    };

    const handleTouchStart = useCallback((e: TouchEvent) => {
        // 简体中文注释：如果正在重绘，或者点击的是控制区域或交互按钮，则直接退出，不干扰其原生点击事件
        if (redrawWorkspaceModeRef.current !== null) return;
        if (isExcludedFromGesture(e.target)) return;

        if (e.touches.length === 1) {
            const touch = e.touches[0];
            touchStartRef.current = [{ x: touch.clientX, y: touch.clientY }];
            initialTouchPanRef.current = { ...panRef.current };

            // 双击放大/重置逻辑
            const now = Date.now();
            if (now - lastTapRef.current < 300) {
                if (zoomRef.current !== 1 || panRef.current.x !== 0 || panRef.current.y !== 0) {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                } else {
                    setZoom(2);
                    setPan({ x: 0, y: 0 });
                }
                lastTapRef.current = 0;
            } else {
                lastTapRef.current = now;
            }
        } else if (e.touches.length === 2) {
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            touchStartRef.current = [
                { x: t1.clientX, y: t1.clientY },
                { x: t2.clientX, y: t2.clientY }
            ];
            initialTouchDistanceRef.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            initialTouchZoomRef.current = zoomRef.current;
            initialTouchPanRef.current = { ...panRef.current };
        }
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (redrawWorkspaceModeRef.current !== null) return;
        if (e.touches.length === 1 && touchStartRef.current.length === 1) {
            const touch = e.touches[0];
            const dx = touch.clientX - touchStartRef.current[0].x;
            const dy = touch.clientY - touchStartRef.current[0].y;

            if (zoomRef.current > 1) {
                if (e.cancelable) e.preventDefault();
                setPan({
                    x: initialTouchPanRef.current.x + dx,
                    y: initialTouchPanRef.current.y + dy
                });
            } else {
                if (Math.abs(dy) > Math.abs(dx)) {
                    if (e.cancelable) e.preventDefault();
                    setPan({
                        x: 0,
                        y: dy
                    });
                }
            }
        } else if (e.touches.length === 2 && touchStartRef.current.length === 2) {
            if (e.cancelable) e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const distance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            const factor = distance / initialTouchDistanceRef.current;
            
            const nextZoom = Math.min(5, Math.max(0.5, initialTouchZoomRef.current * factor));
            setZoom(nextZoom);

            const dx = (t1.clientX + t2.clientX) / 2 - (touchStartRef.current[0].x + touchStartRef.current[1].x) / 2;
            const dy = (t1.clientY + t2.clientY) / 2 - (touchStartRef.current[0].y + touchStartRef.current[1].y) / 2;
            setPan({
                x: initialTouchPanRef.current.x + dx,
                y: initialTouchPanRef.current.y + dy
            });
        }
    }, []);

    const handleTouchEnd = useCallback((e: TouchEvent) => {
        if (redrawWorkspaceModeRef.current !== null) return;
        // 简体中文注释：若未记录 touchStart（比如被拦截了），则不处理后续的手势结束逻辑
        if (touchStartRef.current.length === 0) return;

        if (zoomRef.current < 1) {
            setZoom(1);
            setPan({ x: 0, y: 0 });
        }

        if (zoomRef.current === 1 && touchStartRef.current.length === 1) {
            const touch = e.changedTouches[0];
            if (touch) {
                const deltaX = touch.clientX - touchStartRef.current[0].x;
                const deltaY = touch.clientY - touchStartRef.current[0].y;

                if (Math.abs(deltaY) > 140) {
                    if (imagesRef.current.length > 1) {
                        if (deltaY > 0) {
                            handlePrevRef.current();
                        } else {
                            handleNextRef.current();
                        }
                        setPan({ x: 0, y: 0 });
                    } else {
                        onCloseRef.current();
                    }
                } else if (Math.abs(deltaX) > 80 && Math.abs(deltaY) < 60) {
                    if (deltaX > 0) {
                        handlePrevRef.current();
                    } else {
                        handleNextRef.current();
                    }
                    setPan({ x: 0, y: 0 });
                } else {
                    setPan({ x: 0, y: 0 });
                }
            }
        } else if (zoomRef.current > 1) {
            // 保持放大状态
        }
        
        touchStartRef.current = [];
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !isMobile) return;

        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: false });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isMobile, handleTouchStart, handleTouchMove, handleTouchEnd]);

    useEffect(() => {
        if (redrawWorkspaceMode !== 'regenerate') {
            setRegenerateReferenceImages([]);
            return;
        }

        const referenceIds = Array.from(new Set([
            ...(image.redraw?.extraReferenceImageIds || []),
            ...(image.sourceReferenceStorageIds || []),
        ].filter((id): id is string => Boolean(id && !/^redraw-color-map-/i.test(id)))));

        let cancelled = false;
        void (async () => {
            const hydrated = await Promise.all(referenceIds.map(async (id): Promise<ReferenceImage | null> => {
                try {
                    const dataUrl = await getImage(id);
                    if (!dataUrl) return null;
                    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                    return {
                        id,
                        storageId: id,
                        data: match?.[2] || dataUrl,
                        mimeType: match?.[1] || 'image/png',
                        url: dataUrl,
                    };
                } catch {
                    return null;
                }
            }));
            if (!cancelled) {
                setRegenerateReferenceImages(hydrated.filter((item): item is ReferenceImage => Boolean(item)));
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [image.redraw?.extraReferenceImageIds, image.sourceReferenceStorageIds, redrawWorkspaceMode]);

    useEffect(() => {
        setShowDownloadMenu(false);
    }, [currentIndex]);

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

    // 5. Download flow
	    const handleSingleDownload = async (e: React.MouseEvent) => {
	        e.stopPropagation();
	        try {
	            const isVideoMode = image.mode === GenerationMode.VIDEO || (image.url && image.url.includes('.mp4'));
	            const isAudioMode = image.mode === GenerationMode.AUDIO || (image.url && (image.url.includes('.mp3') || image.url.includes('.wav')));
	            // Prefer the locally recovered original before remote fallbacks.
	            let target = await getStrictOriginalImage(image.id);
	            if (!target && image.storageId && image.storageId !== image.id) {
	                target = await getStrictOriginalImage(image.storageId);
	            }

	            target = target || image.originalUrl || null;
	            if (!target && (isVideoMode || isAudioMode)) {
	                target = image.originalUrl || image.apiResultUrl || displaySrc || image.url;
	            }
	            if (!target) return;

	            const exportType = isAudioMode ? 'Audio' : (isVideoMode ? 'Video' : 'Image');
	            const exportExt = isAudioMode ? '.mp3' : (isVideoMode ? '.mp4' : '.png');
            const filename = generateDownloadFilename(exportType, exportExt);

            // Download data/blob URLs directly; fetch http(s) URLs as blobs first.
            if (target.startsWith('data:') || target.startsWith('blob:')) {
                triggerDownload(target, filename);
                return;
            }

            const response = await fetch(target);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            try {
                triggerDownload(objectUrl, filename);
            } finally {
                setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            }
	        } catch (err) {
	            const isVideoMode = image.mode === GenerationMode.VIDEO || (image.url && image.url.includes('.mp4'));
	            const isAudioMode = image.mode === GenerationMode.AUDIO || (image.url && (image.url.includes('.mp3') || image.url.includes('.wav')));
	            if (isVideoMode || isAudioMode) {
	                const fallback = image.originalUrl || image.apiResultUrl || displaySrc || image.url;
	                if (fallback) safeOpenLink(fallback);
	                return;
	            }
	            notify.warning('原图不可用', '当前仅有预览图，未找到可下载的原图。');
	        }
	    };

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

    const handleCopyOriginal = async (e: React.MouseEvent) => {
        e.stopPropagation();

        try {
            const blob = await resolveOriginalBlob();
            if (!blob) {
                throw new Error('ORIGINAL_BLOB_UNAVAILABLE');
            }

            await writeImageToClipboard(blob);
            notify.success('已复制', '原图已复制到剪贴板');
        } catch (error) {
            console.error('[Lightbox] copy original failed:', error);
            notify.warning('复制失败', '当前环境无法直接复制原图，请改用下载。');
        }
    };

    // Prevent accidental double-trigger closes on rapid interactions.
    const [isReady, setIsReady] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 600);
        return () => clearTimeout(timer);
    }, []);

    const handleBackgroundClick = useCallback(() => {
        if (redrawWorkspaceMode !== null) return;
        if (isReady) onClose();
    }, [isReady, onClose, redrawWorkspaceMode]);

    // 7. [Fix] Native Video DoubleClick Capture

    // React's onDoubleClick bubbles, but video fullscreen often happens on native event.
    // We use a capture listener to intercept it BEFORE the browser handles it.
    // 7. [Fix] Native Video DoubleClick Capture (Mousedown Strategy)
    // Browser fullscreen often triggers on the second mousedown, NOT the dblclick event.
    // We use capture: true on mousedown to intercept the 2nd click (`e.detail > 1`)
    // before the video element sees it.
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl) return;

        const handleNativeMousedown = (e: MouseEvent) => {
            if (redrawWorkspaceMode !== null) return;
            // Check if this is the second click (or more) of a double-click
            if (e.detail > 1) {
                // Stop everything immediately
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                onClose();
            }
        };

        // Use capture: true to intercept BEFORE the video element
        videoEl.addEventListener('mousedown', handleNativeMousedown, { capture: true });
        return () => {
            videoEl.removeEventListener('mousedown', handleNativeMousedown, { capture: true });
        };
    }, [onClose, redrawWorkspaceMode]);

    if (!image) return null;

    const isVideo = image.mode === GenerationMode.VIDEO || displaySrc?.startsWith('data:video') || displaySrc?.endsWith('.mp4');
    const isAudio = image.mode === GenerationMode.AUDIO || displaySrc?.endsWith('.mp3') || displaySrc?.endsWith('.wav');
    const getOpacity = () => {
        // 简体中文注释：仅在未放大状态且垂直拖动时，按比例调低背景透明度以透出下层内容
        if (zoom === 1 && Math.abs(pan.y) > 0) {
            const ratio = Math.max(0.2, 1 - Math.abs(pan.y) / 400);
            return ratio * 0.95;
        }
        return 0.95;
    };

    const getScale = () => {
        // 简体中文注释：仅在未放大状态且垂直拖动时，按比例缩小大图以实现微缩拖动回弹效果
        if (zoom === 1 && Math.abs(pan.y) > 0) {
            return Math.max(0.7, 1 - Math.abs(pan.y) / 800);
        }
        return 1;
    };

    const actionButtonClass = 'kk-result-control shrink-0 flex items-center gap-2 rounded-lg px-4 text-sm font-medium active:scale-[0.98]';
    const downloadButtonClass = 'kk-result-control kk-result-primary-action shrink-0 flex items-center gap-2 rounded-lg px-4 text-sm font-semibold active:scale-[0.98]';
    const zoomButtonClass = 'kk-result-icon-control flex items-center justify-center rounded-md text-[var(--kk-result-control-muted-text)] hover:text-[var(--kk-result-control-text)]';
    const zoomGroupClass = 'kk-result-zoom-group flex shrink-0 items-center rounded-lg p-1 gap-0.5';
    const downloadMenuClass = 'kk-result-menu absolute right-0 bottom-full z-20 mb-2 w-36 rounded-xl p-1.5';
    const downloadMenuItemClass = 'kk-result-menu-item flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--kk-result-control-text)]';

    return ReactDOM.createPortal(
        <div
            ref={containerRef}
            className="kk-result-surface kk-lightbox-backdrop fixed inset-0 flex flex-col animate-fadeIn select-none overflow-hidden"
            onClick={handleBackgroundClick}
            style={{
                zIndex: KK_LAYER.fullscreen,
                '--kk-lightbox-backdrop-opacity': getOpacity(),
                transition: (isPanning || zoomRef.current !== 1 || Math.abs(pan.y) > 0) ? 'none' : 'background-color var(--kk-motion-standard) var(--kk-motion-ease-standard)',
                ...(isMobile ? {
                    paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
                    paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
                } : {})
            } as LightboxCssProperties}
        >
            {/* Top bar: close button */}
            <button
                onClick={onClose}
                className="kk-result-icon-control absolute z-50 rounded-full p-2 text-white hover:opacity-90 lightbox-exclude"
                style={isMobile
                    ? { top: 'max(12px, env(safe-area-inset-top, 0px))', right: 12 }
                    : { top: 16, right: 16 }}
                title="关闭"
            >
                <X size={24} />
            </button>

            {/* Navigation controls with subtle visual treatment */}
            {!isMobile && images.length > 1 && (
                <>
                    <div
                        className="absolute left-0 top-0 bottom-0 w-[15%] z-40 flex items-center justify-start pl-4 cursor-pointer transition-colors group"
                        onClick={handlePrev}
                        title="上一张"
                    >
                        <div className="kk-result-icon-control rounded-full p-3 text-white opacity-0 group-hover:opacity-100">
                            <ChevronLeft size={32} />
                        </div>
                    </div>

                    <div
                        className="absolute right-0 top-0 bottom-0 w-[15%] z-40 flex items-center justify-end pr-4 cursor-pointer transition-colors group"
                        onClick={handleNext}
                        title="下一张"
                    >
                        <div className="kk-result-icon-control rounded-full p-3 text-white opacity-0 group-hover:opacity-100">
                            <ChevronRight size={32} />
                        </div>
                    </div>
                </>
            )}

            {/* Main content area */}
            {/* Height budget: 100vh minus footer space */}
            <div
                className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden"
                onWheel={handleWheel}
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the panel.
                style={isMobile
                    ? { padding: '56px 12px 8px' }
                    : { padding: '24px 32px 16px' }}
            >
                {!displaySrc && isLoading ? (
                    <div className="text-white">加载中...</div>
                ) : displaySrc && isAudio ? (
                    <div className="flex w-full max-w-[320px] flex-col items-center justify-center gap-6">
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-pink-400/60">
                            <path d="M9 18V5l12-2v13" />
                            <circle cx="6" cy="18" r="3" />
                            <circle cx="18" cy="16" r="3" />
                        </svg>
                        <audio
                            src={displaySrc!}
                            controls
                            autoPlay
                            className="w-full"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                    </div>
                ) : displaySrc && isVideo ? (
                    <div
                        className="max-w-full max-h-full flex items-center justify-center"
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom * getScale()})`,
                            cursor: isPanning ? 'grabbing' : 'grab' // Apply cursor to wrapper
                        }}
                        onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (redrawWorkspaceMode !== null) return;
                            onClose();
                        }}
                    >
                        <video
                            ref={videoRef}
                            src={displaySrc!}
                            controls
                            autoPlay
                            loop
                            playsInline
                            className="max-w-full max-h-full object-contain pointer-events-auto"
                            // Native listener handles double click
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%'
                            }}
                        />
                    </div>
                ) : displaySrc ? (
                    <img
                        src={displaySrc!}
                        alt={image.prompt}
                        referrerPolicy="strict-origin-when-cross-origin"
                        className={`max-w-full max-h-full object-contain transition-transform duration-100 ${!displaySrc || hasError || isLoading ? 'opacity-0 pointer-events-none' : ''}`}
                        draggable={false}
                        onLoad={handleImageLoad} // Capture real rendered dimensions.
                        onMouseDown={handleMouseDown}
                        onDoubleClick={(e) => {
                            e.preventDefault();
                            if (redrawWorkspaceMode !== null) return;
                            onClose();
                        }}
                        onContextMenu={(e) => {
                            if (isLoading) {
                                e.preventDefault();
                                  return;
                              }
                              e.stopPropagation();
                          }}
                          onError={() => {
                              void recoverLightboxSource();
                          }}
                          style={{
                              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom * getScale()})`,
                              transition: isPanning ? 'none' : 'transform var(--kk-motion-standard) var(--kk-motion-ease-standard)',
                              cursor: isPanning ? 'grabbing' : 'grab'
                          }}
                      />
                  ) : null}
                  {displaySrc && isLoading && !hasError && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="rounded-full bg-black/50 px-4 py-2 text-sm text-white">
                              加载原图...
                          </div>
                      </div>
                  )}
                  {/* Error Fallback */}
                  {hasError && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="bg-[var(--bg-tertiary)] p-4 rounded-lg text-red-400 flex flex-col items-center gap-2">
                              <ZoomOut size={24} />
                              <span>图片加载失败 (Image Load Failed)</span>
                          </div>
                      </div>
                  )}
              </div>

              {!isMobile && images.length > 1 && (
                  <div
                      className="kk-result-panel w-full shrink-0 border-t px-8 py-3 text-[var(--kk-result-control-text)]"
                      onClick={(event) => event.stopPropagation()}
                  >
                      <div className="mb-2 flex items-center justify-between text-xs text-white/55">
                          <span>{image.redraw || image.partialRedraw ? '重绘结果列表' : '结果列表'}</span>
                          <span>{currentIndex + 1} / {images.length}</span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                          {images.map((item, index) => {
                              const thumbSrc = item.url || item.originalUrl || item.apiResultUrl;
                              const isCurrent = index === currentIndex;
                              const isRedrawItem = Boolean(item.redraw || item.partialRedraw);
                              return (
                                  <button
                                      key={item.id}
                                      type="button"
                                      onClick={() => {
                                          setCurrentIndex(index);
                                          setZoom(1);
                                          setPan({ x: 0, y: 0 });
                                      }}
                                      className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border transition-opacity ${isCurrent ? 'border-[var(--kk-result-control-primary-text)] ring-2 ring-white/25' : 'border-[var(--kk-result-panel-border)] opacity-75 hover:opacity-100'}`}
                                      title={item.prompt || `结果 ${index + 1}`}
                                  >
                                      {thumbSrc ? (
                                          <img src={thumbSrc} alt={item.prompt || `结果 ${index + 1}`} className="h-full w-full object-cover" />
                                      ) : (
                                          <span className="flex h-full w-full items-center justify-center bg-[var(--kk-result-control-bg)] text-[10px]">无预览</span>
                                      )}
                                      <span className="absolute bottom-1 left-1 rounded bg-[var(--kk-result-control-overlay-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                          {isRedrawItem ? '重绘' : index + 1}
                                      </span>
                                  </button>
                              );
                          })}
                      </div>
                  </div>
              )}
  
              {/* 简体中文注释：底部信息与操作区和缩略图分层，避免遮挡主图和重绘入口。 */}
              <div
                  className={`kk-result-panel w-full shrink-0 border-t text-[var(--text-primary)] lightbox-exclude ${isMobile ? 'px-3 py-3' : 'grid min-h-[100px] grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-8'}`}
                  onClick={e => e.stopPropagation()}
              >
                  <div className="flex min-w-0 flex-col text-left justify-center">
                      <div
                          className="text-left text-sm font-medium line-clamp-2 cursor-pointer hover:text-[var(--accent-coral)] transition-colors"
                          title="点击复制提示词"
                          onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                  await writeTextToClipboard(image.prompt);
                                  notify.success('已复制', '提示词已复制到剪贴板');
                              } catch (err) {
                                  console.error('Copy failed', err);
                                  notify.warning('复制失败', '当前环境无法复制提示词。');
                              }
                          }}
                      >
                          {image.prompt}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-left text-xs text-[var(--text-tertiary)] sm:gap-3">
                          <span className="bg-[var(--kk-result-control-bg)] px-2 py-0.5 rounded border border-[var(--kk-result-control-border)]">
                              {currentIndex + 1} / {images.length}
                          </span>
                          <span>{image.model.split('/').pop()}</span>
                          {/* Prefer loaded dimensions, then fall back to metadata */}
                          <span>{realDimensions || image.dimensions || '加载中...'}</span>
                          {clampedGenerationTime > 0 && <span>{formatGenerationDurationSeconds(clampedGenerationTime)}s</span>}
                      </div>
                  </div>
  
                  {isMobile ? (
                      /* 简体中文注释：手机端专属的双排自适应流式排版，剥离写死的 h-10 限高，使多余操作可以优雅折行，彻底消除遮挡风险 */
                      <div className="mt-3 flex flex-col w-full gap-3">
                          {/* 第一排：高频缩放控制条与高频下载按钮 */}
                          <div className="flex w-full items-center justify-between gap-2">
                              {/* Action controls */}
                              <div className={zoomGroupClass}>
                                  <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className={zoomButtonClass} title="缩小"><ZoomOut size={16} /></button>
                                  <span className="w-12 text-center text-xs font-mono select-none">{Math.round(zoom * 100)}%</span>
                                  <button onClick={() => setZoom(z => Math.min(5, z + 0.25))} className={zoomButtonClass} title="放大"><ZoomIn size={16} /></button>
                                  <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className={`${zoomButtonClass} ml-1 border-l border-[var(--kk-result-control-border)]`} title="重置"><RotateCcw size={16} /></button>
                              </div>

                              <div className="relative" ref={downloadMenuRef}>
                                  <button
                                      onClick={handleDownload}
                                      className={downloadButtonClass}
                                      title={isPptSubCard && onDownloadPptComposite ? '下载选项' : '下载原图'}
                                  >
                                      <Download size={16} />
                                      下载
                                  </button>
                                  {showDownloadMenu && isPptSubCard && onDownloadPptComposite && (
                                      <div className={downloadMenuClass}>
                                          <button
                                              onClick={(e) => {
                                                  setShowDownloadMenu(false);
                                                  void handleSingleDownload(e);
                                              }}
                                              className={downloadMenuItemClass}
                                          >
                                              <span>下载单图</span>
                                          </button>
                                          <button
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  setShowDownloadMenu(false);
                                                  onDownloadPptComposite(image.id);
                                              }}
                                              className={downloadMenuItemClass}
                                          >
                                              <span>下载整屏</span>
                                          </button>
                                      </div>
                                  )}
                              </div>
                          </div>

                          {/* 第二排：业务操作按钮（使用 flex-wrap 弹性多排包裹自适应） */}
                          <div className="flex flex-wrap w-full items-center gap-2">
                              <button
                                  onClick={handleToggleFavorite}
                                  className={`${actionButtonClass} ${imageFavorite ? 'border-[var(--accent-coral)] text-[var(--accent-coral)]' : 'hover:border-[var(--accent-coral)] hover:text-[var(--accent-coral)]'} flex-1 justify-center`}
                                  title={imageFavorite ? '取消收藏' : '添加至收藏'}
                                  aria-pressed={Boolean(imageFavorite)}
                              >
                                  <Heart size={16} fill={imageFavorite ? 'currentColor' : 'none'} />
                                  收藏
                              </button>
                              {onUseAsSource && !isVideo && !isAudio && (
                                  <button
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          onUseAsSource(image);
                                          onClose();
                                      }}
                                      className={`${actionButtonClass} hover:border-[var(--accent-coral)] hover:text-[var(--accent-coral)] flex-1 justify-center`}
                                      title="将此图设为参考图继续创作"
                                  >
                                      <Sparkles size={16} />
                                      继续创作
                                  </button>
                              )}

                              {onPartialRedraw && !isVideo && !isAudio && displaySrc && (
                                  <button
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          setRedrawWorkspaceMode('fresh');
                                      }}
                                      className={`${actionButtonClass} hover:border-[var(--accent-coral)] hover:text-[var(--accent-coral)] flex-1 justify-center`}
                                      title="重绘"
                                  >
                                      <Pen size={16} />
                                      重绘
                                  </button>
                              )}

                              {onPartialRedraw && !isVideo && !isAudio && displaySrc && (image.redraw || image.partialRedraw) && (
                                  <button
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          setRedrawWorkspaceMode('regenerate');
                                      }}
                                      className={`${actionButtonClass} hover:border-[var(--accent-coral)] hover:text-[var(--accent-coral)] flex-1 justify-center`}
                                      title="复用原图、原提示词和原标记重新生成"
                                  >
                                      <Sparkles size={16} />
                                      不满意重生成
                                  </button>
                              )}

                              {onEditPptDeck && image.mode === GenerationMode.PPT && !isVideo && !isAudio && (
                                  <button
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          onEditPptDeck(image);
                                      }}
                                      className={`${actionButtonClass} hover:border-[var(--accent-coral)] hover:text-[var(--accent-coral)] flex-1 justify-center`}
                                      title={pickByDocumentLanguage('编辑分层页面包', 'Edit layered deck')}
                                  >
                                      <Pen size={16} />
                                      {pickByDocumentLanguage('编辑页面包', 'Edit Deck')}
                                  </button>
                              )}

                              {onEditText && image.mode === GenerationMode.PPT && !isVideo && !isAudio && (
                                  <button
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          onEditText(image);
                                      }}
                                      className={`${actionButtonClass} hover:border-[var(--accent-coral)] hover:text-[var(--accent-coral)] flex-1 justify-center`}
                                      title="编辑当前页文字"
                                  >
                                      <Pen size={16} />
                                      {pickByDocumentLanguage('快速改字', 'Quick Text')}
                                  </button>
                              )}

                              {!isVideo && !isAudio && (
                                  <button
                                      onClick={handleCopyOriginal}
                                      className={`${actionButtonClass} hover:border-[var(--accent-coral)] hover:text-[var(--accent-coral)] flex-1 justify-center`}
                                      title="复制原图"
                                  >
                                      <Copy size={16} />
                                      复制
                                  </button>
                              )}

                              {onDeleteImage && (
                                  <button
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          onDeleteImage(image.id);
                                          if (images.length <= 1) {
                                              onClose();
                                              return;
                                          }
                                          setCurrentIndex((index) => Math.max(0, Math.min(index, images.length - 2)));
                                      }}
                                      className={`${actionButtonClass} kk-result-danger-control flex-1 justify-center`}
                                      title="删除当前结果"
                                  >
                                      <Trash2 size={16} />
                                      删除
                                  </button>
                              )}
                          </div>
                      </div>
                  ) : (
                      <div className="mt-3 flex w-full items-center gap-2 self-center sm:mt-0 sm:w-auto sm:flex-nowrap sm:justify-end sm:justify-self-end sm:gap-3">
                          {/* Action controls */}
                          <div className={zoomGroupClass}>
                              <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className={zoomButtonClass} title="缩小"><ZoomOut size={16} /></button>
                              <span className="w-12 text-center text-xs font-mono select-none">{Math.round(zoom * 100)}%</span>
                              <button onClick={() => setZoom(z => Math.min(5, z + 0.25))} className={zoomButtonClass} title="放大"><ZoomIn size={16} /></button>
                              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className={`${zoomButtonClass} ml-1 border-l border-[var(--kk-result-control-border)]`} title="重置"><RotateCcw size={16} /></button>
                          </div>
   
                          <button
                              onClick={handleToggleFavorite}
                              className={`${actionButtonClass} ${imageFavorite ? 'border-[var(--accent-coral)] text-[var(--accent-coral)]' : 'hover:border-[var(--accent-coral)] hover:text-[var(--accent-coral)]'}`}
                              title={imageFavorite ? '取消收藏' : '添加至收藏'}
                              aria-pressed={Boolean(imageFavorite)}
                          >
                              <Heart size={16} fill={imageFavorite ? 'currentColor' : 'none'} />
                              收藏
                          </button>

                          {/* Continue generation / Use as source action */}
                          {onUseAsSource && !isVideo && !isAudio && (
                              <button
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      onUseAsSource(image);
                                      onClose(); // 将此图片设为参考图后，立即关闭大图灯箱
                                  }}
                                  className={`${actionButtonClass} hover:border-[var(--accent-coral)] hover:text-[var(--accent-coral)]`}
                                  title="将此图设为参考图继续创作"
                              >
                                  <Sparkles size={16} />
                                  继续创作
                              </button>
                          )}
   
                          {onPartialRedraw && !isVideo && !isAudio && displaySrc && (() => {
                              const isImgConfigured = isImageConfigured();
                              return (
                                  <button
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          if (!isImgConfigured) {
                                              if (onOpenSettings) {
                                                   onOpenSettings();
                                               } else if (navigate) {
                                                   navigate('/settings/api-management');
                                               }
                                              onClose();
                                              notify.info('需要配置模型', '重绘功能需要先在能力分配中配置图片模型。');
                                              return;
                                          }
                                          setRedrawWorkspaceMode('fresh');
                                      }}
                                      className={`${actionButtonClass} ${isImgConfigured ? 'hover:border-[var(--accent-coral)] hover:text-[var(--accent-coral)]' : 'opacity-40 hover:opacity-50 grayscale cursor-pointer'}`}
                                      title="重绘"
                                  >
                                      <Pen size={16} />
                                      重绘
                                  </button>
                              );
                          })()}
                          {onPartialRedraw && !isVideo && !isAudio && displaySrc && (image.redraw || image.partialRedraw) && (() => {
                              const isImgConfigured = isImageConfigured();
                              return (
                                  <button
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          if (!isImgConfigured) {
                                              if (onOpenSettings) {
                                                   onOpenSettings();
                                               } else if (navigate) {
                                                   navigate('/settings/api-management');
                                               }
                                              onClose();
                                              notify.info('需要配置模型', '重绘功能需要先在能力分配中配置图片模型。');
                                              return;
                                          }
                                          setRedrawWorkspaceMode('regenerate');
                                      }}
                                      className={`${actionButtonClass} ${isImgConfigured ? 'hover:border-[var(--accent-coral)] hover:text-[var(--accent-coral)]' : 'opacity-40 hover:opacity-50 grayscale cursor-pointer'}`}
                                      title="复用原图、原提示词和原标记重新生成"
                                  >
                                      <Sparkles size={16} />
                                      不满意重生成
                                  </button>
                              );
                          })()}
                          {onEditPptDeck && image.mode === GenerationMode.PPT && !isVideo && !isAudio && (
                              <button
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      onEditPptDeck(image);
                                  }}
                                  className={`${actionButtonClass} hover:border-[var(--accent-coral)] hover:text-[var(--accent-coral)]`}
                                  title={pickByDocumentLanguage('编辑分层页面包', 'Edit layered deck')}
                              >
                                  <Pen size={16} />
                                  {pickByDocumentLanguage('编辑页面包', 'Edit Deck')}
                              </button>
                          )}
      
                          {onEditText && image.mode === GenerationMode.PPT && !isVideo && !isAudio && (
                              <button
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      onEditText(image);
                                  }}
                                  className={`${actionButtonClass} hover:border-[var(--accent-coral)] hover:text-[var(--accent-coral)]`}
                                  title="编辑当前页文字"
                              >
                                  <Pen size={16} />
                                  {pickByDocumentLanguage('快速改字', 'Quick Text')}
                              </button>
                          )}
      
                          {!isVideo && !isAudio && (
                              <button
                                  onClick={handleCopyOriginal}
                                  className={`${actionButtonClass} hover:border-[var(--accent-coral)] hover:text-[var(--accent-coral)]`}
                                  title="复制原图"
                              >
                                  <Copy size={16} />
                                  复制
                              </button>
                          )}
                          {onDeleteImage && (
                              <button
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteImage(image.id);
                                      if (images.length <= 1) {
                                          onClose();
                                          return;
                                      }
                                      setCurrentIndex((index) => Math.max(0, Math.min(index, images.length - 2)));
                                  }}
                                  className={`${actionButtonClass} kk-result-danger-control`}
                                  title="删除当前结果"
                              >
                                  <Trash2 size={16} />
                                  删除
                              </button>
                          )}
      
                          <div className="relative" ref={downloadMenuRef}>
                              <button
                                  onClick={handleDownload}
                                  className={downloadButtonClass}
                                  title={isPptSubCard && onDownloadPptComposite ? '下载选项' : '下载原图'}
                              >
                                  <Download size={16} />
                                  下载
                              </button>
                              {showDownloadMenu && isPptSubCard && onDownloadPptComposite && (
                                  <div className={downloadMenuClass}>
                                      <button
                                          onClick={(e) => {
                                              setShowDownloadMenu(false);
                                              void handleSingleDownload(e);
                                          }}
                                          className={downloadMenuItemClass}
                                      >
                                          <span>下载单图</span>
                                      </button>
                                      <button
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              setShowDownloadMenu(false);
                                              onDownloadPptComposite(image.id);
                                          }}
                                          className={downloadMenuItemClass}
                                      >
                                          <span>下载整屏</span>
                                      </button>
                                  </div>
                              )}
                          </div>
                      </div>
                  )}
            </div>

            {redrawWorkspaceMode && redrawWorkspaceImageUrl && (
                <React.Suspense fallback={null}>
                    <RedrawWorkspace
                        image={redrawWorkspaceImage}
                        imageUrl={redrawWorkspaceImageUrl}
                        isMobile={isMobile}
                        initialPrompt={redrawWorkspaceMode === 'regenerate' ? (image.redraw?.strictPrompt || image.prompt || '') : ''}
                        initialRegions={redrawWorkspaceMode === 'regenerate' ? (image.redraw?.regions || []) : []}
                        initialColorBlocks={redrawWorkspaceMode === 'regenerate' ? (image.redraw?.colorBlocks || []) : []}
                        initialReferenceImages={redrawWorkspaceMode === 'regenerate' ? regenerateReferenceImages : []}
                        onCancel={() => setRedrawWorkspaceMode(null)}
                        onSubmit={(request) => {
                            setRedrawWorkspaceMode(null);
                            if (onPartialRedraw) {
                                onPartialRedraw(redrawWorkspaceImage, request);
                            }
                            onClose();
                        }}
                    />
                </React.Suspense>
            )}
        </div>,
        document.body
    );
};
