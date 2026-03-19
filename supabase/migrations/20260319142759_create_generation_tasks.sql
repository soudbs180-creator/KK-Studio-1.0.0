-- 创建异步生成任务表，用于页面刷新后恢复任务查询
CREATE TABLE IF NOT EXISTS public.generation_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL, -- API 返回的任务 ID
    task_type TEXT NOT NULL CHECK (task_type IN ('image', 'video', 'audio')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

    -- 生成参数
    prompt TEXT,
    model TEXT,
    aspect_ratio TEXT,
    image_size TEXT,

    -- 结果数据
    result_urls TEXT[] NOT NULL DEFAULT '{}'::TEXT[], -- 生成的图片/视频 URL 数组
    error_message TEXT,

    -- 计费信息
    cost NUMERIC(10, 4),
    tokens INTEGER,

    -- 关联信息
    canvas_id TEXT,
    prompt_node_id TEXT,

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    CONSTRAINT generation_tasks_user_task_unique UNIQUE (user_id, task_id)
);

-- 创建索引加速恢复查询和清理任务
CREATE INDEX IF NOT EXISTS idx_generation_tasks_user_status_created_at
    ON public.generation_tasks (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_tasks_created_at
    ON public.generation_tasks (created_at);

-- 启用 RLS
ALTER TABLE public.generation_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS generation_tasks_select_own ON public.generation_tasks;
CREATE POLICY generation_tasks_select_own
    ON public.generation_tasks
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS generation_tasks_insert_own ON public.generation_tasks;
CREATE POLICY generation_tasks_insert_own
    ON public.generation_tasks
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS generation_tasks_update_own ON public.generation_tasks;
CREATE POLICY generation_tasks_update_own
    ON public.generation_tasks
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS generation_tasks_delete_own ON public.generation_tasks;
CREATE POLICY generation_tasks_delete_own
    ON public.generation_tasks
    FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- 自动更新 updated_at
DROP FUNCTION IF EXISTS public.set_generation_tasks_updated_at();
CREATE FUNCTION public.set_generation_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generation_tasks_set_updated_at ON public.generation_tasks;
CREATE TRIGGER trg_generation_tasks_set_updated_at
    BEFORE UPDATE ON public.generation_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_generation_tasks_updated_at();

-- 清理旧任务函数（保留最近 30 天）
CREATE OR REPLACE FUNCTION public.cleanup_old_generation_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.generation_tasks
    WHERE created_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_generation_tasks() FROM PUBLIC;

-- 启用定时清理任务
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cleanup-old-generation-tasks'
  AND username = current_user;

SELECT cron.schedule(
    'cleanup-old-generation-tasks',
    '17 4 * * *',
    $$SELECT public.cleanup_old_generation_tasks();$$
);
