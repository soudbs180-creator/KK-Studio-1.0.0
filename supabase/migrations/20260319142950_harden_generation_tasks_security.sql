DROP POLICY IF EXISTS generation_tasks_select_own ON public.generation_tasks;
CREATE POLICY generation_tasks_select_own
    ON public.generation_tasks
    FOR SELECT
    TO authenticated
    USING (
        (SELECT auth.uid()) = user_id
        AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
    );

DROP POLICY IF EXISTS generation_tasks_insert_own ON public.generation_tasks;
CREATE POLICY generation_tasks_insert_own
    ON public.generation_tasks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
    );

DROP POLICY IF EXISTS generation_tasks_update_own ON public.generation_tasks;
CREATE POLICY generation_tasks_update_own
    ON public.generation_tasks
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT auth.uid()) = user_id
        AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
    )
    WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
    );

DROP POLICY IF EXISTS generation_tasks_delete_own ON public.generation_tasks;
CREATE POLICY generation_tasks_delete_own
    ON public.generation_tasks
    FOR DELETE
    TO authenticated
    USING (
        (SELECT auth.uid()) = user_id
        AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
    );

CREATE OR REPLACE FUNCTION public.set_generation_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;
