import React, { useState, useEffect, useMemo } from 'react';
import { Tag, X, Plus, Check } from 'lucide-react';
import { generateTagColor } from '../../utils/colorUtils';
import { isPhoneResponsiveWidth } from '../../utils/responsiveSurface';

interface TagInputModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTags?: string[];
    onSave: (tags: string[]) => void;
    maxTags?: number;
    maxChars?: number;
    // 🚀 New Props for enhanced features
    allTags?: string[]; // All tags from entire canvas for suggestions
    inheritedTags?: string[]; // Tags from parent (Main Card) if editing Sub Card
    isSubCard?: boolean; // Whether editing a Sub Card
}

const TagInputModal: React.FC<TagInputModalProps> = ({
    isOpen,
    onClose,
    initialTags = [],
    onSave,
    maxTags = 10,
    maxChars = 6,
    allTags = [],
    inheritedTags = [],
    isSubCard = false
}) => {
    const [tags, setTags] = useState<string[]>([]);
    const [input, setInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? isPhoneResponsiveWidth(window.innerWidth) : false
    );

    useEffect(() => {
        if (isOpen) {
            setTags(initialTags);
            setInput('');
            setError(null);
        }
    }, [isOpen, initialTags]);

    useEffect(() => {
        const onResize = () => setIsMobile(isPhoneResponsiveWidth(window.innerWidth));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // 🚀 Suggestion list: All tags minus current tags and inherited tags
    const suggestions = useMemo(() => {
        const currentSet = new Set([...tags, ...inheritedTags]);
        return allTags.filter(t => !currentSet.has(t)).slice(0, 10);
    }, [allTags, tags, inheritedTags]);

    if (!isOpen) return null;

    const handleAdd = () => {
        const trimmed = input.trim();
        if (!trimmed) return;

        if (trimmed.length > maxChars) {
            setError(`标签不能超过 ${maxChars} 个字符`);
            return;
        }

        if (tags.length >= maxTags) {
            setError(`最多只能添加 ${maxTags} 个标签`);
            return;
        }

        if (tags.includes(trimmed)) {
            setError('标签已存在');
            return;
        }

        // 🚀 New Constraint: Reject if Parent (inherited) already has this tag
        if (inheritedTags.includes(trimmed)) {
            setError('主卡已有此标签，无需重复添加');
            return;
        }

        setTags([...tags, trimmed]);
        setInput('');
        setError(null);
    };

    const handleAddSuggestion = (suggestion: string) => {
        if (tags.length >= maxTags) {
            setError(`最多只能添加 ${maxTags} 个标签`);
            return;
        }
        if (inheritedTags.includes(suggestion)) {
            setError('主卡已有此标签');
            return;
        }
        if (!tags.includes(suggestion)) {
            setTags([...tags, suggestion]);
            setError(null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleSave = () => {
        onSave(tags);
        onClose();
    };

    return (
        <div
            className={`fixed inset-0 z-[10001] flex justify-center backdrop-blur-sm ${isMobile ? 'mobile-overlay-safe items-end px-2' : 'items-center px-4 py-4'}`}
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={onClose}
        >
            <div
                className={`tag-input-modal w-full overflow-hidden animate-modal-in flex flex-col ${isMobile ? 'ios-mobile-sheet mobile-sheet-viewport rounded-t-[26px] rounded-b-none' : 'mx-4 max-w-md rounded-xl max-h-[85vh]'}`}
                style={{
                    background: 'var(--frost-card-framework-bg)',
                    border: '1px solid var(--frost-card-framework-border)',
                    boxShadow: 'var(--frost-card-framework-shadow)',
                    WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
                    backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className={`flex items-center justify-between border-b p-4 ${isMobile ? 'mobile-sheet-header-safe' : ''}`}
                    style={{
                        background: 'var(--frost-card-sub-bg)',
                        borderColor: 'var(--frost-card-sub-border)'
                    }}
                >
                    <h3 className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Tag size={16} style={{ color: 'var(--accent-green)' }} />
                        编辑标签 {isSubCard && <span className="text-xs dark:text-zinc-500">(副卡)</span>}
                    </h3>
                    <button
                        onClick={onClose}
                        className="transition-all active:scale-95"
                        style={{
                            color: 'var(--text-tertiary)',
                            borderRadius: 'var(--radius-sm)',
                            transitionDuration: 'var(--duration-fast)'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className={`space-y-4 p-4 ${isMobile ? 'mobile-sheet-scroll flex-1' : 'overflow-y-auto'}`}>
                    {/* 🚀 Inherited Tags Section (Show Parent tags for Sub Cards) */}
                    {isSubCard && inheritedTags.length > 0 && (
                        <div className="space-y-1.5">
                            <div className="text-xs dark:text-zinc-500">主卡标签 (自动继承)</div>
                            <div className="flex flex-wrap gap-2">
                                {inheritedTags.map(tag => {
                                    const colors = generateTagColor(tag);
                                    return (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs opacity-60"
                                            style={{
                                                backgroundColor: colors.bg,
                                                color: colors.text,
                                                border: `1px solid ${colors.border}`,
                                                borderRadius: 'var(--radius-full)'
                                            }}
                                        >
                                            #{tag}
                                            <Check size={10} className="text-green-400" />
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Current Tags */}
                    <div className="space-y-1.5">
                        <div className="text-xs dark:text-zinc-500">{isSubCard ? '副卡专属标签' : '当前标签'}</div>
                        <div className="flex flex-wrap gap-2 min-h-[40px]">
                            {tags.map(tag => {
                                const colors = generateTagColor(tag);
                                return (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs"
                                        style={{
                                            backgroundColor: colors.bg,
                                            color: colors.text,
                                            border: `1px solid ${colors.border}`,
                                            borderRadius: 'var(--radius-full)'
                                        }}
                                    >
                                        #{tag}
                                        <button
                                            onClick={() => removeTag(tag)}
                                            className="transition-opacity active:scale-90"
                                            style={{ opacity: 0.8 }}
                                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                );
                            })}
                            {tags.length === 0 && (
                                <span className="dark:text-zinc-500 text-sm italic">暂无标签</span>
                            )}
                        </div>
                    </div>

                    {/* Validation Error */}
                    {error && (
                        <div className="text-xs text-red-500 animate-pulse">
                            {error}
                        </div>
                    )}

                    {/* Input */}
                    <div className="flex gap-2">
                        <input
                            autoFocus
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="输入标签并回车..."
                            className="flex-1 px-3 py-2 text-sm transition-all focus:border-[color:var(--settings-focus-border)] focus:ring-2 focus:ring-[color:var(--settings-focus-ring)]"
                            style={{
                                background: 'var(--frost-input-bg)',
                                border: '1px solid var(--frost-input-border)',
                                borderRadius: 'var(--radius-md)',
                                boxShadow: 'var(--frost-input-shadow)',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                fontSize: '16px',
                                transitionDuration: 'var(--duration-fast)',
                                WebkitBackdropFilter: 'blur(var(--frost-input-blur)) saturate(1.12)',
                                backdropFilter: 'blur(var(--frost-input-blur)) saturate(1.12)'
                            }}
                        />
                        <button
                            onClick={handleAdd}
                            disabled={!input.trim()}
                            className="px-3 transition-all active:scale-95"
                            style={{
                                backgroundColor: 'var(--frost-card-sub-bg)',
                                color: 'var(--text-primary)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--frost-card-sub-border)',
                                opacity: !input.trim() ? 0.5 : 1,
                                cursor: !input.trim() ? 'not-allowed' : 'pointer',
                                transitionDuration: 'var(--duration-fast)'
                            }}
                            onMouseEnter={(e) => {
                                if (input.trim()) e.currentTarget.style.backgroundColor = 'var(--frost-card-main-bg)';
                            }}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--frost-card-sub-bg)')}
                        >
                            <Plus size={18} />
                        </button>
                    </div>

                    {/* 🚀 Tag Suggestions */}
                    {suggestions.length > 0 && (
                        <div className="space-y-1.5">
                            <div className="text-xs dark:text-zinc-500">已有标签 (点击添加)</div>
                            <div className="flex flex-wrap gap-2">
                                {suggestions.map(tag => {
                                    const colors = generateTagColor(tag);
                                    return (
                                        <button
                                            key={tag}
                                            onClick={() => handleAddSuggestion(tag)}
                                            className="px-2 py-0.5 text-xs rounded-full border transition-all hover:scale-105 active:scale-95"
                                            style={{
                                                backgroundColor: 'transparent',
                                                color: colors.text,
                                                borderColor: colors.border,
                                                opacity: 0.7
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = colors.bg;
                                                e.currentTarget.style.opacity = '1';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.opacity = '0.7';
                                            }}
                                        >
                                            #{tag}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div
                    className={`border-t p-4 flex justify-end gap-2 ${isMobile ? 'mobile-sheet-footer-safe' : ''}`}
                    style={{
                        background: 'var(--frost-card-sub-bg)',
                        borderColor: 'var(--frost-card-sub-border)'
                    }}
                >
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm transition-all active:scale-95"
                        style={{
                            color: 'var(--text-tertiary)',
                            borderRadius: 'var(--radius-md)',
                            transitionDuration: 'var(--duration-fast)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--text-primary)';
                            e.currentTarget.style.backgroundColor = 'var(--frost-card-sub-bg)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-tertiary)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-medium transition-all active:scale-95"
                        style={{
                            background: 'linear-gradient(180deg, var(--clay-brand-pink) 0%, var(--clay-brand-coral) 100%)',
                            color: 'white',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: 'var(--frost-card-main-shadow)',
                            transitionDuration: 'var(--duration-fast)'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
                        onMouseLeave={(e) => (e.currentTarget.style.filter = 'brightness(1)')}
                    >
                        保存标签
                    </button>
                </div>
            </div>
        </div >
    );
};

export default TagInputModal;
