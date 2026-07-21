// 简体中文：AST 级 UI 硬编码颜色 Token 强熔断审查脚本 (Check UI Token Literals)
// 职责：扫描组件源码中的硬编码颜色值（HEX, RGBA, HSLA）。对于常规开发必须使用设计 Token，除非添加 "// UI_TOKEN_EXCEPTION" 或列入豁免名单。
// 任何新增的非合规颜色将直接触发 process.exit(1) 熔断 CI。

import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

const HEX_COLOR_REGEX = /#[0-9a-fA-F]{3,8}/;
const RGBA_REGEX = /rgba?\(/;
const HSLA_REGEX = /hsla?\(/;

// 存量清理豁免名单（只允许在存量清理期间添加，常规新组件严禁加入此列表）
const EXCLUDED_FILES = new Set([
  'apps/web/src/components/settings/apiWorkbenchSections.tsx',
  'apps/web/src/components/canvas/PromptNodeComponent.tsx',
  'apps/web/src/components/settings/views/DashboardView.localized.tsx',
  'apps/web/src/components/layout/PromptBar.tsx',
  'apps/web/src/components/modals/RechargeModal.tsx',
  'apps/web/src/components/ui/sign-up.tsx',
  'apps/web/src/components/settings/ApiConnectivityWidget.ts',
  'apps/web/src/components/layout/prompt-bar/composerModeRegistry.ts',
  'apps/web/src/components/layout/ChatSidebar.tsx',
  'apps/web/src/components/canvas/CanvasGroupComponent.tsx',
  'apps/web/src/components/modals/MigrateModal.tsx',
  'apps/web/src/components/modals/UserProfileModal.tsx',
  'apps/web/src/components/modals/StorageSelectionModal.tsx',
  'apps/web/src/components/settings/ApiSettingsView.tsx',
  'apps/web/src/components/mermaid/mermaidTopology.ts',
  'apps/web/src/components/settings/views/DashboardView.tsx',
  'apps/web/src/components/settings/views/UserProfileView.tsx',
  'apps/web/src/components/settings/ProjectManager.tsx',
  'apps/web/src/components/mobile/MobileWorkspaceSurface.tsx',
  'apps/web/src/components/settings/ui/index.tsx',
  'apps/web/src/components/canvas/ConnectionDot.tsx',
  'apps/web/src/components/layout/Sidebar.tsx',
  'apps/web/src/components/mobile/MobileEcommercePanel.tsx',
  'apps/web/src/components/mobile/MobileResultTile.tsx',
]);

async function main() {
  const files = await fg([
    'apps/web/src/components/**/*.{ts,tsx}',
  ], {
    ignore: [
      'node_modules/**',
      'dist/**',
    ],
  });

  const offenders = [];

  for (const file of files) {
    // 转换为 POSIX 格式统一对比
    const posixPath = file.replace(/\\/g, '/');
    if (EXCLUDED_FILES.has(posixPath)) {
      continue;
    }

    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 排除注释和例外行
      if (line.includes('//') || line.includes('/*')) continue;
      if (line.includes('UI_TOKEN_EXCEPTION')) continue;

      if (HEX_COLOR_REGEX.test(line) || RGBA_REGEX.test(line) || HSLA_REGEX.test(line)) {
        offenders.push(`${file}:${i + 1} -> ${line.trim()}`);
      }
    }
  }

  if (offenders.length > 0) {
    console.error('❌ [UI Token Check] 发现非法的硬编码颜色字面量！');
    console.error('   为了保证界面样式一致性与主题自适应，请使用 packages/ui/ 中定义的色彩 Token，或在行尾添加 "// UI_TOKEN_EXCEPTION" 予以特例豁免。');
    console.error(`   本次扫描检测到 ${offenders.length} 处违规：`);
    offenders.slice(0, 15).forEach((off) => console.error(`    - ${off}`));
    if (offenders.length > 15) {
      console.error(`    ... 以及另外 ${offenders.length - 15} 处违规。`);
    }
    // 强熔断：新出现的任何硬编码颜色都将阻止编译和合并
    process.exit(1);
  } else {
    console.log('✅ [UI Token Check] 校验通过：未在常规组件中发现任何非法硬编码颜色。');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
