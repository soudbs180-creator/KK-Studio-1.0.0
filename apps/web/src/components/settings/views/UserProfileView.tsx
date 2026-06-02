import React, { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Check,
  Crown,
  Sparkles,
  Award,
  User,
  Shield,
  Loader2,
  Mail,
  Smartphone,
  Info,
  Coins,
  History,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useBilling } from '../../../context/BillingContext';
import { useAdminRole } from '../../../hooks/useAdminRole';
import { formatRemainingCredits } from '../../../services/billing/remainingBalance';
import {
  SettingsBadge,
  SettingsCardGridContainer,
  SettingsHero,
  SettingsViewShell,
} from '../SettingsScaffold';
import { EmptyState, StatusBadge } from '../ui/index';
import { collectLinkedAuthProviders, listLinkedAuthProviders } from '../../../services/auth/identityLinking';
import { notify } from '../../../services/system/notificationService';

// 简体中文注释：格式化时间戳/时间串为标准中国时间格式
const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getRechargeSubmissionStatusLabel = (status?: string | null) => {
  if (!status) return '已完成';
  const lower = status.toLowerCase();
  if (lower === 'completed') return '已完成';
  if (lower === 'pending') return '处理中';
  if (lower === 'failed') return '失败';
  if (lower === 'refunded') return '已退款';
  return status;
};

const getStatusClass = (status?: string | null) => {
  const lower = (status || '').toLowerCase();
  if (lower === 'failed') return 'text-red-400 border-red-500/30 bg-red-500/10';
  if (lower === 'pending') return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
  if (lower === 'refunded') return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
  return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
};

