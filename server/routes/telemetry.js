/**
 * @file telemetry.js
 * @module server/routes
 * @description AI Router 监控指标与健康检查路由。提供 /v1/health 与 /v1/metrics。
 */

const express = require('express');
const { getPool } = require('../lib/db');
const localUserRouteStore = require('../lib/dispatcher/localUserRouteStore');
const metricsCollector = require('../lib/dispatcher/metricsCollector');
const dispatcher = require('../lib/dispatcher/index');

const router = express.Router();

// GET /v1/health 健康检查
router.get('/v1/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    details: {
      database: 'unknown',
      localStorage: 'unknown',
    },
  };

  let hasError = false;

  // 1. 测试数据库连接
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    health.details.database = 'connected';
  } catch (err) {
    hasError = true;
    health.details.database = `error: ${err.message}`;
  }

  // 2. 测试本地存储 local-user-apis.json 的可读写性
  try {
    const data = await localUserRouteStore.readLocalStorage();
    // 幂等写回以验证写权限
    await localUserRouteStore.writeLocalStorage(data);
    health.details.localStorage = 'writable';
  } catch (err) {
    hasError = true;
    health.details.localStorage = `error: ${err.message}`;
  }

  if (hasError) {
    health.status = 'unhealthy';
    return res.status(500).json(health);
  }

  return res.json(health);
});

// GET /v1/metrics 性能指标
router.get('/v1/metrics', (req, res) => {
  const metrics = metricsCollector.getMetrics();
  const breakerStatus = dispatcher.getCircuitBreakerStatus();

  return res.json({
    success: true,
    data: {
      ...metrics,
      circuitBreaker: breakerStatus,
    },
  });
});

module.exports = router;
