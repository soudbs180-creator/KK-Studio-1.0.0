import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// 1. 生成图片 hook
export function useGenerateImage() {
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/.netlify/functions/generate-image', payload);
      return data;
    },
  });
}

// 2. 获取充值方案 hook
export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data } = await apiClient.get('/.netlify/functions/billing/plans');
      return data;
    },
  });
}

// 3. 创建支付会话 mutation
export function useCreateCheckout() {
  return useMutation({
    mutationFn: async (planId: string) => {
      const { data } = await apiClient.post('/.netlify/functions/billing/create-checkout', { planId });
      return data;
    },
  });
}

// 4. 获取当前用户 hook
export function useUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data } = await apiClient.get('/.netlify/functions/user');
      return data;
    },
  });
}

// 5. 更新用户 mutation
export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.patch('/.netlify/functions/user', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}
export { apiClient };
