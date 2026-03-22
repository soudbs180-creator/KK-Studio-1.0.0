import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Loader2, Lock, Settings, ShieldAlert, ShieldCheck, UserCog } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminRole } from '../../hooks/useAdminRole';
import { notify } from '../../services/system/notificationService';
import CreditModelSettings from './CreditModelSettings';
import AdminConsoleSettings from './AdminConsoleSettings';
import { ExchangeRateSettingsView } from './views/ExchangeRateSettingsView';
import {
  SegmentedControlMulti,
  StatusBadge,
} from './ui/index';
import {
  SETTINGS_ELEVATED_STYLE,
  SETTINGS_INPUT_CLASSNAME,
  SETTINGS_LABEL_CLASSNAME,
  SETTINGS_WARNING_STYLE,
  SettingsActionButton,
  SettingsBadge,
  SettingsHero,
  SettingsMetricCard,
  SettingsSection,
  SettingsViewShell,
} from './SettingsScaffold';

type AdminTab = 'credit-models' | 'exchange-rates' | 'admin-console';

const SESSION_UNLOCK_KEY = 'kk_admin_panel_unlocked_at';
const SESSION_UNLOCK_TTL_MS = 30 * 60 * 1000;

// 全局变量：跟踪是否已经完成初始检查，避免切换标签页时重复显示 loading
let globalHasInitiallyChecked = false;

type AdminUnlockSession = {
  unlockedAt: number;
  userId: string | null;
};

function clearUnlockSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_UNLOCK_KEY);
}

function readUnlockSession(): AdminUnlockSession | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(SESSION_UNLOCK_KEY);
  if (!raw) return null;

  const ts = Number(raw);
  if (Number.isFinite(ts)) {
    return {
      unlockedAt: ts,
      userId: null,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AdminUnlockSession>;
    if (!parsed || typeof parsed !== 'object') {
      clearUnlockSession();
      return null;
    }

    const unlockedAt = Number(parsed.unlockedAt);
    if (!Number.isFinite(unlockedAt)) {
      clearUnlockSession();
      return null;
    }

    return {
      unlockedAt,
      userId: typeof parsed.userId === 'string' ? parsed.userId : null,
    };
  } catch {
    clearUnlockSession();
    return null;
  }
}

function getUnlockSessionRemainingMs(userId?: string): number {
  const session = readUnlockSession();
  if (!session) return 0;

  if (session.userId && userId && session.userId !== userId) {
    clearUnlockSession();
    return 0;
  }

  const remaining = SESSION_UNLOCK_TTL_MS - (Date.now() - session.unlockedAt);
  if (remaining <= 0) {
    clearUnlockSession();
    return 0;
  }

  return remaining;
}

function isSessionUnlocked(userId?: string): boolean {
  return getUnlockSessionRemainingMs(userId) > 0;
}

function persistUnlockSession(userId?: string) {
  if (typeof window === 'undefined') return;

  const payload: AdminUnlockSession = {
    unlockedAt: Date.now(),
    userId: userId ?? null,
  };

  localStorage.setItem(SESSION_UNLOCK_KEY, JSON.stringify(payload));
}

const infoCardStyle: React.CSSProperties = {
  borderColor: 'var(--border-light)',
  backgroundColor: 'var(--bg-overlay)',
};

const AdminAccessCard: React.FC<{
  tone: 'slate' | 'rose' | 'amber';
  icon: React.ComponentType<{ className?: string; size?: number }>;
  title: string;
  description: string;
  badge: string;
  children?: React.ReactNode;
  side?: React.ReactNode;
}> = ({ tone, icon: Icon, title, description, badge, children, side }) => (
  <section className="mx-auto max-w-[760px] rounded-[24px] border p-6 md:p-7" style={SETTINGS_ELEVATED_STYLE}>
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={
              tone === 'rose'
                ? { border: '1px solid var(--state-danger-border)', background: 'var(--state-danger-bg)', color: 'var(--state-danger-text)' }
                : tone === 'amber'
                  ? { border: '1px solid var(--state-warning-border)', background: 'var(--state-warning-bg)', color: 'var(--state-warning-text)' }
                  : { border: '1px solid var(--border-light)', background: 'var(--bg-overlay)', color: 'var(--text-secondary)' }
            }
          >
            <Icon size={18} />
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
              权限校验
            </div>
            <div className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </div>
            <p className="max-w-2xl text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              {description}
            </p>
          </div>
        </div>
        <SettingsBadge tone={tone}>{badge}</SettingsBadge>
      </div>

      <div className={`grid gap-4 ${side ? 'lg:grid-cols-[minmax(0,1fr)_240px]' : ''}`.trim()}>
        <div className="rounded-2xl border p-5" style={SETTINGS_ELEVATED_STYLE}>
          {children}
        </div>
        {side ? (
          <div className="rounded-2xl border p-5" style={infoCardStyle}>
            {side}
          </div>
        ) : null}
      </div>
    </div>
  </section>
);

