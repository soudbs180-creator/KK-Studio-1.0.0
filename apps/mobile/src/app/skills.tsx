// 简体中文：移动端技能扩展与 ToolRegistry 控制中心路由页面 (Skills Screen)

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

interface SkillItem {
  id: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
}

export default function SkillsScreen() {
  const router = useRouter();
  const [skills, setSkills] = useState<SkillItem[]>([
    {
      id: 'skill-brand-vi',
      name: 'Miora 品牌 VI 专家模式',
      category: '视觉设计',
      description: '分析品牌调性，自动提炼色板与 VI 视觉物料',
      enabled: true,
    },
    {
      id: 'skill-ppt',
      name: 'PPT 演示文稿结构化生成',
      category: '工作流自动化',
      description: '生成可编辑图层 OpenXML 格式演示文稿',
      enabled: true,
    },
    {
      id: 'skill-vectorize',
      name: 'SVG 矢量图形转换',
      category: '通用工具',
      description: '自动提取位图边线并转为 SVG 矢量节点',
      enabled: false,
    },
  ]);

  const toggleSkill = (id: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>技能扩展中心 (Skills)</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionHeader}>已接入 Awesome Claude Skills 规范</Text>

        {skills.map((skill) => (
          <View key={skill.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.skillName}>{skill.name}</Text>
                <Text style={styles.skillCategory}>{skill.category}</Text>
              </View>
              <Switch
                value={skill.enabled}
                onValueChange={() => toggleSkill(skill.id)}
                trackColor={{ false: '#334155', true: '#6366F1' }}
                thumbColor="#F8FAFC"
              />
            </View>

            <Text style={styles.skillDesc}>{skill.description}</Text>

            <View style={styles.permTag}>
              <Text style={styles.permText}>🔒 需安全级别: Safe Authorization</Text>
            </View>
          </View>
        ))}
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  skillName: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  skillCategory: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  skillDesc: { color: '#CBD5E1', fontSize: 13, marginBottom: 10, lineHeight: 18 },
  permTag: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  permText: { color: '#64748B', fontSize: 10, fontWeight: '500' },
});
