import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { GeneratedImage, GenerationMode } from '../../types';
import { Download, ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, RotateCcw, Pen, Copy } from 'lucide-react';
import { InpaintModal } from './InpaintModal';
import { notify } from '../../services/system/notificationService';
import { getImage, getStrictOriginalImage } from '../../services/storage/imageStorage';
import { writeTextToClipboard, writeImageToClipboard } from '../../utils/clipboard';
import { generateDownloadFilename, triggerDownload } from '../../utils/downloadUtils';
import { clampGenerationDurationMs, formatGenerationDurationSeconds } from '../../utils/timeUtils';

interface GlobalLightboxProps {
    images: GeneratedImage[];
    initialIndex: number;
    onClose: () => void;
    onEditText?: (image: GeneratedImage) => void;
    onEditPptDeck?: (image: GeneratedImage) => void;
    onInpaint?: (image: GeneratedImage, maskBase64: string, prompt?: string) => void;
    onDownloadPptComposite?: (imageId: string) => void;
}

/**
 * Global lightbox viewer.
 * Displays generated images or videos in fullscreen with zoom, pan, and gallery navigation.
 * @param images Media items to browse.
 * @param initialIndex Initially active item index.
 * @param onClose Close handler.
 */
export const GlobalLightbox: React.FC<GlobalLightboxProps> = ({ images, initialIndex, onClose, onEditText, onEditPptDeck, onInpaint, onDownloadPptComposite }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [showInpaint, setShowInpaint] = useState(false);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
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
    const clampedGenerationTime = clampGenerationDurationMs(image.generationTime);
    const isPptSubCard = image.mode === GenerationMode.PPT && Boolean(image.parentPromptId);
    const downloadMenuRef = useRef<HTMLDivElement>(null);
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
        const onResize = () => setIsMobile(window.innerWidth < 768);
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
            const current = sanitizeUrl(displaySrcRef.current || image.originalUrl || image.url || null);
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
                [displaySrcRef.current, image.originalUrl, image.url]
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
    }, [image.id, image.storageId, image.url, image.originalUrl, sanitizeUrl, trySwitchSource]);

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

        const fallbackCandidates = [image.originalUrl, displaySrcRef.current, image.url]
            .map((value) => sanitizeUrl(value || null))
            .filter((value): value is string => !!value);

        for (const candidate of fallbackCandidates) {
            const blob = await fetchSourceBlob(candidate);
            if (blob) return blob;
        }

        return null;
    }, [fetchSourceBlob, image.id, image.originalUrl, image.storageId, image.url, sanitizeUrl]);

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

        const initialOriginalHint = sanitizeUrl(image.originalUrl || null);
        const initialFallbackSrc = sanitizeUrl(image.url || null);

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

    // 2. Keyboard event listeners
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'ArrowRight') handleNext();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, images.length]); // Rebind listeners when the active index changes.

    // 3. Gallery navigation handlers
    const handlePrev = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
    }, [images.length]);

    const handleNext = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
    }, [images.length]);

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
            // Prefer the locally recovered original before remote fallbacks.
            let target = await getStrictOriginalImage(image.id);
            if (!target && image.storageId && image.storageId !== image.id) {
                target = await getStrictOriginalImage(image.storageId);
            }

            target = target || image.originalUrl || displaySrc || image.url;
            if (!target) return;

            const isVideoMode = image.mode === GenerationMode.VIDEO || (image.url && image.url.includes('.mp4'));
            const isAudioMode = image.mode === GenerationMode.AUDIO || (image.url && (image.url.includes('.mp3') || image.url.includes('.wav')));
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
            // Final fallback: open the asset in a new tab.
            const fallback = image.originalUrl || displaySrc || image.url;
            if (fallback) window.open(fallback, '_blank', 'noopener,noreferrer');
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
        if (isReady) onClose();
    }, [isReady, onClose]);

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
    }, [onClose]);

    if (!image) return null;

    const isVideo = image.mode === GenerationMode.VIDEO || displaySrc?.startsWith('data:video') || displaySrc?.endsWith('.mp4');
    const isAudio = image.mode === GenerationMode.AUDIO || displaySrc?.endsWith('.mp3') || displaySrc?.endsWith('.wav');
    const actionButtonClass = 'shrink-0 flex items-center gap-2 rounded-lg border border-[var(--border-medium)] bg-[var(--bg-tertiary)] px-4 py-2 text-sm font-medium transition-all hover:bg-[var(--bg-secondary)]';
    const iconActionButtonClass = 'shrink-0 inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border-medium)] bg-[var(--bg-tertiary)] px-3 text-sm font-medium transition-all hover:bg-[var(--bg-secondary)]';

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[99999] flex flex-col bg-black/95 animate-fadeIn select-none overflow-hidden"
            onClick={handleBackgroundClick}
            style={isMobile ? {
                paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
                paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
            } : undefined}
        >
            {/* Top bar: close button */}
            <button
                onClick={onClose}
                className="absolute z-50 rounded-full bg-white/10 p-2 text-white transition-opacity hover:opacity-80"
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
                        <div className="p-3 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronLeft size={32} />
                        </div>
                    </div>

                    <div
                        className="absolute right-0 top-0 bottom-0 w-[15%] z-40 flex items-center justify-end pr-4 cursor-pointer transition-colors group"
                        onClick={handleNext}
                        title="下一张"
                    >
                        <div className="p-3 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
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
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            cursor: isPanning ? 'grabbing' : 'grab' // Apply cursor to wrapper
                        }}
                        onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
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
                        onDoubleClick={(e) => { e.preventDefault(); onClose(); }}
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
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
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

            {/* Footer metadata panel */}
            {/* Fixed footer below the media to avoid overlap */}
            <div
                className={`w-full shrink-0 border-t border-[var(--border-light)] bg-[var(--bg-secondary)]/90 text-[var(--text-primary)] backdrop-blur-xl ${isMobile ? 'px-3 py-3' : 'grid min-h-[100px] grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-8'}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex min-w-0 flex-col text-left justify-center">
                    <div
                        className="text-left text-sm font-medium line-clamp-2 cursor-pointer hover:text-indigo-300 transition-colors"
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
                        <span className="bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-medium)]">
                            {currentIndex + 1} / {images.length}
                        </span>
                        <span>{image.model.split('/').pop()}</span>
                        {/* Prefer loaded dimensions, then fall back to metadata */}
                        <span>{realDimensions || image.dimensions || '加载中...'}</span>
                        {clampedGenerationTime > 0 && <span>{formatGenerationDurationSeconds(clampedGenerationTime)}s</span>}
                    </div>
                </div>

                <div className={`mt-3 flex w-full items-center gap-2 ${isMobile ? 'overflow-x-auto pb-1' : 'self-center sm:mt-0 sm:w-auto sm:flex-nowrap sm:justify-end sm:justify-self-end sm:gap-3'}`}>
                    {isMobile && images.length > 1 && (
                        <>
                            <button onClick={handlePrev} className={iconActionButtonClass} title="上一张">
                                <ChevronLeft size={16} />
                            </button>
                            <button onClick={handleNext} className={iconActionButtonClass} title="下一张">
                                <ChevronRight size={16} />
                            </button>
                        </>
                    )}
                    {/* Action controls */}
                    <div className="flex shrink-0 items-center rounded-lg bg-[var(--bg-tertiary)] p-1">
                        <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-2 hover:bg-[var(--bg-secondary)] rounded" title="缩小"><ZoomOut size={16} /></button>
                        <span className="w-12 text-center text-xs">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.min(5, z + 0.25))} className="p-2 hover:bg-[var(--bg-secondary)] rounded" title="放大"><ZoomIn size={16} /></button>
                        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className="p-2 hover:bg-[var(--bg-secondary)] rounded ml-1 border-l border-[var(--border-light)]" title="重置"><RotateCcw size={16} /></button>
                    </div>

                    {/* Partial redraw actions for images only */}
                    {onInpaint && !isVideo && !isAudio && displaySrc && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowInpaint(true);
                            }}
                            className={`${actionButtonClass} hover:border-purple-500 hover:bg-purple-600/80`}
                            title="局部重绘"
                        >
                            <Pen size={16} />
                            重绘
                        </button>
                    )}

                    {onEditPptDeck && image.mode === GenerationMode.PPT && !isVideo && !isAudio && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEditPptDeck(image);
                            }}
                            className={`${actionButtonClass} hover:border-emerald-500 hover:bg-emerald-600/80`}
                            title="Edit layered deck"
                        >
                            <Pen size={16} />
                            Edit Deck
                        </button>
                    )}

                    {onEditText && image.mode === GenerationMode.PPT && !isVideo && !isAudio && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEditText(image);
                            }}
                            className={`${actionButtonClass} hover:border-sky-500 hover:bg-sky-600/80`}
                            title="编辑当前页文字"
                        >
                            <Pen size={16} />
                            Quick Text
                        </button>
                    )}

                    {!isVideo && !isAudio && (
                        <button
                            onClick={handleCopyOriginal}
                            className={`${actionButtonClass} hover:border-cyan-500 hover:bg-cyan-600/80`}
                            title="复制原图"
                        >
                            <Copy size={16} />
                            复制
                        </button>
                    )}

                    <div className="relative" ref={downloadMenuRef}>
                        <button
                            onClick={handleDownload}
                            className="shrink-0 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-indigo-500"
                            title={isPptSubCard && onDownloadPptComposite ? '下载选项' : '下载原图'}
                        >
                            <Download size={16} />
                            下载
                        </button>
                        {showDownloadMenu && isPptSubCard && onDownloadPptComposite && (
                            <div className="absolute right-0 top-full z-20 mt-2 w-36 rounded-xl border border-[var(--border-medium)] bg-[var(--bg-secondary)] p-1.5 shadow-2xl">
                                <button
                                    onClick={(e) => {
                                        setShowDownloadMenu(false);
                                        void handleSingleDownload(e);
                                    }}
                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                                >
                                    <span>下载单图</span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowDownloadMenu(false);
                                        onDownloadPptComposite(image.id);
                                    }}
                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                                >
                                    <span>下载整屏</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Inpaint modal for partial redraw */}
            {showInpaint && displaySrc && (
                <InpaintModal
                    imageUrl={displaySrc}
                    onCancel={() => setShowInpaint(false)}
                    onSave={(maskBase64, prompt) => {
                        setShowInpaint(false);
                        if (onInpaint) {
                            onInpaint(image, maskBase64, prompt);
                        }
                        onClose();
                    }}
                />
            )}
        </div>,
        document.body
    );
};
