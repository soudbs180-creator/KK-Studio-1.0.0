import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, Settings, ShieldAlert, ShieldCheck } from 'lucide-react';

import { useAdminRole } from '../../hooks/useAdminRole';
import {
  clearStoredAdminSession,
  setStoredAdminSession,
} from '../../services/api/adminSession';
import { legacyWebApiClient } from '../../services/api/kkApiClient';
import { notify } from '../../services/system/notificationService';
import AdminConsoleSettings from './AdminConsoleSettings';
import CreditModelSettings from './CreditModelSettings';
import { PrimaryButton, SecondaryButton } from './ui/index';
import { ExchangeRateSettingsView } from './views/ExchangeRateSettingsView';

type AdminTab = 'credit-models' | 'exchange-rates' | 'admin-console';

function buildAdminRequestId(prefix: string, userId?: string) {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  return `${prefix}-${userId || 'anonymous'}-${uuid}`;
}

function buildAdminRequestOptions(requestId?: string) {
  return {
    requestId,
  };
}

const TAB_OPTIONS: Array<{ id: AdminTab; label: string; description: string }> = [
  {
    id: 'credit-models',
    label: '积分模型',
    description: '维护积分模型、供应商和高阶出图配置。',
  },
  {
    id: 'exchange-rates',
    label: '汇率设置',
    description: '维护充值汇率、金额上下限和前台可见性。',
  },
  {
    id: 'admin-console',
    label: '后台管理',
    description: '修改管理员密码、手动充值和授予管理员权限。',
  },
];

function formatRemainingMinutes(expiresAt?: string): string {
  if (!expiresAt) {
    return '未验证';
  }

  const remaining = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return '已过期';
  }

  return `${Math.ceil(remaining / 60000)} 分钟`;
}

function renderActiveTab(tab: AdminTab) {
  if (tab === 'credit-models') {
    return <CreditModelSettings />;
  }

  if (tab === 'exchange-rates') {
    return <ExchangeRateSettingsView />;
  }

  return <AdminConsoleSettings />;
}

