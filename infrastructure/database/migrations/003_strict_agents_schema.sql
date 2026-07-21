-- 新增前进迁移：用户、生成历史、订单、服务端定价方案
-- 遵守 AGENTS 项目规范：所有代码和迁移文件必须使用中文注释说明用途。

-- 1. 用户表：管理登录凭证和积分余额
CREATE TABLE IF NOT EXISTS public.users (
  id VARCHAR(255) PRIMARY KEY, -- 用户唯一 ID
  email VARCHAR(255) UNIQUE NOT NULL, -- 邮箱（唯一）
  password_hash VARCHAR(255) NOT NULL, -- 密码哈希
  credits BIGINT NOT NULL DEFAULT 100, -- 用户的可用积分余额，默认赠送 100 积分
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 2. 服务端定价方案表：定义 Stripe Price ID 及其对应的价格和赠送积分额度
CREATE TABLE IF NOT EXISTS public.plans (
  id VARCHAR(255) PRIMARY KEY, -- Stripe Price ID (例如 price_xxx) 或自定义方案标识
  name VARCHAR(100) NOT NULL, -- 方案名称
  amount_cents INTEGER NOT NULL, -- 方案实际金额 (以分为单位，防止浮点数精度丢失)
  credits BIGINT NOT NULL, -- 该定价方案所包含的积分额度，防篡改关键
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 3. 订单表：记录充值流水和 Stripe 支付状态
CREATE TABLE IF NOT EXISTS public.orders (
  id VARCHAR(255) PRIMARY KEY, -- 订单唯一标识，防重放
  user_id VARCHAR(255) REFERENCES public.users(id), -- 关联的用户 ID
  stripe_session_id VARCHAR(255) UNIQUE, -- Stripe Checkout Session ID，做幂等校验
  plan_id VARCHAR(255) REFERENCES public.plans(id), -- 关联的方案 ID
  amount_cents INTEGER NOT NULL, -- 实付金额 (分)
  credits BIGINT NOT NULL, -- 应该增加的积分，按 plan 的服务端配置结算
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 订单状态 (pending: 待付, completed: 成功, failed: 失败)
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 4. 生成历史表：用于记录多模态图像生成/编辑的历史记录
CREATE TABLE IF NOT EXISTS public.generations (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id VARCHAR(255) REFERENCES public.users(id), -- 关联的用户 ID
  prompt TEXT NOT NULL, -- 生成/编辑时的提示词
  image_url TEXT, -- 图像的 base64 文本数据或存储的 URL 路径
  model VARCHAR(100) NOT NULL, -- 生成所用的具体模型名
  type VARCHAR(50) NOT NULL, -- 生成动作类型 (image_generation 或 image_edit)
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 5. 初始化三个标准的服务端套餐配置
INSERT INTO public.plans (id, name, amount_cents, credits) VALUES
('price_basic_100', '基础套餐', 990, 100) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plans (id, name, amount_cents, credits) VALUES
('price_premium_500', '高级套餐', 3990, 500) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plans (id, name, amount_cents, credits) VALUES
('price_enterprise_1500', '企业套餐', 9990, 1500) ON CONFLICT (id) DO NOTHING;
