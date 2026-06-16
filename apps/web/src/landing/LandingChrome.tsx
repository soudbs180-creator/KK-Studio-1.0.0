// 简体中文：Landing 专属极简编辑排版导航组件
import React, { useCallback, useEffect, useState } from 'react';
import { Menu, Sparkles, X } from 'lucide-react';
import { navItems } from './landingContent';
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
  onEnterWorkspace,
}) => {
  const { language } = useLocale();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const t = <T,>(text: { zh: T; en: T }): T => pickByResolvedLanguage(language, text.zh, text.en);

  useEffect(() => {
    let rafId = 0;
    const updateScrollState = () => {
      rafId = 0;
      setIsScrolled(window.scrollY > 18);
    };
    const handleScroll = () => {
      if (rafId === 0) {
        rafId = window.requestAnimationFrame(updateScrollState);
      }
    };

    updateScrollState();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  const handleNavClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault();
    setMobileMenuOpen(false);
    const target = document.querySelector(href);
    if (!target) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  }, []);

  const handlePrimaryAction = () => {
    setMobileMenuOpen(false);
    if (isLoggedIn) {
      onEnterWorkspace();
      return;
    }
    onLoginClick();
  };

  return (
    <nav className={`kk-landing-chrome ${isScrolled ? 'is-scrolled' : ''}`}>
      <div className="kk-landing-chrome__inner">
        <button
          type="button"
          className="kk-landing-logo"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="KK Studio"
        >
          <span className="kk-landing-logo__mark"><Sparkles size={14} /></span>
          <span>KK Studio</span>
        </button>

        <div className="kk-landing-navlinks" aria-label="Landing navigation">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} onClick={(event) => handleNavClick(event, item.href)}>
              {t(item.label)}
            </a>
          ))}
        </div>

        <div className="kk-landing-actions">
          <button 
            type="button" 
            className="kk-landing-start-button" 
            onClick={isLoggedIn ? onEnterWorkspace : onLoginClick}
          >
            {isLoggedIn 
              ? t({ zh: '进入工作区', en: 'Enter workspace' }) 
              : t({ zh: '登录 / 开始创作', en: 'Sign in / Start' })}
          </button>
        </div>

        <button
          type="button"
          className="kk-landing-menu-button"
          onClick={() => setMobileMenuOpen((value) => !value)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="kk-landing-mobile-menu">
          <div className="kk-landing-mobile-menu__links">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} onClick={(event) => handleNavClick(event, item.href)}>
                {t(item.label)}
              </a>
            ))}
          </div>
          <button type="button" className="kk-editorial-button kk-editorial-button--dark" onClick={handlePrimaryAction}>
            {isLoggedIn ? t({ zh: '进入工作台', en: 'Enter workspace' }) : t({ zh: '开始创作', en: 'Start creating' })}
          </button>
        </div>
      )}
    </nav>
  );
};

export default LandingChrome;
