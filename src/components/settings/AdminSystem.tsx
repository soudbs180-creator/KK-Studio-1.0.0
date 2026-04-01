import React, { useEffect, useMemo, useState } from 'react';
import {
  Fingerprint,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldEllipsis,
  UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useLocale } from '../../context/LocaleContext';
import { useAdminRole } from '../../hooks/useAdminRole';
import {
  clearStoredAdminSession,
  setStoredAdminSession,
} from '../../services/api/adminSession';
import {
  loadStoredAdminSystemTab,
  saveStoredAdminSystemTab,
} from '../../services/admin/adminConsoleState';
import { verifyAdminPasswordViaSupabase } from '../../services/admin/supabaseAdminFallbackService';
import {
  legacyWebApiClient,
  shouldUseLegacyWebApiFallback,
} from '../../services/api/kkApiClient';
import { notify } from '../../services/system/notificationService';
import { SettingsActionButton, SettingsBadge, SettingsViewShell } from './SettingsScaffold';
import AdminConsoleSettings from './AdminConsoleSettings';
import CreditModelSettings from './CreditModelSettings';
import { StatusBadge } from './ui/index';
import { ExchangeRateSettingsView } from './views/ExchangeRateSettingsView';

type AdminTab = 'credit-models' | 'exchange-rates' | 'admin-console';

type TabOption = {
  id: AdminTab;
  label: string;
  description: string;
  path: string;
};

function buildAdminRequestId(prefix: string, userId?: string) {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  return `${prefix}-${userId || 'anonymous'}-${uuid}`;
}

function buildAdminRequestOptions(requestId?: string) {
  return {
    requestId,
  };
}

const getTabOptions = (pick: <T,>(zh: T, en: T) => T): TabOption[] => [
  {
    id: 'credit-models',
    label: pick('积分模型', 'Credit models'),
    description: pick(
      '统一维护供应商积分模型、路由组合和高阶画质定价。',
      'Manage provider credit models, routing combinations, and advanced quality pricing in one place.'
    ),
    path: '/settings/credit-models',
  },
  {
    id: 'exchange-rates',
    label: pick('汇率规则', 'Exchange rules'),
    description: pick(
      '控制充值币种、兑换比例、金额区间和前台展示状态。',
      'Control recharge currencies, exchange ratios, amount ranges, and storefront visibility.'
    ),
    path: '/settings/exchange-rates',
  },
  {
    id: 'admin-console',
    label: pick('高级操作', 'Admin operations'),
    description: pick(
      '管理员改密、手动充值和角色授予等高权限动作统一收口。',
      'Keep password changes, manual recharges, and role grants together in one privileged workspace.'
    ),
    path: '/settings/admin-console',
  },
];

const formatRemainingMinutes = (
  expiresAt: string | undefined,
  pick: <T,>(zh: T, en: T) => T
) => {
  if (!expiresAt) {
    return pick('未验证', 'Not verified');
  }

  const remaining = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return pick('已过期', 'Expired');
  }

  return pick(`${Math.ceil(remaining / 60000)} 分钟`, `${Math.ceil(remaining / 60000)} min`);
};

const resolveActiveComponent = (tab: AdminTab) => {
  if (tab === 'credit-models') {
    return <CreditModelSettings />;
  }

  if (tab === 'exchange-rates') {
    return <ExchangeRateSettingsView />;
  }

  return <AdminConsoleSettings />;
};

const ReferenceMetric: React.FC<{
  label: string;
  value: string;
  helper: string;
}> = ({ label, value, helper }) => (
  <div className="settings-reference-mini-metric">
    <div className="settings-reference-mini-metric__label">{label}</div>
    <div className="settings-reference-mini-metric__value">{value}</div>
    <div className="settings-reference-mini-metric__helper">{helper}</div>
  </div>
);

