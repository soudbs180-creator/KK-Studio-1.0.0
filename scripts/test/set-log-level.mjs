import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 保存原始的 fs 方法以便调用
const originalReadFileSync = fs.readFileSync;
const originalExistsSync = fs.existsSync;
const originalStatSync = fs.statSync;

// 获取项目根目录的绝对路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

function redirectPath(filePath) {
  if (typeof filePath !== 'string') return filePath;
  const normalized = filePath.replace(/\\/g, '/');

  // 对第三方模块不做任何重定向拦截
  if (normalized.includes('/node_modules/')) {
    return filePath;
  }
  
  // 检查是否指向不存在的旧 src 目录，且不包含在 apps/shared 中
  if (normalized.includes('/src/') && !normalized.includes('/apps/web/src/') && !normalized.includes('/apps/mobile/src/') && !normalized.includes('/packages/shared/src/')) {
    // 替换为 apps/web/src/
    const redirected = filePath.replace(/[\\/]src[\\/]/, '/apps/web/src/');
    return path.normalize(redirected);
  }
  
  // 检查是否指向 packages/contracts/
  if (normalized.includes('/packages/contracts/') && !normalized.includes('/packages/shared/src/contracts/')) {
    let redirected = filePath.replace(/[\\/]packages[\\/]contracts[\\/]/, '/packages/shared/src/contracts/');
    redirected = redirected.replace(/[\\/]contracts[\\/]src[\\/]/, '/contracts/');
    return path.normalize(redirected);
  }

  // 检查是否指向 packages/shared/src/contracts/src/
  if (normalized.includes('/packages/shared/src/contracts/src/')) {
    const redirected = filePath.replace(/[\\/]contracts[\\/]src[\\/]/, '/contracts/');
    return path.normalize(redirected);
  }
  
  // 检查是否指向 vite.config.ts
  if (normalized.endsWith('/vite.config.ts') && !normalized.includes('/apps/web/')) {
    const redirected = filePath.replace('vite.config.ts', 'apps/web/vite.config.ts');
    return path.normalize(redirected);
  }
  
  return filePath;
}

// 劫持 readFileSync
fs.readFileSync = function (filePath, ...args) {
  const targetPath = redirectPath(filePath);
  return originalReadFileSync(targetPath, ...args);
};

// 劫持 existsSync
fs.existsSync = function (filePath) {
  const targetPath = redirectPath(filePath);
  return originalExistsSync(targetPath);
};

// 劫持 statSync
fs.statSync = function (filePath, ...args) {
  const targetPath = redirectPath(filePath);
  return originalStatSync(targetPath, ...args);
};

process.env.KK_LOG_LEVEL ??= "WARN";
process.env.KK_API_SESSION_SIGNING_SECRET ??= "unit-test-kk-session-signing-secret";

const originalConsoleWarn = console.warn.bind(console);
const originalConsoleError = console.error.bind(console);

const suppressedTextFragments = [];

const suppressedStructuredWarningMessages = new Set([
  "Falling back to file-backed local auth data repository",
  "Falling back to in-memory admin console repository",
  "Falling back to in-memory credit account repository",
  "Falling back to in-memory credit exchange-rate repository",
  "Falling back to in-memory credit provider repository",
  "Falling back to in-memory workspace layout repository",
  "Using in-memory admin console repository for KKAI local-only runtime",
  "Using file-backed credit account repository for KKAI local-only runtime",
  "Using file-backed credit exchange-rate repository for KKAI local-only runtime",
  "Using in-memory credit provider repository for KKAI local-only runtime",
  "WeChat auth service is disabled because the PostgreSQL WeChat repository is unavailable.",
  "WeChat auth service is disabled because WeChat env vars are incomplete.",
  "Failed to persist user API entries to the cloud mirror.",
  "Rejected WeChat callback before code exchange",
  "Ignoring mismatched client-supplied credit amount",
  "Falling back to in-memory payment order repository",
]);

const suppressedStructuredErrorMessages = new Set([
  "WeChat callback failed",
]);

function readStructuredMessage(args) {
  const [firstArg] = args;
  if (typeof firstArg !== "string" || !firstArg.trim().startsWith("{")) {
    return null;
  }

  try {
    const payload = JSON.parse(firstArg);
    return typeof payload?.message === "string" ? payload.message : null;
  } catch {
    return null;
  }
}

function shouldSuppressConsoleText(args) {
  const joined = args.map((value) => String(value)).join(" ");
  return suppressedTextFragments.some((fragment) => joined.includes(fragment));
}

function shouldSuppressStructuredLog(args, allowedMessages) {
  const message = readStructuredMessage(args);
  return message ? allowedMessages.has(message) : false;
}

console.warn = (...args) => {
  if (shouldSuppressConsoleText(args) || shouldSuppressStructuredLog(args, suppressedStructuredWarningMessages)) {
    return;
  }

  originalConsoleWarn(...args);
};

console.error = (...args) => {
  if (shouldSuppressConsoleText(args) || shouldSuppressStructuredLog(args, suppressedStructuredErrorMessages)) {
    return;
  }

  originalConsoleError(...args);
};
