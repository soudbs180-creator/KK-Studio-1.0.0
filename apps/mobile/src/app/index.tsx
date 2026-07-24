// 简体中文：KK Studio 移动端主页工作台 (Mobile Workspace Home Screen)

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>KK</Text>
        </View>
        <View>
          <Text style={styles.appTitle}>KK Studio Mobile</Text>
          <Text style={styles.appSubtitle}>v1.6.0 AI 创作控制台</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>全新核心业务功能</Text>

        {/* Action 1: Brand VI */}
        <TouchableOpacity
          onPress={() => router.push('/brand-vi')}
          style={[styles.navCard, { borderColor: 'rgba(99, 102, 241, 0.4)' }]}
        >
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>✨</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.navTitle}>Miora 品牌 VI 专家模式</Text>
            <Text style={styles.navDesc}>六步品牌调性识别与全套 VI 视觉物料生成</Text>
          </View>
          <Text style={styles.arrowText}>→</Text>
        </TouchableOpacity>

        {/* Action 2: Canvas Sync */}
        <TouchableOpacity
          onPress={() => router.push('/canvas')}
          style={[styles.navCard, { borderColor: 'rgba(16, 185, 129, 0.4)' }]}
        >
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>🖼️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.navTitle}>无限画布同步视图</Text>
            <Text style={styles.navDesc}>卡片节点实时同步，去背/4K放大/SVG转换</Text>
          </View>
          <Text style={styles.arrowText}>→</Text>
        </TouchableOpacity>

        {/* Action 3: Skills Center */}
        <TouchableOpacity
          onPress={() => router.push('/skills')}
          style={[styles.navCard, { borderColor: 'rgba(245, 158, 11, 0.4)' }]}
        >
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>🧩</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.navTitle}>技能扩展中心 (Skills)</Text>
            <Text style={styles.navDesc}>Claude Standard Skills 与 Agent 工具挂载</Text>
          </View>
          <Text style={styles.arrowText}>→</Text>
        </TouchableOpacity>

        {/* Action 4: Settings */}
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          style={[styles.navCard, { borderColor: 'rgba(148, 163, 184, 0.3)' }]}
        >
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>⚙️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.navTitle}>设置与 Provider 节点</Text>
            <Text style={styles.navDesc}>检查大模型代理网关与平台状态</Text>
          </View>
          <Text style={styles.arrowText}>→</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  appSubtitle: {
    fontSize: 12,
    color: '#818CF8',
    marginTop: 2,
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconText: {
    fontSize: 20,
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  navDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 3,
  },
  arrowText: {
    fontSize: 18,
    color: '#6366F1',
    fontWeight: '700',
    marginLeft: 8,
  },
});
