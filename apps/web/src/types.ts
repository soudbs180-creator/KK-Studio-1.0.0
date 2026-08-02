import type {
  CanvasCardPresentation,
  CanvasConnection,
  CanvasNoteNodeDto,
  ContextReferenceDto,
  GenerationTelemetry,
  ReferenceRole,
  VideoReferenceMode,
} from '@kk/shared';

export const AspectRatio = {
  AUTO: 'auto', // Auto match
  SQUARE: '1:1',
  PORTRAIT_1_8: '1:8', // New: Nano Banana 2 & Pro
  PORTRAIT_1_4: '1:4', // New: Nano Banana 2 & Pro
  PORTRAIT_3_4: '3:4',
  PORTRAIT_4_5: '4:5', // Gemini 3 Pro
  PORTRAIT_9_16: '9:16',
  PORTRAIT_9_21: '9:21', // Flux Mobile
  PORTRAIT_2_3: '2:3',
  LANDSCAPE_4_3: '4:3',
  LANDSCAPE_5_4: '5:4', // Gemini 3 Pro
  LANDSCAPE_16_9: '16:9',
  LANDSCAPE_21_9: '21:9',
  LANDSCAPE_4_1: '4:1', // New: Nano Banana 2 & Pro
  LANDSCAPE_8_1: '8:1', // New: Nano Banana 2 & Pro
  LANDSCAPE_3_2: '3:2',
  STANDARD_2_3: '2:3', // Alias/Legacy
  STANDARD_3_2: '3:2', // Alias/Legacy
} as const;

export type AspectRatio = typeof AspectRatio[keyof typeof AspectRatio];

export interface GeneratedImage {
  id: string;
  telemetry?: GenerationTelemetry;
}

export const ImageSize = {
  SIZE_05K: '0.5K', // 512px - Gemini 3.1 Flash Image
  SIZE_1K: '1K',
  SIZE_2K: '2K',
  SIZE_4K: '4K',
} as const;
export type ImageSize = typeof ImageSize[keyof typeof ImageSize];

// Model IDs are now dynamic strings, but keeping this for legacy ref if needed
// or just deprecated it completely.
// For now, let's keep it as string union or just string to allow custom models.
export type ModelType = string;

export type AppSurface = 'workspace' | 'library' | 'favorites' | 'chat' | 'settings' | 'profile';

export type WorkspacePanel = 'history' | 'favorites' | 'chat' | null;

export type MobilePrimaryTab =
  | 'create'
  | 'canvas'
  | 'copilot'
  | 'assets'
  | 'library'
  | 'chat'
  | 'me';

export type ResponsiveSurface = 'phone' | 'tablet' | 'desktop';

export type ResultViewMode = 'standard' | 'detail';

export type MobileSurfaceScreen = 'home' | 'detail' | 'more-sheet' | 'ecommerce';
// 兼容旧版测试正则匹配: export type MobileSurfaceScreen = 'home' | 'detail' | 'more-sheet' | 'ecommerce';

export type MobileSettingsSection = 'dashboard' | 'api-management' | 'consumption-records' | 'system-logs';

export interface MobileResultActions {
  preview: boolean;
  useAsSource: boolean;
  partialRedraw: boolean;
  download: boolean;
  delete: boolean;
}

export interface MobileEcommerceContinuation {
  promptNodeId: string | null;
  taskId?: string;
  sourceSheet: EcommerceGroupSheet;
  kind: Exclude<EcommercePromptKind, 'a-plus-group' | 'framework'>;
  sourceRowKey: string;
  outputTypeLabel: string;
  displayLabel: string;
  declaredSizeText?: string;
  taskPrompt?: string;
  assetRoles: EcommerceTaskAssetRoleBinding[];
  stageLabel: string;
  stageTone: 'amber' | 'blue' | 'emerald' | 'rose';
  stageDescription: string;
  reviewWarnings: string[];
  selectedForGeneration: boolean;
  canEditTask: boolean;
  canConfirmDesktop: boolean;
  canGenerateMobile: boolean;
  canToggleSelection: boolean;
  frameworkId?: string;
  frameworkLabel?: string;
  frameworkStatus?: {
    activeSheet: EcommerceGroupSheet;
    paused: boolean;
    queued: number;
    dispatching: number;
    running: number;
    completed: number;
    failed: number;
    pausedItems: number;
    total: number;
  };
}

export interface MobileResultLayout {
  aspectRatio: number;
  aspectCategory: 'portrait' | 'square' | 'landscape' | 'wide';
  emphasis: 'compact' | 'standard' | 'wide';
}

export type EcommerceGroupSheet = '主图' | 'A+';

export type EcommerceAPlusControlMode = 'auto' | '1464x600' | '970x600' | '600x450';

export interface EcommerceSheetSetting {
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  aPlusControlMode?: EcommerceAPlusControlMode;
}

export interface EcommerceSheetSettingPatch {
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
  aPlusControlMode?: EcommerceAPlusControlMode;
}

