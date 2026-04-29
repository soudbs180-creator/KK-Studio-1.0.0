import React, { useState, useCallback, useRef, useEffect, useLayoutEffect, startTransition } from 'react';
import InfiniteCanvas, { InfiniteCanvasHandle } from './components/canvas/InfiniteCanvas';
import ImageNode from './components/image/ImageCard';
import PromptNodeComponent from './components/canvas/PromptNodeComponent';
import PendingNode from './components/canvas/PendingNode';
// KeyManagerModal removed - integrated into UserProfileModal
import ChatSidebar from './components/layout/ChatSidebar';
import { AspectRatio, ImageSize, GenerationConfig, PromptNode, GeneratedImage, GenerationMode, KnownModel, CanvasGroup, ReferenceImage, type PartialRedrawRequest, type AgentWorkflowNode, type PreviewWorkflowNode, type SaveWorkflowNode, type PptEditableImageLayer, type PptEditablePage, type MobileResultEntry, type MobileSurfaceScreen, type EcommerceAPlusControlMode, type EcommerceEditableTaskState, type EcommerceTaskAssetRoleBinding, type EcommerceGroupSheet, type EcommerceImageRef, type EcommerceSheetSetting, type EcommerceSheetSettingPatch, type EcommerceFrameworkRuntimeState, type EcommerceFrameworkQueueItem } from './types';
import { Image as ImageIcon, MessageSquare, Plus, Trash2, Shield, FileText, CheckCircle2, History, CreditCard, ChevronDown, Wand2, RefreshCw, Star, Coins, Settings } from 'lucide-react';
import { SelectionMenu } from './components/canvas/SelectionMenu';
import { CanvasGroupComponent } from './components/canvas/CanvasGroupComponent';
import { generateImage, cancelGeneration } from './services/llm/geminiService';
import { modelCaller } from './services/model/modelCaller';
import { getModelPricing, getModelCredits } from './services/model/modelPricing';
import { keyManager, getModelMetadata, normalizeModelId } from './services/auth/keyManager';
import { adminModelService } from './services/model/adminModelService';
import { unifiedModelService } from './services/model/unifiedModelService';
import { getModelCapabilities } from './services/model/modelCapabilities';
import { buildPartialRedrawReferenceImage } from './services/image/partialRedraw';
import { analyzeEcommerceRequirementFile } from './services/ecommerce/ecommerceAnalysisClient.ts';
import { resolveEcommercePromptNodeMetadata } from './services/ecommerce/ecommercePromptNodeMetadata.ts';
import { isEcommerceAllowedModel, normalizeEcommerceModelId, resolveEcommerceAspectPolicy, resolveEffectiveEcommerceAPlusPolicy, resolvePreferredEcommerceImageSize } from './services/ecommerce/ecommerceModelPolicy.ts';
import type { EcommerceAnalysisAsset, EcommerceAnalysisAPlusModule, EcommerceAnalysisMainImageItem, EcommerceAnalysisResult } from './services/ecommerce/types.ts';
import { buildEcommerceRenderTask } from './services/ecommerce/renderTaskBuilder.ts';
import { buildEcommerceCanvasGroupLayout } from './services/ecommerce/groupCanvasLayout.ts';
import { buildEcommerceGroupExportManifest } from './services/ecommerce/groupExportManifest.ts';
import { buildEcommerceAssetRoleBindings } from './services/ecommerce/assetRoleBindings.ts';
import {
  applyEcommerceSlotResult,
  buildEcommerceSlotPreviewBundle,
  buildInitialEcommerceGroupSlotState,
  type EcommerceGroupSlotState,
} from './services/ecommerce/groupSlotState.ts';
import { mergeEcommerceTaskState } from './services/ecommerce/taskMerger.ts';
import {
  cancelEcommerceFrameworkNodeQueue,
  createDefaultEcommerceFrameworkSchedulerConfig,
  createEcommerceFrameworkRuntimeState,
  enqueueEcommerceFrameworkItems,
  markEcommerceFrameworkQueueItemStatus,
  migrateLegacyEcommerceFrameworkCanvas,
  pauseEcommerceFrameworkRuntime,
  resolveEcommerceFrameworkDispatchPlan,
  resolveEcommerceFrameworkSummary,
  resolveFrameworkLane,
  resumeEcommerceFrameworkRuntime,
} from './services/ecommerce/frameworkRuntime.ts';
import { llmService } from './services/llm/LLMService';
import { cancelSecureSystemProxyTask } from './services/model/secureModelProxy';
import { appendUploadFilesWithinLimit } from './components/ecommerce/ecommerceImportPreview.ts';
import { getCardDimensions } from './utils/styleUtils';
import { buildGeneratedImageBatchPositions } from './utils/generatedImageLayout';
import { getViewportPreferredPosition } from './utils/canvasUtils';
import { getViewportOffsets } from './utils/canvasCenter';
import { clampGenerationDurationMs } from './utils/timeUtils';
import { resolveModelDisplayName } from './utils/modelDisplayName';
import { resolveProviderIdentity } from './utils/providerDisplay';
import { pickByDocumentLanguage } from './utils/localeText';
import { base64ToBlob, generateDownloadFilename, triggerDownload } from './utils/downloadUtils';
import {
  getReferenceImageLookupIds,
  normalizeReferenceImagesStorage,
  toReferenceImageDataUrl,
} from './utils/referenceImageStorage';
import {
  resolveLiveSceneNodePosition,
  type CanvasInteractionPhase,
} from './canvas/liveScene';
import AppPromptComposer from './app/AppPromptComposer';
import AppGlobalModals, { type AppGlobalModalsProps } from './app/AppGlobalModals';
import {
  type AgentRenderItem,
  type CanvasRenderItem,
  type ImageRenderItem,
  type PreviewRenderItem,
  type PromptGroupLayoutPresentationState,
  type PromptGroupRenderItem,
  type PromptGroupTier,
  type SaveRenderItem,
  type ScheduledImageLoadState,
  type WorkflowUtilityCanvasNode,
} from './app/appCanvasTypes';
import { buildSoftConnectorPath, getSoftConnectorPointAt } from './canvas/connectorGeometry';
import AppDesktopChrome from './app/AppDesktopChrome';
import AppCanvasOverlays from './app/AppCanvasOverlays';
import AppMobileWorkspace from './app/AppMobileWorkspace';
import { buildPptSlidesPreviewHtml } from './app/buildPptSlidesPreviewHtml';
import { buildPptxSlideRelationshipsXml, buildPptxSlideXml } from './app/buildPptxSlideDocuments';
import { buildCancelledPromptNodePatch } from './app/buildCancelledPromptNodePatch';
import { buildCompletedPromptNodePatch } from './app/buildCompletedPromptNodePatch';
import { buildGeneratingPromptNode } from './app/buildGeneratingPromptNode';
import { prepareRetriedExecutionNode } from './app/prepareRetriedExecutionNode';
import { buildRetryExecutionNode } from './app/buildRetryExecutionNode';
import { optimizeGenerationPrompt } from './app/optimizeGenerationPrompt';
import { persistGeneratingPromptNode } from './app/persistGeneratingPromptNode';
import { resolveGenerationBillingState } from './app/resolveGenerationBillingState';
import { resolveGenerationPreviewState } from './app/resolveGenerationPreviewState';
import { resolveFollowUpDraftPosition } from './app/followUpDraftPosition';
import { buildPromptGroupRenderLayout } from './app/promptGroupRenderLayout';
import { writePptxPackageSkeleton } from './app/writePptxPackageSkeleton';
import { useAppPromptBarProps } from './app/useAppPromptBarProps';
import { useCanvasDragConnection } from './app/useCanvasDragConnection';
import { useCanvasSelectionBox } from './app/useCanvasSelectionBox';
import { useCanvasNodeSelection } from './app/useCanvasNodeSelection';
import { useDraftNodeSync } from './app/useDraftNodeSync';
import { useGenerationPlacement } from './app/useGenerationPlacement';
import { useGenerationReferenceImages } from './app/useGenerationReferenceImages';
import { usePromptGroupDragHandlers } from './app/usePromptGroupDragHandlers';
import { useSelectionMenuOverlay } from './app/useSelectionMenuOverlay';
import { useWorkflowSourceResolvers } from './app/useWorkflowSourceResolvers';
import { useWorkflowActions } from './app/useWorkflowActions';
import { useConnectorRenderer } from './app/useConnectorRenderer';
import { usePromptGroupLayout } from './app/usePromptGroupLayout';
import { resolveProviderKeyType } from './services/api/providerStrategy.ts';
import { isCompactResponsiveSurface, resolveResponsiveSurface } from './utils/responsiveSurface';

const GENERATE_TRIGGER_COOLDOWN_MS = 500;
const GENERATE_SIGNATURE_DEDUP_MS = 4000;
const GENERATE_TIMEOUT_MS = 600000;

type EcommerceRuntimeState = {
  requirementFile: File | null;
  productFiles: File[];
  extraReferenceFiles: File[];
  itemReferenceFiles: Record<string, EcommerceManualReferenceBinding[]>;
  analysis: EcommerceAnalysisResult | null;
  analysisConfirmed: boolean;
  selectedItems: Record<string, boolean>;
  taskStates: Record<string, EcommerceEditableTaskState>;
  sheetSettings: Record<EcommerceGroupSheet, EcommerceSheetSetting>;
  groupSlots: Record<EcommerceGroupSheet, EcommerceGroupSlotState[]>;
  activeTaskNodeId: string | null;
  activeTaskState: EcommerceEditableTaskState | null;
  activeFrameworkId: string | null;
  activeGroupSheet: EcommerceGroupSheet | null;
  frameworkRuntime: Record<string, EcommerceFrameworkRuntimeState>;
  isAnalyzing: boolean;
  isConfirmingAnalysis: boolean;
};

type EcommerceManualReferenceBinding = {
  assetId: string;
  label: string;
  fileName: string;
  referenceImage: ReferenceImage;
  assetRole: EcommerceTaskAssetRoleBinding;
};

type EcommerceUploadReferenceBundle = {
  productReferences: ReferenceImage[];
  extraReferences: ReferenceImage[];
  productImageRef?: EcommerceImageRef;
};

type SharedPromptNodeActionProps = Pick<
  React.ComponentProps<typeof PromptNodeComponent>,
  | 'onCancel'
  | 'onRetry'
  | 'onEditPptDeck'
  | 'onExportPpt'
  | 'onExportPptx'
  | 'onRetryPptPage'
  | 'onExportPptPage'
  | 'onToggleEcommerceSelected'
  | 'onSetEcommerceGroupSelection'
  | 'onGenerateEcommerceNode'
  | 'onGenerateEcommerceGroup'
  | 'onGenerateEcommerceFramework'
  | 'onPauseEcommerceFramework'
  | 'onResumeEcommerceFramework'
  | 'onCancelEcommerceNodeQueue'
  | 'onConfirmEcommerceDesktop'
  | 'onRetryEcommerceModule'
  | 'onExportEcommerceGroup'
  | 'ecommerceFrameworkStatus'
  | 'activeEcommerceTaskState'
  | 'onActivateEcommerceTask'
  | 'onEcommerceTaskStateChange'
  | 'ecommerceSlotState'
  | 'onPreviewEcommerceSlotHistory'
  | 'ioTrace'
  | 'onOpenStorageSettings'
  | 'onDelete'
  | 'onDisconnect'
  | 'onUpdateNode'
>;

type SharedImageNodeProps = Pick<
  React.ComponentProps<typeof ImageNode>,
  | 'image'
  | 'onPositionChange'
  | 'onDimensionsUpdate'
  | 'onUpdate'
  | 'onDelete'
  | 'onConnectEnd'
  | 'onClick'
  | 'isActive'
  | 'zoomScale'
  | 'isMobile'
  | 'onPreview'
  | 'onPreviewPptStack'
  | 'onDownloadPptComposite'
  | 'isCanvasTransforming'
  | 'isNew'
  | 'canvasTransform'
>;

type ConnectorDisconnectButtonProps = {
  x: number;
  y: number;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
};


const MAX_ECOMMERCE_PRODUCT_FILES = 4;
const MAX_ECOMMERCE_EXTRA_REFERENCE_FILES = 4;
const MAX_ECOMMERCE_ITEM_REFERENCE_FILES = 6;

const ConnectorDisconnectButton: React.FC<ConnectorDisconnectButtonProps> = ({ x, y, onClick }) => (
  <foreignObject
    x={x - 12}
    y={y - 12}
    width={24}
    height={24}
    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
    style={{ pointerEvents: 'auto' }}
  >
    <div
      className="w-6 h-6 rounded-full border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center cursor-pointer shadow-lg scale-90 hover:scale-110 active:scale-95 transition-all"
      style={{ backgroundColor: 'var(--bg-secondary)' }}
      onClick={onClick}
      title="断开连接"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </div>
  </foreignObject>
);

const createEmptyEcommerceGroupSlots = (): Record<EcommerceGroupSheet, EcommerceGroupSlotState[]> => ({
  '主图': [],
  'A+': [],
});

const createEcommerceAnalysisResetPatch = (
  options: {
    isAnalyzing?: boolean;
    requirementFile?: File | null;
  } = {},
): Partial<EcommerceRuntimeState> => {
  const patch: Partial<EcommerceRuntimeState> = {
    itemReferenceFiles: {},
    analysis: null,
    analysisConfirmed: false,
    selectedItems: {},
    taskStates: {},
    groupSlots: createEmptyEcommerceGroupSlots(),
    activeTaskNodeId: null,
    activeTaskState: null,
    activeGroupSheet: null,
    isConfirmingAnalysis: false,
  };

  if ('requirementFile' in options) {
    patch.requirementFile = options.requirementFile ?? null;
  }

  if ('isAnalyzing' in options) {
    patch.isAnalyzing = options.isAnalyzing ?? false;
  }

  return patch;
};

