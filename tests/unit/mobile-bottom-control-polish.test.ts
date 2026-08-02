import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const workspaceCss = readFileSync(
  path.join(process.cwd(), 'apps/web/src/styles/workspace-ui-v3.css'),
  'utf8',
);

test('mobile result dock shares one panel surface while preserving capsule and circle geometry', () => {
  assert.match(workspaceCss, /\.kk-result-view-mode-group\s*\{[\s\S]*?background:\s*var\(--kk-morphic-panel\);/);
  assert.match(workspaceCss, /\.kk-result-view-mode-thumb\s*\{[\s\S]*?border-radius:\s*999px;[\s\S]*?background:\s*var\(--kk-morphic-panel\);/);
  assert.match(workspaceCss, /\.kk-mobile-generation-status\s*\{[\s\S]*?border-radius:\s*999px;/);
  assert.match(workspaceCss, /\.kk-result-locate-control\s*\{[\s\S]*?border-radius:\s*50%;[\s\S]*?background:\s*var\(--kk-morphic-panel\);/);
});

test('mobile credit divider floats in the gap instead of becoming the button edge', () => {
  assert.match(workspaceCss, /\.kk-mobile-header-control\[data-testid='mobile-header-credit-chip'\]\s*\{[\s\S]*?position:\s*relative;[\s\S]*?border-left:\s*0\s*!important;/);
  assert.match(workspaceCss, /\.kk-mobile-header-control\[data-testid='mobile-header-credit-chip'\]::before\s*\{[\s\S]*?left:\s*-2\.5px;[\s\S]*?height:\s*20px;[\s\S]*?background:\s*var\(--kk-morphic-border\);/);
});
