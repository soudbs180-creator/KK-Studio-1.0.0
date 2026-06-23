/**
 * @file generate-v1.js
 * @module server/routes
 * @description 新增的同步与异步生成影子入口路由模块。
 *              作为统一入口的前哨，在 S0/S1 增量阶段，采用内部路由重定向技术透明桥接现有对话、画图、自带 Key 等所有端点。
 */

const express = require('express');
const { verifyJWT } = require('../lib/jwt');
const metricsCollector = require('../lib/dispatcher/metricsCollector');

const router = express.Router();

function requireAuth(req, res, next) {
  const userId = verifyJWT(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized.', code: 'UNAUTHORIZED' });
  }
  req.userId = userId;
  next();
}

// 影子同步生成收口端点
router.post('/v1/generate', requireAuth, (req, res, next) => {
  const startTime = Date.now();
  const taskType = req.body?.task_type || req.body?.taskType;
  const isChat = taskType === 'chat' || Array.isArray(req.body?.messages);
  const routeId = req.body?.routeId || req.headers['x-key-slot-id'];

  // 重写 json 响应以注入埋点统计
  const oldJson = res.json;
  res.json = function(data) {
    const success = res.statusCode >= 200 && res.statusCode < 300 && !(data && data.success === false);
    metricsCollector.recordRouteCall({
      routePath: '/api/v1/generate',
      success,
      latency: Date.now() - startTime
    });
    return oldJson.apply(res, arguments);
  };

  if (routeId) {
    // 1. 自带 Key 模式，重定向到通用自带 Key 代理端点
    req.url = '/v1/model-proxy/user';
  } else if (isChat) {
    // 2. 平台积分对话，重定向到 /chat
    req.url = '/chat';
  } else {
    // 3. 平台积分生图，重定向到 /generate-image
    req.url = '/generate-image';
  }

  next();
});

// 影子异步生成与轮询状态收口端点
router.post('/v1/generate/async', requireAuth, (req, res, next) => {
  const startTime = Date.now();

  const oldJson = res.json;
  res.json = function(data) {
    const success = res.statusCode >= 200 && res.statusCode < 300 && !(data && data.success === false);
    metricsCollector.recordRouteCall({
      routePath: '/api/v1/generate/async',
      success,
      latency: Date.now() - startTime
    });
    return oldJson.apply(res, arguments);
  };

  // 异步影子入口，直接重定向到自带 Key 代理路由执行（因为视频/音频/异步任务均由自带 Key 路由承载）
  req.url = '/v1/model-proxy/user';
  next();
});

module.exports = router;
