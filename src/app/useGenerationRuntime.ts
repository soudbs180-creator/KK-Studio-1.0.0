import { useCallback } from 'react';

import type { CreditConsumeResult, CreditRefundResult } from '../context/BillingContext';
import { keyManager } from '../services/auth/keyManager';
import {
  buildGenerationBillingAttempt,
  buildGenerationAttemptRequestId,
  resolveGenerationAttemptFailureState,
} from '../services/billing/generationBillingCoordinator';
import type { GenerateImageResult } from '../services/llm/geminiService';
import type { VideoGenerationResult } from '../services/llm/LLMAdapter';
import { adminModelService } from '../services/model/adminModelService';
import { getModelCapabilities } from '../services/model/modelCapabilities';
import type { ModelExecutionLane } from '../services/model/modelExecutionLane';
import { GenerationMode, ImageSize, type Canvas, type GeneratedImage, type GenerationConfig, type PromptNode, type ReferenceImage } from '../types';
import { buildCancelledPromptNodePatch } from './buildCancelledPromptNodePatch';
import { buildCompletedPromptNodePatch } from './buildCompletedPromptNodePatch';
import { buildGeneratingPromptNode } from './buildGeneratingPromptNode';
import { buildRetryExecutionNode } from './buildRetryExecutionNode';
import { optimizeGenerationPrompt, summarizePromptOptimizationError } from './optimizeGenerationPrompt';
import { prepareRetriedExecutionNode } from './prepareRetriedExecutionNode';
import { persistGeneratingPromptNode } from './persistGeneratingPromptNode';
import { resolveGenerationBillingState } from './resolveGenerationBillingState';
import { resolveGenerationPreviewState } from './resolveGenerationPreviewState';
import { getPromptPptImageNodes } from '../utils/pptEditable';
import { buildPptDeckModuleState } from '../utils/pptDeckModules';
import { normalizePptSlidesForCount } from '../utils/pptUtils';
import { calculateImageHash } from '../utils/imageUtils';
import { normalizePersistableMediaSource, saveOriginalImage } from '../services/storage/imageStorage';
import { clampGenerationDurationMs } from '../utils/timeUtils';

type CreditBillingAttempt = {
  attemptId: string;
  businessRefId: string;
  idempotencyKey: string;
};

export interface EnsureCreditAttemptChargedParams {
  modelId: string;
  modelLabel?: string;
  providerId?: string;
  provider?: string;
  requiredCredits: number;
  useServerSideCreditSettlement: boolean;
  billingAttempt?: CreditBillingAttempt;
}

export type EnsureCreditAttemptChargedResult =
  | { success: true; transactionId: string | undefined }
  | { success: false; transactionId?: undefined };

export interface PrepareInitialCreditSettlementParams extends EnsureCreditAttemptChargedParams {
  isCreditModel: boolean;
}

export type PrepareInitialCreditSettlementResult =
  | { allowed: true; paymentTransactionId: string | undefined }
  | { allowed: false; paymentTransactionId?: undefined };

export type GenerationCreditAttemptNode = Pick<
  PromptNode,
  | 'id'
  | 'billingMode'
  | 'creditSettlement'
  | 'isPaymentProcessed'
  | 'paymentTransactionId'
  | 'refundStatus'
  | 'cost'
>;

export type GenerationCreditAttemptFailurePatch = {
  refundStatus?: PromptNode['refundStatus'];
  isPaymentProcessed?: boolean;
  paymentTransactionId?: string;
};

export interface PrepareGenerationDraftContextArgs {
  activeCanvasRef: {
    current?: Pick<Canvas, 'promptNodes'> | null;
  };
  activeSourceImage?: string | null;
  draftNodeId?: string | null;
}

export interface PrepareGenerationDraftContextResult {
  isFollowUp: boolean;
  existingPromptDraftId: string;
  existingPromptDraft: PromptNode | null;
  hasReusablePromptDraft: boolean;
  promptNodeId: string;
}

interface InitialBillingGenerationState {
  executionLane: ModelExecutionLane;
  isCreditModel: boolean;
  useServerSideCreditSettlement: boolean;
}

export interface PrepareInitialBillingAttemptContextParams {
  generationBillingState: InitialBillingGenerationState;
  imageSize?: ImageSize | string | null;
  modelId: string;
  promptNodeId: string;
}

export interface PrepareInitialBillingAttemptContextResult {
  billingAttempt: CreditBillingAttempt;
  executionLane: ModelExecutionLane;
  resolvedCreditRoute: ReturnType<typeof adminModelService.getCreditRouteSnapshot> | null;
  resolvedCreditSpecId: string | undefined;
  useServerSideCreditSettlement: boolean;
}

export interface PrepareGenerationBillingStateContextParams {
  config: Pick<GenerationConfig, 'model' | 'imageSize' | 'mode' | 'parallelCount'>;
  getPreferredKeyForMode: (mode: GenerationConfig['mode']) => string | undefined;
  hasExplicitModelRoute: (modelId: string) => boolean;
  resolveCreditCostForModel: (modelId: string, imageSize?: ImageSize | string) => number;
}

export interface PrepareGenerationBillingStateContextResult {
  selectedKeyForBilling: ReturnType<typeof keyManager.getNextKey>;
  generationBillingState: ReturnType<typeof resolveGenerationBillingState>;
}

export interface PrepareInitialGenerationSubmissionContextParams extends PrepareGenerationDraftContextArgs {
  config: PrepareGenerationBillingStateContextParams['config'];
  getPreferredKeyForMode: PrepareGenerationBillingStateContextParams['getPreferredKeyForMode'];
  hasExplicitModelRoute: PrepareGenerationBillingStateContextParams['hasExplicitModelRoute'];
  resolveCreditCostForModel: PrepareGenerationBillingStateContextParams['resolveCreditCostForModel'];
}

export type PrepareInitialGenerationSubmissionContextResult =
  | { allowed: false }
  | {
    allowed: true;
    billingAttempt: CreditBillingAttempt;
    draftContext: PrepareGenerationDraftContextResult;
    executionLane: ModelExecutionLane;
    generationBillingState: ReturnType<typeof resolveGenerationBillingState>;
    hasReusablePromptDraft: boolean;
    isFollowUp: boolean;
    paymentTransactionId: string | undefined;
    perImageCreditCost: number;
    promptNodeId: string;
    requiredCredits: number;
    resolvedCreditRoute: ReturnType<typeof adminModelService.getCreditRouteSnapshot> | null;
    resolvedCreditSpecId: string | undefined;
    selectedKeyForBilling: ReturnType<typeof keyManager.getNextKey>;
    useServerSideCreditSettlement: boolean;
  };

type PreparedInitialGenerationSubmissionContext = Extract<PrepareInitialGenerationSubmissionContextResult, { allowed: true }>;

export interface PrepareInitialGeneratingPromptNodeParams {
  activeSourceImage?: string | null;
  billingAttempt: CreditBillingAttempt;
  config: GenerationConfig;
  currentPos: PromptNode['position'];
  executionLane: ModelExecutionLane;
  finalReferenceImages: ReferenceImage[];
  generationBillingState: Pick<ReturnType<typeof resolveGenerationBillingState>, 'isCreditModel'>;
  optimizedPromptEn?: string;
  optimizedPromptZh?: string;
  paymentTransactionId?: string;
  perImageCreditCost: number;
  promptNodeId: string;
  promptOptimizerResult?: PromptNode['promptOptimizerResult'];
  rawPrompt: string;
  requiredCredits: number;
  resolvedCreditRoute: ReturnType<typeof adminModelService.getCreditRouteSnapshot> | null;
  resolvedCreditSpecId?: string;
  selectedKeyForBilling: ReturnType<typeof keyManager.getNextKey>;
  useServerSideCreditSettlement: boolean;
}

export interface PrepareInitialGeneratingPromptNodeResult {
  generatingNode: PromptNode;
}

type GenerationPersistenceCanvasSnapshot = Pick<Canvas, 'promptNodes'> & {
  imageNodes: GeneratedImage[];
};

export interface PersistInitialGeneratingPromptNodeParams {
  addPromptNode: (node: PromptNode) => void | Promise<void>;
  deletePromptNode: (id: string) => void | Promise<void>;
  generatingNode: PromptNode;
  getCanvas: () => GenerationPersistenceCanvasSnapshot | undefined;
  updateImageNodePosition: (
    id: string,
    position: { x: number; y: number },
    options?: { ignoreSelection?: boolean },
  ) => void | Promise<void>;
}

export interface PersistInitialGeneratingPromptNodeResult {
  persistedGeneratingNode: PromptNode;
}

export interface PrepareInitialGenerationPromptOptimizationParams {
  config: Pick<
    GenerationConfig,
    'aspectRatio' | 'enablePromptOptimization' | 'imageSize' | 'mode' | 'model' | 'thinkingMode'
  >;
  finalReferenceImages: ReferenceImage[];
  rawPrompt: string;
}

export type PrepareInitialGenerationPromptOptimizationResult = Awaited<ReturnType<typeof optimizeGenerationPrompt>>;

export interface PrepareInitialGeneratingPromptNodeContextParams extends Omit<
  PrepareInitialGeneratingPromptNodeParams,
  'finalReferenceImages' | 'optimizedPromptEn' | 'optimizedPromptZh' | 'promptOptimizerResult'
> {
  prepareGenerationReferenceImages: (referenceImages: ReferenceImage[]) => ReferenceImage[];
}

export interface PrepareInitialGeneratingPromptNodeContextResult extends PrepareInitialGeneratingPromptNodeResult {
}

export interface CompleteInitialGenerationPromptSubmissionParams {
  setActiveSourceImage: (id: string | null) => void;
  setConfig: (updater: (prev: GenerationConfig) => GenerationConfig) => void;
  setDraftNodeId: (id: string | null) => void;
}

export interface CompleteAndExecuteInitialGenerationSubmissionParams
  extends CompleteInitialGenerationPromptSubmissionParams,
  ExecuteInitialGenerationPromptNodeParams {
}

export interface PersistAndExecuteInitialGenerationSubmissionParams
  extends PersistInitialGeneratingPromptNodeParams,
  CompleteInitialGenerationPromptSubmissionParams,
  Pick<ExecuteInitialGenerationPromptNodeParams, 'executeGeneration' | 'requiredCredits' | 'useServerSideCreditSettlement'> {
}

export interface PersistAndExecuteInitialGenerationSubmissionResult extends PersistInitialGeneratingPromptNodeResult {
}

export interface RunInitialGenerationSubmissionTransactionParams {
  activeSourceImage?: string | null;
  addPromptNode: PersistInitialGeneratingPromptNodeParams['addPromptNode'];
  config: GenerationConfig;
  deletePromptNode: PersistInitialGeneratingPromptNodeParams['deletePromptNode'];
  executeGeneration: ExecuteInitialGenerationPromptNodeParams['executeGeneration'];
  getCanvas: PersistInitialGeneratingPromptNodeParams['getCanvas'];
  initialSubmissionContext: PreparedInitialGenerationSubmissionContext;
  prepareGenerationReferenceImages: PrepareInitialGeneratingPromptNodeContextParams['prepareGenerationReferenceImages'];
  rawPrompt: string;
  resolveGenerationPlacement: (params: {
    isFollowUp: boolean;
    promptNodeId: string;
    hasReusablePromptDraft: boolean;
  }) => { currentPos: PromptNode['position']; promptNodeId: string };
  setActiveSourceImage: CompleteInitialGenerationPromptSubmissionParams['setActiveSourceImage'];
  setConfig: CompleteInitialGenerationPromptSubmissionParams['setConfig'];
  setDraftNodeId: CompleteInitialGenerationPromptSubmissionParams['setDraftNodeId'];
  updateImageNodePosition: PersistInitialGeneratingPromptNodeParams['updateImageNodePosition'];
}

export interface CommitRetryGenerationFailureParams {
  error: unknown;
  executionNode: PromptNode;
  extractErrorDetails: (error: unknown, fallbackModel?: string) => PromptNode['errorDetails'];
}

export interface ExecuteInitialGenerationPromptNodeParams {
  executeGeneration: (node: PromptNode) => Promise<void>;
  persistedGeneratingNode: PromptNode;
  requiredCredits: number;
  useServerSideCreditSettlement: boolean;
}

export interface ReportInitialGenerationFailureParams {
  error: unknown;
}

export interface CreateRetryGenerationTimeoutGuardParams {
  executionNode: PromptNode;
  requestId: string;
  timeoutMs: number;
}

export interface CreateRetryGenerationTimeoutGuardResult {
  markFinished: () => void;
  clear: () => void;
}

export interface FinalizeRetryGeneratedMediaAttemptGuardParams {
  timeoutGuard: CreateRetryGenerationTimeoutGuardResult;
}

export interface RunRetryGeneratedMediaAttemptWithGuardParams<T> {
  timeoutGuard: CreateRetryGenerationTimeoutGuardResult;
  run: () => Promise<T>;
}

