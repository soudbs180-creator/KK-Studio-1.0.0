import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { OpencliCommandSchema } from '../contracts/opencli';
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
    return res.status(401).json({
      error: { code: 'INVALID_LOCAL_TOKEN', message: 'Local Runner authentication failed.' },
    });
  }

  const parsedCommand = OpencliCommandSchema.safeParse(req.body);
  if (!parsedCommand.success) {
    return res.status(400).json({
      error: { code: 'INVALID_COMMAND', message: 'Local Runner command is invalid.' },
    });
  }

  const { kind, target, payload } = parsedCommand.data;
  const logId = `audit_${randomUUID()}`;

  // 2. 协议动作白名单校验
  if (!commandAllowlist.validateCommand(kind)) {
    localAuditLogService.log(logId, kind, 'high', target, 'blocked', {
      errorCode: 'COMMAND_NOT_ALLOWED',
    });
    return res.status(400).json({
      error: { code: 'COMMAND_NOT_ALLOWED', message: 'Local Runner command is not allowed.' },
    });
  }

  // 3. 敏感及高风险动作校验
  if (!permissionPolicy.authorize(kind, req.headers)) {
    localAuditLogService.log(logId, kind, 'high', target, 'blocked', {
      errorCode: 'USER_CONFIRMATION_REQUIRED',
    });
    return res.status(403).json({
      error: {
        code: 'USER_CONFIRMATION_REQUIRED',
        message: 'Local Runner requires an explicit user confirmation.',
      },
    });
  }

  // 4. 执行指令并记录日志
  try {
    const risk = permissionPolicy.evaluateRisk(kind);
    localAuditLogService.log(logId, kind, risk, target, 'pending');

    const result = await opencliService.executeCommand({ kind, target, payload, logId });
    
    localAuditLogService.log(logId, kind, risk, target, 'success', {
      resultStatus: result.status,
    });
    res.json({
      id: logId,
      status: 'success',
      summary: result.summary,
      data: result.data
    });
  } catch (error: unknown) {
    localAuditLogService.log(logId, kind, 'medium', target, 'failed', {
      errorCode: 'LOCAL_EXECUTION_FAILED',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    res.status(500).json({
      error: {
        code: 'LOCAL_EXECUTION_FAILED',
        message: 'Local Runner could not complete the command.',
      },
    });
  }
});

export default router;
