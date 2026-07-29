import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { type PromptNode, AspectRatio, GenerationMode, type PromptGenerationMetadata, type EcommerceEditableTaskState, type EcommerceFrameworkQueueItem } from '../../types';
import type { EcommerceGroupSlotState } from '../../services/ecommerce/groupSlotState.ts';
import { Sparkles, Loader2, Video, Image, Music, Copy, Check, Languages, Info, Shield, CheckCircle2, AlertTriangle, Download, Heart, AlertCircle, Bot, Pencil } from 'lucide-react';
import { getCardDimensions } from '../../utils/styleUtils';
import { generateTagColor } from '../../utils/colorUtils';
import { notify } from '../../services/system/notificationService';
import { getImage } from '../../services/storage/imageStorage';
import { getModelBadgeInfo, getProviderBadgeColor, getProviderBadgeStyle } from '../../utils/modelBadge';
import { writeTextToClipboard } from '../../utils/clipboard';
import { getLaunchTimelineByOffset, getPromptBarLaunchPoint } from '../../utils/cardLaunch';
import ImagePreview from '../image/ImagePreview';
import { getCanvasTextSofteningProfile, type CanvasCardDetailLevel } from '../../canvas/performanceProfile';
import { resolveDisplayedProviderLabel } from '../../utils/providerDisplay';
import { isCreditBillingTarget } from '../../utils/creditBilling';
import { getCanvasCardShadow } from '../../utils/canvasCardShadow';
import { pickByDocumentLanguage } from '../../utils/localeText';
import { resolveModelDisplayName } from '../../utils/modelDisplayName';
import { elevateCanvasStackZIndex } from '../../utils/canvasUtils';
import { buildPptDeckModuleState } from '../../utils/pptDeckModules';
import { getPromptNodeBaseCardWidth, getPromptNodeCardWidth } from '../../utils/promptNodeCardWidth';
import { snapCanvasPointToGrid } from '../../utils/canvasSnapToGrid';
import EcommerceCardActions from '../ecommerce/EcommerceCardActions';
import { useFavoritesStore } from '../../features/favorites';
import { canvasLivePositionStore, updateConnectorDom } from '../../app/canvasLivePositionStore';
import { CanvasMeasurementScheduler } from '../../canvas/CanvasMeasurementScheduler';
import { CanvasConnectorScheduler } from '../../canvas/CanvasConnectorScheduler';
import CanvasCardShell from './CanvasCardShell.tsx';
import { createCanvasCardPresentation } from '../../context/canvasPresentationMigration.ts';
import { createPromptCardViewModel } from '../../canvas/v3/adapters.ts';

const EcommerceCanvasWorkbenchCard = React.lazy(() => import('../ecommerce/EcommerceCanvasWorkbenchCard'));

