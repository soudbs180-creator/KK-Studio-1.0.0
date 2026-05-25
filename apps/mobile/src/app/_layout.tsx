// apps/mobile/src/app/_layout.tsx
// 职责：移动端 App 的全局布局路由入口，初始化跨端配置
import React from 'react';
import { Slot } from 'expo-router';

export default function RootLayout() {
  return <Slot />;
}
