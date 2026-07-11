import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {
  getCanvasPerformancePreferences,
  setCanvasPerformancePreference,
  subscribeCanvasPerformancePreferences,
} from '../../apps/web/src/canvas/canvasPerformancePreferences.ts';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test('canvas performance preferences notify the mounted workspace immediately', () => {
  const globalLike = globalThis as any;
  const previousWindow = globalLike.window;
  const previousStorage = globalLike.localStorage;
  const eventTarget = new EventTarget() as EventTarget & Record<string, unknown>;
  globalLike.window = eventTarget;
  globalLike.localStorage = new MemoryStorage();
  let notifications = 0;
  const unsubscribe = subscribeCanvasPerformancePreferences(() => { notifications += 1; });

  try {
    setCanvasPerformancePreference('mode', 'ghost');
    setCanvasPerformancePreference('viewportCulling', false);
    assert.equal(notifications, 2);
    assert.equal(getCanvasPerformancePreferences().mode, 'ghost');
    assert.equal(getCanvasPerformancePreferences().viewportCulling, false);
  } finally {
    unsubscribe();
    globalLike.window = previousWindow;
    globalLike.localStorage = previousStorage;
  }
});

test('settings only expose performance policies consumed by the canvas runtime', () => {
  const settings = fs.readFileSync('apps/web/src/components/settings/views/CanvasPerformanceView.tsx', 'utf8');
  const workspace = fs.readFileSync('apps/web/src/pages/Workspace/WorkspacePage.tsx', 'utf8');
  const preferences = fs.readFileSync('apps/web/src/canvas/canvasPerformancePreferences.ts', 'utf8');

  for (const key of ['mode', 'viewportCulling', 'dragSuspend', 'zoomReduceMotion', 'connectorThrottle']) {
    assert.match(settings, new RegExp(key));
    assert.match(preferences, new RegExp(key));
  }
  assert.match(workspace, /applyCanvasPerformanceOverrides/);
  assert.match(workspace, /disableCulling: !canvasPerformancePreferences\.viewportCulling/);
  assert.doesNotMatch(settings, /kk_studio_perf_lazy_load|kk_studio_perf_delay_decode/);
});
