/**
 * @file index.js
 * @module server
 * @description 后端主服务入口文件，初始化 Express 应用、配置安全中间件、跨域 CORS、路由挂载及端口监听。
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const webhookRouter = require('./routes/webhook');
const generateImageRouter = require('./routes/generate-image');
const creditProviderRouter = require('./routes/credit-provider-router');
const userAiRouter = require('./routes/user-ai-router');
const adminRouter = require('./routes/admin');
const userRouter = require('./routes/user');
const chatRouter = require('./routes/chat');
const ocrRouter = require('./routes/ocr');
const aiAssistantRouter = require('./routes/ai-assistant');
const configRouter = require('./routes/config');
const providerProbeRouter = require('./routes/provider-probe');

const DEFAULT_ALLOWED_ORIGINS = [
  'https://kkai.plus',
  'https://www.kkai.plus',
];

const REQUIRED_ENV_VARS = [
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'JWT_SECRET',
  'PASSWORD_SALT',
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

function isTestRun() {
  return process.env.NODE_ENV === 'test' || process.argv.some((arg) => arg.includes('test'));
}

function assertRequiredEnv(options = {}) {
  if (options.skipConfigCheck === true || isTestRun()) {
    return;
  }

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      throw new Error(`[严重] 环境变量 ${key} 未配置，服务拒绝启动`);
    }
  }
}

function getAllowedOrigins() {
  const envOrigins = process.env.ALLOWED_ORIGINS || process.env.PAYMENT_ALLOWED_ORIGINS || '';
  const configuredOrigins = String(envOrigins)
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin && origin !== '*');

  return configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;
}

function isLocalDevelopmentOrigin(origin) {
  const normalizedOrigin = String(origin || '').trim();
  if (!normalizedOrigin) {
    return false;
  }

  try {
    const url = new URL(normalizedOrigin);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const isLoopback = hostname === 'localhost' || hostname === '::1' || hostname.startsWith('127.');
    const isPrivateNetwork =
      /^10\./.test(hostname)
      || /^192\.168\./.test(hostname)
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
      || /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(hostname)
      || /^169\.254\./.test(hostname);

    // 简体中文注释：手机浏览器调试常从局域网 IP 访问桌面开发机，只在非生产环境放行私网 Origin。
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && (isLoopback || (process.env.NODE_ENV !== 'production' && isPrivateNetwork));
  } catch {
    return false;
  }
}

function captureRawJsonBody(req, _res, buf) {
  if (buf && buf.length > 0) {
    req.rawBody = buf.toString('utf8');
  }
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    if (!req.path.startsWith('/webhook/stripe')) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
    next();
  });

  const allowedOrigins = new Set(getAllowedOrigins().map((origin) => origin.toLowerCase()));
  app.use(cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = String(origin).toLowerCase();
      callback(null, allowedOrigins.has(normalizedOrigin) || isLocalDevelopmentOrigin(origin));
    },
    credentials: true,
    exposedHeaders: ['X-Refresh-Token'],
  }));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'kk-api' });
  });

  // 简体中文注释：限制图像生成与编辑路由（含大 base64 数据）的请求体最大为 10mb
  app.use('/api/generate-image', express.json({ limit: '10mb', verify: captureRawJsonBody }));
  app.use('/api/generate/image', express.json({ limit: '10mb', verify: captureRawJsonBody }));
  app.use('/api/generate/edit', express.json({ limit: '10mb', verify: captureRawJsonBody }));

  // 简体中文注释：限制其它所有 API 和 Webhook 路由请求体最大为 1mb，防止内存耗尽攻击
  app.use((req, res, next) => {
    if (req.body !== undefined) {
      return next();
    }
    express.json({ limit: '1mb', verify: captureRawJsonBody })(req, res, next);
  });
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.use('/webhook', webhookRouter);
  // 简体中文注释：用户自带 Key 的新 AI Router 必须挂在 legacy userRouter 前；只接管 mode=chat，其它模式 next() 回落旧逻辑。
  app.use('/api', userAiRouter);
  app.use('/api', userRouter);
  // 简体中文注释：AI Router 新保存入口必须挂在 legacy adminRouter 之前，否则旧路由会吞掉 requestProfileId/routeStrategy。
  app.use('/api', creditProviderRouter);
  app.use('/api', adminRouter);
  app.use('/api', providerProbeRouter);
  app.use('/api', chatRouter);
  app.use('/api', generateImageRouter);
  app.use('/api', ocrRouter);
  app.use('/api', aiAssistantRouter);
  app.use('/api', configRouter);

  app.use((err, _req, res, _next) => {
    console.error('[server] request failed:', err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found or legacy route disabled.' });
  });

  return app;
}

const app = createApp();

/**
 * 强校验 uploads 目录的可写性，防范生产环境 VPS 上由于权限缺失导致图片落盘失败的事故。
 */
function ensureUploadsDirectoryWritable() {
  if (isTestRun()) {
    return;
  }
  const uploadsDir = path.join(__dirname, 'uploads');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    // 简体中文注释：写入临时测试文件以确认物理磁盘具有写权限
    const testFile = path.join(uploadsDir, `.write-test-${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (err) {
    const isProd = process.env.NODE_ENV === 'production';
    const msg = `[严重] uploads 目录 '${uploadsDir}' 无法写入，请检查生产环境 VPS 的目录写权限。错误: ${err.message}`;
    if (isProd) {
      throw new Error(msg);
    } else {
      console.warn(`[警告] 本地开发环境 uploads 目录可写性测试失败（可能是由于安全软件锁定），已跳过致命阻断。具体错误: ${err.message}`);
    }
  }
}

function startServer(port = Number(process.env.PORT || 8080), options = {}) {
  assertRequiredEnv(options);
  ensureUploadsDirectoryWritable();
  const { startReconciliationDaemon } = require('./lib/dispatcher/reconciliation');
  startReconciliationDaemon();
  const runtimeApp = options.app || app;
  return runtimeApp.listen(port, () => {
    console.log(`[server] 后端主服务已启动，正在运行在端口 :${port}`);
  });
}

if (require.main === module) {
  startServer(Number(process.env.PORT || 8080));
}

module.exports = {
  REQUIRED_ENV_VARS,
  app,
  assertRequiredEnv,
  createApp,
  getAllowedOrigins,
  isLocalDevelopmentOrigin,
  startServer,
};
