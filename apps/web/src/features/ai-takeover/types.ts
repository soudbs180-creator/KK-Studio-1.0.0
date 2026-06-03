// 简体中文：定义 AI 接管的核心业务类型

import type { AspectRatio, ImageSize, GenerationMode } from '../../types';

// 意图枚举
export type AssistantIntent =
  | 'help'                         // 帮助/问答
  | 'optimize_prompt'              // 优化提示词（绝不自动生成图片）
  | 'write_prompt'                 // 写提示词
  | 'generate_images'              // 开始生图
  | 'batch_generate_from_folder'   // 文件夹批量生图
  | 'download_outputs'             // 打包下载结果
  | 'search_card'                  // 查找/定位卡片
  | 'explain_error'                // 排查报错
  | 'configure_api'                // 引导 API 配置
  | 'upload_assets'                // 上传资源
  | 'optimize_input_prompt'        // 优化输入框提示词
  | 'submit_composer'              // 帮我发送/运行生成
  | 'create_card'                  // 帮我建卡
  | 'change_generation_mode'       // 切换生成模式
  | 'complex_sequence'             // 连续复合多步任务（如生图再生成视频）
  | 'unknown';

// 意图分析结果
export interface IntentResult {
  intent: AssistantIntent;
  confidence: number;              // 置信度 (0-1)
  extracted: {
    count?: number;                // 图片张数
    subjects?: string[];           // 主体列表
    style?: string;                // 画风/风格要求或模式
    folderId?: string;             // 文件夹 ID
    fileIds?: string[];            // 关联的文件 ID 列表
    cardQuery?: string;            // 查找卡片的关键字
    downloadScope?: string;        // 下载范围
  };
  risk: 'none' | 'low' | 'cost' | 'upload' | 'destructive';
  needsConfirmation: boolean;      // 是否需要强确认卡片
  reason: string;                  // 解析理由说明
}

// 可被接管动作类型
export type AssistantAction =
  | { type: 'sendMessage'; payload: { text: string } }
  | { type: 'optimizePromptLocally'; payload: { subject: string; templateId?: string; style?: string } }
  | { type: 'fillPrompt'; payload: { prompt: string; negativePrompt?: string; modelId?: string } }
  | { type: 'startGeneration'; payload: { prompt: string; count: number; options?: any } }
  | { type: 'startBatchGeneration'; payload: { plan: BatchGenerationPlan } }
  | { type: 'locateCard'; payload: { keyword: string } }
  | { type: 'highlightElement'; payload: { selector: string } }
  | { type: 'openSettings'; payload: { tab: string } }
  | { type: 'zipOutputs'; payload: { scope: 'latest_batch' | 'current_batch' | 'selected_cards' | 'all_canvas_outputs' | 'asset_collection_outputs' } }
  | { type: 'explainError'; payload: { errorCode?: string; errorMessage?: string } }
  | { type: 'fillInputPrompt'; payload: { prompt: string } }
  | { type: 'changeMode'; payload: { mode: GenerationMode } }
  | { type: 'submitPromptComposer'; payload: {} };

// 执行计划
export interface AssistantPlan {
  id: string;
  reply: string;                   // 机器人的普通文本回答
  intent: AssistantIntent;
  confidence: number;
  actions: AssistantAction[];
  requiresConfirmation: boolean;   // 是否需要用户确认
  confirmation?: {
    title: string;
    summary: string;
    confirmText: string;
    cancelText: string;
  };
}

// 积分消耗估计策略
export interface CostPolicy {
  requiresCredits: boolean;
  estimatedCredits?: number;
}

// 批量文件夹生成计划
export interface BatchGenerationPlan {
  id: string;
  sourceCollectionId: string;
  imageIds: string[];
  promptStrategy: {
    mode: 'single_template' | 'per_image_filename' | 'per_image_ai';
    templateId?: string;
    rawUserStyle: string;
    basePrompt: string;
    negativePrompt?: string;
  };
  output: {
    countPerImage: number;
    expectedTotal: number;
  };
  referencePolicy: {
    useEachImageAsReference: boolean;
    uploadOnlyWhenGenerating: boolean;
  };
  costPolicy: CostPolicy;
  confirmationRequired: boolean;
}

// 资源种类
export type AssetKind = 'image' | 'file' | 'output';

