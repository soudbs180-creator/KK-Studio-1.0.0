import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { pickByResolvedLanguage } from '../utils/localeText';
import './landingStyles.css';
import './landingReferenceOverrides.css';

interface KkLandingPageProps {
  onLoginClick: () => void;
  isLoggedIn: boolean;
  onEnterWorkspace: () => void;
}

type LocalizedText = {
  zh: string;
  en: string;
};

const navItems = [
  { label: { zh: '作品', en: 'Work' }, href: '#work' },
  { label: { zh: '方法', en: 'Approach' }, href: '#approach' },
  { label: { zh: 'AI 流程', en: 'AI Flow' }, href: '#ai-flow' },
  { label: { zh: '能力', en: 'Services' }, href: '#services' },
  { label: { zh: '关于', en: 'About' }, href: '#about' },
  { label: { zh: '加入', en: 'Join' }, href: '#join' },
  { label: { zh: '联系', en: 'Contact' }, href: '#contact' },
] as const;

const workItems = [
  {
    index: '01',
    title: { zh: '跟得上意图的无限画布。', en: 'Canvas that keeps up with intent.' },
    type: { zh: '无限画布 / 创作生产', en: 'Infinite canvas / Creation' },
  },
  {
    index: '02',
    title: { zh: '带记忆和控制的批量生产。', en: 'Batch work with memory and control.' },
    type: { zh: '持久队列 / 自动化', en: 'Durable queue / Automation' },
  },
  {
    index: '03',
    title: { zh: '每一步都可见的 AI 接管。', en: 'AI takeover with a visible trail.' },
    type: { zh: 'Agent 运行时 / 验证', en: 'Agent runtime / Verification' },
  },
] as const;

const approachItems = [
  ['01', {
    zh: 'IntentGate 先读懂任务，再允许系统移动画布和资产。',
    en: 'IntentGate reads the job before the system moves the canvas.',
  }],
  ['02', {
    zh: 'Planner 与 ToolRegistry 把用户目标转成可回退的产品动作。',
    en: 'Planner and ToolRegistry turn user goals into reversible product actions.',
  }],
  ['03', {
    zh: 'PermissionPolicy、Executor、Verification 与 Memory 让 AI 接管全程可见。',
    en: 'PermissionPolicy, Executor, Verification, and Memory keep AI takeover visible end to end.',
  }],
] as const;

const capabilityTiles: LocalizedText[] = [
  { zh: '画布运行时', en: 'Canvas runtime' },
  { zh: '批量生成', en: 'Batch generation' },
  { zh: '原图资产', en: 'Original assets' },
  { zh: '知识更新', en: 'Knowledge update' },
];