export interface PrepareRetryGeneratedMediaAttemptContextParams {
  currentNodeId: string;
  executionNode: PromptNode;
  index: number;
  timeoutMs: number;
}

export interface PrepareRetryGeneratedMediaAttemptContextResult {
  requestId: string;
  timeoutGuard: CreateRetryGenerationTimeoutGuardResult;
}

export interface CommitRetryGenerationStartParams {
  executionNode: PromptNode;
  retryBillingState: Pick<ReturnType<typeof resolveGenerationBillingState>, 'requiredCredits' | 'useServerSideCreditSettlement'>;
  resolveModelDisplayName: (modelId: string, fallbackLabel?: string) => string;
}

export interface ReportRetryRecoveryResultParams {
  recoveredCount: number;
  pendingCount: number;
}

export interface RecoverRetryGenerationBridgeParams {
  executionNode: PromptNode;
  recoverFailedSyncBridgeGeneration: (
    node: PromptNode,
  ) => Promise<{ checkedCount?: number; recoveredCount: number; pendingCount: number }>;
}

export interface RecoverRetryGenerationBridgeResult {
  checkedCount?: number;
  recoveredCount: number;
  pendingCount: number;
  shouldShortCircuit: boolean;
}

export interface PrepareRetryGenerationRequestContextParams {
  node: Pick<PromptNode, 'id' | 'mode' | 'parallelCount'>;
  defaultParallelCount: number;
}

export interface PrepareRetryGenerationRequestContextResult {
  currentNodeId: string;
  requestedCount: number;
  count: number;
}

export interface PrepareRetryGeneratedMediaExecutionContextParams {
  defaultParallelCount: number;
  node: PromptNode;
  recoverFailedSyncBridgeGeneration: RecoverRetryGenerationBridgeParams['recoverFailedSyncBridgeGeneration'];
  resolveNodeRouteState: Parameters<typeof buildRetryExecutionNode>[0]['resolveNodeRouteState'];
  resolveCreditCostForModel: (modelId: string, imageSize?: ImageSize | string) => number;
}

export type PrepareRetryGeneratedMediaExecutionContextResult =
  | {
    prepared: false;
  }
  | (PrepareRetryGenerationRequestContextResult & {
    prepared: true;
    executionNode: PromptNode;
    retryBillingState: ReturnType<typeof resolveGenerationBillingState>;
  });

export interface RetryGenerationSuccessDebugResult {
  requestPath?: string;
  requestBodyPreview?: string;
  pythonSnippet?: string;
}

export interface ReportRetryGenerationSuccessParams {
  executionNode: Pick<PromptNode, 'model' | 'prompt' | 'referenceImages' | 'imageSize' | 'keySlotId'>;
  alignedImageNodes: Array<Pick<GeneratedImage, 'imageSize' | 'keySlotId'>>;
  results: RetryGenerationSuccessDebugResult[];
}

export interface CommitRetryGeneratedMediaSuccessParams {
  addImageNodes: (
    nodes: RetryGeneratedMediaLayoutNode[],
    parentUpdates?: Record<string, Partial<PromptNode>>,
  ) => void | Promise<void>;
  alignedImageNodes: RetryGeneratedMediaLayoutNode[];
  executionNode: ReportRetryGenerationSuccessParams['executionNode'];
  parentNodeId: string;
  results: RetryGenerationSuccessDebugResult[];
  retryCompletedPromptPatch: Partial<PromptNode>;
}

export interface PrepareRetryGenerationTaskPromptContextParams {
  count: number;
  executionNode: Pick<PromptNode, 'mode' | 'pptSlides' | 'pptStyleLocked' | 'prompt'>;
  index: number;
  sourcePrompt: string;
}

export interface PrepareRetryGenerationTaskPromptContextResult {
  currentMode: GenerationMode;
  taskPrompt: string;
}

export interface PrepareRetryVideoGenerationRequestParams {
  executionNode: Pick<
    PromptNode,
    'aspectRatio' | 'imageSize' | 'keySlotId' | 'model' | 'referenceImages' | 'videoDuration' | 'videoResolution'
  >;
  taskPrompt: string;
}

export interface PrepareRetryVideoGenerationRequestResult {
  modelId: string;
  prompt: string;
  aspectRatio: string;
  imageUrl?: string;
  imageTailUrl?: string;
  videoDuration?: string;
  preferredKeyId?: string;
  providerConfig: {
    google: {
      imageConfig: {
        imageSize: string;
      };
    };
  };
}

export interface RetryGeneratedMediaResultMetadata {
  completionTokens?: number;
  cost?: number;
  costSource?: GeneratedImage['costSource'];
  keySlotId?: string;
  model: GeneratedImage['model'];
  modelLabel?: string;
  promptTokens?: number;
  provider?: string;
  providerLabel?: string;
  tokens?: number;
}

export interface BuildRetryVideoGenerationResultContextParams {
  executionNode: Pick<PromptNode, 'keySlotId' | 'model' | 'modelLabel' | 'provider' | 'providerLabel'>;
  videoResult: VideoGenerationResult;
}

export interface RetryGeneratedMediaResultContext {
  apiDurationMs?: number;
  b64: string;
  balanceAfter?: number;
  requestTrace: RetryGenerationSuccessDebugResult;
  resultMetadata: RetryGeneratedMediaResultMetadata;
}

export interface ApplyRetryGeneratedMediaAuthoritativeBalanceParams {
  generatedMediaContext: Pick<RetryGeneratedMediaResultContext, 'balanceAfter'>;
  applyAuthoritativeBalance: (balance: number) => void;
}

export type BuildRetryVideoGenerationResultContextResult = RetryGeneratedMediaResultContext;

export interface ResolveRetryGeneratedMediaGenerationTimeParams {
  apiDurationMs?: number;
  startedAtMs: number;
}

export interface PrepareRetryImageGenerationRequestParams {
  executionNode: Pick<
    PromptNode,
    'aspectRatio' | 'enableGrounding' | 'enableImageSearch' | 'imageSize' | 'keySlotId' | 'model' | 'referenceImages' | 'thinkingMode'
  >;
  requestId: string;
  taskPrompt: string;
}

export interface PrepareRetryImageGenerationRequestResult {
  args: [
    string,
    PromptNode['aspectRatio'],
    PromptNode['imageSize'],
    ReferenceImage[],
    PromptNode['model'],
    string,
    string,
  ];
  grounding: boolean;
  options: {
    preferredKeyId?: string;
    enableWebSearch: boolean;
    enableImageSearch: boolean;
    thinkingMode: 'minimal' | 'high';
  };
}

export interface BuildRetryImageGenerationResultContextParams {
  executionNode: Pick<PromptNode, 'keySlotId' | 'model' | 'modelLabel' | 'provider' | 'providerLabel'>;
  result: GenerateImageResult;
  resolveModelDisplayName: (modelId: string, fallbackLabel?: string) => string;
}

export type BuildRetryImageGenerationResultContextResult = RetryGeneratedMediaResultContext;

export type RetryGeneratedMediaGenerateImage = (...args: [
  ...PrepareRetryImageGenerationRequestResult['args'],
  PrepareRetryImageGenerationRequestResult['grounding'],
  PrepareRetryImageGenerationRequestResult['options'],
]) => Promise<GenerateImageResult>;

export type RetryGeneratedMediaGenerateVideo = (request: PrepareRetryVideoGenerationRequestResult) => Promise<VideoGenerationResult>;

export interface ExecuteRetryGeneratedMediaRequestParams {
  currentMode: GenerationMode;
  executionNode: PrepareRetryVideoGenerationRequestParams['executionNode']
    & BuildRetryVideoGenerationResultContextParams['executionNode']
    & PrepareRetryImageGenerationRequestParams['executionNode']
    & BuildRetryImageGenerationResultContextParams['executionNode'];
  generateImage: RetryGeneratedMediaGenerateImage;
  generateVideo: RetryGeneratedMediaGenerateVideo;
  requestId: string;
  resolveModelDisplayName: BuildRetryImageGenerationResultContextParams['resolveModelDisplayName'];
  taskPrompt: string;
}

export interface ExecuteRetryGeneratedMediaRequestResult {
  currentMode: GenerationMode;
  generatedMediaContext: RetryGeneratedMediaResultContext;
  taskPrompt: string;
}

export interface ExecuteRetryGeneratedMediaAttemptRequestParams {
  applyAuthoritativeBalance: ApplyRetryGeneratedMediaAuthoritativeBalanceParams['applyAuthoritativeBalance'];
  count: number;
  currentNodeId: string;
  executionNode: PrepareRetryGeneratedMediaAttemptContextParams['executionNode']
    & PrepareRetryGenerationTaskPromptContextParams['executionNode']
    & ExecuteRetryGeneratedMediaRequestParams['executionNode'];
  generateImage: ExecuteRetryGeneratedMediaRequestParams['generateImage'];
  generateVideo: ExecuteRetryGeneratedMediaRequestParams['generateVideo'];
  index: number;
  resolveModelDisplayName: ExecuteRetryGeneratedMediaRequestParams['resolveModelDisplayName'];
  sourcePrompt: string;
  timeoutMs: number;
}

export interface PrepareRetryGeneratedMediaPersistenceParams {
  b64: string;
  calculateImageHash: (source: string) => Promise<string>;
  currentMode: GenerationMode;
  normalizePersistableMediaSource: (source: string, mimeType: string) => string | undefined;
  saveOriginalImage: (storageId: string, originalSource: string) => Promise<unknown>;
}

export interface PrepareRetryGeneratedMediaPersistenceResult {
  apiResultUrl?: string;
  mimeType: 'image/png' | 'video/mp4';
  normalizedOriginalSource?: string;
  originalUrl: string;
  storageId: string;
  url: string;
}

export interface ScheduleRetryGeneratedMediaCloudSyncParams {
  b64: string;
  currentMode: GenerationMode;
  index: number;
}

export interface ResolveRetryGeneratedMediaDimensionsParams {
  b64: string;
  executionNode: Pick<PromptNode, 'aspectRatio' | 'imageSize'>;
  url: string;
}

export interface ResolveRetryGeneratedMediaDimensionsResult {
  actualHeight: number;
  actualWidth: number;
  computedImageSize: PromptNode['imageSize'];
  displayDimensions: string;
}

export interface BuildRetryGeneratedMediaResultParams {
  alias?: string;
  canvasId?: string;
  currentMode: GenerationMode;
  executionNode: Pick<
    PromptNode,
    'aspectRatio' | 'billingMode' | 'creditCost' | 'id' | 'referenceImages'
  >;
  generationTime: number;
  index: number;
  mediaDimensions: ResolveRetryGeneratedMediaDimensionsResult;
  mediaPersistence: PrepareRetryGeneratedMediaPersistenceResult;
  prompt: string;
  requestTrace: RetryGenerationSuccessDebugResult;
  resultMetadata: RetryGeneratedMediaResultMetadata;
}

export interface BuildRetryGeneratedMediaResultFromContextParams extends Omit<
  BuildRetryGeneratedMediaResultParams,
  'alias' | 'executionNode' | 'requestTrace' | 'resultMetadata'
> {
  buildPptPageAlias: (raw: string | undefined, pageIndex: number) => string;
  executionNode: BuildRetryGeneratedMediaResultParams['executionNode'] & Pick<PromptNode, 'pptSlides'>;
  generatedMediaContext: RetryGeneratedMediaResultContext;
}

export type RetryGeneratedMediaResult = Omit<GeneratedImage, 'position'> & {
  height: number;
  index: number;
  seed: number;
  width: number;
};

export interface AssembleRetryGeneratedMediaAttemptResultParams {
  buildPptPageAlias: BuildRetryGeneratedMediaResultFromContextParams['buildPptPageAlias'];
  calculateImageHash: PrepareRetryGeneratedMediaPersistenceParams['calculateImageHash'];
  canvasId?: string;
  currentMode: GenerationMode;
  executionNode: BuildRetryGeneratedMediaResultFromContextParams['executionNode']
    & ResolveRetryGeneratedMediaDimensionsParams['executionNode'];
  generatedMediaContext: RetryGeneratedMediaResultContext;
  index: number;
  normalizePersistableMediaSource: PrepareRetryGeneratedMediaPersistenceParams['normalizePersistableMediaSource'];
  prompt: string;
  saveOriginalImage: PrepareRetryGeneratedMediaPersistenceParams['saveOriginalImage'];
  startedAtMs: number;
}

export interface RunRetryGeneratedMediaAttemptsParams {
  applyAuthoritativeBalance: ApplyRetryGeneratedMediaAuthoritativeBalanceParams['applyAuthoritativeBalance'];
  buildPptPageAlias: BuildRetryGeneratedMediaResultFromContextParams['buildPptPageAlias'];
  calculateImageHash: PrepareRetryGeneratedMediaPersistenceParams['calculateImageHash'];
  canvasId?: string;
  count: number;
  currentNodeId: string;
  executionNode: PromptNode;
  generateImage: RetryGeneratedMediaGenerateImage;
  generateVideo: RetryGeneratedMediaGenerateVideo;
  normalizePersistableMediaSource: PrepareRetryGeneratedMediaPersistenceParams['normalizePersistableMediaSource'];
  resolveModelDisplayName: BuildRetryImageGenerationResultContextParams['resolveModelDisplayName'];
  saveOriginalImage: PrepareRetryGeneratedMediaPersistenceParams['saveOriginalImage'];
  sourcePrompt: string;
  startedAtMs: number;
  timeoutMs: number;
}

