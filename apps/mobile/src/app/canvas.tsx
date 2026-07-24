// 简体中文：移动端无限画布节点同步与快捷后处理路由页面 (Canvas Screen)

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function CanvasScreen() {
  const router = useRouter();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const mockNodes = [
    { id: 'node-1', type: 'PromptNode', title: '品牌 Logo 概念生成', status: '已完成' },
    { id: 'node-2', type: 'ImageCard', title: '调性色板与 UI 设计规范', status: '已完成' },
    { id: 'node-3', type: 'WorkflowNode', title: 'SVG 矢量线条提取流', status: '生成中' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>无限画布同步视图</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionHeader}>实时同步桌面端 3 个画布卡片</Text>

        {mockNodes.map((node) => {
          const isSelected = selectedNode === node.id;
          return (
            <TouchableOpacity
              key={node.id}
              onPress={() => setSelectedNode(isSelected ? null : node.id)}
              style={[styles.card, isSelected && styles.cardSelected]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.nodeTitle}>{node.title}</Text>
                <Text style={node.status === '已完成' ? styles.statusSuccess : styles.statusPending}>
                  {node.status}
                </Text>
              </View>
              <Text style={styles.nodeType}>类型: {node.type} • ID: {node.id}</Text>

              {/* Toolbar for selected image card */}
              {isSelected && node.type === 'ImageCard' && (
                <View style={styles.toolbar}>
                  <TouchableOpacity style={styles.toolBtn}>
                    <Text style={styles.toolText}>✨ 智能去背</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.toolBtn}>
                    <Text style={styles.toolText}>🔍 4K 放大</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.toolBtn}>
                    <Text style={styles.toolText}>📐 转 SVG</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
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
  sectionHeader: { color: '#818CF8', fontSize: 12, fontWeight: '600', marginBottom: 12 },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardSelected: {
    borderColor: '#6366F1',
    borderWidth: 1.5,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  nodeTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  statusSuccess: { color: '#10B981', fontSize: 12, fontWeight: '600' },
  statusPending: { color: '#F59E0B', fontSize: 12, fontWeight: '600' },
  nodeType: { color: '#94A3B8', fontSize: 11 },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  toolBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  toolText: { color: '#818CF8', fontSize: 12, fontWeight: '600' },
});
