import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  KeyRound,
  Link2,
  Loader2,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

import { formatRemainingCredits } from '../../../services/billing/remainingBalance';
import { resolveAvatarUrl } from '../../../utils/presetAvatars';
import { USER_PROFILE_ACTIONS } from '../settingsModuleActions';
import { SettingsViewShell } from '../SettingsScaffold';
import { useAccountCenterController } from '../controllers/useAccountCenterController';

type ProfileRoute = 'account' | 'billing' | 'security';

const PROFILE_TABS: Array<{ id: ProfileRoute; label: string; path: string }> = [
  { id: 'account', label: '账户资料', path: '/settings/user-profile' },
  { id: 'billing', label: '账单余额', path: '/settings/user-profile/billing' },
  { id: 'security', label: '安全设置', path: '/settings/user-profile/security' },
];

function resolveProfileRoute(pathname: string): ProfileRoute {
  if (pathname.endsWith('/security')) return 'security';
  if (pathname.endsWith('/billing')) return 'billing';
  return 'account';
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false });
}

function statusLabel(status?: string | null): string {
  const normalized = String(status || 'completed').toLowerCase();
  if (normalized === 'pending') return '处理中';
  if (normalized === 'failed') return '失败';
  if (normalized === 'refunded') return '已退款';
  return '已完成';
}

const ProfileHeader: React.FC<{
  active: ProfileRoute;
  onNavigate: (path: string) => void;
}> = ({ active, onNavigate }) => (
  <>
    <header className="console-page-header settings-hero-flat-header">
      <div>
        <span className="console-eyebrow">Account</span>
        <h2>个人中心</h2>
        <p>管理登录身份、账单余额和账户安全。</p>
      </div>
    </header>
    <nav className="console-profile-tabs" aria-label="个人中心导航">
      {PROFILE_TABS.map((tab) => (
        <button key={tab.id} type="button" data-selected={active === tab.id} onClick={() => onNavigate(tab.path)}>
          {tab.label}
        </button>
      ))}
    </nav>
  </>
);

