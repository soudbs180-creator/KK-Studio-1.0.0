// packages/api-client/src/api.ts
// 职责：定义与导出全部类型化的 API 请求函数，供桌面端前端、移动端以及 hooks 调用

import { apiClient } from './client.js';
export type GenerationProviderId =
  | 'google'
  | 'gpt-best'
  | '12ai'
  | 'suxi'
  | 'wuyinkeji'
  | 'newapi'
  | 'acedata'
  | 'custom';

export type GenerationSurface =
  | 'chat-image'
  | 'provider-images'
  | 'gemini-native-image'
  | 'async-image';

export type StandardGenerationStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed';

export type StandardGenerationErrorCode =
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'INVALID_INPUT'
  | 'MODEL_UNAVAILABLE'
  | 'PROVIDER_ROUTE_MISMATCH'
  | 'PROVIDER_RESPONSE_INVALID'
  | 'EMPTY_RESULT'
  | 'TIMEOUT'
  | 'BILLING_PRECHARGE_FAILED'
  | 'BILLING_REFUND_FAILED'
  | 'UNKNOWN_PROVIDER_ERROR';

export interface StandardImageGenerationInput {
  requestId: string;
  providerId: GenerationProviderId;
  modelId: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  size?: string;
  imageCount?: number;
  referenceImages?: Array<string | { data: string; mimeType: string }>;
  executionLane: 'local-user-api' | 'cloud-credit-model';
}

export interface StandardGenerationError {
  code: StandardGenerationErrorCode;
  message: string;
  retryable: boolean;
  providerId: GenerationProviderId;
  surface?: GenerationSurface;
  status?: number;
  raw?: unknown;
}

export interface StandardImageGenerationResult {
  requestId: string;
  providerId: GenerationProviderId;
  surface: GenerationSurface;
  modelId: string;
  status: StandardGenerationStatus;
  urls: string[];
  taskId?: string;
  providerTaskId?: string;
  usage?: {
    totalTokens?: number;
    cost?: number;
  };
  billing?: {
    deducted?: boolean;
    ledgerId?: string;
    balanceAfter?: number;
    refundApplied?: boolean;
  };
  error?: StandardGenerationError;
  raw?: unknown;
}

// 定义相关的载荷与响应类型定义
export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: {
    id: string;
    email: string;
    credits: number;
  };
}

export interface GenerateImagePayload {
  prompt: string;
  referenceImageBase64?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16';
  creditSettlement?: 'server' | 'client';
  executionLane?: 'local-user-api' | 'cloud-credit-model';
}

export interface GenerateImageResponse {
  image: string; // 生成或编辑后的图像 base64 字符串
  text?: string;  // 模型可能返回的文字描述
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatPayload {
  messages: ChatMessage[];
  creditSettlement?: 'server' | 'client';
  executionLane?: 'local-user-api' | 'cloud-credit-model';
}

export interface ChatResponse {
  role: 'assistant';
  content: string;
}

export interface UserMeResponse {
  id: string;
  email: string;
  credits: number;
  created_at: string;
  adminLevel?: number;
}


export interface UpdateUserPayload {
  email?: string;
  password?: string;
}

export interface BillingPlan {
  id: string;
  name: string;
  amount: string; // 浮点字符串格式，如 "9.99"
  credits: number;
}

export interface BillingPlansResponse {
  plans: BillingPlan[];
}

export interface CreateCheckoutResponse {
  url: string;
  stripeSessionId: string;
}

export interface GenerationRecord {
  id: string;
  user_id: string;
  prompt: string;
  image_url: string;
  created_at: string;
}

export interface GenerationsResponse {
  generations: GenerationRecord[];
}

/**
 * 1. 登录用户
 */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
  return data;
}

/**
 * 2. 注册新用户
 */
export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', payload);
  return data;
}

/**
 * 3. 刷新 JWT Token
 */
export async function refresh(): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/refresh');
  return data;
}

/**
 * 兼容过渡：将旧版图像响应转化为标准响应
 */
export function normalizeLegacyGenerateImageResponse(
  legacy: GenerateImageResponse,
  requestId: string,
  modelId: string,
  providerId: string
): StandardImageGenerationResult {
  return {
    requestId,
    providerId: providerId as any,
    surface: 'provider-images',
    modelId,
    status: 'success',
    urls: [legacy.image],
    raw: legacy,
  };
}

