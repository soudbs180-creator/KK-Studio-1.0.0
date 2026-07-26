// 简体中文：Miora 品牌 VI 专家模式六步工作流弹窗组件 (Brand VI Specialist Flow Modal)

import React, { useState } from 'react';
import type { BrandProfile, ColorPalette, TypographyRule, BrandGuideline } from '@kk/shared';
import { KK_LAYER } from '@kk/ui';
import { LayerPortal } from '../../components/layout/LayerPortal';

export interface BrandVIFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveProfile: (profile: Partial<BrandProfile>) => Promise<void>;
  onBatchGenerateToCanvas: (prompts: string[]) => void;
}

export const BrandVIFlowModal: React.FC<BrandVIFlowModalProps> = ({
  isOpen,
  onClose,
  onSaveProfile,
  onBatchGenerateToCanvas,
}) => {
  const [step, setStep] = useState<number>(1);
  const [brandName, setBrandName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [industry, setIndustry] = useState('科技 / 软件');
  const [targetAudience, setTargetAudience] = useState('青年专业人士 / 创作者');
  
  const [primaryColor, setPrimaryColor] = useState('#6366F1');
  const [secondaryColor, setSecondaryColor] = useState('#10B981');
  const [accentColor, setAccentColor] = useState('#F59E0B');

  const [primaryFont, setPrimaryFont] = useState('Inter');
  const [headingFont, setHeadingFont] = useState('Outfit');

  const [voiceTone, setVoiceTone] = useState<string>('专业、前沿、有温度');
  const [prohibitedRules, setProhibitedRules] = useState<string>('避免过时的复古杂乱线条、避免过于幼稚的配色');

  if (!isOpen) return null;

  const handleNext = () => {
    if (step < 6) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
    const palette: ColorPalette = {
      primary: primaryColor,
      secondary: secondaryColor,
      accent: accentColor,
      background: '#0F172A',
    };

    const typography: TypographyRule = {
      primaryFont,
      headingFont,
    };

    const guidelines: BrandGuideline = {
      voiceAndTone: voiceTone.split('、'),
      designKeywords: [industry, 'Modern', 'Minimalist'],
      prohibitedElements: prohibitedRules.split('、'),
    };

    await onSaveProfile({
      brandName,
      slogan,
      industry,
      targetAudience,
      palette,
      typography,
      guidelines,
    });

    // 自动生成 6 个品牌物料的批量 Prompt 交付给无限画布
    const generatedPrompts = [
      `[Logo Design] Minimalist vector logo for brand "${brandName}", ${slogan ? `slogan: "${slogan}", ` : ''}modern tech style, primary color ${primaryColor}, clean geometric vector asset`,
      `[Brand Color Palette] Professional brand identity palette showcase card for "${brandName}", featuring colors ${primaryColor}, ${secondaryColor}, ${accentColor}, flat UI presentation`,
      `[VI Guideline] Typography and visual identity specification poster for "${brandName}", fonts ${headingFont} & ${primaryFont}, elegant layout`,
      `[Social Banner] High converting social media marketing banner for "${brandName}", showcasing product key features, vibrant design, 16:9 ratio`,
      `[Product Mockup] Premium minimalist product packaging & device mockup with "${brandName}" branding overlay, photorealistic 8K render`,
      `[Brand Story Visual] Aesthetic hero graphic illustrating "${brandName}" brand essence, futuristic design, key colors ${primaryColor} and ${accentColor}`,
    ];

    onBatchGenerateToCanvas(generatedPrompts);
    onClose();
  };

  // 特权浮层契约：Modal 必须 Portal 到 document.body。画布视口带 transform，
  // 内联渲染会让 fixed inset-0 以视口容器为包含块，遮罩塌缩且被 overflow 裁剪。
  return (
    <LayerPortal zIndex={KK_LAYER.modal}>
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div>
            <h2 className="text-lg font-bold text-indigo-400">Miora 品牌 VI 专家模式</h2>
            <p className="text-xs text-slate-400">步骤 {step} / 6：从品牌定位到全套 VI 物料推流生成</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-base">第一步：品牌基础定位与命名</h3>
              <div>
                <label className="block text-xs text-slate-400 mb-1">品牌名称 *</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="例如：KK Studio / Nova AI"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">品牌 Slogan / 口号</label>
                <input
                  type="text"
                  value={slogan}
                  onChange={(e) => setSlogan(e.target.value)}
                  placeholder="例如：From brief to delivery"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-base">第二步：行业与受众分析</h3>
              <div>
                <label className="block text-xs text-slate-400 mb-1">所属行业</label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">目标受众群体</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-base">第三步：品牌调性与配色选择</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">主品牌色</label>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-full h-10 bg-slate-800 border border-slate-700 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">辅助色</label>
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-full h-10 bg-slate-800 border border-slate-700 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">点缀色</label>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-full h-10 bg-slate-800 border border-slate-700 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-base">第四步：字体与视觉约束</h3>
              <div>
                <label className="block text-xs text-slate-400 mb-1">标题字体 (Heading Font)</label>
                <input
                  type="text"
                  value={headingFont}
                  onChange={(e) => setHeadingFont(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">正文字体 (Body Font)</label>
                <input
                  type="text"
                  value={primaryFont}
                  onChange={(e) => setPrimaryFont(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-base">第五步：AI 品牌负面约束与语调 (Memory Guardrails)</h3>
              <div>
                <label className="block text-xs text-slate-400 mb-1">品牌语调关键字</label>
                <input
                  type="text"
                  value={voiceTone}
                  onChange={(e) => setVoiceTone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">禁用元素与风格边界 (Prohibited Rules)</label>
                <textarea
                  value={prohibitedRules}
                  onChange={(e) => setProhibitedRules(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-base text-indigo-400">第六步：一键推送生成全套 VI 物料</h3>
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs">
                <p className="font-medium text-slate-200">即将在无限画布批量生成以下 6 项 VI 节点：</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>[Logo] 品牌核心 Logo 矢量风格稿</li>
                  <li>[Color] 标准品牌色彩与阶梯色板卡片</li>
                  <li>[Typography] 字体排版与 VI 规范海报</li>
                  <li>[Banner] 社交媒体高转化长图 Banner</li>
                  <li>[Mockup] 高精产品包装与设备 Mockup</li>
                  <li>[Story] 品牌叙事与 Hero 图形物料</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-between bg-slate-950/50">
          <button
            onClick={handlePrev}
            disabled={step === 1}
            className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg transition-colors"
          >
            上一步
          </button>

          {step < 6 ? (
            <button
              onClick={handleNext}
              disabled={step === 1 && !brandName.trim()}
              className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg transition-colors"
            >
              下一步
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-5 py-2 text-xs font-medium bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-400 hover:to-emerald-400 text-white rounded-lg shadow-lg transition-all"
            >
              立即生成并存入品牌记忆
            </button>
          )}
        </div>
      </div>
    </div>
    </LayerPortal>
  );
};
