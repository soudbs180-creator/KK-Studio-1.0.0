

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { CanvasSceneBounds } from '@kk/shared';
import { APP_DISPLAY_VERSION } from '../../config/appInfo';
import {
    getCanvasDeviceTier,
    getCanvasInteractionIdleRelaxationMs,
    type CanvasDeviceTier,
    type CanvasInteractionPhase,
} from '../../canvas/performanceProfile';
import {
    CANVAS_MIN_SCALE,
    createCanvasFitTransform,
    doesViewportIntersectScene,
    isValidCanvasViewportTransform,
} from '../../canvas/canvasViewportPersistence.ts';
import { getAvailableCanvasViewport, measureCanvasViewportInsets } from '../../canvas/canvasAvailableViewport.ts';

export interface InfiniteCanvasHandle {
    zoomIn: () => void;
    zoomOut: () => void;
    resetView: () => void;
    fitToAll: () => void; // ✅ 缩放到全览所有卡片
    setView: (x: number, y: number, scale: number) => void;
    getCurrentTransform: () => { x: number; y: number; scale: number }; // 🚀 获取当前实时的 transform
    getCanvasRect: () => DOMRect | null; // 🚀 获取画布容器的实际尺寸
}

interface InfiniteCanvasProps {
    children: React.ReactNode;
    showGrid?: boolean;
    onTransformChange?: (transform: { x: number; y: number; scale: number }) => void;
    onInteractionChange?: (state: {
        isDragging: boolean;
        isZooming: boolean;
        interactionPhase: CanvasInteractionPhase;
        idleRelaxationMs: number;
    }) => void;
    onCanvasClick?: () => void; // Called when clicking empty canvas area
    onCanvasDoubleClick?: () => void; // [NEW] Called when double clicking empty canvas area
    onAutoArrange?: () => void; // Called when arrange button is clicked
    onResetView?: () => void; // Called when ESC is pressed (定位最新)
    sceneBounds?: CanvasSceneBounds[];
    restoreFocusBounds?: CanvasSceneBounds[];
    viewStorageKey?: string;
    onMouseDown?: (e: React.MouseEvent) => void;
    onMouseMove?: (e: React.MouseEvent) => void;
    onMouseUp?: (e: React.MouseEvent) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    onImageDrop?: (file: File, canvasPosition: { x: number; y: number }) => void; // [NEW] 拖入图片创建副卡
    id?: string;
    backgroundOverlay?: React.ReactNode;
    reducePointerEffects?: boolean;
}

interface Transform {
    x: number;
    y: number;
    scale: number;
}

interface CanvasInteractionState {
    isDragging: boolean;
    isZooming: boolean;
    interactionPhase: CanvasInteractionPhase;
    idleRelaxationMs: number;
}

interface CachedCanvasRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

const snapTransformForText = (t: Transform): Transform => {
    // Keep translate on whole CSS pixels to avoid corner clipping artifacts
    // on rounded cards when canvas is heavily zoomed/panned.
    const snap = (v: number) => Math.round(v);
    return {
        x: snap(t.x),
        y: snap(t.y),
        scale: t.scale
    };
};

const buildViewportTransform = (nextTransform: Transform, _preferGpu: boolean = false): string => {
    return `translate(${nextTransform.x}px, ${nextTransform.y}px) scale(${nextTransform.scale})`;
};