/**
 * 4. 调用 Gemini 进行图像生成 / 编辑
 * @deprecated Use createImageGeneration() instead.
 */
export async function generateImage(payload: GenerateImagePayload): Promise<StandardImageGenerationResult> {
  const isEdit = !!payload.referenceImageBase64;
  const path = isEdit ? '/generate/edit' : '/generate/image';
  const { data } = await apiClient.post<GenerateImageResponse>(path, payload);
  return normalizeLegacyGenerateImageResponse(
    data,
    `legacy-${Date.now()}`,
    isEdit ? 'gemini-2.5-flash-image-edit' : 'gemini-2.5-flash-image',
    'google'
  );
}

/**
 * 5. 调用 OpenAI 进行智能文本对话
 */
export async function chat(payload: ChatPayload): Promise<ChatResponse> {
  const { data } = await apiClient.post<ChatResponse>('/chat', payload);
  return data;
}

/**
 * 6. 获取当前用户信息
 */
export async function getUserMe(token?: string): Promise<UserMeResponse> {
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
  const { data } = await apiClient.get<UserMeResponse>('/user/me', config);
  return data;
}

/**
 * 7. 更新当前用户信息 (密码/邮箱)
 */
export async function updateUserMe(payload: UpdateUserPayload): Promise<UserMeResponse> {
  const { data } = await apiClient.patch<UserMeResponse>('/user/me', payload);
  return data;
}

/**
 * 8. 获取可信的服务端充值套餐方案列表
 */
export async function getBillingPlans(): Promise<BillingPlansResponse> {
  const { data } = await apiClient.get<BillingPlansResponse>('/billing/plans');
  return data;
}

/**
 * 9. 创建 Stripe 支付 Checkout 会话
 */
export async function createCheckout(planId: string): Promise<CreateCheckoutResponse> {
  const { data } = await apiClient.post<CreateCheckoutResponse>('/billing/create-checkout', { planId });
  return data;
}

/**
 * 10. 获取用户的图像生成历史记录
 */
export async function getGenerations(): Promise<GenerationsResponse> {
  const { data } = await apiClient.get<GenerationsResponse>('/generations');
  return data;
}

/**
 * 11. 管理员：获取用户列表
 */
export async function adminGetUsers(params: { page?: number; limit?: number; search?: string }, token?: string): Promise<any> {
  const { data } = await apiClient.get('/admin/users', { params });
  return data;
}

/**
 * 12. 管理员：充值积分
 */
export async function adminRechargeUser(userId: string, amount: number, note: string, token?: string): Promise<any> {
  const { data } = await apiClient.post(`/admin/users/${userId}/recharge`, { amount, note });
  return data;
}

/**
 * 13. 管理员：调整积分
 */
export async function adminAdjustCredits(userId: string, delta: number, note: string, token?: string): Promise<any> {
  const { data } = await apiClient.patch(`/admin/users/${userId}/credits`, { delta, note });
  return data;
}

/**
 * 14. 管理员：获取 API 配置列表
 */
export async function adminGetApiConfig(token?: string): Promise<any> {
  const { data } = await apiClient.get('/admin/api-config');
  return data;
}

/**
 * 15. 管理员：修改定价
 */
export async function adminUpdateApiConfig(operationKey: string, cost: number, token?: string): Promise<any> {
  const { data } = await apiClient.patch('/admin/api-config', { operation_key: operationKey, cost });
  return data;
}

/**
 * 16. 管理员：设置/取消管理员级别
 */
export async function adminSetAdminLevel(userId: string, adminLevel: number, token?: string): Promise<any> {
  const { data } = await apiClient.patch(`/admin/users/${userId}/admin-level`, { admin_level: adminLevel });
  return data;
}

/**
 * 17. 标准图像生成统一入口
 */
export async function createImageGeneration(
  payload: StandardImageGenerationInput
): Promise<StandardImageGenerationResult> {
  const { data } = await apiClient.post<StandardImageGenerationResult>('/generate-image', payload);
  return data;
}
