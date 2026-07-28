import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Group, Tag, FolderOutput, LayoutGrid, Rows, Columns, GripHorizontal, Heart } from 'lucide-react';
import { KK_LAYER } from '@kk/ui';
import { type ArrangeMode} from '../../context/CanvasContext';

interface SelectionMenuProps {
    position: { x: number; y: number };
    placement: 'right' | 'left' | 'bottom';
    selectedCount: number;
    cardGroupCount?: number;
    isolatedPromptCount?: number;
    isolatedResultCount?: number;
    onDelete: () => void;
    onGroup: () => void;
    onTag: () => void;
    onMigrate?: () => void;
    onArrange?: (mode: ArrangeMode) => void;
    canArrange?: boolean; // 简体中文注释：标识当前是否可整理排列
    onFavorite?: () => void;
    isAllFavorite?: boolean;
}

export const SelectionMenu: React.FC<SelectionMenuProps> = ({
    position,
    placement,
    selectedCount,
    cardGroupCount = 0,
    isolatedPromptCount = 0,
    isolatedResultCount = 0,
    onDelete,
    onGroup,
    onTag,
    onMigrate,
    onArrange,
    canArrange = true,
    onFavorite,
    isAllFavorite = false
}) => {
    const [showArrangeMenu, setShowArrangeMenu] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const initialOffsetRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        setDragOffset({ x: 0, y: 0 });
    }, [position.x, position.y]);

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
        if (cardGroupCount > 0) parts.push(`${cardGroupCount} 个卡组`);
        if (isolatedPromptCount > 0) parts.push(`${isolatedPromptCount} 个提示词`);
        if (isolatedResultCount > 0) parts.push(`${isolatedResultCount} 个结果`);
        return parts.length > 0 ? parts.join(' + ') : `${selectedCount} 个项目`;
    };

    return (
        <div
            className="kk-canvas-selection-menu fixed flex items-center rounded-xl p-1 cursor-grab active:cursor-grabbing"
            data-placement={placement}
            style={{
                zIndex: KK_LAYER.floating,
                ...(placement === 'bottom'
                    ? {}
                    : {
                        left: position.x + dragOffset.x,
                        top: position.y + dragOffset.y,
                    }),
            }}
            onMouseDown={handleMouseDown}
        >
            <div className="kk-canvas-selection-menu-label px-3 text-xs border-r mr-1 font-medium flex items-center gap-2">
                <GripHorizontal size={14} style={{ color: 'var(--text-muted)' }} />
                {getSelectionLabel()}
            </div>

            <button onClick={onGroup} className="kk-canvas-selection-menu-item rounded-lg" data-tone="pink" title="分组 (Group)">
                <Group size={18} />
            </button>

            <button onClick={onTag} className="kk-canvas-selection-menu-item rounded-lg" data-tone="teal" title="添加标签 (Tag)">
                <Tag size={18} />
            </button>

            {onFavorite && (
                <button onClick={onFavorite} className="kk-canvas-selection-menu-item rounded-lg" data-tone="pink" title={isAllFavorite ? "取消收藏 (Unfavorite)" : "添加收藏 (Favorite)"}>
                    <Heart size={18} fill={isAllFavorite ? 'currentColor' : 'none'} style={{ color: isAllFavorite ? 'var(--accent-coral)' : undefined }} />
                </button>
            )}

            {onMigrate && (
                <button onClick={onMigrate} className="kk-canvas-selection-menu-item rounded-lg" data-tone="ochre" title="迁移到其他项目 (Migrate)">
                    <FolderOutput size={18} />
                </button>
            )}

            {onArrange && (
                <div className="relative">
                    <button
                        onClick={() => canArrange && setShowArrangeMenu(!showArrangeMenu)}
                        className={`kk-canvas-selection-menu-item rounded-lg ${canArrange ? 'cursor-pointer' : 'cursor-not-allowed opacity-35'}`}
                        data-tone="lavender"
                        title={canArrange ? "整理选中项 (Arrange)" : "框选 2 个以上项目或单 Prompt 拥有子图方可整理"}
                        disabled={!canArrange}
                    >
                        <LayoutGrid size={18} />
                    </button>
                    {showArrangeMenu && canArrange && (
                        <div 
                            className="kk-canvas-selection-menu absolute top-full left-1/2 -translate-x-1/2 mt-2 flex min-w-[110px] flex-col gap-1 rounded-xl p-1 animate-in slide-in-from-top-2 duration-150"
                        >
                            <button 
                                onClick={() => { onArrange('grid'); setShowArrangeMenu(false); }} 
                                className="kk-canvas-selection-menu-row flex items-center gap-2 px-3 py-1.5 text-xs rounded whitespace-nowrap cursor-pointer"
                            >
                                <LayoutGrid size={14} />
                                宫格(6列)
                            </button>
                            <button 
                                onClick={() => { onArrange('row'); setShowArrangeMenu(false); }} 
                                className="kk-canvas-selection-menu-row flex items-center gap-2 px-3 py-1.5 text-xs rounded whitespace-nowrap cursor-pointer"
                            >
                                <Rows size={14} />
                                横向排列
                            </button>
                            <button 
                                onClick={() => { onArrange('column'); setShowArrangeMenu(false); }} 
                                className="kk-canvas-selection-menu-row flex items-center gap-2 px-3 py-1.5 text-xs rounded whitespace-nowrap cursor-pointer"
                            >
                                <Columns size={14} />
                                纵向排列
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--kk-morphic-border)' }} />

            <button onClick={onDelete} className="kk-canvas-selection-menu-item rounded-lg" data-tone="coral" title="删除选中 (Delete)">
                <Trash2 size={18} />
            </button>
        </div>
    );
};
