// server/index.js
// 职责：后端主服务的启动入口文件，挂载全部路由与全局中间件。
// 遵守规范：代码和变更使用中文注释，对外英文报错脱敏。

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// 确保在系统启动时强校验环境变量，缺一不可（以快速失败模式退出进程，测试用例运行时除外）
const isTestRun = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('test'));
if (!isTestRun) {
  const REQUIRED_ENV_VARS = [
    "GEMINI_API_KEY",
    "JWT_SECRET",
    "DATABASE_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
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

// 允许的前端 CORS 源白名单列表
const DEFAULT_ALLOWED_ORIGINS = [
  'https://kkai.plus',
  'https://www.kkai.plus',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8888',
  'http://127.0.0.1:8888',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

/**
 * 从环境变量动态读取或使用默认白名单
 */
function getAllowedOrigins() {
  const configuredOrigins = String(process.env.PAYMENT_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;
}

/**
 * 捕获传入的原始 rawBody 缓冲区内容并挂载到 req 上，主要供 Stripe Webhook 验签使用
 */
function captureRawJsonBody(req, _res, buf) {
  if (!buf || !buf.length) {
    return;
  }
  req.rawBody = buf.toString('utf8');
}

const app = express();
app.disable('x-powered-by'); // 安全加固，隐藏 Express 标志

// 配置 CORS 跨域规则，非通配符方式，以满足携带 cookie/credentials 时的跨域安全要求
const allowedOrigins = new Set(getAllowedOrigins().map((origin) => origin.toLowerCase()));
app.use(cors({
  origin(origin, callback) {
    // 浏览器没有传 origin（如内部服务调用、Postman 或是 Curl 发起的请求），直接放行
    if (!origin || allowedOrigins.has('*')) {
      callback(null, true);
      return;
    }
    callback(null, allowedOrigins.has(String(origin).toLowerCase()));
  },
  credentials: true,
}));

// 应用解析中间件，通过 verify 钩子自动暂存 rawBody 用于签名校验
app.use(express.json({ verify: captureRawJsonBody }));
app.use(express.urlencoded({ extended: true }));

// 挂载 Stripe Webhook 路由：最终挂载在 /webhook/stripe 端点上
app.use('/webhook', webhookRouter);

// 挂载图像生成路由：最终挂载在 /api/generate-image 端点上
app.use('/api', generateImageRouter);

// 404 兜底响应
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found or legacy route disabled.' });
});

// 服务端口监听
const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.log(`[server] 后端主服务已就绪，正在运行在端口 :${PORT}`);
});
