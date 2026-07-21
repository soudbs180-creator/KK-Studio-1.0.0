-- 8. 在 admin_credit_models 表中增加 provider_kind 列，区分官方与中转站
-- 中文注释：此字段用于实现管理后台和用户侧一致的官方/中转站双入口供应商模型。
ALTER TABLE public.admin_credit_models ADD COLUMN IF NOT EXISTS provider_kind text NOT NULL DEFAULT 'relay';

-- 对现有的官方直连数据进行 backfill 修复（比如名称包含 Google 或者是 OpenAI 的，将其 provider_kind 改为 official）
UPDATE public.admin_credit_models 
SET provider_kind = 'official' 
WHERE provider_id ILIKE '%google%' 
   OR provider_id ILIKE '%openai%' 
   OR provider_id ILIKE '%gemini%' 
   OR provider_name ILIKE '%google%' 
   OR provider_name ILIKE '%openai%' 
   OR provider_name ILIKE '%gemini%' 
   OR provider_name ILIKE '%claude%' 
   OR provider_name ILIKE '%deepseek%' 
   OR provider_name ILIKE '%qwen%' 
   OR provider_name ILIKE '%kimi%';
