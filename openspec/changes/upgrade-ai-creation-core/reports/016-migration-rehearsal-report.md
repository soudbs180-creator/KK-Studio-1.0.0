# 016 PostgreSQL Migration Rehearsal Report
Host: 172.245.156.16
Database: kkstudio_rehearsal_016
PostgreSQL version: 17.9 (Debian)
Scripts run: bootstrap + 16 migrations

## Procedure
1. Created isolated database `kkstudio_rehearsal_016` and user `kkstudio_rehearsal`.
2. Enabled `uuid-ossp` and `pgcrypto` extensions.
3. Ran `scripts/postgres/bootstrap-kk-vps.sql` as the base schema.
4. Ran migrations 001-016 in order with `ON_ERROR_STOP=1`.

## Migration Results
- bootstrap-kk-vps.sql: OK
  Notice/Error: psql:/tmp/kkstudio_rehearsal_016/bootstrap-kk-vps.sql:3: NOTICE:  extension "pgcrypto" already exists, skipping
psql:/tmp/kkstudio_rehearsal_016/bootstrap-kk-vps.sql:191: NOTICE:  column "visibility" 
- 001_points_schema.sql: OK
- 002_token_schema.sql: OK
- 003_strict_agents_schema.sql: OK
- 004_add_status_to_generations.sql: OK
- 005_remove_default_credits.sql: OK
- 006_admin_credits_contract.sql: OK
  Notice/Error: psql:/tmp/kkstudio_rehearsal_016/006_admin_credits_contract.sql:25: NOTICE:  column "actor_id" of relation "credit_logs" already exists, skipping
- 007_admin_credit_models.sql: OK
  Notice/Error: psql:/tmp/kkstudio_rehearsal_016/007_admin_credit_models.sql:3: NOTICE:  extension "pgcrypto" already exists, skipping
psql:/tmp/kkstudio_rehearsal_016/007_admin_credit_models.sql:31: NOTICE:  relatio
- 008_add_provider_kind.sql: OK
- 009_admin_level_check_constraint.sql: OK
- 010_orders_positive_credits_constraint.sql: OK
- 011_ai_assistant_tables.sql: OK
  Notice/Error: psql:/tmp/kkstudio_rehearsal_016/011_ai_assistant_tables.sql:13: NOTICE:  relation "agent_runs" already exists, skipping
psql:/tmp/kkstudio_rehearsal_016/011_ai_assistant_tables.sql:27: NOTICE:  relat
- 012_billing_jobs_saga.sql: OK
- 013_password_reset_tokens.sql: OK
- 014_vps_security_and_jobs.sql: OK
- 015_unified_media_generation_jobs.sql: OK
  Notice/Error: psql:/tmp/kkstudio_rehearsal_016/015_unified_media_generation_jobs.sql:38: NOTICE:  column "user_id" of relation "agent_runs" already exists, skipping
psql:/tmp/kkstudio_rehearsal_016/015_unified_medi
- 016_ai_assistant_user_scope.sql: OK
  Notice/Error: psql:/tmp/kkstudio_rehearsal_016/016_ai_assistant_user_scope.sql:53: NOTICE:  column "user_id" of relation "agent_runs" already exists, skipping
psql:/tmp/kkstudio_rehearsal_016/016_ai_assistant_user_

