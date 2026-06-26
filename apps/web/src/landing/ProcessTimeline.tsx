// 简体中文：Landing 专属交互式步骤时间线组件
import React, { useState, useEffect, useRef } from 'react';
import { processSteps } from './landingContent';
import { useLocale } from '../context/LocaleContext';
import { pickByResolvedLanguage } from '../utils/localeText';

export const ProcessTimeline: React.FC = () => {
  const { language } = useLocale();
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  const t = <T,>(text: { zh: T; en: T }): T => {
    return pickByResolvedLanguage(language, text.zh, text.en);
  };

  useEffect(() => {
    // 监听每个步骤卡片是否滚动进入了视口中央，从而触发高亮
    const observerOptions = {
      root: null,
      rootMargin: '-30% 0px -30% 0px', // 在视口偏中部位触发
      threshold: 0.2
    };

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = stepRefs.current.findIndex(ref => ref === entry.target);
          if (index !== -1) {
            setActiveIndex(index);
          }
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);

    stepRefs.current.forEach(step => {
      if (step) observer.observe(step);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <section id="process" className="py-24 md:py-32 bg-[#fffaf0] relative z-10 border-t border-b border-[#e5e5e5]/50">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          
          {/* Left Sticky Panel */}
          <div className="lg:col-span-5 lg:sticky lg:top-[120px] lg:h-[fit-content]">
            <span className="text-xs uppercase tracking-widest text-[#6a6a6a] border border-[#e5e5e5] px-3 py-1 rounded-full bg-white shadow-sm inline-block mb-4">
              {t({ zh: '创作流向 / Process', en: 'Core Workflow' })}
            </span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight leading-[1.02] text-[#0a0a0a] mb-6">
              {t({
                zh: '从单次生成，升级为创作系统。',
                en: 'From prompt to production system'
              })}
            </h2>
            <p className="text-sm md:text-base text-[#3a3a3a] leading-relaxed max-w-md">
              {t({
                zh: 'KK Studio 整合了 AI 创作的完整业务闭环。我们打破点对点的零散对话，将其升华为系统化的流水线生产流。',
                en: 'We structure the chaotic AI interactions into a clean, deterministic pipeline that scales as your workload expands.'
              })}
            </p>

            {/* Current Active Indicator Line */}
            <div className="hidden lg:flex flex-col gap-3 mt-12 pl-1.5 border-l border-[#e5e5e5] relative">
              {processSteps.map((step, idx) => (
                <div
                  key={step.num}
                  className={`text-xs font-semibold font-mono pl-3 transition-colors duration-300 ${
                    idx === activeIndex ? 'text-[#0a0a0a]' : 'text-gray-300'
                  }`}
                >
                  {step.num}
                </div>
              ))}
              {/* Dynamic Line Cursor */}
              <div 
                className="absolute left-0 w-[2px] bg-[#0a0a0a] transition-all duration-300 ease-out"
                style={{
                  height: '16px',
                  top: `${activeIndex * 28 + 4}px`
                }}
              />
            </div>
          </div>

          {/* Right Steps Timeline */}
          <div ref={containerRef} className="lg:col-span-7 flex flex-col gap-16 md:gap-24">
            {processSteps.map((step, index) => (
              <div
                key={step.num}
                ref={el => { stepRefs.current[index] = el; }}
                className={`process-step-item pointer-events-auto border-l-2 pl-6 md:pl-10 pb-2 ${
                  index === activeIndex 
                    ? 'is-active border-l-[#0a0a0a]' 
                    : 'border-l-[#e5e5e5]/60'
                }`}
              >
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-sm font-semibold font-mono text-[#6a6a6a]">
                    {step.num}
                  </span>
                  <h3 className="text-xl md:text-2xl font-medium tracking-tight text-[#0a0a0a]">
                    {t(step.title)}
                  </h3>
                </div>
                <p className="text-sm md:text-base text-[#3a3a3a] leading-relaxed font-light max-w-xl">
                  {t(step.desc)}
                </p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};
export default ProcessTimeline;
