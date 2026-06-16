// 简体中文：Landing Hero 的高级编辑式画布主视觉，保持静态优先与低成本动效
import React from 'react';
import { useLocale } from '../context/LocaleContext';
import { pickByResolvedLanguage } from '../utils/localeText';

export const CanvasPreviewMock: React.FC = () => {
  const { language } = useLocale();
  const t = <T,>(text: { zh: T; en: T }): T => pickByResolvedLanguage(language, text.zh, text.en);

  return (
    <div className="kk-canvas-preview" aria-label={t({ zh: 'KK Studio 画布预览', en: 'KK Studio canvas preview' })}>
      <div className="kk-canvas-preview__grid" aria-hidden />
      <div className="kk-canvas-preview__orb kk-canvas-preview__orb--coral" aria-hidden />
      <div className="kk-canvas-preview__orb kk-canvas-preview__orb--teal" aria-hidden />

      <div className="kk-canvas-preview__topbar">
        <span>KK Studio Canvas</span>
        <span>{t({ zh: 'Production board / live', en: 'Production board / live' })}</span>
        <span>100%</span>
      </div>

      <svg className="kk-canvas-preview__links" viewBox="0 0 1200 620" preserveAspectRatio="none" aria-hidden>
        <path d="M 216 168 C 330 150, 432 250, 540 242" />
        <path d="M 306 452 C 420 432, 438 338, 540 300" />
        <path d="M 674 260 C 798 248, 822 166, 974 148" />
        <path d="M 682 304 C 820 332, 834 424, 1008 448" />
        <path className="kk-canvas-preview__active-link" d="M 674 260 C 798 248, 822 166, 974 148" />
      </svg>

      <article className="kk-canvas-node kk-canvas-node--prompt">
        <div className="kk-canvas-node__header">
          <span>{t({ zh: 'Prompt Composer', en: 'Prompt Composer' })}</span>
          <small>Node 01</small>
        </div>
        <p>
          {t({
            zh: '高质感商品主图，暖奶油背景，珊瑚色光影，柔和材质，适合电商首屏。',
            en: 'Premium product visual, warm cream backdrop, coral light, soft material, commerce-ready hero shot.'
          })}
        </p>
        <div className="kk-canvas-node__chips">
          <span>#commerce</span>
          <span>#hero</span>
          <span>#soft-light</span>
        </div>
      </article>

      <article className="kk-canvas-node kk-canvas-node--asset">
        <div className="kk-canvas-image-card">
          <div className="kk-canvas-image-card__stage">
            <div className="kk-canvas-image-card__object" />
            <div className="kk-canvas-image-card__base" />
          </div>
        </div>
        <div className="kk-canvas-node__caption">
          <span>Reference_24.png</span>
          <small>{t({ zh: '参考图', en: 'Reference' })}</small>
        </div>
      </article>

      <article className="kk-canvas-node kk-canvas-node--router">
        <div className="kk-canvas-node__header">
          <span>{t({ zh: 'Model Router', en: 'Model Router' })}</span>
          <small>{t({ zh: '审计中', en: 'Audited' })}</small>
        </div>
        <div className="kk-router-lines">
          <div><span>GPT-4o</span><b>{t({ zh: '主路由', en: 'Primary' })}</b></div>
          <div><span>Claude</span><b>{t({ zh: '备用', en: 'Standby' })}</b></div>
          <div><span>Gemini</span><b>{t({ zh: '图像', en: 'Image' })}</b></div>
        </div>
      </article>

      <article className="kk-canvas-node kk-canvas-node--output">
        <div className="kk-output-mosaic">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="kk-canvas-node__caption">
          <span>{t({ zh: 'Commerce batch', en: 'Commerce batch' })}</span>
          <small>24 assets</small>
        </div>
      </article>

      <article className="kk-canvas-node kk-canvas-node--agent">
        <div className="kk-agent-pulse" />
        <div>
          <span>{t({ zh: 'Agent Queue', en: 'Agent Queue' })}</span>
          <p>{t({ zh: '整理版本、重试失败项并准备导出。', en: 'Sorting versions, retrying failures and preparing export.' })}</p>
        </div>
      </article>

      <div className="kk-canvas-preview__status kk-canvas-preview__status--left">
        <span>{t({ zh: 'Key isolated', en: 'Key isolated' })}</span>
        <b>{t({ zh: '已启用', en: 'Enabled' })}</b>
      </div>
      <div className="kk-canvas-preview__status kk-canvas-preview__status--right">
        <span>{t({ zh: 'Credits held', en: 'Credits held' })}</span>
        <b>128.4</b>
      </div>
    </div>
  );
};

export default CanvasPreviewMock;