export interface MobileResultEntry {
  id: string;
  imageId: string;
  displaySrc: string | null;
  displayLabel?: string;
  hasOriginal: boolean;
  timestamp: number;
  parentPromptId: string | null;
  prompt?: string;
  promptSummary: string;
  fullPrompt: string;
  referenceImages: ReferenceImage[];
  modelId?: string;
  modelLabel: string;
  aspectRatio: AspectRatio | string;
  imageSize: ImageSize | string;
  actions: MobileResultActions;
  primaryImageSource?: string | null;
  ecommerceContinuation?: MobileEcommerceContinuation;
  mobileLayout: MobileResultLayout;
  detailEntryId?: string;
  detailEntry?: {
    imageId: string;
    promptId: string | null;
  };
  creditCost?: number;
  generationTime?: number;
  isGenerating?: boolean;
  error?: string;
  tags?: string[];
  groupCount?: number;
  groupEntries?: MobileResultEntry[];
}

// ============================================
// 已知模型常量 - 图像和视频生成
// 参考: https://ai.google.dev/gemini-api/docs/pricing?hl=zh-cn
// ============================================
export const KnownModel = {
  // Imagen 4 系列（最新）
  IMAGEN_4: 'imagen-4.0-generate-001',
  IMAGEN_4_ULTRA: 'imagen-4.0-ultra-generate-001',
  IMAGEN_4_FAST: 'imagen-4.0-fast-generate-001',

  // Imagen 3 系列
  IMAGEN_3: 'imagen-3.0-generate-001',
  IMAGEN_3_LEGACY: 'imagen-3.0-generate-002',

  // Gemini 原生图像生成系列
  GEMINI_2_5_FLASH_IMAGE: 'gemini-2.5-flash-image',
  GEMINI_3_PRO_IMAGE: 'gemini-3-pro-image-preview',

  // Veo 视频生成系列
  VEO_3_1: 'veo-3.1-generate-preview',
  VEO_3_1_FAST: 'veo-3.1-fast-generate-preview',
  VEO_3: 'veo-3.0-generate-001',
  VEO_3_FAST: 'veo-3.0-fast-generate-001',
  VEO_2: 'veo-2.0-generate-001',

  // Third Party Fallback
  DALLE_3: 'dall-e-3',
  MIDJOURNEY: 'midjourney',
}

export const GenerationMode = {
  IMAGE: 'image',
  VIDEO: 'video',
  ECOMMERCE: 'ecommerce',
  AUDIO: 'audio',  // Audio generation mode
  PPT: 'ppt',      // PPT batch image mode
  EDIT: 'edit',    // General edit mode
  INPAINT: 'inpaint', // Mask-based inpaint mode
  REDRAW: 'redraw', // Partial redraw mode
} as const;
export type GenerationMode = typeof GenerationMode[keyof typeof GenerationMode];

// ============================================
// 聊天模型类型
// 参考: https://ai.google.dev/gemini-api/docs/pricing?hl=zh-cn
// ============================================
export const ChatModelType = {
  // Gemini 2.5 series
  GEMINI_2_5_PRO: 'gemini-2.5-pro',
  GEMINI_2_5_FLASH: 'gemini-2.5-flash',
  GEMINI_2_5_FLASH_LITE: 'gemini-2.5-flash-lite',
  // Gemini 3 series
  GEMINI_3_PRO: 'gemini-3-pro-preview',
  GEMINI_3_FLASH: 'gemini-3-flash-preview',
} as const;
export type ChatModelType = typeof ChatModelType[keyof typeof ChatModelType];

