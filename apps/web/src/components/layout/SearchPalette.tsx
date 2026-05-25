import React, { useState, useEffect, useRef } from 'react';
import { PromptNode, CanvasGroup } from '../../types';
import { Search, MapPin, CornerDownLeft, X, Layers } from 'lucide-react';
import { generateTagColor } from '../../utils/colorUtils';
import { isPhoneResponsiveWidth } from '../../utils/responsiveSurface';

interface SearchPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    promptNodes: PromptNode[];
    groups?: CanvasGroup[];
    onNavigate: (x: number, y: number, id?: string) => void;
    onMultiSelectConfirm?: (ids: string[]) => void;
}

type SearchResultItem =
    | { type: 'node'; data: PromptNode }
    | { type: 'group'; data: CanvasGroup };

const DESKTOP_SEARCH_SHORTCUTS = [
    { key: '↑↓', label: '导航' },
    { key: 'Enter', label: '定位' },
    { key: 'Ctrl+M', label: '切换多选' },
];

const MOBILE_SEARCH_HINTS = [
    '输入关键词筛选历史内容',
    '点按结果定位到画布',
    '使用多选整理多个条目',
];

const SearchPalette: React.FC<SearchPaletteProps> = ({ isOpen, onClose, promptNodes, groups = [], onNavigate, onMultiSelectConfirm }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? isPhoneResponsiveWidth(window.innerWidth) : false
    );

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const lastClickedIndexRef = useRef<number>(-1); // Record the last clicked index for Shift-range selection

    // Normalize query
    const lowerQuery = query.toLowerCase();

    // Filter results
    // Sort by tag match first, then by recency.
    const nodeResults: SearchResultItem[] = (() => {
        const matching = promptNodes.filter(node =>
            node.prompt.toLowerCase().includes(lowerQuery) ||
            (node.tags && node.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
        );

        matching.sort((a, b) => {
            // 1. Tag Match Priority
            const aTagMatch = a.tags && a.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
            const bTagMatch = b.tags && b.tags.some(tag => tag.toLowerCase().includes(lowerQuery));

            if (aTagMatch && !bTagMatch) return -1;
            if (!aTagMatch && bTagMatch) return 1;

            // 2. Recency (Newest First)
            return b.timestamp - a.timestamp;
        });

        return matching.map(n => ({ type: 'node', data: n }));
    })();

    const groupResults: SearchResultItem[] = groups.filter(g =>
        (g.label || 'Group').toLowerCase().includes(lowerQuery)
    ).map(g => ({ type: 'group', data: g }));

    const results = [...groupResults, ...nodeResults].slice(0, 50);

    // Auto-focus input when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setMultiSelectedIds(new Set());
            setIsMultiSelectMode(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        const onResize = () => setIsMobile(isPhoneResponsiveWidth(window.innerWidth));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen || isMobile) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(prev => results.length > 0 ? (prev + 1) % results.length : 0);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(prev => results.length > 0 ? (prev - 1 + results.length) % results.length : 0);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (isMultiSelectMode || e.ctrlKey || e.metaKey || e.shiftKey) {
                        if (e.ctrlKey || e.metaKey) {
                            handleConfirmMultiSelect();
                        } else {
                            if (results[selectedIndex]) {
                                toggleMultiSelect(results[selectedIndex]);
                            }
                        }
                    } else {
                        if (results[selectedIndex]) {
                            handleSelect(results[selectedIndex]);
                        }
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
                case 'm':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        setIsMultiSelectMode(prev => !prev);
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isMobile, results, selectedIndex, isMultiSelectMode, multiSelectedIds]);

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current) {
            const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    const handleSelect = (item: SearchResultItem) => {
        if (item.type === 'node') {
            onNavigate(item.data.position.x, item.data.position.y, item.data.id);
        } else {
            const g = item.data;
            const cx = g.bounds.x + g.bounds.width / 2;
            const cy = g.bounds.y + g.bounds.height / 2;
            onNavigate(cx, cy, g.id);
        }
        onClose();
    };

    const toggleMultiSelect = (item: SearchResultItem) => {
        setMultiSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(item.data.id)) {
                next.delete(item.data.id);
            } else {
                next.add(item.data.id);
            }
            return next;
        });
    };

    const handleConfirmMultiSelect = () => {
        if (multiSelectedIds.size === 0) return;
        onMultiSelectConfirm?.(Array.from(multiSelectedIds));
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            data-search-surface={isMobile ? 'mobile' : 'desktop'}
            className={`fixed inset-0 z-[100] flex justify-center animate-fadeIn ${isMobile ? 'mobile-overlay-safe items-end px-2' : 'items-start px-4 pt-[15vh]'}`}
            style={{ background: 'var(--search-palette-overlay-bg)' }}
        >
            {/* Click outside to close */}
            <div className="absolute inset-0" onClick={onClose} />

            <div
                data-search-panel={isMobile ? 'mobile-bottom-sheet' : 'desktop-command-surface'}
                className={`relative w-full overflow-hidden border animate-slideDown flex flex-col ${isMobile ? 'clay-mobile-search-sheet mobile-sheet-viewport' : 'max-w-2xl max-h-[60vh]'}`}
                style={{
                    background: 'var(--frost-card-framework-bg)',
                    borderColor: 'var(--frost-card-framework-border)',
                    boxShadow: 'var(--frost-card-framework-shadow)',
                    borderRadius: isMobile ? 'var(--search-palette-mobile-radius)' : 'var(--search-palette-desktop-radius)',
                    borderBottom: isMobile ? 'none' : undefined,
                    outlineColor: 'var(--clay-brand-pink)',
                    WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
                    backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)'
                }}
            >
                {/* Search Header */}
                <div
                    className={`flex items-center px-4 border-b focus-within:ring-2 focus-within:ring-[var(--search-palette-focus-ring)] ${isMobile ? 'mobile-sheet-header-safe' : ''}`}
                    style={{
                        background: 'var(--frost-input-bg)',
                        borderColor: 'var(--frost-input-border)',
                        boxShadow: 'inset 0 -1px 0 var(--frost-input-border)',
                        WebkitBackdropFilter: 'blur(var(--frost-input-blur)) saturate(1.12)',
                        backdropFilter: 'blur(var(--frost-input-blur)) saturate(1.12)'
                    }}
                >
                    <Search className="text-[var(--text-tertiary)] w-5 h-5 mr-3" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                        placeholder={isMultiSelectMode ? "多选模式：点击选择多个，按 Ctrl+Enter 确认整理" : "搜索提示词、标签或分组..."}
                        className="flex-1 bg-transparent border-none py-4 text-lg focus:outline-none"
                        style={{
                            color: 'var(--text-primary)',
                            fontSize: '16px',
                            transitionDuration: 'var(--motion-duration-standard)',
                            transitionTimingFunction: 'var(--motion-ease-standard)'
                        }}
                    />

                    {/* Multi-Select Toggle */}
                    <button
                        onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                        className="mr-2 min-h-[32px] rounded-[var(--radius-control-sm)] border px-2.5 py-1 text-xs font-medium transition-[background-color,border-color,color,box-shadow] hover:bg-[var(--toolbar-hover)]"
                        style={{
                            background: isMultiSelectMode ? 'var(--search-palette-selected-bg)' : 'var(--frost-card-sub-bg)',
                            borderColor: isMultiSelectMode ? 'var(--search-palette-selected-border)' : 'var(--frost-card-sub-border)',
                            boxShadow: isMultiSelectMode ? 'var(--search-palette-selected-shadow)' : 'none',
                            color: isMultiSelectMode ? 'var(--search-palette-accent)' : 'var(--text-secondary)'
                        }}
                        title="多选模式 (Ctrl+M)"
                    >
                        {isMultiSelectMode ? '多选已开启' : '多选'}
                    </button>

                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-[var(--toolbar-hover)] rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Results List */}
                <div
                    ref={listRef}
                    className={`custom-scrollbar flex-1 p-2 ${isMobile ? 'mobile-sheet-scroll' : 'overflow-y-auto'}`}
                >
                    {results.length === 0 ? (
                        <div className="py-12 text-center text-[var(--text-tertiary)]">
                            {query ? '未找到相关内容' : '输入关键词开始搜索...'}
                        </div>
                    ) : (
                        results.map((item, index) => {
                            const isFocused = index === selectedIndex;
                            const isSelected = multiSelectedIds.has(item.data.id);
                            const isGroup = item.type === 'group';

                            return (
                                <div
                                    key={item.data.id}
                                    onClick={(e) => {
                                        // Enter multi-select implicitly when modifier keys are used.
                                        const isModifierHeld = e.shiftKey || e.ctrlKey || e.metaKey;

                                        if (isMultiSelectMode || isModifierHeld) {
                                            if (!isMultiSelectMode) {
                                                setIsMultiSelectMode(true);
                                            }
                                            e.stopPropagation();

                                            // 1. Shift Range Select
                                            if (e.shiftKey && lastClickedIndexRef.current >= 0) {
                                                const start = Math.min(lastClickedIndexRef.current, index);
                                                const end = Math.max(lastClickedIndexRef.current, index);
                                                setMultiSelectedIds(prev => {
                                                    const next = new Set(prev);
                                                    for (let i = start; i <= end; i++) {
                                                        if (results[i]) {
                                                            next.add(results[i].data.id);
                                                        }
                                                    }
                                                    return next;
                                                });
                                            }
                                            // 2. Ctrl Toggle (Add/Remove)
                                            else {
                                                toggleMultiSelect(item);
                                            }
                                            lastClickedIndexRef.current = index;
                                        } else {
                                            // Normal Select
                                            handleSelect(item);
                                        }
                                    }}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control-md)] border px-4 py-3 transition-[background-color,border-color,box-shadow,transform]"
                                    style={{
                                        background: isSelected
                                            ? 'var(--search-palette-selected-bg)'
                                            : isFocused
                                                ? 'var(--search-palette-hover-bg)'
                                                : 'transparent',
                                        borderColor: isSelected ? 'var(--search-palette-selected-border)' : 'transparent',
                                        boxShadow: isSelected ? 'var(--search-palette-selected-shadow)' : 'none',
                                        transitionDuration: 'var(--motion-duration-standard)',
                                        transitionTimingFunction: 'var(--motion-ease-standard)'
                                    }}
                                >
                                    {isMultiSelectMode && (
                                        <div
                                            className="mt-1.5 flex h-4 w-4 items-center justify-center rounded border transition-colors"
                                            style={{
                                                background: isSelected ? 'var(--search-palette-accent)' : 'transparent',
                                                borderColor: isSelected ? 'var(--search-palette-accent)' : 'var(--text-tertiary)'
                                            }}
                                        >
                                            {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                        </div>
                                    )}

                                    <div className={`mt-1 p-1.5 rounded-md ${isFocused ? 'bg-[var(--bg-tertiary)]' : 'bg-[var(--bg-tertiary)]'} text-[var(--text-secondary)]`}>
                                        {isGroup ? <Layers size={14} /> : <MapPin size={14} />}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div
                                            className="truncate text-sm font-medium"
                                            style={{ color: isSelected ? 'var(--search-palette-accent)' : 'var(--text-primary)' }}
                                        >
                                            {item.type === 'group' ? (item.data.label || '未命名分组') : item.data.prompt}
                                        </div>

                                        {item.type === 'node' && (
                                            <>
                                                <div className="text-xs text-[var(--text-tertiary)] mt-1 flex items-center gap-2">
                                                    <span>Position: {Math.round(item.data.position.x)}, {Math.round(item.data.position.y)}</span>
                                                    <span className="w-1 h-1 bg-[var(--text-muted)] rounded-full" />
                                                    <span>{new Date(item.data.timestamp).toLocaleTimeString()}</span>
                                                </div>
                                                {item.data.tags && item.data.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {item.data.tags.map(tag => {
                                                            const colors = generateTagColor(tag);
                                                            return (
                                                                <span
                                                                    key={tag}
                                                                    className="px-1.5 py-0.5 text-[10px]"
                                                                    style={{
                                                                        backgroundColor: colors.bg,
                                                                        color: colors.text,
                                                                        border: `1px solid ${colors.border}`,
                                                                        borderRadius: 'var(--radius-sm)'
                                                                    }}
                                                                >
                                                                    #{tag}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {isGroup && (
                                            <div className="text-xs text-[var(--text-tertiary)] mt-1">
                                                包含该分组内的节点
                                            </div>
                                        )}
                                    </div>
                                    {isSelected && (
                                        <CornerDownLeft size={16} className="text-[var(--text-tertiary)] mt-1" />
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Footer Tips */}
                <div
                    className={`px-4 py-2 border-t text-[10px] text-[var(--text-tertiary)] ${isMobile ? 'mobile-sheet-footer-safe' : ''}`}
                    style={{ background: 'var(--search-palette-footer-bg)', borderColor: 'var(--search-palette-border)' }}
                >
                    <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between gap-4'}`}>
                        <div className="flex flex-wrap gap-4">
                        {isMobile ? (
                            <>
                                {MOBILE_SEARCH_HINTS.map((hint) => (
                                    <span key={hint} className="flex items-center gap-1">
                                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--search-palette-accent)]" />
                                        {hint}
                                    </span>
                                ))}
                            </>
                        ) : (
                            <>
                                {DESKTOP_SEARCH_SHORTCUTS.map((shortcut) => (
                                    <span key={shortcut.key} className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-[var(--bg-primary)] rounded border border-[var(--border-light)] font-sans">{shortcut.key}</kbd> {shortcut.label}
                                    </span>
                                ))}
                                {isMultiSelectMode && (
                                    <>
                                        <span className="flex items-center gap-1 font-medium text-[var(--search-palette-accent)]">
                                            <kbd className="px-1.5 py-0.5 rounded border bg-[var(--state-info-bg)] border-[var(--search-palette-selected-border)] font-sans text-[var(--search-palette-accent)]">Shift+点击</kbd> 区间选择
                                        </span>
                                        <span className="flex items-center gap-1 font-medium text-[var(--search-palette-accent)]">
                                            <kbd className="px-1.5 py-0.5 rounded border bg-[var(--state-info-bg)] border-[var(--search-palette-selected-border)] font-sans text-[var(--search-palette-accent)]">Ctrl+Enter</kbd> 确认整理 ({multiSelectedIds.size})
                                        </span>
                                    </>
                                )}
                            </>
                        )}
                        </div>
                        <div className={`flex shrink-0 items-center gap-2 ${isMobile ? 'justify-end' : ''}`}>
                            <span>{results.length} 个结果</span>
                            {isMultiSelectMode && multiSelectedIds.size > 0 && (
                                <button
                                    type="button"
                                    className="inline-flex min-h-[32px] max-w-full items-center gap-1.5 overflow-hidden rounded-[var(--radius-control-md)] border px-3 py-1.5 text-xs font-medium text-white transition-[background-color,border-color,box-shadow]"
                                    style={{
                                        background: 'var(--search-palette-accent)',
                                        borderColor: 'var(--search-palette-selected-border)',
                                        boxShadow: 'var(--search-palette-selected-shadow)'
                                    }}
                                    onClick={handleConfirmMultiSelect}
                                >
                                    <span className="min-w-0 truncate">整理 {multiSelectedIds.size} 项</span>
                                    <CornerDownLeft size={14} className="shrink-0" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SearchPalette;
