// 简体中文：移动端设置与 Provider 节点管理路由页面 (Settings Screen)

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MOBILE_APP_DISPLAY_VERSION } from '../config/appInfo';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>设置与 Provider 节点</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>服务版本与事实源</Text>
          <Text style={styles.infoText}>KK Studio 移动端 {MOBILE_APP_DISPLAY_VERSION}</Text>
          <Text style={styles.infoText}>环境: Production (VPS Synchronized)</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>大模型代理与网关 (CLIProxyAPI)</Text>
          <Text style={styles.statusOk}>🟢 Google Gemini 1.5 Pro: 已连接</Text>
          <Text style={styles.statusOk}>🟢 OpenAI GPT-4o: 已连接</Text>
          <Text style={styles.statusOk}>🟢 Grok-Build MPC Engine: 已就绪</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { marginRight: 12, minHeight: 44, justifyContent: 'center' },
  backText: { color: '#6366F1', fontSize: 14, fontWeight: '600' },
  title: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  content: { padding: 16 },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  infoText: { color: '#94A3B8', fontSize: 13, marginBottom: 4 },
  statusOk: { color: '#10B981', fontSize: 13, marginBottom: 6, fontWeight: '500' },
});
