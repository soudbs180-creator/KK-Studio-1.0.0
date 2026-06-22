import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import './landingStyles.css';
import './landingReferenceOverrides.css';

interface KkLandingPageProps {
  onLoginClick: () => void;
  isLoggedIn: boolean;
  onEnterWorkspace: () => void;
}

const navItems = ['Work', 'Approach', 'AI Flow', 'Services', 'About', 'Join', 'Contact'] as const;

const workItems = [
  {
    index: '01',
    title: 'Canvas that keeps up with intent.',
    type: 'Infinite canvas / Creation',
    visualClass: 'canvas',
  },
  {
    index: '02',
    title: 'Batch work with memory and control.',
    type: 'Durable queue / Automation',
    visualClass: 'batch',
  },
  {
    index: '03',
    title: 'AI takeover with a visible trail.',
    type: 'Agent runtime / Verification',
    visualClass: 'takeover',
  },
] as const;

const approachItems = [
  ['01', 'IntentGate reads the job before the system moves the canvas.'],
  ['02', 'Planner and ToolRegistry turn user goals into reversible product actions.'],
  ['03', 'PermissionPolicy, Executor, Verification, and Memory keep AI takeover visible end to end.'],
] as const;

const sectionIdFor = (item: (typeof navItems)[number]) => item.toLowerCase().replace(/\s+/g, '-');

export const KkLandingPage: React.FC<KkLandingPageProps> = ({
  onLoginClick,
  isLoggedIn,
  onEnterWorkspace,
}) => {
  const primaryAction = isLoggedIn ? onEnterWorkspace : onLoginClick;
  const primaryLabel = isLoggedIn ? 'Open workspace' : 'Sign in';

  return (
    <div className="ng-landing-root">
      <div className="ng-gradient-stage" aria-hidden />
      <div className="ng-warm-stage" aria-hidden />
      <div className="ng-noise" aria-hidden />

      <header className="ng-nav" aria-label="Primary navigation">
        <a className="ng-nav__brand" href="#top" aria-label="KK Studio home">
          KK Studio
        </a>
        <nav className="ng-nav__links" aria-label="Landing sections">
          {navItems.map((item) => (
            <a key={item} href={`#${sectionIdFor(item)}`}>
              {item}
            </a>
          ))}
        </nav>
        <button type="button" className="ng-nav__login" onClick={primaryAction}>
          {primaryLabel}
        </button>
      </header>

      <main className="ng-main" id="top">
        <section className="ng-hero" aria-labelledby="ng-hero-title">
          <div className="ng-hero__copy">
            <p className="ng-kicker">AI-native creative workspace</p>
            <h1 id="ng-hero-title">
              KK Studio is an AI-native creative workspace for full-flow creative production.
            </h1>
          </div>

          <a className="ng-work-pill" href="#ai-flow">
            <span>See AI Flow</span>
            <ArrowUpRight size={14} strokeWidth={1.7} />
          </a>

          <aside className="ng-hero-card" aria-label="AI takeover note">
            <span>AI takeover</span>
            <p>
              From intent to verification, every automated canvas action stays visible, scoped,
              and ready for the next product step.
            </p>
          </aside>
        </section>

        <section className="ng-work-section" id="work" aria-labelledby="ng-work-title">
          <div className="ng-section-label">Work</div>
          <div className="ng-work-heading">
            <h2 id="ng-work-title">Production work, not demo decks.</h2>
            <p>
              KK Studio brings prompts, images, batches, originals, and layout decisions into one
              scrollable creative system that stays fast under real workloads.
            </p>
          </div>

          <div className="ng-work-grid">
            {workItems.map((item) => (
              <article className="ng-work-card" key={item.title}>
                <div className={`ng-work-card__image ng-work-card__image--${item.visualClass}`} aria-hidden />
                <div className="ng-work-card__body">
                  <span>{item.index}</span>
                  <h3>{item.title}</h3>
                  <p>{item.type}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ng-approach-section" id="approach" aria-labelledby="ng-approach-title">
          <div className="ng-section-label">Approach</div>
          <h2 id="ng-approach-title">Smooth enough for daily creation, strict enough for agents.</h2>
          <div className="ng-approach-list">
            {approachItems.map(([index, text]) => (
              <article key={index} className="ng-approach-row">
                <span>{index}</span>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ng-news-section" id="ai-flow" aria-label="AI Flow">
          <p>AI Flow</p>
          <h2>IntentGate to Memory: the full-flow AI takeover path stays on screen.</h2>
        </section>

        <section className="ng-services-section" id="services" aria-labelledby="ng-services-title">
          <div className="ng-section-label">Services</div>
          <h2 id="ng-services-title">Canvas, generation, assets, knowledge, verification.</h2>
          <div className="ng-services-grid">
            {['Canvas runtime', 'Batch generation', 'Original assets', 'Knowledge update'].map((service) => (
              <span key={service}>{service}</span>
            ))}
          </div>
        </section>

        <section className="ng-about-section" id="about" aria-labelledby="ng-about-title">
          <div className="ng-section-label">About</div>
          <h2 id="ng-about-title">A studio surface for creators who need intelligent flow.</h2>
        </section>

        <section className="ng-join-section" id="join" aria-labelledby="ng-join-title">
          <div className="ng-section-label">Join</div>
          <h2 id="ng-join-title">For teams that want AI to act carefully, quickly, and visibly.</h2>
        </section>

        <footer className="ng-footer" id="contact">
          <div className="ng-footer__flower" aria-hidden />
          <div className="ng-footer__content">
            <p>Start with KK Studio</p>
            <h2>Turn the whole creative flow into a controlled AI workspace.</h2>
            <button type="button" onClick={primaryAction}>
              {primaryLabel}
              <ArrowUpRight size={16} strokeWidth={1.7} />
            </button>
          </div>
          <div className="ng-footer__links">
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
