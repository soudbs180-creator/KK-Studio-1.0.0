// payment-server/index.js
// 职责：启动 VPS 支付接收端 Web 服务。
// 根据收敛计划，此服务仅负责托管 Stripe Webhook (路由为 /webhook/stripe)。
// 下线所有已废弃的 alipay、wechat 兼容路由及 nickname 查询接口，以消除支付安全隐患。
// 遵守规范：所有代码和变更使用中文注释，对外英文报错脱敏。

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const webhookRouter = require('./webhook');

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
 * 获取可信的前端跨域源列表
 */
function getAllowedOrigins() {
  const configuredOrigins = String(process.env.PAYMENT_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;
}

function captureRawJsonBody(req, _res, buf) {
  if (!buf || !buf.length) {
    return;
  }
  // 必须保留原始 rawBody 用于 Stripe Webhook 签名验证
  req.rawBody = buf.toString('utf8');
}

const app = express();
app.disable('x-powered-by');

// 配置 CORS 跨域规则
const allowedOrigins = new Set(getAllowedOrigins().map((origin) => origin.toLowerCase()));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has('*')) {
      callback(null, true);
      return;
    }
    callback(null, allowedOrigins.has(String(origin).toLowerCase()));
  },
  credentials: true,
}));

// 配置解析中间件，必须 verify 钩子获取原始 rawBody，否则 Stripe 签名验证会失败
app.use(express.json({ verify: captureRawJsonBody }));
app.use(express.urlencoded({ extended: true }));

// 唯一挂载点：Stripe Webhook 支付回调路由（最终形成 /webhook/stripe 端点）
app.use('/webhook', webhookRouter);

// 兜底 404 路由
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found or legacy route disabled.' });
});

// 监听端口启动服务
const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.log(`[payment-server] 充值结算服务已就绪，正在运行在端口 :${PORT}`);
});
