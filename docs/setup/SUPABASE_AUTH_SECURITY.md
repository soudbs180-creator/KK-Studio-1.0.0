# Supabase Auth Security Checklist

当前项目已经补上了应用侧的 TOTP 双重验证入口，但 Supabase Security Advisors 里仍有两类需要在控制台手动开启的项目。

## 1. 开启泄露密码保护

1. 打开 Supabase Dashboard。
2. 进入 `Authentication` -> `Providers` -> `Email`。
3. 开启 `Leaked password protection`。

参考：
- [Supabase leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## 2. 开启 MFA 选项

1. 打开 Supabase Dashboard。
2. 进入 `Authentication` -> `Multi-Factor Auth`。
3. 至少开启 `TOTP`。
4. 如果团队后续要继续强化，建议再评估是否同时开启 `WebAuthn`。

前端已支持：
- TOTP 因子生成
- 扫码绑定
- 动态口令验证
- 当前会话提升到 `aal2`

参考：
- [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa)

## 3. 关于 cron 两条匿名访问告警

仓库里已经准备了前向迁移：

- `supabase/migrations/20260323113000_harden_pg_cron_policy_roles.sql`

这条迁移会把以下策略从 `public` 收紧到 `postgres, supabase_admin`：

- `cron.job`
- `cron.job_run_details`

但当前通过 MCP/SQL Editor 执行时会被 Supabase 托管权限拦住，因为这两个扩展表的 owner 是 `supabase_admin`，当前执行角色是 `postgres`，无法直接 `DROP POLICY`。

如果后续有更高权限的运维通道，再执行这条迁移即可。
