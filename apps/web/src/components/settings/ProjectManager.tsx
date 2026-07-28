import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
    Focus,
    Grid3x3,
    Heart,
    Layers,
    LayoutDashboard,
    Magnet,
    Maximize2,
    Moon,
    Search,
    Square,
    Sun,
    Trash2,
    Palette,
    Network,
    Cpu,
    Eye,
    Save,
    X,
} from 'lucide-react';
import { KK_LAYER } from '@kk/ui';
import { useCanvas } from '../../context/CanvasContext';
import { createZipArchive, saveBlobAs } from '../../utils/archiveRuntime';

// 简体中文：自定义扫把（Broom）图标组件，用于清理操作
const Broom: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <path d="M4 20h16" />
        <path d="m11 15 4.5-4.5" />
        <path d="m13 13 4.5-4.5" />
        <path d="M15 11 19.5 6.5" />
        <path d="m20 4-4.5 4.5" />
        <path d="M11 15 8 18" />
        <path d="m8 18-2 2" />
        <path d="M13 13 10 16" />
        <path d="m10 16-2 2" />
    </svg>
);

import { useTheme } from '../../context/ThemeContext';
import { notify } from '../../services/system/notificationService';
import type { WorkflowUtilityNodeKind } from '../../workflow/schema';
import type { WorkflowTemplateDefinition, WorkflowTemplateId } from '../../workflow/templates/workflowTemplates';
import {
    SETTINGS_MODAL_BACKDROP_CLASSNAME,
    SETTINGS_MODAL_PANEL_CLASSNAME,
} from './SettingsScaffold';
import { PROJECT_MANAGER_ACTIONS } from './settingsModuleActions';

interface ProjectManagerProps {
    onSearch: () => void;
    onFavorites?: () => void;
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
    isMobile: boolean;
    onFitToAll: () => void;
    onResetView: () => void;
    onToggleCanvasMode: () => void;
    onToggleSnapToGrid: () => void;
    onAutoArrange: () => void;
    onToggleChat?: () => void;
    isChatOpen?: boolean;
    canvasMode?: 'normal' | 'board';
    showSnapToGrid?: boolean;
    onOpenProfile?: () => void;
    mobilePromptOptimizationEnabled?: boolean;
    mobilePromptOptimizationSupported?: boolean;
    onToggleMobilePromptOptimization?: () => void;
    onOpenMobilePromptLibrary?: () => void;
    workflowTemplates?: WorkflowTemplateDefinition[];
    onApplyWorkflowTemplate?: (templateId: WorkflowTemplateId) => void;
    onAddWorkflowUtilityCard?: (kind: WorkflowUtilityNodeKind) => void;
    desktopScale?: number;
    desktopOffset?: number;
    isUserMenuOpen?: boolean;
    onOpenMarkdownImport?: () => void;
    onOpenMermaidImport?: () => void;
}

