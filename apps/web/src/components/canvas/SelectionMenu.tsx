import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Group, Tag, FolderOutput, LayoutGrid, Rows, Columns, GripHorizontal } from 'lucide-react';
import { type ArrangeMode} from '../../context/CanvasContext';

interface SelectionMenuProps {
    position: { x: number; y: number };
    selectedCount: number;
    groupCount?: number;
    imageCount?: number;
    videoCount?: number;
    onDelete: () => void;
    onGroup: () => void;
    onTag: () => void;
    onMigrate?: () => void;
    onArrange?: (mode: ArrangeMode) => void;
    canArrange?: boolean; // 简体中文注释：标识当前是否可整理排列
}

export const SelectionMenu: React.FC<SelectionMenuProps> = ({
    position,
    selectedCount,
    groupCount = 0,
    imageCount = 0,
    videoCount = 0,
    onDelete,
    onGroup,
    onTag,
    onMigrate,
    onArrange,
    canArrange = true
}) => {
    const [showArrangeMenu, setShowArrangeMenu] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const initialOffsetRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const dx = e.clientX - dragStartRef.current.x;
            const dy = e.clientY - dragStartRef.current.y;
            setDragOffset({
                x: initialOffsetRef.current.x + dx,
                y: initialOffsetRef.current.y + dy
            });
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        isDraggingRef.current = true;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        initialOffsetRef.current = dragOffset;
    };

    const getSelectionLabel = () => {
        const parts: string[] = [];
        if (groupCount > 0) parts.push(`${groupCount} 个组`);
        if (imageCount > 0) parts.push(`${imageCount} 张图片`);
        if (videoCount > 0) parts.push(`${videoCount} 个视频`);
        return parts.length > 0 ? parts.join(' + ') : `${selectedCount} 个项目`;
    };

    const menuSurfaceStyle: React.CSSProperties = {
        background: 'var(--frost-card-framework-bg)',
        border: '1px solid var(--frost-card-framework-border)',
        boxShadow: 'var(--frost-card-framework-shadow)',
        WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
        backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)'
    };

    return (
        <div
            className="fixed z-[10000] flex items-center rounded-xl p-1 animate-in zoom-in-95 duration-200 cursor-grab active:cursor-grabbing"
            style={{
                left: position.x + dragOffset.x,
                top: position.y + dragOffset.y,
                transform: 'translate(-50%, -100%) translateY(-12px)',
                ...menuSurfaceStyle
            }}
            onMouseDown={handleMouseDown}
        >
            <div className="px-3 text-xs border-r mr-1 font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)', borderColor: 'var(--frost-card-sub-border)' }}>
                <GripHorizontal size={14} style={{ color: 'var(--text-muted)' }} />
                {getSelectionLabel()}
            </div>

            <button onClick={onGroup} className="touch-target rounded-lg transition-colors haptic-press hover:bg-[var(--frost-card-sub-bg)]" style={{ color: 'var(--clay-brand-pink)' }} title="分组 (Group)">
                <Group size={18} />
            </button>

            <button onClick={onTag} className="touch-target rounded-lg transition-colors haptic-press hover:bg-[var(--frost-card-sub-bg)]" style={{ color: 'var(--clay-brand-teal)' }} title="添加标签 (Tag)">
                <Tag size={18} />
            </button>

            {onMigrate && (
                <button onClick={onMigrate} className="touch-target rounded-lg transition-colors haptic-press hover:bg-[var(--frost-card-sub-bg)]" style={{ color: 'var(--clay-brand-ochre)' }} title="迁移到其他项目 (Migrate)">
                    <FolderOutput size={18} />
                </button>
            )}

            {onArrange && (
                <div className="relative">
                    <button
                        onClick={() => canArrange && setShowArrangeMenu(!showArrangeMenu)}
                        className={`touch-target rounded-lg transition-colors haptic-press ${canArrange ? 'hover:bg-[var(--frost-card-sub-bg)] cursor-pointer' : 'cursor-not-allowed opacity-35'}`}
                        style={{ color: 'var(--clay-brand-lavender)' }}
                        title={canArrange ? "整理选中项 (Arrange)" : "框选 2 个以上项目或单 Prompt 拥有子图方可整理"}
                        disabled={!canArrange}
                    >
                        <LayoutGrid size={18} />
                    </button>
                    {showArrangeMenu && canArrange && (
                        <div 
                            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 flex min-w-[110px] flex-col gap-1 rounded-xl p-1 animate-in slide-in-from-top-2 duration-150" 
                            style={{
                                ...menuSurfaceStyle,
                                boxShadow: 'var(--frost-card-framework-shadow), 0 10px 30px -10px rgba(99, 102, 241, 0.25)',
                            }}
                        >
                            <button 
                                onClick={() => { onArrange('grid'); setShowArrangeMenu(false); }} 
                                className="flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-all duration-200 whitespace-nowrap cursor-pointer" 
                                style={{ color: 'var(--text-secondary)' }} 
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--frost-card-sub-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }} 
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            >
                                <LayoutGrid size={14} />
                                宫格(6列)
                            </button>
                            <button 
                                onClick={() => { onArrange('row'); setShowArrangeMenu(false); }} 
                                className="flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-all duration-200 whitespace-nowrap cursor-pointer" 
                                style={{ color: 'var(--text-secondary)' }} 
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--frost-card-sub-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }} 
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            >
                                <Rows size={14} />
                                横向排列
                            </button>
                            <button 
                                onClick={() => { onArrange('column'); setShowArrangeMenu(false); }} 
                                className="flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-all duration-200 whitespace-nowrap cursor-pointer" 
                                style={{ color: 'var(--text-secondary)' }} 
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--frost-card-sub-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }} 
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            >
                                <Columns size={14} />
                                纵向排列
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--frost-card-sub-border)' }} />

            <button onClick={onDelete} className="touch-target rounded-lg transition-colors haptic-press hover:bg-[var(--frost-card-sub-bg)]" style={{ color: 'var(--clay-brand-coral)' }} title="删除选中 (Delete)">
                <Trash2 size={18} />
            </button>
        </div>
    );
};
