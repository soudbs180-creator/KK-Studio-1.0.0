// 简体中文：Landing 专属作品集式产品叙事组件（编辑排版升级版）
import React from 'react';
import { workCards } from './landingContent';
import { useLocale } from '../context/LocaleContext';
import { pickByResolvedLanguage } from '../utils/localeText';

export const FeatureNarrative: React.FC = () => {
  const { language } = useLocale();

  const t = <T,>(text: { zh: T; en: T }): T => pickByResolvedLanguage(language, text.zh, text.en);

  return (
    <section id="work" className="kk-work-section">
      <div className="kk-work-inner">
        <header className="kk-work-header">
          <span className="kk-section-kicker">{t({ zh: 'Work / 系统能力', en: 'Work / System' })}</span>
          <h2>{t({ zh: 'AI 创作的每一步，都应该被看见。', en: 'Every step of AI creation should be visible.' })}</h2>
        </header>

        <div className="kk-work-grid">
          {workCards.map((card) => (
            <article key={card.id} className="kk-work-card" style={{ ['--tone' as any]: card.tone }}>
              <div className="kk-work-card__top">
                <span className="kk-work-card__num">{card.num}</span>
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

              <div className="kk-work-card__accent" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureNarrative;
