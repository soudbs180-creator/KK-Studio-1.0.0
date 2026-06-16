// 简体中文：KK Studio 高端极简营销落地页主框架组件
import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { LandingChrome } from './LandingChrome';
import { CanvasPreviewMock } from './CanvasPreviewMock';
import { FeatureNarrative } from './FeatureNarrative';
import { ProcessTimeline } from './ProcessTimeline';
import { LandingCTA } from './LandingCTA';
import { heroBadges, useCaseTags } from './landingContent';
import { useLocale } from '../context/LocaleContext';
import { pickByResolvedLanguage } from '../utils/localeText';
import './landingStyles.css';

interface KkLandingPageProps {
  onLoginClick: () => void;
  isLoggedIn: boolean;
  onEnterWorkspace: () => void;
}

export const KkLandingPage: React.FC<KkLandingPageProps> = ({
  onLoginClick,
  isLoggedIn,
  onEnterWorkspace
}) => {
  const { language } = useLocale();

  const t = <T,>(text: { zh: T; en: T }): T => {
    return pickByResolvedLanguage(language, text.zh, text.en);
  };

  // 辅助色彩映射，为标签墙赋予不同的 Clay Accent 气质
  const categoryColorMap = {
    ecommerce: '#ff6b5a', // Coral
    workflow: '#ff4d8b',  // Pink
    model: '#b8a4ed',     // Lavender
    agent: '#a4d4c5',     // Teal
    media: '#ffb084'      // Peach
  };

  return (
    <div className="kk-landing-root relative w-full overflow-hidden">
      {/* 噪点覆盖层 */}
      <div className="kk-landing-noise" aria-hidden />

      {/* 极简氛围渐变背景 */}
      <div className="kk-landing-gradients" aria-hidden />

      {/* 极简高定导航栏 */}
      <LandingChrome
        onLoginClick={onLoginClick}
        isLoggedIn={isLoggedIn}
        onEnterWorkspace={onEnterWorkspace}
      />

      {/* Hero 首屏 */}
      <header className="relative pt-32 pb-16 md:pt-44 md:pb-24 z-10 max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="max-w-5xl text-left">
          
          {/* Small Feature Badges */}
          <div className="flex flex-wrap gap-2.5 mb-8">
            {heroBadges.map((badge, idx) => (
              <span
                key={idx}
                className="text-[10px] md:text-xs font-semibold tracking-wider uppercase bg-white border border-[#e5e5e5] px-3.5 py-1.5 rounded-full text-[#3a3a3a] shadow-3xs"
              >
                {t(badge)}
              </span>
            ))}
          </div>

          {/* Large editorial title */}
          <h1 className="kk-landing-display-title text-4xl md:text-7xl lg:text-8xl mb-8 leading-[0.98]">
            {t({
              zh: '把灵感、素材与模型，\n编排成一张无限画布。',
              en: 'Your AI production canvas for images, prompts, and agents.'
            })}
          </h1>

          {/* Subtitle */}
          <p className="text-sm md:text-xl text-[#3a3a3a] max-w-3xl leading-relaxed mb-10 font-light">
            {t({
              zh: '在一个无限画布中组织 Prompt、参考图、模型结果与商业任务流。从单张灵感图，到批量电商素材、PPT、视频与自动化 Agent，KK Studio 让 AI 创作变成可管理、可复用、可审计的生产系统。',
              en: 'Organize prompt templates, images, models, and agents in one zoomable workspace. From initial concepts to batch ecommerce assets, PPT templates, and autonomous agents, KK Studio elevates AI creation into a manageable, auditable operating system.'
            })}
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={isLoggedIn ? onEnterWorkspace : onLoginClick}
              className="clay-btn clay-btn-primary w-full sm:w-auto flex items-center gap-2"
            >
              {t({ zh: '立即开启智能创作', en: 'Start Creating' })}
              <ArrowRight size={16} />
            </button>
            <button
              onClick={onLoginClick}
              className="clay-btn clay-btn-secondary w-full sm:w-auto"
            >
              {t({ zh: '配置自有模型密钥', en: 'Configure APIs' })}
            </button>
          </div>

        </div>
      </header>

      {/* Canvas Preview Mock section */}
      <section id="canvas-preview" className="relative z-10 max-w-[1440px] mx-auto px-6 md:px-12 pb-24">
        <CanvasPreviewMock />
      </section>

      {/* Use Cases Tag Wall (Marquee) */}
      <section className="py-12 bg-white/40 border-t border-b border-[#e5e5e5]/40 backdrop-blur-2xs z-10 relative">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 mb-6">
          <span className="text-[10px] md:text-xs font-semibold tracking-widest text-[#6a6a6a] uppercase">
            {t({ zh: '赋能核心场景 / USE CASES', en: 'BUILT FOR CREATORS' })}
          </span>
        </div>
        
        {/* Double Marquee content for seamless loop */}
        <div className="marquee-container">
          <div className="marquee-content py-2">
            {[...useCaseTags, ...useCaseTags].map((tag, idx) => {
              const borderAccentColor = categoryColorMap[tag.category] || '#e5e5e5';
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white border text-xs font-medium text-[#3a3a3a] shadow-3xs cursor-default transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:text-[#0a0a0a]"
                  style={{ borderColor: borderAccentColor }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: borderAccentColor }} />
                  {t(tag.label)}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature Narrative Section (Dark theme) */}
      <FeatureNarrative />

      {/* Process Timeline Section */}
      <ProcessTimeline />

      {/* CTA & Footer Section */}
      <LandingCTA
        onPrimaryClick={isLoggedIn ? onEnterWorkspace : onLoginClick}
        onSecondaryClick={onLoginClick}
      />
    </div>
  );
};
export default KkLandingPage;