const InfiniteCanvas = forwardRef<InfiniteCanvasHandle, InfiniteCanvasProps>(({ children, showGrid = true, onTransformChange, onInteractionChange, onCanvasClick, onCanvasDoubleClick, onResetView, sceneBounds = [], restoreFocusBounds = [], viewStorageKey = 'kk_canvas_view:default:desktop', onMouseDown, onMouseMove, onMouseUp, onContextMenu, id, onImageDrop, backgroundOverlay, reducePointerEffects = false }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null); // 🚀 [性能优化] 直接操作DOM
    const containerRectRef = useRef<CachedCanvasRect | null>(null);
    const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const lastTransform = useRef({ x: 0, y: 0 });
    const touchGestureRef = useRef<{
        startDistance: number;
        worldAnchor: { x: number; y: number };
    } | null>(null);

    const isDraggingRef = useRef(false);
    const [isZooming, setIsZooming] = useState(false);

    // 🚀 实时坐标追踪 Ref (解决 React 状态异步延迟，确保 getCurrentTransform 永远返回物理最新值)
    const syncTransformRef = useRef<Transform>({ x: 0, y: 0, scale: 1 });
    const sceneBoundsRef = useRef(sceneBounds);
    const restoreFocusBoundsRef = useRef(restoreFocusBounds);
    const callbackRef = useRef({
        onTransformChange,
        onInteractionChange,
        onMouseDown,
        onMouseMove,
        onCanvasClick,
        onCanvasDoubleClick,
        onContextMenu,
        onImageDrop,
        onResetView,
    });
    const interactionDeviceTierRef = useRef<CanvasDeviceTier>(
        getCanvasDeviceTier({
            hardwareConcurrency: typeof navigator === 'undefined' ? undefined : navigator.hardwareConcurrency,
            deviceMemory: typeof navigator === 'undefined'
                ? undefined
                : (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
        })
    );
    const interactionIdleTimeoutRef = useRef<number | null>(null);
    const interactionStateRef = useRef<CanvasInteractionState>({
        isDragging: false,
        isZooming: false,
        interactionPhase: 'idle',
        idleRelaxationMs: 0,
    });

    // 🚀 性能优化：缩放防抖
    const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const zoomIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [isImageDragOver, setIsImageDragOver] = useState(false); // 图片拖拽悬停状态
    const dragCounter = useRef(0); // 防止拖拽事件抖动

    const gridGlowAnimationFrameRef = useRef<number | null>(null);
    const gridGlowIdleTimeoutRef = useRef<number | null>(null);
    const gridGlowPointerInsideRef = useRef(false);
    const gridGlowCurrentRef = useRef({ x: 0, y: 0, opacity: 0, scale: 0.32 });
    const gridGlowTargetRef = useRef({ x: 0, y: 0, opacity: 0, scale: 0.32 });

    useEffect(() => {
        sceneBoundsRef.current = sceneBounds;
        restoreFocusBoundsRef.current = restoreFocusBounds;
    }, [restoreFocusBounds, sceneBounds]);

    useEffect(() => {
        callbackRef.current = {
            onTransformChange,
            onInteractionChange,
            onMouseDown,
            onMouseMove,
            onCanvasClick,
            onCanvasDoubleClick,
            onContextMenu,
            onImageDrop,
            onResetView,
        };
    }, [
        onCanvasClick,
        onCanvasDoubleClick,
        onContextMenu,
        onImageDrop,
        onInteractionChange,
        onMouseDown,
        onMouseMove,
        onResetView,
        onTransformChange,
    ]);

    const readContainerRect = useCallback((): CachedCanvasRect | null => {
        const container = containerRef.current;
        if (!container) return null;

        const rect = container.getBoundingClientRect();
        const cachedRect = {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
        };
        containerRectRef.current = cachedRect;
        return cachedRect;
    }, []);

    const emitLiveTransformChange = useCallback((nextTransform: Transform) => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent('kk-canvas-live-transform', {
            detail: nextTransform,
        }));
    }, []);

    const emitTransformChange = useCallback((nextTransform: Transform) => {
        callbackRef.current.onTransformChange?.(nextTransform);
    }, []);

    const buildInteractionState = useCallback((
        isDraggingValue: boolean,
        isZoomingValue: boolean,
        interactionPhase: CanvasInteractionPhase
    ): CanvasInteractionState => ({
        isDragging: isDraggingValue,
        isZooming: isZoomingValue,
        interactionPhase,
        idleRelaxationMs: getCanvasInteractionIdleRelaxationMs(
            interactionPhase,
            interactionDeviceTierRef.current
        ),
    }), []);

    const emitInteractionState = useCallback((nextState: CanvasInteractionState) => {
        const prevState = interactionStateRef.current;
        const didChange =
            prevState.isDragging !== nextState.isDragging
            || prevState.isZooming !== nextState.isZooming
            || prevState.interactionPhase !== nextState.interactionPhase
            || prevState.idleRelaxationMs !== nextState.idleRelaxationMs;

        interactionStateRef.current = nextState;
        setIsDragging(prev => (prev === nextState.isDragging ? prev : nextState.isDragging));
        setIsZooming(prev => (prev === nextState.isZooming ? prev : nextState.isZooming));

        if (didChange) {
            callbackRef.current.onInteractionChange?.(nextState);
        }
    }, []);

    const clearInteractionIdleTimeout = useCallback(() => {
        if (interactionIdleTimeoutRef.current !== null) {
            window.clearTimeout(interactionIdleTimeoutRef.current);
            interactionIdleTimeoutRef.current = null;
        }
    }, []);

    const activateInteractionPhase = useCallback((nextPhase: Exclude<CanvasInteractionPhase, 'idle'>) => {
        clearInteractionIdleTimeout();

        const currentState = interactionStateRef.current;
        emitInteractionState(buildInteractionState(
            nextPhase === 'pan' ? true : currentState.isDragging,
            nextPhase === 'zoom' ? true : false,
            nextPhase
        ));
    }, [buildInteractionState, clearInteractionIdleTimeout, emitInteractionState]);

    const settleInteractionPhase = useCallback((releasedPhase: Exclude<CanvasInteractionPhase, 'idle'>) => {
        clearInteractionIdleTimeout();

        const currentState = interactionStateRef.current;
        const nextIsDragging = releasedPhase === 'pan' ? false : currentState.isDragging;
        const nextIsZooming = releasedPhase === 'zoom' ? false : currentState.isZooming;

        if (nextIsDragging || nextIsZooming) {
            emitInteractionState(buildInteractionState(
                nextIsDragging,
                nextIsZooming,
                nextIsZooming ? 'zoom' : 'pan'
            ));
            return;
        }

        const relaxingState = buildInteractionState(false, false, releasedPhase);
        emitInteractionState(relaxingState);

        interactionIdleTimeoutRef.current = window.setTimeout(() => {
            interactionIdleTimeoutRef.current = null;
            const latestState = interactionStateRef.current;
            if (latestState.isDragging || latestState.isZooming) {
                return;
            }

            emitInteractionState(buildInteractionState(false, false, 'idle'));
        }, relaxingState.idleRelaxationMs);
    }, [buildInteractionState, clearInteractionIdleTimeout, emitInteractionState]);

    const scheduleZoomIdleSettle = useCallback(() => {
        if (zoomIndicatorTimeoutRef.current) {
            clearTimeout(zoomIndicatorTimeoutRef.current);
        }

        zoomIndicatorTimeoutRef.current = setTimeout(() => {
            settleInteractionPhase('zoom');
        }, 260);
    }, [settleInteractionPhase]);

    const applyGridGlow = useCallback((x: number, y: number, opacity: number, scale: number) => {
        const grid = gridRef.current;
        if (!grid) return;

        grid.style.setProperty('--grid-glow-x', `${x.toFixed(1)}px`);
        grid.style.setProperty('--grid-glow-y', `${y.toFixed(1)}px`);
        grid.style.setProperty('--grid-glow-opacity', opacity.toFixed(3));
        grid.style.setProperty('--grid-glow-scale', scale.toFixed(3));
    }, []);

    const animateGridGlow = useCallback(() => {
        gridGlowAnimationFrameRef.current = null;

        const current = gridGlowCurrentRef.current;
        const target = gridGlowTargetRef.current;

        current.x = target.x;
        current.y = target.y;
        current.opacity += (target.opacity - current.opacity) * 0.16;
        current.scale += (target.scale - current.scale) * 0.16;

        applyGridGlow(current.x, current.y, current.opacity, current.scale);

        const needsNextFrame =
            Math.abs(current.opacity - target.opacity) > 0.02
            || Math.abs(current.scale - target.scale) > 0.02;

        if (needsNextFrame) {
            gridGlowAnimationFrameRef.current = window.requestAnimationFrame(animateGridGlow);
            return;
        }

        current.x = target.x;
        current.y = target.y;
        current.opacity = target.opacity;
        current.scale = target.scale;
        applyGridGlow(current.x, current.y, current.opacity, current.scale);
    }, [applyGridGlow]);

    const queueGridGlowAnimation = useCallback(() => {
        if (gridGlowAnimationFrameRef.current !== null) return;
        gridGlowAnimationFrameRef.current = window.requestAnimationFrame(animateGridGlow);
    }, [animateGridGlow]);

    const setGridGlowTarget = useCallback((clientX: number, clientY: number, opacity: number, scale: number) => {
        if (!showGrid || reducePointerEffects) return;

        const rect = containerRectRef.current || readContainerRect();
        if (!rect) return;

        const nextX = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const nextY = Math.max(0, Math.min(rect.height, clientY - rect.top));
        const current = gridGlowCurrentRef.current;
        const previousTarget = gridGlowTargetRef.current;

        current.x = nextX;
        current.y = nextY;

        if (current.opacity < 0.02 && previousTarget.opacity < 0.02) {
            current.scale = 0.42;
            applyGridGlow(nextX, nextY, opacity, current.scale);
        } else {
            applyGridGlow(nextX, nextY, current.opacity, current.scale);
        }

        gridGlowTargetRef.current = { x: nextX, y: nextY, opacity, scale };
        queueGridGlowAnimation();
    }, [applyGridGlow, queueGridGlowAnimation, readContainerRect, reducePointerEffects, showGrid]);

    const scheduleGridGlowIdleFade = useCallback(() => {
        if (!showGrid || reducePointerEffects) return;

        if (gridGlowIdleTimeoutRef.current !== null) {
            window.clearTimeout(gridGlowIdleTimeoutRef.current);
        }

        gridGlowIdleTimeoutRef.current = window.setTimeout(() => {
            gridGlowIdleTimeoutRef.current = null;
            gridGlowTargetRef.current = { ...gridGlowTargetRef.current, opacity: 0, scale: 0.24 };
            queueGridGlowAnimation();
        }, 1150);
    }, [queueGridGlowAnimation, reducePointerEffects, showGrid]);

    const fadeGridGlow = useCallback(() => {
        if (!showGrid || reducePointerEffects) return;

        if (gridGlowIdleTimeoutRef.current !== null) {
            window.clearTimeout(gridGlowIdleTimeoutRef.current);
            gridGlowIdleTimeoutRef.current = null;
        }

        gridGlowTargetRef.current = { ...gridGlowTargetRef.current, opacity: 0, scale: 0.2 };
        queueGridGlowAnimation();
    }, [queueGridGlowAnimation, reducePointerEffects, showGrid]);

    // Center the canvas on mount OR restore from localStorage
    useEffect(() => {
        const rect = readContainerRect();
        if (!rect) return;
        const available = getAvailableCanvasViewport(rect, measureCanvasViewportInsets(rect));

        const initialGlow = {
            x: rect.width / 2,
            y: rect.height / 2,
            opacity: 0,
            scale: 0.32,
        };
        gridGlowCurrentRef.current = initialGlow;
        gridGlowTargetRef.current = initialGlow;
        applyGridGlow(initialGlow.x, initialGlow.y, initialGlow.opacity, initialGlow.scale);

        // Restore only a view that still intersects the current scene.
        try {
            const savedView = localStorage.getItem(viewStorageKey);
            if (savedView) {
                const parsed = JSON.parse(savedView);
                if (
                    isValidCanvasViewportTransform(parsed)
                    && doesViewportIntersectScene(parsed, available, sceneBoundsRef.current)
                ) {
                    setTransform(parsed);
                    syncTransformRef.current = parsed;
                    emitTransformChange(parsed);
                    return;
                }

                localStorage.removeItem(viewStorageKey);
            }
        } catch (e) {
            console.error("Failed to load canvas view", e);
            localStorage.removeItem(viewStorageKey);
        }

        const initialTransformBase = createCanvasFitTransform(
            restoreFocusBoundsRef.current.length > 0 ? restoreFocusBoundsRef.current : sceneBoundsRef.current,
            available,
            {
            padding: 72,
            minScale: CANVAS_MIN_SCALE,
            maxScale: 1,
        });
        const initialTransform = initialTransformBase ? {
            ...initialTransformBase,
            x: initialTransformBase.x + available.x,
            y: initialTransformBase.y + available.y,
        } : {
            x: available.centerX,
            y: available.centerY,
            scale: 1
        };
        setTransform(initialTransform);
        syncTransformRef.current = initialTransform;
        emitTransformChange(initialTransform);
    }, [applyGridGlow, emitTransformChange, readContainerRect, viewStorageKey]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        readContainerRect();
        const handleResize = () => {
            readContainerRect();
        };

        window.addEventListener('resize', handleResize, { passive: true });

        if (typeof ResizeObserver === 'undefined') {
            return () => {
                window.removeEventListener('resize', handleResize);
            };
        }

        const resizeObserver = new ResizeObserver(() => {
            readContainerRect();
        });
        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, [readContainerRect]);

    // Save view to localStorage on change (debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            localStorage.setItem(viewStorageKey, JSON.stringify(transform));
        }, 500);
        return () => clearTimeout(timer);
    }, [transform, viewStorageKey]);

    useEffect(() => {
        callbackRef.current.onInteractionChange?.(interactionStateRef.current);
    }, []);

    // Handle mouse wheel zoom
    // 🚀 优化：缩放时使用临时transform + 防抖 + 缓动曲线
    const handleWheel = useCallback((e: WheelEvent) => {
        // 🚀 [FIX] Allow scrolling inside text areas/custom scrollbars
        if ((e.target as HTMLElement).closest('.input-bar, .custom-scrollbar, textarea, input')) {
            return;
        }
        e.preventDefault();
        activateInteractionPhase('zoom');
        scheduleZoomIdleSettle();

        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // 🚀 动态缓动：根据滚轮速度自适应intensity
        // 快速滚动时响应更大，慢速滚动时更精细
        const rawDelta = Math.abs(e.deltaY);
        const speedFactor = Math.min(1, rawDelta / 100); // 0-1，100+为快速滚动

        // 缓动曲线：easeOutQuad - 快速开始，缓慢结束
        const easedFactor = 1 - (1 - speedFactor) * (1 - speedFactor);

        // intensity范围：0.0005（慢）到 0.002（快）
        const minIntensity = 0.0005;
        const maxIntensity = 0.002;
        const zoomIntensity = minIntensity + easedFactor * (maxIntensity - minIntensity);

        const delta = -e.deltaY * zoomIntensity;
        // 🚀 使用 syncTransformRef 获取最新的物理值，避免连续滚动时的状态滞后
        const currentTransform = syncTransformRef.current;
        const newScale = Math.max(0.1, Math.min(3, currentTransform.scale * (1 + delta)));

        // Zoom towards mouse position
        const scaleRatio = newScale / currentTransform.scale;
        const newX = mouseX - (mouseX - currentTransform.x) * scaleRatio;
        const newY = mouseY - (mouseY - currentTransform.y) * scaleRatio;

        const newTransform = snapTransformForText({ x: newX, y: newY, scale: newScale });

        // 🚀 立即更新 Ref 和 DOM
        syncTransformRef.current = newTransform;
        if (viewportRef.current) {
            viewportRef.current.style.transform = buildViewportTransform(newTransform, true);
        }
        emitLiveTransformChange(newTransform);

        // 🚀 防抖：50ms后再提交最终transform到React状态树
        if (zoomTimeoutRef.current) {
            clearTimeout(zoomTimeoutRef.current);
        }
        zoomTimeoutRef.current = setTimeout(() => {
            setTransform(newTransform);
            emitTransformChange(newTransform);
        }, 50);
    }, [activateInteractionPhase, emitLiveTransformChange, emitTransformChange, scheduleZoomIdleSettle]);

    // 图片拖拽处理
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;

        if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
            setIsImageDragOver(true);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;

        if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setIsImageDragOver(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current = 0;
        setIsImageDragOver(false);

        if (!callbackRef.current.onImageDrop) return;

        // 🚀 [FIX] Ignore Internal Drags (prevent orphan creation from internal move)
        // Check if the drag data includes our internal type
        if (e.dataTransfer.types.includes('application/x-kk-image-ref')) {
            return;
        }

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const imageFile = Array.from(files).find(f => f.type.startsWith('image/'));
            if (imageFile) {
                const container = containerRef.current;
                if (!container) return;

                const rect = container.getBoundingClientRect();
                const clientX = e.clientX - rect.left;
                const clientY = e.clientY - rect.top;

                const canvasX = (clientX - transform.x) / transform.scale;
                const canvasY = (clientY - transform.y) / transform.scale;

                callbackRef.current.onImageDrop?.(imageFile, { x: canvasX, y: canvasY });
            }
        }
    }, [transform]);

    const startCanvasPan = useCallback((clientX: number, clientY: number) => {
        const currentTransform = syncTransformRef.current;

        isDraggingRef.current = true;
        dragStart.current = { x: clientX, y: clientY };
        lastTransform.current = { x: currentTransform.x, y: currentTransform.y };
        activateInteractionPhase('pan');
        setGridGlowTarget(clientX, clientY, 0.52, 0.72);
    }, [activateInteractionPhase, setGridGlowTarget]);

    const handleMouseDownCapture = useCallback((e: React.MouseEvent) => {
        if (e.button !== 1) return;

        // Middle mouse should always pan the canvas, even above cards or controls.
        e.preventDefault();
        e.stopPropagation();
        startCanvasPan(e.clientX, e.clientY);
    }, [startCanvasPan]);

    // Handle mouse down for panning
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const isEmptyCanvas = e.target === containerRef.current || (e.target as HTMLElement).classList.contains('canvas-grid');

        if (e.button === 1) {
            return;
        }

        // Call parent handler first
        callbackRef.current.onMouseDown?.(e);

        // Pan on Left Button (0) on empty background
        // IGNORE Right Button (2) to allow external handling (Selection)
        if (isEmptyCanvas && e.button === 0) {
            e.preventDefault();
            startCanvasPan(e.clientX, e.clientY);
            isDraggingRef.current = true; // 🚀 设置拖动标记
        }
    }, [startCanvasPan]);

    // Handle mouse move for panning
    // 🚀 优化：拖动时只更新临时transform，不触发重绘
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current) return;

        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;

        // 🚀 [Fix Text Jitter] Round coordinates to nearest integer pixel to prevent subpixel antialiasing flutter
        const newTransform = {
            x: Math.round(lastTransform.current.x + dx),
            y: Math.round(lastTransform.current.y + dy),
            scale: syncTransformRef.current.scale
        };

        // 实时同步到 Ref
        syncTransformRef.current = newTransform;

        // 🚀 直接操作DOM，不触发React重绘!
        if (viewportRef.current) {
            viewportRef.current.style.transform = buildViewportTransform(newTransform, true);
        }
        emitLiveTransformChange(newTransform);
    }, [emitLiveTransformChange]);

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        callbackRef.current.onMouseMove?.(e);
        setGridGlowTarget(
            e.clientX,
            e.clientY,
            isDraggingRef.current ? 0.52 : 0.82,
            isDraggingRef.current ? 0.72 : 0.96
        );
        scheduleGridGlowIdleFade();
    }, [scheduleGridGlowIdleFade, setGridGlowTarget]);

    const handleCanvasMouseLeave = useCallback(() => {
        gridGlowPointerInsideRef.current = false;
        fadeGridGlow();
    }, [fadeGridGlow]);

    const handleWindowMouseMoveForGlow = useCallback((e: MouseEvent) => {
        if (!showGrid || reducePointerEffects) return;

        const rect = containerRectRef.current || readContainerRect();
        if (!rect) return;

        const isInside =
            e.clientX >= rect.left
            && e.clientX <= rect.right
            && e.clientY >= rect.top
            && e.clientY <= rect.bottom;

        if (!isInside) {
            if (gridGlowPointerInsideRef.current) {
                gridGlowPointerInsideRef.current = false;
                fadeGridGlow();
            }
            return;
        }

        gridGlowPointerInsideRef.current = true;
        setGridGlowTarget(
            e.clientX,
            e.clientY,
            isDraggingRef.current ? 0.52 : 0.82,
            isDraggingRef.current ? 0.72 : 0.96
        );
        scheduleGridGlowIdleFade();
    }, [fadeGridGlow, readContainerRect, reducePointerEffects, scheduleGridGlowIdleFade, setGridGlowTarget, showGrid]);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (isDraggingRef.current) {
            const dist = Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y);

            // 提交最终transform（触发重绘）
            const finalTransform = syncTransformRef.current;

            // 如果发生了移动，则同步最终状态
            if (finalTransform.x !== lastTransform.current.x || finalTransform.y !== lastTransform.current.y) {
                const roundedFinal = {
                    ...finalTransform,
                    x: Math.round(finalTransform.x),
                    y: Math.round(finalTransform.y)
                };
                syncTransformRef.current = roundedFinal;
                setTransform(roundedFinal);
                emitTransformChange(roundedFinal);
                emitLiveTransformChange(roundedFinal);
            }

            // 检查是否是点击（移动距离<5px）
            if (dist < 5 && e.button === 0) {
                callbackRef.current.onCanvasClick?.();
            }

            isDraggingRef.current = false;
            settleInteractionPhase('pan');
        }
    }, [emitLiveTransformChange, emitTransformChange, settleInteractionPhase]);

    // Zoom controls
    const zoomIn = useCallback(() => {
        const currentTransform = syncTransformRef.current;
        const newScale = Math.min(3, currentTransform.scale * 1.1);
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const scaleRatio = newScale / currentTransform.scale;
        const newX = centerX - (centerX - currentTransform.x) * scaleRatio;
        const newY = centerY - (centerY - currentTransform.y) * scaleRatio;

        const newTransform = snapTransformForText({ x: newX, y: newY, scale: newScale });
        syncTransformRef.current = newTransform;
        if (viewportRef.current) {
            viewportRef.current.style.transform = buildViewportTransform(newTransform, true);
        }
        emitLiveTransformChange(newTransform);

        if (zoomTimeoutRef.current) {
            clearTimeout(zoomTimeoutRef.current);
        }
        zoomTimeoutRef.current = setTimeout(() => {
            setTransform(newTransform);
            emitTransformChange(newTransform);
        }, 50);

        activateInteractionPhase('zoom');
        scheduleZoomIdleSettle();
    }, [activateInteractionPhase, emitLiveTransformChange, emitTransformChange, scheduleZoomIdleSettle]);

    const zoomOut = useCallback(() => {
        const currentTransform = syncTransformRef.current;
        const newScale = Math.max(0.1, currentTransform.scale / 1.1);
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const scaleRatio = newScale / currentTransform.scale;
        const newX = centerX - (centerX - currentTransform.x) * scaleRatio;
        const newY = centerY - (centerY - currentTransform.y) * scaleRatio;

        const newTransform = snapTransformForText({ x: newX, y: newY, scale: newScale });
        syncTransformRef.current = newTransform;
        if (viewportRef.current) {
            viewportRef.current.style.transform = buildViewportTransform(newTransform, true);
        }
        emitLiveTransformChange(newTransform);

        if (zoomTimeoutRef.current) {
            clearTimeout(zoomTimeoutRef.current);
        }
        zoomTimeoutRef.current = setTimeout(() => {
            setTransform(newTransform);
            emitTransformChange(newTransform);
        }, 50);

        activateInteractionPhase('zoom');
        scheduleZoomIdleSettle();
    }, [activateInteractionPhase, emitLiveTransformChange, emitTransformChange, scheduleZoomIdleSettle]);

    const zoomTo = useCallback((newScale: number) => {
        const currentTransform = syncTransformRef.current;
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        
        // 滑块改变通常为操作控制条，统一以屏幕几何中心缩放，防止视野偏移猛烈
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const scaleRatio = newScale / currentTransform.scale;
        const newX = centerX - (centerX - currentTransform.x) * scaleRatio;
        const newY = centerY - (centerY - currentTransform.y) * scaleRatio;

        const newTransform = snapTransformForText({ x: newX, y: newY, scale: newScale });
        syncTransformRef.current = newTransform;
        if (viewportRef.current) {
            viewportRef.current.style.transform = buildViewportTransform(newTransform, true);
        }
        emitLiveTransformChange(newTransform);

        if (zoomTimeoutRef.current) {
            clearTimeout(zoomTimeoutRef.current);
        }
        zoomTimeoutRef.current = setTimeout(() => {
            setTransform(newTransform);
            emitTransformChange(newTransform);
        }, 50);

        activateInteractionPhase('zoom');
        scheduleZoomIdleSettle();
    }, [activateInteractionPhase, emitLiveTransformChange, emitTransformChange, scheduleZoomIdleSettle]);

    const resetView = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const available = getAvailableCanvasViewport(rect, measureCanvasViewportInsets(rect));
        const newTransform = snapTransformForText({
            x: available.centerX,
            y: available.centerY,
            scale: 1
        });
        syncTransformRef.current = newTransform;
        setTransform(newTransform);
        emitTransformChange(newTransform);
        emitLiveTransformChange(newTransform);
    }, [emitLiveTransformChange, emitTransformChange]);

    // ✅ 缩放到全览所有卡片
    const fitToAll = useCallback(() => {
        const container = containerRef.current;
        if (!container || sceneBounds.length === 0) {
            resetView();
            return;
        }

        const rect = container.getBoundingClientRect();
        const available = getAvailableCanvasViewport(rect, measureCanvasViewportInsets(rect));
        const fitted = createCanvasFitTransform(sceneBounds, available, {
            padding: 100,
            minScale: CANVAS_MIN_SCALE,
            maxScale: 1,
        });
        if (!fitted) return;
        const newTransform = snapTransformForText({
            ...fitted,
            x: fitted.x + available.x,
            y: fitted.y + available.y,
        });
        syncTransformRef.current = newTransform;
        setTransform(newTransform);
        emitTransformChange(newTransform);
        emitLiveTransformChange(newTransform);

        // 派发自定义事件，通知子卡片进行由内向外的慢加载优化以减小渲染压力
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kk-fit-to-all', {
                detail: {
                    centerX: (available.x - newTransform.x + available.width / 2) / newTransform.scale,
                    centerY: (available.y - newTransform.y + available.height / 2) / newTransform.scale,
                }
            }));
        }
    }, [sceneBounds, emitLiveTransformChange, emitTransformChange, resetView]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        zoomIn,
        zoomOut,
        resetView,
        fitToAll,
        zoomTo,
        setView: (x: number, y: number, scale: number) => {
            const newTransform = snapTransformForText({ x, y, scale });
            syncTransformRef.current = newTransform;
            setTransform(newTransform);
            emitTransformChange(newTransform);
            emitLiveTransformChange(newTransform);
        },
        // 🚀 获取当前实时的 transform（使用 Ref 绕过 React 状态异步，解决截图/生成时的坐标偏移）
        getCurrentTransform: () => syncTransformRef.current,
        // 🚀 获取画布容器的实际尺寸（用于精准中心计算，自动排除侧边栏影响）
        getCanvasRect: () => containerRef.current?.getBoundingClientRect() || null
    }));

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Ignore if input/textarea is focused
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
            return;
        }

        // Prevent default space action (scrolling/button press)
        // Check for both 'Space' code and ' ' key to be robust
        if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
        }

        if (e.key === 'Escape' || e.key === 'Home') {
            // 如果有onResetView prop,使用它(定位最新),否则使用resetView(重置到中心)
            if (callbackRef.current.onResetView) {
                callbackRef.current.onResetView();
            } else {
                resetView();
            }
        }
        if (e.key === '+' || e.key === '=') {
            zoomIn();
        }
        if (e.key === '-' || e.key === '_') {
            zoomOut();
        }
    }, [resetView, zoomIn, zoomOut]);

    // Touch Handling (Mirroring Mouse Logic)
    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (e.touches.length === 2) {
            if (e.cancelable) e.preventDefault();
            const [first, second] = [e.touches[0], e.touches[1]];
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const center = {
                x: (first.clientX + second.clientX) / 2 - rect.left,
                y: (first.clientY + second.clientY) / 2 - rect.top,
            };
            const current = syncTransformRef.current;
            touchGestureRef.current = {
                startDistance: Math.max(1, Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)),
                worldAnchor: {
                    x: (center.x - current.x) / current.scale,
                    y: (center.y - current.y) / current.scale,
                },
            };
            isDraggingRef.current = false;
            activateInteractionPhase('zoom');
            return;
        }
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            isDraggingRef.current = true; // 🚀 [移动端优化] 使用 ref 标记
            dragStart.current = { x: touch.clientX, y: touch.clientY };
            lastTransform.current = {
                x: syncTransformRef.current.x,
                y: syncTransformRef.current.y,
            };
            activateInteractionPhase('pan');
        }
    }, [activateInteractionPhase]);

    // 🚀 [移动端性能优化] 触控拖动时直接操作 DOM，与鼠标拖动保持一致
    // 避免每帧 setState 造成 React 重绘，实现 60fps 丝滑滑动
    const handleTouchMove = useCallback((e: TouchEvent) => {
        const pinch = touchGestureRef.current;
        if (pinch && e.touches.length === 2) {
            if (e.cancelable) e.preventDefault();
            const [first, second] = [e.touches[0], e.touches[1]];
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const distance = Math.max(1, Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY));
            const center = {
                x: (first.clientX + second.clientX) / 2 - rect.left,
                y: (first.clientY + second.clientY) / 2 - rect.top,
            };
            const currentScale = syncTransformRef.current.scale;
            const scale = Math.min(3, Math.max(0.1, currentScale * (distance / pinch.startDistance)));
            pinch.startDistance = distance;
            const newTransform = {
                x: Math.round(center.x - pinch.worldAnchor.x * scale),
                y: Math.round(center.y - pinch.worldAnchor.y * scale),
                scale,
            };
            syncTransformRef.current = newTransform;
            if (viewportRef.current) viewportRef.current.style.transform = buildViewportTransform(newTransform, true);
            emitLiveTransformChange(newTransform);
            return;
        }
        if (!isDraggingRef.current) return;
        if (e.touches.length === 1) {
            if (e.cancelable) e.preventDefault();
            const touch = e.touches[0];
            const dx = touch.clientX - dragStart.current.x;
            const dy = touch.clientY - dragStart.current.y;

            const newTransform = {
                x: Math.round(lastTransform.current.x + dx),
                y: Math.round(lastTransform.current.y + dy),
                scale: syncTransformRef.current.scale
            };

            // 🚀 实时同步到 Ref，不触发 React 重绘
            syncTransformRef.current = newTransform;

            // 🚀 直接操作 DOM 实现零延迟滑动
            if (viewportRef.current) {
                viewportRef.current.style.transform = buildViewportTransform(newTransform, true);
            }
            emitLiveTransformChange(newTransform);
        }
    }, [emitLiveTransformChange]);

    // 🚀 [移动端优化] touchEnd 时才提交 React state 同步最终位置
    const handleTouchEnd = useCallback((event: TouchEvent) => {
        if (zoomIndicatorTimeoutRef.current) {
            clearTimeout(zoomIndicatorTimeoutRef.current);
            zoomIndicatorTimeoutRef.current = null;
        }
        const wasPinching = touchGestureRef.current !== null;
        const wasDragging = isDraggingRef.current;
        if (wasPinching || wasDragging) {
            const finalTransform = syncTransformRef.current;
            setTransform({ ...finalTransform });
            emitTransformChange(finalTransform);
            emitLiveTransformChange(finalTransform);
        }
        if (wasPinching) {
            touchGestureRef.current = null;
            settleInteractionPhase('zoom');
            if (event.touches.length === 1) {
                const touch = event.touches[0];
                isDraggingRef.current = true;
                dragStart.current = { x: touch.clientX, y: touch.clientY };
                lastTransform.current = { x: syncTransformRef.current.x, y: syncTransformRef.current.y };
                activateInteractionPhase('pan');
                return;
            }
        }
        if (wasDragging) {
            isDraggingRef.current = false;
            settleInteractionPhase('pan');
        }
    }, [activateInteractionPhase, emitLiveTransformChange, emitTransformChange, settleInteractionPhase]);

    // Setup event listeners
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('wheel', handleWheel, { passive: false });
        // Touch Listeners (Passive: false to allow preventDefault)
        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);
        container.addEventListener('touchcancel', handleTouchEnd);

        // 🚀 使用 passive 监听器提升滚动/移动性能
        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        if (!reducePointerEffects) {
            window.addEventListener('mousemove', handleWindowMouseMoveForGlow, { passive: true });
        }
        window.addEventListener('mouseup', handleMouseUp, { passive: true });
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', handleTouchEnd);

            window.removeEventListener('mousemove', handleMouseMove);
            if (!reducePointerEffects) {
                window.removeEventListener('mousemove', handleWindowMouseMoveForGlow);
            }
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('keydown', handleKeyDown);
            if (zoomTimeoutRef.current) {
                clearTimeout(zoomTimeoutRef.current);
                zoomTimeoutRef.current = null;
            }
            if (zoomIndicatorTimeoutRef.current) {
                clearTimeout(zoomIndicatorTimeoutRef.current);
                zoomIndicatorTimeoutRef.current = null;
            }
            clearInteractionIdleTimeout();
        };
    }, [clearInteractionIdleTimeout, handleWheel, handleKeyDown, handleMouseMove, handleMouseUp, handleTouchEnd, handleTouchMove, handleTouchStart, handleWindowMouseMoveForGlow, reducePointerEffects]);

    useEffect(() => {
        return () => {
            if (gridGlowAnimationFrameRef.current !== null) {
                window.cancelAnimationFrame(gridGlowAnimationFrameRef.current);
            }
            if (gridGlowIdleTimeoutRef.current !== null) {
                window.clearTimeout(gridGlowIdleTimeoutRef.current);
            }
            clearInteractionIdleTimeout();
        };
    }, [clearInteractionIdleTimeout]);

    const zoomSliderProgress = Math.max(0, Math.min(100, ((transform.scale * 100) - 10) / 290 * 100));

    return (
        <div className="relative w-full h-full">
            {/* CanvasLayer - 承载网格和视口卡片，拥有独立的合成层与隔离属性 */}
            <div
                ref={containerRef}
                id={id}
                className={`canvas-layer canvas-container outline-none focus:outline-none gpu-accelerated ${isDragging ? 'is-dragging' : ''} ${isZooming ? 'is-zooming' : ''} ${isDragging || isZooming ? 'is-transforming' : ''} ${isImageDragOver ? 'ring-4 ring-[color:var(--clay-brand-pink)]' : ''}`}
                tabIndex={-1}
                onMouseDownCapture={handleMouseDownCapture}
                onMouseDown={handleMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={handleCanvasMouseLeave}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onContextMenu={(e) => {
                    if (callbackRef.current.onContextMenu) {
                        callbackRef.current.onContextMenu(e);
                    } else {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }}
                onDoubleClick={(e) => {
                    const isEmptyCanvas = e.target === containerRef.current || (e.target as HTMLElement).classList.contains('canvas-grid');
                    if (isEmptyCanvas) {
                        callbackRef.current.onCanvasDoubleClick?.();
                    }
                }}
                style={{ 
                    cursor: isDragging ? 'grabbing' : 'grab',
                    contain: 'layout style', // 开启浏览器渲染隔离
                    touchAction: 'none',
                }}
            >
                {/* 拖拽悬停效果 - 只显示边框高亮，不显示提示文本 */}
                {/* Grid Background */}
                {showGrid && <div ref={gridRef} className="canvas-grid" />}

                {/* 不受 viewport 缩放平移影响的背景插槽 */}
                {backgroundOverlay}

                {/* Viewport with transform - GPU accelerated */}
                <div
                    ref={viewportRef}
                    className="canvas-viewport"
                    style={{
                        // 🚀 [Fix] 使用 2D translate 代替 translate3d，并移除 backfaceVisibility
                        // 这能防止浏览器将画布强制视为位图纹理，从而在缩放后重新渲染高清晰度的文本和矢量图标
                        transform: buildViewportTransform(transform, isDragging || isZooming),
                        transformOrigin: '0 0', // Explicitly set origin
                        willChange: isDragging || isZooming ? 'transform' : 'auto',
                        // 避免 paint contain 造成卡片被裁剪，同时保留一定布局隔离能力
                        contain: 'layout style',
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
});

export default InfiniteCanvas;
