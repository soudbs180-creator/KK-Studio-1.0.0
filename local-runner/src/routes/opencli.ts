import { Router } from 'express';
import { localToken } from '../security/localToken';
import { commandAllowlist } from '../security/commandAllowlist';
import { permissionPolicy } from '../security/permissionPolicy';
import { opencliService } from '../services/opencliService';
import { localAuditLogService } from '../services/localAuditLogService';

// 简体中文：OpenCLI 指令分发执行路由 (OpenCLI Execution Route)
const router = Router();

router.post('/execute', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  
  // 1. 本地双向凭证校验
  if (!localToken.validate(authHeader)) {
    return res.status(401).send('Unauthorized: Invalid local token.');
  }

  const { kind, target, payload } = req.body;
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 2. 指令及 Shell 注入校验
  if (!commandAllowlist.validateCommand(kind, target, payload)) {
    localAuditLogService.log(logId, kind, 'high', target || '', 'blocked', { error: 'Command blocked by Allowlist/Injection check.' });
    return res.status(400).send('Bad Request: Command blocked by safety policy.');
  }

  // 3. 敏感及高风险动作校验
  if (!permissionPolicy.authorize(kind, req.headers)) {
    localAuditLogService.log(logId, kind, 'high', target || '', 'blocked', { error: 'Action unauthorized by Permission Policy.' });
    return res.status(403).send('Forbidden: Risk evaluation blocked this action without user gesture.');
  }

  // 4. 执行指令并记录日志
  try {
    const risk = permissionPolicy.evaluateRisk(kind);
    localAuditLogService.log(logId, kind, risk, target || '', 'pending');

    const result = await opencliService.executeCommand({ kind, target, payload, logId });
    
    localAuditLogService.log(logId, kind, risk, target || '', 'success', result);
    res.json({
      id: logId,
      status: 'success',
      summary: result.summary,
      data: result.data
    });
  } catch (e: any) {
    localAuditLogService.log(logId, kind, 'medium', target || '', 'failed', { error: e.message });
    res.status(500).send(e.message || 'Execution error');
  }
});

export default router;
