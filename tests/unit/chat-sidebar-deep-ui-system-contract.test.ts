import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('chat sidebar exposes reusable deep menu and modal primitives', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-chat-sidebar-menu-bg',
    '--kk-chat-sidebar-menu-border',
    '--kk-chat-sidebar-menu-shadow',
    '--kk-chat-sidebar-menu-item-hover-bg',
    '--kk-chat-sidebar-menu-danger-text',
    '--kk-chat-sidebar-modal-backdrop-bg',
    '--kk-chat-sidebar-modal-panel-bg',
    '--kk-chat-sidebar-filter-active-bg',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-chat-sidebar-floating-menu',
    '.kk-chat-sidebar-menu-item',
    '.kk-chat-sidebar-menu-item--danger',
    '.kk-chat-sidebar-menu-divider',
    '.kk-chat-sidebar-modal-backdrop',
    '.kk-chat-sidebar-modal-panel',
    '.kk-chat-sidebar-filter-toggle',
    '.kk-chat-sidebar-filter-toggle--active',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }
});

test('chat sidebar deep overlays consume shared primitives and layer tokens', () => {
  const source = readSource('apps/web/src/components/layout/ChatSidebar.tsx');

  assert.match(source, /className="kk-chat-sidebar-floating-menu absolute bottom-full/);
  assert.match(source, /className="kk-chat-sidebar-floating-menu fixed/);
  assert.match(source, /className="kk-chat-sidebar-menu-item/);
  assert.match(source, /className="kk-chat-sidebar-menu-item kk-chat-sidebar-menu-item--danger/);
  assert.match(source, /className="kk-chat-sidebar-menu-divider/);
  assert.match(source, /style=\{\{ zIndex: KK_LAYER\.dropdown/);
  assert.match(source, /className="kk-chat-sidebar-modal-backdrop fixed inset-0/);
  assert.match(source, /style=\{\{ zIndex: KK_LAYER\.modalBackdrop \}\}/);
  assert.match(source, /className="kk-chat-sidebar-modal-panel/);
  assert.match(source, /kk-chat-sidebar-filter-toggle--active/);

  assert.doesNotMatch(source, /z-\[1000\]|z-\[10020\]|z-\[10030\]/);
  assert.doesNotMatch(source, /border-zinc-800 bg-\[#0d0e14\]|bg-\[#0d0e14\]|bg-black\/50/);
  assert.doesNotMatch(source, /text-zinc-300 hover:text-white hover:bg-zinc-800/);
  assert.doesNotMatch(source, /text-red-300 hover:bg-red-500\/20/);
  assert.doesNotMatch(source, /border-red-400\/40 bg-red-500\/15 text-red-200/);
});
