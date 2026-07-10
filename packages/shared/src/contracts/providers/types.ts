// packages/shared/src/contracts/providers/types.ts
// 中文注释：供应商注册及适配器核心 TypeScript 类型定义

export type ProviderKind = 'official' | 'relay' | 'byok-reverse-proxy';
export type ApiFormat = 'openai' | 'gemini' | 'anthropic' | 'custom';

export interface ProviderAuth {
  method: 'bearer' | 'header' | 'query_param' | 'custom';
  headerName?: string; // 例如 'Authorization' 或 'x-api-key'
  keyRef: string;      // 例如 'GEMINI_API_KEY', 'VODESHOP_API_KEY'（用 keyRef 描述环境变量名，彻底解耦命名歧义）
}

export interface ProviderGenerationCapabilities {
  imageGeneration: boolean;
  textToVideo: boolean;
  imageToVideo: boolean;
  firstLastFrameVideo: boolean;
  videoExtension: boolean;
  audioGeneration: boolean;
  audioSynchronizedVideo: boolean;
  supportedDurationsSeconds: number[];
  supportedResolutions: string[];
  maxConcurrentImage: number;
  maxConcurrentVideo: number;
  maxConcurrentAudio: number;
}

export interface ProviderItem {
  id: string;              // 唯一供应商 ID
  kind: ProviderKind;
  displayName: string;
  host: string;            // 上游唯一 Host (例如 'api.openai.com')
  apiFormat: ApiFormat;
  auth: ProviderAuth;
  endpoints: {
    base: string;          // 默认基础 URL
    chat?: string;
    image?: string;
    video?: string;
    models?: string;       // 模型发现端点
  };
  pricingSource: {
    sourceType: 'online' | 'local_fallback';
    url?: string;          // 线上目录 URL（若 online）
    fallbackFile?: string; // 本地 fallback json 文件路径（若 local_fallback）
  };
  capabilities: string[];  // 支持的模态类型：'chat' | 'image' | 'video'
  generationCapabilities: ProviderGenerationCapabilities;
}
