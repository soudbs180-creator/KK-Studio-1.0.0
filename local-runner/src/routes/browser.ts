import { Router } from 'express';
import { browserBridgeService } from '../services/browserBridgeService';
import { localToken } from '../security/localToken';

// 简体中文：获取与管理 Chrome 会话路由 (Browser Sessions Route)
const router = Router();

router.get('/sessions', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  if (!localToken.validate(authHeader)) {
    return res.status(401).send('Unauthorized: Invalid local token.');
  }

  try {
    const sessions = await browserBridgeService.getActiveSessions();
    res.json(sessions);
  } catch (e: any) {
    res.status(500).send(e.message);
  }
});

export default router;
