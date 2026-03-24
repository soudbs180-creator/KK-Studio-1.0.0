DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_namespace
        WHERE nspname = 'cron'
    ) AND EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n
          ON n.oid = c.relnamespace
        WHERE n.nspname = 'cron'
          AND c.relname = 'job'
          AND c.relkind = 'r'
    ) THEN
        DROP POLICY IF EXISTS cron_job_policy ON cron.job;

        CREATE POLICY cron_job_policy
            ON cron.job
            FOR ALL
            TO postgres, supabase_admin
            USING (username = CURRENT_USER);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n
          ON n.oid = c.relnamespace
        WHERE n.nspname = 'cron'
          AND c.relname = 'job_run_details'
          AND c.relkind = 'r'
    ) THEN
        DROP POLICY IF EXISTS cron_job_run_details_policy ON cron.job_run_details;

        CREATE POLICY cron_job_run_details_policy
            ON cron.job_run_details
            FOR ALL
            TO postgres, supabase_admin
            USING (username = CURRENT_USER);
    END IF;
END
$$;
