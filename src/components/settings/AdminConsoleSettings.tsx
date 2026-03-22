import React, { useMemo, useState } from 'react';
import { KeyRound, Shield, ShieldAlert, Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { notify } from '../../services/system/notificationService';
import {
  MetricCard,
  PrimaryButton,
  SettingCard,
  SettingInput,
} from './ui/index';

const AdminConsoleSettings: React.FC = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [identity, setIdentity] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState(100);
  const [rechargeRemark, setRechargeRemark] = useState('管理员手动充值');
  const [recharging, setRecharging] = useState(false);

  const [newAdminIdentity, setNewAdminIdentity] = useState('');
  const [settingAdmin, setSettingAdmin] = useState(false);

  const amountLabel = useMemo(() => `${rechargeAmount} 积分`, [rechargeAmount]);

  const handleChangePassword = async () => {
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
      const { data, error } = await supabase.rpc('admin_change_password_secure', {
        p_old_password: oldPassword,
        p_new_password: newPassword,
      });

      if (error || data !== true) {
        throw error || new Error('管理员密码修改失败。');
      }

      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notify.success('修改成功', '管理员密码已更新。');
    } catch (error: any) {
      notify.error('修改失败', error?.message || '请检查旧密码后重试。');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleRecharge = async () => {
    if (!identity.trim()) {
      notify.error('缺少目标用户', '请输入用户 ID 或邮箱。');
      return;
    }

    setRecharging(true);
    try {
      const { data, error } = await supabase.rpc('admin_recharge_credits_by_identity', {
        p_identity: identity.trim(),
        p_amount: rechargeAmount,
        p_description: rechargeRemark.trim() || '管理员手动充值',
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.success) {
        throw new Error(row?.message || '充值失败。');
      }

      notify.success('充值成功', `新余额：${row.new_balance} 积分`);
      setIdentity('');
    } catch (error: any) {
      notify.error('充值失败', error?.message || '请检查用户信息后重试。');
    } finally {
      setRecharging(false);
    }
  };

  const handleSetAdmin = async () => {
    if (!newAdminIdentity.trim()) {
      notify.error('缺少目标用户', '请输入用户 ID 或邮箱。');
      return;
    }

    setSettingAdmin(true);
    try {
      const { error } = await supabase.rpc('admin_set_user_role_by_identity', {
        p_identity: newAdminIdentity.trim(),
        p_role: 'admin',
      });

      if (error) throw error;

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
          helper="建议尽快替换默认密码"
          tone="amber"
        />
        <MetricCard
          value={amountLabel}
          label="本次充值"
          helper="提交前可再次核对"
          tone="emerald"
        />
        <MetricCard
          value="管理员作用域"
          label="权限范围"
          helper="会影响后台配置与用户资产"
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
              建议使用字母、数字和符号组合。修改成功后，后续再次进入后台需要使用新密码验证。
            </div>

            <div className="flex gap-2">
              <PrimaryButton onClick={() => void handleChangePassword()} loading={changingPassword}>
                <KeyRound size={14} className="mr-1 inline-block" />
                {changingPassword ? '保存中...' : '保存新密码'}
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
              <div>备注信息：{rechargeRemark.trim() || '管理员手动充值'}</div>
            </div>

            <div className="flex gap-2">
              <PrimaryButton onClick={() => void handleRecharge()} loading={recharging}>
                <Wallet size={14} className="mr-1 inline-block" />
                {recharging ? '充值中...' : '确认充值'}
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
                {settingAdmin ? '设置中...' : '确认设为管理员'}
              </PrimaryButton>
            </div>
          </div>

          <div className="rounded-2xl border p-4" style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 12%, transparent)', borderColor: 'color-mix(in srgb, var(--warning) 28%, transparent)' }}>
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
