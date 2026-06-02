import React, { useState, useCallback, useRef, useEffect, useLayoutEffect, startTransition } from 'react';
import InfiniteCanvas, { type InfiniteCanvasHandle } from './components/canvas/InfiniteCanvas';
import ImageNode from './components/image/ImageCard';
import PromptNodeComponent from './components/canvas/PromptNodeComponent';
// KeyManagerModal removed - integrated into UserProfileModal
import { APP_DISPLAY_VERSION } from './config/appInfo';
import { AspectRatio, ImageSize, type GenerationConfig, type PromptNode, type GeneratedImage, GenerationMode, KnownModel, type CanvasGroup, type RedrawRequest, type RedrawCropPlan, type MobileResultEntry, type MobileSurfaceScreen, type EcommerceEditableTaskState, type EcommerceGroupSheet, type EcommerceSheetSetting, type EcommerceFrameworkRuntimeState } from './types';
import { CanvasGroupComponent } from './components/canvas/CanvasGroupComponent';
import { generateImage, cancelGeneration } from './services/llm/geminiService';
import { getModelCredits } from './services/model/modelPricing';
import { keyManager, getModelMetadata, normalizeModelId } from './services/auth/keyManager';
import { adminModelService } from './services/model/adminModelService';
import { unifiedModelService } from './services/model/unifiedModelService';
import { buildRedrawReferenceImage } from './services/image/partialRedraw';
import { analyzeEcommerceRequirementFile } from './services/ecommerce/ecommerceAnalysisClient.ts';
import type { EcommerceAnalysisResult } from './services/ecommerce/types';
import type { EcommerceGroupSlotState } from './services/ecommerce/groupSlotState.ts';
import { llmService } from './services/llm/LLMService';
import { cancelSecureSystemProxyTask } from './services/model/secureModelProxy';
import { getCardDimensions } from './utils/styleUtils';
import { buildGeneratedImageBatchPositions } from './utils/generatedImageLayout';
import { getViewportPreferredPosition } from './utils/canvasUtils';
import { resolveModelDisplayName } from './utils/modelDisplayName';
import { resolveProviderIdentity } from './utils/providerDisplay';
import { pickByDocumentLanguage } from './utils/localeText';
import { getPromptNodeBoundsWidth } from './utils/promptNodeCardWidth';
import { generateDownloadFilename, triggerDownload } from './utils/downloadUtils';
import {
  getReferenceImageLookupIds,
  normalizeReferenceImagesStorage,
} from './utils/referenceImageStorage';
import type { CanvasInteractionPhase } from './canvas/liveScene';
import AppPromptComposer from './app/AppPromptComposer';
import AppGlobalModals, { type AppGlobalModalsProps } from './app/AppGlobalModals';
import {
  type AgentRenderItem,
  type CanvasRenderItem,
  type ImageRenderItem,
  type PreviewRenderItem,
  type PromptGroupLayoutPresentationState,
  type PromptGroupRenderItem,
  type SaveRenderItem,
  type ScheduledImageLoadState,
  type WorkflowUtilityCanvasNode,
} from './app/appCanvasTypes';
import { buildSoftConnectorPath, getSoftConnectorPointAt } from './canvas/connectorGeometry';
import AppDesktopChrome from './app/AppDesktopChrome';
import AppZoomControl from './app/AppZoomControl';
import AppCanvasOverlays from './app/AppCanvasOverlays';
import { getCollapsedCanvasGroupNodeIds } from './app/collapsedCanvasGroups';
import AppMobileWorkspace from './app/AppMobileWorkspace';
import { resolveFollowUpDraftPosition } from './app/followUpDraftPosition';
import { buildPromptGroupRenderLayout } from './app/promptGroupRenderLayout';
import { useAppPromptBarProps } from './app/useAppPromptBarProps';
import { useCanvasDragConnection } from './app/useCanvasDragConnection';
import { useCanvasSelectionBox } from './app/useCanvasSelectionBox';
import { useCanvasNodeSelection } from './app/useCanvasNodeSelection';
import { useDraftNodeSync } from './app/useDraftNodeSync';
import { useGenerationPlacement } from './app/useGenerationPlacement';
import { useGenerationReferenceImages } from './app/useGenerationReferenceImages';
import { useGenerationSubmitGuard } from './app/useGenerationSubmitGuard';
import { usePromptGroupDragHandlers } from './app/usePromptGroupDragHandlers';
import { usePromptGroupSelection } from './app/usePromptGroupSelection';
import { useSelectionMenuOverlay } from './app/useSelectionMenuOverlay';
import { useWorkflowSourceResolvers } from './app/useWorkflowSourceResolvers';
import { useWorkflowActions } from './app/useWorkflowActions';
import { useConnectorRenderer } from './app/useConnectorRenderer';
import { usePromptGroupLayout, usePromptGroupStacking } from './app/usePromptGroupLayout';
import { useGenerationRuntime } from './app/useGenerationRuntime';
import { usePptRuntime } from './app/usePptRuntime';
import { useEcommerceRuntime, type UpdateEcommerceSelectionState } from './app/useEcommerceRuntime';
import { useEcommerceFrameworkRuntimeState, type SetEcommerceFrameworkRuntimeState } from './app/useEcommerceFrameworkRuntimeState';
import { useEcommerceSlotHistoryRuntime } from './app/useEcommerceSlotHistoryRuntime';
import {
  useEcommerceUploadReferenceRuntime,
  type EcommerceManualReferenceBinding,
  type SetEcommerceUploadReferenceState,
} from './app/useEcommerceUploadReferenceRuntime';
import { useEcommerceGroupExportRuntime, type SetEcommerceGroupExportState } from './app/useEcommerceGroupExportRuntime';
import {
  createDefaultEcommerceSheetSettings,
  useEcommerceSheetSettingsRuntime,
  type SetEcommerceSheetSettingsState,
} from './app/useEcommerceSheetSettingsRuntime';
import {
  useEcommerceTaskStateRuntime,
  type SetEcommerceTaskStateRuntimeState,
} from './app/useEcommerceTaskStateRuntime';
import {
  createEmptyEcommerceGroupSlots,
  useEcommerceRequirementAnalysisRuntime,
  type SetEcommerceRequirementAnalysisState,
} from './app/useEcommerceRequirementAnalysisRuntime';
import {
  useEcommerceBuildRuntime,
  type SetEcommerceBuildRuntimeState,
} from './app/useEcommerceBuildRuntime';
import {
  useEcommercePostBuildSyncRuntime,
  type SetEcommercePostBuildSyncState,
} from './app/useEcommercePostBuildSyncRuntime';
import {
  useEcommerceNodeGenerationRuntime,
  type SetEcommerceNodeGenerationRuntimeState,
} from './app/useEcommerceNodeGenerationRuntime';
import { useEcommerceMobileContinuationRuntime } from './app/useEcommerceMobileContinuationRuntime';
import {
  useEcommerceTaskActivationRuntime,
  type SetEcommerceTaskActivationRuntimeState,
} from './app/useEcommerceTaskActivationRuntime';
import {
  useEcommercePromptActivationRuntime,
  type SetEcommercePromptActivationRuntimeState,
} from './app/useEcommercePromptActivationRuntime';
import {
  useEcommerceSourceSelectionRuntime,
} from './app/useEcommerceSourceSelectionRuntime';
import { useEcommercePartialRedrawRuntime } from './app/useEcommercePartialRedrawRuntime';
import { useEcommerceModeRuntime, type SetEcommerceModeRuntimeState } from './app/useEcommerceModeRuntime';
import { useEcommerceSubmitRuntime } from './app/useEcommerceSubmitRuntime';
import { isCompactResponsiveSurface, resolveResponsiveSurface } from './utils/responsiveSurface';

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
  | 'onOptimizeEcommerceTaskPrompt'
  | 'onRegenerateUnsatisfiedEcommerceNode'
  | 'onGenerateEcommerceGroup'
  | 'onGenerateEcommerceFramework'
  | 'onPauseEcommerceFramework'
  | 'onResumeEcommerceFramework'
  | 'onPauseEcommerceNodeQueue'
  | 'onResumeEcommerceNodeQueue'
  | 'onSetEcommerceFrameworkConcurrency'
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
  | 'snapToGrid'
>;

type ConnectorDisconnectButtonProps = {
  x: number;
  y: number;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
};


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
      title="鏂紑杩炴帴"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </div>
  </foreignObject>
);

// Lucide icons replaced with SVGs
import { CanvasProvider, useCanvas } from './context/CanvasContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppStartupProvider, useAppStartup } from './context/AppStartupContext';
import { AuthenticatedAppShell } from './app/AuthenticatedAppShell';
import { KKAI_FEATURE_FLAGS } from './app/kkaiFeatureFlags';
import { createAppRootMode } from './context/kkaiRuntimeContext';
import type { UserProfileView } from './components/modals/UserProfileModal';
import { useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';
import { BillingProvider, useBilling } from './context/BillingContext';
import { formatRemainingCredits } from './services/billing/remainingBalance';
import {
  isCapabilityRouteAssignmentRouteDisabled,
  resolveEnabledCapabilityRouteAssignment,
} from './services/api/capabilityRouteAssignments';


// import { syncService } from './services/system/syncService'; // [FIX] Dynamic Import
import { saveOriginalImage, normalizePersistableMediaSource } from './services/storage/imageStorage';
import { cancelImageLoad, loadImage } from './services/image/imageLoader';
import { ImageQuality } from './services/image/imageQuality';
import { calculateImageHash } from './utils/imageUtils';
import { useImageGeneration } from './hooks/useImageGeneration';
import { useWorkspaceSurface, type SettingsSurfaceView } from './hooks/useWorkspaceSurface';
import { WorkspaceSurfacePanels } from './components/workspace/WorkspaceSurfacePanels';
// import { notify } from './services/system/notificationService'; // [FIX] Dynamic Import

// ProjectManager imported from components
import ProjectManager from './components/settings/ProjectManager';
import GpuBackground from './components/layout/GpuBackground';
import type { Supplier } from './services/billing/supplierService';
import { resolveAvatarUrl } from './utils/presetAvatars';
import { cleanupImagesOlderThan, cleanupOriginalsOlderThan, getStrictOriginalImage } from './services/storage/imageStorage';
import { cleanupCompletedTasksOlderThan } from './services/persistence/taskPersistence';
import { traceLocalPerformance } from './services/system/localPerformanceTrace';
import { cleanupLogsOlderThan } from './services/system/systemLogService';
import { ensureMobileRetentionPreference, getMobileRetentionPreference, MOBILE_RETENTION_PREFERENCE_KEY } from './services/storage/mobileRetentionPreference';
import { lazyWithRetry, lazyNamedWithRetry } from './utils/lazyWithRetry';
const SettingsPageRoot = lazyWithRetry(() => import('./app/SettingsPageRoot'));
const AdminLayout = lazyNamedWithRetry(() => import('./pages/admin/AdminLayout.tsx'), 'AdminLayout');
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
} from './canvas/performanceProfile';