export interface ReferenceImage {
  id: string;
  storageId?: string; // Content-based Hash ID for storage deduplication
  data: string; // Base64 or URL
  mimeType: string;
  url?: string; // Optional URL for thumbnail/reference
  mentionName?: string; // User-facing @ reference name used for semantic binding
  mentionText?: string;
  mentionSourceId?: string;
  role?: ReferenceRole;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PartialRedrawMetadata {
  sourceImageId: string;
  sourceImageStorageId?: string;
  sourcePromptId?: string;
  sourceImageDimensions: { width: number; height: number };
  selectionRect: NormalizedRect;
  generationRect: NormalizedRect;
  targetAspectRatio: AspectRatio;
  extraReferenceImageIds: string[];
  inheritedDisplayLabel?: string;
  inheritedTaskState?: EcommerceEditableTaskState;
  inheritedDeliveryKind?: EcommerceSlotDeliveryKind;
  compositeVersion: 1;
}

export interface PartialRedrawRequest {
  model: ModelType;
  aspectRatio: AspectRatio;
  prompt: string;
  selectionRect: NormalizedRect;
  generationRect: NormalizedRect;
  sourceImageDimensions: { width: number; height: number };
  referenceImages: ReferenceImage[];
}

export type RedrawRegionKind = 'rect' | 'stroke' | 'merged';
export type RedrawPlanMode = 'whole-image' | 'regional-crops' | 'whole-image-marked' | 'color-blocks';

export interface RedrawPoint {
  x: number;
  y: number;
}

export interface RedrawStroke {
  id: string;
  points: RedrawPoint[];
  brushSize: number;
  color?: string;
}

export interface RedrawRegion {
  id: string;
  kind: RedrawRegionKind;
  rect: NormalizedRect;
  stroke?: RedrawStroke;
  color?: string;
  label?: string;
}

export interface RedrawColorBlock {
  id: string;
  color: string;
  label: string;
  rect: NormalizedRect;
  prompt?: string;
}

export interface RedrawCropPlan {
  id: string;
  regionIds: string[];
  selectionRect: NormalizedRect;
  generationRect: NormalizedRect;
  pixelRect: { x: number; y: number; width: number; height: number };
  imageSize: ImageSize;
}

export interface RedrawPlan {
  mode: RedrawPlanMode;
  model: ModelType;
  aspectRatio: AspectRatio;
  prompt: string;
  sourceImageDimensions: { width: number; height: number };
  regions: RedrawRegion[];
  cropPlans: RedrawCropPlan[];
  colorBlocks?: RedrawColorBlock[];
  annotatedReferenceImage?: ReferenceImage;
  strictPrompt?: string;
}

export interface RedrawRequest {
  model: ModelType;
  aspectRatio: AspectRatio;
  prompt: string;
  sourceImageDimensions: { width: number; height: number };
  referenceImages: ReferenceImage[];
  regions: RedrawRegion[];
  strokes?: RedrawStroke[];
  colorBlocks?: RedrawColorBlock[];
  plan: RedrawPlan;
  selectionRect?: NormalizedRect;
  generationRect?: NormalizedRect;
}

export interface RedrawMetadata {
  mode: RedrawPlanMode;
  sourceImageId: string;
  compositionBaseImageId?: string;
  sourceImageStorageId?: string;
  sourcePromptId?: string;
  sourceImageDimensions: { width: number; height: number };
  regions: RedrawRegion[];
  cropPlans: RedrawCropPlan[];
  targetAspectRatio: AspectRatio;
  extraReferenceImageIds: string[];
  colorBlocks?: RedrawColorBlock[];
  strictPrompt?: string;
  inheritedDisplayLabel?: string;
  inheritedTaskState?: EcommerceEditableTaskState;
  inheritedDeliveryKind?: EcommerceSlotDeliveryKind;
  compositeVersion: 2;
}

export interface GeneratedImage {
  id: string;
  telemetry?: GenerationTelemetry;
  storageId?: string; // Content-based Hash ID for storage deduplication
  url: string;
  originalUrl?: string; // High-res original (if different from url)
  apiResultUrl?: string; // Persisted remote HTTP(S) source for recovery
  prompt: string;
  aspectRatio: AspectRatio;
  imageSize?: ImageSize; // Image size/quality setting
  timestamp: number;
  model: ModelType;
  modelLabel?: string; // Display label captured at generation time
  modelColorStart?: string;
  modelColorEnd?: string;
  modelColorSecondary?: string;
  modelTextColor?: 'white' | 'black';
  canvasId: string;
  parentPromptId: string;
  position: { x: number; y: number };
  generationTime?: number; // Duration in ms
  dimensions?: string; // e.g. "1024x1024"
  displayLabel?: string; // Business-facing label such as "主图 1:1 4K"
  mode?: GenerationMode; // New: track creation mode
  tags?: string[]; // Search tags
  tokens?: number; // New: Token usage
  promptTokens?: number;
  completionTokens?: number;
  cost?: number; // New: Estimated cost
  costSource?: 'snapshot' | 'explicit' | 'stored' | 'estimated' | 'none';
  billingMode?: 'credits' | 'currency';
  creditCost?: number;
  orphaned?: boolean; // 孤立副卡（无父节点）
  userMoved?: boolean; // 是否被用户手动移动过（用于保留副卡自定义布局）
  fileName?: string; // 原始文档名
  fileSize?: number; // 文档大小（字节）
  alias?: string; // 🎯 [New] 用户自定义备注名
  isGenerating?: boolean; // 🎯 [New] True when image is being generated
  error?: string; // 🎯 [New] Error message for failed generation
  mimeType?: string; // 🎯 [New] Image MIME type (e.g., 'image/png', 'image/jpeg')
  exactDimensions?: { width: number; height: number }; // 🎯 [New] Exact dimensions for AUTO mode
  provider?: string; // 🎯 [New] API Provider Name (e.g., Google, OpenAI)
  providerLabel?: string; // 🎯 [New] User-defined Channel Name (e.g. 'Google Official')
  keySlotId?: string;
  sourceTaskId?: string;
  sourceResultIndex?: number;
  sourceReferenceStorageIds?: string[];
  requestPath?: string;
  requestBodyPreview?: string;
  pythonSnippet?: string;
  optimizedPromptEn?: string; // 🎯 [New] 存储优化后的英文提示词
  optimizedPromptZh?: string; // 🎯 [New] 存储优化后的中文解释
  // 🎯 [New] 完整的提示词优化结果对象
  promptOptimizerResult?: PromptOptimizerResult;
  partialRedraw?: PartialRedrawMetadata;
  redraw?: RedrawMetadata;
  ecommerceDeliveryKind?: EcommerceSlotDeliveryKind;

