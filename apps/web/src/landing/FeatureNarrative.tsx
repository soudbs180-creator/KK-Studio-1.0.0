// 简体中文：Landing 专属作品集式产品叙事组件
import React from 'react';
import { featureCards } from './landingContent';
import { useLocale } from '../context/LocaleContext';
import { pickByResolvedLanguage } from '../utils/localeText';

export const FeatureNarrative: React.FC = () => {
  const { language } = useLocale();

  const t = <T,>(text: { zh: T; en: T }): T => {
    return pickByResolvedLanguage(language, text.zh, text.en);
  };

  return (
    <section id="narrative" className="py-24 md:py-32 bg-[#0b0b0c] text-white overflow-hidden relative z-10">
      {/* 极简背景氛围圆圈 */}
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] rounded-full bg-rose-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-0 w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-[140px] pointer-events-none" />

      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        {/* Header */}
        <div className="max-w-3xl mb-16 md:mb-24">
          <span className="text-xs uppercase tracking-widest text-white/50 border border-white/10 px-3 py-1 rounded-full bg-white/5 inline-block mb-4">
            {t({ zh: '系统架构 / Features', en: 'System Capabilities' })}
          </span>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-medium tracking-tight leading-[1.05] text-white">
            {t({
              zh: '一张无限画布，容纳 AI 创作的所有阶段。',
              en: 'One canvas. Every stage of AI production.'
            })}
          </h2>
        </div>

        {/* Feature Grid - 非对称宽幅网格排版 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10">
          {featureCards.map((feat, index) => {
            // 对每张卡片进行非对称列宽分配，实现高级留白美学
            // Card 0, 3 (1 & 4) 占用 7 列，Card 1, 2 (2 & 3) 占用 5 列，交叉排列
            const colSpanClass = index === 0 || index === 3
              ? 'md:col-span-7'
              : 'md:col-span-5';

            return (
              <div
                key={feat.id}
                className={`${colSpanClass} group relative rounded-3xl border border-white/10 bg-white/[0.02] p-8 md:p-12 flex flex-col justify-between min-h-[360px] md:min-h-[420px] hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300 pointer-events-auto`}
              >
                {/* Accent Color Strip */}
                <div
                  className="absolute top-0 left-0 w-full h-[3px] rounded-t-3xl transition-opacity duration-300 opacity-60 group-hover:opacity-100"
                  style={{ backgroundColor: feat.color }}
                />

                {/* Top Info */}
                <div className="flex items-start justify-between">
                  <span className="text-xs tracking-wider uppercase opacity-40 font-mono">
                    {feat.num}
                  </span>
                  <span
                    className="text-[10px] font-medium tracking-widest uppercase px-2.5 py-1 rounded-md border border-white/5"
                    style={{ color: feat.color, backgroundColor: `${feat.color}08` }}
                  >
                    {t(feat.badge)}
                  </span>
                </div>

                {/* Bottom Content */}
                <div className="mt-16 md:mt-24">
                  <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-white/95 mb-4 group-hover:translate-x-1 transition-transform duration-300">
                    {t(feat.title)}
                  </h3>
                  <p className="text-sm text-white/60 leading-relaxed font-light">
                    {t(feat.desc)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
export default FeatureNarrative;
