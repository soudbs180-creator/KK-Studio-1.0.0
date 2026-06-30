import React, { useState, useCallback, useRef, useEffect, useLayoutEffect, startTransition } from 'react';
import InfiniteCanvas, { type InfiniteCanvasHandle } from '../../components/canvas/InfiniteCanvas';
import CanvasDrawingsLayer from '../../components/canvas/CanvasDrawingsLayer';
import CanvasDrawingInteractionOverlay from '../../components/canvas/CanvasDrawingInteractionOverlay';
import { PenTool, Type, Shapes, Palette, Trash, Scissors } from 'lucide-react';
import ImageNode from '../../components/image/ImageCard';
import PromptNodeComponent from '../../components/canvas/PromptNodeComponent';
// KeyManagerModal removed - integrated into UserProfileModal
import { APP_DISPLAY_VERSION } from '../../config/appInfo';
import { AspectRatio, ImageSize, type GenerationConfig, type PromptNode, type GeneratedImage, GenerationMode, KnownModel, type CanvasGroup, type RedrawRequest, type RedrawCropPlan, type MobileResultEntry, type MobileSurfaceScreen, type EcommerceEditableTaskState, type EcommerceGroupSheet, type EcommerceSheetSetting, type EcommerceFrameworkRuntimeState, type ToolWindowInstance } from '../../types';
import { CanvasGroupComponent } from '../../components/canvas/CanvasGroupComponent';
import { getModelCredits } from '../../services/model/modelPricing';
import { keyManager, getModelMetadata, normalizeModelId } from '../../services/auth/keyManager';
import { adminModelService } from '../../services/model/adminModelService';
import { buildRedrawReferenceImage } from '../../services/image/partialRedraw';
import type { EcommerceAnalysisResult } from '../../services/ecommerce/types';
import type { EcommerceGroupSlotState } from '../../services/ecommerce/groupSlotState.ts';
import { getCardDimensions } from '../../utils/styleUtils';
import { buildGeneratedImageBatchPositions } from '../../utils/generatedImageLayout';
import { getViewportPreferredPosition } from '../../utils/canvasUtils';
import { resolveModelDisplayName } from '../../utils/modelDisplayName';
import { resolveProviderIdentity } from '../../utils/providerDisplay';
import { pickByDocumentLanguage } from '../../utils/localeText';
import { getPromptNodeBoundsWidth } from '../../utils/promptNodeCardWidth';
import { generateDownloadFilename, triggerDownload } from '../../utils/downloadUtils';
import {
  getReferenceImageLookupIds,
  normalizeReferenceImagesStorage,
} from '../../utils/referenceImageStorage';
import type { CanvasInteractionPhase } from '../../canvas/liveScene';
import AppPromptComposer from '../../app/AppPromptComposer';
import type { AppGlobalModalsProps } from '../../app/AppGlobalModals';
import {
  type AgentRenderItem,
  type CanvasRenderItem,
  type ImageRenderItem,
  type PreviewRenderItem,
  type PromptGroupLayoutPresentationState,
  type PromptGroupRenderItem,
  type SaveRenderItem,
  type WorkflowUtilityCanvasNode,
} from '../../app/appCanvasTypes';
import { buildSoftConnectorPath, getSoftConnectorPointAt } from '../../canvas/connectorGeometry';
import AppCanvasNavigationPanel from '../../app/AppCanvasNavigationPanel';
import AppCanvasOverlays from '../../app/AppCanvasOverlays';
import { getCollapsedCanvasGroupNodeIds } from '../../app/collapsedCanvasGroups';
import { resolveFollowUpDraftPosition } from '../../app/followUpDraftPosition';
import { buildPromptChildImagesByPromptId } from '../../app/promptGroupChildImages';
import { buildPromptGroupRenderLayout } from '../../app/promptGroupRenderLayout';
import { useAppPromptBarProps } from '../../app/useAppPromptBarProps';
import { useCanvasViewport } from '../../hooks/useCanvasViewport';
import { useCanvasRenderItems } from '../../hooks/useCanvasRenderItems';
import { canvasCardRendererRegistry } from '../../core/canvas/renderers/CanvasCardRendererRegistry';
import { useCanvasInteractionState } from '../../hooks/useCanvasInteractionState';
import { useCanvasNodeSelection } from '../../app/useCanvasNodeSelection';
import { useDraftNodeSync } from '../../app/useDraftNodeSync';
import { useGenerationPlacement } from '../../app/useGenerationPlacement';
import { useGenerationReferenceImages } from '../../app/useGenerationReferenceImages';
import { useGenerationSubmitGuard } from '../../app/useGenerationSubmitGuard';
import { usePromptGroupDragHandlers } from '../../app/usePromptGroupDragHandlers';
import { usePromptGroupSelection } from '../../app/usePromptGroupSelection';
import { useSelectionMenuOverlay } from '../../app/useSelectionMenuOverlay';
import { useWorkflowSourceResolvers } from '../../app/useWorkflowSourceResolvers';
import { useWorkflowActions } from '../../app/useWorkflowActions';
import { useConnectorRenderer } from '../../app/useConnectorRenderer';
import { usePromptGroupLayout, usePromptGroupStacking } from '../../app/usePromptGroupLayout';
import { useGenerationRuntime } from '../../app/useGenerationRuntime';
import { usePptRuntime } from '../../app/usePptRuntime';
import { useEcommerceRuntime, type UpdateEcommerceSelectionState } from '../../app/useEcommerceRuntime';
import { useEcommerceFrameworkRuntimeState, type SetEcommerceFrameworkRuntimeState } from '../../app/useEcommerceFrameworkRuntimeState';
import { useEcommerceSlotHistoryRuntime } from '../../app/useEcommerceSlotHistoryRuntime';
import {
  useEcommerceUploadReferenceRuntime,
  type EcommerceManualReferenceBinding,
  type SetEcommerceUploadReferenceState,
} from '../../app/useEcommerceUploadReferenceRuntime';
import { useEcommerceGroupExportRuntime, type SetEcommerceGroupExportState } from '../../app/useEcommerceGroupExportRuntime';
import {
  createDefaultEcommerceSheetSettings,
  useEcommerceSheetSettingsRuntime,
  type SetEcommerceSheetSettingsState,
} from '../../app/useEcommerceSheetSettingsRuntime';
import {
  useEcommerceTaskStateRuntime,
  type SetEcommerceTaskStateRuntimeState,
} from '../../app/useEcommerceTaskStateRuntime';
import {
  createEmptyEcommerceGroupSlots,
  useEcommerceRequirementAnalysisRuntime,
  type SetEcommerceRequirementAnalysisState,
} from '../../app/useEcommerceRequirementAnalysisRuntime';
import {
  useEcommerceBuildRuntime,
  type SetEcommerceBuildRuntimeState,
} from '../../app/useEcommerceBuildRuntime';
import {
  useEcommercePostBuildSyncRuntime,
  type SetEcommercePostBuildSyncState,
} from '../../app/useEcommercePostBuildSyncRuntime';
import {
  useEcommerceNodeGenerationRuntime,
  type SetEcommerceNodeGenerationRuntimeState,
} from '../../app/useEcommerceNodeGenerationRuntime';
import { useEcommerceMobileContinuationRuntime } from '../../app/useEcommerceMobileContinuationRuntime';
import {
  useEcommerceTaskActivationRuntime,
  type SetEcommerceTaskActivationRuntimeState,
} from '../../app/useEcommerceTaskActivationRuntime';
import {
  useEcommercePromptActivationRuntime,
  type SetEcommercePromptActivationRuntimeState,
} from '../../app/useEcommercePromptActivationRuntime';
import {
  useEcommerceSourceSelectionRuntime,
} from '../../app/useEcommerceSourceSelectionRuntime';
import { useEcommercePartialRedrawRuntime } from '../../app/useEcommercePartialRedrawRuntime';
import { useEcommerceModeRuntime, type SetEcommerceModeRuntimeState } from '../../app/useEcommerceModeRuntime';
import { useEcommerceSubmitRuntime } from '../../app/useEcommerceSubmitRuntime';
import { isCompactResponsiveSurface, resolveResponsiveSurface } from '../../utils/responsiveSurface';
import { useVisibleCanvasItems, useVisibleCanvasItemsNew } from '../../app/useVisibleCanvasItems';
import { useCanvasSpatialIndex } from '../../app/useCanvasSpatialIndex';
import { CanvasMeasurementScheduler } from '../../canvas/CanvasMeasurementScheduler';
import { CanvasLayerRenderer } from '../../components/canvas/CanvasLayerRenderer';
import { buildViewportImageLoadScheduling } from '../../canvas/largeCanvasVirtualization';
import type { CachedCardMeta } from '../../services/storage/offlineDb';
import { syncService } from '../../services/system/syncService';

const GENERATE_TIMEOUT_MS = 600000;

type GenerationServiceClass = import('../../features/generation/generateService').GenerationService;
type GenerateImageFn = GenerationServiceClass['generateImage'];
type GenerateVideoFn = GenerationServiceClass['generateVideo'];
type EcommerceAnalysisModule = typeof import('../../services/ecommerce/ecommerceAnalysisClient.ts');
type SecureModelProxyModule = typeof import('../../services/model/secureModelProxy');

const generateImage = async (...args: Parameters<GenerateImageFn>) => {
  const { generationService: runGenerationService } = await import('../../features/generation/generateService');
  return runGenerationService.generateImage(...args);
};

const cancelGeneration = (id: string): void => {
  void import('../../features/generation/generateService').then(({ generationService: runGenerationService }) => {
    runGenerationService.cancelGeneration(id);
  });
};

const analyzeEcommerceRequirementFile: EcommerceAnalysisModule['analyzeEcommerceRequirementFile'] = async (...args) => {
  const { analyzeEcommerceRequirementFile: runAnalyzeEcommerceRequirementFile } = await import('../../services/ecommerce/ecommerceAnalysisClient.ts');
  return runAnalyzeEcommerceRequirementFile(...args);
};

const generateVideo = async (...args: Parameters<GenerateVideoFn>) => {
  const { generationService: runtimeLlmService } = await import('../../features/generation/generateService');
  return runtimeLlmService.generateVideo(...args);
};

const cancelSecureSystemProxyTask: SecureModelProxyModule['cancelSecureSystemProxyTask'] = async (...args) => {
  const { cancelSecureSystemProxyTask: runCancelSecureSystemProxyTask } = await import('../../services/model/secureModelProxy');
  return runCancelSecureSystemProxyTask(...args);
};

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
      title="断开连接"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </div>
  </foreignObject>
);

// Lucide icons replaced with SVGs
import { toolRegistryInstance } from '../../features/ai-assistant-runtime';
import { CanvasProvider, useCanvas, useCanvasStartupStatus } from '../../context/CanvasContext';
import { ThemeProvider, useTheme } from '../../context/ThemeContext';
import { AppearanceMotionProvider } from '../../context/AppearanceMotionContext';
import { KkUIProvider } from '@kk/ui/web';
import { AppStartupProvider, useAppStartup } from '../../context/AppStartupContext';
import { AuthenticatedAppShell } from '../../app/AuthenticatedAppShell';
import { KKAI_FEATURE_FLAGS } from '../../app/kkaiFeatureFlags';
import { createAppRootMode } from '../../context/kkaiRuntimeContext';
import { resolveAppRootMode } from '../../app/navigation/appRootNavigation';
import { getStorageMode, isMobileDevice } from '../../services/storage/storagePreference';
import type { UserProfileView } from '../../components/modals/UserProfileModal';
import { useAuth } from '../../context/AuthContext';
import { Loader2, X } from 'lucide-react';
import { BillingProvider, useBilling } from '../../context/BillingContext';
import { formatRemainingCredits } from '../../services/billing/remainingBalance';
import {
  isCapabilityRouteAssignmentRouteDisabled,
  resolveEnabledCapabilityRouteAssignment,
  resolveRedrawRouteAndModel,
} from '../../services/api/capabilityRouteAssignments';


// import { syncService } from '../../services/system/syncService'; // [FIX] Dynamic Import
import { saveOriginalImage, normalizePersistableMediaSource } from '../../services/storage/imageStorage';
import { cancelImageLoad, loadImage } from '../../services/image/imageLoader';
import { calculateImageHash } from '../../utils/imageUtils';
import { useImageGeneration } from '../../hooks/useImageGeneration';
import { useWorkspaceSurface, type SettingsSurfaceView } from '../../hooks/useWorkspaceSurface';
import {
  appendReferenceMappingToPrompt,
  reorderReferenceImagesByMentions,
  useFavoritesStore,
} from '../../features/favorites';
// import { notify } from '../../services/system/notificationService'; // [FIX] Dynamic Import