// 资源上传状态
export type AssetUploadState =
  | 'linked'                       // 已建立连接，未上传内容
  | 'local_ready'                  // 本地读取就绪
  | 'indexed'                      // 已索引
  | 'uploaded'                     // 已上传到服务器/云存储
  | 'used'                         // 正在被使用中
  | 'failed'                       // 失败
  | 'blocked_sensitive';           // 命中敏感词被物理隔离拦截

// 图像资源
export interface ImageAsset {
  id: string;
  kind: 'image';
  name: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  relativePath?: string;
  collectionId?: string;
  thumbnailUrl?: string;
  localFile?: File;                // HTML5 本地文件对象
  storageId?: string;
  uploadState: AssetUploadState;
}

// 附件文件资源
export interface FileAsset {
  id: string;
  kind: 'file';
  name: string;
  mimeType: string;
  size: number;
  relativePath?: string;
  localFile?: File;
  uploadState: AssetUploadState;
  sensitive: boolean;
  sensitiveReason?: string;
  uploadedUrl?: string;
  extractedTextId?: string;
}

// 输出结果图片资源
export interface OutputAsset {
  id: string;
  kind: 'output';
  name: string;
  sourceCardId: string;            // 对应的来源卡片 ID
  sourceBatchId?: string;          // 对应的批量生成 ID
  url: string;
  createdAt: number;
}

// 资源上下文概览（发送给大模型的脱敏元数据摘要，大模型默认不能直接拿 base64 或文件内容）
export interface AssetContextSummary {
  imageCollections: Array<{ id: string; name: string; imageCount: number }>;
  images: Array<{
    id: string;
    name: string;
    width?: number;
    height?: number;
    collectionId?: string;
    uploadState: AssetUploadState;
  }>;
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    uploadState: AssetUploadState;
    sensitive: boolean;
  }>;
  outputs: Array<{
    id: string;
    name: string;
    sourceCardId: string;
    sourceBatchId?: string;
  }>;
}

// 提示词库模板
export interface PromptTemplate {
  id: string;
  name: string;
  category: 'portrait' | 'product' | 'anime' | 'realistic' | 'scene' | 'logo' | 'character' | 'ecommerce' | 'mecha' | 'cyberpunk';
  triggerWords: string[];
  tags: string[];
  toolTypes: Array<'image-generation' | 'image-edit' | 'batch-generation'>;
  basePrompt: string;
  negativePrompt?: string;
  variables: Array<{ key: string; required: boolean; defaultValue?: string }>;
  styleBoosters: string[];
  qualityBoosters: string[];
  compositionBoosters: string[];
  modelHints?: string[];
}

// 脱敏项目上下文
export interface SanitizedProjectContext {
  currentPage: 'canvas' | 'settings' | 'agent' | 'unknown';
  aiTakeover: { enabled: boolean; mode: 'local' | 'api' };
  agent: { enabled: boolean };
  canvas: {
    id?: string;
    name?: string;
    selectedNodeIds: string[];
    promptNodes: Array<{
      id: string;
      prompt: string;
      optimizedPromptEn?: string;
      optimizedPromptZh?: string;
      status: 'idle' | 'generating' | 'failed' | 'done';
      hasReferenceImages: boolean;
      childImageCount: number;
      tags?: string[];
      error?: string;
    }>;
    imageNodes: Array<{
      id: string;
      name?: string;
      parentPromptId?: string;
      tags?: string[];
      hasOriginalUrl: boolean;
    }>;
  };
  assets: AssetContextSummary;
  settings: {
    apiKeyStatus: 'missing' | 'configured_masked' | 'invalid' | 'unknown';
    providerCount: number;
    selectedModel?: string;
  };
  billing: {
    balanceKnown: boolean;
    canEstimateCost: boolean;
  };
  errors: Array<{
    code: string;
    message: string;
    source: string;
    relatedNodeId?: string;
  }>;
  promptBarInput?: {
    prompt: string;
    referenceImagesCount: number;
    mode: string;
    ecommerceSettings?: {
      platform?: string;
      targetMarket?: string;
      batchCount?: number;
      productName?: string;
      theme?: string;
      activeGroupSheet?: string;
      requirementFileName?: string;
      productFilesCount?: number;
    };
  };
}

export type ToolPermission =
  | 'safe'
  | 'confirm'
  | 'dangerous'
  | 'forbidden';

export interface AssetCollection {
  id: string;
  name: string;
  kind: 'image_folder' | 'file_folder' | 'mixed';
  source: 'file_input' | 'directory_picker' | 'dropzone';
  assetIds: string[];
  createdAt: number;
}

