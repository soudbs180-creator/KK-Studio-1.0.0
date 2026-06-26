import { Router } from 'express';

// 简体中文：健康探查路由 (Health Route)
const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'healthy',
    reachable: true,
    version: '1.5.9',
    service: 'KK Studio Local Runner',
    timestamp: new Date().toISOString()
  });
});

export default router;