export const AdminSystem: React.FC<{ initialTab?: AdminTab }> = ({ initialTab = 'credit-models' }) => {
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

  const userLabel = user?.email || user?.phone || user?.id || '未登录';
  const unlocked = adminSessionActive;
  const activeTabMeta = useMemo(
    () => TAB_OPTIONS.find((item) => item.id === activeTab) || TAB_OPTIONS[0],
    [activeTab],
  );

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

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
      notify.error('缺少密码', '请输入管理员密码。');
      return;
    }

    if (!user?.id) {
      notify.error('身份失效', '请重新登录后再验证管理员密码。');
      return;
    }

    setVerifying(true);
    try {
      const response = await legacyWebApiClient.verifyAdminPassword(
        {
          password,
        },
        buildAdminRequestOptions(buildAdminRequestId('admin-unlock', user.id)),
      );

      if (!response.success) {
        notify.error('验证失败', response.error.message || '管理员密码错误。');
        return;
      }

      setStoredAdminSession(
        response.data.adminSessionToken,
        response.data.adminSessionExpiresAt,
      );
      setPassword('');
      notify.success('验证通过', '管理员后台已解锁。');
    } catch (error: any) {
      notify.error('验证失败', error?.message || '请稍后重试。');
    } finally {
      setVerifying(false);
    }
  };

  const lockNow = () => {
    clearStoredAdminSession();
  };

  if (authLoading || checkingAdmin) {
    return (
      <div className="space-y-4">
        <div
          className="rounded-[28px] border p-8 text-center"
          style={{ borderColor: 'var(--border-light)', backgroundColor: 'var(--bg-overlay)' }}
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border"
            style={{ borderColor: 'var(--border-light)' }}
          >
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div className="mt-4 text-lg font-semibold text-[var(--text-primary)]">正在校验管理员权限</div>
          <div className="mt-2 text-sm text-[var(--text-secondary)]">当前账号：{userLabel}</div>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="space-y-4">
        <div
          className="rounded-[28px] border p-8"
          style={{
            borderColor: 'var(--state-danger-border)',
            backgroundColor: 'var(--state-danger-bg)',
          }}
        >
          <div className="flex items-center gap-3 text-[var(--state-danger-text)]">
            <ShieldAlert className="h-5 w-5" />
            <div className="text-lg font-semibold">管理员权限不足</div>
          </div>
          <div className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            只有管理员账户才能进入后台模块。请确认当前登录账号正确，并且已经设置
            <code className="mx-1 rounded bg-black/10 px-1 py-0.5">profiles.role = admin</code>
            。
          </div>
          <div
            className="mt-4 rounded-2xl border px-4 py-3 text-sm"
            style={{ borderColor: 'var(--border-light)', backgroundColor: 'var(--bg-overlay)' }}
          >
            当前账号：{userLabel}
          </div>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="space-y-4">
        <div
          className="rounded-[28px] border p-8"
          style={{ borderColor: 'var(--border-light)', backgroundColor: 'var(--bg-overlay)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl border"
              style={{
                borderColor: 'var(--state-warning-border)',
                backgroundColor: 'var(--state-warning-bg)',
                color: 'var(--state-warning-text)',
              }}
            >
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold text-[var(--text-primary)]">管理员后台登录</div>
              <div className="text-sm text-[var(--text-secondary)]">
                输入管理员密码后，才会显示后台模块。
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr),260px]">
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">管理员密码</span>
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
                  className="w-full rounded-2xl border px-4 py-3 text-sm"
                  style={{
                    borderColor: 'var(--border-light)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </label>

              <div className="flex gap-2">
                <PrimaryButton onClick={() => void verifyAdminPassword()} loading={verifying}>
                  {verifying ? '验证中...' : '登录后台'}
                </PrimaryButton>
              </div>
            </div>

            <div
              className="rounded-2xl border p-4 text-sm leading-6"
              style={{ borderColor: 'var(--border-light)', backgroundColor: 'var(--bg-secondary)' }}
            >
              <div className="font-medium text-[var(--text-primary)]">会话说明</div>
              <div className="mt-2 text-[var(--text-secondary)]">
                解锁后会话保持 30 分钟。到期后需要重新输入管理员密码。
              </div>
              <div className="mt-3 text-[var(--text-secondary)]">当前账号：{userLabel}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-[28px] border p-6"
        style={{ borderColor: 'var(--border-light)', backgroundColor: 'var(--bg-overlay)' }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
              style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
            >
              <Settings className="h-3.5 w-3.5" />
              高级设置
            </div>
            <div className="text-2xl font-semibold text-[var(--text-primary)]">管理员后台</div>
            <div className="max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              这里集中维护积分模型、充值汇率和高权限操作。所有后台写入都应该通过迁移后的主
              API 执行。
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={lockNow}>立即锁定</SecondaryButton>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: 'var(--border-light)', backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="text-sm text-[var(--text-tertiary)]">后台状态</div>
            <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
              <ShieldCheck className="h-4 w-4 text-[var(--state-success-text)]" />
              已验证
            </div>
          </div>
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: 'var(--border-light)', backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="text-sm text-[var(--text-tertiary)]">会话剩余</div>
            <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
              {formatRemainingMinutes(adminSessionExpiresAt)}
            </div>
          </div>
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: 'var(--border-light)', backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="text-sm text-[var(--text-tertiary)]">当前账号</div>
            <div className="mt-2 truncate text-lg font-semibold text-[var(--text-primary)]">
              {userLabel}
            </div>
          </div>
          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: requiresAdminPasswordChange
                ? 'var(--state-warning-border)'
                : 'var(--border-light)',
              backgroundColor: requiresAdminPasswordChange
                ? 'var(--state-warning-bg)'
                : 'var(--bg-secondary)',
            }}
          >
            <div className="text-sm text-[var(--text-tertiary)]">密码状态</div>
            <div
              className="mt-2 text-lg font-semibold"
              style={{
                color: requiresAdminPasswordChange
                  ? 'var(--state-warning-text)'
                  : 'var(--text-primary)',
              }}
            >
              {requiresAdminPasswordChange ? '需立即修改' : '安全'}
            </div>
          </div>
        </div>
      </div>

      {requiresAdminPasswordChange ? (
        <div
          className="rounded-[24px] border p-4 text-sm leading-6"
          style={{
            borderColor: 'var(--state-warning-border)',
            backgroundColor: 'var(--state-warning-bg)',
            color: 'var(--state-warning-text)',
          }}
        >
          当前管理员密码仍处于默认或待更新状态。建议先进入“后台管理”模块完成改密，再继续执行其他高权限操作。
        </div>
      ) : null}

      <div
        className="rounded-[28px] border p-4"
        style={{ borderColor: 'var(--border-light)', backgroundColor: 'var(--bg-overlay)' }}
      >
        <div className="flex flex-wrap gap-2">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="rounded-full px-4 py-2 text-sm transition"
              style={{
                border: '1px solid var(--border-light)',
                backgroundColor: activeTab === tab.id ? 'var(--bg-secondary)' : 'transparent',
                color: 'var(--text-primary)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          className="mt-4 rounded-2xl border p-4 text-sm leading-6"
          style={{ borderColor: 'var(--border-light)', backgroundColor: 'var(--bg-secondary)' }}
        >
          <div className="font-medium text-[var(--text-primary)]">{activeTabMeta.label}</div>
          <div className="mt-1 text-[var(--text-secondary)]">{activeTabMeta.description}</div>
        </div>
      </div>

      {renderActiveTab(activeTab)}
    </div>
  );
};

export default AdminSystem;