export const UserProfileView: React.FC = () => {
  const { user, isTempUser, adminLevel } = useAuth();
  const { accountRole } = useAdminRole();
  const {
    balance,
    billingLogs,
    usageLogs,
    loading: billingLoading,
    refreshBilling,
  } = useBilling();

  const [copied, setCopied] = useState(false);
  const [subTab, setSubTab] = useState<'usage' | 'recharge'>('usage');
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);

  // 简体中文注释：获取绑定的身份登录提供者，支持本地与会话同步
  const sessionLinkedProviders = useMemo(() => collectLinkedAuthProviders(user), [user]);
  const effectiveLinkedProviders = useMemo(
    () => (linkedProviders.length > 0 ? linkedProviders : sessionLinkedProviders),
    [linkedProviders, sessionLinkedProviders]
  );

  const isShadowWechatEmail = Boolean(user?.email?.endsWith('@users.kkstudio.local'));
  const isWechatBound =
    isShadowWechatEmail ||
    user?.user_metadata?.auth_provider === 'wechat' ||
    effectiveLinkedProviders.includes('wechat');
  const isGoogleBound = effectiveLinkedProviders.includes('google');

  const displayEmail = isShadowWechatEmail ? '微信授权用户' : user?.email || '未绑定邮箱';

  useEffect(() => {
    void refreshBilling({ includeTransactions: true });
  }, [refreshBilling]);

  useEffect(() => {
    if (!user?.id || isTempUser) return;
    let active = true;
    const loadLinkedProviders = async () => {
      try {
        const providers = await listLinkedAuthProviders();
        if (active) {
          setLinkedProviders(providers);
        }
      } catch (error) {
        console.warn('[UserProfileView] Failed to load linked identities:', error);
      }
    };
    void loadLinkedProviders();
    return () => {
      active = false;
    };
  }, [isTempUser, user?.id]);

  const handleCopyId = (id: string) => {
    if (!id) return;
    void navigator.clipboard.writeText(id);
    setCopied(true);
    notify.success('复制成功', '用户 ID 已复制到剪贴板');
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. 计算总充值积分：对 billingLogs 且状态为 completed 的 amount 求和
  const totalRecharged = useMemo(() => {
    return billingLogs
      .filter((log) => !log.status || log.status.toLowerCase() === 'completed')
      .reduce((sum, log) => sum + (Number(log.amount) || 0), 0);
  }, [billingLogs]);

  // 2. 计算总消耗积分：对 usageLogs 且状态为 completed (或无状态) 的 amount 求绝对值求和
  const totalConsumed = useMemo(() => {
    return usageLogs
      .filter((log) => !log.status || log.status.toLowerCase() === 'completed')
      .reduce((sum, log) => sum + Math.abs(Number(log.amount) || 0), 0);
  }, [usageLogs]);

  // 3. 计算用户身份等级和徽标
  const resolvedIdentity = useMemo(() => {
    if (adminLevel === 1 || (accountRole === 'admin' && (user?.email === '977483863@qq.com' || user?.user_metadata?.email === '977483863@qq.com'))) {
      return {
        label: '高级管理员',
        colorClass: 'text-red-400',
        bgStyle: 'bg-red-500/10 border border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.2)]',
        icon: <Shield size={12} className="text-red-400 shrink-0" />
      };
    }
    if (adminLevel === 2) {
      return {
        label: '普通管理员',
        colorClass: 'text-emerald-400',
        bgStyle: 'bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]',
        icon: <Award size={12} className="text-emerald-400 shrink-0" />
      };
    }
    if (isTempUser) {
      return {
        label: '临时用户',
        colorClass: 'text-amber-400',
        bgStyle: 'bg-amber-500/10 border border-amber-500/20',
        icon: <User size={12} className="text-amber-400 shrink-0" />
      };
    }
    if (balance >= 5000) {
      return {
        label: '会员用户',
        colorClass: 'text-yellow-400',
        bgStyle: 'bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-orange-500/20 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
        icon: <Crown size={12} className="text-amber-400 shrink-0" />
      };
    }
    if (balance >= 1000) {
      return {
        label: '高级用户',
        colorClass: 'text-blue-400',
        bgStyle: 'bg-blue-500/10 border border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.2)]',
        icon: <Sparkles size={12} className="text-blue-400 shrink-0" />
      };
    }
    return {
      label: '普通用户',
      colorClass: 'text-gray-300',
      bgStyle: 'bg-white/5 border border-white/10',
      icon: <User size={12} className="text-gray-300 shrink-0" />
    };
  }, [adminLevel, accountRole, user, balance, isTempUser]);

  const nickname =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.display_name ||
    (isShadowWechatEmail ? '微信用户' : user?.email?.split('@')[0]) ||
    '未命名用户';

  return (
    <SettingsViewShell>
      {/* 顶部标题与个人说明 */}
      <SettingsHero
        title="个人中心"
        description="在这里查看和核对您的个人账户基本信息、第三方绑定、积分资产以及账单历史明细。"
      />

      <SettingsCardGridContainer>
        {/* 卡片 1: 积分余额 (1A) */}
        <div className="dashboard-grid-card">
          <div className="flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[9px] font-bold uppercase tracking-wider">可用积分余额</span>
              <Coins size={13} />
            </div>
            <div
              className="text-xl font-bold mt-1.5"
              style={{
                background: 'linear-gradient(135deg, #FFE3A8 0%, #FFB084 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {formatRemainingCredits(balance, 'zh-CN')}
            </div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">
              当前账户中可自由支配的额度。
            </div>
          </div>
        </div>

        {/* 卡片 2: 累计充值积分 (1A) */}
        <div className="dashboard-grid-card">
          <div className="flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[9px] font-bold uppercase tracking-wider">累计充值积分</span>
              <TrendingUp size={13} />
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1.5">
              +{totalRecharged}
            </div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">
              历史所有完成的充值额度总和。
            </div>
          </div>
        </div>

        {/* 卡片 3: 累计消耗积分 (1A) */}
        <div className="dashboard-grid-card">
          <div className="flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[9px] font-bold uppercase tracking-wider">累计消耗积分</span>
              <History size={13} />
            </div>
            <div className="text-xl font-bold text-red-400 mt-1.5">
              -{totalConsumed}
            </div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">
              历史使用系统生成或对话消耗总计。
            </div>
          </div>
        </div>

        {/* 卡片 4: 登录方式与安全角色 (1A) */}
        <div className="dashboard-grid-card">
          <div className="flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[9px] font-bold uppercase tracking-wider">安全角色</span>
              <Shield size={13} />
            </div>
            <div className="mt-1.5">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${resolvedIdentity.colorClass} ${resolvedIdentity.bgStyle}`}>
                {resolvedIdentity.icon}
                <span>{resolvedIdentity.label}</span>
              </span>
            </div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">
              您的安全组角色及后台授权级别。
            </div>
          </div>
        </div>

        {/* 卡片 5: 用户基础账户资料 (2A*2A) */}
        <div className="dashboard-grid-card a-card-span-2-col a-card-span-2-row p-4 flex flex-col justify-between" style={{ cursor: 'default' }}>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">账户信息</div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">基本资料</h3>

            <div className="mt-3.5 space-y-3.5">
              {/* 头像与昵称 */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center text-sm font-bold">
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="头像" className="h-full w-full object-cover" />
                  ) : (
                    nickname.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {nickname}
                  </div>
                  <div className="truncate text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <Mail size={12} />
                    <span>{displayEmail}</span>
                  </div>
                </div>
              </div>

              {/* 用户 ID 面板 */}
              <div className="border border-white/5 bg-white/5 rounded-xl p-3 space-y-1">
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">用户 ID</div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="font-mono text-xs text-slate-200 select-all truncate" title={user?.id || ''}>
                    {user?.id || '-'}
                  </span>
                  {user?.id && (
                    <button
                      onClick={() => handleCopyId(user.id)}
                      className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
                      title="复制用户 ID"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="pt-2.5 border-t border-white/5 text-[9px] text-slate-400 flex items-center gap-1">
            <Info size={11} className="text-slate-500" />
            <span>ID 广泛用于在 API 调用、技术排障及官方客服对账时唯一标识账户。</span>
          </div>
        </div>

        {/* 卡片 6: 第三方登录绑定状态 (2A*2A) */}
        <div className="dashboard-grid-card a-card-span-2-col a-card-span-2-row p-4 flex flex-col justify-between" style={{ cursor: 'default' }}>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">身份认证</div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">绑定的登录方式</h3>

            <div className="mt-4 space-y-3">
              {/* 微信绑定 */}
              <div className={`flex items-center justify-between border rounded-xl p-3 transition-colors ${
                isWechatBound ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/5 bg-white/5'
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <Smartphone size={16} className={isWechatBound ? 'text-emerald-400' : 'text-slate-400'} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-200">微信绑定</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {isWechatBound ? '已完成绑定，可扫码一键登录' : '未绑定'}
                    </div>
                  </div>
                </div>
                <div>
                  <StatusBadge status={isWechatBound ? 'online' : 'offline'} label={isWechatBound ? '已绑定' : '未绑定'} />
                </div>
              </div>

              {/* Google 绑定 */}
              <div className={`flex items-center justify-between border rounded-xl p-3 transition-colors ${
                isGoogleBound ? 'border-blue-500/20 bg-blue-500/5' : 'border-white/5 bg-white/5'
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <User size={16} className={isGoogleBound ? 'text-blue-400' : 'text-slate-400'} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-200">Google 绑定</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {isGoogleBound ? '已完成绑定，可 Google 一键快捷登录' : '未绑定'}
                    </div>
                  </div>
                </div>
                <div>
                  <StatusBadge status={isGoogleBound ? 'online' : 'offline'} label={isGoogleBound ? '已绑定' : '未绑定'} />
                </div>
              </div>
            </div>
          </div>
          <div className="pt-2.5 border-t border-white/5 text-[9px] text-slate-400 flex items-center gap-1">
            <Info size={11} className="text-slate-500" />
            <span>可在个人账号面板或登录页完成多社交账号绑定。</span>
          </div>
        </div>

        {/* 账单明细/充值记录大卡片 (4A*4A) */}
        <div className="dashboard-grid-card a-card-span-4-col a-card-span-4-row p-4 flex flex-col justify-between" style={{ cursor: 'default' }}>
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex border-b border-white/5 mb-3.5">
              <button
                onClick={() => setSubTab('usage')}
                className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  subTab === 'usage'
                    ? 'border-blue-500 text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                消费历史明细
              </button>
              <button
                onClick={() => setSubTab('recharge')}
                className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  subTab === 'recharge'
                    ? 'border-blue-500 text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                充值交易记录
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[350px] text-xs">
              {billingLoading ? (
                <div className="h-full flex items-center justify-center py-10 text-slate-400 gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  <span>正在加载明细...</span>
                </div>
              ) : subTab === 'usage' ? (
                usageLogs.length === 0 ? (
                  <div className="py-12 flex items-center justify-center">
                    <EmptyState
                      title="暂无消费明细"
                      description="您当前账户还没有任何扣费的积分消耗记录。"
                    />
                  </div>
                ) : (
                  usageLogs.slice(0, 50).map((record) => {
                    const title = record.model_name || record.model_id || record.description || '模型调用扣费';
                    const amountText = record.amount >= 0 ? `+${record.amount}` : `${record.amount}`;

                    return (
                      <div
                        key={record.id}
                        className="p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-between gap-3 hover:bg-white/[0.08] transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-slate-900 dark:text-white font-semibold">
                            {title}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
                            <span>时间：{formatDateTime(record.created_at)}</span>
                            {record.description && <span className="truncate max-w-[200px]" title={record.description}>· {record.description}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none ${
                            getStatusClass(record.status)
                          }`}>
                            {getRechargeSubmissionStatusLabel(record.status || 'completed')}
                          </span>
                          <div className={`mt-1 font-bold text-sm ${
                            record.amount >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {amountText}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                billingLogs.length === 0 ? (
                  <div className="py-12 flex items-center justify-center">
                    <EmptyState
                      title="暂无充值记录"
                      description="您当前账户还没有充值积分的入账记录。"
                    />
                  </div>
                ) : (
                  billingLogs.slice(0, 50).map((record) => (
                    <div
                      key={record.id}
                      className="p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-between gap-3 hover:bg-white/[0.08] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-slate-900 dark:text-white font-semibold">
                          充值积分 {record.amount} 点
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
                          <span>时间：{formatDateTime(record.created_at)}</span>
                          {record.description && <span className="truncate max-w-[200px]" title={record.description}>· {record.description}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none ${
                          getStatusClass(record.status)
                        }`}>
                          {getRechargeSubmissionStatusLabel(record.status || 'completed')}
                        </span>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      </SettingsCardGridContainer>
    </SettingsViewShell>
  );
};

export default UserProfileView;