export const AdminSystem: React.FC<{ initialTab?: AdminTab }> = ({ initialTab = 'credit-models' }) => {
  const { user, authLoading, checkingAdmin, isAdmin } = useAdminRole();
  const [unlocked, setUnlocked] = useState(isSessionUnlocked());
  const hasInitiallyCheckedRef = useRef(globalHasInitiallyChecked);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [mustChangeDefaultPassword, setMustChangeDefaultPassword] = useState(false);

  const userLabel = user?.email || user?.phone || user?.id || '未登录';
  const activeModuleLabel =
    activeTab === 'credit-models' ? '积分模型' : activeTab === 'exchange-rates' ? '汇率设置' : '后台管理';
  const activeModuleDescription =
    activeTab === 'credit-models'
      ? '维护计费模型、积分消耗和高级出图策略。'
      : activeTab === 'exchange-rates'
        ? '配置充值汇率、金额范围和前台可见状态。'
        : '处理管理员密码、手动充值和权限授权。';

  const lockedReason = useMemo(() => {
    if (authLoading || checkingAdmin) return '正在校验管理员权限。';
    if (!user) return '请先登录管理员账号后再进入后台。';
    if (!isAdmin) return '当前账号没有管理员权限。';
    return '';
  }, [authLoading, checkingAdmin, isAdmin, user]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (authLoading || checkingAdmin) return;

    if (!user || !isAdmin) {
      setUnlocked(false);
      setMustChangeDefaultPassword(false);
      clearUnlockSession();
      hasInitiallyCheckedRef.current = true;
      globalHasInitiallyChecked = true;
      return;
    }

    setUnlocked(isSessionUnlocked(user.id));
    hasInitiallyCheckedRef.current = true;
    globalHasInitiallyChecked = true;
  }, [authLoading, checkingAdmin, isAdmin, user]);

  useEffect(() => {
    if (!unlocked || !user || !isAdmin) return;

    const remaining = getUnlockSessionRemainingMs(user.id);
    if (remaining <= 0) {
      setUnlocked(false);
      setMustChangeDefaultPassword(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      clearUnlockSession();
      setUnlocked(false);
      setMustChangeDefaultPassword(false);
    }, remaining);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [unlocked, isAdmin, user]);

  const verifyAdminPassword = async () => {
    if (!password.trim()) {
      notify.error('缺少密码', '请输入管理员密码。');
      return;
    }

    setVerifying(true);
    try {
      const verifyResult = await supabase.rpc('verify_admin_password_admin', {
        input_password: password,
      });

      let ok = !verifyResult.error && Boolean(verifyResult.data) === true;

      if (!ok) {
        const legacyVerify = await supabase.rpc('verify_admin_password', {
          input_password: password,
        });
        ok = !legacyVerify.error && Boolean(legacyVerify.data) === true;
      }

      if (!ok) {
        const authResult = await supabase.rpc('authenticate_admin', {
          input_password: password,
        });
        const row = Array.isArray(authResult.data) ? authResult.data[0] : authResult.data;
        ok = !authResult.error && Boolean(row?.success);
      }

      if (!ok) {
        notify.error('验证失败', '管理员密码错误。');
        return;
      }

      persistUnlockSession(user?.id);
      setUnlocked(true);
      setPassword('');
      notify.success('验证通过', '管理员后台已解锁。');

      try {
        const defaultPwdResult = await supabase.rpc('verify_admin_password_admin', {
          input_password: '123456',
        });
        setMustChangeDefaultPassword(!defaultPwdResult.error && defaultPwdResult.data === true);
      } catch {
        setMustChangeDefaultPassword(false);
      }
    } catch (error: any) {
      notify.error('验证失败', error.message || '请稍后重试。');
    } finally {
      setVerifying(false);
    }
  };

  const lockNow = () => {
    clearUnlockSession();
    setUnlocked(false);
    setMustChangeDefaultPassword(false);
  };

  if ((authLoading || checkingAdmin) && !hasInitiallyCheckedRef.current) {
    return (
      <SettingsViewShell>
        <AdminAccessCard
          tone="slate"
          icon={Loader2}
          title="管理员后台"
          description="正在确认当前账号是否具备管理员权限，校验完成后会显示登录入口。"
          badge="校验中"
          side={
            <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <div className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                当前账号
              </div>
              <div className="rounded-xl border px-3 py-3" style={SETTINGS_ELEVATED_STYLE}>
                {userLabel}
              </div>
              <div className="text-xs leading-6" style={{ color: 'var(--text-tertiary)' }}>
                会先检查 `is_admin` RPC，再回退到 `profiles.role`。
              </div>
            </div>
          }
        >
          <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed" style={infoCardStyle}>
            <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              正在校验管理员身份...
            </div>
          </div>
        </AdminAccessCard>
      </SettingsViewShell>
    );
  }

  if (!user || !isAdmin) {
    return (
      <SettingsViewShell>
        <AdminAccessCard
          tone="rose"
          icon={ShieldAlert}
          title="管理员后台"
          description="这里现在只保留轻量登录入口。当前账号未通过管理员校验，所以不会展示后台模块。"
          badge="访问受限"
          side={
            <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  当前账号
                </div>
                <div className="mt-2 rounded-xl border px-3 py-3" style={SETTINGS_ELEVATED_STYLE}>
                  {userLabel}
                </div>
              </div>
              <div className="rounded-xl border px-3 py-3 text-xs leading-6" style={SETTINGS_WARNING_STYLE}>
                {lockedReason || '请确认当前登录的是管理员账号。'}
              </div>
            </div>
          }
        >
          <div className="space-y-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
            <div>只有管理员账号才能进入后台模块，普通用户不会看到任何后台配置入口。</div>
            <div>如果你本来就应该有权限，优先检查当前登录账号是否正确，以及 `profiles.role` 是否已设置为 `admin`。</div>
          </div>
        </AdminAccessCard>
      </SettingsViewShell>
    );
  }

  if (!unlocked) {
    return (
      <SettingsViewShell>
        <AdminAccessCard
          tone="amber"
          icon={ShieldCheck}
          title="管理员后台登录"
          description="管理员页面先只保留一个登录卡片。输入管理员密码后，再进入后续模块。"
          badge="会话 30 分钟"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <span className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5" style={infoCardStyle}>
                <UserCog size={12} />
                {userLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5" style={infoCardStyle}>
                <Clock3 size={12} />
                30 分钟会话
              </span>
            </div>

            <label className="block space-y-2">
              <span className={SETTINGS_LABEL_CLASSNAME}>管理员密码</span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--text-tertiary)]">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void verifyAdminPassword();
                    }
                  }}
                  placeholder="请输入管理员密码"
                  className={`${SETTINGS_INPUT_CLASSNAME} pl-10`}
                />
              </div>
            </label>

            <div className="flex flex-wrap gap-2">
              <SettingsActionButton icon={ShieldCheck} tone="primary" loading={verifying} onClick={() => void verifyAdminPassword()}>
                {verifying ? '验证中...' : '登录后台'}
              </SettingsActionButton>
            </div>

            <div className="rounded-xl border px-3 py-3 text-xs leading-6" style={infoCardStyle}>
              输入正确密码后，才会显示积分模型和后台管理模块。所有后台写入仍通过 Supabase RPC 执行。
            </div>
          </div>
        </AdminAccessCard>
      </SettingsViewShell>
    );
  }

  return (
    <SettingsViewShell>
      <SettingsHero
        eyebrow="高级设置"
        title="管理员后台"
        description="这里集中维护积分模型、充值汇率和高权限操作。普通用户不会看到这些入口，所有写入仍通过 Supabase RPC 执行。"
        icon={ShieldCheck}
        tone={mustChangeDefaultPassword ? 'amber' : 'indigo'}
        badge={
          <SettingsBadge tone={mustChangeDefaultPassword ? 'amber' : 'emerald'}>
            {mustChangeDefaultPassword ? '默认密码待更换' : '后台会话已解锁'}
          </SettingsBadge>
        }
        actions={
          <SettingsActionButton icon={Lock} onClick={lockNow}>
            立即锁定
          </SettingsActionButton>
        }
        metrics={
          <>
            <SettingsMetricCard
              label="后台状态"
              value="已验证"
              helper={mustChangeDefaultPassword ? '建议优先修改默认密码' : '当前会话已解锁'}
              icon={ShieldCheck}
              tone={mustChangeDefaultPassword ? 'amber' : 'emerald'}
            />
            <SettingsMetricCard
              label="会话时长"
              value="30 分钟"
              helper="到期后需要重新输入管理员密码"
              icon={Clock3}
              tone="neutral"
            />
            <SettingsMetricCard
              label="当前账号"
              value={user?.email || '管理员'}
              helper="仅管理员可见"
              icon={UserCog}
              tone="indigo"
            />
            <SettingsMetricCard
              label="当前模块"
              value={activeModuleLabel}
              helper="支持在下方快速切换"
              icon={Settings}
              tone="neutral"
            />
          </>
        }
      />

      <SettingsSection
        title="模块切换"
        eyebrow="后台导航"
        description="切换模块不会退出当前管理员会话，只会切换当前显示内容。"
        action={<SettingsBadge tone="neutral">{activeModuleLabel}</SettingsBadge>}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="online" label="已验证" />
            {mustChangeDefaultPassword ? <StatusBadge status="warning" label="请先修改默认密码" /> : null}
            <span className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs" style={infoCardStyle}>
              <UserCog size={12} />
              {userLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs" style={infoCardStyle}>
              <Clock3 size={12} />
              会话 30 分钟
            </span>
          </div>

          <div className="rounded-[24px] border p-4 text-[13px] leading-6" style={SETTINGS_ELEVATED_STYLE}>
            当前停留在“{activeModuleLabel}”模块。{activeModuleDescription}
          </div>

          <SegmentedControlMulti
            options={['积分模型', '汇率设置', '后台管理']}
            value={activeModuleLabel}
            onChange={(value) =>
              setActiveTab(value === '积分模型' ? 'credit-models' : value === '汇率设置' ? 'exchange-rates' : 'admin-console')
            }
          />
        </div>
      </SettingsSection>

      {mustChangeDefaultPassword ? (
        <SettingsSection
          title="安全提醒"
          eyebrow="高优先级"
          description="建议先完成密码更新，再继续执行充值或权限类操作。"
        >
          <div className="rounded-[24px] border p-4" style={SETTINGS_WARNING_STYLE}>
            <div className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              默认密码仍然有效
            </div>
            <div className="mt-2 text-[13px] leading-6" style={{ color: 'var(--text-secondary)' }}>
              建议先到“后台管理”模块里修改默认密码 `123456`，再继续执行其他后台操作。
            </div>
          </div>
        </SettingsSection>
      ) : null}

      <SettingsSection
        title={activeModuleLabel}
        eyebrow="后台模块"
        description={activeModuleDescription}
        action={
          <SettingsBadge tone={activeTab === 'admin-console' ? 'amber' : 'indigo'}>
            {activeModuleLabel}
          </SettingsBadge>
        }
      >
        {activeTab === 'credit-models' ? (
          <CreditModelSettings />
        ) : activeTab === 'exchange-rates' ? (
          <ExchangeRateSettingsView />
        ) : (
          <AdminConsoleSettings />
        )}
      </SettingsSection>
    </SettingsViewShell>
  );
};

export default AdminSystem;
