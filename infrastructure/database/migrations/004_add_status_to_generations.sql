-- 4. 增加 generations 表的 status 字段，并允许 type 为空或保留默认值，以兼容新版积分机制下的生成日志
-- 中文注释：此迁移用于为 generations 表增加 status 字段以保存生成成功/失败状态，同时设置 type 字段的默认值为 'image_generation'
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE public.generations ALTER COLUMN type DROP NOT NULL;
ALTER TABLE public.generations ALTER COLUMN type SET DEFAULT 'image_generation';