export interface ResolveRetryGeneratedMediaLayoutPromptParams {
  canvasSnapshot?: Pick<Canvas, 'promptNodes'> | null;
  executionNode: Pick<PromptNode, 'id' | 'position'>;
}

export type ResolveRetryGeneratedMediaLayoutPromptResult = Pick<PromptNode, 'position'>;

interface RetryGeneratedMediaLayoutCardDimensions {
  width: number;
  totalHeight: number;
}

interface RetryGeneratedMediaLayoutPosition {
  x: number;
  y: number;
}

export type RetryGeneratedMediaLayoutNode = RetryGeneratedMediaResult & Pick<GeneratedImage, 'position'>;

export interface BuildRetryGeneratedMediaLayoutParams {
  buildGeneratedImageBatchPositions: (params: {
    basePosition: RetryGeneratedMediaLayoutPosition;
    items: Array<{
      aspectRatio?: GeneratedImage['aspectRatio'];
      exactDimensions?: { width: number; height: number };
    }>;
    mode?: GenerationMode;
    isMobile?: boolean;
  }) => RetryGeneratedMediaLayoutPosition[];
  count: number;
  executionNode: Pick<PromptNode, 'aspectRatio' | 'mode' | 'position'>;
  getCardDimensions: (aspectRatio: PromptNode['aspectRatio'], includeFooter?: boolean) => RetryGeneratedMediaLayoutCardDimensions;
  isMobile: boolean;
  latestLayoutPrompt?: Pick<PromptNode, 'position'> | null;
  results: RetryGeneratedMediaResult[];
}

export interface BuildRetryCompletedPromptPatchParams {
  alignedImageNodes: Array<Pick<GeneratedImage, 'id' | 'keySlotId' | 'model' | 'modelLabel' | 'provider' | 'providerLabel'>>;
  executionNode: Pick<PromptNode, 'keySlotId' | 'model' | 'modelLabel' | 'provider' | 'providerLabel'>;
  resolveModelDisplayName: (modelId: string, fallbackLabel?: string) => string;
}

export interface PrepareRetryGeneratedMediaSuccessCommitContextParams extends Omit<
  BuildRetryGeneratedMediaLayoutParams,
  'executionNode' | 'latestLayoutPrompt'
> {
  canvasSnapshot?: Pick<Canvas, 'promptNodes'> | null;
  executionNode: BuildRetryGeneratedMediaLayoutParams['executionNode']
    & BuildRetryCompletedPromptPatchParams['executionNode']
    & ResolveRetryGeneratedMediaLayoutPromptParams['executionNode'];
  resolveModelDisplayName: BuildRetryCompletedPromptPatchParams['resolveModelDisplayName'];
}

export interface PrepareRetryGeneratedMediaSuccessCommitContextResult {
  alignedImageNodes: RetryGeneratedMediaLayoutNode[];
  retryCompletedPromptPatch: Partial<PromptNode>;
}

export interface CommitRetryGeneratedMediaBatchSuccessParams extends Omit<
  PrepareRetryGeneratedMediaSuccessCommitContextParams,
  'executionNode' | 'results'
> {
  addImageNodes: CommitRetryGeneratedMediaSuccessParams['addImageNodes'];
  executionNode: PrepareRetryGeneratedMediaSuccessCommitContextParams['executionNode']
    & CommitRetryGeneratedMediaSuccessParams['executionNode'];
  parentNodeId: CommitRetryGeneratedMediaSuccessParams['parentNodeId'];
  results: RetryGeneratedMediaResult[];
}

export interface CompleteRetryGeneratedMediaBatchParams extends Omit<
  RunRetryGeneratedMediaAttemptsParams,
  'startedAtMs'
> {
  addImageNodes: CommitRetryGeneratedMediaBatchSuccessParams['addImageNodes'];
  buildGeneratedImageBatchPositions: CommitRetryGeneratedMediaBatchSuccessParams['buildGeneratedImageBatchPositions'];
  canvasSnapshot?: CommitRetryGeneratedMediaBatchSuccessParams['canvasSnapshot'];
  extractErrorDetails: CommitRetryGenerationFailureParams['extractErrorDetails'];
  getCardDimensions: CommitRetryGeneratedMediaBatchSuccessParams['getCardDimensions'];
  isMobile: CommitRetryGeneratedMediaBatchSuccessParams['isMobile'];
  parentNodeId: CommitRetryGeneratedMediaBatchSuccessParams['parentNodeId'];
  retryBillingState: CommitRetryGenerationStartParams['retryBillingState'];
}

interface RefreshBillingOptions {
  includeTransactions?: boolean;
  silent?: boolean;
}

