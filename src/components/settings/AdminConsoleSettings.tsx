import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyRound, Shield, ShieldAlert, Wallet } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { clearStoredAdminSession } from '../../services/api/adminSession';
import {
  ADMIN_CONSOLE_DRAFT_SCOPE,
  loadScopedAdminConsoleState,
  saveScopedAdminConsoleState,
} from '../../services/admin/adminConsoleState';
import { legacyWebApiClient } from '../../services/api/kkApiClient';
import { notify } from '../../services/system/notificationService';
import {
  MetricCard,
  PrimaryButton,
  SettingCard,
  SettingInput,
} from './ui/index';

const DEFAULT_RECHARGE_REMARK_ZH = '管理员手动充值';
const DEFAULT_RECHARGE_REMARK_EN = 'Manual admin recharge';

type AdminConsoleDraft = {
  identity: string;
  rechargeAmount: number;
  rechargeRemark: string;
  newAdminIdentity: string;
};

function buildRequestId(prefix: string, suffix?: string): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  const safeSuffix = String(suffix || '').trim();
  return `${prefix}-${safeSuffix || 'anonymous'}-${uuid}`;
}

function buildAdminRequestOptions(requestId?: string) {
  return {
    requestId,
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '').trim();
    if (message) {
      return message;
    }
  }

  return fallback;
}

