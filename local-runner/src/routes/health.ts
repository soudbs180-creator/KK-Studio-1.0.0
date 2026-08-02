import { Router } from 'express';

// 简体中文：健康探查路由 (Health Route)
const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'healthy',
    reachable: true,
    version: process.env.KK_LOCAL_RUNNER_VERSION || '1.0.0',
    service: 'KK Studio Local Runner',
    timestamp: new Date().toISOString()
  });
});

export default router;
