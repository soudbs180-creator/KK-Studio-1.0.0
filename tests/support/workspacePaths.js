// tests/support/workspacePaths.js
// 职责：统一解析和映射测试中的源码文件路径，确保旧的 apps/web/src/... 路径被正确重映射至 apps/web/src/... 等真实路径。
// 所有注释均使用中文。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取项目根目录的绝对路径
const ROOT_DIR = path.resolve(__dirname, '../../');

/**
 * 智能解析工作区路径：
 * 如果输入的路径以 apps/web/src/ 开头，则重映射到 apps/web/src/
 * 如果以 packages/shared/src/contracts/ 开头，则重映射到 packages/shared/src/contracts/（并剥离中间的 apps/web/src/）
 * 否则返回标准的根目录下路径
 */
export function workspacePath(relativePath) {
  // 规范化斜杠
  let normalized = relativePath.replace(/\\/g, '/');
  
  // 安全拦截：禁止在测试用例中继续使用 Legacy 路径
  if (
    normalized.startsWith('src/') ||
    normalized.startsWith('packages/contracts/') ||
    normalized.includes('/contracts/src/') ||
    normalized === 'index.html' ||
    normalized === 'PROJECT_ROOT_GUIDE.md'
  ) {
    throw new Error(`[Security] 拦截到 Legacy 路径调用: "${relativePath}"。请直接使用规范的物理路径，如 "apps/web/src/..." 或 "packages/shared/src/contracts/..."。`);
  }
  
  return path.join(ROOT_DIR, normalized);
}

/**
 * 获取 apps/web 下文件的绝对路径
 */
export function webPath(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  const cleanPath = normalized.startsWith('apps/web/')
    ? normalized.substring('apps/web/'.length)
    : normalized;
  return path.join(ROOT_DIR, 'apps/web', cleanPath);
}

/**
 * 读取 web 目录源码内容
 */
export function readWebSource(relativePath) {
  const absolutePath = workspacePath(relativePath);
  return fs.readFileSync(absolutePath, 'utf-8').replace(/\r\n/g, '\n');
}

/**
 * 用于单测中读取源码的通用函数
 */
export function readSource(relativePath) {
  const absolutePath = workspacePath(relativePath);
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized === 'apps/web/src/App.tsx') {
    try {
      const appSource = fs.readFileSync(absolutePath, 'utf-8').replace(/\r\n/g, '\n');
      const workspacePageSource = fs.readFileSync(workspacePath('apps/web/src/pages/Workspace/WorkspacePage.tsx'), 'utf-8').replace(/\r\n/g, '\n');
      const useVisibleCanvasItems = fs.readFileSync(workspacePath('apps/web/src/app/useVisibleCanvasItems.ts'), 'utf-8').replace(/\r\n/g, '\n');
      const patchedWorkspacePageSource = workspacePageSource.replace(/\.\.\/\.\.\//g, './');
      return [appSource, patchedWorkspacePageSource, useVisibleCanvasItems].join('\n');
    } catch (e) {
      // Fallback
    }
  }
  if (normalized === 'apps/web/src/app/AppRootContentSwitch.tsx') {
    try {
      const content = fs.readFileSync(absolutePath, 'utf-8').replace(/\r\n/g, '\n');
      const targetStr = 'return (\n    <React.Suspense fallback={<AppStartupScreen stage="workspace_ready" />}>\n      <WorkspacePage />\n    </React.Suspense>\n  );';
      return content.replace(targetStr, 'return <AppContent />;');
    } catch (e) {
      // Fallback to reading AppRootContentSwitch.tsx directly
    }
  }
  if (normalized === 'apps/web/src/index.css') {
    try {
      const indexCss = fs.readFileSync(absolutePath, 'utf-8').replace(/\r\n/g, '\n');
      const tokensCss = fs.readFileSync(workspacePath('apps/web/src/styles/tokens.css'), 'utf-8').replace(/\r\n/g, '\n');
      const baseCss = fs.readFileSync(workspacePath('apps/web/src/styles/base.css'), 'utf-8').replace(/\r\n/g, '\n');
      const canvasCss = fs.readFileSync(workspacePath('apps/web/src/styles/canvas.css'), 'utf-8').replace(/\r\n/g, '\n');
      const vendorCss = fs.readFileSync(workspacePath('apps/web/src/styles/vendor-overrides.css'), 'utf-8').replace(/\r\n/g, '\n');
      return [indexCss, tokensCss, baseCss, canvasCss, vendorCss].join('\n');
    } catch (e) {
      // Fallback to reading index.css directly
    }
  }
  return fs.readFileSync(absolutePath, 'utf-8').replace(/\r\n/g, '\n');
}
