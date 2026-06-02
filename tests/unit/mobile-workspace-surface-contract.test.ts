import { readSource, workspacePath } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();
const MOBILE_SURFACE_PATH = 'apps/web/src/components/mobile/MobileWorkspaceSurface.tsx';



test('mobile workspace surface exists as the dedicated mobile orchestration entry', () => {
  assert.equal(existsSync(workspacePath(MOBILE_SURFACE_PATH)), true);
});

test('mobile workspace surface exposes the planned mobile screen contract', () => {
  const source = readSource(MOBILE_SURFACE_PATH);
  const typesSource = readSource('apps/web/src/types.ts');
  const headerSource = readSource('apps/web/src/components/mobile/MobileHeader.tsx');
  const appShellSource = readSource('apps/web/src/components/mobile/MobileAppShell.tsx');

  assert.match(typesSource, /export type MobileSurfaceScreen = 'home' \| 'detail' \| 'more-sheet' \| 'ecommerce';/);
  assert.match(typesSource, /export type ResponsiveSurface = 'phone' \| 'tablet' \| 'desktop';/);
  assert.match(typesSource, /export type ResultViewMode = 'standard' \| 'detail';/);
  assert.match(typesSource, /export type MobileSettingsSection = 'dashboard' \| 'api-management' \| 'consumption-records' \| 'system-logs';/);
  assert.match(source, /interface MobileWorkspaceSurfaceProps\s*\{/);
  assert.match(source, /surface:\s*ResponsiveSurface;/);
  assert.match(source, /const \[resultViewMode, setResultViewMode\] = useState<ResultViewMode>\('standard'\);/);
  assert.match(source, /activeScreen:\s*MobileSurfaceScreen;/);
  assert.match(source, /onScreenChange:\s*\(screen: MobileSurfaceScreen\) => void;/);
  assert.match(source, /onOpenSettings:\s*\(\) => void;/);
  assert.doesNotMatch(source, /settingsHome:\s*React\.ReactNode;/);
  assert.doesNotMatch(source, /settingsPage:\s*React\.ReactNode;/);
  assert.match(source, /data-testid="mobile-workspace-surface"/);
  assert.match(source, /<MobileAppShell/);
  assert.doesNotMatch(headerSource, /fixed top-0 left-0 right-0/);
  assert.match(headerSource, /lg:hidden/);
  assert.match(appShellSource, /lg:hidden/);
});

test('mobile workspace delegates scrolling to a single shell-owned feed scrollport', () => {
  const shellSource = readSource('apps/web/src/components/mobile/MobileAppShell.tsx');
  const surfaceSource = readSource('apps/web/src/components/mobile/MobileWorkspaceSurface.tsx');
  const feedSource = readSource('apps/web/src/components/mobile/MobileResultFeed.tsx');

  assert.match(shellSource, /className="flex-1 overflow-y-auto overscroll-contain"/);
  assert.doesNotMatch(surfaceSource, /className="min-h-0 flex-1 overflow-y-auto px-3 pb-3"/);
  assert.doesNotMatch(feedSource, /className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4"/);
});

test('mobile workspace keeps prompt optimization controls out of the dedicated surface contract', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const surfaceSource = readSource(MOBILE_SURFACE_PATH);

  assert.doesNotMatch(surfaceSource, /promptOptimizationEnabled:\s*boolean;/);
  assert.doesNotMatch(surfaceSource, /promptOptimizationSupported:\s*boolean;/);
  assert.doesNotMatch(surfaceSource, /onTogglePromptOptimization:\s*\(\) => void;/);
  assert.doesNotMatch(surfaceSource, /promptBoostDescription/);
  assert.doesNotMatch(appSource, /promptOptimizationEnabled=\{/);
  assert.doesNotMatch(appSource, /promptOptimizationSupported=\{/);
  assert.doesNotMatch(appSource, /onTogglePromptOptimization=\{/);
});

test('mobile detail and chrome surfaces use Clay frosted mobile tokens', () => {
  const detailSource = readSource('apps/web/src/components/mobile/MobileResultDetailScreen.tsx');
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(detailSource, /var\(--mobile-clay-surface-bg\)/);
  assert.match(detailSource, /var\(--mobile-clay-muted-surface-bg\)/);
  assert.match(detailSource, /var\(--mobile-clay-border\)/);
  assert.doesNotMatch(detailSource, /var\(--bg-secondary\)|var\(--bg-tertiary\)|var\(--border-light\)/);

  assert.match(cssSource, /\.ios-mobile-project-pill,[\s\S]*background:\s*var\(--mobile-clay-shell-bg\) !important;/);
  assert.match(cssSource, /\.mobile-card-stream__empty,[\s\S]*background:\s*var\(--mobile-clay-shell-bg\) !important;/);
  assert.match(cssSource, /\.mobile-card-group\.is-highlighted\s*\{[\s\S]*border-color:\s*var\(--mobile-clay-active-border\) !important;/);
  assert.match(cssSource, /\.mobile-card-group-shell__action--download\s*\{[\s\S]*var\(--clay-brand-coral\)/);
});