const AccountView: React.FC<{ controller: ReturnType<typeof useAccountCenterController> }> = ({ controller }) => {
  const [copied, setCopied] = useState(false);

  const copyId = () => {
    if (!controller.user?.id) return;
    void navigator.clipboard.writeText(controller.user.id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <div className="console-profile-columns">
        <section className="console-card">
          <div className="console-card-heading"><div><h3>账户资料</h3><p>用于 API 调用、账单和技术支持的身份信息。</p></div></div>
          <div className="console-profile-identity">
            <div className="console-avatar">
              {/* 头像可能是 `preset:xxx` 标识符而非 URL，必须经 resolveAvatarUrl 解析成真实资源，
                  否则浏览器会把它当作非法协议直接破图（其余 7 处渲染点均已正确解析）。 */}
              {resolveAvatarUrl(controller.avatarUrl) ? <img src={resolveAvatarUrl(controller.avatarUrl)} alt="头像" /> : controller.nickname.slice(0, 1).toUpperCase()}
            </div>
            <div><strong>{controller.nickname}</strong><span><Mail size={13} />{controller.displayEmail}</span></div>
          </div>
          <button
            type="button"
            className="console-setting-row console-profile-copy-id"
            onClick={copyId}
            disabled={!controller.user?.id}
            aria-label={copied ? '用户 ID 已复制' : '复制用户 ID'}
            data-user-profile-action={USER_PROFILE_ACTIONS.copyUserId.uiAction}
          >
            <span><strong>用户 ID</strong><span className="console-mono">{controller.user?.id || '-'}</span></span>
            <small>{copied ? '已复制' : '点击复制'}</small>
          </button>
        </section>

        <section className="console-card">
          <div className="console-card-heading"><div><h3>身份绑定</h3><p>检查当前可用于登录和恢复账户的方式。</p></div></div>
          <div className="console-account-list">
            <div><span className="console-provider-icon"><Mail size={15} /></span><div><strong>邮箱</strong><small>{controller.displayEmail}</small></div><span className="console-status" data-tone={controller.user?.email ? 'success' : 'neutral'}>{controller.user?.email ? '已连接' : '未连接'}</span></div>
            <div><span className="console-provider-icon"><Link2 size={15} /></span><div><strong>微信</strong><small>微信扫码登录</small></div><span className="console-status" data-tone={controller.isWechatBound ? 'success' : 'neutral'}>{controller.isWechatBound ? '已绑定' : '未绑定'}</span></div>
            <div><span className="console-provider-icon"><UserRound size={15} /></span><div><strong>Google</strong><small>Google OAuth 登录</small></div><span className="console-status" data-tone={controller.isGoogleBound ? 'success' : 'neutral'}>{controller.isGoogleBound ? '已绑定' : '未绑定'}</span></div>
          </div>
        </section>
      </div>
    </>
  );
};

const SecurityView: React.FC<{ controller: ReturnType<typeof useAccountCenterController> }> = ({ controller }) => {
  useEffect(() => { void controller.refreshMfa(); }, [controller.refreshMfa]);
  const verifiedMfa = controller.mfaStatus?.verifiedFactors.length || 0;

  return (
    <div className="console-profile-columns">
      <section className="console-card">
        <div className="console-card-heading"><div><h3>登录方式</h3><p>绑定多个身份来源，降低账户恢复风险。</p></div></div>
        <div className="console-account-list">
          <div><span className="console-provider-icon"><Link2 size={15} /></span><div><strong>微信</strong><small>{controller.isWechatBound ? '已完成绑定' : '尚未绑定'}</small></div><button type="button" className="console-secondary-button" disabled={controller.isTempUser || controller.isWechatBound || controller.busyAction === 'wechat'} onClick={() => void controller.bindWechat()}>{controller.isWechatBound ? '已绑定' : '绑定'}</button></div>
          <div><span className="console-provider-icon"><UserRound size={15} /></span><div><strong>Google</strong><small>{controller.isGoogleBound ? '已完成绑定' : '尚未绑定'}</small></div><button type="button" className="console-secondary-button" disabled={controller.isTempUser || controller.isGoogleBound || controller.busyAction === 'google'} onClick={() => void controller.bindGoogle()}>{controller.isGoogleBound ? '已绑定' : '绑定'}</button></div>
        </div>
      </section>

      <section className="console-card">
        <div className="console-card-heading"><div><h3>双重验证</h3><p>TOTP 验证器为敏感操作增加第二道校验。</p></div><span className="console-status" data-tone={verifiedMfa > 0 ? 'success' : 'neutral'}>{verifiedMfa > 0 ? '已启用' : '未启用'}</span></div>
        {controller.mfaEnrollment ? (
          <div className="console-mfa-enrollment">
            {controller.mfaEnrollment.qrCode ? <img src={controller.mfaEnrollment.qrCode} alt="TOTP 绑定二维码" /> : null}
            <code>{controller.mfaEnrollment.secret}</code>
            <label className="console-field"><span>6 位动态口令</span><input inputMode="numeric" maxLength={6} value={controller.mfaCode} onChange={(event) => controller.setMfaCode(event.target.value.replace(/\D/g, ''))} /></label>
            <button type="button" className="console-primary-button" disabled={controller.busyAction === 'mfa-verify'} onClick={() => void controller.verifyMfa()}>验证并启用</button>
          </div>
        ) : (
          <button type="button" className="console-secondary-button" disabled={controller.isTempUser || verifiedMfa > 0 || controller.busyAction === 'mfa-enroll'} onClick={() => void controller.enrollMfa()}>
            <ShieldCheck size={15} />{verifiedMfa > 0 ? '验证器已连接' : '启用验证器'}
          </button>
        )}
      </section>

      <section className="console-card console-profile-wide">
        <div className="console-card-heading"><div><h3>修改密码</h3><p>验证码发送至当前账户邮箱，有效期由服务端控制。</p></div></div>
        <div className="console-password-grid">
          <label className="console-field"><span>邮箱验证码</span><div className="console-inline-field"><input value={controller.passwordCode} onChange={(event) => controller.setPasswordCode(event.target.value)} /><button type="button" className="console-secondary-button" disabled={controller.busyAction === 'send-password-code'} onClick={() => void controller.sendPasswordCode()}>发送验证码</button></div></label>
          <label className="console-field"><span>新密码</span><input type="password" value={controller.newPassword} onChange={(event) => controller.setNewPassword(event.target.value)} /></label>
          <label className="console-field"><span>确认密码</span><input type="password" value={controller.confirmPassword} onChange={(event) => controller.setConfirmPassword(event.target.value)} /></label>
        </div>
        {controller.passwordCodeExpiresAt ? <p className="console-field-note">验证码有效期至 {formatDateTime(controller.passwordCodeExpiresAt)}</p> : null}
        <div className="console-card-actions"><button type="button" className="console-primary-button" disabled={controller.busyAction === 'password'} onClick={() => void controller.updatePassword()}><KeyRound size={15} />更新密码</button></div>
      </section>
    </div>
  );
};

const BillingView: React.FC<{ controller: ReturnType<typeof useAccountCenterController> }> = ({ controller }) => {
  const [tab, setTab] = useState<'usage' | 'recharge'>('usage');
  const rows = tab === 'usage' ? controller.usageLogs : controller.billingLogs;
  return (
    <>
      <div className="console-grid console-profile-metrics">
        <article className="console-metric-card"><span>可用积分</span><strong>{formatRemainingCredits(controller.balance, 'zh-CN')}</strong><small>当前可支配额度</small></article>
        <article className="console-metric-card"><span>累计充值</span><strong>{controller.totalRecharged}</strong><small>已完成充值总额</small></article>
        <article className="console-metric-card"><span>累计消耗</span><strong>{controller.totalConsumed}</strong><small>生成与对话消耗</small></article>
      </div>
      <section className="console-card console-billing-table-card">
      <div className="console-card-heading">
        <div><h3>交易记录</h3><p>消费和充值记录按发生时间倒序展示。</p></div>
        <div className="console-segmented">
          <button type="button" data-selected={tab === 'usage'} onClick={() => setTab('usage')} data-user-profile-action={USER_PROFILE_ACTIONS.switchToUsageLogs.uiAction}>消费记录</button>
          <button type="button" data-selected={tab === 'recharge'} onClick={() => setTab('recharge')} data-user-profile-action={USER_PROFILE_ACTIONS.switchToRechargeLogs.uiAction}>充值记录</button>
        </div>
      </div>
      <div className="console-data-table" role="table">
        <div className="console-data-table__head" role="row"><span>时间</span><span>说明</span><span>状态</span><span>积分</span></div>
        {controller.loading ? <div className="console-table-empty"><Loader2 size={16} className="animate-spin" />正在加载记录</div> : rows.length === 0 ? <div className="console-table-empty">暂无{tab === 'usage' ? '消费' : '充值'}记录</div> : rows.map((row) => (
          <div className="console-data-table__row" role="row" key={row.id}>
            <span>{formatDateTime(row.completed_at || row.created_at)}</span>
            <span><strong>{row.model_name || row.description || (tab === 'usage' ? '积分消费' : '账户充值')}</strong><small>{row.provider_id || row.type}</small></span>
            <span><i className="console-status" data-tone={String(row.status).toLowerCase() === 'failed' ? 'danger' : String(row.status).toLowerCase() === 'pending' ? 'pending' : 'success'}>{statusLabel(row.status)}</i></span>
            <span className={tab === 'usage' ? 'console-amount-negative' : 'console-amount-positive'}>{tab === 'usage' ? '-' : '+'}{Math.abs(Number(row.amount) || 0)}</span>
          </div>
        ))}
      </div>
      </section>
    </>
  );
};

export const UserProfileView: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const controller = useAccountCenterController();
  const active = resolveProfileRoute(location.pathname);
  const content = useMemo(() => {
    if (active === 'security') return <SecurityView controller={controller} />;
    if (active === 'billing') return <BillingView controller={controller} />;
    return <AccountView controller={controller} />;
  }, [active, controller, navigate]);

  return (
    <SettingsViewShell className="console-profile-page">
      <ProfileHeader active={active} onNavigate={navigate} />
      {controller.message ? <div className="console-notice" data-tone={controller.message.tone}>{controller.message.tone === 'success' ? <Check size={15} /> : <ChevronRight size={15} />}<span>{controller.message.text}</span></div> : null}
      {content}
    </SettingsViewShell>
  );
};

export default UserProfileView;
