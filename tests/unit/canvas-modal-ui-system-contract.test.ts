import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('canvas modal primitives expose shared backdrop and panel tokens', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-canvas-modal-backdrop-bg',
    '--kk-canvas-modal-panel-bg',
    '--kk-canvas-modal-panel-border',
    '--kk-canvas-modal-panel-shadow',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-canvas-modal-backdrop',
    '.kk-canvas-modal-panel',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }

  assert.match(cssSource, /--kk-canvas-modal-backdrop-bg:\s*var\(--kk-overlay-backdrop-bg\);/);
  assert.match(cssSource, /--kk-canvas-modal-panel-bg:\s*var\(--frost-card-framework-bg\);/);
  assert.match(cssSource, /\.kk-canvas-modal-backdrop\s*\{[\s\S]*backdrop-filter:\s*blur\(var\(--kk-ui-glass-blur\)\)/);
  assert.match(cssSource, /\.kk-canvas-modal-panel\s*\{[\s\S]*box-shadow:\s*var\(--kk-canvas-modal-panel-shadow\);/);
});

test('canvas utility modals consume shared modal primitives and bounded layers', () => {
  const modalPaths = [
    'apps/web/src/components/modals/MigrateModal.tsx',
    'apps/web/src/components/modals/StorageSelectionModal.tsx',
    'apps/web/src/components/modals/TagInputModal.tsx',
  ];

  for (const modalPath of modalPaths) {
    const source = readSource(modalPath);

    assert.match(source, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/, `${modalPath} should import KK_LAYER`);
    assert.match(source, /className=\{`kk-canvas-modal-backdrop fixed inset-0 flex justify-center/, `${modalPath} should use the shared modal backdrop primitive`);
    assert.match(source, /style=\{\{\s*zIndex:\s*KK_LAYER\.modalBackdrop\s*\}\}/, `${modalPath} should use the bounded modal backdrop layer`);
    assert.match(source, /kk-canvas-modal-panel/, `${modalPath} should use the shared modal panel primitive`);

    assert.doesNotMatch(source, /z-\[(?:10001|3000)\]/, `${modalPath} should not carry private high z-index utilities`);
    assert.doesNotMatch(source, /bg-black\/60|backdrop-blur-sm|backgroundColor:\s*'rgba\(0,\s*0,\s*0,\s*0\.5\)'/, `${modalPath} should not carry private backdrop styling`);
  }
});

test('account and billing mobile modal wrappers consume shared primitives and bounded layers', () => {
  const modalSpecs = [
    {
      path: 'apps/web/src/components/modals/RechargeModal.tsx',
      wrapperStart: 'const RechargeModalWrapper',
    },
    {
      path: 'apps/web/src/components/modals/UserProfileModal.tsx',
      wrapperStart: 'const ModalWrapper',
    },
  ];

  for (const { path, wrapperStart } of modalSpecs) {
    const source = readSource(path);
    const wrapperIndex = source.indexOf(wrapperStart);
    assert.notEqual(wrapperIndex, -1, `${path} should keep a local wrapper component`);
    const wrapperSource = source.slice(wrapperIndex);

    assert.match(source, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/, `${path} should import KK_LAYER`);
    assert.match(wrapperSource, /className="kk-canvas-modal-backdrop fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-200"/, `${path} mobile backdrop should use the shared primitive`);
    assert.match(wrapperSource, /style=\{\{\s*zIndex:\s*KK_LAYER\.modalBackdrop\s*\}\}/, `${path} mobile backdrop should use the bounded modal layer`);
    assert.match(wrapperSource, /className="kk-canvas-modal-panel w-full max-w-\[480px\]/, `${path} mobile panel should use the shared primitive`);

    assert.doesNotMatch(wrapperSource, /z-\[10001\]|bg-black\/60|backdrop-blur-sm/, `${path} should not keep private mobile overlay styling`);
    assert.doesNotMatch(wrapperSource, /shadow-2xl/, `${path} mobile panel shadow should come from the primitive`);
  }
});