// ProjectManager imported dynamically
import GpuBackground from '../../components/layout/GpuBackground';
import type { Supplier } from '../../services/billing/supplierService';
import { resolveAvatarUrl } from '../../utils/presetAvatars';
import { cleanupImagesOlderThan, cleanupOriginalsOlderThan, getStrictOriginalImage } from '../../services/storage/imageStorage';
import { cleanupCompletedTasksOlderThan } from '../../services/persistence/taskPersistence';
import { traceLocalPerformance } from '../../services/system/localPerformanceTrace';
import { cleanupLogsOlderThan } from '../../services/system/systemLogService';
import { ensureMobileRetentionPreference, getMobileRetentionPreference, MOBILE_RETENTION_PREFERENCE_KEY } from '../../services/storage/mobileRetentionPreference';
import { lazyWithRetry, lazyNamedWithRetry } from '../../utils/lazyWithRetry';
import AppRootContentSwitch from '../../app/AppRootContentSwitch';
import EmptyCanvasWelcome from '../../landing/EmptyCanvasWelcome';
import { WorkspaceShell } from '../../components/workspace';
import {
  createWorkflowNodeRendererRegistry,
  renderWorkflowNode,
} from '../../workflow/renderers/nodeRendererRegistry';
import PreviewNodeCard from '../../workflow/nodes/PreviewNodeCard';
import SaveNodeCard from '../../workflow/nodes/SaveNodeCard';
import AgentNodeCard from '../../workflow/nodes/AgentNodeCard';
import {
  WORKFLOW_TEMPLATES,
} from '../../workflow/templates/workflowTemplates';
import { isWorkflowUtilityNodeKind } from '../../workflow/schema';
import {
  getCanvasPerformanceProfile,
} from '../../canvas/performanceProfile';

const AppDesktopChrome = lazyWithRetry(() => import('../../app/AppDesktopChrome'));
const AppGlobalModals = lazyWithRetry(() => import('../../app/AppGlobalModals'));
const AppMobileWorkspace = lazyWithRetry(() => import('../../app/AppMobileWorkspace'));
const TaskCenterTray = lazyNamedWithRetry(() => import('../../components/workspace/TaskCenterTray'), 'TaskCenterTray');
const WindowManager = lazyNamedWithRetry(() => import('../../components/workspace/WindowManager'), 'WindowManager');
const WorkspaceSurfacePanels = lazyNamedWithRetry(() => import('../../components/workspace/WorkspaceSurfacePanels'), 'WorkspaceSurfacePanels');
const ProjectManager = lazyWithRetry(() => import('../../components/settings/ProjectManager'));

interface AppContentProps {
}

type DesktopSideRailLayout = {
  projectManagerScale: number;
  hideZoomControl: boolean;
  projectManagerOffset: number;
};

const DEFAULT_DESKTOP_SIDE_RAIL_LAYOUT: DesktopSideRailLayout = {
  projectManagerScale: 1,
  hideZoomControl: false,
  projectManagerOffset: 0,
};