const ProjectManager: React.FC<ProjectManagerProps> = ({
    onSearch,
    onFavorites,
    isMobile,
    onFitToAll,
    onResetView,
    onToggleCanvasMode,
    onToggleSnapToGrid,
    onAutoArrange,
    canvasMode = 'normal',
    showSnapToGrid = false,
    isUserMenuOpen = false,
    onOpenMarkdownImport,
    onOpenMermaidImport,
    workflowTemplates = [],
    onApplyWorkflowTemplate,
    onAddWorkflowUtilityCard,
}) => {
    const {
        state,
        activeCanvas,
        createCanvas,
        switchCanvas,
        deleteCanvas,
        renameCanvas,
        clearAllData,
        canCreateCanvas,
        mergeCanvasInto,
        cleanupInvalidCards,
    } = useCanvas();
    const { resolvedTheme, toggleTheme } = useTheme();
    const isDarkMode = resolvedTheme === 'dark';
    const frostedProjectManagerShellStyle: React.CSSProperties = {
        background: 'var(--frost-card-framework-bg)',
        border: '1px solid var(--frost-card-framework-border)',
        boxShadow: 'var(--frost-card-framework-shadow)',
        WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
        backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
    };
    const frostedProjectManagerSubSurfaceStyle: React.CSSProperties = {
        background: 'var(--frost-card-sub-bg)',
        border: '1px solid var(--frost-card-sub-border)',
        boxShadow: 'var(--frost-card-sub-shadow)',
        WebkitBackdropFilter: 'blur(var(--frost-card-sub-blur)) saturate(1.08)',
        backdropFilter: 'blur(var(--frost-card-sub-blur)) saturate(1.08)',
    };

    const [showDropdown, setShowDropdown] = useState(false);
    const [showWorkflowDropdown, setShowWorkflowDropdown] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    const workflowTimerRef = useRef<NodeJS.Timeout | null>(null);

    const openWorkflowMenu = useCallback(() => {
        if (workflowTimerRef.current) {
            clearTimeout(workflowTimerRef.current);
            workflowTimerRef.current = null;
        }
        setShowWorkflowDropdown(true);
    }, []);

    const closeWorkflowMenuDelayed = useCallback(() => {
        if (workflowTimerRef.current) {
            clearTimeout(workflowTimerRef.current);
        }
        workflowTimerRef.current = setTimeout(() => {
            setShowWorkflowDropdown(false);
        }, 1200);
    }, []);

    const handleWorkflowMenuMouseEnter = useCallback(() => {
        if (workflowTimerRef.current) {
            clearTimeout(workflowTimerRef.current);
            workflowTimerRef.current = null;
        }
    }, []);

    const handleAddUtilityCardWithSafety = useCallback((kind: WorkflowUtilityNodeKind) => {
        try {
            if (!onAddWorkflowUtilityCard) {
                notify.error('添加失败', '工作流添加接口未准备就绪。');
                return;
            }
            if (!activeCanvas) {
                notify.error('无法执行', '未找到当前活动项目。');
                return;
            }

            onAddWorkflowUtilityCard(kind);
            notify.success('节点添加成功', `已在画布添加“${kind === 'preview' ? '预览卡' : kind === 'save' ? '保存卡' : '提示增强卡'}”`);
        } catch (error) {
            console.error('Failed to add workflow utility card', error);
            notify.error('添加失败', '系统运行时发生异常，请重试。');
        }
    }, [activeCanvas, onAddWorkflowUtilityCard]);

    const handleApplyTemplateWithSafety = useCallback((templateId: WorkflowTemplateId, title: string) => {
        try {
            if (!onApplyWorkflowTemplate) {
                notify.error('应用失败', '工作流模板接口未就绪。');
                return;
            }
            if (!activeCanvas) {
                notify.error('无法执行', '未找到当前活动项目。');
                return;
            }

            const templateNodes = activeCanvas.workflow?.nodes || [];
            const hasDuplicate = templateNodes.some(n => n.tags?.includes(`template:${templateId}`));
            if (hasDuplicate) {
                if (!window.confirm(`当前画布可能已应用过“${title}”，继续应用可能会生成重复节点，是否继续？`)) {
                    return;
                }
            }

            onApplyWorkflowTemplate(templateId);
            notify.success('应用模板成功', `已将工作流模板“${title}”部署到画布。`);
        } catch (error) {
            console.error('Failed to apply workflow template', error);
            notify.error('应用模板失败', '网络或状态同步发生异常。');
        }
    }, [activeCanvas, onApplyWorkflowTemplate]);

    useEffect(() => {
        return () => {
            if (workflowTimerRef.current) {
                clearTimeout(workflowTimerRef.current);
            }
        };
    }, []);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [mergingCanvasId, setMergingCanvasId] = useState<string | null>(null);
    const [cleaningInvalid, setCleaningInvalid] = useState(false);
    const [topPosition, setTopPosition] = useState(() => {
        const saved = localStorage.getItem('kk_pm_pos');
        const parsed = saved ? Number.parseFloat(saved) : 80;
        return Number.isFinite(parsed) ? parsed : 80;
    });
    const [isDragging, setIsDragging] = useState(false);

    const dragStartRef = useRef({ y: 0, startTop: 0 });
    const initialTop = 60;
    const activeProjectName = activeCanvas?.name || '项目';

    useEffect(() => {
        localStorage.setItem('kk_pm_pos', String(topPosition));
    }, [topPosition]);

    useEffect(() => {
        if (!isDragging) {
            return;
        }

        const handleMove = (event: MouseEvent | TouchEvent) => {
            const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
            const deltaY = clientY - dragStartRef.current.y;
            const maxTop = window.innerHeight / 2;
            const nextTop = Math.min(maxTop, Math.max(initialTop, dragStartRef.current.startTop + deltaY));
            setTopPosition(nextTop);
        };

        const handleEnd = () => {
            setIsDragging(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.body.style.touchAction = '';
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', handleEnd);

        document.body.style.cursor = 'grab';
        document.body.style.userSelect = 'none';
        document.body.style.touchAction = 'none';

        return () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('touchend', handleEnd);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.body.style.touchAction = '';
        };
    }, [isDragging]);

    const handleDragStart = (event: React.MouseEvent | React.TouchEvent) => {
        if (isMobile || (event.target as HTMLElement).closest('button')) {
            return;
        }

        const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
        dragStartRef.current = { y: clientY, startTop: topPosition };
        setIsDragging(true);
    };

    useEffect(() => {
        if (!showDropdown) {
            return;
        }

        const timer = setTimeout(() => {
            setShowDropdown(false);
        }, 5000);

        return () => clearTimeout(timer);
    }, [showDropdown]);

    // 采用防抖控制，已安全地移除硬编码的 8s 销毁定时器

    const saveEdit = useCallback(() => {
        if (editingId && editName.trim()) {
            renameCanvas(editingId, editName.trim());
        }
        setEditingId(null);
        setEditName('');

    }, [editName, editingId, renameCanvas]);

    const startEditing = useCallback((canvas: { id: string; name: string }) => {
        setEditingId(canvas.id);
        setEditName(canvas.name);
    }, []);

    const handleCreateProject = useCallback(() => {
        if (!canCreateCanvas) {
            notify.warning('项目数量已满', '当前最多只能创建 10 个项目。');
            return;
        }

        createCanvas();
        setShowDropdown(false);
    }, [canCreateCanvas, createCanvas]);

    const handleClearAll = useCallback(() => {
        if (window.confirm('确定要清空当前项目的数据吗？此操作无法撤销。')) {
            clearAllData();
            setShowDropdown(false);
        }
    }, [clearAllData]);

    const handleDownloadAll = useCallback(async () => {
        if (!activeCanvas || activeCanvas.imageNodes.length === 0) {
            notify.warning('暂无可下载内容', '当前项目还没有生成图片。');
            return;
        }

        if (!window.confirm('确认下载当前项目的全部图片吗？这会打包高质量原图。')) {
            return;
        }

        setIsDownloading(true);
        setShowDropdown(false);

        try {
            const zip = await createZipArchive();
            const folder = zip.folder(activeCanvas.name) || zip;

            let count = 0;
            await Promise.all(activeCanvas.imageNodes.map(async (image, index) => {
                try {
                    const downloadUrl = image.originalUrl || image.url;
                    if (!downloadUrl) {
                        return;
                    }

                    const response = downloadUrl.startsWith('data:')
                        ? await fetch(downloadUrl)
                        : await fetch(downloadUrl);
                    const blob = await response.blob();
                    const ext = blob.type.split('/')[1] || 'png';
                    const filename = `image_${index + 1}_${image.id.slice(0, 4)}.${ext}`;
                    folder.file(filename, blob);
                    count += 1;
                } catch (error) {
                    console.error('Failed to add image to zip', error);
                }
            }));

            if (count === 0) {
                notify.error('下载失败', '没有成功获取到图片数据。');
                return;
            }

            const content = await zip.generateAsync({ type: 'blob' });
            await saveBlobAs(content, `${activeCanvas.name}_images.zip`);
        } catch (error) {
            console.error('Download failed', error);
            notify.error('下载失败', '打包图片时出现问题，请稍后重试。');
        } finally {
            setIsDownloading(false);
        }
    }, [activeCanvas]);

    const handleCleanupInvalidCards = useCallback(() => {
        if (!activeCanvas) {
            return;
        }

        setCleaningInvalid(true);
        try {
            const result = cleanupInvalidCards(activeCanvas.id);
            if (result.removedPrompts === 0 && result.removedImages === 0 && result.removedGroups === 0) {
                notify.success('无需清理', '当前项目没有发现错误卡片或失效分组。');
                return;
            }

            notify.success(
                '清理完成',
                `已清理 ${result.removedPrompts} 张主卡、${result.removedImages} 张子卡，并移除 ${result.removedGroups} 个空分组。`
            );
        } finally {
            setCleaningInvalid(false);
            setShowDropdown(false);
        }
    }, [activeCanvas, cleanupInvalidCards]);

    const handleMergeIntoCurrent = useCallback((sourceCanvasId: string) => {
        if (!activeCanvas || sourceCanvasId === activeCanvas.id) {
            return;
        }

        const sourceCanvas = state.canvases.find(canvas => canvas.id === sourceCanvasId);
        if (!sourceCanvas) {
            return;
        }

        const confirmed = window.confirm(`确认把“${sourceCanvas.name}”合并到“${activeCanvas.name}”吗？合并后原项目会被删除。`);
        if (!confirmed) {
            return;
        }

        setMergingCanvasId(sourceCanvasId);
        try {
            const result = mergeCanvasInto(sourceCanvasId, activeCanvas.id, { deleteSource: true });
            notify.success(
                '合并完成',
                `已合并 ${result.movedPrompts} 张主卡和 ${result.movedImages} 张子卡到“${activeCanvas.name}”。`
            );
            setShowMergeModal(false);
            setShowDropdown(false);
        } finally {
            setMergingCanvasId(null);
        }
    }, [activeCanvas, mergeCanvasInto, state.canvases]);

    const desktopIconButtonClass = 'group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-all active:scale-95 hover:bg-[var(--toolbar-hover)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-coral)]';
    const dropdownPositionStyle = isMobile
        ? { top: 'calc(100% + 10px)', left: 0, width: 'min(92vw, 340px)' }
        : undefined;

    const projectDropdown = showDropdown ? (
        <>
            <div
                className="fixed inset-0 cursor-default"
                style={{ zIndex: KK_LAYER.modalBackdrop }}
                onClick={(event) => {
                    event.stopPropagation();
                    setShowDropdown(false);
                }}
            />
            <div
                className={`kk-morphic-project-panel ${isMobile ? 'absolute' : 'fixed left-3 top-[48px] bottom-[10px] w-[262px]'} overflow-hidden rounded-[14px] border`}
                style={{
                    ...frostedProjectManagerShellStyle,
                    ...dropdownPositionStyle,
                    zIndex: KK_LAYER.modal,
                }}
            >
                <div
                    className="flex items-center justify-between border-b px-4 py-3"
                    style={frostedProjectManagerSubSurfaceStyle}
                >
                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
                        我的项目
                    </h3>
                    <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                        {activeProjectName}
                    </span>
                </div>

                <div className="custom-scrollbar max-h-60 overflow-y-auto">
                    {state.canvases.map((canvas) => {
                        const isActive = canvas.id === activeCanvas?.id;

                        return (
                            <div
                                key={canvas.id}
                                data-project-manager-action={PROJECT_MANAGER_ACTIONS.selectProject.uiAction}
                                className="flex items-center gap-2 px-3 py-2.5 transition-colors"
                                style={{
                                    backgroundColor: isActive ? 'var(--toolbar-active)' : 'transparent',
                                    color: isActive ? 'var(--accent-coral)' : 'var(--text-secondary)',
                                }}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (editingId !== canvas.id) {
                                        switchCanvas(canvas.id);
                                        setShowDropdown(false);
                                    }
                                }}
                            >
                                <div className={`flex h-4 w-4 items-center justify-center ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>

                                {editingId === canvas.id ? (
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(event) => setEditName(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                saveEdit();
                                            }
                                        }}
                                        onClick={(event) => event.stopPropagation()}
                                        onBlur={saveEdit}
                                        className="flex-1 rounded-md border px-2 py-1 text-sm focus:outline-none"
                                        style={{
                                            backgroundColor: 'var(--frost-input-bg)',
                                            borderColor: 'var(--frost-input-border)',
                                            boxShadow: 'var(--frost-input-shadow)',
                                            color: 'var(--text-primary)',
                                        }}
                                        autoFocus
                                    />
                                ) : (
                                    <span className="flex-1 truncate text-sm font-medium">{canvas.name}</span>
                                )}

                                <div className="flex items-center gap-1">
                                    <button
                                        data-project-manager-action={PROJECT_MANAGER_ACTIONS.renameProject.uiAction}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            startEditing(canvas);
                                        }}
                                        className="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--toolbar-hover)] hover:text-[var(--text-primary)]"
                                        aria-label="重命名项目"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                        </svg>
                                    </button>

                                    {state.canvases.length > 1 && (
                                        <button
                                            data-project-manager-action={PROJECT_MANAGER_ACTIONS.requestDeleteProject.uiAction}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setShowDeleteConfirm(canvas.id);
                                            }}
                                            className="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                                            aria-label="删除项目"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div
                    className="space-y-1 border-t p-2"
                    style={frostedProjectManagerSubSurfaceStyle}
                >
                    <button
                        id="btn-create-canvas"
                        data-project-manager-action={PROJECT_MANAGER_ACTIONS.createProject.uiAction}
                        onClick={(event) => {
                            event.stopPropagation();
                            handleCreateProject();
                        }}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${canCreateCanvas ? 'hover:bg-[var(--toolbar-hover)]' : 'cursor-not-allowed opacity-60'}`}
                        style={{ color: canCreateCanvas ? 'var(--accent-coral)' : 'var(--text-secondary)' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        新建项目
                    </button>

                    <div className="my-1 h-px" style={{ backgroundColor: 'var(--border-light)' }} />

                    <button
                        data-project-manager-action={PROJECT_MANAGER_ACTIONS.downloadProjectOriginals.uiAction}
                        onClick={(event) => {
                            event.stopPropagation();
                            void handleDownloadAll();
                        }}
                        disabled={isDownloading}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--toolbar-hover)] hover:text-[var(--text-primary)]"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        {isDownloading ? '正在打包图片...' : '下载项目原图'}
                    </button>

                    <button
                        data-project-manager-action={PROJECT_MANAGER_ACTIONS.openMergeModal.uiAction}
                        onClick={(event) => {
                            event.stopPropagation();
                            setShowMergeModal(true);
                        }}
                        disabled={state.canvases.length < 2 || !!mergingCanvasId}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--toolbar-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Layers size={16} />
                        {mergingCanvasId ? '正在合并项目...' : '合并其他项目到当前画布'}
                    </button>

                    <button
                        data-project-manager-action={PROJECT_MANAGER_ACTIONS.cleanupInvalidCards.uiAction}
                        onClick={(event) => {
                            event.stopPropagation();
                            handleCleanupInvalidCards();
                        }}
                        disabled={cleaningInvalid}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-amber-500/10 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Broom size={16} />
                        {cleaningInvalid ? '正在清理错误卡片...' : '清理错误卡片'}
                    </button>

                    <button
                        data-project-manager-action={PROJECT_MANAGER_ACTIONS.clearCurrentProjectData.uiAction}
                        onClick={(event) => {
                            event.stopPropagation();
                            handleClearAll();
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                        清空项目数据
                    </button>
                </div>
            </div>
        </>
    ) : null;

    const workflowDropdown = showWorkflowDropdown && onAddWorkflowUtilityCard && onApplyWorkflowTemplate ? (
        <>
            <div
                className="fixed inset-0 cursor-default"
                style={{ zIndex: KK_LAYER.modalBackdrop }}
                onClick={(event) => {
                    event.stopPropagation();
                    setShowWorkflowDropdown(false);
                }}
            />
            <div
                className="kk-morphic-workflow-panel fixed left-1/2 top-1/2 w-[min(820px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[14px] border transition-[opacity,transform] duration-150"
                style={{ ...frostedProjectManagerShellStyle, zIndex: KK_LAYER.modal }}
                onMouseEnter={handleWorkflowMenuMouseEnter}
                onMouseLeave={closeWorkflowMenuDelayed}
            >
                <div
                    className="flex items-center justify-between border-b px-4 py-3"
                    style={frostedProjectManagerSubSurfaceStyle}
                >
                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
                        工作流引擎
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                            BETA
                        </span>
                        <button
                            type="button"
                            aria-label="关闭工作流"
                            className="flex size-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--toolbar-hover)] hover:text-[var(--text-primary)]"
                            onClick={(event) => {
                                event.stopPropagation();
                                setShowWorkflowDropdown(false);
                            }}
                        >
                            <X size={16} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                <div className="p-3 border-b border-[color:var(--frost-card-sub-border)]">
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
                        添加工作流卡片
                    </div>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleAddUtilityCardWithSafety('workflow-panel');
                            setShowWorkflowDropdown(false);
                        }}
                        className="mb-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--frost-card-sub-border)] bg-[var(--frost-card-main-bg)] text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--toolbar-hover)]"
                    >
                        <Network size={16} className="text-blue-400" />
                        工作流面板
                    </button>
                    <div className="grid grid-cols-3 gap-1.5">
                        <button
                            data-project-manager-action={PROJECT_MANAGER_ACTIONS.addWorkflowPreviewCard.uiAction}
                            onClick={(event) => {
                                event.stopPropagation();
                                handleAddUtilityCardWithSafety('preview');
                                setShowWorkflowDropdown(false);
                            }}
                            className="flex flex-col items-center justify-center p-2 rounded-xl border border-[color:var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] text-[var(--text-secondary)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--text-primary)] active:scale-95 group cursor-pointer"
                        >
                            <Eye size={16} className="text-indigo-400 mb-1 group-hover:scale-110 transition-transform duration-200" />
                            <span className="text-[11px] font-medium">预览卡</span>
                        </button>
                        <button
                            data-project-manager-action={PROJECT_MANAGER_ACTIONS.addWorkflowSaveCard.uiAction}
                            onClick={(event) => {
                                event.stopPropagation();
                                handleAddUtilityCardWithSafety('save');
                                setShowWorkflowDropdown(false);
                            }}
                            className="flex flex-col items-center justify-center p-2 rounded-xl border border-[color:var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] text-[var(--text-secondary)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--text-primary)] active:scale-95 group cursor-pointer"
                        >
                            <Save size={16} className="text-emerald-400 mb-1 group-hover:scale-110 transition-transform duration-200" />
                            <span className="text-[11px] font-medium">保存卡</span>
                        </button>
                        <button
                            data-project-manager-action={PROJECT_MANAGER_ACTIONS.addWorkflowAgentCard.uiAction}
                            onClick={(event) => {
                                event.stopPropagation();
                                handleAddUtilityCardWithSafety('agent');
                                setShowWorkflowDropdown(false);
                            }}
                            className="flex flex-col items-center justify-center p-2 rounded-xl border border-[color:var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] text-[var(--text-secondary)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--text-primary)] active:scale-95 group cursor-pointer"
                        >
                            <Cpu size={16} className="text-amber-400 mb-1 group-hover:scale-110 transition-transform duration-200" />
                            <span className="text-[11px] font-medium">增强卡</span>
                        </button>
                    </div>
                </div>

                <div
                    className="p-3 space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar"
                    style={frostedProjectManagerSubSurfaceStyle}
                >
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        应用工作流模板
                    </div>
                    {workflowTemplates && workflowTemplates.length > 0 ? (
                        workflowTemplates.map((template) => (
                            <button
                                key={template.id}
                                data-project-manager-action={PROJECT_MANAGER_ACTIONS.applyWorkflowTemplate.uiAction}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    handleApplyTemplateWithSafety(template.id, template.title);
                                    setShowWorkflowDropdown(false);
                                }}
                                className="flex w-full flex-col rounded-xl border border-[color:var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] px-3 py-2 text-left transition-colors hover:bg-[var(--frost-card-main-bg)] active:scale-[0.98] cursor-pointer group"
                            >
                                <div className="text-xs font-semibold text-gray-900 dark:text-white group-hover:text-[var(--accent-coral)] transition-colors">
                                    {template.title}
                                </div>
                                <div className="mt-0.5 text-[10px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                                    {template.description}
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="text-xs py-2 px-1 text-[var(--text-tertiary)] italic">暂无预设模板</div>
                    )}
                </div>
            </div>
        </>
    ) : null;

    const deleteConfirmModal = showDeleteConfirm
        ? ReactDOM.createPortal(
            <div
                className={`fixed inset-0 flex items-center justify-center ${SETTINGS_MODAL_BACKDROP_CLASSNAME}`}
                style={{ zIndex: KK_LAYER.modalBackdrop }}
                onClick={() => setShowDeleteConfirm(null)}
            >
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="project-manager-delete-title"
                    className={`mx-4 w-[90%] max-w-sm rounded-2xl border p-6 ${SETTINGS_MODAL_PANEL_CLASSNAME}`}
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="mb-5 flex items-center gap-4">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                        </div>
                        <div>
                            <h3 id="project-manager-delete-title" className="text-lg font-bold text-gray-900 dark:text-white">确认删除项目？</h3>
                            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">本地文件不会被删除，只会从工作区移除。</p>
                        </div>
                    </div>

                    <p className="mb-6 rounded-lg border p-3 text-sm leading-relaxed text-[var(--text-secondary)]" style={frostedProjectManagerSubSurfaceStyle}>
                        删除后，该项目会从当前工作区消失。如果你之后重新同步本地素材，还可以重新导入回来。
                    </p>

                    <div className="flex justify-end gap-3">
                        <button
                            data-project-manager-action={PROJECT_MANAGER_ACTIONS.cancelDeleteProject.uiAction}
                            onClick={() => setShowDeleteConfirm(null)}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--frost-card-sub-bg)] hover:text-[var(--text-primary)]"
                        >
                            取消
                        </button>
                        <button
                            data-project-manager-action={PROJECT_MANAGER_ACTIONS.confirmDeleteProject.uiAction}
                            onClick={() => {
                                if (showDeleteConfirm) {
                                    deleteCanvas(showDeleteConfirm);
                                }
                                setShowDeleteConfirm(null);
                                setShowDropdown(false);
                            }}
                            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-none transition-all hover:bg-red-600 active:scale-95"
                        >
                            删除
                        </button>
                    </div>
                </div>
            </div>,
            document.body,
        )
        : null;

    const mergeCandidates = state.canvases.filter(canvas => canvas.id !== activeCanvas?.id);
    const mergeModal = showMergeModal
        ? ReactDOM.createPortal(
            <div
                className={`fixed inset-0 flex items-center justify-center ${SETTINGS_MODAL_BACKDROP_CLASSNAME}`}
                style={{ zIndex: KK_LAYER.modalBackdrop }}
                onClick={() => !mergingCanvasId && setShowMergeModal(false)}
            >
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="project-manager-merge-title"
                    className={`mx-4 w-[92%] max-w-lg rounded-2xl border p-5 ${SETTINGS_MODAL_PANEL_CLASSNAME}`}
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 id="project-manager-merge-title" className="text-lg font-semibold text-gray-900 dark:text-white">合并项目到当前画布</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                                选择一个项目合并进“{activeProjectName}”，合并完成后原项目会自动删除。
                            </p>
                        </div>
                        <button
                            data-project-manager-action={PROJECT_MANAGER_ACTIONS.closeMergeModal.uiAction}
                            onClick={() => setShowMergeModal(false)}
                            disabled={!!mergingCanvasId}
                            className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--frost-card-sub-bg)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            关闭
                        </button>
                    </div>

                    <div className="mt-4 space-y-2">
                        {mergeCandidates.length === 0 ? (
                            <div className="rounded-xl border px-4 py-5 text-sm text-[var(--text-secondary)]" style={frostedProjectManagerSubSurfaceStyle}>
                                当前没有其他项目可合并。
                            </div>
                        ) : (
                            mergeCandidates.map((canvas) => (
                                <button
                                    key={canvas.id}
                                    data-project-manager-action={PROJECT_MANAGER_ACTIONS.mergeIntoCurrentProject.uiAction}
                                    onClick={() => handleMergeIntoCurrent(canvas.id)}
                                    disabled={!!mergingCanvasId}
                                    className="flex w-full items-center justify-between rounded-xl border border-[color:var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] px-4 py-3 text-left transition-colors hover:bg-[var(--frost-card-main-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{canvas.name}</div>
                                        <div className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                                            {canvas.promptNodes.length} 个主卡，{canvas.imageNodes.length} 个子卡
                                        </div>
                                    </div>
                                    <div className="text-xs text-[var(--accent-coral)]">
                                        {mergingCanvasId === canvas.id ? '合并中...' : '合并'}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>,
            document.body,
        )
        : null;

    if (isMobile) {
        return (
            <>
                <div id="project-manager-container" className="ios-mobile-project-strip-wrap">
                    <div className="ios-mobile-header-glass ios-mobile-project-strip">
                        <div className="ios-mobile-project-grid">
                            <div className="relative min-w-0">
                                <button
                                id="project-manager-trigger"
                                data-project-manager-action={PROJECT_MANAGER_ACTIONS.openProjectMenu.uiAction}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setShowDropdown((prev) => !prev);
                                }}
                                className={`ios-mobile-project-pill ${showDropdown ? 'is-active' : ''}`}
                                aria-label="打开项目列表"
                            >
                                <span className="ios-mobile-project-pill-icon">
                                    <Layers size={18} />
                                </span>
                                <span className="ios-mobile-project-pill-copy">
                                    <span className="ios-mobile-project-pill-label">项目</span>
                                    <span className="ios-mobile-project-pill-value">{activeProjectName}</span>
                                </span>
                            </button>
                                {projectDropdown}
                            </div>

                        <button
                            data-project-manager-action={PROJECT_MANAGER_ACTIONS.openSearch.uiAction}
                            onClick={(event) => {
                                event.stopPropagation();
                                onSearch();
                            }}
                            className="ios-mobile-project-pill ios-mobile-project-pill--search"
                            aria-label="打开搜索"
                        >
                            <span className="ios-mobile-project-pill-icon">
                                <Search size={18} />
                            </span>
                            <span className="ios-mobile-project-pill-copy">
                                <span className="ios-mobile-project-pill-label">搜索</span>
                                <span className="ios-mobile-project-pill-value">查找卡片</span>
                            </span>
                        </button>
                    </div>
                </div>
                </div>
                {deleteConfirmModal}
                {mergeModal}
            </>
        );
    }

    return (
        <>
            <div
                id="project-manager-container"
                className="fixed left-3 z-50 flex w-11 flex-col items-center select-none"
                style={{ 
                    top: '50%',
                    transform: 'translateY(-50%)',
                }}
            >
                <div
                    className="flex max-h-[calc(100dvh-144px)] w-full flex-col items-center gap-1 overflow-x-hidden overflow-y-auto rounded-lg p-0.5"
                    style={{
                        background: 'var(--frost-card-framework-bg)',
                        border: '1px solid var(--frost-card-framework-border)',
                        boxShadow: 'var(--frost-card-framework-shadow)',
                        WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
                        backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
                    }}
                >
                    <div className="flex w-full flex-col items-center gap-2">
                                <div className="relative">
                                    <button
                                        id="project-manager-trigger"
                                        data-project-manager-action={PROJECT_MANAGER_ACTIONS.openProjectMenu.uiAction}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setShowDropdown((prev) => !prev);
                                        }}
                                        className={`${desktopIconButtonClass} ${showDropdown ? 'bg-[var(--toolbar-hover)] text-[var(--accent-coral)]' : ''}`}
                                        title={activeProjectName}
                                    >
                                        <Layers size={20} />
                                        <div className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[var(--accent-coral)] border border-[var(--frost-card-framework-border)]" />
                                    </button>
                                </div>

                                <button
                                    data-project-manager-action={PROJECT_MANAGER_ACTIONS.openSearch.uiAction}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onSearch();
                                    }}
                                    className={desktopIconButtonClass}
                                    title="搜索提示词"
                                >
                                    <Search size={20} />
                                </button>

                                {onFavorites && (
                                    <button
                                        id="project-manager-favorites"
                                        data-testid="project-manager-favorites"
                                        data-project-manager-action={PROJECT_MANAGER_ACTIONS.openFavorites.uiAction}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onFavorites();
                                        }}
                                        className={desktopIconButtonClass}
                                        title="收藏"
                                    >
                                        <Heart size={20} />
                                    </button>
                                )}

                                <div className="my-1 h-px w-full" style={{ backgroundColor: 'var(--frost-card-framework-border)' }} />

                                <button
                                    data-project-manager-action={PROJECT_MANAGER_ACTIONS.fitToAll.uiAction}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onFitToAll();
                                    }}
                                    className={desktopIconButtonClass}
                                    title="缩放到全局"
                                >
                                    <Maximize2 size={20} />
                                </button>

                                <button
                                    data-project-manager-action={PROJECT_MANAGER_ACTIONS.resetView.uiAction}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onResetView();
                                    }}
                                    className={desktopIconButtonClass}
                                    title="定位卡组"
                                >
                                    <Focus size={20} />
                                </button>

                                <button
                                    data-project-manager-action={PROJECT_MANAGER_ACTIONS.toggleCanvasMode.uiAction}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onToggleCanvasMode();
                                    }}
                                    className={`${desktopIconButtonClass} ${canvasMode === 'board' ? 'bg-[var(--toolbar-active)] text-[var(--accent-coral)]' : ''}`}
                                    title={canvasMode === 'board' ? '切换到正常模式' : '切换到画板模式'}
                                >
                                    {canvasMode === 'board' ? <Palette size={20} /> : <Grid3x3 size={20} />}
                                </button>

                                <button
                                    data-project-manager-action={PROJECT_MANAGER_ACTIONS.toggleSnapToGrid.uiAction}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onToggleSnapToGrid();
                                    }}
                                    className={`${desktopIconButtonClass} ${showSnapToGrid ? 'bg-[var(--toolbar-active)] text-[var(--accent-coral)]' : ''}`}
                                    title={showSnapToGrid ? '关闭吸附' : '开启吸附'}
                                    aria-pressed={showSnapToGrid}
                                    data-testid="canvas-snap-to-grid-toggle"
                                >
                                    <Magnet size={20} />
                                </button>

                                <button
                                    data-project-manager-action={PROJECT_MANAGER_ACTIONS.autoArrange.uiAction}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onAutoArrange();
                                    }}
                                    className={desktopIconButtonClass}
                                    title="自动整理"
                                >
                                    <LayoutDashboard size={20} />
                                </button>

                                {onAddWorkflowUtilityCard && onApplyWorkflowTemplate && (
                                    <div 
                                        className="relative"
                                        onMouseEnter={openWorkflowMenu}
                                        onMouseLeave={closeWorkflowMenuDelayed}
                                    >
                                        <button
                                            data-project-manager-action={PROJECT_MANAGER_ACTIONS.toggleWorkflowMenu.uiAction}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setShowWorkflowDropdown((prev) => !prev);
                                            }}
                                            className={`${desktopIconButtonClass} ${showWorkflowDropdown ? 'bg-[var(--toolbar-hover)] text-[var(--accent-coral)]' : ''}`}
                                            title="工作流与模板"
                                        >
                                            <Network size={20} />
                                        </button>
                                    </div>
                                )}

                                <div className="my-1 h-px w-full" style={{ backgroundColor: 'var(--frost-card-framework-border)' }} />

                                <button
                                    data-project-manager-action={PROJECT_MANAGER_ACTIONS.toggleTheme.uiAction}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        toggleTheme();
                                    }}
                                    className={desktopIconButtonClass}
                                    title={isDarkMode ? '切换到浅色模式' : '切换到深色模式'}
                                >
                                    {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
                                </button>
                    </div>
                </div>
            </div>
            {projectDropdown ? ReactDOM.createPortal(projectDropdown, document.body) : null}
            {workflowDropdown ? ReactDOM.createPortal(workflowDropdown, document.body) : null}
            {deleteConfirmModal}
            {mergeModal}
        </>
    );
};

export default ProjectManager;