const truncateByChars = (text: string, maxChars: number): string => {
    if (!text) return '';
    return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}…` : text;
};

const getCreditFailureSuffix = (
    node: Pick<PromptNode, 'billingMode' | 'creditCost' | 'model' | 'provider' | 'imageSize' | 'refundStatus'>
) => {
    const isCreditModel = isCreditBillingTarget(node);
    if (!isCreditModel) return '';
    if (node.refundStatus === 'success') return '，积分已退回';
    if (node.refundStatus === 'failed') return '，积分退款失败';
    return '';
};

const getPromptFailureLabel = (
    node: Pick<PromptNode, 'billingMode' | 'creditCost' | 'model' | 'provider' | 'imageSize' | 'refundStatus'>
) => `生成失败${getCreditFailureSuffix(node)}`;

const CARD_LAUNCH_OVERLAY_Z_INDEX = 980;

const getPromptStackZIndex = (node: PromptNode, isSelected: boolean, groupLayerZIndex?: number) => {
    const persistedOrder = (groupLayerZIndex ?? node.zIndex ?? 0) * 100;

    if (node.isGenerating) return persistedOrder + 40;
    if (node.isNew) return persistedOrder + 30;
    if (isSelected) return persistedOrder + 20;
    return persistedOrder + 10;
};

const snapCanvasCoordinate = (value: number, scale: number = 1) => {
    if (!Number.isFinite(value) || !Number.isFinite(scale) || scale <= 0) return value;
    return Math.round(value * scale) / scale;
};

const getFiniteTimerStart = (value: unknown): number | undefined => (
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
);

const resolveGenerationTimerStart = (node: PromptNode): number | undefined => {
    const metadata = node.generationMetadata as PromptGenerationMetadata | undefined;
    const pendingSyncStarts = (metadata?.pendingSyncRequests || [])
        .map((item) => getFiniteTimerStart(item.startedAt))
        .filter((value): value is number => value !== undefined);

    if (pendingSyncStarts.length > 0) {
        return Math.min(...pendingSyncStarts);
    }

    return getFiniteTimerStart(metadata?.attemptStartedAt) ?? getFiniteTimerStart(node.timestamp);
};

const getOptimizerStrategySummaryZh = (
    node: Pick<PromptNode, 'promptOptimizerResult'>,
): string | null => {
    const title = String(node.promptOptimizerResult?.meta?.route_title || '').trim();
    const taskType = String(node.promptOptimizerResult?.params?.task_type || '').trim();

    if (title.includes('电商主图') || taskType === 'ecommerce_hero') {
        return '当前这次优化会优先补齐产品主体、卖点焦点、拍摄角度和背景材质，让结果更适合主图与电商展示。';
    }
    if (title.includes('界面与版式') || taskType === 'ui') {
        return '当前这次优化会优先补齐界面类型、信息层级、配色风格和展示场景，让版式表达更清晰。';
    }
    if (title.includes('PPT 叙事') || taskType === 'infographic') {
        return '当前这次优化会优先补齐页面主题、版式层级、主视觉和配色方向，让演示页更稳定易读。';
    }
    if (title.includes('电影感场景') || taskType === 'lifestyle_photo') {
        return '当前这次优化会优先补齐主体身份、场景环境、情绪氛围和镜头语言，让画面更有叙事感。';
    }
    if (title) {
        return '当前这次优化会优先补齐核心主体、风格方向、光线氛围和构图重点，再尽量保持你的原始意图不被改偏。';
    }
    return null;
};

const getPromptOptimizerEngineLabelZh = (
    node: Pick<PromptNode, 'promptOptimizerResult'>,
): string | null => {
    const engine = node.promptOptimizerResult?.meta?.engine;
    if (engine === 'ai-enhanced') return 'AI 增强';
    if (engine === 'local-rulebook') return '本地规则';
    return null;
};

const getPromptOptimizerAiStatusLabelZh = (
    node: Pick<PromptNode, 'promptOptimizerResult'>,
): string | null => {
    const status = node.promptOptimizerResult?.meta?.ai_status;
    if (status === 'enhanced') return 'AI 已增强';
    if (status === 'failed-fallback') return 'AI 失败回退';
    if (status === 'skipped') return 'AI 未启用';
    return null;
};

const getPromptBusinessDisplayLabel = (node: PromptNode): string | null => {
    if (node.ecommerce?.displayLabel) return node.ecommerce.displayLabel;
    if (node.redraw?.inheritedDisplayLabel) return node.redraw.inheritedDisplayLabel;
    if (node.partialRedraw?.inheritedDisplayLabel) return node.partialRedraw.inheritedDisplayLabel;
    return null;
};

const resolveFrameworkRemarkLabel = (node: PromptNode): string => (
    node.ecommerce?.displayLabel
    || node.ecommerce?.theme
    || node.prompt
    || node.id
).trim();

const getPptDeckStageLabel = (stage: NonNullable<PromptNode['pptDeck']>['stage']) => {
    switch (stage) {
        case 'generating':
            return '生成中';
        case 'ready':
            return '可导出';
        case 'failed':
            return '异常';
        case 'exported':
            return '已导出';
        case 'descriptions':
            return '待生成';
        default:
            return '待整理';
    }
};

const getPptDeckStageTone = (stage: NonNullable<PromptNode['pptDeck']>['stage']) => {
    switch (stage) {
        case 'generating':
            return 'border-[rgba(255,77,139,0.28)] bg-[rgba(255,77,139,0.10)] text-[var(--clay-brand-pink)]';
        case 'ready':
            return 'border-[rgba(26,58,58,0.28)] bg-[rgba(26,58,58,0.10)] text-[var(--clay-brand-teal)]';
        case 'failed':
            return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
        case 'exported':
            return 'border-[rgba(255,107,90,0.28)] bg-[rgba(255,107,90,0.10)] text-[var(--clay-brand-coral)]';
        default:
            return 'border-[var(--border-light)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]';
    }
};

const getPptPageStatusTone = (status: NonNullable<NonNullable<PromptNode['pptDeck']>['pages']>[number]['generationStatus']) => {
    switch (status) {
        case 'ready':
            return 'border-[rgba(26,58,58,0.24)] bg-[rgba(26,58,58,0.08)] text-[var(--clay-brand-teal)]';
        case 'generating':
            return 'border-[rgba(255,77,139,0.24)] bg-[rgba(255,77,139,0.08)] text-[var(--clay-brand-pink)]';
        case 'error':
            return 'border-rose-500/25 bg-rose-500/8 text-rose-200';
        case 'queued':
            return 'border-[rgba(255,176,132,0.24)] bg-[rgba(255,176,132,0.08)] text-[var(--clay-brand-peach)]';
        default:
            return 'border-[var(--border-light)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]';
    }
};

type EcommercePromptBadge = { label: string; tone: 'amber' | 'blue' | 'emerald' | 'rose' | 'neutral' };

const getEcommerceAssetPreviewLabel = (
    binding?: EcommerceEditableTaskState['assetRoles'][number],
): string => {
    if (!binding) return '';

    const roleLabelMap: Record<string, string> = {
        product: '产品图',
        reference: '参考图',
        'extra-reference': '补充参考图',
        accessory: '配件图',
        'series-template': '模板图',
    };

    const primaryLabel = binding.aliasLabel || binding.label;
    const roleLabel = roleLabelMap[binding.role] || binding.role;
    return `${primaryLabel} · ${roleLabel}`;
};

const getEcommerceSelectionBadges = (
    node: PromptNode,
    activeTaskState?: EcommerceEditableTaskState | null,
): EcommercePromptBadge[] => {
    const ecommerce = node.ecommerce;
    if (!ecommerce) return [];

    const badges: EcommercePromptBadge[] = [];
    const taskState = ecommerce.editableTask;
    const taskIsActive = Boolean(
        taskState
        && activeTaskState
        && (
            activeTaskState.taskId === taskState.taskId
            || activeTaskState.sourceRowKey === ecommerce.sourceRowKey
        ),
    );

    if (ecommerce.kind !== 'a-plus-group' && ecommerce.kind !== 'framework' && ecommerce.selectedForGeneration === false) {
        badges.push({ label: '已跳过', tone: 'neutral' });
    }

    if (!ecommerce.needsReview && (taskState?.missingFields || []).length > 0) {
        badges.push({ label: '待编辑', tone: 'amber' });
    }

    if (ecommerce.stage === 'ready' && ecommerce.selectedForGeneration !== false && ecommerce.kind !== 'a-plus-group' && ecommerce.kind !== 'framework') {
        badges.push({ label: '已确认生成', tone: 'blue' });
    }

    if (taskIsActive) {
        badges.push({ label: '编辑中', tone: 'blue' });
    }

    return badges;
};

const getEcommerceStageBadges = (node: PromptNode): EcommercePromptBadge[] => {
    const ecommerce = node.ecommerce;
    if (!ecommerce) return [];

    const badges: EcommercePromptBadge[] = [];

    if (ecommerce.needsReview || (ecommerce.reviewWarnings || []).length > 0) {
        badges.push({ label: '待复核', tone: 'amber' });
    }
    if (ecommerce.desktopStage === 'generated') {
        badges.push({ label: '桌面待确认', tone: 'blue' });
    } else if (ecommerce.desktopStage === 'confirmed' && ecommerce.mobileStage === 'pending') {
        badges.push({ label: '桌面已确认待手机版', tone: 'blue' });
    } else if (ecommerce.desktopStage === 'failed') {
        badges.push({ label: '桌面生成失败', tone: 'rose' });
    }
    if (ecommerce.mobileStage === 'pending' && ecommerce.desktopStage !== 'confirmed') {
        badges.push({ label: '手机待生成', tone: 'blue' });
    } else if (ecommerce.mobileStage === 'failed') {
        badges.push({ label: '手机生成失败', tone: 'rose' });
    } else if (ecommerce.mobileStage === 'generated') {
        badges.push({ label: '手机已生成', tone: 'emerald' });
    }
    if (ecommerce.stage === 'generated' && badges.length === 0) {
        badges.push({ label: '已生成', tone: 'emerald' });
    }
    if (ecommerce.stage === 'failed' && badges.length === 0) {
        badges.push({ label: '生成失败', tone: 'rose' });
    }

    return badges;
};

const getEcommerceBadges = (
    node: PromptNode,
    activeTaskState?: EcommerceEditableTaskState | null,
): EcommercePromptBadge[] => [
    ...getEcommerceSelectionBadges(node, activeTaskState),
    ...getEcommerceStageBadges(node),
];

interface PromptNodeProps {
    node: PromptNode;
    detailLevel?: CanvasCardDetailLevel;
    groupLayerZIndex?: number;
    stackZIndexOverride?: number;
    renderOrigin?: { x: number; y: number };
    actualChildImageCount?: number;
    onPositionChange: (id: string, newPos: { x: number; y: number }) => void;
    isSelected: boolean;
    onSelect: () => void;
    onBringToFront?: () => void;
    onClickPrompt?: (node: PromptNode, isOptimizedView?: boolean) => void;
    onConnectStart?: (id: string, startPos: { x: number; y: number }) => void;
    canvasTransform?: { x: number; y: number; scale: number }; // Deprecated
    zoomScale?: number;
    isMobile?: boolean;
    sourcePosition?: { x: number; y: number };
    onCancel?: (id: string) => void;
    onDelete?: (id: string) => void;
    onRetry?: (node: PromptNode) => void;
    onUseAsAiContext?: (node: PromptNode) => void;
    onEditPptDeck?: (node: PromptNode) => void;
    onExportPpt?: (node: PromptNode) => void;
    onExportPptx?: (node: PromptNode) => void;
    onRetryPptPage?: (node: PromptNode, pageIndex: number) => void;
    onExportPptPage?: (node: PromptNode, pageIndex: number) => void;
    onToggleEcommerceSelected?: (node: PromptNode, selected: boolean) => void;
    onSetEcommerceGroupSelection?: (node: PromptNode, selected: boolean) => void;
    onGenerateEcommerceNode?: (node: PromptNode) => void;
    onOptimizeEcommerceTaskPrompt?: (node: PromptNode) => void;
    onRegenerateUnsatisfiedEcommerceNode?: (node: PromptNode) => void;
    onGenerateEcommerceGroup?: (node: PromptNode, phase: 'desktop' | 'mobile') => void;
    onGenerateEcommerceFramework?: (node: PromptNode) => void;
    onPauseEcommerceFramework?: (node: PromptNode) => void;
    onResumeEcommerceFramework?: (node: PromptNode) => void;
    onPauseEcommerceNodeQueue?: (node: PromptNode, reason?: 'editing' | 'manual') => void;
    onResumeEcommerceNodeQueue?: (node: PromptNode, reason?: 'editing' | 'manual') => void;
    onSetEcommerceFrameworkConcurrency?: (node: PromptNode, maxConcurrentGenerations: 1 | 2 | 4) => void;
    onCancelEcommerceNodeQueue?: (node: PromptNode) => void;
    onConfirmEcommerceDesktop?: (node: PromptNode) => void;
    onRetryEcommerceModule?: (node: PromptNode) => void;
    onExportEcommerceGroup?: (node: PromptNode) => void;
    ecommerceFrameworkStatus?: {
        activeSheet: string;
        paused: boolean;
        queued: number;
        dispatching: number;
        running: number;
        completed: number;
        failed: number;
        pausedItems: number;
        total: number;
        queueItems?: EcommerceFrameworkQueueItem[];
        maxConcurrentGenerations?: number;
    } | null;
    ecommerceSlotState?: EcommerceGroupSlotState | null;
    activeEcommerceTaskState?: EcommerceEditableTaskState | null;
    ecommerceFrameworkTaskNodes?: PromptNode[];
    onActivateEcommerceTask?: (node: PromptNode) => void;
    onPreviewEcommerceSlotHistory?: (node: PromptNode, preferredImageId?: string) => void;
    onEcommerceTaskStateChange?: (
        taskId: string,
        updater:
            | EcommerceEditableTaskState
            | ((previous: EcommerceEditableTaskState) => EcommerceEditableTaskState),
    ) => void;
    ioTrace?: {
        inputStorageIds: string[];
        outputStorageIds: string[];
    };
    onOpenStorageSettings?: () => void;
    onDisconnect?: (id: string) => void;
    onHeightChange?: (id: string, height: number) => void;
    highlighted?: boolean;
    shadowBoost?: boolean;
    onLivePositionChange?: (id: string, position: { x: number; y: number } | null) => void;
    onPin?: (id: string, mode: 'button' | 'drag') => void; // 🚀 [New Prop] Pin Draft
    onRemoveTag?: (id: string, tag: string) => void; // 🚀 [New Prop] Remove Tag
    onDragDelta?: (delta: { x: number; y: number }, sourceNodeId?: string) => void; // 🚀 [New Prop] Relative Drag
    onDragCommit?: (delta: { x: number; y: number }, sourceNodeId?: string, finalPosition?: { x: number; y: number }) => void;
    onDragStateChange?: (dragging: boolean) => void;
    onUpdateNode?: (node: PromptNode) => void; // 🚀 [New Prop] Update node externally
    isCanvasTransforming?: boolean;
    snapToGrid?: boolean;
    isChatMode?: boolean; // 🚀 [New Prop] Render as standard block in chat feed
}

// [FIX] Self-healing thumbnail component that recovers data from IDB if missing
const ReferenceThumbnail: React.FC<{
    image: { id: string, data?: string, mimeType?: string },
    label?: string,
    onClick?: (e: React.MouseEvent) => void
}> = ({ image, label, onClick }) => {
    const [data, setData] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setHasError(false);
        // 🚀 [Fix] If data exists and is NOT a blob URL, use it directly
        // Blob URLs can expire after page refresh, so we should try to recover from IDB
        if (image.data && !image.data.startsWith('blob:')) {
            setData(image.data);
            setLoading(false);
            return;
        }

        // If data missing OR is a blob URL (may be expired), try recover from IDB
        let active = true;
        setLoading(true);
        // Add 3s timeout to prevent infinite spinning if IDB hangs
        const timeoutPromise = new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
        // Prefer storageId if available, otherwise fallback to id
        const lookupId = (image as any).storageId || image.id;

        Promise.race([getImage(lookupId), timeoutPromise])
            .then(cached => {
                if (active && typeof cached === 'string') {
                    setData(cached);
                } else if (active && image.data) {
                    // Fallback to original data if IDB returns nothing
                    setData(image.data);
                }
                if (active) setLoading(false);
            })
            .catch(() => {
                // Fallback to original data on error
                if (active && image.data) {
                    setData(image.data);
                }
                if (active) setLoading(false);
            });

        return () => { active = false; };
    }, [image.id, (image as any).storageId, image.data]);

    const src = data ? (
        data.startsWith('data:') || data.startsWith('http') || data.startsWith('blob:')
            ? data
            : `data:${image.mimeType || 'image/png'};base64,${data}`
    ) : '';

    return (
        <div
            className="w-10 h-10 rounded border border-[var(--border-light)] overflow-hidden relative bg-[var(--bg-tertiary)] cursor-pointer active:scale-95 transition-transform"
            data-native-drag-source="true"
            draggable={!!src && !hasError}
            onMouseDown={(e) => {
                // Allow Standard Click, but prevent Drag unless moved
                e.stopPropagation();
            }}
            onClick={(e) => {
                e.stopPropagation(); // Prevent card selection
                if (onClick) onClick(e);
            }}
            onDragStart={(e) => {
                if (!src || hasError) {
                    e.preventDefault();
                    return;
                }
                e.stopPropagation(); // Prevent card drag
                // 🚀 [添加] 触发自定义事件通知 ImagePreview 关闭
                window.dispatchEvent(new CustomEvent('kk-drag-start'));
                // Pass URL as text so PromptBar can read it
                e.dataTransfer.setData('text/plain', src);
                e.dataTransfer.setData('text/uri-list', src);
                // [NEW] Pass structured data for efficient reuse
                e.dataTransfer.setData('application/x-kk-image-ref', JSON.stringify({
                    storageId: (image as any).storageId || image.id,
                    mimeType: image.mimeType || 'image/png',
                    source: 'reference-thumb',
                    data: src.startsWith('data:') ? src : undefined // Pass full data URL if available
                }));
                e.dataTransfer.effectAllowed = 'copy';
            }}
        >
            {src && !hasError ? (
                <img
                    src={src}
                    alt="Ref"
                    className="w-full h-full object-cover pointer-events-none"
                    style={{
                        imageRendering: 'auto',
                        display: 'block'
                    }}
                    onError={() => setHasError(true)}
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-tertiary)]">
                    {loading ? (
                        <Loader2 className="w-3 h-3 text-[var(--text-tertiary)] animate-spin" />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60" title="Lost">
                            <AlertCircle className="w-5 h-5 text-white/80" />
                        </div>
                    )}
                </div>
            )}
            {label ? (
                <div className="absolute left-0.5 top-0.5 max-w-[calc(100%-4px)] rounded bg-black/70 px-1 py-0.5 text-[7px] font-medium leading-none text-white">
                    <span className="block truncate">{label}</span>
                </div>
            ) : null}
        </div>

    );
};

// [NEW] Timer for generation status - 3档颜色系统
// ✅ <200s: 绿色 - "正在生成"
// ⚠️ 200-400s: 黄色 - "等待时间过长"
// 🔴 400-600s: 红色 - "建议重新生成"
// ❌ >600s: 自动取消并转为错误卡
const MAX_GENERATION_MS = 600000;

const GenerationTimer: React.FC<{ start: number; onTimeout?: () => void }> = ({ start, onTimeout }) => {
    const [elapsed, setElapsed] = useState(() => Math.min(MAX_GENERATION_MS, Math.max(0, Date.now() - start)));
    const timeoutTriggered = useRef(false);

    useEffect(() => {
        timeoutTriggered.current = false;

        const tick = () => {
            const now = Math.max(0, Date.now() - start);
            setElapsed(Math.min(now, MAX_GENERATION_MS));

            // 🚀 超过600秒自动取消
            if (now >= MAX_GENERATION_MS && !timeoutTriggered.current && onTimeout) {
                timeoutTriggered.current = true;
                onTimeout();
            }
        };
        tick();
        const interval = setInterval(tick, 250);
        return () => clearInterval(interval);
    }, [start, onTimeout]);

    const seconds = Math.min(600, Math.floor(elapsed / 1000));
    const displayTime = (Math.min(elapsed, MAX_GENERATION_MS) / 1000).toFixed(1);

    // 计算颜色和状态信息
    let colorClass: string;
    let statusText: string;
    let iconColorClass: string;

    if (seconds < 200) {
        colorClass = 'text-green-400';
        iconColorClass = 'text-green-400';
        statusText = '正在生成';
    } else if (seconds < 400) {
        colorClass = 'text-yellow-400';
        iconColorClass = 'text-yellow-400';
        statusText = '等待时间较长';
    } else if (seconds < 600) {
        colorClass = 'text-red-400';
        iconColorClass = 'text-red-400';
        statusText = '建议重新生成';
    } else {
        colorClass = 'text-red-600';
        iconColorClass = 'text-red-600';
        statusText = '即将超时';
    }

    return (
        <div className="flex flex-col items-center gap-0.5 pointer-events-none select-none">
            <div className={`text-[10px] opacity-80 font-medium tracking-widest mb-0.5 ${colorClass}`}>
                {statusText}
            </div>
            <div className={`flex items-center gap-2 ${colorClass}`}>
                <Loader2 className={`animate-spin ${iconColorClass}`} size={14} />
                <div className="font-mono text-lg font-medium tabular-nums tracking-wider drop-shadow-sm transform translate-y-[-1px]">
                    {displayTime}s
                </div>
            </div>
        </div>
    );
};

const PromptNodeComponent: React.FC<PromptNodeProps> = React.memo(({
    node,
    detailLevel = 'full',
    groupLayerZIndex,
    stackZIndexOverride,
    renderOrigin,
    actualChildImageCount = 0,

    isSelected,
    onSelect,
    onBringToFront,
    onClickPrompt,
    onConnectStart,
    canvasTransform, // Optional now
    zoomScale = 1,
    isMobile = false,
    onCancel,
    onDelete,
    onRetry,
    onUseAsAiContext,
    onEditPptDeck,
    onExportPpt,
    onExportPptx,
    onRetryPptPage,
    onExportPptPage,
    onToggleEcommerceSelected,
    onSetEcommerceGroupSelection,
    onGenerateEcommerceNode,
    onOptimizeEcommerceTaskPrompt,
    onRegenerateUnsatisfiedEcommerceNode,
    onGenerateEcommerceGroup,
    onGenerateEcommerceFramework,
    onPauseEcommerceFramework,
    onResumeEcommerceFramework,
    onPauseEcommerceNodeQueue,
    onResumeEcommerceNodeQueue,
    onSetEcommerceFrameworkConcurrency,
    onCancelEcommerceNodeQueue,
    onConfirmEcommerceDesktop,
    onRetryEcommerceModule,
    onExportEcommerceGroup,
    ecommerceFrameworkStatus = null,
    ecommerceSlotState = null,
    activeEcommerceTaskState = null,
    ecommerceFrameworkTaskNodes = [],
    onActivateEcommerceTask,
    onPreviewEcommerceSlotHistory,
    onEcommerceTaskStateChange,
    onHeightChange,
    highlighted,
    shadowBoost = false,
    onLivePositionChange,
    onRemoveTag,
    onDragDelta,
    onDragCommit,
    onDragStateChange,
    onUpdateNode,
    isCanvasTransforming = false,
    snapToGrid = false,
    isChatMode = false
}) => {
    // 🚀 [DEBUG] Trace PromptNode Rendering
    // if (node.isGenerating) {
    //    console.log('[PromptNode] Rendering Generating Node:', node.id, 'Parallel:', node.parallelCount);
    // }

    const [isDragging, setIsDragging] = useState(false);
    const isDraggingRef = useRef(false);
    const [isSlowLoading, setIsSlowLoading] = useState(false);

    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;

        const handleFitToAll = (e: Event) => {
            const customEvent = e as CustomEvent<{ centerX: number; centerY: number }>;
            if (!customEvent.detail) return;
            const { centerX, centerY } = customEvent.detail;
            
            // 计算当前卡片与中心点的物理距离
            const dx = node.position.x - centerX;
            const dy = node.position.y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 渐进延迟，系数为 0.2ms/px，限制最大延迟为 1200ms
            const delay = Math.min(1200, distance * 0.2);
            
            if (timer) {
                clearTimeout(timer);
            }
            
            setIsSlowLoading(true);
            
            timer = setTimeout(() => {
                setIsSlowLoading(false);
                timer = null;
            }, delay);
        };
        
        window.addEventListener('kk-fit-to-all', handleFitToAll);
        return () => {
            window.removeEventListener('kk-fit-to-all', handleFitToAll);
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            setIsSlowLoading(false);
        };
    }, [node.position.x, node.position.y]);
    const [cardHeight, setCardHeight] = useState(200); // 默认高度??00px,会在渲染后更??
    const isEcommerceFrameworkCard = node.mode === GenerationMode.ECOMMERCE && node.ecommerce?.kind === 'framework';
    const baseCardWidth = getPromptNodeBaseCardWidth(node);
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : baseCardWidth;
    const cardWidth = getPromptNodeCardWidth(node, isMobile, viewportWidth);
    const canvasV3ViewModel = createPromptCardViewModel(node);
    const originX = renderOrigin?.x ?? 0;
    const originY = renderOrigin?.y ?? 0;
    const [previewImage, setPreviewImage] = useState<{ url: string; originRect: DOMRect } | null>(null);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const dragStartCanvasPos = useRef({ x: 0, y: 0 });

    const hasMoved = useRef(false);
    const [activeTab, setActiveTab] = useState<'raw' | 'opt'>('raw');
    const [copyStatus, setCopyStatus] = useState<'idle' | 'en' | 'zh'>('idle');
    const favoriteItems = useFavoritesStore(state => state.items);
    const addPromptFavorite = useFavoritesStore(state => state.addPromptFavorite);
    const removeFavorite = useFavoritesStore(state => state.removeFavorite);
    const promptFavorite = favoriteItems.find(item => (
        item.kind === 'favorite-prompt'
        && (
            item.sourcePromptId === node.id
            || item.prompt.trim() === node.prompt.trim()
        )
    ));
    const [frameworkRemarkDraft, setFrameworkRemarkDraft] = useState(() => resolveFrameworkRemarkLabel(node));
    const frameworkRemarkSkipCommitRef = useRef(false);
    const ecommerceFrameworkCardClassName = isEcommerceFrameworkCard
        ? 'kk-canvas-v3-prompt-body px-4 pb-4 pt-3 flex flex-col'
        : 'kk-canvas-v3-prompt-body p-3 flex flex-col';
    const resolvedTimerStart = resolveGenerationTimerStart(node);
    const timerStartRef = useRef<number>(resolvedTimerStart ?? Date.now());

    const containerRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') {
            setIsVisible(true);
            return;
        }
        if (!cardRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    setIsVisible(entry.isIntersecting);
                }
            },
            { rootMargin: '200px' }
        );

        observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, []);

    const localPosRef = useRef(node.position);
    const hasAnimatedRef = useRef<string | null>(null);
    const onDragDeltaRef = useRef(onDragDelta);
    const onDragCommitRef = useRef(onDragCommit);
    const onLivePositionChangeRef = useRef(onLivePositionChange);
    const onDragStateChangeRef = useRef(onDragStateChange);
    const latestPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
    const dragRafRef = useRef<number | null>(null);
    const dragRenderMetricsRef = useRef({
        cardWidth,
        cardHeight,
        originX,
        originY,
        zoomScale: zoomScale || 1,
        nodeId: node.id,
    });

    useEffect(() => {
        onDragDeltaRef.current = onDragDelta;
        onDragCommitRef.current = onDragCommit;
        onLivePositionChangeRef.current = onLivePositionChange;
        onDragStateChangeRef.current = onDragStateChange;
        if (!isDraggingRef.current) {
            dragRenderMetricsRef.current = {
                cardWidth,
                cardHeight,
                originX,
                originY,
                zoomScale: zoomScale || 1,
                nodeId: node.id,
            };
        }
    }, [cardHeight, cardWidth, node.id, onDragCommit, onDragDelta, onDragStateChange, onLivePositionChange, originX, originY, zoomScale]);

    // Sync ref when node.position updates externally (and not dragging)
    // 🚀 [Fix] 使用更宽松的条件，避免拖动结束后位置回弹
    useEffect(() => {
        if (!isDragging && !isDraggingRef.current && !isChatMode) {
            localPosRef.current = node.position;
            const isEntryAnimationActive = Boolean(
                node.timestamp
                && Date.now() - node.timestamp < 1500
                && canvasTransform
            );
            if (containerRef.current && !isEntryAnimationActive) {
                // world 布局已由 React 提交，此处只清理实时位移残留。
                containerRef.current.style.transform = '';
            }
        }
    }, [node.position.x, node.position.y, node.timestamp, isDragging, isChatMode, canvasTransform]);

    useEffect(() => () => {
        onLivePositionChangeRef.current?.(node.id, null);
    }, [node.id]);

    useEffect(() => {
        if (isChatMode) return;

        const unsubscribe = canvasLivePositionStore.subscribe(node.id, (pos) => {
            if (isDraggingRef.current) return;

            if (containerRef.current) {
                if (pos) {
                    const renderLeft = snapCanvasCoordinate(pos.x - cardWidth / 2, zoomScale || 1);
                    const renderTop = snapCanvasCoordinate(pos.y - cardHeight, zoomScale || 1);
                    const currentLeft = parseFloat(containerRef.current.style.left) || 0;
                    const currentTop = parseFloat(containerRef.current.style.top) || 0;
                    const nextTranslateX = renderLeft - originX - currentLeft;
                    const nextTranslateY = renderTop - originY - currentTop;

                    containerRef.current.style.transform = `translate3d(${nextTranslateX}px, ${nextTranslateY}px, 0px)`;

                    // 🚀 同时更新这组下属所有子图像节点的局部连接线！
                    if (node.childImageIds && node.childImageIds.length > 0) {
                        node.childImageIds.forEach((childImageId) => {
                            CanvasConnectorScheduler.request(node.id, childImageId);
                        });
                    }
                } else {
                    containerRef.current.style.transform = '';
                }
            }
        });

        return () => unsubscribe();
    }, [node.id, node.childImageIds, cardWidth, cardHeight, zoomScale, originX, originY, isChatMode]);

    useEffect(() => {
        // 🚀 默认展示优化后的结果 (若存在)
        if (node.promptOptimizerResult || (node.optimizedPromptEn && node.optimizedPromptZh)) {
            setActiveTab('opt');
        } else {
            setActiveTab('raw');
        }
    }, [node.id]);

    useEffect(() => {
        if (!isEcommerceFrameworkCard) return;
        setFrameworkRemarkDraft(resolveFrameworkRemarkLabel(node));
    }, [isEcommerceFrameworkCard, node.ecommerce?.displayLabel, node.ecommerce?.theme, node.id, node.prompt]);

    const handleFrameworkRemarkCommit = () => {
        if (!isEcommerceFrameworkCard || !node.ecommerce) return;
        if (frameworkRemarkSkipCommitRef.current) {
            frameworkRemarkSkipCommitRef.current = false;
            return;
        }

        const currentLabel = resolveFrameworkRemarkLabel(node);
        const nextLabel = frameworkRemarkDraft.trim() || currentLabel;
        setFrameworkRemarkDraft(nextLabel);

        if (nextLabel === currentLabel) {
            return;
        }

        void onUpdateNode?.({
            ...node,
            ecommerce: {
                ...node.ecommerce,
                displayLabel: nextLabel,
            },
        });
    };

    const renderEcommerceFrameworkHeaderContent = (compact = false) => (
        <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
                type="text"
                value={frameworkRemarkDraft}
                data-testid="ecommerce-framework-remark-input"
                aria-label="电商卡片备注名"
                className={`${compact ? 'h-7 min-w-[120px]' : 'h-8 min-w-[140px]'} max-w-[280px] flex-[0_1_280px] rounded-lg border border-[var(--frost-card-sub-border)] bg-[var(--frost-input-bg)] px-3 text-[12px] font-medium text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-[var(--clay-brand-pink)]`}
                placeholder="备注名称"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setFrameworkRemarkDraft(e.target.value)}
                onBlur={handleFrameworkRemarkCommit}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.currentTarget.blur();
                    } else if (e.key === 'Escape') {
                        frameworkRemarkSkipCommitRef.current = true;
                        setFrameworkRemarkDraft(resolveFrameworkRemarkLabel(node));
                        e.currentTarget.blur();
                    }
                }}
            />
            {node.tags && node.tags.length > 0 ? (
                <div
                    className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden"
                    data-testid="ecommerce-framework-header-tags"
                >
                    {node.tags?.slice(0, 5).map((tag) => {
                        const colors = generateTagColor(tag);
                        return (
                            <span
                                key={tag}
                                className={`${compact ? 'h-5 max-w-[78px]' : 'h-6 max-w-[92px]'} inline-flex shrink-0 items-center rounded-md border px-2 text-[10px] font-medium`}
                                style={{
                                    backgroundColor: colors.bg,
                                    color: colors.text,
                                    borderColor: colors.border,
                                }}
                                title={tag}
                            >
                                #{truncateByChars(tag, compact ? 6 : 8)}
                            </span>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );

    useEffect(() => {
        if (resolvedTimerStart !== undefined) {
            timerStartRef.current = resolvedTimerStart;
        }
    }, [node.id, resolvedTimerStart]);

    useEffect(() => {
        return () => {
            onDragStateChangeRef.current?.(false);
        };
    }, []);

    // 🚀 [丝滑优化] 统一飞入动画：从输入框中心飞向画布目标位置
    // 使用 useLayoutEffect + 单一 gsap.fromTo 避免双重动画冲突和位置跳动
    useLayoutEffect(() => {
        if (node.isDraft || hasAnimatedRef.current === node.id) return;

        const now = Date.now();
        const isFresh = node.timestamp && (now - node.timestamp < 1500);

        if (isFresh && canvasTransform && containerRef.current) {
            hasAnimatedRef.current = node.id;
            const el = containerRef.current;
            const restoreVisibility = () => {
                if (!el || !el.isConnected) return;
                el.style.opacity = '1';
                el.style.willChange = '';
                el.style.zIndex = '';
            };

            import('gsap').then(({ default: gsap }) => {
                if (!el || !el.isConnected) return;

                try {
                    // 仅在 GSAP 成功加载后再隐藏，避免卡片永久透明
                    el.style.opacity = '0';
                    el.style.willChange = 'transform, opacity';

                    // 1. 计算起始世界坐标（从输入框下沿外侧弹出，避免压在输入框上层）
                    const launchPoint = getPromptBarLaunchPoint(18, 'bottom');
                    const startScreenX = launchPoint.x;
                    const startScreenY = launchPoint.y;
                    const offsetX = (startScreenX - canvasTransform.x) / canvasTransform.scale - node.position.x;
                    const offsetY = (startScreenY - canvasTransform.y) / canvasTransform.scale - node.position.y;
                    const timelineConfig = getLaunchTimelineByOffset(offsetX, offsetY, canvasTransform.scale || 1);

                    // 2. 单一 fromTo 动画 —— 避免双重动画覆盖
                    const timeline = gsap.timeline({
                        defaults: { force3D: true, overwrite: 'auto' },
                        onStart: () => {
                            el.style.zIndex = String(Math.max(
                                CARD_LAUNCH_OVERLAY_Z_INDEX,
                                (stackZIndexOverride ?? getPromptStackZIndex(node, isSelected, groupLayerZIndex)) + 1
                            ));
                        },
                        onComplete: () => {
                            el.style.willChange = '';
                            el.style.zIndex = '';
                        },
                        onInterrupt: () => {
                            el.style.willChange = '';
                            el.style.zIndex = '';
                        },
                    });

                    timeline
                        .set(el, {
                            x: timelineConfig.startX,
                            y: timelineConfig.startY,
                            scale: timelineConfig.startScale,
                            opacity: 0,
                            transformOrigin: '50% 100%',
                        })
                        .to(el, {
                            opacity: 1,
                            duration: timelineConfig.fadeInDuration,
                            ease: 'sine.out',
                        })
                        .to(el, {
                            x: timelineConfig.midX,
                            y: timelineConfig.midY,
                            scale: timelineConfig.midScale,
                            duration: timelineConfig.travelDuration,
                            ease: 'power2.out',
                        }, '<')
                        .to(el, {
                            x: timelineConfig.nearX,
                            y: timelineConfig.nearY,
                            scale: timelineConfig.nearScale,
                            duration: timelineConfig.nearDuration,
                            ease: 'sine.out',
                        })
                        .to(el, {
                            x: 0,
                            y: 0,
                            scale: 1,
                            opacity: 1,
                            duration: timelineConfig.settleDuration + 0.06,
                            ease: 'expo.out',
                            clearProps: 'transform,opacity,will-change',
                        });
                } catch (error) {
                    console.warn('[PromptNodeComponent] Entry animation failed, restored visibility.', error);
                    restoreVisibility();
                }
            }).catch((error) => {
                console.warn('[PromptNodeComponent] Failed to load GSAP, restored visibility.', error);
                restoreVisibility();
            });
        }
    }, [node.id, node.timestamp, node.isDraft, canvasTransform, isChatMode, isSelected, node.zIndex, groupLayerZIndex, stackZIndexOverride]);

    // 🚀 [New] Entry Animation Cleanup: remove 'isNew' status after animation ends
    useEffect(() => {
        if (node.isNew) {
            const timer = setTimeout(() => {
                if (onUpdateNode) {
                    onUpdateNode({ ...node, isNew: false });
                }
            }, 1000); // 增加清理时间窗口
            return () => clearTimeout(timer);
        }
    }, [node.id, node.isNew, onUpdateNode]);


    // 合并后的高度测量与上报调度逻辑
    useEffect(() => {
        // 只在 idle + visible + full detail + 且非拖拽非缩放状态下测量
        if (detailLevel !== 'full' || isCanvasTransforming || isDragging || !isVisible) {
            return;
        }

        const triggerMeasure = () => {
            if (cardRef.current) {
                CanvasMeasurementScheduler.requestHeight(
                    node.id,
                    cardRef.current,
                    (height) => {
                        if (height > 0) {
                            // 1. 内部同步状态（用于连线起点）
                            setCardHeight(prev => (Math.abs(prev - height) > 2 ? height : prev));
                            // 2. 外部上报高度
                            if (onHeightChange && Math.abs(height - (node.height || 0)) > 2) {
                                onHeightChange(node.id, height);
                            }
                        }
                    }
                );
            }
        };

        // 当变为 idle + visible + full detail 且非交互状态时，立即进行一次同步高度测量
        triggerMeasure();

        if (typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver((entries) => {
            // 在回调中再次双重验证，如果处于 transforming 或 dragging，忽略回调以防止卡顿
            if (isCanvasTransforming || isDragging) return;
            triggerMeasure();
        });

        if (cardRef.current) {
            observer.observe(cardRef.current);
        }
        return () => observer.disconnect();
    }, [node.id, node.height, detailLevel, isCanvasTransforming, isDragging, isVisible, onHeightChange]);


    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (isChatMode) return; // Disable drag/select logic in chat mode
        e.stopPropagation();
        if (e.cancelable) {
            e.preventDefault();
        }
        if ('button' in e && e.button === 1) {
            return;
        }
        if ('button' in e && e.button === 2) {
            e.stopPropagation();
            onBringToFront?.();
            onSelect();
            return;
        }
        // Only select if not already selected (Preserve Group)
        if (!isSelected) {
            onBringToFront?.();
            onSelect();
        }

        // Handle both Mouse and Touch events
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        // Store initial mouse position
        dragStartPos.current = { x: clientX, y: clientY };
        dragStartCanvasPos.current = { x: node.position.x, y: node.position.y };
        localPosRef.current = node.position;
        dragRenderMetricsRef.current = {
            cardWidth,
            cardHeight,
            originX,
            originY,
            zoomScale: zoomScale || 1,
            nodeId: node.id,
        };

        isDraggingRef.current = true;
        setIsDragging(true);
        onDragStateChange?.(true);
        hasMoved.current = false;

        // 🚀 [添加] 触发自定义事件通知 ImagePreview 关闭
        window.dispatchEvent(new CustomEvent('kk-drag-start'));
    };

    // 🚀 [优化] 拖拽逻辑采用 requestAnimationFrame 进行节流以提高跟手性与流畅度
    const updateDragPosition = () => {
        dragRafRef.current = null;
        if (!isDraggingRef.current || !latestPointerRef.current) return;

        const { clientX, clientY } = latestPointerRef.current;
        const scale = dragRenderMetricsRef.current.zoomScale;
        const nextPos = snapCanvasPointToGrid({
            x: dragStartCanvasPos.current.x + ((clientX - dragStartPos.current.x) / scale),
            y: dragStartCanvasPos.current.y + ((clientY - dragStartPos.current.y) / scale),
        }, { enabled: snapToGrid });
        const dx = nextPos.x - localPosRef.current.x;
        const dy = nextPos.y - localPosRef.current.y;

        localPosRef.current = nextPos;
        onLivePositionChangeRef.current?.(node.id, nextPos);

        if (containerRef.current) {
            const { cardWidth: liveCardWidth, cardHeight: liveCardHeight, originX: liveOriginX, originY: liveOriginY, zoomScale: liveZoomScale } = dragRenderMetricsRef.current;
            const nextLeft = snapCanvasCoordinate(nextPos.x - liveCardWidth / 2, liveZoomScale) - liveOriginX;
            const nextTop = snapCanvasCoordinate(nextPos.y - liveCardHeight, liveZoomScale) - liveOriginY;
            containerRef.current.style.left = `${nextLeft}px`;
            containerRef.current.style.top = `${nextTop}px`;
        }

        // 只更新 React 状态，连接线会跟随
        const dragDeltaHandler = onDragDeltaRef.current;
        const draggedNodeId = dragRenderMetricsRef.current.nodeId;
        if (dragDeltaHandler && (dx !== 0 || dy !== 0)) {
            dragDeltaHandler({ x: dx, y: dy }, draggedNodeId);
        }
    };

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
        if (!isDraggingRef.current) return;

        // 防止拖拽卡片时页面滚动
        if (e.cancelable) e.preventDefault();

        let clientX, clientY;
        if ('touches' in e) {
            clientX = (e as TouchEvent).touches[0].clientX;
            clientY = (e as TouchEvent).touches[0].clientY;
        } else {
            clientX = (e as MouseEvent).clientX;
            clientY = (e as MouseEvent).clientY;
        }

        const moveDist = Math.hypot(clientX - dragStartPos.current.x, clientY - dragStartPos.current.y);
        if (moveDist > 3) {
            hasMoved.current = true;
        }

        latestPointerRef.current = { clientX, clientY };

        if (dragRafRef.current === null) {
            dragRafRef.current = requestAnimationFrame(updateDragPosition);
        }
    };

    const handleMouseUp = () => {
        if (isDraggingRef.current) {
            isDraggingRef.current = false;

            // 清理可能处于 pending 状态的动画帧，确保数据同步
            if (dragRafRef.current !== null) {
                cancelAnimationFrame(dragRafRef.current);
                dragRafRef.current = null;
            }

            // 如果 latestPointer 存在，在 mouseup 时做最后一次更新以保证最新坐标被算入
            if (latestPointerRef.current) {
                const { clientX, clientY } = latestPointerRef.current;
                const scale = dragRenderMetricsRef.current.zoomScale;
                const finalPos = snapCanvasPointToGrid({
                    x: dragStartCanvasPos.current.x + ((clientX - dragStartPos.current.x) / scale),
                    y: dragStartCanvasPos.current.y + ((clientY - dragStartPos.current.y) / scale),
                }, { enabled: snapToGrid });
                localPosRef.current = finalPos;
            }

            const finalPos = localPosRef.current;
            const totalDelta = {
                x: finalPos.x - dragStartCanvasPos.current.x,
                y: finalPos.y - dragStartCanvasPos.current.y,
            };
            setIsDragging(false);
            onDragStateChangeRef.current?.(false);
            if (containerRef.current) {
                const { cardWidth: liveCardWidth, cardHeight: liveCardHeight, originX: liveOriginX, originY: liveOriginY, zoomScale: liveZoomScale } = dragRenderMetricsRef.current;
                const finalLeft = snapCanvasCoordinate(finalPos.x - liveCardWidth / 2, liveZoomScale) - liveOriginX;
                const finalTop = snapCanvasCoordinate(finalPos.y - liveCardHeight, liveZoomScale) - liveOriginY;
                containerRef.current.style.left = `${finalLeft}px`;
                containerRef.current.style.top = `${finalTop}px`;
            }
            if (hasMoved.current && (totalDelta.x !== 0 || totalDelta.y !== 0)) {
                onDragCommitRef.current?.(totalDelta, dragRenderMetricsRef.current.nodeId, finalPos);
            }
            onLivePositionChangeRef.current?.(dragRenderMetricsRef.current.nodeId, null);
            latestPointerRef.current = null;
        }
    };

    useEffect(() => {
        if (isDragging) {
            // 🚀 使用 passive: true 提升性能，因为我们在 handleMouseMove 中调用 preventDefault
            window.addEventListener('mousemove', handleMouseMove, { passive: false });
            window.addEventListener('mouseup', handleMouseUp);
            // Touch listeners (non-passive to prevent scroll)
            window.addEventListener('touchmove', handleMouseMove, { passive: false });
            window.addEventListener('touchend', handleMouseUp);
        }
        return () => {
            // 确保在卸载时清理可能存在的动画帧
            if (dragRafRef.current !== null) {
                cancelAnimationFrame(dragRafRef.current);
                dragRafRef.current = null;
            }
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [isDragging, snapToGrid]);

    const effectiveChildImageCount = Math.max(0, actualChildImageCount);
    const pptDeck = node.mode === GenerationMode.PPT ? buildPptDeckModuleState(node) : null;
    const pptReadyPageCount = pptDeck?.pages.filter((page) => page.generationStatus === 'ready').length || 0;
    const shouldReduceShadow = (isDragging || isCanvasTransforming) && localStorage.getItem('kk_studio_perf_zoom_reduce_motion') !== 'false';
    const renderedSuccessCount = effectiveChildImageCount > 0
        ? effectiveChildImageCount
        : (pptReadyPageCount > 0 ? pptReadyPageCount : Math.max(0, Number(node.lastGenerationSuccessCount || 0)));
    const renderedFailCount = Math.max(0, Number(node.lastGenerationFailCount || 0));
    const showError = Boolean(node.error);
    const isThumbnailShell = detailLevel === 'thumbnail-shell';
    const shellKind = node.presentation?.kind || (node.childImageIds.length > 0 ? 'prompt-result-group' : 'prompt-only');
    const shellLayoutMode = node.presentation?.layoutMode || 'column';
    const shellPresentation = node.presentation || createCanvasCardPresentation(
        shellKind,
        shellLayoutMode,
        cardWidth >= 400 ? 'wide' : cardWidth <= 280 ? 'compact' : 'standard',
    );
    const shellCardShadow = shouldReduceShadow
        ? 'none'
        : (showError
            ? getCanvasCardShadow({ accent: 'red', boost: shadowBoost, zoomScale })
            : isSelected
                ? getCanvasCardShadow({ accent: 'blue', boost: shadowBoost, zoomScale })
                : getCanvasCardShadow({ boost: shadowBoost, zoomScale }));
    const mainCardShadow = shouldReduceShadow
        ? 'none'
        : (showError
            ? getCanvasCardShadow({ accent: 'red', boost: shadowBoost, zoomScale })
            : isSelected
                ? getCanvasCardShadow({ accent: 'blue', boost: shadowBoost, zoomScale })
                : getCanvasCardShadow({ boost: shadowBoost, zoomScale }));
    const shellPreviewText = (
        node.optimizedPromptEn
        || node.promptOptimizerResult?.optimized_prompt_en
        || node.originalPrompt
        || node.prompt
        || ''
    ).trim();
    const shellReferenceImages = node.referenceImages?.slice(0, isThumbnailShell ? 1 : 2) || [];
    const stackZIndex = stackZIndexOverride ?? getPromptStackZIndex(node, isSelected, groupLayerZIndex);
    const effectiveStackZIndex = elevateCanvasStackZIndex(stackZIndex, isDragging);
    const cardSurfaceZIndex = (node.isGenerating || showError)
        ? stackZIndex + 120
        : stackZIndex;
    const renderPos = isDragging ? localPosRef.current : node.position;
    const activeOriginX = isDragging ? dragRenderMetricsRef.current.originX : originX;
    const activeOriginY = isDragging ? dragRenderMetricsRef.current.originY : originY;
    const renderLeft = snapCanvasCoordinate(renderPos.x - cardWidth / 2, zoomScale || 1);
    const renderTop = snapCanvasCoordinate(renderPos.y - cardHeight, zoomScale || 1);
    const textSoftening = getCanvasTextSofteningProfile(
        zoomScale || 1,
        detailLevel === 'compact' || isCanvasTransforming
    );
    const textTransition = 'filter 140ms ease, opacity 140ms ease';
    const primaryTextRenderStyle = {
        filter: textSoftening.active ? `blur(${textSoftening.primaryBlurPx}px)` : 'none',
        opacity: textSoftening.primaryOpacity,
        transition: textTransition,
    };
    const secondaryTextRenderStyle = {
        filter: textSoftening.active ? `blur(${textSoftening.secondaryBlurPx}px)` : 'none',
        opacity: textSoftening.secondaryOpacity,
        transition: textTransition,
    };
    const promptCardScale = isDragging
        ? 1
        : isSelected
            ? 1.016
            : (highlighted ? 1.01 : 1);
    const promptCardTransform = `scale(${promptCardScale})`;
    const promptGlassFill = 'var(--frost-card-main-bg)';

    if (detailLevel === 'ghost') {
        return (
            <CanvasCardShell
                ref={containerRef}
                id={node.id}
                domId={`prompt-card-${node.id}`}
                position={{
                    x: renderLeft + cardWidth / 2 - activeOriginX,
                    y: renderTop + cardHeight - activeOriginY,
                }}
                origin={{ x: activeOriginX, y: activeOriginY }}
                presentation={shellPresentation}
                width={cardWidth}
                height={cardHeight}
                zIndex={effectiveStackZIndex}
                selected={isSelected}
                detailLevel={detailLevel}
                positioning="world"
                surface={false}
                renderDetailPlaceholder={false}
                className="prompt-node flex flex-col items-center select-none"
                style={{
                    height: cardHeight,
                    opacity: 0.8,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    transition: isDragging ? 'none' : 'opacity 125ms var(--kk-motion-ease-standard)',
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect?.();
                }}
            >
                <div
                    className="relative w-full h-full overflow-hidden border border-dashed border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)] flex flex-col justify-between p-2"
                >
                    <div className="text-[10px] text-[var(--text-secondary)] font-bold truncate">
                        {pickByDocumentLanguage(node.prompt, node.originalPrompt) || 'Prompt Node'}
                    </div>
                    <div className="text-[8px] text-[var(--text-tertiary)] truncate">
                        {pickByDocumentLanguage(node.prompt, node.originalPrompt) || 'Ghost Details'}
                    </div>
                </div>
            </CanvasCardShell>
        );
    }

    if (isSlowLoading) {
        return (
            <CanvasCardShell
                ref={containerRef}
                id={node.id}
                domId={`prompt-card-${node.id}`}
                position={{
                    x: renderLeft + cardWidth / 2 - activeOriginX,
                    y: renderTop + cardHeight - activeOriginY,
                }}
                origin={{ x: activeOriginX, y: activeOriginY }}
                presentation={shellPresentation}
                width={cardWidth}
                height={cardHeight}
                zIndex={effectiveStackZIndex}
                selected={isSelected}
                detailLevel="skeleton"
                positioning="world"
                surface={false}
                renderDetailPlaceholder={false}
                style={{
                    height: `${cardHeight}px`,
                    pointerEvents: 'none',
                    opacity: 0.8,
                }}
                className="gpu-accelerated transition-opacity duration-300"
            >
                <div
                    className="w-full h-full rounded-2xl border animate-pulse"
                    style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderColor: 'rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(8px)',
                    }}
                />
            </CanvasCardShell>
        );
    }

    if (detailLevel === 'thumbnail-shell') {
        const shellStatusTone = showError
            ? 'text-red-400 bg-red-500/10 border-red-500/20'
            : node.isGenerating
                ? 'text-[var(--clay-brand-pink)] bg-[rgba(255,77,139,0.10)] border-[rgba(255,77,139,0.20)]'
                : 'text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border-[var(--border-light)]';

        return (
            <CanvasCardShell
                ref={containerRef}
                id={node.id}
                domId={`prompt-card-${node.id}`}
                position={{
                    x: renderLeft + cardWidth / 2 - activeOriginX,
                    y: renderTop + cardHeight - activeOriginY,
                }}
                origin={{ x: activeOriginX, y: activeOriginY }}
                presentation={shellPresentation}
                width={cardWidth}
                height={cardHeight}
                zIndex={effectiveStackZIndex}
                selected={isSelected}
                detailLevel={detailLevel}
                positioning={isChatMode ? 'flow' : 'world'}
                surface={false}
                renderDetailPlaceholder={false}
                data-x={node.position.x}
                data-y={node.position.y}
                className={`prompt-node ${isChatMode ? 'w-full max-w-[460px] mx-auto my-3' : ''} flex flex-col items-center group antialiased select-none`}
                style={isChatMode ? {
                    opacity: 1,
                } : {
                    opacity: 1,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    willChange: isDragging ? 'left, top' : 'auto',
                    transition: isDragging ? 'none' : 'opacity 125ms var(--kk-motion-ease-standard)',
                    pointerEvents: 'auto',
                    touchAction: 'none'
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
            >
                <div
                    ref={cardRef}
                    data-canvas-surface="prompt"
                    className={`relative flex flex-col rounded-2xl border border-[var(--frost-card-main-border)] overflow-hidden`}
                    style={{
                        width: isChatMode ? '100%' : cardWidth,
                        maxWidth: isMobile && !isChatMode ? 'calc(100vw - 24px)' : undefined,
                        backgroundColor: promptGlassFill,
                        boxShadow: shellCardShadow,
                        transform: promptCardTransform,
                        transformOrigin: '50% 100%',
                        zIndex: cardSurfaceZIndex,
                        transitionDuration: isDragging ? '0ms' : 'var(--duration-normal)',
                        transitionProperty: 'transform, box-shadow, border-color',
                    }}
                >
                    {onConnectStart && !isChatMode && (
                        <div
                            className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-7 h-7 flex items-center justify-center z-50 cursor-crosshair group/connector"
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onConnectStart(node.id, {
                                    x: node.position.x,
                                    y: node.position.y,
                                });
                            }}
                            title="拖拽连线"
                        >
                            {/* Inner Dot and Outer Pulsing Glow */}
                            <div className="w-2.5 h-2.5 rounded-full bg-[var(--connector-color,#6366f1)] border border-white/20 transition-all duration-300 shadow-[0_0_8px_rgba(99,102,241,0.5)] group-hover/connector:scale-125 group-hover/connector:bg-[var(--accent-coral,#ef4444)] group-hover/connector:shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
                            <div className="absolute inset-0 rounded-full border border-[var(--connector-color,#6366f1)] opacity-0 scale-50 group-hover/connector:scale-100 group-hover/connector:opacity-30 group-hover/connector:animate-pulse transition-all duration-300" />
                        </div>
                    )}

                    <div className={`flex items-center justify-between gap-2 border-b border-[var(--frost-card-main-border)] ${isThumbnailShell ? 'px-3 py-2' : 'px-4 py-2.5'}`}>
                        {isEcommerceFrameworkCard ? (
                            renderEcommerceFrameworkHeaderContent(true)
                        ) : (
                            <>
                                <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium ${shellStatusTone}`}>
                                    {showError ? (
                                        <AlertTriangle size={12} />
                                    ) : node.isGenerating ? (
                                        <Loader2 size={12} className="animate-spin" />
                                    ) : node.mode === GenerationMode.VIDEO ? (
                                        <Video size={12} />
                                    ) : node.mode === GenerationMode.AUDIO ? (
                                        <Music size={12} />
                                    ) : (
                                        <Sparkles size={12} />
                                    )}
                                    <span className="truncate">
                                        {showError ? getPromptFailureLabel(node) : node.isGenerating ? '生成中' : `${renderedSuccessCount || 0} 个结果`}
                                    </span>
                                </div>
                                <div className="text-[11px] text-[var(--text-tertiary)] shrink-0">
                                    {node.aspectRatio}{node.execTime ? ` · ${node.execTime.toFixed(1)}s` : ''}
                                </div>
                            </>
                        )}
                    </div>

                    <div
                        className={isThumbnailShell ? 'p-3 flex flex-col gap-3' : 'p-4 flex flex-col gap-3'}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (hasMoved.current) return;
                            onClickPrompt?.(node, activeTab === 'opt');
                        }}
                    >
                        {/* 🚀 [LOD 优化] 当处于超小缩放的 thumbnail-shell 模式时，不再渲染参考小图，减少 DOM 深度与图片加载开销 */}
                        {!isThumbnailShell && shellReferenceImages.length > 0 && (
                            <div className="flex gap-2">
                                {shellReferenceImages.map((img, index) => {
                                    const thumbSrc = img.data || img.url || '';
                                    return (
                                        <div
                                            key={img.id || index}
                                            className="w-14 h-14 rounded-xl overflow-hidden border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] shrink-0"
                                        >
                                            {thumbSrc ? (
                                                <img
                                                    src={thumbSrc}
                                                    alt="Reference"
                                                    className="w-full h-full object-cover"
                                                    draggable={false}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[var(--text-tertiary)]">
                                                    <Image size={14} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="space-y-2">
                                                        {/* 🚀 [LOD 优化] 当处于超小缩放的 thumbnail-shell 模式时，改用静态字符截短，规避 -webkit-line-clamp 排版开销 */}
                            {isThumbnailShell ? (
                                <div className="text-[13px] leading-5 font-medium text-[var(--text-primary)]">
                                    {truncateByChars(shellPreviewText || '输入提示词...', 36)}
                                </div>
                            ) : (
                                <div
                                    className="text-[14px] leading-6 font-medium text-[var(--text-primary)]"
                                    style={{
                                        display: '-webkit-box',
                                        WebkitLineClamp: 4,
                                        WebkitBoxOrient: 'vertical' as any,
                                        overflow: 'hidden',
                                    }}
                                >
                                    {shellPreviewText || '输入提示词...'}
                                </div>
                            )}

                            {!isThumbnailShell && node.tags && node.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {node.tags.slice(0, 3).map((tag) => {
                                        const colors = generateTagColor(tag);
                                        return (
                                            <span
                                                key={tag}
                                                className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
                                                style={{
                                                    backgroundColor: colors.bg,
                                                    color: colors.text,
                                                    borderColor: colors.border,
                                                }}
                                            >
                                                {truncateByChars(tag, 8)}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CanvasCardShell>
        );
    }

    return (
        <CanvasCardShell
            ref={containerRef}
            id={node.id}
            domId={`prompt-card-${node.id}`}
            position={{
                x: renderLeft + cardWidth / 2 - activeOriginX,
                y: renderTop + cardHeight - activeOriginY,
            }}
            origin={{ x: activeOriginX, y: activeOriginY }}
            presentation={shellPresentation}
            width={cardWidth}
            height={cardHeight}
            zIndex={effectiveStackZIndex}
            selected={isSelected}
            detailLevel={detailLevel}
            positioning={isChatMode ? 'flow' : 'world'}
            surface={false}
            renderDetailPlaceholder={false}
            data-x={node.position.x}
            data-y={node.position.y}
            className={`prompt-node ${isChatMode ? 'w-full max-w-[460px] mx-auto my-3' : ''} flex flex-col items-center group antialiased select-none ${node.isNew && !canvasTransform && !isChatMode ? 'is-new' : ''}`}
            style={isChatMode ? {
                opacity: 1,
            } : {
                zIndex: effectiveStackZIndex,
                opacity: 1,
                cursor: isDragging ? 'grabbing' : 'grab',
                willChange: isDragging ? 'left, top' : 'auto',
                transition: isDragging ? 'none' : 'opacity 125ms var(--kk-motion-ease-standard)',
                pointerEvents: 'auto',
                touchAction: 'none'
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
        >
            {/* Main Content Card */}
            <div
                ref={cardRef}
                data-canvas-surface="prompt"
                data-card-v3-kind={canvasV3ViewModel.kind}
                data-card-v3-status={canvasV3ViewModel.status}
                data-selected={isSelected || undefined}
                className="kk-canvas-v3-adapted-card relative flex flex-col rounded-2xl border border-[var(--frost-card-main-border)] transition-all"
                style={{
                    width: isChatMode ? '100%' : cardWidth,
                    maxWidth: isMobile && !isChatMode ? 'calc(100vw - 24px)' : undefined,
                    backgroundColor: promptGlassFill,
                    boxShadow: mainCardShadow,
                    transform: promptCardTransform,
                    transformOrigin: '50% 100%',
                    zIndex: cardSurfaceZIndex,
                    transitionDuration: isDragging ? '0ms' : 'var(--duration-normal)',
                    transitionProperty: 'transform, box-shadow, border-color',
                }}
            >
                {/* 🚀 [NEW] Connection Point - Bottom Center */}
                {onConnectStart && !isChatMode && (
                    <div
                            className="kk-canvas-v3-port kk-canvas-v3-port--output absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-transparent hover:bg-[rgba(255,77,139,0.22)] rounded-full z-50 cursor-crosshair transition-colors"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            // Calculate start position in canvas coordinates
                            const rect = cardRef.current?.getBoundingClientRect();
                            if (rect) {
                                const startPos = {
                                    x: node.position.x,
                                    y: node.position.y
                                };
                                onConnectStart(node.id, startPos);
                            }
                        }}
                        title="拖拽连线"
                    />
                )}
                {/* Header (Status & Actions) */}
                <div className="kk-canvas-v3-prompt-header flex items-center justify-between px-4 py-3 w-full" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', ...secondaryTextRenderStyle }}>
                    {/* Left: Status Icon and Text */}
                    <div className="flex flex-1 items-center gap-2 min-w-0">
                        {isEcommerceFrameworkCard ? (
                            renderEcommerceFrameworkHeaderContent()
                        ) : showError ? (
                            <>
                                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-red-500/15">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="8" x2="12" y2="12"></line>
                                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                    </svg>
                                </div>
                                <span className="text-[13px] font-medium tracking-wide truncate text-red-500" title={node.error}>
                                    {getPromptFailureLabel(node)}
                                </span>
                            </>
                        ) : node.isGenerating ? (
                            <>
                                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-[rgba(255,77,139,0.12)]">
                                    <Sparkles size={12} className="text-[var(--clay-brand-pink)] animate-pulse" />
                                </div>
                                <span className="text-[13px] font-medium tracking-wide truncate text-[var(--clay-brand-pink)]">
                                    正在生成 {node.parallelCount || 1} 张
                                </span>
                            </>
                        ) : (
                            <>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-amber-500/10`}>
                                    <Sparkles size={12} className="text-amber-400" />
                                </div>
                                <span className="text-[13px] font-medium tracking-wide truncate">
                                    {renderedSuccessCount > 0 ? (
                                        <span className="text-[var(--text-secondary)]">
                                            {renderedFailCount > 0
                                                ? `成功 ${renderedSuccessCount} 张，失败 ${renderedFailCount} 张`
                                                : `已生成 ${renderedSuccessCount} 张`}
                                        </span>
                                    ) : (
                                        <span className="text-[var(--text-tertiary)]">
                                            {node.isDraft && !node.originalPrompt && !node.prompt ? '输入提示词...' : (node as any).title || node.id.slice(0, 8) + '...'}
                                        </span>
                                    )}
                                </span>
                            </>
                        )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                        {showError && onRetry && (
                            <button
                                type="button"
                                className="inline-flex h-8 items-center gap-1 rounded-md border border-red-400/30 px-2 text-[11px] text-red-300 hover:bg-red-500/10"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onRetry(node);
                                }}
                                aria-label="Retry failed card"
                                title="Retry failed card"
                            >
                                <Sparkles size={12} />
                                Retry
                            </button>
                        )}
                        {!node.isGenerating && renderedSuccessCount > 0 && (
                            <div
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-[var(--border-light)] bg-[var(--bg-tertiary)] text-[10px] text-[var(--text-secondary)] font-medium shrink-0 select-none"
                                title={`共生成了 ${renderedSuccessCount} 张图片`}
                            >
                                <Image size={10} className="opacity-70" />
                                <span>{renderedSuccessCount}张</span>
                            </div>
                        )}
                        {node.mode === GenerationMode.ECOMMERCE && node.ecommerce?.kind === 'a-plus-group' && onExportEcommerceGroup && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onExportEcommerceGroup(node);
                                }}
                                aria-label={node.ecommerce.sourceSheet === '主图' ? '打包主图' : '打包A+'}
                                className="inline-flex items-center gap-1 rounded-md border border-[rgba(26,58,58,0.30)] bg-[rgba(26,58,58,0.10)] px-2 py-1 text-[10px] font-bold text-[var(--clay-brand-teal)] transition-all hover:bg-[rgba(26,58,58,0.16)]"
                                title={node.ecommerce.sourceSheet === '主图' ? '打包主图' : '打包A+'}
                            >
                                <Download size={10} />
                                <span>{node.ecommerce.sourceSheet === '主图' ? '打包主图' : '打包A+'}</span>
                            </button>
                        )}
                        {node.mode === GenerationMode.ECOMMERCE && node.ecommerce && onToggleEcommerceSelected && node.ecommerce.kind !== 'a-plus-group' && node.ecommerce.kind !== 'framework' && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleEcommerceSelected(node, node.ecommerce?.selectedForGeneration === false);
                                }}
                                aria-label={node.ecommerce.selectedForGeneration === false ? '确认生成' : '取消确认生成'}
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold transition-all ${
                                    node.ecommerce.selectedForGeneration === false
                                        ? 'border-[var(--frost-card-sub-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--clay-brand-pink)]'
                                        : 'border-[rgba(255,77,139,0.28)] bg-[rgba(255,77,139,0.10)] text-[var(--clay-brand-pink)] hover:bg-[rgba(255,77,139,0.16)]'
                                }`}
                                title={node.ecommerce.selectedForGeneration === false ? '确认生成' : '取消确认'}
                            >
                                <CheckCircle2 size={10} />
                                <span>{node.ecommerce.selectedForGeneration === false ? '确认生成' : '取消确认'}</span>
                            </button>
                        )}
                        {/* 提示词编译器 Tab 切换 */}
                        {(node.promptOptimizerResult || node.optimizedPromptEn) && (
                            <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5 border border-[var(--border-light)] ml-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setActiveTab('raw'); }}
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${activeTab === 'raw'
                                        ? 'bg-[var(--bg-overlay)] text-[var(--text-primary)] shadow-sm'
                                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                                        }`}
                                >
                                    原文
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setActiveTab('opt'); }}
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all ${activeTab === 'opt'
                                        ? 'bg-[rgba(255,77,139,0.12)] text-[var(--clay-brand-pink)] shadow-sm'
                                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                                        }`}
                                >
                                    <Sparkles size={8} />
                                    优化
                                </button>
                            </div>
                        )}



                        {/* Delete Button */}
                        {onDelete && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(node.id);
                                }}
                                className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                title="删除提示词"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {node.mode === GenerationMode.ECOMMERCE
                    && node.ecommerce
                    && node.ecommerce.kind !== 'a-plus-group'
                    && node.ecommerce.kind !== 'framework'
                    && ecommerceSlotState
                    && (ecommerceSlotState.currentImageId || ecommerceSlotState.history.length > 1) ? (
                    <div
                        className="mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-3 py-2"
                        data-testid="ecommerce-slot-version-surface"
                    >
                        <span className="rounded-full border border-[var(--border-light)] px-2 py-1 text-[10px] text-[var(--text-secondary)]">
                            当前版本 {ecommerceSlotState.currentSource === 'redraw' ? '重绘版' : ecommerceSlotState.currentSource === 'generated' ? '生成版' : '未生成'}
                        </span>
                        {onPreviewEcommerceSlotHistory && ecommerceSlotState.currentImageId ? (
                            <button
                                type="button"
                                className="rounded-md border border-[var(--frost-card-sub-border)] px-2 py-1 text-[10px] text-[var(--text-primary)] transition-colors hover:border-[var(--clay-brand-pink)] hover:text-[var(--clay-brand-pink)]"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPreviewEcommerceSlotHistory(node, ecommerceSlotState.currentImageId || undefined);
                                }}
                            >
                                打开当前版本
                            </button>
                        ) : null}
                        {onPreviewEcommerceSlotHistory && ecommerceSlotState.history.length > 1 ? (
                            <button
                                type="button"
                                className="rounded-md border border-[var(--frost-card-sub-border)] px-2 py-1 text-[10px] text-[var(--text-secondary)] transition-colors hover:border-[var(--clay-brand-pink)] hover:text-[var(--clay-brand-pink)]"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPreviewEcommerceSlotHistory(node);
                                }}
                            >
                                查看历史版本 {ecommerceSlotState.history.length - 1}
                            </button>
                        ) : null}
                    </div>
                ) : null}

                {/* Content Padding Wrapper */}
                <div className={ecommerceFrameworkCardClassName}>
                    {isEcommerceFrameworkCard ? (
                        <div data-testid="ecommerce-canvas-framework-workbench">
                        <React.Suspense
                            fallback={(
                                <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-3 py-4 text-center text-xs text-[var(--text-secondary)]">
                                    Loading...
                                </div>
                            )}
                        >
                            <EcommerceCanvasWorkbenchCard
                                node={node} onDeleteTask={onDelete ? (taskNode) => onDelete(taskNode.id) : undefined}
                                taskNodes={ecommerceFrameworkTaskNodes}
                                activeTaskState={activeEcommerceTaskState}
                                frameworkStatus={ecommerceFrameworkStatus}
                                onActivateTask={onActivateEcommerceTask}
                                onTaskStateChange={onEcommerceTaskStateChange}
                                onToggleSelected={onToggleEcommerceSelected}
                                onGenerateNode={onGenerateEcommerceNode}
                                onOptimizeTaskPrompt={onOptimizeEcommerceTaskPrompt}
                                onRegenerateUnsatisfied={onRegenerateUnsatisfiedEcommerceNode}
                                onGenerateFramework={onGenerateEcommerceFramework}
                                onPauseFramework={onPauseEcommerceFramework}
                                onResumeFramework={onResumeEcommerceFramework}
                                onPauseNodeQueue={onPauseEcommerceNodeQueue}
                                onResumeNodeQueue={onResumeEcommerceNodeQueue}
                                onSetFrameworkConcurrency={onSetEcommerceFrameworkConcurrency}
                                onCancelNodeQueue={onCancelEcommerceNodeQueue}
                                onConfirmDesktop={onConfirmEcommerceDesktop}
                                onGenerateMobile={onRetryEcommerceModule}
                            />
                        </React.Suspense>
                        </div>
                    ) : (
                    <>
                    {/* Reference Images Thumbnails */}
                    {node.referenceImages && node.referenceImages.length > 0 && (
                        <div className="flex gap-1 mb-2 flex-wrap">
                            {node.referenceImages.slice(0, 4).map((img, idx) => (
                                <ReferenceThumbnail
                                    key={img.id || idx}
                                    image={img}
                                    label={getEcommerceAssetPreviewLabel(node.ecommerce?.editableTask?.assetRoles?.[idx])}
                                    onClick={(e) => {
                                        const refThumb = e.currentTarget.querySelector('img');
                                        if (refThumb) {
                                            const rect = refThumb.getBoundingClientRect();
                                            const src = refThumb.src; // Use the rendered src (which is resolved)
                                            setPreviewImage({ url: src, originRect: rect });
                                        }
                                    }}
                                />
                            ))}
                            {node.referenceImages.length > 4 && (
                                <div className="w-10 h-10 rounded border border-[var(--border-light)] bg-[var(--bg-tertiary)] flex items-center justify-center text-xs text-[var(--text-secondary)]">
                                    +{node.referenceImages.length - 4}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Prompt Text Area - 画布主卡禁用文本选择，避免拖拽时误选中文案 */}
                    <div
                        className={`kk-canvas-v3-prompt-copy relative text-[var(--text-primary)] text-[13px] leading-5 font-normal tracking-wide overflow-y-auto max-h-[144px] custom-scrollbar pr-1 group/content ${isChatMode ? 'select-text cursor-text' : 'select-none'}`}
                        style={primaryTextRenderStyle}
                        onWheel={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (hasMoved.current) return;
                            const sel = document.getSelection();
                            if (sel && sel.toString().length > 0) return;
                            if (onClickPrompt) onClickPrompt(node, activeTab === 'opt');
                        }}
                    >
                        {activeTab === 'opt' && (node.optimizedPromptEn || node.promptOptimizerResult) ? (
                            <div className="flex flex-col gap-3 py-1 relative">
                                {/* Task Type Badge (if available) */}
                                {node.promptOptimizerResult?.params?.task_type && (
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="px-1.5 py-0.5 rounded bg-[rgba(255,77,139,0.10)] text-[var(--clay-brand-pink)] text-[9px] font-bold uppercase tracking-wider border border-[rgba(255,77,139,0.20)]">
                                            {node.promptOptimizerResult.params.task_type.replace('_', ' ')}
                                        </div>
                                        {node.promptOptimizerResult?.params?.aspect_ratio && (
                                            <div className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] text-[9px] font-bold border border-[var(--border-light)]">
                                                {node.promptOptimizerResult.params.aspect_ratio}
                                            </div>
                                        )}
                                        {String(node.promptOptimizerResult?.meta?.route_title || '').trim() && (
                                        <div className="px-1.5 py-0.5 rounded bg-[rgba(26,58,58,0.10)] text-[var(--clay-brand-teal)] text-[9px] font-bold border border-[rgba(26,58,58,0.20)]">
                                                自动策略 · {
                                                    String(node.promptOptimizerResult?.meta?.route_title || '').trim()
                                                }
                                            </div>
                                        )}
                                        {getPromptOptimizerEngineLabelZh(node) && (
                                            <div className="px-1.5 py-0.5 rounded bg-[rgba(129,140,248,0.10)] text-[var(--clay-brand-lavender)] text-[9px] font-bold border border-[rgba(129,140,248,0.20)]">
                                                {getPromptOptimizerEngineLabelZh(node)}
                                            </div>
                                        )}
                                        {getPromptOptimizerAiStatusLabelZh(node) && (
                                            <div className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] text-[9px] font-bold border border-[var(--border-light)]">
                                                {getPromptOptimizerAiStatusLabelZh(node)}
                                            </div>
                                        )}
                                        {node.promptOptimizerResult?.confidence && (
                                            <div className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] text-[9px] font-bold border border-[var(--border-light)]">
                                                {node.promptOptimizerResult.confidence}
                                            </div>
                                        )}
                                        {node.promptOptimizerResult?.meta?.strategy && (
                                        <div className="px-1.5 py-0.5 rounded bg-[rgba(255,176,132,0.10)] text-[var(--clay-brand-peach)] text-[9px] font-bold border border-[rgba(255,176,132,0.20)]">
                                                {node.promptOptimizerResult.meta.strategy}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* English - Professional Structure */}
                                <div className="relative group/en">
                                    <div className="text-[14px] leading-relaxed text-[var(--text-primary)] font-medium tracking-tight font-serif-ui whitespace-pre-wrap selection:bg-[rgba(255,77,139,0.24)] pr-8">
                                        {node.optimizedPromptEn || node.promptOptimizerResult?.optimized_prompt_en}
                                    </div>
                                    <button
                                        className="absolute top-0 right-0 p-1.5 rounded-md bg-[var(--frost-card-sub-bg)] border border-[var(--frost-card-sub-border)] text-[var(--text-tertiary)] hover:text-[var(--clay-brand-pink)] hover:border-[var(--clay-brand-pink)] opacity-0 group-hover/content:opacity-100 transition-all shadow-sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const text = node.optimizedPromptEn || node.promptOptimizerResult?.optimized_prompt_en || '';
                                            void writeTextToClipboard(text)
                                                .then(() => {
                                                    setCopyStatus('en');
                                                    setTimeout(() => setCopyStatus('idle'), 2000);
                                                })
                                                .catch((error) => {
                                                    console.error('[PromptNodeComponent] Copy English prompt failed:', error);
                                                    notify.warning('复制失败', '当前环境无法复制英文提示词。');
                                                });
                                        }}
                                        title="复制英文提示词"
                                    >
                                        {copyStatus === 'en' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                    </button>
                                </div>

                                {/* Divider with Icon */}
                                <div className="flex items-center gap-2 opacity-20 my-1">
                                    <div className="h-px flex-1 bg-current"></div>
                                    <Languages size={10} />
                                    <div className="h-px flex-1 bg-current"></div>
                                </div>

                                {/* Chinese - User Friendly Explanation */}
                                <div className="relative group/zh">
                                    <div className="text-[12px] leading-6 text-[var(--text-secondary)] font-normal italic opacity-90 whitespace-pre-wrap selection:bg-amber-500/20 pr-8">
                                        {node.optimizedPromptZh || node.promptOptimizerResult?.optimized_prompt_zh_display || 'AI 正在解析您的创意...'}
                                    </div>
                                    <button
                                        className="absolute top-0 right-0 p-1.5 rounded-md bg-[var(--frost-card-sub-bg)] border border-[var(--frost-card-sub-border)] text-[var(--text-tertiary)] hover:text-[var(--clay-brand-peach)] hover:border-[var(--clay-brand-peach)] opacity-0 group-hover/content:opacity-100 transition-all shadow-sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const text = node.optimizedPromptZh || node.promptOptimizerResult?.optimized_prompt_zh_display || '';
                                            void writeTextToClipboard(text)
                                                .then(() => {
                                                    setCopyStatus('zh');
                                                    setTimeout(() => setCopyStatus('idle'), 2000);
                                                })
                                                .catch((error) => {
                                                    console.error('[PromptNodeComponent] Copy Chinese prompt failed:', error);
                                                    notify.warning('复制失败', '当前环境无法复制中文提示词。');
                                                });
                                        }}
                                        title="复制中文注释"
                                    >
                                        {copyStatus === 'zh' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                    </button>
                                </div>

                                {/* Assumptions / Tips */}
                                {getOptimizerStrategySummaryZh(node) && (
                                    <div className="mt-2 p-2 rounded-lg bg-[rgba(255,176,132,0.05)] border border-[rgba(255,176,132,0.15)]">
                                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--clay-brand-peach)]/90 mb-2">
                                            <Sparkles size={12} />
                                            <span>自动策略说明</span>
                                        </div>
                                        <div className="text-[10px] text-[var(--clay-brand-lavender)] leading-normal">
                                            {getOptimizerStrategySummaryZh(node)}
                                        </div>
                                    </div>
                                )}

                                {(node.promptOptimizerResult?.assumptions || []).length > 0 && (
                                    <div className="mt-2 flex items-start gap-2 p-2 rounded-lg bg-[rgba(255,77,139,0.05)] border border-[rgba(255,77,139,0.10)]">
                                        <Info size={12} className="text-[var(--clay-brand-pink)] mt-0.5 shrink-0" />
                                        <div className="space-y-1 text-[10px] text-[var(--clay-brand-pink)]/80 leading-normal">
                                            {(node.promptOptimizerResult?.assumptions || []).map((assumption, index) => (
                                                <div key={`assumption-${index}`}>{assumption}</div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(node.promptOptimizerResult?.negative_constraints || []).length > 0 && (
                                    <div className="mt-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
                                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-300/90 mb-2">
                                            <Shield size={12} />
                                            <span>避免项</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(node.promptOptimizerResult?.negative_constraints || []).map((constraint, index) => (
                                                <span
                                                    key={`constraint-${index}`}
                                                    className="px-2 py-1 rounded-full text-[10px] border border-amber-500/20 bg-amber-500/10 text-amber-200/90"
                                                >
                                                    {constraint}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(node.promptOptimizerResult?.validation_checks || []).length > 0 && (
                                    <div className="mt-2 p-2 rounded-lg bg-[rgba(26,58,58,0.05)] border border-[rgba(26,58,58,0.15)]">
                                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--clay-brand-teal)]/90 mb-2">
                                            <CheckCircle2 size={12} />
                                            <span>校验清单</span>
                                        </div>
                                        <div className="space-y-1 text-[10px] text-emerald-100/80 leading-normal">
                                            {(node.promptOptimizerResult?.validation_checks || []).map((checkItem, index) => (
                                                <div key={`validation-${index}`}>{checkItem}</div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(node.promptOptimizerResult?.missing_inputs || []).length > 0 && (
                                    <div className="mt-2 p-2 rounded-lg bg-red-500/5 border border-red-500/15">
                                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-red-300/90 mb-2">
                                            <AlertTriangle size={12} />
                                            <span>建议补充（可选）</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(node.promptOptimizerResult?.missing_inputs || []).map((item, index) => (
                                                <span
                                                    key={`missing-${index}`}
                                                    className="px-2 py-1 rounded-full text-[10px] border border-red-500/20 bg-red-500/10 text-red-200/90"
                                                >
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-[15px] leading-7 text-[var(--text-primary)] font-normal selection:bg-[rgba(255,77,139,0.18)] pr-2">
                                {node.originalPrompt || node.prompt || (node.isDraft ? <span className="text-[var(--text-tertiary)] italic">输入提示词...</span> : '')}
                            </div>
                        )}

                        {node.ecommerce && getEcommerceBadges(node, activeEcommerceTaskState).length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {getEcommerceBadges(node, activeEcommerceTaskState).map((badge) => {
                                    const toneStyle = badge.tone === 'emerald'
                                        ? {
                                            background: 'rgba(16, 185, 129, 0.12)',
                                            borderColor: 'rgba(16, 185, 129, 0.28)',
                                            color: 'rgb(110, 231, 183)',
                                        }
                                        : badge.tone === 'neutral'
                                            ? {
                                                background: 'rgba(148, 163, 184, 0.10)',
                                                borderColor: 'rgba(148, 163, 184, 0.22)',
                                                color: 'rgb(203, 213, 225)',
                                            }
                                        : badge.tone === 'rose'
                                            ? {
                                                background: 'rgba(244, 63, 94, 0.12)',
                                                borderColor: 'rgba(244, 63, 94, 0.28)',
                                                color: 'rgb(253, 164, 175)',
                                            }
                                            : badge.tone === 'blue'
                                                ? {
                                                    background: 'var(--state-info-bg)',
                                                    borderColor: 'var(--state-info-border)',
                                                    color: 'var(--state-info-text)',
                                                }
                                                : {
                                                    background: 'rgba(245, 158, 11, 0.12)',
                                                    borderColor: 'rgba(245, 158, 11, 0.28)',
                                                    color: 'rgb(253, 224, 71)',
                                                };

                                    return (
                                        <span
                                            key={`${badge.label}-${badge.tone}`}
                                            className="rounded-full border px-2 py-1 text-[10px] font-medium"
                                            style={toneStyle}
                                        >
                                            {badge.label}
                                        </span>
                                    );
                                })}
                            </div>
                        ) : null}

                        {node.mode === GenerationMode.ECOMMERCE && node.ecommerce && onToggleEcommerceSelected && onGenerateEcommerceNode && onGenerateEcommerceGroup && onConfirmEcommerceDesktop && onRetryEcommerceModule && (
                            <EcommerceCardActions
                                node={node}
                                taskState={node.ecommerce.editableTask}
                                activeTaskState={activeEcommerceTaskState}
                                frameworkStatus={ecommerceFrameworkStatus}
                                onActivateTask={onActivateEcommerceTask}
                                onTaskStateChange={onEcommerceTaskStateChange}
                                onToggleSelected={onToggleEcommerceSelected}
                                onSetGroupSelection={onSetEcommerceGroupSelection}
                                onGenerateNode={onGenerateEcommerceNode}
                                onRegenerateUnsatisfied={onRegenerateUnsatisfiedEcommerceNode}
                                onGenerateGroup={onGenerateEcommerceGroup}
                                onGenerateFramework={onGenerateEcommerceFramework}
                                onPauseFramework={onPauseEcommerceFramework}
                                onResumeFramework={onResumeEcommerceFramework}
                                onPauseNodeQueue={onPauseEcommerceNodeQueue}
                                onResumeNodeQueue={onResumeEcommerceNodeQueue}
                                onSetFrameworkConcurrency={onSetEcommerceFrameworkConcurrency}
                                onCancelNodeQueue={onCancelEcommerceNodeQueue}
                                onConfirmDesktop={onConfirmEcommerceDesktop}
                                onGenerateMobile={onRetryEcommerceModule}
                            />
                        )}

                    </div>
                    </>
                    )}

                    {/* 错误详情面板已被移除 */}


                    {node.mode === GenerationMode.PPT && pptDeck && pptDeck.pageCount > 0 && (
                        <div
                            data-testid="ppt-deck-container"
                            className="mt-3 rounded-[18px] border p-3"
                            style={{ borderColor: 'var(--border-light)', backgroundColor: 'var(--bg-tertiary)', ...secondaryTextRenderStyle }}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">PPT 页面模块</div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <div className="min-w-0 truncate text-[13px] font-semibold text-[var(--text-primary)]">
                                            {pptDeck.title}
                                        </div>
                                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${getPptDeckStageTone(pptDeck.stage)}`}>
                                            {getPptDeckStageLabel(pptDeck.stage)}
                                        </span>
                                    </div>
                                    <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                                        {`${pptDeck.pageCount} 页 · ${pptReadyPageCount} 页已生成 · ${pptDeck.styleLocked ? '风格锁定' : '风格可变'}`}
                                    </div>
                                </div>
                                {pptDeck.lastThumbnailUrl ? (
                                    <img
                                        src={pptDeck.lastThumbnailUrl}
                                        alt="PPT deck preview"
                                        className="h-14 w-14 shrink-0 rounded-xl object-cover"
                                    />
                                ) : (
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-[var(--border-light)] text-[10px] text-[var(--text-tertiary)]">
                                        Deck
                                    </div>
                                )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {onEditPptDeck && !node.isGenerating && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEditPptDeck(node);
                                        }}
                                        className="px-2 py-1 rounded-md border text-[11px] leading-none bg-[rgba(26,58,58,0.10)] text-[var(--clay-brand-teal)] border-[rgba(26,58,58,0.30)] hover:bg-[rgba(26,58,58,0.16)]"
                                        title={pickByDocumentLanguage('编辑分层 PPT 内容', 'Edit layered PPT content')}
                                    >
                                        {pickByDocumentLanguage('编辑页面包', 'Edit Deck')}
                                    </button>
                                )}
                                {onExportPpt && pptReadyPageCount > 0 && !node.isGenerating && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onExportPpt(node);
                                        }}
                                        className="px-2 py-1 rounded-md border text-[11px] leading-none bg-[rgba(255,176,132,0.10)] text-[var(--clay-brand-peach)] border-[rgba(255,176,132,0.30)] hover:bg-[rgba(255,176,132,0.16)]"
                                        title="导出该 PPT 项目的页面包"
                                    >
                                        导出页面包
                                    </button>
                                )}
                                {onExportPptx && pptReadyPageCount > 0 && !node.isGenerating && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onExportPptx(node);
                                        }}
                                        className="px-2 py-1 rounded-md border text-[11px] leading-none bg-[rgba(255,77,139,0.10)] text-[var(--clay-brand-pink)] border-[rgba(255,77,139,0.30)] hover:bg-[rgba(255,77,139,0.16)]"
                                        title="导出 PPTX 文档"
                                    >
                                        导出 PPTX
                                    </button>
                                )}
                            </div>

                            <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                                {pptDeck.pages.map((page) => (
                                    <div
                                        key={`ppt-page-module-${page.pageIndex}`}
                                        className="rounded-xl border p-2.5"
                                        style={{ borderColor: 'var(--border-light)', backgroundColor: 'rgba(255,255,255,0.02)' }}
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full border border-[rgba(255,176,132,0.20)] bg-[rgba(255,176,132,0.10)] px-1.5 py-0.5 text-[9px] text-[var(--clay-brand-peach)]">
                                                        P{page.pageNumber}
                                                    </span>
                                                    <div className="min-w-0 truncate text-[11px] font-medium text-[var(--text-primary)]" title={page.title}>
                                                        {page.title}
                                                    </div>
                                                    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${getPptPageStatusTone(page.generationStatus)}`}>
                                                        {page.generationStatus === 'ready'
                                                            ? '已生成'
                                                            : page.generationStatus === 'generating'
                                                                ? '生成中'
                                                                : page.generationStatus === 'error'
                                                                    ? '异常'
                                                                    : page.generationStatus === 'queued'
                                                                        ? '排队中'
                                                                        : '待处理'}
                                                    </span>
                                                </div>
                                                <div className="mt-1 line-clamp-2 text-[10px] leading-5 text-[var(--text-secondary)]" title={page.pageDescription}>
                                                    {page.pageDescription}
                                                </div>
                                            </div>
                                            {page.thumbnailUrl ? (
                                                <img
                                                    src={page.thumbnailUrl}
                                                    alt={page.title}
                                                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--border-light)] text-[9px] text-[var(--text-tertiary)]">
                                                    暂无
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {onRetryPptPage && (
                                                <button
                                                    className="px-1.5 py-0.5 rounded border text-[10px] border-[var(--frost-card-sub-border)] text-[var(--text-secondary)] hover:bg-[var(--frost-card-sub-bg)]"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onRetryPptPage(node, page.pageIndex);
                                                    }}
                                                    title={`重生第 ${page.pageNumber} 页`}
                                                >
                                                    单页重生
                                                </button>
                                            )}
                                            {onExportPptPage && page.imageId && (
                                                <button
                                                    className="px-1.5 py-0.5 rounded border text-[10px] border-[rgba(255,77,139,0.28)] text-[var(--clay-brand-pink)] hover:bg-[rgba(255,77,139,0.10)]"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onExportPptPage(node, page.pageIndex);
                                                    }}
                                                    title={`导出第 ${page.pageNumber} 页`}
                                                >
                                                    导出单页
                                                </button>
                                            )}
                                            {onEditPptDeck && (
                                                <button
                                                    className="px-1.5 py-0.5 rounded border text-[10px] border-[rgba(26,58,58,0.30)] text-[var(--clay-brand-teal)] hover:bg-[rgba(26,58,58,0.10)]"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEditPptDeck(node);
                                                    }}
                                                    title={`编辑第 ${page.pageNumber} 页所在页面包`}
                                                >
                                                    编辑页面包
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {shellKind === 'text' && (
                        <div className="mx-3 mt-3 flex flex-wrap gap-2 rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] p-2">
                            <button
                                type="button"
                                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border-light)] px-2.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    void writeTextToClipboard(node.prompt).then(
                                        () => notify.success('Copied', 'Text card copied to clipboard.'),
                                        () => notify.error('Copy failed', 'Clipboard access is unavailable.'),
                                    );
                                }}
                                title="Copy text"
                            >
                                <Copy size={13} />
                                Copy
                            </button>
                            <button
                                type="button"
                                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border-light)] px-2.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onClickPrompt?.(node, false);
                                }}
                                title="Edit or use as prompt"
                            >
                                <Pencil size={13} />
                                Edit / Prompt
                            </button>
                            {onUseAsAiContext && (
                                <button
                                    type="button"
                                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border-light)] px-2.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onUseAsAiContext(node);
                                    }}
                                    title="Use as AI context"
                                >
                                    <Bot size={13} />
                                    AI Context
                                </button>
                            )}
                        </div>
                    )}

                    {/* 🚀 Main Card Tags: Centered Layout with Hover Blur + X Delete */}
                    {node.tags && node.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3 mb-1 px-2 w-full box-border justify-center" style={secondaryTextRenderStyle}>
                            {node.tags.slice(0, 8).map(tag => {
                                const colors = generateTagColor(tag);
                                return (
                                    <div
                                        key={tag}
                                        className="relative group/tag flex items-center justify-center px-3 py-1 text-xs font-medium rounded-lg border transition-all cursor-default select-none overflow-hidden"
                                        style={{
                                            backgroundColor: colors.bg,
                                            color: colors.text,
                                            borderColor: colors.border,
                                            minHeight: '24px' // Consistent height
                                        }}
                                    >
                                        {/* Tag Text - Blurs on hover */}
                                        <span className="whitespace-nowrap transition-all duration-200 group-hover/tag:blur-sm group-hover/tag:opacity-30">#{tag}</span>

                                        {/* Delete Button - Centered, visible on hover */}
                                        {onRemoveTag && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRemoveTag(node.id, tag);
                                                }}
                                                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/tag:opacity-100 transition-all duration-200"
                                                title="移除标签"
                                            >
                                                <div className="w-5 h-5 flex items-center justify-center rounded-full bg-red-500/90 text-white shadow-sm">
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="18" y1="6" x2="6" y2="18" />
                                                        <line x1="6" y1="6" x2="18" y2="18" />
                                                    </svg>
                                                </div>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Loading Placeholders - 2x2 Grid Layout with Shimmer */}
                    {/* 🚀 Generating Overlay - Simple & Focused */}
                    {node.isGenerating && !showError && (() => {
                        // 🚀 [Fix] Force count to at least 1 if undefined, ensuring placeholders appear
                        const count = node.parallelCount || 1;
                        const COLS = node.mode === GenerationMode.PPT ? 1 : 2; // PPT副卡较长，默认单列
                        const GAP = node.mode === GenerationMode.PPT ? 28 : 20;
                        const gapToPlaceholders = 80;

                        // 🚀 [Fix] Auto Aspect Ratio Resolution
                        // If ratio is AUTO, try to infer from reference image, otherwise default to SQUARE
                        let resolvedRatio = node.aspectRatio;
                        if (resolvedRatio === AspectRatio.AUTO && node.referenceImages && node.referenceImages.length > 0) {
                            // If they HAVE refs, 1:1 is also safe-ish but might be wrong.
                            // Note: Better auto-detection would require reading actual image dimensions
                            // from the reference image metadata. Currently defaults to SQUARE as the safest
                            // generic shape to avoid layout jumping when actual generation result has different ratio.
                            resolvedRatio = AspectRatio.SQUARE;
                        }

                        // Actually, if it IS auto, let's just use Square for now as it's the safest generic shape.
                        // The user issue "frame and image different ratio" likely means they uploaded a 16:9 image,
                        // selected "Auto", got a Square placeholder, and then the result was 16:9.
                        // To fix the "jumping" effect, we should ideally know the target ratio.
                        // Without it, Square is the best we can do.
                        // UNLESS we check if the user selected a specific model that enforces a ratio?

                        const { width: w, totalHeight: h } = getCardDimensions(resolvedRatio, true);
                        const rows = Math.ceil(count / COLS);
                        const totalPlaceholderHeight = gapToPlaceholders + rows * (h + GAP);

                        if (isChatMode) {
                            return (
                                <div className="mobile-generating-stack">
                                    {Array.from({ length: count }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="mobile-generating-stack__card"
                                            style={{
                                                minHeight: h,
                                                zIndex: count - i,
                                                marginTop: i === 0 ? 0 : -Math.min(h * 0.72, 108),
                                                transform: `translateX(${Math.min(i * 6, 18)}px) scale(${Math.max(0.92, 1 - i * 0.025)})`
                                            }}
                                        >
                                            <div className="mobile-generating-stack__card-sheen" />
                                            <div className="mobile-generating-stack__card-grid" />

                                            <div className="absolute inset-x-0 top-4 flex items-center justify-between gap-3 px-4">
                                                <span className="mobile-generating-stack__badge">生成中 {i + 1}/{count}</span>
                                                <span className="mobile-generating-stack__hint">
                                                    {getPromptBusinessDisplayLabel(node) || `${node.aspectRatio || '1:1'} · ${node.mode === GenerationMode.PPT ? 'PPT' : node.imageSize || '1K'}`}
                                                </span>
                                            </div>

                                            <div className="absolute inset-x-0 bottom-4 flex items-center justify-between gap-3 px-4">
                                                <span className="mobile-generating-stack__status">
                                                    {i === 0 ? '正在为这组卡片生成结果' : '等待上一张完成后继续'}
                                                </span>
                                                {i === 0 ? (
                                                    <GenerationTimer
                                                        start={timerStartRef.current}
                                                        onTimeout={() => onCancel && onCancel(node.id)}
                                                    />
                                                ) : (
                                                    <span className="mobile-generating-stack__hint">AI Queue</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        }

                        return (
                            <div
                                className="absolute w-full"
                                style={{
                                    top: '100%',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    height: totalPlaceholderHeight
                                }}
                            >
                                {Array.from({ length: count }).map((_, i) => {
                                    const col = i % COLS;
                                    const row = Math.floor(i / COLS);
                                    const cardsInCurrentRow = Math.min(COLS, count - row * COLS);
                                    const rowWidth = cardsInCurrentRow * w + (cardsInCurrentRow - 1) * GAP;
                                    const startX = -rowWidth / 2;
                                    const offsetX = startX + col * (w + GAP) + w / 2;
                                    const offsetY = gapToPlaceholders + row * (h + GAP);

                                    return (
                                        <React.Fragment key={i}>
                                            {/* 能量流动线 */}
                                            <svg
                                                className="kk-canvas-prompt-node-energy-trail pointer-events-none"
                                            >
                                                <defs>
                                                    {/* 发光滤镜 - Scoped ID */}
                                                    <filter id={`energy-trail-${node.id}-${i}`} x="-50%" y="-50%" width="200%" height="200%">
                                                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                                        <feMerge>
                                                            <feMergeNode in="coloredBlur" />
                                                            <feMergeNode in="SourceGraphic" />
                                                        </feMerge>
                                                    </filter>

                                                    {/* 能量流动渐变 - Scoped ID */}
                                                    <linearGradient id={`energy-gradient-${node.id}-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                        <stop offset="0%" stopColor="var(--kk-canvas-prompt-node-energy-stop-start)" stopOpacity="0">
                                                            <animate attributeName="offset" values="0;0.3;0" dur="1.5s" repeatCount="indefinite" />
                                                        </stop>
                                                        <stop offset="30%" stopColor="var(--kk-canvas-prompt-node-energy-stop-mid)" stopOpacity="1">
                                                            <animate attributeName="offset" values="0.3;0.7;0.3" dur="1.5s" repeatCount="indefinite" />
                                                        </stop>
                                                        <stop offset="60%" stopColor="var(--kk-canvas-prompt-node-energy-stop-warm)" stopOpacity="0.8">
                                                            <animate attributeName="offset" values="0.6;1;0.6" dur="1.5s" repeatCount="indefinite" />
                                                        </stop>
                                                        <stop offset="100%" stopColor="var(--kk-canvas-prompt-node-energy-stop-end)" stopOpacity="0" />
                                                    </linearGradient>
                                                </defs>

                                                {/* 外发光层 */}
                                                <path
                                                    d={`M0,0 C0,${offsetY * 0.5} ${offsetX},${offsetY * 0.5} ${offsetX},${offsetY}`}
                                                    fill="none"
                                                    stroke="var(--kk-canvas-prompt-node-energy-trail-stroke)"
                                                    strokeWidth="8"
                                                    opacity="0.1"
                                                    filter={`url(#energy-trail-${node.id}-${i})`}
                                                />

                                                {/* 基础线条(脉冲效果) */}
                                                <path
                                                    d={`M0,0 C0,${offsetY * 0.5} ${offsetX},${offsetY * 0.5} ${offsetX},${offsetY}`}
                                                    fill="none"
                                                    stroke="var(--kk-canvas-prompt-node-energy-base-stroke)"
                                                    strokeWidth="2"
                                                    opacity="0.3"
                                                >
                                                    <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2s" repeatCount="indefinite" />
                                                </path>

                                                {/* 能量流动线 */}
                                                <path
                                                    d={`M0,0 C0,${offsetY * 0.5} ${offsetX},${offsetY * 0.5} ${offsetX},${offsetY}`}
                                                    fill="none"
                                                    stroke={`url(#energy-gradient-${node.id}-${i})`}
                                                    strokeWidth="4"
                                                    strokeLinecap="round"
                                                    filter={`url(#energy-trail-${node.id}-${i})`}
                                                />

                                                {/* 能量粒子1 - 快速 */}
                                                <circle r="4" fill="var(--kk-canvas-prompt-node-energy-stop-start)" opacity="0" filter={`url(#energy-trail-${node.id}-${i})`}>
                                                    <animateMotion
                                                        dur="1.5s"
                                                        repeatCount="indefinite"
                                                        path={`M0,0 C0,${offsetY * 0.5} ${offsetX},${offsetY * 0.5} ${offsetX},${offsetY}`}
                                                    />
                                                    <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" />
                                                    <animate attributeName="r" values="2;4;2" dur="1.5s" repeatCount="indefinite" />
                                                </circle>

                                                {/* 能量粒子2 - 中速 */}
                                                <circle r="3" fill="var(--kk-canvas-prompt-node-energy-stop-mid)" opacity="0" filter={`url(#energy-trail-${node.id}-${i})`}>
                                                    <animateMotion
                                                        dur="1.8s"
                                                        repeatCount="indefinite"
                                                        begin="0.3s"
                                                        path={`M0,0 C0,${offsetY * 0.5} ${offsetX},${offsetY * 0.5} ${offsetX},${offsetY}`}
                                                    />
                                                    <animate attributeName="opacity" values="0;0.8;0" dur="1.8s" repeatCount="indefinite" begin="0.3s" />
                                                </circle>

                                                {/* 能量粒子3 - 慢速 */}
                                                <circle r="2.5" fill="var(--kk-canvas-prompt-node-energy-stop-end)" opacity="0" filter={`url(#energy-trail-${node.id}-${i})`}>
                                                    <animateMotion
                                                        dur="2s"
                                                        repeatCount="indefinite"
                                                        begin="0.6s"
                                                        path={`M0,0 C0,${offsetY * 0.5} ${offsetX},${offsetY * 0.5} ${offsetX},${offsetY}`}
                                                    />
                                                    <animate attributeName="opacity" values="0;0.6;0" dur="2s" repeatCount="indefinite" begin="0.6s" />
                                                </circle>
                                            </svg>

                                            {/* 副占位卡 */}
                                            <div
                                                className="absolute rounded-xl overflow-hidden"
                                                style={{
                                                    width: w,
                                                    height: h,
                                                    left: `calc(50% + ${offsetX}px)`,
                                                    top: offsetY,
                                                    transform: 'translateX(-50%)',
                                                    zIndex: stackZIndex + 100, // 🚀 [Fix] 使用更高的 z-index 确保置顶
                                                    background: 'var(--bg-surface)',
                                                    border: '1px solid var(--border-light)',
                                                    boxShadow: getCanvasCardShadow({ boost: shadowBoost, zoomScale }),
                                                    cursor: isDragging ? 'grabbing' : 'grab' // 🚀 Allow grab cursor to bubble
                                                }}
                                            >
                                                {/* 生成中扫光层（严格限定在图片区域，不覆盖底栏 bottom-8） */}
                                                <div
                                                    className="kk-canvas-prompt-node-generating-image-overlay"
                                                >
                                                    <div className="kk-canvas-prompt-node-generating-sheen" />
                                                    <div className="kk-canvas-prompt-node-generating-sweep" />
                                                </div>

                                                <div className="absolute inset-0 bottom-8 flex flex-col items-center justify-center z-10">
                                                    <GenerationTimer
                                                        start={timerStartRef.current}
                                                        onTimeout={() => onCancel && onCancel(node.id)}
                                                    />
                                                </div>

                                                <div
                                                    className="absolute bottom-0 left-0 right-0 h-8 flex items-center justify-center px-2 gap-2"
                                                    style={{
                                                        background: 'var(--bg-tertiary)',
                                                        borderTop: '1px solid var(--border-light)'
                                                    }}
                                                >
                                                    <div
                                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded"
                                                        style={{
                                                            backgroundColor: 'var(--bg-tertiary)',
                                                            border: '1px solid var(--border-light)'
                                                        }}
                                                    >
                                                        {(() => {
                                                            const modelId = node.model || '';
                                                            const modelText = resolveModelDisplayName(modelId, node.modelLabel);
                                                            const providerText = resolveDisplayedProviderLabel(node) || (modelId.includes('@') ? modelId.split('@')[1] : 'Google');
                                                            const modelBadge = getModelBadgeInfo({
                                                                id: modelId,
                                                                label: modelText,
                                                                provider: providerText,
                                                                colorStart: node.modelColorStart,
                                                                colorEnd: node.modelColorEnd,
                                                                textColor: node.modelTextColor,
                                                            });

                                                            const isCreditModel = isCreditBillingTarget(node);

                                                            return (
                                                                <>
                                                                    <span className={`text-[7px] leading-none font-medium whitespace-nowrap max-w-[88px] truncate ${modelBadge.colorClass}`} title={modelText}>
                                                                        {truncateByChars(modelText, 15)}
                                                                    </span>
                                                                    {providerText && !isCreditModel && (
                                                                        <span
                                                                            className={`text-[7px] leading-none px-1 py-0.5 rounded whitespace-nowrap border ${getProviderBadgeColor(providerText)}`}
                                                                            title={providerText}
                                                                            style={getProviderBadgeStyle(providerText)}
                                                                        >
                                                                            {truncateByChars(providerText, 5)}
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[var(--border-medium)] text-[7px]">|</span>
                                                                    <span className="text-[7px] leading-none font-medium text-[var(--text-secondary)] whitespace-nowrap">
                                                                        {getPromptBusinessDisplayLabel(node) || `${node.aspectRatio || '1:1'} · ${node.mode === GenerationMode.VIDEO ? '720p' :
                                                                            node.mode === GenerationMode.AUDIO ? '音频' :
                                                                                node.mode === GenerationMode.PPT ? 'PPT' :
                                                                                    node.mode === GenerationMode.ECOMMERCE ? '电商' :
                                                                                    (node.imageSize as string) === '1024x1024' || (node.imageSize as string) === '1K' ? '1K' :
                                                                                        (node.imageSize as string) === '2048x2048' || (node.imageSize as string) === '2K' ? '2K' :
                                                                                            (node.imageSize as string) === '4096x4096' || (node.imageSize as string) === '4K' ? '4K' :
                                                                                                (node.imageSize as string) || '1K'}`}
                                                                    </span>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        );
                    })()}
                    {/* Telemetry Footer */}
                    <div
                        className="kk-canvas-v3-prompt-footer flex items-center justify-between px-3.5 py-1.5 w-full text-[10px] rounded-b-2xl"
                        style={{
                            background: 'rgba(24, 24, 27, 0.25)',
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                            color: 'var(--text-secondary)',
                        }}
                    >
                        <div className="flex items-center gap-2 truncate">
                            <span className="font-semibold text-amber-400">
                                {node.creditCost !== undefined ? `${node.creditCost} 积分` : '10 积分'}
                            </span>
                            <span className="text-[rgba(255,255,255,0.15)]">|</span>
                            <span className="truncate text-slate-300 font-medium">
                                {node.model ? resolveModelDisplayName(node.model, node.modelLabel) : 'Gemini 3.5 Flash'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                            <span className="px-1 py-0.2 rounded bg-black/30 border border-white/5 text-[8px] text-slate-300">
                                {node.provider ? resolveDisplayedProviderLabel(node) : 'Google'}
                            </span>
                            <span className="text-[8px] opacity-70">
                                {node.executionLane === 'cloud-credit-model' ? '平台路由' : '本地优先'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* [NEW] 局部专属占位扫光动画 */}
            {/* [NEW] 参考图放大浮层 */}
            {previewImage && (
                <ImagePreview
                    imageUrl={previewImage.url}
                    originRect={previewImage.originRect}
                    onClose={() => setPreviewImage(null)}
                />
            )}
        </CanvasCardShell>
    );
}, (prev, next) => {
    // 🚀 [Fix] Only compare state/data props to avoid rendering on inline function identity changes
    if (prev.node.isGenerating !== next.node.isGenerating) return false;

    // 🚀 [性能优化]：如果在拖拽/缩放交互期间，我们忽略 zoomScale 的频繁刷新，完全依靠 Viewport GPU 缩放
    const isTransforming = prev.isCanvasTransforming && next.isCanvasTransforming;

    return (
        prev.node === next.node &&
        prev.groupLayerZIndex === next.groupLayerZIndex &&
        prev.stackZIndexOverride === next.stackZIndexOverride &&
        prev.actualChildImageCount === next.actualChildImageCount &&
        prev.isSelected === next.isSelected &&
        prev.highlighted === next.highlighted &&
        prev.shadowBoost === next.shadowBoost &&
        prev.detailLevel === next.detailLevel &&
        prev.isCanvasTransforming === next.isCanvasTransforming &&
        prev.snapToGrid === next.snapToGrid &&
        (isTransforming ? true : prev.zoomScale === next.zoomScale) &&
        prev.isMobile === next.isMobile &&
        prev.activeEcommerceTaskState === next.activeEcommerceTaskState &&
        prev.ecommerceFrameworkStatus === next.ecommerceFrameworkStatus &&
        prev.ecommerceFrameworkTaskNodes === next.ecommerceFrameworkTaskNodes &&
        prev.sourcePosition?.x === next.sourcePosition?.x &&
        prev.sourcePosition?.y === next.sourcePosition?.y &&
        prev.onDragDelta === next.onDragDelta &&
        prev.onDragCommit === next.onDragCommit
    );
});

export default PromptNodeComponent;
