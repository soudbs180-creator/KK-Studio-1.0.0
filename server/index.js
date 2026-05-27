// server/index.js
// 职责：后端主服务入口，集中挂载全局安全中间件和业务路由。

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const isTestRun = process.env.NODE_ENV === 'test' || process.argv.some((arg) => arg.includes('test'));

if (!isTestRun) {
  const REQUIRED_ENV_VARS = [
    'GEMINI_API_KEY',
    'OPENAI_API_KEY',
    'JWT_SECRET',
    'PASSWORD_SALT',
    'DATABASE_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ];

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      throw new Error(`[严重] 环境变量 ${key} 未配置，服务拒绝启动`);
    }
  }
}

const express = require('express');
const cors = require('cors');
const webhookRouter = require('./routes/webhook');
const generateImageRouter = require('./routes/generate-image');
const adminRouter = require('./routes/admin');
const userRouter = require('./routes/user');

const DEFAULT_ALLOWED_ORIGINS = [
  'https://kkai.plus',
  'https://www.kkai.plus',
];

function getAllowedOrigins() {
  const configuredOrigins = String(process.env.PAYMENT_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin && origin !== '*');

  return configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;
}

function isLocalDevelopmentOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(origin || ''));
}

function captureRawJsonBody(req, _res, buf) {
  if (buf && buf.length > 0) {
    req.rawBody = buf.toString('utf8');
  }
}

const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  if (!req.path.startsWith('/webhook/stripe')) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
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

app.use(express.json({ verify: captureRawJsonBody }));
app.use(express.urlencoded({ extended: true }));

app.use('/webhook', webhookRouter);
app.use('/api', userRouter);
app.use('/api', adminRouter);
app.use('/api', generateImageRouter);

app.use((err, _req, res, _next) => {
  console.error('[server] request failed:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found or legacy route disabled.' });
});

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.log(`[server] 后端主服务已启动，正在运行在端口 :${PORT}`);
});