const AdminConsoleSettings: React.FC = () => {
  const { user } = useAuth();
  const { pick } = useLocale();
  const defaultRechargeRemark = pick(DEFAULT_RECHARGE_REMARK_ZH, DEFAULT_RECHARGE_REMARK_EN);
  const lastDraftUserIdRef = useRef<string | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [identity, setIdentity] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState(100);
  const [rechargeRemark, setRechargeRemark] = useState(DEFAULT_RECHARGE_REMARK_ZH);
  const [recharging, setRecharging] = useState(false);

  const [newAdminIdentity, setNewAdminIdentity] = useState('');
  const [settingAdmin, setSettingAdmin] = useState(false);

  useEffect(() => {
    setRechargeRemark((current) =>
      current === DEFAULT_RECHARGE_REMARK_ZH || current === DEFAULT_RECHARGE_REMARK_EN
        ? defaultRechargeRemark
        : current
    );
  }, [defaultRechargeRemark]);

  useEffect(() => {
    const nextUserId = String(user?.id || '').trim() || null;
    if (lastDraftUserIdRef.current === nextUserId) {
      return;
    }

    lastDraftUserIdRef.current = nextUserId;
    const draft = loadScopedAdminConsoleState<Partial<AdminConsoleDraft>>(
      ADMIN_CONSOLE_DRAFT_SCOPE,
      nextUserId || undefined,
    );

    if (!draft) {
      setIdentity('');
      setRechargeAmount(100);
      setRechargeRemark(defaultRechargeRemark);
      setNewAdminIdentity('');
      return;
    }

    const nextRechargeAmount = Number(draft.rechargeAmount);
    setIdentity(typeof draft.identity === 'string' ? draft.identity : '');
    setRechargeAmount(
      Number.isFinite(nextRechargeAmount) && nextRechargeAmount > 0
        ? Math.max(1, Math.round(nextRechargeAmount))
        : 100,
    );
    setRechargeRemark(
      typeof draft.rechargeRemark === 'string' && draft.rechargeRemark.trim()
        ? draft.rechargeRemark
        : defaultRechargeRemark,
    );
    setNewAdminIdentity(
      typeof draft.newAdminIdentity === 'string' ? draft.newAdminIdentity : '',
    );
  }, [defaultRechargeRemark, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    saveScopedAdminConsoleState<AdminConsoleDraft>(ADMIN_CONSOLE_DRAFT_SCOPE, user.id, {
      identity,
      rechargeAmount,
      rechargeRemark,
      newAdminIdentity,
    });
  }, [identity, newAdminIdentity, rechargeAmount, rechargeRemark, user?.id]);

  const amountLabel = useMemo(
    () => `${rechargeAmount} ${pick('积分', 'credits')}`,
    [pick, rechargeAmount]
  );

  const requireAdminUserId = (): string | null => {
    const userId = user?.id;
    if (!userId) {
      notify.error(
        pick('缺少管理员身份', 'Missing admin identity'),
        pick(
          '请先登录管理员账号后再继续操作。',
          'Please sign in with an admin account before continuing.'
        )
      );
      return null;
    }

    return userId;
  };

  const handleChangePassword = async () => {
    const userId = requireAdminUserId();
    if (!userId) {
      return;
    }

    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      notify.error(
        pick('信息不完整', 'Incomplete information'),
        pick(
          '请输入当前密码、新密码和确认密码。',
          'Enter the current password, new password, and confirmation password.'
        )
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      notify.error(
        pick('两次输入不一致', 'Passwords do not match'),
        pick('请确认两次输入的新密码完全一致。', 'Make sure the new password matches in both fields.')
      );
      return;
    }

    if (newPassword.length < 8) {
      notify.error(
        pick('密码过短', 'Password too short'),
        pick('新密码至少需要 8 位。', 'The new password must be at least 8 characters long.')
      );
      return;
    }

    setChangingPassword(true);
    try {
      const response = await legacyWebApiClient.changeAdminPassword(
        {
          oldPassword,
          newPassword,
        },
        buildAdminRequestOptions(buildRequestId('admin-password-change', userId))
      );

      if (!response.success) {
        throw new Error(
          response.error?.message || pick('管理员密码修改失败。', 'Failed to change the admin password.')
        );
      }

      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      clearStoredAdminSession();
      notify.success(
        pick('修改成功', 'Password updated'),
        pick(
          '管理员密码已更新，请重新输入新密码解锁后台。',
          'The admin password has been updated. Use the new password to unlock the console again.'
        )
      );
    } catch (error) {
      notify.error(
        pick('修改失败', 'Update failed'),
        getErrorMessage(error, pick('请检查当前密码后重试。', 'Check the current password and try again.'))
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const handleRecharge = async () => {
    const userId = requireAdminUserId();
    if (!userId) {
      return;
    }

    if (!identity.trim()) {
      notify.error(
        pick('缺少目标用户', 'Missing target user'),
        pick('请输入用户 ID 或邮箱。', 'Enter a user ID or email address.')
      );
      return;
    }

    if (!Number.isFinite(rechargeAmount) || rechargeAmount <= 0) {
      notify.error(
        pick('充值数额无效', 'Invalid recharge amount'),
        pick('充值积分必须大于 0。', 'Recharge credits must be greater than 0.')
      );
      return;
    }

    setRecharging(true);
    try {
      const response = await legacyWebApiClient.adminRechargeCredits(
        {
          identity: identity.trim(),
          creditAmount: rechargeAmount,
          description: rechargeRemark.trim() || defaultRechargeRemark,
        },
        buildAdminRequestOptions(buildRequestId('admin-recharge', userId))
      );

      if (!response.success) {
        throw new Error(response.error?.message || pick('充值失败。', 'Recharge failed.'));
      }

      const balanceAfter = Number(response.data.balanceAfter || 0);
      notify.success(
        pick('充值成功', 'Recharge completed'),
        pick(`最新余额：${balanceAfter} 积分`, `Latest balance: ${balanceAfter} credits`)
      );
      setIdentity('');
    } catch (error) {
      notify.error(
        pick('充值失败', 'Recharge failed'),
        getErrorMessage(
          error,
          pick('请检查目标用户信息后重试。', 'Check the target user information and try again.')
        )
      );
    } finally {
      setRecharging(false);
    }
  };

  const handleSetAdmin = async () => {
    const userId = requireAdminUserId();
    if (!userId) {
      return;
    }

    if (!newAdminIdentity.trim()) {
      notify.error(
        pick('缺少目标用户', 'Missing target user'),
        pick('请输入用户 ID 或邮箱。', 'Enter a user ID or email address.')
      );
      return;
    }

    setSettingAdmin(true);
    try {
      const normalizedIdentity = newAdminIdentity.trim();
      const response = await legacyWebApiClient.setUserRole(
        {
          identity: normalizedIdentity,
          role: 'admin',
        },
        buildAdminRequestOptions(buildRequestId('admin-role', userId))
      );

      if (!response.success) {
        throw new Error(
          response.error?.message || pick('授予管理员权限失败。', 'Failed to grant admin access.')
        );
      }

      notify.success(
        pick('设置成功', 'Role updated'),
        pick(
          `已将 ${normalizedIdentity} 设置为管理员。`,
          `${normalizedIdentity} has been granted admin access.`
        )
      );
      setNewAdminIdentity('');
    } catch (error) {
      notify.error(
        pick('设置失败', 'Update failed'),
        getErrorMessage(error, pick('授予管理员权限失败。', 'Failed to grant admin access.'))
      );
    } finally {
      setSettingAdmin(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          value={pick('至少 8 位', '8+ characters')}
          label={pick('密码策略', 'Password policy')}
          helper={pick(
            '建议尽快替换默认管理员密码。',
            'Replace the default admin password as soon as possible.'
          )}
          tone="amber"
        />
        <MetricCard
          value={amountLabel}
          label={pick('本次充值', 'Recharge amount')}
          helper={pick('提交前可再次核对金额。', 'Review the amount one more time before submitting.')}
          tone="emerald"
        />
        <MetricCard
          value={pick('高权限操作', 'Privileged actions')}
          label={pick('影响范围', 'Impact scope')}
          helper={pick(
            '这里的变更会直接影响管理员设置与用户积分。',
            'Changes here directly affect admin settings and user credits.'
          )}
          tone="rose"
        />
        <MetricCard
          value={pick('3 项', '3 actions')}
          label={pick('当前模块', 'Current module')}
          helper={pick(
            '改密、充值和授予管理员权限。',
            'Password change, recharge, and grant-admin tools.'
          )}
          tone="neutral"
        />
      </div>

      <div
        className="rounded-[24px] border p-4 text-sm leading-6"
        style={{
          borderColor: 'var(--border-light)',
          backgroundColor: 'var(--bg-overlay)',
          color: 'var(--text-secondary)',
        }}
      >
        {pick(
          '管理员改密、手动充值和角色授予统一走同一套后台 API，避免本地、部署和云端配置分叉后出现权限或数据不一致。',
          'Admin password changes, manual recharges, and role grants now run through the same backend API path so local, deployed, and cloud environments stay aligned.'
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
        <SettingCard title={pick('修改管理员密码', 'Change admin password')}>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <SettingInput
                label={pick('当前密码', 'Current password')}
                type="password"
                value={oldPassword}
                onChange={setOldPassword}
                placeholder={pick('输入当前密码', 'Enter the current password')}
              />
              <SettingInput
                label={pick('新密码', 'New password')}
                type="password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder={pick('至少 8 位', 'At least 8 characters')}
              />
              <SettingInput
                label={pick('确认新密码', 'Confirm new password')}
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder={pick('再次输入新密码', 'Enter the new password again')}
              />
            </div>

            <div className="rounded-2xl border border-[var(--border-light)] bg-[color-mix(in_srgb,var(--bg-tertiary)_45%,transparent)] p-4 text-[13px] leading-6 text-[var(--text-secondary)]">
              {pick(
                '建议同时使用字母、数字和符号组合。修改成功后，需要使用新密码重新解锁后台。',
                'Use a mix of letters, numbers, and symbols when possible. After the password changes, you will need to unlock the console again with the new password.'
              )}
            </div>

            <div className="flex gap-2">
              <PrimaryButton onClick={() => void handleChangePassword()} loading={changingPassword}>
                <KeyRound size={14} />
                {pick('保存新密码', 'Save new password')}
              </PrimaryButton>
            </div>
          </div>
        </SettingCard>

        <SettingCard title={pick('给用户充值积分', 'Recharge user credits')}>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <SettingInput
                label={pick('用户 ID 或邮箱', 'User ID or email')}
                value={identity}
                onChange={setIdentity}
                placeholder={pick('例如 user@example.com', 'For example: user@example.com')}
              />
              <SettingInput
                label={pick('备注', 'Note')}
                value={rechargeRemark}
                onChange={setRechargeRemark}
                placeholder={pick('可选备注', 'Optional note')}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),180px]">
              <div className="rounded-2xl border border-[var(--border-light)] bg-[color-mix(in_srgb,var(--bg-tertiary)_45%,transparent)] p-4">
                <div className="text-[13px] font-medium text-[var(--text-primary)]">
                  {pick('充值额度', 'Recharge amount')}
                </div>
                <input
                  type="range"
                  min={1}
                  max={1000}
                  value={rechargeAmount}
                  onChange={(event) => setRechargeAmount(Number(event.target.value))}
                  className="mt-4 w-full"
                />
              </div>
              <SettingInput
                label={pick('积分值', 'Credits')}
                type="number"
                value={String(rechargeAmount)}
                onChange={(value) => setRechargeAmount(Math.max(1, Number(value) || 1))}
              />
            </div>

            <div className="rounded-2xl border border-[var(--border-light)] bg-[color-mix(in_srgb,var(--bg-tertiary)_45%,transparent)] p-4 text-[13px] leading-6 text-[var(--text-secondary)]">
              <div>{pick('目标用户：', 'Target user: ')}{identity.trim() || pick('尚未填写', 'Not set')}</div>
              <div>{pick('充值额度：', 'Recharge amount: ')}{amountLabel}</div>
              <div>{pick('备注信息：', 'Note: ')}{rechargeRemark.trim() || defaultRechargeRemark}</div>
            </div>

            <div className="flex gap-2">
              <PrimaryButton onClick={() => void handleRecharge()} loading={recharging}>
                <Wallet size={14} />
                {pick('确认充值', 'Confirm recharge')}
              </PrimaryButton>
            </div>
          </div>
        </SettingCard>
      </div>

      <SettingCard title={pick('授予管理员权限', 'Grant admin access')}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),320px]">
          <div className="space-y-4">
            <SettingInput
              label={pick('用户 ID 或邮箱', 'User ID or email')}
              value={newAdminIdentity}
              onChange={setNewAdminIdentity}
              placeholder={pick(
                '输入后将授予管理员权限',
                'Enter a user ID or email to grant admin access'
              )}
            />

            <div className="flex gap-2">
              <PrimaryButton onClick={() => void handleSetAdmin()} loading={settingAdmin}>
                <Shield size={14} />
                {pick('确认设置为管理员', 'Grant admin access')}
              </PrimaryButton>
            </div>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--warning) 12%, transparent)',
              borderColor: 'color-mix(in srgb, var(--warning) 28%, transparent)',
            }}
          >
            <div className="flex items-center gap-2 text-[15px] font-medium text-[var(--text-primary)]">
              <ShieldAlert size={16} />
              {pick('操作提醒', 'Reminder')}
            </div>
            <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
              {pick(
                '管理员拥有全局配置能力，请先核对目标账号身份。更推荐通过邮箱定位，方便人工复核。',
                'Admins can change global configuration, so verify the target account carefully. Using email is recommended because it is easier to audit manually.'
              )}
            </div>
            <div className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">
              {pick(
                '如果这一步失败，请先确认当前账号仍然是 admin，并且本地 API、部署环境和云端数据源都使用同一套后台配置。',
                'If this action fails, first confirm the current account still has the admin role and that the local API, deployed environment, and cloud data source all point to the same backend configuration.'
              )}
            </div>
            <div className="mt-3">
              <code className="rounded bg-black/10 px-1 py-0.5">apps/api/.env.local</code>
            </div>
          </div>
        </div>
      </SettingCard>
    </div>
  );
};

export default AdminConsoleSettings;