export const KkLandingPage: React.FC<KkLandingPageProps> = ({
  onLoginClick,
  isLoggedIn,
  onEnterWorkspace,
}) => {
  const { language } = useLocale();
  const t = <T,>(text: { zh: T; en: T }): T => pickByResolvedLanguage(language, text.zh, text.en);
  const primaryAction = isLoggedIn ? onEnterWorkspace : onLoginClick;
  const primaryLabel = isLoggedIn
    ? t({ zh: '进入工作区', en: 'Open workspace' })
    : t({ zh: '开始创作', en: 'Start creating' });

  return (
    <div className="kk-landing-root">
      <header className="kk-landing-nav" aria-label={t({ zh: '主导航', en: 'Primary navigation' })}>
        <a className="kk-landing-nav__brand" href="#top" aria-label="KK Studio home">
          KK Studio
        </a>
        <nav className="kk-landing-nav__links" aria-label={t({ zh: '介绍页分区', en: 'Landing sections' })}>
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {t(item.label)}
            </a>
          ))}
        </nav>
        <button type="button" className="kk-landing-nav__login" onClick={primaryAction}>
          {primaryLabel}
        </button>
      </header>

      <main className="kk-landing-main" id="top">
        <section className="kk-landing-hero" aria-labelledby="kk-landing-hero-title">
          <div className="kk-landing-hero__copy">
            <p className="kk-landing-kicker">{t({ zh: 'AI 原生创意工作台', en: 'AI-native creative workspace' })}</p>
            <h1 id="kk-landing-hero-title">
              {t({
                zh: 'KK Studio 是面向全流程创意生产的 AI 原生工作区。',
                en: 'KK Studio is an AI-native creative workspace for full-flow creative production.',
              })}
            </h1>
          </div>

          <button type="button" className="kk-landing-work-pill" onClick={primaryAction}>
            <span>{primaryLabel}</span>
            <ArrowUpRight size={14} strokeWidth={1.7} />
          </button>

          <aside className="kk-landing-hero-card" aria-label={t({ zh: 'AI 接管说明', en: 'AI takeover note' })}>
            <span>{t({ zh: 'AI 接管', en: 'AI takeover' })}</span>
            <p>
              {t({
                zh: '从意图到验证，每一次自动化画布动作都保持可见、可控，并准备好衔接下一步生产。',
                en: 'From intent to verification, every automated canvas action stays visible, scoped, and ready for the next product step.',
              })}
            </p>
          </aside>
        </section>

        <section className="kk-landing-work-section" id="work" aria-labelledby="kk-landing-work-title">
          <div className="kk-landing-section-label">{t({ zh: '作品', en: 'Work' })}</div>
          <div className="kk-landing-work-heading">
            <h2 id="kk-landing-work-title">{t({ zh: '真正的生产工作，不只是演示稿。', en: 'Production work, not demo decks.' })}</h2>
            <p>
              {t({
                zh: 'KK Studio 把 Prompt、图片、批量任务、原图和排版决策放进同一个可滚动的创意系统，在真实工作量下依然清晰快速。',
                en: 'KK Studio brings prompts, images, batches, originals, and layout decisions into one scrollable creative system that stays fast under real workloads.',
              })}
            </p>
          </div>

          <div className="kk-landing-work-grid">
            {workItems.map((item) => (
              <article className="kk-landing-work-card" key={item.index}>
                <div className="kk-landing-work-card__body">
                  <span>{item.index}</span>
                  <h3>{t(item.title)}</h3>
                  <p>{t(item.type)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="kk-landing-approach-section" id="approach" aria-labelledby="kk-landing-approach-title">
          <div className="kk-landing-section-label">{t({ zh: '方法', en: 'Approach' })}</div>
          <h2 id="kk-landing-approach-title">
            {t({ zh: '足够顺滑地日常创作，也足够严格地交给 Agent。', en: 'Smooth enough for daily creation, strict enough for agents.' })}
          </h2>
          <div className="kk-landing-approach-list">
            {approachItems.map(([index, text]) => (
              <article key={index} className="kk-landing-approach-row">
                <span>{index}</span>
                <p>{t(text)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="kk-landing-news-section" id="ai-flow" aria-label={t({ zh: 'AI 流程', en: 'AI Flow' })}>
          <p>{t({ zh: 'AI 流程', en: 'AI Flow' })}</p>
          <h2>
            {t({
              zh: '从 IntentGate 到 Memory，完整 AI 接管路径始终留在屏幕上。',
              en: 'IntentGate to Memory: the full-flow AI takeover path stays on screen.',
            })}
          </h2>
        </section>

        <section className="kk-landing-services-section" id="services" aria-labelledby="kk-landing-services-title">
          <div className="kk-landing-section-label">{t({ zh: '能力', en: 'Services' })}</div>
          <h2 id="kk-landing-services-title">
            {t({ zh: '画布、生成、资产、知识和验证。', en: 'Canvas, generation, assets, knowledge, verification.' })}
          </h2>
          <div className="kk-landing-services-grid">
            {capabilityTiles.map((service) => (
              <span key={service.en}>{t(service)}</span>
            ))}
          </div>
        </section>

        <section className="kk-landing-about-section" id="about" aria-labelledby="kk-landing-about-title">
          <div className="kk-landing-section-label">{t({ zh: '关于', en: 'About' })}</div>
          <h2 id="kk-landing-about-title">
            {t({ zh: '为需要智能生产流的创作者准备的工作台。', en: 'A studio surface for creators who need intelligent flow.' })}
          </h2>
        </section>

        <section className="kk-landing-join-section" id="join" aria-labelledby="kk-landing-join-title">
          <div className="kk-landing-section-label">{t({ zh: '加入', en: 'Join' })}</div>
          <h2 id="kk-landing-join-title">
            {t({ zh: '给希望 AI 谨慎、快速、可见地行动的团队。', en: 'For teams that want AI to act carefully, quickly, and visibly.' })}
          </h2>
        </section>

        <footer className="kk-landing-footer" id="contact">
          <div className="kk-landing-footer__content">
            <p>{t({ zh: '从 KK Studio 开始', en: 'Start with KK Studio' })}</p>
            <h2>
              {t({
                zh: '把完整创意流程变成可控的 AI 工作区。',
                en: 'Turn the whole creative flow into a controlled AI workspace.',
              })}
            </h2>
            <button type="button" onClick={primaryAction}>
              {primaryLabel}
              <ArrowUpRight size={16} strokeWidth={1.7} />
            </button>
          </div>
          <div className="kk-landing-footer__links">
            <span>Canvas</span>
            <span>ToolRegistry</span>
            <span>Verification</span>
            <span>2026 KK Studio</span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default KkLandingPage;
