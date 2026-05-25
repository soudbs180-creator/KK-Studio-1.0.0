// packages/api-client/src/hooks.ts
// 职责：将底层类型化的 API 函数包装为适用于 React 架构的 React Query 钩子

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  generateImage,
  getBillingPlans,
  createCheckout,
  getUserMe,
  updateUserMe,
  chat,
  getGenerations,
  GenerateImagePayload,
  UpdateUserPayload,
  ChatPayload,
} from './api';

/**
 * 1. 图像生成 / 编辑 hook
 */
export function useGenerateImage() {
  return useMutation({
    mutationFn: (payload: GenerateImagePayload) => generateImage(payload),
    onError: (err) => {
      console.error('[useGenerateImage] 图像生成或编辑失败:', err);
    },
  });
}

/**
 * 2. 获取充值方案 hook
 */
export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: () => getBillingPlans(),
  });
}

/**
 * 3. 创建 Stripe Checkout 支付会话 hook
 */
export function useCreateCheckout() {
  return useMutation({
    mutationFn: (planId: string) => createCheckout(planId),
    onError: (err) => {
      console.error('[useCreateCheckout] 创建 Stripe 支付会话失败:', err);
    },
  });
}

/**
 * 4. 获取当前登录用户信息 hook
 */
export function useUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: () => getUserMe(),
  });
}

/**
 * 5. 更新当前登录用户信息 hook
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateUserPayload) => updateUserMe(payload),
    onSuccess: () => {
      // 成功更新后失效缓存以刷新用户信息
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (err) => {
      console.error('[useUpdateUser] 更新用户信息失败:', err);
    },
  });
}

/**
 * 6. 智能对话文本生成 hook (OpenAI)
 */
export function useChat() {
  return useMutation({
    mutationFn: (payload: ChatPayload) => chat(payload),
    onError: (err) => {
      console.error('[useChat] 智能对话请求失败:', err);
    },
  });
}

/**
 * 7. 获取生成历史记录 hook
 */
export function useGenerations() {
  return useQuery({
    queryKey: ['generations'],
    queryFn: () => getGenerations(),
  });
}
