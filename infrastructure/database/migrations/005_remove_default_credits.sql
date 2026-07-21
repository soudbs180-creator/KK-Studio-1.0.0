-- 5. 修改 users 表的 credits 默认值为 0
-- 中文注释：此迁移用于将 users 表的默认赠送积分变更为 0，使新用户注册时默认不赠送积分。
ALTER TABLE public.users ALTER COLUMN credits SET DEFAULT 0;
