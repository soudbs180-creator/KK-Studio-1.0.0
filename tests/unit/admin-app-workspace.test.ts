import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

test('package.json exposes admin scripts for the separate Vite target', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

  assert.equal(pkg.scripts['admin:dev'], 'vite --configLoader native --config apps/admin/vite.config.ts');
  assert.equal(pkg.scripts['admin:build'], 'vite build --configLoader native --config apps/admin/vite.config.ts');
  assert.equal(pkg.scripts['admin:preview'], 'vite preview --configLoader native --config apps/admin/vite.config.ts');
});

test('admin html shell is local-only and ad-free', () => {
  assert.equal(existsSync('apps/admin/index.html'), true);
  const html = readFileSync('apps/admin/index.html', 'utf8');

  assert.match(html, /<div id="root"><\/div>/);
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /googletag|doubleclick|gtag|analytics|adservice/i);
});