interface AppContentProps {
}

type DesktopSideRailLayout = {
  projectManagerScale: number;
  hideZoomControl: boolean;
};

const DEFAULT_DESKTOP_SIDE_RAIL_LAYOUT: DesktopSideRailLayout = {
  projectManagerScale: 1,
  hideZoomControl: false,
};

const AppContent: React.FC<AppContentProps> = () => {
  const billingUiEnabled = KKAI_FEATURE_FLAGS.billing;
  const {
    user,
    loading: authLoading,
    isTempUser,
    signOut
  } = useAuth();
  const { advanceTo } = useAppStartup();
  const [showTutorial, setShowTutorial] = useState(false);
  const [desktopSideRailLayout, setDesktopSideRailLayout] = useState<DesktopSideRailLayout>(DEFAULT_DESKTOP_SIDE_RAIL_LAYOUT);
  const desktopSideRailLayoutRef = useRef<DesktopSideRailLayout>(DEFAULT_DESKTOP_SIDE_RAIL_LAYOUT);
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
    linkNodes,
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
    moveSelectedNodesImmediate,
    addWorkflowNode,
    updateWorkflowNodePosition,
    deleteWorkflowNode,
    isReady,
    isLoading,
    loadingProgress,
    setViewportCenter, // 简体中文注释：迁移时保留当前视口中心，避免画布跳动。
    state, // 简体中文注释：迁移功能需要读取完整画布列表。
    migrateNodes, // 简体中文注释：将选中的节点迁移到其他项目。
    createCanvas, // 简体中文注释：必要时创建新的目标项目。
    switchCanvas  // 简体中文注释：迁移完成后切换到目标项目。
  } = useCanvas();

  const imageNodesById = React.useMemo(
    () => new Map((activeCanvas?.imageNodes || []).map(node => [node.id, node])),
    [activeCanvas]
  );

  const promptNodesById = React.useMemo(
    () => new Map((activeCanvas?.promptNodes || []).map(node => [node.id, node])),
    [activeCanvas]
  );

  const ecommerceFrameworkTaskNodesById = React.useMemo(() => {
    const taskNodesByFrameworkId = new Map<string, PromptNode[]>();
    (activeCanvas?.promptNodes || []).forEach((node) => {
      const frameworkId = node.ecommerce?.frameworkId;
      if (
        !frameworkId
        || node.mode !== GenerationMode.ECOMMERCE
        || (node.ecommerce?.kind !== 'main-image' && node.ecommerce?.kind !== 'a-plus-module')
      ) {
        return;
      }

      const existingTaskNodes = taskNodesByFrameworkId.get(frameworkId) || [];
      existingTaskNodes.push(node);
      taskNodesByFrameworkId.set(frameworkId, existingTaskNodes);
    });
    return taskNodesByFrameworkId;
  }, [activeCanvas]);

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
  const handleToggleSnapToGrid = () => setSnapToGrid(prev => !prev);



  // Ref to access fresh state in async functions (fixing Stale Closure issue)
  const activeCanvasRef = useRef(activeCanvas);
  useLayoutEffect(() => {
    activeCanvasRef.current = activeCanvas;
  }, [activeCanvas]);

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


  // Track reserved regions for rapid-fire generation to prevent overlaps (before React update reflects)
  const reservedRegionsRef = useRef<{ bounds: { x: number; y: number; width: number; height: number }; timestamp: number; }[]>([]);



  // [鏂板姛鑳絔 鍏ㄥ眬鐏鐘舵€侊紙閽堝鍥剧墖娴忚锛?
  const [previewImages, setPreviewImages] = useState<GeneratedImage[] | null>(null);
  const [previewInitialIndex, setPreviewInitialIndex] = useState(0);
  const [pptStackPreview, setPptStackPreview] = useState<{ images: GeneratedImage[]; initialIndex: number } | null>(null);
  const [pptDeckEditor, setPptDeckEditor] = useState<{ nodeId: string; initialIndex: number } | null>(null);
  const [showMigrateModal, setShowMigrateModal] = useState(false); // 馃幆 杩佺Щ寮圭獥鐘舵€?
  const {
    buildPptPageAlias,
    getOrderedPptNodeBundle,
    resolvePptImageBlob,
    tryOpenPptPreview,
    handleExportPptPackageEditable,
    handleExportPptxEditable,
    handleDownloadPptComposite,
    handleExportPptSinglePage,
    handleEditPptTextFromLightbox,
    handleSavePptEditablePages,
    handleOpenPptDeckEditor,
    handleOpenPptDeckEditorFromImage,
    handleOpenPptStackPreview,
    isPptDeckChildImageNode,
    resolveCurrentPromptChildImages,
  } = usePptRuntime({
    activeCanvasRef,
    pickByDocumentLanguage,
    setPreviewImages,
    setPreviewInitialIndex,
    setPptDeckEditor,
    setPptStackPreview,
    updateImageNode,
    updatePromptNode,
  });

  const handleOpenPreview = useCallback((imageId: string) => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    if (tryOpenPptPreview(imageId)) {
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
        // 3. 鍏滃簳閫昏緫锛堝崟寮犲浘鐗囷級
        const target = canvas.imageNodes.find(n => n.id === imageId);
        if (target) list = [target];
      }
    }

    if (list.length > 0) {
      const idx = list.findIndex(n => n.id === imageId);
      setPreviewImages(list);
      setPreviewInitialIndex(idx >= 0 ? idx : 0);
    }
  }, [activeCanvasRef, tryOpenPptPreview]);

  const handleLightboxDeleteImage = useCallback((imageId: string) => {
    deleteImageNode(imageId);
    setPreviewImages((images) => {
      if (!images) return images;
      const nextImages = images.filter((image) => image.id !== imageId);
      if (nextImages.length === 0) {
        setPreviewInitialIndex(0);
        return null;
      }
      setPreviewInitialIndex((index) => Math.max(0, Math.min(index, nextImages.length - 1)));
      return nextImages;
    });
  }, [deleteImageNode]);

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
  const [snapToGrid, setSnapToGrid] = useState(false);
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
      console.log('[handleShowMobileNav] 璁剧疆 5 绉掕嚜鍔ㄩ殣钘忓畾鏃跺櫒');
      mobileNavTimerRef.current = setTimeout(() => {
        console.log('[handleShowMobileNav] 5 绉掑悗鑷姩闅愯棌');
        setIsMobileNavVisible(false);
      }, 5000);
    } else {
      console.log('[handleShowMobileNav] 跳过自动隐藏，当前仍有交互', { isPromptFocused, isSidebarHovered, isMouseActive });
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

  // 馃幆 New State for enhanced TagInputModal
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

    // 馃幆 Collect all existing tags from canvas for suggestions
    setAllTags(allCanvasTags);

    // Determine if editing Sub Card and find inherited tags
    if (imageNode) {
      // 馃幆 Sub Card - find parent's tags
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

    // 馃幆 Deduplication Logic: If Main Card adds a tag, remove from its Sub Cards
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

    // 馃幆 File System Shortcut Integration
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
        const { getStorageMode, isMobileDevice } = await import('./services/storage/storagePreference');
        let storageMode = await getStorageMode();

        const isMobilePhone = isMobileDevice();

        if (isMobilePhone) {
          // 手机端直接默认使用 browser 存储模式，不弹出选择弹窗，且静默将其设为 'browser'
          if (!storageMode || storageMode !== 'browser') {
            localStorage.setItem('kk_studio_storage_mode', 'browser');
            storageMode = 'browser';
          }

          // 向浏览器申请持久化存储，延长数据在手机浏览器的保存寿命
          if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().then(granted => {
              if (granted) {
                console.log('[Storage] 手机浏览器已授予持久化存储权限。');
              } else {
                console.log('[Storage] 手机浏览器未授予持久化存储权限（可能会受系统清理影响）。');
              }
            }).catch(e => {
              console.warn('[Storage] 申请持久化存储错误:', e);
            });
          }

          // 提醒用户生成的内容需要及时下载保持，避免不必要的丢失风险
          import('./services/system/notificationService').then(({ notify }) => {
            notify.warning('安全提醒', '手机端数据保存在浏览器本地，请及时下载保存生成的内容，避免数据丢失风险。');
          }).catch(err => console.error('[App] Failed to notify mobile storage warning:', err));
        }

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

  const updateEcommerceUploadReferenceState = useCallback<SetEcommerceUploadReferenceState>((updater) => {
    setEcommerceState((previousState) => {
      const patch = updater({
        productFiles: previousState.productFiles,
        extraReferenceFiles: previousState.extraReferenceFiles,
        itemReferenceFiles: previousState.itemReferenceFiles,
      });
      return patch ? { ...previousState, ...patch } : previousState;
    });
  }, []);

  const updateEcommerceFrameworkRuntimeState = useCallback<SetEcommerceFrameworkRuntimeState>((updater) => {
    setEcommerceState((previousState) => {
      const patch = updater(previousState);
      return patch ? { ...previousState, ...patch } : previousState;
    });
  }, []);

  const updateEcommerceGroupExportState = useCallback<SetEcommerceGroupExportState>((updater) => {
    setEcommerceState((previousState) => {
      const patch = updater({
        analysisConfirmed: previousState.analysisConfirmed,
        selectedItems: previousState.selectedItems,
        groupSlots: previousState.groupSlots,
      });
      return patch ? { ...previousState, ...patch } : previousState;
    });
  }, []);

  const updateEcommerceSheetSettingsState = useCallback<SetEcommerceSheetSettingsState>((updater) => {
    setEcommerceState((previousState) => {
      const patch = updater({
        sheetSettings: previousState.sheetSettings,
        taskStates: previousState.taskStates,
        activeTaskState: previousState.activeTaskState,
      });
      return patch ? { ...previousState, ...patch } : previousState;
    });
  }, []);

  const updateEcommerceTaskStateRuntimeState = useCallback<SetEcommerceTaskStateRuntimeState>((updater) => {
    setEcommerceState((previousState) => {
      const patch = updater({
        taskStates: previousState.taskStates,
        activeTaskState: previousState.activeTaskState,
      });
      return patch ? { ...previousState, ...patch } : previousState;
    });
  }, []);

  const updateEcommerceRequirementAnalysisState = useCallback<SetEcommerceRequirementAnalysisState>((updater) => {
    setEcommerceState((previousState) => {
      const patch = updater({
        requirementFile: previousState.requirementFile,
        productFiles: previousState.productFiles,
        itemReferenceFiles: previousState.itemReferenceFiles,
        analysis: previousState.analysis,
        analysisConfirmed: previousState.analysisConfirmed,
        selectedItems: previousState.selectedItems,
        taskStates: previousState.taskStates,
        groupSlots: previousState.groupSlots,
        activeTaskNodeId: previousState.activeTaskNodeId,
        activeTaskState: previousState.activeTaskState,
        activeGroupSheet: previousState.activeGroupSheet,
        isAnalyzing: previousState.isAnalyzing,
        isConfirmingAnalysis: previousState.isConfirmingAnalysis,
      });
      return patch ? { ...previousState, ...patch } : previousState;
    });
  }, []);

  const updateEcommerceBuildRuntimeState = useCallback<SetEcommerceBuildRuntimeState>((updater) => {
    setEcommerceState((previousState) => {
      const patch = updater({
        requirementFile: previousState.requirementFile,
        productFiles: previousState.productFiles,
        extraReferenceFiles: previousState.extraReferenceFiles,
        itemReferenceFiles: previousState.itemReferenceFiles,
        analysis: previousState.analysis,
        analysisConfirmed: previousState.analysisConfirmed,
        selectedItems: previousState.selectedItems,
        taskStates: previousState.taskStates,
        sheetSettings: previousState.sheetSettings,
        groupSlots: previousState.groupSlots,
        activeTaskNodeId: previousState.activeTaskNodeId,
        activeTaskState: previousState.activeTaskState,
        activeFrameworkId: previousState.activeFrameworkId,
        activeGroupSheet: previousState.activeGroupSheet,
        frameworkRuntime: previousState.frameworkRuntime,
        isConfirmingAnalysis: previousState.isConfirmingAnalysis,
      });
      return patch ? { ...previousState, ...patch } : previousState;
    });
  }, []);

  const updateEcommercePostBuildSyncState = useCallback<SetEcommercePostBuildSyncState>((updater) => {
    setEcommerceState((previousState) => {
      const patch = updater({
        analysis: previousState.analysis,
        analysisConfirmed: previousState.analysisConfirmed,
        taskStates: previousState.taskStates,
        activeTaskNodeId: previousState.activeTaskNodeId,
        activeTaskState: previousState.activeTaskState,
      });
      return patch ? { ...previousState, ...patch } : previousState;
    });
  }, []);

  const updateEcommerceNodeGenerationRuntimeState = useCallback<SetEcommerceNodeGenerationRuntimeState>((updater) => {
    setEcommerceState((previousState) => {
      const patch = updater({
        activeTaskNodeId: previousState.activeTaskNodeId,
        activeTaskState: previousState.activeTaskState,
      });
      return patch ? { ...previousState, ...patch } : previousState;
    });
  }, []);
  const updateEcommerceTaskActivationRuntimeState = useCallback<SetEcommerceTaskActivationRuntimeState>((updater) => {
    setEcommerceState((previousState) => {
      const patch = updater({
        activeTaskNodeId: previousState.activeTaskNodeId,
        activeTaskState: previousState.activeTaskState,
        activeGroupSheet: previousState.activeGroupSheet,
      });
      return patch ? { ...previousState, ...patch } : previousState;
    });
  }, []);
  const updateEcommerceModeRuntimeState = useCallback<SetEcommerceModeRuntimeState>((updater) => {
    setEcommerceState((previousState) => {
      const patch = updater({
        activeTaskNodeId: previousState.activeTaskNodeId,
        activeTaskState: previousState.activeTaskState,
      });
      return patch ? { ...previousState, ...patch } : previousState;
    });
  }, []);
  const updateEcommercePromptActivationRuntimeState = useCallback<SetEcommercePromptActivationRuntimeState>((updater) => {
    setEcommerceState((previousState) => {
      const patch = updater({
        activeTaskNodeId: previousState.activeTaskNodeId,
        activeTaskState: previousState.activeTaskState,
        activeFrameworkId: previousState.activeFrameworkId,
        activeGroupSheet: previousState.activeGroupSheet,
      });
      return patch ? { ...previousState, ...patch } : previousState;
    });
  }, []);

  const frameworkStateView = useEcommerceFrameworkRuntimeState({
    activeCanvas,
    activeCanvasRef,
    ecommerceState,
    setEcommerceState: updateEcommerceFrameworkRuntimeState,
    updatePromptNode,
  });

  const {
    ecommerceFrameworkRuntimeRef,
    resolveEcommerceFrameworkId,
    syncEcommerceFrameworkView,
    handleActivateEcommerceGroupSheet,
  } = frameworkStateView;
  const {
    syncPromptNodeEcommerceSelection,
    resolvePromptNodeFrameworkStatus,
  } = useEcommercePromptActivationRuntime({
    activeCanvasRef,
    ecommerceFrameworkRuntimeRef,
    setEcommercePromptActivationRuntimeState: updateEcommercePromptActivationRuntimeState,
    setEcommerceRatioOverride,
    resolveEcommerceFrameworkId,
    syncEcommerceFrameworkView,
  });
  const {
    resetEcommerceSourceSelectionState,
  } = useEcommerceSourceSelectionRuntime({
    setEcommerceRatioOverride,
    setEcommerceSourceSelectionRuntimeState: updateEcommercePromptActivationRuntimeState,
  });

  const resolveEffectiveEcommerceThinkingMode = useCallback((): 'minimal' | 'high' => (
    config.mode === GenerationMode.ECOMMERCE ? 'high' : (config.thinkingMode || 'minimal')
  ), [config.mode, config.thinkingMode]);

  const {
    resolveEcommerceAPlusControlMode,
    applyEffectiveSizingToTaskState,
    resolveEcommerceNodeGenerationSettings,
    handleUpdateEcommerceSheetSetting,
  } = useEcommerceSheetSettingsRuntime({
    activeCanvasRef,
    configMode: config.mode,
    configModel: config.model,
    ecommerceState,
    setConfig,
    setEcommerceSheetSettingsState: updateEcommerceSheetSettingsState,
    updatePromptNode,
  });

  const {
    buildInitialEcommerceTaskStates,
    handleChangeEcommerceTaskState,
  } = useEcommerceTaskStateRuntime({
    applyEffectiveSizingToTaskState,
    setEcommerceTaskStateRuntimeState: updateEcommerceTaskStateRuntimeState,
  });

  useEcommerceModeRuntime({
    configMode: config.mode,
    configThinkingMode: config.thinkingMode,
    setConfig,
    setEcommerceRatioOverride,
    setEcommerceModeRuntimeState: updateEcommerceModeRuntimeState,
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
    config.prompt, config.videoResolution, config.videoDuration, config.videoAudio, config.audioDuration, config.audioLyrics, config.maskUrl, config.editMode // 鍏ㄩ噺渚濊禆鐩戝惉
  ]);

  // Pending generation state
  // Active source image for continuing conversation
  const [activeSourceImage, setActiveSourceImage] = useState<string | null>(null);

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
        title = 'API 棰勭畻涓ラ噸涓嶈冻';
        sub = '剩余预算低于 1%，请立即充值。';
      } else if (remainingPercent < 10) {
        alertKey = 'warning';
        title = 'API 棰勭畻涓嶈冻';
        sub = '剩余预算低于 10%。';
      } else if (remainingPercent < 20) {
        alertKey = 'low';
        title = 'API 棰勭畻鎻愰啋';
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

  // 🚀 Canvas high-frequency interaction and 2-second debounce load state
  const [isInteractionDeferred, setIsInteractionDeferred] = useState(false);
  const interactionTimerRef = useRef<number | null>(null);

  // 只有在拖动/缩放画布 (isCanvasTransforming) 时才触发加载延迟！
  // 拖动单个卡片时 (isNodeDragActive === true) 绝不变成空卡片，保留完美卡片外观以保证流畅舒适的感知！
  // 同时，只有在卡片数 >= 80 (大型/巨型项目) 时才启用大项目延迟加载防抖机制，保障极限操作下的性能
  const isLargeProject = ((activeCanvas?.promptNodes?.length || 0) + (activeCanvas?.imageNodes?.length || 0)) >= 80;
  const shouldPauseLoading = isCanvasTransforming && isLargeProject;

  useEffect(() => {
    if (shouldPauseLoading) {
      setIsInteractionDeferred(true);
      if (interactionTimerRef.current !== null) {
        window.clearTimeout(interactionTimerRef.current);
        interactionTimerRef.current = null;
      }
    } else {
      if (interactionTimerRef.current !== null) {
        window.clearTimeout(interactionTimerRef.current);
      }
      interactionTimerRef.current = window.setTimeout(() => {
        setIsInteractionDeferred(false);
        interactionTimerRef.current = null;
      }, 2000);
    }

    return () => {
      if (interactionTimerRef.current !== null) {
        window.clearTimeout(interactionTimerRef.current);
      }
    };
  }, [shouldPauseLoading]);

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
    if (isMobile) {
      return;
    }
    e.preventDefault();
  }, [isMobile]);

  const {
    selectionBox,
    handleSelectionMouseDown,
    handleSelectionMouseMove,
    handleSelectionMouseUp,
  } = useCanvasSelectionBox({
    activeCanvas,
    canvasTransform,
    isMobile,
    selectedNodeIds,
    getCardDimensions,
    selectNodes,
    clearSelection,
    closeSelectionMenu: () => setSelectionMenuPosition(null),
    setSelectionMenuPosition,
  });



  // Connection Dragging State
  const [isNodeDragActive, setIsNodeDragActive] = useState(false);
  const { tryStartGenerationSubmission } = useGenerationSubmitGuard();

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

  const {
    buildReferenceImageSignature,
    buildEcommerceImageRefSignature,
    buildTaskStateSyncSignature,
    createReferenceImageFromAsset,
    buildCurrentEcommerceUploadReferences,
    extractEcommerceManualReferenceBindings,
    handlePickEcommerceProductFiles,
    handlePickEcommerceExtraReferenceFiles,
    handleRemoveEcommerceProductFile,
    handleRemoveEcommerceExtraReferenceFile,
    handlePickEcommerceItemReferenceFiles,
    handleRemoveEcommerceItemReferenceFile,
  } = useEcommerceUploadReferenceRuntime({
    ecommerceState,
    setEcommerceUploadReferenceState: updateEcommerceUploadReferenceState,
    readBlobAsDataUrl,
  });

  const {
    handlePickEcommerceRequirementFile,
    handleClearEcommerceRequirementFile,
    handleResetEcommerceAnalysis,
    handleAnalyzeEcommerceRequirement,
  } = useEcommerceRequirementAnalysisRuntime({
    ecommerceState,
    enablePromptOptimization: Boolean(config.enablePromptOptimization),
    readBlobAsDataUrl,
    analyzeRequirementFile: analyzeEcommerceRequirementFile,
    buildInitialEcommerceTaskStates,
    setEcommerceRequirementAnalysisState: updateEcommerceRequirementAnalysisState,
  });

  const { handleConfirmEcommerceAnalysis } = useEcommerceBuildRuntime({
    ecommerceState,
    configModel: config.model,
    configPrompt: config.prompt,
    setConfig,
    setEcommerceBuildRuntimeState: updateEcommerceBuildRuntimeState,
    addPromptNode,
    updatePromptNode,
    bringNodesToFront,
    findNextGroupPosition,
    createEphemeralId,
    buildCurrentEcommerceUploadReferences,
    createReferenceImageFromAsset,
    extractEcommerceManualReferenceBindings,
    applyEffectiveSizingToTaskState,
    resolveEcommerceAPlusControlMode,
  });
  const { handleEcommerceSubmitGuard } = useEcommerceSubmitRuntime({
    hasEcommerceAnalysis: Boolean(ecommerceState.analysis),
    analysisConfirmed: ecommerceState.analysisConfirmed,
    handleAnalyzeEcommerceRequirement,
    handleConfirmEcommerceAnalysis,
  });

  useEcommercePostBuildSyncRuntime({
    activeCanvas,
    ecommerceState,
    setEcommercePostBuildSyncState: updateEcommercePostBuildSyncState,
    updatePromptNode,
    buildCurrentEcommerceUploadReferences,
    buildReferenceImageSignature,
    buildEcommerceImageRefSignature,
    buildTaskStateSyncSignature,
    createReferenceImageFromAsset,
    extractEcommerceManualReferenceBindings,
    applyEffectiveSizingToTaskState,
  });

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

    // User requested "Zoom and Pan" (骞崇Щ骞剁缉鏀?.
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

      // 璁＄畻閫変腑鑺傜偣鐨勪腑蹇冧綅缃?
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

  // 澶勭悊鎷栧叆鍥剧墖骞跺垱寤哄鐙壇鍗?
  const handleImageDrop = useCallback(async (file: File, canvasPosition: { x: number; y: number }) => {
    if (!activeCanvas) return;

    try {
      // 璇诲彇鍥剧墖
      const reader = new FileReader();
      reader.onload = async (e: ProgressEvent<FileReader>) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return;

        // 鑾峰彇鍥剧墖灏哄
        const img = new Image();
        img.onload = async () => {
          const calc = await import('./utils/imageUtils');
          const storageId = await calc.calculateImageHash(dataUrl.split(',')[1]);

          // Persist to storage
          const storage = await import('./services/storage/imageStorage');
          await storage.saveImage(storageId, dataUrl).catch(err =>
            console.error("Failed to save dropped image", err)
          );

          // 璁＄畻瀹介珮姣?
          const calcAspect = (w: number, h: number): AspectRatio => {
            const ratio = w / h;
            if (Math.abs(ratio - 1) < 0.1) return AspectRatio.SQUARE;
            if (ratio < 1) return AspectRatio.PORTRAIT_3_4;
            return AspectRatio.LANDSCAPE_4_3;
          };

          // 鍒涘缓瀛ょ嫭鍓崱
          const newImage: GeneratedImage = {
            id: Date.now().toString(),
            storageId,
            url: dataUrl,
            prompt: `拖入图片：${file.name}`,
            aspectRatio: calcAspect(img.width, img.height),
            timestamp: Date.now(),
            model: 'uploaded',
            canvasId: activeCanvas.id,
            parentPromptId: '', // 瀛ょ嫭鍗＄墖鏃犵埗鑺傜偣
            position: canvasPosition,
            dimensions: `${img.width}脳${img.height}`,
            orphaned: true, // 鏍囪涓哄鐙壇鍗?
            fileName: file.name,
            fileSize: file.size
          };

          addImageNodes([newImage]);

          // 閫氱煡鐢ㄦ埛
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

  

  const {
    handleCancelGeneration,
    handleRetryPptSinglePage,
    prepareInitialGenerationSubmissionContext,
    runInitialGenerationSubmissionTransaction,
    prepareRetryGeneratedMediaExecutionContext,
    completeRetryGeneratedMediaBatch,
  } = useGenerationRuntime({
    activeCanvas,
    updatePromptNode,
    cancelGenerationRequest: cancelGeneration,
    cancelSystemProxyTask: cancelSecureSystemProxyTask,
    updateImageNode,
    authLoading,
    user,
    isTempUser,
    billingLoading,
    balance,
    setShowRechargeModal,
    consumeCreditsDetailed,
    refundCreditsByTransaction,
    refreshBilling,
    adjustBalanceOptimistically,
    applyAuthoritativeBalance,
    rememberPreferredKeyForMode,
    buildPptPageAlias,
    resolveProviderDisplay,
    resolveModelDisplayName,
    resolveNodeRouteState,
    resolveCreditCostForModel,
    generateImage,
  });



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

  const { handleExportEcommerceGroup } = useEcommerceGroupExportRuntime({
    activeCanvas,
    activeCanvasRef,
    ecommerceState,
    setEcommerceGroupExportState: updateEcommerceGroupExportState,
    resolvePptImageBlob,
  });

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
    const submitGuard = tryStartGenerationSubmission({
      config,
      promptOverride,
      activeSourceImage,
    });
    if (!submitGuard.allowed) return;

    if (await handleEcommerceSubmitGuard(submitGuard)) {
      return;
    }

    const trimmedPrompt = submitGuard.trimmedPrompt;

    // Real billing guard and deduction flow
    // Route-aware billing: when the request resolves to a user-owned key/channel,
    // it must never enter the system-credit deduction flow.
    const initialSubmissionContext = await prepareInitialGenerationSubmissionContext({
      config,
      activeCanvasRef,
      activeSourceImage,
      draftNodeId,
      getPreferredKeyForMode,
      hasExplicitModelRoute,
      resolveCreditCostForModel,
    });

    if (!initialSubmissionContext.allowed) {
      return;
    }

    await runInitialGenerationSubmissionTransaction({
      activeSourceImage,
      addPromptNode,
      config,
      deletePromptNode,
      executeGeneration,
      getCanvas: () => activeCanvasRef.current || undefined,
      initialSubmissionContext,
      prepareGenerationReferenceImages,
      rawPrompt: trimmedPrompt,
      resolveGenerationPlacement,
      setActiveSourceImage,
      setConfig,
      setDraftNodeId,
      updateImageNodePosition,
    });
  }, [config, draftNodeId, addPromptNode, updateImageNodePosition, activeSourceImage, executeGeneration, getPreferredKeyForMode, prepareInitialGenerationSubmissionContext, runInitialGenerationSubmissionTransaction, resolveCreditCostForModel, hasExplicitModelRoute, resolveGenerationPlacement, prepareGenerationReferenceImages, deletePromptNode, tryStartGenerationSubmission, handleEcommerceSubmitGuard]);

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

  // --- 杩炴帴绠＄悊 ---
  // 馃幆 [Strict Logic] Disconnect Parent -> Child Group becomes Normal Group
  const handleDisconnectPrompt = useCallback((id: string) => {
    const node = activeCanvas?.promptNodes.find(n => n.id === id);
    if (node && node.sourceImageId) {
      updatePromptNode({ ...node, sourceImageId: undefined });

      // [Draft Logic] If disconnecting draft, clear global source state too
      if (node.id === draftNodeId) {
        setActiveSourceImage(null);
      }

      import('./services/system/notificationService').then(({ notify }) => {
        notify.success('宸叉柇寮€杩炴帴', '鍗＄粍宸叉媶鍒嗕负鐙珛鍗＄粍');
      });
    }
  }, [activeCanvas, updatePromptNode, draftNodeId, setActiveSourceImage]);

  // 馃幆 [Strict Logic] Pin Draft -> Create Lonely Main Card
  const handlePinDraft = useCallback((id: string, _mode: 'button' | 'drag') => {
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
    // 馃幆 [New Requirement] Clear input box and active source
    setConfig(prev => ({ ...prev, prompt: '', referenceImages: [] }));
    setActiveSourceImage(null);

    import('./services/system/notificationService').then(({ notify }) => {
      notify.success('已固定', '草稿已转换为独立卡片');
    });
  }, [activeCanvas, updatePromptNode, setDraftNodeId, setConfig]);

  // Retry Logic (In-Place Regeneration)
  const handleRetryNode = useCallback(async (node: PromptNode) => {
    const retryExecutionContext = await prepareRetryGeneratedMediaExecutionContext({
      node,
      defaultParallelCount: config.parallelCount,
      resolveNodeRouteState,
      recoverFailedSyncBridgeGeneration,
      resolveCreditCostForModel,
    });

    if (!retryExecutionContext.prepared) {
      return;
    }

    const { currentNodeId, count, retryBillingState } = retryExecutionContext;
    const executionNode = retryExecutionContext.executionNode;

    await completeRetryGeneratedMediaBatch({
      addImageNodes,
      applyAuthoritativeBalance,
      buildPptPageAlias,
      buildGeneratedImageBatchPositions,
      calculateImageHash,
      canvasSnapshot: activeCanvasRef.current,
      canvasId: activeCanvasRef.current?.id,
      count,
      currentNodeId,
      executionNode,
      extractErrorDetails,
      generateImage,
      generateVideo: (videoRequest) => llmService.generateVideo(videoRequest),
      getCardDimensions,
      isMobile,
      normalizePersistableMediaSource,
      parentNodeId: node.id,
      resolveModelDisplayName,
      retryBillingState,
      saveOriginalImage,
      sourcePrompt: node.prompt,
      timeoutMs: GENERATE_TIMEOUT_MS,
    });
  }, [config.parallelCount, isMobile, addImageNodes, extractErrorDetails, resolveNodeRouteState, recoverFailedSyncBridgeGeneration, applyAuthoritativeBalance, resolveCreditCostForModel, prepareRetryGeneratedMediaExecutionContext, completeRetryGeneratedMediaBatch, buildPptPageAlias, resolveModelDisplayName, buildGeneratedImageBatchPositions, calculateImageHash, generateImage, getCardDimensions, normalizePersistableMediaSource, saveOriginalImage]);


  const {
    updateEcommerceNodeState,
    handleGenerateEcommerceNode,
    handleOptimizeEcommerceTaskPrompt,
    handleRegenerateUnsatisfiedEcommerceNode,
    handleConfirmEcommerceDesktop,
    handleRetryEcommerceModule,
  } = useEcommerceNodeGenerationRuntime({
    activeCanvasRef,
    ecommerceState,
    setEcommerceNodeGenerationRuntimeState: updateEcommerceNodeGenerationRuntimeState,
    enablePromptOptimization: Boolean(config.enablePromptOptimization),
    configPrompt: config.prompt,
    updatePromptNode,
    handleRetryNode,
    applyEffectiveSizingToTaskState,
    resolveEcommerceNodeGenerationSettings,
    resolveEffectiveEcommerceThinkingMode,
  });

  const updateEcommerceSelectionState = useCallback<UpdateEcommerceSelectionState>((updater) => {
    setEcommerceState((previousState) => ({
      ...previousState,
      ...updater(previousState),
    }));
  }, []);

  const {
    resolveEcommerceSlotState,
    handlePreviewEcommerceSlotHistory,
    handlePreviewEcommerceSlotHistoryForNode,
  } = useEcommerceSlotHistoryRuntime({
    activeCanvasRef,
    ecommerceState,
    setWorkspaceSurface,
    setPreviewImages,
    setPreviewInitialIndex,
  });

  const {
    enqueueEcommerceFrameworkNodes,
    pumpEcommerceFrameworkQueue,
    handleGenerateEcommerceFramework,
    handlePauseEcommerceFramework,
    handleResumeEcommerceFramework,
    handlePauseEcommerceNodeQueue,
    handleResumeEcommerceNodeQueue,
    handleCancelEcommerceFrameworkNodeQueue,
    handleSetEcommerceFrameworkConcurrency,
    handleGenerateEcommerceGroup,
    handleToggleEcommerceAnalysisSelection,
    handleToggleEcommerceSelected,
    handleSetEcommerceGroupSelection,
  } = useEcommerceRuntime({
    activeCanvasRef,
    frameworkStateView,
    ecommerceState,
    updateEcommerceSelectionState,
    updateEcommerceNodeState,
    handleGenerateEcommerceNode,
    handleRetryEcommerceModule,
  });

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
        mode: clickedNode.mode || GenerationMode.IMAGE, // 馃幆 Sync Mode (Image/Video)
      }));

      syncPromptNodeEcommerceSelection(clickedNode);

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
  }, [setConfig, syncPromptNodeEcommerceSelection]);

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
    onOptimizeEcommerceTaskPrompt: handleOptimizeEcommerceTaskPrompt,
    onRegenerateUnsatisfiedEcommerceNode: handleRegenerateUnsatisfiedEcommerceNode,
    onGenerateEcommerceGroup: handleGenerateEcommerceGroup,
    onGenerateEcommerceFramework: handleGenerateEcommerceFramework,
    onPauseEcommerceFramework: handlePauseEcommerceFramework,
    onResumeEcommerceFramework: handleResumeEcommerceFramework,
    onPauseEcommerceNodeQueue: handlePauseEcommerceNodeQueue,
    onResumeEcommerceNodeQueue: handleResumeEcommerceNodeQueue,
    onSetEcommerceFrameworkConcurrency: handleSetEcommerceFrameworkConcurrency,
    onCancelEcommerceNodeQueue: handleCancelEcommerceFrameworkNodeQueue,
    onConfirmEcommerceDesktop: handleConfirmEcommerceDesktop,
    onRetryEcommerceModule: handleRetryEcommerceModule,
    onExportEcommerceGroup: handleExportEcommerceGroup,
    ecommerceFrameworkStatus: resolvePromptNodeFrameworkStatus(node),
    activeEcommerceTaskState: ecommerceState.activeTaskState,
    onActivateEcommerceTask: (promptNode: PromptNode) => {
      syncPromptNodeEcommerceSelection(promptNode);
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
    handleOptimizeEcommerceTaskPrompt,
    handleRegenerateUnsatisfiedEcommerceNode,
    handleOpenPptDeckEditor,
    handlePauseEcommerceFramework,
    handlePauseEcommerceNodeQueue,
    handlePreviewEcommerceSlotHistoryForNode,
    handleResumeEcommerceNodeQueue,
    handleResumeEcommerceFramework,
    handleSetEcommerceFrameworkConcurrency,
    handleRetryEcommerceModule,
    handleRetryNode,
    handleRetryPptSinglePage,
    handleSetEcommerceGroupSelection,
    handleToggleEcommerceSelected,
    openSettingsSurfaceTracked,
    resolvePromptNodeFrameworkStatus,
    resolveEcommerceSlotState,
    syncPromptNodeEcommerceSelection,
    updatePromptNode,
  ]);

  const handleImageClick = useCallback((imageId: string) => {
    // 馃幆 Shift=鍒囨崲锛堝悜鍚庡吋瀹癸級锛屾棤淇グ閿?鏇挎崲
    const sourceImage = imageNodesById.get(imageId);
    // 淇濇寔鐖?Prompt 缁勮仛鐒︼紝浣垮瓙鍗＄墖妗嗗湪鐐瑰嚮鍚庝繚鎸佸彲瑙?
    setFocusedGroupId(sourceImage?.parentPromptId || null);
    selectNodes([imageId], (window.event as any)?.shiftKey ? 'toggle' : 'replace');

    resetEcommerceSourceSelectionState();
    // 馃殌 鐐瑰嚮鍗＄墖鏃朵笉鍐嶅湪鐢诲竷鑷姩鐢熸垚 Draft 妗嗗拰鎷夎繛绾匡紝鐩稿叧浜や簰宸茶浆绉昏嚦鐏
  }, [imageNodesById, selectNodes, resetEcommerceSourceSelectionState]);

  const handleMobileUseImageAsSource = useCallback((imageId: string) => {
    handleImageClick(imageId);
  }, [handleImageClick]);

  // 桌面端在灯箱内继续创作时，将当前图片设为参考图以保持创作链路连续。
  const handleDesktopUseImageAsSource = useCallback((image: GeneratedImage) => {
    const refImg = {
      id: image.id,
      storageId: image.storageId,
      data: image.url,
      mimeType: image.mimeType || 'image/png'
    };
    setConfig(prev => ({
      ...prev,
      referenceImages: [refImg]
    }));
    import('./services/system/notificationService').then(({ notify }) => {
      notify.success('参考图已设置', '已将当前图像设为参考图继续创作');
    });
  }, [setConfig]);
  const {
    resolveEcommercePartialRedrawContext,
    finalizeEcommercePartialRedrawResult,
  } = useEcommercePartialRedrawRuntime({
    activeCanvasRef,
    updateImageNode,
    updatePromptNode,
    deletePromptNode,
  });

  const handleRedrawRequest = useCallback((image: GeneratedImage, request: RedrawRequest) => {
    void (async () => {
      try {
        const plan = request.plan;
        const finalPrompt = (plan?.prompt || request.prompt || '重绘').trim();
        const canvas = activeCanvasRef.current;
        const sourceImage = canvas?.imageNodes.find((img) => img.id === image.id) || image;
        const parentPromptId = sourceImage.parentPromptId;
        const parentPrompt = canvas?.promptNodes.find((promptNode) => promptNode.id === parentPromptId);
        const rootSourceImageUrl = sourceImage.originalUrl || sourceImage.apiResultUrl || sourceImage.url;
        const ecommercePartialRedrawContext = resolveEcommercePartialRedrawContext(sourceImage, parentPrompt);

        let nodePos = { x: sourceImage.position.x, y: sourceImage.position.y + 80 };
        if (parentPrompt && canvas) {
          const siblingImages = canvas.imageNodes.filter((img) => img.parentPromptId === parentPromptId);
          const maxY = siblingImages.reduce((acc, img) => Math.max(acc, img.position.y), parentPrompt.position.y);
          nodePos = { x: sourceImage.position.x, y: maxY + 80 };
        }

        const cropPlans = plan?.mode === 'regional-crops' && plan.cropPlans.length > 0 ? plan.cropPlans : [];
        const executionCrops: Array<RedrawCropPlan | null> = cropPlans.length > 0 ? cropPlans : [null];
        const createdNodes: PromptNode[] = [];
        const generatedRedrawResultIds: string[] = [];
        const extraReferenceImages = [
          ...(plan?.annotatedReferenceImage ? [plan.annotatedReferenceImage] : []),
          ...request.referenceImages,
        ];
        let currentCompositeBaseImageId = sourceImage.id;
        let currentCompositeBaseImageUrl = rootSourceImageUrl;
        let latestRedrawResultId: string | undefined;

        const waitForGeneratedImage = async (promptNodeId: string) => {
          for (let attempt = 0; attempt < 10; attempt += 1) {
            const generatedImageId = activeCanvasRef.current?.promptNodes
              .find((promptNode) => promptNode.id === promptNodeId)
              ?.childImageIds?.[0];
            const generatedImage = generatedImageId
              ? activeCanvasRef.current?.imageNodes.find((imageNode) => imageNode.id === generatedImageId)
              : undefined;
            if (generatedImage) return generatedImage;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          return undefined;
        };

        for (const [index, cropPlan] of executionCrops.entries()) {
          const sourceReference = await buildRedrawReferenceImage(
            currentCompositeBaseImageUrl,
            cropPlan?.generationRect || { x: 0, y: 0, width: 1, height: 1 },
            request.sourceImageDimensions,
            cropPlan ? `redraw-crop-${index + 1}` : 'redraw-full',
          );
          const usesRedrawOnlyModel = Boolean(cropPlan) || plan?.mode === 'color-blocks' || plan?.mode === 'whole-image-marked';
          const nodeModel = normalizeModelId(usesRedrawOnlyModel ? (plan?.model || request.model) : config.model);
          const nodePrompt = cropPlan ? finalPrompt : [
            parentPrompt?.prompt ? `原始提示词：${parentPrompt.prompt}` : '',
            sourceImage.prompt ? `当前图片提示词：${sourceImage.prompt}` : '',
            finalPrompt,
          ].filter(Boolean).join('\n');
          const nodeRedrawMetadata = {
            mode: plan?.mode || (cropPlan ? 'regional-crops' : 'whole-image'),
            sourceImageId: sourceImage.id,
            compositionBaseImageId: cropPlan ? currentCompositeBaseImageId : undefined,
            sourceImageStorageId: sourceImage.storageId,
            sourcePromptId: parentPrompt?.id,
            sourceImageDimensions: request.sourceImageDimensions,
            regions: request.regions,
            cropPlans: cropPlan ? [cropPlan] : (plan?.cropPlans || []),
            targetAspectRatio: cropPlan ? AspectRatio.SQUARE : (plan?.aspectRatio || AspectRatio.AUTO),
            extraReferenceImageIds: extraReferenceImages.map((ref) => ref.storageId || ref.id),
            colorBlocks: request.colorBlocks,
            strictPrompt: plan?.strictPrompt,
            inheritedDisplayLabel: ecommercePartialRedrawContext.inheritedDisplayLabel,
            inheritedTaskState: ecommercePartialRedrawContext.inheritedTaskState,
            inheritedDeliveryKind: ecommercePartialRedrawContext.inheritedDeliveryKind,
            compositeVersion: 2 as const,
          };
          const redrawNode: PromptNode = {
            id: `${Date.now()}_redraw_prompt_${index}`,
            prompt: nodePrompt,
            originalPrompt: nodePrompt,
            position: { x: nodePos.x + index * 36, y: nodePos.y + index * 36 },
            aspectRatio: cropPlan ? AspectRatio.SQUARE : (plan?.aspectRatio || AspectRatio.AUTO),
            imageSize: cropPlan?.imageSize || (plan?.mode === 'whole-image' ? config.imageSize : sourceImage.imageSize || config.imageSize),
            model: nodeModel,
            modelLabel: resolveModelDisplayName(
              nodeModel,
              getModelMetadata(nodeModel)?.name || sourceImage.modelLabel,
            ) || undefined,
            provider: sourceImage.provider || undefined,
            providerLabel: sourceImage.providerLabel || undefined,
            childImageIds: [],
            referenceImages: [
              sourceReference,
              ...extraReferenceImages,
            ],
            timestamp: Date.now(),
            sourceImageId: sourceImage.id,
            isGenerating: true,
            mode: GenerationMode.REDRAW,
            redraw: nodeRedrawMetadata,
            tags: [],
          };

          await addPromptNode(redrawNode);
          await executeGeneration(redrawNode);
          createdNodes.push(redrawNode);
          const generatedImage = await waitForGeneratedImage(redrawNode.id);
          if (generatedImage) {
            latestRedrawResultId = generatedImage.id;
            generatedRedrawResultIds.push(generatedImage.id);
            if (cropPlan) {
              currentCompositeBaseImageId = generatedImage.id;
              currentCompositeBaseImageUrl = generatedImage.originalUrl || generatedImage.apiResultUrl || generatedImage.url;
            }
          } else if (cropPlan) {
            throw new Error('分区重绘没有返回可合成结果');
          }
        }

        const latestRedrawNode = createdNodes[createdNodes.length - 1];
        if (latestRedrawResultId && latestRedrawNode?.redraw && plan?.mode === 'regional-crops' && plan.cropPlans.length > 1) {
          await updateImageNode(latestRedrawResultId, {
            redraw: {
              ...latestRedrawNode.redraw,
              sourceImageId: sourceImage.id,
              compositionBaseImageId: undefined,
              cropPlans: plan.cropPlans,
              regions: request.regions,
              colorBlocks: request.colorBlocks,
              extraReferenceImageIds: extraReferenceImages.map((ref) => ref.storageId || ref.id),
            },
          });
        }

        if (plan?.mode === 'regional-crops' && createdNodes.length > 1) {
          generatedRedrawResultIds.slice(0, -1).forEach((imageId) => {
            deleteImageNode(imageId);
          });
          createdNodes.slice(0, -1).forEach((redrawNode) => {
            deletePromptNode(redrawNode.id);
          });
        }

        if (latestRedrawResultId && latestRedrawNode) {
          await finalizeEcommercePartialRedrawResult({
            parentPrompt,
            sourceImage,
            redrawNode: latestRedrawNode,
            latestRedrawResultId,
            inheritedDeliveryKind: ecommercePartialRedrawContext.inheritedDeliveryKind,
          });

          handleOpenPreview(latestRedrawResultId);
        } else {
          setPreviewImages(null);
        }
      } catch (error: any) {
        console.error('[redraw] Failed to prepare redraw request', error);
        import('./services/system/notificationService').then(({ notify }) => {
          notify.error('重绘准备失败', error?.message || '请稍后重试');
        });
      }
    })();
  }, [addPromptNode, config.imageSize, config.model, deleteImageNode, deletePromptNode, executeGeneration, finalizeEcommercePartialRedrawResult, handleOpenPreview, resolveEcommercePartialRedrawContext, updateImageNode]);

  const handleMobileResultRedraw = useCallback((entry: MobileResultEntry, request: RedrawRequest) => {
    const imageNode = activeCanvas?.imageNodes.find((image) => image.id === entry.imageId);
    if (!imageNode) {
      return;
    }

    handleRedrawRequest(imageNode, request);
  }, [activeCanvas, handleRedrawRequest]);

  const {
    handleMobileEditEcommerceTask,
    handleMobileToggleEcommerceSelected,
    handleMobileConfirmEcommerceDesktop,
    handleMobileGenerateEcommerceMobile,
  } = useEcommerceMobileContinuationRuntime({
    activeCanvasRef,
    activeGroupSheet: ecommerceState.activeGroupSheet,
    focusWorkspace,
    setMobileScreen,
    activatePromptNode: (promptNode) => {
      void handlePromptClick(promptNode, false);
    },
    handleToggleEcommerceSelected,
    handleConfirmEcommerceDesktop,
    handleRetryEcommerceModule,
    enqueueEcommerceFrameworkNodes,
    pumpEcommerceFrameworkQueue,
    syncEcommerceFrameworkView,
  });
  const {
    handleActivateEcommerceTaskBySourceKey,
  } = useEcommerceTaskActivationRuntime({
    activeCanvasRef,
    ecommerceTaskStates: ecommerceState.taskStates,
    setEcommerceTaskActivationRuntimeState: updateEcommerceTaskActivationRuntimeState,
    activatePromptNode: (promptNode) => {
      void handlePromptClick(promptNode, false);
    },
  });

  // Dynamic Group Bounds Calculation
  const getComputedGroupBounds = useCallback((group: CanvasGroup) => {
    if (!activeCanvas) return undefined;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasNodes = false;
    // 馃幆 Uniform 40px padding on all sides
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
        addRect(prompt.position.x, prompt.position.y, getPromptNodeBoundsWidth(prompt, isMobile), prompt.height || 200);
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
  }, [activeCanvas, imageNodesById, isMobile, promptNodesById]);

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
      maxLayer = Math.max(maxLayer, promptNode.zIndex ?? 0);
    });

    activeCanvas.imageNodes.forEach((imageNode) => {
      maxLayer = Math.max(maxLayer, imageNode.zIndex ?? 0);
    });

    (activeCanvas.workflow?.nodes || []).forEach((workflowNode) => {
      maxLayer = Math.max(maxLayer, workflowNode.zIndex ?? 0);
    });

    activeCanvas.groups.forEach((group) => {
      maxLayer = Math.max(maxLayer, group.zIndex ?? 0);
    });

    return maxLayer;
  }, [activeCanvas]);

  const floatingStackBandSize = React.useMemo(
    () => (maxPersistedCanvasLayer + 1) * 100,
    [maxPersistedCanvasLayer]
  );

  const {
    promptGroupLayerById,
    promptGroupStackZIndexById,
  } = usePromptGroupStacking({
    activeCanvas,
    focusedGroupId,
    floatingStackBandSize,
    generatingGroupIds,
    groupOverlapMap,
  });

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
  const collapsedCanvasGroupNodeIds = React.useMemo(
    () => getCollapsedCanvasGroupNodeIds(activeCanvas?.groups),
    [activeCanvas?.groups],
  );

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
        // 馃幆 [Fix] 杩囨护鎺夌┖鐨勫垎缁勶紙娌℃湁鍖呭惈浠讳綍鑺傜偣锛?
        if (!g.nodeIds || g.nodeIds.length === 0) {
          return false;
        }
        const resolvedGroupBounds = getComputedGroupBounds(g) || g.bounds;
        const groupViewportBounds = g.collapsed
          ? {
            x: resolvedGroupBounds.x,
            y: resolvedGroupBounds.y,
            width: Math.max(180, Math.min(320, resolvedGroupBounds.width)),
            height: 44,
          }
          : resolvedGroupBounds;
        const { x, y, width, height } = groupViewportBounds;
        return !(x > vRight || x + width < vLeft || y > vBottom || y + height < vTop);
      })
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    // 2. Filter prompt nodes (hide idle drafts, but keep nodes that are generating)
    const visiblePromptNodes = activeCanvas.promptNodes
      .filter(n => {
        if (collapsedCanvasGroupNodeIds.has(n.id)) {
          return false;
        }

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
          && n.ecommerce.kind === 'a-plus-group'
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
        if (collapsedCanvasGroupNodeIds.has(n.id)) {
          return false;
        }

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

    // 馃幆 Cache timestamp
    const visibleWorkflowUtilityNodes = (activeCanvas.workflow?.nodes || [])
      .filter((node): node is WorkflowUtilityCanvasNode => isWorkflowUtilityNodeKind(node.kind))
      .filter((node) => {
        if (collapsedCanvasGroupNodeIds.has(node.id)) {
          return false;
        }

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
  }, [activeCanvas, canvasPerformanceProfile.overscanBuffer, canvasTransform, collapsedCanvasGroupNodeIds, getComputedGroupBounds, isNodeDragActive, isPptDeckChildImageNode, liveNodePositionVersion, promptGroupLayerById, promptGroupStackZIndexById, standaloneImageStackZIndexById]);

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
    isCanvasTransforming: isInteractionDeferred,
    isNew: (nowTimestamp || Date.now()) - (image.timestamp || 0) < 10000,
    canvasTransform,
    snapToGrid,
  }), [
    activeSourceImage,
    canvasTransform,
    deleteImageNode,
    handleConnectEnd,
    handleDownloadPptComposite,
    handleImageClick,
    handleOpenPptStackPreview,
    handleOpenPreview,
    isInteractionDeferred,
    isMobile,
    nowTimestamp,
    snapToGrid,
    updateImageNode,
    updateImageNodeDisplayMeta,
    updateImageNodePosition,
  ]);

  const {
    liveSceneState,
    liveSceneRef,
    actualChildImageIdsByPromptId,
    expandedSelectedNodeIds,
    standaloneVisibleImageNodes,
    promptGroupNodeIdsById,
    promptGroupRegroupLayoutsById,
    visiblePromptGroupViews,
    resolvePromptGroupIdForNodeId,
    applyLiveNodeDeltaToDraggedSet,
    handleLiveNodePositionChange,
    shouldAutoRegroupPromptGroup,
    commitPromptGroupDrag,
    handleImageCardHeightChange,
    handleFocusPromptGroup,
    handlePromptGroupNodeHeightChange,
    handlePromptGroupTagRemove,
    beginPromptGroupRegroup,
    clearPromptGroupRegroup,
  } = usePromptGroupLayout({
    activeCanvas,
    canvasInteractionPhase,
    focusedGroupId,
    generatingGroupIds,
    groupOverlapMap,
    imageNodesById,
    isMobile,
    isNodeDragActive,
    liveDerivedNodeIdsByOwnerRef,
    lockedGroupBoundsById,
    liveNodePositionByIdRef,
    liveNodePositionVersion,
    moveSelectedNodesImmediate,
    parseImageDimensions,
    promptGroupLayerById,
    promptGroupLayoutStateByIdRef,
    promptGroupLayoutVersion,
    promptNodesById,
    resolveCurrentPromptChildImages,
    selectNodes,
    selectedNodeIds,
    setFocusedGroupId,
    setGroupOverlapMap,
    setImageCardHeightById,
    setLockedGroupBoundsById,
    setPromptGroupLayoutVersion,
    setLiveNodePositionVersion,
    updateImageNodePosition,
    updatePromptNode,
    visibleImageNodes,
    visiblePromptNodes,
    workflowUtilityNodesById,
  });

  const {
    connectorRenderPromptNodes,
    connectorRenderWorkflowUtilityNodesById,
    resolveLivePromptPosition,
    resolveLiveImagePosition,
    resolveConnectorRenderPosition,
  } = useConnectorRenderer({
    liveSceneState,
    liveSceneRef,
    visiblePromptNodes,
    visibleImageNodes,
    visibleWorkflowUtilityNodes,
    promptNodesById,
    imageNodesById,
    workflowUtilityNodesById,
    canvasPerformanceProfile,
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
      if (collapsedCanvasGroupNodeIds.has(node.id)) {
        return;
      }

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
  }, [activeCanvas, canvasTransform.scale, canvasTransform.x, canvasTransform.y, collapsedCanvasGroupNodeIds]);

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

  const {
    handleCanvasNodeSelect,
  } = useCanvasNodeSelection({
    activeCanvas,
    canvasTransform,
    isMobile,
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
    snapToGrid,
    commitPromptGroupDrag,
  });

  const {
    handlePromptGroupNodeSelect,
  } = usePromptGroupSelection({
    handleCanvasNodeSelect,
    setFocusedGroupId,
  });

  const handleRootMouseMove = useCallback((e: React.MouseEvent) => {
    handleSelectionMouseMove(e);
    handleDragConnectionMouseMove(e);
  }, [handleSelectionMouseMove, handleDragConnectionMouseMove]);

  const handleRootMouseUp = useCallback((e: React.MouseEvent) => {
    handleSelectionMouseUp(e);
    handleDragConnectionMouseUp();
  }, [handleSelectionMouseUp, handleDragConnectionMouseUp]);

  const {
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
            moveSelectedNodesImmediate(delta, expandedSelectedNodeIds, { snapToGrid });
            return;
          }

          moveSelectedNodesImmediate(delta, sourceNodeId, { snapToGrid });
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
    snapToGrid,
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
      promptGroupLayoutState,
      regroupLayoutsById: promptGroupRegroupLayoutsById.get(node.id) ?? new Map(),
      imageCardHeightById,
      resolveLivePromptPosition,
      resolveLiveImagePosition,
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
          snapToGrid={snapToGrid}
          isCanvasTransforming={isCanvasTransforming}
          isMobile={isMobile}
          sourcePosition={sourceImageNode ? (resolveLiveImagePosition(sourceImageNode) ?? sourceImageNode.position) : undefined}
          ecommerceFrameworkTaskNodes={ecommerceFrameworkTaskNodesById.get(renderedPromptNode.id) || []}
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
    ecommerceFrameworkTaskNodesById,
    handleConnectStart,
    handleCanvasNodeDragStateChange,
    handleLiveNodePositionChange,
    handleFocusPromptGroup,
    getSharedImageNodeProps,
    getSharedPromptNodeActionProps,
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
    selectedNodeIds,
    snapToGrid,
    updatePromptNodePosition,
  ]);

  const renderPreviewWorkflowItem = useCallback((item: PreviewRenderItem) => (
    <PreviewNodeCard
      node={item.node}
      isSelected={selectedNodeIds.includes(item.node.id)}
      highlighted={highlightedId === item.node.id}
      zoomScale={canvasTransform.scale}
      snapToGrid={snapToGrid}
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
    snapToGrid,
    updateWorkflowNodePosition,
  ]);

  const renderSaveWorkflowItem = useCallback((item: SaveRenderItem) => (
    <SaveNodeCard
      node={item.node}
      isSelected={selectedNodeIds.includes(item.node.id)}
      highlighted={highlightedId === item.node.id}
      zoomScale={canvasTransform.scale}
      snapToGrid={snapToGrid}
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
    snapToGrid,
    updateWorkflowNodePosition,
  ]);

  const renderAgentWorkflowItem = useCallback((item: AgentRenderItem) => (
    <AgentNodeCard
      node={item.node}
      isSelected={selectedNodeIds.includes(item.node.id)}
      highlighted={highlightedId === item.node.id}
      zoomScale={canvasTransform.scale}
      snapToGrid={snapToGrid}
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
    snapToGrid,
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
    ...visiblePromptGroupViews
      .filter((groupView) => !collapsedCanvasGroupNodeIds.has(groupView.rootPrompt.id))
      .map((groupView) => {
        const visibleChildImages = groupView.childImages.filter((imageNode) => !collapsedCanvasGroupNodeIds.has(imageNode.id));
        return {
          id: groupView.id,
          kind: 'prompt-group' as const,
          groupView: {
            ...groupView,
            childImages: visibleChildImages,
            intraGroupEdges: groupView.intraGroupEdges.filter((edge) => !collapsedCanvasGroupNodeIds.has(edge.toId)),
          },
          node: groupView.rootPrompt,
          childNodes: visibleChildImages,
          detailLevel: canvasPerformanceProfile.cardDetailLevel,
        };
      }),
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
    ...visibleWorkflowUtilityNodes.filter((node) => !collapsedCanvasGroupNodeIds.has(node.id)).flatMap((node): Array<PreviewRenderItem | SaveRenderItem | AgentRenderItem> => {
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
    collapsedCanvasGroupNodeIds,
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
        onDragStart={(_id, event) => {
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
        onGroupDrag={(delta, sourceNodeIds) => moveSelectedNodesImmediate(delta, sourceNodeIds, { snapToGrid })}
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
    snapToGrid,
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

  const CONNECTOR_LAYER_Z_INDEX = -10;
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

  useEffect(() => {
    desktopSideRailLayoutRef.current = desktopSideRailLayout;
  }, [desktopSideRailLayout]);

  useLayoutEffect(() => {
    if (!isReady) {
      return;
    }

    if (isMobile) {
      setDesktopSideRailLayout(prev => {
        const isDefault = prev.projectManagerScale === DEFAULT_DESKTOP_SIDE_RAIL_LAYOUT.projectManagerScale
          && prev.hideZoomControl === DEFAULT_DESKTOP_SIDE_RAIL_LAYOUT.hideZoomControl;
        if (isDefault) {
          return prev;
        }
        desktopSideRailLayoutRef.current = DEFAULT_DESKTOP_SIDE_RAIL_LAYOUT;
        return DEFAULT_DESKTOP_SIDE_RAIL_LAYOUT;
      });
      return;
    }

    let frameId: number | null = null;

    const measure = () => {
      frameId = null;

      const projectManager = document.getElementById('project-manager-container');
      const desktopChrome = document.querySelector<HTMLElement>('.desktop-left-chrome');
      const zoomControl = document.querySelector<HTMLElement>('.desktop-zoom-control-shell')
        ?? document.querySelector<HTMLElement>('.desktop-zoom-rail');

      if (!projectManager || !desktopChrome) {
        return;
      }

      const viewportHeight = window.innerHeight;
      const previousScale = desktopSideRailLayoutRef.current.projectManagerScale || 1;
      const projectManagerRect = projectManager.getBoundingClientRect();
      const naturalProjectManagerHeight = projectManagerRect.height > 0
        ? projectManagerRect.height / previousScale
        : 0;

      if (naturalProjectManagerHeight <= 0) {
        return;
      }

      const topChromeBottom = desktopChrome.getBoundingClientRect().bottom;
      const topClearance = Math.max(0, topChromeBottom + 16);
      const topLimitedScale = (viewportHeight - topClearance * 2) / naturalProjectManagerHeight;
      const boundedScale = Math.max(
        0.64,
        Math.min(1, Number.isFinite(topLimitedScale) ? topLimitedScale : 1),
      );
      const nextScale = Math.round(boundedScale * 1000) / 1000;
      const projectedProjectManagerBottom = viewportHeight / 2 + (naturalProjectManagerHeight * nextScale) / 2;
      const zoomControlRect = zoomControl?.getBoundingClientRect();
      const hideZoomControl = Boolean(zoomControlRect && projectedProjectManagerBottom + 12 >= zoomControlRect.top);

      const nextLayout: DesktopSideRailLayout = {
        projectManagerScale: nextScale,
        hideZoomControl,
      };

      setDesktopSideRailLayout(prev => {
        const scaleUnchanged = Math.abs(prev.projectManagerScale - nextLayout.projectManagerScale) < 0.005;
        if (scaleUnchanged && prev.hideZoomControl === nextLayout.hideZoomControl) {
          return prev;
        }

        desktopSideRailLayoutRef.current = nextLayout;
        return nextLayout;
      });
    };

    const scheduleMeasure = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(measure);
    };

    const observedElements = [
      document.getElementById('project-manager-container'),
      document.querySelector<HTMLElement>('.desktop-left-chrome'),
      document.querySelector<HTMLElement>('.desktop-zoom-control-shell')
        ?? document.querySelector<HTMLElement>('.desktop-zoom-rail'),
    ].filter((element): element is HTMLElement => Boolean(element));
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleMeasure)
      : null;

    observedElements.forEach(element => resizeObserver?.observe(element));
    window.addEventListener('resize', scheduleMeasure);
    scheduleMeasure();

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [isMobile, isReady]);

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
    isMobile,
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
      onToggleSnapToGrid={handleToggleSnapToGrid}
      showGrid={showGrid}
      showSnapToGrid={snapToGrid}
      onAutoArrange={handleAutoArrange}
      onToggleChat={toggleChatPanel}
      isChatOpen={isChatOpen}
      desktopScale={desktopSideRailLayout.projectManagerScale}
      workflowTemplates={WORKFLOW_TEMPLATES}
      onApplyWorkflowTemplate={(templateId) => {
        void handleApplyWorkflowTemplate(templateId);
      }}
      onAddWorkflowUtilityCard={handleAddWorkflowUtilityCard}
      isUserMenuOpen={showUserMenu}
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
      onPartialRedraw: handleRedrawRequest,
      onDeleteImage: handleLightboxDeleteImage,
      onUseAsSource: handleDesktopUseImageAsSource,
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
      {/* 绠€浣撲腑鏂囷細宸︿笂瑙掔瓑瀹芥偓娴帶鍒跺崱鐗?*/}
      {!isMobile && (
        <div className="desktop-left-chrome fixed top-4 left-4 z-[100] w-52 pointer-events-auto select-none">
          <AppDesktopChrome
            isMobile={isMobile}
            billingUiEnabled={billingUiEnabled}
            remainingBalanceDisplay={remainingBalanceDisplay}
            onRecharge={() => setShowRechargeModal(true)}
            rightOffset="0px"
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
        </div>
      )}

      {/* 绠€浣撲腑鏂囷細宸︿笅瑙掓偓娴缉鏀惧崱鐗?- 绔栫洿鎽嗘斁锛屾瀬鑷寸氦缁嗗搴?(w-10)锛屼笉瑕佸拰渚ц竟宸ュ叿鏍忓搴︿竴鑷达紝鐗堟湰鍙峰湪鍏朵笅鏂瑰彟澶栨覆鏌撲负绮捐嚧鐨勭嫭绔嬫瘺鐜荤拑鍗＄墖 */}
      {!isMobile && (
        <div className="desktop-zoom-rail fixed bottom-4 left-4 z-50 w-10 flex flex-col items-center gap-2 pointer-events-auto select-none">
          <div
            className="desktop-zoom-control-shell transition-all duration-300"
            aria-hidden={desktopSideRailLayout.hideZoomControl}
            style={{
              opacity: desktopSideRailLayout.hideZoomControl ? 0 : 1,
              visibility: desktopSideRailLayout.hideZoomControl ? 'hidden' : 'visible',
              pointerEvents: desktopSideRailLayout.hideZoomControl ? 'none' : 'auto',
            }}
          >
            <AppZoomControl
              scale={canvasTransform.scale}
              transform={canvasTransform}
              canvasRef={canvasRef}
            />
          </div>
          <div 
            className="w-full py-1.5 flex items-center justify-center rounded-xl border transition-all duration-300"
            style={{
              background: 'var(--frost-card-framework-bg)',
              border: '1px solid var(--frost-card-framework-border)',
              boxShadow: 'var(--frost-card-framework-shadow)',
              WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
              backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
            }}
          >
            <span className="text-[10px] text-[var(--text-secondary)] font-bold tracking-tight leading-none text-center">
              {APP_DISPLAY_VERSION}
            </span>
          </div>
        </div>
      )}

      <AppCanvasOverlays
        selectionBox={selectionBox}
        selectionMenu={selectionMenuOverlay}
      />
      <AppMobileWorkspace
        isMobile={isMobile}
        surface={responsiveSurface}
        workspaceSurface={workspaceSurface}
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
        onPartialRedraw={handleMobileResultRedraw}
        onDownloadEntry={handleMobileResultDownload}
        onDeleteImage={deleteImageNode}
        onEditEcommerceTask={handleMobileEditEcommerceTask}
        onConfirmEcommerceDesktop={handleMobileConfirmEcommerceDesktop}
        onGenerateEcommerceMobile={handleMobileGenerateEcommerceMobile}
        onToggleEcommerceSelected={handleMobileToggleEcommerceSelected}
        promptBarProps={mobilePromptBarProps}
        overlays={workspacePanels}
      />

      {/* Main Infinite Canvas - 浠呭湪闈炴墜鏈虹鏄剧ず */}
      {!isMobile && (
      <div
        className="absolute inset-y-0 left-0 transition-all duration-300 ease-out"
        style={{
          right: isChatOpen ? `${chatSidebarWidth}px` : 0,
        }}
      >
      <InfiniteCanvas
        id="canvas-container"
        ref={canvasRef}
        showGrid={showGrid}
        onTransformChange={handleCanvasTransformChange}
        onInteractionChange={handleCanvasInteractionChange}
        cardPositions={[
          ...(activeCanvas?.promptNodes
            .filter((n) => !collapsedCanvasGroupNodeIds.has(n.id))
            .filter((n) => !n.hiddenInCanvas)
            .filter((n) => !(
              n.mode === GenerationMode.ECOMMERCE
              && n.ecommerce?.frameworkId
              && n.ecommerce.kind === 'a-plus-group'
            ))
            .map(n => n.position) || []),
          ...(activeCanvas?.imageNodes
            .filter((n) => !collapsedCanvasGroupNodeIds.has(n.id))
            .map(n => n.position) || [])
        ]}
        onCanvasClick={() => {
          // [Draft Logic] Detach from draft when clicking background
          // if (draftNodeId) setDraftNodeId(null); // 馃幆 [FIX] Prevent detaching draft on background click to avoid "Lonely Main Card" orphans

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
            // 馃幆 [Fix] Explicitly remove draft node so preview disappears
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

              // 璁＄畻闇€瑕佺殑 transform锛屼娇鐩爣鍗＄墖灞呬腑
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

          {/* Prompt -> image connections render inside each prompt-group container. */}

          {/* 2. Image -> Prompt/Pending Connections (Follow-up Flow) */}
          {/* A. Existing Prompts */}
          {!isCanvasTransforming && connectorRenderPromptNodes.map(pn => {
            if (pn.isDraft) return null; // Draft/pending connection is rendered by pending-connection block below
            if (pn.error) return null; // 🚀 [FIX] 如果生成失败（存在 error），不渲染对应的连线，避免废弃连接线乱飘和视觉污染
            if (!pn.sourceImageId) return null;
            if (collapsedCanvasGroupNodeIds.has(pn.sourceImageId)) return null;
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
            if (!isRedrawMode) return null; // 简体中文：追问功能已删除，不再显示非重绘模式下的黄色虚线连线
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
          {!isCanvasTransforming && activeSourceImage && (() => {
            if (collapsedCanvasGroupNodeIds.has(activeSourceImage)) return null;
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
            if (!isRedrawMode) return null; // 简体中文：追问功能已删除，不再显示非重绘模式下的黄色虚线连线
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
          {!isCanvasTransforming && (activeCanvas?.workflow?.edges || []).map((edge) => {
            if (collapsedCanvasGroupNodeIds.has(edge.from) || collapsedCanvasGroupNodeIds.has(edge.to)) return null;
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




        {/* 2. Canvas items */}
        {renderedVisibleGroups}
        {renderedCanvasItems}

        {/* 4. Pending / Typing Node */}
        {/* 4. Pending / Typing Node - Removed (Now handled by Persistent Draft DraftNode) */}
        {/* <PendingNode ... /> removed */}
      </InfiniteCanvas>
      </div>
      )}



      {!isMobile && (
        <AppPromptComposer
          variant="desktop"
          promptBarProps={{
            ...desktopPromptBarProps,
            isChatOpen,
            chatSidebarWidth
          }}
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

        // 馃幆 [Sidebar Responsive Layout]
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


      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[320px] rounded-2xl border border-white/10 bg-[#121214]/90 p-6 shadow-2xl backdrop-blur-xl">
            {/* 绠€浣撲腑鏂囨敞閲婏細鏍囬鏂囧瓧 */}
            <div className="mb-4 text-sm font-medium text-white/95 text-left">
              正在加载画布
            </div>
            <div className="flex items-center gap-3">
              {/* 绠€浣撲腑鏂囨敞閲婏細娣¤摑鑹茶繘搴︽潯杞ㄩ亾 */}
              <div className="h-2 flex-1 rounded-full bg-white/10 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-sky-400 transition-all duration-300 ease-out" 
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              {/* 绠€浣撲腑鏂囨敞閲婏細杩涘害鐧惧垎姣旀暟鍊?*/}
              <span className="min-w-[42px] text-right text-sm font-semibold text-sky-400">
                {loadingProgress}%
              </span>
            </div>
          </div>
        </div>
      )}

    </WorkspaceShell>
  );
};

const App: React.FC = () => {
  const [showCostEstimation, setShowCostEstimation] = useState(false);
  const [rootMode, setRootMode] = useState<'workspace' | 'settings' | 'admin'>(() => createAppRootMode({ pathname: window.location.pathname }));

  useEffect(() => {
    const handleLocationChange = () => {
      setRootMode(createAppRootMode({ pathname: window.location.pathname }));
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

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
              AppContentComponent={
                rootMode === 'admin'
                  ? (props: any) => (
                      <React.Suspense fallback={<div className="fixed inset-0 z-[10005] flex items-center justify-center bg-slate-950 text-white"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>}>
                        <AdminLayout {...props} />
                      </React.Suspense>
                    )
                  : rootMode === 'settings'
                    ? (props: any) => (
                        <React.Suspense fallback={<div className="fixed inset-0 z-[10005] flex items-center justify-center bg-slate-950 text-white"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>}>
                          <SettingsPageRoot {...props} />
                        </React.Suspense>
                      )
                    : AppContent
              }
            />
          </CanvasProvider>
        </BillingProvider>
      </AppStartupProvider>
    </ThemeProvider>
  );
};

export default App;
// Force Rebuild
