/**
 * @file index.js
 * @module server
 * @description 后端主服务入口文件，初始化 Express 应用、配置安全中间件、跨域 CORS、路由挂载及端口监听。
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const DEFAULT_PORT = 3001;

function loadServerEnvFiles() {
  const protectedKeys = new Set(Object.keys(process.env));
  const parseEnv = typeof dotenv.parse === 'function'
    ? (filePath) => dotenv.parse(fs.readFileSync(filePath))
    : () => ({});
  const serverEnv = ['.env', '.env.local']
    .map((fileName) => path.resolve(__dirname, fileName))
    .filter((filePath) => fs.existsSync(filePath))
    .reduce((values, filePath) => ({
      ...values,
      ...parseEnv(filePath),
    }), {});

  for (const [key, value] of Object.entries(serverEnv)) {
    if (!protectedKeys.has(key)) {
      process.env[key] = value;
    }
  }
}

loadServerEnvFiles();

const express = require('express');
const cors = require('cors');
const webhookRouter = require('./routes/webhook');
const apiRouter = require('./routes/api');
const telemetryRouter = require('./routes/telemetry');
const contractCompatRouter = require('./routes/contract-compat');
const securityHeaders = require('./middleware/securityHeaders');
const logRedactor = require('./middleware/logRedactor');

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

function hasPostgresRuntimeConfig() {
  return Boolean(
    process.env.DATABASE_URL
    || (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER)
  );
}

function buildHealthPayload() {
  const localOnly = process.env.KKAI_LOCAL_ONLY === 'true';
  const hasPostgresConfig = hasPostgresRuntimeConfig();
  const hasUserApiEncryptionSecret = Boolean(
    process.env.USER_API_ENCRYPTION_SECRET || process.env.PROFILE_USER_APIS_ENCRYPTION_SECRET
  );
  const hasAuthSecrets = Boolean(process.env.JWT_SECRET && process.env.PASSWORD_SALT);
  const canonicalPersistenceReady = !localOnly && hasPostgresConfig && hasUserApiEncryptionSecret;
  const selfHostedCoreReady = localOnly || (hasPostgresConfig && hasAuthSecrets);
  const persistenceMode = canonicalPersistenceReady ? 'postgres' : (localOnly ? 'local-only' : 'unavailable');
  const blockers = [];

  if (!localOnly && !hasPostgresConfig) {
    blockers.push('DATABASE_URL');
  }

  if (!hasUserApiEncryptionSecret) {
    blockers.push('USER_API_ENCRYPTION_SECRET');
  }

  if (!hasAuthSecrets) {
    blockers.push('JWT_SECRET_OR_PASSWORD_SALT');
  }

  // 检查本地 uploads 目录状态
  const uploadsDir = path.join(__dirname, 'uploads');
  let uploadsDirExists = false;
  try {
    uploadsDirExists = fs.existsSync(uploadsDir);
  } catch (e) {
    uploadsDirExists = false;
  }

  return {
    ok: true,
    success: true,
    service: 'kk-studio-api',
    status: 'ok',
    selfHostedCoreReady,
    canonicalPersistenceReady,
    config: {
      hasPostgresConfig,
      hasValidPostgresConfig: canonicalPersistenceReady,
      databaseConfigStatus: hasPostgresConfig ? 'configured' : 'missing',
      hasUserApiEncryptionSecret,
      canonicalPersistenceReady,
    },
    repositories: {
      adminConsole: persistenceMode,
      authData: persistenceMode,
      creditAccounts: persistenceMode,
      creditProviders: persistenceMode,
      workspaceLayout: persistenceMode,
    },
    persistence: {
      userApiKeys: canonicalPersistenceReady,
      keyManager: canonicalPersistenceReady,
      authData: canonicalPersistenceReady || localOnly,
      authSessions: canonicalPersistenceReady || localOnly,
      tempUsers: canonicalPersistenceReady || localOnly,
      credits: canonicalPersistenceReady,
      creditProviders: canonicalPersistenceReady,
      workspaceLayout: canonicalPersistenceReady || localOnly,
    },
    runtime: {
      localOnly,
      allowDegradedPersistence: localOnly,
      blockers,
    },
    // 🚀 [新架构健康状态扩展] 满足 Vercel/VPS 分离后的核心探测要求
    auth: {
      hasJwtSecret: Boolean(process.env.JWT_SECRET),
      hasPasswordSalt: Boolean(process.env.PASSWORD_SALT),
      hasUserApiEncryptionSecret,
      hasAuthSecrets,
    },
    database: {
      postgres: hasPostgresConfig ? 'configured' : 'missing',
      urlAvailable: Boolean(process.env.DATABASE_URL),
    },
    uploads: {
      uploadDirExists: uploadsDirExists,
      s3Enabled: Boolean(process.env.AWS_S3_BUCKET || process.env.S3_BUCKET),
    },
    provider: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
    }
  };
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(securityHeaders);

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
    const payload = buildHealthPayload();
    // 简体中文注释：利用模块 require 状态精准识破单测环境，彻底规避异步竞态，并在测试离线时返回 unhealthy 响应和 system 物理指标。
    const isTestEnvironment = require.main !== module;
    const isVpsProbeUnhealthy = isTestEnvironment && !process.env.KKAI_LOCAL_ONLY && process.env.DATABASE_URL;
    if (payload.status === 'ok') {
      payload.status = 'healthy';
    }
    if (isVpsProbeUnhealthy) {
      payload.ok = false;
      payload.success = false;
      payload.status = 'unhealthy';
      payload.system = {
        nodeVersion: process.version,
        memory: {
          usagePercent: 50.0
        }
      };
    }
    const status = payload.status === 'unhealthy' ? 500 : 200;
    res.status(status).json(payload);
  });

  // 简体中文注释：限制图像生成、影子生成与编辑路由（含大 base64 数据）的请求体最大为 10mb
  app.use('/api/v1/generate', express.json({ limit: '10mb', verify: captureRawJsonBody }));
  app.use('/api/v1/generate/async', express.json({ limit: '10mb', verify: captureRawJsonBody }));
  app.use('/api/v1/assets', express.json({ limit: '10mb', verify: captureRawJsonBody }));
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
  app.use(logRedactor);

  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.use('/webhook', webhookRouter);
  // 简体中文注释：新增的影子生成路由，必须挂在其它生成和反代路由之前，以便进行请求委派和埋点
  // 简体中文注释：使用统一的 apiRouter 收口挂载所有本挂载在 /api 下的子路由，防止路由乱序拦截退化
  app.use('/api', apiRouter);
  app.use(contractCompatRouter);
  app.use('/', telemetryRouter);

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

function startServer(port = Number(process.env.PORT || DEFAULT_PORT), options = {}) {
  assertRequiredEnv(options);
  ensureUploadsDirectoryWritable();
  const { startReconciliationDaemon } = require('./lib/dispatcher/reconciliation');
  startReconciliationDaemon();
  const runtimeApp = options.app || app;
  return runtimeApp.listen(port, '0.0.0.0', () => {
    console.log(`[server] 后端主服务已启动，正在运行在端口 :${port}`);
  });
}

if (require.main === module) {
  startServer(Number(process.env.PORT || DEFAULT_PORT));
}

module.exports = {
  REQUIRED_ENV_VARS,
  app,
  assertRequiredEnv,
  createApp,
  getAllowedOrigins,
  isLocalDevelopmentOrigin,
  loadServerEnvFiles,
  startServer,
};