  // 🎯 [Layering] Z-index for rendering order
  zIndex?: number;
  presentation?: CanvasCardPresentation;
}

export type Provider =
  | 'Google'
  | 'OpenAI'
  | 'Anthropic'
  | 'Volcengine' // 火山引擎
  | 'Aliyun'     // 阿里云
  | 'Tencent'    // 腾讯云
  | 'SiliconFlow'// 硅基流动
  | '12AI'        // 12AI 专属
  | 'Flow2API'    // Flow2API 自托管媒体网关
  | 'Custom'      // 自定义
  | 'SystemProxy'; // 系统代理（积分模型）

export interface PromptOptimizerResult {
  raw_prompt_original: string;
  optimized_prompt_en: string;
  optimized_prompt_zh_display: string;
  negative_constraints?: string[];
  assumptions?: string[];
  validation_checks?: string[];
  missing_inputs?: string[];
  confidence?: 'low' | 'medium' | 'high';
  params: {
    task_type: 'icon_set' | 'ecommerce_hero' | 'lifestyle_photo' | 'infographic' | 'logo' | 'ui' | 'other';
    subject: string;
    style?: string;
    composition?: string;
    lighting?: string;
    background?: string;
    materials?: string[];
    color_palette?: string[];
    aspect_ratio?: string;
  };
  ui_payload: {
    tabs: { id: string; label_zh: string; label_en: string }[];
    default_tab: string;
  };
  meta: {
    version: string;
    timestamp: string;
    optimization_mode?: 'auto' | 'manual';
    engine?: 'local-rulebook' | 'ai-enhanced';
    ai_status?: 'skipped' | 'enhanced' | 'failed-fallback';
    route_id?: string;
    route_title?: string;
    template_id?: string;
    template_title?: string;
    strategy?: 'reasoning-native' | 'structure-first';
    validation_status?: 'ready' | 'needs-review';
  };
}

export type PptEditableLayerType = 'image' | 'text';

export type PptEditableLayerRole =
  | 'background'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'caption'
  | 'custom';

export interface PptEditableLayerBase {
  id: string;
  name: string;
  type: PptEditableLayerType;
  role: PptEditableLayerRole;
  visible: boolean;
  locked?: boolean;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
}

export interface PptEditableImageLayer extends PptEditableLayerBase {
  type: 'image';
  imageNodeId?: string;
  sourceUrl?: string;
}

export interface PptEditableTextLayer extends PptEditableLayerBase {
  type: 'text';
  text: string;
  fontSize: number;
  fontWeight?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  backgroundOpacity?: number;
}

export type PptEditableLayer = PptEditableImageLayer | PptEditableTextLayer;

export interface PptEditablePage {
  id: string;
  pageIndex: number;
  name: string;
  outline: string;
  notes?: string;
  backgroundImageId?: string;
  layers: PptEditableLayer[];
}

export type PptDeckStage =
  | 'outline'
  | 'descriptions'
  | 'generating'
  | 'ready'
  | 'failed'
  | 'exported';

export type PptDeckPageGenerationStatus =
  | 'idle'
  | 'queued'
  | 'generating'
  | 'ready'
  | 'error';

export interface PptDeckPageModule {
  pageIndex: number;
  pageNumber: number;
  title: string;
  outlineText: string;
  pageDescription: string;
  imageId?: string;
  editablePageId?: string;
  thumbnailUrl?: string;
  generationStatus: PptDeckPageGenerationStatus;
  error?: string;
  version: number;
  updatedAt?: number;
  exportStatus?: 'idle' | 'exported';
}

export interface PptDeckModuleState {
  stage: PptDeckStage;
  title: string;
  pageCount: number;
  styleLocked: boolean;
  pages: PptDeckPageModule[];
  lastThumbnailUrl?: string;
  exportStatus: 'idle' | 'ready' | 'exported';
  source: 'derived-legacy' | 'native';
  updatedAt: number;
}

export type CapabilityRole =
  | 'image_generation'
  | 'ppt_generation'
  | 'ecommerce_generation'
  | 'assistant'
  | 'prompt_optimizer'
  | 'ocr_document'
  | 'video_generation';

export interface CapabilityRouteAssignment {
  role: CapabilityRole;
  primaryRouteId?: string;
  primaryModelId?: string;
  fallbackRouteId?: string;
  fallbackModelId?: string;
  auxiliaryRouteId?: string;
  auxiliaryModelId?: string;
  imageRouteId?: string;
  imageModelId?: string;
  imageFallbackRouteId?: string;
  imageFallbackModelId?: string;
  enabled: boolean;
  updatedAt: number;
}

export interface OcrServiceSettings {
  provider: 'nutrient' | 'baidu';
  enabled: boolean;
  defaultLanguage: string;
  keySource: 'environment' | 'missing' | 'user';
  healthState: 'configured' | 'missing_key' | 'unknown';
  updatedAt: number;
  baiduApiKey?: string;
  baiduSecretKey?: string;
}

export type TaskProviderType = 'generic' | 'midjourney';

export interface PromptPendingSyncRequest {
  requestId: string;
  index: number;
  prompt: string;
  startedAt: number;
  keySlotId?: string;
}

export interface PromptCompletedTask {
  taskId: string;
  resultUrls: string[];
  resultStorageIds?: Record<string, string>;
  completedAt: number;
  provider?: string;
  providerLabel?: string;
  model?: string;
  modelLabel?: string;
  keySlotId?: string;
  runtimeStrategyId?: string;
  taskProviderType?: TaskProviderType;
  cost?: number;
  costSource?: 'snapshot' | 'explicit' | 'stored' | 'estimated' | 'none';
  tokens?: number;
  execTime?: number;
}

export interface PromptGenerationMetadata {
  attemptStartedAt?: number;
  pendingTaskIds?: string[];
  pendingSyncRequests?: PromptPendingSyncRequest[];
  completedTasks?: PromptCompletedTask[];
  [key: string]: unknown;
}

export type EcommercePromptKind = 'framework' | 'main-image' | 'a-plus-group' | 'a-plus-module';

export type EcommerceSizePolicy = 'main-default' | 'sheet-native' | 'desktop-then-mobile';

export type EcommerceAPlusSizeTier = '1464x600' | '970x600' | '600x450' | 'unknown';

export type EcommerceSlotDeliveryKind = 'default' | 'desktop' | 'mobile';

export type EcommerceFrameworkQueueStatus = 'queued' | 'dispatching' | 'running' | 'completed' | 'failed' | 'paused';

export type EcommerceFrameworkQueuePhase = 'sheet' | 'desktop' | 'mobile';

export type EcommerceFrameworkQueueLaneType = 'local' | 'remote';

export interface EcommerceFrameworkSchedulerConfig {
  maxLocalConcurrency: number;
  maxRemoteConcurrency: number;
  maxConcurrentGenerations?: number;
}

export interface EcommerceFrameworkQueueItem {
  queueId: string;
  frameworkId: string;
  nodeId: string;
  phase: EcommerceFrameworkQueuePhase;
  laneKey: string;
  laneType: EcommerceFrameworkQueueLaneType;
  sourceSheet: EcommerceGroupSheet;
  status: EcommerceFrameworkQueueStatus;
  enqueuedAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  pausedReason?: 'editing' | 'manual';
  revision?: number;
}

export interface EcommerceFrameworkQueueCounts {
  queued: number;
  dispatching: number;
  running: number;
  completed: number;
  failed: number;
  paused: number;
  total: number;
}

export interface EcommerceFrameworkRuntimeState {
  frameworkId: string;
  activeSheet: EcommerceGroupSheet;
  paused: boolean;
  config: EcommerceFrameworkSchedulerConfig;
  queue: EcommerceFrameworkQueueItem[];
  lastUpdatedAt: number;
}

export interface EcommerceFrameworkMeta {
  activeSheet: EcommerceGroupSheet;
  groupIds?: Partial<Record<EcommerceGroupSheet, string>>;
  taskNodeIds?: string[];
  schedulerConfig?: EcommerceFrameworkSchedulerConfig;
}

export type EcommercePromptStage =
  | 'analysis_pending'
  | 'analysis_ready'
  | 'ready'
  | 'generating'
  | 'generated'
  | 'failed';

export type EcommerceModuleStage =
  | 'not_applicable'
  | 'locked'
  | 'pending'
  | 'generating'
  | 'generated'
  | 'confirmed'
  | 'failed';

export interface EcommerceImageRef {
  id: string;
  storageId?: string;
  label: string;
  mimeType?: string;
  url?: string;
}

export interface EcommerceReferenceBinding {
  assetId: string;
  label: string;
  mentionTokens?: string[];
  notes?: string;
}

export type EcommerceAssetRole =
  | 'product'
  | 'reference'
  | 'extra-reference'
  | 'series-template'
  | 'accessory';

export interface EcommerceTaskAssetRoleBinding {
  assetId: string;
  role: EcommerceAssetRole;
  label: string;
  normalizedLabel: string;
  aliasLabel?: string;
  anchorId?: string;
  token?: string;
  roleLabel?: string;
  source: 'upload' | 'analysis' | 'history';
  note?: string;
  mentionTokens?: string[];
}

export interface EcommerceReferenceAnchor {
  anchorId: string;
  token: string;
  roleLabel: string;
  assetId: string;
  label: string;
  source: EcommerceTaskAssetRoleBinding['source'];
  assetRole: EcommerceAssetRole;
  previewUrl?: string;
  note?: string;
}

export interface EcommercePromptAssistState {
  optimized: boolean;
  source?: 'manual' | 'regenerate-feedback' | 'local-rulebook';
  updatedAt?: number;
  error?: string;
}

export interface EcommerceSeriesTemplateStyleProfile {
  tone: string;
  primaryColors: string[];
  backgroundStyle: string;
  effectStyle: string;
  shadowStyle: string;
  atmosphere: string;
}

export interface EcommerceSeriesTemplateLayoutProfile {
  productPosition: string;
  textPosition: string;
  highlightPosition: string;
  accessoryPosition: string;
  whitespaceStyle: string;
  productScalePreset: 'small' | 'balanced' | 'large';
}

export interface EcommerceSeriesTemplateCopyProfile {
  languageStyle: string;
  headlineStyle: string;
  subheadlineStyle: string;
  highlightStyle: string;
  tone: string;
  preferredLanguage: 'zh' | 'en' | 'mixed';
}

export interface EcommerceSeriesTemplateFontProfile {
  fontStyle: string;
  headlineWeight: number;
  subheadlineWeight: number;
  highlightWeight: number;
  headlineScale: number;
  subheadlineScale: number;
  highlightScale: number;
  textColorPrimary: string;
  textColorSecondary: string;
}

export interface EcommerceSeriesTemplateConstraints {
  mustKeepConsistency: boolean;
  forbiddenElements: string[];
  mustKeepProductRealistic: boolean;
  allowedOverrides: string[];
}

export interface EcommerceSeriesTemplate {
  templateId: string;
  templateLabel: string;
  inheritByDefault: boolean;
  styleProfile: EcommerceSeriesTemplateStyleProfile;
  layoutProfile: EcommerceSeriesTemplateLayoutProfile;
  copyProfile: EcommerceSeriesTemplateCopyProfile;
  fontProfile: EcommerceSeriesTemplateFontProfile;
  constraints: EcommerceSeriesTemplateConstraints;
}

export interface EcommerceCopyTaskState {
  headline: string;
  subheadline: string;
  highlight: string;
  featureTags: string[];
  cta: string;
}

export interface EcommerceStyleTaskState {
  tone: string;
  atmosphere: string;
  effect: string;
  backgroundType: string;
}

export interface EcommerceLayoutTaskState {
  productSize: 'small' | 'balanced' | 'large';
  textPosition: string;
  accessoryPolicy: string;
}

export interface EcommerceInheritTaskState {
  keepSeriesStyle: boolean;
  keepFontStyle: boolean;
  keepLayoutStyle: boolean;
  keepCopyStyle: boolean;
  keepPalette: boolean;
}

export interface EcommerceSparseIntentPatch {
  copy?: Partial<EcommerceCopyTaskState>;
  style?: Partial<EcommerceStyleTaskState> & {
    effectEnabled?: boolean;
  };
  layout?: Partial<EcommerceLayoutTaskState>;
  inherit?: Partial<EcommerceInheritTaskState>;
  font?: {
    headlineScaleDelta?: number;
  };
  outputTypeLabel?: string;
}

export interface EcommerceEditableTaskState {
  taskId: string;
  templateId?: string;
  sourceKind: Exclude<EcommercePromptKind, 'a-plus-group' | 'framework'>;
  sourceSheet: EcommerceGroupSheet;
  sourceRowKey: string;
  theme: string;
  outputTypeLabel: string;
  declaredSizeText?: string;
  sizeTier?: EcommerceAPlusSizeTier;
  effectiveSizePolicy?: EcommerceSizePolicy;
  effectiveSizeTier?: EcommerceAPlusSizeTier;
  sizeControlOverride?: EcommerceAPlusControlMode | null;
  imageRoleSummary: string[];
  sparseUserIntent: string;
  copy: EcommerceCopyTaskState;
  style: EcommerceStyleTaskState;
  layout: EcommerceLayoutTaskState;
  inherit: EcommerceInheritTaskState;
  assetRoles: EcommerceTaskAssetRoleBinding[];
  referenceAnchors?: EcommerceReferenceAnchor[];
  styleAnchorTokens?: string[];
  promptAssistState?: EcommercePromptAssistState;
  consistencyChecks: string[];
  missingFields: string[];
  resolvedSparseIntent?: EcommerceSparseIntentPatch;
  resolvedPromptPreview: string;
  displayLabel: string;
  lastRenderPrompt?: string;
  promptOverride?: string;
  revision?: number;
}

export interface EcommercePromptState {
  kind: EcommercePromptKind;
  sourceSheet: EcommerceGroupSheet;
  sourceRowKey: string;
  groupId?: string;
  frameworkId?: string;
  parentNodeId?: string;
  selectedForGeneration?: boolean;
  productImageRef?: EcommerceImageRef;
  referenceBindings?: EcommerceReferenceBinding[];
  copyText?: string;
  designRequirements?: string;
  theme?: string;
  sizePolicy?: EcommerceSizePolicy;
  sizeTier?: EcommerceAPlusSizeTier;
  effectiveSizePolicy?: EcommerceSizePolicy;
  effectiveSizeTier?: EcommerceAPlusSizeTier;
  aPlusControlMode?: EcommerceAPlusControlMode;
  sizeControlOverride?: EcommerceAPlusControlMode | null;
  allowedAspectRatios?: AspectRatio[];
  currentAspectRatio?: AspectRatio;
  activeDeliveryKind?: EcommerceSlotDeliveryKind;
  stage?: EcommercePromptStage;
  desktopStage?: 'not_applicable' | 'pending' | 'generating' | 'generated' | 'confirmed' | 'failed';
  mobileStage?: 'not_applicable' | 'locked' | 'pending' | 'generating' | 'generated' | 'failed';
  declaredSizeText?: string;
  desktopAspectRatio?: AspectRatio;
  mobileAspectRatio?: AspectRatio;
  needsReview?: boolean;
  reviewWarnings?: string[];
  seriesTemplate?: EcommerceSeriesTemplate;
  editableTask?: EcommerceEditableTaskState;
  displayLabel?: string;
  frameworkMeta?: {
    activeSheet: EcommerceGroupSheet;
    groupIds?: Partial<Record<EcommerceGroupSheet, string>>;
    taskNodeIds?: string[];
    inputSummary?: string[];
    schedulerConfig?: EcommerceFrameworkSchedulerConfig;
  };
}

export interface PromptNode {
  id: string;
  telemetry?: GenerationTelemetry;
  prompt: string;
  originalPrompt?: string;
  optimizedPromptEn?: string;
  optimizedPromptZh?: string;
  promptOptimizerResult?: PromptOptimizerResult; // 🎯 [New] 完整的提示词优化结果
  promptOptimizationEnabled?: boolean;
  promptOptimizerArchetype?: string;
  thinkingMode?: 'minimal' | 'high';
  enableGrounding?: boolean;
  enableImageSearch?: boolean;
  position: { x: number; y: number };
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  model: ModelType;
  modelLabel?: string; // 🎯 模型显示名称（用户选择时看到的名字）
  provider?: string; // 🎯 生成信道 provider（内部标识）
  providerLabel?: string; // 🎯 生成信道显示名称（例如“反代”）
  modelColorStart?: string;
  modelColorEnd?: string;
  modelColorSecondary?: string;
  modelTextColor?: 'white' | 'black';
  keySlotId?: string;
  childImageIds: string[];
  lastGenerationSuccessCount?: number;
  lastGenerationFailCount?: number;
  lastGenerationTotalCount?: number;
  referenceImages?: ReferenceImage[];
  timestamp: number;
  sourceImageId?: string;
  partialRedraw?: PartialRedrawMetadata;
  redraw?: RedrawMetadata;
  isGenerating?: boolean;
  parallelCount?: number; // Number of images being generated
  error?: string;
  errorDetails?: {
    code?: string;
    status?: number;
    requestPath?: string;
    requestBody?: string;
    responseBody?: string;
    provider?: string;
    model?: string;
    timestamp?: number;
  };
  // 🎯 [添加] 积分退款状态，用于显示“生成失败，积分已退回”
  refundStatus?: 'pending' | 'success' | 'failed';
  creditSettlement?: 'client' | 'server';
  executionLane?: 'local-user-api' | 'cloud-credit-model';
  billingAttemptId?: string;
  creditRouteSpecId?: string;
  creditRouteUnitId?: string;
  paymentTransactionId?: string;
  balanceAfter?: number;
  execTime?: number;

