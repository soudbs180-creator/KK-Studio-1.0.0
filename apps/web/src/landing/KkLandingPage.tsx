// 简体中文：KK Studio 高端编辑排版营销落地页主框架组件
import React from 'react';
import { ArrowDownRight, ArrowRight } from 'lucide-react';
import { LandingChrome } from './LandingChrome';
import { CanvasPreviewMock } from './CanvasPreviewMock';
import { FeatureNarrative } from './FeatureNarrative';
import { ProcessTimeline } from './ProcessTimeline';
import { LandingCTA } from './LandingCTA';
import { heroBadges, thoughtItems, trustHeadline, useCaseTags } from './landingContent';
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

  const t = <T,>(text: { zh: T; en: T }): T => pickByResolvedLanguage(language, text.zh, text.en);

  const primaryAction = isLoggedIn ? onEnterWorkspace : onLoginClick;

  return (
    <div className="kk-landing-root">
      <div className="kk-landing-noise" aria-hidden />
      <div className="kk-landing-ambient" aria-hidden />

      <LandingChrome
        onLoginClick={onLoginClick}
        isLoggedIn={isLoggedIn}
        onEnterWorkspace={onEnterWorkspace}
      />

      <main>
        <section className="kk-hero" id="top">
          <div className="kk-hero__meta kk-reveal-up">
            <span>{t({ zh: 'KK Studio / Multimodal AI Canvas', en: 'KK Studio / Multimodal AI Canvas' })}</span>
            <span>{t({ zh: 'For visual production teams', en: 'For visual production teams' })}</span>
          </div>

          <div className="kk-hero__grid">
            <div className="kk-hero__copy">
              <div className="kk-hero__badges kk-reveal-up kk-reveal-delay-1">
                {heroBadges.map((badge) => (
                  <span key={badge.en}>{t(badge)}</span>
                ))}
              </div>

              <h1 className="kk-hero__title kk-reveal-title">
                {t({
                  zh: '把 AI 创作\n组织成一张\n无限画布。',
                  en: 'A canvas\nfor AI\nproduction.'
                })}
              </h1>
            </div>

            <aside className="kk-hero__aside kk-reveal-up kk-reveal-delay-2">
              <p>
                {t({
                  zh: '从 Prompt、参考图和模型结果，到电商素材、PPT、视频与 Agent 队列。KK Studio 将零散的 AI 生成，转化为可管理、可复用、可审计的视觉生产系统。',
                  en: 'From prompts, references and model outputs to commerce assets, PPT, video and agent queues. KK Studio turns scattered AI generations into a manageable, reusable and auditable visual production system.'
                })}
              </p>
              <div className="kk-hero__actions">
                <button className="kk-editorial-button kk-editorial-button--dark" onClick={primaryAction}>
                  <span>{t({ zh: '开始创作', en: 'Start creating' })}</span>
                  <ArrowRight size={16} />
                </button>
                <button className="kk-editorial-button kk-editorial-button--ghost" onClick={onLoginClick}>
                  <span>{t({ zh: '配置模型', en: 'Configure models' })}</span>
                  <ArrowDownRight size={16} />
                </button>
              </div>
            </aside>
          </div>

          <div className="kk-hero__preview kk-reveal-up kk-reveal-delay-3">
            <CanvasPreviewMock />
          </div>
        </section>

        <section className="kk-trust-strip" aria-label={t({ zh: '核心场景', en: 'Use cases' })}>
          <div className="kk-trust-strip__heading">
            <span>{t({ zh: 'Our trusted workflows', en: 'Our trusted workflows' })}</span>
            <p>{t(trustHeadline)}</p>
          </div>
          <div className="kk-usecase-marquee" aria-hidden="false">
            <div className="kk-usecase-marquee__track">
              {[...useCaseTags, ...useCaseTags].map((tag, index) => (
                <span className={`kk-usecase-pill kk-usecase-pill--${tag.category}`} key={`${tag.label.en}-${index}`}>
                  {t(tag.label)}
                </span>
              ))}
            </div>
          </div>
        </section>

        <FeatureNarrative />

        <ProcessTimeline />

        <section className="kk-thoughts" id="thoughts">
          <div className="kk-section-kicker">{t({ zh: 'Thoughts', en: 'Thoughts' })}</div>
          <div className="kk-thoughts__header">
            <h2>{t({ zh: '来自画布世界的笔记。', en: 'Notes from the canvas world.' })}</h2>
            <p>
              {t({
                zh: '产品不是更多按钮，而是让复杂创作关系被看见、被复用、被交付。',
                en: 'The product is not more buttons. It is a way to make complex creative relationships visible, reusable and shippable.'
              })}
            </p>
          </div>

          <div className="kk-thoughts__list">
            {thoughtItems.map((item) => (
              <article className="kk-thought-row" key={item.title.en}>
                <div className="kk-thought-row__category">{t(item.category)}</div>
                <div>
                  <h3>{t(item.title)}</h3>
                  <p>{t(item.desc)}</p>
                </div>
                <div className="kk-thought-row__meta">{t(item.meta)}</div>
              </article>
            ))}
          </div>
        </section>

        <LandingCTA
          onPrimaryClick={primaryAction}
          onSecondaryClick={onLoginClick}
        />
      </main>
    </div>
  );
};

export default KkLandingPage;
