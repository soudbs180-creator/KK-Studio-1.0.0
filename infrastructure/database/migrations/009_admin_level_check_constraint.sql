-- 9. 纵深防御：为 admin_level 列增加 CHECK 约束
-- 严格限制管理员级别只能是 0（普通用户）、1（超级管理员）、2（普通管理员）
-- 防止通过任何途径将 admin_level 设为非法值

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_admin_level_range'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT chk_admin_level_range
      CHECK (admin_level IN (0, 1, 2));
  END IF;
END $$;