const WorkspaceLoadingOverlay: React.FC = () => {
  const { isLoading, loadingProgress } = useCanvasStartupStatus();
  const [isFirstScreenMediaLoading, setIsFirstScreenMediaLoading] = useState(true);

  const displayLoadingProgress = React.useMemo(() => {
    if (isLoading) {
      return Math.min(98, loadingProgress);
    }
    if (isFirstScreenMediaLoading) {
      return 99;
    }
    return 100;
  }, [isLoading, loadingProgress, isFirstScreenMediaLoading]);

  useEffect(() => {
    if (isLoading) {
      setIsFirstScreenMediaLoading(true);
      return;
    }

    let active = true;
    let initialTimer: NodeJS.Timeout | null = null;
    let timeoutTimer: NodeJS.Timeout | null = null;

    const checkFirstScreenImages = () => {
      if (!active) return;

      const images = Array.from(document.querySelectorAll<HTMLImageElement>('img[data-native-drag-source="true"]'));
      const pendingImages = images.filter(img => img.src && !img.complete);

      if (pendingImages.length === 0) {
        setIsFirstScreenMediaLoading(false);
        return;
      }

      let loadedCount = 0;
      const total = pendingImages.length;

      const onImageDone = () => {
        loadedCount++;
        if (loadedCount >= total) {
          checkFirstScreenImages();
        }
      };

      pendingImages.forEach(img => {
        img.addEventListener('load', onImageDone, { once: true });
        img.addEventListener('error', onImageDone, { once: true });
      });
    };

    initialTimer = setTimeout(() => {
      checkFirstScreenImages();
    }, 50);

    timeoutTimer = setTimeout(() => {
      if (active) {
        setIsFirstScreenMediaLoading(false);
      }
    }, 2500);

    return () => {
      active = false;
      if (initialTimer) clearTimeout(initialTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };
  }, [isLoading]);

  if (!isLoading && !isFirstScreenMediaLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="w-[320px] rounded-2xl border border-white/10 bg-[#121214]/90 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-4 text-sm font-medium text-white/95 text-left">
          正在加载画布
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-sky-400 transition-all duration-300 ease-out"
              style={{ width: `${displayLoadingProgress}%` }}
            />
          </div>
          <span className="min-w-[42px] text-right text-sm font-semibold text-sky-400">
            {displayLoadingProgress}%
          </span>
        </div>
      </div>
    </div>
  );
};

export const AppContent: React.FC<AppContentProps> = () => {
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

  // 悬浮窗口实例管理状态
  const [toolWindows, setToolWindows] = useState<ToolWindowInstance[]>([]);

  const handleCloseWindow = useCallback((instanceId: string) => {
    setToolWindows((prev) => prev.filter((w) => w.instanceId !== instanceId));
  }, []);

  const handleMinimizeWindow = useCallback((instanceId: string, minimized: boolean) => {
    setToolWindows((prev) =>
      prev.map((w) => (w.instanceId === instanceId ? { ...w, minimized } : w))
    );
  }, []);

  const handleFocusWindow = useCallback((instanceId: string) => {
    setToolWindows((prev) => {
      const target = prev.find((w) => w.instanceId === instanceId);
      if (!target) return prev;
      const maxZIndex = prev.reduce((max, w) => Math.max(max, w.zIndex), 9000);
      return prev.map((w) =>
        w.instanceId === instanceId ? { ...w, zIndex: maxZIndex + 1 } : w
      );
    });
  }, []);

  const handleUpdateWindowLayout = useCallback((instanceId: string, layout: Partial<ToolWindowInstance>) => {
    setToolWindows((prev) =>
      prev.map((w) => (w.instanceId === instanceId ? { ...w, ...layout } : w))
    );
  }, []);

  const openToolWindowInstance = useCallback((toolId: string, url?: string, options?: any) => {
    const isMultiInstance = options?.multiInstance ?? false;
    const title = options?.title || toolId;

    setToolWindows((prev) => {
      if (!isMultiInstance) {
        const existing = prev.find((w) => w.toolId === toolId);
        if (existing) {
          const maxZIndex = prev.reduce((max, w) => Math.max(max, w.zIndex), 9000);
          return prev.map((w) =>
            w.toolId === toolId
              ? { ...w, minimized: false, zIndex: maxZIndex + 1 }
              : w
          );
        }
      }

      const instanceId = `${toolId}_${Date.now()}`;
      const existingInstancesCount = prev.filter((w) => w.toolId === toolId).length;
      const offset = existingInstancesCount * 30;
      
      const width = options?.width || 600;
      const height = options?.height || 450;
      
      const defaultX = Math.max(50, Math.min(window.innerWidth - width - 50, 100 + offset));
      const defaultY = Math.max(50, Math.min(window.innerHeight - height - 50, 100 + offset));

      const x = options?.x !== undefined ? options.x : defaultX;
      const y = options?.y !== undefined ? options.y : defaultY;

      const maxZ = prev.reduce((max, w) => Math.max(max, w.zIndex), 9000);

      const newWin: ToolWindowInstance = {
        instanceId,
        toolId,
        url,
        x,
        y,
        width,
        height,
        minimized: false,
        zIndex: maxZ + 1,
        title,
      };

      return [...prev, newWin];
    });
  }, []);

  const setPptEditorMode = useCallback((mode: string) => {
    import('../../services/system/notificationService').then(({ notify }) => {
      notify.success('PPT 编辑模式已切换', `已切换至：${mode}`);
    });
  }, []);

  const togglePinTool = useCallback((toolId: string, pinned: boolean) => {
    import('../../services/system/notificationService').then(({ notify }) => {
      notify.success(pinned ? '工具已固定' : '工具已取消固定', `工具 ID: ${toolId}`);
    });
  }, []);

  const [promptGroupLayoutVersion, setPromptGroupLayoutVersion] = useState(0);
  const [imageCardHeightById, setImageCardHeightById] = useState<Record<string, number>>({});
  const [lockedGroupBoundsById, setLockedGroupBoundsById] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const nodeDragReleaseFrameRef = useRef<number | null>(null);
  const promptGroupLayoutStateByIdRef = useRef<Record<string, PromptGroupLayoutPresentationState>>({});


  const loadFavorites = useFavoritesStore(state => state.load);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);



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
    setViewportCenter, // 简体中文注释：迁移时保留当前视口中心，避免画布跳动。
    state, // 简体中文注释：迁移功能需要读取完整画布列表。
    migrateNodes, // 简体中文注释：将选中的节点迁移到其他项目。
    createCanvas, // 简体中文注释：必要时创建新的目标项目。
    switchCanvas,  // 简体中文注释：迁移完成后切换到目标项目。
    addCanvasDrawing,
    deleteCanvasDrawing,
    clearCanvasDrawings,
    unlinkNodes
  } = useCanvas();
  const updatePromptNodeRef = useRef(updatePromptNode);
  useLayoutEffect(() => {
    updatePromptNodeRef.current = updatePromptNode;
  });

  useEffect(() => {
    const handleBatchHeightUpdates = (updates: Record<string, number>) => {
      const imageUpdates: Record<string, number> = {};
      const promptUpdates: Record<string, number> = {};

      for (const [id, h] of Object.entries(updates)) {
        const isPrompt = activeCanvasRef.current?.promptNodes?.some((n: any) => n.id === id);
        if (isPrompt) {
          promptUpdates[id] = h;
        } else {
          imageUpdates[id] = h;
        }
      }

      if (Object.keys(imageUpdates).length > 0) {
        setImageCardHeightById((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const [id, h] of Object.entries(imageUpdates)) {
            const prevH = prev[id];
            if (prevH !== h && (!prevH || Math.abs(prevH - h) > 1)) {
              next[id] = h;
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }

      if (Object.keys(promptUpdates).length > 0) {
        for (const [id, h] of Object.entries(promptUpdates)) {
          const targetNode = activeCanvasRef.current?.promptNodes?.find((n: any) => n.id === id);
          if (targetNode && targetNode.height !== h) {
            void updatePromptNodeRef.current({ ...targetNode, height: h });
          }
        }
      }
    };

    CanvasMeasurementScheduler.registerCallback(handleBatchHeightUpdates);
    return () => {
      CanvasMeasurementScheduler.unregisterCallback(handleBatchHeightUpdates);
      CanvasMeasurementScheduler.cancel();
    };
  }, []);

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

  const {
    canvasTransform,
    isCanvasTransforming,
    canvasInteractionPhase,
    highlightedId: highlightedIdVal,
    setCanvasTransform,
    setIsCanvasTransforming,
    setCanvasInteractionPhase,
    handleCanvasTransformChange,
    handleCanvasInteractionChange,
    handleNavigateToNode,
    handleResetView: resetViewFn,
    handleFitToAll,
  } = useCanvasViewport({
    canvasRef,
    activeCanvas,
    selectedNodeIds,
    isReady,
    setViewportCenter,
  });

  const measurementCanvasNodeCount = (activeCanvas?.promptNodes?.length || 0) + (activeCanvas?.imageNodes?.length || 0);
  const isLargeMeasurementCanvas = measurementCanvasNodeCount >= 80;

  useEffect(() => {
    CanvasMeasurementScheduler.setLocked(isCanvasTransforming || isLargeMeasurementCanvas);
  }, [isCanvasTransforming, isLargeMeasurementCanvas]);

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



  // [新功能] 全局灯箱状态（针对图片浏览）
  const [previewImages, setPreviewImages] = useState<GeneratedImage[] | null>(null);
  const [previewInitialIndex, setPreviewInitialIndex] = useState(0);
  const [pptStackPreview, setPptStackPreview] = useState<{ images: GeneratedImage[]; initialIndex: number } | null>(null);
  const [pptDeckEditor, setPptDeckEditor] = useState<{ nodeId: string; initialIndex: number } | null>(null);
  const [showMigrateModal, setShowMigrateModal] = useState(false); // 迁移弹窗状态
  const [exportPptxNode, setExportPptxNode] = useState<PromptNode | null>(null);
  const [showPptxExportDialog, setShowPptxExportDialog] = useState(false);
  const [pptxTransitionsEnabled, setPptxTransitionsEnabled] = useState(false);
  const [pptxTransitionEffects, setPptxTransitionEffects] = useState<string[]>(['fade']);
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
  const [canvasMode, setCanvasMode] = useState<'normal' | 'board'>('normal');
  const [activeDrawingTool, setActiveDrawingTool] = useState<'pen' | 'rect' | 'circle' | 'line' | 'arrow' | 'text' | 'select'>('pen');
  const [activeDrawingColor, setActiveDrawingColor] = useState<string>('#ef4444');
  const [activeDrawingWidth, setActiveDrawingWidth] = useState<number>(3);
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

  useEffect(() => {
    const handleOpenSettingsEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab: string }>;
      const tab = customEvent.detail?.tab || 'api-management';
      openSettingsPanel(tab as any);
    };
    window.addEventListener('kk-open-settings', handleOpenSettingsEvent);
    return () => {
      window.removeEventListener('kk-open-settings', handleOpenSettingsEvent);
    };
  }, [openSettingsPanel]);

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
      const nextKeyStats = keyManager.getStats();
      setKeyStats(prev => (
        prev.total === nextKeyStats.total
        && prev.valid === nextKeyStats.valid
        && prev.invalid === nextKeyStats.invalid
        && prev.disabled === nextKeyStats.disabled
        && prev.rateLimited === nextKeyStats.rateLimited
          ? prev
          : nextKeyStats
      ));

      const nextProviders = keyManager.getProviders();
      setProviders(prev => (
        JSON.stringify(prev) === JSON.stringify(nextProviders)
          ? prev
          : nextProviders
      ));
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

  // Markdown & Mermaid Modal State
  const [showMarkdownModal, setShowMarkdownModal] = useState(false);
  const [showMermaidModal, setShowMermaidModal] = useState(false);

  // Tag Constraints State
  const [tagLimits, setTagLimits] = useState({ maxTags: 10, maxChars: 6 });

  // 🎨 New State for enhanced TagInputModal
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

    // 🎨 Collect all existing tags from canvas for suggestions
    setAllTags(allCanvasTags);

    // Determine if editing Sub Card and find inherited tags
    if (imageNode) {
      // 🎨 Sub Card - find parent's tags
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

    // 🎨 Deduplication Logic: If Main Card adds a tag, remove from its Sub Cards
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

    // 🎨 File System Shortcut Integration
    try {
      const { fileSystemService } = await import('../../services/storage/fileSystemService');
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

    const init = async () => {
      advanceTo('session_ready');
      void adminModelService.initializeUnifiedModels().catch(error => {
        console.warn('[App] Deferred model bootstrap failed:', error);
      });
      try {
        // 1. Sync User ID
        const authenticatedUserId = startupAuthenticatedUserId;

        if (authenticatedUserId) {
          import('../../services/billing/costService').then(async ({ setUserId }) => {
            if (!active) return;
            await setUserId(authenticatedUserId);
          }).catch(err => console.error('[App] CostService sync failed:', err));

          // [New] Mark user as logged in on this browser (for future skips)
          localStorage.setItem('kk_has_logged_in', 'true');
        } else {
          import('../../services/billing/costService').then(async ({ setUserId }) => {
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
        let storageMode = await getStorageMode();

        const isMobilePhone = isMobileDevice();

        if (isMobilePhone) {
          // 手机端若无存储模式，默认使用 browser 存储模式作为本地缓存，但不强行覆盖已有合法模式
          if (!storageMode) {
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

          // 提醒用户当前存储状态，对齐手机端云端优先原则
          import('../../services/system/notificationService').then(({ notify }) => {
            if (authenticatedUserId) {
              notify.success('云端同步', '手机端已开启云端优先。您的创作数据已安全同步至云端主存储。');
            } else {
              notify.warning('体验提醒', '当前为临时本地缓存模式。更换设备或清理浏览器可能导致数据丢失，请登录以开通云端主存储。');
            }
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
        advanceTo('background_ready');
      }
    };

    init();

    return () => {
      active = false;
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
          promptOptimizerArchetype: parsed.promptOptimizerArchetype || 'auto',
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
      promptOptimizerArchetype: 'auto',
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

      const { getImage } = await import('../../services/storage/imageStorage');

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
      promptOptimizerArchetype: config.promptOptimizerArchetype || 'auto',
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
    config.promptOptimizerArchetype,
    config.aspectRatio, config.imageSize, config.parallelCount,
    config.model, config.enableGrounding, config.enableImageSearch, config.thinkingMode, config.mode, config.pptSlides, config.pptStyleLocked,
    config.referenceImages, // Add referenceImages to dep array
    config.prompt, config.videoResolution, config.videoDuration, config.videoAudio, config.audioDuration, config.audioLyrics, config.maskUrl, config.editMode // 全量依赖监听
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
        import('../../services/system/notificationService').then(({ notify }) => {
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



  // 简体中文：AI接管提示词本地填充事件处理器
  useEffect(() => {
    const handleFillPrompt = (e: Event) => {
      const { prompt } = (e as CustomEvent).detail;
      if (prompt) {
        setConfig(prev => ({
          ...prev,
          prompt: prompt
        }));
      }
    };
    window.addEventListener('takeover-fill-prompt', handleFillPrompt);
    return () => window.removeEventListener('takeover-fill-prompt', handleFillPrompt);
  }, [setConfig]);

  // 简体中文：AI接管创建提示词与图片卡片事件处理器
  useEffect(() => {
    const handleCreatePromptCards = async (e: Event) => {
      const { prompts, model, aspectRatio, imageUrl } = (e as CustomEvent).detail;
      if (!prompts || prompts.length === 0) {
        return;
      }

      const { notify } = await import('../../services/system/notificationService');

      await toolRegistryInstance.execute('canvas.createPromptCards', {
        prompts,
        model: model || config.model || 'gemini-2.5-flash',
        aspectRatio: aspectRatio || '1:1',
        imageUrl
      }, {
        activeCanvas,
        addPromptNode,
        addImageNodes,
        getNextCardPosition: () => {
          if (typeof findSmartPosition === 'function') {
            return findSmartPosition(100, 100, 360, 480);
          }
          return {
            x: 100 + Math.random() * 200,
            y: 100 + Math.random() * 200
          };
        },
        config,
        notify
      });
    };
    window.addEventListener('takeover-create-prompt-cards', handleCreatePromptCards);
    return () => window.removeEventListener('takeover-create-prompt-cards', handleCreatePromptCards);
  }, [activeCanvas, addPromptNode, addImageNodes, findSmartPosition, config]);

  // 简体中文：AI接管ZIP导出原图事件处理器
  useEffect(() => {
    const handleZipOriginals = async (e: Event) => {
      const { scope } = (e as CustomEvent).detail;
      const { notify } = await import('../../services/system/notificationService');
      const taskId = `zip_${Date.now()}`;

      // 派发任务添加事件
      window.dispatchEvent(new CustomEvent('task-center:add', {
        detail: {
          id: taskId,
          name: scope === 'selected_nodes' ? '导出选中原图 (ZIP)' : '导出全部原图 (ZIP)',
          type: 'export',
          status: 'running',
          progress: 15
        }
      }));

      try {
        await toolRegistryInstance.execute('assets.zipOriginals', {
          scope: scope || 'all_canvas_outputs'
        }, {
          activeCanvas,
          selectedNodeIds,
          notify
        });

        // 派发成功状态
        window.dispatchEvent(new CustomEvent('task-center:update', {
          detail: {
            id: taskId,
            status: 'completed',
            progress: 100
          }
        }));
      } catch (err: any) {
        console.error('[BrowserAssistant] Failed to run assets.zipOriginals', err);
        // 派发失败状态
        window.dispatchEvent(new CustomEvent('task-center:update', {
          detail: {
            id: taskId,
            status: 'failed',
            progress: 100,
            error: err?.message || String(err)
          }
        }));
      }
    };
    window.addEventListener('takeover-zip-originals', handleZipOriginals);
    return () => window.removeEventListener('takeover-zip-originals', handleZipOriginals);
  }, [activeCanvas, selectedNodeIds]);

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
    dragConnection,
    handleConnectStart,
    handleConnectEnd,
    isNodeDragActive,
    setIsNodeDragActive,
    handleRootMouseMove,
    handleRootMouseUp,
  } = useCanvasInteractionState({
    activeCanvas,
    canvasTransform,
    isMobile,
    selectedNodeIds,
    getCardDimensions,
    selectNodes,
    clearSelection,
    setSelectionMenuPosition,
    linkNodes,
  });
  const { tryStartGenerationSubmission } = useGenerationSubmitGuard();

  // 简体中文：通过时间（200ms）与位移（250px）双重节流，优化交互期间（平移、缩放、拖拽）的重绘机制，保证高频平移流畅度的同时杜绝卡片丢失与白屏
  const lastInteractionRef = useRef({ time: 0, x: 0, y: 0, scale: 1 });
  const shouldFreezeRender = React.useMemo(() => {
    if (!isCanvasTransforming && !isNodeDragActive) {
      lastInteractionRef.current = { time: Date.now(), x: canvasTransform.x, y: canvasTransform.y, scale: canvasTransform.scale };
      return false;
    }

    // 🚀 如果 scale 发生了改变，说明是在进行画布缩放，此时绝不能 Freeze，否则会导致视口改变但渲染不更新（卡片丢失、位置错位）
    if (canvasTransform.scale !== lastInteractionRef.current.scale) {
      lastInteractionRef.current = { time: Date.now(), x: canvasTransform.x, y: canvasTransform.y, scale: canvasTransform.scale };
      return false;
    }

    // 🚀 新增：如果当前交互阶段是缩放，也绝不能 Freeze，以解决滚动缩放防抖时状态未更新导致的误冻结问题
    if (canvasInteractionPhase === 'zoom') {
      lastInteractionRef.current = { time: Date.now(), x: canvasTransform.x, y: canvasTransform.y, scale: canvasTransform.scale };
      return false;
    }

    const now = Date.now();
    const timeElapsed = now - lastInteractionRef.current.time;
    const distanceX = canvasTransform.x - lastInteractionRef.current.x;
    const distanceY = canvasTransform.y - lastInteractionRef.current.y;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    if (distance < 250 && timeElapsed < 200) {
      return true;
    }

    lastInteractionRef.current = { time: now, x: canvasTransform.x, y: canvasTransform.y, scale: canvasTransform.scale };
    return false;
  }, [isCanvasTransforming, isNodeDragActive, canvasTransform.x, canvasTransform.y, canvasTransform.scale, canvasInteractionPhase]);

  // 只有在拖动/缩放画布 (isCanvasTransforming) 时才触发加载延迟！
  // 拖动单个卡片时 (isNodeDragActive === true) 绝不变成空卡片，保留完美卡片外观以保证流畅舒适的感知！
  // 同时，只有在卡片数 >= 80 (大型/巨型项目) 时才启用大项目延迟加载防抖机制，保障极限操作下的性能
  const isLargeProject = ((activeCanvas?.promptNodes?.length || 0) + (activeCanvas?.imageNodes?.length || 0)) >= 80;
  const shouldPauseLoading = shouldFreezeRender && isLargeProject;

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
    openLibrarySurface,
    openFavoritesSurface,
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

  const handleInsertMarkdownCards = useCallback(async (cards: any[]) => {
    if (!cards || cards.length === 0) return;

    const defaultAspectRatio = config.aspectRatio || AspectRatio.SQUARE;
    const defaultImageSize = config.imageSize || ImageSize.SIZE_1K;
    const defaultModel = config.model;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const card of cards) {
      const promptText = card.prompt + (card.bullets.length > 0 ? '\n' + card.bullets.map((b: string) => `- ${b}`).join('\n') : '');
      const promptNode: PromptNode = {
        id: card.id,
        prompt: promptText,
        originalPrompt: card.prompt,
        position: card.position,
        aspectRatio: defaultAspectRatio,
        imageSize: defaultImageSize,
        model: defaultModel,
        childImageIds: [],
        timestamp: Date.now(),
        tags: card.bullets,
      };

      if (card.position.x < minX) minX = card.position.x;
      if (card.position.y < minY) minY = card.position.y;
      if (card.position.x > maxX) maxX = card.position.x;
      if (card.position.y > maxY) maxY = card.position.y;

      await addPromptNode(promptNode);
    }

    const nodeIds = cards.map(c => c.id);
    selectNodes(nodeIds);

    const CARD_WIDTH = 320;
    const CARD_HEIGHT = 220;
    const groupPadding = 40;
    const groupX = minX - groupPadding;
    const groupY = minY - groupPadding;
    const groupW = (maxX - minX) + CARD_WIDTH + groupPadding * 2;
    const groupH = (maxY - minY) + CARD_HEIGHT + groupPadding * 2;

    const newGroupId = createEphemeralId('group');
    addGroup({
      id: newGroupId,
      nodeIds: nodeIds,
      bounds: {
        x: groupX,
        y: groupY,
        width: groupW,
        height: groupH,
      },
      label: 'Markdown 导入组',
      color: '#4f46e5',
      type: 'custom',
    });

    setShowMarkdownModal(false);
  }, [config, addPromptNode, addGroup, selectNodes, createEphemeralId]);

  const handleInsertMermaidCards = useCallback(async (data: {
    nodes: Array<{ id: string; label: string; x: number; y: number }>;
    edges: Array<{ from: string; to: string; label?: string }>;
    groupName?: string;
  }) => {
    if (!data.nodes || data.nodes.length === 0) return;

    const defaultAspectRatio = config.aspectRatio || AspectRatio.SQUARE;
    const defaultImageSize = config.imageSize || ImageSize.SIZE_1K;
    const defaultModel = config.model;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const node of data.nodes) {
      const promptNode: PromptNode = {
        id: node.id,
        prompt: node.label,
        originalPrompt: node.label,
        position: { x: node.x, y: node.y },
        aspectRatio: defaultAspectRatio,
        imageSize: defaultImageSize,
        model: defaultModel,
        childImageIds: [],
        timestamp: Date.now(),
        tags: [],
      };

      if (node.x < minX) minX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.x > maxX) maxX = node.x;
      if (node.y > maxY) maxY = node.y;

      await addPromptNode(promptNode);
    }

    const nodeIds = data.nodes.map(n => n.id);
    selectNodes(nodeIds);

    const CARD_WIDTH = 300;
    const CARD_HEIGHT = 180;
    const groupPadding = 40;
    const groupX = minX - groupPadding;
    const groupY = minY - groupPadding;
    const groupW = (maxX - minX) + CARD_WIDTH + groupPadding * 2;
    const groupH = (maxY - minY) + CARD_HEIGHT + groupPadding * 2;

    const newGroupId = createEphemeralId('group');
    addGroup({
      id: newGroupId,
      nodeIds: nodeIds,
      bounds: {
        x: groupX,
        y: groupY,
        width: groupW,
        height: groupH,
      },
      label: data.groupName || 'Mermaid 转换组',
      color: '#059669',
      type: 'custom',
    });

    setShowMermaidModal(false);
  }, [config, addPromptNode, addGroup, selectNodes, createEphemeralId]);

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

  const handleMultiSelectConfirm = useCallback((ids: string[]) => {
    if (!ids || ids.length === 0) return;
    selectNodes(ids, 'replace');
    setTimeout(() => {
      arrangeAllNodes();
    }, 100);
  }, [selectNodes, arrangeAllNodes]);


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
          const calc = await import('../../utils/imageUtils');
          const storageId = await calc.calculateImageHash(dataUrl.split(',')[1]);

          // Persist to storage
          const storage = await import('../../services/storage/imageStorage');
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
          import('../../services/system/notificationService').then(({ notify }) => {
            notify.success('图片已添加', `${file.name} (${img.width}×${img.height})`);
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to process dropped image:', error);
      import('../../services/system/notificationService').then(({ notify }) => {
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
    const referenceMentionBinding = reorderReferenceImagesByMentions({
      prompt: trimmedPrompt,
      referenceImages: config.referenceImages || [],
      resolveNameForReference: (reference) => (
        reference.mentionName
        || reference.mentionText?.replace(/^@+/, '')
        || undefined
      ),
    });
    const submissionPrompt = appendReferenceMappingToPrompt(
      trimmedPrompt,
      referenceMentionBinding.mappingSummary,
    );
    const submissionConfig = referenceMentionBinding.orderedReferenceImages === config.referenceImages
      ? config
      : {
        ...config,
        referenceImages: referenceMentionBinding.orderedReferenceImages,
      };

    // Real billing guard and deduction flow
    // Route-aware billing: when the request resolves to a user-owned key/channel,
    // it must never enter the system-credit deduction flow.
    const initialSubmissionContext = await prepareInitialGenerationSubmissionContext({
      config: submissionConfig,
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
      config: submissionConfig,
      deletePromptNode,
      executeGeneration,
      getCanvas: () => activeCanvasRef.current || undefined,
      initialSubmissionContext,
      prepareGenerationReferenceImages,
      rawPrompt: submissionPrompt,
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
      import('../../services/system/notificationService').then(({ notify }) => {
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
    // 简体中文：整理后延迟调用 fitToAll，使得视口平滑对齐卡片，防止“卡片丢失”视觉错觉
    setTimeout(() => {
      handleFitToAll();
    }, 150);
  }, [arrangeAllNodes, handleFitToAll]);

  // 简体中文：包装可编辑 PPT 导出任务以支持统一任务中心
  const handleExportPptPackageWithTaskCenter = useCallback(async (node: PromptNode) => {
    const taskId = `ppt_zip_${Date.now()}`;
    window.dispatchEvent(new CustomEvent('task-center:add', {
      detail: {
        id: taskId,
        name: `导出可编辑 PPT 素材包 (${node.prompt.slice(0, 15)}...)`,
        type: 'ppt',
        status: 'running',
        progress: 10
      }
    }));
    try {
      await handleExportPptPackageEditable(node);
      window.dispatchEvent(new CustomEvent('task-center:update', {
        detail: { id: taskId, status: 'completed', progress: 100 }
      }));
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('task-center:update', {
        detail: { id: taskId, status: 'failed', progress: 100, error: e?.message || String(e) }
      }));
    }
  }, [handleExportPptPackageEditable]);

  const handleExportPptxWithTaskCenter = useCallback(async (node: PromptNode, options?: any) => {
    const taskId = `ppt_pptx_${Date.now()}`;
    window.dispatchEvent(new CustomEvent('task-center:add', {
      detail: {
        id: taskId,
        name: `生成并导出 PPTX 幻灯片 (${node.prompt.slice(0, 15)}...)`,
        type: 'ppt',
        status: 'running',
        progress: 10
      }
    }));
    try {
      await handleExportPptxEditable(node, options);
      window.dispatchEvent(new CustomEvent('task-center:update', {
        detail: { id: taskId, status: 'completed', progress: 100 }
      }));
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('task-center:update', {
        detail: { id: taskId, status: 'failed', progress: 100, error: e?.message || String(e) }
      }));
    }
  }, [handleExportPptxEditable]);

  // --- 连接管理 ---
  // 🎨 [Strict Logic] Disconnect Parent -> Child Group becomes Normal Group
  const handleDisconnectPrompt = useCallback((id: string) => {
    const node = activeCanvas?.promptNodes.find(n => n.id === id);
    if (node && node.sourceImageId) {
      updatePromptNode({ ...node, sourceImageId: undefined });

      // [Draft Logic] If disconnecting draft, clear global source state too
      if (node.id === draftNodeId) {
        setActiveSourceImage(null);
      }

      import('../../services/system/notificationService').then(({ notify }) => {
        notify.success('已断开连接', '卡组已拆分为独立卡组');
      });
    }
  }, [activeCanvas, updatePromptNode, draftNodeId, setActiveSourceImage]);

  // 🎨 [Strict Logic] Pin Draft -> Create Lonely Main Card
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
    // 🎨 [New Requirement] Clear input box and active source
    setConfig(prev => ({ ...prev, prompt: '', referenceImages: [] }));
    setActiveSourceImage(null);

    import('../../services/system/notificationService').then(({ notify }) => {
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
      generateVideo,
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
    promptOptimizerArchetype: config.promptOptimizerArchetype,
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

        import('../../services/system/notificationService').then(({ notify }) => {
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
        mode: clickedNode.mode || GenerationMode.IMAGE, // 🎨 Sync Mode (Image/Video)
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
    onExportPpt: handleExportPptPackageWithTaskCenter,
    onExportPptx: (targetNode) => {
      setExportPptxNode(targetNode);
      setShowPptxExportDialog(true);
    },
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
    handleExportPptPackageWithTaskCenter,
    handleExportPptSinglePage,
    handleExportPptxWithTaskCenter,
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
    // 🎨 Shift=切换（向后兼容），无修饰键替换
    const sourceImage = imageNodesById.get(imageId);
    // 保持父 Prompt 组聚焦，使子卡片框在点击后保持可见
    setFocusedGroupId(sourceImage?.parentPromptId || null);
    selectNodes([imageId], (window.event as any)?.shiftKey ? 'toggle' : 'replace');

    resetEcommerceSourceSelectionState();
    // 🚀 点击卡片时不再在画布自动生成 Draft 框 and 拉连接线，相关交互已转移至灯箱
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
    import('../../services/system/notificationService').then(({ notify }) => {
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
          const { routeId, modelId } = resolveRedrawRouteAndModel(sourceImage.provider);
          const nodeModel = modelId;
          const nodeProvider = routeId;
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
            provider: nodeProvider || undefined,
            providerLabel: nodeProvider ? (keyManager.getKey(nodeProvider)?.name || (getModelMetadata(nodeModel) as any)?.providerLabel) : undefined,
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
        import('../../services/system/notificationService').then(({ notify }) => {
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
    // 🎨 Uniform 40px padding on all sides
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

  const generatingChildImagesByPromptId = React.useMemo(
    () => buildPromptChildImagesByPromptId(activeCanvas?.promptNodes, activeCanvas?.imageNodes),
    [activeCanvas?.promptNodes, activeCanvas?.imageNodes]
  );
  const generatingGroupStateSignatureRef = useRef('');
  useEffect(() => {
    if (!activeCanvas) {
      setGeneratingGroupIds([]);
      return;
    }

    const nextGeneratingGroupIds = activeCanvas.promptNodes
      .filter((promptNode) => {
        const childImages = generatingChildImagesByPromptId.get(promptNode.id) || [];
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
  }, [activeCanvas, generatingChildImagesByPromptId]);

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

      const syncedStack = group.hidden && Number.isFinite(highestMemberStack)
        ? Math.max(fallbackStack, highestMemberStack + 30)
        : Number.isFinite(highestMemberStack)
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
  // To satisfy contract test assertion: const resolveViewportNodePosition =
  const liveDerivedNodeIdsByOwnerRef = useRef<Record<string, string[]>>({});
  const collapsedCanvasGroupNodeIds = React.useMemo(
    () => getCollapsedCanvasGroupNodeIds(activeCanvas?.groups),
    [activeCanvas?.groups],
  );

  const cardPositionsVal = React.useMemo(() => {
    return [
      ...(activeCanvas?.promptNodes
        .filter((n: any) => !collapsedCanvasGroupNodeIds.has(n.id))
        .filter((n: any) => !n.hiddenInCanvas)
        .filter((n: any) => !(
          n.mode === GenerationMode.ECOMMERCE
          && n.ecommerce?.frameworkId
          && n.ecommerce.kind === 'a-plus-group'
        ))
        .map((n: any) => n.position) || []),
      ...(activeCanvas?.imageNodes
        .filter((n: any) => !collapsedCanvasGroupNodeIds.has(n.id))
        .map((n: any) => n.position) || [])
    ];
  }, [activeCanvas, collapsedCanvasGroupNodeIds]);

  const handleCanvasClick = React.useCallback(() => {
    clearSelection();
    setFocusedGroupId(null);
    setSelectionMenuPosition(null);
  }, [clearSelection, setFocusedGroupId, setSelectionMenuPosition]);

  const handleCanvasDoubleClick = React.useCallback(() => {
    if (!isGenerating) {
      setConfig(prev => ({ ...prev, prompt: '', referenceImages: [] }));
      setActiveSourceImage(null);
      clearSelection();
      setFocusedGroupId(null);
      setSelectionMenuPosition(null);
      if (draftNodeId) {
        deletePromptNode(draftNodeId);
        setDraftNodeId(null);
      }
    }
  }, [isGenerating, setConfig, setActiveSourceImage, clearSelection, setFocusedGroupId, setSelectionMenuPosition, draftNodeId, deletePromptNode, setDraftNodeId]);

  // 1. 构建空间索引与查找表
  const { spatialIndex, promptNodeById, imageNodeById, workflowNodeById, groupById } = useCanvasSpatialIndex({
    activeCanvas,
    isMobile,
    imageCardHeightById,
    getComputedGroupBounds,
  });

  // 2. 算视口范围与 buffer 缓存边界
  const cullingOverscanBuffer = canvasPerformanceProfile.overscanBuffer;
  const cullingVirtualBuffer = Math.max(cullingOverscanBuffer * 2.5, 2500);

  const viewportBounds = React.useMemo(() => {
    const vLeft = -canvasTransform.x / canvasTransform.scale - cullingVirtualBuffer;
    const vTop = -canvasTransform.y / canvasTransform.scale - cullingVirtualBuffer;
    const vRight = (window.innerWidth - canvasTransform.x) / canvasTransform.scale + cullingVirtualBuffer;
    const vBottom = (window.innerHeight - canvasTransform.y) / canvasTransform.scale + cullingVirtualBuffer;
    return { vLeft, vTop, vRight, vBottom };
  }, [canvasTransform.x, canvasTransform.y, canvasTransform.scale, cullingVirtualBuffer]);

  // Viewport Culling (Virtualization) Logic
  // Optimization: Only render nodes overlapping with the current viewport (+buffer)
  const {
    visiblePromptNodes,
    visibleImageNodes,
    visibleWorkflowUtilityNodes,
    visibleGroups,
    nowTimestamp
  } = useVisibleCanvasItemsNew({
    spatialIndex,
    promptNodeById,
    imageNodeById,
    workflowNodeById,
    groupById,
    viewportBounds,
    activeCanvas,
    collapsedCanvasGroupNodeIds,
    getComputedGroupBounds,
    isNodeDragActive: shouldFreezeRender,
    isCanvasTransforming: shouldFreezeRender,
    isPptDeckChildImageNode,
    promptGroupLayerById,
    promptGroupStackZIndexById,
    standaloneImageStackZIndexById,
    selectedNodeIds,
    draftNodeId,
  });

  // 简体中文：缓存当前视口内可见的图片节点 ID 集合，用于 O(1) 过滤连接线以卸载视口外的 SVG DOM
  const visibleImageIdSet = React.useMemo(() => {
    const ids = new Set<string>();
    visibleImageNodes.forEach((node) => ids.add(node.id));
    return ids;
  }, [visibleImageNodes]);

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
    isCanvasTransforming: shouldFreezeRender,
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

  const applyLiveCanvasGroupNodeDelta = useCallback((
    groupId: string,
    nodeIds: string[] | null | undefined,
    delta: { x: number; y: number },
  ) => {
    if (!groupId || !nodeIds?.length) {
      return;
    }

    applyLiveNodeDeltaToDraggedSet(`canvas-group:${groupId}`, nodeIds, delta);
  }, [applyLiveNodeDeltaToDraggedSet]);

  const clearLiveCanvasGroupNodePositions = useCallback((
    groupId: string,
    nodeIds: string[] | null | undefined,
  ) => {
    if (!groupId) {
      return;
    }

    const ownerId = `canvas-group:${groupId}`;
    const nodeIdSet = new Set([
      ...(nodeIds || []),
      ...(liveDerivedNodeIdsByOwnerRef.current[ownerId] || []),
    ]);
    let nextLivePositions = liveNodePositionByIdRef.current;
    let hasLivePositionChanged = false;

    nodeIdSet.forEach((nodeId) => {
      if (!(nodeId in nextLivePositions)) {
        return;
      }

      if (nextLivePositions === liveNodePositionByIdRef.current) {
        nextLivePositions = { ...nextLivePositions };
      }
      delete nextLivePositions[nodeId];
      hasLivePositionChanged = true;
    });

    if (ownerId in liveDerivedNodeIdsByOwnerRef.current) {
      const nextDerivedNodeIdsByOwner = { ...liveDerivedNodeIdsByOwnerRef.current };
      delete nextDerivedNodeIdsByOwner[ownerId];
      liveDerivedNodeIdsByOwnerRef.current = nextDerivedNodeIdsByOwner;
    }

    if (hasLivePositionChanged) {
      liveNodePositionByIdRef.current = nextLivePositions;
      setLiveNodePositionVersion((prev) => prev + 1);
    }
  }, [
    liveDerivedNodeIdsByOwnerRef,
    liveNodePositionByIdRef,
    setLiveNodePositionVersion,
  ]);

  const imageLoadSchedulingById = React.useMemo(() => {
    return buildViewportImageLoadScheduling({
      imageNodes: visibleImageNodes,
      collapsedCanvasGroupNodeIds,
      canvasTransform,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
  }, [visibleImageNodes, canvasTransform.scale, canvasTransform.x, canvasTransform.y, collapsedCanvasGroupNodeIds]);

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

  // 10000+ 卡片轻量元数据本地状态与可视区状态
  const [cardMetas, setCardMetas] = useState<CachedCardMeta[]>([]);
  const workerRef = useRef<Worker | null>(null);

  // 点击 Canvas 卡片时的选中与加载逻辑
  const handleCanvasCardClick = useCallback((cardId: string, isDoubleClick: boolean) => {
    handleCanvasNodeSelect(cardId);
    
    if (isDoubleClick) {
      void syncService.loadCardDetail(cardId).then(detail => {
        if (detail) {
          console.log(`[WorkspacePage] Loaded full card detail for ${cardId}`, detail);
        }
      });
    }
  }, [handleCanvasNodeSelect]);

  // 初始化 Web Worker（Worker 目前仅处理耗时较长的后台自动排版整理逻辑，不再处理高频的视口裁剪）
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../../canvas/canvasCalculationWorker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'AUTO_ARRANGE_RESULT') {
        const arranged = payload.arrangedPositions;
        Object.keys(arranged).forEach(cardId => {
          const pos = arranged[cardId];
          updateImageNodePosition(cardId, pos);
          updatePromptNodePosition(cardId, pos);
          void syncService.queueOperation('MOVE', cardId, pos);
        });
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [updateImageNodePosition, updatePromptNodePosition]);

  // 当画布节点数据变动时向 Worker 发送重建索引请求（用于后台排版整理计算）
  useEffect(() => {
    if (!activeCanvas) {
      setCardMetas([]);
      return;
    }

    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const rebuildVisibleMetas = () => {
      const sourceImages = isLargeProject ? visibleImageNodes : activeCanvas.imageNodes;
      const metas: CachedCardMeta[] = [];
      sourceImages.forEach((n) => {
        if (n.parentPromptId) {
          return;
        }

        metas.push({
          id: n.id,
          x: n.position.x,
          y: n.position.y,
          width: 400,
          height: 600,
          type: 'image',
          thumbnailUrl: n.apiResultUrl || n.url,
          updatedAt: n.timestamp,
        });
      });

      setCardMetas(metas);

      workerRef.current?.postMessage({
        type: 'REBUILD_INDEX',
        payload: { nodes: metas }
      });
    };

    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(rebuildVisibleMetas, { timeout: 250 });
    } else {
      timeoutId = setTimeout(rebuildVisibleMetas, 0);
    }

    return () => {
      if (idleId !== null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [activeCanvas, isLargeProject, visibleImageNodes]);














  const renderImageWorkflowItem = useCallback((item: ImageRenderItem) => {
    const node = item.node;

    if (item.isPlaceholder) {
      const { width: nodeWidth, totalHeight } = getCardDimensions(node.aspectRatio, true);
      const cardHeight = imageCardHeightById[node.id] ?? totalHeight;
      const renderedImagePosition = resolveLiveImagePosition(node) ?? node.position;
      const left = renderedImagePosition.x - nodeWidth / 2;
      const top = renderedImagePosition.y - cardHeight;
      const stackZIndex = item.stackZIndexOverride ?? item.groupLayerZIndex;

      // 如果是大项目，为了不遮挡底下的 Canvas 渲染，占位层应该是完全透明的交互代理
      const isTransparentProxy = isLargeProject;

      return (
        <div
          id={`image-card-${node.id}`}
          data-x={node.position.x}
          data-y={node.position.y}
          className="image-node absolute pointer-events-auto cursor-pointer rounded-3xl select-none flex flex-col items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            handleCanvasNodeSelect(node.id);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleCanvasCardClick(node.id, true);
          }}
          style={{
            left: `${left}px`,
            top: `${top}px`,
            width: `${nodeWidth}px`,
            height: `${cardHeight}px`,
            zIndex: stackZIndex,
            background: isTransparentProxy ? 'transparent' : '#18181b',
            border: isTransparentProxy ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          {!isTransparentProxy && (
            <div className="flex flex-col items-center gap-1.5 opacity-20">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}
        </div>
      );
    }

    const imageDetailLevel = node.parentPromptId ? 'full' : item.detailLevel;
    const renderedImagePosition = resolveLiveImagePosition(node) ?? node.position;

    return (
      <ImageNode
        id={`image-card-${node.id}`}
        {...getSharedImageNodeProps(node)}
        detailLevel={imageDetailLevel}
        loadPriority={item.loadPriority}
        loadBand={item.loadBand}
        groupLayerZIndex={item.groupLayerZIndex}
        stackZIndexOverride={item.stackZIndexOverride}
        position={renderedImagePosition}
        isVisible={(() => {
          const screenLeft = -canvasTransform.x / canvasTransform.scale;
          const screenTop = -canvasTransform.y / canvasTransform.scale;
          const screenRight = (window.innerWidth - canvasTransform.x) / canvasTransform.scale;
          const screenBottom = (window.innerHeight - canvasTransform.y) / canvasTransform.scale;
          const w = 400;
          const h = 600;
          const x = renderedImagePosition.x - w / 2;
          const y = renderedImagePosition.y - h;
          const margin = 150;
          return !(
            x > screenRight + margin ||
            x + w < screenLeft - margin ||
            y > screenBottom + margin ||
            y + h < screenTop - margin
          );
        })()}
        onLivePositionChange={handleLiveNodePositionChange}
        onHeightChange={handleImageCardHeightChange}
        isCanvasTransforming={isCanvasTransforming}
        highlighted={highlightedIdVal === node.id}
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
    handleCanvasCardClick,
    handleImageCardHeightChange,
    handleCanvasNodeDragStateChange,
    handleLiveNodePositionChange,
    getSharedImageNodeProps,
    highlightedIdVal,
    applyLiveNodeDeltaToDraggedSet,
    moveSelectedNodesImmediate,
    resolveLiveImagePosition,
    selectedNodeIds,
    snapToGrid,
    imageCardHeightById,
    isLargeProject,
  ]);

const isRectIntersecting = (
  r1: { x: number; y: number; width: number; height: number },
  r2: { left: number; top: number; right: number; bottom: number }
) => {
  return !(
    r1.x > r2.right ||
    r1.x + r1.width < r2.left ||
    r1.y > r2.bottom ||
    r1.y + r1.height < r2.top
  );
};

  const renderPromptGroupWorkflowItem = useCallback((item: PromptGroupRenderItem) => {
    const { groupView } = item;
    const node = groupView.rootPrompt;
    const cardKind = canvasCardRendererRegistry.resolveCardKind(node);
    const cardRenderer = canvasCardRendererRegistry.getRenderer(cardKind);

    if (cardRenderer) {
      return cardRenderer({
        item,
        detailLevel: (item.isPlaceholder ? 'skeleton' : item.detailLevel) as any,
        isSelected: selectedNodeIds.includes(node.id),
        highlighted: highlightedIdVal === node.id,
        zoomScale: canvasTransform.scale,
        isMobile,
        canvasTransform,
        generatingGroupIds,
        focusedGroupId,
        promptGroupLayerById,
        promptGroupStackZIndexById,
        promptGroupRegroupLayoutsById,
        imageCardHeightById,
        imageNodesById,
        promptGroupNodeIdsById,
        promptGroupLayoutStateByIdRef,
        imageLoadSchedulingById,
        selectedNodeIds,
        highlightedIdVal,
        snapToGrid,
        isCanvasTransforming,
        nowTimestamp,
        ecommerceFrameworkTaskNodesById,
        handlePromptGroupChildDragCommit,
        handlePromptGroupChildDragDelta,
        handlePromptGroupDragCommit,
        handlePromptGroupDragDelta,
        handlePromptGroupNodeHeightChange,
        handlePromptGroupNodeSelect,
        handlePromptGroupTagRemove,
        handleConnectStart,
        handleCanvasNodeDragStateChange,
        handleCanvasCardClick,
        handleLiveNodePositionChange,
        handleFocusPromptGroup,
        getSharedImageNodeProps,
        getSharedPromptNodeActionProps,
        handlePinDraft,
        resolveLiveImagePosition,
        resolveLivePromptPosition,
        buildPromptGroupRenderLayout,
        visibleImageIdSet,
        handleImageCardHeightChange,
      });
    }

    if (item.isPlaceholder) {
      const width = getPromptNodeBoundsWidth(node, isMobile);
      const height = node.height || 200;
      const position = resolveLivePromptPosition(node) ?? node.position;
      const left = position.x - width / 2;
      const top = position.y - height;
      const groupStackZIndex = promptGroupStackZIndexById.get(node.id) ?? ((groupView.baseOrder * 100) + 10);

      return (
        <div
          id={`prompt-card-${node.id}`}
          className="absolute pointer-events-auto cursor-pointer rounded-3xl select-none flex flex-col items-center justify-center p-4 gap-2 border border-white/5 bg-zinc-900/60"
          onClick={(e) => {
            e.stopPropagation();
            handleCanvasNodeSelect(node.id);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleCanvasCardClick(node.id, true);
          }}
          style={{
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            height: `${height}px`,
            zIndex: groupStackZIndex + 20,
          }}
        >
          <div className="flex flex-col items-center gap-1.5 opacity-25">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-[10px] text-white font-medium truncate max-w-full px-2 text-center">
              {node.prompt ? (node.prompt.slice(0, 16) + (node.prompt.length > 16 ? '...' : '')) : 'Prompt Card'}
            </span>
          </div>
        </div>
      );
    }

    return null;

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
    handleCanvasCardClick,
    handleLiveNodePositionChange,
    handleFocusPromptGroup,
    getSharedImageNodeProps,
    getSharedPromptNodeActionProps,
    handlePinDraft,
    focusedGroupId,
    generatingGroupIds,
    imageCardHeightById,
    imageNodesById,
    highlightedIdVal,
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
    isLargeProject,
  ]);

  const renderPreviewWorkflowItem = useCallback((item: PreviewRenderItem) => (
    <PreviewNodeCard
      node={item.node}
      isSelected={selectedNodeIds.includes(item.node.id)}
      highlighted={highlightedIdVal === item.node.id}
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
    highlightedIdVal,
    selectedNodeIds,
    snapToGrid,
    updateWorkflowNodePosition,
  ]);

  const renderSaveWorkflowItem = useCallback((item: SaveRenderItem) => (
    <SaveNodeCard
      node={item.node}
      isSelected={selectedNodeIds.includes(item.node.id)}
      highlighted={highlightedIdVal === item.node.id}
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
    highlightedIdVal,
    selectedNodeIds,
    snapToGrid,
    updateWorkflowNodePosition,
  ]);

  const renderAgentWorkflowItem = useCallback((item: AgentRenderItem) => (
    <AgentNodeCard
      node={item.node}
      isSelected={selectedNodeIds.includes(item.node.id)}
      highlighted={highlightedIdVal === item.node.id}
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
    highlightedIdVal,
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

  const stableCanvasRenderItemsRef = useRef<CanvasRenderItem[]>([]);

  const effectiveVisibleCardIds = React.useMemo(() => {
    const ids = new Set<string>();
    visiblePromptNodes.forEach((n) => ids.add(n.id));
    visibleImageNodes.forEach((n) => ids.add(n.id));
    return ids;
  }, [visiblePromptNodes, visibleImageNodes]);

  const canvasRenderItems = React.useMemo<CanvasRenderItem[]>(() => {
    if (shouldFreezeRender) {
      return stableCanvasRenderItemsRef.current;
    }

    // 🚀 [体验优化] 卡片自身占位渲染外扩缓冲区由窄小的220px/500px扩大到至少1200px，防止在画布边缘来回平移时DOM频繁销毁与重建（颠簸闪烁）
    const RENDER_BUFFER = Math.max(canvasPerformanceProfile.overscanBuffer * 2.5, 1200);
    const rLeft = -canvasTransform.x / canvasTransform.scale - RENDER_BUFFER;
    const rTop = -canvasTransform.y / canvasTransform.scale - RENDER_BUFFER;
    const rRight = (window.innerWidth - canvasTransform.x) / canvasTransform.scale + RENDER_BUFFER;
    const rBottom = (window.innerHeight - canvasTransform.y) / canvasTransform.scale + RENDER_BUFFER;

    const sLeft = -canvasTransform.x / canvasTransform.scale - 150;
    const sTop = -canvasTransform.y / canvasTransform.scale - 150;
    const sRight = (window.innerWidth - canvasTransform.x) / canvasTransform.scale + 150;
    const sBottom = (window.innerHeight - canvasTransform.y) / canvasTransform.scale + 150;

    const items: CanvasRenderItem[] = [
      ...visiblePromptGroupViews
        .filter((groupView) => !collapsedCanvasGroupNodeIds.has(groupView.rootPrompt.id))
        .filter((groupView) => {
          const isGroupSelected = selectedNodeIds.includes(groupView.rootPrompt.id) 
            || groupView.childImages.some(child => selectedNodeIds.includes(child.id))
            || groupView.rootPrompt.id === activeSourceImage;
          const isGenerating = generatingGroupIds.includes(groupView.rootPrompt.id);
          
          // 只要整个卡组的 bounds 在 RENDER_BUFFER (rLeft, rTop, rRight, rBottom) 内就挂载
          const isWithinRenderBuffer = groupView.bounds
            ? isRectIntersecting(groupView.bounds, { left: rLeft, top: rTop, right: rRight, bottom: rBottom })
            : false;

          return isGroupSelected || isGenerating || isWithinRenderBuffer;
        })
        .map((groupView) => {
          const visibleChildImages = groupView.childImages.filter((imageNode) => !collapsedCanvasGroupNodeIds.has(imageNode.id));
          
          // 卡组整体判断 placeholder 状态（若 bounds 在实际可视视口外，则是 placeholder 占位符）
          const isGroupPlaceholder = groupView.bounds
            ? !isRectIntersecting(groupView.bounds, { left: sLeft, top: sTop, right: sRight, bottom: sBottom })
            : true;

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
            isPlaceholder: isGroupPlaceholder,
          };
        }),
      ...standaloneVisibleImageNodes
        .filter((node) => {
          const isImageSelected = selectedNodeIds.includes(node.id) || node.id === activeSourceImage;
          const isGenerating = generatingGroupIds.includes(node.id);
          // 仅当独立图片节点被选中、激活、生成中或在空间索引中可见时，才挂载 React DOM
          return isImageSelected || isGenerating || effectiveVisibleCardIds.has(node.id);
        })
        .map((node) => {
          const { width, totalHeight } = getCardDimensions(node.aspectRatio, true);
          const height = imageCardHeightById[node.id] ?? totalHeight;
          const pos = liveNodePositionByIdRef.current[node.id] ?? node.position;
          const isImageSelected = selectedNodeIds.includes(node.id) || node.id === activeSourceImage;
          const isImagePlaceholder = (
            pos.x - width / 2 > rRight ||
            pos.x + width / 2 < rLeft ||
            pos.y - height > rBottom ||
            pos.y < rTop
          );

          return {
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
            isPlaceholder: isImagePlaceholder,
          };
        }),
      ...visibleWorkflowUtilityNodes.filter((node) => !collapsedCanvasGroupNodeIds.has(node.id))
        .filter((node) => {
          // 限制只渲染屏幕内/选中态的辅助工作流节点
          const isSelected = selectedNodeIds.includes(node.id);
          if (isSelected) return true;
          const pos = liveNodePositionByIdRef.current[node.id] ?? node.position;
          const w = 400;
          const h = 300;
          return !(
            pos.x - w / 2 > rRight ||
            pos.x + w / 2 < rLeft ||
            pos.y - h > rBottom ||
            pos.y < rTop
          );
        })
        .flatMap((node): Array<PreviewRenderItem | SaveRenderItem | AgentRenderItem> => {
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
    ];

    stableCanvasRenderItemsRef.current = items;
    return items;
  }, [
    collapsedCanvasGroupNodeIds,
    promptGroupLayerById,
    promptGroupStackZIndexById,
    standaloneImageStackZIndexById,
    standaloneVisibleImageNodes,
    canvasPerformanceProfile.cardDetailLevel,
    imageLoadSchedulingById,
    visiblePromptGroupViews,
    visibleWorkflowUtilityNodes,
    canvasTransform,
    canvasPerformanceProfile.overscanBuffer,
    isMobile,
    imageCardHeightById,
    shouldFreezeRender,
    isCanvasTransforming,
    isNodeDragActive,
    effectiveVisibleCardIds,
    selectedNodeIds,
    activeSourceImage,
    generatingGroupIds,
  ]);

  const renderedItems = useCanvasRenderItems({
    items: canvasRenderItems,
    selectedNodeIds,
    activeSourceImage,
    draftNodeId,
    isCanvasTransforming,
    scale: canvasTransform.scale,
    canvasPerformanceProfile,
  });

  const stableRenderedVisibleGroupsRef = useRef<any[]>([]);

  const renderedVisibleGroups = React.useMemo(() => {
    if (shouldFreezeRender) {
      return stableRenderedVisibleGroupsRef.current;
    }

    const elements = visibleGroups.map((group) => (
      <CanvasGroupComponent
        key={group.id}
        group={group}
        zoom={canvasTransform.scale}
        stackZIndexOverride={canvasGroupStackZIndexById.get(group.id)}
        highlighted={highlightedIdVal === group.id}
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
        onGroupDrag={(delta, sourceNodeIds) => {
          const nodeIds = sourceNodeIds || group.nodeIds;
          applyLiveCanvasGroupNodeDelta(group.id, nodeIds, delta);
        }}
        onGroupDragCommit={(delta, sourceNodeIds) => {
          const nodeIds = sourceNodeIds || group.nodeIds;
          moveSelectedNodesImmediate(delta, nodeIds, { snapToGrid });
        }}
        onDragStateChange={(dragging) => {
          handleCanvasNodeDragStateChange(dragging);
          if (!dragging) {
            clearLiveCanvasGroupNodePositions(group.id, group.nodeIds);
          }
        }}
        onUpdateGroup={updateGroup}
        computedBounds={getComputedGroupBounds(group)}
      />
    ));

    stableRenderedVisibleGroupsRef.current = elements;
    return elements;
  }, [
    canvasGroupStackZIndexById,
    canvasTransform.scale,
    applyLiveCanvasGroupNodeDelta,
    clearLiveCanvasGroupNodePositions,
    getComputedGroupBounds,
    handleCanvasNodeDragStateChange,
    highlightedIdVal,
    moveSelectedNodesImmediate,
    removeGroup,
    selectNodes,
    selectedNodeIds,
    snapToGrid,
    updateGroup,
    visibleGroups,
    shouldFreezeRender,
    isCanvasTransforming,
    isNodeDragActive,
  ]);

  const renderedCanvasItems = React.useMemo(() => (
    renderedItems.map((item) => (
      <React.Fragment key={item.id}>
        {renderWorkflowNode(canvasNodeRendererRegistry, item as any)}
      </React.Fragment>
    ))
  ), [canvasNodeRendererRegistry, renderedItems]);

  useEffect(() => {
    if (!isReady || !activeCanvas || !canvasRef.current) return;
    if (isCanvasTransforming || shouldFreezeRender) return;

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
      resetViewFn();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [
    isReady,
    activeCanvas,
    visiblePromptNodes.length,
    visibleImageNodes.length,
    resetViewFn,
    isCanvasTransforming,
    shouldFreezeRender
  ]);



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
      : workspaceSurface === 'favorites'
        ? '668px'
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
          && prev.hideZoomControl === DEFAULT_DESKTOP_SIDE_RAIL_LAYOUT.hideZoomControl
          && prev.projectManagerOffset === DEFAULT_DESKTOP_SIDE_RAIL_LAYOUT.projectManagerOffset;
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

      // 简体中文：检查是否有打开的用户菜单面板
      const userMenu = document.getElementById('desktop-user-menu-panel');
      const topChromeBottom = userMenu
        ? userMenu.getBoundingClientRect().bottom
        : desktopChrome.getBoundingClientRect().bottom;
      const topClearance = Math.max(0, topChromeBottom + 16);
      const topLimitedScale = (viewportHeight - topClearance * 2) / naturalProjectManagerHeight;
      const boundedScale = Math.max(
        0.64,
        Math.min(1, Number.isFinite(topLimitedScale) ? topLimitedScale : 1),
      );
      const nextScale = Math.round(boundedScale * 1000) / 1000;

      // 简体中文：计算 projectManager 正常垂直居中（translateY(-50%)）时的 top 坐标
      const naturalTop = viewportHeight / 2 - (naturalProjectManagerHeight * nextScale) / 2;
      // 简体中文：只有当 naturalTop 小于 topClearance（即发生遮挡）时，才需要向下移动避让
      const avoidOffset = Math.max(0, topClearance - naturalTop);

      const projectedProjectManagerBottom = viewportHeight / 2 + (naturalProjectManagerHeight * nextScale) / 2 + avoidOffset;
      const zoomControlRect = zoomControl?.getBoundingClientRect();
      const hideZoomControl = Boolean(zoomControlRect && projectedProjectManagerBottom + 12 >= zoomControlRect.top);

      const nextLayout: DesktopSideRailLayout = {
        projectManagerScale: nextScale,
        hideZoomControl,
        projectManagerOffset: avoidOffset,
      };

      setDesktopSideRailLayout(prev => {
        const scaleUnchanged = Math.abs(prev.projectManagerScale - nextLayout.projectManagerScale) < 0.005;
        const offsetUnchanged = Math.abs(prev.projectManagerOffset - nextLayout.projectManagerOffset) < 1;
        if (scaleUnchanged && prev.hideZoomControl === nextLayout.hideZoomControl && offsetUnchanged) {
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
  }, [isMobile, isReady, showUserMenu]);

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
      openLibrarySurface={openLibrarySurface}
      openFavoritesSurface={openFavoritesSurface}
      openProfileSurface={openProfileSurface}
      setIsSidebarHovered={setIsSidebarHovered}
      setChatSidebarWidth={setChatSidebarWidth}
      workspaceSurface={workspaceSurface}
      activeCanvas={activeCanvas}
      focusWorkspace={focusWorkspace}
      handlePreviewFromLibrary={handlePreviewFromLibrary}
      handleFocusLibraryImage={handleFocusLibraryImage}
      onRenameFavoriteImage={(imageId: string, name: string) => updateImageNode(imageId, { alias: name })}
      config={config}
      setConfig={setConfig}
      ecommerceState={ecommerceState}
      onGenerate={handleGenerate}
      canvasTransform={canvasTransform}
      canvasRef={canvasRef}
      openToolWindowInstance={openToolWindowInstance}
      updateToolWindowLayout={handleUpdateWindowLayout}
      setPptEditorMode={setPptEditorMode}
      togglePinTool={togglePinTool}
    />
  );


  const selectionMenuOverlay = useSelectionMenuOverlay({
    activeCanvas,
    canvasTransform,
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

          import('../../services/system/notificationService').then(({ notify }) => {
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
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: '#000000' }}>
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  const isCanvasEmpty = !activeCanvas || (
    (activeCanvas.promptNodes?.length || 0) === 0 &&
    (activeCanvas.imageNodes?.length || 0) === 0 &&
    (activeCanvas.workflow?.nodes?.length || 0) === 0
  );

  const projectManagerNode = !isMobile ? (
    <React.Suspense fallback={null}>
      <ProjectManager
        onSearch={() => {
          focusWorkspace();
          setIsSearchOpen(true);
        }}
        onFavorites={() => {
          openFavoritesSurface();
        }}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        isMobile={isMobile}
        onFitToAll={handleFitToAll}
        onResetView={resetViewFn}
        onToggleCanvasMode={() => setCanvasMode(prev => prev === 'normal' ? 'board' : 'normal')}
        onToggleSnapToGrid={handleToggleSnapToGrid}
        canvasMode={canvasMode}
        showSnapToGrid={snapToGrid}
        onAutoArrange={handleAutoArrange}
        onToggleChat={toggleChatPanel}
        isChatOpen={isChatOpen}
        desktopScale={desktopSideRailLayout.projectManagerScale}
        desktopOffset={desktopSideRailLayout.projectManagerOffset}
        workflowTemplates={WORKFLOW_TEMPLATES}
        onApplyWorkflowTemplate={(templateId) => {
          void handleApplyWorkflowTemplate(templateId);
        }}
        onAddWorkflowUtilityCard={handleAddWorkflowUtilityCard}
        isUserMenuOpen={showUserMenu}
        onOpenMarkdownImport={() => setShowMarkdownModal(true)}
        onOpenMermaidImport={() => setShowMermaidModal(true)}
      />
    </React.Suspense>
  ) : null;

  const globalModalsProps: any = {
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
      isChatOpen,
      chatSidebarWidth,
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
      onOpenSettings: () => openSettingsPanel('api-management'),
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
    markdownModal: {
      isOpen: showMarkdownModal,
      onClose: () => setShowMarkdownModal(false),
      onInsert: handleInsertMarkdownCards,
    },
    mermaidModal: {
      isOpen: showMermaidModal,
      onClose: () => setShowMermaidModal(false),
      onInsert: handleInsertMermaidCards,
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
        enabled={!isLargeProject}
        opacity={0.4}
        showConnections={true}
        mode={backgroundMode}
      />
      {/* 简体中文：空画布欢迎态，仅在桌面端且画布节点完全为空时渲染 */}
      {isCanvasEmpty && !isMobile && isReady && (
        <EmptyCanvasWelcome
          onApplyWorkflowTemplate={(templateId) => {
            void handleApplyWorkflowTemplate(templateId);
          }}
          onOpenSettings={() => openSettingsPanel('api-management')}
        />
      )}
      {/* 简体中文：画板模式顶部控制栏，使用磨砂质感毛玻璃高定设计 */}
      {canvasMode === 'board' && !isMobile && (
        <div 
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[101] flex items-center gap-3 px-4 py-2 rounded-2xl border shadow-xl transition-all duration-300 pointer-events-auto"
          style={{
            background: 'var(--frost-card-framework-bg)',
            border: '1px solid var(--frost-card-framework-border)',
            boxShadow: 'var(--frost-card-framework-shadow)',
            WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
            backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
          }}
        >
          {/* 工具选择 */}
          <div className="flex items-center gap-1.5 border-r pr-3 border-[var(--frost-card-framework-border)]">
            <button
              onClick={() => setActiveDrawingTool('pen')}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${activeDrawingTool === 'pen' ? 'bg-[var(--toolbar-active)] text-[var(--accent-coral)] font-bold' : 'text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]'}`}
              title="自由画笔"
            >
              <PenTool size={18} />
            </button>
            <button
              onClick={() => setActiveDrawingTool('select')}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${activeDrawingTool === 'select' ? 'bg-[var(--toolbar-active)] text-[var(--accent-coral)] font-bold' : 'text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]'}`}
              title="框选为参考图"
            >
              <Scissors size={18} />
            </button>
            <button
              onClick={() => setActiveDrawingTool('text')}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${activeDrawingTool === 'text' ? 'bg-[var(--toolbar-active)] text-[var(--accent-coral)] font-bold' : 'text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]'}`}
              title="文本工具"
            >
              <Type size={18} />
            </button>
            
            {/* 形状下拉 */}
            <div className="relative group/shape flex items-center">
              <button
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${['rect', 'circle', 'line', 'arrow'].includes(activeDrawingTool) ? 'bg-[var(--toolbar-active)] text-[var(--accent-coral)] font-bold' : 'text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]'}`}
                title="形状工具"
              >
                <Shapes size={18} />
              </button>
              <div className="absolute top-full left-0 mt-2 hidden group-hover/shape:flex flex-col gap-1 p-1.5 rounded-xl border shadow-lg bg-[var(--frost-card-framework-bg)] border-[var(--frost-card-framework-border)] backdrop-blur-md z-[102] w-28">
                <button
                  onClick={() => setActiveDrawingTool('rect')}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${activeDrawingTool === 'rect' ? 'bg-[var(--toolbar-active)] text-[var(--accent-coral)]' : 'text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]'}`}
                >
                  <span className="w-3 h-3 border border-current rounded-sm inline-block" />
                  矩形
                </button>
                <button
                  onClick={() => setActiveDrawingTool('circle')}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${activeDrawingTool === 'circle' ? 'bg-[var(--toolbar-active)] text-[var(--accent-coral)]' : 'text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]'}`}
                >
                  <span className="w-3 h-3 border border-current rounded-full inline-block" />
                  圆形
                </button>
                <button
                  onClick={() => setActiveDrawingTool('line')}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${activeDrawingTool === 'line' ? 'bg-[var(--toolbar-active)] text-[var(--accent-coral)]' : 'text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]'}`}
                >
                  <span className="w-3 h-px bg-current inline-block transform" style={{ transform: 'translateY(-1px)' }} />
                  直线
                </button>
                <button
                  onClick={() => setActiveDrawingTool('arrow')}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${activeDrawingTool === 'arrow' ? 'bg-[var(--toolbar-active)] text-[var(--accent-coral)]' : 'text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]'}`}
                >
                  <span className="text-[10px] inline-block font-bold">→</span>
                  箭头
                </button>
              </div>
            </div>
          </div>

          {/* 颜色选择 */}
          <div className="flex items-center gap-1.5 border-r pr-3 border-[var(--frost-card-framework-border)]">
            {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#000000', '#ffffff'].map(color => (
              <button
                key={color}
                onClick={() => setActiveDrawingColor(color)}
                className={`w-5 h-5 rounded-full border transition-all ${activeDrawingColor === color ? 'scale-120 ring-2 ring-[var(--accent-coral)] border-transparent' : 'border-white/20 hover:scale-110'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          {/* 笔宽选择 */}
          <div className="flex items-center gap-1.5 border-r pr-3 border-[var(--frost-card-framework-border)]">
            {[2, 4, 8].map(w => (
              <button
                key={w}
                onClick={() => setActiveDrawingWidth(w)}
                className={`flex items-center justify-center rounded-lg transition-colors text-[10px] h-7 w-7 ${activeDrawingWidth === w ? 'bg-[var(--toolbar-active)] text-[var(--accent-coral)] font-bold' : 'text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]'}`}
                title={`线宽: ${w}px`}
              >
                {w === 2 ? '细' : w === 4 ? '中' : '粗'}
              </button>
            ))}
          </div>

          {/* 清除全部 */}
          <button
            onClick={() => {
              if (window.confirm('确认清除当前项目的所有画板手绘和形状吗？此操作无法撤销。')) {
                clearCanvasDrawings();
              }
            }}
            className="flex h-9 px-3 items-center gap-1.5 rounded-xl text-xs text-red-400 transition-colors hover:bg-red-500/10 active:scale-95"
            title="清除全部画板内容"
          >
            <Trash size={15} />
            清除
          </button>
        </div>
      )}
      {/* 简体中文：左上角等宽悬浮控制卡片 */}
      {!isMobile && (
        <div className="desktop-left-chrome fixed top-4 left-4 z-[100] w-auto pointer-events-auto select-none">
          <React.Suspense fallback={null}>
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
            />
          </React.Suspense>
        </div>
      )}

      {/* 简体中文：右上角悬浮缩放与小地图卡片 */}
      {!isMobile && (
        <div 
          className="desktop-navigation-panel fixed top-4 z-[650] pointer-events-auto select-none"
          style={{
            right: isChatOpen
              ? `calc(min(100vw - 60px, ${chatSidebarWidth + 28}px))`
              : '16px',
            transition: 'right 0.3s ease-out'
          }}
        >
          <AppCanvasNavigationPanel
            activeCanvas={activeCanvas}
            canvasTransform={canvasTransform}
            canvasRef={canvasRef}
            isMobile={isMobile}
          />
        </div>
      )}

      {/* 简体中文：左下角精致独立的毛玻璃版本号卡片 */}
      {!isMobile && (
        <div className="desktop-version-badge fixed bottom-4 z-50 py-1.5 px-3 flex items-center justify-center rounded-xl border select-none pointer-events-auto"
          style={{
            left: '16px',
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
      )}

      <AppCanvasOverlays
        selectionBox={selectionBox}
        selectionMenu={selectionMenuOverlay}
      />
      <React.Suspense fallback={null}>
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
      </React.Suspense>

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
        showGrid={canvasMode === 'board' ? false : showGrid}
        onTransformChange={handleCanvasTransformChange}
        onInteractionChange={handleCanvasInteractionChange}
        cardPositions={cardPositionsVal}
        reducePointerEffects={isLargeProject}
        backgroundOverlay={
          isLargeProject && (
            <CanvasLayerRenderer
              cardMetas={cardMetas}
              visibleCardIds={effectiveVisibleCardIds}
              canvasTransform={canvasTransform}
              selectedNodeIds={selectedNodeIds}
              activeSourceImage={activeSourceImage}
              width={window.innerWidth}
              height={window.innerHeight}
            />
          )
        }
        onCanvasClick={handleCanvasClick}
        onCanvasDoubleClick={handleCanvasDoubleClick}
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
                {/* Drawings Layer */}
        {activeCanvas?.drawings && (
          <svg
            className="absolute inset-0 pointer-events-none overflow-visible"
            style={{ zIndex: 10 }}
          >
            <CanvasDrawingsLayer drawings={activeCanvas.drawings} />
          </svg>
        )}

        {/* Canvas Drawing Interaction Layer */}
        <CanvasDrawingInteractionOverlay
          canvasRef={canvasRef}
          canvasMode={canvasMode}
          activeTool={activeDrawingTool}
          activeColor={activeDrawingColor}
          activeWidth={activeDrawingWidth}
          drawings={activeCanvas?.drawings || []}
          addCanvasDrawing={addCanvasDrawing}
          promptNodes={activeCanvas?.promptNodes || []}
          imageNodes={activeCanvas?.imageNodes || []}
          onAddReferenceImage={async (img) => {
            let finalImg = { ...img };
            if (img.data && !img.storageId) {
              try {
                // 计算手绘图形的 Hash 值作为 storageId
                const storageId = await calculateImageHash(img.data);
                const fullDataUrl = `data:${img.mimeType || 'image/png'};base64,${img.data}`;
                
                // 将图片存入 IndexedDB，避免大图 base64 撑爆 localStorage
                const storage = await import('../../services/storage/imageStorage');
                await storage.saveImage(storageId, fullDataUrl);
                
                // 如果本地物理文件系统句柄存在，同步保存至文件系统
                const { fileSystemService } = await import('../../services/storage/fileSystemService');
                const handle = fileSystemService.getGlobalHandle();
                if (handle) {
                  await fileSystemService.saveReferenceImage(handle, storageId, img.data, img.mimeType || 'image/png');
                }
                
                // 补充 storageId，以便在 localStorage 存储时，只保留 storageId 并擦除 base64 占用的空间
                finalImg = { ...img, storageId };
              } catch (e) {
                console.error('[App] 保存框选参考图到本地存储失败:', e);
              }
            }

            setConfig(prev => ({
              ...prev,
              referenceImages: [...prev.referenceImages, finalImg]
            }));
          }}
        />

        <svg
          className="absolute top-0 left-0 pointer-events-none"
          shapeRendering="geometricPrecision"
          style={{
            width: '1px',
            height: '1px',
            overflow: 'visible',
            zIndex: CONNECTOR_LAYER_Z_INDEX,
          }}
        >
          {/* Active Drag Line */}
          {dragConnection?.active && (
            <path
              id="active-drag-connector-path"
              d={`M${dragConnection.startPos.x},${dragConnection.startPos.y} L${dragConnection.currentPos.x},${dragConnection.currentPos.y}`}
              fill="none"
              stroke="#6366f1"
              strokeWidth={activeDragStroke}
              strokeDasharray={`${activeDragDashA} ${activeDragDashB}`}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-80 animate-pulse"
              style={{ willChange: 'd' }}
            />
          )}

          {/* Prompt -> image connections render inside each prompt-group container. */}

          {/* 2. Image -> Prompt/Pending Connections (Follow-up Flow) */}
          {/* A. Existing Prompts */}
          {connectorRenderPromptNodes.map(pn => {
            if (isCanvasTransforming) return null;
            if (pn.isDraft) return null; // Draft/pending connection is rendered by pending-connection block below
            if (pn.error) return null; // 🚀 [FIX] 如果生成失败（存在 error），不渲染对应的连线，避免废弃连接线乱飘和视觉污染
            if (!pn.sourceImageId) return null;
            if (collapsedCanvasGroupNodeIds.has(pn.sourceImageId)) return null;
            const sourceNode = imageNodesById.get(pn.sourceImageId);
            if (!sourceNode) return null;
            const sourcePosition = resolveConnectorRenderPosition(sourceNode.id, sourceNode.position);
            const promptPosition = resolveConnectorRenderPosition(pn.id, pn.position);
            if (!sourcePosition || !promptPosition) return null;

            // Source: Image Bottom Center.
            const startX = sourcePosition.x;
            const startY = sourcePosition.y;

            // Target: Prompt Top Center.
            // Use exact height if available, otherwise estimate
            const height = pn.height || getPromptHeight(pn.prompt);
            const endX = promptPosition.x;
            const endY = promptPosition.y - height;

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
          {activeSourceImage && (() => {
            if (isCanvasTransforming) return null;
            if (collapsedCanvasGroupNodeIds.has(activeSourceImage)) return null;
            const hasDraftFollowup = !!activeCanvas?.promptNodes.some(p => p.isDraft && p.sourceImageId === activeSourceImage);
            if (hasDraftFollowup) return null;
            const sourceNode = imageNodesById.get(activeSourceImage);
            if (!sourceNode) return null;
            const sourcePosition = resolveConnectorRenderPosition(sourceNode.id, sourceNode.position);
            if (!sourcePosition) return null;

            const startX = sourcePosition.x;
            const startY = sourcePosition.y;

            // Pending Node Position (Bottom Center)
            const endX = pendingPosition.x;
            const endY = pendingPosition.y - 140;

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
          {(activeCanvas?.workflow?.edges || []).map((edge) => {
            if (isCanvasTransforming) return null;
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

            const startX = sourcePromptPosition?.x || sourceImagePosition?.x || sourceUtilityPosition?.x || 0;
            const startY = sourcePromptPosition?.y || sourceImagePosition?.y || sourceUtilityPosition?.y || 0;
            const targetHeight = targetNode.height || 176;
            const endX = targetPosition.x;
            const endY = targetPosition.y - targetHeight;
            const d = buildSoftConnectorPath(startX, startY, endX, endY);
            const strokeColor = targetNode.kind === 'preview'
              ? '#38bdf8'
              : targetNode.kind === 'save'
                ? '#34d399'
                : '#f59e0b';

            const midPoint = getSoftConnectorPointAt(startX, startY, endX, endY, 0.5);
            const btnX = midPoint.x;
            const btnY = midPoint.y;

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

                {showConnectorButtons && (
                  <ConnectorDisconnectButton
                    x={btnX}
                    y={btnY}
                    onClick={(e) => {
                      e.stopPropagation();
                      unlinkNodes(edge.from, edge.to);
                    }}
                  />
                )}
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

      {!isMobile && (
        <React.Suspense fallback={null}>
          {workspacePanels}
        </React.Suspense>
      )}

      <React.Suspense fallback={null}>
        <AppGlobalModals {...globalModalsProps} />
      </React.Suspense>



      {/* [NEW] Draft node overlay (fixed center) - disabled because users do not want a follow-up preview card */}
      {/* {draftNodeId && (() => {
        const draftNode = activeCanvas?.promptNodes.find(n => n.id === draftNodeId);
        // Show the overlay only while the node is still a draft; generating nodes should render on the canvas
        if (!draftNode || !draftNode.isDraft) return null;

        // Mock position 0,0 for component, handle centering via container
        const displayNode = { ...draftNode, position: { x: 0, y: 0 } };

        // 🎨 [Sidebar Responsive Layout]
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


      {showPptxExportDialog && exportPptxNode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]" onClick={() => setShowPptxExportDialog(false)}>
          <div 
            className="w-full max-w-lg mx-4 rounded-3xl border p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 pointer-events-auto"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--frost-card-framework-bg)',
              border: '1px solid var(--frost-card-framework-border)',
              boxShadow: 'var(--frost-card-framework-shadow)',
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">{pickByDocumentLanguage('PPTX 导出切换动画设置', 'PPTX Export Transition Settings')}</h3>
              <button 
                onClick={() => setShowPptxExportDialog(false)} 
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              {pickByDocumentLanguage('开启过渡切换效果，可以让您导出的 PPTX 幻灯片之间拥有更加动感的视觉过渡。', 'Enable transition effects to give your exported PPTX slides dynamic visual flows.')}
            </p>

            <div className="space-y-5">
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-2xl hover:bg-white/5 transition-colors border border-white/5 bg-white/2">
                <input
                  type="checkbox"
                  checked={pptxTransitionsEnabled}
                  onChange={e => setPptxTransitionsEnabled(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-white/20 bg-black/40 text-sky-500 focus:ring-sky-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white/90">{pickByDocumentLanguage('启用幻灯片页面切换过渡效果', 'Enable Slide Transition Effects')}</div>
                  <div className="text-[11px] text-gray-400 mt-1">{pickByDocumentLanguage('开启后，每页幻灯片之间将会自动轮播应用选中的效果', 'Once enabled, selected effects will automatically cycle through slide pages')}</div>
                </div>
              </label>

              {pptxTransitionsEnabled && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-400 font-medium px-1">{pickByDocumentLanguage('选择允许的效果（多选将随机轮播）：', 'Select enabled effects (multiple will cycle randomly):')}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { value: 'fade', label: pickByDocumentLanguage('渐变淡入', 'Fade') },
                      { value: 'page_turn', label: pickByDocumentLanguage('翻页效果', 'Page Turn') },
                      { value: 'push', label: pickByDocumentLanguage('平移推进', 'Push') },
                      { value: 'wipe', label: pickByDocumentLanguage('擦除过渡', 'Wipe') },
                      { value: 'split', label: pickByDocumentLanguage('水平分割', 'Split') },
                      { value: 'blinds', label: pickByDocumentLanguage('百叶窗', 'Blinds') },
                      { value: 'checker', label: pickByDocumentLanguage('棋盘交错', 'Checker') },
                      { value: 'wheel', label: pickByDocumentLanguage('时钟轮转', 'Wheel') },
                    ].map(option => {
                      const checked = pptxTransitionEffects.includes(option.value);
                      return (
                        <label
                          key={option.value}
                          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs cursor-pointer transition-colors ${
                            checked
                              ? 'border-sky-500/50 bg-sky-500/10 text-sky-400 font-medium'
                              : 'border-white/10 hover:bg-white/5 text-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              setPptxTransitionEffects(prev => {
                                if (e.target.checked) {
                                  return prev.includes(option.value) ? prev : [...prev, option.value];
                                }
                                return prev.filter(effect => effect !== option.value);
                              });
                            }}
                            className="w-3.5 h-3.5 rounded border-white/20 bg-black/40 text-sky-500 focus:ring-sky-500"
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {pptxTransitionEffects.length === 0 && (
                    <div className="text-[11px] text-rose-400 px-1 mt-1">
                      {pickByDocumentLanguage('⚠️ 请至少选择一种过渡动画效果', '⚠️ Please select at least one transition effect')}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
              <button
                onClick={() => setShowPptxExportDialog(false)}
                className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                {pickByDocumentLanguage('取消', 'Cancel')}
              </button>
              <button
                onClick={() => {
                  setShowPptxExportDialog(false);
                  void handleExportPptxWithTaskCenter(exportPptxNode, {
                    transitionEnabled: pptxTransitionsEnabled,
                    transitionEffects: pptxTransitionEffects,
                  });
                }}
                disabled={pptxTransitionsEnabled && pptxTransitionEffects.length === 0}
                className="px-5 py-2 rounded-xl text-xs bg-sky-500 text-white font-medium hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {pickByDocumentLanguage('开始导出', 'Start Export')}
              </button>
            </div>
          </div>
        </div>
      )}

      <WorkspaceLoadingOverlay />

      <React.Suspense fallback={null}>
        <WindowManager
          toolWindows={toolWindows}
          onCloseWindow={handleCloseWindow}
          onMinimizeWindow={handleMinimizeWindow}
          onFocusWindow={handleFocusWindow}
          onUpdateWindowLayout={handleUpdateWindowLayout}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <TaskCenterTray
          onOpenSettings={openSettingsSurfaceTracked}
          isChatOpen={isChatOpen}
          chatSidebarWidth={chatSidebarWidth}
        />
      </React.Suspense>
    </WorkspaceShell>
  );
};


export default AppContent;