const ModulePreviewRow: React.FC<{
  title: string;
  meta: string;
  value: string;
}> = ({ title, meta, value }) => (
  <div className="settings-reference-list-item">
    <div className="min-w-0 flex-1">
      <div className="settings-reference-list-item__title">{title}</div>
      <div className="settings-reference-list-item__meta">{meta}</div>
    </div>
    <div className="settings-reference-list-item__value">{value}</div>
  </div>
);

export const AdminSystem: React.FC<{ initialTab?: AdminTab }> = ({ initialTab = 'credit-models' }) => {
  const navigate = useNavigate();
  const { pick } = useLocale();
  const {
    user,
    authLoading,
    checkingAdmin,
    isAdmin,
    adminSessionActive,
    adminSessionExpiresAt,
    requiresAdminPasswordChange,
  } = useAdminRole();
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const canUseLegacyAdminApi = shouldUseLegacyWebApiFallback();

  const tabOptions = useMemo(() => getTabOptions(pick), [pick]);
  const userLabel = user?.email || user?.phone || user?.id || pick('未登录', 'Not signed in');
  const unlocked = adminSessionActive;
  const activeTabMeta = useMemo(
    () => tabOptions.find((item) => item.id === activeTab) || tabOptions[0],
    [activeTab, tabOptions]
  );

  useEffect(() => {
    const restoredTab = loadStoredAdminSystemTab(user?.id, initialTab);
    setActiveTab((current) => (current === restoredTab ? current : restoredTab));
  }, [initialTab, user?.id]);

  useEffect(() => {
    saveStoredAdminSystemTab(user?.id, activeTab);
  }, [activeTab, user?.id]);

  useEffect(() => {
    if (authLoading || checkingAdmin) {
      return;
    }

    if (!user || !isAdmin) {
      clearStoredAdminSession();
    }
  }, [authLoading, checkingAdmin, isAdmin, user]);

  useEffect(() => {
    if (!adminSessionActive || !adminSessionExpiresAt) {
      return;
    }

    const remaining = Date.parse(adminSessionExpiresAt) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      clearStoredAdminSession();
      return;
    }

    const timer = window.setTimeout(() => {
      clearStoredAdminSession();
    }, remaining);

    return () => {
      window.clearTimeout(timer);
    };
  }, [adminSessionActive, adminSessionExpiresAt]);

  const verifyAdminPassword = async () => {
    if (!password.trim()) {
      notify.error(
        pick('缺少密码', 'Missing password'),
        pick('请输入管理员密码。', 'Enter the admin password.')
      );
      return;
    }

    if (!user?.id) {
      notify.error(
        pick('身份失效', 'Session expired'),
        pick('请重新登录后再验证管理员密码。', 'Sign in again before verifying the admin password.')
      );
      return;
    }

    setVerifying(true);
    try {
      let verifiedSession: {
        adminSessionToken: string;
        adminSessionExpiresAt: string;
      };

      if (canUseLegacyAdminApi) {
        try {
          const response = await legacyWebApiClient.verifyAdminPassword(
          { password },
          buildAdminRequestOptions(buildAdminRequestId('admin-unlock', user.id))
        );

        if (!response.success) {
          throw new Error(
            response.error.message || pick('管理员密码错误。', 'The admin password is incorrect.')
          );
        }

          verifiedSession = {
            adminSessionToken: response.data.adminSessionToken,
            adminSessionExpiresAt: response.data.adminSessionExpiresAt,
          };
        } catch {
          verifiedSession = await verifyAdminPasswordViaSupabase(user, password);
        }
      } else {
        verifiedSession = await verifyAdminPasswordViaSupabase(user, password);
      }

      setStoredAdminSession(
        verifiedSession.adminSessionToken,
        verifiedSession.adminSessionExpiresAt,
        user.id
      );
      setPassword('');
      notify.success(
        pick('验证通过', 'Verified'),
        pick('管理员后台已解锁。', 'The admin console is now unlocked.')
      );
    } catch (error: any) {
      notify.error(
        pick('验证失败', 'Verification failed'),
        error?.message || pick('请稍后重试。', 'Please try again later.')
      );
    } finally {
      setVerifying(false);
    }
  };

  const lockNow = () => {
    clearStoredAdminSession();
  };

  const switchTab = (tab: AdminTab) => {
    const next = tabOptions.find((item) => item.id === tab);
    setActiveTab(tab);
    if (next) {
      navigate(next.path);
    }
  };

  if (authLoading || checkingAdmin) {
    return (
      <SettingsViewShell>
        <div className="settings-reference-stack">
          <div className="settings-reference-page-header">
            <div className="settings-reference-page-header__lead">
              <div className="settings-reference-page-header__eyebrow">
                {pick('管理员权限', 'Admin access')}
              </div>
              <h2>{pick('权限校验中', 'Checking access')}</h2>
              <p>
                {pick(
                  '正在同步当前账号的管理员角色、后台会话和密码状态，请稍候。',
                  'Syncing the current account role, admin session, and password state.'
                )}
              </p>
            </div>
          </div>

          <div className="settings-reference-card settings-reference-card--soft p-8">
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-[22px] border"
                style={{
                  borderColor: 'var(--settings-border-subtle)',
                  background: 'var(--settings-surface-overlay)',
                  color: 'var(--text-primary)',
                }}
              >
                <Loader2 size={24} className="animate-spin" />
              </div>
              <div>
                <div className="text-[20px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                  {pick('校验管理员权限', 'Verifying admin access')}
                </div>
                <div className="mt-2 text-sm text-[var(--text-secondary)]">
                  {pick('当前账号：', 'Current account: ')}
                  {userLabel}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SettingsViewShell>
    );
  }

  if (!user || !isAdmin) {
    return (
      <SettingsViewShell>
        <div className="settings-reference-stack">
          <div className="settings-reference-page-header">
            <div className="settings-reference-page-header__lead">
              <div className="settings-reference-page-header__eyebrow">
                {pick('管理员权限', 'Admin access')}
              </div>
              <h2>{pick('管理员权限不足', 'Admin role required')}</h2>
              <p>
                {pick(
                  '这个模块仅对管理员账号开放，必须先完成角色校验后才能进入高级设置。',
                  'This module is only available to admin accounts after role verification.'
                )}
              </p>
            </div>
          </div>

          <div className="settings-reference-card settings-reference-danger p-6">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">
                  {pick('访问受限', 'Restricted')}
                </div>
                <div className="settings-reference-card__title">
                  {pick('当前账号无法访问后台模块', 'This account cannot access the admin workspace')}
                </div>
                <div className="settings-reference-card__meta">
                  {pick('请确认当前登录用户已经具备管理员角色，并且', 'Confirm the signed-in user has the admin role and that')}
                  <code className="mx-1 rounded-md bg-black/20 px-1.5 py-0.5">profiles.role = admin</code>
                  {pick('已生效。', 'has propagated correctly.')}
                </div>
              </div>
              <div
                className="flex h-14 w-14 items-center justify-center rounded-[20px] border"
                style={{
                  borderColor: 'var(--state-danger-border)',
                  background: 'var(--state-danger-bg)',
                  color: 'var(--state-danger-text)',
                }}
              >
                <ShieldAlert size={22} />
              </div>
            </div>

            <div className="mt-5 settings-reference-grid-2">
              <ReferenceMetric
                label={pick('当前账号', 'Current account')}
                value={userLabel}
                helper={pick('请确认登录身份后再进入后台设置。', 'Confirm the current sign-in identity before opening admin settings.')}
              />
              <ReferenceMetric
                label={pick('访问状态', 'Access status')}
                value={pick('已拒绝', 'Denied')}
                helper={pick('当前未检测到管理员角色。', 'No admin role was detected for this account.')}
              />
            </div>
          </div>
        </div>
      </SettingsViewShell>
    );
  }

  if (!unlocked) {
    return (
      <SettingsViewShell>
        <div className="settings-reference-stack">
          <div className="settings-reference-page-header">
            <div className="settings-reference-page-header__lead">
              <div className="settings-reference-page-header__eyebrow">
                {pick('管理员权限', 'Admin access')}
              </div>
              <h2>{pick('管理员后台解锁', 'Unlock admin console')}</h2>
              <p>
                {pick(
                  '输入管理员密码后才能编辑积分模型规则、汇率规则和高权限操作；普通账号的积分模型显示与使用不会受这 30 分钟会话影响。',
                  'Enter the admin password to edit credit model rules, exchange rules, and privileged tools. End-user model access is not affected by this 30-minute session.'
                )}
              </p>
            </div>
            <div className="settings-reference-actions">
              <SettingsBadge tone="neutral">
                {pick('当前账号：', 'Current account: ')}
                {userLabel}
              </SettingsBadge>
            </div>
          </div>

          <div className="settings-reference-grid-2">
            <div className="settings-reference-card settings-reference-card--elevated p-6">
              <div className="settings-reference-card__header">
                <div>
                  <div className="settings-reference-card__eyebrow">
                    {pick('后台解锁', 'Unlock')}
                  </div>
                  <div className="settings-reference-card__title">
                    {pick('输入管理员密码', 'Enter the admin password')}
                  </div>
                  <div className="settings-reference-card__meta">
                    {pick(
                      '解锁后只开放后台编辑能力，会话默认保持 30 分钟；到期后需要重新验证，但不会影响普通账号继续使用积分模型。',
                      'Unlocking enables admin editing for 30 minutes. When it expires, verify again, but normal users can still use credit models.'
                    )}
                  </div>
                </div>
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-[20px] border"
                  style={{
                    borderColor: 'var(--state-warning-border)',
                    background: 'var(--state-warning-bg)',
                    color: 'var(--state-warning-text)',
                  }}
                >
                  <Lock size={22} />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <label className="block">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    {pick('管理员密码', 'Admin password')}
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void verifyAdminPassword();
                      }
                    }}
                    placeholder={pick('请输入管理员密码', 'Enter the admin password')}
                    className="w-full rounded-[20px] border px-4 py-3 text-sm outline-none transition"
                    style={{
                      borderColor: 'var(--settings-border-subtle)',
                      background: 'var(--settings-surface-overlay)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </label>

                <div className="flex flex-wrap gap-3">
                  <SettingsActionButton
                    icon={Fingerprint}
                    tone="primary"
                    loading={verifying}
                    onClick={() => void verifyAdminPassword()}
                  >
                    {verifying ? pick('验证中...', 'Verifying...') : pick('解锁后台', 'Unlock console')}
                  </SettingsActionButton>
                </div>
              </div>
            </div>

            <div className="settings-reference-card settings-reference-card--soft p-6">
              <div className="settings-reference-card__header">
                <div>
                  <div className="settings-reference-card__eyebrow">
                    {pick('模块预览', 'Modules')}
                  </div>
                  <div className="settings-reference-card__title">
                    {pick('解锁后可编辑的后台模块', 'Admin editing modules')}
                  </div>
                  <div className="settings-reference-card__meta">
                    {pick(
                      '解锁后会进入统一的后台编辑控制台，只影响管理员维护操作，不影响普通用户前台使用。',
                      'After unlocking, every admin editing page opens inside the same console shell without affecting the end-user experience.'
                    )}
                  </div>
                </div>
                <SettingsBadge tone="neutral">{pick('3 个模块', '3 modules')}</SettingsBadge>
              </div>

              <div className="mt-5 settings-reference-list">
                <ModulePreviewRow
                  title={pick('积分模型', 'Credit models')}
                  meta={pick('供应商、模型路由、画质档位和积分定价编辑。', 'Edit providers, model routes, quality tiers, and credit pricing.')}
                  value={pick('编辑', 'Edit')}
                />
                <ModulePreviewRow
                  title={pick('汇率规则', 'Exchange rules')}
                  meta={pick('充值币种、兑换比例、可见性与限额。', 'Recharge currencies, exchange ratios, visibility, and limits.')}
                  value={pick('汇率', 'Rates')}
                />
                <ModulePreviewRow
                  title={pick('高级操作', 'Admin operations')}
                  meta={pick('管理员改密、手动充值和权限授予。', 'Password changes, manual recharges, and role grants.')}
                  value={pick('操作', 'Ops')}
                />
              </div>
            </div>
          </div>
        </div>
      </SettingsViewShell>
    );
  }

  return (
    <SettingsViewShell>
      <div className="settings-reference-stack">
        <div className="settings-reference-page-header">
          <div className="settings-reference-page-header__lead">
            <div className="settings-reference-page-header__eyebrow">
              {pick('管理员控制台', 'Administrator console')}
            </div>
            <h2>{pick('高级设置控制台', 'Advanced settings console')}</h2>
            <p>
              {pick(
                '统一维护积分模型、充值汇率和管理员高权限操作，界面结构与其他设置页保持一致，收敛到同一套深色控制台视觉语言。',
                'Maintain credit models, recharge rates, and privileged admin actions in a single console that matches the rest of settings.'
              )}
            </p>
          </div>
          <div className="settings-reference-actions">
            <SettingsBadge tone="emerald">{pick('会话已激活', 'Session active')}</SettingsBadge>
            <SettingsActionButton icon={RefreshCw} onClick={() => navigate(activeTabMeta.path, { replace: true })}>
              {pick('刷新当前页', 'Refresh page')}
            </SettingsActionButton>
            <SettingsActionButton icon={Lock} tone="danger" onClick={lockNow}>
              {pick('立即锁定', 'Lock now')}
            </SettingsActionButton>
          </div>
        </div>

        <div className="settings-reference-grid-4">
          <ReferenceMetric
            label={pick('后台状态', 'Console status')}
            value={pick('已解锁', 'Unlocked')}
            helper={pick('管理员二次验证已通过，可以执行后台配置写入。', 'Admin verification passed and privileged changes are now allowed.')}
          />
          <ReferenceMetric
            label={pick('会话剩余', 'Time remaining')}
            value={formatRemainingMinutes(adminSessionExpiresAt, pick)}
            helper={pick('到期后会自动清理，需要重新输入管理员密码。', 'The session clears automatically when it expires.')}
          />
          <ReferenceMetric
            label={pick('当前账号', 'Current account')}
            value={userLabel}
            helper={pick('当前高权限操作将以该账号身份执行。', 'Privileged actions run as this account.')}
          />
          <ReferenceMetric
            label={pick('密码状态', 'Password status')}
            value={requiresAdminPasswordChange ? pick('需更新', 'Needs update') : pick('正常', 'Healthy')}
            helper={
              requiresAdminPasswordChange
                ? pick('建议先在高级操作中更新管理员密码，再继续其他后台维护。', 'Update the admin password before making other privileged changes.')
                : pick('管理员密码状态正常。', 'The admin password status looks good.')
            }
          />
        </div>

        {requiresAdminPasswordChange ? (
          <div
            className="settings-reference-card p-5"
            style={{
              borderColor: 'var(--state-warning-border)',
              background:
                'linear-gradient(180deg, rgb(245 158 11 / 0.08) 0%, transparent 100%), color-mix(in srgb, var(--settings-surface-overlay) 88%, rgb(245 158 11 / 0.12))',
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border"
                style={{
                  borderColor: 'var(--state-warning-border)',
                  background: 'var(--state-warning-bg)',
                  color: 'var(--state-warning-text)',
                }}
              >
                <ShieldEllipsis size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {pick('管理员密码需要更新', 'Admin password needs attention')}
                </div>
                <div className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                  {pick(
                    '当前后台仍检测到默认或待更新的密码状态。建议优先进入“高级操作”完成改密，再继续其他高权限配置。',
                    'The console still detects a default or pending password state. Update it in Admin operations before continuing.'
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="settings-reference-grid-2">
          <div className="settings-reference-card settings-reference-card--soft p-5">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">
                  {pick('模块导航', 'Modules')}
                </div>
                <div className="settings-reference-card__title">
                  {pick('后台模块导航', 'Admin module navigation')}
                </div>
                <div className="settings-reference-card__meta">
                  {pick(
                    '每个模块都沿用统一的卡片密度、深色底板和操作按钮体系。',
                    'Every module uses the same dark panel layout and action patterns.'
                  )}
                </div>
              </div>
              <StatusBadge status="online" label={pick('已验证', 'Verified')} />
            </div>

            <div className="mt-5 space-y-3">
              {tabOptions.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => switchTab(tab.id)}
                    className="settings-reference-list-item w-full text-left transition"
                    style={
                      isActive
                        ? {
                            borderColor: 'rgb(var(--settings-accent-rgb) / 0.28)',
                            background:
                              'linear-gradient(180deg, rgb(var(--settings-accent-rgb) / 0.12) 0%, transparent 100%), var(--settings-surface-elevated)',
                          }
                        : undefined
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="settings-reference-list-item__title">{tab.label}</div>
                        {isActive ? <SettingsBadge tone="indigo">{pick('当前', 'Current')}</SettingsBadge> : null}
                      </div>
                      <div className="settings-reference-list-item__meta">{tab.description}</div>
                    </div>
                    <div className="settings-reference-list-item__value">
                      {isActive ? pick('已打开', 'Active') : pick('进入', 'Open')}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="settings-reference-card settings-reference-card--elevated p-5">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">
                  {pick('当前模块', 'Current module')}
                </div>
                <div className="settings-reference-card__title">{activeTabMeta.label}</div>
                <div className="settings-reference-card__meta">{activeTabMeta.description}</div>
              </div>
              <div
                className="flex h-12 w-12 items-center justify-center rounded-[18px] border"
                style={{
                  borderColor: 'var(--settings-border-subtle)',
                  background: 'var(--settings-surface-overlay)',
                  color: 'var(--text-primary)',
                }}
              >
                {activeTab === 'credit-models' ? (
                  <ShieldCheck size={18} />
                ) : activeTab === 'exchange-rates' ? (
                  <RefreshCw size={18} />
                ) : (
                  <UserRound size={18} />
                )}
              </div>
            </div>

            <div className="mt-5 settings-reference-metric-grid">
              <ReferenceMetric
                label={pick('模块总数', 'Module count')}
                value={pick('3', '3')}
                helper={pick('积分、汇率与管理员操作都已纳入统一入口。', 'Credits, exchange rules, and admin operations share one entry point.')}
              />
              <ReferenceMetric
                label={pick('访问状态', 'Access state')}
                value={pick('已验证', 'Verified')}
                helper={pick('当前账号已完成管理员二次验证。', 'The current account completed the second admin check.')}
              />
              <ReferenceMetric
                label={pick('当前路径', 'Current route')}
                value={activeTabMeta.path.replace('/settings/', '')}
                helper={pick('标签切换时会同步更新设置路由。', 'Switching tabs also updates the settings route.')}
              />
              <ReferenceMetric
                label={pick('安全建议', 'Security')}
                value={requiresAdminPasswordChange ? pick('建议更新', 'Update') : pick('状态正常', 'Normal')}
                helper={pick('建议优先处理密码安全，再进行其他后台维护。', 'Address password safety first before continuing other admin maintenance.')}
              />
            </div>
          </div>
        </div>

        <div
          className="rounded-[28px] border p-5"
          style={{ borderColor: 'var(--border-light)', backgroundColor: 'var(--bg-overlay)' }}
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                {pick('模块工作区', 'Module workspace')}
              </div>
              <div className="mt-2 text-[20px] font-semibold text-[var(--text-primary)]">
                {activeTabMeta.label}
              </div>
              <div className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">
                {activeTabMeta.description}
              </div>
            </div>
            <SettingsBadge tone="neutral">{pick('统一控制台', 'Shared console shell')}</SettingsBadge>
          </div>

          <div>{resolveActiveComponent(activeTab)}</div>
        </div>
      </div>
    </SettingsViewShell>
  );
};

export default AdminSystem;