## Verification Results
### Tables after bootstrap + migrations
```
 schemaname |         tablename         | tableowner 
------------+---------------------------+------------
 public     | admin_auth                | postgres
 public     | admin_credit_models       | postgres
 public     | admin_sessions            | postgres
 public     | agent_memory              | postgres
 public     | agent_runs                | postgres
 public     | agent_skill_versions      | postgres
 public     | agent_skills              | postgres
 public     | agent_tool_calls          | postgres
 public     | api_cost_config           | postgres
 public     | billing_jobs              | postgres
 public     | canvas_nodes              | postgres
 public     | canvas_runtime_snapshots  | postgres
 public     | credit_exchange_rates     | postgres
 public     | credit_logs               | postgres
 public     | credit_transactions       | postgres
 public     | external_identities       | postgres
 public     | generation_jobs           | postgres
 public     | generation_tasks          | postgres
 public     | generations               | postgres
 public     | knowledge_chunks          | postgres
 public     | knowledge_documents       | postgres
 public     | orders                    | postgres
 public     | password_identities       | postgres
 public     | password_reset_tokens     | postgres
 public     | payment_callbacks         | postgres
 public     | payment_orders            | postgres
 public     | plans                     | postgres
 public     | profiles                  | postgres
 public     | provider_pricing_cache    | postgres
 public     | recharge_submissions      | postgres
 public     | temp_users                | postgres
 public     | user_credits              | postgres
 public     | user_provider_credentials | postgres
 public     | user_sessions             | postgres
 public     | users                     | postgres
 public     | workflow_documents        | postgres
 public     | workspace_cloud_images    | postgres
 public     | workspace_layouts         | postgres
(38 rows)


```
### 016: agent_runs new columns
```
 column_name  | data_type | is_nullable 
--------------+-----------+-------------
 step_results | jsonb     | NO
 user_id      | text      | NO
(2 rows)


```
### 016: agent_skill_versions table
```
 column_name |        data_type         | is_nullable 
-------------+--------------------------+-------------
 user_id     | text                     | NO
 skill_key   | text                     | NO
 updated_at  | timestamp with time zone | NO
 deleted     | boolean                  | NO
(4 rows)


```
### 016: owner_scope constraints
```
                  conname                   |         conrelid         |                                                                   pg_get_constraintdef                                                                    
--------------------------------------------+--------------------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------
 knowledge_documents_owner_scope_check      | knowledge_documents      | CHECK ((((owner_scope = 'user'::text) AND (user_id IS NOT NULL)) OR ((owner_scope = ANY (ARRAY['system'::text, 'legacy'::text])) AND (user_id IS NULL))))
 canvas_runtime_snapshots_owner_scope_check | canvas_runtime_snapshots | CHECK ((((owner_scope = 'user'::text) AND (user_id IS NOT NULL)) OR ((owner_scope = ANY (ARRAY['system'::text, 'legacy'::text])) AND (user_id IS NULL))))
 agent_skills_owner_scope_check             | agent_skills             | CHECK ((((owner_scope = 'user'::text) AND (user_id IS NOT NULL)) OR ((owner_scope = ANY (ARRAY['system'::text, 'legacy'::text])) AND (user_id IS NULL))))
(3 rows)


```
### 016: owner_scope indexes
```
                indexname                 |                                                                                   indexdef                                                                                    
------------------------------------------+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 agent_skills_user_name_idx               | CREATE UNIQUE INDEX agent_skills_user_name_idx ON public.agent_skills USING btree (user_id, name) WHERE (owner_scope = 'user'::text)
 agent_skills_user_updated_idx            | CREATE INDEX agent_skills_user_updated_idx ON public.agent_skills USING btree (user_id, updated_at DESC) WHERE (owner_scope = 'user'::text)
 knowledge_documents_user_updated_idx     | CREATE INDEX knowledge_documents_user_updated_idx ON public.knowledge_documents USING btree (user_id, updated_at DESC) WHERE (owner_scope = 'user'::text)
 knowledge_documents_system_updated_idx   | CREATE INDEX knowledge_documents_system_updated_idx ON public.knowledge_documents USING btree (updated_at DESC) WHERE (owner_scope = 'system'::text)
 canvas_runtime_snapshots_user_canvas_idx | CREATE INDEX canvas_runtime_snapshots_user_canvas_idx ON public.canvas_runtime_snapshots USING btree (user_id, canvas_id, created_at DESC) WHERE (owner_scope = 'user'::text)
(5 rows)


```
### 016: column types upgraded to timestamptz
```
        table_name        | column_name  |        data_type         
--------------------------+--------------+--------------------------
 agent_runs               | created_at   | timestamp with time zone
 agent_runs               | updated_at   | timestamp with time zone
 agent_tool_calls         | started_at   | timestamp with time zone
 agent_tool_calls         | completed_at | timestamp with time zone
 agent_memory             | created_at   | timestamp with time zone
 agent_memory             | updated_at   | timestamp with time zone
 knowledge_documents      | updated_at   | timestamp with time zone
 knowledge_chunks         | created_at   | timestamp with time zone
 canvas_runtime_snapshots | created_at   | timestamp with time zone
 agent_skills             | created_at   | timestamp with time zone
 agent_skills             | updated_at   | timestamp with time zone
(11 rows)


```

## Idempotency Test (re-run 016)
Result: PASS

## Fixes Applied During Rehearsal
- `migrations/013_password_reset_tokens.sql`: changed `user_id` from `UUID` to `VARCHAR(255)` to match `public.users(id)` and `profiles(id)` text types.

## Deployment Procedure
For a fresh install, apply in this order:
1. `scripts/postgres/bootstrap-kk-vps.sql`
2. `migrations/*.sql` in numeric order (001-016)

## Cleanup
Cleanup performed after report generation:
- Dropped database `kkstudio_rehearsal_016`.
- Dropped user `kkstudio_rehearsal`.
- Removed `/tmp/kkstudio_rehearsal_016` from the VPS.
- Removed local temporary Python scripts from the workstation.

If you need to re-run, recreate the isolated database and user as described above.