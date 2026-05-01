import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { CanvasGroup } from '../../types';
import { Type, GripHorizontal, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { elevateCanvasStackZIndex } from '../../utils/canvasUtils';

export interface CanvasGroupProps {
    group: CanvasGroup;
    zoom: number;
    stackZIndexOverride?: number;
    onUngroup: (id: string) => void;
    onDragStart: (id: string, e: React.MouseEvent) => void;
    onGroupDrag?: (delta: { x: number; y: number }, sourceNodeIds?: string[]) => void;
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
    onDragStateChange,
    onUpdateGroup,
    highlighted,
    computedBounds
}) => {
    // Shared state for drag
    const lastPos = useRef<{ x: number; y: number } | null>(null);
    const rafRef = useRef<number | null>(null);
    const pendingDelta = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
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
            : isDragging
                ? 'var(--frost-card-main-bg)'
                : 'var(--frost-card-framework-bg)',
        borderColor: highlighted
            ? 'var(--state-info-border)'
            : 'var(--frost-card-framework-border)',
        boxShadow: 'var(--frost-card-framework-shadow)',
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

    // Rename state
    const [isEditing, setIsEditing] = useState(false);
    const [label, setLabel] = useState(group.label || 'Group');
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync label
    useEffect(() => {
        setLabel(group.label || 'Group');
    }, [group.label]);

    // Sync bounds (if not dragging)
    useEffect(() => {
        if (!isDragging) {
            const newBounds = computedBounds || group.bounds;
            localBoundsRef.current = newBounds;
            if (containerRef.current) {
                containerRef.current.style.transform = `translate(${newBounds.x}px, ${newBounds.y}px)`;
                containerRef.current.style.width = `${newBounds.width}px`;
                containerRef.current.style.height = `${newBounds.height}px`;
            }
        }
    }, [computedBounds, group.bounds, isDragging]);

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
                setMenuPosition({ x: contextMenu.x + 6, y: contextMenu.y + 6 });
                return;
            }
            const rect = menuEl.getBoundingClientRect();
            const x = Math.min(contextMenu.x + 6, window.innerWidth - rect.width - 8);
            const y = Math.min(contextMenu.y + 6, window.innerHeight - rect.height - 8);
            setMenuPosition({ x: Math.max(8, x), y: Math.max(8, y) });
        };
        updatePosition();
    }, [contextMenu]);

    const handleRename = () => {
        if (label.trim() && label !== group.label && onUpdateGroup) {
            onUpdateGroup({ ...group, label: label.trim() });
        }
        setIsEditing(false);
    };

    // Use computed bounds if available, otherwise fall back to stored group bounds
    const bounds = computedBounds || group.bounds;

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

        onGroupDrag({ x, y }, group.nodeIds);
        pendingDelta.current = { x: 0, y: 0 };
    }, [group.nodeIds, onGroupDrag]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1) {
            return;
        }
        e.stopPropagation(); // Prevent canvas pan
        onDragStart(group.id, e); // Select the group nodes

        if (!onGroupDrag) return;

        lastPos.current = { x: e.clientX, y: e.clientY };
        setIsDragging(true);
        onDragStateChange?.(true);

        const handleMouseMove = (ev: MouseEvent) => {
            if (!lastPos.current) return;

            const dx = (ev.clientX - lastPos.current.x) / zoom;
            const dy = (ev.clientY - lastPos.current.y) / zoom;
            lastPos.current = { x: ev.clientX, y: ev.clientY };

            // Accumulate deltas (even if RAF is pending)
            pendingDelta.current = {
                x: pendingDelta.current.x + dx,
                y: pendingDelta.current.y + dy
            };

            flushPendingDrag();
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            onDragStateChange?.(false);
            lastPos.current = null;
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            flushPendingDrag();
            pendingDelta.current = { x: 0, y: 0 };
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <>
            <div
                ref={containerRef}
                className={`absolute border rounded-[32px] group-container transition-colors ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                    left: 0,
                    top: 0,
                    width: bounds.width,
                    height: bounds.height,
                    transform: `translate(${bounds.x}px, ${bounds.y}px)`,
                    zIndex: effectiveStackZIndex,
                    pointerEvents: 'auto',
                    ...groupSurfaceStyle,
                    willChange: isDragging ? 'width, height' : 'auto',
                    // Disable transition during drag to prevent rubber-banding
                    transition: isDragging ? 'none' : 'box-shadow 0.3s ease, transform 0.1s linear, width 0.1s linear, height 0.1s linear',
                    contain: 'layout style'
                }}
                onMouseDown={handleMouseDown} // Allow dragging from anywhere in the group box
                onContextMenu={handleContextMenu}
            >
                {/* Header / Drag Handle */}
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
                                    setLabel(group.label || 'Group');
                                    setIsEditing(false);
                                }
                                e.stopPropagation();
                            }}
                            onMouseDown={(e) => e.stopPropagation()} // Allow text alignment/cursor
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
                            {group.label || 'Group'}
                        </span>
                    )}
                </div>
            </div>

            {/* Context Menu Portal (Fixed Position) */}
            {contextMenu && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-[9999] rounded-lg border p-1 min-w-[140px] animate-fadeIn"
                    style={{
                        left: (menuPosition?.x ?? contextMenu.x + 6),
                        top: (menuPosition?.y ?? contextMenu.y + 6),
                        background: 'var(--frost-card-framework-bg)',
                        borderColor: 'var(--frost-card-framework-border)',
                        boxShadow: 'var(--frost-card-framework-shadow)',
                        WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
                        backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => {
                            setContextMenu(null);
                            setIsEditing(true);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--frost-card-sub-bg)] hover:text-[var(--text-primary)] rounded transition-colors text-left"
                    >
                        <Type size={14} />
                        重命名
                    </button>
                    <div className="h-[1px] bg-[var(--border-light)] my-1" />
                    <button
                        onClick={() => {
                            setContextMenu(null);
                            onUngroup(group.id);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-[rgba(255,107,90,0.10)] hover:text-red-400 rounded transition-colors text-left"
                    >
                        <Trash2 size={14} />
                        取消打组
                    </button>
                </div>,
                document.body
            )}
        </>
    );
};
