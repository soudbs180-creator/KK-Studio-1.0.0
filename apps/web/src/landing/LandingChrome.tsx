// 简体中文：Landing 专属极简导航组件
import React, { useState, useEffect } from 'react';
import { Sparkles, Menu, X } from 'lucide-react';
import { navItems, type LocaleText } from './landingContent';
import { useLocale } from '../context/LocaleContext';
import { pickByResolvedLanguage } from '../utils/localeText';

interface LandingChromeProps {
  onLoginClick: () => void;
  isLoggedIn: boolean;
  onEnterWorkspace: () => void;
}

export const LandingChrome: React.FC<LandingChromeProps> = ({
  onLoginClick,
  isLoggedIn,
  onEnterWorkspace
}) => {
  const { language } = useLocale();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const t = <T,>(text: { zh: T; en: T }): T => {
    return pickByResolvedLanguage(language, text.zh, text.en);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 pointer-events-auto border-b ${
        isScrolled
          ? 'py-3 bg-white/70 border-b-[#e5e5e5]/80 backdrop-blur-md shadow-sm'
          : 'py-5 bg-transparent border-transparent'
      }`}
      style={{
        WebkitBackdropFilter: isScrolled ? 'blur(16px)' : 'none'
      }}
    >
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="w-8 h-8 rounded-lg bg-[#0a0a0a] text-white flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <span className="font-semibold text-lg tracking-tight text-[#0a0a0a]">KK Studio</span>
        </div>

        {/* Center: Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              className="text-sm font-medium text-[#3a3a3a] hover:text-[#0a0a0a] transition-colors"
            >
              {t(item.label)}
            </a>
          ))}
        </div>

        {/* Right: Actions */}
        <div className="hidden md:flex items-center gap-4">
          {isLoggedIn ? (
            <button
              onClick={onEnterWorkspace}
              className="clay-btn clay-btn-primary !h-10 px-5 rounded-lg text-xs"
            >
              {t({ zh: '进入工作台', en: 'Enter Workspace' })}
            </button>
          ) : (
            <>
              <button
                onClick={onLoginClick}
                className="text-sm font-medium text-[#3a3a3a] hover:text-[#0a0a0a] transition-colors"
              >
                {t({ zh: '登录', en: 'Sign In' })}
              </button>
              <button
                onClick={onLoginClick}
                className="clay-btn clay-btn-primary !h-10 px-5 rounded-lg text-xs"
              >
                {t({ zh: '开始创作', en: 'Start Designing' })}
              </button>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-1.5 text-[#3a3a3a] hover:text-[#0a0a0a] transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-[56px] left-0 right-0 bottom-0 bg-white z-40 flex flex-col p-6 animate-fade-in border-t border-t-[#e5e5e5]">
          <div className="flex flex-col gap-5 py-4">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="text-lg font-medium text-[#3a3a3a] py-2 border-b border-b-gray-100"
              >
                {t(item.label)}
              </a>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-3 pb-8">
            {isLoggedIn ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onEnterWorkspace();
                }}
                className="clay-btn clay-btn-primary w-full"
              >
                {t({ zh: '进入工作台', en: 'Enter Workspace' })}
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLoginClick();
                  }}
                  className="clay-btn clay-btn-secondary w-full"
                >
                  {t({ zh: '登录账号', en: 'Sign In' })}
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLoginClick();
                  }}
                  className="clay-btn clay-btn-primary w-full"
                >
                  {t({ zh: '开始免费使用', en: 'Start Free' })}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
export default LandingChrome;
