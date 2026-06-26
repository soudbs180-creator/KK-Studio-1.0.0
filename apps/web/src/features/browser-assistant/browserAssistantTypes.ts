// 简体中文：浏览器助手核心类型定义
export type AuthMode = 'public' | 'user-browser-session' | 'official-oauth' | 'api-key' | 'manual';
export type ExecutionMode = 'local-browser' | 'cloud-api' | 'local-runner' | 'disabled';
export type ActionType = 'search' | 'read' | 'extract' | 'download' | 'upload' | 'generate-text' | 'generate-image' | 'generate-video' | 'publish' | 'delete';
export type QuotaSource = 'none' | 'user-membership' | 'user-api-key' | 'platform-credit';
export type RiskLevel = 'low' | 'medium' | 'high';
export type OutputTarget = 'canvas' | 'asset' | 'markdown' | 'ppt-outline' | 'generation-task';

export interface SiteCapability {
  siteId: string;
  name: string;
  domains: string[];
  authMode: AuthMode;
  executionMode: ExecutionMode;
  actions: ActionType[];
  quotaSource: QuotaSource;
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
}

export interface BrowserSiteAdapter {
  siteId: string;
  canHandle(urlOrTask: string): boolean;
  inspect?(ctx: any): Promise<any>;
  search?(ctx: any): Promise<any>;
  extract?(ctx: any): Promise<any>;
  generate?(ctx: any): Promise<any>;
  download?(ctx: any): Promise<any>;
  importToCanvas?(result: any): Promise<any>;
}

export interface BrowserTaskIntent {
  taskId: string;
  userText: string;
  targetSite: string;
  targetUrl?: string;
  actionType: ActionType;
  requiresLogin: boolean;
  usesMembership: boolean;
  outputTarget: OutputTarget;
}

export interface BrowserTaskResult {
  status: 'success' | 'failed' | 'cancelled' | 'pending';
  siteId: string;
  actionType: ActionType;
  extractedText?: string;
  extractedImages?: string[];
  screenshotUrl?: string;
  networkData?: Record<string, any>;
  generatedAssets?: string[];
  canvasCards?: string[];
  auditLogId?: string;
  error?: string;
}
