// packages/api-client/src/api.ts
// 职责：定义与导出全部类型化的 API 请求函数，供桌面端前端、移动端以及 hooks 调用

import { apiClient } from './client';

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
 * 4. 调用 Gemini 进行图像生成 / 编辑
 */
export async function generateImage(payload: GenerateImagePayload): Promise<GenerateImageResponse> {
  const isEdit = !!payload.referenceImageBase64;
  const path = isEdit ? '/generate/edit' : '/generate/image';
  const { data } = await apiClient.post<GenerateImageResponse>(path, payload);
  return data;
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
export async function getUserMe(): Promise<UserMeResponse> {
  const { data } = await apiClient.get<UserMeResponse>('/user/me');
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
