import React, { useMemo, useState } from 'react';
import { KeyRound, Shield, ShieldAlert, Wallet } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { clearStoredAdminSession } from '../../services/api/adminSession';
import { legacyWebApiClient } from '../../services/api/kkApiClient';
import { notify } from '../../services/system/notificationService';
import {
  MetricCard,
  PrimaryButton,
  SettingCard,
  SettingInput,
} from './ui/index';

const DEFAULT_RECHARGE_REMARK = '管理员手动充值';

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

const AdminConsoleSettings: React.FC = () => {
  const { user } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [identity, setIdentity] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState(100);
  const [rechargeRemark, setRechargeRemark] = useState(DEFAULT_RECHARGE_REMARK);
  const [recharging, setRecharging] = useState(false);

  const [newAdminIdentity, setNewAdminIdentity] = useState('');
  const [settingAdmin, setSettingAdmin] = useState(false);

  const amountLabel = useMemo(() => `${rechargeAmount} 积分`, [rechargeAmount]);

  const requireAdminUserId = (): string | null => {
    const userId = user?.id;
    if (!userId) {
      notify.error('管理员身份缺失', '请先登录管理员账号后再继续操作。');
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
      notify.error('信息不完整', '请填写旧密码、新密码和确认密码。');
      return;
    }

    if (newPassword !== confirmPassword) {
      notify.error('两次输入不一致', '请确认两次输入的新密码完全一致。');
      return;
    }

    if (newPassword.length < 8) {
      notify.error('密码过短', '新密码至少需要 8 位。');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await legacyWebApiClient.changeAdminPassword(
        {
          oldPassword,
          newPassword,
        },
        buildAdminRequestOptions(buildRequestId('admin-password-change', userId)),
      );

      if (!response.success) {
        throw new Error(response.error.message || '管理员密码修改失败。');
      }

      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      clearStoredAdminSession();
      notify.success('修改成功', '管理员密码已更新，请重新验证后台会话。');
    } catch (error: any) {
      notify.error('修改失败', error?.message || '请检查旧密码后重试。');
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
      notify.error('缺少目标用户', '请输入用户 ID 或邮箱。');
      return;
    }

    setRecharging(true);
    try {
      const response = await legacyWebApiClient.adminRechargeCredits(
        {
          identity: identity.trim(),
          creditAmount: rechargeAmount,
          description: rechargeRemark.trim() || DEFAULT_RECHARGE_REMARK,
        },
        buildAdminRequestOptions(buildRequestId('admin-recharge', identity)),
      );

      if (!response.success) {
        throw new Error(response.error.message || '充值失败。');
      }

      notify.success('充值成功', `最新余额：${response.data.balanceAfter} 积分`);
      setIdentity('');
    } catch (error: any) {
      notify.error('充值失败', error?.message || '请检查用户信息后重试。');
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
      notify.error('缺少目标用户', '请输入用户 ID 或邮箱。');
      return;
    }

    setSettingAdmin(true);
    try {
      const response = await legacyWebApiClient.setUserRole(
        {
          identity: newAdminIdentity.trim(),
          role: 'admin',
        },
        buildAdminRequestOptions(buildRequestId('admin-role', newAdminIdentity)),
      );

      if (!response.success) {
        throw new Error(response.error.message || '授予管理员权限失败。');
      }

      notify.success('设置成功', `已将 ${newAdminIdentity.trim()} 设为管理员。`);
      setNewAdminIdentity('');
    } catch (error: any) {
      notify.error('设置失败', error?.message || '请检查用户信息后重试。');
    } finally {
      setSettingAdmin(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          value="至少 8 位"
          label="密码策略"
          helper="建议尽快替换默认管理员密码"
          tone="amber"
        />
        <MetricCard
          value={amountLabel}
          label="本次充值"
          helper="提交前可再次核对金额"
          tone="emerald"
        />
        <MetricCard
          value="管理员作用域"
          label="权限范围"
          helper="影响后台配置与用户资产"
          tone="rose"
        />
        <MetricCard
          value="3 项"
          label="当前操作"
          helper="密码、充值、授权"
          tone="neutral"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
        <SettingCard title="修改管理员密码">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <SettingInput
                label="旧密码"
                type="password"
                value={oldPassword}
                onChange={setOldPassword}
                placeholder="输入当前密码"
              />
              <SettingInput
                label="新密码"
                type="password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="至少 8 位"
              />
              <SettingInput
                label="确认新密码"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="再次输入新密码"
              />
            </div>

            <div className="rounded-2xl border border-[var(--border-light)] bg-[color-mix(in_srgb,var(--bg-tertiary)_45%,transparent)] p-4 text-[13px] leading-6 text-[var(--text-secondary)]">
              建议同时使用字母、数字和符号组合。修改成功后，再次进入后台时需要使用新密码验证。
            </div>

            <div className="flex gap-2">
              <PrimaryButton onClick={() => void handleChangePassword()} loading={changingPassword}>
                <KeyRound size={14} className="mr-1 inline-block" />
                保存新密码
              </PrimaryButton>
            </div>
          </div>
        </SettingCard>

        <SettingCard title="给用户充值积分">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <SettingInput
                label="用户 ID 或邮箱"
                value={identity}
                onChange={setIdentity}
                placeholder="例如 user@example.com"
              />
              <SettingInput
                label="备注"
                value={rechargeRemark}
                onChange={setRechargeRemark}
                placeholder="可选备注"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),180px]">
              <div className="rounded-2xl border border-[var(--border-light)] bg-[color-mix(in_srgb,var(--bg-tertiary)_45%,transparent)] p-4">
                <div className="text-[13px] font-medium text-[var(--text-primary)]">充值额度</div>
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
                label="积分值"
                type="number"
                value={String(rechargeAmount)}
                onChange={(value) => setRechargeAmount(Math.max(1, Number(value) || 1))}
              />
            </div>

            <div className="rounded-2xl border border-[var(--border-light)] bg-[color-mix(in_srgb,var(--bg-tertiary)_45%,transparent)] p-4 text-[13px] leading-6 text-[var(--text-secondary)]">
              <div>目标用户：{identity.trim() || '尚未填写'}</div>
              <div>充值额度：{amountLabel}</div>
              <div>备注信息：{rechargeRemark.trim() || DEFAULT_RECHARGE_REMARK}</div>
            </div>

            <div className="flex gap-2">
              <PrimaryButton onClick={() => void handleRecharge()} loading={recharging}>
                <Wallet size={14} className="mr-1 inline-block" />
                确认充值
              </PrimaryButton>
            </div>
          </div>
        </SettingCard>
      </div>

      <SettingCard title="授予管理员权限">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),320px]">
          <div className="space-y-4">
            <SettingInput
              label="用户 ID 或邮箱"
              value={newAdminIdentity}
              onChange={setNewAdminIdentity}
              placeholder="输入后将授予管理员权限"
            />

            <div className="flex gap-2">
              <PrimaryButton onClick={() => void handleSetAdmin()} loading={settingAdmin}>
                <Shield size={14} className="mr-1 inline-block" />
                确认设为管理员
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
              操作提醒
            </div>
            <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
              管理员拥有全局配置能力，请先核对目标账号身份。更推荐通过邮箱定位，方便人工复核。
            </div>
          </div>
        </div>
      </SettingCard>
    </div>
  );
};

export default AdminConsoleSettings;
