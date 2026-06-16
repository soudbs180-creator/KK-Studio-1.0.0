// 简体中文：Landing 专属作品集式产品叙事组件（水平可拖动卡片升级版）
import React, { useRef, useState } from 'react';
import { workCards } from './landingContent';
import { useLocale } from '../context/LocaleContext';
import { pickByResolvedLanguage } from '../utils/localeText';

export const FeatureNarrative: React.FC = () => {
  const { language } = useLocale();

  const t = <T,>(text: { zh: T; en: T }): T => pickByResolvedLanguage(language, text.zh, text.en);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const [dragMoved, setDragMoved] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setDragMoved(false);
    startX.current = e.pageX - containerRef.current.offsetLeft;
    scrollLeft.current = containerRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
    if (dragMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    if (Math.abs(x - startX.current) > 5) {
      setDragMoved(true);
    }
    containerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  return (
    <section id="work" className="kk-work-section">
      <div className="kk-work-inner">
        <header className="kk-work-header">
          <span className="kk-section-kicker">{t({ zh: 'Work / 系统能力', en: 'Work / System' })}</span>
          <h2>{t({ zh: 'AI 创作的每一步，都应该被看见。', en: 'Every step of AI creation should be visible.' })}</h2>
        </header>

        {/* 可水平滑动/拖拽的产品卡片展示轨道 */}
        <div
          ref={containerRef}
          className={`kk-work-scroll-container ${isDragging ? 'is-dragging' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <div className="kk-work-track">
            {workCards.map((card) => (
              <article key={card.id} className="kk-work-card" style={{ ['--tone' as any]: card.tone }}>
                {/* 3D 渐变模糊光圈的抽象视觉模块，创造 WOW 级效果 */}
                <div className="kk-work-card__visual">
                  <div className={`kk-work-card__art kk-work-card__art--${card.tone}`}>
                    <div className="art-orb-1" />
                    <div className="art-orb-2" />
                    <div className="art-glass">
                      <span className="art-num">{card.num}</span>
                    </div>
                  </div>
                </div>

                <div className="kk-work-card__content">
                  <div className="kk-work-card__top">
                    <span className="kk-work-card__eyebrow">{t(card.eyebrow)}</span>
                  </div>

                  <h3 className="kk-work-card__title">
                    {t(card.title)}
                  </h3>

                  <p className="kk-work-card__desc">
                    {t(card.desc)}
                  </p>

                  <div className="kk-work-card__tags">
                    {card.tags.map((tag) => (
                      <span key={t(tag)} className="kk-work-tag">
                        {t(tag)}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeatureNarrative;