  mode?: GenerationMode; // New
  width?: number; // Dynamic width for layout calculation
  height?: number; // Dynamic height for connection line anchoring
  tags?: string[]; // Search tags
  isDraft?: boolean; // Preview/Draft state
  draftMode?: GenerationMode;
  slotRole?: 'standalone-prompt' | 'result-slot';
  capabilityTags?: GenerationMode[];
  hiddenInCanvas?: boolean; // Keep runtime-owned helper nodes off the infinite canvas surface
  orphaned?: boolean; // 孤立主卡（由 pending 卡转换而来）
  userMoved?: boolean; // 🎯 [New] 是否被用户手动移动过（用于智能归位逻辑）

  // Video specific
  videoResolution?: string;
  videoDuration?: string;
  videoFirstFrameUrl?: string; // Optional image to use as start frame
  videoLastFrameUrl?: string;  // Optional image to use as end frame
  videoAudio?: boolean; // Whether to generate audio for the video

  // Audio specific
  audioDuration?: string; // e.g. '120s' or 'auto'
  audioLyrics?: string;     // custom lyrics for music generation
  pptSlides?: string[];
  pptEditablePages?: PptEditablePage[];
  pptDeck?: PptDeckModuleState;
  pptStyleLocked?: boolean;

  // 🎯 Image Editing specific properties
  maskUrl?: string;