const createDefaultEcommerceSheetSettings = (modelId: string): Record<EcommerceGroupSheet, EcommerceSheetSetting> => {
  const preferredImageSize = resolvePreferredEcommerceImageSize(normalizeEcommerceModelId(modelId) || modelId) as ImageSize;

  return {
    '主图': {
      aspectRatio: AspectRatio.AUTO,
      imageSize: preferredImageSize,
    },
    'A+': {
      aspectRatio: AspectRatio.LANDSCAPE_16_9,
      imageSize: ImageSize.SIZE_4K,
      aPlusControlMode: 'auto',
    },
  };
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
import { KKAI_FEATURE_FLAGS } from './app/kkaiFeatureFlags';
import { createAppRootMode } from './context/kkaiRuntimeContext';
import ConnectionDot from './components/canvas/ConnectionDot';
import type { UserProfileView } from './components/modals/UserProfileModal';
import { useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';
import { BillingProvider, useBilling } from './context/BillingContext';
import { formatRemainingCredits } from './services/billing/remainingBalance';
import {
  buildGenerationBillingAttempt,
  buildGenerationAttemptRequestId,
  resolveGenerationAttemptFailureState,
} from './services/billing/generationBillingCoordinator';
import {
  isCapabilityRouteAssignmentRouteDisabled,
  resolveEnabledCapabilityRouteAssignment,
} from './services/api/capabilityRouteAssignments';


import { saveAs } from 'file-saver';
import JSZip from 'jszip';
// import { syncService } from './services/system/syncService'; // [FIX] Dynamic Import
import { saveImage, saveOriginalImage, normalizePersistableMediaSource } from './services/storage/imageStorage';
import { cancelImageLoad, loadImage } from './services/image/imageLoader';
import { ImageQuality } from './services/image/imageQuality';
import { calculateImageHash } from './utils/imageUtils';
import { normalizePptSlidesForCount, buildAutoPptSlides } from './utils/pptUtils';
import {
  PPT_EDITABLE_CANVAS,
  buildPptEditablePages,
  getPromptPptImageNodes,
  getPptTextLayer,
  patchPptTextLayer,
  sortPptLayers,
  syncPptSlidesFromEditablePages,
} from './utils/pptEditable';
import { buildPptDeckModuleState } from './utils/pptDeckModules';
import { useImageGeneration } from './hooks/useImageGeneration';
import { useWorkspaceSurface, type SettingsSurfaceView } from './hooks/useWorkspaceSurface';
import { WorkspaceSurfacePanels } from './components/workspace/WorkspaceSurfacePanels';
// import { notify } from './services/system/notificationService'; // [FIX] Dynamic Import

// ProjectManager imported from components
import ProjectManager from './components/settings/ProjectManager';
import { Search } from 'lucide-react'; // Import Search icon
import GpuBackground from './components/layout/GpuBackground';
import type { Supplier } from './services/billing/supplierService';
import { resolveAvatarUrl } from './utils/presetAvatars';
import { cleanupImagesOlderThan, cleanupOriginalsOlderThan, getStrictOriginalImage } from './services/storage/imageStorage';
import { cleanupCompletedTasksOlderThan } from './services/persistence/taskPersistence';
import { traceLocalPerformance } from './services/system/localPerformanceTrace';
import { cleanupLogsOlderThan } from './services/system/systemLogService';
import { ensureMobileRetentionPreference, getMobileRetentionPreference, MOBILE_RETENTION_PREFERENCE_KEY } from './services/storage/mobileRetentionPreference';
import SettingsPageRoot from './app/SettingsPageRoot';
import { WorkspaceShell } from './components/workspace';
import {
  createWorkflowNodeRendererRegistry,
  renderWorkflowNode,
} from './workflow/renderers/nodeRendererRegistry';
import PreviewNodeCard from './workflow/nodes/PreviewNodeCard';
import SaveNodeCard from './workflow/nodes/SaveNodeCard';
import AgentNodeCard from './workflow/nodes/AgentNodeCard';
import {
  WORKFLOW_TEMPLATES,
} from './workflow/templates/workflowTemplates';
import { isWorkflowUtilityNodeKind } from './workflow/schema';
import {
  getCanvasPerformanceProfile,
  type CanvasCardDetailLevel,
} from './canvas/performanceProfile';

interface AppContentProps {
}

const AppContent: React.FC<AppContentProps> = () => {
  const billingUiEnabled = KKAI_FEATURE_FLAGS.billing;
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
  const [liveNodePositionVersion, setLiveNodePositionVersion] = useState(0);
  const [canvasInteractionPhase, setCanvasInteractionPhase] = useState<CanvasInteractionPhase>('idle');
  const [promptGroupLayoutVersion, setPromptGroupLayoutVersion] = useState(0);
  const [imageCardHeightById, setImageCardHeightById] = useState<Record<string, number>>({});
  const [lockedGroupBoundsById, setLockedGroupBoundsById] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const nodeDragReleaseFrameRef = useRef<number | null>(null);
  const promptGroupLayoutStateByIdRef = useRef<Record<string, PromptGroupLayoutPresentationState>>({});



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

  const imageNodesById = React.useMemo(
    () => new Map((activeCanvas?.imageNodes || []).map(node => [node.id, node])),
    [activeCanvas]
  );

  const promptNodesById = React.useMemo(
    () => new Map((activeCanvas?.promptNodes || []).map(node => [node.id, node])),
    [activeCanvas]
  );

  const draftPromptNode = React.useMemo(
    () => (draftNodeId ? promptNodesById.get(draftNodeId) ?? null : null),
    [draftNodeId, promptNodesById]
  );

  const workflowUtilityNodesById = React.useMemo(
    () => new Map(
      (activeCanvas?.workflow?.nodes || [])
        .filter((node): node is WorkflowUtilityCanvasNode => isWorkflowUtilityNodeKind(node.kind))
        .map((node) => [node.id, node])
    ),
    [activeCanvas]
  );

  const {
    balance,
    loading: billingLoading,
    showRechargeModal,
    setShowRechargeModal,
    applyAuthoritativeBalance,
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
  const ecommerceFrameworkRuntimeRef = useRef<Record<string, EcommerceFrameworkRuntimeState>>({});

  const selectedNodeIdsRef = useRef<string[]>(selectedNodeIds);
  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

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
    billingAttempt?: {
      attemptId: string;
      businessRefId: string;
      idempotencyKey: string;
    };
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
      attemptId: params.billingAttempt?.attemptId,
      businessRefId: params.billingAttempt?.businessRefId,
      idempotencyKey: params.billingAttempt?.idempotencyKey,
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
    const failureState = await resolveGenerationAttemptFailureState(node, {
      refundCreditsByTransaction,
      refreshBilling,
    });

    if (
      failureState.refundStatus === 'failed'
      && node.billingMode === 'credits'
      && node.creditSettlement === 'server'
      && (node.cost || 0) > 0
    ) {
      console.error('[resolveFailedCreditAttempt] Failed to refresh billing after server-side credit failure:', node.id);
    }

    return failureState;
  }, [refundCreditsByTransaction, refreshBilling]);

  const applyOptimisticServerCreditDebit = useCallback((requiredCredits: number, useServerSideCreditSettlement: boolean) => {
    if (useServerSideCreditSettlement && requiredCredits > 0) {
      adjustBalanceOptimistically(-requiredCredits);
    }
  }, [adjustBalanceOptimistically]);

  const showNoPptPagesWarning = useCallback(() => {
    import('./services/system/notificationService').then(({ notify }) => {
      notify.warning('无可导出页面', '当前主卡还没有生成副卡页面');
    });
  }, []);

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
        // 3. 兜底逻辑（单张图片）
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
  const [responsiveSurface, setResponsiveSurface] = useState(() => (
    typeof window !== 'undefined' ? resolveResponsiveSurface(window.innerWidth) : 'desktop'
  ));
  const isMobile = isCompactResponsiveSurface(responsiveSurface);
  const [mobileScreen, setMobileScreen] = useState<MobileSurfaceScreen>('home');
  const [mobileActiveResultId, setMobileActiveResultId] = useState<string | null>(null);

  /* Tutorial Logic - Delayed until Storage is Checked */
  const [isStorageChecked, setIsStorageChecked] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncMobileViewport = () => {
      setResponsiveSurface(resolveResponsiveSurface(window.innerWidth));
    };

    syncMobileViewport();
    window.addEventListener('resize', syncMobileViewport);
    return () => {
      window.removeEventListener('resize', syncMobileViewport);
    };
  }, []);

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

  const [settingsInitialView, setSettingsInitialView] = useState<SettingsSurfaceView>('dashboard');
  const [settingsInitialSupplier, setSettingsInitialSupplier] = useState<Supplier | null>(null);
  const [settingsPanelSessionKey, setSettingsPanelSessionKey] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [promptBarUiBusy, setPromptBarUiBusy] = useState(false);
  const openSettingsPanel = useCallback((
    view: SettingsSurfaceView = 'api-management',
    supplier: Supplier | null = null
  ) => {
    setSettingsPanelSessionKey((prev) => prev + 1);
    setSettingsInitialSupplier(supplier);
    setSettingsInitialView(view);
    setShowSettingsPanel(true);
  }, []);

  const handleMobileResultOpen = useCallback((entryId: string) => {
    setMobileActiveResultId(entryId);
    setMobileScreen('detail');
  }, []);

  const handleMobileResultDownload = useCallback(async (entry: MobileResultEntry) => {
    const exportType = 'Image';
    const filename = generateDownloadFilename(exportType, '.png');

    let target = await getStrictOriginalImage(entry.imageId);
    if (!target) {
      target = entry.displaySrc;
    }
    if (!target) {
      return;
    }

    if (target.startsWith('data:') || target.startsWith('blob:')) {
      triggerDownload(target, filename);
      return;
    }

    const response = await fetch(target);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const blob = await response.blob();
    triggerDownload(blob, filename);
  }, []);

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
  const allCanvasTags = React.useMemo(() => {
    const allPromptTags = activeCanvas?.promptNodes.flatMap((node) => node.tags || []) || [];
    const allImageTags = activeCanvas?.imageNodes.flatMap((node) => node.tags || []) || [];

    return [...new Set([...allPromptTags, ...allImageTags])];
  }, [activeCanvas]);

  const handleTag = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    setTaggingNodeIds(selectedNodeIds);

    const firstId = selectedNodeIds[0];
    const promptNode = promptNodesById.get(firstId);
    const imageNode = imageNodesById.get(firstId);

    // 🎯 Collect all existing tags from canvas for suggestions
    setAllTags(allCanvasTags);

    // Determine if editing Sub Card and find inherited tags
    if (imageNode) {
      // 🎯 Sub Card - find parent's tags
      const parentPrompt = imageNode.parentPromptId ? promptNodesById.get(imageNode.parentPromptId) : null;
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
  }, [allCanvasTags, imageNodesById, promptNodesById, selectedNodeIds]);

  const handleSaveTags = useCallback(async (tags: string[]) => {
    const firstId = taggingNodeIds[0];
    const promptNode = promptNodesById.get(firstId);

    // 🎯 Deduplication Logic: If Main Card adds a tag, remove from its Sub Cards
    if (promptNode) {
      // Editing a Main Card
      const childImageIds = promptNode.childImageIds || [];
      const newMainTags = tags;

      // For each child sub-card, remove any tag that now exists on the main card
      childImageIds.forEach(imgId => {
        const img = imageNodesById.get(imgId);
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
          const img = imageNodesById.get(nodeId);
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
  }, [imageNodesById, promptNodesById, setNodeTags, taggingNodeIds]);


  const startupAuthenticatedUserId = user && !isTempUser ? user.id : null;

  // Sync user with KeyManager and handle Modal Logic (Storage -> API)
  useEffect(() => {
    if (authLoading) return;
    let active = true;
    let backgroundReadyTimer: number | null = null;

    const init = async () => {
      advanceTo('session_ready');
      try {
        // 0. Initialize the local model surface first. Hosted catalog refreshes
        // stay deferred until the startup coordinator reaches background_ready.
        await unifiedModelService.initialize();
        if (!active) return;

        // 1. Sync User ID
        const authenticatedUserId = startupAuthenticatedUserId;

        if (authenticatedUserId) {
          import('./services/billing/costService').then(async ({ setUserId }) => {
            if (!active) return;
            await setUserId(authenticatedUserId);
          }).catch(err => console.error('[App] CostService sync failed:', err));

          // [New] Mark user as logged in on this browser (for future skips)
          localStorage.setItem('kk_has_logged_in', 'true');
        } else {
          import('./services/billing/costService').then(async ({ setUserId }) => {
            if (!active) return;
            await setUserId(null);
          }).catch(err => console.error('[App] CostService reset failed:', err));
        }

        advanceTo('profile_ready');

        // 2. Check for Returning User (Smart Skip)
        const hasLoggedInBefore = localStorage.getItem('kk_has_logged_in');
        const isDevMode = window.location.hostname === 'localhost'
          || window.location.hostname === '127.0.0.1'
          || window.location.hostname === '::1';

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
            openSettingsSurfaceTracked('api-management');
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
        } else if (hasLoggedInBefore) {
          // Returning User -> FORCE SKIP TUTORIAL
          // Even if 'kk_tutorial_seen' is missing (e.g. cleared cache but kept local storage key?)
          // We'll trust 'kk_has_logged_in'.
          localStorage.setItem('kk_tutorial_seen', 'true'); // Silently mark as seen
        }
      } catch (error) {
        console.error('[App] Startup bootstrap failed:', error);
      } finally {
        if (!active) return;

        advanceTo('workspace_ready');

        backgroundReadyTimer = window.setTimeout(() => {
          if (!active) {
            return;
          }
          advanceTo('background_ready');
        }, 0);
      }
    };

    init();

    return () => {
      active = false;
      if (backgroundReadyTimer !== null) {
        window.clearTimeout(backgroundReadyTimer);
      }
    };
  }, [advanceTo, authLoading, startupAuthenticatedUserId]);

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

  const [ecommerceState, setEcommerceState] = useState<EcommerceRuntimeState>({
    requirementFile: null,
    productFiles: [],
    extraReferenceFiles: [],
    itemReferenceFiles: {},
    analysis: null,
    analysisConfirmed: false,
    selectedItems: {},
    taskStates: {},
    sheetSettings: createDefaultEcommerceSheetSettings(config.model),
    groupSlots: createEmptyEcommerceGroupSlots(),
    activeTaskNodeId: null,
    activeTaskState: null,
    activeFrameworkId: null,
    activeGroupSheet: null,
    frameworkRuntime: {},
    isAnalyzing: false,
    isConfirmingAnalysis: false,
  });
  const [ecommerceRatioOverride, setEcommerceRatioOverride] = useState<AspectRatio[] | undefined>(undefined);

  useEffect(() => {
    ecommerceFrameworkRuntimeRef.current = ecommerceState.frameworkRuntime;
  }, [ecommerceState.frameworkRuntime]);

  useEffect(() => {
    const frameworkNodes = (activeCanvas?.promptNodes || []).filter((node) => (
      node.mode === GenerationMode.ECOMMERCE && node.ecommerce?.kind === 'framework'
    ));

    setEcommerceState((previousState) => {
      const nextFrameworkRuntime: Record<string, EcommerceFrameworkRuntimeState> = {};
      let didChange = false;

      frameworkNodes.forEach((frameworkNode) => {
        const existingRuntime = previousState.frameworkRuntime[frameworkNode.id];
        if (existingRuntime) {
          nextFrameworkRuntime[frameworkNode.id] = existingRuntime;
          return;
        }

        nextFrameworkRuntime[frameworkNode.id] = createEcommerceFrameworkRuntimeState({
          frameworkId: frameworkNode.id,
          activeSheet: frameworkNode.ecommerce?.frameworkMeta?.activeSheet || frameworkNode.ecommerce?.sourceSheet || '主图',
          config: frameworkNode.ecommerce?.frameworkMeta?.schedulerConfig,
        });
        didChange = true;
      });

      if (!didChange) {
        const previousIds = Object.keys(previousState.frameworkRuntime);
        if (previousIds.length !== Object.keys(nextFrameworkRuntime).length) {
          didChange = true;
        } else if (previousIds.some((frameworkId) => !nextFrameworkRuntime[frameworkId])) {
          didChange = true;
        }
      }

      const nextActiveFrameworkId = previousState.activeFrameworkId && nextFrameworkRuntime[previousState.activeFrameworkId]
        ? previousState.activeFrameworkId
        : (frameworkNodes[0]?.id || null);
      const nextActiveGroupSheet = previousState.activeTaskState?.sourceSheet
        || (nextActiveFrameworkId
          ? (previousState.activeGroupSheet || nextFrameworkRuntime[nextActiveFrameworkId]?.activeSheet || null)
          : null);

      if (
        !didChange
        && nextActiveFrameworkId === previousState.activeFrameworkId
        && nextActiveGroupSheet === previousState.activeGroupSheet
      ) {
        return previousState;
      }

      return {
        ...previousState,
        frameworkRuntime: nextFrameworkRuntime,
        activeFrameworkId: nextActiveFrameworkId,
        activeGroupSheet: nextActiveGroupSheet,
      };
    });
  }, [activeCanvas]);

  const resolveEcommerceFrameworkId = useCallback((node?: PromptNode | null): string | null => {
    if (!node?.ecommerce) {
      return null;
    }

    if (node.ecommerce.kind === 'framework') {
      return node.id;
    }

    return node.ecommerce.frameworkId || null;
  }, []);

  const resolveEcommerceFrameworkNode = useCallback((frameworkId?: string | null): PromptNode | null => {
    if (!frameworkId) {
      return null;
    }

    return activeCanvasRef.current?.promptNodes.find((node) => (
      node.id === frameworkId && node.ecommerce?.kind === 'framework'
    )) || null;
  }, []);

  const updateEcommerceFrameworkMeta = useCallback((
    frameworkId: string,
    patch: Partial<NonNullable<NonNullable<PromptNode['ecommerce']>['frameworkMeta']>>,
  ) => {
    const frameworkNode = activeCanvasRef.current?.promptNodes.find((node) => (
      node.id === frameworkId && node.ecommerce?.kind === 'framework'
    ));
    if (!frameworkNode?.ecommerce) {
      return;
    }

    updatePromptNode({
      ...frameworkNode,
      ecommerce: {
        ...frameworkNode.ecommerce,
        frameworkMeta: {
          activeSheet: frameworkNode.ecommerce.frameworkMeta?.activeSheet || frameworkNode.ecommerce.sourceSheet || '主图',
          groupIds: frameworkNode.ecommerce.frameworkMeta?.groupIds,
          taskNodeIds: frameworkNode.ecommerce.frameworkMeta?.taskNodeIds,
          schedulerConfig: frameworkNode.ecommerce.frameworkMeta?.schedulerConfig,
          ...patch,
        },
      },
    });
  }, [updatePromptNode]);

  const updateEcommerceFrameworkRuntime = useCallback((
    frameworkId: string,
    updater: (current: EcommerceFrameworkRuntimeState) => EcommerceFrameworkRuntimeState,
  ): EcommerceFrameworkRuntimeState => {
    const frameworkNode = resolveEcommerceFrameworkNode(frameworkId);
    const currentRuntime = ecommerceFrameworkRuntimeRef.current[frameworkId]
      || createEcommerceFrameworkRuntimeState({
        frameworkId,
        activeSheet: frameworkNode?.ecommerce?.frameworkMeta?.activeSheet || frameworkNode?.ecommerce?.sourceSheet || '主图',
        config: frameworkNode?.ecommerce?.frameworkMeta?.schedulerConfig,
      });
    const nextRuntime = updater(currentRuntime);

    ecommerceFrameworkRuntimeRef.current = {
      ...ecommerceFrameworkRuntimeRef.current,
      [frameworkId]: nextRuntime,
    };

    setEcommerceState((previousState) => ({
      ...previousState,
      frameworkRuntime: {
        ...previousState.frameworkRuntime,
        [frameworkId]: nextRuntime,
      },
    }));

    return nextRuntime;
  }, [resolveEcommerceFrameworkNode]);

  const syncEcommerceFrameworkView = useCallback((frameworkId: string, activeSheet: EcommerceGroupSheet) => {
    updateEcommerceFrameworkRuntime(frameworkId, (currentRuntime) => ({
      ...currentRuntime,
      activeSheet,
      lastUpdatedAt: Date.now(),
    }));
    updateEcommerceFrameworkMeta(frameworkId, { activeSheet });
  }, [updateEcommerceFrameworkMeta, updateEcommerceFrameworkRuntime]);

  const resolveEffectiveEcommerceThinkingMode = useCallback((): 'minimal' | 'high' => (
    config.mode === GenerationMode.ECOMMERCE ? 'high' : (config.thinkingMode || 'minimal')
  ), [config.mode, config.thinkingMode]);

  const resolveEcommerceAPlusControlMode = useCallback((sheetSetting?: EcommerceSheetSetting): EcommerceAPlusControlMode => (
    sheetSetting?.aPlusControlMode || 'auto'
  ), []);

  const applyEffectiveSizingToTaskState = useCallback((
    taskState: EcommerceEditableTaskState,
    options?: { controlMode?: EcommerceAPlusControlMode },
  ): EcommerceEditableTaskState => {
    if (taskState.sourceSheet !== 'A+' || taskState.sourceKind !== 'a-plus-module') {
      return {
        ...taskState,
        effectiveSizePolicy: taskState.effectiveSizePolicy,
        effectiveSizeTier: taskState.effectiveSizeTier || taskState.sizeTier,
      };
    }

    const activeSheetSetting = ecommerceState.sheetSettings['A+'] || createDefaultEcommerceSheetSettings(config.model)['A+'];
    const effectivePolicy = resolveEffectiveEcommerceAPlusPolicy({
      detectedSizeTier: taskState.sizeTier,
      controlMode: taskState.sizeControlOverride ?? options?.controlMode ?? resolveEcommerceAPlusControlMode(activeSheetSetting),
    });

    return {
      ...taskState,
      effectiveSizePolicy: effectivePolicy.effectiveSizePolicy,
      effectiveSizeTier: effectivePolicy.effectiveSizeTier,
    };
  }, [config.model, ecommerceState.sheetSettings, resolveEcommerceAPlusControlMode]);

  const resolveEcommerceNodeGenerationSettings = useCallback((
    node: PromptNode,
    generationTarget?: 'sheet' | 'desktop' | 'mobile',
  ) => {
    const fallbackSheetSettings = createDefaultEcommerceSheetSettings(node.model);
    const sheetSettings = node.ecommerce
      ? (ecommerceState.sheetSettings[node.ecommerce.sourceSheet] || fallbackSheetSettings[node.ecommerce.sourceSheet])
      : fallbackSheetSettings['主图'];

    if (!node.ecommerce) {
      return {
        aspectRatio: node.aspectRatio || sheetSettings.aspectRatio,
        imageSize: node.imageSize || sheetSettings.imageSize,
      };
    }

    if (generationTarget === 'mobile') {
      return {
        aspectRatio: (node.ecommerce.mobileAspectRatio || AspectRatio.LANDSCAPE_4_3) as AspectRatio,
        imageSize: sheetSettings.imageSize,
      };
    }

    const effectiveSizePolicy = node.ecommerce.effectiveSizePolicy || node.ecommerce.sizePolicy;

    if (node.ecommerce.kind === 'a-plus-module' && effectiveSizePolicy === 'desktop-then-mobile') {
      return {
        aspectRatio: (node.ecommerce.desktopAspectRatio || node.ecommerce.currentAspectRatio || node.aspectRatio || AspectRatio.LANDSCAPE_21_9) as AspectRatio,
        imageSize: sheetSettings.imageSize,
      };
    }

    return {
      aspectRatio: (
        node.ecommerce.kind === 'a-plus-module'
          ? (node.ecommerce.currentAspectRatio || node.aspectRatio || AspectRatio.LANDSCAPE_16_9)
          : (sheetSettings.aspectRatio || node.ecommerce.currentAspectRatio || node.aspectRatio || AspectRatio.SQUARE)
      ) as AspectRatio,
      imageSize: sheetSettings.imageSize || node.imageSize || (resolvePreferredEcommerceImageSize(node.model) as ImageSize),
    };
  }, [ecommerceState.sheetSettings]);

  const resolveEcommerceSlotState = useCallback((node: PromptNode) => {
    if (!node.ecommerce || node.ecommerce.kind === 'a-plus-group') {
      return null;
    }

    return ecommerceState.groupSlots[node.ecommerce.sourceSheet].find(
      (slot) => slot.sourceKey === node.ecommerce?.sourceRowKey,
    ) ?? null;
  }, [ecommerceState.groupSlots]);

  const handlePreviewEcommerceSlotHistory = useCallback((
    sourceSheet: EcommerceGroupSheet,
    sourceKey: string,
    preferredImageId?: string,
  ) => {
    const canvas = activeCanvasRef.current;
    if (!canvas) {
      return;
    }

    const slotState = ecommerceState.groupSlots[sourceSheet].find((slot) => slot.sourceKey === sourceKey);
    if (!slotState) {
      return;
    }

    const imagesById = new Map(canvas.imageNodes.map((imageNode) => [imageNode.id, imageNode] as const));
    const previewBundle = buildEcommerceSlotPreviewBundle(slotState, imagesById, preferredImageId);
    if (!previewBundle) {
      return;
    }

    setWorkspaceSurface('workspace');
    setPreviewImages(previewBundle.images);
    setPreviewInitialIndex(previewBundle.initialIndex);
  }, [ecommerceState.groupSlots]);

  const handlePreviewEcommerceSlotHistoryForNode = useCallback((node: PromptNode, preferredImageId?: string) => {
    if (!node.ecommerce || node.ecommerce.kind === 'a-plus-group') {
      return;
    }

    handlePreviewEcommerceSlotHistory(node.ecommerce.sourceSheet, node.ecommerce.sourceRowKey, preferredImageId);
  }, [handlePreviewEcommerceSlotHistory]);

  useEffect(() => {
    if (config.mode !== GenerationMode.ECOMMERCE) {
      setEcommerceRatioOverride(undefined);
      setEcommerceState((previousState) => ({
        ...previousState,
        activeTaskNodeId: null,
        activeTaskState: null,
      }));
      return;
    }

    if (config.thinkingMode !== 'high') {
      setConfig((previousConfig) => (
        previousConfig.mode === GenerationMode.ECOMMERCE && previousConfig.thinkingMode !== 'high'
          ? { ...previousConfig, thinkingMode: 'high' }
          : previousConfig
      ));
    }
  }, [config.mode, config.thinkingMode, setConfig]);

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
    const capabilityRole = m === GenerationMode.PPT
      ? 'ppt_generation'
      : m === GenerationMode.ECOMMERCE
        ? 'ecommerce_generation'
        : m === GenerationMode.IMAGE
          ? 'image_generation'
          : null;
    const capabilityRouteId = capabilityRole
      ? resolveEnabledCapabilityRouteAssignment(capabilityRole)?.primaryRouteId
      : undefined;
    const capabilityKeyId = capabilityRouteId && keyManager.getKey(capabilityRouteId)
      ? capabilityRouteId
      : undefined;
    const rememberedKeyId = modePreferredKeyMap[m];
    if (
      capabilityRole
      && isCapabilityRouteAssignmentRouteDisabled(capabilityRole, rememberedKeyId)
    ) {
      return undefined;
    }
    return capabilityKeyId || rememberedKeyId;
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
    config.aspectRatio, config.imageSize, config.parallelCount,
    config.model, config.enableGrounding, config.enableImageSearch, config.thinkingMode, config.mode, config.pptSlides, config.pptStyleLocked,
    config.referenceImages, // Add referenceImages to dep array
    config.prompt, config.videoResolution, config.videoDuration, config.videoAudio, config.audioDuration, config.audioLyrics, config.maskUrl, config.editMode // 全量依赖监听
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
      const sourceImage = imageNodesById.get(activeSourceImage);
      if (sourceImage) {
        const parentPrompt = sourceImage.parentPromptId
          ? (promptNodesById.get(sourceImage.parentPromptId) ?? null)
          : null;
        return resolveFollowUpDraftPosition({
          sourceImage,
          parentPrompt,
          imageNodes: activeCanvas.imageNodes,
        });
      }
    }
    // Smart Center Placement - Manual Mode (Always Center)
    // Use the actual InfiniteCanvas viewport plus the live transform to compute a precise center
    const currentTf = canvasRef.current?.getCurrentTransform() || canvasTransform;
    const vpRect = canvasRef.current?.getCanvasRect() || null;
    return getViewportPreferredPosition(currentTf, vpRect, 180);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCanvas, activeSourceImage, canvasTransform, imageNodesById, promptNodesById]);

  // [Draft Feature] Persistent Input Card State - Moved to Top





  // Clear the follow-up source image and remove the empty follow-up draft at the same time
  const handleClearSource = useCallback(() => {
    setActiveSourceImage(null);
    // If the draft belongs to follow-up mode and is empty, remove it
    if (draftNodeId && draftPromptNode?.sourceImageId && !draftPromptNode.prompt.trim()) {
      // Only remove drafts that still belong to follow-up mode and have no content
      deletePromptNode(draftNodeId);
      setDraftNodeId(null);
    }
  }, [deletePromptNode, draftNodeId, draftPromptNode]);

  // Right-Click Selection State
  const [selectionMenuPosition, setSelectionMenuPosition] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const {
    selectionBox,
    handleSelectionMouseDown,
    handleSelectionMouseMove,
    handleSelectionMouseUp,
  } = useCanvasSelectionBox({
    activeCanvas,
    canvasTransform,
    selectedNodeIds,
    getCardDimensions,
    selectNodes,
    clearSelection,
    closeSelectionMenu: () => setSelectionMenuPosition(null),
    setSelectionMenuPosition,
  });



  // Connection Dragging State
  const [isNodeDragActive, setIsNodeDragActive] = useState(false);
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
    workspaceSurface,
    setWorkspaceSurface,
    activeAppSurface,
    activeWorkspacePanel,
    focusWorkspace,
    toggleChatPanel,
    openProfileSurface,
    openSettingsSurface,
  } = useWorkspaceSurface({
    showSettingsPanel,
    showProfileModal,
    handleShowMobileNav,
    openSettingsPanel,
    setProfileInitialView,
    setShowProfileModal,
    setShowUserMenu,
  });

  useDraftNodeSync({
    draftNodeId,
    draftPromptNode,
    activeSourceImage,
    config,
    canvasRef,
    canvasTransform,
    isSidebarOpen,
    isChatOpen,
    isMobile,
    resolveNodeRouteState,
    updatePromptNode,
    deletePromptNode,
    setDraftNodeId,
  });

  const resolveGenerationPlacement = useGenerationPlacement({
    activeCanvasRef,
    canvasRef,
    canvasTransform,
    isSidebarOpen,
    isChatOpen,
    isMobile,
    chatSidebarWidth,
    reservedRegionsRef,
    updatePromptNode,
  });

  const prepareGenerationReferenceImages = useGenerationReferenceImages({
    activeSourceImage,
    imageNodesById,
  });

  const openSettingsSurfaceTracked = useCallback((
    view: SettingsSurfaceView = 'dashboard',
    supplier: Supplier | null = null,
  ) => {
    openSettingsSurface(view, supplier);
  }, [openSettingsSurface]);

  const openCurrentMobileSettingsSurface = useCallback(() => {
    openSettingsSurfaceTracked('dashboard');
  }, [openSettingsSurfaceTracked]);

  const {
    dragConnection,
    handleConnectStart,
    handleConnectEnd,
    handleDragConnectionMouseMove,
    handleDragConnectionMouseUp,
  } = useCanvasDragConnection({
    canvasTransform,
    linkNodes,
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
    if (!isMobile || !isReady) {
      return;
    }

    const retentionMode = getMobileRetentionPreference() || ensureMobileRetentionPreference();
    if (retentionMode === 'manual') {
      return;
    }

    const lastRunAtRaw = localStorage.getItem(`${MOBILE_RETENTION_PREFERENCE_KEY}:last-run-at`);
    const lastRunAt = Number(lastRunAtRaw || '0');
    if (Number.isFinite(lastRunAt) && Date.now() - lastRunAt < 12 * 60 * 60 * 1000) {
      return;
    }

    const retentionDays = retentionMode === '30d' ? 30 : 7;
    void Promise.allSettled([
      cleanupImagesOlderThan(retentionDays),
      cleanupOriginalsOlderThan(retentionDays),
      cleanupCompletedTasksOlderThan(retentionDays),
      Promise.resolve(cleanupLogsOlderThan(retentionDays)),
    ]).finally(() => {
      localStorage.setItem(`${MOBILE_RETENTION_PREFERENCE_KEY}:last-run-at`, String(Date.now()));
    });
  }, [isMobile, isReady]);
  const createEphemeralId = useCallback((prefix: string) => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }, []);

  const readBlobAsDataUrl = useCallback((blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('FILE_READ_FAILED'));
    reader.readAsDataURL(blob);
  }), []);

  const sanitizeReferenceToken = useCallback((value: string) => (
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'ref'
  ), []);

  const buildUploadReferenceIdentity = useCallback((file: File, labelPrefix: string) => (
    `${labelPrefix}-${sanitizeReferenceToken(file.name || labelPrefix)}-${file.size}-${file.lastModified}`
  ), [sanitizeReferenceToken]);

  const buildProductImageRef = useCallback((referenceImage?: ReferenceImage | null): EcommerceImageRef | undefined => (
    referenceImage
      ? {
          id: referenceImage.id,
          storageId: referenceImage.storageId,
          label: '产品图1',
          mimeType: referenceImage.mimeType,
          url: referenceImage.url,
        }
      : undefined
  ), []);

  const buildReferenceImageSignature = useCallback((referenceImages: ReferenceImage[]) => (
    referenceImages.map((referenceImage) => [
      referenceImage.id,
      referenceImage.storageId || '',
      referenceImage.mimeType || '',
      referenceImage.url || '',
      referenceImage.data || '',
    ].join('|')).join('||')
  ), []);

  const buildEcommerceImageRefSignature = useCallback((reference?: EcommerceImageRef) => (
    reference
      ? [reference.id, reference.storageId || '', reference.label || '', reference.mimeType || '', reference.url || ''].join('|')
      : ''
  ), []);

  const buildTaskStateSyncSignature = useCallback((taskState?: EcommerceEditableTaskState | null) => JSON.stringify({
    imageRoleSummary: taskState?.imageRoleSummary || [],
    assetRoles: taskState?.assetRoles || [],
    missingFields: taskState?.missingFields || [],
    effectiveSizePolicy: taskState?.effectiveSizePolicy || '',
    effectiveSizeTier: taskState?.effectiveSizeTier || '',
    promptOverride: taskState?.promptOverride || '',
    resolvedPromptPreview: taskState?.resolvedPromptPreview || '',
    displayLabel: taskState?.displayLabel || '',
  }), []);

  const createReferenceImageFromFile = useCallback(async (file: File, labelPrefix: string): Promise<ReferenceImage> => {
    const dataUrl = await readBlobAsDataUrl(file);
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    const referenceIdentity = buildUploadReferenceIdentity(file, labelPrefix);
    return {
      id: referenceIdentity,
      storageId: referenceIdentity,
      data: match?.[2] || '',
      mimeType: match?.[1] || file.type || 'image/png',
      url: dataUrl,
    };
  }, [buildUploadReferenceIdentity, readBlobAsDataUrl]);

  const createReferenceImageFromAsset = useCallback((asset: EcommerceAnalysisAsset): ReferenceImage | null => {
    if (!asset.previewUrl) return null;
    const match = asset.previewUrl.match(/^data:([^;]+);base64,(.+)$/);
    return {
      id: `analysis-${asset.assetId}`,
      storageId: asset.assetId,
      data: match?.[2] || '',
      mimeType: match?.[1] || asset.mimeType || 'image/png',
      url: asset.previewUrl,
    };
  }, []);

  const buildCurrentEcommerceUploadReferences = useCallback(async (): Promise<EcommerceUploadReferenceBundle> => {
    const productReferences = await Promise.all(
      ecommerceState.productFiles
        .slice(0, MAX_ECOMMERCE_PRODUCT_FILES)
        .map((file, index) => createReferenceImageFromFile(file, `product-${index + 1}`)),
    );
    const extraReferences = await Promise.all(
      ecommerceState.extraReferenceFiles
        .slice(0, MAX_ECOMMERCE_EXTRA_REFERENCE_FILES)
        .map((file, index) => createReferenceImageFromFile(file, `extra-${index + 1}`)),
    );

    return {
      productReferences,
      extraReferences,
      productImageRef: buildProductImageRef(productReferences[0]),
    };
  }, [buildProductImageRef, createReferenceImageFromFile, ecommerceState.extraReferenceFiles, ecommerceState.productFiles]);

  const extractEcommerceManualReferenceBindings = useCallback((taskStateSeed?: EcommerceEditableTaskState | null) => {
    if (!taskStateSeed?.sourceRowKey) {
      return [] as EcommerceManualReferenceBinding[];
    }

    return ecommerceState.itemReferenceFiles[taskStateSeed.sourceRowKey] || [];
  }, [ecommerceState.itemReferenceFiles]);

  const buildInitialEcommerceTaskStates = useCallback((analysis: EcommerceAnalysisResult): Record<string, EcommerceEditableTaskState> => {
    const nextStateMap: Record<string, EcommerceEditableTaskState> = {};

    analysis.mainImageItems.forEach((item) => {
      if (item.editableTask) {
        nextStateMap[item.itemId] = applyEffectiveSizingToTaskState(item.editableTask);
      }
    });
    analysis.aPlusGroup.modules.forEach((item) => {
      if (item.editableTask) {
        nextStateMap[item.moduleId] = applyEffectiveSizingToTaskState(item.editableTask);
      }
    });

    return nextStateMap;
  }, [applyEffectiveSizingToTaskState]);

  const findEcommerceAnalysisItemBySourceKey = useCallback((analysis: EcommerceAnalysisResult, sourceKey: string) => {
    return analysis.mainImageItems.find((item) => item.itemId === sourceKey)
      || analysis.aPlusGroup.modules.find((item) => item.moduleId === sourceKey)
      || null;
  }, []);

  const handleChangeEcommerceTaskState = useCallback((
    taskId: string,
    updater:
      | EcommerceEditableTaskState
      | ((previous: EcommerceEditableTaskState) => EcommerceEditableTaskState),
  ) => {
    setEcommerceState((previousState) => {
      const nextTaskStates = { ...previousState.taskStates };
      let didUpdate = false;

      Object.entries(nextTaskStates).forEach(([rowKey, taskState]) => {
        if (!taskState) return;
        if (taskState.taskId !== taskId && rowKey !== taskId) return;
        const updatedTaskState = typeof updater === 'function' ? updater(taskState) : updater;
        nextTaskStates[rowKey] = applyEffectiveSizingToTaskState(updatedTaskState);
        didUpdate = true;
      });

      let nextActiveTaskState = previousState.activeTaskState;
      if (previousState.activeTaskState && previousState.activeTaskState.taskId === taskId) {
        const updatedActiveTaskState = typeof updater === 'function'
          ? updater(previousState.activeTaskState)
          : updater;
        nextActiveTaskState = applyEffectiveSizingToTaskState(updatedActiveTaskState);
        didUpdate = true;
      }

      if (!didUpdate) {
        return previousState;
      }

      return {
        ...previousState,
        taskStates: nextTaskStates,
        activeTaskState: nextActiveTaskState,
      };
    });
  }, [applyEffectiveSizingToTaskState]);

  const buildRuntimeEcommerceAssetRoles = useCallback((params: {
    rowAssets: EcommerceAnalysisAsset[];
    rowMentions: Array<{ assetId: string; label: string; mentionTokens: string[]; notes?: string }>;
    manualReferences: EcommerceManualReferenceBinding[];
    productReferences: ReferenceImage[];
    extraReferences: ReferenceImage[];
  }): EcommerceTaskAssetRoleBinding[] => {
    return buildEcommerceAssetRoleBindings({
      rowAssets: params.rowAssets,
      rowMentions: params.rowMentions,
      manualReferences: params.manualReferences,
      productReferences: params.productReferences,
      extraReferences: params.extraReferences,
    });
  }, []);

  const handlePickEcommerceRequirementFile = useCallback((files: FileList | File[]) => {
    const [file] = Array.from(files);
    if (!file) return;
    setEcommerceState((previousState) => ({
      ...previousState,
      ...createEcommerceAnalysisResetPatch({ requirementFile: file }),
    }));
  }, []);

  const handleClearEcommerceRequirementFile = useCallback(() => {
    setEcommerceState((previousState) => ({
      ...previousState,
      ...createEcommerceAnalysisResetPatch({ requirementFile: null, isAnalyzing: false }),
    }));
  }, []);

  const handlePickEcommerceProductFiles = useCallback((files: FileList | File[]) => {
    const nextFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (nextFiles.length === 0) return;
    setEcommerceState((previousState) => ({
      ...previousState,
      productFiles: appendUploadFilesWithinLimit(
        previousState.productFiles,
        nextFiles,
        MAX_ECOMMERCE_PRODUCT_FILES,
      ),
      analysis: previousState.analysis,
    }));
  }, []);

  const handlePickEcommerceExtraReferenceFiles = useCallback((files: FileList | File[]) => {
    const nextFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (nextFiles.length === 0) return;
    setEcommerceState((previousState) => ({
      ...previousState,
      extraReferenceFiles: appendUploadFilesWithinLimit(
        previousState.extraReferenceFiles,
        nextFiles,
        MAX_ECOMMERCE_EXTRA_REFERENCE_FILES,
      ),
    }));
  }, []);

  const handleRemoveEcommerceProductFile = useCallback((index: number) => {
    setEcommerceState((previousState) => ({
      ...previousState,
      productFiles: previousState.productFiles.filter((_, fileIndex) => fileIndex !== index),
    }));
  }, []);

  const handleRemoveEcommerceExtraReferenceFile = useCallback((index: number) => {
    setEcommerceState((previousState) => ({
      ...previousState,
      extraReferenceFiles: previousState.extraReferenceFiles.filter((_, fileIndex) => fileIndex !== index),
    }));
  }, []);

  const handlePickEcommerceItemReferenceFiles = useCallback(async (sourceKey: string, files: FileList | File[]) => {
    const nextFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!sourceKey || nextFiles.length === 0) {
      return;
    }

    const manualReferenceBindings = await Promise.all(
      nextFiles.map(async (file, index) => {
        const referenceImage = await createReferenceImageFromFile(file, `item-${sourceKey}-${index + 1}`);
        const assetId = referenceImage.storageId || referenceImage.id;
        const label = `手动参考图${index + 1}`;

        return {
          assetId,
          label,
          fileName: file.name,
          referenceImage,
          assetRole: {
            assetId,
            role: 'reference' as const,
            label,
            normalizedLabel: label,
            source: 'upload' as const,
            note: '用户手动补传到当前需求的参考图',
          },
        } satisfies EcommerceManualReferenceBinding;
      }),
    );

    setEcommerceState((previousState) => {
      const previousBindings = previousState.itemReferenceFiles[sourceKey] || [];
      return {
        ...previousState,
        itemReferenceFiles: {
          ...previousState.itemReferenceFiles,
          [sourceKey]: [
            ...previousBindings,
            ...manualReferenceBindings,
          ].slice(0, MAX_ECOMMERCE_ITEM_REFERENCE_FILES),
        },
      };
    });
  }, [createReferenceImageFromFile]);

  const handleRemoveEcommerceItemReferenceFile = useCallback((sourceKey: string, index: number) => {
    setEcommerceState((previousState) => ({
      ...previousState,
      itemReferenceFiles: {
        ...previousState.itemReferenceFiles,
        [sourceKey]: (previousState.itemReferenceFiles[sourceKey] || []).filter((_, bindingIndex) => bindingIndex !== index),
      },
    }));
  }, []);

  const handleResetEcommerceAnalysis = useCallback(() => {
    setEcommerceState((previousState) => ({
      ...previousState,
      ...createEcommerceAnalysisResetPatch({ isAnalyzing: false }),
    }));
  }, []);

  const handleToggleEcommerceAnalysisSelection = useCallback((id: string, selected: boolean) => {
    setEcommerceState((previousState) => ({
      ...previousState,
      selectedItems: {
        ...previousState.selectedItems,
        [id]: selected,
      },
    }));
  }, []);

  const handleUpdateEcommerceSheetSetting = useCallback((
    sheet: EcommerceGroupSheet,
    patch: EcommerceSheetSettingPatch,
  ) => {
    const previousSetting = ecommerceState.sheetSettings[sheet] || createDefaultEcommerceSheetSettings(config.model)[sheet];
    const mergedSetting: EcommerceSheetSetting = {
      ...previousSetting,
      ...patch,
    };
    const nextSetting: EcommerceSheetSetting = sheet === 'A+'
      ? { ...mergedSetting, imageSize: ImageSize.SIZE_4K }
      : mergedSetting;

    if (
      previousSetting.aspectRatio === nextSetting.aspectRatio
      && previousSetting.imageSize === nextSetting.imageSize
      && previousSetting.aPlusControlMode === nextSetting.aPlusControlMode
    ) {
      return;
    }

    setEcommerceState((previousState) => {
      const nextTaskStates = Object.fromEntries(
        Object.entries(previousState.taskStates).map(([rowKey, taskState]) => [
          rowKey,
          taskState && taskState.sourceSheet === sheet
            ? applyEffectiveSizingToTaskState(taskState, { controlMode: nextSetting.aPlusControlMode })
            : taskState,
        ]),
      ) as Record<string, EcommerceEditableTaskState>;

      const nextActiveTaskState = previousState.activeTaskState && previousState.activeTaskState.sourceSheet === sheet
        ? applyEffectiveSizingToTaskState(previousState.activeTaskState, { controlMode: nextSetting.aPlusControlMode })
        : previousState.activeTaskState;

      return {
        ...previousState,
        taskStates: nextTaskStates,
        activeTaskState: nextActiveTaskState,
        sheetSettings: {
          ...previousState.sheetSettings,
          [sheet]: nextSetting,
        },
      };
    });

    if (config.mode === GenerationMode.ECOMMERCE) {
      setConfig((previousConfig) => ({
        ...previousConfig,
        aspectRatio: sheet !== 'A+' ? nextSetting.aspectRatio : previousConfig.aspectRatio,
        imageSize: nextSetting.imageSize,
        thinkingMode: 'high',
      }));
    }

    startTransition(() => {
      const promptNodes = activeCanvasRef.current?.promptNodes || [];
      promptNodes
        .filter((node) => (
          node.mode === GenerationMode.ECOMMERCE
          && node.ecommerce?.sourceSheet === sheet
          && node.ecommerce.kind !== 'a-plus-group'
        ))
        .forEach((node) => {
          if (!node.ecommerce) {
            return;
          }

          const effectivePolicy = node.ecommerce.kind === 'a-plus-module'
            ? resolveEffectiveEcommerceAPlusPolicy({
                detectedSizeTier: node.ecommerce.sizeTier,
                controlMode: node.ecommerce.sizeControlOverride ?? nextSetting.aPlusControlMode,
              })
            : null;
          const nextNodeAspectRatio = node.ecommerce.sourceSheet === 'A+'
            ? (effectivePolicy?.runtimeAspectRatio || node.ecommerce.currentAspectRatio || node.aspectRatio)
            : nextSetting.aspectRatio;
          const nextNodeImageSize = nextSetting.imageSize;
          const nextEffectiveSizePolicy = effectivePolicy?.effectiveSizePolicy || node.ecommerce.sizePolicy;
          const nextTaskState = node.ecommerce.editableTask
            ? applyEffectiveSizingToTaskState(node.ecommerce.editableTask, { controlMode: nextSetting.aPlusControlMode })
            : node.ecommerce.editableTask;
          const nextRenderTask = nextTaskState && node.ecommerce.seriesTemplate
            ? buildEcommerceRenderTask({
                taskState: nextTaskState,
                seriesTemplate: node.ecommerce.seriesTemplate,
                aspectRatio: String(nextNodeAspectRatio),
                imageSize: String(nextNodeImageSize),
                productName: node.ecommerce.productImageRef?.label || node.ecommerce.theme || '',
              })
            : null;

          updatePromptNode({
            ...node,
            prompt: nextRenderTask?.prompt || node.prompt,
            originalPrompt: nextRenderTask?.prompt || node.originalPrompt,
            aspectRatio: nextNodeAspectRatio as AspectRatio,
            imageSize: nextNodeImageSize,
            ecommerce: {
              ...node.ecommerce,
              aPlusControlMode: node.ecommerce.sourceSheet === 'A+' ? resolveEcommerceAPlusControlMode(nextSetting) : node.ecommerce.aPlusControlMode,
              currentAspectRatio: nextNodeAspectRatio as AspectRatio,
              sizePolicy: nextEffectiveSizePolicy,
              effectiveSizePolicy: effectivePolicy?.effectiveSizePolicy || node.ecommerce.effectiveSizePolicy,
              effectiveSizeTier: effectivePolicy?.effectiveSizeTier || node.ecommerce.effectiveSizeTier,
              allowedAspectRatios: (effectivePolicy?.allowedAspectRatios || node.ecommerce.allowedAspectRatios) as AspectRatio[] | undefined,
              activeDeliveryKind: nextEffectiveSizePolicy === 'desktop-then-mobile'
                ? (node.ecommerce.activeDeliveryKind === 'mobile' ? 'mobile' : 'desktop')
                : 'default',
              desktopStage: nextEffectiveSizePolicy === 'desktop-then-mobile'
                ? node.ecommerce.desktopStage
                : 'not_applicable',
              mobileStage: nextEffectiveSizePolicy === 'desktop-then-mobile'
                ? node.ecommerce.mobileStage
                : 'not_applicable',
              desktopAspectRatio: node.ecommerce.kind === 'a-plus-module' && nextEffectiveSizePolicy === 'desktop-then-mobile'
                ? nextNodeAspectRatio as AspectRatio
                : undefined,
              mobileAspectRatio: nextEffectiveSizePolicy === 'desktop-then-mobile'
                ? ((effectivePolicy?.mobileAspectRatio || node.ecommerce.mobileAspectRatio) as AspectRatio | undefined)
                : undefined,
              editableTask: nextRenderTask?.taskState || nextTaskState,
              displayLabel: nextRenderTask?.displayLabel || node.ecommerce.displayLabel,
            },
          });
        });
    });
  }, [activeCanvasRef, applyEffectiveSizingToTaskState, config.mode, config.model, ecommerceState.sheetSettings, resolveEcommerceAPlusControlMode, setConfig, updatePromptNode]);

  const handleAnalyzeEcommerceRequirement = useCallback(async () => {
    if (!ecommerceState.requirementFile) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.warning('缺少需求单', '请先上传运营需求文件。');
      });
      return;
    }

    setEcommerceState((previousState) => ({ ...previousState, isAnalyzing: true }));
    try {
      let analysis = await analyzeEcommerceRequirementFile(ecommerceState.requirementFile);

      if (config.enablePromptOptimization && ecommerceState.productFiles.length > 0) {
        try {
          const { enhanceAnalysisWithAI } = await import('./services/ecommerce/ecommerceAnalysisEnhancer');
          const productImageData = await Promise.all(
            ecommerceState.productFiles.map(async (file) => {
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(new Error('读取产品图失败'));
                reader.readAsDataURL(file);
              });
              const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
              return { mimeType: match?.[1] || file.type || 'image/png', data: match?.[2] || dataUrl };
            }),
          );
          analysis = await enhanceAnalysisWithAI(analysis, productImageData);
        } catch (enhanceError) {
          console.warn('[ecommerce] AI enhancement failed, using template analysis', enhanceError);
        }
      }

      const selectedItems: Record<string, boolean> = {};
      analysis.mainImageItems.forEach((item) => {
        selectedItems[item.itemId] = true;
      });
      analysis.aPlusGroup.modules.forEach((module) => {
        selectedItems[module.moduleId] = true;
      });
      setEcommerceState((previousState) => ({
        ...previousState,
        analysis,
        itemReferenceFiles: previousState.itemReferenceFiles,
        analysisConfirmed: false,
        selectedItems,
        taskStates: buildInitialEcommerceTaskStates(analysis),
        groupSlots: createEmptyEcommerceGroupSlots(),
        activeTaskNodeId: null,
        activeTaskState: null,
        activeGroupSheet: null,
        isAnalyzing: false,
        isConfirmingAnalysis: false,
      }));
      import('./services/system/notificationService').then(({ notify }) => {
        notify.success('分析完成', `已解析主图 ${analysis.mainImageItems.length} 条，A+ ${analysis.aPlusGroup.modules.length} 条。`);
      });
    } catch (error: any) {
      setEcommerceState((previousState) => ({ ...previousState, isAnalyzing: false, isConfirmingAnalysis: false }));
      import('./services/system/notificationService').then(({ notify }) => {
        notify.error('分析失败', error?.message || '请稍后重试。');
      });
    }
  }, [buildInitialEcommerceTaskStates, ecommerceState.requirementFile]);

  useEffect(() => {
    if (!ecommerceState.activeTaskNodeId || !ecommerceState.activeTaskState) {
      return;
    }

    const latestNode = activeCanvas?.promptNodes.find((node) => node.id === ecommerceState.activeTaskNodeId);
    if (!latestNode?.ecommerce?.seriesTemplate) {
      return;
    }

    const mergedTaskState = applyEffectiveSizingToTaskState(mergeEcommerceTaskState({
      baseTask: ecommerceState.activeTaskState,
      seriesTemplate: latestNode.ecommerce.seriesTemplate,
      sparseIntent: ecommerceState.activeTaskState.sparseUserIntent,
      productName: latestNode.ecommerce.productImageRef?.label || latestNode.ecommerce.theme || '',
    }));
    const nextAspectRatio = latestNode.ecommerce.currentAspectRatio || latestNode.aspectRatio || AspectRatio.SQUARE;
    const nextImageSize = latestNode.imageSize || (resolvePreferredEcommerceImageSize(latestNode.model) as ImageSize);
    const renderTask = buildEcommerceRenderTask({
      taskState: mergedTaskState,
      seriesTemplate: latestNode.ecommerce.seriesTemplate,
      aspectRatio: String(nextAspectRatio),
      imageSize: String(nextImageSize),
    });

    if (
      latestNode.originalPrompt === renderTask.prompt
      && latestNode.ecommerce.displayLabel === renderTask.displayLabel
      && latestNode.ecommerce.editableTask?.taskId === renderTask.taskState.taskId
      && latestNode.ecommerce.editableTask?.resolvedPromptPreview === renderTask.taskState.resolvedPromptPreview
    ) {
      return;
    }

    updatePromptNode({
      ...latestNode,
      prompt: renderTask.prompt,
      originalPrompt: renderTask.prompt,
      imageSize: nextImageSize,
      ecommerce: {
        ...latestNode.ecommerce,
        editableTask: renderTask.taskState,
        displayLabel: renderTask.displayLabel,
      },
    });
  }, [activeCanvas, applyEffectiveSizingToTaskState, ecommerceState.activeTaskNodeId, ecommerceState.activeTaskState, updatePromptNode]);

  useEffect(() => {
    const analysis = ecommerceState.analysis;
    if (!ecommerceState.analysisConfirmed || !analysis || !activeCanvas?.promptNodes.length) {
      return;
    }

    const ecommercePromptNodes = activeCanvas.promptNodes.filter(
      (node) => node.mode === GenerationMode.ECOMMERCE && node.ecommerce?.kind !== 'a-plus-group',
    );
    if (ecommercePromptNodes.length === 0) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const {
        productReferences: nextProductReferences,
        extraReferences: nextExtraReferences,
        productImageRef: nextProductImageRef,
      } = await buildCurrentEcommerceUploadReferences();
      if (cancelled) {
        return;
      }

      const nextTaskStatesBySourceKey: Record<string, EcommerceEditableTaskState> = {};
      const nextActiveTaskCandidates = new Map<string, EcommerceEditableTaskState>();

      ecommercePromptNodes.forEach((node) => {
        if (!node.ecommerce?.seriesTemplate) {
          return;
        }

        const sourceItem = findEcommerceAnalysisItemBySourceKey(analysis, node.ecommerce.sourceRowKey);
        if (!sourceItem) {
          return;
        }

        const rowAssets = analysis.assets.referenceAssets.filter((asset) => (
          sourceItem.referenceAssetIds.includes(asset.assetId)
        ));
        const rowReferences = rowAssets
          .map(createReferenceImageFromAsset)
          .filter((referenceImage): referenceImage is ReferenceImage => Boolean(referenceImage));
        const taskStateSeed = ecommerceState.taskStates[node.ecommerce.sourceRowKey] || node.ecommerce.editableTask;
        const manualReferences = extractEcommerceManualReferenceBindings(taskStateSeed);
        const nextImageSize = node.imageSize || (resolvePreferredEcommerceImageSize(node.model) as ImageSize);
        const nextAspectRatio = node.ecommerce.currentAspectRatio || node.aspectRatio || AspectRatio.SQUARE;
        const nextReferenceImages = [...rowReferences, ...manualReferences.map((reference) => reference.referenceImage), ...nextProductReferences, ...nextExtraReferences];
        const nextAssetRoles = buildRuntimeEcommerceAssetRoles({
          rowAssets,
          rowMentions: sourceItem.referenceMentions,
          manualReferences: manualReferences,
          productReferences: nextProductReferences,
          extraReferences: nextExtraReferences,
        });
        const nextTaskState = taskStateSeed
          ? applyEffectiveSizingToTaskState({
              ...taskStateSeed,
              assetRoles: nextAssetRoles,
            })
          : null;
        const nextRenderTask = nextTaskState
          ? buildEcommerceRenderTask({
              taskState: mergeEcommerceTaskState({
                baseTask: nextTaskState,
                seriesTemplate: node.ecommerce.seriesTemplate,
                sparseIntent: nextTaskState.sparseUserIntent,
                productName: analysis.projectMeta.productName,
              }),
              seriesTemplate: node.ecommerce.seriesTemplate,
              aspectRatio: String(nextAspectRatio),
              imageSize: String(nextImageSize),
            })
          : null;

        if (nextRenderTask) {
          nextTaskStatesBySourceKey[node.ecommerce.sourceRowKey] = nextRenderTask.taskState;
          nextActiveTaskCandidates.set(nextRenderTask.taskState.taskId, nextRenderTask.taskState);
          nextActiveTaskCandidates.set(node.ecommerce.sourceRowKey, nextRenderTask.taskState);
        }

        const nextEditableTask = nextRenderTask?.taskState || node.ecommerce.editableTask;
        const nextDisplayLabel = nextRenderTask?.displayLabel || node.ecommerce.displayLabel;
        const referenceImagesChanged = buildReferenceImageSignature(node.referenceImages || [])
          !== buildReferenceImageSignature(nextReferenceImages);
        const productImageRefChanged = buildEcommerceImageRefSignature(node.ecommerce.productImageRef)
          !== buildEcommerceImageRefSignature(nextProductImageRef);
        const taskStateChanged = buildTaskStateSyncSignature(node.ecommerce.editableTask)
          !== buildTaskStateSyncSignature(nextEditableTask);
        const displayLabelChanged = (node.ecommerce.displayLabel || '') !== (nextDisplayLabel || '');

        if (!referenceImagesChanged && !productImageRefChanged && !taskStateChanged && !displayLabelChanged) {
          return;
        }

        updatePromptNode({
          ...node,
          prompt: nextRenderTask?.prompt || node.prompt,
          originalPrompt: nextRenderTask?.prompt || node.originalPrompt || node.prompt,
          referenceImages: nextReferenceImages,
          ecommerce: {
            ...node.ecommerce,
            productImageRef: nextProductImageRef,
            editableTask: nextEditableTask,
            displayLabel: nextDisplayLabel,
          },
        });
      });

      if (Object.keys(nextTaskStatesBySourceKey).length === 0) {
        return;
      }

      setEcommerceState((previousState) => ({
        ...previousState,
        taskStates: {
          ...previousState.taskStates,
          ...nextTaskStatesBySourceKey,
        },
        activeTaskState: previousState.activeTaskState
          ? nextActiveTaskCandidates.get(previousState.activeTaskState.taskId)
            || nextActiveTaskCandidates.get(previousState.activeTaskState.sourceRowKey)
            || previousState.activeTaskState
          : previousState.activeTaskState,
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeCanvas?.id,
    activeCanvas?.promptNodes.length,
    buildCurrentEcommerceUploadReferences,
    buildEcommerceImageRefSignature,
    buildReferenceImageSignature,
    buildRuntimeEcommerceAssetRoles,
    buildTaskStateSyncSignature,
    applyEffectiveSizingToTaskState,
    createReferenceImageFromAsset,
    extractEcommerceManualReferenceBindings,
    ecommerceState.analysis,
    ecommerceState.analysisConfirmed,
    ecommerceState.taskStates,
    findEcommerceAnalysisItemBySourceKey,
    updatePromptNode,
  ]);

  const buildEcommerceFrameworkNode = useCallback((
    analysis: EcommerceAnalysisResult,
    position: { x: number; y: number },
  ): PromptNode => {
    const productName = analysis.projectMeta.productName;
    const label = `${productName || '电商'} Framework`;
    const schedulerConfig = createDefaultEcommerceFrameworkSchedulerConfig();
    const summary = [
      analysis.projectMeta.projectName || label,
      analysis.projectMeta.productName ? `产品：${analysis.projectMeta.productName}` : '',
      '主图',
      ...analysis.mainImageItems.map((item, index) => {
        const selected = ecommerceState.selectedItems[item.itemId] !== false ? '保留' : '跳过';
        return `${index + 1}. [${selected}] ${item.theme || item.type}${item.designRequirements ? ` - ${item.designRequirements}` : ''}`;
      }),
      'A+',
      ...analysis.aPlusGroup.modules.map((item, index) => {
        const selected = ecommerceState.selectedItems[item.moduleId] !== false ? '保留' : '跳过';
        return `${index + 1}. [${selected}] ${item.moduleName}${item.designRequirements ? ` - ${item.designRequirements}` : ''}`;
      }),
    ].filter(Boolean).join('\n');

    return {
      id: createEphemeralId('ecom-framework'),
      prompt: summary,
      originalPrompt: summary,
      position,
      aspectRatio: AspectRatio.LANDSCAPE_16_9,
      imageSize: ImageSize.SIZE_1K,
      model: normalizeEcommerceModelId(config.model) || 'gemini-3.1-flash-image-preview',
      childImageIds: [],
      timestamp: Date.now(),
      mode: GenerationMode.ECOMMERCE,
      parallelCount: 1,
      thinkingMode: 'high',
      referenceImages: [],
      ecommerce: {
        kind: 'framework',
        sourceSheet: '主图',
        sourceRowKey: 'framework-root',
        selectedForGeneration: false,
        stage: 'ready',
        theme: label,
        displayLabel: label,
        desktopStage: 'not_applicable',
        mobileStage: 'not_applicable',
        allowedAspectRatios: [AspectRatio.LANDSCAPE_16_9],
        currentAspectRatio: AspectRatio.LANDSCAPE_16_9,
        frameworkMeta: {
          activeSheet: '主图',
          groupIds: {},
          taskNodeIds: [],
          schedulerConfig,
        },
      },
    };
  }, [config.model, createEphemeralId, ecommerceState.selectedItems]);

  const buildEcommerceGroupNode = useCallback((
    productName: string,
    sourceSheet: '主图' | 'A+',
    position: { x: number; y: number },
  frameworkId?: string,
  ): PromptNode => {
    const sheetSetting = ecommerceState.sheetSettings[sourceSheet] || createDefaultEcommerceSheetSettings(config.model)[sourceSheet];

    return {
      id: createEphemeralId(sourceSheet === '主图' ? 'ecom-main-group' : 'ecom-group'),
      prompt: `${productName || '电商'} ${sourceSheet}组卡`,
      originalPrompt: `${productName || '电商'} ${sourceSheet}组卡`,
      position,
      aspectRatio: sheetSetting.aspectRatio,
      imageSize: sheetSetting.imageSize,
      model: normalizeEcommerceModelId(config.model) || 'gemini-3.1-flash-image-preview',
      childImageIds: [],
      timestamp: Date.now(),
      mode: GenerationMode.ECOMMERCE,
      hiddenInCanvas: Boolean(frameworkId),
      parallelCount: 1,
      thinkingMode: 'high',
      ecommerce: {
        kind: 'a-plus-group',
        sourceSheet,
        sourceRowKey: sourceSheet === '主图' ? 'main-group' : 'aplus-group',
        frameworkId,
        parentNodeId: frameworkId,
        selectedForGeneration: false,
        stage: 'analysis_ready',
        theme: `${productName || '电商'} ${sourceSheet}组卡`,
        sizePolicy: 'sheet-native',
        allowedAspectRatios: [sheetSetting.aspectRatio],
        currentAspectRatio: sheetSetting.aspectRatio,
        desktopStage: 'pending',
        mobileStage: 'locked',
      },
    };
  }, [config.model, createEphemeralId, ecommerceState.sheetSettings]);

  const buildEcommercePromptNode = useCallback(async (params: ({
    item: EcommerceAnalysisMainImageItem;
    kind: 'main-image';
    position: { x: number; y: number };
    groupId?: string;
    frameworkId?: string;
    selected: boolean;
    analysis: EcommerceAnalysisResult;
    uploadReferences?: EcommerceUploadReferenceBundle;
  } | {
    item: EcommerceAnalysisAPlusModule;
    kind: 'a-plus-module';
    position: { x: number; y: number };
    groupId?: string;
    frameworkId?: string;
    selected: boolean;
    analysis: EcommerceAnalysisResult;
    uploadReferences?: EcommerceUploadReferenceBundle;
  })): Promise<PromptNode> => {
    const modelId = normalizeEcommerceModelId(config.model) || 'gemini-3.1-flash-image-preview';
    const policy = resolveEcommerceAspectPolicy({
      kind: params.kind,
      modelId,
      declaredDimensions: 'declaredSizeText' in params.item ? params.item.declaredSizeText : undefined,
      designRequirements: params.item.designRequirements,
      copyText: params.item.copyText,
    });
    const preferredImageSize = resolvePreferredEcommerceImageSize(modelId) as ImageSize;
    const rowAssets = params.analysis.assets.referenceAssets.filter((asset) => params.item.referenceAssetIds.includes(asset.assetId));
    const {
      productReferences,
      extraReferences,
      productImageRef,
    } = params.uploadReferences || await buildCurrentEcommerceUploadReferences();
    const rowReferences = rowAssets.map(createReferenceImageFromAsset).filter((item): item is ReferenceImage => Boolean(item));
    const sourceMetadata = params.kind === 'main-image'
      ? resolveEcommercePromptNodeMetadata({
          kind: 'main-image',
          item: params.item,
        })
      : resolveEcommercePromptNodeMetadata({
          kind: 'a-plus-module',
          item: params.item,
        });
    const sourceKey = params.kind === 'main-image' ? params.item.itemId : params.item.moduleId;
    const sheetSetting = ecommerceState.sheetSettings[sourceMetadata.sourceSheet]
      || createDefaultEcommerceSheetSettings(modelId)[sourceMetadata.sourceSheet];
    const aPlusEffectivePolicy = params.kind === 'a-plus-module'
      ? resolveEffectiveEcommerceAPlusPolicy({
          detectedSizeTier: policy.sizeTier,
          controlMode: resolveEcommerceAPlusControlMode(sheetSetting),
        })
      : null;
    const resolvedNodeAspectRatio = (sourceMetadata.sourceSheet === 'A+'
      ? (aPlusEffectivePolicy?.runtimeAspectRatio || policy.defaultAspectRatio)
      : sheetSetting.aspectRatio) as AspectRatio;
    const taskStateSeed = ecommerceState.taskStates[sourceKey]
      || params.item.editableTask;
    const taskManualReferences = extractEcommerceManualReferenceBindings(taskStateSeed);
    const referenceImages = [...rowReferences, ...taskManualReferences.map((reference) => reference.referenceImage), ...productReferences, ...extraReferences];
    const runtimeAssetRoles = buildRuntimeEcommerceAssetRoles({
      rowAssets,
      rowMentions: params.item.referenceMentions,
      manualReferences: taskManualReferences,
      productReferences,
      extraReferences,
    });
    const mergedTaskState = applyEffectiveSizingToTaskState(mergeEcommerceTaskState({
      baseTask: {
        ...(taskStateSeed || {
          taskId: `task-${sourceMetadata.sourceRowKey}`,
          templateId: params.analysis.seriesTemplate.templateId,
          sourceKind: params.kind,
          sourceSheet: sourceMetadata.sourceSheet,
          sourceRowKey: sourceMetadata.sourceRowKey,
          declaredSizeText: 'declaredSizeText' in params.item ? params.item.declaredSizeText : undefined,
          sizeTier: policy.sizeTier,
          effectiveSizePolicy: aPlusEffectivePolicy?.effectiveSizePolicy,
          effectiveSizeTier: aPlusEffectivePolicy?.effectiveSizeTier,
          sizeControlOverride: null,
          theme: sourceMetadata.theme,
          outputTypeLabel: params.kind === 'main-image' ? '主图' : 'A+',
          imageRoleSummary: runtimeAssetRoles.map((item) => item.normalizedLabel),
          sparseUserIntent: '',
          copy: { headline: '', subheadline: '', highlight: '', featureTags: [], cta: '' },
          style: { tone: '', atmosphere: '', effect: '', backgroundType: '' },
          layout: { productSize: 'balanced', textPosition: 'top-left', accessoryPolicy: 'auto' },
          inherit: {
            keepSeriesStyle: true,
            keepFontStyle: true,
            keepLayoutStyle: true,
            keepCopyStyle: true,
            keepPalette: true,
          },
          assetRoles: runtimeAssetRoles,
          consistencyChecks: [],
          missingFields: [],
          resolvedPromptPreview: '',
          displayLabel: '',
          promptOverride: '',
        }),
        assetRoles: runtimeAssetRoles,
      },
      seriesTemplate: params.analysis.seriesTemplate,
      sparseIntent: String(config.prompt || '').trim() || taskStateSeed?.sparseUserIntent || '',
      productName: params.analysis.projectMeta.productName,
    }), {
      controlMode: resolveEcommerceAPlusControlMode(sheetSetting),
    });
    const renderTask = buildEcommerceRenderTask({
      taskState: mergedTaskState,
      seriesTemplate: params.analysis.seriesTemplate,
      aspectRatio: resolvedNodeAspectRatio,
      imageSize: sheetSetting.imageSize,
    });

    return {
      id: createEphemeralId(params.kind === 'main-image' ? 'ecom-main' : 'ecom-module'),
      prompt: renderTask.prompt,
      originalPrompt: renderTask.prompt,
      position: params.position,
      aspectRatio: resolvedNodeAspectRatio,
      imageSize: sheetSetting.imageSize,
      model: modelId,
      childImageIds: [],
      referenceImages,
      timestamp: Date.now(),
      mode: GenerationMode.ECOMMERCE,
      hiddenInCanvas: Boolean(params.frameworkId),
      parallelCount: 1,
      thinkingMode: 'high',
      ecommerce: {
        kind: params.kind,
        sourceSheet: sourceMetadata.sourceSheet,
        sourceRowKey: sourceMetadata.sourceRowKey,
        groupId: params.groupId,
        frameworkId: params.frameworkId,
        parentNodeId: params.groupId || params.frameworkId,
        selectedForGeneration: params.selected,
        productImageRef,
        referenceBindings: params.item.referenceMentions,
        copyText: params.item.copyText,
        designRequirements: params.item.designRequirements,
        theme: sourceMetadata.theme,
        sizePolicy: aPlusEffectivePolicy?.effectiveSizePolicy || policy.sizePolicy,
        sizeTier: policy.sizeTier,
        effectiveSizePolicy: aPlusEffectivePolicy?.effectiveSizePolicy,
        effectiveSizeTier: aPlusEffectivePolicy?.effectiveSizeTier,
        allowedAspectRatios: (aPlusEffectivePolicy?.allowedAspectRatios || policy.allowedAspectRatios) as AspectRatio[],
        currentAspectRatio: resolvedNodeAspectRatio,
        activeDeliveryKind: (aPlusEffectivePolicy?.effectiveSizePolicy || policy.sizePolicy) === 'desktop-then-mobile' ? 'desktop' : 'default',
        aPlusControlMode: resolveEcommerceAPlusControlMode(sheetSetting),
        sizeControlOverride: mergedTaskState.sizeControlOverride ?? null,
        stage: 'analysis_ready',
        desktopStage: (aPlusEffectivePolicy?.effectiveSizePolicy || policy.sizePolicy) === 'desktop-then-mobile' ? 'pending' : 'not_applicable',
        mobileStage: (aPlusEffectivePolicy?.effectiveSizePolicy || policy.sizePolicy) === 'desktop-then-mobile' ? 'locked' : 'not_applicable',
        declaredSizeText: 'declaredSizeText' in params.item ? params.item.declaredSizeText : undefined,
        desktopAspectRatio: (aPlusEffectivePolicy?.effectiveSizePolicy || policy.sizePolicy) === 'desktop-then-mobile' ? resolvedNodeAspectRatio : undefined,
        mobileAspectRatio: (aPlusEffectivePolicy?.mobileAspectRatio || policy.mobileAspectRatio) as AspectRatio | undefined,
        needsReview: params.item.needsReview,
        reviewWarnings: params.item.reviewWarnings,
        seriesTemplate: params.analysis.seriesTemplate,
        editableTask: renderTask.taskState,
        displayLabel: renderTask.displayLabel,
      },
    };
  }, [buildCurrentEcommerceUploadReferences, buildRuntimeEcommerceAssetRoles, config.model, config.prompt, createEphemeralId, createReferenceImageFromAsset, ecommerceState.sheetSettings, ecommerceState.taskStates, extractEcommerceManualReferenceBindings]);

  const handleConfirmEcommerceAnalysis = useCallback(async () => {
    if (!ecommerceState.analysis || ecommerceState.isConfirmingAnalysis) return;
    setEcommerceState((previousState) => ({
      ...previousState,
      isConfirmingAnalysis: true,
    }));

    try {
      const analysis = ecommerceState.analysis;
      if (!analysis) {
        return;
      }

      const currentUploadReferences = await buildCurrentEcommerceUploadReferences();
      const basePosition = findNextGroupPosition();
      const createdNodeIds: string[] = [];
      const taskNodeIds: string[] = [];
      const layoutPlan = buildEcommerceCanvasGroupLayout({
        basePosition,
        mainSlotKeys: analysis.mainImageItems.map((item) => item.itemId),
        aPlusSlotKeys: analysis.aPlusGroup.modules.map((item) => item.moduleId),
      });
      const mainSlotPositionByKey = new Map(
        layoutPlan.mainGroup.slots.map((slot) => [slot.sourceKey, slot.position] as const),
      );
      const aPlusSlotPositionByKey = new Map(
        layoutPlan.aPlusGroup.slots.map((slot) => [slot.sourceKey, slot.position] as const),
      );
      const initialGroupSlots = {
        '主图': buildInitialEcommerceGroupSlotState({
          groupKey: 'main',
          slots: layoutPlan.mainGroup.slots.map((slot) => ({
            slotId: slot.slotId,
            sourceKey: slot.sourceKey,
          })),
          selectedItems: ecommerceState.selectedItems,
        }),
        'A+': buildInitialEcommerceGroupSlotState({
          groupKey: 'aplus',
          slots: layoutPlan.aPlusGroup.slots.map((slot) => ({
            slotId: slot.slotId,
            sourceKey: slot.sourceKey,
            deliveryKinds: (ecommerceState.taskStates[slot.sourceKey]?.effectiveSizePolicy
              || analysis.aPlusGroup.modules.find((item) => item.moduleId === slot.sourceKey)?.sizePolicy) === 'desktop-then-mobile'
              ? ['desktop', 'mobile']
              : ['default'],
          })),
          selectedItems: ecommerceState.selectedItems,
        }),
      };

      const frameworkNode = buildEcommerceFrameworkNode(analysis, {
        x: basePosition.x + 260,
        y: basePosition.y - 260,
      });
      await addPromptNode(frameworkNode);
      createdNodeIds.push(frameworkNode.id);

      const mainGroupNode = buildEcommerceGroupNode(
        analysis.projectMeta.productName,
        '主图',
        layoutPlan.mainGroup.position,
        frameworkNode.id,
      );
      await addPromptNode(mainGroupNode);
      createdNodeIds.push(mainGroupNode.id);

      const aPlusGroupNode = buildEcommerceGroupNode(
        analysis.projectMeta.productName,
        'A+',
        layoutPlan.aPlusGroup.position,
        frameworkNode.id,
      );
      await addPromptNode(aPlusGroupNode);
      createdNodeIds.push(aPlusGroupNode.id);

      for (let index = 0; index < analysis.mainImageItems.length; index += 1) {
        const item = analysis.mainImageItems[index];
        const node = await buildEcommercePromptNode({
          item,
          kind: 'main-image',
          position: mainSlotPositionByKey.get(item.itemId) || {
            x: layoutPlan.mainGroup.position.x,
            y: layoutPlan.mainGroup.position.y + 180 + index * 220,
          },
          groupId: mainGroupNode.id,
          frameworkId: frameworkNode.id,
          selected: ecommerceState.selectedItems[item.itemId] !== false,
          analysis,
          uploadReferences: currentUploadReferences,
        });
        await addPromptNode(node);
        createdNodeIds.push(node.id);
        taskNodeIds.push(node.id);
      }

      for (let index = 0; index < analysis.aPlusGroup.modules.length; index += 1) {
        const item = analysis.aPlusGroup.modules[index];
        const node = await buildEcommercePromptNode({
          item,
          kind: 'a-plus-module',
          groupId: aPlusGroupNode.id,
          frameworkId: frameworkNode.id,
          position: aPlusSlotPositionByKey.get(item.moduleId) || {
            x: layoutPlan.aPlusGroup.position.x,
            y: layoutPlan.aPlusGroup.position.y + 180 + index * 220,
          },
          selected: ecommerceState.selectedItems[item.moduleId] !== false,
          analysis,
          uploadReferences: currentUploadReferences,
        });
        await addPromptNode(node);
        createdNodeIds.push(node.id);
        taskNodeIds.push(node.id);
      }

      const frameworkSchedulerConfig = frameworkNode.ecommerce?.frameworkMeta?.schedulerConfig;
      if (frameworkNode.ecommerce) {
        await updatePromptNode({
          ...frameworkNode,
          ecommerce: {
            ...frameworkNode.ecommerce,
            frameworkMeta: {
              activeSheet: '主图',
              groupIds: {
                '主图': mainGroupNode.id,
                'A+': aPlusGroupNode.id,
              },
              taskNodeIds,
              schedulerConfig: frameworkSchedulerConfig,
            },
          },
        });
      }

      const initialFrameworkRuntime = createEcommerceFrameworkRuntimeState({
        frameworkId: frameworkNode.id,
        activeSheet: '主图',
        config: frameworkSchedulerConfig,
      });

      bringNodesToFront(createdNodeIds);
      setEcommerceState((previousState) => ({
        ...previousState,
        analysisConfirmed: true,
        groupSlots: initialGroupSlots,
        activeTaskNodeId: null,
        activeTaskState: null,
        activeFrameworkId: frameworkNode.id,
        activeGroupSheet: '主图',
        frameworkRuntime: {
          ...previousState.frameworkRuntime,
          [frameworkNode.id]: initialFrameworkRuntime,
        },
      }));
      setConfig((previousConfig) => ({
        ...previousConfig,
        prompt: '',
        referenceImages: [],
      }));
      import('./services/system/notificationService').then(({ notify }) => {
        notify.success('Build complete', 'Created ' + createdNodeIds.length + ' ecommerce cards.');
      });
    } catch (error: any) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.error('Build failed', error?.message || 'Please try again later.');
      });
    } finally {
      setEcommerceState((previousState) => ({
        ...previousState,
        isConfirmingAnalysis: false,
      }));
    }
  }, [addPromptNode, bringNodesToFront, buildCurrentEcommerceUploadReferences, buildEcommerceFrameworkNode, buildEcommerceGroupNode, buildEcommercePromptNode, ecommerceState.analysis, ecommerceState.isConfirmingAnalysis, ecommerceState.selectedItems, ecommerceState.taskStates, findNextGroupPosition, updatePromptNode]);

  const handleActivateEcommerceGroupSheet = useCallback((sheet: '主图' | 'A+') => {
    setEcommerceState((previousState) => ({
      ...previousState,
      activeTaskNodeId: null,
      activeTaskState: null,
      activeGroupSheet: sheet,
    }));

    if (ecommerceState.activeFrameworkId) {
      syncEcommerceFrameworkView(ecommerceState.activeFrameworkId, sheet);
    }
  }, [ecommerceState.activeFrameworkId, syncEcommerceFrameworkView]);

  useEffect(() => {
    return () => {
    };
  }, []);

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
      setCanvasInteractionPhase('node-drag');
      return;
    }

    // Keep connector rendering in live mode for one more frame so the
    // final drag delta can commit before we fall back to the throttled snapshot.
    nodeDragReleaseFrameRef.current = requestAnimationFrame(() => {
      nodeDragReleaseFrameRef.current = null;
      setIsNodeDragActive(false);
      setCanvasInteractionPhase((prev) => (prev === 'node-drag' ? 'idle' : prev));
    });
  }, []);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Clean Fly-to Navigation Logic
  const handleNavigateToNode = useCallback((targetX: number, targetY: number, id?: string) => {
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;

    // Calculate new position to center the target
    // We want: targetX * scale + transformX = screenCenterX
    // So: transformX = screenCenterX - targetX * scale

    // User requested "Zoom and Pan" (平移并缩放).
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
            ...buildCancelledPromptNodePatch(node.model)
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
            ...buildCancelledPromptNodePatch(node.model)
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
    const fallbackOrder = getPromptPptImageNodes(canvas.imageNodes, promptNode.id).map((img) => img.id);
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
    const fallbackImages = getPromptPptImageNodes(canvas.imageNodes, promptNode.id);

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

  const requirePptEditableExportBundle = useCallback((node: PromptNode) => {
    const exportBundle = getPptEditableExportBundle(node);
    if (!exportBundle) {
      showNoPptPagesWarning();
      return null;
    }

    return exportBundle;
  }, [getPptEditableExportBundle, showNoPptPagesWarning]);

  const sanitizePptFileSegment = useCallback((value: string, fallback: string) => {
    const normalized = String(value || '')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    return normalized || fallback;
  }, []);

  const resolvePptImageBlob = useCallback(async (image: GeneratedImage): Promise<{ blob: Blob; isOriginal: boolean }> => {
    const { getStrictOriginalImage } = await import('./services/storage/imageStorage');

    let isOriginal = true;
    let source = await getStrictOriginalImage(image.id);
    if (!source && image.storageId && image.storageId !== image.id) {
      source = await getStrictOriginalImage(image.storageId);
    }
    if (!source) {
      source = image.originalUrl || image.url;
      isOriginal = false;
    }
    if (!source) {
      throw new Error('未找到可用的图片源');
    }

    let blob: Blob;
    if (source.startsWith('data:')) {
      blob = base64ToBlob(source);
    } else if (source.startsWith('blob:')) {
      const response = await fetch(source);
      if (!response.ok) throw new Error('无法读取本地图片数据');
      blob = await response.blob();
    } else {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`下载图片失败：HTTP ${response.status}`);
      }
      blob = await response.blob();
    }
    return { blob, isOriginal };
  }, []);

  const sanitizeEcommerceExportName = useCallback((value: string, fallback: string) => {
    const normalized = String(value || '')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .trim();
    return normalized || fallback;
  }, []);

  const resolveLatestEcommerceSlotImage = useCallback((node: PromptNode, deliveryKind?: 'default' | 'desktop' | 'mobile') => {
    const canvas = activeCanvasRef.current;
    const taskId = node.ecommerce?.editableTask?.taskId;
    if (!canvas || !node.ecommerce) {
      return null;
    }

    const candidatePromptIds = new Set<string>([node.id]);
    if (taskId) {
      canvas.promptNodes.forEach((promptNode) => {
        if (promptNode.partialRedraw?.inheritedTaskState?.taskId === taskId) {
          candidatePromptIds.add(promptNode.id);
        }
      });
    }

    const latestImage = canvas.imageNodes
      .filter((imageNode) => {
        if (!imageNode.parentPromptId || !candidatePromptIds.has(imageNode.parentPromptId)) {
          return false;
        }

        if (!deliveryKind) {
          return true;
        }

        if (deliveryKind === 'default') {
          return !imageNode.ecommerceDeliveryKind || imageNode.ecommerceDeliveryKind === 'default';
        }

        return imageNode.ecommerceDeliveryKind === deliveryKind;
      })
      .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))[0];

    if (!latestImage) {
      return null;
    }

    return {
      image: latestImage,
      latestSource: latestImage.parentPromptId === node.id ? 'generated' as const : 'redraw' as const,
    };
  }, []);

  useEffect(() => {
    if (!ecommerceState.analysisConfirmed) {
      return;
    }

    setEcommerceState((previousState) => {
      const nextGroupSlots: Record<EcommerceGroupSheet, EcommerceGroupSlotState[]> = {
        '主图': previousState.groupSlots['主图'].map((slot) => ({
          ...slot,
          selected: previousState.selectedItems[slot.sourceKey] !== false,
        })),
        'A+': previousState.groupSlots['A+'].map((slot) => ({
          ...slot,
          selected: previousState.selectedItems[slot.sourceKey] !== false,
        })),
      };

      (activeCanvas?.promptNodes || []).forEach((promptNode) => {
        if (!promptNode.ecommerce || promptNode.ecommerce.kind === 'a-plus-group') {
          return;
        }

        const sheet = promptNode.ecommerce.sourceSheet;
        const slot = nextGroupSlots[sheet].find((entry) => entry.sourceKey === promptNode.ecommerce?.sourceRowKey);
        if (!slot) {
          return;
        }

        const latest = resolveLatestEcommerceSlotImage(promptNode);
        if (!latest) {
          return;
        }

        nextGroupSlots[sheet] = applyEcommerceSlotResult(nextGroupSlots[sheet], {
          slotId: slot.slotId,
          imageId: latest.image.id,
          source: latest.latestSource,
        });

        slot.deliveries.forEach((delivery) => {
          const latestForDelivery = resolveLatestEcommerceSlotImage(promptNode, delivery.deliveryKind);
          if (!latestForDelivery) {
            return;
          }

          nextGroupSlots[sheet] = applyEcommerceSlotResult(nextGroupSlots[sheet], {
            slotId: slot.slotId,
            deliveryKind: delivery.deliveryKind,
            imageId: latestForDelivery.image.id,
            source: latestForDelivery.latestSource,
          });
        });
      });

      const previousSignature = JSON.stringify(previousState.groupSlots);
      const nextSignature = JSON.stringify(nextGroupSlots);
      if (previousSignature === nextSignature) {
        return previousState;
      }

      return {
        ...previousState,
        groupSlots: nextGroupSlots,
      };
    });
  }, [activeCanvas, ecommerceState.analysisConfirmed, ecommerceState.selectedItems, resolveLatestEcommerceSlotImage]);

  const handleExportEcommerceGroup = useCallback(async (groupNode: PromptNode) => {
    if (!groupNode.ecommerce || groupNode.ecommerce.kind !== 'a-plus-group') {
      return;
    }

    const canvas = activeCanvasRef.current;
    if (!canvas) {
      return;
    }

    const moduleNodes = canvas.promptNodes.filter((promptNode) => (
      !!promptNode.ecommerce
      && promptNode.ecommerce.kind !== 'a-plus-group'
      && promptNode.ecommerce.groupId === groupNode.id
    ));
    const slotStateBySourceKey = new Map(
      ecommerceState.groupSlots[groupNode.ecommerce.sourceSheet].map((slot) => [slot.sourceKey, slot] as const),
    );

    const packageType = groupNode.ecommerce.sourceSheet === '主图' ? 'main-image-group' : 'a-plus-group';
    const packageLabel = groupNode.ecommerce.sourceSheet === '主图' ? '主图包' : 'A+包';
    const zip = new JSZip();
    const exportables: Array<{ fileName: string; image: GeneratedImage }> = [];

    const manifest = buildEcommerceGroupExportManifest({
      packageType,
      groupId: groupNode.id,
      groupLabel: groupNode.ecommerce.sourceSheet,
      sourcePromptId: groupNode.id,
      slots: moduleNodes.map((promptNode, index) => {
        const latest = resolveLatestEcommerceSlotImage(promptNode);
        const slotLabel = promptNode.ecommerce?.displayLabel || promptNode.ecommerce?.sourceRowKey || `${groupNode.ecommerce?.sourceSheet} 模块`;
        const slotState = promptNode.ecommerce
          ? slotStateBySourceKey.get(promptNode.ecommerce.sourceRowKey)
          : undefined;
        const slotId = slotState?.slotId || `${groupNode.id}-slot-${index + 1}`;
        const isSelected = slotState?.selected ?? (promptNode.ecommerce?.selectedForGeneration !== false);
        if (!promptNode.ecommerce || !isSelected) {
          return {
            slotId,
            slotLabel,
            selectedForGeneration: false,
          };
        }

        if ((promptNode.ecommerce.effectiveSizePolicy || promptNode.ecommerce.sizePolicy) === 'desktop-then-mobile') {
          const deliverables = (['desktop', 'mobile'] as const).map((deliveryKind) => {
            const latestForDelivery = resolveLatestEcommerceSlotImage(promptNode, deliveryKind);
            if (!latestForDelivery) {
              return { deliveryKind };
            }

            const extension = latestForDelivery.image.mimeType?.includes('jpeg') || latestForDelivery.image.mimeType?.includes('jpg')
              ? 'jpg'
              : latestForDelivery.image.mimeType?.includes('webp')
                ? 'webp'
                : 'png';
            const fileName = `${String(index + 1).padStart(2, '0')}-${sanitizeEcommerceExportName(slotLabel, `slot-${index + 1}`)}-${deliveryKind}.${extension}`;
            exportables.push({ fileName, image: latestForDelivery.image });

            return {
              deliveryKind,
              latestImageId: latestForDelivery.image.id,
              latestSource: latestForDelivery.latestSource,
              fileName,
            };
          });

          if (!deliverables.some((deliverable) => 'latestImageId' in deliverable)) {
            return {
              slotId,
              slotLabel,
              selectedForGeneration: true,
            };
          }

          return {
            slotId,
            slotLabel,
            selectedForGeneration: true,
            deliverables,
          };
        }

        if (!latest) {
          return {
            slotId,
            slotLabel,
            selectedForGeneration: true,
          };
        }

        const extension = latest.image.mimeType?.includes('jpeg') || latest.image.mimeType?.includes('jpg')
          ? 'jpg'
          : latest.image.mimeType?.includes('webp')
            ? 'webp'
            : 'png';
        const fileName = `${String(index + 1).padStart(2, '0')}-${sanitizeEcommerceExportName(slotLabel, `slot-${index + 1}`)}.${extension}`;
        exportables.push({ fileName, image: latest.image });

        return {
          slotId,
          slotLabel,
          selectedForGeneration: true,
          latestImageId: latest.image.id,
          latestSource: latest.latestSource,
          fileName,
        };
      }),
    });

    if (exportables.length === 0) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.warning('无可导出图片', `${packageLabel}当前没有已生成的图片可打包。`);
      });
      return;
    }

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const fallbackQualityFiles: string[] = [];
    for (const exportItem of exportables) {
      const { blob, isOriginal } = await resolvePptImageBlob(exportItem.image);
      if (!isOriginal) fallbackQualityFiles.push(exportItem.fileName);
      zip.file(exportItem.fileName, blob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${sanitizeEcommerceExportName(packageLabel, packageLabel)}-${Date.now()}.zip`);
    import('./services/system/notificationService').then(({ notify }) => {
      if (fallbackQualityFiles.length > 0) {
        notify.warning('部分图片非原始质量', `${fallbackQualityFiles.length} 张图片使用了回退源：${fallbackQualityFiles.slice(0, 3).join('、')}${fallbackQualityFiles.length > 3 ? '…' : ''}`);
      }
      notify.success('导出完成', `${packageLabel}已导出，共 ${exportables.length} 张图片。`);
    });
  }, [ecommerceState.groupSlots, resolveLatestEcommerceSlotImage, resolvePptImageBlob, sanitizeEcommerceExportName]);

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
    const { blob } = await resolvePptImageBlob(image);
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
        const sourceBlob = sourceImage ? (await resolvePptImageBlob(sourceImage)).blob : null;
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
      const { blob } = await resolvePptImageBlob(image);
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
    if (config.mode === GenerationMode.ECOMMERCE) {
      if (!ecommerceState.analysis) {
        await handleAnalyzeEcommerceRequirement();
        return;
      }
      await handleConfirmEcommerceAnalysis();
      return;
    }
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
    const customLocal = (() => {
      try {
        return JSON.parse(localStorage.getItem('kk_model_customizations') || '{}')[config.model] || {};
      } catch { return {}; }
    })();

    const preferredKeyIdForBilling = hasExplicitModelRoute(config.model)
      ? undefined
      : getPreferredKeyForMode(config.mode);
    const selectedKeyForBilling = keyManager.getNextKey(config.model, preferredKeyIdForBilling);
    const generationBillingState = resolveGenerationBillingState({
      modelId: config.model,
      imageSize: config.imageSize,
      mode: config.mode,
      parallelCount: config.parallelCount,
      customAlias: customLocal.alias,
      preferredKeyId: selectedKeyForBilling?.id || preferredKeyIdForBilling,
      resolveCreditCostForModel,
    });

    console.log('[handleGenerate] 计费检查', {
      model: config.model,
      provider: generationBillingState.resolvedProvider,
      selectedKeyId: selectedKeyForBilling?.id,
      hasCustomUserKey: generationBillingState.hasCustomUserKey,
      isCreditModel: generationBillingState.isCreditModel,
      mode: config.mode
    });

    const isFollowUp = !!activeSourceImage;
    const existingPromptDraftId = String(draftNodeId || '').trim();
    const existingPromptDraft = existingPromptDraftId
      ? activeCanvasRef.current?.promptNodes.find((node) => node.id === existingPromptDraftId)
      : null;
    const hasReusablePromptDraft = Boolean(isFollowUp && existingPromptDraft);
    let promptNodeId = hasReusablePromptDraft
      ? existingPromptDraftId
      : `node_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

    let requiredCredits = generationBillingState.requiredCredits;
    let perImageCreditCost = generationBillingState.perImageCreditCost;
    let paymentTransactionId: string | undefined = undefined;
    const resolvedCreditRoute = generationBillingState.isCreditModel
      ? adminModelService.getCreditRouteSnapshot(config.model, config.imageSize)
      : null;
    const resolvedCreditSpecId = resolvedCreditRoute?.specId;
    const billingAttempt = buildGenerationBillingAttempt({
      nodeId: promptNodeId,
      phase: 'initial',
    });
    const executionLane = generationBillingState.executionLane;
    const useServerSideCreditSettlement = generationBillingState.useServerSideCreditSettlement;
    if (generationBillingState.isCreditModel) {
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
        const chargeAttempt = await ensureCreditAttemptCharged({
          modelId: config.model,
          modelLabel: config.model,
          providerId: generationBillingState.resolvedProvider || selectedKeyForBilling?.id || 'managed',
          provider: generationBillingState.resolvedProvider,
          requiredCredits,
          useServerSideCreditSettlement,
          billingAttempt,
        });

        if (!chargeAttempt.success) {
          return;
        }

        paymentTransactionId = chargeAttempt.transactionId;
      }
    }
    // setIsGenerating(true); // Removed, handled by hook
    try {

      // 4. Calculate Position
      // Normal mode uses the current viewport center; follow-up mode keeps the existing linked placement flow.
      const placement = resolveGenerationPlacement({
        isFollowUp,
        promptNodeId,
        hasReusablePromptDraft,
      });
      promptNodeId = placement.promptNodeId;
      let currentPos = placement.currentPos;

      // setDraftNodeId(null); // Moved to end to prevent flicker

      // 立即创建卡片，参考图异步加载。
      const finalReferenceImages = prepareGenerationReferenceImages(config.referenceImages);

      const isNewAnim = true; // Always set for standard generation

      const rawPrompt = trimmedPrompt;
      const {
        optimizedPromptEn,
        optimizedPromptZh,
        promptOptimizerResult,
      } = await optimizeGenerationPrompt({
        enabled: (config.mode === GenerationMode.IMAGE || config.mode === GenerationMode.PPT)
          && config.enablePromptOptimization
          && !!rawPrompt,
        rawPrompt,
        referenceImages: finalReferenceImages,
        options: {
          preferredModelId: config.model,
          aspectRatio: config.aspectRatio,
          imageSize: config.imageSize,
          mode: config.mode,
          supportsThinking: !!getModelCapabilities(config.model)?.supportsThinking,
          thinkingMode: config.thinkingMode || 'minimal',
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : String(error || '');
          console.warn('[handleGenerate] Prompt optimization failed, fallback to raw prompt:', error);
          import('./services/system/notificationService').then(({ notify }) => {
            notify.error('Prompt optimization failed', 'Fell back to the original prompt: ' + message);
          });
        },
      });

      const generationPreviewState = resolveGenerationPreviewState({
        config,
        rawPrompt,
        selectedKeyForBilling,
        useServerSideCreditSettlement,
      });

      const generatingNode = buildGeneratingPromptNode({
        promptNodeId,
        prompt: rawPrompt,
        optimizedPromptEn,
        optimizedPromptZh,
        promptOptimizerResult,
        promptOptimizationEnabled: !!(config.enablePromptOptimization && (optimizedPromptEn || promptOptimizerResult)),
        position: currentPos,
        config,
        previewModelLabel: generationPreviewState.previewModelLabel,
        previewModelMeta: generationPreviewState.previewColorMeta,
        previewProvider: generationPreviewState.previewProvider,
        previewProviderLabel: generationPreviewState.previewProviderLabel,
        keySlotId: generationPreviewState.keySlotId,
        referenceImages: finalReferenceImages,
        creditSettlement: useServerSideCreditSettlement ? 'server' : 'client',
        executionLane,
        billingAttemptId: billingAttempt.attemptId,
        creditRouteSpecId: resolvedCreditSpecId,
        creditRouteUnitId: resolvedCreditRoute?.routeUnitId,
        paymentTransactionId,
        isNew: isNewAnim,
        parallelCount: generationPreviewState.parallelCount,
        sourceImageId: activeSourceImage || undefined,
        pptSlides: generationPreviewState.pptSlides,
        cost: requiredCredits,
        billingMode: generationBillingState.isCreditModel ? 'credits' : 'currency',
        creditCost: generationBillingState.isCreditModel ? perImageCreditCost : undefined,
        isPaymentProcessed: requiredCredits > 0 && !useServerSideCreditSettlement,
      });

      const persistedGeneratingNode = await persistGeneratingPromptNode({
        generatingNode,
        getCanvas: () => activeCanvasRef.current,
        updatePromptNode,
        addPromptNode,
        updateImageNodePosition,
        deletePromptNode,
      });

      setDraftNodeId(null); // Detach status NOW that the node is updated in canvas
      setConfig(prev => ({ ...prev, prompt: '', referenceImages: [] }));
      setActiveSourceImage(null);

      // Execute immediately after save completed
      applyOptimisticServerCreditDebit(requiredCredits, useServerSideCreditSettlement);
      await executeGeneration(persistedGeneratingNode);
    } catch (e: any) {
      console.error('[handleGenerate] failed:', e);
      import('./services/system/notificationService').then(({ notify }) => {
        notify.error('发送失败', e?.message || '请重试');
      });
    } finally {
      // executeGeneration manages isGenerating internally; avoid resetting it here.
      // Request throttling is controlled by lastGenerateAtRef instead of waiting for the full run to settle.
    }
  }, [config, draftNodeId, addPromptNode, updatePromptNode, updateImageNodePosition, activeSourceImage, executeGeneration, normalizePptSlidesForCount, getPreferredKeyForMode, consumeCreditsDetailed, balance, setShowRechargeModal, user, isTempUser, authLoading, billingLoading, applyOptimisticServerCreditDebit, resolveCreditCostForModel, hasExplicitModelRoute, resolveGenerationPlacement, prepareGenerationReferenceImages, deletePromptNode]);

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

  // Auto arrange is delegated to CanvasContext.
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
    let executionNode = buildRetryExecutionNode({
      node,
      resolveNodeRouteState,
    });

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
    const preparedRetry = await prepareRetriedExecutionNode({
      executionNode,
      nodeId: currentNodeId,
      parallelCount: count,
      phase: 'retry',
      resolveCreditCostForModel,
      ensureCreditAttemptCharged,
    });

    if (!preparedRetry) {
      return;
    }

    const { billingAttempt: retryBillingAttempt, billingState: retryBillingState } = preparedRetry;
    executionNode = preparedRetry.executionNode;

    // 1. Reset state to generating
    updatePromptNode({
      ...executionNode,
      modelLabel: resolveModelDisplayName(executionNode.model, executionNode.modelLabel || executionNode.model),
      isGenerating: true,
      error: undefined,
      errorDetails: undefined,
      isDraft: false, // 🎯 [Fix] Ensure visibility
      timestamp: Date.now() // Reset timer
    });
    applyOptimisticServerCreditDebit(
      retryBillingState.requiredCredits,
      retryBillingState.useServerSideCreditSettlement,
    );

    const startTime = Date.now();

    try {
      const results = await Promise.all(Array.from({ length: count }).map(async (_, index) => {
        const requestId = buildGenerationAttemptRequestId(
          executionNode.billingAttemptId || currentNodeId,
          index,
        );

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
            if (typeof result.balanceAfter === 'number') {
              applyAuthoritativeBalance(result.balanceAfter);
            }
          }

          isFinished = true;
          clearTimeout(timer);

          // Upload (non-blocking for latency)
          let url = b64;
          let originalUrl = '';
          let apiResultUrl: string | undefined = undefined;

          if (currentMode === GenerationMode.IMAGE || currentMode === GenerationMode.PPT || currentMode === GenerationMode.ECOMMERCE) {
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

          if (currentMode === GenerationMode.IMAGE || currentMode === GenerationMode.PPT || currentMode === GenerationMode.ECOMMERCE) {
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
          ...buildCompletedPromptNodePatch(),
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
  }, [config.parallelCount, isMobile, updatePromptNode, addImageNodes, config.enableGrounding, extractErrorDetails, normalizePptSlidesForCount, buildAutoPptSlides, resolveNodeRouteState, recoverFailedSyncBridgeGeneration, ensureCreditAttemptCharged, applyOptimisticServerCreditDebit, resolveCreditCostForModel, resolveFailedCreditAttempt]);

  const handleExportPptPackage = useCallback(async (node: PromptNode) => {
    if (!activeCanvas) return;
    const childImages = getPromptPptImageNodes(activeCanvas.imageNodes, node.id);

    if (childImages.length === 0) {
      showNoPptPagesWarning();
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

    const slidesHtml = buildPptSlidesPreviewHtml({
      title: node.prompt || 'PPT 导出',
      items: pagesMeta.map((pageMeta) => ({
        page: pageMeta.page,
        title: String(pageMeta.title || ''),
        imageSrc: `../${String(pageMeta.file || '')}`,
        description: String(pageMeta.prompt || ''),
      })),
    });
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
  }, [activeCanvas, parsePptOutlineLine, showNoPptPagesWarning]);

  const handleRetryPptSinglePage = useCallback(async (node: PromptNode, pageIndex: number) => {
    if (!activeCanvas) return;
    if (node.mode !== GenerationMode.PPT) return;
    let executionNode = buildRetryExecutionNode({
      node,
      resolveNodeRouteState,
    });

    const ordered = getPromptPptImageNodes(activeCanvas.imageNodes, node.id);

    const target = ordered[pageIndex];
    if (!target) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.warning('页面不存在', `未找到图 ${pageIndex + 1}`);
      });
      return;
    }

    const preparedPageRetry = await prepareRetriedExecutionNode({
      executionNode,
      nodeId: node.id,
      parallelCount: 1,
      phase: 'ppt-single',
      pageIndex,
      resolveCreditCostForModel,
      ensureCreditAttemptCharged,
    });

    if (!preparedPageRetry) {
      return;
    }

    const { billingAttempt: pageRetryBillingAttempt, billingState: pageRetryBillingState } = preparedPageRetry;
    executionNode = preparedPageRetry.executionNode;

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

    applyOptimisticServerCreditDebit(
      pageRetryBillingState.requiredCredits,
      pageRetryBillingState.useServerSideCreditSettlement,
    );

    const startTime = Date.now();
    try {
      const result = await generateImage(
        taskPrompt,
        executionNode.aspectRatio,
        executionNode.imageSize,
        executionNode.referenceImages || [],
        executionNode.model,
        '',
        buildGenerationAttemptRequestId(pageRetryBillingAttempt.attemptId, 0),
        !!executionNode.enableGrounding || !!executionNode.enableImageSearch,
        {
          preferredKeyId: executionNode.keySlotId,
          enableWebSearch: !!executionNode.enableGrounding,
          enableImageSearch: !!executionNode.enableImageSearch,
          thinkingMode: executionNode.thinkingMode || 'minimal'
        }
      );

      if (typeof result.balanceAfter === 'number') {
        applyAuthoritativeBalance(result.balanceAfter);
      }

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

      const refreshedPageImage: GeneratedImage = {
        ...target,
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
      };
      updateImageNode(target.id, refreshedPageImage);

      rememberPreferredKeyForMode(executionNode.mode, result.keySlotId || executionNode.keySlotId);
      const refreshedDeckImages = ordered.map((imageNode, index) => (
        index === pageIndex ? refreshedPageImage : imageNode
      ));
      updatePromptNode({
        ...executionNode,
        ...buildCompletedPromptNodePatch(),
        childImageIds: node.childImageIds,
        pptDeck: buildPptDeckModuleState({
          ...executionNode,
          ...buildCompletedPromptNodePatch(),
          childImageIds: node.childImageIds,
          pptDeck: node.pptDeck,
        }, refreshedDeckImages),
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
  }, [activeCanvas, updateImageNode, rememberPreferredKeyForMode, normalizePptSlidesForCount, resolveNodeRouteState, resolveProviderDisplay, ensureCreditAttemptCharged, applyOptimisticServerCreditDebit, resolveCreditCostForModel, updatePromptNode, resolveFailedCreditAttempt]);

  const updateEcommerceNodeState = useCallback((nodeId: string, patch: Partial<NonNullable<PromptNode['ecommerce']>>, nodePatch: Partial<PromptNode> = {}) => {
    const latestNode = activeCanvasRef.current?.promptNodes.find((node) => node.id === nodeId);
    if (!latestNode?.ecommerce) return;
    updatePromptNode({
      ...latestNode,
      ...nodePatch,
      ecommerce: {
        ...latestNode.ecommerce,
        ...patch,
      },
    });
  }, [updatePromptNode]);

  const syncActiveEcommerceTask = useCallback((nodeId: string, taskState: EcommerceEditableTaskState) => {
    setEcommerceState((previousState) => {
      if (previousState.activeTaskNodeId !== nodeId) {
        return previousState;
      }

      return {
        ...previousState,
        activeTaskState: taskState,
      };
    });
  }, []);

  const runEcommerceNodeGeneration = useCallback(async (
    node: PromptNode,
    options?: {
      aspectRatio?: AspectRatio;
      imageSize?: ImageSize;
      generationTarget?: 'sheet' | 'desktop' | 'mobile';
      promptSuffix?: string;
      stagePatch?: Partial<NonNullable<PromptNode['ecommerce']>>;
      successPatch?: Partial<NonNullable<PromptNode['ecommerce']>>;
      failurePatch?: Partial<NonNullable<PromptNode['ecommerce']>>;
    },
  ) => {
    const latestNode = activeCanvasRef.current?.promptNodes.find((item) => item.id === node.id) || node;
    if (!latestNode.ecommerce) return;

    const nextGenerationSettings = resolveEcommerceNodeGenerationSettings(latestNode, options?.generationTarget);
    const nextAspectRatio = options?.aspectRatio || nextGenerationSettings.aspectRatio;
    const nextImageSize = options?.imageSize || nextGenerationSettings.imageSize;
    const activeDraft = ecommerceState.activeTaskNodeId === node.id
      ? ecommerceState.activeTaskState
      : null;
    const baseTaskState = activeDraft || latestNode.ecommerce.editableTask;
    const seriesTemplate = latestNode.ecommerce.seriesTemplate;
    const mergedTaskState = (baseTaskState && seriesTemplate)
      ? applyEffectiveSizingToTaskState(mergeEcommerceTaskState({
          baseTask: {
            ...baseTaskState,
            assetRoles: baseTaskState.assetRoles,
          },
          seriesTemplate,
          sparseIntent: ecommerceState.activeTaskNodeId === node.id
            ? (String(config.prompt || '').trim() || baseTaskState.sparseUserIntent || '')
            : (baseTaskState.sparseUserIntent || ''),
          productName: latestNode.ecommerce.productImageRef?.label || latestNode.ecommerce.theme || '',
        }))
      : null;
    const renderTask = mergedTaskState && seriesTemplate
      ? buildEcommerceRenderTask({
          taskState: mergedTaskState,
          seriesTemplate,
          aspectRatio: String(nextAspectRatio),
          imageSize: String(nextImageSize),
        })
      : null;
    const activeDeliveryKind = options?.generationTarget === 'mobile'
      ? 'mobile'
      : (latestNode.ecommerce.effectiveSizePolicy || latestNode.ecommerce.sizePolicy) === 'desktop-then-mobile'
        ? 'desktop'
        : 'default';
    let nextPrompt = [renderTask?.prompt || latestNode.originalPrompt || latestNode.prompt, options?.promptSuffix || ''].filter(Boolean).join('\n');
    const {
      optimizedPrompt: optimizedNextPrompt,
      optimizedPromptEn,
      optimizedPromptZh,
      promptOptimizerResult,
    } = await optimizeGenerationPrompt({
      enabled: config.enablePromptOptimization && !!nextPrompt,
      rawPrompt: nextPrompt,
      referenceImages: latestNode.referenceImages || [],
      options: {
        preferredModelId: latestNode.model,
        aspectRatio: String(nextAspectRatio),
        imageSize: String(nextImageSize),
        mode: GenerationMode.ECOMMERCE,
        supportsThinking: !!getModelCapabilities(latestNode.model)?.supportsThinking,
        thinkingMode: resolveEffectiveEcommerceThinkingMode(),
        ecommerceContext: renderTask && seriesTemplate ? {
          taskState: renderTask.taskState,
          seriesTemplate,
          assetRoles: renderTask.taskState.assetRoles,
          outputTarget: {
            label: renderTask.displayLabel,
            aspectRatio: String(nextAspectRatio),
            imageSize: String(nextImageSize),
          },
        } : undefined,
      },
      onError: (error) => {
        console.warn('[runEcommerceNodeGeneration] Prompt optimization failed, fallback to render task prompt.', error);
      },
    });
    nextPrompt = optimizedNextPrompt;

    const executionNode: PromptNode = {
      ...latestNode,
      prompt: nextPrompt,
      originalPrompt: renderTask?.prompt || latestNode.originalPrompt || latestNode.prompt,
      optimizedPromptEn,
      optimizedPromptZh,
      promptOptimizerResult,
      imageSize: nextImageSize,
      thinkingMode: resolveEffectiveEcommerceThinkingMode(),
      mode: GenerationMode.ECOMMERCE,
      aspectRatio: nextAspectRatio,
      ecommerce: {
        ...latestNode.ecommerce,
        editableTask: renderTask?.taskState || latestNode.ecommerce.editableTask,
        displayLabel: renderTask?.displayLabel || latestNode.ecommerce.displayLabel,
        currentAspectRatio: nextAspectRatio,
        activeDeliveryKind,
        stage: 'generating',
        ...options?.stagePatch,
      },
    };

    if (renderTask?.taskState) {
      syncActiveEcommerceTask(node.id, renderTask.taskState);
    }

    await handleRetryNode(executionNode);

    const finalizedNode = activeCanvasRef.current?.promptNodes.find((item) => item.id === node.id) || executionNode;
    const succeeded = !finalizedNode.error && (finalizedNode.childImageIds?.length || 0) > 0;
    updateEcommerceNodeState(node.id, succeeded ? {
      stage: 'generated',
      ...options?.successPatch,
    } : {
      stage: 'failed',
      ...options?.failurePatch,
    });
  }, [applyEffectiveSizingToTaskState, config.enablePromptOptimization, config.prompt, ecommerceState.activeTaskNodeId, ecommerceState.activeTaskState, handleRetryNode, resolveEcommerceNodeGenerationSettings, resolveEffectiveEcommerceThinkingMode, syncActiveEcommerceTask, updateEcommerceNodeState]);

  const handleToggleEcommerceSelected = useCallback((node: PromptNode, selected: boolean) => {
    if (!node.ecommerce) return;
    updateEcommerceNodeState(node.id, { selectedForGeneration: selected });
    setEcommerceState((previousState) => ({
      ...previousState,
      selectedItems: {
        ...previousState.selectedItems,
        [node.ecommerce?.sourceRowKey || node.id]: selected,
      },
      groupSlots: node.ecommerce?.sourceSheet
        ? {
            ...previousState.groupSlots,
            [node.ecommerce.sourceSheet]: previousState.groupSlots[node.ecommerce.sourceSheet].map((slot) => (
              slot.sourceKey === node.ecommerce?.sourceRowKey
                ? { ...slot, selected }
                : slot
            )),
          }
        : previousState.groupSlots,
    }));
  }, [updateEcommerceNodeState]);

  const handleSetEcommerceGroupSelection = useCallback((groupNode: PromptNode, selected: boolean) => {
    if (!groupNode.ecommerce || groupNode.ecommerce.kind !== 'a-plus-group') {
      return;
    }

    const childNodes = (activeCanvasRef.current?.promptNodes || []).filter((node) => (
      node.mode === GenerationMode.ECOMMERCE
      && node.ecommerce?.groupId === groupNode.id
      && node.ecommerce.kind !== 'a-plus-group'
    ));

    childNodes.forEach((node) => {
      updateEcommerceNodeState(node.id, { selectedForGeneration: selected });
    });

    const affectedSourceKeys = new Set(
      childNodes
        .map((node) => node.ecommerce?.sourceRowKey)
        .filter((sourceKey): sourceKey is string => Boolean(sourceKey)),
    );

    setEcommerceState((previousState) => ({
      ...previousState,
      selectedItems: {
        ...previousState.selectedItems,
        ...Object.fromEntries(Array.from(affectedSourceKeys).map((sourceKey) => [sourceKey, selected])),
      },
      groupSlots: {
        ...previousState.groupSlots,
        [groupNode.ecommerce!.sourceSheet]: previousState.groupSlots[groupNode.ecommerce!.sourceSheet].map((slot) => (
          affectedSourceKeys.has(slot.sourceKey)
            ? { ...slot, selected }
            : slot
        )),
      },
    }));
  }, [updateEcommerceNodeState]);

  const handleGenerateEcommerceNode = useCallback(async (node: PromptNode) => {
    if (!node.ecommerce) return;
    if (node.ecommerce.kind === 'main-image') {
      await runEcommerceNodeGeneration(node, {
        generationTarget: 'sheet',
      });
      return;
    }

    if (node.ecommerce.kind === 'a-plus-module') {
      const effectiveSizePolicy = node.ecommerce.effectiveSizePolicy || node.ecommerce.sizePolicy;
      const effectiveSizeTier = node.ecommerce.effectiveSizeTier || node.ecommerce.sizeTier;
      const isDesktopThenMobile = effectiveSizePolicy === 'desktop-then-mobile';
      const desktopPromptSuffix = effectiveSizeTier === '1464x600'
        ? '先生成 1464*600 桌面端母版，保留后续转 600*450 手机端的安全排版空间。'
        : effectiveSizeTier === '600x450'
          ? '先生成可收敛到 600*450 手机端成品的紧凑母版，保持主体与文案一致。'
          : '先生成桌面端 A+ 模块版本。';
      await runEcommerceNodeGeneration(node, {
        generationTarget: isDesktopThenMobile ? 'desktop' : 'sheet',
        ...(isDesktopThenMobile ? {} : {}),
        promptSuffix: isDesktopThenMobile ? '先生成桌面端 21:9 电商横幅版本。' : undefined,
        stagePatch: isDesktopThenMobile ? { desktopStage: 'generating' } : undefined,
        successPatch: isDesktopThenMobile ? { desktopStage: 'generated', mobileStage: 'locked' } : undefined,
        failurePatch: isDesktopThenMobile ? { desktopStage: 'failed' } : undefined,
        ...(isDesktopThenMobile ? { promptSuffix: desktopPromptSuffix } : {}),
      });
    }
  }, [runEcommerceNodeGeneration]);

  const handleConfirmEcommerceDesktop = useCallback((node: PromptNode) => {
    if (!node.ecommerce || node.ecommerce.kind !== 'a-plus-module' || node.ecommerce.desktopStage !== 'generated') return;
    updateEcommerceNodeState(node.id, {
      desktopStage: 'confirmed',
      mobileStage: 'pending',
      stage: 'ready',
    });
  }, [updateEcommerceNodeState]);

  const handleRetryEcommerceModule = useCallback(async (node: PromptNode) => {
    if (!node.ecommerce || node.ecommerce.kind !== 'a-plus-module' || node.ecommerce.desktopStage !== 'confirmed') return;
    await runEcommerceNodeGeneration(node, {
      generationTarget: 'mobile',


      stagePatch: { mobileStage: 'generating' },
      successPatch: { mobileStage: 'generated' },
      failurePatch: { mobileStage: 'failed' },
      ...({ promptSuffix: '将这个 A+ 画面转换成 600*450 手机端版本，排版更紧凑，保持主体、文案、风格与画面逻辑一致。' }),
    });
  }, [runEcommerceNodeGeneration]);

  const resolveEcommerceFrameworkQueuePhases = useCallback((
    node: PromptNode,
    phasePreference?: 'desktop' | 'mobile',
  ): EcommerceFrameworkQueueItem['phase'][] => {
    const ecommerce = node.ecommerce;
    if (!ecommerce || ecommerce.selectedForGeneration === false) {
      return [];
    }

    if (ecommerce.kind === 'main-image') {
      if (phasePreference === 'mobile') {
        return [];
      }

      return (ecommerce.stage === 'analysis_ready' || ecommerce.stage === 'ready' || ecommerce.stage === 'failed')
        ? ['sheet']
        : [];
    }

    if (ecommerce.kind !== 'a-plus-module') {
      return [];
    }

    const effectiveSizePolicy = ecommerce.effectiveSizePolicy || ecommerce.sizePolicy;
    const requiresMobileFollowUp = effectiveSizePolicy === 'desktop-then-mobile';

    if (phasePreference === 'mobile') {
      return ecommerce.desktopStage === 'confirmed'
        && (ecommerce.mobileStage === 'pending' || ecommerce.mobileStage === 'failed' || ecommerce.mobileStage === 'locked')
        ? ['mobile']
        : [];
    }

    if (phasePreference === 'desktop') {
      if (requiresMobileFollowUp) {
        return ecommerce.desktopStage === 'pending' || ecommerce.desktopStage === 'failed'
          ? ['desktop']
          : [];
      }

      return ecommerce.stage === 'analysis_ready' || ecommerce.stage === 'ready' || ecommerce.stage === 'failed'
        ? ['sheet']
        : [];
    }

    if (requiresMobileFollowUp) {
      if (ecommerce.desktopStage === 'confirmed' && (ecommerce.mobileStage === 'pending' || ecommerce.mobileStage === 'failed')) {
        return ['mobile'];
      }

      return ecommerce.desktopStage === 'pending' || ecommerce.desktopStage === 'failed'
        ? ['desktop']
        : [];
    }

    return (ecommerce.stage === 'analysis_ready' || ecommerce.stage === 'ready' || ecommerce.stage === 'failed')
      ? ['sheet']
      : [];
  }, []);

  const enqueueEcommerceFrameworkNodes = useCallback((
    frameworkId: string,
    nodes: PromptNode[],
    phasePreference?: 'desktop' | 'mobile',
  ): number => {
    const queueItems: Array<Pick<EcommerceFrameworkQueueItem, 'queueId' | 'nodeId' | 'phase' | 'laneKey' | 'laneType' | 'sourceSheet'>> = [];

    nodes.forEach((node) => {
      const ecommerce = node.ecommerce;
      if (!ecommerce) {
        return;
      }

      const phases = resolveEcommerceFrameworkQueuePhases(node, phasePreference);
      if (phases.length === 0) {
        return;
      }

      const resolvedKey = keyManager.getNextKey(node.model, node.keySlotId);
      const provider = resolvedKey?.provider || node.provider;
      const baseUrl = resolvedKey?.baseUrl || resolvedKey?.providerConfig?.baseUrl;
      const providerKeyType = resolveProviderKeyType(provider, baseUrl);
      const lane = resolveFrameworkLane({
        keySlotId: resolvedKey?.id || node.keySlotId || providerKeyType,
        provider,
        baseUrl,
      });

      phases.forEach((phase) => {
        queueItems.push({
          queueId: frameworkId + ':' + node.id + ':' + phase + ':' + Date.now() + ':' + queueItems.length,
          nodeId: node.id,
          phase,
          laneKey: lane.laneKey,
          laneType: lane.laneType,
          sourceSheet: ecommerce.sourceSheet,
        });
      });
    });

    if (queueItems.length === 0) {
      return 0;
    }

    updateEcommerceFrameworkRuntime(frameworkId, (currentRuntime) => enqueueEcommerceFrameworkItems(currentRuntime, queueItems));
    return queueItems.length;
  }, [resolveEcommerceFrameworkQueuePhases, updateEcommerceFrameworkRuntime]);

  const pumpEcommerceFrameworkQueue = useCallback((frameworkId: string) => {
    const currentRuntime = ecommerceFrameworkRuntimeRef.current[frameworkId];
    if (!currentRuntime || currentRuntime.paused) {
      return;
    }

    const starters = resolveEcommerceFrameworkDispatchPlan(currentRuntime);
    if (starters.length === 0) {
      return;
    }

    updateEcommerceFrameworkRuntime(frameworkId, (runtime) => {
      let nextRuntime = runtime;
      starters.forEach((item) => {
        nextRuntime = markEcommerceFrameworkQueueItemStatus(nextRuntime, item.queueId, 'dispatching');
      });
      return nextRuntime;
    });

    starters.forEach((item) => {
      void (async () => {
        updateEcommerceFrameworkRuntime(frameworkId, (runtime) => markEcommerceFrameworkQueueItemStatus(runtime, item.queueId, 'running', {
          startedAt: Date.now(),
          error: undefined,
        }));

        try {
          const latestNode = activeCanvasRef.current?.promptNodes.find((promptNode) => promptNode.id === item.nodeId);
          if (!latestNode?.ecommerce) {
            throw new Error('Missing ecommerce node');
          }

          if (item.phase === 'mobile') {
            await handleRetryEcommerceModule(latestNode);
          } else {
            await handleGenerateEcommerceNode(latestNode);
          }

          updateEcommerceFrameworkRuntime(frameworkId, (runtime) => markEcommerceFrameworkQueueItemStatus(runtime, item.queueId, 'completed', {
            finishedAt: Date.now(),
            error: undefined,
          }));
        } catch (error: any) {
          updateEcommerceFrameworkRuntime(frameworkId, (runtime) => markEcommerceFrameworkQueueItemStatus(runtime, item.queueId, 'failed', {
            finishedAt: Date.now(),
            error: error?.message || 'Queue item failed',
          }));
        } finally {
          setTimeout(() => {
            pumpEcommerceFrameworkQueue(frameworkId);
          }, 0);
        }
      })();
    });
  }, [handleGenerateEcommerceNode, handleRetryEcommerceModule, updateEcommerceFrameworkRuntime]);

  const handleGenerateEcommerceFramework = useCallback(async (node: PromptNode) => {
    if (!node.ecommerce || node.ecommerce.kind !== 'framework') return;

    const targetNodes = (activeCanvasRef.current?.promptNodes || []).filter((item) => (
      item.mode === GenerationMode.ECOMMERCE
      && !!item.ecommerce
      && item.ecommerce.kind !== 'framework'
      && item.ecommerce.kind !== 'a-plus-group'
      && item.ecommerce.frameworkId === node.id
      && item.ecommerce.selectedForGeneration !== false
    ));

    const queuedCount = enqueueEcommerceFrameworkNodes(node.id, targetNodes);
    if (queuedCount === 0) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.warning('No eligible cards', 'There are no ecommerce cards ready to enqueue.');
      });
      return;
    }

    const nextSheet = node.ecommerce.frameworkMeta?.activeSheet || ecommerceState.activeGroupSheet || '主图';
    syncEcommerceFrameworkView(node.id, nextSheet);
    pumpEcommerceFrameworkQueue(node.id);
  }, [ecommerceState.activeGroupSheet, enqueueEcommerceFrameworkNodes, pumpEcommerceFrameworkQueue, syncEcommerceFrameworkView]);

  const handlePauseEcommerceFramework = useCallback((node: PromptNode) => {
    const frameworkId = resolveEcommerceFrameworkId(node);
    if (!frameworkId) {
      return;
    }

    updateEcommerceFrameworkRuntime(frameworkId, (runtime) => pauseEcommerceFrameworkRuntime(runtime));
  }, [resolveEcommerceFrameworkId, updateEcommerceFrameworkRuntime]);

  const handleResumeEcommerceFramework = useCallback((node: PromptNode) => {
    const frameworkId = resolveEcommerceFrameworkId(node);
    if (!frameworkId) {
      return;
    }

    updateEcommerceFrameworkRuntime(frameworkId, (runtime) => resumeEcommerceFrameworkRuntime(runtime));
    pumpEcommerceFrameworkQueue(frameworkId);
  }, [pumpEcommerceFrameworkQueue, resolveEcommerceFrameworkId, updateEcommerceFrameworkRuntime]);

  const handleCancelEcommerceFrameworkNodeQueue = useCallback((node: PromptNode) => {
    const frameworkId = resolveEcommerceFrameworkId(node);
    if (!frameworkId) {
      return;
    }

    updateEcommerceFrameworkRuntime(frameworkId, (runtime) => cancelEcommerceFrameworkNodeQueue(runtime, node.id));
  }, [resolveEcommerceFrameworkId, updateEcommerceFrameworkRuntime]);

  const handleGenerateEcommerceGroup = useCallback(async (node: PromptNode, phase: 'desktop' | 'mobile') => {
    if (!node.ecommerce || node.ecommerce.kind !== 'a-plus-group') return;

    const frameworkId = node.ecommerce.frameworkId;
    const targetNodes = (activeCanvasRef.current?.promptNodes || []).filter((item) => (
      item.mode === GenerationMode.ECOMMERCE
      && !!item.ecommerce
      && item.ecommerce.kind !== 'framework'
      && item.ecommerce.kind !== 'a-plus-group'
      && item.ecommerce.groupId === node.id
      && item.ecommerce.selectedForGeneration !== false
    ));

    if (!frameworkId) {
      for (const targetNode of targetNodes) {
        if (phase === 'mobile') {
          await handleRetryEcommerceModule(targetNode);
        } else {
          await handleGenerateEcommerceNode(targetNode);
        }
      }
      return;
    }

    const queuedCount = enqueueEcommerceFrameworkNodes(frameworkId, targetNodes, phase);
    if (queuedCount === 0) {
      import('./services/system/notificationService').then(({ notify }) => {
        notify.warning(
          'No eligible cards',
          phase === 'mobile'
            ? 'There are no confirmed mobile follow-up cards ready to enqueue.'
            : 'There are no ecommerce cards ready to enqueue for this group.',
        );
      });
      return;
    }

    syncEcommerceFrameworkView(frameworkId, node.ecommerce.sourceSheet);
    pumpEcommerceFrameworkQueue(frameworkId);
  }, [enqueueEcommerceFrameworkNodes, handleGenerateEcommerceNode, handleRetryEcommerceModule, pumpEcommerceFrameworkQueue, syncEcommerceFrameworkView]);

  const handleExportPptSinglePage = useCallback(async (node: PromptNode, pageIndex: number) => {
    if (!activeCanvas) return;
    if (node.mode !== GenerationMode.PPT) return;

    const ordered = getPromptPptImageNodes(activeCanvas.imageNodes, node.id);

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

    const ordered = getPromptPptImageNodes(activeCanvas.imageNodes, node.id).slice(0, 20);

    if (ordered.length === 0) {
      showNoPptPagesWarning();
      return;
    }

    const escapeXml = (s: string) => String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const zip = new JSZip();
    writePptxPackageSkeleton({
      zip,
      slideCount: ordered.length,
      title: node.prompt || 'KK Studio PPT 导出',
    });

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

      zip.file(`ppt/slides/slide${i + 1}.xml`, buildPptxSlideXml({
        bodyXml: `      <p:pic>
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
`,
      }));

      zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, buildPptxSlideRelationshipsXml([
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i + 1}.${ext}"/>`,
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>',
      ]));
    }

    const pptxBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(pptxBlob, `ppt-slides-${Date.now()}.pptx`);
    import('./services/system/notificationService').then(({ notify }) => {
      notify.success('PPTX 导出完成', `已导出 ${ordered.length} 页的 .pptx 文件`);
    });
  }, [activeCanvas, parsePptOutlineLine, showNoPptPagesWarning]);

  const handleExportPptPackageEditable = useCallback(async (node: PromptNode) => {
    const exportBundle = requirePptEditableExportBundle(node);
    if (!exportBundle) return;

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

    const slidesHtml = buildPptSlidesPreviewHtml({
      title: promptNode.prompt || 'PPT 导出预览',
      items: pageSummaries.map((page) => ({
        page: String(page.page || ''),
        title: String(page.title || ''),
        imageSrc: `../${String(page.previewFile || '')}`,
        description: String(page.outline || ''),
      })),
    });
    zip.file('outline/slides-preview.html', slidesHtml);

    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `ppt-editable-package-${Date.now()}.zip`);

    import('./services/system/notificationService').then(({ notify }) => {
      notify.success('导出完成', `已导出 ${pages.length} 页，以及 editable 图层包、预览页和素材目录`);
    });
  }, [requirePptEditableExportBundle, renderPptEditablePagePreviewBlob, resolvePptExportImageAsset, sanitizePptFileSegment]);

  const handleExportPptxEditable = useCallback(async (node: PromptNode) => {
    const exportBundle = requirePptEditableExportBundle(node);
    if (!exportBundle) return;

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
    writePptxPackageSkeleton({
      zip,
      slideCount: pages.length,
      title: promptNode.prompt || 'KK Studio PPT',
      slideWidth,
      slideHeight,
    });

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

      zip.file(`ppt/slides/slide${slideIndex + 1}.xml`, buildPptxSlideXml({
        bodyXml: slideLayerXml.join('\n'),
      }));

      zip.file(`ppt/slides/_rels/slide${slideIndex + 1}.xml.rels`, buildPptxSlideRelationshipsXml(slideRelationships));
    }

    const pptxBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(pptxBlob, `ppt-layered-${Date.now()}.pptx`);

    import('./services/system/notificationService').then(({ notify }) => {
      notify.success('PPTX 导出完成', `已导出 ${pages.length} 页的可编辑图层 PPTX`);
    });
  }, [requirePptEditableExportBundle, resolvePptExportImageAsset]);

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
  const handlePromptClick = useCallback((clickedNode: PromptNode, isOptimizedView?: boolean) => {
    traceLocalPerformance('canvas-interaction.prompt-click', () => {
      setActiveSourceImage(null);

      const ecommerceTaskState = clickedNode.ecommerce?.editableTask
        || clickedNode.partialRedraw?.inheritedTaskState
        || null;
      const textToCopy = clickedNode.mode === GenerationMode.ECOMMERCE
        ? ''
        : ((isOptimizedView && clickedNode.optimizedPromptEn?.trim())
          ? clickedNode.optimizedPromptEn.trim()
          : clickedNode.prompt);

      setConfig((prev) => ({
        ...prev,
        prompt: textToCopy,
        aspectRatio: clickedNode.aspectRatio,
        imageSize: clickedNode.imageSize,
        model: normalizeModelId(clickedNode.model),
        // Let the composer switch immediately, then hydrate any missing image data in the background.
        referenceImages: clickedNode.referenceImages || [],
        mode: clickedNode.mode || GenerationMode.IMAGE, // 🎯 Sync Mode (Image/Video)
      }));

      const nextFrameworkId = clickedNode.mode === GenerationMode.ECOMMERCE
        ? resolveEcommerceFrameworkId(clickedNode)
        : null;
      const nextActiveSheet = clickedNode.mode === GenerationMode.ECOMMERCE
        ? (clickedNode.ecommerce?.kind === 'framework'
          ? (clickedNode.ecommerce.frameworkMeta?.activeSheet || clickedNode.ecommerce.sourceSheet || null)
          : (clickedNode.ecommerce?.sourceSheet || null))
        : null;

      setEcommerceRatioOverride(clickedNode.ecommerce?.allowedAspectRatios);
      setEcommerceState((previousState) => ({
        ...previousState,
        activeTaskNodeId: clickedNode.mode === GenerationMode.ECOMMERCE && clickedNode.ecommerce?.kind !== 'framework'
          ? clickedNode.id
          : null,
        activeTaskState: clickedNode.mode === GenerationMode.ECOMMERCE && clickedNode.ecommerce?.kind !== 'framework'
          ? ecommerceTaskState
          : null,
        activeFrameworkId: nextFrameworkId,
        activeGroupSheet: nextActiveSheet,
      }));

      if (nextFrameworkId && nextActiveSheet) {
        syncEcommerceFrameworkView(nextFrameworkId, nextActiveSheet);
      }

      // [Draft Logic] Resume Draft if clicked on a draft node
      if (clickedNode.isDraft) {
        setDraftNodeId(clickedNode.id);
      } else {
        // Detach draft if clicking a finalized node (acting as "Edit Template" or "Remix")
        setDraftNodeId(null);
      }
    }, {
      mode: clickedNode.mode || GenerationMode.IMAGE,
      nodeId: clickedNode.id,
      referenceImageCount: clickedNode.referenceImages?.length || 0,
    });
  }, [resolveEcommerceFrameworkId, setConfig, syncEcommerceFrameworkView]);

  const resolvePromptNodeFrameworkStatus = useCallback((node: PromptNode) => {
    const frameworkId = resolveEcommerceFrameworkId(node);
    if (!frameworkId) {
      return null;
    }

    return resolveEcommerceFrameworkSummary(
      activeCanvasRef.current?.promptNodes || [],
      frameworkId,
      ecommerceFrameworkRuntimeRef.current[frameworkId],
    );
  }, [resolveEcommerceFrameworkId]);

  const getSharedPromptNodeActionProps = useCallback((node: PromptNode): SharedPromptNodeActionProps => ({
    onCancel: handleCancelGeneration,
    onRetry: handleRetryNode,
    onEditPptDeck: handleOpenPptDeckEditor,
    onExportPpt: handleExportPptPackageEditable,
    onExportPptx: handleExportPptxEditable,
    onRetryPptPage: handleRetryPptSinglePage,
    onExportPptPage: handleExportPptSinglePage,
    onToggleEcommerceSelected: handleToggleEcommerceSelected,
    onSetEcommerceGroupSelection: handleSetEcommerceGroupSelection,
    onGenerateEcommerceNode: handleGenerateEcommerceNode,
    onGenerateEcommerceGroup: handleGenerateEcommerceGroup,
    onGenerateEcommerceFramework: handleGenerateEcommerceFramework,
    onPauseEcommerceFramework: handlePauseEcommerceFramework,
    onResumeEcommerceFramework: handleResumeEcommerceFramework,
    onCancelEcommerceNodeQueue: handleCancelEcommerceFrameworkNodeQueue,
    onConfirmEcommerceDesktop: handleConfirmEcommerceDesktop,
    onRetryEcommerceModule: handleRetryEcommerceModule,
    onExportEcommerceGroup: handleExportEcommerceGroup,
    ecommerceFrameworkStatus: resolvePromptNodeFrameworkStatus(node),
    activeEcommerceTaskState: ecommerceState.activeTaskState,
    onActivateEcommerceTask: (promptNode: PromptNode) => {
      void handlePromptClick(promptNode, false);
    },
    onEcommerceTaskStateChange: handleChangeEcommerceTaskState,
    ecommerceSlotState: resolveEcommerceSlotState(node),
    onPreviewEcommerceSlotHistory: handlePreviewEcommerceSlotHistoryForNode,
    ioTrace: getNodeIoTrace(node.id),
    onOpenStorageSettings: () => {
      openSettingsSurfaceTracked('storage-settings');
    },
    onDelete: deletePromptNode,
    onDisconnect: handleDisconnectPrompt,
    onUpdateNode: updatePromptNode,
  }), [
    deletePromptNode,
    ecommerceState.activeTaskState,
    getNodeIoTrace,
    handleCancelGeneration,
    handleChangeEcommerceTaskState,
    handleConfirmEcommerceDesktop,
    handleCancelEcommerceFrameworkNodeQueue,
    handleDisconnectPrompt,
    handleExportEcommerceGroup,
    handleExportPptPackageEditable,
    handleExportPptSinglePage,
    handleExportPptxEditable,
    handleGenerateEcommerceGroup,
    handleGenerateEcommerceFramework,
    handleGenerateEcommerceNode,
    handleOpenPptDeckEditor,
    handlePauseEcommerceFramework,
    handlePreviewEcommerceSlotHistoryForNode,
    handlePromptClick,
    handleResumeEcommerceFramework,
    handleRetryEcommerceModule,
    handleRetryNode,
    handleRetryPptSinglePage,
    handleSetEcommerceGroupSelection,
    handleToggleEcommerceSelected,
    openSettingsSurfaceTracked,
    resolvePromptNodeFrameworkStatus,
    resolveEcommerceSlotState,
    updatePromptNode,
  ]);

  const handleActivateEcommerceTaskBySourceKey = useCallback((sourceKey: string) => {
    const targetNode = activeCanvas?.promptNodes.find((node) => (
      node.mode === GenerationMode.ECOMMERCE
      && node.ecommerce?.sourceRowKey === sourceKey
    ));

    if (targetNode) {
      void handlePromptClick(targetNode, false);
      return;
    }

    const fallbackTask = ecommerceState.taskStates[sourceKey];
    if (!fallbackTask) {
      return;
    }

    setEcommerceState((previousState) => ({
      ...previousState,
      activeTaskNodeId: null,
      activeTaskState: fallbackTask,
      activeGroupSheet: fallbackTask.sourceSheet,
    }));
  }, [activeCanvas, ecommerceState.taskStates, handlePromptClick]);

  const handleImageClick = useCallback((imageId: string) => {
    // 🎯 Shift=切换（向后兼容），无修饰键=替换
    const sourceImage = imageNodesById.get(imageId);
    // Keep the parent prompt group focused so the subcard frame stays visible after click.
    setFocusedGroupId(sourceImage?.parentPromptId || null);
    selectNodes([imageId], (window.event as any)?.shiftKey ? 'toggle' : 'replace');

    // Set this image as source for continuing conversation
    setActiveSourceImage(imageId);
    setEcommerceRatioOverride(undefined);
    setEcommerceState((previousState) => ({
      ...previousState,
      activeTaskNodeId: null,
      activeTaskState: null,
      activeFrameworkId: null,
      activeGroupSheet: null,
    }));
    // Clear prompt and existing references to start fresh continue-conversation
    setConfig(prev => ({ ...prev, prompt: '', referenceImages: [] }));

    // Create the follow-up draft node immediately
    // Remove the existing draft first, if any
    if (draftNodeId) {
      deletePromptNode(draftNodeId);
    }

    // Compute the follow-up draft position below the parent group
    if (sourceImage) {
      const parentPrompt = sourceImage.parentPromptId
        ? (promptNodesById.get(sourceImage.parentPromptId) ?? null)
        : null;
      const draftPos = resolveFollowUpDraftPosition({
        sourceImage,
        parentPrompt,
        imageNodes: activeCanvas?.imageNodes || [],
      });

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
  }, [selectNodes, setConfig, draftNodeId, deletePromptNode, activeCanvas, addPromptNode, config, imageNodesById, promptNodesById]);

  const handleMobileUseImageAsSource = useCallback((imageId: string) => {
    handleImageClick(imageId);
  }, [handleImageClick]);

  const handlePartialRedrawRequest = useCallback((image: GeneratedImage, request: PartialRedrawRequest) => {
    void (async () => {
      try {
        const finalPrompt = (request.prompt || '局部重绘').trim();
        const canvas = activeCanvasRef.current;
        const sourceImage = canvas?.imageNodes.find((img) => img.id === image.id) || image;
        const parentPromptId = sourceImage.parentPromptId;
        const parentPrompt = canvas?.promptNodes.find((promptNode) => promptNode.id === parentPromptId);
        const sourceImageUrl = sourceImage.originalUrl || sourceImage.apiResultUrl || sourceImage.url;
        const inheritedTaskState = parentPrompt?.ecommerce?.editableTask
          || sourceImage.partialRedraw?.inheritedTaskState
          || undefined;
        const inheritedDisplayLabel = parentPrompt?.ecommerce?.displayLabel
          || sourceImage.partialRedraw?.inheritedDisplayLabel;
        const inheritedDeliveryKind = sourceImage.ecommerceDeliveryKind
          || sourceImage.partialRedraw?.inheritedDeliveryKind
          || parentPrompt?.ecommerce?.activeDeliveryKind;

        const croppedSourceReference = await buildPartialRedrawReferenceImage(
          sourceImageUrl,
          request.generationRect,
          request.sourceImageDimensions,
        );

        let nodePos = { x: sourceImage.position.x, y: sourceImage.position.y + 80 };
        if (parentPrompt && canvas) {
          const siblingImages = canvas.imageNodes.filter((img) => img.parentPromptId === parentPromptId);
          const maxY = siblingImages.reduce((acc, img) => Math.max(acc, img.position.y), parentPrompt.position.y);
          nodePos = { x: sourceImage.position.x, y: maxY + 80 };
        }

        const promptNodeId = `${Date.now()}_redraw_prompt`;

        const redrawNode: PromptNode = {
          id: promptNodeId,
          prompt: finalPrompt,
          originalPrompt: finalPrompt,
          position: nodePos,
          aspectRatio: request.aspectRatio || sourceImage.aspectRatio || config.aspectRatio,
          imageSize: sourceImage.imageSize || config.imageSize,
          model: normalizeModelId(request.model || sourceImage.model || config.model),
          modelLabel: resolveModelDisplayName(
            request.model || sourceImage.model || config.model,
            sourceImage.modelLabel || getModelMetadata(request.model || sourceImage.model || config.model)?.name,
          ) || undefined,
          provider: sourceImage.provider || undefined,
          providerLabel: sourceImage.providerLabel || undefined,
          childImageIds: [],
          referenceImages: [croppedSourceReference, ...request.referenceImages],
          timestamp: Date.now(),
          sourceImageId: sourceImage.id,
          isGenerating: true,
          mode: GenerationMode.REDRAW,
          partialRedraw: {
            sourceImageId: sourceImage.id,
            sourceImageStorageId: sourceImage.storageId,
            sourcePromptId: parentPrompt?.id,
            sourceImageDimensions: request.sourceImageDimensions,
            selectionRect: request.selectionRect,
            generationRect: request.generationRect,
            targetAspectRatio: request.aspectRatio,
            extraReferenceImageIds: request.referenceImages.map((ref) => ref.storageId || ref.id),
            inheritedDisplayLabel,
            inheritedTaskState,
            inheritedDeliveryKind,
            compositeVersion: 1,
          },
          tags: [],
        };

        await addPromptNode(redrawNode);
        await executeGeneration(redrawNode);

        const latestRedrawResultId = activeCanvasRef.current?.promptNodes
          .find((promptNode) => promptNode.id === redrawNode.id)
          ?.childImageIds?.[0];

        if (latestRedrawResultId) {
          const redrawResultImage = activeCanvasRef.current?.imageNodes.find((img) => img.id === latestRedrawResultId);
          if (parentPrompt?.mode === GenerationMode.ECOMMERCE && redrawResultImage) {
            await updateImageNode(redrawResultImage.id, {
              parentPromptId: parentPrompt.id,
              position: { ...sourceImage.position },
              ecommerceDeliveryKind: inheritedDeliveryKind || redrawResultImage.ecommerceDeliveryKind,
            });

            const latestParentPrompt = activeCanvasRef.current?.promptNodes.find((promptNode) => promptNode.id === parentPrompt.id) || parentPrompt;
            if (!latestParentPrompt.childImageIds.includes(latestRedrawResultId)) {
              await updatePromptNode({
                ...latestParentPrompt,
                childImageIds: [...latestParentPrompt.childImageIds, latestRedrawResultId],
              });
            }

            const latestRedrawPrompt = activeCanvasRef.current?.promptNodes.find((promptNode) => promptNode.id === redrawNode.id) || redrawNode;
            await updatePromptNode({
              ...latestRedrawPrompt,
              childImageIds: [],
            });
            deletePromptNode(redrawNode.id);
          }

          handleOpenPreview(latestRedrawResultId);
        } else {
          setPreviewImages(null);
        }
      } catch (error: any) {
        console.error('[partial-redraw] Failed to prepare redraw request', error);
        import('./services/system/notificationService').then(({ notify }) => {
          notify.error('重绘准备失败', error?.message || '请稍后重试');
        });
      }
    })();
  }, [addPromptNode, config.aspectRatio, config.imageSize, config.model, executeGeneration, handleOpenPreview]);

  const handleMobileResultPartialRedraw = useCallback((entry: MobileResultEntry, request: PartialRedrawRequest) => {
    const imageNode = activeCanvas?.imageNodes.find((image) => image.id === entry.imageId);
    if (!imageNode) {
      return;
    }

    handlePartialRedrawRequest(imageNode, request);
  }, [activeCanvas, handlePartialRedrawRequest]);

  const resolveMobileResultPromptNode = useCallback((entry: MobileResultEntry) => {
    const promptNodeId = entry.ecommerceContinuation?.promptNodeId
      || entry.detailEntry?.promptId
      || entry.parentPromptId;
    if (!promptNodeId) {
      return null;
    }

    return activeCanvasRef.current?.promptNodes.find((node) => node.id === promptNodeId) || null;
  }, []);

  const handleMobileEditEcommerceTask = useCallback((entry: MobileResultEntry) => {
    if (!entry.ecommerceContinuation?.canEditTask) {
      return;
    }

    const promptNode = resolveMobileResultPromptNode(entry);
    if (!promptNode || promptNode.mode !== GenerationMode.ECOMMERCE) {
      return;
    }

    void handlePromptClick(promptNode, false);
    focusWorkspace();
    setMobileScreen('home');
  }, [focusWorkspace, handlePromptClick, resolveMobileResultPromptNode]);

  const handleMobileToggleEcommerceSelected = useCallback((entry: MobileResultEntry, selected: boolean) => {
    if (!entry.ecommerceContinuation?.canToggleSelection) {
      return;
    }

    const promptNode = resolveMobileResultPromptNode(entry);
    if (!promptNode || promptNode.mode !== GenerationMode.ECOMMERCE) {
      return;
    }

    handleToggleEcommerceSelected(promptNode, selected);
  }, [handleToggleEcommerceSelected, resolveMobileResultPromptNode]);

  const handleMobileConfirmEcommerceDesktop = useCallback((entry: MobileResultEntry) => {
    if (!entry.ecommerceContinuation?.canConfirmDesktop) {
      return;
    }

    const promptNode = resolveMobileResultPromptNode(entry);
    if (!promptNode || promptNode.mode !== GenerationMode.ECOMMERCE) {
      return;
    }

    handleConfirmEcommerceDesktop(promptNode);
  }, [handleConfirmEcommerceDesktop, resolveMobileResultPromptNode]);

  const handleMobileGenerateEcommerceMobile = useCallback((entry: MobileResultEntry) => {
    if (!entry.ecommerceContinuation?.canGenerateMobile) {
      return;
    }

    const promptNode = resolveMobileResultPromptNode(entry);
    if (!promptNode || promptNode.mode !== GenerationMode.ECOMMERCE) {
      return;
    }

    const frameworkId = promptNode.ecommerce?.frameworkId;
    if (frameworkId) {
      const queuedCount = enqueueEcommerceFrameworkNodes(frameworkId, [promptNode], 'mobile');
      if (queuedCount > 0) {
        syncEcommerceFrameworkView(
          frameworkId,
          (promptNode.ecommerce?.sourceSheet || ecommerceState.activeGroupSheet || 'A+') as EcommerceGroupSheet,
        );
        pumpEcommerceFrameworkQueue(frameworkId);
        return;
      }
    }

    void handleRetryEcommerceModule(promptNode);
  }, [ecommerceState.activeGroupSheet, enqueueEcommerceFrameworkNodes, handleRetryEcommerceModule, pumpEcommerceFrameworkQueue, resolveMobileResultPromptNode, syncEcommerceFrameworkView]);

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
      const prompt = promptNodesById.get(id);
      if (prompt) {
        addRect(prompt.position.x, prompt.position.y, 380, prompt.height || 200);
        return;
      }
      // 2. Check Images
      const img = imageNodesById.get(id);
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
  }, [activeCanvas, imageNodesById, promptNodesById]);

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

  const isPptDeckChildImageNode = useCallback((imageNode: GeneratedImage) => {
    if (!imageNode.parentPromptId) {
      return false;
    }

    const canvas = activeCanvasRef.current;
    if (!canvas) {
      return false;
    }

    const parentPrompt = canvas.promptNodes.find((promptNode) => promptNode.id === imageNode.parentPromptId);
    return Boolean(parentPrompt && parentPrompt.mode === GenerationMode.PPT);
  }, []);

  const resolveCurrentPromptChildImages = useCallback((
    promptNode: PromptNode | undefined | null,
    imageNodes: GeneratedImage[],
  ) => {
    if (!promptNode) return [] as GeneratedImage[];
    if (promptNode.mode === GenerationMode.PPT) return [] as GeneratedImage[];

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

        const imageNode = imageNodesById.get(nodeId);
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
    imageNodesById,
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
    const isInteracting = canvasInteractionPhase !== 'idle' || Boolean(selectionBox?.active) || Boolean(dragConnection?.active);
    const profileInteractionPhase = canvasInteractionPhase === 'zoom'
      ? 'zoom'
      : isInteracting
        ? 'pan'
        : 'idle';

    return getCanvasPerformanceProfile({
      scale: canvasTransform.scale || 1,
      isInteracting,
      interactionPhase: profileInteractionPhase,
      isDragging: profileInteractionPhase === 'pan',
      isZooming: profileInteractionPhase === 'zoom',
      hardwareConcurrency: typeof navigator === 'undefined' ? undefined : navigator.hardwareConcurrency,
      deviceMemory: typeof navigator === 'undefined'
        ? undefined
        : (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      nodeCount,
      connectionCount,
      viewportWidth: typeof window === 'undefined' ? 0 : window.innerWidth,
      viewportHeight: typeof window === 'undefined' ? 0 : window.innerHeight,
    });
  }, [
    activeCanvas,
    canvasInteractionPhase,
    canvasTransform.scale,
    dragConnection?.active,
    selectionBox?.active,
  ]);
  const liveNodePositionByIdRef = useRef<Record<string, { x: number; y: number }>>({});
  const liveDerivedNodeIdsByOwnerRef = useRef<Record<string, string[]>>({});

  // Viewport Culling (Virtualization) Logic
  // Optimization: Only render nodes overlapping with the current viewport (+buffer)
  const stableVisibleCanvasSceneRef = useRef<{
    visiblePromptNodes: PromptNode[];
    visibleImageNodes: GeneratedImage[];
    visibleWorkflowUtilityNodes: WorkflowUtilityCanvasNode[];
    visibleGroups: CanvasGroup[];
    nowTimestamp: number;
  }>({
    visiblePromptNodes: [],
    visibleImageNodes: [],
    visibleWorkflowUtilityNodes: [],
    visibleGroups: [],
    nowTimestamp: Date.now(),
  });
  const { visiblePromptNodes, visibleImageNodes, visibleWorkflowUtilityNodes, visibleGroups, nowTimestamp } = React.useMemo(() => {
    if (isNodeDragActive) {
      return stableVisibleCanvasSceneRef.current;
    }

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
      liveNodePositionByIdRef.current[node.id] ?? node.position
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

        if (n.hiddenInCanvas) {
          return false;
        }

        if (
          n.mode === GenerationMode.ECOMMERCE
          && n.ecommerce?.frameworkId
          && n.ecommerce.kind !== 'framework'
        ) {
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
        if (isPptDeckChildImageNode(n)) {
          return false;
        }

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

    stableVisibleCanvasSceneRef.current = {
      visiblePromptNodes,
      visibleImageNodes,
      visibleWorkflowUtilityNodes,
      visibleGroups,
      nowTimestamp,
    };

    return { visiblePromptNodes, visibleImageNodes, visibleWorkflowUtilityNodes, visibleGroups, nowTimestamp };
  }, [activeCanvas, canvasPerformanceProfile.overscanBuffer, canvasTransform, isNodeDragActive, isPptDeckChildImageNode, liveNodePositionVersion, promptGroupLayerById, promptGroupStackZIndexById, standaloneImageStackZIndexById]);

  const getSharedImageNodeProps = useCallback((image: GeneratedImage): SharedImageNodeProps => ({
    image,
    onPositionChange: updateImageNodePosition,
    onDimensionsUpdate: updateImageNodeDisplayMeta,
    onUpdate: updateImageNode,
    onDelete: deleteImageNode,
    onConnectEnd: handleConnectEnd,
    onClick: handleImageClick,
    isActive: image.id === activeSourceImage,
    zoomScale: canvasTransform.scale,
    isMobile,
    onPreview: handleOpenPreview,
    onPreviewPptStack: handleOpenPptStackPreview,
    onDownloadPptComposite: handleDownloadPptComposite,
    isCanvasTransforming,
    isNew: (nowTimestamp || Date.now()) - (image.timestamp || 0) < 10000,
    canvasTransform,
  }), [
    activeSourceImage,
    canvasTransform,
    deleteImageNode,
    handleConnectEnd,
    handleDownloadPptComposite,
    handleImageClick,
    handleOpenPptStackPreview,
    handleOpenPreview,
    isCanvasTransforming,
    isMobile,
    nowTimestamp,
    updateImageNode,
    updateImageNodeDisplayMeta,
    updateImageNodePosition,
  ]);

  const handleLegacyImageRelativeDrag = useCallback((delta: { x: number; y: number }, sourceNodeId?: string) => {
    if (!sourceNodeId) {
      return;
    }

    const expandedSelectedIds = Array.from(new Set(
      selectedNodeIds.flatMap((selectedId) => {
        const selectedPrompt = activeCanvas?.promptNodes.find((promptNode) => promptNode.id === selectedId);
        if (!selectedPrompt) {
          return [selectedId];
        }

        return [
          selectedId,
          ...(selectedPrompt.childImageIds || []).filter((id): id is string => !!id),
        ];
      })
    ));

    if (selectedNodeIds.includes(sourceNodeId) && expandedSelectedIds.length > 0) {
      moveSelectedNodes(delta, expandedSelectedIds);
      return;
    }

    moveSelectedNodes(delta, sourceNodeId);
  }, [activeCanvas, moveSelectedNodes, selectedNodeIds]);

  const {
    liveSceneState,
    liveSceneRef,
    actualChildImagesByPromptId,
    actualChildImageIdsByPromptId,
    promptGroupNodeIdsById,
    promptGroupRegroupLayoutsById,
    promptGroupBoundsById,
    promptGroupViews,
    visiblePromptGroupViews,
    syncLiveNodePositionState,
    beginPromptGroupRegroup,
    settlePromptGroupRegroup,
    clearPromptGroupRegroup,
  } = usePromptGroupLayout({
    activeCanvas,
    canvasInteractionPhase,
    focusedGroupId,
    generatingGroupIds,
    groupOverlapMap,
    isMobile,
    isNodeDragActive,
    lockedGroupBoundsById,
    liveNodePositionByIdRef,
    liveNodePositionVersion,
    parseImageDimensions,
    promptGroupLayerById,
    promptGroupLayoutStateByIdRef,
    promptGroupLayoutVersion,
    promptNodesById,
    resolveCurrentPromptChildImages,
    setGroupOverlapMap,
    setPromptGroupLayoutVersion,
    setLiveNodePositionVersion,
    visibleImageNodes,
    visiblePromptNodes,
  });

  useEffect(() => {
    setImageCardHeightById({});
  }, [activeCanvas?.id]);

  useEffect(() => {
    if (!activeCanvas) {
      setFocusedGroupId((current) => (current === null ? current : null));

      const hadLivePositions = Object.keys(liveNodePositionByIdRef.current).length > 0
        || Object.keys(liveDerivedNodeIdsByOwnerRef.current).length > 0;
      const hadPromptGroupLayouts = Object.keys(promptGroupLayoutStateByIdRef.current).length > 0;

      if (hadLivePositions) {
        liveNodePositionByIdRef.current = {};
        liveDerivedNodeIdsByOwnerRef.current = {};
        setLiveNodePositionVersion((prev) => prev + 1);
      }

      if (hadPromptGroupLayouts) {
        promptGroupLayoutStateByIdRef.current = {};
        setPromptGroupLayoutVersion((prev) => prev + 1);
      }

      setLockedGroupBoundsById((current) => (
        Object.keys(current).length === 0 ? current : {}
      ));
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

  const resolvePromptGroupIdForNodeId = useCallback((nodeId: string) => {
    if (promptNodesById.has(nodeId)) {
      return nodeId;
    }

    return imageNodesById.get(nodeId)?.parentPromptId || null;
  }, [imageNodesById, promptNodesById]);

  const resolveCanvasNodePositionForLiveDrag = useCallback((nodeId: string) => {
    const livePosition = liveNodePositionByIdRef.current[nodeId];
    if (livePosition) {
      return livePosition;
    }

    const promptNode = promptNodesById.get(nodeId);
    if (promptNode) {
      return promptNode.position;
    }

    const imageNode = imageNodesById.get(nodeId);
    if (imageNode) {
      return imageNode.position;
    }

    const workflowNode = workflowUtilityNodesById.get(nodeId);
    return workflowNode?.position ?? null;
  }, [imageNodesById, promptNodesById, workflowUtilityNodesById]);

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
    const groupId = resolvePromptGroupIdForNodeId(nodeId);

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

        const liveGroupId = resolvePromptGroupIdForNodeId(liveNodeId);

        return liveGroupId === groupId;
      });

      if (hasOtherLiveNodeInGroup || !(groupId in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  }, [moveSelectedNodesImmediate, promptGroupBoundsById, resolvePromptGroupIdForNodeId, syncLiveNodePositionState]);

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

  const shouldAutoRegroupPromptGroup = useCallback((
    promptNode: PromptNode,
    childImages: GeneratedImage[],
    sourceNodeId: string,
  ) => (
    sourceNodeId === promptNode.id
    && selectedNodeIds.length <= 1
    && childImages.length > 0
  ), [selectedNodeIds.length]);

  const commitPromptGroupDrag = useCallback((
    promptNode: PromptNode,
    childImages: GeneratedImage[],
    finalPromptPosition: { x: number; y: number },
    shouldRegroup: boolean,
  ) => {
    const latestPrompt = activeCanvas?.promptNodes.find((candidate) => candidate.id === promptNode.id) ?? promptNode;
    const promptGroupSnapshot = liveSceneRef.current.promptGroups[promptNode.id];

    void updatePromptNode({
      ...latestPrompt,
      position: finalPromptPosition,
      userMoved: true,
    });

    childImages.forEach((imageNode) => {
      const fallbackPosition = liveNodePositionByIdRef.current[imageNode.id] ?? imageNode.position;
      const commitPosition = shouldRegroup
        ? promptGroupSnapshot?.childRenderPositionsById[imageNode.id]
          ?? promptGroupSnapshot?.childLogicalPositionsById[imageNode.id]
          ?? fallbackPosition
        : fallbackPosition;
      updateImageNodePosition(imageNode.id, commitPosition, { ignoreSelection: true });
    });

    if (shouldRegroup && childImages.length > 0) {
      settlePromptGroupRegroup(promptNode.id);
      return;
    }

    clearPromptGroupRegroup(promptNode.id);
  }, [activeCanvas, clearPromptGroupRegroup, settlePromptGroupRegroup, updateImageNodePosition, updatePromptNode]);

  const autoRepairedPromptLayoutKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    autoRepairedPromptLayoutKeysRef.current.clear();
  }, [activeCanvas?.id]);

  useEffect(() => {
    if (!activeCanvas || isNodeDragActive) return;

    const repairKeys = autoRepairedPromptLayoutKeysRef.current;
    const activeCanvasId = activeCanvas.id;

    activeCanvas.promptNodes.forEach((promptNode) => {
      const childImages = actualChildImagesByPromptId.get(promptNode.id) || [];
      if (childImages.length === 0) return;

      const hasLiveDragInGroup = Boolean(liveNodePositionByIdRef.current[promptNode.id])
        || childImages.some((imageNode) => Boolean(liveNodePositionByIdRef.current[imageNode.id]));
      const hasManualLayoutOverride = Boolean(promptNode.userMoved)
        || childImages.some((imageNode) => Boolean(imageNode.userMoved));
      const hasPromptGroupPresentationState = Boolean(promptGroupLayoutStateByIdRef.current[promptNode.id]);

      if (hasLiveDragInGroup || hasManualLayoutOverride || hasPromptGroupPresentationState) return;

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
  }, [activeCanvas, actualChildImagesByPromptId, isMobile, isNodeDragActive, liveNodePositionVersion, parseImageDimensions, promptGroupLayoutVersion, updateImageNodePosition]);

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

  const visibleWorkflowUtilityNodesById = React.useMemo(
    () => new Map(visibleWorkflowUtilityNodes.map((node) => [node.id, node])),
    [visibleWorkflowUtilityNodes]
  );

  const {
    connectorRenderSnapshot,
    connectorRenderPromptNodes,
    connectorRenderVisibleImageNodes,
    connectorRenderWorkflowUtilityNodesById,
    connectorVisibleImageNodeIds,
    connectorChildImagesByPromptId,
    resolveLivePromptPosition,
    resolveLiveImagePosition,
    resolveConnectorRenderPosition,
  } = useConnectorRenderer({
    activeCanvas,
    liveSceneState,
    liveSceneRef,
    visiblePromptNodes,
    visibleImageNodes,
    visibleWorkflowUtilityNodes,
    promptNodesById,
    imageNodesById,
    workflowUtilityNodesById,
    canvasPerformanceProfile,
    resolveCurrentPromptChildImages,
  });

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

  const {
    getSelectionScreenCenter,
    selectNodeFromCurrentEvent,
    handleCanvasNodeSelect,
  } = useCanvasNodeSelection({
    activeCanvas,
    canvasTransform,
    getCardDimensions,
    resolvePromptGroupIdForNodeId,
    selectNodes,
    setFocusedGroupId,
    setSelectionMenuPosition,
  });

  const {
    handlePromptGroupDragDelta,
    handlePromptGroupDragCommit,
    handlePromptGroupChildDragDelta,
    handlePromptGroupChildDragCommit,
  } = usePromptGroupDragHandlers({
    selectedNodeIds,
    expandedSelectedNodeIds,
    shouldAutoRegroupPromptGroup,
    beginPromptGroupRegroup,
    clearPromptGroupRegroup,
    applyLiveNodeDeltaToDraggedSet,
    moveSelectedNodesImmediate,
    commitPromptGroupDrag,
  });

  const handlePromptGroupNodeSelect = useCallback((groupId: string, nodeId: string) => {
    setFocusedGroupId(groupId);
    handleCanvasNodeSelect(nodeId);
  }, [handleCanvasNodeSelect]);

  const handlePromptGroupNodeHeightChange = useCallback((fallbackNode: PromptNode, id: string, height: number) => {
    const targetNode = promptNodesById.get(id) ?? fallbackNode;
    if (targetNode.height !== height) {
      void updatePromptNode({ ...targetNode, height });
    }
  }, [promptNodesById, updatePromptNode]);

  const handlePromptGroupTagRemove = useCallback((id: string, tag: string) => {
    const promptNode = promptNodesById.get(id);
    if (!promptNode?.tags) {
      return;
    }

    void updatePromptNode({
      ...promptNode,
      tags: promptNode.tags.filter((currentTag) => currentTag !== tag),
    });
  }, [promptNodesById, updatePromptNode]);

  const handleRootMouseMove = useCallback((e: React.MouseEvent) => {
    handleSelectionMouseMove(e);
    handleDragConnectionMouseMove(e);
  }, [handleSelectionMouseMove, handleDragConnectionMouseMove]);

  const handleRootMouseUp = useCallback((e: React.MouseEvent) => {
    handleSelectionMouseUp(e);
    handleDragConnectionMouseUp();
  }, [handleSelectionMouseUp, handleDragConnectionMouseUp]);

  const {
    getPromptChildrenForWorkflow,
    resolveWorkflowSourceIdsFromSelection,
    resolveCanvasNodePosition,
    resolvePrimaryWorkflowSourcePrompt,
    resolvePrimaryWorkflowSourceImage,
    resolveWorkflowLinkedImages,
  } = useWorkflowSourceResolvers({
    activeCanvas,
    selectedNodeIds,
    activeSourceImage,
    promptNodesById,
    imageNodesById,
    workflowUtilityNodesById,
    resolveCurrentPromptChildImages,
  });

  const {
    notifyWorkflowCard,
    getWorkflowInsertPosition,
    exportWorkflowImagesAsZip,
    createTemplatePromptNode,
    handleWorkflowPreviewAction,
    handleWorkflowSaveAction,
    handleWorkflowAgentAction,
    handleAddWorkflowUtilityCard,
    handleApplyWorkflowTemplate,
  } = useWorkflowActions({
    activeCanvas,
    config,
    setConfig,
    canvasRef,
    canvasTransform,
    isSidebarOpen,
    isChatOpen,
    isMobile,
    chatSidebarWidth,
    selectedNodeIds,
    findSmartPosition,
    addPromptNode,
    addWorkflowNode,
    selectNodes,
    bringNodesToFront,
    setActiveSourceImage,
    setWorkspaceSurface,
    handleOpenPreview,
    handleNavigateToNode,
    handleExportPptxEditable,
    resolveCanvasNodePosition,
    resolvePrimaryWorkflowSourcePrompt,
    resolvePrimaryWorkflowSourceImage,
    resolveWorkflowLinkedImages,
    resolveWorkflowSourceIdsFromSelection,
  });














  const renderImageWorkflowItem = useCallback((item: ImageRenderItem) => {
    const node = item.node;
    const imageDetailLevel = node.parentPromptId ? 'full' : item.detailLevel;
    const renderedImagePosition = resolveLiveImagePosition(node) ?? node.position;

    return (
      <ImageNode
        {...getSharedImageNodeProps(node)}
        detailLevel={imageDetailLevel}
        loadPriority={item.loadPriority}
        loadBand={item.loadBand}
        groupLayerZIndex={item.groupLayerZIndex}
        stackZIndexOverride={item.stackZIndexOverride}
        position={renderedImagePosition}
        onLivePositionChange={handleLiveNodePositionChange}
        onHeightChange={handleImageCardHeightChange}
        highlighted={highlightedId === node.id}
        onBringToFront={() => bringNodesToFront([node.id])}
        isSelected={selectedNodeIds.includes(node.id)}
        onSelect={() => handleCanvasNodeSelect(node.id)}
        onDragStateChange={handleCanvasNodeDragStateChange}
        onDragDelta={(delta, sourceNodeId) => {
          if (!sourceNodeId) return;

          if (selectedNodeIds.includes(sourceNodeId) && expandedSelectedNodeIds.length > 0) {
            applyLiveNodeDeltaToDraggedSet(sourceNodeId, expandedSelectedNodeIds, delta);
          }
        }}
        onDragCommit={(delta, sourceNodeId) => {
          if (!sourceNodeId) return;

          if (selectedNodeIds.includes(sourceNodeId) && expandedSelectedNodeIds.length > 0) {
            moveSelectedNodesImmediate(delta, expandedSelectedNodeIds);
            return;
          }

          moveSelectedNodesImmediate(delta, sourceNodeId);
        }}
      />
    );
  }, [
    bringNodesToFront,
    expandedSelectedNodeIds,
    handleCanvasNodeSelect,
    handleImageCardHeightChange,
    handleCanvasNodeDragStateChange,
    handleLiveNodePositionChange,
    getSharedImageNodeProps,
    highlightedId,
    applyLiveNodeDeltaToDraggedSet,
    moveSelectedNodesImmediate,
    resolveLiveImagePosition,
    selectedNodeIds,
  ]);

  const renderPromptGroupWorkflowItem = useCallback((item: PromptGroupRenderItem) => {
    const { groupView } = item;
    const node = groupView.rootPrompt;
    const groupNodeIds = promptGroupNodeIdsById.get(node.id) || [node.id];
    const promptGroupLayoutState = promptGroupLayoutStateByIdRef.current[node.id];
    const groupStackZIndex = promptGroupStackZIndexById.get(node.id) ?? ((groupView.baseOrder * 100) + 10);
    const sourceImageNode = node.sourceImageId ? imageNodesById.get(node.sourceImageId) : null;
    const {
      isGroupFocused,
      promptDetailLevel,
      shadowBoost,
      connectorLayerZIndex,
      promptCardZIndex,
      groupConnectorStroke,
      groupConnectorDash,
      connectorSvgLeft,
      connectorSvgTop,
      connectorSvgWidth,
      connectorSvgHeight,
      connectorOpacity,
      renderedPromptNode,
      childVisualLayouts,
      groupConnectorLayouts,
    } = buildPromptGroupRenderLayout({
      item,
      groupStackZIndex,
      focusedGroupId,
      generatingGroupIds,
      canvasScale: canvasTransform.scale,
      isMobile,
      promptGroupLayoutState,
      regroupLayoutsById: promptGroupRegroupLayoutsById.get(node.id) ?? new Map(),
      imageCardHeightById,
      resolveLivePromptPosition,
      resolveLiveImagePosition,
      getPromptHeight,
    });

    return (
      <>
        {groupConnectorLayouts.length > 0 && (
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            shapeRendering="geometricPrecision"
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
            <g>
              {groupConnectorLayouts.map((segment) => (
                <path
                  key={segment.key}
                  d={segment.path}
                  fill="none"
                  stroke="var(--connector-color, #6366f1)"
                  strokeWidth={groupConnectorStroke}
                  strokeDasharray={groupConnectorDash}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={connectorOpacity}
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
          onSelect={() => handlePromptGroupNodeSelect(node.id, node.id)}
          onClickPrompt={handlePromptClick}
          onConnectStart={handleConnectStart}
          zoomScale={canvasTransform.scale}
          isCanvasTransforming={isCanvasTransforming}
          isMobile={isMobile}
          sourcePosition={sourceImageNode ? (resolveLiveImagePosition(sourceImageNode) ?? sourceImageNode.position) : undefined}
          {...getSharedPromptNodeActionProps(renderedPromptNode)}
          onLivePositionChange={handleLiveNodePositionChange}
          onHeightChange={(id, height) => {
            handlePromptGroupNodeHeightChange(node, id, height);
          }}
          onPin={handlePinDraft}
          onRemoveTag={handlePromptGroupTagRemove}
          onDragDelta={(delta, sourceNodeId) => {
            handlePromptGroupDragDelta({
              node,
              childImages: groupView.childImages,
              groupNodeIds,
              delta,
              sourceNodeId,
            });
          }}
          onDragCommit={(delta, sourceNodeId, finalPosition) => {
            handlePromptGroupDragCommit({
              node,
              childImages: groupView.childImages,
              delta,
              sourceNodeId,
              finalPosition,
            });
          }}
          canvasTransform={canvasTransform}
          onDragStateChange={handleCanvasNodeDragStateChange}
        />

        {childVisualLayouts.map((childLayout, childIndex) => (
          <React.Fragment key={childLayout.childNode.id}>
            <ImageNode
              {...getSharedImageNodeProps(childLayout.childNode)}
              detailLevel="full"
              loadPriority={1200}
              loadBand={0}
              groupLayerZIndex={promptGroupLayerById.get(node.id) ?? childLayout.childNode.zIndex ?? 0}
              stackZIndexOverride={promptCardZIndex + 10 + childIndex}
              shadowBoost={shadowBoost}
              position={childLayout.visualPosition}
              onLivePositionChange={handleLiveNodePositionChange}
              onHeightChange={handleImageCardHeightChange}
              highlighted={highlightedId === childLayout.childNode.id || isGroupFocused}
              onBringToFront={() => handleFocusPromptGroup(node.id, { keepSelection: true })}
              isSelected={selectedNodeIds.includes(childLayout.childNode.id)}
              onSelect={() => handlePromptGroupNodeSelect(node.id, childLayout.childNode.id)}
              onDragStateChange={handleCanvasNodeDragStateChange}
              onDragDelta={(delta, sourceNodeId) => {
                handlePromptGroupChildDragDelta({
                  groupId: node.id,
                  delta,
                  sourceNodeId,
                });
              }}
              onDragCommit={(delta, sourceNodeId) => {
                handlePromptGroupChildDragCommit({
                  groupId: node.id,
                  delta,
                  sourceNodeId,
                });
              }}
            />
          </React.Fragment>
        ))}
      </>
    );
  }, [
    handlePromptGroupChildDragCommit,
    handlePromptGroupChildDragDelta,
    handlePromptGroupDragCommit,
    handlePromptGroupDragDelta,
    handlePromptGroupNodeHeightChange,
    handlePromptGroupNodeSelect,
    handlePromptGroupTagRemove,
    canvasTransform,
    deleteImageNode,
    handleConnectStart,
    handleConnectEnd,
    handleDownloadPptComposite,
    handleOpenPptStackPreview,
    handleOpenPreview,
    handleCanvasNodeDragStateChange,
    handleLiveNodePositionChange,
    handleFocusPromptGroup,
    getSharedImageNodeProps,
    getSharedPromptNodeActionProps,
    handleImageClick,
    handlePinDraft,
    focusedGroupId,
    generatingGroupIds,
    imageCardHeightById,
    imageNodesById,
    highlightedId,
    isMobile,
    nowTimestamp,
    promptGroupNodeIdsById,
    promptGroupLayoutVersion,
    promptGroupRegroupLayoutsById,
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

  const handleCanvasInteractionChange = useCallback((state: {
    isDragging: boolean;
    isZooming: boolean;
    interactionPhase: 'idle' | 'pan' | 'zoom';
    idleRelaxationMs: number;
  }) => {
    const nextValue = state.isDragging || state.isZooming;
    setIsCanvasTransforming(prev => (prev === nextValue ? prev : nextValue));
    setCanvasInteractionPhase(state.interactionPhase);
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

  

  const workspaceChrome = null;

  const {
    mobilePromptBarProps,
    desktopPromptBarProps,
  } = useAppPromptBarProps({
    config,
    setConfig,
    isGenerating,
    onUiBusyChange: setPromptBarUiBusy,
    onGenerate: handleGenerate,
    onCancel: handleCancelGeneration,
    onFilesDrop: handleFilesDrop,
    activeCanvas,
    activeSourceImageId: activeSourceImage,
    onClearSource: handleClearSource,
    isMobile,
    ecommerceState,
    onPickEcommerceRequirementFile: handlePickEcommerceRequirementFile,
    onPickEcommerceProductFiles: handlePickEcommerceProductFiles,
    onPickEcommerceExtraReferenceFiles: handlePickEcommerceExtraReferenceFiles,
    onClearEcommerceRequirementFile: handleClearEcommerceRequirementFile,
    onRemoveEcommerceProductFile: handleRemoveEcommerceProductFile,
    onRemoveEcommerceExtraReferenceFile: handleRemoveEcommerceExtraReferenceFile,
    onPickEcommerceItemReferenceFiles: handlePickEcommerceItemReferenceFiles,
    onRemoveEcommerceItemReferenceFile: handleRemoveEcommerceItemReferenceFile,
    onResetEcommerceAnalysis: handleResetEcommerceAnalysis,
    onConfirmEcommerceAnalysis: handleConfirmEcommerceAnalysis,
    onToggleEcommerceSelection: handleToggleEcommerceAnalysisSelection,
    onActivateEcommerceGroupSheet: handleActivateEcommerceGroupSheet,
    onActivateEcommerceTaskBySourceKey: handleActivateEcommerceTaskBySourceKey,
    onUpdateEcommerceSheetSetting: handleUpdateEcommerceSheetSetting,
    onChangeEcommerceTaskState: handleChangeEcommerceTaskState,
    onPreviewEcommerceSlotHistory: handlePreviewEcommerceSlotHistory,
    ecommerceRatioOverride,
    onAnalyzeEcommerceFile: handleAnalyzeEcommerceRequirement,
    openSettingsSurface: openSettingsSurfaceTracked,
    handleShowMobileNav,
    handleHideMobileNav,
    setIsPromptFocused,
  });

  const workspacePanels = (
    <WorkspaceSurfacePanels
      activeSurface={activeAppSurface}
      activePanel={activeWorkspacePanel}
      isChatOpen={isChatOpen}
      toggleChatPanel={toggleChatPanel}
      setIsChatOpen={setIsChatOpen}
      isMobile={isMobile}
      openSettingsSurface={openSettingsSurfaceTracked}
      setIsSidebarHovered={setIsSidebarHovered}
      setChatSidebarWidth={setChatSidebarWidth}
      workspaceSurface={workspaceSurface}
      activeCanvas={activeCanvas}
      focusWorkspace={focusWorkspace}
      handlePreviewFromLibrary={handlePreviewFromLibrary}
      handleFocusLibraryImage={handleFocusLibraryImage}
    />
  );

  const selectionMenuOverlay = useSelectionMenuOverlay({
    activeCanvas,
    selectedNodeIds,
    selectionMenuPosition,
    closeSelectionMenu: () => setSelectionMenuPosition(null),
    actualChildImageIdsByPromptId,
    deletePromptNode,
    deleteImageNode,
    deleteWorkflowNode,
    removeGroup,
    addGroup,
    clearSelection,
    arrangeAllNodes,
    getCardDimensions,
    onTag: handleTag,
    onOpenMigrate: () => setShowMigrateModal(true),
  });

  const handleCloseSettingsPanel = useCallback(() => {
    setShowSettingsPanel(false);
    setSettingsInitialSupplier(null);
  }, []);

  const handleStorageSelectionComplete = useCallback(() => {
    setShowStorageModal(false);
    setIsStorageChecked(true);
    if (!keyManager.hasValidKeys()) {
      openSettingsSurfaceTracked('api-management');
    }
  }, [openSettingsSurfaceTracked]);

  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false);
    localStorage.setItem('kk_tutorial_seen', 'true');
  }, []);

  const handleMigrateSelection = useCallback((targetCanvasId: string) => {
    if (targetCanvasId === '__new__') {
      const newCanvasId = createCanvas();
      if (newCanvasId) {
        const originalCanvasId = state.activeCanvasId;
        switchCanvas(originalCanvasId);
        setTimeout(() => {
          migrateNodes(selectedNodeIds, newCanvasId);
          switchCanvas(newCanvasId);

          import('./services/system/notificationService').then(({ notify }) => {
            notify.success('迁移成功', `已创建新项目并迁移 ${selectedNodeIds.length} 个项目`);
          });
        }, 50);
      }
    } else {
      migrateNodes(selectedNodeIds, targetCanvasId);
    }

    setShowMigrateModal(false);
    clearSelection();
  }, [clearSelection, createCanvas, migrateNodes, selectedNodeIds, state.activeCanvasId, switchCanvas]);

  // [Blocking Load] Wait for Canvas Hydration to prevent "Triple Load" flash
  // Keep this after all hooks so the hook order stays stable across renders.
  if (!isReady) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  const projectManagerNode = !isMobile ? (
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
  ) : null;

  const globalModalsProps: AppGlobalModalsProps = {
    projectManager: projectManagerNode,
    tagModal: {
      isOpen: isTagModalOpen,
      onClose: () => setIsTagModalOpen(false),
      initialTags,
      onSave: handleSaveTags,
      maxTags: tagLimits.maxTags,
      maxChars: tagLimits.maxChars,
      allTags,
      inheritedTags,
      isSubCard,
    },
    profileModal: {
      isOpen: showProfileModal,
      onClose: () => setShowProfileModal(false),
      user,
      onSignOut: signOut,
      initialView: profileInitialView,
      isMobile,
    },
    settingsPanel: {
      isOpen: showSettingsPanel,
      sessionKey: settingsPanelSessionKey,
      initialView: settingsInitialView,
      initialSupplier: settingsInitialSupplier,
      onClose: handleCloseSettingsPanel,
    },
    storageModal: {
      isOpen: showStorageModal,
      onComplete: handleStorageSelectionComplete,
    },
    lightbox: {
      images: previewImages,
      initialIndex: previewInitialIndex,
      onClose: () => setPreviewImages(null),
      onEditPptDeck: handleOpenPptDeckEditorFromImage,
      onEditText: handleEditPptTextFromLightbox,
      onDownloadPptComposite: handleDownloadPptComposite,
      onPartialRedraw: handlePartialRedrawRequest,
    },
    pptStackPreview: {
      state: pptStackPreview,
      onClose: () => setPptStackPreview(null),
    },
    pptDeckEditor: {
      state: pptDeckEditor,
      resolveBundle: getOrderedPptNodeBundle,
      onClose: () => setPptDeckEditor(null),
      onSave: handleSavePptEditablePages,
    },
    searchPalette: {
      isOpen: isSearchOpen,
      onClose: () => setIsSearchOpen(false),
      promptNodes: activeCanvas?.promptNodes || [],
      groups: activeCanvas?.groups || [],
      onNavigate: handleNavigateToNode,
      onMultiSelectConfirm: handleMultiSelectConfirm,
    },
    tutorial: {
      isVisible: showTutorial,
      onComplete: handleTutorialComplete,
    },
    migrateModal: {
      isOpen: showMigrateModal,
      onClose: () => setShowMigrateModal(false),
      canvases: state.canvases,
      currentCanvasId: state.activeCanvasId,
      selectedCount: selectedNodeIds.length,
      onMigrate: handleMigrateSelection,
    },
    rechargeModal: {
      enabled: billingUiEnabled,
      isOpen: showRechargeModal,
    },
  };


    return (
    <WorkspaceShell
      isMobile={isMobile}
      onMouseDown={handleSelectionMouseDown}
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
      <AppDesktopChrome
        isMobile={isMobile}
        billingUiEnabled={billingUiEnabled}
        remainingBalanceDisplay={remainingBalanceDisplay}
        onRecharge={() => setShowRechargeModal(true)}
        rightOffset={desktopChromeRight}
        user={user}
        avatarUrl={derivedMobileUserAvatarUrl}
        apiStatus={derivedApiStatus}
        showUserMenu={showUserMenu}
        setShowUserMenu={setShowUserMenu}
        onOpenProfile={openProfileSurface}
        onOpenSettings={() => openSettingsSurfaceTracked('dashboard')}
        onSignOut={() => { void signOut(); }}
        isChatOpen={isChatOpen}
        onToggleChat={toggleChatPanel}
      />

      <AppCanvasOverlays
        selectionBox={selectionBox}
        selectionMenu={selectionMenuOverlay}
      />
      <AppMobileWorkspace
        isMobile={isMobile}
        surface={responsiveSurface}
        mobileScreen={mobileScreen}
        setMobileScreen={setMobileScreen}
        onOpenSettings={openCurrentMobileSettingsSurface}
        userName={derivedMobileUserName}
        userAvatarUrl={derivedMobileUserAvatarUrl}
        billingUiEnabled={billingUiEnabled}
        balance={balance}
        billingLoading={billingLoading}
        activeCanvas={activeCanvas}
        frameworkRuntime={ecommerceState.frameworkRuntime}
        projectCount={state.canvases.length}
        focusWorkspace={focusWorkspace}
        setIsSearchOpen={setIsSearchOpen}
        setWorkspaceSurface={setWorkspaceSurface}
        setIsChatOpen={setIsChatOpen}
        openProfileSurface={openProfileSurface}
        onShowRecharge={() => setShowRechargeModal(true)}
        activeEntryId={mobileActiveResultId}
        activeSourceImage={activeSourceImage}
        onEntryOpen={handleMobileResultOpen}
        onPreviewImage={handleOpenPreview}
        onUseResultAsSource={handleMobileUseImageAsSource}
        onPartialRedraw={handleMobileResultPartialRedraw}
        onDownloadEntry={handleMobileResultDownload}
        onDeleteImage={deleteImageNode}
        onEditEcommerceTask={handleMobileEditEcommerceTask}
        onConfirmEcommerceDesktop={handleMobileConfirmEcommerceDesktop}
        onGenerateEcommerceMobile={handleMobileGenerateEcommerceMobile}
        onToggleEcommerceSelected={handleMobileToggleEcommerceSelected}
        promptBarProps={mobilePromptBarProps}
        overlays={workspacePanels}
      />

      {/* Main Infinite Canvas - 仅在非手机端显示 */}
      {!isMobile && (
      <InfiniteCanvas
        id="canvas-container"
        ref={canvasRef}
        showGrid={showGrid}
        onTransformChange={handleCanvasTransformChange}
        onInteractionChange={handleCanvasInteractionChange}
        cardPositions={[
          ...(activeCanvas?.promptNodes
            .filter((n) => !n.hiddenInCanvas)
            .filter((n) => !(
              n.mode === GenerationMode.ECOMMERCE
              && n.ecommerce?.frameworkId
              && n.ecommerce.kind !== 'framework'
            ))
            .map(n => n.position) || []),
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

              // 计算需要的 transform，使目标卡片居中
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
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
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
              /* Keep parent-child card connectors light gray. */

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
            const sourcePosition = resolveConnectorRenderPosition(sourceNode.id, sourceNode.position);
            const promptPosition = resolveConnectorRenderPosition(pn.id, pn.position);
            if (!sourcePosition || !promptPosition) return null;

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
            const isRedrawMode = pn.mode === GenerationMode.REDRAW || pn.mode === GenerationMode.INPAINT;
            const baseColor = isRedrawMode ? '#22c55e' : '#eab308';
            const hoverClass = isRedrawMode ? 'group-hover:stroke-green-400' : 'group-hover:stroke-yellow-400';

            return (
              <g key={`followup-${pn.id}`} className={showConnectorButtons ? 'group' : undefined}>
                {/* Curve - Bottom Layer */}
                <path
                  d={d}
                  fill="none"
                  stroke={baseColor}
                  strokeWidth={connectorStroke}
                  strokeDasharray={connectorStrokeDasharray}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap={connectorStrokeLinecap}
                  strokeLinejoin="round"
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
                  <ConnectorDisconnectButton
                    x={btnX}
                    y={btnY}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDisconnectPrompt(pn.id);
                    }}
                  />
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
            const sourcePosition = resolveConnectorRenderPosition(sourceNode.id, sourceNode.position);
            if (!sourcePosition) return null;

            // Position + 5000 Offset
            const startX = sourcePosition.x + 5000;
            const startY = sourcePosition.y + 5000;

            // Pending Node Position (Bottom Center)
            const endX = pendingPosition.x + 5000;
            const endY = (pendingPosition.y - 140) + 5000;

            const d = buildSoftConnectorPath(startX, startY, endX, endY);

            const { x: btnX, y: btnY } = getSoftConnectorPointAt(startX, startY, endX, endY, 0.5);

            /* Pending connection colors follow the active generation mode. */
            const isRedrawMode = config.mode === GenerationMode.REDRAW || config.mode === GenerationMode.INPAINT;
            const baseColor = isRedrawMode ? '#22c55e' : '#eab308';
            const hoverClass = isRedrawMode ? 'group-hover:stroke-green-400' : 'group-hover:stroke-yellow-400';

            return (
              <g key="pending-connection" className={showConnectorButtons ? 'group' : undefined}>
                <path
                  d={d}
                  fill="none"
                  stroke={baseColor}
                  strokeWidth={connectorStroke}
                  strokeDasharray={connectorStrokeDasharray}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap={connectorStrokeLinecap}
                  strokeLinejoin="round"
                  opacity="0.5"
                  className={showConnectorButtons ? `transition-opacity duration-200 ${hoverClass} group-hover:opacity-100` : undefined}
                />
                {showConnectorHitAreas && (
                  <path d={d} stroke="transparent" strokeWidth={connectorHitStroke} fill="none" className="pointer-events-auto cursor-pointer" />
                )}
                <circle cx={startX} cy={startY} r={connectorDotStart} fill={baseColor} opacity="0.6" />
                <circle cx={endX} cy={endY} r={connectorDotEnd} fill={baseColor} opacity="0.5" />

                {showConnectorButtons && (
                  <ConnectorDisconnectButton
                    x={btnX}
                    y={btnY}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSourceImage(null);
                      setConfig(prev => ({ ...prev, referenceImages: [] }));
                    }}
                  />
                )}
              </g>
            );
          })()}

          {/* C. Workflow Utility Connections */}
          {(activeCanvas?.workflow?.edges || []).map((edge) => {
            const targetNode = connectorRenderWorkflowUtilityNodesById.get(edge.to);
            if (!targetNode) return null;

            const sourcePrompt = promptNodesById.get(edge.from);
            const sourceImage = imageNodesById.get(edge.from);
            const sourceUtility = connectorRenderWorkflowUtilityNodesById.get(edge.from)
              ?? workflowUtilityNodesById.get(edge.from);
            if (!sourcePrompt && !sourceImage && !sourceUtility) return null;
            const sourcePromptPosition = sourcePrompt
              ? resolveConnectorRenderPosition(sourcePrompt.id, sourcePrompt.position)
              : null;
            const sourceImagePosition = sourceImage
              ? resolveConnectorRenderPosition(sourceImage.id, sourceImage.position)
              : null;
            const sourceUtilityPosition = sourceUtility
              ? resolveConnectorRenderPosition(sourceUtility.id, sourceUtility.position)
              : null;
            const targetPosition = resolveConnectorRenderPosition(targetNode.id, targetNode.position);
            if (!targetPosition) return null;

            const startX = (sourcePromptPosition?.x || sourceImagePosition?.x || sourceUtilityPosition?.x || 0) + 5000;
            const startY = (sourcePromptPosition?.y || sourceImagePosition?.y || sourceUtilityPosition?.y || 0) + 5000;
            const targetHeight = targetNode.height || 176;
            const endX = targetPosition.x + 5000;
            const endY = (targetPosition.y - targetHeight) + 5000;
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
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap={connectorStrokeLinecap}
                  strokeLinejoin="round"
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
              onSelect={() => selectNodeFromCurrentEvent(node.id)}
              onClickPrompt={handlePromptClick}
              onConnectStart={handleConnectStart}
              zoomScale={canvasTransform.scale}
              isCanvasTransforming={isCanvasTransforming}
              isMobile={isMobile}
              sourcePosition={node.sourceImageId
                ? activeCanvas?.imageNodes.find(n => n.id === node.sourceImageId)?.position
                : undefined
              }
              {...getSharedPromptNodeActionProps(node)}
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
                {...getSharedImageNodeProps(childNode)}
                detailLevel="full"
                groupLayerZIndex={promptGroupLayerById.get(node.id) ?? childNode.zIndex ?? 0}
                stackZIndexOverride={promptGroupStackZIndexById.get(node.id)}
                position={childNode.position}
                highlighted={highlightedId === childNode.id}
                onBringToFront={() => bringNodesToFront([childNode.id])}
                isSelected={selectedNodeIds.includes(childNode.id)}
                onSelect={() => selectNodeFromCurrentEvent(childNode.id)}
                onDragDelta={handleLegacyImageRelativeDrag}
              />
            ))}
          </React.Fragment>
        ))}
        {false && standaloneVisibleImageNodes.map(node => (
          <ImageNode
            key={node.id}
            {...getSharedImageNodeProps(node)}
            detailLevel={canvasPerformanceProfile.cardDetailLevel}
            groupLayerZIndex={node.parentPromptId
              ? (promptGroupLayerById.get(node.parentPromptId) ?? node.zIndex ?? 0)
              : (node.zIndex ?? 0)}
            stackZIndexOverride={node.parentPromptId
              ? promptGroupStackZIndexById.get(node.parentPromptId)
              : standaloneImageStackZIndexById.get(node.id)}
            position={node.position}
            onDragDelta={handleLegacyImageRelativeDrag}
          />
        ))}

        {/* 4. Pending / Typing Node */}
        {/* 4. Pending / Typing Node - Removed (Now handled by Persistent Draft DraftNode) */}
        {/* <PendingNode ... /> removed */}
      </InfiniteCanvas>
      )}



      {!isMobile && (
        <AppPromptComposer
          variant="desktop"
          promptBarProps={desktopPromptBarProps}
        />
      )}

      {!isMobile && workspacePanels}

      <AppGlobalModals {...globalModalsProps} />



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


    </WorkspaceShell>
  );
};

const App: React.FC = () => {
  const [showCostEstimation, setShowCostEstimation] = useState(false);
  const rootMode = createAppRootMode({ pathname: window.location.pathname });

  // Initialize update check on mount (must be before any conditional returns per React Rules of Hooks)
  useEffect(() => {
    // Dynamic Import for Update Check
    import('./services/system/updateCheck').then(({ initUpdateCheck }) => {
      initUpdateCheck();
    });
  }, []);

  return (
    <ThemeProvider>
      <AppStartupProvider>
        <BillingProvider>
          <CanvasProvider>
            <AuthenticatedAppShell
              showCostEstimation={rootMode === 'workspace' ? showCostEstimation : false}
              onExitCostEstimation={() => setShowCostEstimation(false)}
              showStartupBanner={rootMode === 'workspace'}
              AppContentComponent={rootMode === 'settings' ? SettingsPageRoot : AppContent}
            />
          </CanvasProvider>
        </BillingProvider>
      </AppStartupProvider>
    </ThemeProvider>
  );
};

export default App;
// Force Rebuild
