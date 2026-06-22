import assert from 'node:assert/strict';
import test from 'node:test';

import { readSource } from '../support/workspacePaths.js';

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

  assert.match(combinedCss, /height:\s*240vh;/);
  assert.match(combinedCss, /linear-gradient\(\s*#280e01 0%,\s*#182644 15\.2608%,\s*#5a769f 30\.284%,\s*#87a1c4 43\.3787%,\s*#c1d3e6 58\.8313%,\s*#fef9e1 79\.7139%,\s*#f7f3f0 100%\s*\)/);
  assert.match(combinedCss, /linear-gradient\(\s*180deg,\s*#f7f3f000 0%,\s*#f1bd7af7 17\.3899%,\s*#fcbe6d 32\.9462%,\s*#e46c44 51\.4622%,\s*#542512 78\.2939%,\s*#1e1310 100%\s*\)/);
  assert.match(combinedCss, /\.ng-work-card\s*\{/);
  assert.match(combinedCss, /touch-action:\s*pan-y;/);
});

test('login card uses neutral KK reference styling instead of the rejected blue treatment', () => {
  const authCssSource = readSource(LOGIN_SCREEN_CSS_PATH);
  const referenceCssSource = readSource(LANDING_REFERENCE_PATH);
  const combinedAuthCss = `${authCssSource}\n${referenceCssSource}`;

  assert.match(combinedAuthCss, /--ng-ink:\s*#0c1018;/);
  assert.match(combinedAuthCss, /\.auth-page--landing \.auth-modal-content \.auth-panel\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.78\)/);
  assert.match(combinedAuthCss, /\.auth-page--landing \.auth-btn-main\s*\{[\s\S]*background:\s*#0c1018 !important;/);
  assert.match(combinedAuthCss, /\.auth-social-row\s*\{[\s\S]*display:\s*flex/);
  assert.doesNotMatch(combinedAuthCss, /linear-gradient\(135deg,\s*#1e40af,\s*#0f1d3a\)/);
  assert.doesNotMatch(combinedAuthCss, /background:\s*#0f1d3a !important;/);
});
