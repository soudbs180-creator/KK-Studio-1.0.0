import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { KK_LAYER } from '@kk/ui';
import { type CanvasGroup} from '../../types';
import { Type, GripHorizontal, Trash2, Eye, EyeOff, Archive, Maximize2, Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { elevateCanvasStackZIndex } from '../../utils/canvasUtils';

const GROUP_BORDER_COLOR_SWATCHES = [
    '#ffffff',
    '#60a5fa',
    '#34d399',
    '#f59e0b',
    '#fb7185',
    '#a78bfa',
    '#94a3b8',
    '#111827',
];

const CANVAS_GROUP_CONTEXT_MENU_LAYER = KK_LAYER.dropdown;
const CANVAS_GROUP_CONTEXT_MENU_OFFSET_PX = 6;
const CANVAS_GROUP_CONTEXT_MENU_VIEWPORT_PADDING_PX = 8;

function normalizeHexColor(color: string | undefined): string {
    return /^#[0-9a-fA-F]{6}$/.test(color || '') ? color! : '#ffffff';
}

export interface CanvasGroupProps {
    group: CanvasGroup;
    zoom: number;
    stackZIndexOverride?: number;
    onUngroup: (id: string) => void;
    onDragStart: (id: string, e: React.PointerEvent) => void;
    onGroupDrag?: (delta: { x: number; y: number }, sourceNodeIds?: string[]) => void;
    onGroupDragCommit?: (delta: { x: number; y: number }, sourceNodeIds?: string[]) => void;
    onDragStateChange?: (dragging: boolean) => void;
    onUpdateGroup?: (group: CanvasGroup) => void;
    highlighted?: boolean;
    computedBounds?: { x: number; y: number; width: number; height: number };
}

export const CanvasGroupComponent: React.FC<CanvasGroupProps> = ({
    group,
    zoom,
    stackZIndexOverride,
    onUngroup,
    onDragStart,
    onGroupDrag,
    onGroupDragCommit,
    onDragStateChange,
    onUpdateGroup,
    highlighted,
    computedBounds
}) => {
    // Shared state for drag
    const lastPos = useRef<{ x: number; y: number } | null>(null);
    const rafRef = useRef<number | null>(null);
    const pendingDelta = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const accumulatedDelta = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const activePointerIdRef = useRef<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const isCollapsed = Boolean(group.collapsed);
    const isHidden = Boolean(group.hidden);
    const groupBorderColor = group.color || '#ffffff';
    const fallbackStackZIndex = ((group.zIndex ?? 0) * 100) + (isDragging ? 30 : highlighted ? 20 : 10);
    const stackZIndex = stackZIndexOverride ?? fallbackStackZIndex;
    const effectiveStackZIndex = elevateCanvasStackZIndex(stackZIndex, isDragging);
    // Direct DOM Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const localBoundsRef = useRef(computedBounds || group.bounds);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const groupSurfaceStyle: React.CSSProperties = {
        background: highlighted
            ? 'color-mix(in srgb, var(--frost-card-framework-bg) 88%, var(--state-info-bg) 12%)'
            : isHidden
                ? 'color-mix(in srgb, var(--frost-card-framework-bg) 70%, transparent)'
            : isDragging
                ? 'var(--frost-card-main-bg)'
                : 'var(--frost-card-framework-bg)',
        borderColor: highlighted
            ? 'var(--state-info-border)'
            : 'var(--frost-card-framework-border)',
        boxShadow: [
            'var(--frost-card-framework-shadow)',
            `inset 0 0 0 1px color-mix(in srgb, ${groupBorderColor} 34%, transparent)`,
            `inset 0 0 22px color-mix(in srgb, ${groupBorderColor} 18%, transparent)`,
        ].join(', '),
        WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
        backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
    };
    const groupHeaderSurfaceStyle: React.CSSProperties = {
        background: highlighted
            ? 'color-mix(in srgb, var(--frost-card-sub-bg) 88%, var(--state-info-bg) 12%)'
            : 'var(--frost-card-sub-bg)',
        borderColor: highlighted
            ? 'var(--state-info-border)'
            : 'var(--frost-card-sub-border)',
        boxShadow: 'var(--frost-card-sub-shadow)',
        WebkitBackdropFilter: 'blur(var(--frost-card-sub-blur)) saturate(1.08)',
        backdropFilter: 'blur(var(--frost-card-sub-blur)) saturate(1.08)',
    };
    const groupInputSurfaceStyle: React.CSSProperties = {
        background: 'var(--frost-input-bg)',
        borderColor: 'var(--frost-input-border)',
        boxShadow: 'var(--frost-input-shadow)',
        WebkitBackdropFilter: 'blur(var(--frost-input-blur)) saturate(1.12)',
        backdropFilter: 'blur(var(--frost-input-blur)) saturate(1.12)',
    };
    const groupCollapsedCardStyle: React.CSSProperties = {
        ...groupHeaderSurfaceStyle,
        borderColor: highlighted ? 'var(--state-info-border)' : 'var(--frost-card-framework-border)',
        boxShadow: [
            'var(--frost-card-sub-shadow)',
            `inset 0 0 0 1px color-mix(in srgb, ${groupBorderColor} 34%, transparent)`,
            `inset 0 0 18px color-mix(in srgb, ${groupBorderColor} 16%, transparent)`,
        ].join(', '),
        minWidth: 180,
        maxWidth: 320,
    };
    const hiddenOverlayStyle: React.CSSProperties = {
        background: 'color-mix(in srgb, var(--frost-card-framework-bg) 58%, transparent)',
        boxShadow: [
            `inset 0 0 0 1px color-mix(in srgb, ${groupBorderColor} 38%, transparent)`,
            `inset 0 0 36px color-mix(in srgb, ${groupBorderColor} 22%, transparent)`,
        ].join(', '),
        WebkitBackdropFilter: 'blur(18px) saturate(0.82)',
        backdropFilter: 'blur(18px) saturate(0.82)',
    };

    // Rename state
    const [isEditing, setIsEditing] = useState(false);
    const defaultGroupLabel = '分组';
    const hiddenToggleLabel = isHidden ? '显示卡片' : '隐藏/模糊卡片';
    const collapsedToggleLabel = isCollapsed ? '展开分组' : '收纳分组';
    const [label, setLabel] = useState(group.label || defaultGroupLabel);
    const inputRef = useRef<HTMLInputElement>(null);
    // Use computed bounds if available, otherwise fall back to stored group bounds
    const bounds = computedBounds || group.bounds;
    const compactBounds = {
        x: bounds.x,
        y: bounds.y,
        width: Math.max(180, Math.min(320, bounds.width)),
        height: 44,
    };
    const renderedBounds = isCollapsed ? compactBounds : bounds;
    const hiddenDisplayLabel = group.label || defaultGroupLabel;
    const hiddenDisplayLabelLength = Math.max(2, Array.from(hiddenDisplayLabel).length);
    const hiddenLabelFontSize = Math.max(
        16,
        Math.min(
            52,
            Math.max(14, (renderedBounds.width - 80) / (hiddenDisplayLabelLength * 0.62)),
            renderedBounds.height * 0.18,
            18 / Math.max(zoom, 0.34),
        ),
    );
    const hiddenLabelStyle: React.CSSProperties = {
        color: 'var(--text-primary)',
        fontSize: hiddenLabelFontSize,
        lineHeight: 1.12,
        maxWidth: Math.max(96, renderedBounds.width - 72),
        textShadow: '0 2px 18px rgba(0, 0, 0, 0.35)',
    };

    // Sync label
    useEffect(() => {
        setLabel(group.label || defaultGroupLabel);
    }, [defaultGroupLabel, group.label]);

    // Sync bounds (if not dragging)
    useEffect(() => {
        if (!isDragging) {
            localBoundsRef.current = renderedBounds;
            if (containerRef.current) {
                containerRef.current.style.transform = `translate(${renderedBounds.x}px, ${renderedBounds.y}px)`;
                containerRef.current.style.width = `${renderedBounds.width}px`;
                containerRef.current.style.height = `${renderedBounds.height}px`;
            }
        }
    }, [isDragging, renderedBounds]);

    // Focus input on edit start
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    // Handle Context Menu
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    // Close menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    useEffect(() => {
        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            onDragStateChange?.(false);
        };
    }, [onDragStateChange]);

    useLayoutEffect(() => {
        if (!contextMenu) {
            setMenuPosition(null);
            return;
        }
        const updatePosition = () => {
            const menuEl = menuRef.current;
            if (!menuEl) {
                setMenuPosition({
                    x: contextMenu.x + CANVAS_GROUP_CONTEXT_MENU_OFFSET_PX,
                    y: contextMenu.y + CANVAS_GROUP_CONTEXT_MENU_OFFSET_PX,
                });
                return;
            }
            const rect = menuEl.getBoundingClientRect();
            const x = Math.min(
                contextMenu.x + CANVAS_GROUP_CONTEXT_MENU_OFFSET_PX,
                window.innerWidth - rect.width - CANVAS_GROUP_CONTEXT_MENU_VIEWPORT_PADDING_PX,
            );
            const y = Math.min(
                contextMenu.y + CANVAS_GROUP_CONTEXT_MENU_OFFSET_PX,
                window.innerHeight - rect.height - CANVAS_GROUP_CONTEXT_MENU_VIEWPORT_PADDING_PX,
            );
            setMenuPosition({
                x: Math.max(CANVAS_GROUP_CONTEXT_MENU_VIEWPORT_PADDING_PX, x),
                y: Math.max(CANVAS_GROUP_CONTEXT_MENU_VIEWPORT_PADDING_PX, y),
            });
        };
        updatePosition();
    }, [contextMenu]);

    const handleRename = () => {
        if (label.trim() && label !== group.label && onUpdateGroup) {
            onUpdateGroup({ ...group, label: label.trim() });
        }
        setIsEditing(false);
    };

    const handleToggleCollapsed = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        onUpdateGroup?.({ ...group, collapsed: !group.collapsed });
    }, [group, onUpdateGroup]);

    const handleToggleHidden = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        onUpdateGroup?.({ ...group, hidden: !group.hidden });
    }, [group, onUpdateGroup]);

    const handleUpdateColor = useCallback((color: string) => {
        onUpdateGroup?.({ ...group, color });
    }, [group, onUpdateGroup]);

    const flushPendingDrag = useCallback(() => {
        if (!onGroupDrag) return;

        const { x, y } = pendingDelta.current;
        if (x === 0 && y === 0) return;

        if (containerRef.current) {
            const cb = localBoundsRef.current;
            const newX = cb.x + x;
            const newY = cb.y + y;
            localBoundsRef.current = { ...cb, x: newX, y: newY };
            containerRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
        }

        accumulatedDelta.current = {
            x: accumulatedDelta.current.x + x,
            y: accumulatedDelta.current.y + y
        };

        onGroupDrag({ x, y }, group.nodeIds);
        pendingDelta.current = { x: 0, y: 0 };
    }, [group.nodeIds, onGroupDrag]);

    const scheduleDragFlush = useCallback(() => {
        if (rafRef.current !== null) {
            return;
        }

        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            flushPendingDrag();
        });
    }, [flushPendingDrag]);

    const finishPointerDrag = useCallback((element: HTMLDivElement, pointerId: number, commit: boolean) => {
        if (activePointerIdRef.current !== pointerId) return;
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        flushPendingDrag();
        setIsDragging(false);
        onDragStateChange?.(false);
        lastPos.current = null;
        pendingDelta.current = { x: 0, y: 0 };
        activePointerIdRef.current = null;
        if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);

        const finalDelta = accumulatedDelta.current;
        if (commit && (finalDelta.x !== 0 || finalDelta.y !== 0)) {
            onGroupDragCommit?.(finalDelta, group.nodeIds);
        }
        accumulatedDelta.current = { x: 0, y: 0 };
    }, [flushPendingDrag, group.nodeIds, onDragStateChange, onGroupDragCommit]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) {
            return;
        }
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        activePointerIdRef.current = e.pointerId;
        onDragStart(group.id, e);

        if (!onGroupDrag) return;

        lastPos.current = { x: e.clientX, y: e.clientY };
        setIsDragging(true);
        onDragStateChange?.(true);
        accumulatedDelta.current = { x: 0, y: 0 };

    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (activePointerIdRef.current !== event.pointerId || !lastPos.current || !onGroupDrag) return;
        const dx = (event.clientX - lastPos.current.x) / zoom;
        const dy = (event.clientY - lastPos.current.y) / zoom;
        lastPos.current = { x: event.clientX, y: event.clientY };
        pendingDelta.current = {
            x: pendingDelta.current.x + dx,
            y: pendingDelta.current.y + dy,
        };
        scheduleDragFlush();
    };

    return (
        <>
            <div
                ref={containerRef}
                className={isCollapsed
                    ? `absolute canvas-group-collapsed-card border rounded-2xl transition-colors ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`
                    : `absolute border rounded-[32px] group-container transition-colors ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                    left: 0,
                    top: 0,
                    width: renderedBounds.width,
                    height: renderedBounds.height,
                    transform: `translate(${renderedBounds.x}px, ${renderedBounds.y}px)`,
                    zIndex: effectiveStackZIndex,
                    pointerEvents: 'auto',
                    ...(isCollapsed ? groupCollapsedCardStyle : groupSurfaceStyle),
                    willChange: isDragging ? 'transform' : 'auto',
                    // Disable transition during drag to prevent rubber-banding and compositor stalls.
                    transition: isDragging ? 'none' : 'box-shadow 0.3s ease',
                    contain: 'layout style'
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={(event) => finishPointerDrag(event.currentTarget, event.pointerId, true)}
                onPointerCancel={(event) => finishPointerDrag(event.currentTarget, event.pointerId, false)}
                onContextMenu={handleContextMenu}
            >
                {isCollapsed ? (
                    <div className="flex h-full min-w-0 items-center gap-2 px-3">
                        <button
                            type="button"
                            onClick={handleToggleCollapsed}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors hover:bg-[var(--frost-card-sub-bg)]"
                            style={{
                                borderColor: 'var(--frost-card-sub-border)',
                                color: highlighted ? 'var(--state-info-text)' : 'var(--text-secondary)',
                            }}
                            title={collapsedToggleLabel}
                            aria-label={collapsedToggleLabel}
                        >
                            <Maximize2 size={14} />
                            <span>展开分组</span>
                        </button>
                        <span
                            className="min-w-0 truncate text-xs font-medium"
                            style={{ color: highlighted ? 'var(--state-info-text)' : 'var(--text-secondary)' }}
                            title={group.label || defaultGroupLabel}
                        >
                            {group.label || defaultGroupLabel}
                        </span>
                    </div>
                ) : (
                    <div
                        className="absolute -top-10 left-0 flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-opacity opacity-100"
                        style={groupHeaderSurfaceStyle}
                    >
                        <GripHorizontal size={14} style={{ color: highlighted ? 'var(--state-info-text)' : 'var(--text-tertiary)' }} />
                        {isEditing ? (
                            <input
                                ref={inputRef}
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRename();
                                    if (e.key === 'Escape') {
                                        setLabel(group.label || defaultGroupLabel);
                                        setIsEditing(false);
                                    }
                                    e.stopPropagation();
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="w-32 text-xs font-medium border-none outline-none rounded px-1 transition-all"
                                style={{
                                    ...groupInputSurfaceStyle,
                                    color: 'var(--text-primary)',
                                    fontSize: '16px',
                                    transitionDuration: 'var(--duration-fast)'
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.boxShadow = '0 0 0 1px var(--state-info-border)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.boxShadow = 'none';
                                    handleRename();
                                }}
                            />
                        ) : (
                            <span
                                className="text-xs font-medium whitespace-nowrap"
                                style={{ color: highlighted ? 'var(--state-info-text)' : 'var(--text-secondary)' }}
                            >
                                {group.label || defaultGroupLabel}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={handleToggleHidden}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-[var(--frost-card-sub-bg)]"
                            style={{ color: highlighted ? 'var(--state-info-text)' : 'var(--text-tertiary)' }}
                            title={hiddenToggleLabel}
                            aria-label={hiddenToggleLabel}
                        >
                            {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                            type="button"
                            onClick={handleToggleCollapsed}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-[var(--frost-card-sub-bg)]"
                            style={{ color: highlighted ? 'var(--state-info-text)' : 'var(--text-tertiary)' }}
                            title={collapsedToggleLabel}
                            aria-label={collapsedToggleLabel}
                        >
                            <Archive size={14} />
                        </button>
                    </div>
                )}
                {!isCollapsed && isHidden && (
                    <div
                        className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[30px] px-8 text-center"
                        style={hiddenOverlayStyle}
                    >
                        <span
                            className="block truncate font-semibold"
                            style={hiddenLabelStyle}
                            title={hiddenDisplayLabel}
                        >
                            {hiddenDisplayLabel}
                        </span>
                    </div>
                )}
            </div>

            {/* Context Menu Portal (Fixed Position) */}
            {contextMenu && createPortal(
                <div
                    ref={menuRef}
                    className="kk-canvas-context-menu fixed animate-fadeIn"
                    data-kk-canvas-context-menu-layer="true"
                    role="menu"
                    style={{
                        left: (menuPosition?.x ?? contextMenu.x + CANVAS_GROUP_CONTEXT_MENU_OFFSET_PX),
                        top: (menuPosition?.y ?? contextMenu.y + CANVAS_GROUP_CONTEXT_MENU_OFFSET_PX),
                        zIndex: CANVAS_GROUP_CONTEXT_MENU_LAYER,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        role="menuitem"
                        onClick={() => {
                            setContextMenu(null);
                            setIsEditing(true);
                        }}
                        className="kk-canvas-context-menu-item"
                    >
                        <Type size={14} />
                        重命名
                    </button>
                    <div className="kk-canvas-context-menu-section">
                        <div className="kk-canvas-context-menu-label">内发光颜色</div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {GROUP_BORDER_COLOR_SWATCHES.map((color) => {
                                const selected = color.toLowerCase() === groupBorderColor.toLowerCase();
                                const swatchStyle = {
                                    '--kk-canvas-context-menu-swatch-color': color,
                                    '--kk-canvas-context-menu-swatch-check-color': color === '#111827'
                                        ? 'var(--kk-canvas-context-menu-swatch-check-on-dark)'
                                        : 'var(--kk-canvas-context-menu-swatch-check-on-light)',
                                } as React.CSSProperties;
                                return (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => handleUpdateColor(color)}
                                        className="kk-canvas-context-menu-swatch"
                                        data-selected={selected}
                                        style={swatchStyle}
                                        title={color}
                                        aria-label={color}
                                    >
                                        {selected && <Check size={13} />}
                                    </button>
                                );
                            })}
                            <input
                                type="color"
                                value={normalizeHexColor(groupBorderColor)}
                                onChange={(e) => handleUpdateColor(e.currentTarget.value)}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="kk-canvas-context-menu-color-input"
                                title="自定义内发光颜色"
                                aria-label="自定义内发光颜色"
                            />
                        </div>
                    </div>
                    <div className="kk-canvas-context-menu-divider" />
                    <button
                        role="menuitem"
                        onClick={() => {
                            setContextMenu(null);
                            onUngroup(group.id);
                        }}
                        className="kk-canvas-context-menu-item kk-canvas-context-menu-item--danger"
                    >
                        <Trash2 size={14} />
                        取消分组
                    </button>
                </div>,
                document.body
            )}
        </>
    );
};
