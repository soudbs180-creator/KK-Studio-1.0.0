import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import { readSource, workspacePath } from '../support/workspacePaths.js';

const LOGIN_SCREEN_PATH = 'apps/web/src/components/auth/LoginScreen.tsx';
const LOGIN_SCREEN_CSS_PATH = 'apps/web/src/components/auth/LoginScreen.css';
const LANDING_PAGE_PATH = 'apps/web/src/landing/KkLandingPage.tsx';
const LANDING_STYLES_PATH = 'apps/web/src/landing/landingStyles.css';
const LANDING_REFERENCE_PATH = 'apps/web/src/landing/landingReferenceOverrides.css';

test('signed-out landing mode unlocks document scrolling and only locks it for the auth modal', () => {
  const loginSource = readSource(LOGIN_SCREEN_PATH);
  const authCssSource = readSource(LOGIN_SCREEN_CSS_PATH);
  const referenceCssSource = readSource(LANDING_REFERENCE_PATH);

  assert.match(loginSource, /const authLandingClass = 'auth-screen-active--landing';/);
  assert.match(loginSource, /body\.classList\.add\('auth-screen-active', authThemeClass, authLandingClass\);/);
  assert.match(loginSource, /root\.classList\.add\('auth-screen-active', authThemeClass, authLandingClass\);/);
  assert.match(loginSource, /const modalOpenClass = 'auth-modal-open';/);
  assert.match(loginSource, /document\.body\.classList\.toggle\(modalOpenClass, isLoginModalOpen\);/);
  assert.doesNotMatch(loginSource, /document\.body\.style\.overflow\s*=\s*'hidden';/);

  assert.match(
    authCssSource,
    /html\.auth-screen-active--landing,\s*body\.auth-screen-active--landing,\s*html\.auth-screen-active--landing body,\s*body\.auth-screen-active--landing #root\s*\{[\s\S]*overflow-y:\s*auto !important;/,
  );
  assert.match(authCssSource, /body\.auth-modal-open\s*\{[\s\S]*overflow:\s*hidden(?: !important)?;/);
  assert.doesNotMatch(authCssSource, /@media \(max-width:\s*767px\)\s*\{[\s\S]*?\.auth-page\s*\{[\s\S]*?overflow:\s*hidden !important;/);
  assert.doesNotMatch(referenceCssSource, /html\.auth-screen-active,\s*body\.auth-screen-active,/);
});

test('landing page keeps KK Studio brand while using the reference structure and project-card treatment', () => {
  const landingSource = readSource(LANDING_PAGE_PATH);
  const landingCssSource = readSource(LANDING_STYLES_PATH);
  const referenceCssSource = readSource(LANDING_REFERENCE_PATH);
  const combinedCss = `${landingCssSource}\n${referenceCssSource}`;

  assert.match(landingSource, /className="ng-landing-root"/);
  assert.match(landingSource, /useLocale/);
  assert.match(landingSource, /AI 原生创意工作台/);
  assert.match(landingSource, /KK Studio/);
  assert.match(landingSource, /AI-native creative workspace/);
  assert.match(landingSource, /AI takeover/);
  assert.match(landingSource, /full-flow creative production/i);
  assert.match(landingSource, /Work/);
  assert.match(landingSource, /Approach/);
  assert.match(landingSource, /AI Flow/);
  assert.match(landingSource, /Services/);
  assert.match(landingSource, /Contact/);
  assert.doesNotMatch(landingSource, /New Genre/);
  assert.doesNotMatch(landingSource, /newgenre_static/);
  assert.doesNotMatch(landingSource, /CanvasPreviewMock|ProcessTimeline|LandingCTA|FeatureNarrative|heroBadges|serviceItems|thoughtItems/);

  assert.match(combinedCss, /\.ng-continuous-stage\s*\{/);
  assert.match(combinedCss, /--ng-page-gradient:/);
  assert.match(combinedCss, /min-height:\s*100%;/);
  assert.doesNotMatch(combinedCss, /\.ng-gradient-stage\s*\{[\s\S]*height:\s*240vh;/);
  assert.match(combinedCss, /url\("\/landing\/kk-infinite-canvas-workspace\.png"\)/);
  assert.match(combinedCss, /url\("\/landing\/kk-durable-batch-queue\.png"\)/);
  assert.match(combinedCss, /url\("\/landing\/kk-agent-takeover-runtime\.png"\)/);
  assert.match(combinedCss, /\.ng-footer\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.42fr\)\s*minmax\(320px,\s*0\.58fr\);/);
  assert.match(combinedCss, /\.ng-footer__flower\s*\{[\s\S]*position:\s*relative;[\s\S]*aspect-ratio:\s*16 \/ 10;/);
  assert.doesNotMatch(combinedCss, /\.ng-footer__flower\s*\{[\s\S]*right:\s*min\(-12vw,\s*-90px\);/);
  assert.match(combinedCss, /\.ng-work-card\s*\{/);
  assert.match(combinedCss, /touch-action:\s*pan-y;/);

  for (const assetName of [
    'kk-infinite-canvas-workspace.png',
    'kk-durable-batch-queue.png',
    'kk-agent-takeover-runtime.png',
  ]) {
    assert.ok(
      existsSync(workspacePath(`apps/web/public/landing/${assetName}`)),
      `${assetName} should exist as a real landing image asset`,
    );
  }
});

test('login card uses neutral KK reference styling instead of the rejected blue treatment', () => {
  const authCssSource = readSource(LOGIN_SCREEN_CSS_PATH);
  const referenceCssSource = readSource(LANDING_REFERENCE_PATH);
  const combinedAuthCss = `${authCssSource}\n${referenceCssSource}`;

  assert.match(combinedAuthCss, /--ng-ink:\s*#0c1018;/);
  assert.match(combinedAuthCss, /\.auth-page--landing \.auth-modal-content \.auth-panel\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.45\)/);
  assert.match(combinedAuthCss, /\.auth-page--landing \.auth-btn-main\s*\{[\s\S]*background:\s*#0c1018 !important;/);
  assert.match(combinedAuthCss, /\.auth-social-row\s*\{[\s\S]*display:\s*flex/);
  assert.doesNotMatch(combinedAuthCss, /linear-gradient\(135deg,\s*#1e40af,\s*#0f1d3a\)/);
  assert.doesNotMatch(combinedAuthCss, /background:\s*#0f1d3a !important;/);
});
