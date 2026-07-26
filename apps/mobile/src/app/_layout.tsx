// apps/mobile/src/app/_layout.tsx
// 职责：移动端 App 的全局布局路由入口，初始化鉴权、数据查询与手势根容器。
//
// 注意：本目录下同时存在 _layout.jsx。Expo/Metro 的默认 sourceExts 把 ts/tsx 排在 js/jsx 之前，
// 因此实际生效的是本文件。此前本文件只是一个 8 行的 <Slot /> 空壳，导致应用真实运行时
// 丢失了 QueryClientProvider、useAuth 初始化、GestureHandlerRootView、启动屏控制，
// 以及四条业务路由的标题注册 —— 那些内容都写在不生效的 _layout.jsx 里。
// 现将真实布局收敛到本文件；_layout.jsx 已不再生效，可择机移除。

import { useAuth } from '@/utils/auth/useAuth';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 分钟
      // react-query v5 已将 cacheTime 更名为 gcTime；沿用旧名会被静默忽略，
      // 导致这里配置的 30 分钟回收时间不生效而回落到默认值。
      gcTime: 1000 * 60 * 30, // 30 分钟
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const { initiate, isReady } = useAuth();

  useEffect(() => {
    initiate();
  }, [initiate]);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
          <Stack.Screen name="index" />
          <Stack.Screen name="brand-vi" options={{ title: '品牌 VI 专家模式' }} />
          <Stack.Screen name="skills" options={{ title: '技能中心' }} />
          <Stack.Screen name="canvas" options={{ title: '画布同步视图' }} />
          <Stack.Screen name="settings" options={{ title: '设置与节点' }} />
        </Stack>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
