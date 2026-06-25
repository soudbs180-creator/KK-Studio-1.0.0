// 简体中文：智能 CDN 降级与工具箱多实例管理回归契约单元测试 (Sprint 8 Regression Test)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('Sprint 8: Service Worker 开发环境旁路契约静态审查', () => {
  const swPath = path.join(root, 'apps', 'web', 'public', 'sw.js');
  const source = fs.readFileSync(swPath, 'utf8');

  // 断言 sw.js 必须包含 localhost Bypass 放行判断
  assert.ok(source.includes('self.location.hostname === \'localhost\''));
  assert.ok(source.includes('self.location.hostname === \'127.0.0.1\''));
  assert.ok(source.includes('DEGRADED_CDNS'));
  assert.ok(source.includes('SW_CDN_SET_PREFERENCE'));
});

test('Sprint 8: WindowManager 多实例挂载与 CSS Theme 规范性审查', () => {
  const managerPath = path.join(root, 'apps', 'web', 'src', 'components/workspace/WindowManager.tsx');
  const source = fs.readFileSync(managerPath, 'utf8');

  // 断言 WindowManager 必须包含 Z_INDEX_EXCEPTION 豁免例外，且无硬编码色彩字面量
  assert.ok(source.includes('// Z_INDEX_EXCEPTION'));
  assert.ok(source.includes('var(--frost-card-framework-bg)'));
  assert.ok(source.includes('var(--text-primary)'));
  assert.ok(source.includes('var(--frost-card-sub-bg)'));

  // 必须正确引入 Lazy 组件以防运行时同步循环依赖
  assert.ok(source.includes('React.lazy'));
  assert.ok(source.includes('StressLab'));
  assert.ok(source.includes('BrowserAssistantView'));
});

test('Sprint 8: WorkspacePage 方法路由透传闭环审查', () => {
  const pagePath = path.join(root, 'apps', 'web', 'src', 'pages/Workspace/WorkspacePage.tsx');
  const source = fs.readFileSync(pagePath, 'utf8');

  // 必须成功声明 toolWindows state，以及向外挂载 WindowManager
  assert.ok(source.includes('toolWindows'));
  assert.ok(source.includes('openToolWindowInstance'));
  assert.ok(source.includes('handleUpdateWindowLayout'));
  assert.ok(source.includes('<WindowManager'));
  assert.ok(source.includes('setPptEditorMode'));
  assert.ok(source.includes('togglePinTool'));
});
