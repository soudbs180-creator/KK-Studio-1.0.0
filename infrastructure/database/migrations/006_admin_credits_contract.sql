-- 6. 补齐管理后台与积分审计所需的数据库契约
-- 中文注释：这些字段和表是后端安全校验、动态定价和积分流水强审计的基础，必须通过迁移统一管理。

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS admin_level INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.api_cost_config (
  operation_key VARCHAR(100) PRIMARY KEY, -- 操作唯一键，后端只按 key 动态读取价格
  operation_name VARCHAR(100) NOT NULL, -- 管理后台展示名称
  cost BIGINT NOT NULL CHECK (cost >= 0), -- 单次操作积分成本，禁止负数价格
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credit_logs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id VARCHAR(255) REFERENCES public.users(id), -- 积分归属用户
  delta BIGINT NOT NULL, -- 积分变动值，扣减为负数，增加为正数
  reason VARCHAR(100) NOT NULL, -- 变动原因枚举，如 ai_deduct、ai_refund、stripe_webhook、admin_adjust
  operation_key VARCHAR(255), -- 业务操作 key 或外部流水号
  balance_after BIGINT NOT NULL, -- 变动后的余额快照
  actor_id VARCHAR(255), -- 实际操作者，系统回调可为空
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.credit_logs ADD COLUMN IF NOT EXISTS actor_id VARCHAR(255);

INSERT INTO public.api_cost_config (operation_key, operation_name, cost, is_active) VALUES
('image_generation', '图像生成', 10, TRUE),
('image_edit', '图像编辑', 15, TRUE),
('chat', '智能对话', 1, TRUE)
ON CONFLICT (operation_key) DO NOTHING;