const createGenerationPromptNodeId = () => `node_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

const resolveFiniteNumber = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

export interface UseGenerationRuntimeDeps {
  activeCanvas?: Pick<Canvas, 'promptNodes' | 'imageNodes'> | null;
  updatePromptNode: (node: PromptNode) => void | Promise<void>;
  updateImageNode: (id: string, updates: Partial<GeneratedImage>) => void | Promise<void>;
  cancelGenerationRequest: (requestId: string) => void;
  cancelSystemProxyTask: (jobId: string) => Promise<unknown>;
  authLoading: boolean;
  user: unknown;
  isTempUser: boolean;
  billingLoading: boolean;
  balance: number;
  setShowRechargeModal: (show: boolean) => void;
  consumeCreditsDetailed: (
    modelId: string,
    count: number,
    details?: Record<string, unknown>,
  ) => Promise<CreditConsumeResult>;
  refundCreditsByTransaction: (transactionId: string, reason: string) => Promise<CreditRefundResult>;
  refreshBilling: (options?: RefreshBillingOptions) => Promise<void>;
  adjustBalanceOptimistically: (delta: number) => void;
  applyAuthoritativeBalance: (balance: number) => void;
  rememberPreferredKeyForMode: (mode: GenerationMode | undefined, keySlotId?: string) => void;
  buildPptPageAlias: (raw: string | undefined, pageIndex: number) => string;
  resolveModelDisplayName: (modelId: string, fallbackLabel?: string) => string;
  resolveNodeRouteState: Parameters<typeof buildRetryExecutionNode>[0]['resolveNodeRouteState'];
  resolveCreditCostForModel: (modelId: string, imageSize?: ImageSize | string) => number;
  resolveProviderDisplay: (keySlotId?: string, fallbackProviderLabel?: string, fallbackProvider?: string) => {
    provider?: string;
    providerLabel?: string;
  };
  generateImage: RetryGeneratedMediaGenerateImage;
}

export interface UseGenerationRuntimeResult {
  handleCancelGeneration: (id?: string) => Promise<void>;
  handleRetryPptSinglePage: (node: PromptNode, pageIndex: number) => Promise<void>;
  ensureCreditAttemptCharged: (params: EnsureCreditAttemptChargedParams) => Promise<EnsureCreditAttemptChargedResult>;
  prepareInitialCreditSettlement: (params: PrepareInitialCreditSettlementParams) => Promise<PrepareInitialCreditSettlementResult>;
  prepareGenerationDraftContext: (args: PrepareGenerationDraftContextArgs) => PrepareGenerationDraftContextResult;
  prepareInitialBillingAttemptContext: (params: PrepareInitialBillingAttemptContextParams) => PrepareInitialBillingAttemptContextResult;
  prepareGenerationBillingStateContext: (params: PrepareGenerationBillingStateContextParams) => PrepareGenerationBillingStateContextResult;
  prepareInitialGenerationSubmissionContext: (params: PrepareInitialGenerationSubmissionContextParams) => Promise<PrepareInitialGenerationSubmissionContextResult>;
  prepareInitialGeneratingPromptNode: (params: PrepareInitialGeneratingPromptNodeParams) => PrepareInitialGeneratingPromptNodeResult;
  persistInitialGeneratingPromptNode: (params: PersistInitialGeneratingPromptNodeParams) => Promise<PersistInitialGeneratingPromptNodeResult>;
  prepareInitialGenerationPromptOptimization: (params: PrepareInitialGenerationPromptOptimizationParams) => Promise<PrepareInitialGenerationPromptOptimizationResult>;
  prepareInitialGeneratingPromptNodeContext: (params: PrepareInitialGeneratingPromptNodeContextParams) => Promise<PrepareInitialGeneratingPromptNodeContextResult>;
  completeInitialGenerationPromptSubmission: (params: CompleteInitialGenerationPromptSubmissionParams) => void;
  completeAndExecuteInitialGenerationSubmission: (params: CompleteAndExecuteInitialGenerationSubmissionParams) => Promise<void>;
  persistAndExecuteInitialGenerationSubmission: (params: PersistAndExecuteInitialGenerationSubmissionParams) => Promise<PersistAndExecuteInitialGenerationSubmissionResult>;
  runInitialGenerationSubmissionTransaction: (params: RunInitialGenerationSubmissionTransactionParams) => Promise<void>;
  commitRetryGenerationFailure: (params: CommitRetryGenerationFailureParams) => Promise<void>;
  executeInitialGenerationPromptNode: (params: ExecuteInitialGenerationPromptNodeParams) => Promise<void>;
  reportInitialGenerationFailure: (params: ReportInitialGenerationFailureParams) => void;
  createRetryGenerationTimeoutGuard: (params: CreateRetryGenerationTimeoutGuardParams) => CreateRetryGenerationTimeoutGuardResult;
  finalizeRetryGeneratedMediaAttemptGuard: (params: FinalizeRetryGeneratedMediaAttemptGuardParams) => void;
  runRetryGeneratedMediaAttemptWithGuard: <T>(params: RunRetryGeneratedMediaAttemptWithGuardParams<T>) => Promise<T>;
  prepareRetryGeneratedMediaAttemptContext: (params: PrepareRetryGeneratedMediaAttemptContextParams) => PrepareRetryGeneratedMediaAttemptContextResult;
  reportRetryRecoveryResult: (params: ReportRetryRecoveryResultParams) => void;
  recoverRetryGenerationBridge: (params: RecoverRetryGenerationBridgeParams) => Promise<RecoverRetryGenerationBridgeResult>;
  prepareRetryGenerationRequestContext: (params: PrepareRetryGenerationRequestContextParams) => PrepareRetryGenerationRequestContextResult;
  prepareRetryGeneratedMediaExecutionContext: (params: PrepareRetryGeneratedMediaExecutionContextParams) => Promise<PrepareRetryGeneratedMediaExecutionContextResult>;
  reportRetryGenerationSuccess: (params: ReportRetryGenerationSuccessParams) => void;
  commitRetryGeneratedMediaSuccess: (params: CommitRetryGeneratedMediaSuccessParams) => Promise<void>;
  prepareRetryGenerationTaskPromptContext: (params: PrepareRetryGenerationTaskPromptContextParams) => PrepareRetryGenerationTaskPromptContextResult;
  prepareRetryVideoGenerationRequest: (params: PrepareRetryVideoGenerationRequestParams) => PrepareRetryVideoGenerationRequestResult;
  buildRetryVideoGenerationResultContext: (params: BuildRetryVideoGenerationResultContextParams) => BuildRetryVideoGenerationResultContextResult;
  resolveRetryGeneratedMediaGenerationTime: (params: ResolveRetryGeneratedMediaGenerationTimeParams) => number;
  prepareRetryImageGenerationRequest: (params: PrepareRetryImageGenerationRequestParams) => PrepareRetryImageGenerationRequestResult;
  buildRetryImageGenerationResultContext: (params: BuildRetryImageGenerationResultContextParams) => BuildRetryImageGenerationResultContextResult;
  executeRetryGeneratedMediaRequest: (params: ExecuteRetryGeneratedMediaRequestParams) => Promise<ExecuteRetryGeneratedMediaRequestResult>;
  applyRetryGeneratedMediaAuthoritativeBalance: (params: ApplyRetryGeneratedMediaAuthoritativeBalanceParams) => void;
  executeRetryGeneratedMediaAttemptRequest: (params: ExecuteRetryGeneratedMediaAttemptRequestParams) => Promise<ExecuteRetryGeneratedMediaRequestResult>;
  prepareRetryGeneratedMediaPersistence: (params: PrepareRetryGeneratedMediaPersistenceParams) => Promise<PrepareRetryGeneratedMediaPersistenceResult>;
  scheduleRetryGeneratedMediaCloudSync: (params: ScheduleRetryGeneratedMediaCloudSyncParams) => void;
  resolveRetryGeneratedMediaDimensions: (params: ResolveRetryGeneratedMediaDimensionsParams) => Promise<ResolveRetryGeneratedMediaDimensionsResult>;
  buildRetryGeneratedMediaResult: (params: BuildRetryGeneratedMediaResultParams) => RetryGeneratedMediaResult;
  buildRetryGeneratedMediaResultFromContext: (params: BuildRetryGeneratedMediaResultFromContextParams) => RetryGeneratedMediaResult;
  assembleRetryGeneratedMediaAttemptResult: (params: AssembleRetryGeneratedMediaAttemptResultParams) => Promise<RetryGeneratedMediaResult>;
  runRetryGeneratedMediaAttempts: (params: RunRetryGeneratedMediaAttemptsParams) => Promise<RetryGeneratedMediaResult[]>;
  resolveRetryGeneratedMediaLayoutPrompt: (params: ResolveRetryGeneratedMediaLayoutPromptParams) => ResolveRetryGeneratedMediaLayoutPromptResult;
  buildRetryGeneratedMediaLayout: (params: BuildRetryGeneratedMediaLayoutParams) => RetryGeneratedMediaLayoutNode[];
  buildRetryCompletedPromptPatch: (params: BuildRetryCompletedPromptPatchParams) => Partial<PromptNode>;
  prepareRetryGeneratedMediaSuccessCommitContext: (params: PrepareRetryGeneratedMediaSuccessCommitContextParams) => PrepareRetryGeneratedMediaSuccessCommitContextResult;
  commitRetryGeneratedMediaBatchSuccess: (params: CommitRetryGeneratedMediaBatchSuccessParams) => Promise<void>;
  completeRetryGeneratedMediaBatch: (params: CompleteRetryGeneratedMediaBatchParams) => Promise<void>;
  resolveFailedCreditAttempt: (node: GenerationCreditAttemptNode) => Promise<GenerationCreditAttemptFailurePatch>;
  applyOptimisticServerCreditDebit: (requiredCredits: number, useServerSideCreditSettlement: boolean) => void;
}

export function useGenerationRuntime({
  activeCanvas,
  updatePromptNode,
  updateImageNode,
  cancelGenerationRequest,
  cancelSystemProxyTask,
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
  resolveModelDisplayName,
  resolveNodeRouteState,
  resolveCreditCostForModel,
  resolveProviderDisplay,
  generateImage,
}: UseGenerationRuntimeDeps): UseGenerationRuntimeResult {
  const ensureCreditAttemptCharged = useCallback(async (params: EnsureCreditAttemptChargedParams) => {
    if (params.requiredCredits <= 0) {
      return { success: true as const, transactionId: undefined };
    }

    if (authLoading) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.info('账户状态确认中', '正在校验登录状态，请稍后再试。');
      });
      return { success: false as const };
    }

    if (!user || isTempUser) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.error('请先登录', '积分模型需要登录正式账号后使用。');
      });
      return { success: false as const };
    }

    if (billingLoading) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.info('余额同步中', '正在刷新账户余额，请稍后重试。');
      });
      return { success: false as const };
    }

    if (balance < params.requiredCredits) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.error('生成失败', '您的账户余额不足，请先充值积分。');
      });
      setShowRechargeModal(true);
      return { success: false as const };
    }

    if (params.useServerSideCreditSettlement) {
      return { success: true as const, transactionId: undefined };
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
      import('../services/system/notificationService').then(({ notify }) => {
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
  }, [authLoading, balance, billingLoading, consumeCreditsDetailed, isTempUser, setShowRechargeModal, user]);

  const prepareInitialCreditSettlement = useCallback(async (params: PrepareInitialCreditSettlementParams) => {
    if (!params.isCreditModel) {
      return { allowed: true as const, paymentTransactionId: undefined };
    }

    if (authLoading) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.info('账号状态确认中', '正在校验登录状态，请稍后再试。');
      });
      return { allowed: false as const };
    }

    if (!user || isTempUser) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.error('请先登录', '管理员配置的积分模型需要登录账号后使用积分调用。');
      });
      return { allowed: false as const };
    }

    if (params.requiredCredits > 0 && billingLoading) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.info('余额同步中', '正在刷新账户余额，请稍后重试。');
      });
      return { allowed: false as const };
    }

    if (params.requiredCredits > 0 && balance < params.requiredCredits) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.error('生成失败', '您的账户余额不足，请先充值积分。');
      });
      setShowRechargeModal(true);
      return { allowed: false as const };
    }

    if (params.requiredCredits > 0 && !params.useServerSideCreditSettlement) {
      const chargeAttempt = await ensureCreditAttemptCharged({
        modelId: params.modelId,
        modelLabel: params.modelLabel,
        providerId: params.providerId,
        provider: params.provider,
        requiredCredits: params.requiredCredits,
        useServerSideCreditSettlement: params.useServerSideCreditSettlement,
        billingAttempt: params.billingAttempt,
      });

      if (!chargeAttempt.success) {
        return { allowed: false as const };
      }

      return {
        allowed: true as const,
        paymentTransactionId: chargeAttempt.transactionId,
      };
    }

    return { allowed: true as const, paymentTransactionId: undefined };
  }, [
    authLoading,
    balance,
    billingLoading,
    ensureCreditAttemptCharged,
    isTempUser,
    setShowRechargeModal,
    user,
  ]);

  const resolveFailedCreditAttempt = useCallback(async (node: GenerationCreditAttemptNode) => {
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

  const commitRetryGenerationFailure = useCallback(async (params: CommitRetryGenerationFailureParams) => {
    const failedBillingState = await resolveFailedCreditAttempt(params.executionNode);
    const rawMessage = (params.error as { message?: unknown } | null | undefined)?.message;
    const errorMessage = typeof rawMessage === 'string' && rawMessage ? rawMessage : 'Retry failed';
    const notifyMessage = errorMessage;

    await updatePromptNode({
      ...params.executionNode,
      isGenerating: false,
      isDraft: false,
      error: errorMessage,
      errorDetails: params.extractErrorDetails(params.error, params.executionNode.model),
      ...failedBillingState
    });
    import('../services/system/notificationService').then(({ notify }) => {
      notify.error('重试失败', notifyMessage);
    });
  }, [resolveFailedCreditAttempt, updatePromptNode]);

  const applyOptimisticServerCreditDebit = useCallback((requiredCredits: number, useServerSideCreditSettlement: boolean) => {
    if (useServerSideCreditSettlement && requiredCredits > 0) {
      adjustBalanceOptimistically(-requiredCredits);
    }
  }, [adjustBalanceOptimistically]);

  const executeInitialGenerationPromptNode = useCallback(async (params: ExecuteInitialGenerationPromptNodeParams) => {
    applyOptimisticServerCreditDebit(params.requiredCredits, params.useServerSideCreditSettlement);
    await params.executeGeneration(params.persistedGeneratingNode);
  }, [applyOptimisticServerCreditDebit]);

  const reportInitialGenerationFailure = useCallback((params: ReportInitialGenerationFailureParams) => {
    console.error('[handleGenerate] failed:', params.error);
    const message = String((params.error as { message?: unknown } | null | undefined)?.message || '请重试');
    import('../services/system/notificationService').then(({ notify }) => {
      notify.error('发送失败', message);
    });
  }, []);

  const createRetryGenerationTimeoutGuard = useCallback((params: CreateRetryGenerationTimeoutGuardParams) => {
    let isFinished = false;
    const timer = setTimeout(() => {
      if (!isFinished) {
        cancelGenerationRequest(params.requestId);
        void updatePromptNode({
          ...params.executionNode,
          isGenerating: false,
          isDraft: false,
          error: '生成超时',
          errorDetails: {
            code: 'TIMEOUT',
            responseBody: `Retry request exceeded ${params.timeoutMs}ms timeout`,
            model: params.executionNode.model,
            timestamp: Date.now()
          }
        });
      }
    }, params.timeoutMs);

    return {
      markFinished: () => {
        isFinished = true;
      },
      clear: () => clearTimeout(timer),
    };
  }, [cancelGenerationRequest, updatePromptNode]);

  const prepareRetryGeneratedMediaAttemptContext = useCallback((params: PrepareRetryGeneratedMediaAttemptContextParams): PrepareRetryGeneratedMediaAttemptContextResult => {
    const requestId = buildGenerationAttemptRequestId(
      params.executionNode.billingAttemptId || params.currentNodeId,
      params.index,
    );

    return {
      requestId,
      timeoutGuard: createRetryGenerationTimeoutGuard({
        executionNode: params.executionNode,
        requestId,
        timeoutMs: params.timeoutMs,
      }),
    };
  }, [createRetryGenerationTimeoutGuard]);

  const finalizeRetryGeneratedMediaAttemptGuard = useCallback((params: FinalizeRetryGeneratedMediaAttemptGuardParams): void => {
    params.timeoutGuard.markFinished();
    params.timeoutGuard.clear();
  }, []);

  const runRetryGeneratedMediaAttemptWithGuard = useCallback(async <T,>(params: RunRetryGeneratedMediaAttemptWithGuardParams<T>): Promise<T> => {
    try {
      const result = await params.run();
      finalizeRetryGeneratedMediaAttemptGuard({ timeoutGuard: params.timeoutGuard });
      return result;
    } catch (e) {
      finalizeRetryGeneratedMediaAttemptGuard({ timeoutGuard: params.timeoutGuard });
      throw e;
    }
  }, [finalizeRetryGeneratedMediaAttemptGuard]);

  const commitRetryGenerationStart = useCallback((params: CommitRetryGenerationStartParams) => {
    updatePromptNode({
      ...params.executionNode,
      modelLabel: params.resolveModelDisplayName(params.executionNode.model, params.executionNode.modelLabel || params.executionNode.model),
      isGenerating: true,
      error: undefined,
      errorDetails: undefined,
      isDraft: false,
      timestamp: Date.now()
    });
    applyOptimisticServerCreditDebit(
      params.retryBillingState.requiredCredits,
      params.retryBillingState.useServerSideCreditSettlement,
    );
  }, [applyOptimisticServerCreditDebit, updatePromptNode]);

  const reportRetryRecoveryResult = useCallback((params: ReportRetryRecoveryResultParams) => {
    if (params.recoveredCount <= 0 && params.pendingCount <= 0) {
      return;
    }
    const message = params.pendingCount > 0
      ? `已重新接管 ${params.pendingCount} 个可恢复请求，后台返图后会自动补回。`
      : `已找到 ${params.recoveredCount} 个已返图结果，正在补回到当前卡片。`;
    import('../services/system/notificationService').then(({ notify }) => {
      notify.info('恢复历史结果', message);
    });
  }, []);

  const recoverRetryGenerationBridge = useCallback(async (params: RecoverRetryGenerationBridgeParams): Promise<RecoverRetryGenerationBridgeResult> => {
    const recovered = await params.recoverFailedSyncBridgeGeneration(params.executionNode);
    const shouldShortCircuit = recovered.recoveredCount > 0 || recovered.pendingCount > 0;
    if (shouldShortCircuit) {
      reportRetryRecoveryResult({ recoveredCount: recovered.recoveredCount, pendingCount: recovered.pendingCount });
    }
    return {
      ...recovered,
      shouldShortCircuit,
    };
  }, [reportRetryRecoveryResult]);

  const prepareRetryGenerationRequestContext = useCallback((params: PrepareRetryGenerationRequestContextParams) => {
    const currentNodeId = params.node.id;
    const requestedCount = params.node.parallelCount || params.defaultParallelCount || 1;
    const count = params.node.mode === GenerationMode.PPT ? Math.min(20, Math.max(1, requestedCount)) : requestedCount;
    return { currentNodeId, requestedCount, count };
  }, []);

  const prepareRetryGeneratedMediaExecutionContext = useCallback(async (
    params: PrepareRetryGeneratedMediaExecutionContextParams,
  ): Promise<PrepareRetryGeneratedMediaExecutionContextResult> => {
    const retryExecutionNode = buildRetryExecutionNode({
      node: params.node,
      resolveNodeRouteState: params.resolveNodeRouteState,
    });
    const retryRecovery = await recoverRetryGenerationBridge({
      executionNode: retryExecutionNode,
      recoverFailedSyncBridgeGeneration: params.recoverFailedSyncBridgeGeneration,
    });
    if (retryRecovery.shouldShortCircuit) {
      return {
        prepared: false as const,
      };
    }

    const { currentNodeId, requestedCount, count } = prepareRetryGenerationRequestContext({
      node: params.node,
      defaultParallelCount: params.defaultParallelCount,
    });
    const preparedRetry = await prepareRetriedExecutionNode({
      executionNode: retryExecutionNode,
      nodeId: currentNodeId,
      parallelCount: count,
      phase: 'retry',
      resolveCreditCostForModel: params.resolveCreditCostForModel,
      ensureCreditAttemptCharged,
    });

    if (!preparedRetry) {
      return {
        prepared: false as const,
      };
    }

    return {
      prepared: true as const,
      currentNodeId,
      requestedCount,
      count,
      executionNode: preparedRetry.executionNode,
      retryBillingState: preparedRetry.billingState,
    };
  }, [ensureCreditAttemptCharged, prepareRetryGenerationRequestContext, recoverRetryGenerationBridge]);

  const reportRetryGenerationSuccess = useCallback((params: ReportRetryGenerationSuccessParams) => {
    const effectiveSize = params.alignedImageNodes[0]?.imageSize || params.executionNode.imageSize;

    import('../services/billing/costService').then(({ recordCost }) => {
      const firstDebug = params.results[0] || {};
      recordCost(
        params.executionNode.model,
        effectiveSize as ImageSize,
        params.alignedImageNodes.length,
        params.executionNode.prompt,
        params.executionNode.referenceImages?.length || 0,
        undefined,
        {
          requestPath: firstDebug.requestPath,
          requestBodyPreview: firstDebug.requestBodyPreview,
          pythonSnippet: firstDebug.pythonSnippet
        },
        params.alignedImageNodes[0]?.keySlotId || params.executionNode.keySlotId
      );
    });
    import('../services/system/notificationService').then(({ notify }) => {
      notify.success('生成完成', '重新生成成功');
    });
  }, []);

  const commitRetryGeneratedMediaSuccess = useCallback(async (params: CommitRetryGeneratedMediaSuccessParams): Promise<void> => {
    await params.addImageNodes(params.alignedImageNodes, {
      [params.parentNodeId]: params.retryCompletedPromptPatch,
    });

    reportRetryGenerationSuccess({
      executionNode: params.executionNode,
      alignedImageNodes: params.alignedImageNodes,
      results: params.results,
    });
  }, [reportRetryGenerationSuccess]);

  const prepareRetryGenerationTaskPromptContext = useCallback((params: PrepareRetryGenerationTaskPromptContextParams) => {
    const currentMode = params.executionNode.mode || GenerationMode.IMAGE;
    if (currentMode !== GenerationMode.PPT) {
      return { currentMode, taskPrompt: params.executionNode.prompt };
    }

    const slideLines = (params.executionNode.pptSlides || [])
      .map((line) => String(line || '').trim())
      .filter(Boolean);
    const styleDirective = params.executionNode.pptStyleLocked !== false
      ? '与整套 PPT 保持完全统一的视觉语言'
      : '保持整体风格统一，但允许当前页面有适度变化';
    const picked = slideLines.length > 0
      ? slideLines[Math.min(params.index, slideLines.length - 1)]
      : `主题：${params.sourcePrompt}。保持同一套视觉风格，页面内容独立不重复。`;

    return {
      currentMode,
      taskPrompt: `PPT 第 ${params.index + 1}/${params.count} 页。${picked}。16:9。${styleDirective}。`,
    };
  }, []);

  const prepareRetryVideoGenerationRequest = useCallback((params: PrepareRetryVideoGenerationRequestParams) => {
    const videoResolution = (() => {
      if (params.executionNode.videoResolution) return params.executionNode.videoResolution;
      const size = params.executionNode.imageSize?.toLowerCase() || '';
      if (size.includes('4k') || size.includes('ultra')) return '4k';
      if (size.includes('1080') || size.includes('hd')) return '1080p';
      return '720p';
    })();
    const videoAspect = params.executionNode.aspectRatio === '9:16' ? '9:16' : '16:9';

    return {
      modelId: params.executionNode.model,
      prompt: params.taskPrompt,
      aspectRatio: videoAspect,
      imageUrl: params.executionNode.referenceImages?.[0]?.data,
      imageTailUrl: params.executionNode.referenceImages?.[1]?.data,
      videoDuration: params.executionNode.videoDuration,
      preferredKeyId: params.executionNode.keySlotId,
      providerConfig: {
        google: {
          imageConfig: { imageSize: videoResolution }
        }
      }
    };
  }, []);

  const buildRetryVideoGenerationResultContext = useCallback((
    params: BuildRetryVideoGenerationResultContextParams,
  ): BuildRetryVideoGenerationResultContextResult => {
    const usage = params.videoResult.usage as (VideoGenerationResult['usage'] & {
      promptTokens?: number;
      completionTokens?: number;
    }) | undefined;
    const cost = resolveFiniteNumber(usage?.cost);

    return {
      requestTrace: {},
      b64: params.videoResult.url,
      resultMetadata: {
        completionTokens: resolveFiniteNumber(usage?.completionTokens),
        cost,
        costSource: cost !== undefined ? 'explicit' : 'none',
        keySlotId: params.videoResult.keySlotId || params.executionNode.keySlotId,
        model: params.videoResult.model || params.executionNode.model,
        modelLabel: params.videoResult.modelName || params.executionNode.modelLabel,
        promptTokens: resolveFiniteNumber(usage?.promptTokens),
        provider: params.videoResult.provider || params.executionNode.provider,
        providerLabel: params.videoResult.providerName || params.executionNode.providerLabel,
        tokens: resolveFiniteNumber(usage?.totalTokens),
      },
    };
  }, []);

  const resolveRetryGeneratedMediaGenerationTime = useCallback((params: ResolveRetryGeneratedMediaGenerationTimeParams): number => {
    const { apiDurationMs } = params;
    return clampGenerationDurationMs((apiDurationMs && apiDurationMs > 0)
      ? apiDurationMs
      : (Date.now() - params.startedAtMs));
  }, []);

  const prepareRetryImageGenerationRequest = useCallback((params: PrepareRetryImageGenerationRequestParams): PrepareRetryImageGenerationRequestResult => ({
    args: [
      params.taskPrompt,
      params.executionNode.aspectRatio,
      params.executionNode.imageSize,
      params.executionNode.referenceImages || [],
      params.executionNode.model,
      '',
      params.requestId,
    ],
    grounding: !!params.executionNode.enableGrounding || !!params.executionNode.enableImageSearch,
    options: {
      preferredKeyId: params.executionNode.keySlotId,
      enableWebSearch: !!params.executionNode.enableGrounding,
      enableImageSearch: !!params.executionNode.enableImageSearch,
      thinkingMode: params.executionNode.thinkingMode || 'minimal'
    }
  }), []);

  const buildRetryImageGenerationResultContext = useCallback((
    params: BuildRetryImageGenerationResultContextParams,
  ): BuildRetryImageGenerationResultContextResult => {
    const model = params.result.effectiveModel || params.executionNode.model;
    const cost = resolveFiniteNumber(params.result.cost);

    return {
      apiDurationMs: params.result.apiDurationMs,
      b64: params.result.url,
      balanceAfter: params.result.balanceAfter,
      requestTrace: {
        requestPath: params.result.requestPath,
        requestBodyPreview: params.result.requestBodyPreview,
        pythonSnippet: params.result.pythonSnippet,
      },
      resultMetadata: {
        completionTokens: resolveFiniteNumber(params.result.completionTokens),
        cost,
        costSource: cost !== undefined ? 'explicit' : 'none',
        keySlotId: params.result.keySlotId || params.executionNode.keySlotId,
        model,
        modelLabel: params.resolveModelDisplayName(
          model,
          params.result.modelName || params.executionNode.modelLabel,
        ),
        promptTokens: resolveFiniteNumber(params.result.promptTokens),
        provider: params.result.provider || params.executionNode.provider,
        providerLabel: params.result.providerName || params.executionNode.providerLabel,
        tokens: resolveFiniteNumber(params.result.tokens),
      },
    };
  }, []);

  const executeRetryGeneratedMediaRequest = useCallback(async (
    params: ExecuteRetryGeneratedMediaRequestParams,
  ): Promise<ExecuteRetryGeneratedMediaRequestResult> => {
    let generatedMediaContext: RetryGeneratedMediaResultContext;

    if (params.currentMode === GenerationMode.VIDEO) {
      const videoRequest = prepareRetryVideoGenerationRequest({ executionNode: params.executionNode, taskPrompt: params.taskPrompt });
      const videoResult = await params.generateVideo(videoRequest);
      generatedMediaContext = buildRetryVideoGenerationResultContext({
        executionNode: params.executionNode,
        videoResult,
      });
    } else {
      const imageRequest = prepareRetryImageGenerationRequest({ executionNode: params.executionNode, requestId: params.requestId, taskPrompt: params.taskPrompt });
      const result = await params.generateImage(
        ...imageRequest.args,
        imageRequest.grounding,
        imageRequest.options,
      );
      generatedMediaContext = buildRetryImageGenerationResultContext({
        executionNode: params.executionNode,
        result,
        resolveModelDisplayName: params.resolveModelDisplayName,
      });
    }

    return {
      currentMode: params.currentMode,
      taskPrompt: params.taskPrompt,
      generatedMediaContext,
    };
  }, [
    buildRetryImageGenerationResultContext,
    buildRetryVideoGenerationResultContext,
    prepareRetryImageGenerationRequest,
    prepareRetryVideoGenerationRequest,
  ]);

  const applyRetryGeneratedMediaAuthoritativeBalance = useCallback((params: ApplyRetryGeneratedMediaAuthoritativeBalanceParams): void => {
    if (typeof params.generatedMediaContext.balanceAfter === 'number') {
      params.applyAuthoritativeBalance(params.generatedMediaContext.balanceAfter);
    }
  }, []);

  const prepareRetryGeneratedMediaPersistence = useCallback(async (
    params: PrepareRetryGeneratedMediaPersistenceParams,
  ): Promise<PrepareRetryGeneratedMediaPersistenceResult> => {
    let url = params.b64;
    let originalUrl = '';
    let apiResultUrl: string | undefined = undefined;

    if (params.currentMode === GenerationMode.IMAGE || params.currentMode === GenerationMode.PPT || params.currentMode === GenerationMode.ECOMMERCE) {
      if (params.b64.startsWith('data:')) {
        originalUrl = params.b64;
      } else if (/^https?:\/\//i.test(params.b64)) {
        apiResultUrl = params.b64;
      }
    } else {
      url = params.b64;
      originalUrl = params.b64;
    }

    const mimeType = params.currentMode === GenerationMode.VIDEO ? 'video/mp4' : 'image/png';
    const normalizedOriginalSource = params.normalizePersistableMediaSource(
      originalUrl || url,
      mimeType,
    );
    const storageId = await params.calculateImageHash(normalizedOriginalSource || url);

    if (params.currentMode === GenerationMode.IMAGE || params.currentMode === GenerationMode.PPT || params.currentMode === GenerationMode.ECOMMERCE) {
      if (normalizedOriginalSource) {
        void params.saveOriginalImage(storageId, normalizedOriginalSource).catch(() => undefined);
      }
    }

    return {
      apiResultUrl,
      mimeType,
      normalizedOriginalSource,
      originalUrl,
      storageId,
      url,
    };
  }, []);

  const scheduleRetryGeneratedMediaCloudSync = useCallback((params: ScheduleRetryGeneratedMediaCloudSyncParams): void => {
    const shouldSyncImageMedia = params.currentMode === GenerationMode.IMAGE
      || params.currentMode === GenerationMode.PPT
      || params.currentMode === GenerationMode.ECOMMERCE;

    if (!shouldSyncImageMedia) {
      return;
    }

    if (!params.b64.startsWith('data:')) {
      return;
    }

    import('../services/system/syncService').then(async ({ syncService }) => {
      try {
        const res = await fetch(params.b64);
        const blob = await res.blob();
        const id = `${Date.now()}_${params.index}`;
        await syncService.uploadImagePair(id, blob);
      } catch (e) {
        console.warn('Cloud image sync skipped because no real upload backend is configured yet.', e);
      }
    }).catch(() => { });
  }, []);

  const resolveRetryGeneratedMediaDimensions = useCallback(async (
    params: ResolveRetryGeneratedMediaDimensionsParams,
  ): Promise<ResolveRetryGeneratedMediaDimensionsResult> => {
    let actualWidth = 1024;
    let actualHeight = 1024;
    let displayDimensions = `${params.executionNode.aspectRatio} · ${params.executionNode.imageSize || '1K'}`;
    let computedImageSize: PromptNode['imageSize'] = params.executionNode.imageSize || ImageSize.SIZE_1K;

    try {
      if (typeof createImageBitmap !== 'undefined' && params.b64.startsWith('blob:')) {
        const res = await fetch(params.b64);
        const blob = await res.blob();
        const bitmap = await createImageBitmap(blob);
        actualWidth = bitmap.width;
        actualHeight = bitmap.height;
        bitmap.close();
      } else {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = params.url;
        });
        actualWidth = img.naturalWidth;
        actualHeight = img.naturalHeight;
      }

      displayDimensions = `${actualWidth}x${actualHeight}`;

      const maxDim = Math.max(actualWidth, actualHeight);
      if (maxDim > 3000) {
        computedImageSize = ImageSize.SIZE_4K;
      } else if (maxDim > 1500) {
        computedImageSize = ImageSize.SIZE_2K;
      } else {
        computedImageSize = ImageSize.SIZE_1K;
      }
      console.log(`[Fair Billing] Requested: ${params.executionNode.imageSize}, Received: ${actualWidth}x${actualHeight}, Billed As: ${computedImageSize}`);
    } catch (e) {
      console.warn('[App] Failed to detect actual dimensions, falling back to requested', e);
    }

    return {
      actualHeight,
      actualWidth,
      computedImageSize,
      displayDimensions,
    };
  }, []);

  const buildRetryGeneratedMediaResult = useCallback((params: BuildRetryGeneratedMediaResultParams): RetryGeneratedMediaResult => {
    const sourceReferenceStorageIds = (params.executionNode.referenceImages || [])
      .map(ref => ref.storageId || ref.id)
      .filter((id): id is string => Boolean(id));

    return {
      canvasId: params.canvasId || 'default',
      parentPromptId: params.executionNode.id,
      dimensions: params.mediaDimensions.displayDimensions,
      generationTime: params.generationTime,
      index: params.index,
      url: params.mediaPersistence.url,
      originalUrl: params.mediaPersistence.originalUrl,
      apiResultUrl: params.mediaPersistence.apiResultUrl,
      prompt: params.prompt,
      width: params.mediaDimensions.actualWidth,
      height: params.mediaDimensions.actualHeight,
      aspectRatio: params.executionNode.aspectRatio,
      imageSize: params.mediaDimensions.computedImageSize,
      model: params.resultMetadata.model,
      modelLabel: params.resultMetadata.modelLabel,
      provider: params.resultMetadata.provider,
      providerLabel: params.resultMetadata.providerLabel,
      tokens: params.resultMetadata.tokens,
      promptTokens: params.resultMetadata.promptTokens,
      completionTokens: params.resultMetadata.completionTokens,
      cost: params.resultMetadata.cost,
      costSource: params.resultMetadata.costSource,
      billingMode: params.executionNode.billingMode,
      creditCost: params.executionNode.creditCost,
      keySlotId: params.resultMetadata.keySlotId,
      sourceReferenceStorageIds,
      alias: params.alias,
      seed: -1,
      id: `${Date.now()}_${params.index}_${Math.random().toString(36).substr(2, 5)}`,
      storageId: params.mediaPersistence.storageId,
      mimeType: params.mediaPersistence.mimeType,
      timestamp: Date.now(),
      mode: params.currentMode,
      requestPath: params.requestTrace.requestPath,
      requestBodyPreview: params.requestTrace.requestBodyPreview,
      pythonSnippet: params.requestTrace.pythonSnippet,
    };
  }, []);

  const buildRetryGeneratedMediaResultFromContext = useCallback((params: BuildRetryGeneratedMediaResultFromContextParams): RetryGeneratedMediaResult => {
    return buildRetryGeneratedMediaResult({
      alias: params.currentMode === GenerationMode.PPT ? params.buildPptPageAlias(params.executionNode.pptSlides?.[params.index], params.index) : undefined,
      canvasId: params.canvasId,
      currentMode: params.currentMode,
      executionNode: params.executionNode,
      generationTime: params.generationTime,
      index: params.index,
      mediaDimensions: params.mediaDimensions,
      mediaPersistence: params.mediaPersistence,
      prompt: params.prompt,
      requestTrace: params.generatedMediaContext.requestTrace,
      resultMetadata: params.generatedMediaContext.resultMetadata,
    });
  }, [buildRetryGeneratedMediaResult]);

  const executeRetryGeneratedMediaAttemptRequest = useCallback(async (
    params: ExecuteRetryGeneratedMediaAttemptRequestParams,
  ): Promise<ExecuteRetryGeneratedMediaRequestResult> => {
    const { requestId, timeoutGuard } = prepareRetryGeneratedMediaAttemptContext({
      currentNodeId: params.currentNodeId,
      executionNode: params.executionNode,
      index: params.index,
      timeoutMs: params.timeoutMs,
    });

    const { currentMode, taskPrompt } = prepareRetryGenerationTaskPromptContext({
      count: params.count,
      executionNode: params.executionNode,
      index: params.index,
      sourcePrompt: params.sourcePrompt,
    });

    return runRetryGeneratedMediaAttemptWithGuard({
      timeoutGuard,
      run: async () => {
        const requestResult = await executeRetryGeneratedMediaRequest({
          currentMode,
          executionNode: params.executionNode,
          generateImage: params.generateImage,
          generateVideo: params.generateVideo,
          requestId,
          resolveModelDisplayName: params.resolveModelDisplayName,
          taskPrompt,
        });
        applyRetryGeneratedMediaAuthoritativeBalance({
          generatedMediaContext: requestResult.generatedMediaContext,
          applyAuthoritativeBalance: params.applyAuthoritativeBalance,
        });
        return requestResult;
      },
    });
  }, [
    applyRetryGeneratedMediaAuthoritativeBalance,
    executeRetryGeneratedMediaRequest,
    prepareRetryGeneratedMediaAttemptContext,
    prepareRetryGenerationTaskPromptContext,
    runRetryGeneratedMediaAttemptWithGuard,
  ]);

  const assembleRetryGeneratedMediaAttemptResult = useCallback(async (
    params: AssembleRetryGeneratedMediaAttemptResultParams,
  ): Promise<RetryGeneratedMediaResult> => {
    const { apiDurationMs, b64 } = params.generatedMediaContext;

    const mediaPersistence = await prepareRetryGeneratedMediaPersistence({
      b64,
      currentMode: params.currentMode,
      normalizePersistableMediaSource: params.normalizePersistableMediaSource,
      calculateImageHash: params.calculateImageHash,
      saveOriginalImage: params.saveOriginalImage,
    });

    scheduleRetryGeneratedMediaCloudSync({
      b64,
      currentMode: params.currentMode,
      index: params.index,
    });

    const generationTime = resolveRetryGeneratedMediaGenerationTime({
      apiDurationMs,
      startedAtMs: params.startedAtMs,
    });

    const mediaDimensions = await resolveRetryGeneratedMediaDimensions({
      b64,
      executionNode: params.executionNode,
      url: mediaPersistence.url,
    });

    const generatedResult = buildRetryGeneratedMediaResultFromContext({
      buildPptPageAlias: params.buildPptPageAlias,
      canvasId: params.canvasId,
      currentMode: params.currentMode,
      executionNode: params.executionNode,
      generatedMediaContext: params.generatedMediaContext,
      generationTime,
      index: params.index,
      mediaDimensions,
      mediaPersistence,
      prompt: params.prompt,
    });
    return generatedResult;
  }, [
    buildRetryGeneratedMediaResultFromContext,
    prepareRetryGeneratedMediaPersistence,
    resolveRetryGeneratedMediaDimensions,
    resolveRetryGeneratedMediaGenerationTime,
    scheduleRetryGeneratedMediaCloudSync,
  ]);

  const runRetryGeneratedMediaAttempts = useCallback(async (
    params: RunRetryGeneratedMediaAttemptsParams,
  ): Promise<RetryGeneratedMediaResult[]> => {
    return Promise.all(Array.from({ length: params.count }).map(async (_, index) => {
      const { currentMode, taskPrompt, generatedMediaContext } = await executeRetryGeneratedMediaAttemptRequest({
        applyAuthoritativeBalance: params.applyAuthoritativeBalance,
        count: params.count,
        currentNodeId: params.currentNodeId,
        executionNode: params.executionNode,
        generateImage: params.generateImage,
        generateVideo: params.generateVideo,
        index,
        resolveModelDisplayName: params.resolveModelDisplayName,
        sourcePrompt: params.sourcePrompt,
        timeoutMs: params.timeoutMs,
      });

      const generatedResult = await assembleRetryGeneratedMediaAttemptResult({
        buildPptPageAlias: params.buildPptPageAlias,
        canvasId: params.canvasId,
        calculateImageHash: params.calculateImageHash,
        currentMode,
        executionNode: params.executionNode,
        generatedMediaContext,
        index,
        normalizePersistableMediaSource: params.normalizePersistableMediaSource,
        prompt: taskPrompt,
        saveOriginalImage: params.saveOriginalImage,
        startedAtMs: params.startedAtMs,
      });
      return generatedResult;
    }));
  }, [
    assembleRetryGeneratedMediaAttemptResult,
    executeRetryGeneratedMediaAttemptRequest,
  ]);

  const resolveRetryGeneratedMediaLayoutPrompt = useCallback((params: ResolveRetryGeneratedMediaLayoutPromptParams): ResolveRetryGeneratedMediaLayoutPromptResult => {
    return params.canvasSnapshot?.promptNodes.find((promptNode) => promptNode.id === params.executionNode.id)
      || params.executionNode;
  }, []);

  const buildRetryGeneratedMediaLayout = useCallback((params: BuildRetryGeneratedMediaLayoutParams): RetryGeneratedMediaLayoutNode[] => {
    const gapToImages = 20;
    const gap = 16;
    const { width: cardWidth, totalHeight: cardHeight } = params.getCardDimensions(params.executionNode.aspectRatio, true);

    const newImageNodes = params.results.map((img, i) => {
      let x;
      let y;
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
        const { totalHeight } = params.getCardDimensions(params.executionNode.aspectRatio, true);
        exactImageHeight = totalHeight;
      }

      const isPptMode = (params.executionNode.mode || GenerationMode.IMAGE) === GenerationMode.PPT;

      if (isPptMode) {
        const pptGap = 28;
        const offsetY = gapToImages + exactImageHeight + i * (exactImageHeight + pptGap);
        x = params.executionNode.position.x;
        y = params.executionNode.position.y + offsetY;
      } else if (params.isMobile) {
        const row = i;
        const mobileCardWidth = cardWidth;
        const mobileGap = 20;
        const startX = -mobileCardWidth / 2;
        const offsetX = startX + mobileCardWidth / 2;
        const offsetY = gapToImages + exactImageHeight + row * (exactImageHeight + mobileGap);
        x = params.executionNode.position.x + offsetX;
        y = params.executionNode.position.y + offsetY;
      } else {
        const cols = Math.min(params.count, 2);
        const col = i % cols;
        const row = Math.floor(i / cols);
        const itemsInRow = Math.min(cols, params.count - row * cols);
        let actualCardHeight = cardHeight;

        if (img.dimensions) {
          const match = img.dimensions.match(/(\d+)\s*[xX]\s*(\d+)/);
          if (match && match[1] && match[2]) {
            const w = parseInt(match[1], 10);
            const h = parseInt(match[2], 10);
            if (w > 0 && h > 0) {
              const aspect = w / h;
              const { width: baseWidth } = params.getCardDimensions(params.executionNode.aspectRatio, false);
              actualCardHeight = (baseWidth / aspect) + 40;
            }
          }
        }

        if (params.count === 1) {
          x = params.executionNode.position.x;
          y = params.executionNode.position.y + gapToImages + actualCardHeight;
        } else {
          const gridCardWidth = cardWidth;
          const currentGridWidth = itemsInRow * gridCardWidth + (itemsInRow - 1) * gap;
          const startX = params.executionNode.position.x - currentGridWidth / 2;
          const offsetX = startX + col * (gridCardWidth + gap) + gridCardWidth / 2 - params.executionNode.position.x;
          const rowHeight = exactImageHeight;
          const rowOffsetY = row * (rowHeight + gap);
          const offsetY = gapToImages + exactImageHeight + rowOffsetY;

          x = params.executionNode.position.x + offsetX;
          y = params.executionNode.position.y + offsetY;
        }
      }

      return {
        ...img,
        position: { x, y },
      };
    });

    const generatedPositions = params.buildGeneratedImageBatchPositions({
      basePosition: (params.latestLayoutPrompt || params.executionNode).position || params.executionNode.position,
      items: newImageNodes.map((img) => ({
        aspectRatio: img.aspectRatio,
        exactDimensions: (typeof img.width === 'number' && typeof img.height === 'number' && img.width > 0 && img.height > 0)
          ? { width: img.width, height: img.height }
          : undefined,
      })),
      mode: params.executionNode.mode,
      isMobile: params.isMobile,
    });

    return newImageNodes.map((img, index) => ({
      ...img,
      position: generatedPositions[index] || img.position,
    }));
  }, []);

  const buildRetryCompletedPromptPatch = useCallback((params: BuildRetryCompletedPromptPatchParams): Partial<PromptNode> => {
    const primaryImageNode = params.alignedImageNodes[0];
    const modelId = primaryImageNode?.model || params.executionNode.model;

    return {
      isGenerating: false,
      isDraft: false,
      childImageIds: params.alignedImageNodes.map(n => n.id),
      ...buildCompletedPromptNodePatch(),
      keySlotId: primaryImageNode?.keySlotId || params.executionNode.keySlotId,
      provider: primaryImageNode?.provider || params.executionNode.provider,
      providerLabel: primaryImageNode?.providerLabel || params.executionNode.providerLabel,
      modelLabel: params.resolveModelDisplayName(
        modelId,
        primaryImageNode?.modelLabel || params.executionNode.modelLabel,
      ),
    };
  }, []);

  const prepareRetryGeneratedMediaSuccessCommitContext = useCallback((params: PrepareRetryGeneratedMediaSuccessCommitContextParams): PrepareRetryGeneratedMediaSuccessCommitContextResult => {
    const latestLayoutPrompt = resolveRetryGeneratedMediaLayoutPrompt({
      canvasSnapshot: params.canvasSnapshot,
      executionNode: params.executionNode,
    });
    const alignedImageNodes = buildRetryGeneratedMediaLayout({
      buildGeneratedImageBatchPositions: params.buildGeneratedImageBatchPositions,
      count: params.count,
      executionNode: params.executionNode,
      getCardDimensions: params.getCardDimensions,
      isMobile: params.isMobile,
      latestLayoutPrompt,
      results: params.results,
    });
    const retryCompletedPromptPatch = buildRetryCompletedPromptPatch({
      alignedImageNodes,
      executionNode: params.executionNode,
      resolveModelDisplayName: params.resolveModelDisplayName,
    });

    return {
      alignedImageNodes,
      retryCompletedPromptPatch,
    };
  }, [buildRetryCompletedPromptPatch, buildRetryGeneratedMediaLayout, resolveRetryGeneratedMediaLayoutPrompt]);

  const commitRetryGeneratedMediaBatchSuccess = useCallback(async (
    params: CommitRetryGeneratedMediaBatchSuccessParams,
  ): Promise<void> => {
    const { alignedImageNodes, retryCompletedPromptPatch } = prepareRetryGeneratedMediaSuccessCommitContext({
      canvasSnapshot: params.canvasSnapshot,
      buildGeneratedImageBatchPositions: params.buildGeneratedImageBatchPositions,
      count: params.count,
      executionNode: params.executionNode,
      getCardDimensions: params.getCardDimensions,
      isMobile: params.isMobile,
      resolveModelDisplayName: params.resolveModelDisplayName,
      results: params.results,
    });

    await commitRetryGeneratedMediaSuccess({
      addImageNodes: params.addImageNodes,
      executionNode: params.executionNode,
      alignedImageNodes,
      parentNodeId: params.parentNodeId,
      results: params.results,
      retryCompletedPromptPatch,
    });
  }, [commitRetryGeneratedMediaSuccess, prepareRetryGeneratedMediaSuccessCommitContext]);

  const completeRetryGeneratedMediaBatch = useCallback(async (
    params: CompleteRetryGeneratedMediaBatchParams,
  ): Promise<void> => {
    commitRetryGenerationStart({
      executionNode: params.executionNode,
      retryBillingState: params.retryBillingState,
      resolveModelDisplayName: params.resolveModelDisplayName,
    });

    try {
      const startedAtMs = Date.now();
      const results = await runRetryGeneratedMediaAttempts({
        applyAuthoritativeBalance: params.applyAuthoritativeBalance,
        buildPptPageAlias: params.buildPptPageAlias,
        calculateImageHash: params.calculateImageHash,
        canvasId: params.canvasId,
        count: params.count,
        currentNodeId: params.currentNodeId,
        executionNode: params.executionNode,
        generateImage: params.generateImage,
        generateVideo: params.generateVideo,
        normalizePersistableMediaSource: params.normalizePersistableMediaSource,
        resolveModelDisplayName: params.resolveModelDisplayName,
        saveOriginalImage: params.saveOriginalImage,
        sourcePrompt: params.sourcePrompt,
        startedAtMs,
        timeoutMs: params.timeoutMs,
      });

      await commitRetryGeneratedMediaBatchSuccess({
        addImageNodes: params.addImageNodes,
        canvasSnapshot: params.canvasSnapshot,
        buildGeneratedImageBatchPositions: params.buildGeneratedImageBatchPositions,
        count: params.count,
        executionNode: params.executionNode,
        getCardDimensions: params.getCardDimensions,
        isMobile: params.isMobile,
        parentNodeId: params.parentNodeId,
        resolveModelDisplayName: params.resolveModelDisplayName,
        results,
      });
    } catch (error: unknown) {
      await commitRetryGenerationFailure({
        executionNode: params.executionNode,
        error,
        extractErrorDetails: params.extractErrorDetails,
      });
    }
  }, [commitRetryGeneratedMediaBatchSuccess, commitRetryGenerationFailure, commitRetryGenerationStart, runRetryGeneratedMediaAttempts]);

  const prepareGenerationDraftContext = useCallback(({
    activeCanvasRef,
    activeSourceImage,
    draftNodeId,
  }: PrepareGenerationDraftContextArgs) => {
    const isFollowUp = !!activeSourceImage;
    const existingPromptDraftId = String(draftNodeId || '').trim();
    const existingPromptDraft = existingPromptDraftId
      ? activeCanvasRef.current?.promptNodes.find((node) => node.id === existingPromptDraftId) ?? null
      : null;
    const hasReusablePromptDraft = Boolean(isFollowUp && existingPromptDraft);
    const promptNodeId = hasReusablePromptDraft
      ? existingPromptDraftId
      : createGenerationPromptNodeId();

    return {
      isFollowUp,
      existingPromptDraftId,
      existingPromptDraft,
      hasReusablePromptDraft,
      promptNodeId,
    };
  }, []);

  const prepareInitialBillingAttemptContext = useCallback((params: PrepareInitialBillingAttemptContextParams) => {
    const resolvedCreditRoute = params.generationBillingState.isCreditModel
      ? adminModelService.getCreditRouteSnapshot(params.modelId, params.imageSize)
      : null;
    const billingAttempt = buildGenerationBillingAttempt({
      nodeId: params.promptNodeId,
      phase: 'initial',
    });

    return {
      resolvedCreditRoute,
      resolvedCreditSpecId: resolvedCreditRoute?.specId,
      billingAttempt,
      executionLane: params.generationBillingState.executionLane,
      useServerSideCreditSettlement: params.generationBillingState.useServerSideCreditSettlement,
    };
  }, []);

  const prepareGenerationBillingStateContext = useCallback((params: PrepareGenerationBillingStateContextParams) => {
    const customLocal = (() => {
      try {
        return JSON.parse(localStorage.getItem('kk_model_customizations') || '{}')[params.config.model] || {};
      } catch {
        return {};
      }
    })();

    const preferredKeyIdForBilling = params.hasExplicitModelRoute(params.config.model)
      ? undefined
      : params.getPreferredKeyForMode(params.config.mode);
    const selectedKeyForBilling = keyManager.getNextKey(params.config.model, preferredKeyIdForBilling);
    const generationBillingState = resolveGenerationBillingState({
      modelId: params.config.model,
      imageSize: params.config.imageSize,
      mode: params.config.mode,
      parallelCount: params.config.parallelCount,
      customAlias: customLocal.alias,
      preferredKeyId: selectedKeyForBilling?.id || preferredKeyIdForBilling,
      resolveCreditCostForModel: params.resolveCreditCostForModel,
    });

    console.log('[handleGenerate] 计费检查', {
      model: params.config.model,
      provider: generationBillingState.resolvedProvider,
      selectedKeyId: selectedKeyForBilling?.id,
      hasCustomUserKey: generationBillingState.hasCustomUserKey,
      isCreditModel: generationBillingState.isCreditModel,
      mode: params.config.mode,
    });

    return {
      selectedKeyForBilling,
      generationBillingState,
    };
  }, []);

  const prepareInitialGenerationSubmissionContext = useCallback(async (
    params: PrepareInitialGenerationSubmissionContextParams,
  ): Promise<PrepareInitialGenerationSubmissionContextResult> => {
    const billingStateContext = prepareGenerationBillingStateContext({
      config: params.config,
      getPreferredKeyForMode: params.getPreferredKeyForMode,
      hasExplicitModelRoute: params.hasExplicitModelRoute,
      resolveCreditCostForModel: params.resolveCreditCostForModel,
    });
    const selectedKeyForBilling = billingStateContext.selectedKeyForBilling;
    const generationBillingState = billingStateContext.generationBillingState;

    const draftContext = prepareGenerationDraftContext({
      activeCanvasRef: params.activeCanvasRef,
      activeSourceImage: params.activeSourceImage,
      draftNodeId: params.draftNodeId,
    });

    const billingAttemptContext = prepareInitialBillingAttemptContext({
      generationBillingState,
      imageSize: params.config.imageSize,
      modelId: params.config.model,
      promptNodeId: draftContext.promptNodeId,
    });

    const requiredCredits = generationBillingState.requiredCredits;
    const initialCreditSettlement = await prepareInitialCreditSettlement({
      isCreditModel: generationBillingState.isCreditModel,
      modelId: params.config.model,
      modelLabel: params.config.model,
      providerId: generationBillingState.resolvedProvider || selectedKeyForBilling?.id || 'managed',
      provider: generationBillingState.resolvedProvider,
      requiredCredits,
      useServerSideCreditSettlement: billingAttemptContext.useServerSideCreditSettlement,
      billingAttempt: billingAttemptContext.billingAttempt,
    });

    if (!initialCreditSettlement.allowed) {
      return { allowed: false };
    }

    return {
      allowed: true,
      billingAttempt: billingAttemptContext.billingAttempt,
      draftContext,
      executionLane: billingAttemptContext.executionLane,
      generationBillingState,
      hasReusablePromptDraft: draftContext.hasReusablePromptDraft,
      isFollowUp: draftContext.isFollowUp,
      paymentTransactionId: initialCreditSettlement.paymentTransactionId,
      perImageCreditCost: generationBillingState.perImageCreditCost,
      promptNodeId: draftContext.promptNodeId,
      requiredCredits,
      resolvedCreditRoute: billingAttemptContext.resolvedCreditRoute,
      resolvedCreditSpecId: billingAttemptContext.resolvedCreditSpecId,
      selectedKeyForBilling,
      useServerSideCreditSettlement: billingAttemptContext.useServerSideCreditSettlement,
    };
  }, [
    prepareGenerationBillingStateContext,
    prepareGenerationDraftContext,
    prepareInitialBillingAttemptContext,
    prepareInitialCreditSettlement,
  ]);

  const prepareInitialGeneratingPromptNode = useCallback((params: PrepareInitialGeneratingPromptNodeParams) => {
    const generationPreviewState = resolveGenerationPreviewState({
      config: params.config,
      rawPrompt: params.rawPrompt,
      selectedKeyForBilling: params.selectedKeyForBilling,
      useServerSideCreditSettlement: params.useServerSideCreditSettlement,
    });

    const generatingNode = buildGeneratingPromptNode({
      promptNodeId: params.promptNodeId,
      prompt: params.rawPrompt,
      optimizedPromptEn: params.optimizedPromptEn,
      optimizedPromptZh: params.optimizedPromptZh,
      promptOptimizerResult: params.promptOptimizerResult,
      promptOptimizationEnabled: !!(params.config.enablePromptOptimization && (params.optimizedPromptEn || params.promptOptimizerResult)),
      position: params.currentPos,
      config: params.config,
      previewModelLabel: generationPreviewState.previewModelLabel,
      previewModelMeta: generationPreviewState.previewColorMeta,
      previewProvider: generationPreviewState.previewProvider,
      previewProviderLabel: generationPreviewState.previewProviderLabel,
      keySlotId: generationPreviewState.keySlotId,
      referenceImages: params.finalReferenceImages,
      creditSettlement: params.useServerSideCreditSettlement ? 'server' : 'client',
      executionLane: params.executionLane,
      billingAttemptId: params.billingAttempt.attemptId,
      creditRouteSpecId: params.resolvedCreditSpecId,
      creditRouteUnitId: params.resolvedCreditRoute?.routeUnitId,
      paymentTransactionId: params.paymentTransactionId,
      isNew: true,
      parallelCount: generationPreviewState.parallelCount,
      sourceImageId: params.activeSourceImage || undefined,
      pptSlides: generationPreviewState.pptSlides,
      cost: params.requiredCredits,
      billingMode: params.generationBillingState.isCreditModel ? 'credits' : 'currency',
      creditCost: params.generationBillingState.isCreditModel ? params.perImageCreditCost : undefined,
      isPaymentProcessed: params.requiredCredits > 0 && !params.useServerSideCreditSettlement,
    });

    return { generatingNode };
  }, []);

  const prepareInitialGenerationPromptOptimization = useCallback(async (params: PrepareInitialGenerationPromptOptimizationParams) => {
    return optimizeGenerationPrompt({
      enabled: (params.config.mode === GenerationMode.IMAGE || params.config.mode === GenerationMode.PPT)
        && params.config.enablePromptOptimization
        && !!params.rawPrompt,
      rawPrompt: params.rawPrompt,
      referenceImages: params.finalReferenceImages,
      options: {
        preferredModelId: params.config.model,
        aspectRatio: params.config.aspectRatio,
        imageSize: params.config.imageSize,
        mode: params.config.mode,
        supportsThinking: !!getModelCapabilities(params.config.model)?.supportsThinking,
        thinkingMode: params.config.thinkingMode || 'minimal',
      },
      onError: (error) => {
        const message = summarizePromptOptimizationError(error);
        console.warn('[handleGenerate] Prompt optimization failed, fallback to raw prompt:', summarizePromptOptimizationError(error));
        import('../services/system/notificationService').then(({ notify }) => {
          notify.error('Prompt optimization failed', 'Fell back to the original prompt: ' + message);
        });
      },
    });
  }, []);

  const prepareInitialGeneratingPromptNodeContext = useCallback(async (params: PrepareInitialGeneratingPromptNodeContextParams): Promise<PrepareInitialGeneratingPromptNodeContextResult> => {
    const finalReferenceImages = params.prepareGenerationReferenceImages(params.config.referenceImages ?? []);
    const initialPromptOptimization = await prepareInitialGenerationPromptOptimization({
      config: params.config,
      rawPrompt: params.rawPrompt,
      finalReferenceImages,
    });

    const initialGeneratingNode = prepareInitialGeneratingPromptNode({
      activeSourceImage: params.activeSourceImage,
      billingAttempt: params.billingAttempt,
      config: params.config,
      currentPos: params.currentPos,
      executionLane: params.executionLane,
      finalReferenceImages,
      generationBillingState: params.generationBillingState,
      optimizedPromptEn: initialPromptOptimization.optimizedPromptEn,
      optimizedPromptZh: initialPromptOptimization.optimizedPromptZh,
      paymentTransactionId: params.paymentTransactionId,
      perImageCreditCost: params.perImageCreditCost,
      promptNodeId: params.promptNodeId,
      promptOptimizerResult: initialPromptOptimization.promptOptimizerResult,
      rawPrompt: params.rawPrompt,
      requiredCredits: params.requiredCredits,
      resolvedCreditRoute: params.resolvedCreditRoute,
      resolvedCreditSpecId: params.resolvedCreditSpecId,
      selectedKeyForBilling: params.selectedKeyForBilling,
      useServerSideCreditSettlement: params.useServerSideCreditSettlement,
    });

    return initialGeneratingNode;
  }, [prepareInitialGeneratingPromptNode, prepareInitialGenerationPromptOptimization]);

  const persistInitialGeneratingPromptNode = useCallback(async (params: PersistInitialGeneratingPromptNodeParams) => {
    const persistedGeneratingNode = await persistGeneratingPromptNode({
      generatingNode: params.generatingNode,
      getCanvas: params.getCanvas,
      updatePromptNode,
      addPromptNode: params.addPromptNode,
      updateImageNodePosition: params.updateImageNodePosition,
      deletePromptNode: params.deletePromptNode,
    });

    return { persistedGeneratingNode };
  }, [updatePromptNode]);

  const completeInitialGenerationPromptSubmission = useCallback((params: CompleteInitialGenerationPromptSubmissionParams) => {
    params.setDraftNodeId(null);
    params.setConfig(prev => ({ ...prev, prompt: '', referenceImages: [] }));
    params.setActiveSourceImage(null);
  }, []);

  const completeAndExecuteInitialGenerationSubmission = useCallback(async (params: CompleteAndExecuteInitialGenerationSubmissionParams): Promise<void> => {
    completeInitialGenerationPromptSubmission({
      setActiveSourceImage: params.setActiveSourceImage,
      setConfig: params.setConfig,
      setDraftNodeId: params.setDraftNodeId,
    });

    await executeInitialGenerationPromptNode({
      persistedGeneratingNode: params.persistedGeneratingNode,
      requiredCredits: params.requiredCredits,
      useServerSideCreditSettlement: params.useServerSideCreditSettlement,
      executeGeneration: params.executeGeneration,
    });
  }, [completeInitialGenerationPromptSubmission, executeInitialGenerationPromptNode]);

  const persistAndExecuteInitialGenerationSubmission = useCallback(async (
    params: PersistAndExecuteInitialGenerationSubmissionParams,
  ): Promise<PersistAndExecuteInitialGenerationSubmissionResult> => {
    const persistedGeneration = await persistInitialGeneratingPromptNode({
      generatingNode: params.generatingNode,
      getCanvas: params.getCanvas,
      addPromptNode: params.addPromptNode,
      updateImageNodePosition: params.updateImageNodePosition,
      deletePromptNode: params.deletePromptNode,
    });
    const persistedGeneratingNode = persistedGeneration.persistedGeneratingNode;

    await completeAndExecuteInitialGenerationSubmission({
      setActiveSourceImage: params.setActiveSourceImage,
      setConfig: params.setConfig,
      setDraftNodeId: params.setDraftNodeId,
      persistedGeneratingNode,
      requiredCredits: params.requiredCredits,
      useServerSideCreditSettlement: params.useServerSideCreditSettlement,
      executeGeneration: params.executeGeneration,
    });

    return { persistedGeneratingNode };
  }, [completeAndExecuteInitialGenerationSubmission, persistInitialGeneratingPromptNode]);

  const runInitialGenerationSubmissionTransaction = useCallback(async (
    params: RunInitialGenerationSubmissionTransactionParams,
  ): Promise<void> => {
    const initialSubmissionContext = params.initialSubmissionContext;

    try {
      const placement = params.resolveGenerationPlacement({
        isFollowUp: params.initialSubmissionContext.isFollowUp,
        promptNodeId: params.initialSubmissionContext.promptNodeId,
        hasReusablePromptDraft: params.initialSubmissionContext.hasReusablePromptDraft,
      });

      const initialGeneratingNode = await prepareInitialGeneratingPromptNodeContext({
        activeSourceImage: params.activeSourceImage,
        billingAttempt: initialSubmissionContext.billingAttempt,
        config: params.config,
        currentPos: placement.currentPos,
        executionLane: initialSubmissionContext.executionLane,
        generationBillingState: initialSubmissionContext.generationBillingState,
        paymentTransactionId: initialSubmissionContext.paymentTransactionId,
        perImageCreditCost: initialSubmissionContext.perImageCreditCost,
        prepareGenerationReferenceImages: params.prepareGenerationReferenceImages,
        promptNodeId: placement.promptNodeId,
        rawPrompt: params.rawPrompt,
        requiredCredits: initialSubmissionContext.requiredCredits,
        resolvedCreditRoute: initialSubmissionContext.resolvedCreditRoute,
        resolvedCreditSpecId: initialSubmissionContext.resolvedCreditSpecId,
        selectedKeyForBilling: initialSubmissionContext.selectedKeyForBilling,
        useServerSideCreditSettlement: initialSubmissionContext.useServerSideCreditSettlement,
      });
      const generatingNode = initialGeneratingNode.generatingNode;

      await persistAndExecuteInitialGenerationSubmission({
        generatingNode,
        getCanvas: params.getCanvas,
        addPromptNode: params.addPromptNode,
        updateImageNodePosition: params.updateImageNodePosition,
        deletePromptNode: params.deletePromptNode,
        setActiveSourceImage: params.setActiveSourceImage,
        setConfig: params.setConfig,
        setDraftNodeId: params.setDraftNodeId,
        requiredCredits: params.initialSubmissionContext.requiredCredits,
        useServerSideCreditSettlement: params.initialSubmissionContext.useServerSideCreditSettlement,
        executeGeneration: params.executeGeneration,
      });
    } catch (error) {
      reportInitialGenerationFailure({ error });
    }
  }, [
    persistAndExecuteInitialGenerationSubmission,
    prepareInitialGeneratingPromptNodeContext,
    reportInitialGenerationFailure,
  ]);

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
      import('../services/system/notificationService').then(({ notify }) => {
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
      Math.max(pageIndex + 1, executionNode.parallelCount || 1, ordered.length),
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
          thinkingMode: executionNode.thinkingMode || 'minimal',
        }
      );

      if (typeof result.balanceAfter === 'number') {
        applyAuthoritativeBalance(result.balanceAfter);
      }

      let storageId = target.storageId;
      const persistableResultSource = normalizePersistableMediaSource(
        result.url,
        target.mimeType || 'image/png',
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
        error: undefined,
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

      import('../services/system/notificationService').then(({ notify }) => {
        notify.success('单页重绘完成', `已更新图${pageIndex + 1}`);
      });
    } catch (error: any) {
      const failedBillingState = await resolveFailedCreditAttempt(executionNode);
      updatePromptNode({
        ...executionNode,
        ...failedBillingState,
      });
      updateImageNode(target.id, {
        isGenerating: false,
        error: error?.message || '单页重绘失败',
      });
      import('../services/system/notificationService').then(({ notify }) => {
        notify.error('单页重绘失败', error?.message || '请稍后重试');
      });
    }
  }, [
    activeCanvas,
    applyAuthoritativeBalance,
    applyOptimisticServerCreditDebit,
    buildPptPageAlias,
    ensureCreditAttemptCharged,
    generateImage,
    rememberPreferredKeyForMode,
    resolveCreditCostForModel,
    resolveFailedCreditAttempt,
    resolveModelDisplayName,
    resolveNodeRouteState,
    resolveProviderDisplay,
    updateImageNode,
    updatePromptNode,
  ]);

  const handleCancelGeneration = useCallback(async (id?: string) => {
    const promptNodes = activeCanvas?.promptNodes ?? [];

    if (id) {
      cancelGenerationRequest(id);
      const node = promptNodes.find((candidate) => candidate.id === id);
      if (!node) {
        return;
      }

      if (node.jobId?.startsWith('system_proxy:')) {
        try {
          await cancelSystemProxyTask(node.jobId);
        } catch (error) {
          console.warn('[handleCancelGeneration] 取消系统任务失败:', error);
        }
      }

      await updatePromptNode({
        ...node,
        ...buildCancelledPromptNodePatch(node.model),
      });
      return;
    }

    const generatingNodes = promptNodes.filter((node) => node.isGenerating);
    await Promise.allSettled(generatingNodes.map(async (node) => {
      const count = node.parallelCount || 1;
      for (let i = 0; i < count; i += 1) {
        cancelGenerationRequest(`${node.id}-${i}`);
      }

      if (node.jobId?.startsWith('system_proxy:')) {
        try {
          await cancelSystemProxyTask(node.jobId);
        } catch (error) {
          console.warn('[handleCancelGeneration] 批量取消系统任务失败:', error);
        }
      }

      await updatePromptNode({
        ...node,
        ...buildCancelledPromptNodePatch(node.model),
      });
    }));
  }, [activeCanvas, cancelGenerationRequest, cancelSystemProxyTask, updatePromptNode]);

  return {
    handleCancelGeneration,
    handleRetryPptSinglePage,
    ensureCreditAttemptCharged,
    prepareInitialCreditSettlement,
    prepareGenerationDraftContext,
    prepareInitialBillingAttemptContext,
    prepareGenerationBillingStateContext,
    prepareInitialGenerationSubmissionContext,
    prepareInitialGeneratingPromptNode,
    persistInitialGeneratingPromptNode,
    prepareInitialGenerationPromptOptimization,
    prepareInitialGeneratingPromptNodeContext,
    completeInitialGenerationPromptSubmission,
    completeAndExecuteInitialGenerationSubmission,
    persistAndExecuteInitialGenerationSubmission,
    runInitialGenerationSubmissionTransaction,
    commitRetryGenerationFailure,
    executeInitialGenerationPromptNode,
    reportInitialGenerationFailure,
    createRetryGenerationTimeoutGuard,
    finalizeRetryGeneratedMediaAttemptGuard,
    runRetryGeneratedMediaAttemptWithGuard,
    prepareRetryGeneratedMediaAttemptContext,
    reportRetryRecoveryResult,
    recoverRetryGenerationBridge,
    prepareRetryGenerationRequestContext,
    prepareRetryGeneratedMediaExecutionContext,
    reportRetryGenerationSuccess,
    commitRetryGeneratedMediaSuccess,
    prepareRetryGenerationTaskPromptContext,
    prepareRetryVideoGenerationRequest,
    buildRetryVideoGenerationResultContext,
    resolveRetryGeneratedMediaGenerationTime,
    prepareRetryImageGenerationRequest,
    buildRetryImageGenerationResultContext,
    executeRetryGeneratedMediaRequest,
    applyRetryGeneratedMediaAuthoritativeBalance,
    executeRetryGeneratedMediaAttemptRequest,
    prepareRetryGeneratedMediaPersistence,
    scheduleRetryGeneratedMediaCloudSync,
    resolveRetryGeneratedMediaDimensions,
    buildRetryGeneratedMediaResult,
    buildRetryGeneratedMediaResultFromContext,
    assembleRetryGeneratedMediaAttemptResult,
    runRetryGeneratedMediaAttempts,
    resolveRetryGeneratedMediaLayoutPrompt,
    buildRetryGeneratedMediaLayout,
    buildRetryCompletedPromptPatch,
    prepareRetryGeneratedMediaSuccessCommitContext,
    commitRetryGeneratedMediaBatchSuccess,
    completeRetryGeneratedMediaBatch,
    resolveFailedCreditAttempt,
    applyOptimisticServerCreditDebit,
  };
}
