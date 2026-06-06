-- 12. 简体中文：创建计费任务单表，以支持二阶段 Saga 补偿性最终一致性退款机制
-- 遵守 AGENTS 项目规范：所有代码和迁移文件必须使用中文注释说明用途。
CREATE TABLE IF NOT EXISTS public.billing_jobs (
  id VARCHAR(255) PRIMARY KEY, -- 对应 AI 派发请求的唯一交易或请求 ID (requestId 或是 attemptId)
  user_id VARCHAR(255) REFERENCES public.users(id) ON DELETE CASCADE, -- 关联的用户 ID
  operation_key VARCHAR(100) NOT NULL, -- 计费对应的操作键 (例如 'image_generation' 或是 'chat')
  required_credits BIGINT NOT NULL, -- 锁定扣除的积分额度
  status VARCHAR(50) NOT NULL, -- 状态机状态: draft(任务单起草), pending_deducted(已扣积分待通信), completed(执行成功), refunded(失败已安全退回), failed(扣减成功但通信及退款皆失败，须人工介入)
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
