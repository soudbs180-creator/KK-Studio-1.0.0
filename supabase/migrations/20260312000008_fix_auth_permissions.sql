-- =====================================================
-- 修复认证权限问题
-- 原因：之前的迁移撤销了anon权限，导致无法登录
-- =====================================================

BEGIN;

-- =====================================================
-- 1. 恢复认证相关表的权限
-- =====================================================

-- 允许 anon 访问认证 schema（supabase_auth）
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- 恢复 anon 对必要表的权限（用于注册/登录）
-- profiles 表需要 anon 可以 INSERT（注册时创建）
GRANT SELECT, INSERT ON public.profiles TO anon;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'profiles_id_seq'
          AND c.relkind = 'S'
    ) THEN
        EXECUTE 'GRANT USAGE ON SEQUENCE public.profiles_id_seq TO anon';
    END IF;
END $$;

-- 允许 authenticated 访问 profiles
GRANT ALL ON public.profiles TO authenticated;

-- =====================================================
-- 2. 恢复关键 RPC 函数的权限
-- =====================================================

-- 认证相关函数需要 anon 可以访问
-- 这些函数由 Supabase Auth 使用

-- 如果有自定义的认证相关函数，恢复权限
DO $$
BEGIN
    -- 恢复 auth 函数的权限
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not grant auth schema permissions: %', SQLERRM;
END $$;

-- =====================================================
-- 3. 修复 RLS 策略 - 允许注册时插入 profiles
-- =====================================================

-- 删除可能存在的严格策略
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- 创建宽松的 profiles 策略
-- 策略1：任何人可以查看自己的 profile
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT TO authenticated, anon
    USING (auth.uid() = id);

-- 策略2：认证用户可以查看所有 profiles（用于管理员功能）
CREATE POLICY "profiles_select_all_for_authenticated" ON public.profiles
    FOR SELECT TO authenticated
    USING (true);

-- 策略3：注册时允许插入（anon 在触发器中创建）
CREATE POLICY "profiles_insert_on_signup" ON public.profiles
    FOR INSERT TO anon, authenticated
    WITH CHECK (auth.uid() = id);

-- 策略4：用户只能更新自己的 profile
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id);

-- =====================================================
-- 4. 确保 user_api_keys 表对 anon 是安全的（继续禁止）
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'user_api_keys'
    ) THEN
        EXECUTE 'REVOKE ALL ON public.user_api_keys FROM anon';
        EXECUTE 'DROP POLICY IF EXISTS "user_api_keys_isolation_select" ON public.user_api_keys';
        EXECUTE 'DROP POLICY IF EXISTS "user_api_keys_isolation_insert" ON public.user_api_keys';
        EXECUTE 'DROP POLICY IF EXISTS "user_api_keys_isolation_update" ON public.user_api_keys';
        EXECUTE 'DROP POLICY IF EXISTS "user_api_keys_isolation_delete" ON public.user_api_keys';
        EXECUTE '' ||
          'CREATE POLICY "user_api_keys_isolation_select" ON public.user_api_keys ' ||
          'FOR SELECT TO authenticated USING (user_id = auth.uid())';
        EXECUTE '' ||
          'CREATE POLICY "user_api_keys_isolation_insert" ON public.user_api_keys ' ||
          'FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
        EXECUTE '' ||
          'CREATE POLICY "user_api_keys_isolation_update" ON public.user_api_keys ' ||
          'FOR UPDATE TO authenticated USING (user_id = auth.uid())';
        EXECUTE '' ||
          'CREATE POLICY "user_api_keys_isolation_delete" ON public.user_api_keys ' ||
          'FOR DELETE TO authenticated USING (user_id = auth.uid())';
    ELSE
        RAISE NOTICE 'Skipping user_api_keys policy repair because the table does not exist';
    END IF;
END $$;

-- =====================================================
-- 5. 修复其他核心表的权限
-- =====================================================

-- user_credits 表
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'user_credits'
    ) THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.user_credits TO authenticated';
        EXECUTE 'REVOKE ALL ON public.user_credits FROM anon';
    END IF;
END $$;

-- credit_transactions 表
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
    ) THEN
        EXECUTE 'GRANT SELECT, INSERT ON public.credit_transactions TO authenticated';
        EXECUTE 'REVOKE ALL ON public.credit_transactions FROM anon';
    END IF;
END $$;

-- admin_credit_models 表（只读给 authenticated）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'admin_credit_models'
    ) THEN
        EXECUTE 'GRANT SELECT ON public.admin_credit_models TO authenticated';
        EXECUTE 'REVOKE ALL ON public.admin_credit_models FROM anon';
    END IF;
END $$;

-- =====================================================
-- 6. 视图权限
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.views
        WHERE table_schema = 'public'
          AND table_name = 'vw_user_api_keys'
    ) THEN
        EXECUTE 'GRANT SELECT ON public.vw_user_api_keys TO authenticated';
        EXECUTE 'REVOKE ALL ON public.vw_user_api_keys FROM anon';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.views
        WHERE table_schema = 'public'
          AND table_name = 'vw_available_models'
    ) THEN
        EXECUTE 'GRANT SELECT ON public.vw_available_models TO authenticated';
        EXECUTE 'REVOKE ALL ON public.vw_available_models FROM anon';
    END IF;
END $$;

COMMIT;

-- =====================================================
-- 7. 验证修复
-- =====================================================

DO $$
DECLARE
    v_profiles_policy_count INTEGER;
    v_user_keys_policy_count INTEGER;
BEGIN
    -- 检查 profiles 策略
    SELECT COUNT(*) INTO v_profiles_policy_count
    FROM pg_policies 
    WHERE tablename = 'profiles' AND schemaname = 'public';
    
    RAISE NOTICE 'profiles policies: %', v_profiles_policy_count;
    
    -- 检查 user_api_keys 策略
    SELECT COUNT(*) INTO v_user_keys_policy_count
    FROM pg_policies 
    WHERE tablename = 'user_api_keys' AND schemaname = 'public';
    
    RAISE NOTICE 'user_api_keys policies: %', v_user_keys_policy_count;
    
    IF v_profiles_policy_count >= 2 AND v_user_keys_policy_count >= 4 THEN
        RAISE NOTICE '✅ Permission fix applied successfully';
    ELSE
        RAISE WARNING '⚠️  Some policies may be missing';
    END IF;
END $$;
