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
  { label: { zh: '浣滃搧', en: 'Work' }, href: '#work' },
  { label: { zh: '鏂规硶', en: 'Approach' }, href: '#approach' },
  { label: { zh: 'AI 娴佺▼', en: 'AI Flow' }, href: '#ai-flow' },
  { label: { zh: '鑳藉姏', en: 'Services' }, href: '#services' },
  { label: { zh: '鍏充簬', en: 'About' }, href: '#about' },
  { label: { zh: '鍔犲叆', en: 'Join' }, href: '#join' },
  { label: { zh: '鑱旂郴', en: 'Contact' }, href: '#contact' },
] as const;

const workItems = [
  {
    index: '01',
    title: { zh: '璺熷緱涓婃剰鍥剧殑鏃犻檺鐢诲竷銆?, en: 'Canvas that keeps up with intent.' },
    type: { zh: '鏃犻檺鐢诲竷 / 鍒涗綔鐢熶骇', en: 'Infinite canvas / Creation' },
    visualClass: 'canvas',
  },
  {
    index: '02',
    title: { zh: '甯﹁蹇嗗拰鎺у埗鐨勬壒閲忕敓浜с€?, en: 'Batch work with memory and control.' },
    type: { zh: '鎸佷箙闃熷垪 / 鑷姩鍖?, en: 'Durable queue / Automation' },
    visualClass: 'batch',
  },
  {
    index: '03',
    title: { zh: '姣忎竴姝ラ兘鍙鐨?AI 鎺ョ銆?, en: 'AI takeover with a visible trail.' },
    type: { zh: 'Agent 杩愯鏃?/ 楠岃瘉', en: 'Agent runtime / Verification' },
    visualClass: 'takeover',
  },
] as const;

const approachItems = [
  ['01', {
    zh: 'IntentGate 鍏堣鎳備换鍔★紝鍐嶅厑璁哥郴缁熺Щ鍔ㄧ敾甯冨拰璧勪骇銆?,
    en: 'IntentGate reads the job before the system moves the canvas.',
  }],
  ['02', {
    zh: 'Planner 涓?ToolRegistry 鎶婄敤鎴风洰鏍囪浆鎴愬彲鍥為€€鐨勪骇鍝佸姩浣溿€?,
    en: 'Planner and ToolRegistry turn user goals into reversible product actions.',
  }],
  ['03', {
    zh: 'PermissionPolicy銆丒xecutor銆乂erification 涓?Memory 璁?AI 鎺ョ鍏ㄧ▼鍙銆?,
    en: 'PermissionPolicy, Executor, Verification, and Memory keep AI takeover visible end to end.',
  }],
] as const;

const capabilityTiles: LocalizedText[] = [
  { zh: '鐢诲竷杩愯鏃?, en: 'Canvas runtime' },
  { zh: '鎵归噺鐢熸垚', en: 'Batch generation' },
  { zh: '鍘熷浘璧勪骇', en: 'Original assets' },
  { zh: '鐭ヨ瘑鏇存柊', en: 'Knowledge update' },
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
    ? t({ zh: '杩涘叆宸ヤ綔鍖?, en: 'Open workspace' })
    : t({ zh: '鐧诲綍', en: 'Sign in' });

  return (
    <div className="kk-landikk-landing-landikk-landing-root">
      <div className="kk-landikk-landing-continuous-stage" aria-hidden />
      <div className="kk-landikk-landing-noise" aria-hidden />

      <header className="kk-landikk-landing-nav" aria-label={t({ zh: '涓诲鑸?, en: 'Primary navigation' })}>
        <a className="kk-landikk-landing-nav__brand" href="#top" aria-label="KK Studio home">
          KK Studio
        </a>
        <nav className="kk-landikk-landing-nav__links" aria-label={t({ zh: '浠嬬粛椤靛垎鍖?, en: 'Landing sections' })}>
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {t(item.label)}
            </a>
          ))}
        </nav>
        <button type="button" className="kk-landikk-landing-nav__login" onClick={primaryAction}>
          {primaryLabel}
        </button>
      </header>

      <main className="kk-landikk-landing-main" id="top">
        <section className="kk-landikk-landing-hero" aria-labelledby="kk-landikk-landing-hero-title">
          <div className="kk-landikk-landing-hero__copy">
            <p className="kk-landikk-landing-kicker">{t({ zh: 'AI 鍘熺敓鍒涙剰宸ヤ綔鍙?, en: 'AI-native creative workspace' })}</p>
            <h1 id="kk-landikk-landing-hero-title">
              {t({
                zh: 'KK Studio 鏄潰鍚戝叏娴佺▼鍒涙剰鐢熶骇鐨?AI 鍘熺敓宸ヤ綔鍖恒€?,
                en: 'KK Studio is an AI-native creative workspace for full-flow creative production.',
              })}
            </h1>
          </div>

          <a className="kk-landikk-landing-work-pill" href="#ai-flow">
            <span>{t({ zh: '鏌ョ湅 AI 娴佺▼', en: 'See AI Flow' })}</span>
            <ArrowUpRight size={14} strokeWidth={1.7} />
          </a>

          <aside className="kk-landikk-landing-hero-card" aria-label={t({ zh: 'AI 鎺ョ璇存槑', en: 'AI takeover note' })}>
            <span>{t({ zh: 'AI 鎺ョ', en: 'AI takeover' })}</span>
            <p>
              {t({
                zh: '浠庢剰鍥惧埌楠岃瘉锛屾瘡涓€娆¤嚜鍔ㄥ寲鐢诲竷鍔ㄤ綔閮戒繚鎸佸彲瑙併€佸彲鎺э紝骞跺噯澶囧ソ琛旀帴涓嬩竴姝ョ敓浜с€?,
                en: 'From intent to verification, every automated canvas action stays visible, scoped, and ready for the next product step.',
              })}
            </p>
          </aside>
        </section>

        <section className="kk-landikk-landing-work-section" id="work" aria-labelledby="kk-landikk-landing-work-title">
          <div className="kk-landikk-landing-section-label">{t({ zh: '浣滃搧', en: 'Work' })}</div>
          <div className="kk-landikk-landing-work-heading">
            <h2 id="kk-landikk-landing-work-title">{t({ zh: '鐪熸鐨勭敓浜у伐浣滐紝涓嶅彧鏄紨绀虹銆?, en: 'Production work, not demo decks.' })}</h2>
            <p>
              {t({
                zh: 'KK Studio 鎶?Prompt銆佸浘鐗囥€佹壒閲忎换鍔°€佸師鍥惧拰鎺掔増鍐崇瓥鏀捐繘鍚屼竴涓彲婊氬姩鐨勫垱鎰忕郴缁燂紝鍦ㄧ湡瀹炲伐浣滈噺涓嬩緷鐒舵竻鏅板揩閫熴€?,
                en: 'KK Studio brings prompts, images, batches, originals, and layout decisions into one scrollable creative system that stays fast under real workloads.',
              })}
            </p>
          </div>

          <div className="kk-landikk-landing-work-grid">
            {workItems.map((item) => (
              <article className="kk-landikk-landing-work-card" key={item.index}>
                <div className={`kk-landing-work-card__image kk-landing-work-card__image--${item.visualClass}`} aria-hidden />
                <div className="kk-landikk-landing-work-card__body">
                  <span>{item.index}</span>
                  <h3>{t(item.title)}</h3>
                  <p>{t(item.type)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="kk-landikk-landing-approach-section" id="approach" aria-labelledby="kk-landikk-landing-approach-title">
          <div className="kk-landikk-landing-section-label">{t({ zh: '鏂规硶', en: 'Approach' })}</div>
          <h2 id="kk-landikk-landing-approach-title">
            {t({ zh: '瓒冲椤烘粦鍦版棩甯稿垱浣滐紝涔熻冻澶熶弗鏍煎湴浜ょ粰 Agent銆?, en: 'Smooth enough for daily creation, strict enough for agents.' })}
          </h2>
          <div className="kk-landikk-landing-approach-list">
            {approachItems.map(([index, text]) => (
              <article key={index} className="kk-landikk-landing-approach-row">
                <span>{index}</span>
                <p>{t(text)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="kk-landikk-landing-news-section" id="ai-flow" aria-label={t({ zh: 'AI 娴佺▼', en: 'AI Flow' })}>
          <p>{t({ zh: 'AI 娴佺▼', en: 'AI Flow' })}</p>
          <h2>
            {t({
              zh: '浠?IntentGate 鍒?Memory锛屽畬鏁?AI 鎺ョ璺緞濮嬬粓鐣欏湪灞忓箷涓娿€?,
              en: 'IntentGate to Memory: the full-flow AI takeover path stays on screen.',
            })}
          </h2>
        </section>

        <section className="kk-landikk-landing-services-section" id="services" aria-labelledby="kk-landikk-landing-services-title">
          <div className="kk-landikk-landing-section-label">{t({ zh: '鑳藉姏', en: 'Services' })}</div>
          <h2 id="kk-landikk-landing-services-title">
            {t({ zh: '鐢诲竷銆佺敓鎴愩€佽祫浜с€佺煡璇嗗拰楠岃瘉銆?, en: 'Canvas, generation, assets, knowledge, verification.' })}
          </h2>
          <div className="kk-landikk-landing-services-grid">
            {capabilityTiles.map((service) => (
              <span key={service.en}>{t(service)}</span>
            ))}
          </div>
        </section>

        <section className="kk-landikk-landing-about-section" id="about" aria-labelledby="kk-landikk-landing-about-title">
          <div className="kk-landikk-landing-section-label">{t({ zh: '鍏充簬', en: 'About' })}</div>
          <h2 id="kk-landikk-landing-about-title">
            {t({ zh: '涓洪渶瑕佹櫤鑳界敓浜ф祦鐨勫垱浣滆€呭噯澶囩殑宸ヤ綔鍙般€?, en: 'A studio surface for creators who need intelligent flow.' })}
          </h2>
        </section>

        <section className="kk-landikk-landing-join-section" id="join" aria-labelledby="kk-landikk-landing-join-title">
          <div className="kk-landikk-landing-section-label">{t({ zh: '鍔犲叆', en: 'Join' })}</div>
          <h2 id="kk-landikk-landing-join-title">
            {t({ zh: '缁欏笇鏈?AI 璋ㄦ厧銆佸揩閫熴€佸彲瑙佸湴琛屽姩鐨勫洟闃熴€?, en: 'For teams that want AI to act carefully, quickly, and visibly.' })}
          </h2>
        </section>

        <footer className="kk-landikk-landing-footer" id="contact">
          <div className="kk-landikk-landing-footer__flower" aria-hidden />
          <div className="kk-landikk-landing-footer__content">
            <p>{t({ zh: '浠?KK Studio 寮€濮?, en: 'Start with KK Studio' })}</p>
            <h2>
              {t({
                zh: '鎶婂畬鏁村垱鎰忔祦绋嬪彉鎴愬彲鎺х殑 AI 宸ヤ綔鍖恒€?,
                en: 'Turn the whole creative flow into a controlled AI workspace.',
              })}
            </h2>
            <button type="button" onClick={primaryAction}>
              {primaryLabel}
              <ArrowUpRight size={16} strokeWidth={1.7} />
            </button>
          </div>
          <div className="kk-landikk-landing-footer__links">
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

