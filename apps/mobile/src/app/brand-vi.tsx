// 简体中文：移动端 Miora 品牌 VI 专家模式路由页面 (Brand VI Specialist Screen)

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function BrandVIScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [brandName, setBrandName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366F1');
  const [secondaryColor, setSecondaryColor] = useState('#10B981');
  const [isDone, setIsDone] = useState(false);

  const handleFinish = () => {
    setIsDone(true);
    setTimeout(() => {
      router.push('/canvas');
    }, 1200);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Miora 品牌 VI 专家模式</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isDone ? (
          <View style={styles.successBox}>
            <Text style={styles.successIcon}>✨</Text>
            <Text style={styles.successTitle}>品牌 VI 识别已生成！</Text>
            <Text style={styles.successSub}>全套物料已自动推流至无限画布，正在为您跳转...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.stepTitle}>步骤 {step} / 3</Text>

            {step === 1 && (
              <View style={styles.card}>
                <Text style={styles.label}>品牌名称 *</Text>
                <TextInput
                  style={styles.input}
                  value={brandName}
                  onChangeText={setBrandName}
                  placeholder="如：Nova Studio"
                  placeholderTextColor="#64748B"
                />

                <Text style={styles.label}>Slogan / 口号</Text>
                <TextInput
                  style={styles.input}
                  value={slogan}
                  onChangeText={setSlogan}
                  placeholder="如：AI 驱动多模态创作"
                  placeholderTextColor="#64748B"
                />
              </View>
            )}

            {step === 2 && (
              <View style={styles.card}>
                <Text style={styles.label}>主品牌色 (HEX)</Text>
                <TextInput
                  style={styles.input}
                  value={primaryColor}
                  onChangeText={setPrimaryColor}
                  placeholder="#6366F1"
                  placeholderTextColor="#64748B"
                />

                <Text style={styles.label}>辅助调性色 (HEX)</Text>
                <TextInput
                  style={styles.input}
                  value={secondaryColor}
                  onChangeText={setSecondaryColor}
                  placeholder="#10B981"
                  placeholderTextColor="#64748B"
                />
              </View>
            )}

            {step === 3 && (
              <View style={styles.card}>
                <Text style={styles.summaryTitle}>即将在无限画布推流生成：</Text>
                <Text style={styles.bullet}>• [Logo] 品牌核心 Logo 矢量风格稿</Text>
                <Text style={styles.bullet}>• [Color] 调性色板与阶梯色卡</Text>
                <Text style={styles.bullet}>• [Poster] 品牌 VI 规范设计海报</Text>
                <Text style={styles.bullet}>• [Banner] 社交媒体高转化横幅</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Footer Navigation */}
      {!isDone && (
        <View style={styles.footer}>
          <TouchableOpacity
            disabled={step === 1}
            onPress={() => setStep(step - 1)}
            style={[styles.btnSecondary, step === 1 && styles.btnDisabled]}
          >
            <Text style={styles.btnSecondaryText}>上一步</Text>
          </TouchableOpacity>

          {step < 3 ? (
            <TouchableOpacity
              disabled={step === 1 && !brandName.trim()}
              onPress={() => setStep(step + 1)}
              style={[styles.btnPrimary, step === 1 && !brandName.trim() && styles.btnDisabled]}
            >
              <Text style={styles.btnPrimaryText}>下一步</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleFinish} style={styles.btnFinish}>
              <Text style={styles.btnPrimaryText}>生成并推流至画布</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
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
  stepTitle: { color: '#818CF8', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  label: { color: '#94A3B8', fontSize: 12, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  bullet: { color: '#CBD5E1', fontSize: 13, marginBottom: 6 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
  },
  btnSecondary: {
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  btnSecondaryText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  btnPrimary: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  btnFinish: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
  successBox: { alignItems: 'center', paddingVertical: 40 },
  successIcon: { fontSize: 48, marginBottom: 12 },
  successTitle: { color: '#10B981', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  successSub: { color: '#94A3B8', fontSize: 13, textAlign: 'center' },
});