  // Analytics
  cost?: number; // Estimated or actual cost
  billingMode?: 'credits' | 'currency';
  creditCost?: number;
  isPaymentProcessed?: boolean; // 🎯 [New] 是否已成功执行扣费，用于失败退款判断

  // 🎯 [Persistence Management]
  jobId?: string; // 任务 ID（用于异步轮询和刷新状态）
  isNew?: boolean; // 🎯 [New] 是否为新生成的节点（用于触发飞出动画）
  generationMetadata?: PromptGenerationMetadata; // 生成上下文元数据
  ecommerce?: EcommercePromptState;

  // 🎯 [Layering] Z-index for rendering order
  zIndex?: number;
  presentation?: CanvasCardPresentation;
}

export interface CanvasGroup {
  id: string;
  nodeIds: string[]; // IDs of PromptNodes or ImageNodes
  bounds: { x: number; y: number; width: number; height: number };
  // 🎯 [Layering] Z-index for rendering order
  zIndex?: number;
  label?: string;
  color?: string; // Group glow color
  hidden?: boolean;
  collapsed?: boolean;
  type: 'custom';
}

export interface CanvasDrawing {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  type: 'pen' | 'marker' | 'rect' | 'circle' | 'line' | 'arrow' | 'text';
  fillColor?: string;
  text?: string;
  fontSize?: number;
  bindingNodeId?: string;
  bindingGroupId?: string;
}

export type CanvasNoteNode = CanvasNoteNodeDto;

export interface AgentWorkflowData {
  title?: string;
  instruction?: string;
  notes?: string;
  mode?: 'prompt-assist' | 'organize' | 'archive';
  sourceNodeIds?: string[];
  outputNodeIds?: string[];
  actionLabel?: string;
  [key: string]: unknown;
}

export interface PreviewWorkflowData {
  title?: string;
  sourceNodeIds?: string[];
  summary?: string;
  actionLabel?: string;
  [key: string]: unknown;
}

export interface SaveWorkflowData {
  title?: string;
  destination?: 'local' | 'project' | 'export';
  format?: 'zip' | 'pptx' | 'project' | string;
  sourceNodeIds?: string[];
  actionLabel?: string;
  [key: string]: unknown;
}

export interface VideoInputWorkflowData {
  sourceUrl?: string;
  assetId?: string;
  thumbnailUrl?: string;
  [key: string]: unknown;
}

export interface VideoAnalyzeWorkflowData {
  sourceNodeId?: string;
  analysisType?: 'summary' | 'shots' | 'objects' | 'motion';
  [key: string]: unknown;
}

export interface StoryboardWorkflowData {
  sourceNodeId?: string;
  frameCount?: number;
  style?: string;
  [key: string]: unknown;
}

export interface WorkflowPanelStep {
  id: string;
  label: string;
  enabled: boolean;
  parameters: Record<string, string | number | boolean>;
  status?: 'idle' | 'running' | 'completed' | 'failed';
  error?: string;
}

export interface WorkflowPanelData {
  title: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  steps: WorkflowPanelStep[];
  outputNodeIds: string[];
  error?: string;
}

export type PromptWorkflowNode = import('./workflow/types').WorkflowNodeBase<
  'prompt',
  PromptNode
>;
export type ImageWorkflowNode = import('./workflow/types').WorkflowNodeBase<
  'image',
  GeneratedImage
>;
export type AgentWorkflowNode = import('./workflow/types').WorkflowNodeBase<
  'agent',
  AgentWorkflowData
>;
export type PreviewWorkflowNode = import('./workflow/types').WorkflowNodeBase<
  'preview',
  PreviewWorkflowData
>;
export type SaveWorkflowNode = import('./workflow/types').WorkflowNodeBase<
  'save',
  SaveWorkflowData
>;
export type VideoInputWorkflowNode = import('./workflow/types').WorkflowNodeBase<
  'video-input',
  VideoInputWorkflowData
>;
export type VideoAnalyzeWorkflowNode = import('./workflow/types').WorkflowNodeBase<
  'video-analyze',
  VideoAnalyzeWorkflowData
>;
export type StoryboardWorkflowNode = import('./workflow/types').WorkflowNodeBase<
  'storyboard',
  StoryboardWorkflowData
>;
export type WorkflowPanelNode = import('./workflow/types').WorkflowNodeBase<
  'workflow-panel',
  WorkflowPanelData
>;

export type WorkflowNode =
  | PromptWorkflowNode
  | ImageWorkflowNode
  | AgentWorkflowNode
  | PreviewWorkflowNode
  | SaveWorkflowNode
  | VideoInputWorkflowNode
  | VideoAnalyzeWorkflowNode
  | StoryboardWorkflowNode
  | WorkflowPanelNode;

export type CanvasWorkflow = import('./workflow/types').WorkflowGraph<WorkflowNode>;

export interface Canvas {
  id: string;
  name: string;
  folderName?: string;
  promptNodes: PromptNode[];
  imageNodes: GeneratedImage[];
  groups: CanvasGroup[];
  drawings: CanvasDrawing[];
  connections?: CanvasConnection[];
  noteNodes?: CanvasNoteNode[];
  workflow?: CanvasWorkflow;
  presentationVersion?: number;
  lastModified: number;
}

/**
 * 视频分辨率与支持时长的映射
 * 根据官方文档: https://ai.google.dev/gemini-api/docs/video?hl=zh-cn
 * - 720p: 支持 4s, 6s, 8s
 * - 1080p: 仅支持 8s
 * - 4k: 仅支持 8s
 */
export const VIDEO_RESOLUTION_DURATION_MAP = {
  '720p': ['4s', '6s', '8s'],
  '1080p': ['8s'],
  '4k': ['8s']
} as const;

export interface GenerationConfig {
  prompt: string;
  enablePromptOptimization?: boolean;
  promptOptimizerArchetype?: string;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  referenceImages: ReferenceImage[];
  contextReferences?: ContextReferenceDto[];
  parallelCount: number;
  model: ModelType;
  enableGrounding: boolean;
  enableImageSearch?: boolean;
  thinkingMode?: 'minimal' | 'high';
  mode: GenerationMode;
  // 视频配置字段
  videoResolution?: string; // '720p' | '1080p' | '4k'
  videoDuration?: string;   // 根据分辨率动态支持：720p 支持 4s/6s/8s，1080p 和 4k 仅支持 8s
  videoAudio?: boolean;     // 生成音频
  videoReferenceMode?: VideoReferenceMode;
  // 图像编辑扩展
  maskUrl?: string;         // Base64 蒙版图片 (Inpaint)
  editMode?: 'inpaint' | 'outpaint' | 'vectorize' | 'reframe' | 'upscale' | 'replace-background' | 'edit';
  // 音频扩展
  audioDuration?: string;
  audioLyrics?: string;
  pptSlides?: string[];
  pptStyleLocked?: boolean;
}

export interface ToolWindowInstance {
  instanceId: string;
  toolId: string;
  url?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  zIndex: number;
  title?: string;
}
