import React, { Suspense, lazy, useState, useCallback, useRef, useEffect, useLayoutEffect, startTransition } from 'react';
import InfiniteCanvas, { InfiniteCanvasHandle } from './components/canvas/InfiniteCanvas';
import PromptBar from './components/layout/PromptBar';
import ImageNode from './components/image/ImageCard';
import { GlobalLightbox } from './components/image/GlobalLightbox';
import PptStackPreviewModal from './components/image/PptStackPreviewModal';
import PromptNodeComponent from './components/canvas/PromptNodeComponent';
import PendingNode from './components/canvas/PendingNode';
// KeyManagerModal removed - integrated into UserProfileModal
import ChatSidebar from './components/layout/ChatSidebar';
import { AspectRatio, ImageSize, GenerationConfig, PromptNode, GeneratedImage, GenerationMode, KnownModel, CanvasGroup, type AgentWorkflowNode, type AppSurface, type MobilePrimaryTab, type PreviewWorkflowNode, type SaveWorkflowNode, type WorkspacePanel, type PptEditableImageLayer, type PptEditablePage } from './types';
import { Image as ImageIcon, MessageSquare, Plus, Trash2, Shield, FileText, CheckCircle2, History, CreditCard, ChevronDown, Wand2, RefreshCw, Star, Coins, User, LayoutDashboard, LogOut, Settings, Zap, Sparkles } from 'lucide-react';
import { SelectionMenu } from './components/canvas/SelectionMenu';
import { CanvasGroupComponent } from './components/canvas/CanvasGroupComponent';
import { generateImage, cancelGeneration } from './services/llm/geminiService';
import { modelCaller } from './services/model/modelCaller';
import { getModelPricing, isCreditBasedModel, getModelCredits } from './services/model/modelPricing';
import { keyManager, getModelMetadata, normalizeModelId } from './services/auth/keyManager';
import { adminModelService } from './services/model/adminModelService';
import { unifiedModelService } from './services/model/unifiedModelService';
import { getModelCapabilities } from './services/model/modelCapabilities';
import { isSystemModelRoute } from './services/model/modelRoute';
import { llmService } from './services/llm/LLMService';
import { cancelSecureSystemProxyTask } from './services/model/secureModelProxy';
import { getCardDimensions } from './utils/styleUtils';
import { buildGeneratedImageBatchPositions } from './utils/generatedImageLayout';
import { getViewportPreferredPosition, findSafePosition } from './utils/canvasUtils'; // 🎯 Smart Positioning
import { getViewportOffsets, getPromptBarFrontPosition } from './utils/canvasCenter';
import { clampGenerationDurationMs } from './utils/timeUtils';
import { resolveModelDisplayName } from './utils/modelDisplayName';
import { resolveProviderIdentity } from './utils/providerDisplay';
import { pickByDocumentLanguage } from './utils/localeText';
import {
  getReferenceImageLookupIds,
  normalizeReferenceImagesStorage,
  toReferenceImageDataUrl,
} from './utils/referenceImageStorage';

const GENERATE_TRIGGER_COOLDOWN_MS = 500;
const GENERATE_SIGNATURE_DEDUP_MS = 4000;
const GENERATE_TIMEOUT_MS = 600000;

const boundsIntersect = (
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
) => !(
  left.x + left.width <= right.x
  || right.x + right.width <= left.x
  || left.y + left.height <= right.y
  || right.y + right.height <= left.y
);

function buildSoftConnectorPath(startX: number, startY: number, endX: number, endY: number) {
  const { control1X, control1Y, control2X, control2Y } = getSoftConnectorControlPoints(startX, startY, endX, endY);

  return `M${startX},${startY} C${control1X},${control1Y} ${control2X},${control2Y} ${endX},${endY}`;
}

function buildDockedVerticalConnectorPath(startX: number, startY: number, endX: number, endY: number) {
  const deltaY = endY - startY;
  const directionY = deltaY === 0 ? 1 : Math.sign(deltaY);
  const distanceY = Math.abs(deltaY);
  const startPullY = Math.max(28, Math.min(distanceY * 0.5, 140)) * directionY;
  const endPullY = Math.max(24, Math.min(distanceY * 0.34, 112)) * directionY;

  return `M${startX},${startY} C${startX},${startY + startPullY} ${endX},${endY - endPullY} ${endX},${endY}`;
}

function getSoftConnectorControlPoints(startX: number, startY: number, endX: number, endY: number) {
  const deltaX = endX - startX;
  const distanceX = Math.abs(deltaX);
  const distanceY = Math.abs(endY - startY);
  const directionX = deltaX === 0 ? 0 : Math.sign(deltaX);
  const horizontalPull = Math.min(distanceX * 0.22, 64) * directionX;
  const startPullY = Math.min(Math.max(distanceY * 0.42, 24), Math.max(distanceY * 0.72, 24));
  const endPullY = Math.min(Math.max(distanceY * 0.24, 18), Math.max(distanceY * 0.44, 18));

  return {
    control1X: startX + horizontalPull,
    control1Y: startY + startPullY,
    control2X: endX - horizontalPull,
    control2Y: endY - endPullY,
  };
}

type CubicBezierSegment = {
  startX: number;
  startY: number;
  control1X: number;
  control1Y: number;
  control2X: number;
  control2Y: number;
  endX: number;
  endY: number;
};

function getSoftConnectorBezierSegment(startX: number, startY: number, endX: number, endY: number): CubicBezierSegment {
  return {
    startX,
    startY,
    ...getSoftConnectorControlPoints(startX, startY, endX, endY),
    endX,
    endY,
  };
}

function buildCubicBezierPath(segment: CubicBezierSegment) {
  return `M${segment.startX},${segment.startY} C${segment.control1X},${segment.control1Y} ${segment.control2X},${segment.control2Y} ${segment.endX},${segment.endY}`;
}

function interpolatePoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: number
) {
  return {
    x: from.x + ((to.x - from.x) * t),
    y: from.y + ((to.y - from.y) * t),
  };
}

function splitCubicBezierSegment(segment: CubicBezierSegment, t: number) {
  const p0 = { x: segment.startX, y: segment.startY };
  const p1 = { x: segment.control1X, y: segment.control1Y };
  const p2 = { x: segment.control2X, y: segment.control2Y };
  const p3 = { x: segment.endX, y: segment.endY };

  const p01 = interpolatePoint(p0, p1, t);
  const p12 = interpolatePoint(p1, p2, t);
  const p23 = interpolatePoint(p2, p3, t);
  const p012 = interpolatePoint(p01, p12, t);
  const p123 = interpolatePoint(p12, p23, t);
  const p0123 = interpolatePoint(p012, p123, t);

  return {
    left: {
      startX: p0.x,
      startY: p0.y,
      control1X: p01.x,
      control1Y: p01.y,
      control2X: p012.x,
      control2Y: p012.y,
      endX: p0123.x,
      endY: p0123.y,
    } satisfies CubicBezierSegment,
    right: {
      startX: p0123.x,
      startY: p0123.y,
      control1X: p123.x,
      control1Y: p123.y,
      control2X: p23.x,
      control2Y: p23.y,
      endX: p3.x,
      endY: p3.y,
    } satisfies CubicBezierSegment,
  };
}

function getCubicBezierPoint(start: number, control1: number, control2: number, end: number, t: number) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return (mt * mt2 * start) + (3 * mt2 * t * control1) + (3 * mt * t2 * control2) + (t * t2 * end);
}

function getSoftConnectorPointAt(startX: number, startY: number, endX: number, endY: number, t: number) {
  const { control1X, control1Y, control2X, control2Y } = getSoftConnectorControlPoints(startX, startY, endX, endY);

  return {
    x: getCubicBezierPoint(startX, control1X, control2X, endX, t),
    y: getCubicBezierPoint(startY, control1Y, control2Y, endY, t),
  };
}

function estimateCubicBezierLength(segment: CubicBezierSegment, samples: number = 18) {
  let totalLength = 0;
  let previousPoint = { x: segment.startX, y: segment.startY };

  for (let index = 1; index <= samples; index += 1) {
    const t = index / samples;
    const point = {
      x: getCubicBezierPoint(segment.startX, segment.control1X, segment.control2X, segment.endX, t),
      y: getCubicBezierPoint(segment.startY, segment.control1Y, segment.control2Y, segment.endY, t),
    };
    totalLength += Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);
    previousPoint = point;
  }

  return totalLength;
}

type Point = { x: number; y: number };
type SelectionBoxState = { start: Point; current: Point; active: boolean } | null;
type DragConnectionState = {
  active: boolean;
  startId: string;
  startPos: Point;
  currentPos: Point;
} | null;

type PromptGroupRenderItem = {
  id: string;
  kind: 'prompt-group';
  groupView: PromptGroupView;
  node: PromptNode;
  childNodes: GeneratedImage[];
  detailLevel: CanvasCardDetailLevel;
};

type ImageRenderItem = {
  id: string;
  kind: 'image';
  node: GeneratedImage;
  groupLayerZIndex: number;
  stackZIndexOverride?: number;
  detailLevel: CanvasCardDetailLevel;
  loadPriority: number;
  loadBand: 0 | 1 | 2 | 3;
};

type PreviewRenderItem = {
  id: string;
  kind: 'preview';
  node: PreviewWorkflowNode;
};

type SaveRenderItem = {
  id: string;
  kind: 'save';
  node: SaveWorkflowNode;
};

type AgentRenderItem = {
  id: string;
  kind: 'agent';
  node: AgentWorkflowNode;
};

type WorkflowUtilityCanvasNode = PreviewWorkflowNode | SaveWorkflowNode | AgentWorkflowNode;

type PromptGroupTier = 'base' | 'generating' | 'focused';

type PromptGroupView = {
  id: string;
  rootPrompt: PromptNode;
  childImages: GeneratedImage[];
  intraGroupEdges: Array<{ fromId: string; toId: string }>;
  bounds: { x: number; y: number; width: number; height: number };
  baseOrder: number;
  tier: PromptGroupTier;
  isOverlapping: boolean;
};

type CanvasRenderItem =
  | PromptGroupRenderItem
  | ImageRenderItem
  | PreviewRenderItem
  | SaveRenderItem
  | AgentRenderItem;
type ScheduledImageLoadState = {
  loadBand: 0 | 1 | 2 | 3;
  loadPriority: number;
  prefetchQuality: ImageQuality;
};

const PROMPT_GROUP_TIER_WEIGHT: Record<PromptGroupTier, number> = {
  base: 1,
  focused: 2,
  generating: 3,
};

// Lucide icons replaced with SVGs
import { CanvasProvider, useCanvas } from './context/CanvasContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppStartupProvider, useAppStartup } from './context/AppStartupContext';
import { AuthenticatedAppShell } from './app/AuthenticatedAppShell';
import ConnectionDot from './components/canvas/ConnectionDot';
import LoginScreen from './components/auth/LoginScreen';
import AuthCallback from './pages/AuthCallback';
import type { UserProfileView } from './components/modals/UserProfileModal';
import { useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';
import { BillingProvider, useBilling } from './context/BillingContext';
import { formatRemainingCredits } from './services/billing/remainingBalance';


import { saveAs } from 'file-saver';
import JSZip from 'jszip';
// import { syncService } from './services/system/syncService'; // [FIX] Dynamic Import
import { saveImage, saveOriginalImage, normalizePersistableMediaSource } from './services/storage/imageStorage';
import { cancelImageLoad, loadImage } from './services/image/imageLoader';
import { ImageQuality } from './services/image/imageQuality';
import { calculateImageHash } from './utils/imageUtils';
import { optimizePromptForImage } from './services/llm/promptOptimizerService';
import {
  getDefaultPromptOptimizerTemplateId,
  getPromptOptimizerTemplate,
} from './config/promptOptimizerTemplates';
import { normalizePptSlidesForCount, buildAutoPptSlides } from './utils/pptUtils';
import {
  PPT_EDITABLE_CANVAS,
  buildPptEditablePages,
  getPptTextLayer,
  patchPptTextLayer,
  sortPptImageNodes,
  sortPptLayers,
  syncPptSlidesFromEditablePages,
} from './utils/pptEditable';
import { useImageGeneration } from './hooks/useImageGeneration';
import { useWorkspaceSurface } from './hooks/useWorkspaceSurface';
import { WorkspaceSurfacePanels } from './components/workspace/WorkspaceSurfacePanels';
// import { notify } from './services/system/notificationService'; // [FIX] Dynamic Import

// ProjectManager imported from components
import ProjectManager from './components/settings/ProjectManager';
import { Search } from 'lucide-react'; // Import Search icon
import GpuBackground from './components/layout/GpuBackground';
import type { Supplier } from './services/billing/supplierService';
import { apiKeyModalService } from './services/api/apiKeyModalService';
import { MobileChatFeed, MobileHeader, MobileTabBar, MobileWorkspaceQuickBar } from './components/mobile';
import { resolveAvatarUrl } from './utils/presetAvatars';
import {
  AssetLibraryPanel,
  GlobalModals,
  WorkspaceActionBar,
  WorkspaceActionButton,
  WorkspaceShell,
} from './components/workspace';
import {
  createWorkflowNodeRendererRegistry,
  renderWorkflowNode,
} from './workflow/renderers/nodeRendererRegistry';
import PreviewNodeCard from './workflow/nodes/PreviewNodeCard';
import SaveNodeCard from './workflow/nodes/SaveNodeCard';
import AgentNodeCard from './workflow/nodes/AgentNodeCard';
import {
  WORKFLOW_TEMPLATES,
  type WorkflowTemplateId,
  createAgentWorkflowNode,
  createPreviewWorkflowNode,
  createSaveWorkflowNode,
} from './workflow/templates/workflowTemplates';
import { isWorkflowUtilityNodeKind } from './workflow/schema';
import {
  getCanvasPerformanceProfile,
  shouldThrottleEdges,
  type CanvasCardDetailLevel,
} from './canvas/performanceProfile';

const UserProfileModal = lazy(() => import('./components/modals/UserProfileModal'));
const SettingsPanel = lazy(() => import('./components/settings/SettingsPanel')); // single production entry
const SearchPalette = lazy(() => import('./components/layout/SearchPalette'));
const TagInputModal = lazy(() => import('./components/modals/TagInputModal'));
const TutorialOverlay = lazy(() => import('./components/common/TutorialOverlay'));
const StorageSelectionModal = lazy(() => import('./components/modals/StorageSelectionModal'));
const MigrateModal = lazy(async () => {
  const module = await import('./components/modals/MigrateModal');
  return { default: module.MigrateModal };
});
const PptDeckEditorModal = lazy(() => import('./components/image/PptDeckEditorModal'));
const RechargeModal = lazy(() => import('./components/modals/RechargeModal'));

interface AppContentProps {
}

const AppContent: React.FC<AppContentProps> = () => {
  const {
    user,
    loading: authLoading,
    isTempUser,
    signOut
  } = useAuth();
  const { advanceTo, stage } = useAppStartup();
  const [showTutorial, setShowTutorial] = useState(false);
  // [Draft Feature] Persistent Input Card State (Moved to top to avoid ReferenceError)
  const [draftNodeId, setDraftNodeId] = useState<string | null>(null);
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);
  const [generatingGroupIds, setGeneratingGroupIds] = useState<string[]>([]);
  const [groupOverlapMap, setGroupOverlapMap] = useState<Record<string, string[]>>({});
  const [liveNodePositionById, setLiveNodePositionById] = useState<Record<string, { x: number; y: number }>>({});
  const [imageCardHeightById, setImageCardHeightById] = useState<Record<string, number>>({});
  const [lockedGroupBoundsById, setLockedGroupBoundsById] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const nodeDragReleaseFrameRef = useRef<number | null>(null);




  const {
    activeCanvas,
    addPromptNode,
    updatePromptNode,
    addImageNodes,
    updatePromptNodePosition, updateImageNodePosition, updateImageNodeDimensions, updateImageNode, // canvas mutation helpers
    deletePromptNode,
    deleteImageNode,
    urgentUpdatePromptNode, // hot-path prompt updates for transient generation state
    linkNodes,
    unlinkNodes,
    undo,
    redo,
    canUndo,
    canRedo,
    selectedNodeIds,
    selectNodes,
    clearSelection,
    bringNodesToFront,
    findSmartPosition,
    findNextGroupPosition,
    addGroup,
    removeGroup,
    updateGroup,
    setNodeTags,
    arrangeAllNodes,
    moveSelectedNodes,
    moveSelectedNodesImmediate,
    addWorkflowNode,
    updateWorkflowNode,
    updateWorkflowNodePosition,
    deleteWorkflowNode,
    isReady,
    setViewportCenter, // 🎯 视口中心动态优先级
    state, // 🎯 迁移功能需要访问 canvases 列表
    migrateNodes, // 🎯 迁移节点到其他项目
    createCanvas, // 🎯 创建新项目
    switchCanvas  // 🎯 切换项目
  } = useCanvas();

  const {
    balance,
    loading: billingLoading,
    showRechargeModal,
    setShowRechargeModal,
    consumeCreditsDetailed,
    refundCreditsByTransaction,
    refreshBilling,
    adjustBalanceOptimistically
  } = useBilling();
  const remainingBalanceDisplay = billingLoading ? '...' : formatRemainingCredits(balance, 'zh-CN');

  // Canvas Ref for Zoom/Pan Controls
  const canvasRef = useRef<InfiniteCanvasHandle>(null);
  const autoRecoveredCanvasKeyRef = useRef<string>('');

  const handleFitToAll = () => canvasRef.current?.fitToAll();

  const handleToggleGrid = () => setShowGrid(prev => !prev);



  // Ref to access fresh state in async functions (fixing Stale Closure issue)
  const activeCanvasRef = useRef(activeCanvas);
  useLayoutEffect(() => {
    activeCanvasRef.current = activeCanvas;
  }, [activeCanvas]);

  const selectedNodeIdsRef = useRef<string[]>(selectedNodeIds);
  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

  useEffect(() => {
    keyManager.setStartupStage(stage);
    adminModelService.setStartupStage(stage);
  }, [stage]);

  const resolveProviderDisplay = useCallback((keySlotId?: string, fallbackProviderLabel?: string, fallbackProvider?: string) => {
    return resolveProviderIdentity({
      keySlotId,
      provider: fallbackProvider,
      providerLabel: fallbackProviderLabel,
    });
  }, []);

  const shouldPreferRouteProviderDisplay = useCallback((
    node: Pick<PromptNode, 'model' | 'provider' | 'providerLabel'>,
    routeDisplay: { provider?: string; providerLabel?: string }
  ) => {
    const currentLabel = String(node.providerLabel || '').trim();
    const routeLabel = String(routeDisplay.providerLabel || '').trim();

    if (!routeLabel || !currentLabel || currentLabel === routeLabel) {
      return !currentLabel && !!routeLabel;
    }

    const modelMeta = getModelMetadata(node.model || '') as { provider?: string; providerLabel?: string } | undefined;
    const genericLabels = new Set(
      [node.providerLabel, node.provider, modelMeta?.providerLabel, modelMeta?.provider]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim().toLowerCase())
    );

    return genericLabels.has(currentLabel.toLowerCase());
  }, []);

  const resolveCreditCostForModel = useCallback((modelId: string, imageSize?: ImageSize | string) => {
    const globalModel = keyManager.getGlobalModelList().find((model) => model.id === modelId);
    const systemDisplay = globalModel?.isSystemInternal
      ? adminModelService.getModelDisplayInfo(modelId, imageSize)
      : null;
    const resolvedCreditCost = Number(systemDisplay?.creditCost ?? globalModel?.creditCost ?? 0);

    if (Number.isFinite(resolvedCreditCost) && resolvedCreditCost > 0) {
      return resolvedCreditCost;
    }

    return getModelCredits(modelId, imageSize);
  }, []);

  const resolveNodeRouteState = useCallback((node: Pick<PromptNode, 'model' | 'keySlotId' | 'provider' | 'providerLabel'>) => {
    const resolvedKey = keyManager.getNextKey(node.model, node.keySlotId);
    const resolvedKeySlotId = resolvedKey?.id || node.keySlotId;
    const routeDisplay = resolvedKeySlotId
      ? resolveProviderDisplay(resolvedKeySlotId)
      : resolveProviderDisplay(undefined, node.providerLabel, node.provider);
    const preferRouteProviderDisplay = (!!resolvedKeySlotId && !!routeDisplay.providerLabel)
      || shouldPreferRouteProviderDisplay(node, routeDisplay);

    return {
      keySlotId: resolvedKeySlotId,
      provider: preferRouteProviderDisplay
        ? (routeDisplay.provider || node.provider)
        : (node.provider || routeDisplay.provider),
      providerLabel: preferRouteProviderDisplay
        ? (routeDisplay.providerLabel || node.providerLabel)
        : (node.providerLabel || routeDisplay.providerLabel),
    };
  }, [resolveProviderDisplay, shouldPreferRouteProviderDisplay]);

  const hasExplicitModelRoute = useCallback((modelId: string) => {
    const rawModelId = String(modelId || '').trim();
    const separatorIndex = rawModelId.indexOf('@');
    return separatorIndex !== -1 && rawModelId.slice(separatorIndex + 1).trim().length > 0;
  }, []);

  const ensureCreditAttemptCharged = useCallback(async (params: {
    modelId: string;
    modelLabel?: string;
    providerId?: string;
    provider?: string;
    requiredCredits: number;
    useServerSideCreditSettlement: boolean;
  }) => {
    if (params.requiredCredits <= 0) {
      return { success: true as const, transactionId: undefined as string | undefined };
    }

    if (authLoading) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.info('账户状态确认中', '正在校验登录状态，请稍后再试。');
      });
      return { success: false as const };
    }

    if (!user || isTempUser) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.error('请先登录', '积分模型需要登录正式账号后使用。');
      });
      return { success: false as const };
    }

    if (billingLoading) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.info('余额同步中', '正在刷新账户余额，请稍后重试。');
      });
      return { success: false as const };
    }

    if (balance < params.requiredCredits) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.error('生成失败', '您的账户余额不足，请先充值积分。');
      });
      setShowRechargeModal(true);
      return { success: false as const };
    }

    if (params.useServerSideCreditSettlement) {
      return { success: true as const, transactionId: undefined as string | undefined };
    }

    const chargeResult = await consumeCreditsDetailed(params.modelId, params.requiredCredits, {
      feature: `模型调用：${params.modelLabel || params.modelId}`,
      modelName: params.modelLabel || params.modelId,
      providerId: params.providerId || params.provider || 'managed',
      provider: params.provider,
      keySlotId: params.providerId,
    });

    if (!chargeResult.success) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.error('生成失败', chargeResult.message || '积分扣费失败，请稍后重试。');
      });
      if ((chargeResult.newBalance ?? balance) < params.requiredCredits) {
        setShowRechargeModal(true);
      }
      return { success: false as const };
    }

    return {
      success: true as const,
      transactionId: chargeResult.transactionId,
    };
  }, [authLoading, user, isTempUser, balance, setShowRechargeModal, consumeCreditsDetailed]);

  const resolveFailedCreditAttempt = useCallback(async (node: Pick<PromptNode, 'id' | 'billingMode' | 'creditSettlement' | 'isPaymentProcessed' | 'paymentTransactionId' | 'refundStatus' | 'cost'>) => {
    const refundableTransactionId = String(node.paymentTransactionId || '').trim();
    const shouldRefundCurrentAttempt =
      node.billingMode === 'credits'
      && node.creditSettlement === 'client'
      && node.isPaymentProcessed === true
      && refundableTransactionId.length > 0;
    const shouldRefreshServerSideAttempt =
      node.billingMode === 'credits'
      && node.creditSettlement === 'server'
      && (node.cost || 0) > 0;

    let refundStatus = node.refundStatus;
    let isPaymentProcessed = node.isPaymentProcessed;
    let paymentTransactionId = node.paymentTransactionId;

    if (shouldRefundCurrentAttempt) {
      const refundResult = await refundCreditsByTransaction(refundableTransactionId, `退款 ${node.id}`);
      refundStatus = refundResult.success ? 'success' : 'failed';
      if (refundResult.success) {
        isPaymentProcessed = false;
        paymentTransactionId = undefined;
      }
    }

    if (shouldRefreshServerSideAttempt) {
      try {
        await refreshBilling();
        refundStatus = 'success';
      } catch (error) {
        console.error('[resolveFailedCreditAttempt] Failed to refresh billing after server-side credit failure:', error);
        refundStatus = 'failed';
      }
    }

    return {
      refundStatus,
      isPaymentProcessed,
      paymentTransactionId,
    };
  }, [refundCreditsByTransaction, refreshBilling]);

  // Track reserved regions for rapid-fire generation to prevent overlaps (before React update reflects)
  const reservedRegionsRef = useRef<{ bounds: { x: number; y: number; width: number; height: number }; timestamp: number; }[]>([]);



  // [新功能] 全局灯箱状态（针对图片浏览）
  const [previewImages, setPreviewImages] = useState<GeneratedImage[] | null>(null);
  const [previewInitialIndex, setPreviewInitialIndex] = useState(0);
  const [pptStackPreview, setPptStackPreview] = useState<{ images: GeneratedImage[]; initialIndex: number } | null>(null);
  const [pptDeckEditor, setPptDeckEditor] = useState<{ nodeId: string; initialIndex: number } | null>(null);
  const [showMigrateModal, setShowMigrateModal] = useState(false); // 🎯 迁移弹窗状态

  const handleOpenPreview = useCallback((imageId: string) => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    const pptBundle = getOrderedPptPreviewBundle(imageId);
    if (pptBundle) {
      setPreviewImages(pptBundle.images);
      setPreviewInitialIndex(pptBundle.currentIndex);
      return;
    }

    // 1. Group traversal (prioritize canvas groups)
    const group = canvas.groups.find(g => g.nodeIds.includes(imageId));
    let list: GeneratedImage[] = [];

    if (group) {
      list = canvas.imageNodes.filter(n => group.nodeIds.includes(n.id))
        .sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));
    } else {
      // 2. Prompt lineage traversal (include parent images, variants, expansions, and redraw descendants)
      const graphImages = new Set<string>();
      const queue = [imageId];

      while (queue.length > 0) {
        const currId = queue.shift()!;
        if (!graphImages.has(currId)) {
          graphImages.add(currId);
          const img = canvas.imageNodes.find(n => n.id === currId);
          if (img) {
            // Walk upward: sibling images under the same prompt, plus the parent image that spawned this prompt
            const prompt = canvas.promptNodes.find(p => p.id === img.parentPromptId);
            if (prompt) {
              prompt.childImageIds?.forEach(id => {
                if (!graphImages.has(id) && !queue.includes(id)) queue.push(id);
              });
              if (prompt.sourceImageId && !graphImages.has(prompt.sourceImageId) && !queue.includes(prompt.sourceImageId)) {
                queue.push(prompt.sourceImageId);
              }
            }
            // Walk downward: child prompt groups generated from the current image
            const childPrompts = canvas.promptNodes.filter(p => p.sourceImageId === currId);
            childPrompts.forEach(cp => {
              cp.childImageIds?.forEach(id => {
                if (!graphImages.has(id) && !queue.includes(id)) queue.push(id);
              });
            });
          }
        }
      }

      if (graphImages.size > 0) {
        list = canvas.imageNodes.filter(n => graphImages.has(n.id))
          .sort((a, b) => a.timestamp - b.timestamp || (a.position.x - b.position.x));
      } else {
        // 3. 鍏滃簳閫昏緫 (鍗曞紶图片)
        const target = canvas.imageNodes.find(n => n.id === imageId);
        if (target) list = [target];
      }
    }

    if (list.length > 0) {
      const idx = list.findIndex(n => n.id === imageId);
      setPreviewImages(list);
      setPreviewInitialIndex(idx >= 0 ? idx : 0);
    }
  }, [getOrderedPptPreviewBundle]);

  // Reactively track KeyManager state
  const [keyStats, setKeyStats] = useState(() => keyManager.getStats());
  const [providers, setProviders] = useState(() => keyManager.getProviders());

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false); // New User Menu State
  useEffect(() => {
    console.log('[App] showProfileModal changed:', showProfileModal);
  }, [showProfileModal]);
  const [profileInitialView, setProfileInitialView] = useState<UserProfileView>('main');
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  /* Tutorial Logic - Delayed until Storage is Checked */
  const [isStorageChecked, setIsStorageChecked] = useState(false);

  useEffect(() => {
    // Only trigger if storage is checked AND we are not showing the modal
    // AND Canvas is fully Ready (Hydration complete, prompts dismissed)
    if (isStorageChecked && !showStorageModal && isReady) {
      const seen = localStorage.getItem('kk_tutorial_seen');
      if (!seen) {
        // Wait for potential redirect/settings panel to close or settle
        const timer = setTimeout(() => {
          // If we are in API management, don't show tutorial yet
          if (!showSettingsPanel) {
            setShowTutorial(true);
          }
        }, 1500); // Keep 1.5s delay for smooth UX
        return () => clearTimeout(timer);
      }
    }
  }, [isStorageChecked, showStorageModal, showSettingsPanel, isReady]);

  const [settingsInitialView, setSettingsInitialView] = useState<'dashboard' | 'api-management' | 'consumption-records' | 'storage-settings' | 'system-logs'>('dashboard');
  const [settingsInitialSupplier, setSettingsInitialSupplier] = useState<Supplier | null>(null);
  const [settingsPanelSessionKey, setSettingsPanelSessionKey] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [promptBarUiBusy, setPromptBarUiBusy] = useState(false);
  const openSettingsPanel = useCallback((
    view: 'dashboard' | 'api-management' | 'consumption-records' | 'storage-settings' | 'system-logs' = 'api-management',
    supplier: Supplier | null = null
  ) => {
    setSettingsPanelSessionKey((prev) => prev + 1);
    setSettingsInitialSupplier(supplier);
    setSettingsInitialView(view);
    setShowSettingsPanel(true);
  }, []);

  useEffect(() => {
    const openApiManagement = (supplier?: Supplier) => {
      openSettingsPanel('api-management', supplier || null);
    };

    (window as any).openApiKeyModal = openApiManagement;
    apiKeyModalService.setOpenCallback(openApiManagement);

    return () => {
      delete (window as any).openApiKeyModal;
      apiKeyModalService.setOpenCallback(() => {});
    };
  }, [openSettingsPanel]);

  useEffect(() => {
    const unsubscribe = keyManager.subscribe(() => {
      setKeyStats(keyManager.getStats());
      setProviders(keyManager.getProviders());
    });
    return unsubscribe;
  }, []);

  // Mobile Nav Bar Visibility (Swipe to Show, Auto Hide)
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(false);
  const mobileNavTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPromptFocused, setIsPromptFocused] = useState(false); // Track prompt input focus state
  const [isSidebarHovered, setIsSidebarHovered] = useState(false); // Track sidebar hover state
  const lastMouseMoveRef = useRef<number>(Date.now()); // Track the last mouse movement time

  const handleShowMobileNav = useCallback(() => {
    const timeSinceLastMouseMove = Date.now() - lastMouseMoveRef.current;
    const isMouseActive = timeSinceLastMouseMove < 5000; // Treat the mouse as active if it moved within the last 5 seconds

    console.log('[handleShowMobileNav] isPromptFocused:', isPromptFocused, 'isSidebarHovered:', isSidebarHovered, 'isMouseActive:', isMouseActive);
    setIsMobileNavVisible(true);
    // Clear any existing timer
    if (mobileNavTimerRef.current) {
      clearTimeout(mobileNavTimerRef.current);
    }
    // Skip auto-hide while the input is focused, the sidebar is hovered, or the mouse is active
    if (!isPromptFocused && !isSidebarHovered && !isMouseActive) {
      console.log('[handleShowMobileNav] 设置 5 秒自动隐藏定时器');
      mobileNavTimerRef.current = setTimeout(() => {
        console.log('[handleShowMobileNav] 5 秒后自动隐藏');
        setIsMobileNavVisible(false);
      }, 5000);
    } else {
      console.log('[handleShowMobileNav] 不设置定时器，当前仍有交互', { isPromptFocused, isSidebarHovered, isMouseActive });
    }
  }, [isPromptFocused, isSidebarHovered]);

  const handleHideMobileNav = useCallback(() => {
    setIsMobileNavVisible(false);
    if (mobileNavTimerRef.current) {
      clearTimeout(mobileNavTimerRef.current);
    }
  }, []);

  // Global mouse movement listener used to reset the timer
  useEffect(() => {
    const handleGlobalMouseMove = () => {
      lastMouseMoveRef.current = Date.now();
      // When the mouse moves and the nav is visible, refresh the visibility timer
      if (isMobileNavVisible) {
        handleShowMobileNav();
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [isMobileNavVisible, handleShowMobileNav]);

  // Tagging State
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [taggingNodeIds, setTaggingNodeIds] = useState<string[]>([]);
  const [initialTags, setInitialTags] = useState<string[]>([]);

  // Tag Constraints State
  const [tagLimits, setTagLimits] = useState({ maxTags: 10, maxChars: 6 });

  // 🎯 New State for enhanced TagInputModal
  const [allTags, setAllTags] = useState<string[]>([]);
  const [inheritedTags, setInheritedTags] = useState<string[]>([]);
  const [isSubCard, setIsSubCard] = useState(false);

  const handleTag = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    setTaggingNodeIds(selectedNodeIds);

    const firstId = selectedNodeIds[0];
    const promptNode = activeCanvas?.promptNodes.find(n => n.id === firstId);
    const imageNode = activeCanvas?.imageNodes.find(n => n.id === firstId);

    // 🎯 Collect all existing tags from canvas for suggestions
    const allPromptTags = activeCanvas?.promptNodes.flatMap(n => n.tags || []) || [];
    const allImageTags = activeCanvas?.imageNodes.flatMap(n => n.tags || []) || [];
    const uniqueAllTags = [...new Set([...allPromptTags, ...allImageTags])];
    setAllTags(uniqueAllTags);

    // Determine if editing Sub Card and find inherited tags
    if (imageNode) {
      // 🎯 Sub Card - find parent's tags
      const parentPrompt = activeCanvas?.promptNodes.find(n => n.id === imageNode.parentPromptId);
      setInheritedTags(parentPrompt?.tags || []);
      setIsSubCard(true);
      setTagLimits({ maxTags: 3, maxChars: 6 });
    } else {
      // Main Card
      setInheritedTags([]);
      setIsSubCard(false);
      setTagLimits({ maxTags: 8, maxChars: 6 });
    }

    const tags = promptNode?.tags || imageNode?.tags || [];
    setInitialTags(tags);
    setIsTagModalOpen(true);
    setSelectionMenuPosition(null);
  }, [selectedNodeIds, activeCanvas]);

  const handleSaveTags = useCallback(async (tags: string[]) => {
    const firstId = taggingNodeIds[0];
    const promptNode = activeCanvas?.promptNodes.find(n => n.id === firstId);

    // 🎯 Deduplication Logic: If Main Card adds a tag, remove from its Sub Cards
    if (promptNode) {
      // Editing a Main Card
      const childImageIds = promptNode.childImageIds || [];
      const newMainTags = tags;

      // For each child sub-card, remove any tag that now exists on the main card
      childImageIds.forEach(imgId => {
        const img = activeCanvas?.imageNodes.find(n => n.id === imgId);
        if (img && img.tags && img.tags.length > 0) {
          const filteredTags = img.tags.filter(t => !newMainTags.includes(t));
          if (filteredTags.length !== img.tags.length) {
            // Tags were removed, update the sub-card
            setNodeTags([imgId], filteredTags);
          }
        }
      });
    }

    setNodeTags(taggingNodeIds, tags);
    setIsTagModalOpen(false);

    // 🎯 File System Shortcut Integration
    try {
      const { fileSystemService } = await import('./services/storage/fileSystemService');
      const handle = fileSystemService.getGlobalHandle();

      if (handle) {
        for (const nodeId of taggingNodeIds) {
          const img = activeCanvas?.imageNodes.find(n => n.id === nodeId);
          // Only process ImageNodes that have a filename (from local storage)
          // @ts-ignore - filename injected by CanvasContext
          if (img && img.fileName) {
            const oldTags = img.tags || [];
            const newTags = tags;

            // Diff tags
            const added = newTags.filter(t => !oldTags.includes(t));
            const removed = oldTags.filter(t => !newTags.includes(t));

            const isVideo = img.url?.startsWith('data:video/') || img.model?.includes('veo') || false;

            // Execute updates
            // @ts-ignore
            const filename = img.fileName;

            for (const tag of added) {
              await fileSystemService.createTagShortcut(handle, tag, filename, isVideo);
            }
            for (const tag of removed) {
              await fileSystemService.removeTagShortcut(handle, tag, filename, isVideo);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[App] Failed to update tag shortcuts:', e);
    }
  }, [taggingNodeIds, setNodeTags, activeCanvas]);


  // Sync user with KeyManager and handle Modal Logic (Storage -> API)
  useEffect(() => {
    if (authLoading) return;
    let active = true;
    let backgroundReadyTimer: number | null = null;

    const init = async () => {
      advanceTo('session_ready');

      // 0. Initialize the local model surface first. Hosted catalog refreshes
      // stay deferred until the startup coordinator reaches background_ready.
      await unifiedModelService.initialize();
      if (!active) return;

      // 1. Sync User ID
      const authenticatedUserId = user && !isTempUser ? user.id : null;
      const keyManagerUserId = user?.id || null;

      if (authenticatedUserId) {
        import('./services/billing/costService').then(async ({ setUserId }) => {
          if (!active) return;
          await setUserId(authenticatedUserId);
        }).catch(err => console.error('[App] CostService sync failed:', err));
        await keyManager.setUserId(keyManagerUserId);
        if (!active) return;

        // [New] Mark user as logged in on this browser (for future skips)
        localStorage.setItem('kk_has_logged_in', 'true');
      } else {
        import('./services/billing/costService').then(async ({ setUserId }) => {
          if (!active) return;
          await setUserId(null);
        }).catch(err => console.error('[App] CostService reset failed:', err));
        await keyManager.setUserId(keyManagerUserId);
        if (!active) return;
      }

      advanceTo('profile_ready');

      // 2. Check for Returning User (Smart Skip)
      const hasLoggedInBefore = localStorage.getItem('kk_has_logged_in');
      const isDevMode = window.location.hostname === 'localhost';

      // 3. Storage Mode Check
      const { getStorageMode } = await import('./services/storage/storagePreference');
      const storageMode = await getStorageMode();

      // 4. Tutorial Logic
      const tutorialSeen = localStorage.getItem('kk_tutorial_seen');

      // [Smart Logic]
      // A. Storage Modal: Show ONLY if no mode set AND user is NOT a returning user (unless critical)
      // Actually, if storageMode is missing, we MUST show it or default it, otherwise app won't work.
      // But user said: "If storage settings are already set, do not pop up" -> Already handled by `!storageMode` check.
      // "If my account has already logged in ... do not pop up selection" -> This implies we might need a default if missing?
      // For safety, if storageMode is MISSING, we must ask. But if it exists, we skip.

      if (!storageMode) {
        // If returning user but somehow lost storage config? 
        // We still need to ask, to avoid data saving to nowhere.
        // However, if the user implies "don't ask me *again*", likely they have it set.
        // Current logic: `if (!storageMode) setShowStorageModal(true)`
        setShowStorageModal(true);
      } else {
        // Mode exists -> Check Keys for API Panel
        // Only show the API settings panel for first-time users; do not auto-open it for returning users
        const hasKeys = keyManager.hasValidKeys();
        if (!hasKeys && !hasLoggedInBefore && !isDevMode) {
          // Only first-time users should see the API settings panel automatically
          openSettingsSurface('api-management');
        }
        setIsStorageChecked(true);
      }

      // B. Tutorial Logic
      // "Only new users and developer mode should pop up tutorial"
      // "If my account has already logged in ... do not pop up tutorial"
      if (isDevMode) {
        // Dev Mode: Allow normal logic (show if not seen, or always? User said "Only... pop up")
        // We'll stick to "Show if not seen" for Devs, unless user explicitly meant "Always for Devs".
        // Assuming "Only [New Users OR Dev Mode] get it" implies Devs get it too.
        if (!tutorialSeen) {
          // Handled by the other useEffect, we just ensure we don't block it here.
        }
      } else {
        if (hasLoggedInBefore) {
          // Returning User -> FORCE SKIP TUTORIAL
          // Even if 'kk_tutorial_seen' is missing (e.g. cleared cache but kept local storage key?)
          // We'll trust 'kk_has_logged_in'.
          // actually 'kk_has_logged_in' is set above.
          localStorage.setItem('kk_tutorial_seen', 'true'); // Silently mark as seen
        }
      }

      advanceTo('workspace_ready');

      backgroundReadyTimer = window.setTimeout(() => {
        if (!active) {
          return;
        }
        advanceTo('background_ready');
      }, 0);
    };

    init();

    return () => {
      active = false;
      if (backgroundReadyTimer !== null) {
        window.clearTimeout(backgroundReadyTimer);
      }
    };
  }, [advanceTo, authLoading, isTempUser, user]);

  // Generation config state
  // Generation config state with Persistence
  const [config, setConfig] = useState<GenerationConfig>(() => {
    // Load from localStorage
    try {
      const saved = localStorage.getItem('kk_generation_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        const normalizedSavedModel = normalizeModelId(parsed.model || KnownModel.IMAGEN_4);
        // Merge with defaults to ensure all fields exist
        return {
          prompt: parsed.prompt || '', // Restore the persisted prompt
          enablePromptOptimization: parsed.enablePromptOptimization || false,
          promptOptimizationMode: parsed.promptOptimizationMode === 'custom' ? 'custom' : 'auto',
          promptOptimizationTemplateId: parsed.promptOptimizationTemplateId || getDefaultPromptOptimizerTemplateId(parsed.mode || GenerationMode.IMAGE),
          promptOptimizationCustomPrompt: typeof parsed.promptOptimizationCustomPrompt === 'string' ? parsed.promptOptimizationCustomPrompt : '',
          aspectRatio: AspectRatio.AUTO, // [Default: Auto]
          imageSize: ImageSize.SIZE_1K,
          parallelCount: parsed.parallelCount || 1,
          // Restore reference image metadata without base64; hydrate the binary data from IndexedDB later
          referenceImages: normalizeReferenceImagesStorage((parsed.referenceImages || []).map((img: any) => ({
            ...img,
            data: undefined // Binary data is hydrated from IndexedDB, not localStorage
          }))) || [],
          model: normalizedSavedModel,
          enableGrounding: parsed.enableGrounding || false,
          enableImageSearch: parsed.enableImageSearch || false,
          thinkingMode: (parsed.thinkingMode === 'high' || parsed.thinkingMode === 'deep') ? 'high' : 'minimal',
          mode: parsed.mode || GenerationMode.IMAGE,
          pptSlides: Array.isArray(parsed.pptSlides) ? parsed.pptSlides : [],
          pptStyleLocked: parsed.pptStyleLocked !== false
        };
      }
    } catch (e) {
      console.warn('Failed to load generation config', e);
    }
    // Default Fallback
    return {
      prompt: '',
      enablePromptOptimization: false,
      promptOptimizationMode: 'auto',
      promptOptimizationTemplateId: getDefaultPromptOptimizerTemplateId(GenerationMode.IMAGE),
      promptOptimizationCustomPrompt: '',
      aspectRatio: AspectRatio.AUTO, // [Default: Auto]
      imageSize: ImageSize.SIZE_1K,
      parallelCount: 1,
      referenceImages: [],
      model: KnownModel.IMAGEN_4,
      enableGrounding: false,
      enableImageSearch: false,
      thinkingMode: 'minimal',
      mode: GenerationMode.IMAGE,
      pptSlides: [],
      pptStyleLocked: true
    };
  });

  const [modePreferredKeyMap, setModePreferredKeyMap] = useState<Partial<Record<GenerationMode, string>>>(() => {
    try {
      const raw = localStorage.getItem('kk_mode_preferred_key_map');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
      return {};
    }
  });

  const getPreferredKeyForMode = useCallback((mode?: GenerationMode) => {
    const m = mode || GenerationMode.IMAGE;
    return modePreferredKeyMap[m];
  }, [modePreferredKeyMap]);

  const rememberPreferredKeyForMode = useCallback((mode: GenerationMode | undefined, keySlotId?: string) => {
    if (!mode || !keySlotId) return;
    setModePreferredKeyMap(prev => {
      if (prev[mode] === keySlotId) return prev;
      const next = { ...prev, [mode]: keySlotId };
      localStorage.setItem('kk_mode_preferred_key_map', JSON.stringify(next));
      return next;
    });
  }, []);

  // [New] Hydrate Reference Images from IndexedDB
  useEffect(() => {
    const hydrate = async () => {
      // Only hydrate if we have images with storageId but missing data
      const needsHydration = config.referenceImages.some(img => !img.data && getReferenceImageLookupIds(img).length > 0);
      if (!needsHydration) return;

      const { getImage } = await import('./services/storage/imageStorage');

      const hydratedImages = await Promise.all(config.referenceImages.map(async (img) => {
        if (!img.data) {
          try {
            for (const lookupId of getReferenceImageLookupIds(img)) {
              const dataUrl = await getImage(lookupId);

              if (!dataUrl) continue;

              // [FIX] Strip Data URL prefix to comply with PromptBar's raw Base64 expectation
              // The storage returns a full Data URL (e.g. "data:image/png;base64,...")
              // but PromptBar constructs the src by prepending "data:..." again.
              const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
              if (matches && matches[2]) {
                return {
                  ...img,
                  storageId: img.storageId || lookupId,
                  data: matches[2],
                  mimeType: matches[1] || img.mimeType
                };
              }

              // Fallback: If it doesn't match standard Data URL format, use as is.
              // This handles edge cases or if raw base64 was somehow saved.
              return {
                ...img,
                storageId: img.storageId || lookupId,
                data: dataUrl
              };
            }
          } catch (e) {
            console.error('Failed to hydrate image', img.id, e);
          }
        }
        return img;
      }));

      // Update state with hydrated images, only if actually changed
      // To avoid infinite loop, we compare stringified or reference equality?
      // But 'hydrate' runs on config change. If we update config, it runs again.
      // We must ensure we don't trigger if already hydrated.
      // The check `needsHydration` handles this.

      setConfig(prev => {
        // [FIX] Race Condition: The async hydration might finish AFTER the user has deleted an image.
        // We must NOT overwrite 'prev.referenceImages' with the stale 'hydratedImages' array.
        // Instead, we update only the images that still exist in 'prev'.

        const hydratedMap = new Map(hydratedImages.map(img => [img.id, img]));

        const newImages = prev.referenceImages.map(img => {
          // If we found a hydrated version (with data) for this existing image, use it.
          const hydrated = hydratedMap.get(img.id);
          if (hydrated && hydrated.data && !img.data) {
            return { ...img, data: hydrated.data };
          }
          return img;
        });

        // Optimization: strict equality check to avoid re-render if nothing effectively changed
        // But for object references in map, it's safer to just return new state if we are unsure.
        // Given React batching, this is fine.
        return { ...prev, referenceImages: newImages };
      });
    };

    hydrate();
  }, [config.referenceImages]); // Run when referenceImages array changes (e.g. loaded from empty metadata)


  // Persist Config Changes (Debounced/Effect)
  useEffect(() => {
    // 1. [REMOVED] Save Image Data to IndexedDB (Async side effect)
    // The "Write-First" strategy in PromptBar now handles this immediately upon upload.

    const toSave = {
      enablePromptOptimization: config.enablePromptOptimization || false,
      promptOptimizationMode: config.promptOptimizationMode || 'auto',
      promptOptimizationTemplateId: config.promptOptimizationTemplateId || getDefaultPromptOptimizerTemplateId(config.mode),
      promptOptimizationCustomPrompt: config.promptOptimizationCustomPrompt || '',
      aspectRatio: config.aspectRatio,
      imageSize: config.imageSize,
      parallelCount: config.parallelCount,
      model: config.model,
      enableGrounding: config.enableGrounding,
      enableImageSearch: config.enableImageSearch || false,
      thinkingMode: config.thinkingMode || 'minimal',
      mode: config.mode,
      pptSlides: config.pptSlides || [],
      pptStyleLocked: config.pptStyleLocked !== false,
      // Preserve prompt, video, and audio settings introduced by newer workflows.
      prompt: config.prompt || '',
      videoResolution: config.videoResolution,
      videoDuration: config.videoDuration,
      videoAudio: config.videoAudio,
      audioDuration: config.audioDuration,
      audioLyrics: config.audioLyrics,
      maskUrl: config.maskUrl,
      editMode: config.editMode,
      // Save metadata only (strip heavy data) appropriately? 
      // Actually PromptBar renders using `img.data`.
      // We must save the array structure, but we want `data` to be undefined or null in localStorage to save space.
      referenceImages: (normalizeReferenceImagesStorage(config.referenceImages) || []).map(img => ({
        ...img,
        data: undefined // Don't save base64 to localStorage
      }))
    };
    localStorage.setItem('kk_generation_config', JSON.stringify(toSave));
  }, [
    config.enablePromptOptimization,
    config.promptOptimizationMode,
    config.promptOptimizationTemplateId,
    config.promptOptimizationCustomPrompt,
    config.aspectRatio, config.imageSize, config.parallelCount,
    config.model, config.enableGrounding, config.enableImageSearch, config.thinkingMode, config.mode, config.pptSlides, config.pptStyleLocked,
    config.referenceImages, // Add referenceImages to dep array
    config.prompt, config.videoResolution, config.videoDuration, config.videoAudio, config.audioDuration, config.audioLyrics, config.maskUrl, config.editMode // 🎯 鍏ㄩ噺渚濊禆鐩戝惉
  ]);

  // Pending generation state
  // Active source image for continuing conversation
  const [activeSourceImage, setActiveSourceImage] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string>('');

  // Persist Active Source Image
  useEffect(() => {
    // [FIX] Do not restore active source image
    // const savedSource = localStorage.getItem('kk_active_source_image');
    // if (savedSource) setActiveSourceImage(savedSource);
    localStorage.removeItem('kk_active_source_image'); // Ensure it's cleared
  }, []);

  useEffect(() => {
    if (activeSourceImage) {
      localStorage.setItem('kk_active_source_image', activeSourceImage);
    } else {
      localStorage.removeItem('kk_active_source_image');
    }
  }, [activeSourceImage]);



  // Budget Monitoring for Global Notifications
  const lastBudgetAlertRef = useRef<string | null>(null);

  useEffect(() => {
    // Periodic check or subscription
    const checkBudget = () => {
      const slots = keyManager.getSlots();
      const totalCost = slots.reduce((acc, s) => acc + (s.totalCost || 0), 0);
      const totalBudget = slots.reduce((acc, s) => acc + (s.budgetLimit > 0 ? s.budgetLimit : 0), 0);
      const hasUnlimited = slots.some(s => s.budgetLimit < 0);

      // Skip if unlimited total
      if (hasUnlimited || totalBudget === 0) return;

      const remainingPercent = Math.max(0, ((totalBudget - totalCost) / totalBudget) * 100);

      let alertKey = '';
      let title = '';
      let sub = '';

      if (remainingPercent < 1) {
        alertKey = 'critical';
        title = 'API 预算严重不足';
        sub = '剩余预算低于 1%，请立即充值。';
      } else if (remainingPercent < 10) {
        alertKey = 'warning';
        title = 'API 预算不足';
        sub = '剩余预算低于 10%。';
      } else if (remainingPercent < 20) {
        alertKey = 'low';
        title = 'API 预算提醒';
        sub = '剩余预算低于 20%。';
      }

      // Only notify if new alert state is different/higher priority or hasn't been shown
      if (alertKey && lastBudgetAlertRef.current !== alertKey) {
        lastBudgetAlertRef.current = alertKey;
        // Use appropriate level
        import('./services/system/notificationService').then(({ notify }) => {
          if (alertKey === 'critical' || alertKey === 'warning') {
            notify.warning(title, sub);
          } else {
            notify.info(title, sub);
          }
        });
      }
    };

    // Check initially and on keyStats change (which usually happens after generation)
    checkBudget();

    // Subscribe
    const unsub = keyManager.subscribe(checkBudget);
    return unsub;
  }, []);

  // Canvas transform state (for positioning in visible area)
  const [canvasTransform, setCanvasTransform] = useState<{ x: number; y: number; scale: number }>({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    scale: 1
  });
  const [isCanvasTransforming, setIsCanvasTransforming] = useState(false);

  // Sync the viewport center into CanvasContext for prioritized loading
  useEffect(() => {
    // Compute the current viewport center in canvas coordinates
    const centerX = (window.innerWidth / 2 - canvasTransform.x) / canvasTransform.scale;
    const centerY = (window.innerHeight / 2 - canvasTransform.y) / canvasTransform.scale;
    setViewportCenter({ x: centerX, y: centerY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasTransform]); // Exclude setViewportCenter to avoid an infinite loop

  // Derived Pending Position: Always Center (or linked to source)
  const pendingPosition = React.useMemo(() => {
    if (activeSourceImage && activeCanvas) {
      const sourceImage = activeCanvas.imageNodes.find(img => img.id === activeSourceImage);
      if (sourceImage) {
        // Follow-up mode: place the new parent card below the original parent group
        const parentPromptId = sourceImage.parentPromptId;
        const parentPromptRaw = activeCanvas.promptNodes.find(p => p.id === parentPromptId);
        const parentPrompt = parentPromptRaw
          ? { ...parentPromptRaw, position: { ...parentPromptRaw.position, x: sourceImage.position.x } }
          : undefined;

        if (parentPrompt) {
          // Find all child cards below the parent prompt and compute the maximum Y
          const siblingImages = activeCanvas.imageNodes.filter(img => img.parentPromptId === parentPromptId);
          let maxY = parentPrompt.position.y; // Parent prompt Y position (bottom anchor)

          // Compute the maximum bottom Y across all child cards
          siblingImages.forEach(img => {
            const { totalHeight } = getCardDimensions(img.aspectRatio, true);
            const imgBottom = img.position.y + totalHeight;
            maxY = Math.max(maxY, imgBottom);
          });

          const GAP = 60; // Gap between the new parent card and the child-card group
          return {
            x: parentPrompt.position.x,  // Align with the parent prompt on the X axis
            y: maxY + GAP  // Place the card below the lowest child card
          };
        }

        // If there is no parent prompt (orphan child card), place it below the source image
        let sourceHeight = 320;
        if (sourceImage.dimensions) {
          const [w, h] = sourceImage.dimensions.split('x').map(Number);
          if (w && h) {
            const ratio = w / h;
            const cardWidth = ratio > 1 ? 320 : (ratio < 1 ? 200 : 280);
            sourceHeight = (cardWidth / ratio) + 40;
          }
        } else {
          const { totalHeight } = getCardDimensions(sourceImage.aspectRatio, true);
          sourceHeight = totalHeight;
        }

        const GAP = 40;
        return {
          x: sourceImage.position.x,
          y: sourceImage.position.y + sourceHeight + GAP
        };
      }
    }
    // Smart Center Placement - Manual Mode (Always Center)
    // Use the actual InfiniteCanvas viewport plus the live transform to compute a precise center
    const currentTf = canvasRef.current?.getCurrentTransform() || canvasTransform;
    const vpRect = canvasRef.current?.getCanvasRect() || null;
    return getViewportPreferredPosition(currentTf, vpRect, 180);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSourceImage, activeCanvas, canvasTransform]);

  // [Draft Feature] Persistent Input Card State - Moved to Top





  // Clear the follow-up source image and remove the empty follow-up draft at the same time
  const handleClearSource = useCallback(() => {
    setActiveSourceImage(null);
    // If the draft belongs to follow-up mode and is empty, remove it
    if (draftNodeId) {
      const draftNode = activeCanvas?.promptNodes.find(n => n.id === draftNodeId);
      if (draftNode && draftNode.sourceImageId && !draftNode.prompt.trim()) {
        // Only remove drafts that still belong to follow-up mode and have no content
        deletePromptNode(draftNodeId);
        setDraftNodeId(null);
      }
    }
  }, [draftNodeId, activeCanvas, deletePromptNode]);

  // Right-Click Selection State
  const [selectionBox, setSelectionBox] = useState<SelectionBoxState>(null);
  const [selectionMenuPosition, setSelectionMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const selectionBoxRef = useRef<SelectionBoxState>(null);
  const selectionBoxFrameRef = useRef<number | null>(null);
  const pendingSelectionPointRef = useRef<Point | null>(null);

  useEffect(() => {
    selectionBoxRef.current = selectionBox;
  }, [selectionBox]);

  const flushPendingSelectionBox = useCallback(() => {
    if (selectionBoxFrameRef.current !== null) {
      cancelAnimationFrame(selectionBoxFrameRef.current);
      selectionBoxFrameRef.current = null;
    }

    const pendingPoint = pendingSelectionPointRef.current;
    const currentSelection = selectionBoxRef.current;
    if (!pendingPoint || !currentSelection) return currentSelection;

    const nextSelection = { ...currentSelection, current: pendingPoint };
    selectionBoxRef.current = nextSelection;
    pendingSelectionPointRef.current = null;
    setSelectionBox(nextSelection);
    return nextSelection;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only allow box selection if clicking on background
    const target = e.target as HTMLElement;
    const isNode = target.closest('.prompt-node') || target.closest('.image-node') || target.closest('.group-container') || target.closest('button') || target.closest('input');

    if (e.button !== 2) {
      setSelectionMenuPosition(null);
    }

    // Middle click (button 1) handled by InfiniteCanvas
    if (e.button === 2 && !isNode) { // Right click on BACKGROUND only
      e.preventDefault(); // allow context menu? No, user wants box select.
      // E.preventDefault avoids native menu.
      e.stopPropagation();
      setSelectionMenuPosition(null);
      const nextSelectionBox = {
        start: { x: e.clientX, y: e.clientY },
        current: { x: e.clientX, y: e.clientY },
        active: true
      };
      selectionBoxRef.current = nextSelectionBox;
      pendingSelectionPointRef.current = null;
      setSelectionBox(nextSelectionBox);
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!selectionBoxRef.current?.active) return;

    pendingSelectionPointRef.current = { x: e.clientX, y: e.clientY };
    if (selectionBoxFrameRef.current !== null) return;

    selectionBoxFrameRef.current = window.requestAnimationFrame(() => {
      selectionBoxFrameRef.current = null;
      const pendingPoint = pendingSelectionPointRef.current;
      const currentSelection = selectionBoxRef.current;
      if (!pendingPoint || !currentSelection) return;

      const nextSelection = { ...currentSelection, current: pendingPoint };
      selectionBoxRef.current = nextSelection;
      setSelectionBox(nextSelection);
    });
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const currentSelectionBox = flushPendingSelectionBox() ?? selectionBoxRef.current;
    if (currentSelectionBox?.active) {
      const startX = Math.min(currentSelectionBox.start.x, currentSelectionBox.current.x);
      const startY = Math.min(currentSelectionBox.start.y, currentSelectionBox.current.y);
      const endX = Math.max(currentSelectionBox.start.x, currentSelectionBox.current.x);
      const endY = Math.max(currentSelectionBox.start.y, currentSelectionBox.current.y);
      const width = endX - startX;
      const height = endY - startY;
      let nextSelectionIds: string[] = [];

      if (width > 5 || height > 5) {
        // Convert screen rect to canvas rect
        const s = canvasTransform.scale;
        const ox = canvasTransform.x;
        const oy = canvasTransform.y;

        const canvasRect = {
          x: (startX - ox) / s,
          y: (startY - oy) / s,
          w: width / s,
          h: height / s
        };

        const ids: string[] = [];
        // Check prompts
        activeCanvas?.promptNodes.forEach(node => {
          const { width: nw } = getCardDimensions(node.aspectRatio);
          const nh = 140; // Approx height
          // Card origin (x,y) is Bottom Center.
          // Rect is [x - w/2, y - h, w, h]
          const nx = node.position.x - nw / 2;
          const ny = node.position.y - nh;

          if (nx < canvasRect.x + canvasRect.w && nx + nw > canvasRect.x &&
            ny < canvasRect.y + canvasRect.h && ny + nh > canvasRect.y) {
            ids.push(node.id);
          }
        });

        // Check images
        activeCanvas?.imageNodes.forEach(node => {
          const { width: nw, totalHeight: nh } = getCardDimensions(node.aspectRatio, true);
          const nx = node.position.x - nw / 2;
          const ny = node.position.y - nh;

          if (nx < canvasRect.x + canvasRect.w && nx + nw > canvasRect.x &&
            ny < canvasRect.y + canvasRect.h && ny + nh > canvasRect.y) {
            ids.push(node.id);
          }
        });

        nextSelectionIds = ids;
        if (ids.length > 0) {
          // Shift=add, Ctrl=remove, no modifier=replace
          const mode = e.ctrlKey ? 'remove' : (e.shiftKey ? 'add' : 'replace');
          selectNodes(ids, mode);
        } else {
          if (!e.shiftKey && !e.ctrlKey) clearSelection();
        }
      } else {
        // Clicked without drag
        // If Right Click (button 2), DO NOT clear selection (it's likely for Context Menu)
        // Only clear if Left Click and not Shift
        if (e.button !== 2 && !e.shiftKey) {
          clearSelection();
        }
      }
      // 🎯 Show selection menu centered on selection bounds (not at mouse)
      if (e.button === 2) {
        const allSelectedIds = nextSelectionIds.length > 0 ? nextSelectionIds : selectedNodeIds;
        if (allSelectedIds.length > 0) {
          // Calculate center position immediately - getSelectionScreenCenter depends on activeCanvas
          // which may not include newly selected IDs, so we compute manually here
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          let hasNodes = false;

          activeCanvas?.promptNodes
            .filter(n => allSelectedIds.includes(n.id))
            .forEach(n => {
              const w = 380;
              const h = n.height || 200;
              minX = Math.min(minX, n.position.x - w / 2);
              maxX = Math.max(maxX, n.position.x + w / 2);
              minY = Math.min(minY, n.position.y - h);
              maxY = Math.max(maxY, n.position.y);
              hasNodes = true;
            });

          activeCanvas?.imageNodes
            .filter(n => allSelectedIds.includes(n.id))
            .forEach(n => {
              const { width, totalHeight } = getCardDimensions(n.aspectRatio, true);
              minX = Math.min(minX, n.position.x - width / 2);
              maxX = Math.max(maxX, n.position.x + width / 2);
              minY = Math.min(minY, n.position.y - totalHeight);
              maxY = Math.max(maxY, n.position.y);
              hasNodes = true;
            });

          if (hasNodes) {
            const centerX = (minX + maxX) / 2;
            const topY = minY;
            const screenX = centerX * canvasTransform.scale + canvasTransform.x;
            const screenY = topY * canvasTransform.scale + canvasTransform.y;
            setSelectionMenuPosition({ x: screenX, y: screenY });
          } else {
            setSelectionMenuPosition(null);
          }
        } else {
          setSelectionMenuPosition(null);
        }
      } else {
        // Left click clears position unless clicking on a node (handled separately)
        setSelectionMenuPosition(null);
      }
      selectionBoxRef.current = null;
      pendingSelectionPointRef.current = null;
      setSelectionBox(null);
    }
  }, [flushPendingSelectionBox, canvasTransform, activeCanvas, selectNodes, clearSelection, selectedNodeIds, getCardDimensions]);



  // Connection Dragging State
  const [dragConnection, setDragConnection] = useState<DragConnectionState>(null);
  const dragConnectionRef = useRef<DragConnectionState>(null);
  const dragConnectionFrameRef = useRef<number | null>(null);
  const pendingDragConnectionPointRef = useRef<Point | null>(null);
  const [isNodeDragActive, setIsNodeDragActive] = useState(false);

  useEffect(() => {
    dragConnectionRef.current = dragConnection;
  }, [dragConnection]);

  const flushPendingDragConnection = useCallback(() => {
    if (dragConnectionFrameRef.current !== null) {
      cancelAnimationFrame(dragConnectionFrameRef.current);
      dragConnectionFrameRef.current = null;
    }

    const pendingPoint = pendingDragConnectionPointRef.current;
    const currentDragConnection = dragConnectionRef.current;
    if (!pendingPoint || !currentDragConnection) return currentDragConnection;

    const nextDragConnection = { ...currentDragConnection, currentPos: pendingPoint };
    dragConnectionRef.current = nextDragConnection;
    pendingDragConnectionPointRef.current = null;
    setDragConnection(nextDragConnection);
    return nextDragConnection;
  }, []);
  const lastGenerateAtRef = useRef(0);
  const lastGenerateSignatureRef = useRef<{ value: string; at: number } | null>(null);

  // error state removed, using notify service
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    isChatOpen,
    setIsChatOpen,
    chatSidebarWidth,
    setChatSidebarWidth,
    isMobile,
    workspaceSurface,
    setWorkspaceSurface,
    activeAppSurface,
    activeWorkspacePanel,
    currentMobileTab,
    focusWorkspace,
    openLibrarySurface,
    toggleChatPanel,
    openProfileSurface,
    openSettingsSurface,
    handleSelectMobileTab,
  } = useWorkspaceSurface({
    showSettingsPanel,
    showProfileModal,
    handleShowMobileNav,
    openSettingsPanel,
    setProfileInitialView,
    setShowProfileModal,
    setShowUserMenu,
  });

  const {
    isGenerating,
    executeGeneration,
    pollTaskStatus,
    cancelGeneration: cancelGen,
    recoverFailedSyncBridgeGeneration
  } = useImageGeneration({
    isMobile,
    getCardDimensions,
    rememberPreferredKeyForMode
  });

  useEffect(() => {
    return () => {
      if (selectionBoxFrameRef.current !== null) {
        cancelAnimationFrame(selectionBoxFrameRef.current);
      }
      if (dragConnectionFrameRef.current !== null) {
        cancelAnimationFrame(dragConnectionFrameRef.current);
      }
    };
  }, []);

  const handleRootMouseMove = useCallback((e: React.MouseEvent) => {
    handleMouseMove(e);

    if (!dragConnectionRef.current?.active) return;

    const nextPoint = {
      x: (e.clientX - canvasTransform.x) / canvasTransform.scale,
      y: (e.clientY - canvasTransform.y) / canvasTransform.scale,
    };
    pendingDragConnectionPointRef.current = nextPoint;

    const currentDragConnection = dragConnectionRef.current;
    if (!currentDragConnection) return;

    const nextDragConnection = { ...currentDragConnection, currentPos: nextPoint };
    dragConnectionRef.current = nextDragConnection;
    setDragConnection(nextDragConnection);
  }, [handleMouseMove, canvasTransform]);

  const handleRootMouseUp = useCallback((e: React.MouseEvent) => {
    handleMouseUp(e);

    if (dragConnectionRef.current?.active) {
      if (dragConnectionFrameRef.current !== null) {
        cancelAnimationFrame(dragConnectionFrameRef.current);
        dragConnectionFrameRef.current = null;
      }
      pendingDragConnectionPointRef.current = null;
      dragConnectionRef.current = null;
      setDragConnection(null);
    }
  }, [handleMouseUp]);

  useEffect(() => {
    return () => {
      if (nodeDragReleaseFrameRef.current !== null) {
        cancelAnimationFrame(nodeDragReleaseFrameRef.current);
      }
    };
  }, []);

  const handleCanvasNodeDragStateChange = useCallback((dragging: boolean) => {
    if (nodeDragReleaseFrameRef.current !== null) {
      cancelAnimationFrame(nodeDragReleaseFrameRef.current);
      nodeDragReleaseFrameRef.current = null;
    }

    if (dragging) {
      setIsNodeDragActive(true);
      return;
    }

    // Keep connector rendering in live mode for one more frame so the
    // final drag delta can commit before we fall back to the throttled snapshot.
    nodeDragReleaseFrameRef.current = requestAnimationFrame(() => {
      nodeDragReleaseFrameRef.current = null;
      setIsNodeDragActive(false);
    });
  }, []);

  // [Draft Sync Effect] Keep the draft node in sync with PromptBar config
  // AND [Smart Re-centering] Auto-calculate position for new/stale drafts
  useEffect(() => {
    if (draftNodeId && activeCanvas) {
      if (config.prompt.trim()) {
        const node = activeCanvas?.promptNodes.find(n => n.id === draftNodeId);
        if (node) {
          const nextSourceImageId = activeSourceImage || undefined;
          const draftModelMeta = keyManager.getGlobalModelList().find((model) => model.id === config.model);
          const draftSystemDisplay = draftModelMeta?.isSystemInternal
            ? adminModelService.getModelDisplayInfo(config.model, config.imageSize)
            : null;
          const draftRouteState = resolveNodeRouteState({
            model: config.model,
            keySlotId: node.keySlotId,
            provider: node.provider,
            providerLabel: node.providerLabel,
          });
          const nextDraftModelLabel = draftSystemDisplay?.displayName || resolveModelDisplayName(
            config.model,
            draftModelMeta?.name || getModelMetadata(config.model)?.name || config.model,
          );
          const nextDraftColorStart = draftSystemDisplay?.colorStart || draftModelMeta?.colorStart;
          const nextDraftColorEnd = draftSystemDisplay?.colorEnd || draftModelMeta?.colorEnd;
          const nextDraftColorSecondary = draftSystemDisplay?.colorSecondary || draftModelMeta?.colorSecondary;
          const nextDraftTextColor = draftSystemDisplay?.textColor || draftModelMeta?.textColor;
          const referenceImagesChanged = node.referenceImages !== config.referenceImages;
          // Detect changes to avoid loop
          const hasChanged = node.prompt !== config.prompt ||
            node.model !== config.model ||
            node.modelLabel !== nextDraftModelLabel ||
            node.provider !== draftRouteState.provider ||
            node.providerLabel !== draftRouteState.providerLabel ||
            node.keySlotId !== draftRouteState.keySlotId ||
            node.modelColorStart !== nextDraftColorStart ||
            node.modelColorEnd !== nextDraftColorEnd ||
            node.modelColorSecondary !== nextDraftColorSecondary ||
            node.modelTextColor !== nextDraftTextColor ||
            node.aspectRatio !== config.aspectRatio ||
            node.imageSize !== config.imageSize ||
            (node.thinkingMode || 'minimal') !== (config.thinkingMode || 'minimal') ||
            !!node.enableGrounding !== !!config.enableGrounding ||
            !!node.enableImageSearch !== !!config.enableImageSearch ||
            node.mode !== config.mode ||
            referenceImagesChanged ||
            node.sourceImageId !== nextSourceImageId;

          const shouldAutoCenter = !node.userMoved && !node.sourceImageId;

          if (hasChanged || shouldAutoCenter) {
            // 🎯 [Smart Re-centering]
            // If the user hasn't moved the draft, and it's a normal draft (not follow-up),
            // auto-sync its position to current viewport center
            const currentTransform = canvasRef.current?.getCurrentTransform() || canvasTransform;
            const viewportRect = canvasRef.current?.getCanvasRect() || null;
            const leftOffset = isSidebarOpen && !isMobile ? 260 : (isMobile ? 0 : 60);
            const rightOffset = isChatOpen && !isMobile ? 420 : 0;
            const liveCenter = getViewportPreferredPosition(currentTransform, viewportRect, 180, { left: leftOffset, right: rightOffset });

            // Only update position if it actually needs to move (avoid spam)
            const isPositionDifferent = Math.abs(node.position.x - liveCenter.x) > 1 || Math.abs(node.position.y - liveCenter.y) > 1;

            if (hasChanged || (shouldAutoCenter && isPositionDifferent)) {
              const nextDraftNode: PromptNode = {
                ...node,
                prompt: config.prompt,
                aspectRatio: config.aspectRatio,
                imageSize: config.imageSize,
                model: config.model,
                modelLabel: nextDraftModelLabel,
                modelColorStart: nextDraftColorStart,
                modelColorEnd: nextDraftColorEnd,
                modelColorSecondary: nextDraftColorSecondary,
                modelTextColor: nextDraftTextColor,
                keySlotId: draftRouteState.keySlotId,
                provider: draftRouteState.provider,
                providerLabel: draftRouteState.providerLabel,
                thinkingMode: config.thinkingMode || 'minimal',
                enableGrounding: !!config.enableGrounding,
                enableImageSearch: !!config.enableImageSearch,
                referenceImages: referenceImagesChanged ? config.referenceImages : undefined,
                sourceImageId: nextSourceImageId,
                mode: config.mode,
                position: shouldAutoCenter ? liveCenter : node.position
              };

              updatePromptNode(nextDraftNode);
            }
          }
        } else {
          setDraftNodeId(null);
        }
      }
    } else {
      // Config is empty
      if (draftNodeId) {
        const node = activeCanvas?.promptNodes.find(n => n.id === draftNodeId);
        if (node && !node.sourceImageId && !node.isGenerating) {
          deletePromptNode(draftNodeId);
          setDraftNodeId(null);
        }
      }
    }
  }, [
    activeCanvas,
    activeSourceImage,
    canvasTransform,
    config.aspectRatio,
    config.enableGrounding,
    config.enableImageSearch,
    config.imageSize,
    config.mode,
    config.model,
    config.prompt,
    config.referenceImages,
    config.thinkingMode,
    deletePromptNode,
    draftNodeId,
    isChatOpen,
    isMobile,
    isSidebarOpen,
    resolveNodeRouteState,
    updatePromptNode,
  ]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Clean Fly-to Navigation Logic
  const handleNavigateToNode = useCallback((targetX: number, targetY: number, id?: string) => {
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;

    // Calculate new position to center the target
    // We want: targetX * scale + transformX = screenCenterX
    // So: transformX = screenCenterX - targetX * scale

    // User requested "Zoom and Pan" (平移骞剁缉鏀?
    const targetScale = 1; // Reset to 1:1 view for clarity

    const newX = screenCenterX - targetX * targetScale;
    const newY = screenCenterY - targetY * targetScale;

    // IMPERATIVE UPDATE: Tell InfiniteCanvas to move
    canvasRef.current?.setView(newX, newY, targetScale);

    // Keep local state in sync
    setCanvasTransform({
      x: newX,
      y: newY,
      scale: targetScale
    });

    if (id) {
      setHighlightedId(id);
      setTimeout(() => setHighlightedId(null), 3000); // Highlight for 3 seconds
    }
  }, []);

  const handleMultiSelectConfirm = useCallback((ids: string[]) => {
    if (!ids || ids.length === 0) return;
    selectNodes(ids, 'replace');
    setTimeout(() => {
      arrangeAllNodes();
    }, 100);
  }, [selectNodes, arrangeAllNodes]);

  // 🎯 Helper: Compute selection bounds center in screen coordinates
  const getSelectionScreenCenter = useCallback((nodeIds: string[]) => {
    if (!activeCanvas || nodeIds.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasNodes = false;

    // Check prompts
    activeCanvas.promptNodes
      .filter(n => nodeIds.includes(n.id))
      .forEach(n => {
        const w = 380;
        const h = n.height || 200;
        minX = Math.min(minX, n.position.x - w / 2);
        maxX = Math.max(maxX, n.position.x + w / 2);
        minY = Math.min(minY, n.position.y - h);
        maxY = Math.max(maxY, n.position.y);
        hasNodes = true;
      });

    // Check images
    activeCanvas.imageNodes
      .filter(n => nodeIds.includes(n.id))
      .forEach(n => {
        const { width, totalHeight } = getCardDimensions(n.aspectRatio, true);
        minX = Math.min(minX, n.position.x - width / 2);
        maxX = Math.max(maxX, n.position.x + width / 2);
        minY = Math.min(minY, n.position.y - totalHeight);
        maxY = Math.max(maxY, n.position.y);
        hasNodes = true;
      });

    (activeCanvas.workflow?.nodes || [])
      .filter((node): node is WorkflowUtilityCanvasNode => (
        nodeIds.includes(node.id) && isWorkflowUtilityNodeKind(node.kind)
      ))
      .forEach((node) => {
        const width = node.width || 284;
        const height = node.height || 176;
        minX = Math.min(minX, node.position.x - width / 2);
        maxX = Math.max(maxX, node.position.x + width / 2);
        minY = Math.min(minY, node.position.y - height);
        maxY = Math.max(maxY, node.position.y);
        hasNodes = true;
      });

    if (!hasNodes) return null;

    // Convert canvas coords to screen coords
    const centerX = (minX + maxX) / 2;
    const topY = minY; // Use top of bounds for menu position (above selection)

    const screenX = centerX * canvasTransform.scale + canvasTransform.x;
    const screenY = topY * canvasTransform.scale + canvasTransform.y;

    return { x: screenX, y: screenY };
  }, [activeCanvas, canvasTransform, getCardDimensions]);

  // Reset view: prefer the selected group, otherwise fall back to the latest node
  const handleResetView = useCallback(() => {
    if (!activeCanvas) return;

    // 1. If there is a selection, center the view on the selected group first
    if (selectedNodeIds.length > 0) {
      // Collect the selected prompt and image nodes
      const selectedPrompts = activeCanvas.promptNodes.filter(p => selectedNodeIds.includes(p.id));
      const selectedImages = activeCanvas.imageNodes.filter(img => selectedNodeIds.includes(img.id));
      const selectedWorkflowNodes = (activeCanvas.workflow?.nodes || []).filter(
        (node): node is WorkflowUtilityCanvasNode => (
          selectedNodeIds.includes(node.id) && isWorkflowUtilityNodeKind(node.kind)
        )
      );

      // 计算选中节点的中心位置
      const allPositions = [
        ...selectedPrompts.map(p => p.position),
        ...selectedImages.map(img => img.position),
        ...selectedWorkflowNodes.map(node => node.position),
      ];

      if (allPositions.length > 0) {
        const avgX = allPositions.reduce((sum, pos) => sum + pos.x, 0) / allPositions.length;
        const avgY = allPositions.reduce((sum, pos) => sum + pos.y, 0) / allPositions.length;
        handleNavigateToNode(avgX, avgY);
        return;
      }
    }

    // 2. If there are no prompt cards, jump to the newest generated image card.
    const prompts = activeCanvas.promptNodes;
    if (prompts.length === 0) {
      const latestImage = [...activeCanvas.imageNodes].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
      if (latestImage) {
        handleNavigateToNode(latestImage.position.x, latestImage.position.y);
        return;
      }
      handleNavigateToNode(0, 0);
      return;
    }
    // Sort by timestamp descending
    const latestPrompt = [...prompts].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];

    if (latestPrompt) {
      // Find associated images to calculate bounding box
      const childImages = activeCanvas.imageNodes.filter(img => img.parentPromptId === latestPrompt.id);

      let targetX = latestPrompt.position.x;
      let targetY = latestPrompt.position.y;

      if (childImages.length > 0) {
        // Find lowest image bottom (since Y is anchor bottom for images too)
        const maxY = Math.max(...childImages.map(img => img.position.y));
        // Target vertical center between Prompt Bottom and Image(s) Bottom
        targetY = (latestPrompt.position.y + maxY) / 2;
      } else {
        // If no images yet, center roughly on the card body (Anchor is Bottom, so move Up)
        targetY = latestPrompt.position.y - 100;
      }

      handleNavigateToNode(targetX, targetY);
    }
  }, [activeCanvas, handleNavigateToNode, selectedNodeIds]);

  // 处理拖入图片并创建孤独副卡
  const handleImageDrop = useCallback(async (file: File, canvasPosition: { x: number; y: number }) => {
    if (!activeCanvas) return;

    try {
      // 读取图片
      const reader = new FileReader();
      reader.onload = async (e: ProgressEvent<FileReader>) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return;

        // 获取图片尺寸
        const img = new Image();
        img.onload = async () => {
          const calc = await import('./utils/imageUtils');
          const storageId = await calc.calculateImageHash(dataUrl.split(',')[1]);

          // Persist to storage
          const storage = await import('./services/storage/imageStorage');
          await storage.saveImage(storageId, dataUrl).catch(err =>
            console.error("Failed to save dropped image", err)
          );

          // 计算宽高比
          const calcAspect = (w: number, h: number): AspectRatio => {
            const ratio = w / h;
            if (Math.abs(ratio - 1) < 0.1) return AspectRatio.SQUARE;
            if (ratio < 1) return AspectRatio.PORTRAIT_3_4;
            return AspectRatio.LANDSCAPE_4_3;
          };

          // 创建孤独副卡
          const newImage: GeneratedImage = {
            id: Date.now().toString(),
            storageId,
            url: dataUrl,
            prompt: `拖入图片：${file.name}`,
            aspectRatio: calcAspect(img.width, img.height),
            timestamp: Date.now(),
            model: 'uploaded',
            canvasId: activeCanvas.id,
            parentPromptId: '', // 孤独卡片无父节点
            position: canvasPosition,
            dimensions: `${img.width}×${img.height}`,
            orphaned: true, // 标记为孤独副卡
            fileName: file.name,
            fileSize: file.size
          };

          addImageNodes([newImage]);

          // 通知用户
          import('./services/system/notificationService').then(({ notify }) => {
            notify.success('图片已添加', `${file.name} (${img.width}×${img.height})`);
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to process dropped image:', error);
      import('./services/system/notificationService').then(({ notify }) => {
        notify.error('图片处理失败', '请重试');
      });
    }
  }, [activeCanvas, addImageNodes]);



  // Handle keys logic (kept as is)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) {
        return;
      }

      // Delete selected nodes via keyboard (after box-select or multi-select)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const ids = selectedNodeIdsRef.current;
        if (ids.length > 0) {
          e.preventDefault();
          const canvas = activeCanvasRef.current;
          if (canvas) {
            const idSet = new Set(ids);
            const prompts = canvas.promptNodes.filter(n => idSet.has(n.id));
            const images = canvas.imageNodes.filter(n => idSet.has(n.id));
            prompts.forEach(n => deletePromptNode(n.id));
            images.forEach(n => deleteImageNode(n.id));
            clearSelection();
            setSelectionMenuPosition(null);
          }
          return;
        }
      }

      // Ctrl + K or Cmd + K to open Search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          if (canRedo) redo();
        } else {
          e.preventDefault();
          if (canUndo) undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        if (canRedo) redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo, deletePromptNode, deleteImageNode, clearSelection]);

  // const [showApiModal, setShowApiModal] = useState(false); // Removed
  // Duplicate showProfileModal removed

  // Treat non-invalid configured channels as usable so the avatar indicator matches real routing behavior.
  const hasUsableOfficialApi = keyManager.hasValidKeys();
  const hasUsableProviderApi = providers.some((provider) =>
    provider.isActive
    && provider.status !== 'error'
    && provider.baseUrl.trim().length > 0
    && provider.apiKey.trim().length > 0
  );
  const hasProviderErrors = providers.some((provider) => provider.isActive && provider.status === 'error');

  // Get derived API status for UI indicator - use keyManager
  const derivedApiStatus = hasUsableOfficialApi || hasUsableProviderApi
    ? 'success'
    : keyStats.invalid > 0 || hasProviderErrors
      ? 'error'
      : 'neutral';

  

  const handleCancelGeneration = useCallback(async (id?: string) => {
    // If ID provided, cancel specific
    if (id) {
      cancelGeneration(id);
      if (activeCanvas) {
        const node = activeCanvas.promptNodes.find(n => n.id === id);
        if (node) {
          if (node.jobId?.startsWith('system_proxy:')) {
            try {
              await cancelSecureSystemProxyTask(node.jobId);
            } catch (error) {
              console.warn('[handleCancelGeneration] 取消系统任务失败:', error);
            }
          }
          updatePromptNode({
            ...node,
            isGenerating: false,
            error: "Cancelled by user",
            errorDetails: {
              code: 'CANCELLED',
              responseBody: 'Generation cancelled by user',
              model: node.model,
              timestamp: Date.now()
            }
          });
        }
      }
    } else {
      // If no ID, cancel ALL generating nodes (Global Stop)
      if (activeCanvas) {
        const generatingNodes = activeCanvas.promptNodes.filter(n => n.isGenerating);
        await Promise.allSettled(generatingNodes.map(async (node) => {
          // Cancel all parallel requests for this node
          const count = node.parallelCount || 1;
          for (let i = 0; i < count; i++) {
            cancelGeneration(`${node.id}-${i}`);
          }

          if (node.jobId?.startsWith('system_proxy:')) {
            try {
              await cancelSecureSystemProxyTask(node.jobId);
            } catch (error) {
              console.warn('[handleCancelGeneration] 批量取消系统任务失败:', error);
            }
          }

          updatePromptNode({
            ...node,
            isGenerating: false,
            error: "Cancelled by user",
            errorDetails: {
              code: 'CANCELLED',
              responseBody: 'Generation cancelled by user',
              model: node.model,
              timestamp: Date.now()
            }
          });
        }));
      }

    }
  }, [activeCanvas, updatePromptNode, cancelGeneration]);



  // Helper to estimate prompt card height based on text length
  const getPromptHeight = useCallback((text: string) => {
    // Calibrated for PromptNodeComponent (Header ~40px, Padding ~24px, Footer/Spacer ~20px)
    const baseHeight = 110;
    const charPerLine = 18; // Conservative char count (Chinese/Wide chars)
    const lineHeight = 28; // text-[15px] leading-7 = 28px
    const lines = Math.ceil((text || '').length / charPerLine) || 1;
    // Lower the floor to 130px (approx single line prompt height)
    return Math.max(130, baseHeight + (lines * lineHeight));
  }, []);

  const inferAspectRatioFromDimensions = useCallback((w: number, h: number): AspectRatio => {
    if (!w || !h) return AspectRatio.SQUARE;
    const ratio = w / h;
    const targets: Array<{ ratio: AspectRatio; value: number }> = [
      { ratio: AspectRatio.SQUARE, value: 1 / 1 },
      { ratio: AspectRatio.PORTRAIT_3_4, value: 3 / 4 },
      { ratio: AspectRatio.PORTRAIT_4_5, value: 4 / 5 },
      { ratio: AspectRatio.PORTRAIT_9_16, value: 9 / 16 },
      { ratio: AspectRatio.PORTRAIT_9_21, value: 9 / 21 },
      { ratio: AspectRatio.PORTRAIT_2_3, value: 2 / 3 },
      { ratio: AspectRatio.LANDSCAPE_4_3, value: 4 / 3 },
      { ratio: AspectRatio.LANDSCAPE_5_4, value: 5 / 4 },
      { ratio: AspectRatio.LANDSCAPE_16_9, value: 16 / 9 },
      { ratio: AspectRatio.LANDSCAPE_21_9, value: 21 / 9 },
      { ratio: AspectRatio.LANDSCAPE_3_2, value: 3 / 2 }
    ];

    let best = targets[0];
    let minDiff = Infinity;
    targets.forEach(t => {
      const diff = Math.abs(t.value - ratio);
      if (diff < minDiff) {
        minDiff = diff;
        best = t;
      }
    });
    return best.ratio;
  }, []);

  const parseImageDimensions = useCallback((dimensions?: string | null) => {
    if (!dimensions) return undefined;

    const match = dimensions.match(/(\d+)\s*[xX]\s*(\d+)/);
    if (!match) return undefined;

    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height) {
      return undefined;
    }

    return { width, height };
  }, []);

  const updateImageNodeDisplayMeta = useCallback((id: string, dimensions: string) => {
    const parsedDimensions = parseImageDimensions(dimensions);
    if (!parsedDimensions) {
      updateImageNodeDimensions(id, dimensions);
      return;
    }

    const { width, height } = parsedDimensions;
    const maxDim = Math.max(width, height);
    const effectiveSize = maxDim > 3000 ? ImageSize.SIZE_4K : maxDim > 1500 ? ImageSize.SIZE_2K : ImageSize.SIZE_1K;
    const inferredRatio = inferAspectRatioFromDimensions(width, height);

    updateImageNode(id, {
      dimensions,
      imageSize: effectiveSize,
      aspectRatio: inferredRatio,
      exactDimensions: { width, height }
    });
  }, [inferAspectRatioFromDimensions, parseImageDimensions, updateImageNode, updateImageNodeDimensions]);

  const extractErrorDetails = useCallback((error: any, fallbackModel?: string) => {
    const details = {
      code: error?.code ? String(error.code) : undefined,
      status: typeof error?.status === 'number' ? error.status : (typeof error?.response?.status === 'number' ? error.response.status : undefined),
      requestPath: error?.requestPath ? String(error.requestPath) : (error?.request?.path ? String(error.request.path) : undefined),
      requestBody: undefined as string | undefined,
      responseBody: undefined as string | undefined,
      provider: error?.provider ? String(error.provider) : undefined,
      model: fallbackModel,
      timestamp: Date.now()
    };

    if (error?.requestBody) {
      details.requestBody = typeof error.requestBody === 'string' ? error.requestBody : JSON.stringify(error.requestBody, null, 2);
    } else if (error?.request?.body) {
      details.requestBody = typeof error.request.body === 'string' ? error.request.body : JSON.stringify(error.request.body, null, 2);
    }

    if (error?.responseBody) {
      details.responseBody = typeof error.responseBody === 'string' ? error.responseBody : JSON.stringify(error.responseBody, null, 2);
    } else if (error?.response?.data) {
      details.responseBody = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data, null, 2);
    }

    if (error?.message && !details.responseBody) {
      details.responseBody = String(error.message);
    }

    if (!details.code && !details.status && !details.requestPath && !details.requestBody && !details.responseBody && !details.provider) {
      return undefined;
    }
    return details;
  }, []);

  const parsePptOutlineLine = useCallback((raw?: string) => {
    const text = String(raw || '').trim();
    if (!text) return { title: '', subtitle: '' };

    const splitBy = (token: string) => {
      const idx = text.indexOf(token);
      if (idx <= 0) return null;
      const title = text.slice(0, idx).trim();
      const subtitle = text.slice(idx + token.length).trim();
      return { title, subtitle };
    };

    const byColon = splitBy('：') || splitBy(':');
    if (byColon) return byColon;

    const byDash = splitBy(' - ') || splitBy(' — ') || splitBy(' – ');
    if (byDash) return byDash;

    return { title: text, subtitle: '' };
  }, []);

  const buildPptPageAlias = useCallback((raw: string | undefined, pageIndex: number) => {
    const parsed = parsePptOutlineLine(raw);
    const title = parsed.title || parsed.subtitle || String(raw || '').trim();
    return title || `第 ${pageIndex + 1} 页`;
  }, [parsePptOutlineLine]);

  function getOrderedPptPreviewBundle(imageId: string) {
    const canvas = activeCanvasRef.current;
    if (!canvas) return null;

    const target = canvas.imageNodes.find((img) => img.id === imageId);
    if (!target || target.mode !== GenerationMode.PPT || !target.parentPromptId) {
      return null;
    }

    const promptNode = canvas.promptNodes.find((node) => node.id === target.parentPromptId);
    if (!promptNode) return null;

    const orderedIds = (promptNode.childImageIds || []).filter(Boolean) as string[];
    const fallbackOrder = sortPptImageNodes(
      canvas.imageNodes.filter((img) => img.parentPromptId === promptNode.id),
    ).map((img) => img.id);
    const finalOrder = orderedIds.length > 0 ? orderedIds : fallbackOrder;

    const images = finalOrder
      .map((id) => canvas.imageNodes.find((img) => img.id === id))
      .filter((img): img is GeneratedImage => !!img);

    if (images.length === 0) return null;

    const currentIndex = Math.max(0, images.findIndex((img) => img.id === imageId));
    return {
      promptNode,
      images,
      currentIndex,
    };
  }

  const getOrderedPptNodeBundle = useCallback((nodeOrId: PromptNode | string) => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return null;

    const promptNode = typeof nodeOrId === 'string'
      ? canvas.promptNodes.find((node) => node.id === nodeOrId)
      : canvas.promptNodes.find((node) => node.id === nodeOrId.id) || nodeOrId;

    if (!promptNode || promptNode.mode !== GenerationMode.PPT) return null;

    const orderedIds = (promptNode.childImageIds || []).filter(Boolean) as string[];
    const fallbackImages = sortPptImageNodes(
      canvas.imageNodes.filter((img) => img.parentPromptId === promptNode.id),
    );

    const images = orderedIds.length > 0
      ? orderedIds
          .map((id) => canvas.imageNodes.find((img) => img.id === id))
          .filter((img): img is GeneratedImage => !!img)
      : fallbackImages;

    if (images.length === 0) return null;

    return {
      promptNode,
      images,
    };
  }, []);

  const handleOpenPptDeckEditor = useCallback((nodeOrId: PromptNode | string, initialIndex = 0) => {
    const bundle = getOrderedPptNodeBundle(nodeOrId);
    if (!bundle) return;

    setPptDeckEditor({
      nodeId: bundle.promptNode.id,
      initialIndex: Math.max(0, Math.min(initialIndex, bundle.images.length - 1)),
    });
  }, [getOrderedPptNodeBundle]);

  const handleOpenPptDeckEditorFromImage = useCallback((image: GeneratedImage) => {
    const bundle = getOrderedPptPreviewBundle(image.id);
    if (!bundle) return;
    handleOpenPptDeckEditor(bundle.promptNode, bundle.currentIndex);
  }, [getOrderedPptPreviewBundle, handleOpenPptDeckEditor]);

  const handleSavePptEditablePages = useCallback((nodeId: string, pages: PptEditablePage[]) => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    const promptNode = canvas.promptNodes.find((node) => node.id === nodeId);
    if (!promptNode) return;

    const nextSlides = syncPptSlidesFromEditablePages(pages);
    updatePromptNode({
      ...promptNode,
      pptEditablePages: pages,
      pptSlides: nextSlides,
      parallelCount: Math.max(promptNode.parallelCount || 1, nextSlides.length || 1),
    });

    const bundle = getOrderedPptNodeBundle(nodeId);
    bundle?.images.forEach((image, index) => {
      const alias = buildPptPageAlias(nextSlides[index], index);
      updateImageNode(image.id, { alias });
    });

    setPreviewImages((prev) => {
      if (!prev) return prev;
      return prev.map((image, index) => {
        const alias = nextSlides[index] ? buildPptPageAlias(nextSlides[index], index) : image.alias;
        return alias ? { ...image, alias } : image;
      });
    });

    setPptStackPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        images: prev.images.map((image, index) => {
          const alias = nextSlides[index] ? buildPptPageAlias(nextSlides[index], index) : image.alias;
          return alias ? { ...image, alias } : image;
        }),
      };
    });

    import('./services/system/notificationService').then(({ notify }) => {
      notify.success(
        pickByDocumentLanguage('页面包已更新', 'Deck updated'),
        pickByDocumentLanguage(
          `已保存 ${pages.length} 页可编辑 PPT 页面。`,
          `Saved ${pages.length} editable PPT page${pages.length === 1 ? '' : 's'}.`
        )
      );
    });
  }, [buildPptPageAlias, getOrderedPptNodeBundle, updateImageNode, updatePromptNode]);

  const getPptEditableExportBundle = useCallback((node: PromptNode) => {
    const bundle = getOrderedPptNodeBundle(node);
    if (!bundle) return null;

    const images = bundle.images.slice(0, 20);
    const pages = buildPptEditablePages(bundle.promptNode, images);

    return {
      promptNode: bundle.promptNode,
      images,
      pages,
      imageById: new Map(images.map((image) => [image.id, image] as const)),
    };
  }, [getOrderedPptNodeBundle]);

  const sanitizePptFileSegment = useCallback((value: string, fallback: string) => {
    const normalized = String(value || '')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    return normalized || fallback;
  }, []);

  const resolvePptImageBlob = useCallback(async (image: GeneratedImage): Promise<Blob> => {
    const { getStrictOriginalImage } = await import('./services/storage/imageStorage');
    const { base64ToBlob } = await import('./utils/downloadUtils');

    let source = await getStrictOriginalImage(image.id);
    if (!source && image.storageId && image.storageId !== image.id) {
      source = await getStrictOriginalImage(image.storageId);
    }
    if (!source) {
      source = image.originalUrl || image.url;
    }
    if (!source) {
      throw new Error('未找到可用的图片源');
    }

    if (source.startsWith('data:')) {
      return base64ToBlob(source);
    }
    if (source.startsWith('blob:')) {
      const response = await fetch(source);
      if (!response.ok) throw new Error('无法读取本地图片数据');
      return await response.blob();
    }

    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`下载图片失败：HTTP ${response.status}`);
    }
    return await response.blob();
  }, []);

  const renderBlobIntoImage = useCallback((blob: Blob) => (
    new Promise<HTMLImageElement>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('图片解码失败'));
      };
      image.src = objectUrl;
    })
  ), []);

  const convertBlobToPng = useCallback(async (blob: Blob) => {
    const image = await renderBlobIntoImage(blob);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('无法创建导出画布');
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png', 1);
    });

    if (!pngBlob) {
      throw new Error('无法转换图片格式');
    }

    return pngBlob;
  }, [renderBlobIntoImage]);

  const resolvePptExportImageAsset = useCallback(async (image: GeneratedImage) => {
    const blob = await resolvePptImageBlob(image);
    const type = String(blob.type || '').toLowerCase();

    if (type.includes('png')) {
      return { blob, ext: 'png' as const, mime: 'image/png' };
    }
    if (type.includes('jpeg') || type.includes('jpg')) {
      return { blob, ext: 'jpg' as const, mime: 'image/jpeg' };
    }

    const pngBlob = await convertBlobToPng(blob);
    return { blob: pngBlob, ext: 'png' as const, mime: 'image/png' };
  }, [convertBlobToPng, resolvePptImageBlob]);

  const renderPptEditablePagePreviewBlob = useCallback(async (
    page: PptEditablePage,
    imageById: Map<string, GeneratedImage>,
  ) => {
    const canvas = document.createElement('canvas');
    canvas.width = PPT_EDITABLE_CANVAS.width;
    canvas.height = PPT_EDITABLE_CANVAS.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('无法创建页面预览画布');
    }

    context.fillStyle = '#020617';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textBaseline = 'top';

    const normalizeColor = (value?: string, fallback = '#FFFFFF') => {
      const raw = String(value || '').trim();
      if (/^#[0-9a-fA-F]{3}$/.test(raw) || /^#[0-9a-fA-F]{6}$/.test(raw)) {
        return raw;
      }
      return fallback;
    };

    for (const layer of sortPptLayers(page.layers)) {
      if (!layer.visible) continue;

      if (layer.type === 'image') {
        const sourceImageId = layer.imageNodeId || page.backgroundImageId;
        const sourceImage = sourceImageId ? imageById.get(sourceImageId) : undefined;
        const sourceBlob = sourceImage ? await resolvePptImageBlob(sourceImage) : null;
        const imageElement = sourceBlob ? await renderBlobIntoImage(sourceBlob) : null;

        if (!imageElement) continue;

        context.save();
        context.globalAlpha = Math.max(0, Math.min(1, layer.opacity ?? 1));
        context.drawImage(imageElement, layer.x, layer.y, layer.width, layer.height);
        context.restore();
        continue;
      }

      if (!layer.text.trim()) continue;

      const backgroundOpacity = Math.max(0, Math.min(1, (layer.backgroundOpacity ?? 0) * (layer.opacity ?? 1)));
      if (layer.backgroundColor && backgroundOpacity > 0) {
        context.save();
        context.globalAlpha = backgroundOpacity;
        context.fillStyle = normalizeColor(layer.backgroundColor, '#111827');
        context.fillRect(layer.x, layer.y, layer.width, layer.height);
        context.restore();
      }

      const paddingX = 24;
      const paddingY = 18;
      const availableWidth = Math.max(0, layer.width - paddingX * 2);
      const lines = layer.text.split(/\r?\n/);

      context.save();
      context.globalAlpha = Math.max(0, Math.min(1, layer.opacity ?? 1));
      context.fillStyle = normalizeColor(layer.color, '#FFFFFF');
      context.font = `${layer.fontWeight || 500} ${layer.fontSize}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
      context.textAlign = layer.align || 'left';

      const baseX = layer.align === 'center'
        ? layer.x + layer.width / 2
        : layer.align === 'right'
          ? layer.x + layer.width - paddingX
          : layer.x + paddingX;
      const lineHeight = Math.round(layer.fontSize * 1.3);

      lines.forEach((line, lineIndex) => {
        const y = layer.y + paddingY + lineIndex * lineHeight;
        if (y > layer.y + layer.height - lineHeight) return;
        const text = line || ' ';

        if (availableWidth > 0 && context.measureText(text).width > availableWidth && layer.align !== 'center') {
          context.save();
          context.beginPath();
          context.rect(layer.x + paddingX, layer.y + paddingY, availableWidth, layer.height - paddingY * 2);
          context.clip();
          context.fillText(text, baseX, y);
          context.restore();
        } else {
          context.fillText(text, baseX, y);
        }
      });

      context.restore();
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png', 1);
    });

    if (!blob) {
      throw new Error('无法生成页面预览');
    }

    return blob;
  }, [renderBlobIntoImage, resolvePptImageBlob]);

  const stitchPptImagesToBlob = useCallback(async (images: GeneratedImage[]) => {
    const loaded = await Promise.all(images.map(async (image) => {
      const blob = await resolvePptImageBlob(image);
      const objectUrl = URL.createObjectURL(blob);
      try {
        const element = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('图片加载失败'));
          img.src = objectUrl;
        });
        return {
          width: element.naturalWidth,
          height: element.naturalHeight,
          element,
        };
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }));

    const maxWidth = Math.max(...loaded.map((item) => item.width));
    const scaledHeights = loaded.map((item) => Math.round(item.height * (maxWidth / item.width)));
    const rawTotalHeight = scaledHeights.reduce((sum, value) => sum + value, 0);
    const maxCanvasHeight = 32000;
    const downscale = rawTotalHeight > maxCanvasHeight ? maxCanvasHeight / rawTotalHeight : 1;
    const targetWidth = Math.max(1, Math.round(maxWidth * downscale));
    const finalHeights = scaledHeights.map((value) => Math.max(1, Math.round(value * downscale)));
    const totalHeight = finalHeights.reduce((sum, value) => sum + value, 0);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = totalHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('无法创建整屏导出画布');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    let offsetY = 0;
    loaded.forEach((item, index) => {
      const height = finalHeights[index];
      context.drawImage(item.element, 0, offsetY, targetWidth, height);
      offsetY += height;
    });

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png', 1);
    });

    if (!blob) {
      throw new Error('整屏导出失败');
    }

    return blob;
  }, [resolvePptImageBlob]);

  const handleOpenPptStackPreview = useCallback((imageId: string) => {
    const bundle = getOrderedPptPreviewBundle(imageId);
    if (!bundle) return;

    setPptStackPreview({
      images: bundle.images,
      initialIndex: bundle.currentIndex,
    });
  }, [getOrderedPptPreviewBundle]);

  const handleDownloadPptComposite = useCallback(async (imageId: string) => {
    const bundle = getOrderedPptPreviewBundle(imageId);
    if (!bundle) return;

    try {
      const blob = await stitchPptImagesToBlob(bundle.images);
      saveAs(blob, `ppt-full-screen-${Date.now()}.png`);
      import('./services/system/notificationService').then(({ notify }) => {
        notify.success('导出完成', `已导出 ${bundle.images.length} 页整屏长图`);
      });
    } catch (error: any) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.error('整屏导出失败', error?.message || '请稍后重试');
      });
    }
  }, [getOrderedPptPreviewBundle, stitchPptImagesToBlob]);

  const handleEditPptTextFromLightbox = useCallback((image: GeneratedImage) => {
    const bundle = getOrderedPptPreviewBundle(image.id);
    if (!bundle) return;

    const currentText = bundle.promptNode.pptSlides?.[bundle.currentIndex]
      || image.alias
      || buildPptPageAlias(undefined, bundle.currentIndex);
    const nextText = window.prompt(`编辑第 ${bundle.currentIndex + 1} 页文字`, currentText);
    if (nextText === null) return;

    const trimmed = nextText.trim();
    if (!trimmed) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.warning('内容为空', '请输入当前页面的标题或描述');
      });
      return;
    }

    const nextSlides = [...(bundle.promptNode.pptSlides || [])];
    while (nextSlides.length < bundle.images.length) {
      nextSlides.push(buildPptPageAlias(undefined, nextSlides.length));
    }
    nextSlides[bundle.currentIndex] = trimmed;

    const nextPages = buildPptEditablePages(bundle.promptNode, bundle.images);
    const parsed = parsePptOutlineLine(trimmed);
    const currentPage = nextPages[bundle.currentIndex];
    if (currentPage) {
      let patchedPage = patchPptTextLayer(
        currentPage,
        'title',
        parsed.title || buildPptPageAlias(trimmed, bundle.currentIndex),
      );
      patchedPage = patchPptTextLayer(patchedPage, 'subtitle', parsed.subtitle || '');
      nextPages[bundle.currentIndex] = patchedPage;
    }

    updatePromptNode({
      ...bundle.promptNode,
      pptSlides: nextSlides,
      pptEditablePages: nextPages,
      parallelCount: Math.max(bundle.promptNode.parallelCount || 1, nextSlides.length),
    });

    updateImageNode(image.id, {
      alias: buildPptPageAlias(trimmed, bundle.currentIndex),
    });

    setPreviewImages((prev) => prev?.map((item) => (
      item.id === image.id
        ? { ...item, alias: buildPptPageAlias(trimmed, bundle.currentIndex) }
        : item
    )) || prev);

    setPptStackPreview((prev) => prev ? {
      ...prev,
      images: prev.images.map((item) => (
        item.id === image.id
          ? { ...item, alias: buildPptPageAlias(trimmed, bundle.currentIndex) }
          : item
      )),
    } : prev);

    import('./services/system/notificationService').then(({ notify }) => {
      notify.success('页面文案已更新', `第 ${bundle.currentIndex + 1} 页已同步到主卡设置`);
    });
  }, [buildPptPageAlias, getOrderedPptPreviewBundle, parsePptOutlineLine, updateImageNode, updatePromptNode]);

  const getNodeIoTrace = useCallback((nodeId: string) => {
    const node = activeCanvas?.promptNodes.find(n => n.id === nodeId);
    const inputStorageIds = (node?.referenceImages || []).map(ref => ref.storageId || ref.id).filter(Boolean) as string[];
    const outputStorageIds = (activeCanvas?.imageNodes || [])
      .filter(img => img.parentPromptId === nodeId)
      .map(img => img.storageId || img.id)
      .filter(Boolean) as string[];
    return { inputStorageIds, outputStorageIds };
  }, [activeCanvas]);


  // Extracted Execution Logic

  const handleGenerate = useCallback(async (promptOverride?: string) => {
    const now = Date.now();
    const cooldownRemaining = GENERATE_TRIGGER_COOLDOWN_MS - (now - lastGenerateAtRef.current);
    if (cooldownRemaining > 0) {
      console.warn('[handleGenerate] blocked duplicate trigger');
      return;
    }
    const promptText = promptOverride ?? config.prompt;
    const trimmedPrompt = promptText.trim();
    if (!trimmedPrompt) return;
    const submitSignature = JSON.stringify({
      prompt: trimmedPrompt,
      model: config.model,
      mode: config.mode,
      aspectRatio: config.aspectRatio,
      imageSize: config.imageSize,
      parallelCount: config.parallelCount || 1,
      sourceImageId: activeSourceImage || '',
      referenceImages: (config.referenceImages || [])
        .map(img => img.id || img.storageId || img.url || '')
        .sort()
    });
    const lastSignature = lastGenerateSignatureRef.current;
    if (lastSignature && lastSignature.value === submitSignature && (now - lastSignature.at) < GENERATE_SIGNATURE_DEDUP_MS) {
      console.warn('[handleGenerate] blocked repeated identical submission');
      import('./services/system/notificationService').then(({ notify }) => {
        notify.warning('已拦截重复发送', '检测到相同内容短时间内重复提交，已阻止再次请求以避免重复扣费。');
      });
      return;
    }
    lastGenerateAtRef.current = now;
    lastGenerateSignatureRef.current = { value: submitSignature, at: now };

    // Real billing guard and deduction flow
    // Route-aware billing: when the request resolves to a user-owned key/channel,
    // it must never enter the system-credit deduction flow.
    const provider = config.model.includes('@') ? config.model.split('@')[1] : undefined;
    const customLocal = (() => {
      try {
        return JSON.parse(localStorage.getItem('kk_model_customizations') || '{}')[config.model] || {};
      } catch { return {}; }
    })();

    const hasCustomUserKey = keyManager.hasCustomKeyForModel(config.model);
    const preferredKeyIdForBilling = hasExplicitModelRoute(config.model)
      ? undefined
      : getPreferredKeyForMode(config.mode);
    const selectedKeyForBilling = keyManager.getNextKey(config.model, preferredKeyIdForBilling);
    const isCreditModel = isCreditBasedModel(
      config.model,
      provider,
      customLocal.alias,
      hasCustomUserKey,
      selectedKeyForBilling?.id || preferredKeyIdForBilling,
    );

    console.log('[handleGenerate] 计费检查', {
      model: config.model,
      provider,
      selectedKeyId: selectedKeyForBilling?.id,
      hasCustomUserKey,
      isCreditModel,
      mode: config.mode
    });

    let requiredCredits = 0;
    let perImageCreditCost = 0;
    let paymentTransactionId: string | undefined = undefined;
    const useServerSideCreditSettlement = isCreditModel && isSystemModelRoute(config.model);
    if (isCreditModel) {
      if (authLoading) {
        import('./services/system/notificationService').then(({ notify }) => {
          notify.info('账号状态确认中', '正在校验登录状态，请稍后再试。');
        });
        return;
      }

      if (!user || isTempUser) {
        import('./services/system/notificationService').then(({ notify }) => {
          notify.error('请先登录', '管理员配置的积分模型需要登录账号后使用积分调用。');
        });
        return;
      }

      perImageCreditCost = resolveCreditCostForModel(config.model, config.imageSize);
      if (config.mode === GenerationMode.IMAGE || config.mode === GenerationMode.PPT) {
        requiredCredits = (config.parallelCount || 1) * perImageCreditCost;
      } else {
        requiredCredits = perImageCreditCost || 1;
      }

      if (requiredCredits > 0 && billingLoading) {
        import('./services/system/notificationService').then(({ notify }) => {
          notify.info('余额同步中', '正在刷新账户余额，请稍后重试。');
        });
        return;
      }
      if (requiredCredits > 0 && balance < requiredCredits) {
        import('./services/system/notificationService').then(({ notify }) => {
          notify.error('生成失败', '您的账户余额不足，请先充值积分。');
        });
        setShowRechargeModal(true);
        return;
      }

      // Non-system routed credit models still use the legacy client-side pre-charge flow
      if (requiredCredits > 0 && !useServerSideCreditSettlement) {
        console.log('[handleGenerate] 准备扣费:', { model: config.model, requiredCredits });
        const chargeResult = await consumeCreditsDetailed(config.model, requiredCredits, {
          feature: `模型调用：${config.model}`,
          modelName: config.model,
          providerId: provider || 'managed',
          provider,
        });
        console.log('[handleGenerate] 扣费结果:', { chargeResult });
        if (!chargeResult.success) {
          import('./services/system/notificationService').then(({ notify }) => {
            notify.error('生成失败', '您的账户余额不足，请先充值积分。');
          });
          setShowRechargeModal(true); // Automatically open the recharge modal
          return;
        }
        paymentTransactionId = chargeResult.transactionId;
      }
    }
    // setIsGenerating(true); // Removed, handled by hook
    try {

      // 4. Calculate Position
      // Normal mode uses the current viewport center; follow-up mode keeps the existing linked placement flow.
      const isFollowUp = !!activeSourceImage;
      const currentTransform = canvasRef.current?.getCurrentTransform() || canvasTransform;
      const viewportRect = canvasRef.current?.getCanvasRect() || null;
      const viewportOffsets = getViewportOffsets(isSidebarOpen, isChatOpen, isMobile, chatSidebarWidth);
      const liveCenter = getPromptBarFrontPosition(currentTransform, viewportRect, viewportOffsets, 200, 48);
      const realViewCenter = liveCenter;
      let viewCenter = { ...liveCenter };
      let currentPos = { ...viewCenter };

      // [Draft Logic] Use existing draft only for follow-up mode.
      // Normal mode must always lock to the current viewport center.
      const canvasNow = activeCanvasRef.current;
      let promptNodeId = draftNodeId;
      let isReusingDraft = false;

      if (!isFollowUp) {
        promptNodeId = `node_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
        currentPos = { ...liveCenter };
        isReusingDraft = false;
        console.log('[handleGenerate] Normal mode - locked to current viewport center:', currentPos);
      } else if (promptNodeId) {
        // We have a draft. Use it.
        const draft = canvasNow?.promptNodes.find(n => n.id === promptNodeId);
        if (draft) {
          isReusingDraft = true;
          currentPos = draft.position;

          // 🎯 [Smart Re-centering Fix]
          // If the draft is an auto-center draft (not moved by user), FORCE it to stay at the REAL center
          // during the final generation calculation, even if the canvas was panned just now.
          const shouldAutoCenter = !draft.userMoved && !draft.sourceImageId && !draft.isGenerating;

          if (shouldAutoCenter) {
            console.log('[handleGenerate] Auto-centering draft to latest viewCenter for precise placement');
            currentPos = { ...viewCenter };
          } else {
            // 🎯 [Auto-Center Fallback] If draft is off-screen, snap it to current view center
            // This fixes the issue where users pan away from a draft and then generate, causing the result to be "lost"
            // Use the live transform, including any in-progress drag offset.
            const currentTransformForVisibility = canvasRef.current?.getCurrentTransform() || canvasTransform;
            const vLeft = -currentTransformForVisibility.x / currentTransformForVisibility.scale;
            const vTop = -currentTransformForVisibility.y / currentTransformForVisibility.scale;
            const vWidth = window.innerWidth / currentTransformForVisibility.scale;
            const vHeight = window.innerHeight / currentTransformForVisibility.scale;

            // Margin of error (e.g. 100px)
            const margin = 100;
            const isVisible =
              currentPos.x >= vLeft - margin &&
              currentPos.x <= vLeft + vWidth + margin &&
              currentPos.y >= vTop - margin &&
              currentPos.y <= vTop + vHeight + margin;

            if (!isVisible) {
              console.warn('[handleGenerate] Draft is off-screen, moving to center:', {
                currentPos,
                viewCenter,
                viewport: { vLeft, vRight: vLeft + vWidth, vTop, vBottom: vTop + vHeight }
              });
              currentPos = { ...viewCenter };
            } else {
              console.log('[handleGenerate] Reusing draft at position (Visible):', currentPos);
            }
          }

          // 🎯 [Collision Check] Ensure draft doesn't overlap others
          const freshCanvas = activeCanvasRef.current; // Use Ref for fresh state
          const now = Date.now();

          // [Rapid-Fire] Prune old reserved regions (>3s)
          reservedRegionsRef.current = reservedRegionsRef.current.filter(r => now - r.timestamp < 3000);

          const otherNodes = [
            ...(freshCanvas?.promptNodes || [])
              .filter(n => n.id !== draft.id)
              .map(n => ({ x: n.position.x, y: n.position.y, width: n.width || 380, height: n.height || 200 })),
            ...(freshCanvas?.imageNodes || []).map(n => {
              const { width, totalHeight } = getCardDimensions(n.aspectRatio, true);
              return { x: n.position.x, y: n.position.y, width, height: totalHeight };
            }),
            ...(reservedRegionsRef.current || []).map(r => ({ x: r.bounds.x, y: r.bounds.y, width: r.bounds.width, height: r.bounds.height }))
          ];

          // 🎯 [Fix] If reusing a draft (user placed), Respect its position! 
          // Only use safe-find for completely new/automatic generations.
          let safePos = currentPos;
          if (!isReusingDraft) {
            safePos = findSafePosition(currentPos, otherNodes);
          } else {
            // Ensure we are snapping to integer coordinates for sharpness
            safePos = { x: Math.round(currentPos.x), y: Math.round(currentPos.y) };
          }

          // 🎯 Always reserve the FINAL position (whether shifted or not)
          reservedRegionsRef.current.push({
            timestamp: now,
            bounds: { x: safePos.x, y: safePos.y, width: 380, height: 200 }
          });

          if (safePos.x !== currentPos.x || safePos.y !== currentPos.y) {
            console.log('[handleGenerate] Draft collision detected, shifting to:', safePos);
            // Persist the shifted position to canvas state so it cannot jump back or collide with the next card
            updatePromptNode({ ...draft, position: safePos });
            currentPos = safePos;
          }
        } else {
          // Draft ID stale?
          promptNodeId = `node_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
          console.log('[handleGenerate] Creating new node at view center (Stale ID):', currentPos);
        }
      } else {
        // Follow-up mode but no draft id: create a new node at computed center/path
        promptNodeId = `node_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
        console.log('[handleGenerate] Follow-up mode without draft, using computed center:', currentPos);
      }

      // setDraftNodeId(null); // Moved to end to prevent flicker

      // Legacy calculation reference, but we used currentPos above.
      const promptHeight = getPromptHeight(promptText);

      // 🚀 [Performance Fix] 立即创建卡片，参考图异步加载
      // 先使用现有的参考图数据（可能有 storageId 但没有 data），在 executeGeneration 中再加载
      let finalReferenceImages = config.referenceImages.map(img => ({ ...img }));

      // 如果有源图片（追询模式），添加到参考图中
      if (activeSourceImage) {
        const sourceImage = activeCanvasRef.current?.imageNodes.find(img => img.id === activeSourceImage);
        const alreadyAdded = finalReferenceImages.some(ref => ref.id === sourceImage?.id);
        if (sourceImage && !alreadyAdded) {
          finalReferenceImages.push({
            id: sourceImage.id,
            data: '', // 在 executeGeneration 中异步加载
            storageId: sourceImage.storageId || sourceImage.id,
            mimeType: 'image/png'
          });
        }
      }

      // 🚀 异步保存参考图到 IDB（不阻塞）
      finalReferenceImages.forEach(ref => {
        if (ref.data) {
          import('./services/storage/imageStorage').then(({ saveImage }) => {
            const fullUrl = toReferenceImageDataUrl(ref.data, (ref as any).mimeType || 'image/png');
            const lookupIds = getReferenceImageLookupIds(ref);
            Promise.allSettled(lookupIds.map((lookupId) => saveImage(lookupId, fullUrl)))
              .catch(e => console.warn('Ref save failed', e));
          });
        }
      });

      // 🎯 Final hard-guard: in normal mode, always lock to CURRENT viewport center at click-time
      // This prevents any stale draft/canvas closure from pulling position back to initial canvas.
      if (!isFollowUp) {
        const latestTransform = canvasRef.current?.getCurrentTransform() || canvasTransform;
        const latestViewportRect = canvasRef.current?.getCanvasRect() || null;
        const latestOffsets = getViewportOffsets(isSidebarOpen, isChatOpen, isMobile, chatSidebarWidth);
        currentPos = getPromptBarFrontPosition(latestTransform, latestViewportRect, latestOffsets, 200, 48);
        console.log('[handleGenerate] Final position hard-guard (normal mode):', currentPos);
      }

      const isNewAnim = true; // 🎯 Always set for standard generation

      const rawPrompt = trimmedPrompt;
      let optimizedPromptEn: string | undefined;
      let optimizedPromptZh: string | undefined;
      let promptOptimizerResult: any | undefined; // Store the full prompt-optimizer result

      if ((config.mode === GenerationMode.IMAGE || config.mode === GenerationMode.PPT) && config.enablePromptOptimization && rawPrompt) {
        try {
          const selectedOptimizerTemplate = getPromptOptimizerTemplate(config.promptOptimizationTemplateId, config.mode);
          const optimizationMode = config.promptOptimizationMode || 'auto';
          const optimizationPrompt = [
            selectedOptimizerTemplate?.instruction || '',
            optimizationMode === 'custom' ? (config.promptOptimizationCustomPrompt || '').trim() : ''
          ]
            .filter(Boolean)
            .join('\n');
          const optimized = await optimizePromptForImage(rawPrompt, {
            preferredModelId: config.model,
            aspectRatio: config.aspectRatio,
            imageSize: config.imageSize,
            mode: config.mode,
            optimizationMode,
            optimizationTemplateId: selectedOptimizerTemplate?.id,
            optimizationTemplateTitle: selectedOptimizerTemplate?.title,
            optimizationPrompt,
            supportsThinking: !!getModelCapabilities(config.model)?.supportsThinking,
            thinkingMode: config.thinkingMode || 'minimal',
            referenceImages: finalReferenceImages
              .filter(ref => ref.data)
              .map(ref => {
                const mime = (ref as any).mimeType || 'image/png';
                let base64Data = ref.data!;
                if (base64Data.startsWith('data:')) {
                  const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
                  if (match) {
                    base64Data = match[2];
                  }
                }
                return { mimeType: mime, data: base64Data };
              })
          });
          optimizedPromptEn = optimized.optimizedEn;
          optimizedPromptZh = optimized.optimizedZh;
          promptOptimizerResult = optimized.fullResult; // Capture the full prompt-optimizer result
        } catch (e: any) {
          console.warn('[handleGenerate] Prompt optimization failed, fallback to raw prompt:', e);
          import('./services/system/notificationService').then(({ notify }) => {
            notify.error('提示词优化失败', '无法调用对话模型，已自动降级为原始提示词：' + (e.message || ''));
          });
        }
      }

      const baseModelIdForPreview = config.model.split('@')[0];
      const modelSuffixForPreview = config.model.split('@')[1];
      const previewModelMeta = keyManager.getGlobalModelList().find((model) => model.id === config.model);
      const previewSystemDisplay = previewModelMeta?.isSystemInternal
        ? adminModelService.getModelDisplayInfo(config.model, config.imageSize)
        : null;
      const previewModelLabel = previewSystemDisplay?.displayName || resolveModelDisplayName(
        config.model,
        previewModelMeta?.name || getModelMetadata(config.model)?.name || baseModelIdForPreview,
      );
      const selectedKey = useServerSideCreditSettlement
        ? null
        : selectedKeyForBilling;
      const previewProvider = useServerSideCreditSettlement
        ? 'SystemProxy'
        : (selectedKey?.provider || previewModelMeta?.provider || (modelSuffixForPreview ? 'Custom' : 'Google'));
      const previewProviderLabel = useServerSideCreditSettlement
        ? (previewSystemDisplay?.providerName || previewSystemDisplay?.provider || previewModelMeta?.providerLabel || 'System Proxy')
        : (selectedKey?.name || previewModelMeta?.providerLabel || modelSuffixForPreview || 'Google');
      const pptCount = config.mode === GenerationMode.PPT
        ? Math.min(20, Math.max(1, config.parallelCount || 1))
        : Math.min(4, Math.max(1, config.parallelCount || 1));
      const normalizedSlides = (config.pptSlides || []).map(s => String(s || '').trim()).filter(Boolean);
      const effectivePptSlides = config.mode === GenerationMode.PPT
        ? normalizePptSlidesForCount(normalizedSlides, rawPrompt, pptCount)
        : [];

      const generatingNode: PromptNode = {
        id: promptNodeId!,
        prompt: rawPrompt,
        originalPrompt: rawPrompt,
        optimizedPromptEn,
        optimizedPromptZh,
        promptOptimizerResult, // Store the full prompt-optimizer result
        promptOptimizationEnabled: !!(config.enablePromptOptimization && (optimizedPromptEn || promptOptimizerResult)),
        position: currentPos,
        aspectRatio: config.aspectRatio,
        imageSize: config.imageSize,
        model: config.model,
        modelLabel: previewModelLabel,
        modelColorStart: previewModelMeta?.colorStart,
        modelColorEnd: previewModelMeta?.colorEnd,
        modelColorSecondary: previewModelMeta?.colorSecondary,
        modelTextColor: previewModelMeta?.textColor,
        thinkingMode: config.thinkingMode || 'minimal',
        enableGrounding: !!config.enableGrounding,
        enableImageSearch: !!config.enableImageSearch,
        provider: previewProvider,
        providerLabel: previewProviderLabel,
        keySlotId: useServerSideCreditSettlement ? 'system_proxy_slot' : selectedKey?.id,
        childImageIds: [],
        lastGenerationSuccessCount: undefined,
        lastGenerationFailCount: undefined,
        lastGenerationTotalCount: undefined,
        referenceImages: finalReferenceImages,
        timestamp: Date.now(),
        isGenerating: true,
        error: undefined,
        errorDetails: undefined,
        refundStatus: undefined,
        creditSettlement: useServerSideCreditSettlement ? 'server' : 'client',
        paymentTransactionId,
        isNew: isNewAnim, // Mark the node as newly created so the launch animation can run.
        parallelCount: pptCount,
        sourceImageId: activeSourceImage || undefined,
        mode: config.mode,
        isDraft: false, // Ensure it is NOT a draft anymore
        videoResolution: config.videoResolution,
        videoDuration: config.videoDuration,
        videoAudio: config.videoAudio,
        pptSlides: effectivePptSlides,
        pptStyleLocked: config.pptStyleLocked !== false,
        cost: requiredCredits,
        billingMode: isCreditModel ? 'credits' : 'currency',
        creditCost: isCreditModel ? perImageCreditCost : undefined,
        isPaymentProcessed: requiredCredits > 0 && !useServerSideCreditSettlement,
        generationMetadata: {
          pendingTaskIds: [],
        },
      };

      // 🎯 [Fix Duplicate Placeholders]
      // Always check if the ID we are about to add/update actually exists on canvas
      // If not, revert to add. If yes, update.
      const canvasForWrite = activeCanvasRef.current;
      const STACK_SHIFT_Y = 10;
      const STACK_MATCH_X = 36;
      const STACK_MATCH_Y = 120;

      const overlappingPromptGroups = (canvasForWrite?.promptNodes || [])
        .filter(node =>
          node.id !== generatingNode.id &&
          Math.abs(node.position.x - generatingNode.position.x) <= STACK_MATCH_X &&
          Math.abs(node.position.y - generatingNode.position.y) <= STACK_MATCH_Y
        )
        .sort((a, b) => b.position.y - a.position.y);

      const promptUpdates: { id: string, updates: Partial<PromptNode> }[] = [];
      const imageUpdates: { id: string, updates: Partial<GeneratedImage> }[] = [];

      overlappingPromptGroups.forEach((node) => {
        promptUpdates.push({
          id: node.id,
          updates: {
            position: {
              ...node.position,
              y: node.position.y - STACK_SHIFT_Y,
            }
          }
        });

        (canvasForWrite?.imageNodes || [])
          .filter(img => img.parentPromptId === node.id)
          .forEach((img) => {
            imageUpdates.push({
              id: img.id,
              updates: {
                position: {
                  ...img.position,
                  y: img.position.y - STACK_SHIFT_Y,
                }
              }
            });
          });
      });

      if (promptUpdates.length > 0) {
        promptUpdates.forEach(({ id, updates }) => {
          const freshNode = activeCanvasRef.current?.promptNodes.find(n => n.id === id);
          if (freshNode) {
            updatePromptNode({ ...freshNode, ...updates });
          }
        });
      }

      if (imageUpdates.length > 0) {
        imageUpdates.forEach(({ id, updates }) => {
          if (updates.position) {
            updateImageNodePosition(id, updates.position, { ignoreSelection: true });
          } else {
            updateImageNode(id, updates);
          }
        });
      }

      const existingNode = canvasForWrite?.promptNodes.find(n => n.id === generatingNode.id);

      if (existingNode) {
        console.log('[handleGenerate] Updating existing node:', generatingNode.id);
        await updatePromptNode(generatingNode);
      } else {
        // Safety: Check if ANY draft exists that we might have missed (stale closure)
        const strayDraft = canvasForWrite?.promptNodes.find(n => n.isDraft);
        if (strayDraft) {
          console.log('[handleGenerate] Found stray draft during generation, converting it:', strayDraft.id);
          // Replace the stray draft's ID with our generating ID? 
          // Or just update the stray draft with our config?
          // Better to update the stray draft to avoid orphans.
          // IMPORTANT: keep the freshly calculated generation position (current viewport center in normal mode)
          // Do NOT reuse stray draft position, otherwise node may jump back to old/initial canvas location.
          const fusedNode = { ...generatingNode, id: strayDraft.id, position: generatingNode.position };
          await updatePromptNode(fusedNode);
          // Update our local ID reference for executeGeneration
          generatingNode.id = strayDraft.id;
        } else {
          console.log('[handleGenerate] Creating NEW node:', generatingNode.id);
          await addPromptNode(generatingNode);
          console.log('[handleGenerate] addPromptNode completed for:', generatingNode.id, 'isDraft:', generatingNode.isDraft);
        }
      }

      // 🎯 [Cleanup] Remove any OTHER drafts if they exist (duplicate prevention)
      // This is a safety measure - uncommented to fix orphan card issue
      const leftovers = canvasForWrite?.promptNodes.filter(n => n.isDraft && n.id !== generatingNode.id);
      if (leftovers && leftovers.length > 0) {
        console.log('[handleGenerate] Cleaning up orphan drafts:', leftovers.map(n => n.id));
        leftovers.forEach(n => deletePromptNode(n.id));
      }

      setDraftNodeId(null); // Detach status NOW that the node is updated in canvas
      setConfig(prev => ({ ...prev, prompt: '', referenceImages: [] }));
      setActiveSourceImage(null);

      // Execute immediately after save completed
      if (useServerSideCreditSettlement && requiredCredits > 0) {
        adjustBalanceOptimistically(-requiredCredits);
      }
      await executeGeneration(generatingNode);
    } catch (e: any) {
      console.error('[handleGenerate] failed:', e);
      import('./services/system/notificationService').then(({ notify }) => {
        notify.error('发送失败', e?.message || '请重试');
      });
    } finally {
      // executeGeneration manages isGenerating internally; avoid resetting it here.
      // Request throttling is controlled by lastGenerateAtRef instead of waiting for the full run to settle.
    }
  }, [config, draftNodeId, addPromptNode, updatePromptNode, updateImageNodePosition, updateImageNode, activeCanvas, activeSourceImage, canvasTransform, findNextGroupPosition, executeGeneration, getPromptHeight, isSidebarOpen, isChatOpen, isMobile, chatSidebarWidth, normalizePptSlidesForCount, getPreferredKeyForMode, consumeCreditsDetailed, balance, setShowRechargeModal, user, isTempUser, authLoading, adjustBalanceOptimistically, resolveCreditCostForModel, hasExplicitModelRoute]);

  // Handle reference images
  const handleFilesDrop = useCallback((files: File[]) => {
    if (files.length === 0) return;
    if (config.referenceImages.length + files.length > 5) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.warning('无法添加图片', '最多支持 5 张参考图');
      });
      files = files.slice(0, 5 - config.referenceImages.length);
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const matches = (reader.result as string).match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          setConfig(prev => ({
            ...prev,
            referenceImages: [...prev.referenceImages, {
              id: Date.now() + Math.random().toString(),
              data: matches[2],
              mimeType: matches[1]
            }]
          }));
        }
      };
      reader.readAsDataURL(file);
    });
  }, [config.referenceImages]);

  const handleConnectStart = useCallback((id: string, startPos: { x: number; y: number }) => {
    setDragConnection({
      active: true,
      startId: id,
      startPos,
      currentPos: startPos
    });
  }, []);

  const handleConnectEnd = useCallback((targetId: string) => {
    if (dragConnection?.active) {
      linkNodes(dragConnection.startId, targetId);
    }
    setDragConnection(null);
  }, [dragConnection, linkNodes]);

  // 鑷姩鏁寸悊锛氬鎵樼粰 CanvasContext
  const handleAutoArrange = useCallback(() => {
    arrangeAllNodes();
  }, [arrangeAllNodes]);

  // --- 连接管理 ---
  const handleCutConnection = useCallback((promptId: string, imageId: string) => {
    unlinkNodes(promptId, imageId);
  }, [unlinkNodes]);

  // 🎯 [Strict Logic] Disconnect Parent -> Child Group becomes Normal Group
  const handleDisconnectPrompt = useCallback((id: string) => {
    const node = activeCanvas?.promptNodes.find(n => n.id === id);
    if (node && node.sourceImageId) {
      updatePromptNode({ ...node, sourceImageId: undefined });

      // [Draft Logic] If disconnecting draft, clear global source state too
      if (node.id === draftNodeId) {
        setActiveSourceImage(null);
      }

      import('./services/system/notificationService').then(({ notify }) => {
        notify.success('已断开连接', '卡组已拆分为独立卡组');
      });
    }
  }, [activeCanvas, updatePromptNode, draftNodeId, setActiveSourceImage]);

  // 🎯 [Strict Logic] Pin Draft -> Create Lonely Main Card
  const handlePinDraft = useCallback((id: string, mode: 'button' | 'drag') => {
    const node = activeCanvas?.promptNodes.find(n => n.id === id);
    if (!node) return;

    // Pin: Move up 350px to avoid overlap with where the next preview will appear
    // Matches user requirement: "Main Card generated ABOVE... DO NOT OVERLAP"
    const newPos = { ...node.position, y: node.position.y - 350 };

    updatePromptNode({
      ...node,
      position: newPos,
      isDraft: false
    });

    // Clear Draft ID so next typing creates new draft
    setDraftNodeId(null);
    // 🎯 [New Requirement] Clear input box and active source
    setConfig(prev => ({ ...prev, prompt: '', referenceImages: [] }));
    setActiveSourceImage(null);

    import('./services/system/notificationService').then(({ notify }) => {
      notify.success('已固定', '草稿已转换为独立卡片');
    });
  }, [activeCanvas, updatePromptNode, setDraftNodeId, setConfig]);

  // 🎯 [New Feature] Pin Image -> Convert to Lonely Main Card (Idea Freeze)
  const handlePinImage = useCallback(async (imageId: string) => {
    const imageNode = activeCanvas?.imageNodes.find(n => n.id === imageId);
    if (!imageNode) return;

    // 1. Create New Prompt Node based on Image
    const newPromptId = Date.now().toString();
    const newPromptNode: PromptNode = {
      id: newPromptId,
      prompt: imageNode.prompt || '',
      position: imageNode.position, // Take image's place
      width: undefined as number | undefined, // Default width
      height: undefined as number | undefined,
      isDraft: false, // Lonely Main Card (Permanent)
      model: imageNode.model,
      imageSize: imageNode.imageSize || ImageSize.SIZE_1K,
      aspectRatio: imageNode.aspectRatio,
      childImageIds: [], // Initialize empty array for new prompt node
      // 🎯 Use the image itself as a reference to preserve the "Idea"
      referenceImages: [{
        id: `ref-${newPromptId}`,
        storageId: imageNode.storageId || imageNode.id,
        url: imageNode.url, // Thumbnail
        data: imageNode.url, // Base64/Blob
        mimeType: imageNode.mimeType || 'image/png'
      }],
      timestamp: Date.now()
    };

    // 2. Add New Prompt Node
    addPromptNode(newPromptNode);

    // 3. Delete Original Image Node (Transformation complete)
    deleteImageNode(imageId);

    import('./services/system/notificationService').then(({ notify }) => {
      notify.success('想法已定格', '图片已转换为独立主卡');
    });

  }, [activeCanvas, addPromptNode, deleteImageNode]);

  // Retry Logic (In-Place Regeneration)
  const handleRetryNode = useCallback(async (node: PromptNode) => {
    const normalizedRetryModel = normalizeModelId(node.model);
    const normalizedRetryNode: PromptNode = {
      ...node,
      model: normalizedRetryModel,
      modelLabel: resolveModelDisplayName(normalizedRetryModel, node.modelLabel || node.model),
    };
    const resolvedRoute = resolveNodeRouteState(normalizedRetryNode);
    let executionNode: PromptNode = {
      ...normalizedRetryNode,
      ...resolvedRoute,
    };

    const recovered = await recoverFailedSyncBridgeGeneration(executionNode);
    if (recovered.recoveredCount > 0 || recovered.pendingCount > 0) {
      import('./services/system/notificationService').then(({ notify }) => {
        const message = recovered.pendingCount > 0
          ? `已重新接管 ${recovered.pendingCount} 个可恢复请求，后台返图后会自动补回。`
          : `已找到 ${recovered.recoveredCount} 个已返图结果，正在补回到当前卡片。`;
        notify.info('恢复历史结果', message);
      });
      return;
    }

    const currentNodeId = node.id;
    const requestedCount = node.parallelCount || config.parallelCount || 1;
    const count = node.mode === GenerationMode.PPT ? Math.min(20, Math.max(1, requestedCount)) : requestedCount;
    const retryProvider = executionNode.model.includes('@')
      ? executionNode.model.split('@')[1]
      : executionNode.provider;
    const hasRetryCustomUserKey = keyManager.hasCustomKeyForModel(executionNode.model);
    const retryIsCreditModel = isCreditBasedModel(
      executionNode.model,
      retryProvider,
      undefined,
      hasRetryCustomUserKey,
      executionNode.keySlotId,
    );
    const retryUseServerSideCreditSettlement = retryIsCreditModel && isSystemModelRoute(executionNode.model);
    const retryPerImageCreditCost = retryIsCreditModel
      ? resolveCreditCostForModel(executionNode.model, executionNode.imageSize)
      : 0;
    const retryRequiredCredits = retryIsCreditModel
      ? ((executionNode.mode === GenerationMode.IMAGE || executionNode.mode === GenerationMode.PPT)
        ? count * retryPerImageCreditCost
        : (retryPerImageCreditCost || 1))
      : 0;
    const retryChargeAttempt = await ensureCreditAttemptCharged({
      modelId: executionNode.model,
      modelLabel: resolveModelDisplayName(executionNode.model, executionNode.modelLabel || executionNode.model),
      providerId: retryUseServerSideCreditSettlement ? 'system_proxy_slot' : executionNode.keySlotId,
      provider: executionNode.provider,
      requiredCredits: retryRequiredCredits,
      useServerSideCreditSettlement: retryUseServerSideCreditSettlement,
    });

    if (!retryChargeAttempt.success) {
      return;
    }

    executionNode = {
      ...executionNode,
      refundStatus: undefined,
      billingMode: retryIsCreditModel ? 'credits' : 'currency',
      creditCost: retryIsCreditModel ? retryPerImageCreditCost : undefined,
      creditSettlement: retryUseServerSideCreditSettlement ? 'server' : 'client',
      cost: retryRequiredCredits,
      isPaymentProcessed: Boolean(retryChargeAttempt.transactionId),
      paymentTransactionId: retryChargeAttempt.transactionId,
    };

    // 1. Reset state to generating
    updatePromptNode({
      ...executionNode,
      modelLabel: resolveModelDisplayName(executionNode.model, executionNode.modelLabel || executionNode.model),
      isGenerating: true,
      error: undefined,
      errorDetails: undefined,
      refundStatus: undefined,
      billingMode: retryIsCreditModel ? 'credits' : 'currency',
      creditCost: retryIsCreditModel ? retryPerImageCreditCost : undefined,
      creditSettlement: retryUseServerSideCreditSettlement ? 'server' : 'client',
      cost: retryRequiredCredits,
      isPaymentProcessed: Boolean(retryChargeAttempt.transactionId),
      paymentTransactionId: retryChargeAttempt.transactionId,
      isDraft: false, // 🎯 [Fix] Ensure visibility
      timestamp: Date.now() // Reset timer
    });
    if (retryUseServerSideCreditSettlement && retryRequiredCredits > 0) {
      adjustBalanceOptimistically(-retryRequiredCredits);
    }

    const startTime = Date.now();

    try {
      const results = await Promise.all(Array.from({ length: count }).map(async (_, index) => {
        const requestId = `${currentNodeId}-${index}`;

        let isFinished = false;
        const timer = setTimeout(() => {
          if (!isFinished) {
            cancelGeneration(requestId);
            updatePromptNode({
              ...executionNode,
              isGenerating: false,
              isDraft: false, // 🎯 [Fix] Prevent disappearance on timeout
              error: '生成超时',
              errorDetails: {
                code: 'TIMEOUT',
                responseBody: 'Retry request exceeded 600000ms timeout',
                model: executionNode.model,
                timestamp: Date.now()
              }
            });
          }
        }, GENERATE_TIMEOUT_MS);

        try {
          let b64 = '';
          let requestPath: string | undefined = undefined;
          let requestBodyPreview: string | undefined = undefined;
          let pythonSnippet: string | undefined = undefined;
          let apiDurationMs: number | undefined = undefined;
          let actualKeySlotId = executionNode.keySlotId;
          let actualProvider = executionNode.provider;
          let actualProviderLabel = executionNode.providerLabel;
          let actualModelLabel = executionNode.modelLabel;
          let actualModel = executionNode.model;
          let actualCost: number | undefined = undefined;
          let actualCostSource: 'snapshot' | 'explicit' | 'stored' | 'estimated' | 'none' | undefined = undefined;
          let actualTokens: number | undefined = undefined;
          let actualPromptTokens: number | undefined = undefined;
          let actualCompletionTokens: number | undefined = undefined;
          const currentMode: GenerationMode = executionNode.mode || GenerationMode.IMAGE;
          const taskPrompt = currentMode === GenerationMode.PPT
            ? (() => {
              const slideLines = (executionNode.pptSlides || []).map(line => String(line || '').trim()).filter(Boolean);
              const styleDirective = executionNode.pptStyleLocked !== false
                ? '与整套 PPT 保持完全统一的视觉语言'
                : '保持整体风格统一，但允许当前页面有适度变化';
              const picked = slideLines.length > 0
                ? slideLines[Math.min(index, slideLines.length - 1)]
                : `主题：${node.prompt}。保持同一套视觉风格，页面内容独立不重复。`;
              return `PPT 第 ${index + 1}/${count} 页。${picked}。16:9。${styleDirective}。`;
            })()
            : executionNode.prompt;

          if (currentMode === GenerationMode.VIDEO) {
            const videoResolution = (() => {
              if (executionNode.videoResolution) return executionNode.videoResolution;
              const size = executionNode.imageSize?.toLowerCase() || '';
              if (size.includes('4k') || size.includes('ultra')) return '4k';
              if (size.includes('1080') || size.includes('hd')) return '1080p';
              return '720p'; // Default to 720p
            })();
            const videoAspect = executionNode.aspectRatio === '9:16' ? '9:16' : '16:9';
            const videoResult = await llmService.generateVideo({
              modelId: executionNode.model,
              prompt: taskPrompt,
              aspectRatio: videoAspect,
              imageUrl: executionNode.referenceImages?.[0]?.data,
              imageTailUrl: executionNode.referenceImages?.[1]?.data,
              videoDuration: executionNode.videoDuration,
              preferredKeyId: executionNode.keySlotId,
              providerConfig: {
                google: {
                  imageConfig: { imageSize: videoResolution }
                }
              }
            });
            b64 = videoResult.url;
            actualKeySlotId = videoResult.keySlotId || actualKeySlotId;
            actualProvider = videoResult.provider || actualProvider;
            actualProviderLabel = videoResult.providerName || actualProviderLabel;
            actualModelLabel = videoResult.modelName || actualModelLabel;
            actualModel = videoResult.model || actualModel;
            actualCost = typeof (videoResult as any).usage?.cost === 'number' && Number.isFinite((videoResult as any).usage.cost)
              ? (videoResult as any).usage.cost
              : undefined;
            actualTokens = typeof (videoResult as any).usage?.totalTokens === 'number' && Number.isFinite((videoResult as any).usage.totalTokens)
              ? (videoResult as any).usage.totalTokens
              : undefined;
            actualPromptTokens = typeof (videoResult as any).usage?.promptTokens === 'number' && Number.isFinite((videoResult as any).usage.promptTokens)
              ? (videoResult as any).usage.promptTokens
              : undefined;
            actualCompletionTokens = typeof (videoResult as any).usage?.completionTokens === 'number' && Number.isFinite((videoResult as any).usage.completionTokens)
              ? (videoResult as any).usage.completionTokens
              : undefined;
            actualCostSource = actualCost !== undefined ? 'explicit' : 'none';
          } else {
            const result = await generateImage(
              taskPrompt,
              executionNode.aspectRatio,
              executionNode.imageSize,
              executionNode.referenceImages || [],
              executionNode.model,
              '', // managed key
              requestId,
              !!executionNode.enableGrounding || !!executionNode.enableImageSearch
              , {
                preferredKeyId: executionNode.keySlotId,
                enableWebSearch: !!executionNode.enableGrounding,
                enableImageSearch: !!executionNode.enableImageSearch,
                thinkingMode: executionNode.thinkingMode || 'minimal'
              }
            );
            b64 = result.url;
            requestPath = result.requestPath;
            requestBodyPreview = result.requestBodyPreview;
            pythonSnippet = result.pythonSnippet;
            apiDurationMs = result.apiDurationMs;
            actualKeySlotId = result.keySlotId || actualKeySlotId;
            actualProvider = result.provider || actualProvider;
            actualProviderLabel = result.providerName || actualProviderLabel;
            actualModel = result.effectiveModel || actualModel;
            actualModelLabel = resolveModelDisplayName(actualModel, result.modelName || actualModelLabel);
            actualCost = typeof result.cost === 'number' && Number.isFinite(result.cost)
              ? result.cost
              : undefined;
            actualTokens = typeof result.tokens === 'number' && Number.isFinite(result.tokens)
              ? result.tokens
              : undefined;
            actualPromptTokens = typeof result.promptTokens === 'number' && Number.isFinite(result.promptTokens)
              ? result.promptTokens
              : undefined;
            actualCompletionTokens = typeof result.completionTokens === 'number' && Number.isFinite(result.completionTokens)
              ? result.completionTokens
              : undefined;
            actualCostSource = actualCost !== undefined ? 'explicit' : 'none';
          }

          isFinished = true;
          clearTimeout(timer);

          // Upload (non-blocking for latency)
          let url = b64;
          let originalUrl = '';
          let apiResultUrl: string | undefined = undefined;

          if (currentMode === GenerationMode.IMAGE || currentMode === GenerationMode.PPT) {
            if (b64.startsWith('data:')) {
              originalUrl = b64;
              import('./services/system/syncService').then(async ({ syncService }) => {
                try {
                  const res = await fetch(b64);
                  const blob = await res.blob();
                  const id = `${Date.now()}_${index}`;
                  await syncService.uploadImagePair(id, blob);
                } catch (e) {
                  console.warn('Cloud image sync skipped because no real upload backend is configured yet.', e);
                }
              }).catch(() => { });
            } else if (/^https?:\/\//i.test(b64)) {
              apiResultUrl = b64;
            }
          } else {
            // For video, assume URL is remote or data URI
            url = b64;
            originalUrl = b64;
          }

          const generationTime = clampGenerationDurationMs((apiDurationMs && apiDurationMs > 0)
            ? apiDurationMs
            : (Date.now() - startTime));

          // Calculate Hash/StorageID
          const normalizedOriginalSource = normalizePersistableMediaSource(
            originalUrl || url,
            currentMode === GenerationMode.VIDEO ? 'video/mp4' : 'image/png'
          );
          const storageId = await calculateImageHash(normalizedOriginalSource || url);

          if (currentMode === GenerationMode.IMAGE || currentMode === GenerationMode.PPT) {
            if (normalizedOriginalSource) {
              void saveOriginalImage(storageId, normalizedOriginalSource).catch(() => undefined);
            }
          }

          // 🎯 [Fair Billing] Detect ACTUAL dimensions from the blob/image
          // This ensures we bill for what was received (e.g. 1K), not what was requested (e.g. 4K)
          // if the API downgraded it.
          let actualWidth = 1024;
          let actualHeight = 1024;
          let displayDimensions = `${node.aspectRatio} · ${node.imageSize || '1K'}`;
          let computedImageSize = node.imageSize || 'SIZE_1K'; // Default fallback
          displayDimensions = `${executionNode.aspectRatio} · ${executionNode.imageSize || '1K'}`;
          computedImageSize = executionNode.imageSize || 'SIZE_1K';

          try {
            if (typeof createImageBitmap !== 'undefined' && b64.startsWith('blob:')) {
              // Fast path for Blobs
              const res = await fetch(b64);
              const blob = await res.blob();
              const bitmap = await createImageBitmap(blob);
              actualWidth = bitmap.width;
              actualHeight = bitmap.height;
              bitmap.close();
            } else {
              // Slow path for Data URLs / Remote URLs
              const img = new Image();
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
              });
              actualWidth = img.naturalWidth;
              actualHeight = img.naturalHeight;
            }

            // Update display string to show REAL pixels
            displayDimensions = `${actualWidth}x${actualHeight}`;

            // Determine Billing Tier based on Max Dimension
            // 1K Tier: max <= 1500 (approx)
            // 2K Tier: max > 1500 && max <= 3000
            // 4K Tier: max > 3000
            const maxDim = Math.max(actualWidth, actualHeight);
            if (maxDim > 3000) {
              computedImageSize = ImageSize.SIZE_4K; // Map to enum manually or use string
            } else if (maxDim > 1500) {
              computedImageSize = ImageSize.SIZE_2K;
            } else {
              computedImageSize = ImageSize.SIZE_1K;
            }
            console.log(`[Fair Billing] Requested: ${executionNode.imageSize}, Received: ${actualWidth}x${actualHeight}, Billed As: ${computedImageSize}`);

          } catch (e) {
            console.warn('[App] Failed to detect actual dimensions, falling back to requested', e);
          }

          return {
            canvasId: activeCanvas?.id || 'default',
            parentPromptId: executionNode.id,
            dimensions: displayDimensions, // 🎯 Use Real Dimensions
            generationTime,
            index,
            url,
            originalUrl,
            apiResultUrl,
            prompt: taskPrompt,
            width: actualWidth,
            height: actualHeight,
            aspectRatio: executionNode.aspectRatio,
            imageSize: computedImageSize, // 🎯 Use Computed Cost Tier
            model: actualModel,
            modelLabel: actualModelLabel,
            provider: actualProvider,
            providerLabel: actualProviderLabel,
            tokens: actualTokens,
            promptTokens: actualPromptTokens,
            completionTokens: actualCompletionTokens,
            cost: actualCost,
            costSource: actualCostSource,
            billingMode: executionNode.billingMode,
            creditCost: executionNode.creditCost,
            keySlotId: actualKeySlotId,
            sourceReferenceStorageIds: (executionNode.referenceImages || []).map(ref => ref.storageId || ref.id).filter(Boolean),
            alias: currentMode === GenerationMode.PPT ? buildPptPageAlias(executionNode.pptSlides?.[index], index) : undefined,
            seed: -1,
            id: `${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
            storageId, // Content-Based ID
            mimeType: currentMode === GenerationMode.VIDEO ? 'video/mp4' : 'image/png',
            timestamp: Date.now(),
            mode: currentMode,
            requestPath,
            requestBodyPreview,
            pythonSnippet
          };
        } catch (e: any) {
          isFinished = true;
          clearTimeout(timer);
          throw e;
        }
      }));

      // Calculate Positions
      const gapToImages = 20; // Reduced to minimum for tight layout
      const gap = 16;

      const { width: cardWidth, totalHeight: cardHeight } = getCardDimensions(executionNode.aspectRatio, true);

      const newImageNodes = results.map((img, i) => {
        let x, y;

        // STRICT LAYOUT LOGIC (Matching arrangeAllNodes)
        // 1. Calculate Image Height strictly based on dimensions/aspectRatio (Footer included +40)
        let exactImageHeight = cardHeight;
        if (img.dimensions) {
          const match = img.dimensions.match(/(\d+)\s*[xX]\s*(\d+)/);
          if (match && match[1] && match[2]) {
            const w = parseInt(match[1], 10);
            const h = parseInt(match[2], 10);
            if (w > 0 && h > 0) {
              const ratio = w / h;
              const displayWidth = ratio > 1 ? 320 : (ratio < 1 ? 200 : 280);
              exactImageHeight = (displayWidth / ratio) + 40;
            }
          }
        } else {
          // Fallback
          // Use shared utility
          const { totalHeight } = getCardDimensions(executionNode.aspectRatio, true);
          exactImageHeight = totalHeight;
        }

        // 2. Position:
        // Y: Prompt Bottom + Gap + Image Height (Because Image Y is anchor bottom!)
        // Note: node.position.y is Prompt Bottom.
        // So Image Y = node.position.y + gapToImages + exactImageHeight.

        const isPptMode = (executionNode.mode || GenerationMode.IMAGE) === GenerationMode.PPT;

        if (isPptMode) {
          const pptGap = 28;
          const offsetY = gapToImages + exactImageHeight + i * (exactImageHeight + pptGap);
          x = executionNode.position.x;
          y = executionNode.position.y + offsetY;
        } else if (isMobile) {
          // Mobile: Maintain Desktop Size but Single Column
          const cols = 1; // Force single column to fit screen
          const col = 0; // Always col 0
          const row = i; // Row increments with index
          const mobileCardWidth = cardWidth; // Use full desktop width

          const mobileGap = 20;
          const startX = -mobileCardWidth / 2;
          const offsetX = startX + mobileCardWidth / 2;

          // 🎯 [Fix] Image Y should be exactly below Prompt Y, without adding promptCardHeight
          // Because Prompt Y is already its bottom edge.
          const offsetY = gapToImages + exactImageHeight + row * (exactImageHeight + mobileGap);
          x = executionNode.position.x + offsetX;
          y = executionNode.position.y + offsetY;
        } else {
          // DESKTOP LOGIC
          const cols = Math.min(count, 2);
          const col = i % cols;
          const row = Math.floor(i / cols);
          const itemsInRow = Math.min(cols, count - row * cols);

          // Get actual dimensions for this specific image
          let actualCardWidth = cardWidth;
          let actualCardHeight = cardHeight;
          
          // Calculate actual width based on image dimensions (matching ImageCard2 logic)
          if (img.dimensions) {
            const match = img.dimensions.match(/(\d+)\s*[xX]\s*(\d+)/);
            if (match && match[1] && match[2]) {
              const w = parseInt(match[1], 10);
              const h = parseInt(match[2], 10);
              if (w > 0 && h > 0) {
                const aspect = w / h;
                const { width: baseWidth } = getCardDimensions(executionNode.aspectRatio, false);
                actualCardWidth = baseWidth;
                actualCardHeight = (baseWidth / aspect) + 40; // 40px for footer
              }
            }
          }

          // For single image, always center it relative to prompt
          if (count === 1) {
            // 🎯 [Fix] 单列时直接居中：x = basePosition.x (主卡中心点)
            x = executionNode.position.x;
            y = executionNode.position.y + gapToImages + actualCardHeight;
          } else {
            // Multiple images: use grid layout with the first image's width for consistent grid
            const gridCardWidth = cardWidth;
            const currentGridWidth = itemsInRow * gridCardWidth + (itemsInRow - 1) * gap;
            const startX = executionNode.position.x - currentGridWidth / 2;
            const offsetX = startX + col * (gridCardWidth + gap) + gridCardWidth / 2 - executionNode.position.x;
            
            const rowHeight = exactImageHeight;
            const rowOffsetY = row * (rowHeight + gap);
            const offsetY = gapToImages + exactImageHeight + rowOffsetY;

            x = executionNode.position.x + offsetX;
            y = executionNode.position.y + offsetY;
          }
        }
        return {
          ...img,
          position: { x, y }
        };
      });

      const alignedImageNodes = (() => {
        const latestLayoutPrompt = activeCanvasRef.current?.promptNodes.find((promptNode) => promptNode.id === executionNode.id) || executionNode;
        const generatedPositions = buildGeneratedImageBatchPositions({
          basePosition: latestLayoutPrompt.position || executionNode.position,
          items: newImageNodes.map((img) => ({
            aspectRatio: img.aspectRatio,
            exactDimensions: (typeof img.width === 'number' && typeof img.height === 'number' && img.width > 0 && img.height > 0)
              ? { width: img.width, height: img.height }
              : undefined,
          })),
          mode: executionNode.mode,
          isMobile,
        });

        return newImageNodes.map((img, index) => ({
          ...img,
          position: generatedPositions[index] || img.position,
        }));
      })();

      // Add to canvas atomically with parent linking
      addImageNodes(alignedImageNodes, {
        [node.id]: {
          isGenerating: false,
          isDraft: false, // 🎯 [Fix] Ensure persistence
          childImageIds: alignedImageNodes.map(n => n.id),
          error: undefined,
          errorDetails: undefined,
          refundStatus: undefined,
          isPaymentProcessed: false,
          paymentTransactionId: undefined,
          keySlotId: alignedImageNodes[0]?.keySlotId || executionNode.keySlotId,
          provider: alignedImageNodes[0]?.provider || executionNode.provider,
          providerLabel: alignedImageNodes[0]?.providerLabel || executionNode.providerLabel,
          modelLabel: resolveModelDisplayName(
            alignedImageNodes[0]?.model || executionNode.model,
            alignedImageNodes[0]?.modelLabel || executionNode.modelLabel,
          )
        }
      });

      // Record cost
      // 🎯 [Fair Billing] Use the computed/effective size from the first result (assuming all in batch are same)
      const effectiveSize = alignedImageNodes[0]?.imageSize || executionNode.imageSize; // fallback

      import('./services/billing/costService').then(({ recordCost }) => {
        const firstDebug = (results as any[])[0] || {};
        recordCost(
          executionNode.model,
          effectiveSize as any, // Cast to ImageSize
          alignedImageNodes.length,
          executionNode.prompt,
          executionNode.referenceImages?.length || 0,
          undefined,
          {
            requestPath: firstDebug.requestPath,
            requestBodyPreview: firstDebug.requestBodyPreview,
            pythonSnippet: firstDebug.pythonSnippet
          },
          alignedImageNodes[0]?.keySlotId || executionNode.keySlotId
        );
      });
      import('./services/system/notificationService').then(({ notify }) => {
        notify.success('生成完成', '重新生成成功');
      });

    } catch (error: any) {
      const failedBillingState = await resolveFailedCreditAttempt(executionNode);
      updatePromptNode({
        ...executionNode,
        isGenerating: false,
        isDraft: false, // 🎯 [Fix] Prevent disappearance on error
        error: error.message || 'Retry failed',
        errorDetails: extractErrorDetails(error, executionNode.model),
        ...failedBillingState
      });
      import('./services/system/notificationService').then(({ notify }) => {
        notify.error('重试失败', error.message);
      });
    }
  }, [config.parallelCount, isMobile, updatePromptNode, addImageNodes, config.enableGrounding, extractErrorDetails, normalizePptSlidesForCount, buildAutoPptSlides, resolveNodeRouteState, recoverFailedSyncBridgeGeneration, ensureCreditAttemptCharged, resolveCreditCostForModel, adjustBalanceOptimistically, resolveFailedCreditAttempt]);

  const handleExportPptPackage = useCallback(async (node: PromptNode) => {
    if (!activeCanvas) return;
    const childImages = activeCanvas.imageNodes
      .filter(img => img.parentPromptId === node.id)
      .sort((a, b) => {
        const getNum = (x: string | undefined) => {
          if (!x) return Number.POSITIVE_INFINITY;
          const m = x.match(/图\s*(\d+)/);
          return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
        };
        const diff = getNum(a.alias) - getNum(b.alias);
        if (Number.isFinite(diff) && diff !== 0) return diff;
        return (a.timestamp || 0) - (b.timestamp || 0);
      });

    if (childImages.length === 0) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.warning('无可导出页面', '当前主卡还没有生成副卡页面');
      });
      return;
    }

    const zip = new JSZip();
    const pagesMeta: Array<any> = [];

    for (let i = 0; i < childImages.length; i++) {
      const img = childImages[i];
      const pageNo = i + 1;
      const pageName = img.alias || `图${pageNo}`;
      const outlineRaw = node.pptSlides?.[i] || img.alias || '';
      const { title: outlineTitle, subtitle: outlineSubtitle } = parsePptOutlineLine(outlineRaw);
      const fileName = `pages/${String(pageNo).padStart(2, '0')}-${pageName.replace(/[\\/:*?"<>|]/g, '_')}.png`;
      const src = img.originalUrl || img.url;

      try {
        const res = await fetch(src);
        const blob = await res.blob();
        zip.file(fileName, blob);
      } catch {
        // Skip broken pages but keep metadata
      }

      pagesMeta.push({
        page: pageNo,
        title: pageName,
        outlineTitle,
        outlineSubtitle,
        prompt: img.prompt,
        model: img.model,
        provider: img.providerLabel || img.provider,
        keySlotId: img.keySlotId,
        dimensions: img.dimensions,
        imageSize: img.imageSize,
        timestamp: img.timestamp,
        file: fileName
      });
    }

    const outlinePages = (node.pptSlides || []).map((text, idx) => ({
      page: idx + 1,
      text
    }));

    zip.file('meta/manifest.json', JSON.stringify({
      exportedAt: new Date().toISOString(),
      nodeId: node.id,
      nodePrompt: node.prompt,
      pageCount: childImages.length,
      pages: pagesMeta
    }, null, 2));

    zip.file('outline/ppt-outline.json', JSON.stringify({
      topic: node.prompt,
      pageCount: Math.max(childImages.length, outlinePages.length),
      styleLocked: node.pptStyleLocked !== false,
      pages: outlinePages
    }, null, 2));

    zip.file('meta/node-meta.json', JSON.stringify({
      nodeId: node.id,
      model: node.model,
      modelLabel: node.modelLabel,
      provider: node.provider,
      providerLabel: node.providerLabel,
      keySlotId: node.keySlotId,
      aspectRatio: node.aspectRatio,
      imageSize: node.imageSize,
      parallelCount: node.parallelCount,
      styleLocked: node.pptStyleLocked !== false,
      referenceStorageIds: (node.referenceImages || []).map(ref => ref.storageId || ref.id).filter(Boolean)
    }, null, 2));

    const slidesHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PPT 导出预览</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0b1020; color: #e5e7eb; margin: 0; padding: 20px; }
    h1 { font-size: 18px; margin: 0 0 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }
    .card { background: #121a2f; border: 1px solid #23304f; border-radius: 10px; overflow: hidden; }
    .meta { padding: 10px 12px; font-size: 12px; line-height: 1.4; }
    .title { color: #7dd3fc; font-weight: 600; margin-bottom: 6px; }
    img { width: 100%; display: block; background: #0f172a; }
  </style>
</head>
<body>
  <h1>${(node.prompt || 'PPT 导出').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1>
  <div class="grid">
    ${pagesMeta.map(p => `
      <div class="card">
        <img src="../${p.file}" alt="${String(p.title).replace(/"/g, '&quot;')}" />
        <div class="meta">
          <div class="title">第 ${p.page} 页 · ${String(p.title).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          <div>${String(p.prompt || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
      </div>`).join('')}
  </div>
</body>
</html>`;
    zip.file('outline/slides-preview.html', slidesHtml);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ppt-pages-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    import('./services/system/notificationService').then(({ notify }) => {
      notify.success('导出完成', `已导出 ${childImages.length} 页与 pages/outline/meta 目录`);
    });
  }, [activeCanvas, parsePptOutlineLine]);

  const handleRetryPptSinglePage = useCallback(async (node: PromptNode, pageIndex: number) => {
    if (!activeCanvas) return;
    if (node.mode !== GenerationMode.PPT) return;
    const normalizedRetryModel = normalizeModelId(node.model);
    const normalizedRetryNode: PromptNode = {
      ...node,
      model: normalizedRetryModel,
      modelLabel: resolveModelDisplayName(normalizedRetryModel, node.modelLabel || node.model),
    };
    const resolvedRoute = resolveNodeRouteState(normalizedRetryNode);
    let executionNode: PromptNode = {
      ...normalizedRetryNode,
      ...resolvedRoute,
    };

    const ordered = activeCanvas.imageNodes
      .filter(img => img.parentPromptId === node.id)
      .sort((a, b) => {
        const num = (val?: string) => {
          if (!val) return Number.POSITIVE_INFINITY;
          const m = val.match(/图\s*(\d+)/);
          return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
        };
        const d = num(a.alias) - num(b.alias);
        if (Number.isFinite(d) && d !== 0) return d;
        return (a.timestamp || 0) - (b.timestamp || 0);
      });

    const target = ordered[pageIndex];
    if (!target) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.warning('页面不存在', `未找到图 ${pageIndex + 1}`);
      });
      return;
    }

    const pageRetryProvider = executionNode.model.includes('@')
      ? executionNode.model.split('@')[1]
      : executionNode.provider;
    const hasPageRetryCustomUserKey = keyManager.hasCustomKeyForModel(executionNode.model);
    const pageRetryIsCreditModel = isCreditBasedModel(
      executionNode.model,
      pageRetryProvider,
      undefined,
      hasPageRetryCustomUserKey,
      executionNode.keySlotId,
    );
    const pageRetryUseServerSideCreditSettlement = pageRetryIsCreditModel && isSystemModelRoute(executionNode.model);
    const pageRetryPerImageCreditCost = pageRetryIsCreditModel
      ? resolveCreditCostForModel(executionNode.model, executionNode.imageSize)
      : 0;
    const pageRetryRequiredCredits = pageRetryIsCreditModel
      ? (pageRetryPerImageCreditCost || 1)
      : 0;
    const pageRetryChargeAttempt = await ensureCreditAttemptCharged({
      modelId: executionNode.model,
      modelLabel: resolveModelDisplayName(executionNode.model, executionNode.modelLabel || executionNode.model),
      providerId: pageRetryUseServerSideCreditSettlement ? 'system_proxy_slot' : executionNode.keySlotId,
      provider: executionNode.provider,
      requiredCredits: pageRetryRequiredCredits,
      useServerSideCreditSettlement: pageRetryUseServerSideCreditSettlement,
    });

    if (!pageRetryChargeAttempt.success) {
      return;
    }

    executionNode = {
      ...executionNode,
      refundStatus: undefined,
      billingMode: pageRetryIsCreditModel ? 'credits' : 'currency',
      creditCost: pageRetryIsCreditModel ? pageRetryPerImageCreditCost : undefined,
      creditSettlement: pageRetryUseServerSideCreditSettlement ? 'server' : 'client',
      cost: pageRetryRequiredCredits,
      isPaymentProcessed: Boolean(pageRetryChargeAttempt.transactionId),
      paymentTransactionId: pageRetryChargeAttempt.transactionId,
      error: undefined,
      errorDetails: undefined,
    };

    updatePromptNode(executionNode);

    const slides = normalizePptSlidesForCount(
      executionNode.pptSlides,
      executionNode.prompt,
      Math.max(pageIndex + 1, executionNode.parallelCount || 1, ordered.length)
    );
    const slideText = slides[pageIndex]
      || `主题：${node.prompt}。保持同一套视觉风格，页面内容独立不重复。`;
    const layoutDirective = (() => {
      const t = slideText.toLowerCase();
      if (/封面|cover|title/.test(t)) return '采用封面版式：大标题 + 副标题 + 视觉主图，信息精简。';
      if (/目录|agenda|contents?/.test(t)) return '采用目录版式：清晰列出 4-6 个章节条目，层级分明。';
      if (/总结|结论|行动|summary|conclusion/.test(t)) return '采用总结版式：突出结论要点和行动建议，重点高亮。';
      if (/章节|section|transition/.test(t)) return '采用章节过渡页版式：突出章节标题，并配合关键词。';
      return '采用内容页版式：标题 + 3-5 个信息块，层次清晰。';
    })();
    const styleDirective = executionNode.pptStyleLocked !== false
      ? '与整套 PPT 保持完全统一的视觉语言'
      : '保持整体风格统一，但允许当前页面有适度变化';
    const previousVisualHint = (() => {
      const raw = (target.prompt || '').replace(/PPT第\d+\/?\d*页。?/g, '').trim();
      if (!raw) return '';
      const compact = raw.length > 120 ? `${raw.slice(0, 120)}...` : raw;
      return `参考上一版视觉关键词：${compact}。`;
    })();
    const taskPrompt = `PPT 第 ${pageIndex + 1}/${Math.max(1, node.childImageIds.length)} 页。${slideText}。16:9。${styleDirective}。${layoutDirective}${previousVisualHint}`;

    updateImageNode(target.id, {
      isGenerating: true,
      error: undefined,
      model: executionNode.model,
      modelLabel: resolveModelDisplayName(executionNode.model, executionNode.modelLabel || executionNode.model),
    });

    if (pageRetryUseServerSideCreditSettlement && pageRetryRequiredCredits > 0) {
      adjustBalanceOptimistically(-pageRetryRequiredCredits);
    }

    const startTime = Date.now();
    try {
      const result = await generateImage(
        taskPrompt,
        executionNode.aspectRatio,
        executionNode.imageSize,
        executionNode.referenceImages || [],
        executionNode.model,
        '',
        `${node.id}-ppt-single-${pageIndex}`,
        !!executionNode.enableGrounding || !!executionNode.enableImageSearch,
        {
          preferredKeyId: executionNode.keySlotId,
          enableWebSearch: !!executionNode.enableGrounding,
          enableImageSearch: !!executionNode.enableImageSearch,
          thinkingMode: executionNode.thinkingMode || 'minimal'
        }
      );

      let storageId = target.storageId;
      const persistableResultSource = normalizePersistableMediaSource(
        result.url,
        target.mimeType || 'image/png'
      );
      if (persistableResultSource) {
        try {
          const hash = await calculateImageHash(persistableResultSource);
          storageId = hash;
          await saveOriginalImage(hash, persistableResultSource);
        } catch {
          // ignore storage failures, keep in-memory preview
        }
      }

      updateImageNode(target.id, {
        ...resolveProviderDisplay(result.keySlotId || executionNode.keySlotId, result.providerName || target.providerLabel, result.provider || target.provider),
        url: result.url,
        originalUrl: result.url.startsWith('data:') ? result.url : undefined,
        apiResultUrl: /^https?:\/\//i.test(result.url) ? result.url : undefined,
        prompt: taskPrompt,
        timestamp: Date.now(),
        generationTime: clampGenerationDurationMs(Date.now() - startTime),
        model: result.model || executionNode.model,
        modelLabel: resolveModelDisplayName(result.model || executionNode.model, result.modelName || target.modelLabel),
        modelColorStart: target.modelColorStart,
        modelColorEnd: target.modelColorEnd,
        modelColorSecondary: target.modelColorSecondary,
        modelTextColor: target.modelTextColor,
        billingMode: executionNode.billingMode,
        creditCost: executionNode.creditCost,
        tokens: typeof result.tokens === 'number' && Number.isFinite(result.tokens) ? result.tokens : undefined,
        promptTokens: typeof result.promptTokens === 'number' && Number.isFinite(result.promptTokens) ? result.promptTokens : undefined,
        completionTokens: typeof result.completionTokens === 'number' && Number.isFinite(result.completionTokens) ? result.completionTokens : undefined,
        cost: typeof result.cost === 'number' && Number.isFinite(result.cost) ? result.cost : undefined,
        costSource: typeof result.cost === 'number' && Number.isFinite(result.cost) ? 'explicit' : 'none',
        keySlotId: result.keySlotId || executionNode.keySlotId,
        imageSize: result.imageSize || executionNode.imageSize,
        aspectRatio: result.aspectRatio || executionNode.aspectRatio,
        dimensions: result.dimensions ? `${result.dimensions.width}x${result.dimensions.height}` : target.dimensions,
        exactDimensions: result.dimensions || target.exactDimensions,
        sourceReferenceStorageIds: (executionNode.referenceImages || []).map(ref => ref.storageId || ref.id).filter(Boolean),
        alias: buildPptPageAlias(slideText, pageIndex),
        storageId,
        isGenerating: false,
        error: undefined
      });

      rememberPreferredKeyForMode(executionNode.mode, result.keySlotId || executionNode.keySlotId);
      updatePromptNode({
        ...executionNode,
        refundStatus: undefined,
        isPaymentProcessed: false,
        paymentTransactionId: undefined,
        error: undefined,
        errorDetails: undefined
      });

      import('./services/system/notificationService').then(({ notify }) => {
        notify.success('单页重绘完成', `已更新图${pageIndex + 1}`);
      });
    } catch (error: any) {
      const failedBillingState = await resolveFailedCreditAttempt(executionNode);
      updatePromptNode({
        ...executionNode,
        ...failedBillingState
      });
      updateImageNode(target.id, {
        isGenerating: false,
        error: error?.message || '单页重绘失败'
      });
      import('./services/system/notificationService').then(({ notify }) => {
        notify.error('单页重绘失败', error?.message || '请稍后重试');
      });
    }
  }, [activeCanvas, updateImageNode, rememberPreferredKeyForMode, normalizePptSlidesForCount, resolveNodeRouteState, resolveProviderDisplay, ensureCreditAttemptCharged, resolveCreditCostForModel, adjustBalanceOptimistically, updatePromptNode, resolveFailedCreditAttempt]);

  const handleExportPptSinglePage = useCallback(async (node: PromptNode, pageIndex: number) => {
    if (!activeCanvas) return;
    if (node.mode !== GenerationMode.PPT) return;

    const ordered = activeCanvas.imageNodes
      .filter(img => img.parentPromptId === node.id)
      .sort((a, b) => {
        const num = (val?: string) => {
          if (!val) return Number.POSITIVE_INFINITY;
          const m = val.match(/图\s*(\d+)/);
          return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
        };
        const d = num(a.alias) - num(b.alias);
        if (Number.isFinite(d) && d !== 0) return d;
        return (a.timestamp || 0) - (b.timestamp || 0);
      });

    const target = ordered[pageIndex];
    if (!target) return;

    try {
      const res = await fetch(target.originalUrl || target.url);
      const blob = await res.blob();
      const name = `ppt-page-${String(pageIndex + 1).padStart(2, '0')}.png`;
      saveAs(blob, name);
      import('./services/system/notificationService').then(({ notify }) => {
        notify.success('导出完成', `已导出图 ${pageIndex + 1}`);
      });
    } catch (e: any) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.error('导出失败', e?.message || '无法导出该页面');
      });
    }
  }, [activeCanvas]);

  const handleExportPptx = useCallback(async (node: PromptNode) => {
    if (!activeCanvas) return;
    if (node.mode !== GenerationMode.PPT) return;

    const ordered = activeCanvas.imageNodes
      .filter(img => img.parentPromptId === node.id)
      .sort((a, b) => {
        const num = (val?: string) => {
          if (!val) return Number.POSITIVE_INFINITY;
          const m = val.match(/图\s*(\d+)/);
          return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
        };
        const d = num(a.alias) - num(b.alias);
        if (Number.isFinite(d) && d !== 0) return d;
        return (a.timestamp || 0) - (b.timestamp || 0);
      })
      .slice(0, 20);

    if (ordered.length === 0) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.warning('无可导出页面', '当前主卡还没有生成副卡页面');
      });
      return;
    }

    const escapeXml = (s: string) => String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const zip = new JSZip();

    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${ordered.map((_, i) => `  <Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('\n')}
</Types>`);

    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

    zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(node.prompt || 'KK Studio PPT 导出')}</dc:title>
  <dc:creator>KK Studio</dc:creator>
  <cp:lastModifiedBy>KK Studio</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`);

    zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>KK Studio</Application>
  <Slides>${ordered.length}</Slides>
</Properties>`);

    zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>
    ${ordered.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')}
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`);

    zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${ordered.map((_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('\n')}
</Relationships>`);

    zip.file('ppt/slideMasters/slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld name="Master"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`);

    zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`);

    zip.file('ppt/slideLayouts/slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`);

    zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);

    zip.file('ppt/theme/theme1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme"><a:themeElements><a:clrScheme name="Default"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2><a:accent1><a:srgbClr val="4F81BD"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2><a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="8064A2"/></a:accent4><a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6><a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink></a:clrScheme><a:fontScheme name="Default"><a:majorFont><a:latin typeface="Calibri"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme><a:fmtScheme name="Default"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`);

    for (let i = 0; i < ordered.length; i++) {
      const img = ordered[i];
      const outlineRaw = node.pptSlides?.[i] || img.alias || `第 ${i + 1} 页`;
      const { title: outlineTitle, subtitle: outlineSubtitle } = parsePptOutlineLine(outlineRaw);
      const titleText = outlineTitle || `第 ${i + 1} 页`;
      const subtitleText = outlineSubtitle || '';
      const src = img.originalUrl || img.url;
      const res = await fetch(src);
      const blob = await res.blob();
      const mime = blob.type || 'image/png';
      const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png';
      const mediaPath = `ppt/media/image${i + 1}.${ext}`;
      zip.file(mediaPath, blob);

      zip.file(`ppt/slides/slide${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="2" name="${escapeXml(img.alias || `Slide ${i + 1}`)}"/>
          <p:cNvPicPr/>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId1"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Title Box"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="228600"/><a:ext cx="11277600" cy="731520"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="111827"><a:alpha val="42000"/></a:srgbClr></a:solidFill>
          <a:ln><a:noFill/></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr lIns="114300" tIns="57150" rIns="114300" bIns="57150"/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="zh-CN" b="1" sz="3200"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr>
              <a:t>${escapeXml(titleText)}</a:t>
            </a:r>
            <a:endParaRPr lang="zh-CN" sz="3200"/>
          </a:p>
        </p:txBody>
      </p:sp>
      ${subtitleText ? `<p:sp>
        <p:nvSpPr>
          <p:cNvPr id="4" name="Subtitle Box"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="1005840"/><a:ext cx="11277600" cy="548640"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="0F172A"><a:alpha val="28000"/></a:srgbClr></a:solidFill>
          <a:ln><a:noFill/></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr lIns="114300" tIns="38100" rIns="114300" bIns="38100"/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="zh-CN" sz="1800"><a:solidFill><a:srgbClr val="E5E7EB"/></a:solidFill></a:rPr>
              <a:t>${escapeXml(subtitleText)}</a:t>
            </a:r>
            <a:endParaRPr lang="zh-CN" sz="1800"/>
          </a:p>
        </p:txBody>
      </p:sp>` : ''}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`);

      zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i + 1}.${ext}"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);
    }

    const pptxBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(pptxBlob, `ppt-slides-${Date.now()}.pptx`);
    import('./services/system/notificationService').then(({ notify }) => {
      notify.success('PPTX 导出完成', `已导出 ${ordered.length} 页的 .pptx 文件`);
    });
  }, [activeCanvas, parsePptOutlineLine]);

  const handleExportPptPackageEditable = useCallback(async (node: PromptNode) => {
    const exportBundle = getPptEditableExportBundle(node);
    if (!exportBundle) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.warning('无可导出页面', '当前主卡还没有生成副卡页面');
      });
      return;
    }

    const zip = new JSZip();
    const { promptNode, images, pages, imageById } = exportBundle;
    const outlinePages = syncPptSlidesFromEditablePages(pages);
    const pageSummaries: Array<Record<string, unknown>> = [];
    const assetFileByImageId = new Map<string, string>();
    const uniqueImageIds = Array.from(new Set(
      pages.flatMap((page) => page.layers
        .map((layer) => layer.type === 'image' ? (layer.imageNodeId || page.backgroundImageId || null) : null)
        .filter((id): id is string => Boolean(id))),
    ));

    for (let assetIndex = 0; assetIndex < uniqueImageIds.length; assetIndex += 1) {
      const imageId = uniqueImageIds[assetIndex];
      const image = imageById.get(imageId);
      if (!image) continue;

      const asset = await resolvePptExportImageAsset(image);
      const assetSlug = sanitizePptFileSegment(
        image.alias || `slide-${assetIndex + 1}`,
        `slide-${assetIndex + 1}`,
      );
      const assetFile = `editable/assets/${String(assetIndex + 1).padStart(2, '0')}-${assetSlug}.${asset.ext}`;
      zip.file(assetFile, asset.blob);
      assetFileByImageId.set(imageId, assetFile);
    }

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const page = pages[pageIndex];
      const pageNo = pageIndex + 1;
      const pageTitle = getPptTextLayer(page, 'title')?.text.trim() || page.name || `Slide ${pageNo}`;
      const pageSlug = sanitizePptFileSegment(pageTitle, `slide-${pageNo}`);
      const previewFile = `pages/${String(pageNo).padStart(2, '0')}-${pageSlug}.png`;
      const backgroundImageId = page.backgroundImageId
        || page.layers.find((layer): layer is PptEditableImageLayer => layer.type === 'image')?.imageNodeId;
      zip.file(previewFile, await renderPptEditablePagePreviewBlob(page, imageById));

      const slideFile = `editable/slides/slide-${String(pageNo).padStart(2, '0')}.json`;
      const subtitle = getPptTextLayer(page, 'subtitle')?.text.trim() || '';
      const layerPayload = page.layers.map((layer) => {
        if (layer.type === 'image') {
          const layerImageId = layer.imageNodeId || page.backgroundImageId;
          return {
            ...layer,
            sourceUrl: undefined,
            assetFile: layerImageId ? assetFileByImageId.get(layerImageId) : undefined,
          };
        }

        return layer;
      });

      zip.file(slideFile, JSON.stringify({
        id: page.id,
        page: pageNo,
        name: page.name,
        outline: outlinePages[pageIndex] || page.outline,
        notes: page.notes || '',
        backgroundImageId: backgroundImageId || null,
        previewFile,
        layers: layerPayload,
      }, null, 2));

      pageSummaries.push({
        page: pageNo,
        id: page.id,
        title: pageTitle,
        subtitle,
        outline: outlinePages[pageIndex] || page.outline,
        prompt: images[pageIndex]?.prompt || promptNode.prompt,
        model: images[pageIndex]?.model || promptNode.model,
        provider: images[pageIndex]?.providerLabel || images[pageIndex]?.provider || promptNode.providerLabel || promptNode.provider,
        keySlotId: images[pageIndex]?.keySlotId || promptNode.keySlotId,
        dimensions: images[pageIndex]?.dimensions,
        imageSize: images[pageIndex]?.imageSize || promptNode.imageSize,
        timestamp: images[pageIndex]?.timestamp || promptNode.timestamp,
        previewFile,
        editableFile: slideFile,
        backgroundAsset: backgroundImageId ? assetFileByImageId.get(backgroundImageId) : undefined,
        layerCount: page.layers.length,
        visibleLayerCount: page.layers.filter((layer) => layer.visible).length,
      });
    }

    zip.file('editable/deck.json', JSON.stringify({
      exportedAt: new Date().toISOString(),
      format: 'kk-studio-ppt-editable/v1',
      canvas: PPT_EDITABLE_CANVAS,
      node: {
        id: promptNode.id,
        prompt: promptNode.prompt,
        mode: promptNode.mode,
        model: promptNode.model,
        modelLabel: promptNode.modelLabel,
        provider: promptNode.provider,
        providerLabel: promptNode.providerLabel,
        keySlotId: promptNode.keySlotId,
        aspectRatio: promptNode.aspectRatio,
        imageSize: promptNode.imageSize,
        styleLocked: promptNode.pptStyleLocked !== false,
      },
      pages: pages.map((page, index) => ({
        id: page.id,
        page: index + 1,
        name: page.name,
        outline: outlinePages[index] || page.outline,
        previewFile: `pages/${String(index + 1).padStart(2, '0')}-${sanitizePptFileSegment(
          getPptTextLayer(page, 'title')?.text.trim() || page.name || `slide-${index + 1}`,
          `slide-${index + 1}`,
        )}.png`,
        editableFile: `editable/slides/slide-${String(index + 1).padStart(2, '0')}.json`,
      })),
      assets: Object.fromEntries(assetFileByImageId.entries()),
      notes: [
        pickByDocumentLanguage(
          '这个包会保留分层 PPT 场景数据，便于继续在线编辑或导出 PPTX。',
          'This package preserves layered PPT scene data for online editing and PPTX export.'
        ),
        pickByDocumentLanguage(
          'PSD 无法从扁平化 AI 图片自动还原，若要导出 PSD，需要基于这些图层重新构建。',
          'PSD export is not reconstructed automatically from a flat AI image; it must be rebuilt from these layers.'
        ),
      ],
    }, null, 2));

    zip.file('meta/manifest.json', JSON.stringify({
      exportedAt: new Date().toISOString(),
      nodeId: promptNode.id,
      nodePrompt: promptNode.prompt,
      pageCount: pages.length,
      pages: pageSummaries,
    }, null, 2));

    zip.file('outline/ppt-outline.json', JSON.stringify({
      topic: promptNode.prompt,
      pageCount: pages.length,
      styleLocked: promptNode.pptStyleLocked !== false,
      pages: outlinePages.map((text, index) => ({
        page: index + 1,
        text,
      })),
    }, null, 2));

    zip.file('meta/node-meta.json', JSON.stringify({
      nodeId: promptNode.id,
      model: promptNode.model,
      modelLabel: promptNode.modelLabel,
      provider: promptNode.provider,
      providerLabel: promptNode.providerLabel,
      keySlotId: promptNode.keySlotId,
      aspectRatio: promptNode.aspectRatio,
      imageSize: promptNode.imageSize,
      parallelCount: promptNode.parallelCount,
      styleLocked: promptNode.pptStyleLocked !== false,
      referenceStorageIds: (promptNode.referenceImages || []).map((ref) => ref.storageId || ref.id).filter(Boolean),
    }, null, 2));

    zip.file('editable/README.md', [
      pickByDocumentLanguage('# 可编辑 PPT 页面包', '# Editable PPT Package'),
      '',
      pickByDocumentLanguage('- `editable/deck.json`：KK Studio 使用的分层页面包清单。', '- `editable/deck.json`: layered deck manifest used by KK Studio.'),
      pickByDocumentLanguage('- `editable/slides/*.json`：每一页的可编辑图层数据。', '- `editable/slides/*.json`: per-slide editable layer data.'),
      pickByDocumentLanguage('- `editable/assets/*`：页面 JSON 引用到的图像图层素材。', '- `editable/assets/*`: image layer assets referenced by the slide JSON.'),
      pickByDocumentLanguage('- `pages/*`：用于快速查看的预览 PNG。', '- `pages/*`: preview PNGs for quick inspection.'),
      '',
      pickByDocumentLanguage(
        '当你希望保留可编辑文字和图层顺序，并继续导出 PPTX 或后续重建 PSD 时，请使用这个包。',
        'Use this package when you want to keep editable text and layer ordering, then export to PPTX now or rebuild PSD later.'
      ),
    ].join('\n'));

    const slidesHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PPT 导出预览</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0b1020; color: #e5e7eb; margin: 0; padding: 20px; }
    h1 { font-size: 18px; margin: 0 0 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }
    .card { background: #121a2f; border: 1px solid #23304f; border-radius: 10px; overflow: hidden; }
    .meta { padding: 10px 12px; font-size: 12px; line-height: 1.4; }
    .title { color: #7dd3fc; font-weight: 600; margin-bottom: 6px; }
    img { width: 100%; display: block; background: #0f172a; }
  </style>
</head>
<body>
  <h1>${(promptNode.prompt || 'PPT 导出预览').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1>
  <div class="grid">
    ${pageSummaries.map((page) => `
      <div class="card">
        <img src="../${String(page.previewFile)}" alt="${String(page.title).replace(/"/g, '&quot;')}" />
        <div class="meta">
          <div class="title">第 ${String(page.page)} 页 · ${String(page.title).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          <div>${String(page.outline || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
      </div>`).join('')}
  </div>
</body>
</html>`;
    zip.file('outline/slides-preview.html', slidesHtml);

    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `ppt-editable-package-${Date.now()}.zip`);

    import('./services/system/notificationService').then(({ notify }) => {
      notify.success('导出完成', `已导出 ${pages.length} 页，以及 editable 图层包、预览页和素材目录`);
    });
  }, [getPptEditableExportBundle, renderPptEditablePagePreviewBlob, resolvePptExportImageAsset, sanitizePptFileSegment]);

  const handleExportPptxEditable = useCallback(async (node: PromptNode) => {
    const exportBundle = getPptEditableExportBundle(node);
    if (!exportBundle) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.warning('无可导出页面', '当前主卡还没有生成副卡页面');
      });
      return;
    }

    const { promptNode, pages, imageById } = exportBundle;
    const slideWidth = 12192000;
    const slideHeight = 6858000;
    const emuPerPx = Math.round(slideWidth / PPT_EDITABLE_CANVAS.width);
    const escapeXml = (value: string) => String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    const normalizeColor = (value?: string, fallback = 'FFFFFF') => {
      const raw = String(value || '').trim().replace(/^#/, '');
      if (/^[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
      if (/^[0-9a-fA-F]{3}$/.test(raw)) {
        return raw.split('').map((part) => `${part}${part}`).join('').toUpperCase();
      }
      return fallback;
    };
    const toAlphaValue = (opacity: number) => Math.max(0, Math.min(100000, Math.round(opacity * 100000)));
    const toEmu = (value: number) => Math.max(0, Math.round(value * emuPerPx));
    const alignMap = {
      left: 'l',
      center: 'ctr',
      right: 'r',
    } as const;
    const makeColorXml = (value: string | undefined, fallback: string, opacity = 1) => (
      `<a:srgbClr val="${normalizeColor(value, fallback)}">${opacity < 1 ? `<a:alpha val="${toAlphaValue(opacity)}"/>` : ''}</a:srgbClr>`
    );

    const zip = new JSZip();
    const visibleImageIds = Array.from(new Set(
      pages.flatMap((page) => page.layers.reduce<string[]>((ids, layer) => {
        if (!layer.visible || layer.type !== 'image') {
          return ids;
        }

        const imageId = layer.imageNodeId || page.backgroundImageId;
        if (imageId) {
          ids.push(imageId);
        }

        return ids;
      }, [])),
    ));
    const mediaByImageId = new Map<string, { fileName: string; ext: 'png' | 'jpg' }>();

    for (let mediaIndex = 0; mediaIndex < visibleImageIds.length; mediaIndex += 1) {
      const imageId = visibleImageIds[mediaIndex];
      const image = imageById.get(imageId);
      if (!image) continue;

      const asset = await resolvePptExportImageAsset(image);
      const fileName = `image${mediaIndex + 1}.${asset.ext}`;
      zip.file(`ppt/media/${fileName}`, asset.blob);
      mediaByImageId.set(imageId, { fileName, ext: asset.ext });
    }

    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${pages.map((_, index) => `  <Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('\n')}
</Types>`);

    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

    const nowIso = new Date().toISOString();
    zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(promptNode.prompt || 'KK Studio PPT')}</dc:title>
  <dc:creator>KK Studio</dc:creator>
  <cp:lastModifiedBy>KK Studio</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:modified>
</cp:coreProperties>`);

    zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>KK Studio</Application>
  <Slides>${pages.length}</Slides>
</Properties>`);

    zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>
    ${pages.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join('')}
  </p:sldIdLst>
  <p:sldSz cx="${slideWidth}" cy="${slideHeight}" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`);

    zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${pages.map((_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join('\n')}
</Relationships>`);

    zip.file('ppt/slideMasters/slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld name="Master"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`);

    zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`);

    zip.file('ppt/slideLayouts/slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`);

    zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);

    zip.file('ppt/theme/theme1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme"><a:themeElements><a:clrScheme name="Default"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2><a:accent1><a:srgbClr val="4F81BD"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2><a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="8064A2"/></a:accent4><a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6><a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink></a:clrScheme><a:fontScheme name="Default"><a:majorFont><a:latin typeface="Calibri"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme><a:fmtScheme name="Default"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`);

    for (let slideIndex = 0; slideIndex < pages.length; slideIndex += 1) {
      const page = pages[slideIndex];
      const visibleLayers = sortPptLayers(page.layers).filter((layer) => layer.visible);
      const slideLayerXml: string[] = [];
      const slideRelationships: string[] = [];
      let nextShapeId = 2;
      let nextRelationshipId = 1;

      visibleLayers.forEach((layer) => {
        if (layer.type === 'image') {
          const imageId = layer.imageNodeId || page.backgroundImageId;
          if (!imageId) return;

          const media = mediaByImageId.get(imageId);
          if (!media) return;

          const relationshipId = `rId${nextRelationshipId}`;
          nextRelationshipId += 1;
          slideRelationships.push(
            `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${media.fileName}"/>`,
          );

          const opacity = Math.max(0, Math.min(1, layer.opacity ?? 1));
          const pictureXml = `      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="${nextShapeId}" name="${escapeXml(layer.name || `Image ${nextShapeId}`)}"/>
          <p:cNvPicPr/>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="${relationshipId}">${opacity < 1 ? `<a:alphaModFix amt="${toAlphaValue(opacity)}"/>` : ''}</a:blip>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="${toEmu(layer.x)}" y="${toEmu(layer.y)}"/><a:ext cx="${toEmu(layer.width)}" cy="${toEmu(layer.height)}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>`;
          slideLayerXml.push(pictureXml);
          nextShapeId += 1;
          return;
        }

        if (!layer.text.trim()) return;

        const fontSize = Math.max(100, Math.round(layer.fontSize * 100));
        const textOpacity = Math.max(0, Math.min(1, layer.opacity ?? 1));
        const backgroundOpacity = Math.max(0, Math.min(1, (layer.backgroundOpacity ?? 0) * textOpacity));
        const paragraphs = layer.text.split(/\r?\n/).map((line) => (
          `          <a:p>
            <a:pPr algn="${alignMap[layer.align || 'left']}"/>
            <a:r>
              <a:rPr lang="zh-CN"${(layer.fontWeight || 0) >= 600 ? ' b="1"' : ''} sz="${fontSize}">
                <a:solidFill>${makeColorXml(layer.color, 'FFFFFF', textOpacity)}</a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(line || ' ')}</a:t>
            </a:r>
            <a:endParaRPr lang="zh-CN" sz="${fontSize}"/>
          </a:p>`
        )).join('\n');
        const textXml = `      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${nextShapeId}" name="${escapeXml(layer.name || `Text ${nextShapeId}`)}"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="${toEmu(layer.x)}" y="${toEmu(layer.y)}"/><a:ext cx="${toEmu(layer.width)}" cy="${toEmu(layer.height)}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          ${layer.backgroundColor && backgroundOpacity > 0 ? `<a:solidFill>${makeColorXml(layer.backgroundColor, '111827', backgroundOpacity)}</a:solidFill>` : '<a:noFill/>'}
          <a:ln><a:noFill/></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr wrap="square" lIns="114300" tIns="57150" rIns="114300" bIns="57150"/>
          <a:lstStyle/>
${paragraphs}
        </p:txBody>
      </p:sp>`;
        slideLayerXml.push(textXml);
        nextShapeId += 1;
      });

      slideRelationships.push(
        `<Relationship Id="rId${nextRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`,
      );

      zip.file(`ppt/slides/slide${slideIndex + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
${slideLayerXml.join('\n')}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`);

      zip.file(`ppt/slides/_rels/slide${slideIndex + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${slideRelationships.join('\n  ')}
</Relationships>`);
    }

    const pptxBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(pptxBlob, `ppt-layered-${Date.now()}.pptx`);

    import('./services/system/notificationService').then(({ notify }) => {
      notify.success('PPTX 导出完成', `已导出 ${pages.length} 页的可编辑图层 PPTX`);
    });
  }, [getPptEditableExportBundle, resolvePptExportImageAsset]);

  const promptNodeById = React.useMemo(() => {
    const map = new Map<string, PromptNode>();
    activeCanvas?.promptNodes.forEach((node) => {
      map.set(node.id, node);
    });
    return map;
  }, [activeCanvas?.promptNodes]);

  const imageNodeById = React.useMemo(() => {
    const map = new Map<string, GeneratedImage>();
    activeCanvas?.imageNodes.forEach((node) => {
      map.set(node.id, node);
    });
    return map;
  }, [activeCanvas?.imageNodes]);

  // Auto-Recover Interrupted Tasks
  useEffect(() => {
    if (activeCanvas) {
      const interruptedNodes = activeCanvas.promptNodes.filter(n => n.error === '::INTERRUPTED::');
      if (interruptedNodes.length > 0) {
        console.log('[App] Auto-recovering interrupted nodes:', interruptedNodes.length);

        interruptedNodes.forEach(node => {
          handleRetryNode(node);
        });

        import('./services/system/notificationService').then(({ notify }) => {
          notify.info('恢复任务', `系统已自动重新开始 ${interruptedNodes.length} 个中断的任务`);
        });
      }
    }
  }, [activeCanvas, handleRetryNode]);

  // Optimization: Stable handlers for Node Clicks
  const handlePromptClick = useCallback(async (clickedNode: PromptNode, isOptimizedView?: boolean) => {
    setActiveSourceImage(null);

    let referenceImages = clickedNode.referenceImages || [];

    // Pre-hydrate if needed to prevent flicker
    // We do this BEFORE setting config so the UI never sees the "loading" state
    if (referenceImages.some(img => !img.data && getReferenceImageLookupIds(img).length > 0)) {
      try {
        const { getImage } = await import('./services/storage/imageStorage');
        const hydrated = await Promise.all(referenceImages.map(async (img) => {
          if (!img.data) {
            for (const lookupId of getReferenceImageLookupIds(img)) {
              const data = await getImage(lookupId);
              if (data) {
                return { ...img, storageId: img.storageId || lookupId, data };
              }
            }
          }
          return img;
        }));
        referenceImages = hydrated;
      } catch (e) {
        console.error('Failed to pre-hydrate reference images', e);
      }
    }

    const textToCopy = (isOptimizedView && clickedNode.optimizedPromptEn?.trim())
      ? clickedNode.optimizedPromptEn.trim()
      : clickedNode.prompt;

    setConfig(prev => ({
      ...prev,
      prompt: textToCopy,
      aspectRatio: clickedNode.aspectRatio,
      imageSize: clickedNode.imageSize,
      model: normalizeModelId(clickedNode.model),
      referenceImages: referenceImages,
      mode: clickedNode.mode || GenerationMode.IMAGE // 🎯 Sync Mode (Image/Video)
    }));

    // [Draft Logic] Resume Draft if clicked on a draft node
    if (clickedNode.isDraft) {
      setDraftNodeId(clickedNode.id);
    } else {
      // Detach draft if clicking a finalized node (acting as "Edit Template" or "Remix")
      setDraftNodeId(null);
    }
  }, [setConfig]);

  const handleImageClick = useCallback((imageId: string) => {
    // 🎯 Shift=切换（向后兼容），无修饰键=替换
    const sourceImage = activeCanvas?.imageNodes.find(img => img.id === imageId);
    // Keep the parent prompt group focused so the subcard frame stays visible after click.
    setFocusedGroupId(sourceImage?.parentPromptId || null);
    selectNodes([imageId], (window.event as any)?.shiftKey ? 'toggle' : 'replace');

    // Set this image as source for continuing conversation
    setActiveSourceImage(imageId);
    // Clear prompt and existing references to start fresh continue-conversation
    setConfig(prev => ({ ...prev, prompt: '', referenceImages: [] }));

    // Create the follow-up draft node immediately
    // Remove the existing draft first, if any
    if (draftNodeId) {
      deletePromptNode(draftNodeId);
    }

    // Compute the follow-up draft position below the parent group
    if (sourceImage) {
      const parentPromptId = sourceImage.parentPromptId;
      const parentPrompt = activeCanvas?.promptNodes.find(p => p.id === parentPromptId);

      // For images, position.y is already the bottom anchor
      const sourceBottom = sourceImage.position.y;

      let draftPos = { x: sourceImage.position.x, y: sourceBottom + 100 }; // Fallback: 100px below the source image

      if (parentPrompt) {
        // Find all sibling child cards and compute the maximum bottom Y
        const siblingImages = activeCanvas?.imageNodes.filter(img => img.parentPromptId === parentPromptId) || [];
        let maxY = parentPrompt.position.y; // Parent prompt bottom anchor

        siblingImages.forEach(img => {
          // Images already use a bottom anchor, so no extra height is needed
          maxY = Math.max(maxY, img.position.y);
        });

        draftPos = {
          x: sourceImage.position.x,
          y: maxY + 80  // 80px below the lowest card
        };
      }

      const newId = Date.now().toString();
      addPromptNode({
        id: newId,
        prompt: '',  // Empty prompt; wait for user input
        position: draftPos,
        aspectRatio: config.aspectRatio,
        imageSize: config.imageSize,
        model: normalizeModelId(config.model),
        modelLabel: resolveModelDisplayName(config.model, getModelMetadata(config.model)?.name || config.model),
        childImageIds: [],
        referenceImages: [],  // The source image will be attached automatically in handleGenerate
        timestamp: Date.now(),
        sourceImageId: imageId,
        isDraft: true,
        mode: config.mode,
        tags: []
      });
      setDraftNodeId(newId);
    }
  }, [selectNodes, setConfig, draftNodeId, deletePromptNode, activeCanvas, addPromptNode, config, getCardDimensions]);

  // Dynamic Group Bounds Calculation
  const getComputedGroupBounds = useCallback((group: CanvasGroup) => {
    if (!activeCanvas) return undefined;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasNodes = false;
    // 🎯 Uniform 40px padding on all sides
    const PADDING = 40;
    const TOP_EXTRA = 40; // Extra for header
    const BOTTOM_EXTRA = 40;

    // Helper to merge rect into bounds
    const addRect = (x: number, y: number, w: number, h: number) => {
      // Anchored at Bottom Center (x, y)
      const left = x - w / 2;
      const right = x + w / 2;
      const top = y - h;
      const bottom = y;

      minX = Math.min(minX, left);
      maxX = Math.max(maxX, right);
      minY = Math.min(minY, top);
      maxY = Math.max(maxY, bottom);
      hasNodes = true;
    };

    group.nodeIds.forEach(id => {
      // 1. Check Prompts
      const prompt = promptNodeById.get(id);
      if (prompt) {
        addRect(prompt.position.x, prompt.position.y, 380, prompt.height || 200);
        return;
      }
      // 2. Check Images
      const img = imageNodeById.get(id);
      if (img) {
        const { width, totalHeight } = getCardDimensions(img.aspectRatio, true);
        addRect(img.position.x, img.position.y, width, totalHeight);
      }
    });

    if (!hasNodes) return undefined;

    return {
      x: minX - PADDING,
      y: minY - (PADDING + TOP_EXTRA),
      width: (maxX - minX) + PADDING * 2,
      height: (maxY - minY) + PADDING + TOP_EXTRA + BOTTOM_EXTRA
    };
  }, [activeCanvas, imageNodeById, promptNodeById]);

  const promptGroupLayerById = React.useMemo(() => {
    const groupLayerMap = new Map<string, number>();
    if (!activeCanvas) return groupLayerMap;

    activeCanvas.promptNodes.forEach((promptNode) => {
      groupLayerMap.set(promptNode.id, promptNode.zIndex ?? 0);
    });

    activeCanvas.imageNodes.forEach((imageNode) => {
      if (!imageNode.parentPromptId) return;
      const currentLayer = groupLayerMap.get(imageNode.parentPromptId) ?? 0;
      const imageLayer = imageNode.zIndex ?? 0;
      if (imageLayer > currentLayer) {
        groupLayerMap.set(imageNode.parentPromptId, imageLayer);
      }
    });

    return groupLayerMap;
  }, [activeCanvas]);

  const resolveCurrentPromptChildImages = useCallback((
    promptNode: PromptNode | undefined | null,
    imageNodes: GeneratedImage[],
  ) => {
    if (!promptNode) return [] as GeneratedImage[];

    const promptId = promptNode.id;
    const sourceImageId = promptNode.sourceImageId;
    const orderedIds = (promptNode.childImageIds || []).filter((id): id is string => Boolean(id));
    const imageNodeById = new Map(imageNodes.map((imageNode) => [imageNode.id, imageNode] as const));
    const strongOwnedImages = imageNodes.filter((imageNode) => (
      imageNode.parentPromptId === promptId && imageNode.id !== sourceImageId
    ));

    if (strongOwnedImages.length > 0) {
      const orderedOwnedImages: GeneratedImage[] = [];
      const seenIds = new Set<string>();

      orderedIds.forEach((imageId) => {
        const imageNode = imageNodeById.get(imageId);
        if (!imageNode || imageNode.id === sourceImageId || imageNode.parentPromptId !== promptId || seenIds.has(imageNode.id)) {
          return;
        }
        seenIds.add(imageNode.id);
        orderedOwnedImages.push(imageNode);
      });

      strongOwnedImages.forEach((imageNode) => {
        if (seenIds.has(imageNode.id)) return;
        seenIds.add(imageNode.id);
        orderedOwnedImages.push(imageNode);
      });

      return orderedOwnedImages;
    }

    if (promptNode.error) {
      return [] as GeneratedImage[];
    }

    if (sourceImageId) {
      return [] as GeneratedImage[];
    }

    const legacyOwnedImages: GeneratedImage[] = [];
    const seenIds = new Set<string>();
    orderedIds.forEach((imageId) => {
      const imageNode = imageNodeById.get(imageId);
      if (!imageNode || imageNode.id === sourceImageId || imageNode.parentPromptId || seenIds.has(imageNode.id)) {
        return;
      }
      seenIds.add(imageNode.id);
      legacyOwnedImages.push(imageNode);
    });

    return legacyOwnedImages;
  }, []);

  const promptGroupBoundsById = React.useMemo(() => {
    const boundsMap = new Map<string, { x: number; y: number; width: number; height: number }>();
    if (!activeCanvas) return boundsMap;

    const PADDING = 40;
    const TOP_EXTRA = 40;
    const BOTTOM_EXTRA = 40;

    activeCanvas.promptNodes.forEach((promptNode) => {
      if (promptNode.isDraft && !promptNode.isGenerating) {
        return;
      }

      const lockedBounds = lockedGroupBoundsById[promptNode.id];
      if (lockedBounds) {
        // Rule: once a prompt-group drag starts, overlap detection keeps using the
        // pre-drag expanded footprint until the drag ends, preventing focus/stack
        // state from thrashing while subcards visually collapse.
        boundsMap.set(promptNode.id, lockedBounds);
        return;
      }

      const childImages = resolveCurrentPromptChildImages(promptNode, activeCanvas.imageNodes);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      const addRect = (x: number, y: number, width: number, height: number) => {
        minX = Math.min(minX, x - width / 2);
        maxX = Math.max(maxX, x + width / 2);
        minY = Math.min(minY, y - height);
        maxY = Math.max(maxY, y);
      };

      const livePromptPosition = liveNodePositionById[promptNode.id] ?? promptNode.position;
      addRect(livePromptPosition.x, livePromptPosition.y, 380, promptNode.height || 200);
      childImages.forEach((imageNode) => {
        const { width, totalHeight } = getCardDimensions(imageNode.aspectRatio, true);
        const liveImagePosition = liveNodePositionById[imageNode.id] ?? imageNode.position;
        addRect(liveImagePosition.x, liveImagePosition.y, width, totalHeight);
      });

      if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return;
      }

      boundsMap.set(promptNode.id, {
        x: minX - PADDING,
        y: minY - (PADDING + TOP_EXTRA),
        width: (maxX - minX) + PADDING * 2,
        height: (maxY - minY) + PADDING + TOP_EXTRA + BOTTOM_EXTRA,
      });
    });

    return boundsMap;
  }, [activeCanvas, lockedGroupBoundsById, liveNodePositionById, resolveCurrentPromptChildImages]);

  const generatingGroupStateSignatureRef = useRef('');
  useEffect(() => {
    if (!activeCanvas) {
      setGeneratingGroupIds([]);
      return;
    }

    const nextGeneratingGroupIds = activeCanvas.promptNodes
      .filter((promptNode) => {
        const childImages = resolveCurrentPromptChildImages(promptNode, activeCanvas.imageNodes);
        return Boolean(promptNode.isGenerating) || childImages.some((imageNode) => imageNode.isGenerating);
      })
      .map((promptNode) => promptNode.id)
      .sort();

    const signature = nextGeneratingGroupIds.join('|');
    if (generatingGroupStateSignatureRef.current === signature) {
      return;
    }
    generatingGroupStateSignatureRef.current = signature;
    setGeneratingGroupIds(nextGeneratingGroupIds);
  }, [activeCanvas, resolveCurrentPromptChildImages]);

  const computedGroupOverlapMap = React.useMemo(() => {
    const nextOverlapMap: Record<string, string[]> = {};
    const entries = Array.from(promptGroupBoundsById.entries());

    entries.forEach(([groupId]) => {
      nextOverlapMap[groupId] = [];
    });

    for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
      const [leftId, leftBounds] = entries[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
        const [rightId, rightBounds] = entries[rightIndex];
        if (!boundsIntersect(leftBounds, rightBounds)) continue;
        nextOverlapMap[leftId].push(rightId);
        nextOverlapMap[rightId].push(leftId);
      }
    }

    return nextOverlapMap;
  }, [promptGroupBoundsById]);

  const groupOverlapStateSignatureRef = useRef('');
  useEffect(() => {
    const normalized = Object.keys(computedGroupOverlapMap)
      .sort()
      .map((groupId) => `${groupId}:${(computedGroupOverlapMap[groupId] || []).slice().sort().join(',')}`)
      .join('|');

    if (groupOverlapStateSignatureRef.current === normalized) {
      return;
    }
    groupOverlapStateSignatureRef.current = normalized;
    setGroupOverlapMap(computedGroupOverlapMap);
  }, [computedGroupOverlapMap]);

  const maxPersistedCanvasLayer = React.useMemo(() => {
    if (!activeCanvas) return 0;

    let maxLayer = 0;

    activeCanvas.promptNodes.forEach((promptNode) => {
      maxLayer = Math.max(maxLayer, promptGroupLayerById.get(promptNode.id) ?? promptNode.zIndex ?? 0);
    });

    activeCanvas.imageNodes.forEach((imageNode) => {
      const baseLayer = imageNode.parentPromptId
        ? (promptGroupLayerById.get(imageNode.parentPromptId) ?? imageNode.zIndex ?? 0)
        : (imageNode.zIndex ?? 0);
      maxLayer = Math.max(maxLayer, baseLayer);
    });

    (activeCanvas.workflow?.nodes || []).forEach((workflowNode) => {
      maxLayer = Math.max(maxLayer, workflowNode.zIndex ?? 0);
    });

    activeCanvas.groups.forEach((group) => {
      maxLayer = Math.max(maxLayer, group.zIndex ?? 0);
    });

    return maxLayer;
  }, [activeCanvas, promptGroupLayerById]);

  const floatingStackBandSize = React.useMemo(
    () => (maxPersistedCanvasLayer + 1) * 100,
    [maxPersistedCanvasLayer]
  );

  const promptGroupStackZIndexById = React.useMemo(() => {
    const stackMap = new Map<string, number>();
    if (!activeCanvas) return stackMap;
    const generatingGroupIdSet = new Set(generatingGroupIds);

    activeCanvas.promptNodes.forEach((promptNode) => {
      const baseLayer = promptGroupLayerById.get(promptNode.id) ?? promptNode.zIndex ?? 0;
      const isOverlapping = (groupOverlapMap[promptNode.id] || []).length > 0;
      const tier: PromptGroupTier = focusedGroupId === promptNode.id && isOverlapping
        ? 'focused'
        : generatingGroupIdSet.has(promptNode.id)
          ? 'generating'
          : 'base';
      const floatingBonus = tier === 'generating'
        ? floatingStackBandSize * 2
        : tier === 'focused'
          ? floatingStackBandSize
          : 0;
      const stackZIndex = (baseLayer * 100) + (PROMPT_GROUP_TIER_WEIGHT[tier] * 10) + floatingBonus;

      stackMap.set(promptNode.id, stackZIndex);
    });

    return stackMap;
  }, [activeCanvas, floatingStackBandSize, focusedGroupId, generatingGroupIds, groupOverlapMap, promptGroupLayerById]);

  const standaloneImageStackZIndexById = React.useMemo(() => {
    const stackMap = new Map<string, number>();
    if (!activeCanvas) return stackMap;

    const now = Date.now();
    activeCanvas.imageNodes.forEach((imageNode) => {
      if (imageNode.parentPromptId) return;

      const baseLayer = imageNode.zIndex ?? 0;
      const isSelectedImage = selectedNodeIds.includes(imageNode.id);
      const isNewImage = now - (imageNode.timestamp || 0) < 10000;
      const isActiveImage = imageNode.id === activeSourceImage;

      let stackZIndex = baseLayer * 100;
      if (imageNode.isGenerating) {
        stackZIndex += floatingStackBandSize * 2;
        stackZIndex += 40;
      } else if (isNewImage) {
        stackZIndex += 30;
      } else if (isSelectedImage) {
        stackZIndex += 20;
      } else if (isActiveImage) {
        stackZIndex += 15;
      } else {
        stackZIndex += 10;
      }

      stackMap.set(imageNode.id, stackZIndex);
    });

    return stackMap;
  }, [activeCanvas, activeSourceImage, floatingStackBandSize, selectedNodeIds]);

  const workflowUtilityStackZIndexById = React.useMemo(() => {
    const stackMap = new Map<string, number>();
    if (!activeCanvas?.workflow?.nodes) return stackMap;

    activeCanvas.workflow.nodes.forEach((node) => {
      if (!isWorkflowUtilityNodeKind(node.kind)) return;

      const persistedOrder = (node.zIndex ?? 0) * 100;
      const isSelectedNode = selectedNodeIds.includes(node.id);
      stackMap.set(node.id, persistedOrder + (isSelectedNode ? 20 : 10));
    });

    return stackMap;
  }, [activeCanvas, selectedNodeIds]);

  const canvasGroupStackZIndexById = React.useMemo(() => {
    const stackMap = new Map<string, number>();
    if (!activeCanvas) return stackMap;

    activeCanvas.groups.forEach((group) => {
      const fallbackStack = ((group.zIndex ?? 0) * 100) + 10;
      let highestMemberStack = Number.NEGATIVE_INFINITY;

      group.nodeIds.forEach((nodeId) => {
        const promptStack = promptGroupStackZIndexById.get(nodeId);
        if (promptStack !== undefined) {
          highestMemberStack = Math.max(highestMemberStack, promptStack);
          return;
        }

        const imageNode = imageNodeById.get(nodeId);
        if (imageNode) {
          const imageStack = imageNode.parentPromptId
            ? (
              promptGroupStackZIndexById.get(imageNode.parentPromptId)
              ?? ((promptGroupLayerById.get(imageNode.parentPromptId) ?? imageNode.zIndex ?? 0) * 100 + 10)
            )
            : (
              standaloneImageStackZIndexById.get(imageNode.id)
              ?? ((imageNode.zIndex ?? 0) * 100 + 10)
            );
          highestMemberStack = Math.max(highestMemberStack, imageStack);
          return;
        }

        const workflowStack = workflowUtilityStackZIndexById.get(nodeId);
        if (workflowStack !== undefined) {
          highestMemberStack = Math.max(highestMemberStack, workflowStack);
        }
      });

      const syncedStack = Number.isFinite(highestMemberStack)
        ? Math.max(fallbackStack, highestMemberStack - 1)
        : fallbackStack;

      stackMap.set(group.id, syncedStack);
    });

    return stackMap;
  }, [
    activeCanvas,
    imageNodeById,
    promptGroupLayerById,
    promptGroupStackZIndexById,
    standaloneImageStackZIndexById,
    workflowUtilityStackZIndexById,
  ]);

  const canvasPerformanceProfile = React.useMemo(() => {
    const promptCount = activeCanvas?.promptNodes.length || 0;
    const imageCount = activeCanvas?.imageNodes.length || 0;
    const nodeCount = promptCount + imageCount;
    const connectionCount = (activeCanvas?.imageNodes.filter((node) => !!node.parentPromptId).length || 0)
      + (activeCanvas?.promptNodes.filter((node) => !!node.sourceImageId).length || 0);
    const isInteracting = isCanvasTransforming || Boolean(selectionBox?.active) || Boolean(dragConnection?.active);

    return getCanvasPerformanceProfile({
      scale: canvasTransform.scale || 1,
      isInteracting,
      nodeCount,
      connectionCount,
      viewportWidth: typeof window === 'undefined' ? 0 : window.innerWidth,
      viewportHeight: typeof window === 'undefined' ? 0 : window.innerHeight,
    });
  }, [
    activeCanvas,
    canvasTransform.scale,
    dragConnection?.active,
    isCanvasTransforming,
    selectionBox?.active,
  ]);

  // Viewport Culling (Virtualization) Logic
  // Optimization: Only render nodes overlapping with the current viewport (+buffer)
  const { visiblePromptNodes, visibleImageNodes, visibleWorkflowUtilityNodes, visibleGroups, nowTimestamp } = React.useMemo(() => {
    if (!activeCanvas) {
      return {
        visiblePromptNodes: [],
        visibleImageNodes: [],
        visibleWorkflowUtilityNodes: [],
        visibleGroups: [],
        nowTimestamp: Date.now(),
      };
    }

    // Buffer: Load 2 screens worth of content around the viewport to prevent flash on drag
    const BUFFER = canvasPerformanceProfile.overscanBuffer;

    // Viewport Render Bounds in Canvas Coordinates
    const vLeft = -canvasTransform.x / canvasTransform.scale - BUFFER;
    const vTop = -canvasTransform.y / canvasTransform.scale - BUFFER;
    const vRight = (window.innerWidth - canvasTransform.x) / canvasTransform.scale + BUFFER;
    const vBottom = (window.innerHeight - canvasTransform.y) / canvasTransform.scale + BUFFER;
    const getPromptGroupStackZIndex = (promptNode: PromptNode) => (
      promptGroupStackZIndexById.get(promptNode.id)
      ?? ((promptGroupLayerById.get(promptNode.id) ?? promptNode.zIndex ?? 0) * 100 + 10)
    );
    const getImageGroupStackZIndex = (imageNode: GeneratedImage) => (
      imageNode.parentPromptId
        ? (
          promptGroupStackZIndexById.get(imageNode.parentPromptId)
          ?? ((promptGroupLayerById.get(imageNode.parentPromptId) ?? imageNode.zIndex ?? 0) * 100 + 10)
        )
        : (
          standaloneImageStackZIndexById.get(imageNode.id)
          ?? ((imageNode.zIndex ?? 0) * 100 + 10)
        )
    );
    const resolveViewportNodePosition = <TNode extends { id: string; position: { x: number; y: number } }>(node: TNode) => (
      liveNodePositionById[node.id] ?? node.position
    );

    // 1. Filter Groups
    const visibleGroups = activeCanvas.groups
      .filter(g => {
        // 🎯 [Fix] 过滤掉空的分组（没有包含任何节点）
        if (!g.nodeIds || g.nodeIds.length === 0) {
          return false;
        }
        const { x, y, width, height } = g.bounds;
        return !(x > vRight || x + width < vLeft || y > vBottom || y + height < vTop);
      })
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    // 2. Filter prompt nodes (hide idle drafts, but keep nodes that are generating)
    const visiblePromptNodes = activeCanvas.promptNodes
      .filter(n => {
        // Hide a node only when it is a static draft; the active center control is responsible for rendering it
        // Once it enters generating state, it must appear on the canvas
        if (n.isDraft && !n.isGenerating) {
          return false;
        }

        // Estimate Bounds (Center X, Bottom Y)
        const w = 800;
        const h = 800;
        const position = resolveViewportNodePosition(n);
        const x = position.x - w / 2;
        const y = position.y - h;

        return !(x > vRight || x + w < vLeft || y > vBottom || y + h < vTop);
      })
      .sort((a, b) => {
        const zDiff = getPromptGroupStackZIndex(a) - getPromptGroupStackZIndex(b);
        if (zDiff !== 0) return zDiff;
        return a.timestamp - b.timestamp;
      });

    // 3. Filter Image Nodes
    const visibleImageNodes = activeCanvas.imageNodes
      .filter(n => {
        const w = 800;
        const h = 1200;
        const position = resolveViewportNodePosition(n);
        const x = position.x - w / 2;
        const y = position.y - h;
        return !(x > vRight || x + w < vLeft || y > vBottom || y + h < vTop);
      })
      .sort((a, b) => {
        const zDiff = getImageGroupStackZIndex(a) - getImageGroupStackZIndex(b);
        if (zDiff !== 0) return zDiff;
        return a.timestamp - b.timestamp;
      });

    // 🎯 Cache timestamp
    const visibleWorkflowUtilityNodes = (activeCanvas.workflow?.nodes || [])
      .filter((node): node is WorkflowUtilityCanvasNode => isWorkflowUtilityNodeKind(node.kind))
      .filter((node) => {
        const width = node.width || 284;
        const height = node.height || 176;
        const x = node.position.x - width / 2;
        const y = node.position.y - height;
        return !(x > vRight || x + width < vLeft || y > vBottom || y + height < vTop);
      })
      .sort((left, right) => {
        const zDiff = (left.zIndex ?? 0) - (right.zIndex ?? 0);
        if (zDiff !== 0) return zDiff;
        return left.id.localeCompare(right.id);
      });

    const nowTimestamp = Date.now();

    return { visiblePromptNodes, visibleImageNodes, visibleWorkflowUtilityNodes, visibleGroups, nowTimestamp };
  }, [activeCanvas, canvasPerformanceProfile.overscanBuffer, canvasTransform, liveNodePositionById, promptGroupLayerById, promptGroupStackZIndexById, standaloneImageStackZIndexById]);

  const actualChildImagesByPromptId = React.useMemo(() => {
    const childMap = new Map<string, GeneratedImage[]>();
    if (!activeCanvas) return childMap;

    activeCanvas.promptNodes.forEach((promptNode) => {
      const childImages = resolveCurrentPromptChildImages(promptNode, activeCanvas.imageNodes);
      if (childImages.length > 0) {
        childMap.set(promptNode.id, childImages);
      }
    });

    return childMap;
  }, [activeCanvas, resolveCurrentPromptChildImages]);

  const actualChildImageIdsByPromptId = React.useMemo(() => {
    const childIdMap = new Map<string, string[]>();

    actualChildImagesByPromptId.forEach((images, promptId) => {
      childIdMap.set(promptId, images.map((imageNode) => imageNode.id));
    });

    return childIdMap;
  }, [actualChildImagesByPromptId]);

  useEffect(() => {
    setImageCardHeightById({});
  }, [activeCanvas?.id]);

  useEffect(() => {
    if (!activeCanvas) {
      setFocusedGroupId(null);
      liveNodePositionByIdRef.current = {};
      liveDerivedNodeIdsByOwnerRef.current = {};
      promptDragOriginByIdRef.current = {};
      setLiveNodePositionById({});
      setLockedGroupBoundsById({});
      return;
    }

    if (focusedGroupId && !activeCanvas.promptNodes.some((promptNode) => promptNode.id === focusedGroupId)) {
      setFocusedGroupId(null);
      return;
    }

    if (selectedNodeIds.length === 0 && focusedGroupId) {
      setFocusedGroupId(null);
    }
  }, [activeCanvas, focusedGroupId, selectedNodeIds]);

  const liveNodePositionByIdRef = useRef<Record<string, { x: number; y: number }>>({});
  const liveDerivedNodeIdsByOwnerRef = useRef<Record<string, string[]>>({});
  const promptDragOriginByIdRef = useRef<Record<string, { x: number; y: number }>>({});
  const syncLiveNodePositionState = useCallback(() => {
    const next = liveNodePositionByIdRef.current;
    setLiveNodePositionById((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length && prevKeys.every((key) => (
        next[key] && prev[key]?.x === next[key].x && prev[key]?.y === next[key].y
      ))) {
        return prev;
      }

      return { ...next };
    });
  }, []);

  const resolveCanvasNodePositionForLiveDrag = useCallback((nodeId: string) => {
    const livePosition = liveNodePositionByIdRef.current[nodeId];
    if (livePosition) {
      return livePosition;
    }

    const promptNode = activeCanvas?.promptNodes.find((node) => node.id === nodeId);
    if (promptNode) {
      return promptNode.position;
    }

    const imageNode = activeCanvas?.imageNodes.find((node) => node.id === nodeId);
    if (imageNode) {
      return imageNode.position;
    }

    const workflowNode = activeCanvas?.workflow?.nodes?.find((node) => node.id === nodeId);
    return workflowNode?.position ?? null;
  }, [activeCanvas]);

  const applyLiveNodeDeltaToDraggedSet = useCallback((
    ownerId: string,
    nodeIds: string[],
    delta: { x: number; y: number },
  ) => {
    if (!ownerId || nodeIds.length === 0 || (delta.x === 0 && delta.y === 0)) {
      return;
    }

    const companionIds = Array.from(new Set(
      nodeIds.filter((nodeId) => Boolean(nodeId) && nodeId !== ownerId)
    ));

    const previousCompanionIds = liveDerivedNodeIdsByOwnerRef.current[ownerId] || [];
    let nextLivePositions = liveNodePositionByIdRef.current;
    let hasLivePositionChanged = false;

    previousCompanionIds.forEach((nodeId) => {
      if (companionIds.includes(nodeId) || !(nodeId in nextLivePositions)) {
        return;
      }

      if (nextLivePositions === liveNodePositionByIdRef.current) {
        nextLivePositions = { ...nextLivePositions };
      }
      delete nextLivePositions[nodeId];
      hasLivePositionChanged = true;
    });

    companionIds.forEach((nodeId) => {
      const basePosition = resolveCanvasNodePositionForLiveDrag(nodeId);
      if (!basePosition) {
        return;
      }

      const nextPosition = {
        x: basePosition.x + delta.x,
        y: basePosition.y + delta.y,
      };
      const previousPosition = nextLivePositions[nodeId];

      if (!previousPosition || previousPosition.x !== nextPosition.x || previousPosition.y !== nextPosition.y) {
        if (nextLivePositions === liveNodePositionByIdRef.current) {
          nextLivePositions = { ...nextLivePositions };
        }
        nextLivePositions[nodeId] = nextPosition;
        hasLivePositionChanged = true;
      }
    });

    liveDerivedNodeIdsByOwnerRef.current = {
      ...liveDerivedNodeIdsByOwnerRef.current,
      [ownerId]: companionIds,
    };

    if (hasLivePositionChanged) {
      liveNodePositionByIdRef.current = nextLivePositions;
      syncLiveNodePositionState();
    }
  }, [resolveCanvasNodePositionForLiveDrag, syncLiveNodePositionState]);

  const handleLiveNodePositionChange = useCallback((nodeId: string, position: { x: number; y: number } | null) => {
    const promptNode = activeCanvas?.promptNodes.find((candidate) => candidate.id === nodeId) ?? null;
    const groupId = promptNode
      ? nodeId
      : (activeCanvas?.imageNodes.find((imageNode) => imageNode.id === nodeId)?.parentPromptId ?? null);

    if (promptNode && position && !promptDragOriginByIdRef.current[nodeId]) {
      promptDragOriginByIdRef.current = {
        ...promptDragOriginByIdRef.current,
        [nodeId]: promptNode.position,
      };
    }

    let nextLivePositions = liveNodePositionByIdRef.current;
    let hasLivePositionChanged = false;

    if (!position) {
      const derivedNodeIds = liveDerivedNodeIdsByOwnerRef.current[nodeId] || [];

      if (nodeId in nextLivePositions) {
        nextLivePositions = { ...nextLivePositions };
        delete nextLivePositions[nodeId];
        hasLivePositionChanged = true;
      }

      derivedNodeIds.forEach((derivedNodeId) => {
        if (!(derivedNodeId in nextLivePositions)) {
          return;
        }

        if (nextLivePositions === liveNodePositionByIdRef.current) {
          nextLivePositions = { ...nextLivePositions };
        }
        delete nextLivePositions[derivedNodeId];
        hasLivePositionChanged = true;
      });

      if (nodeId in liveDerivedNodeIdsByOwnerRef.current) {
        const nextDerivedNodeIdsByOwner = { ...liveDerivedNodeIdsByOwnerRef.current };
        delete nextDerivedNodeIdsByOwner[nodeId];
        liveDerivedNodeIdsByOwnerRef.current = nextDerivedNodeIdsByOwner;
      }

      if (promptNode && nodeId in promptDragOriginByIdRef.current) {
        const nextPromptDragOrigins = { ...promptDragOriginByIdRef.current };
        delete nextPromptDragOrigins[nodeId];
        promptDragOriginByIdRef.current = nextPromptDragOrigins;
      }
    } else {
      const previous = nextLivePositions[nodeId];
      if (!previous || previous.x !== position.x || previous.y !== position.y) {
        nextLivePositions = {
          ...nextLivePositions,
          [nodeId]: position,
        };
        hasLivePositionChanged = true;
      }
    }

    if (!position && hasLivePositionChanged) {
      // Flush the last queued drag delta before we clear the live snapshot so
      // cards and connectors do not briefly fall back to stale persisted coords.
      moveSelectedNodesImmediate({ x: 0, y: 0 });
    }

    if (hasLivePositionChanged) {
      liveNodePositionByIdRef.current = nextLivePositions;
      syncLiveNodePositionState();
    }

    if (!groupId) {
      return;
    }

    setLockedGroupBoundsById((prev) => {
      if (position) {
        if (prev[groupId]) return prev;
        const currentBounds = promptGroupBoundsById.get(groupId);
        if (!currentBounds) return prev;
        return {
          ...prev,
          [groupId]: currentBounds,
        };
      }

      const hasOtherLiveNodeInGroup = Object.keys(liveNodePositionByIdRef.current).some((liveNodeId) => {
        if (liveNodeId === nodeId) return false;

        const liveGroupId = activeCanvas?.promptNodes.some((promptNode) => promptNode.id === liveNodeId)
          ? liveNodeId
          : (activeCanvas?.imageNodes.find((imageNode) => imageNode.id === liveNodeId)?.parentPromptId ?? null);

        return liveGroupId === groupId;
      });

      if (hasOtherLiveNodeInGroup || !(groupId in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  }, [activeCanvas, moveSelectedNodesImmediate, promptGroupBoundsById, syncLiveNodePositionState]);

  const handleImageCardHeightChange = useCallback((imageId: string, height: number) => {
    if (!(height > 0)) return;

    setImageCardHeightById((prev) => {
      const previousHeight = prev[imageId];
      if (previousHeight && Math.abs(previousHeight - height) <= 1) {
        return prev;
      }

      return {
        ...prev,
        [imageId]: height,
      };
    });
  }, []);

  const promptGroupNodeIdsById = React.useMemo(() => {
    const nodeIdsByGroupId = new Map<string, string[]>();

    activeCanvas?.promptNodes.forEach((promptNode) => {
      if (promptNode.isDraft && !promptNode.isGenerating) {
        return;
      }
      nodeIdsByGroupId.set(promptNode.id, [
        promptNode.id,
        ...(actualChildImageIdsByPromptId.get(promptNode.id) || []),
      ]);
    });

    return nodeIdsByGroupId;
  }, [activeCanvas, actualChildImageIdsByPromptId]);

  const resolvePromptGroupIdForNodeId = useCallback((nodeId: string) => {
    if (!activeCanvas) return null;
    if (activeCanvas.promptNodes.some((promptNode) => promptNode.id === nodeId)) {
      return nodeId;
    }
    const imageNode = activeCanvas.imageNodes.find((node) => node.id === nodeId);
    return imageNode?.parentPromptId || null;
  }, [activeCanvas]);

  const handleFocusPromptGroup = useCallback((groupId: string | null, options?: {
    nodeIds?: string[];
    keepSelection?: boolean;
  }) => {
    setFocusedGroupId(groupId);
    if (!groupId || options?.keepSelection || !options?.nodeIds?.length) {
      return;
    }
    selectNodes(options.nodeIds, 'replace');
  }, [selectNodes]);

  const promptGroupViews = React.useMemo<PromptGroupView[]>(() => {
    if (!activeCanvas) return [];

    return activeCanvas.promptNodes
      .filter((promptNode) => !(promptNode.isDraft && !promptNode.isGenerating))
      .map((promptNode) => {
        const childImages = actualChildImagesByPromptId.get(promptNode.id) || [];
        const bounds = promptGroupBoundsById.get(promptNode.id);
        if (!bounds) {
          return null;
        }

        const isOverlapping = (groupOverlapMap[promptNode.id] || []).length > 0;
        const tier: PromptGroupTier = focusedGroupId === promptNode.id && isOverlapping
          ? 'focused'
          : generatingGroupIds.includes(promptNode.id)
            ? 'generating'
            : 'base';

        return {
          id: promptNode.id,
          rootPrompt: promptNode,
          childImages,
          intraGroupEdges: childImages.map((childNode) => ({ fromId: promptNode.id, toId: childNode.id })),
          bounds,
          baseOrder: promptGroupLayerById.get(promptNode.id) ?? promptNode.zIndex ?? 0,
          tier,
          isOverlapping,
        } satisfies PromptGroupView;
      })
      .filter((groupView): groupView is PromptGroupView => Boolean(groupView));
  }, [activeCanvas, actualChildImagesByPromptId, focusedGroupId, generatingGroupIds, groupOverlapMap, promptGroupBoundsById, promptGroupLayerById]);

  const visiblePromptGroupViews = React.useMemo(() => {
    const promptIdSet = new Set(visiblePromptNodes.map((promptNode) => promptNode.id));
    const imageIdSet = new Set(visibleImageNodes.map((imageNode) => imageNode.id));

    return promptGroupViews
      .filter((groupView) => {
        const isPromptVisible = promptIdSet.has(groupView.rootPrompt.id);
        const hasVisibleChild = groupView.childImages.some((imageNode) => imageIdSet.has(imageNode.id));
        return isPromptVisible || hasVisibleChild || groupView.tier !== 'base';
      })
      .sort((left, right) => {
        const tierDiff = PROMPT_GROUP_TIER_WEIGHT[left.tier] - PROMPT_GROUP_TIER_WEIGHT[right.tier];
        if (tierDiff !== 0) return tierDiff;
        const orderDiff = left.baseOrder - right.baseOrder;
        if (orderDiff !== 0) return orderDiff;
        return left.rootPrompt.timestamp - right.rootPrompt.timestamp;
      });
  }, [promptGroupViews, visibleImageNodes, visiblePromptNodes]);

  const autoRepairedPromptLayoutKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    autoRepairedPromptLayoutKeysRef.current.clear();
  }, [activeCanvas?.id]);

  useEffect(() => {
    if (!activeCanvas) return;

    const repairKeys = autoRepairedPromptLayoutKeysRef.current;
    const activeCanvasId = activeCanvas.id;

    activeCanvas.promptNodes.forEach((promptNode) => {
      const childImages = actualChildImagesByPromptId.get(promptNode.id) || [];
      if (childImages.length === 0) return;

      const repairKey = [
        activeCanvasId,
        promptNode.id,
        promptNode.position.x,
        promptNode.position.y,
        childImages.map((imageNode) => imageNode.id).join(','),
      ].join(':');

      if (repairKeys.has(repairKey)) return;

      const expectedPositions = buildGeneratedImageBatchPositions({
        basePosition: promptNode.position,
        items: childImages.map((imageNode) => ({
          aspectRatio: imageNode.aspectRatio,
          exactDimensions: imageNode.exactDimensions || parseImageDimensions(imageNode.dimensions),
        })),
        mode: promptNode.mode,
        isMobile,
      });

      const hasSevereLayoutDrift = childImages.some((imageNode, index) => {
        const expectedPosition = expectedPositions[index];
        if (!expectedPosition) return false;

        const dx = Math.abs(imageNode.position.x - expectedPosition.x);
        const dy = Math.abs(imageNode.position.y - expectedPosition.y);

        return dx > 220 || dy > 260;
      });

      if (!hasSevereLayoutDrift) return;

      repairKeys.add(repairKey);
      expectedPositions.forEach((expectedPosition, index) => {
        const imageNode = childImages[index];
        if (!imageNode || !expectedPosition) return;
        updateImageNodePosition(imageNode.id, expectedPosition, { ignoreSelection: true });
      });
    });
  }, [activeCanvas, actualChildImagesByPromptId, isMobile, parseImageDimensions, updateImageNodePosition]);

  const imageNodesById = React.useMemo(
    () => new Map((activeCanvas?.imageNodes || []).map(node => [node.id, node])),
    [activeCanvas]
  );

  const promptNodesById = React.useMemo(
    () => new Map((activeCanvas?.promptNodes || []).map(node => [node.id, node])),
    [activeCanvas]
  );

  const visibleImageNodesById = React.useMemo(
    () => new Map(visibleImageNodes.map(node => [node.id, node])),
    [visibleImageNodes]
  );

  const visibleImageNodeIds = React.useMemo(
    () => new Set(visibleImageNodes.map(node => node.id)),
    [visibleImageNodes]
  );

  const visibleChildImagesByPromptId = React.useMemo(() => {
    const childMap = new Map<string, GeneratedImage[]>();
    if (!activeCanvas) return childMap;

    visiblePromptNodes.forEach((promptNode) => {
      const images = resolveCurrentPromptChildImages(promptNode, visibleImageNodes);
      if (images.length > 0) {
        childMap.set(promptNode.id, images);
      }
    });

    return childMap;
  }, [activeCanvas, resolveCurrentPromptChildImages, visibleImageNodes, visiblePromptNodes]);

  const standaloneVisibleImageNodes = React.useMemo(
    () => {
      const promptGroupIdSet = new Set(promptGroupViews.map((groupView) => groupView.id));

      return visibleImageNodes.filter((imageNode) => (
        !imageNode.parentPromptId || !promptGroupIdSet.has(imageNode.parentPromptId)
      ));
    },
    [promptGroupViews, visibleImageNodes]
  );

  const workflowUtilityNodesById = React.useMemo(
    () => new Map(
      (activeCanvas?.workflow?.nodes || [])
        .filter((node): node is WorkflowUtilityCanvasNode => isWorkflowUtilityNodeKind(node.kind))
        .map((node) => [node.id, node])
    ),
    [activeCanvas]
  );

  const visibleWorkflowUtilityNodesById = React.useMemo(
    () => new Map(visibleWorkflowUtilityNodes.map((node) => [node.id, node])),
    [visibleWorkflowUtilityNodes]
  );

  const imageLoadSchedulingById = React.useMemo(() => {
    const scheduling = new Map<string, ScheduledImageLoadState>();
    if (!activeCanvas) return scheduling;

    const scale = canvasTransform.scale || 1;
    const viewportLeft = -canvasTransform.x / scale;
    const viewportTop = -canvasTransform.y / scale;
    const viewportRight = (window.innerWidth - canvasTransform.x) / scale;
    const viewportBottom = (window.innerHeight - canvasTransform.y) / scale;
    const viewportCenterX = (viewportLeft + viewportRight) / 2;
    const viewportCenterY = (viewportTop + viewportBottom) / 2;

    const viewportImages: Array<{ node: GeneratedImage; distance: number }> = [];
    const aboveViewportImages: Array<{ node: GeneratedImage; distance: number }> = [];
    const belowViewportImages: GeneratedImage[] = [];
    const lateralImages: Array<{ node: GeneratedImage; distance: number }> = [];

    activeCanvas.imageNodes.forEach((node) => {
      const width = 800;
      const height = 1200;
      const left = node.position.x - width / 2;
      const top = node.position.y - height;
      const right = left + width;
      const bottom = top + height;
      const intersectsViewport = !(left > viewportRight || right < viewportLeft || top > viewportBottom || bottom < viewportTop);

      if (intersectsViewport) {
        viewportImages.push({
          node,
          distance: Math.abs(node.position.x - viewportCenterX) + Math.abs(node.position.y - viewportCenterY),
        });
        return;
      }

      if (bottom < viewportTop) {
        aboveViewportImages.push({
          node,
          distance: viewportTop - bottom,
        });
        return;
      }

      if (top > viewportBottom) {
        belowViewportImages.push(node);
        return;
      }

      lateralImages.push({
        node,
        distance: Math.min(
          Math.abs(left - viewportRight),
          Math.abs(right - viewportLeft)
        ),
      });
    });

    viewportImages
      .sort((left, right) => left.distance - right.distance)
      .forEach(({ node }, index) => {
        scheduling.set(node.id, {
          loadBand: 0,
          loadPriority: 1400 - index,
          prefetchQuality: ImageQuality.PREVIEW,
        });
      });

    aboveViewportImages
      .sort((left, right) => left.distance - right.distance)
      .forEach(({ node }, index) => {
        scheduling.set(node.id, {
          loadBand: 1,
          loadPriority: 1100 - index,
          prefetchQuality: ImageQuality.THUMBNAIL,
        });
      });

    lateralImages
      .sort((left, right) => left.distance - right.distance)
      .forEach(({ node }, index) => {
        scheduling.set(node.id, {
          loadBand: 1,
          loadPriority: 1000 - index,
          prefetchQuality: ImageQuality.THUMBNAIL,
        });
      });

    const orderedBelowViewportImages = [...belowViewportImages].sort((left, right) => left.position.y - right.position.y);
    const belowSegmentSize = Math.max(1, Math.ceil(orderedBelowViewportImages.length / 3));

    orderedBelowViewportImages.forEach((node, index) => {
      const segment = Math.min(2, Math.floor(index / belowSegmentSize));
      const loadBand = (segment === 0 ? 1 : segment === 1 ? 2 : 3) as 1 | 2 | 3;
      const priorityBase = segment === 0 ? 900 : segment === 1 ? 700 : 500;

      scheduling.set(node.id, {
        loadBand,
        loadPriority: priorityBase - (index % belowSegmentSize),
        prefetchQuality: loadBand === 1 ? ImageQuality.THUMBNAIL : ImageQuality.MICRO,
      });
    });

    return scheduling;
  }, [activeCanvas, canvasTransform.scale, canvasTransform.x, canvasTransform.y]);

  useEffect(() => {
    if (!activeCanvas) return;
    if (isCanvasTransforming || promptBarUiBusy || selectionBox?.active || dragConnection?.active) {
      return;
    }

    let queuedKeys: string[] = [];
    const timer = window.setTimeout(() => {
      queuedKeys = Array.from(imageLoadSchedulingById.entries())
        .filter(([, scheduling]) => scheduling.loadBand === 1)
        .sort((left, right) => right[1].loadPriority - left[1].loadPriority)
        .slice(0, 8)
        .map(([imageId, scheduling]) => {
          const imageNode = imageNodesById.get(imageId);
          const imageKey = imageNode?.storageId || imageNode?.id;
          if (!imageKey) return null;

          void loadImage(imageKey, scheduling.prefetchQuality, scheduling.loadPriority);
          return imageKey;
        })
        .filter((imageKey): imageKey is string => Boolean(imageKey));
    }, 180);

    return () => {
      window.clearTimeout(timer);
      queuedKeys.forEach((imageKey) => {
        cancelImageLoad(imageKey);
      });
    };
  }, [
    activeCanvas,
    dragConnection?.active,
    imageLoadSchedulingById,
    imageNodesById,
    isCanvasTransforming,
    promptBarUiBusy,
    selectionBox?.active,
  ]);

  const [connectorPromptNodes, setConnectorPromptNodes] = useState<PromptNode[]>(visiblePromptNodes);
  const [connectorVisibleImageNodes, setConnectorVisibleImageNodes] = useState<GeneratedImage[]>(visibleImageNodes);
  const connectorLastCommitRef = useRef(0);
  const connectorThrottleTimerRef = useRef<number | null>(null);
  const connectorPendingSnapshotRef = useRef<{
    promptNodes: PromptNode[];
    imageNodes: GeneratedImage[];
  }>({
    promptNodes: visiblePromptNodes,
    imageNodes: visibleImageNodes,
  });

  const commitConnectorSnapshot = useCallback((snapshot: { promptNodes: PromptNode[]; imageNodes: GeneratedImage[] }) => {
    connectorLastCommitRef.current = Date.now();
    setConnectorPromptNodes(snapshot.promptNodes);
    setConnectorVisibleImageNodes(snapshot.imageNodes);
  }, []);

  const shouldUseLiveConnectorSnapshot = isNodeDragActive || !shouldThrottleEdges(canvasPerformanceProfile);

  useEffect(() => {
    return () => {
      if (connectorThrottleTimerRef.current !== null) {
        window.clearTimeout(connectorThrottleTimerRef.current);
        connectorThrottleTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const nextSnapshot = {
      promptNodes: visiblePromptNodes,
      imageNodes: visibleImageNodes,
    };

    connectorPendingSnapshotRef.current = nextSnapshot;

    if (shouldUseLiveConnectorSnapshot) {
      if (connectorThrottleTimerRef.current !== null) {
        window.clearTimeout(connectorThrottleTimerRef.current);
        connectorThrottleTimerRef.current = null;
      }
      commitConnectorSnapshot(nextSnapshot);
      return;
    }

    const elapsed = Date.now() - connectorLastCommitRef.current;
    if (elapsed >= canvasPerformanceProfile.edgeThrottleMs && connectorThrottleTimerRef.current === null) {
      commitConnectorSnapshot(nextSnapshot);
      return;
    }

    if (connectorThrottleTimerRef.current !== null) {
      return;
    }

    const waitTime = Math.max(1, canvasPerformanceProfile.edgeThrottleMs - elapsed);
    connectorThrottleTimerRef.current = window.setTimeout(() => {
      connectorThrottleTimerRef.current = null;
      const pendingSnapshot = connectorPendingSnapshotRef.current;
      if (pendingSnapshot) {
        commitConnectorSnapshot(pendingSnapshot);
      }
    }, waitTime);
  }, [
    canvasPerformanceProfile,
    commitConnectorSnapshot,
    shouldUseLiveConnectorSnapshot,
    visibleImageNodes,
    visiblePromptNodes,
  ]);

  const connectorRenderPromptNodes = shouldUseLiveConnectorSnapshot ? visiblePromptNodes : connectorPromptNodes;
  const connectorRenderVisibleImageNodes = shouldUseLiveConnectorSnapshot ? visibleImageNodes : connectorVisibleImageNodes;

  const connectorVisibleImageNodesById = React.useMemo(
    () => new Map(connectorRenderVisibleImageNodes.map((node) => [node.id, node])),
    [connectorRenderVisibleImageNodes]
  );

  const connectorPromptNodesById = React.useMemo(
    () => new Map(connectorRenderPromptNodes.map((node) => [node.id, node])),
    [connectorRenderPromptNodes]
  );

  const connectorVisibleImageNodeIds = React.useMemo(
    () => new Set(connectorRenderVisibleImageNodes.map((node) => node.id)),
    [connectorRenderVisibleImageNodes]
  );

  const resolveLivePromptPosition = useCallback((promptNode: PromptNode | undefined | null) => {
    if (!promptNode) return null;
    return liveNodePositionById[promptNode.id]
      ?? promptNodesById.get(promptNode.id)?.position
      ?? promptNode.position;
  }, [liveNodePositionById, promptNodesById]);

  const resolveLiveImagePosition = useCallback((imageNode: GeneratedImage | undefined | null) => {
    if (!imageNode) return null;
    return liveNodePositionById[imageNode.id]
      ?? imageNodesById.get(imageNode.id)?.position
      ?? imageNode.position;
  }, [imageNodesById, liveNodePositionById]);

  const connectorChildImagesByPromptId = React.useMemo(() => {
    const childMap = new Map<string, GeneratedImage[]>();
    if (!activeCanvas) return childMap;

    connectorRenderPromptNodes.forEach((promptNode) => {
      const images = resolveCurrentPromptChildImages(promptNode, connectorRenderVisibleImageNodes);
      if (images.length > 0) {
        childMap.set(promptNode.id, images);
      }
    });

    return childMap;
  }, [activeCanvas, connectorRenderPromptNodes, connectorRenderVisibleImageNodes, resolveCurrentPromptChildImages]);

  const expandedSelectedNodeIds = React.useMemo(
    () => Array.from(new Set(
      selectedNodeIds.flatMap((selectedId) => {
        const selectedPrompt = activeCanvas?.promptNodes.find((promptNode) => promptNode.id === selectedId);
        if (!selectedPrompt) return [selectedId];

        return [
          selectedId,
          ...(actualChildImageIdsByPromptId.get(selectedPrompt.id) || []),
        ];
      })
    )),
    [activeCanvas, actualChildImageIdsByPromptId, selectedNodeIds]
  );

  const handleCanvasNodeSelect = useCallback((nodeId: string) => {
    const nextGroupId = resolvePromptGroupIdForNodeId(nodeId);
    setFocusedGroupId(nextGroupId);
    selectNodes([nodeId], (window.event as any)?.shiftKey ? 'toggle' : 'replace');
    if ((window.event as any)?.button === 2) {
      const pos = getSelectionScreenCenter([nodeId]);
      if (pos) setSelectionMenuPosition(pos);
    }
  }, [getSelectionScreenCenter, resolvePromptGroupIdForNodeId, selectNodes]);

  const notifyWorkflowCard = useCallback((
    level: 'success' | 'warning' | 'info' | 'error',
    title: string,
    message: string,
  ) => {
    import('./services/system/notificationService').then(({ notify }) => {
      notify[level](title, message);
    });
  }, []);

  const getPromptChildrenForWorkflow = useCallback((promptNode: PromptNode | undefined | null) => {
    if (!promptNode || !activeCanvas) return [] as GeneratedImage[];
    return resolveCurrentPromptChildImages(promptNode, activeCanvas.imageNodes);
  }, [activeCanvas, resolveCurrentPromptChildImages]);

  const resolveWorkflowSourceIdsFromSelection = useCallback(() => {
    const explicitIds = selectedNodeIds.filter((nodeId) => (
      Boolean(activeCanvas?.promptNodes.some((promptNode) => promptNode.id === nodeId))
      || Boolean(activeCanvas?.imageNodes.some((imageNode) => imageNode.id === nodeId))
    ));

    if (explicitIds.length > 0) {
      return Array.from(new Set(explicitIds));
    }

    return activeSourceImage ? [activeSourceImage] : [];
  }, [activeCanvas, activeSourceImage, selectedNodeIds]);

  const resolveCanvasNodePosition = useCallback((nodeId?: string | null) => {
    if (!nodeId || !activeCanvas) return null;

    const promptNode = activeCanvas.promptNodes.find((node) => node.id === nodeId);
    if (promptNode) return promptNode.position;

    const imageNode = activeCanvas.imageNodes.find((node) => node.id === nodeId);
    if (imageNode) return imageNode.position;

    const workflowNode = workflowUtilityNodesById.get(nodeId);
    return workflowNode?.position || null;
  }, [activeCanvas, workflowUtilityNodesById]);

  const getWorkflowInsertPosition = useCallback((options?: {
    anchorNodeId?: string | null;
    anchorPosition?: { x: number; y: number } | null;
    offsetX?: number;
    offsetY?: number;
    width?: number;
    height?: number;
  }) => {
    const width = options?.width || 284;
    const height = options?.height || 176;
    const anchorPosition = options?.anchorPosition
      || resolveCanvasNodePosition(options?.anchorNodeId)
      || getViewportPreferredPosition(
        canvasRef.current?.getCurrentTransform() || canvasTransform,
        canvasRef.current?.getCanvasRect() || null,
        180,
        getViewportOffsets(isSidebarOpen, isChatOpen, isMobile, chatSidebarWidth),
      );

    return findSmartPosition(
      anchorPosition.x + (options?.offsetX || 0),
      anchorPosition.y + (options?.offsetY || 0),
      width,
      height,
      32,
    );
  }, [
    canvasTransform,
    chatSidebarWidth,
    findSmartPosition,
    isChatOpen,
    isMobile,
    isSidebarOpen,
    resolveCanvasNodePosition,
  ]);

  const resolvePrimaryWorkflowSourcePrompt = useCallback((sourceNodeIds?: string[]) => {
    if (!activeCanvas) return null;

    const directPrompt = (sourceNodeIds || [])
      .map((nodeId) => activeCanvas.promptNodes.find((node) => node.id === nodeId))
      .find((node): node is PromptNode => Boolean(node));
    if (directPrompt) return directPrompt;

    const parentPrompt = (sourceNodeIds || [])
      .map((nodeId) => activeCanvas.imageNodes.find((node) => node.id === nodeId))
      .map((imageNode) => (
        imageNode?.parentPromptId
          ? activeCanvas.promptNodes.find((promptNode) => promptNode.id === imageNode.parentPromptId)
          : null
      ))
      .find((node): node is PromptNode => Boolean(node));
    if (parentPrompt) return parentPrompt;

    const fallbackId = resolveWorkflowSourceIdsFromSelection()[0];
    if (!fallbackId) return null;

    return activeCanvas.promptNodes.find((node) => node.id === fallbackId)
      || activeCanvas.promptNodes.find((node) => node.id === (activeCanvas.imageNodes.find((imageNode) => imageNode.id === fallbackId)?.parentPromptId || ''))
      || null;
  }, [activeCanvas, resolveWorkflowSourceIdsFromSelection]);

  const resolvePrimaryWorkflowSourceImage = useCallback((sourceNodeIds?: string[]) => {
    if (!activeCanvas) return null;

    const directImage = (sourceNodeIds || [])
      .map((nodeId) => activeCanvas.imageNodes.find((node) => node.id === nodeId))
      .find((node): node is GeneratedImage => Boolean(node));
    if (directImage) return directImage;

    const promptResultImage = (sourceNodeIds || [])
      .map((nodeId) => activeCanvas.promptNodes.find((node) => node.id === nodeId))
      .find((node): node is PromptNode => Boolean(node));
    if (promptResultImage) {
      const children = getPromptChildrenForWorkflow(promptResultImage);
      if (children.length > 0) return children[0];
    }

    if (activeSourceImage) {
      return activeCanvas.imageNodes.find((node) => node.id === activeSourceImage) || null;
    }

    const fallbackId = resolveWorkflowSourceIdsFromSelection()[0];
    if (!fallbackId) return null;
    return activeCanvas.imageNodes.find((node) => node.id === fallbackId) || null;
  }, [activeCanvas, activeSourceImage, getPromptChildrenForWorkflow, resolveWorkflowSourceIdsFromSelection]);

  const exportWorkflowImagesAsZip = useCallback(async (images: GeneratedImage[], nameHint: string) => {
    const validImages = images.filter((imageNode) => Boolean(imageNode.originalUrl || imageNode.url));
    if (validImages.length === 0) {
      notifyWorkflowCard('warning', '暂无可导出图片', '当前卡片还没有可下载的图片结果。');
      return false;
    }

    try {
      const zip = new JSZip();
      const safeFolderName = (nameHint || 'kk-studio-export').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'kk-studio-export';
      const folder = zip.folder(safeFolderName) || zip;

      let exportedCount = 0;
      for (let index = 0; index < validImages.length; index += 1) {
        const imageNode = validImages[index];
        try {
          const response = await fetch(imageNode.originalUrl || imageNode.url);
          const blob = await response.blob();
          const mimeExtension = blob.type.split('/')[1] || imageNode.mimeType?.split('/')[1] || 'png';
          const fileStem = (imageNode.alias || imageNode.fileName || `image_${index + 1}`)
            .replace(/[\\/:*?"<>|]+/g, '_')
            .trim()
            || `image_${index + 1}`;
          folder.file(`${String(index + 1).padStart(2, '0')}_${fileStem}.${mimeExtension}`, blob);
          exportedCount += 1;
        } catch (error) {
          console.error('[workflow.save] Failed to export image', error);
        }
      }

      if (exportedCount === 0) {
        notifyWorkflowCard('error', '导出失败', '没有成功获取到可导出的图片数据。');
        return false;
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${safeFolderName}.zip`);
      notifyWorkflowCard('success', '导出完成', `已导出 ${exportedCount} 张图片。`);
      return true;
    } catch (error: any) {
      console.error('[workflow.save] Export failed', error);
      notifyWorkflowCard('error', '导出失败', error?.message || '请稍后重试。');
      return false;
    }
  }, [notifyWorkflowCard]);

  const createTemplatePromptNode = useCallback((options: {
    position: { x: number; y: number };
    prompt: string;
    mode?: GenerationMode;
    sourceImageId?: string;
  }): PromptNode => {
    const promptText = options.prompt.trim();
    const mode = options.mode || config.mode;
    const slideCount = Math.max(config.parallelCount || 1, config.pptSlides?.length || 0, mode === GenerationMode.PPT ? 4 : 1);

    return {
      id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      prompt: promptText,
      originalPrompt: promptText,
      promptOptimizationEnabled: !!config.enablePromptOptimization,
      thinkingMode: config.thinkingMode || 'minimal',
      enableGrounding: !!config.enableGrounding,
      enableImageSearch: !!config.enableImageSearch,
      position: options.position,
      aspectRatio: mode === GenerationMode.PPT ? AspectRatio.LANDSCAPE_16_9 : config.aspectRatio,
      imageSize: config.imageSize,
      model: config.model,
      childImageIds: [],
      referenceImages: options.sourceImageId ? [] : [...config.referenceImages],
      timestamp: Date.now(),
      sourceImageId: options.sourceImageId,
      parallelCount: slideCount,
      mode,
      tags: [],
      videoResolution: config.videoResolution,
      videoDuration: config.videoDuration,
      videoAudio: config.videoAudio,
      audioDuration: config.audioDuration,
      audioLyrics: config.audioLyrics,
      pptSlides: mode === GenerationMode.PPT
        ? normalizePptSlidesForCount(config.pptSlides, promptText, slideCount)
        : config.pptSlides,
      pptStyleLocked: config.pptStyleLocked !== false,
      maskUrl: config.maskUrl,
    };
  }, [config]);

  const handleWorkflowPreviewAction = useCallback((node: PreviewWorkflowNode) => {
    const sourceImage = resolvePrimaryWorkflowSourceImage(node.data.sourceNodeIds);
    if (sourceImage) {
      setWorkspaceSurface('workspace');
      handleOpenPreview(sourceImage.id);
      return;
    }

    const sourcePrompt = resolvePrimaryWorkflowSourcePrompt(node.data.sourceNodeIds);
    if (sourcePrompt) {
      selectNodes([sourcePrompt.id], 'replace');
      handleNavigateToNode(sourcePrompt.position.x, sourcePrompt.position.y, sourcePrompt.id);
      return;
    }

    notifyWorkflowCard('info', '预览卡未连接结果', '先把它挂到图片卡或主卡上，再从这里快速查看。');
  }, [
    handleNavigateToNode,
    handleOpenPreview,
    notifyWorkflowCard,
    resolvePrimaryWorkflowSourceImage,
    resolvePrimaryWorkflowSourcePrompt,
    selectNodes,
  ]);

  const handleWorkflowSaveAction = useCallback(async (node: SaveWorkflowNode) => {
    const sourcePrompt = resolvePrimaryWorkflowSourcePrompt(node.data.sourceNodeIds);
    const linkedImages = Array.from(new Set([
      ...((node.data.sourceNodeIds || [])
        .map((nodeId) => activeCanvas?.imageNodes.find((imageNode) => imageNode.id === nodeId))
        .filter((imageNode): imageNode is GeneratedImage => Boolean(imageNode))),
      ...(sourcePrompt ? getPromptChildrenForWorkflow(sourcePrompt) : []),
    ]));

    if ((node.data.format || 'zip').toLowerCase() === 'pptx') {
      if (sourcePrompt && sourcePrompt.mode === GenerationMode.PPT) {
        await handleExportPptxEditable(sourcePrompt);
        return;
      }

      notifyWorkflowCard('warning', '缺少 PPT 主卡', '保存卡已设为 PPTX 导出，但当前没有连接到 PPT 主卡。');
      return;
    }

    const fallbackImages = linkedImages.length > 0
      ? linkedImages
      : (activeCanvas?.imageNodes || []);

    await exportWorkflowImagesAsZip(
      fallbackImages,
      sourcePrompt?.prompt.slice(0, 24) || activeCanvas?.name || 'kk-studio-export',
    );
  }, [
    activeCanvas,
    exportWorkflowImagesAsZip,
    getPromptChildrenForWorkflow,
    handleExportPptxEditable,
    notifyWorkflowCard,
    resolvePrimaryWorkflowSourcePrompt,
  ]);

  const handleWorkflowAgentAction = useCallback((node: AgentWorkflowNode) => {
    const nextPrompt = String(node.data.instruction || node.data.notes || '').trim();
    if (!nextPrompt) {
      notifyWorkflowCard('warning', '增强卡暂时为空', '先给这张卡写一点提示增强说明，再一键填入输入栏。');
      return;
    }

    const sourceImage = resolvePrimaryWorkflowSourceImage(node.data.sourceNodeIds);
    if (sourceImage) {
      setActiveSourceImage(sourceImage.id);
      selectNodes([sourceImage.id], 'replace');
    }

    setWorkspaceSurface('workspace');
    setConfig((prev) => ({
      ...prev,
      prompt: nextPrompt,
      referenceImages: sourceImage ? [] : prev.referenceImages,
    }));

    notifyWorkflowCard(
      'success',
      '已填入提示增强',
      sourceImage ? '已保留关联图片作为 follow-up 起点。' : '增强提示已写入输入栏，可继续微调后再生成。',
    );
  }, [
    notifyWorkflowCard,
    resolvePrimaryWorkflowSourceImage,
    selectNodes,
    setConfig,
  ]);

  const handleAddWorkflowUtilityCard = useCallback((kind: 'preview' | 'save' | 'agent') => {
    const sourceNodeIds = resolveWorkflowSourceIdsFromSelection();
    const anchorId = sourceNodeIds[0];
    const basePosition = getWorkflowInsertPosition({
      anchorNodeId: anchorId,
      offsetX: anchorId ? 360 : 0,
      offsetY: anchorId ? 24 : 0,
      width: 284,
      height: 176,
    });

    if (kind === 'preview') {
      const previewNode = createPreviewWorkflowNode(basePosition, {
        title: '预览卡',
        summary: sourceNodeIds.length > 0 ? '聚合上游结果，方便快速检查画面。' : '先连接一张图片卡或主卡，再从这里统一预览结果。',
        sourceNodeIds,
      });
      addWorkflowNode(previewNode);
      selectNodes([previewNode.id], 'replace');
      bringNodesToFront([previewNode.id]);
      return;
    }

    if (kind === 'save') {
      const sourcePrompt = resolvePrimaryWorkflowSourcePrompt(sourceNodeIds);
      const saveNode = createSaveWorkflowNode(basePosition, {
        title: '保存卡',
        format: sourcePrompt?.mode === GenerationMode.PPT ? 'pptx' : 'zip',
        sourceNodeIds,
      });
      addWorkflowNode(saveNode);
      selectNodes([saveNode.id], 'replace');
      bringNodesToFront([saveNode.id]);
      return;
    }

    const agentNode = createAgentWorkflowNode(basePosition, {
      title: '提示增强卡',
      instruction: '保持主体一致，补足镜头语言、材质细节和画面氛围，再继续生成。',
      sourceNodeIds,
    });
    addWorkflowNode(agentNode);
    selectNodes([agentNode.id], 'replace');
    bringNodesToFront([agentNode.id]);
  }, [
    addWorkflowNode,
    bringNodesToFront,
    getWorkflowInsertPosition,
    resolvePrimaryWorkflowSourcePrompt,
    resolveWorkflowSourceIdsFromSelection,
    selectNodes,
  ]);

  const handleApplyWorkflowTemplate = useCallback(async (templateId: WorkflowTemplateId) => {
    if (!activeCanvas) {
      notifyWorkflowCard('warning', '当前没有可用画布', '请先打开一个项目，再插入模板。');
      return;
    }

    if (templateId === 'image-follow-up-image') {
      const sourceImage = resolvePrimaryWorkflowSourceImage(resolveWorkflowSourceIdsFromSelection());
      if (!sourceImage) {
        notifyWorkflowCard('warning', '需要先选一张图片', '这个模板会围绕现有图片创建 follow-up 主卡。');
        return;
      }

      const promptPosition = getWorkflowInsertPosition({
        anchorPosition: sourceImage.position,
        offsetX: 360,
        offsetY: 28,
        width: 380,
        height: 220,
      });
      const promptNode = createTemplatePromptNode({
        position: promptPosition,
        prompt: config.prompt.trim() || '继续延展这张图，保持主体与风格一致，补充新的镜头或细节。',
        sourceImageId: sourceImage.id,
      });

      await addPromptNode(promptNode);

      const previewNode = createPreviewWorkflowNode(
        getWorkflowInsertPosition({
          anchorPosition: promptPosition,
          offsetX: 360,
          offsetY: 0,
          width: 284,
          height: 176,
        }),
        {
          title: '预览卡',
          summary: '挂在 follow-up 链路旁，快速核对上游图片与后续结果。',
          sourceNodeIds: [sourceImage.id, promptNode.id],
        },
      );
      const agentNode = createAgentWorkflowNode(
        getWorkflowInsertPosition({
          anchorPosition: promptPosition,
          offsetX: 680,
          offsetY: 12,
          width: 284,
          height: 176,
        }),
        {
          title: '提示增强卡',
          instruction: '保持主体一致，延续构图与材质风格，只扩展新的动作、镜头或场景细节。',
          sourceNodeIds: [sourceImage.id, promptNode.id],
        },
      );

      addWorkflowNode(previewNode);
      addWorkflowNode(agentNode);
      selectNodes([promptNode.id], 'replace');
      bringNodesToFront([promptNode.id, previewNode.id, agentNode.id]);
      notifyWorkflowCard('success', '已插入 follow-up 模板', '原有图片链路没变，只额外挂上了预览卡和提示增强卡。');
      return;
    }

    if (templateId === 'ppt-prompt-export') {
      const promptText = config.prompt.trim() || '为这个主题生成一套可直接导出的 PPT 多页画面方案。';
      const promptPosition = getWorkflowInsertPosition({
        width: 380,
        height: 220,
      });
      const promptNode = createTemplatePromptNode({
        position: promptPosition,
        prompt: promptText,
        mode: GenerationMode.PPT,
      });
      const saveNode = createSaveWorkflowNode(
        getWorkflowInsertPosition({
          anchorPosition: promptPosition,
          offsetX: 360,
          offsetY: 20,
          width: 284,
          height: 176,
        }),
        {
          title: 'PPT 导出卡',
          format: 'pptx',
          sourceNodeIds: [promptNode.id],
        },
      );

      await addPromptNode(promptNode);
      addWorkflowNode(saveNode);
      selectNodes([promptNode.id], 'replace');
      bringNodesToFront([promptNode.id, saveNode.id]);
      notifyWorkflowCard('success', '已插入 PPT 模板', '模板仍然使用你现有的 PPT 主卡与导出链路。');
      return;
    }

    const promptPosition = getWorkflowInsertPosition({
      width: 380,
      height: 220,
    });
    const promptNode = createTemplatePromptNode({
      position: promptPosition,
      prompt: config.prompt.trim() || '在这里填写要生成的主提示词。',
    });
    const saveNode = createSaveWorkflowNode(
      getWorkflowInsertPosition({
        anchorPosition: promptPosition,
        offsetX: 360,
        offsetY: 20,
        width: 284,
        height: 176,
      }),
      {
        title: '保存卡',
        format: 'zip',
        sourceNodeIds: [promptNode.id],
      },
    );

    await addPromptNode(promptNode);
    addWorkflowNode(saveNode);
    selectNodes([promptNode.id], 'replace');
    bringNodesToFront([promptNode.id, saveNode.id]);
    notifyWorkflowCard('success', '已插入卡片模板', '主卡还是你原来的主卡，只在旁边补了一个导出入口。');
  }, [
    activeCanvas,
    addPromptNode,
    addWorkflowNode,
    bringNodesToFront,
    config,
    createTemplatePromptNode,
    getWorkflowInsertPosition,
    notifyWorkflowCard,
    resolvePrimaryWorkflowSourceImage,
    resolveWorkflowSourceIdsFromSelection,
    selectNodes,
  ]);

  const renderImageWorkflowItem = useCallback((item: ImageRenderItem) => {
    const node = item.node;
    const imageDetailLevel = node.parentPromptId ? 'full' : item.detailLevel;
    const renderedImagePosition = resolveLiveImagePosition(node) ?? node.position;

    return (
      <ImageNode
        image={node}
        detailLevel={imageDetailLevel}
        loadPriority={item.loadPriority}
        loadBand={item.loadBand}
        groupLayerZIndex={item.groupLayerZIndex}
        stackZIndexOverride={item.stackZIndexOverride}
        position={renderedImagePosition}
        onPositionChange={updateImageNodePosition}
        onLivePositionChange={handleLiveNodePositionChange}
        onHeightChange={handleImageCardHeightChange}
        highlighted={highlightedId === node.id}
        onDimensionsUpdate={updateImageNodeDisplayMeta}
        onUpdate={updateImageNode}
        onDelete={deleteImageNode}
        onConnectEnd={handleConnectEnd}
        onClick={handleImageClick}
        onBringToFront={() => bringNodesToFront([node.id])}
        isActive={node.id === activeSourceImage}
        isSelected={selectedNodeIds.includes(node.id)}
        onSelect={() => handleCanvasNodeSelect(node.id)}
        zoomScale={canvasTransform.scale}
        isMobile={isMobile}
        onPreview={handleOpenPreview}
        onPreviewPptStack={handleOpenPptStackPreview}
        onDownloadPptComposite={handleDownloadPptComposite}
        isCanvasTransforming={isCanvasTransforming}
        isNew={(nowTimestamp || Date.now()) - (node.timestamp || 0) < 10000}
        canvasTransform={canvasTransform}
        onDragStateChange={handleCanvasNodeDragStateChange}
        onDragDelta={(delta, sourceNodeId) => {
          if (!sourceNodeId) return;

          if (selectedNodeIds.includes(sourceNodeId) && expandedSelectedNodeIds.length > 0) {
            applyLiveNodeDeltaToDraggedSet(sourceNodeId, expandedSelectedNodeIds, delta);
            moveSelectedNodes(delta, expandedSelectedNodeIds);
            return;
          }

          moveSelectedNodes(delta, sourceNodeId);
        }}
      />
    );
  }, [
    activeSourceImage,
    bringNodesToFront,
    canvasTransform,
    deleteImageNode,
    expandedSelectedNodeIds,
    handleCanvasNodeSelect,
    handleConnectEnd,
    handleDownloadPptComposite,
    handleImageClick,
    handleImageCardHeightChange,
    handleCanvasNodeDragStateChange,
    handleLiveNodePositionChange,
    handleOpenPptStackPreview,
    handleOpenPreview,
    highlightedId,
    isCanvasTransforming,
    isMobile,
    applyLiveNodeDeltaToDraggedSet,
    moveSelectedNodes,
    resolveLiveImagePosition,
    moveSelectedNodes,
    nowTimestamp,
    selectedNodeIds,
    updateImageNode,
    updateImageNodeDisplayMeta,
    updateImageNodePosition,
  ]);

  const renderPromptGroupWorkflowItem = useCallback((item: PromptGroupRenderItem) => {
    const { groupView } = item;
    const node = groupView.rootPrompt;
    const groupNodeIds = promptGroupNodeIdsById.get(node.id) || [node.id];
    const groupStackZIndex = promptGroupStackZIndexById.get(node.id) ?? ((groupView.baseOrder * 100) + 10);
    const isGroupFocused = focusedGroupId === node.id && groupView.isOverlapping;
    const isGeneratingGroup = generatingGroupIds.includes(node.id);
    const isPromptDragActive = Boolean(liveNodePositionById[node.id]);
    const promptDetailLevel = item.detailLevel === 'thumbnail-shell' ? 'compact' : item.detailLevel;
    const groupConnectorZoom = Math.max(canvasTransform.scale || 1, 0.5);
    const groupConnectorStroke = Math.max(0.95, Math.min(2.4, 1.1 / groupConnectorZoom));
    const groupConnectorDashLength = Math.max(2.5, Math.min(8, 3.5 / groupConnectorZoom));
    const groupConnectorGapLength = Math.max(3.5, Math.min(12, 6 / groupConnectorZoom));
    const groupConnectorDash = `${groupConnectorDashLength} ${groupConnectorGapLength}`;
    const shadowBoost = isGroupFocused || isGeneratingGroup || groupView.isOverlapping;
    const connectorLayerZIndex = Math.max(0, groupStackZIndex - 1);
    const promptCardZIndex = groupStackZIndex + 20;
    const promptConnectorPosition = resolveLivePromptPosition(node) ?? node.position;
    const renderedPromptNode = (
      promptConnectorPosition.x === node.position.x && promptConnectorPosition.y === node.position.y
    )
      ? node
      : { ...node, position: promptConnectorPosition };
    const promptCardHeight = node.height || getPromptHeight(node.prompt);
    const promptCardWidth = isMobile
      ? Math.min(320, Math.max(248, ((typeof window !== 'undefined' ? window.innerWidth : 320) - 24)))
      : 320;
    // Tuck both connector ends slightly underneath the cards so the card surfaces
    // visually cover the dashed line instead of letting it float over the edges.
    const promptConnectorDockInset = 0;
    const childConnectorDockInset = 0;
    const connectorOccluderInset = Math.max(4, Math.min(12, 8 / groupConnectorZoom));
    const connectorOccluderRadius = Math.max(18, Math.min(26, 22 / groupConnectorZoom));
    const connectorMaskId = `prompt-group-mask-${node.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const connectorCanvasPadding = 128;
    const collapsedChildGapX = 20;
    const collapsedChildGapY = 28;
    const promptDragOrigin = promptDragOriginByIdRef.current[node.id];
    const promptDragDistance = (isPromptDragActive && promptDragOrigin)
      ? Math.hypot(
        promptConnectorPosition.x - promptDragOrigin.x,
        promptConnectorPosition.y - promptDragOrigin.y,
      )
      : 0;
    const childVisualLayoutsBase = groupView.childImages.map((childNode, childIndex) => {
      const livePosition = resolveLiveImagePosition(childNode) ?? childNode.position;
      const { width: renderedWidth, totalHeight: theoreticalHeight } = getCardDimensions(childNode.aspectRatio, true);
      let imageHeight = theoreticalHeight;

      if (childNode.dimensions && typeof childNode.dimensions === 'string') {
        const match = childNode.dimensions.match(/(\d+)\s*[xX]\s*(\d+)/);
        if (match?.[1] && match?.[2]) {
          const width = parseInt(match[1], 10);
          const height = parseInt(match[2], 10);
          if (width > 0 && height > 0) {
            const aspect = width / height;
            imageHeight = (renderedWidth / aspect) + 40;
          }
        }
      }

      const resolvedImageHeight = imageCardHeightById[childNode.id] ?? imageHeight;

      return {
        childNode,
        childIndex,
        renderedWidth,
        resolvedImageHeight,
        livePosition,
      };
    });
    const childVisualLayouts = (() => {
      if (!isPromptDragActive || !promptDragOrigin || childVisualLayoutsBase.length === 0) {
        return childVisualLayoutsBase.map((layout) => ({
          ...layout,
          visualPosition: layout.livePosition,
        }));
      }

      const totalRowWidth = childVisualLayoutsBase.reduce((sum, layout) => sum + layout.renderedWidth, 0)
        + (Math.max(0, childVisualLayoutsBase.length - 1) * collapsedChildGapX);
      let currentX = promptConnectorPosition.x - (totalRowWidth / 2);

      return childVisualLayoutsBase.map((layout) => {
        // Rule: dragging a main card does not hide subcards. Instead, every subcard
        // converges toward a centered horizontal row under the prompt, and the
        // connector path uses that exact same visual position.
        const collapseTargetPosition = {
          x: currentX + (layout.renderedWidth / 2),
          y: promptConnectorPosition.y + collapsedChildGapY + layout.resolvedImageHeight,
        };
        currentX += layout.renderedWidth + collapsedChildGapX;
        const collapseThreshold = 32 + (layout.childIndex * 24);
        const collapseProgress = Math.max(0, Math.min(1, promptDragDistance / collapseThreshold));
        const easedProgress = 1 - Math.pow(1 - collapseProgress, 2);
        const visualPosition = {
          x: layout.livePosition.x + ((collapseTargetPosition.x - layout.livePosition.x) * easedProgress),
          y: layout.livePosition.y + ((collapseTargetPosition.y - layout.livePosition.y) * easedProgress),
        };

        return {
          ...layout,
          visualPosition,
        };
      });
    })();
    const groupConnectorNodes = childVisualLayouts.map((layout) => ({
      key: `${node.id}-${layout.childNode.id}`,
      childNode: layout.childNode,
      childConnectorPosition: layout.visualPosition,
      renderedWidth: layout.renderedWidth,
      resolvedImageHeight: layout.resolvedImageHeight,
    }));
    const promptCardLeft = promptConnectorPosition.x - (promptCardWidth / 2);
    const promptCardRight = promptConnectorPosition.x + (promptCardWidth / 2);
    const promptCardTop = promptConnectorPosition.y - promptCardHeight;
    const promptCardBottom = promptConnectorPosition.y;
    const connectorBounds = groupConnectorNodes.reduce((acc, childLayout) => {
      const childLeft = childLayout.childConnectorPosition.x - (childLayout.renderedWidth / 2);
      const childRight = childLayout.childConnectorPosition.x + (childLayout.renderedWidth / 2);
      const childTop = childLayout.childConnectorPosition.y - childLayout.resolvedImageHeight;
      const childBottom = childLayout.childConnectorPosition.y;

      return {
        minX: Math.min(acc.minX, childLeft),
        maxX: Math.max(acc.maxX, childRight),
        minY: Math.min(acc.minY, childTop),
        maxY: Math.max(acc.maxY, childBottom),
      };
    }, {
      minX: promptCardLeft,
      maxX: promptCardRight,
      minY: promptCardTop,
      maxY: promptCardBottom,
    });
    const connectorSvgLeft = connectorBounds.minX - connectorCanvasPadding;
    const connectorSvgTop = connectorBounds.minY - connectorCanvasPadding;
    const connectorSvgWidth = Math.max(1, (connectorBounds.maxX - connectorBounds.minX) + (connectorCanvasPadding * 2));
    const connectorSvgHeight = Math.max(1, (connectorBounds.maxY - connectorBounds.minY) + (connectorCanvasPadding * 2));
    const groupConnectorLayouts = groupConnectorNodes.map((childLayout) => {
      const startX = promptConnectorPosition.x - connectorSvgLeft;
      const startY = (promptConnectorPosition.y - promptConnectorDockInset) - connectorSvgTop;
      const endX = childLayout.childConnectorPosition.x - connectorSvgLeft;
      const endY = (childLayout.childConnectorPosition.y - childLayout.resolvedImageHeight + childConnectorDockInset) - connectorSvgTop;

      return {
        key: childLayout.key,
        path: buildDockedVerticalConnectorPath(startX, startY, endX, endY),
        occluder: {
          key: `${childLayout.key}-occluder`,
          x: (childLayout.childConnectorPosition.x - (childLayout.renderedWidth / 2)) - connectorSvgLeft - connectorOccluderInset,
          y: (childLayout.childConnectorPosition.y - childLayout.resolvedImageHeight) - connectorSvgTop - connectorOccluderInset,
          width: childLayout.renderedWidth + (connectorOccluderInset * 2),
          height: childLayout.resolvedImageHeight + (connectorOccluderInset * 2),
          radius: connectorOccluderRadius,
        },
      };
    });
    const groupConnectorOccluders = [
      {
        key: `${node.id}-prompt-occluder`,
        x: promptCardLeft - connectorSvgLeft - connectorOccluderInset,
        y: promptCardTop - connectorSvgTop - connectorOccluderInset,
        width: promptCardWidth + (connectorOccluderInset * 2),
        height: promptCardHeight + (connectorOccluderInset * 2),
        radius: connectorOccluderRadius,
      },
      ...groupConnectorLayouts.map((layout) => layout.occluder),
    ];
    // The card layers already sit above the connector layer via z-index, so the
    // extra SVG mask only makes the line appear to "break" early on long drags.
    const shouldMaskGroupConnectors = false;

    return (
      <>
        {groupConnectorLayouts.length > 0 && (
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            shapeRendering="auto"
            width={connectorSvgWidth}
            height={connectorSvgHeight}
            viewBox={`0 0 ${connectorSvgWidth} ${connectorSvgHeight}`}
            style={{
              width: `${connectorSvgWidth}px`,
              height: `${connectorSvgHeight}px`,
              left: `${connectorSvgLeft}px`,
              top: `${connectorSvgTop}px`,
              overflow: 'visible',
              zIndex: connectorLayerZIndex,
            }}
          >
            {shouldMaskGroupConnectors && (
              <defs>
                <mask
                  id={connectorMaskId}
                  maskUnits="userSpaceOnUse"
                  maskContentUnits="userSpaceOnUse"
                  x={0}
                  y={0}
                  width={connectorSvgWidth}
                  height={connectorSvgHeight}
                >
                  <rect x={0} y={0} width={connectorSvgWidth} height={connectorSvgHeight} fill="white" />
                  {groupConnectorOccluders.map((occluder) => (
                    <rect
                      key={occluder.key}
                      x={occluder.x}
                      y={occluder.y}
                      width={occluder.width}
                      height={occluder.height}
                      rx={occluder.radius}
                      ry={occluder.radius}
                      fill="black"
                    />
                  ))}
                </mask>
              </defs>
            )}
            <g mask={shouldMaskGroupConnectors ? `url(#${connectorMaskId})` : undefined}>
              {groupConnectorLayouts.map((segment) => (
                <path
                  key={segment.key}
                  d={segment.path}
                  fill="none"
                  stroke="var(--connector-color, #6366f1)"
                  strokeWidth={groupConnectorStroke}
                  strokeDasharray={groupConnectorDash}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isGroupFocused ? 0.68 : 0.4}
                />
              ))}
            </g>
          </svg>
        )}

        <PromptNodeComponent
          node={renderedPromptNode}
          detailLevel={promptDetailLevel}
          groupLayerZIndex={promptGroupLayerById.get(node.id) ?? node.zIndex ?? 0}
          stackZIndexOverride={promptCardZIndex}
          shadowBoost={shadowBoost}
          actualChildImageCount={groupView.childImages.length}
          onPositionChange={updatePromptNodePosition}
          isSelected={selectedNodeIds.includes(node.id)}
          highlighted={highlightedId === node.id || isGroupFocused}
          onBringToFront={() => handleFocusPromptGroup(node.id, { keepSelection: true })}
          onSelect={() => {
            setFocusedGroupId(node.id);
            handleCanvasNodeSelect(node.id);
          }}
          onClickPrompt={handlePromptClick}
          onConnectStart={handleConnectStart}
          zoomScale={canvasTransform.scale}
          isCanvasTransforming={isCanvasTransforming}
          isMobile={isMobile}
          sourcePosition={node.sourceImageId
            ? (resolveLiveImagePosition(activeCanvas?.imageNodes.find(n => n.id === node.sourceImageId) || null)
              ?? activeCanvas?.imageNodes.find(n => n.id === node.sourceImageId)?.position)
            : undefined
          }
          onCancel={handleCancelGeneration}
          onRetry={handleRetryNode}
          onEditPptDeck={handleOpenPptDeckEditor}
          onExportPpt={handleExportPptPackageEditable}
          onExportPptx={handleExportPptxEditable}
          onRetryPptPage={handleRetryPptSinglePage}
          onExportPptPage={handleExportPptSinglePage}
          ioTrace={getNodeIoTrace(node.id)}
          onOpenStorageSettings={() => {
            setShowSettingsPanel(true);
            setSettingsInitialView('storage-settings');
          }}
          onDelete={deletePromptNode}
          onDisconnect={handleDisconnectPrompt}
          onUpdateNode={updatePromptNode}
          onLivePositionChange={handleLiveNodePositionChange}
          onHeightChange={(id, height) => {
            const latestNode = activeCanvas?.promptNodes.find(n => n.id === id);
            const targetNode = latestNode || node;
            if (targetNode.height !== height) {
              updatePromptNode({ ...targetNode, height });
            }
          }}
          onPin={handlePinDraft}
          onRemoveTag={(id, tag) => {
            const promptNode = activeCanvas?.promptNodes.find(n => n.id === id);
            if (promptNode && promptNode.tags) {
              const newTags = promptNode.tags.filter(t => t !== tag);
              updatePromptNode({ ...promptNode, tags: newTags });
            }
          }}
          onDragDelta={(delta, sourceNodeId) => {
            if (!sourceNodeId) return;
            if (selectedNodeIds.includes(sourceNodeId) && expandedSelectedNodeIds.length > 0) {
              applyLiveNodeDeltaToDraggedSet(sourceNodeId, expandedSelectedNodeIds, delta);
              moveSelectedNodes(delta, expandedSelectedNodeIds);
            } else {
              applyLiveNodeDeltaToDraggedSet(sourceNodeId, groupNodeIds, delta);
              moveSelectedNodes(delta, groupNodeIds);
            }
          }}
          canvasTransform={canvasTransform}
          onDragStateChange={handleCanvasNodeDragStateChange}
        />

        {groupConnectorNodes.map((childLayout, childIndex) => (
          <React.Fragment key={childLayout.childNode.id}>
            <ImageNode
              image={childLayout.childNode}
              detailLevel="full"
              loadPriority={1200}
              loadBand={0}
              groupLayerZIndex={promptGroupLayerById.get(node.id) ?? childLayout.childNode.zIndex ?? 0}
              stackZIndexOverride={promptCardZIndex + 10 + childIndex}
              shadowBoost={shadowBoost}
              position={childLayout.childConnectorPosition}
              onPositionChange={updateImageNodePosition}
              onLivePositionChange={handleLiveNodePositionChange}
              onHeightChange={handleImageCardHeightChange}
              highlighted={highlightedId === childLayout.childNode.id || isGroupFocused}
              onDimensionsUpdate={updateImageNodeDisplayMeta}
              onUpdate={updateImageNode}
              onDelete={deleteImageNode}
              onConnectEnd={handleConnectEnd}
              onClick={handleImageClick}
              onBringToFront={() => handleFocusPromptGroup(node.id, { keepSelection: true })}
              isActive={childLayout.childNode.id === activeSourceImage}
              isSelected={selectedNodeIds.includes(childLayout.childNode.id)}
              onSelect={() => {
                setFocusedGroupId(node.id);
                handleCanvasNodeSelect(childLayout.childNode.id);
              }}
              zoomScale={canvasTransform.scale}
              isMobile={isMobile}
              onPreview={handleOpenPreview}
              onPreviewPptStack={handleOpenPptStackPreview}
              onDownloadPptComposite={handleDownloadPptComposite}
              isCanvasTransforming={isCanvasTransforming}
              isNew={(nowTimestamp || Date.now()) - (childLayout.childNode.timestamp || 0) < 10000}
              canvasTransform={canvasTransform}
              onDragStateChange={handleCanvasNodeDragStateChange}
              onDragDelta={(delta, sourceNodeId) => {
                if (!sourceNodeId) return;

                if (selectedNodeIds.includes(sourceNodeId) && expandedSelectedNodeIds.length > 1) {
                  applyLiveNodeDeltaToDraggedSet(sourceNodeId, expandedSelectedNodeIds, delta);
                  moveSelectedNodes(delta, expandedSelectedNodeIds);
                  return;
                }

                moveSelectedNodes(delta, [sourceNodeId]);
              }}
            />
          </React.Fragment>
        ))}
      </>
    );
  }, [
    activeCanvas,
    canvasTransform,
    deletePromptNode,
    deleteImageNode,
    expandedSelectedNodeIds,
    getNodeIoTrace,
    handleCancelGeneration,
    handleCanvasNodeSelect,
    handleConnectStart,
    handleConnectEnd,
    handleDisconnectPrompt,
    handleDownloadPptComposite,
    handleExportPptPackageEditable,
    handleExportPptSinglePage,
    handleExportPptxEditable,
    handleOpenPptDeckEditor,
    handleOpenPptStackPreview,
    handleOpenPreview,
    handleCanvasNodeDragStateChange,
    handleLiveNodePositionChange,
    handleFocusPromptGroup,
    handleImageClick,
    handlePinDraft,
    handlePromptClick,
    handleRetryNode,
    handleRetryPptSinglePage,
    focusedGroupId,
    generatingGroupIds,
    imageCardHeightById,
    highlightedId,
    isMobile,
    applyLiveNodeDeltaToDraggedSet,
    moveSelectedNodes,
    nowTimestamp,
    promptGroupNodeIdsById,
    promptGroupLayerById,
    promptGroupStackZIndexById,
    resolveLiveImagePosition,
    resolveLivePromptPosition,
    getPromptHeight,
    selectedNodeIds,
    updatePromptNode,
    updateImageNode,
    updateImageNodeDisplayMeta,
    updateImageNodePosition,
    updatePromptNodePosition,
  ]);

  const renderPreviewWorkflowItem = useCallback((item: PreviewRenderItem) => (
    <PreviewNodeCard
      node={item.node}
      isSelected={selectedNodeIds.includes(item.node.id)}
      highlighted={highlightedId === item.node.id}
      zoomScale={canvasTransform.scale}
      onSelect={() => handleCanvasNodeSelect(item.node.id)}
      onBringToFront={() => bringNodesToFront([item.node.id])}
      onDelete={deleteWorkflowNode}
      onPositionChange={updateWorkflowNodePosition}
      onAction={handleWorkflowPreviewAction}
    />
  ), [
    bringNodesToFront,
    canvasTransform.scale,
    deleteWorkflowNode,
    handleCanvasNodeSelect,
    handleWorkflowPreviewAction,
    highlightedId,
    selectedNodeIds,
    updateWorkflowNodePosition,
  ]);

  const renderSaveWorkflowItem = useCallback((item: SaveRenderItem) => (
    <SaveNodeCard
      node={item.node}
      isSelected={selectedNodeIds.includes(item.node.id)}
      highlighted={highlightedId === item.node.id}
      zoomScale={canvasTransform.scale}
      onSelect={() => handleCanvasNodeSelect(item.node.id)}
      onBringToFront={() => bringNodesToFront([item.node.id])}
      onDelete={deleteWorkflowNode}
      onPositionChange={updateWorkflowNodePosition}
      onAction={(node) => {
        void handleWorkflowSaveAction(node);
      }}
    />
  ), [
    bringNodesToFront,
    canvasTransform.scale,
    deleteWorkflowNode,
    handleCanvasNodeSelect,
    handleWorkflowSaveAction,
    highlightedId,
    selectedNodeIds,
    updateWorkflowNodePosition,
  ]);

  const renderAgentWorkflowItem = useCallback((item: AgentRenderItem) => (
    <AgentNodeCard
      node={item.node}
      isSelected={selectedNodeIds.includes(item.node.id)}
      highlighted={highlightedId === item.node.id}
      zoomScale={canvasTransform.scale}
      onSelect={() => handleCanvasNodeSelect(item.node.id)}
      onBringToFront={() => bringNodesToFront([item.node.id])}
      onDelete={deleteWorkflowNode}
      onPositionChange={updateWorkflowNodePosition}
      onAction={handleWorkflowAgentAction}
    />
  ), [
    bringNodesToFront,
    canvasTransform.scale,
    deleteWorkflowNode,
    handleCanvasNodeSelect,
    handleWorkflowAgentAction,
    highlightedId,
    selectedNodeIds,
    updateWorkflowNodePosition,
  ]);

  const canvasNodeRendererRegistry = React.useMemo(
    () => createWorkflowNodeRendererRegistry<CanvasRenderItem>({
      'prompt-group': renderPromptGroupWorkflowItem,
      image: renderImageWorkflowItem,
      preview: renderPreviewWorkflowItem,
      save: renderSaveWorkflowItem,
      agent: renderAgentWorkflowItem,
    }),
    [
      renderAgentWorkflowItem,
      renderImageWorkflowItem,
      renderPreviewWorkflowItem,
      renderPromptGroupWorkflowItem,
      renderSaveWorkflowItem,
    ]
  );

  const canvasRenderItems = React.useMemo<CanvasRenderItem[]>(() => ([
    ...visiblePromptGroupViews.map((groupView) => ({
      id: groupView.id,
      kind: 'prompt-group' as const,
      groupView,
      node: groupView.rootPrompt,
      childNodes: groupView.childImages,
      detailLevel: canvasPerformanceProfile.cardDetailLevel,
    })),
    ...standaloneVisibleImageNodes.map((node) => ({
      id: node.id,
      kind: 'image' as const,
      node,
      detailLevel: canvasPerformanceProfile.cardDetailLevel,
      loadPriority: imageLoadSchedulingById.get(node.id)?.loadPriority ?? 0,
      loadBand: imageLoadSchedulingById.get(node.id)?.loadBand ?? 0,
      groupLayerZIndex: node.parentPromptId
        ? (promptGroupLayerById.get(node.parentPromptId) ?? node.zIndex ?? 0)
        : (node.zIndex ?? 0),
      stackZIndexOverride: node.parentPromptId
        ? promptGroupStackZIndexById.get(node.parentPromptId)
        : standaloneImageStackZIndexById.get(node.id),
    })),
    ...visibleWorkflowUtilityNodes.flatMap((node): Array<PreviewRenderItem | SaveRenderItem | AgentRenderItem> => {
      if (node.kind === 'preview') {
        return [{
          id: node.id,
          kind: 'preview',
          node,
        }];
      }

      if (node.kind === 'save') {
        return [{
          id: node.id,
          kind: 'save',
          node,
        }];
      }

      if (node.kind === 'agent') {
        return [{
          id: node.id,
          kind: 'agent',
          node,
        }];
      }

      return [];
    }),
  ]), [
    promptGroupLayerById,
    promptGroupStackZIndexById,
    standaloneImageStackZIndexById,
    standaloneVisibleImageNodes,
    canvasPerformanceProfile.cardDetailLevel,
    imageLoadSchedulingById,
    visiblePromptGroupViews,
    visibleWorkflowUtilityNodes,
  ]);

  const renderedVisibleGroups = React.useMemo(() => (
    visibleGroups.map((group) => (
      <CanvasGroupComponent
        key={group.id}
        group={group}
        zoom={canvasTransform.scale}
        stackZIndexOverride={canvasGroupStackZIndexById.get(group.id)}
        highlighted={highlightedId === group.id}
        onUngroup={removeGroup}
        onDragStart={(id, event) => {
          const nodeIds = group.nodeIds;
          const isMultiSelect = event.shiftKey || event.ctrlKey || event.metaKey;
          const alreadySelected = selectedNodeIds || [];
          const allNodesSelected = nodeIds.every((nodeId) => alreadySelected.includes(nodeId));

          if (isMultiSelect) {
            selectNodes(nodeIds, 'replace');
            return;
          }

          if (alreadySelected.length > 0 && allNodesSelected) {
            return;
          }

          selectNodes(nodeIds, 'toggle');
        }}
        onGroupDrag={(delta, sourceNodeIds) => moveSelectedNodesImmediate(delta, sourceNodeIds)}
        onDragStateChange={handleCanvasNodeDragStateChange}
        onUpdateGroup={updateGroup}
        computedBounds={getComputedGroupBounds(group)}
      />
    ))
  ), [
    canvasGroupStackZIndexById,
    canvasTransform.scale,
    getComputedGroupBounds,
    handleCanvasNodeDragStateChange,
    highlightedId,
    moveSelectedNodesImmediate,
    removeGroup,
    selectNodes,
    selectedNodeIds,
    updateGroup,
    visibleGroups,
  ]);

  const renderedCanvasItems = React.useMemo(() => (
    canvasRenderItems.map((item) => (
      <React.Fragment key={item.id}>
        {renderWorkflowNode(canvasNodeRendererRegistry, item)}
      </React.Fragment>
    ))
  ), [canvasNodeRendererRegistry, canvasRenderItems]);

  useEffect(() => {
    if (!isReady || !activeCanvas || !canvasRef.current) return;

    const totalCards = (activeCanvas.promptNodes?.length || 0) + (activeCanvas.imageNodes?.length || 0);
    if (totalCards === 0) return;

    if (visiblePromptNodes.length > 0 || visibleImageNodes.length > 0) {
      autoRecoveredCanvasKeyRef.current = '';
      return;
    }

    const recoveryKey = `${activeCanvas.id}:${totalCards}`;
    if (autoRecoveredCanvasKeyRef.current === recoveryKey) return;
    autoRecoveredCanvasKeyRef.current = recoveryKey;

    const timer = window.setTimeout(() => {
      console.warn('[App] Active canvas has cards but nothing is visible, auto-centering view', {
        canvasId: activeCanvas.id,
        promptCount: activeCanvas.promptNodes.length,
        imageCount: activeCanvas.imageNodes.length
      });
      handleResetView();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [
    isReady,
    activeCanvas,
    visiblePromptNodes.length,
    visibleImageNodes.length,
    handleResetView
  ]);

  const handleCanvasTransformChange = useCallback((nextTransform: { x: number; y: number; scale: number }) => {
    startTransition(() => {
      setCanvasTransform(nextTransform);
    });
  }, []);

  const handleCanvasInteractionChange = useCallback((state: { isDragging: boolean; isZooming: boolean }) => {
    const nextValue = state.isDragging || state.isZooming;
    setIsCanvasTransforming(prev => (prev === nextValue ? prev : nextValue));
  }, []);

  const CONNECTOR_LAYER_Z_INDEX = 0;
  const simplifiedConnectorMode = canvasPerformanceProfile.cardDetailLevel === 'thumbnail-shell'
    || (canvasPerformanceProfile.projectSize === 'huge' && canvasPerformanceProfile.isInteracting);
  const showConnectorHitAreas = !simplifiedConnectorMode;
  const showConnectorButtons = !simplifiedConnectorMode && canvasPerformanceProfile.cardDetailLevel === 'full';

  // Adaptive connector styles for zoomed canvas (keep dashed lines visible when zoomed out)
  const zoomForConnectors = Math.max(0.1, canvasTransform.scale || 1);
  const connectorStroke = Math.max(1, Math.min(3, 1 / zoomForConnectors));
  const connectorDashA = Math.max(2, Math.min(10, 4 / zoomForConnectors));
  const connectorDashB = Math.max(2, Math.min(10, 4 / zoomForConnectors));
  const connectorStrokeDasharray = `${connectorDashA} ${connectorDashB}`;
  const connectorStrokeLinecap: 'butt' | 'round' = 'round';
  const activeDragStroke = Math.max(2, Math.min(6, 3 / zoomForConnectors));
  const activeDragDashA = Math.max(3, Math.min(12, 6 / zoomForConnectors));
  const activeDragDashB = Math.max(2, Math.min(10, 4 / zoomForConnectors));
  const connectorHitStroke = Math.max(16, Math.min(40, 20 / zoomForConnectors));
  const connectorDotStart = Math.max(2, Math.min(4.5, 3 / zoomForConnectors));
  const connectorDotEnd = Math.max(1.5, Math.min(3.5, 2 / zoomForConnectors));
  const derivedMobileUserName = (() => {
    const candidate =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.display_name ||
      user?.user_metadata?.name ||
      user?.email?.split('@')[0];

    return typeof candidate === 'string' && candidate.trim().length > 0
      ? candidate.trim()
      : '\u7528\u6237';
  })();
  const derivedMobileUserAvatarUrl = resolveAvatarUrl(user?.user_metadata?.avatar_url);
  const backgroundMode = (
    promptBarUiBusy
    || isCanvasTransforming
    || Boolean(selectionBox?.active)
    || Boolean(dragConnection?.active)
    || showSettingsPanel
    || showProfileModal
    || showStorageModal
    || showMigrateModal
    || isSearchOpen
  )
    ? 'interactive-throttled'
    : 'normal';

  const desktopChromeRight = isChatOpen
    ? `calc(min(100vw - 60px, ${chatSidebarWidth + 28}px))`
    : workspaceSurface === 'library'
      ? '428px'
      : '48px';

  const handlePreviewFromLibrary = useCallback((imageId: string) => {
    setWorkspaceSurface('workspace');
    handleOpenPreview(imageId);
  }, [handleOpenPreview]);

  const handleFocusLibraryImage = useCallback((imageId: string) => {
    const imageNode = activeCanvas?.imageNodes.find(node => node.id === imageId);
    if (!imageNode) return;

    setWorkspaceSurface('workspace');
    handleNavigateToNode(imageNode.position.x, imageNode.position.y, imageNode.id);
  }, [activeCanvas, handleNavigateToNode]);

  

  // [Blocking Load] Wait for Canvas Hydration to prevent "Triple Load" flash
  // Keep this after all hooks so the hook order stays stable across renders.
  if (!isReady) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  const workspaceChrome = (
    <>
      {isMobile ? (
        <>
          <MobileHeader
            onMenuClick={() => setIsSidebarOpen(true)}
            onDashboardClick={() => openSettingsSurface('dashboard')}
            onSettingsClick={() => openSettingsSurface('api-management')}
            onUserClick={() => openProfileSurface('main')}
            onBillingClick={() => openProfileSurface('billing')}
            onRechargeClick={() => setShowRechargeModal(true)}
            balance={balance}
            balanceLoading={billingLoading}
            title="KK Studio"
            userName={derivedMobileUserName}
            userAvatarUrl={derivedMobileUserAvatarUrl}
          />
          <MobileWorkspaceQuickBar
            onSearch={() => {
              focusWorkspace();
              setIsSearchOpen(true);
            }}
            onOpenPromptLibrary={() => {
              window.dispatchEvent(new CustomEvent('kk-mobile-open-prompt-library'));
            }}
            onTogglePromptOptimization={() => {
              if (config.mode !== GenerationMode.IMAGE && config.mode !== GenerationMode.PPT) {
                return;
              }

              setConfig(prev => ({
                ...prev,
                enablePromptOptimization: !prev.enablePromptOptimization,
              }));
            }}
            promptOptimizationEnabled={!!config.enablePromptOptimization}
            promptOptimizationSupported={config.mode === GenerationMode.IMAGE || config.mode === GenerationMode.PPT}
          />
          <MobileTabBar
            currentMode={config.mode}
            currentTab={currentMobileTab}
            onSelectTab={handleSelectMobileTab}
            isVisible={true}
            onInteract={handleShowMobileNav}
          />
        </>
      ) : null}
    </>
  );


  return (
    <WorkspaceShell
      isMobile={isMobile}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onMouseMove={handleRootMouseMove}
      onMouseUp={handleRootMouseUp}
      chrome={workspaceChrome}
    >
      <GpuBackground
        opacity={0.4}
        showConnections={true}
        mode={backgroundMode}
      />

      {/* Top Left Credits Display */}
      {!isMobile && (
        <div className="absolute top-4 left-4 z-[100] flex items-center gap-2">
          <div
            className="flex items-center gap-3 px-4 py-2 rounded-full border shadow-2xl backdrop-blur-md transition-all hover:border-[var(--border-medium)] group"
            style={{
              background: 'var(--floating-shell-bg)',
              borderColor: 'var(--floating-shell-border)',
              boxShadow: 'var(--floating-shell-shadow)',
              backdropFilter: 'blur(18px) saturate(160%)',
              WebkitBackdropFilter: 'blur(18px) saturate(160%)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <Sparkles size={18} fill="currentColor" className="text-blue-500" />
              <div className="flex items-center select-none gap-1">
                <span className="text-[18px] font-mono font-bold leading-none min-w-[20px] drop-shadow-sm" style={{ color: 'var(--text-primary)' }}>
                  {remainingBalanceDisplay}
                </span>
                <span className="text-[14px] font-bold leading-none text-blue-400">积分</span>
              </div>
            </div>
            <div className="w-px h-6" style={{ backgroundColor: 'var(--floating-shell-border)' }} />
            <button
              onClick={() => setShowRechargeModal(true)}
              className="inline-flex items-center justify-center px-3 py-1 bg-indigo-500 hover:bg-indigo-400 text-white text-[11px] font-bold leading-none rounded-lg transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
            >
              充值
            </button>
          </div>
        </div>
      )}

      {/* [NEW] Mobile Header & Navigation */}
      {false && isMobile && (
        <>
          <MobileHeader
            onMenuClick={() => setIsSidebarOpen(true)}
            onDashboardClick={() => {
              openSettingsPanel('dashboard');
            }}
            onSettingsClick={() => {
              openSettingsPanel('api-management');
            }}
            onUserClick={() => {
              setProfileInitialView('main');
              setShowProfileModal(true);
            }}
            onBillingClick={() => {
              setProfileInitialView('billing');
              setShowProfileModal(true);
            }}
            onRechargeClick={() => {
              setShowRechargeModal(true);
            }}
            balance={balance}
            balanceLoading={billingLoading}
            title="KK Studio"
            userName={derivedMobileUserName}
            userAvatarUrl={derivedMobileUserAvatarUrl}
          />
          <MobileTabBar
            currentMode={config.mode}
            currentTab={currentMobileTab}
            onSelectTab={handleSelectMobileTab}
          />
        </>
      )}

      {/* Chat Sidebar (Left) */}


      {/* Top Right User Menu - Desktop Only */}
      {/* Top Right User Menu - Desktop Only */}
      {!isMobile && (
        <div id="header-user-menu" className="absolute top-4 z-[100] hidden md:flex items-center gap-3 transition-all duration-300" style={{ right: isChatOpen ? `calc(min(100vw - 60px, ${chatSidebarWidth + 28}px))` : '48px' }}>
          {/* User Avatar & Dropdown Trigger */}
          <div className="relative group">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="relative w-10 h-10 rounded-full overflow-hidden border-2 transition-all shadow-2xl flex items-center justify-center cursor-pointer active:scale-95"
              style={{ borderColor: 'var(--border-light)', backgroundColor: 'var(--bg-secondary)' }}
            >
              {derivedMobileUserAvatarUrl ? (
                <img src={derivedMobileUserAvatarUrl} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-amber-500 flex items-center justify-center font-bold text-white text-sm">
                  {user?.email?.[0].toUpperCase() || 'K'}
                </div>
              )}
            </button>

            {/* API Status Dot */}
            <div className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 z-10 shadow-lg ${derivedApiStatus === 'success' ? 'bg-green-500' :
              derivedApiStatus === 'error' ? 'bg-red-500' : 'bg-zinc-500'
              }`} style={{ borderColor: 'var(--bg-canvas)' }} />

            {/* New User Menu Dropdown */}
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute top-12 right-0 w-64 border rounded-xl shadow-2xl z-50 p-2 animate-in fade-in zoom-in-95 duration-100 origin-top-right" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-light)' }}>

                  {/* User Info Header */}
                  <div className="px-3 py-3 border-b mb-2 rounded-lg transition-colors cursor-pointer group"
                    style={{ borderColor: 'var(--border-light)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--toolbar-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onClick={() => {
                      setProfileInitialView('main');
                      setShowProfileModal(true);
                      setShowUserMenu(false);
                    }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold overflow-hidden">
                        {derivedMobileUserAvatarUrl ? (
                          <img src={derivedMobileUserAvatarUrl} className="w-full h-full object-cover" />
                        ) : user?.email?.[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user?.user_metadata?.full_name || '用户'}</div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{user?.email}</div>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setProfileInitialView('main');
                        setShowProfileModal(true);
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors text-left"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--toolbar-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-blue)' }}><User size={14} /></div>
                      个人中心
                    </button>

                    {/* [NEW] 账户管理鍏ュ彛 */}
                    <button
                      onClick={() => {
                        setProfileInitialView('billing');
                        setShowProfileModal(true);
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors text-left"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--toolbar-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-yellow)' }}><Zap size={14} /></div>
                      账号管理
                    </button>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowSettingsPanel(true);
                        setSettingsInitialView('dashboard');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors text-left"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--toolbar-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-purple)' }}><LayoutDashboard size={14} /></div>
                      设置
                    </button>

                    <div className="h-px my-1" style={{ backgroundColor: 'var(--border-light)' }} />

                    <button
                      onClick={() => {
                        signOut();
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-left"
                    >
                      <div className="p-1.5 bg-red-500/10 rounded-lg"><LogOut size={14} /></div>
                      退出登录
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Selection Box Overlay */}
      {selectionBox && selectionBox.active && (
        <div
          className="fixed z-[9999] border border-indigo-500 bg-indigo-500/10 pointer-events-none rounded-lg"
          style={{
            left: Math.min(selectionBox.start.x, selectionBox.current.x),
            top: Math.min(selectionBox.start.y, selectionBox.current.y),
            width: Math.abs(selectionBox.current.x - selectionBox.start.x),
            height: Math.abs(selectionBox.current.y - selectionBox.start.y),
          }}
        />
      )}
      {/* Selection Menu Overlay */}
      {selectionMenuPosition && selectedNodeIds.length > 0 && (() => {
        // Compute detailed selection stats: prompt groups, images, and videos
        const selectedPrompts = activeCanvas?.promptNodes.filter(n => selectedNodeIds.includes(n.id)) || [];
        const selectedImages = activeCanvas?.imageNodes.filter(n => selectedNodeIds.includes(n.id)) || [];

        const groupCount = selectedPrompts.length; // Prompt cards count as groups
        const videoCount = selectedImages.filter(img =>
          img.mode === GenerationMode.VIDEO ||
          img.url?.includes('.mp4') ||
          img.url?.startsWith('data:video')
        ).length;
        const imageCount = selectedImages.length - videoCount; // 图片 = 鍓崱鎬绘暟 - 视频鏁?

        return (
          <SelectionMenu
            position={selectionMenuPosition}
            selectedCount={selectedNodeIds.length}
            groupCount={groupCount}
            imageCount={imageCount}
            videoCount={videoCount}
            onDelete={() => {
              if (activeCanvas) {
                const prompts = activeCanvas.promptNodes.filter(n => selectedNodeIds.includes(n.id));
                const images = activeCanvas.imageNodes.filter(n => selectedNodeIds.includes(n.id));
                const workflowNodes = (activeCanvas.workflow?.nodes || []).filter(
                  (node): node is WorkflowUtilityCanvasNode => (
                    selectedNodeIds.includes(node.id) && isWorkflowUtilityNodeKind(node.kind)
                  )
                );
                prompts.forEach(n => deletePromptNode(n.id));
                images.forEach(n => deleteImageNode(n.id));
                workflowNodes.forEach(n => deleteWorkflowNode(n.id));
                clearSelection();
              }
              setSelectionMenuPosition(null);
            }}
            onGroup={() => {
              if (!activeCanvas) return;
              // Calculate bounds
              const prompts = activeCanvas.promptNodes.filter(n => selectedNodeIds.includes(n.id));

              // [FIX] Include child images of selected prompts for adaptive bounding
              const childImageIds = prompts.flatMap((promptNode) => actualChildImageIdsByPromptId.get(promptNode.id) || []);
              const images = activeCanvas.imageNodes.filter(n => selectedNodeIds.includes(n.id) || childImageIds.includes(n.id));

              // 🎯 Merge Logic: Find existing groups that contain any of the selected nodes
              const selectedNodeSet = new Set([...prompts.map(n => n.id), ...images.map(n => n.id)]);
              const existingGroupsInSelection = activeCanvas.groups.filter(g =>
                g.nodeIds.some(nid => selectedNodeSet.has(nid))
              );

              // Collect all node IDs from existing groups to ensure they're merged
              const allMergedNodeIds = new Set<string>();
              existingGroupsInSelection.forEach(g => g.nodeIds.forEach(nid => allMergedNodeIds.add(nid)));
              selectedNodeSet.forEach(nid => allMergedNodeIds.add(nid));

              // 🎯 Label Merge Logic
              let mergedLabel: string | undefined;
              const existingLabels = existingGroupsInSelection
                .map(g => g.label?.trim())
                .filter((l): l is string => !!l && l !== 'Group');

              // Remove duplicates
              const uniqueLabels = [...new Set(existingLabels)];

              if (uniqueLabels.length === 0) {
                mergedLabel = undefined; // Use default 'Group'
              } else if (uniqueLabels.length === 1) {
                mergedLabel = uniqueLabels[0];
              } else {
                // Combine names: "Name1 + Name2"
                mergedLabel = uniqueLabels.join(' + ');
              }

              // 🎯 Remove old groups that are being merged
              existingGroupsInSelection.forEach(g => removeGroup(g.id));

              // Calculate combined bounds (using all merged nodes)
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

              // Find all prompts and images by ID
              const allPrompts = activeCanvas.promptNodes.filter(n => allMergedNodeIds.has(n.id));
              const allImages = activeCanvas.imageNodes.filter(n => allMergedNodeIds.has(n.id));

              allPrompts.forEach(n => {
                const w = 380; // Assuming prompt width
                const h = n.height || 200;
                minX = Math.min(minX, n.position.x - w / 2);
                maxX = Math.max(maxX, n.position.x + w / 2);
                minY = Math.min(minY, n.position.y - h); // Anchor bottom
                maxY = Math.max(maxY, n.position.y);
              });

              allImages.forEach(n => {
                const { width, totalHeight } = getCardDimensions(n.aspectRatio, true);
                minX = Math.min(minX, n.position.x - width / 2);
                maxX = Math.max(maxX, n.position.x + width / 2);
                minY = Math.min(minY, n.position.y - totalHeight);
                maxY = Math.max(maxY, n.position.y);
              });

              if (minX === Infinity) {
                setSelectionMenuPosition(null);
                return;
              }

              const padding = 40; // 🎯 Uniform 40px all sides
              const topExtra = 40;
              const bottomExtra = 40;
              const group: CanvasGroup = {
                id: Date.now().toString(),
                nodeIds: [...allMergedNodeIds],
                bounds: {
                  x: minX - padding,
                  y: minY - (padding + topExtra),
                  width: (maxX - minX) + padding * 2,
                  height: (maxY - minY) + padding + topExtra + bottomExtra
                },
                label: mergedLabel,
                type: 'custom'
              };
              addGroup(group);
              clearSelection();
              setSelectionMenuPosition(null);
            }}
            onTag={handleTag}
            onMigrate={() => {
              setSelectionMenuPosition(null);
              setShowMigrateModal(true);
            }}
            onArrange={(mode) => {
              arrangeAllNodes(mode);
              setSelectionMenuPosition(null);
            }}
          />
        );
      })()}



      {/* 🚀 [Mobile] 手机端聊天流式界面 - 替代无限画布 */}
      {isMobile && (
        <MobileChatFeed
          promptNodes={activeCanvas?.promptNodes || []}
          imageNodes={activeCanvas?.imageNodes || []}
          onPromptPositionChange={updatePromptNodePosition}
          onPromptSelect={(nodeId) => selectNodes([nodeId], 'replace')}
          onPromptClick={handlePromptClick}
          onPromptCancel={handleCancelGeneration}
          onPromptRetry={handleRetryNode}
          onPromptDelete={deletePromptNode}
          onPromptDisconnect={handleDisconnectPrompt}
          onPromptUpdate={updatePromptNode}
          onPromptHeightChange={(id, height) => {
            const node = activeCanvas?.promptNodes.find(n => n.id === id);
            if (node && node.height !== height) updatePromptNode({ ...node, height });
          }}
          onPromptPin={handlePinDraft}
          onPromptRemoveTag={(id, tag) => {
            const node = activeCanvas?.promptNodes.find(n => n.id === id);
            if (node && node.tags) updatePromptNode({ ...node, tags: node.tags.filter(t => t !== tag) });
          }}
          onPromptEditPptDeck={handleOpenPptDeckEditor}
          onPromptExportPpt={handleExportPptPackageEditable}
          onPromptExportPptx={handleExportPptxEditable}
          onPromptRetryPptPage={handleRetryPptSinglePage}
          onPromptExportPptPage={handleExportPptSinglePage}
          onOpenStorageSettings={() => { setShowSettingsPanel(true); setSettingsInitialView('storage-settings'); }}
          selectedNodeIds={selectedNodeIds}
          actualChildImagesByPromptId={actualChildImagesByPromptId}
          getNodeIoTrace={getNodeIoTrace}
          onImagePositionChange={updateImageNodePosition}
          onImageDelete={deleteImageNode}
          onImageClick={handleImageClick}
          onImageSelect={(id) => selectNodes([id], 'replace')}
          onImageUpdate={updateImageNode}
          onImageDimensionsUpdate={updateImageNodeDisplayMeta}
          onImagePreview={handleOpenPreview}
          activeSourceImage={activeSourceImage}
          highlightedId={highlightedId}
          nowTimestamp={nowTimestamp || Date.now()}
        />
      )}

      {/* Main Infinite Canvas - 仅在非手机端显示 */}
      {!isMobile && (
      <InfiniteCanvas
        id="canvas-container"
        ref={canvasRef}
        showGrid={showGrid}
        onTransformChange={handleCanvasTransformChange}
        onInteractionChange={handleCanvasInteractionChange}
        cardPositions={[
          ...(activeCanvas?.promptNodes.map(n => n.position) || []),
          ...(activeCanvas?.imageNodes.map(n => n.position) || [])
        ]}
        onCanvasClick={() => {
          // [Draft Logic] Detach from draft when clicking background
          // if (draftNodeId) setDraftNodeId(null); // 🎯 [FIX] Prevent detaching draft on background click to avoid "Lonely Main Card" orphans

          // Clear input when clicking empty canvas, but NOT during generation
          // and NOT when in "continue from image" mode
          // Clear input when clicking empty canvas? NO, user reported this is annoying.
          // Keep the prompt draft even if deselected.
          /*
          if (!isGenerating && !activeSourceImage) {
            setConfig(prev => ({ ...prev, prompt: '' }));
          }
          */
          // Always clear selection on empty click
          clearSelection();
          setFocusedGroupId(null);
          setSelectionMenuPosition(null);
        }}
        onCanvasDoubleClick={() => {
          // [NEW] Double click to clear EVERYTHING (Prompt + Images)
          if (!isGenerating) {
            setConfig(prev => ({ ...prev, prompt: '', referenceImages: [] }));
            setActiveSourceImage(null);
            // Also clear selection
            clearSelection();
            setFocusedGroupId(null);
            setSelectionMenuPosition(null);
            // 🎯 [Fix] Explicitly remove draft node so preview disappears
            if (draftNodeId) {
              deletePromptNode(draftNodeId);
              setDraftNodeId(null);
            }
          }
        }}
        onAutoArrange={handleAutoArrange}
        onResetView={() => {
          // Focus the most recently generated card
          const latestImage = activeCanvas?.imageNodes[activeCanvas.imageNodes.length - 1];
          const latestPrompt = activeCanvas?.promptNodes[activeCanvas.promptNodes.length - 1];

          // Prefer the latest image; if none exists, fall back to the latest prompt
          const targetNode = latestImage || latestPrompt;

          if (targetNode && canvasRef.current) {
            // Use InfiniteCanvas.setView to center the target card
            const container = document.getElementById('canvas-container');
            if (container) {
              const rect = container.getBoundingClientRect();
              const centerX = rect.width / 2;
              const centerY = rect.height / 2;

              // 计算闇€瑕佺殑transform浣跨洰鏍囧崱鐗囧眳涓?
              const newX = centerX - targetNode.position.x * canvasTransform.scale;
              const newY = centerY - targetNode.position.y * canvasTransform.scale;

              canvasRef.current.setView(newX, newY, canvasTransform.scale);
            }
          }
        }}
        onImageDrop={handleImageDrop}
      >
        {/* 1. Connection Lines Layer (SVG) - Below all cards */}
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          shapeRendering="geometricPrecision"
          style={{
            width: '10000px',
            height: '10000px',
            left: '-5000px',
            top: '-5000px',
            overflow: 'visible',
            zIndex: CONNECTOR_LAYER_Z_INDEX,
          }}
        >
          {/* Active Drag Line */}
          {dragConnection?.active && (
            <path
              d={`M${dragConnection.startPos.x},${dragConnection.startPos.y} L${dragConnection.currentPos.x},${dragConnection.currentPos.y}`}
              fill="none"
              stroke="#6366f1"
              strokeWidth={activeDragStroke}
              strokeDasharray={`${activeDragDashA} ${activeDragDashB}`}
              className="opacity-80 animate-pulse"
            />
          )}

          {/* Prompt -> Image connections now render inside each prompt-group container. */}
          {false && connectorRenderPromptNodes.map(pn => {
            const childNodes = connectorChildImagesByPromptId.get(pn.id) || [];

            return childNodes.map((childNode) => {
              if (!childNode || !connectorVisibleImageNodeIds.has(childNode.id)) return null;

              // Flowith-style: Prompt Bottom 鈫?Image Top
              // Prompt Anchor: Bottom Center (pn.position)
              // Image Anchor: Bottom Center (childNode.position)

              // Start: Prompt Bottom Center
              const startX = pn.position.x + 5000;
              const startY = pn.position.y + 5000;

              // End: Image Top Center (Bottom - Height)
              const { width: cardWidth, totalHeight: theoreticalHeight } = getCardDimensions(childNode.aspectRatio, true);
              let imageHeight = theoreticalHeight;

              if (childNode.dimensions && typeof childNode.dimensions === 'string') {
                // 🎯 [Fix Bug] Extract purely the dimension part: "1:1 路 4096x4096" -> "4096x4096"
                // Then split by 'x' to avoid parsing the "1:1" as "1"
                const match = childNode.dimensions.match(/(\d+)\s*[xX]\s*(\d+)/);
                if (match && match[1] && match[2]) {
                  const w = parseInt(match[1], 10);
                  const h = parseInt(match[2], 10);
                  if (w > 0 && h > 0) {
                    const aspect = w / h;
                    const realParams = getCardDimensions(childNode.aspectRatio, false);
                    imageHeight = (realParams.width / aspect) + 40; // 40px for footer
                  }
                }
              }
              /* 🎯 涓诲崱鍜屽壇鍗′箣闂寸殑杩炵嚎淇濇寔鐧界伆鑹?*/

              if (isNaN(imageHeight) || imageHeight <= 0) {
                imageHeight = theoreticalHeight;
              }
              const endX = childNode.position.x + 5000;
              const endY = (childNode.position.y - imageHeight) + 5005;
              const d = buildSoftConnectorPath(startX, startY, endX, endY);

              return (
                <g key={`${pn.id}-${childNode.id}`}>
                  <circle cx={startX} cy={startY} r={connectorDotEnd} fill="var(--connector-color, #6366f1)" opacity="0.8" />
                  <path
                    d={d}
                    fill="none"
                    stroke="var(--connector-color, #6366f1)"
                    strokeWidth={connectorStroke}
                    strokeDasharray={connectorStrokeDasharray}
                    strokeLinecap={connectorStrokeLinecap}
                    opacity="0.6"
                    className={showConnectorButtons ? 'group-hover:opacity-100' : undefined}
                  />
                  {showConnectorHitAreas && (
                    <path d={d} stroke="transparent" strokeWidth={connectorHitStroke} fill="none" className="pointer-events-auto cursor-pointer" />
                  )}
                </g>
              );
            });
          })}

          {/* 2. Image -> Prompt/Pending Connections (Follow-up Flow) */}
          {/* A. Existing Prompts */}
          {connectorRenderPromptNodes.map(pn => {
            if (pn.isDraft) return null; // Draft/pending connection is rendered by pending-connection block below
            if (!pn.sourceImageId) return null;
            const sourceNode = imageNodesById.get(pn.sourceImageId);
            if (!sourceNode) return null;
            const sourcePosition = resolveLiveImagePosition(sourceNode) ?? sourceNode.position;
            const promptPosition = resolveLivePromptPosition(pn) ?? pn.position;

            // Source: Image Bottom Center (+5000 offset)
            const startX = sourcePosition.x + 5000;
            const startY = sourcePosition.y + 5000;

            // Target: Prompt Top Center (+5000 offset)
            // Use exact height if available, otherwise estimate
            const height = pn.height || getPromptHeight(pn.prompt);
            const endX = promptPosition.x + 5000;
            const endY = (promptPosition.y - height) + 5000;

            const d = buildSoftConnectorPath(startX, startY, endX, endY);

            const { x: btnX, y: btnY } = getSoftConnectorPointAt(startX, startY, endX, endY, 0.5);

            /* Follow-up connector colors mirror the active generation mode. */
            const baseColor = pn.mode === GenerationMode.INPAINT ? '#22c55e' : '#eab308';
            const hoverClass = pn.mode === GenerationMode.INPAINT ? 'group-hover:stroke-green-400' : 'group-hover:stroke-yellow-400';

            return (
              <g key={`followup-${pn.id}`} className={showConnectorButtons ? 'group' : undefined}>
                {/* Curve - Bottom Layer */}
                <path
                  d={d}
                  fill="none"
                  stroke={baseColor}
                  strokeWidth={connectorStroke}
                  strokeDasharray={connectorStrokeDasharray}
                  strokeLinecap={connectorStrokeLinecap}
                  opacity="0.5"
                  className={showConnectorButtons ? `transition-opacity duration-200 ${hoverClass} group-hover:opacity-100` : undefined}
                />

                {/* Transparent Hit Area */}
                {showConnectorHitAreas && (
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={connectorHitStroke}
                    className="pointer-events-auto cursor-pointer"
                  />
                )}

                {/* Start/End Dots - REMOVED per user request */}
                {/* <circle cx={startX} cy={startY} r="3" fill="#6366f1" opacity="0.6" /> */}
                {/* <circle cx={endX} cy={endY} r="2" fill="#6366f1" opacity="0.5" /> */}

                {/* Disconnect Button - Visible on Hover */}
                {showConnectorButtons && (
                  <foreignObject
                    x={btnX - 12}
                    y={btnY - 12}
                    width={24}
                    height={24}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{ pointerEvents: 'auto' }}
                  >
                  <div
                    className="w-6 h-6 rounded-full border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center cursor-pointer shadow-lg scale-90 hover:scale-110 active:scale-95 transition-all"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDisconnectPrompt(pn.id);
                    }}
                    title="断开连接"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </div>
                  </foreignObject>
                )}
              </g>
            );
          })}

          {/* B. Pending Node Connection */}
          {activeSourceImage && (() => {
            const hasDraftFollowup = !!activeCanvas?.promptNodes.some(p => p.isDraft && p.sourceImageId === activeSourceImage);
            if (hasDraftFollowup) return null;
            const sourceNode = imageNodesById.get(activeSourceImage);
            if (!sourceNode) return null;
            const sourcePosition = resolveLiveImagePosition(sourceNode) ?? sourceNode.position;

            // Position + 5000 Offset
            const startX = sourcePosition.x + 5000;
            const startY = sourcePosition.y + 5000;

            // Pending Node Position (Bottom Center)
            const endX = pendingPosition.x + 5000;
            const endY = (pendingPosition.y - 140) + 5000;

            const d = buildSoftConnectorPath(startX, startY, endX, endY);

            const { x: btnX, y: btnY } = getSoftConnectorPointAt(startX, startY, endX, endY, 0.5);

            /* Pending connection colors follow the active generation mode. */
            const baseColor = config.mode === GenerationMode.INPAINT ? '#22c55e' : '#eab308';
            const hoverClass = config.mode === GenerationMode.INPAINT ? 'group-hover:stroke-green-400' : 'group-hover:stroke-yellow-400';

            return (
              <g key="pending-connection" className={showConnectorButtons ? 'group' : undefined}>
                <path
                  d={d}
                  fill="none"
                  stroke={baseColor}
                  strokeWidth={connectorStroke}
                  strokeDasharray={connectorStrokeDasharray}
                  strokeLinecap={connectorStrokeLinecap}
                  opacity="0.5"
                  className={showConnectorButtons ? `transition-opacity duration-200 ${hoverClass} group-hover:opacity-100` : undefined}
                />
                {showConnectorHitAreas && (
                  <path d={d} stroke="transparent" strokeWidth={connectorHitStroke} fill="none" className="pointer-events-auto cursor-pointer" />
                )}
                <circle cx={startX} cy={startY} r={connectorDotStart} fill={baseColor} opacity="0.6" />
                <circle cx={endX} cy={endY} r={connectorDotEnd} fill={baseColor} opacity="0.5" />

                {showConnectorButtons && (
                  <foreignObject
                    x={btnX - 12}
                    y={btnY - 12}
                    width={24}
                    height={24}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{ pointerEvents: 'auto' }}
                  >
                  <div
                    className="w-6 h-6 rounded-full border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center cursor-pointer shadow-lg scale-90 hover:scale-110 active:scale-95 transition-all"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSourceImage(null);
                      setConfig(prev => ({ ...prev, referenceImages: [] }));
                    }}
                    title="断开连接"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </div>
                  </foreignObject>
                )}
              </g>
            );
          })()}

          {/* C. Workflow Utility Connections */}
          {(activeCanvas?.workflow?.edges || []).map((edge) => {
            const targetNode = visibleWorkflowUtilityNodesById.get(edge.to);
            if (!targetNode) return null;

            const sourcePrompt = promptNodesById.get(edge.from);
            const sourceImage = imageNodesById.get(edge.from);
            const sourceUtility = workflowUtilityNodesById.get(edge.from);
            if (!sourcePrompt && !sourceImage && !sourceUtility) return null;
            const sourcePromptPosition = resolveLivePromptPosition(sourcePrompt);
            const sourceImagePosition = resolveLiveImagePosition(sourceImage);

            const startX = (sourcePromptPosition?.x || sourceImagePosition?.x || sourceUtility?.position.x || 0) + 5000;
            const startY = (sourcePromptPosition?.y || sourceImagePosition?.y || sourceUtility?.position.y || 0) + 5000;
            const targetHeight = targetNode.height || 176;
            const endX = targetNode.position.x + 5000;
            const endY = (targetNode.position.y - targetHeight) + 5000;
            const d = buildSoftConnectorPath(startX, startY, endX, endY);
            const strokeColor = targetNode.kind === 'preview'
              ? '#38bdf8'
              : targetNode.kind === 'save'
                ? '#34d399'
                : '#f59e0b';

            return (
              <g key={`workflow-edge-${edge.id}`}>
                <circle cx={startX} cy={startY} r={connectorDotStart} fill={strokeColor} opacity="0.4" />
                <path
                  d={d}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={connectorStroke}
                  strokeDasharray={connectorStrokeDasharray}
                  strokeLinecap={connectorStrokeLinecap}
                  opacity="0.45"
                />
                <circle cx={endX} cy={endY} r={connectorDotEnd} fill={strokeColor} opacity="0.55" />
              </g>
            );
          })}

        </svg>




        {/* 2. Group layer (behind the cards) */}
        {false && visibleGroups.map(group => (
          <CanvasGroupComponent
            key={group.id}
            group={group}
            zoom={canvasTransform.scale}
            highlighted={highlightedId === group.id}
            onUngroup={removeGroup}
            onDragStart={(id, e) => {
              const nodeIds = group.nodeIds;
              const isMultiSelect = e.shiftKey || e.ctrlKey || e.metaKey;
              const alreadySelected = selectedNodeIds || [];

              // If dragging an already selected group (part of a multi-selection), ensure we don't wipe selection
              // Unless we are holding shift (toggling)
              const allNodesSelected = nodeIds.every(nid => alreadySelected.includes(nid));

              if (isMultiSelect) {
                selectNodes(nodeIds, 'replace');
                return;
              }

              if (alreadySelected.length > 0 && allNodesSelected) {
                return;
              }

              selectNodes(nodeIds, 'toggle');
            }}
            onGroupDrag={(delta, sourceNodeIds) => moveSelectedNodesImmediate(delta, sourceNodeIds)}
            onUpdateGroup={updateGroup}
            computedBounds={getComputedGroupBounds(group)}
          />
        ))}

        {/* 3. 持久化提示词节点 */}
        {renderedVisibleGroups}
        {renderedCanvasItems}
        {false && visiblePromptNodes.map(node => (
          <React.Fragment key={node.id}>
            <PromptNodeComponent
              node={node}
              detailLevel={canvasPerformanceProfile.cardDetailLevel}
              groupLayerZIndex={promptGroupLayerById.get(node.id) ?? node.zIndex ?? 0}
              stackZIndexOverride={promptGroupStackZIndexById.get(node.id)}
              actualChildImageCount={(actualChildImagesByPromptId.get(node.id) || []).length}
              onPositionChange={updatePromptNodePosition}
              isSelected={selectedNodeIds.includes(node.id)}
              highlighted={highlightedId === node.id}
              onBringToFront={() => bringNodesToFront([node.id])}
              onSelect={() => {
                selectNodes([node.id], (window.event as any)?.shiftKey ? 'toggle' : 'replace');
                // Right click opens the selection menu centered on the current node bounds.
                if ((window.event as any)?.button === 2) {
                  const pos = getSelectionScreenCenter([node.id]);
                  if (pos) setSelectionMenuPosition(pos);
                }
              }}
              onClickPrompt={handlePromptClick}
              onConnectStart={handleConnectStart}
              zoomScale={canvasTransform.scale}
              isCanvasTransforming={isCanvasTransforming}
              isMobile={isMobile}
              sourcePosition={node.sourceImageId
                ? activeCanvas?.imageNodes.find(n => n.id === node.sourceImageId)?.position
                : undefined
              }
              onCancel={handleCancelGeneration}
              onRetry={handleRetryNode}
              onEditPptDeck={handleOpenPptDeckEditor}
              onExportPpt={handleExportPptPackageEditable}
              onExportPptx={handleExportPptxEditable}
              onRetryPptPage={handleRetryPptSinglePage}
              onExportPptPage={handleExportPptSinglePage}
              ioTrace={getNodeIoTrace(node.id)}
              onOpenStorageSettings={() => {
                setShowSettingsPanel(true);
                setSettingsInitialView('storage-settings');
              }}
              onDelete={deletePromptNode}
              onDisconnect={handleDisconnectPrompt}
              onUpdateNode={updatePromptNode}
              onHeightChange={(id, height) => {
                const latestNode = activeCanvas?.promptNodes.find(n => n.id === id);
                const targetNode = latestNode || node;
                if (targetNode.height !== height) {
                  updatePromptNode({ ...targetNode, height });
                }
              }}
              onPin={handlePinDraft}
              onRemoveTag={(id, tag) => {
                const node = activeCanvas?.promptNodes.find(n => n.id === id);
                if (node && node.tags) {
                  const newTags = node.tags.filter(t => t !== tag);
                  updatePromptNode({ ...node, tags: newTags });
                }
              }}
              onDragDelta={(delta, sourceNodeId) => {
                if (!sourceNodeId) return;

                const mainCard = activeCanvas?.promptNodes.find(p => p.id === sourceNodeId);
                const childImageIds = mainCard?.childImageIds || [];
                const expandedSelectedIds = Array.from(new Set(
                  selectedNodeIds.flatMap((selectedId) => {
                    const selectedPrompt = activeCanvas?.promptNodes.find(p => p.id === selectedId);
                    if (!selectedPrompt) return [selectedId];

                    return [
                      selectedId,
                      ...(selectedPrompt.childImageIds || []).filter((id): id is string => !!id),
                    ];
                  })
                ));

                if (selectedNodeIds.includes(sourceNodeId) && expandedSelectedIds.length > 0) {
                  moveSelectedNodes(delta, expandedSelectedIds);
                } else if (childImageIds.length > 0) {
                  moveSelectedNodes(delta, [sourceNodeId, ...childImageIds.filter((id): id is string => !!id)]);
                } else {
                  moveSelectedNodes(delta, sourceNodeId);
                }
                // Force a re-render so connection lines stay in sync while dragging.
              }} // Enable safe relative drag.
              canvasTransform={canvasTransform} // Pass transform data for connection-line animation math.
            />

            {(visibleChildImagesByPromptId.get(node.id) || []).map(childNode => (
              <ImageNode
                key={childNode.id}
                image={childNode}
                detailLevel="full"
                groupLayerZIndex={promptGroupLayerById.get(node.id) ?? childNode.zIndex ?? 0}
                stackZIndexOverride={promptGroupStackZIndexById.get(node.id)}
                position={childNode.position}
                onPositionChange={updateImageNodePosition}
                highlighted={highlightedId === childNode.id}
                onDimensionsUpdate={updateImageNodeDisplayMeta}
                onUpdate={updateImageNode}
                onDelete={deleteImageNode}
                onConnectEnd={handleConnectEnd}
                onClick={handleImageClick}
                onBringToFront={() => bringNodesToFront([childNode.id])}
                isActive={childNode.id === activeSourceImage}
                isSelected={selectedNodeIds.includes(childNode.id)}
                onSelect={() => {
                  selectNodes([childNode.id], (window.event as any)?.shiftKey ? 'toggle' : 'replace');
                  if ((window.event as any)?.button === 2) {
                    const pos = getSelectionScreenCenter([childNode.id]);
                    if (pos) setSelectionMenuPosition(pos);
                  }
                }}
                zoomScale={canvasTransform.scale}
                isMobile={isMobile}
                onPreview={handleOpenPreview}
                onPreviewPptStack={handleOpenPptStackPreview}
                onDownloadPptComposite={handleDownloadPptComposite}
                isCanvasTransforming={isCanvasTransforming}
                isNew={(nowTimestamp || Date.now()) - (childNode.timestamp || 0) < 10000}
                canvasTransform={canvasTransform}
                onDragDelta={(delta, sourceNodeId) => {
                  if (!sourceNodeId) return;

                  const isSubCard = childNode.parentPromptId && activeCanvas?.promptNodes.some(p => p.id === childNode.parentPromptId);
                  const expandedSelectedIds = Array.from(new Set(
                    selectedNodeIds.flatMap((selectedId) => {
                      const selectedPrompt = activeCanvas?.promptNodes.find(p => p.id === selectedId);
                      if (!selectedPrompt) return [selectedId];

                      return [
                        selectedId,
                        ...(selectedPrompt.childImageIds || []).filter((id): id is string => !!id),
                      ];
                    })
                  ));

                  if (selectedNodeIds.includes(sourceNodeId) && expandedSelectedIds.length > 0) {
                    moveSelectedNodes(delta, expandedSelectedIds);
                  } else if (isSubCard) {
                    moveSelectedNodes(delta, sourceNodeId);
                  } else {
                    moveSelectedNodes(delta, sourceNodeId);
                  }
                }}
              />
            ))}
          </React.Fragment>
        ))}
        {false && standaloneVisibleImageNodes.map(node => (
          <ImageNode
            key={node.id}
            image={node}
            detailLevel={canvasPerformanceProfile.cardDetailLevel}
            groupLayerZIndex={node.parentPromptId
              ? (promptGroupLayerById.get(node.parentPromptId) ?? node.zIndex ?? 0)
              : (node.zIndex ?? 0)}
            stackZIndexOverride={node.parentPromptId
              ? promptGroupStackZIndexById.get(node.parentPromptId)
              : standaloneImageStackZIndexById.get(node.id)}
            position={node.position}
            onPositionChange={updateImageNodePosition}
            highlighted={highlightedId === node.id}
            onDimensionsUpdate={updateImageNodeDisplayMeta}
            onUpdate={updateImageNode} // 🎯
            onDelete={deleteImageNode}
            onConnectEnd={handleConnectEnd}
            onClick={handleImageClick}
            onBringToFront={() => bringNodesToFront([node.id])}
            isActive={node.id === activeSourceImage}
            isSelected={selectedNodeIds.includes(node.id)}
            onSelect={() => {
              selectNodes([node.id], (window.event as any)?.shiftKey ? 'toggle' : 'replace');
              // 🎯 Right Click triggers Selection Menu centered on node bounds
              if ((window.event as any)?.button === 2) {
                const pos = getSelectionScreenCenter([node.id]);
                if (pos) setSelectionMenuPosition(pos);
              }
            }}
            zoomScale={canvasTransform.scale}
            isMobile={isMobile}
            onPreview={handleOpenPreview}
            onPreviewPptStack={handleOpenPptStackPreview}
            onDownloadPptComposite={handleDownloadPptComposite}
            isCanvasTransforming={isCanvasTransforming}
            // 🎯 [Optimization] Identify if the node was created in the last 10 seconds
            isNew={(nowTimestamp || Date.now()) - (node.timestamp || 0) < 10000}
            canvasTransform={canvasTransform} // 🎯 Pass Transform for Animation Calculation
            onDragDelta={(delta, sourceNodeId) => {
              if (!sourceNodeId) return;

              const isSubCard = node.parentPromptId && activeCanvas?.promptNodes.some(p => p.id === node.parentPromptId);
              const expandedSelectedIds = Array.from(new Set(
                selectedNodeIds.flatMap((selectedId) => {
                  const selectedPrompt = activeCanvas?.promptNodes.find(p => p.id === selectedId);
                  if (!selectedPrompt) return [selectedId];

                  return [
                    selectedId,
                    ...(selectedPrompt.childImageIds || []).filter((id): id is string => !!id),
                  ];
                })
              ));

              if (selectedNodeIds.includes(sourceNodeId) && expandedSelectedIds.length > 0) {
                moveSelectedNodes(delta, expandedSelectedIds);
              } else if (isSubCard) {
                moveSelectedNodes(delta, sourceNodeId);
              } else {
                moveSelectedNodes(delta, sourceNodeId);
              }
              // 🎯 [Fix] Force re-render for real-time connection line updates
            }} // 🎯 Enable Safe Relative Drag
          />
        ))}

        {/* 4. Pending / Typing Node */}
        {/* 4. Pending / Typing Node - Removed (Now handled by Persistent Draft DraftNode) */}
        {/* <PendingNode ... /> removed */}
      </InfiniteCanvas>
      )}



      {/* Prompt Bar */}
      <div className="contents">
        <PromptBar
          config={config}
          setConfig={setConfig}
          isGenerating={isGenerating}
          onUiBusyChange={setPromptBarUiBusy}
          onGenerate={handleGenerate}
          onCancel={handleCancelGeneration}
          onFilesDrop={handleFilesDrop}
          activeSourceImage={activeSourceImage ?
            (activeCanvas?.imageNodes.find(n => n.id === activeSourceImage) ? {
              id: activeSourceImage,
              url: activeCanvas.imageNodes.find(n => n.id === activeSourceImage)!.url,
              prompt: activeCanvas.imageNodes.find(n => n.id === activeSourceImage)!.prompt
            } : null) : null
          }
          onClearSource={handleClearSource}
          isMobile={isMobile}
          onOpenSettings={(view) => {
            openSettingsSurface(view || 'api-management');
            handleHideMobileNav(); // Hide nav when opening settings (optional, but requested behavior implies consistent handling)
          }}
          onInteract={handleShowMobileNav}
          onFocus={() => {
            console.log('[PromptBar] onFocus - 设置isPromptFocused=true');
            setIsPromptFocused(true);
          }}
          onBlur={() => {
            console.log('[PromptBar] onBlur - 设置isPromptFocused=false');
            setIsPromptFocused(false);
            // When focus leaves the prompt, restart the 5-second auto-hide timer immediately
            setTimeout(() => handleShowMobileNav(), 0);
          }}
        />
      </div>

      <WorkspaceSurfacePanels
        activeSurface={activeAppSurface}
        activePanel={activeWorkspacePanel}
        isChatOpen={isChatOpen}
        toggleChatPanel={toggleChatPanel}
        setIsChatOpen={setIsChatOpen}
        isMobile={isMobile}
        openSettingsSurface={openSettingsSurface}
        setIsSidebarHovered={setIsSidebarHovered}
        setChatSidebarWidth={setChatSidebarWidth}
        workspaceSurface={workspaceSurface}
        activeCanvas={activeCanvas}
        focusWorkspace={focusWorkspace}
        handlePreviewFromLibrary={handlePreviewFromLibrary}
        handleFocusLibraryImage={handleFocusLibraryImage}
      />

      <GlobalModals>
      {/* Legacy KeyManagerModal removed - integrated into UserProfileModal */}

      {/* User Profile Modal (Unified) */}
      {/* Modals */}
      {isTagModalOpen && (
        <Suspense fallback={null}>
          <TagInputModal
            isOpen={isTagModalOpen}
            onClose={() => setIsTagModalOpen(false)}
            initialTags={initialTags}
            onSave={handleSaveTags}
            maxTags={tagLimits.maxTags}
            maxChars={tagLimits.maxChars}
            allTags={allTags}
            inheritedTags={inheritedTags}
            isSubCard={isSubCard}
          />
        </Suspense>
      )}
      {showProfileModal && (
        <Suspense fallback={null}>
          <UserProfileModal
            isOpen={showProfileModal}
            onClose={() => setShowProfileModal(false)}
            user={user}
            onSignOut={signOut}
            initialView={profileInitialView}
            isMobile={isMobile}
          />
        </Suspense>
      )}

      {/* Settings Panel (Dashboard, API Channels, Cost, Logs) */}
      {showSettingsPanel && (
        <Suspense fallback={null}>
          <SettingsPanel
            key={`${settingsPanelSessionKey}-${settingsInitialView}-${settingsInitialSupplier?.id || 'none'}`}
            isOpen={showSettingsPanel}
            onClose={() => {
              setShowSettingsPanel(false);
              setSettingsInitialSupplier(null);
            }}
            initialView={settingsInitialView}
            initialSupplier={settingsInitialSupplier}
          />
        </Suspense>
      )}

      {/* Storage Selection Modal (Post-Login) */}
      {showStorageModal && (
        <Suspense fallback={null}>
          <StorageSelectionModal
            isOpen={showStorageModal}
            onComplete={() => {
              setShowStorageModal(false);
              setIsStorageChecked(true);
              if (!keyManager.hasValidKeys()) {
                openSettingsSurface('api-management');
              }
            }}
          />
        </Suspense>
      )}







      {/* Project Manager (Replaces Canvas Manager) */}
      {!isMobile && (
        <ProjectManager
          onSearch={() => {
            focusWorkspace();
            setIsSearchOpen(true);
          }}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
          isMobile={isMobile}
          onFitToAll={handleFitToAll}
          onResetView={handleResetView}
          onToggleGrid={handleToggleGrid}
          showGrid={showGrid}
          onAutoArrange={handleAutoArrange}
          onToggleChat={toggleChatPanel}
          isChatOpen={isChatOpen}
          workflowTemplates={WORKFLOW_TEMPLATES}
          onApplyWorkflowTemplate={(templateId) => {
            void handleApplyWorkflowTemplate(templateId);
          }}
          onAddWorkflowUtilityCard={handleAddWorkflowUtilityCard}
        />
      )}



      {/* [NEW] Draft node overlay (fixed center) - disabled because users do not want a follow-up preview card */}
      {/* {draftNodeId && (() => {
        const draftNode = activeCanvas?.promptNodes.find(n => n.id === draftNodeId);
        // Show the overlay only while the node is still a draft; generating nodes should render on the canvas
        if (!draftNode || !draftNode.isDraft) return null;

        // Mock position 0,0 for component, handle centering via container
        const displayNode = { ...draftNode, position: { x: 0, y: 0 } };

        // 🎯 [Sidebar Responsive Layout]
        // Calculate center for the overlay (Accurate widths from components)
        const overlayOffsets = getViewportOffsets(isSidebarOpen, isChatOpen, isMobile, chatSidebarWidth);
        const overlayLeft = overlayOffsets.left;
        const overlayRight = overlayOffsets.right;

        return (
          <div
            className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center transition-all duration-300"
            style={{
              paddingLeft: overlayLeft,
              paddingRight: overlayRight,
              // Move layout center above prompt bar
              paddingBottom: 110
            }}
          >
           
            <div className="relative pointer-events-auto transform translate-y-[50%]">
              <PromptNodeComponent
                node={displayNode}
                onPositionChange={() => { }} 
                isSelected={true}
                onSelect={() => { }}
                zoomScale={1} 
                isMobile={isMobile}
                onCancel={handleCancelGeneration}
               
                onConnectStart={() => { }}
                onPin={handlePinDraft} 
              />
            </div>
          </div>
        );
      })()} */}



      {/* Global lightbox and search panel (search sits near the bottom, the lightbox stays on top) */}
      {previewImages && (
        <Suspense fallback={null}>
          <GlobalLightbox
            images={previewImages}
            initialIndex={previewInitialIndex}
            onClose={() => setPreviewImages(null)}
            onEditPptDeck={handleOpenPptDeckEditorFromImage}
            onEditText={handleEditPptTextFromLightbox}
            onDownloadPptComposite={handleDownloadPptComposite}
            onInpaint={(image, maskBase64, prompt) => {
              const userPrompt = (prompt || '局部重绘').trim();
              // Keep this prompt light: it will be sent through the optimizer, so we do not need heavy hard-coded instructions here
              // Just state the core intent: masked edits should stay inside the mask, while full-image references should guide a remix
              const finalPrompt = maskBase64
                ? `${userPrompt} (change masked area only)`
                : `${userPrompt} (remix based on image)`;

              const sourceImage = activeCanvas?.imageNodes.find(img => img.id === image.id) || image;
              const parentPromptId = sourceImage.parentPromptId;
              const parentPrompt = activeCanvas?.promptNodes.find(p => p.id === parentPromptId);

              let nodePos = { x: sourceImage.position.x, y: sourceImage.position.y + 80 };
              if (parentPrompt && activeCanvas) {
                const siblingImages = activeCanvas.imageNodes.filter(img => img.parentPromptId === parentPromptId);
                const maxY = siblingImages.reduce((acc, img) => Math.max(acc, img.position.y), parentPrompt.position.y);
                nodePos = { x: sourceImage.position.x, y: maxY + 80 };
              }

              const promptNodeId = `${Date.now()}_inpaint_prompt`;

              const inpaintNode: PromptNode = {
                id: promptNodeId,
                prompt: finalPrompt,
                originalPrompt: finalPrompt,
                position: nodePos,
                aspectRatio: sourceImage.aspectRatio || config.aspectRatio,
                imageSize: sourceImage.imageSize || config.imageSize,
                model: normalizeModelId(sourceImage.model || config.model),
                modelLabel: resolveModelDisplayName(
                  sourceImage.model || config.model,
                  sourceImage.modelLabel || getModelMetadata(sourceImage.model || config.model)?.name,
                ) || undefined,
                provider: sourceImage.provider || undefined,
                providerLabel: sourceImage.providerLabel || undefined,
                childImageIds: [],
                referenceImages: [{
                  id: sourceImage.id,
                  storageId: sourceImage.storageId || sourceImage.id,
                  data: sourceImage.originalUrl || sourceImage.url,
                  mimeType: 'image/png'
                }],
                timestamp: Date.now(),
                sourceImageId: sourceImage.id,
                isGenerating: true,
                maskUrl: maskBase64,
                mode: GenerationMode.INPAINT,
                tags: []
              };

              addPromptNode(inpaintNode);
              executeGeneration(inpaintNode);
              setPreviewImages(null);
            }}
          />
        </Suspense>
      )}

      {pptStackPreview && (
        <PptStackPreviewModal
          images={pptStackPreview.images}
          initialIndex={pptStackPreview.initialIndex}
          onClose={() => setPptStackPreview(null)}
        />
      )}

      {pptDeckEditor && (() => {
        const bundle = getOrderedPptNodeBundle(pptDeckEditor.nodeId);
        if (!bundle) return null;

        return (
          <Suspense fallback={null}>
            <PptDeckEditorModal
              promptNode={bundle.promptNode}
              images={bundle.images}
              initialIndex={pptDeckEditor.initialIndex}
              onClose={() => setPptDeckEditor(null)}
              onSave={(pages) => handleSavePptEditablePages(bundle.promptNode.id, pages)}
            />
          </Suspense>
        );
      })()}

      {isSearchOpen && (
        <Suspense fallback={null}>
          <SearchPalette
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            promptNodes={activeCanvas?.promptNodes || []}
            groups={activeCanvas?.groups || []}
            onNavigate={handleNavigateToNode}
            onMultiSelectConfirm={handleMultiSelectConfirm}
          />
        </Suspense>
      )}

      {/* Navigation and Overlays Removed for Mobile Bottom Dock Consistency */}
      {showTutorial && (
        <Suspense fallback={null}>
          <TutorialOverlay
            onComplete={() => {
              setShowTutorial(false);
              localStorage.setItem('kk_tutorial_seen', 'true');
            }}
          />
        </Suspense>
      )}


      {/* AI chat button - fixed in the bottom-right corner */}
      {/* AI chat button - fixed in the bottom-right corner */}
      {false && <div className="absolute bottom-6 z-50 transition-all duration-300 hidden md:block" style={{ right: isChatOpen ? `calc(min(100vw - 60px, ${chatSidebarWidth + 28}px))` : '48px' }}>
        <button
          id="chat-trigger-button"
          className="ai-chat-btn flex items-center justify-center cursor-pointer focus-visible:outline-none text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-blue-400/80 hover:shadow-[0_0_35px] bg-transparent overflow-hidden relative rounded-full aspect-square h-10 hover:scale-110 transition-all duration-300 p-2"
          type="button"
          onClick={() => setIsChatOpen(prev => !prev)}
        >
          <div className="uiverse w-full h-full absolute top-0 left-0 z-[-1] visible">
            <div className="circle circle-12"></div>
            <div className="circle circle-11"></div>
            <div className="circle circle-10"></div>
            <div className="circle circle-9"></div>
            <div className="circle circle-8"></div>
            <div className="circle circle-7"></div>
            <div className="circle circle-6"></div>
            <div className="circle circle-5"></div>
            <div className="circle circle-4"></div>
            <div className="circle circle-3"></div>
            <div className="circle circle-2"></div>
            <div className="circle circle-1"></div>
          </div>

          {/* Soft blue overlay */}
          <div className="absolute inset-0 rounded-full bg-blue-500/15 z-[1]"></div>

          {/* Spark icon - rotate slowly on hover */}
          <svg
            className="ai-chat-icon relative z-10"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="rgba(255, 255, 255, 0.95)"
            xmlns="http://www.w3.org/2000/svg"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))' }}
          >
            <path d="M11.6061 4.23218C11.6838 3.79153 12.3162 3.79153 12.3939 4.23218L12.5268 4.98521C13.1111 8.29642 15.7036 10.8889 19.0148 11.4732L19.7678 11.6061C20.2085 11.6838 20.2085 12.3162 19.7678 12.3939L19.0148 12.5268C15.7036 13.1111 13.1111 15.7036 12.5268 19.0148L12.3939 19.7678C12.3162 20.2085 11.6838 20.2085 11.6061 19.7678L11.4732 19.0148C10.8889 15.7036 8.29642 13.1111 4.98521 12.5268L4.23218 12.3939C3.79153 12.3162 3.79153 11.6838 4.23218 11.6061L4.98521 11.4732C8.29642 10.8889 10.8889 8.29642 11.4732 4.98521L11.6061 4.23218Z" fill="rgba(255, 255, 255, 0.95)"></path>
          </svg>
          <style>{`
            .ai-chat-icon {
              transition: transform 0.7s ease-out;
            }
            .ai-chat-btn:hover .ai-chat-icon {
              transform: rotate(90deg);
            }
            .ai-chat-btn:hover .uiverse .circle {
              animation-duration: calc(var(--duration) / 3) !important;
            }
          `}</style>
        </button>
      </div>}

      {/* 🎯 迁移弹窗 */}
      {showMigrateModal && (
        <Suspense fallback={null}>
          <MigrateModal
            isOpen={showMigrateModal}
            onClose={() => setShowMigrateModal(false)}
            canvases={state.canvases}
            currentCanvasId={state.activeCanvasId}
            selectedCount={selectedNodeIds.length}
            onMigrate={(targetCanvasId) => {
          // Handle the "create a new project and migrate" path
          if (targetCanvasId === '__new__') {
            // Create the new project and receive the new canvas ID
            const newCanvasId = createCanvas();
            if (newCanvasId) {
              // Use the returned canvas ID directly for migration instead of waiting for state updates
              // Keep the current project ID so we can migrate from it
              const originalCanvasId = state.activeCanvasId;

              // Switch back to the original project before running the migration
              switchCanvas(originalCanvasId);

              // Wait briefly for the canvas switch to settle, then migrate
              setTimeout(() => {
                migrateNodes(selectedNodeIds, newCanvasId);
                switchCanvas(newCanvasId);

                import('./services/system/notificationService').then(({ notify }) => {
                  notify.success('迁移成功', `已创建新项目并迁移 ${selectedNodeIds.length} 个项目`);
                });
              }, 50);
            }
          } else {
            // Migrate into an existing project
            migrateNodes(selectedNodeIds, targetCanvasId);
          }
          setShowMigrateModal(false);
          clearSelection();
            }}
          />
        </Suspense>
      )}

      {/* Global recharge modal */}
      {showRechargeModal && (
        <Suspense fallback={null}>
          <RechargeModal />
        </Suspense>
      )}
      </GlobalModals>
    </WorkspaceShell>
  );
};

const App: React.FC = () => {
  const { user, loading } = useAuth();

  const [showCostEstimation, setShowCostEstimation] = useState(false);

  useEffect(() => {
    if (!user) {
      keyManager.setStartupStage('signed_out');
      adminModelService.setStartupStage('signed_out');
    }
  }, [user]);

  // Initialize update check on mount (must be before any conditional returns per React Rules of Hooks)
  useEffect(() => {
    // Dynamic Import for Update Check
    import('./services/system/updateCheck').then(({ initUpdateCheck }) => {
      initUpdateCheck();
    });
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  // OAuth 回调页面（无需登录状态）
  if (window.location.pathname === '/auth/callback') {
    return (
      <ThemeProvider>
        <AuthCallback />
      </ThemeProvider>
    );
  }

  if (!user) {
    return (
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AppStartupProvider>
        <BillingProvider>
          <CanvasProvider>
            <AuthenticatedAppShell
              showCostEstimation={showCostEstimation}
              onExitCostEstimation={() => setShowCostEstimation(false)}
              AppContentComponent={AppContent}
            />
          </CanvasProvider>
        </BillingProvider>
      </AppStartupProvider>
    </ThemeProvider>
  );
};

export default App;
// Force Rebuild




