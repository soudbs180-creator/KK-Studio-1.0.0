import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('mobile ecommerce panel exposes reusable internal ui primitives', () => {
  const source = readSource('apps/web/src/components/mobile/MobileEcommercePanel.tsx');

  for (const primitive of [
    'mobile-ecommerce-upload-card',
    'mobile-ecommerce-upload-dropzone',
    'mobile-ecommerce-danger-action',
    'mobile-ecommerce-preview-card',
    'mobile-ecommerce-download-action',
    'mobile-ecommerce-section-trigger',
    'mobile-ecommerce-chip-grid',
    'mobile-ecommerce-chip',
    'mobile-ecommerce-control-section',
    'mobile-ecommerce-segmented',
    'mobile-ecommerce-segmented-button',
    'mobile-ecommerce-ratio-frame',
    'mobile-ecommerce-ratio-option',
    'mobile-ecommerce-field-select',
    'mobile-ecommerce-stepper',
    'mobile-ecommerce-stepper-button',
    'mobile-ecommerce-bottom-bar',
    'mobile-ecommerce-prompt',
    'mobile-ecommerce-submit',
  ]) {
    assert.match(source, new RegExp(primitive), `missing ${primitive}`);
  }

  assert.match(source, /data-state=\{activeConfigTab === 'ratio' \? 'active' : 'idle'\}/);
  assert.match(source, /data-state=\{activeConfigTab === 'params' \? 'active' : 'idle'\}/);
  assert.match(source, /data-state=\{isActive \? 'active' : 'idle'\}/);
  assert.match(source, /data-state=\{isSubmitting \? 'busy' : 'ready'\}/);
});

test('mobile ecommerce panel avoids local white glass, private gradients, and private blur/shadow controls', () => {
  const source = readSource('apps/web/src/components/mobile/MobileEcommercePanel.tsx');

  assert.doesNotMatch(source, /bg-black\/60|backdrop-blur-md|border-white\/10|hover:text-white|text-rose-300/);
  assert.doesNotMatch(source, /border-white\/20|border-white\/5|bg-white\/\[0\.01\]|hover:border-white\/10|hover:bg-white\/\[0\.02\]/);
  assert.doesNotMatch(source, /bg-gradient-to-tr from-rose-500\/10 to-amber-500\/5|shadow-rose-500\/2/);
  assert.doesNotMatch(source, /bg-gradient-to-tr from-\[#FF5E62\] to-\[#FF9966\]|bg-white\/10 text-white\/50|hover:shadow-lg|hover:shadow-rose-500\/10/);
});

test('mobile ecommerce panel primitives are styled from mobile clay tokens with reduced motion', () => {
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(cssSource, /\.mobile-ecommerce-upload-card\s*\{[^}]*var\(--mobile-clay-surface-bg\)/);
  assert.match(cssSource, /\.mobile-ecommerce-upload-dropzone\s*\{[^}]*var\(--mobile-clay-surface-bg\)/);
  assert.match(cssSource, /\.mobile-ecommerce-download-action\s*\{[^}]*var\(--mobile-clay-overlay-bg\)/);
  assert.match(cssSource, /\.mobile-ecommerce-ratio-option\[data-state="active"\]\s*\{[^}]*var\(--mobile-clay-active-bg\)/);
  assert.match(cssSource, /\.mobile-ecommerce-field-select\s*\{[^}]*var\(--mobile-clay-surface-bg\)/);
  assert.match(cssSource, /\.mobile-ecommerce-bottom-bar\s*\{[^}]*var\(--mobile-clay-bottom-bar-bg\)/);
  assert.match(cssSource, /\.mobile-ecommerce-submit\[data-state="ready"\]\s*\{[^}]*var\(--clay-brand-coral\)/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.mobile-ecommerce-submit/);
});
