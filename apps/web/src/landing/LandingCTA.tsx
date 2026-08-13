// 简体中文：Landing 专属 CTA 与 Footer 组件
import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { ctaCopy } from './landingContent';
import { useLocale } from '../context/LocaleContext';
import { usePlatformRuntime } from '../platform/runtime/usePlatformRuntime';
import { pickByResolvedLanguage } from '../utils/localeText';

interface LandingCTAProps {
  onPrimaryClick: () => void;
  onSecondaryClick: () => void;
}

export const LandingCTA: React.FC<LandingCTAProps> = ({
  onPrimaryClick,
  onSecondaryClick
}) => {
  const { language } = useLocale();
  const displayVersion = usePlatformRuntime().getAppInfo().displayVersion;

  const t = <T,>(text: { zh: T; en: T }): T => {
    return pickByResolvedLanguage(language, text.zh, text.en);
  };

  return (
    <section className="bg-[#fffaf0] relative z-10">
      {/* CTA Section */}
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-24 md:py-36 border-b border-b-[#e5e5e5]/50">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-[#0a0a0a] text-white flex items-center justify-center mb-8 shadow-sm">
            <Sparkles size={24} />
          </div>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-medium tracking-tight leading-[1.02] text-[#0a0a0a] mb-6 max-w-3xl">
            {t(ctaCopy.title)}
          </h2>
          <p className="text-sm md:text-lg text-[#3a3a3a] leading-relaxed max-w-xl mb-10 font-light">
            {t(ctaCopy.subtitle)}
          </p>

        </div>
      </div>

      {/* Footer Section */}
      <footer className="max-w-[1440px] mx-auto px-6 md:px-12 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left: Branding */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#0a0a0a] text-white flex items-center justify-center">
            <Sparkles size={12} />
          </div>
          <span className="font-semibold text-sm tracking-tight text-[#0a0a0a]">KK Studio</span>
        </div>

        {/* Center: Copyright */}
        <div className="text-xs text-[#6a6a6a]">
          &copy; {new Date().getFullYear()} KK Studio. {t({ zh: '保留所有权利。', en: 'All rights reserved.' })}
        </div>

        {/* Right: Version info & platform links */}
        <div className="flex items-center gap-4 text-xs text-[#6a6a6a] font-mono">
          <span className="bg-white px-2.5 py-1 rounded border border-[#e5e5e5] shadow-2xs">
            {displayVersion}
          </span>
        </div>
      </footer>
    </section>
  );
};
export default LandingCTA;
