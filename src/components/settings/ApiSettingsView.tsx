/**
 * ApiSettingsView - Refactored with iOS Style Design System
 * API管理页面 - iOS风格重构版
 */
import React, { useEffect, useMemo, useState } from 'react';
import { 
  Edit3, 
  Pause, 
  Play, 
  Plus, 
  RefreshCw, 
  Save, 
  Trash2, 
  Wand2,
  Key,
  Globe,
  Shield,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import type { Provider } from '../../types';
import type { ApiProtocolFormat } from '../../services/api/apiConfig';
import keyManager, {
  autoDetectAndConfigureModels,
  type KeySlot,
  type ThirdPartyProvider,
} from '../../services/auth/keyManager';
import type { Supplier } from '../../services/billing/supplierService';
import { notify } from '../../services/system/notificationService';
import {
  SettingCard,
  SegmentedControl,
  SegmentedControlMulti,
  SettingInput,
  SettingToggle,
  SettingSelect,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  MetricCard,
  IconButton,
  ProgressBar,
  StatusBadge,
  EmptyState,
} from './ui/index';

type CostMode = 'unlimited' | 'amount' | 'tokens';
type OfficialProvider = 'Google' | 'OpenAI';
type TabType = 'official' | 'third-party';

type OfficialForm = { 
  id?: string; 
  name: string; 
  provider: OfficialProvider; 
  key: string; 
  mode: CostMode; 
  value: string 
};

type ProviderForm = {
  id?: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  format: ApiProtocolFormat;
  group: string;
  color: string;
  isActive: boolean;
  mode: CostMode;
  value: string;
};

const officialDefaults: OfficialForm = { 
  name: '', 
  provider: 'Google', 
  key: '', 
  mode: 'unlimited', 
  value: '' 
};

const providerDefaults: ProviderForm = {
  name: '',
  baseUrl: '',
  apiKey: '',
  format: 'auto',
  group: '',
  color: '#3B82F6',
  isActive: true,
  mode: 'unlimited',
  value: '',
};

const money = (value: number) =>
  `¥${new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;

const compact = (value: number) => 
  new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const tokens = (value: number) => `${compact(value)} Tokens`;

const positive = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isOfficialSlot = (slot: KeySlot) =>
  slot.type === 'official' || (!slot.baseUrl && (slot.provider === 'Google' || slot.provider === 'OpenAI'));

const getMode = (budget?: number, tokenLimit?: number, fallback: CostMode = 'unlimited'): CostMode => {
  if (typeof tokenLimit === 'number' && tokenLimit > -1) return 'tokens';
  if (typeof budget === 'number' && budget > -1) return 'amount';
  return fallback;
};

const toOfficialForm = (slot: KeySlot): OfficialForm => ({
  id: slot.id,
  name: slot.name,
  provider: slot.provider === 'OpenAI' ? 'OpenAI' : 'Google',
  key: slot.key,
  mode: getMode(slot.budgetLimit, slot.tokenLimit),
  value: slot.tokenLimit && slot.tokenLimit > -1 
    ? String(slot.tokenLimit) 
    : slot.budgetLimit && slot.budgetLimit > -1 
      ? String(slot.budgetLimit) 
      : '',
});

const toProviderForm = (provider: ThirdPartyProvider): ProviderForm => ({
  id: provider.id,
  name: provider.name,
  baseUrl: provider.baseUrl,
  apiKey: provider.apiKey,
  format: provider.format,
  group: provider.group || '',
  color: provider.providerColor || '#3B82F6',
  isActive: provider.isActive,
  mode: getMode(provider.budgetLimit, provider.tokenLimit, provider.customCostMode || 'unlimited'),
  value: provider.tokenLimit && provider.tokenLimit > -1
    ? String(provider.tokenLimit)
    : provider.budgetLimit && provider.budgetLimit > -1
      ? String(provider.budgetLimit)
      : provider.customCostValue && provider.customCostValue > 0
        ? String(provider.customCostValue)
        : '',
});

const activityLine = (provider: ThirdPartyProvider) => {
  const summary = provider.activitySummary;
  if (!summary?.lastLatencyMs) return '暂无近期调用指标';
  
  const items = [`耗时 ${(summary.lastLatencyMs / 1000).toFixed(summary.lastLatencyMs >= 10000 ? 0 : 1)}s`];
  
  if (typeof summary.lastTokens === 'number' && summary.lastTokens > 0) {
    items.push(`令牌 ${compact(summary.lastTokens)}`);
  }
  if (typeof summary.lastAmount === 'number' && summary.lastAmount >= 0) {
    items.push(money(summary.lastAmount));
  }
  if (items.length === 1) {
    items.push('令牌金额未获取');
  }
  
  return items.join(' / ');
};

const ApiSettingsView: React.FC<{ initialSupplier?: Supplier | null }> = ({ 
  initialSupplier = null 
}) => {
  const { supplierId } = useParams<{ supplierId: string }>();
  
  const [slots, setSlots] = useState<KeySlot[]>(() => keyManager.getSlots());
  const [providers, setProviders] = useState<ThirdPartyProvider[]>(() => keyManager.getProviders());
  const [activeTab, setActiveTab] = useState<TabType>('official');
  
  const [officialForm, setOfficialForm] = useState<OfficialForm>(officialDefaults);
  const [providerForm, setProviderForm] = useState<ProviderForm>(providerDefaults);
  
  const [editingOfficialId, setEditingOfficialId] = useState<string | null>(null);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  
  const officialSlots = useMemo(() => slots.filter(isOfficialSlot), [slots]);
  const thirdPartyProviders = useMemo(() => [...providers].sort((a, b) => b.updatedAt - a.updatedAt), [providers]);
  const activeProviders = thirdPartyProviders.filter((item) => item.isActive).length;
  const budgetCount = officialSlots.filter((s) => getMode(s.budgetLimit, s.tokenLimit) !== 'unlimited').length + 
    thirdPartyProviders.filter((p) => getMode(p.budgetLimit, p.tokenLimit, p.customCostMode || 'unlimited') !== 'unlimited').length;
  const attentionCount = officialSlots.filter((s) => s.disabled || s.status === 'invalid' || s.status === 'rate_limited').length + 
    thirdPartyProviders.filter((p) => !p.isActive || p.status === 'error').length;

  const refresh = () => {
    setSlots(keyManager.getSlots());
    setProviders(keyManager.getProviders());
  };

  useEffect(() => {
    refresh();
    return keyManager.subscribe(refresh);
  }, []);

  useEffect(() => {
    if (!supplierId && !initialSupplier) return;
    
    const key = supplierId || initialSupplier?.id || initialSupplier?.baseUrl;
    if (!key) return;
    
    const matched = thirdPartyProviders.find((provider) => {
      const idMatch = provider.id.toLowerCase() === (supplierId || initialSupplier?.id || '').toLowerCase();
      const urlMatch = provider.baseUrl.toLowerCase() === (initialSupplier?.baseUrl || supplierId || '').toLowerCase();
      return idMatch || urlMatch;
    });
    
    if (matched) {
      setActiveTab('third-party');
      setEditingProviderId(matched.id);
      setProviderForm(toProviderForm(matched));
    } else if (initialSupplier) {
      setProviderForm({
        ...providerDefaults,
        name: initialSupplier.name,
        baseUrl: initialSupplier.baseUrl,
        apiKey: initialSupplier.apiKey,
        format: initialSupplier.format,
        mode: getMode(initialSupplier.budgetLimit, undefined),
        value: initialSupplier.budgetLimit && initialSupplier.budgetLimit > -1 
          ? String(initialSupplier.budgetLimit) 
          : '',
      });
    }
  }, [initialSupplier, supplierId, thirdPartyProviders]);

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    try {
      await task();
      refresh();
    } finally {
      setBusy((current) => (current === key ? null : current));
    }
  };

  const saveOfficial = async () => {
    const value = officialForm.mode === 'unlimited' ? null : positive(officialForm.value);
    if (!officialForm.key.trim()) {
      notify.error('保存失败', '请填写有效的 API Key。');
      return;
    }
    if (officialForm.mode !== 'unlimited' && !value) {
      notify.error('保存失败', '预算值必须大于 0。');
      return;
    }
    
    const payload = { 
      budgetLimit: officialForm.mode === 'amount' ? value ?? -1 : -1, 
      tokenLimit: officialForm.mode === 'tokens' ? value ?? -1 : -1 
    };
    
    await run(`official-save:${officialForm.id || 'new'}`, async () => {
      if (officialForm.id) {
        await keyManager.updateKey(officialForm.id, { 
          name: officialForm.name || `${officialForm.provider} 官方接口`, 
          provider: officialForm.provider as Provider, 
          type: 'official', 
          format: officialForm.provider === 'Google' ? 'gemini' : 'openai', 
          baseUrl: '', 
          key: officialForm.key.trim(), 
          ...payload 
        });
      } else {
        const result = await keyManager.addKey(officialForm.key.trim(), { 
          name: officialForm.name || `${officialForm.provider} 官方接口`, 
          provider: officialForm.provider as Provider, 
          type: 'official', 
          format: officialForm.provider === 'Google' ? 'gemini' : 'openai', 
          baseUrl: '', 
          ...payload 
        });
        if (!result.success) {
          notify.error('创建失败', result.error || '无法创建官方接口。');
          return;
        }
      }
      notify.success('保存成功', '官方接口已更新。');
      setEditingOfficialId(null);
      setOfficialForm(officialDefaults);
    });
  };

  const saveProvider = async () => {
    const value = providerForm.mode === 'unlimited' ? null : positive(providerForm.value);
    if (!providerForm.name.trim() || !providerForm.baseUrl.trim() || !providerForm.apiKey.trim()) {
      notify.error('保存失败', '请完整填写名称、地址和 API Key。');
      return;
    }
    if (providerForm.mode !== 'unlimited' && !value) {
      notify.error('保存失败', '预算值必须大于 0。');
      return;
    }
    
    const payload = { 
      budgetLimit: providerForm.mode === 'amount' ? value ?? -1 : -1, 
      tokenLimit: providerForm.mode === 'tokens' ? value ?? -1 : -1, 
      customCostMode: providerForm.mode, 
      customCostValue: value ?? undefined 
    };
    
    await run(`provider-save:${providerForm.id || 'new'}`, async () => {
      if (providerForm.id) {
        keyManager.updateProvider(providerForm.id, { 
          name: providerForm.name.trim(), 
          baseUrl: providerForm.baseUrl.trim(), 
          apiKey: providerForm.apiKey.trim(), 
          format: providerForm.format, 
          group: providerForm.group.trim() || undefined, 
          providerColor: providerForm.color, 
          isActive: providerForm.isActive, 
          ...payload 
        });
      } else {
        keyManager.addProvider({ 
          name: providerForm.name.trim(), 
          baseUrl: providerForm.baseUrl.trim(), 
          apiKey: providerForm.apiKey.trim(), 
          models: [], 
          format: providerForm.format, 
          group: providerForm.group.trim() || undefined, 
          providerColor: providerForm.color, 
          isActive: providerForm.isActive, 
          ...payload 
        });
      }
      notify.success('保存成功', '第三方供应商已更新。');
      setEditingProviderId(null);
      setProviderForm(providerDefaults);
    });
  };

  const deleteOfficial = async (id: string) => {
    await run(`official-delete:${id}`, async () => {
      keyManager.removeKey(id);
      if (editingOfficialId === id) {
        setEditingOfficialId(null);
        setOfficialForm(officialDefaults);
      }
    });
  };

  const deleteProvider = async (id: string) => {
    await run(`provider-delete:${id}`, async () => {
      keyManager.removeProvider(id);
      if (editingProviderId === id) {
        setEditingProviderId(null);
        setProviderForm(providerDefaults);
      }
    });
  };

  const toggleOfficial = async (slot: KeySlot) => {
    await run(`official-toggle:${slot.id}`, async () => {
      keyManager.updateKey(slot.id, { disabled: !slot.disabled });
    });
  };

  const toggleProvider = async (provider: ThirdPartyProvider) => {
    await run(`provider-toggle:${provider.id}`, async () => {
      keyManager.updateProvider(provider.id, { isActive: !provider.isActive });
    });
  };

  const refreshOfficial = async (slot: KeySlot) => {
    await run(`official-check:${slot.id}`, async () => {
      const provider = slot.provider === 'OpenAI' ? 'OpenAI' : 'Google';
      const url = provider === 'Google' 
        ? 'https://generativelanguage.googleapis.com' 
        : 'https://api.openai.com';
      const check = await keyManager.testChannel(
        url, 
        slot.key, 
        provider, 
        slot.authMethod, 
        slot.headerName, 
        provider === 'Google' ? 'gemini' : 'openai'
      );
      const models = check.success 
        ? await autoDetectAndConfigureModels(slot.key, url, provider === 'Google' ? 'gemini' : 'openai') 
        : null;
      await keyManager.updateKey(slot.id, { 
        status: check.success ? 'valid' : 'invalid', 
        lastError: check.success ? null : check.message || '连接失败', 
        supportedModels: models?.success ? models.models : slot.supportedModels 
      });
    });
  };

  const refreshProvider = async (provider: ThirdPartyProvider) => {
    await run(`provider-check:${provider.id}`, async () => {
      const check = await keyManager.testChannel(
        provider.baseUrl, 
        provider.apiKey, 
        provider.name, 
        undefined, 
        undefined, 
        provider.format
      );
      const models = check.success 
        ? await autoDetectAndConfigureModels(provider.apiKey, provider.baseUrl, provider.format) 
        : null;
      keyManager.updateProvider(provider.id, { 
        status: check.success ? 'active' : 'error', 
        lastChecked: Date.now(), 
        lastError: check.success ? undefined : check.message || '连接失败', 
        models: models?.success ? models.models : provider.models 
      });
    });
  };

  const syncPricing = async (provider: ThirdPartyProvider) => {
    await run(`provider-price:${provider.id}`, async () => {
      const result = await keyManager.syncProviderPricingDetailed(provider.id);
      if (!result.ok) {
        notify.warning('价格未更新', result.message || '已尝试按当前供应商地址获取价格，但暂时没有返回可用价格数据。');
      }
    });
  };

  const startEditOfficial = (slot: KeySlot) => {
    setEditingOfficialId(slot.id);
    setOfficialForm(toOfficialForm(slot));
  };

  const startEditProvider = (provider: ThirdPartyProvider) => {
    setEditingProviderId(provider.id);
    setProviderForm(toProviderForm(provider));
  };

  const cancelEdit = () => {
    setEditingOfficialId(null);
    setEditingProviderId(null);
    setOfficialForm(officialDefaults);
    setProviderForm(providerDefaults);
  };

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard 
          value={`${officialSlots.length}`} 
          label="官方接口" 
          helper={`${officialSlots.filter(s => !s.disabled).length} 个可用`}
          tone="indigo" 
        />
        <MetricCard 
          value={`${activeProviders}/${thirdPartyProviders.length}`} 
          label="供应商" 
          helper={`${thirdPartyProviders.filter(p => p.status === 'error').length} 个异常`}
          tone={activeProviders > 0 ? 'emerald' : 'neutral'} 
        />
        <MetricCard 
          value={`${budgetCount}`} 
          label="预算配置" 
          helper="已配置限额"
          tone={budgetCount > 0 ? 'amber' : 'neutral'} 
        />
        <MetricCard 
          value={`${attentionCount}`} 
          label="待处理" 
          helper="需要关注"
          tone={attentionCount > 0 ? 'rose' : 'emerald'} 
        />
      </div>

      <SegmentedControl
        options={[
          { value: 'official', label: '官方接口' },
          { value: 'third-party', label: '第三方供应商' },
        ]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as TabType)}
      />

      {activeTab === 'official' && (
        <div className="space-y-3">
          <SettingCard 
            title="官方接口列表" 
            action={
              <PrimaryButton 
                onClick={() => { 
                  setEditingOfficialId(null); 
                  setOfficialForm(officialDefaults); 
                }}
              >
                <Plus size={16} className="mr-1" />
                新增
              </PrimaryButton>
            }
          >
            <div className="space-y-3">
              {officialSlots.length === 0 ? (
                <EmptyState 
                  title="暂无官方接口"
                  description="添加 Google Gemini 或 OpenAI 官方 Key"
                />
              ) : (
                officialSlots.map((slot) => {
                  const mode = getMode(slot.budgetLimit, slot.tokenLimit);
                  const progress = mode === 'amount' && slot.budgetLimit && slot.budgetLimit > 0 
                    ? Math.min(100, (slot.totalCost / slot.budgetLimit) * 100) 
                    : mode === 'tokens' && slot.tokenLimit && slot.tokenLimit > 0 
                      ? Math.min(100, ((slot.usedTokens || 0) / slot.tokenLimit) * 100) 
                      : 0;
                  const isPaused = slot.disabled;
                  
                  return (
                    <div 
                      key={slot.id}
                      className="rounded-xl border border-[var(--border-light)] p-3 transition-all hover:border-[var(--border-default)]"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 26%, transparent)' }}
                    >
                      <div className="mb-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span 
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: '#3B82F6' }}
                          />
                          <span className="text-[15px] font-medium text-[var(--text-primary)]">
                            {slot.name}
                          </span>
                        </div>
                        <StatusBadge 
                          status={isPaused ? 'paused' : slot.status === 'valid' ? 'online' : 'error'} 
                        />
                      </div>

                      <div className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                        <span className="rounded-full border border-[var(--border-light)] px-2 py-1">
                          {slot.provider === 'OpenAI' ? 'OpenAI 官方' : 'Gemini 官方'}
                        </span>
                        <span className="rounded-full border border-[var(--border-light)] px-2 py-1">
                          {mode === 'unlimited' ? '不限额' : mode === 'amount' ? '金额限额' : 'Tokens 限额'}
                        </span>
                      </div>
                       
                      <div className="mb-2.5">
                        <div className="mb-1 text-[13px] text-[var(--text-secondary)]">
                          {mode === 'amount' && slot.budgetLimit && slot.budgetLimit > 0 
                            ? `已用 ${money(slot.totalCost)} / 限额 ${money(slot.budgetLimit)}`
                            : mode === 'tokens' && slot.tokenLimit && slot.tokenLimit > 0 
                              ? `已用 ${tokens(slot.usedTokens || 0)} / 限额 ${tokens(slot.tokenLimit)}`
                              : `已累计 ${money(slot.totalCost)}`}
                        </div>
                        {mode !== 'unlimited' && <ProgressBar progress={progress} tone="indigo" showLabel={false} />}
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--border-light)] p-1.5" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 18%, transparent)' }}>
                        <IconButton 
                          icon={<Edit3 size={16} />} 
                          onClick={() => startEditOfficial(slot)}
                          title="编辑"
                        />
                        <IconButton 
                          icon={<RefreshCw size={16} className={busy === `official-check:${slot.id}` ? 'animate-spin' : ''} />} 
                          onClick={() => refreshOfficial(slot)}
                          title="刷新"
                        />
                        <IconButton 
                          icon={isPaused ? <Play size={16} /> : <Pause size={16} />}
                          onClick={() => toggleOfficial(slot)}
                          title={isPaused ? '启用' : '暂停'}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SettingCard>

          {(editingOfficialId !== null || officialForm.key) && (
            <SettingCard title={editingOfficialId ? '编辑官方接口' : '新增官方接口'}>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SettingInput
                    label="通道名称"
                    value={officialForm.name}
                    onChange={(value) => setOfficialForm(s => ({ ...s, name: value }))}
                    placeholder="例如：Google Gemini 主账号"
                  />
                  <SettingSelect
                    label="服务商"
                    value={officialForm.provider}
                    options={[
                      { value: 'Google', label: 'Google Gemini' },
                      { value: 'OpenAI', label: 'OpenAI' },
                    ]}
                    onChange={(value) => setOfficialForm(s => ({ ...s, provider: value as OfficialProvider }))}
                  />
                </div>
                
                <SettingInput
                  label="API Key"
                  value={officialForm.key}
                  onChange={(value) => setOfficialForm(s => ({ ...s, key: value }))}
                  placeholder="输入您的 API Key"
                  type="password"
                />
                
                <div>
                  <div className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">
                    预算限制
                  </div>
                  <SegmentedControlMulti
                    options={['不限额', '金额', 'Tokens']}
                    value={officialForm.mode === 'unlimited' ? '不限额' : officialForm.mode === 'amount' ? '金额' : 'Tokens'}
                    onChange={(value) => setOfficialForm(s => ({ 
                      ...s, 
                      mode: value === '不限额' ? 'unlimited' : value === '金额' ? 'amount' : 'tokens' 
                    }))}
                  />
                  {officialForm.mode !== 'unlimited' && (
                    <div className="mt-3">
                      <SettingInput
                        label="预算值"
                        value={officialForm.value}
                        onChange={(value) => setOfficialForm(s => ({ ...s, value }))}
                        type="number"
                        placeholder={officialForm.mode === 'amount' ? '例如：100' : '例如：1000000'}
                      />
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 pt-2">
                  <PrimaryButton 
                    onClick={saveOfficial}
                    loading={busy === `official-save:${officialForm.id || 'new'}`}
                  >
                    <Save size={16} className="mr-1" />
                    {editingOfficialId ? '保存修改' : '创建接口'}
                  </PrimaryButton>
                  <SecondaryButton onClick={cancelEdit}>
                    取消
                  </SecondaryButton>
                  {editingOfficialId && (
                    <DangerButton 
                      onClick={() => deleteOfficial(editingOfficialId)}
                      className="ml-auto"
                    >
                      <Trash2 size={16} className="mr-1" />
                      删除
                    </DangerButton>
                  )}
                </div>
              </div>
            </SettingCard>
          )}
        </div>
      )}

      {activeTab === 'third-party' && (
        <div className="space-y-3">
          <SettingCard 
            title="第三方供应商" 
            action={
              <PrimaryButton 
                onClick={() => { 
                  setEditingProviderId(null); 
                  setProviderForm(providerDefaults); 
                }}
              >
                <Plus size={16} className="mr-1" />
                新增
              </PrimaryButton>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {thirdPartyProviders.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState 
                    title="暂无第三方供应商"
                    description="添加第三方 API 供应商扩展服务能力"
                  />
                </div>
              ) : (
                thirdPartyProviders.map((provider) => {
                  const isPaused = !provider.isActive;
                  const providerBase = provider.baseUrl.replace(/^https?:\/\//, '').replace(/\/v\d+.*$/i, '');
                  
                  return (
                    <div 
                      key={provider.id}
                      className="rounded-xl border border-[var(--border-light)] p-3 transition-all hover:border-[var(--border-default)]"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 26%, transparent)' }}
                    >
                      <div className="mb-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold"
                            style={{ 
                              backgroundColor: `${provider.providerColor || '#3B82F6'}22`,
                              color: provider.providerColor || '#3B82F6'
                            }}
                          >
                            {provider.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate text-[15px] font-medium text-[var(--text-primary)]">
                            {provider.name}
                          </span>
                        </div>
                        <StatusBadge 
                          status={isPaused ? 'paused' : provider.status === 'active' ? 'online' : 'error'} 
                        />
                      </div>

                      <div className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                        {provider.group ? (
                          <span className="rounded-full border border-[var(--border-light)] px-2 py-1">
                            {provider.group}
                          </span>
                        ) : null}
                        <span className="max-w-full truncate rounded-full border border-[var(--border-light)] px-2 py-1">
                          {providerBase || '未设置地址'}
                        </span>
                      </div>
                       
                      <div className="mb-2.5 text-[13px] font-medium text-[var(--text-primary)]">
                        {activityLine(provider)}
                      </div>
                        
                      <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--border-light)] p-1.5" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 18%, transparent)' }}>
                        <IconButton 
                          icon={<Edit3 size={16} />} 
                          onClick={() => startEditProvider(provider)}
                          title="编辑"
                        />
                        <IconButton 
                          icon={<RefreshCw size={16} className={busy === `provider-check:${provider.id}` ? 'animate-spin' : ''} />} 
                          onClick={() => refreshProvider(provider)}
                          title="刷新"
                        />
                        <IconButton 
                          icon={<Wand2 size={16} className={busy === `provider-price:${provider.id}` ? 'animate-spin' : ''} />} 
                          onClick={() => syncPricing(provider)}
                          title="获取或校准价格"
                        />
                        <IconButton 
                          icon={isPaused ? <Play size={16} /> : <Pause size={16} />}
                          onClick={() => toggleProvider(provider)}
                          title={isPaused ? '启用' : '暂停'}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SettingCard>

          {(editingProviderId !== null || providerForm.name) && (
            <SettingCard title={editingProviderId ? '编辑供应商' : '新增供应商'}>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SettingInput
                    label="供应商名称"
                    value={providerForm.name}
                    onChange={(value) => setProviderForm(s => ({ ...s, name: value }))}
                    placeholder="例如：SiliconFlow"
                  />
                  <SettingInput
                    label="主题色"
                    value={providerForm.color}
                    onChange={(value) => setProviderForm(s => ({ ...s, color: value }))}
                    placeholder="#3B82F6"
                  />
                </div>
                
                  <SettingInput
                    label="基础地址 (URL)"
                    value={providerForm.baseUrl}
                    onChange={(value) => setProviderForm(s => ({ ...s, baseUrl: value }))}
                    placeholder="https://api.example.com/v1"
                    helper="价格获取会基于当前供应商地址自动识别或拼接对应路径。"
                  />
                
                <div className={`grid gap-3 ${editingProviderId ? 'sm:grid-cols-2' : ''}`}>
                  <SettingInput
                    label="API Key"
                    value={providerForm.apiKey}
                    onChange={(value) => setProviderForm(s => ({ ...s, apiKey: value }))}
                    placeholder="输入 API Key"
                    type="password"
                  />
                  {editingProviderId ? (
                    <SettingSelect
                      label="协议格式"
                      value={providerForm.format}
                      options={[
                        { value: 'auto', label: '自动检测' },
                        { value: 'openai', label: 'OpenAI' },
                        { value: 'gemini', label: 'Gemini' },
                        { value: 'claude', label: 'Claude' },
                      ]}
                      onChange={(value) => setProviderForm(s => ({ ...s, format: value as ApiProtocolFormat }))}
                      helper="创建时默认自动识别，保存后可在编辑态手动调整。"
                    />
                  ) : null}
                </div>
                
                <div className="grid gap-3 sm:grid-cols-2">
                  <SettingInput
                    label="分组 (可选)"
                    value={providerForm.group}
                    onChange={(value) => setProviderForm(s => ({ ...s, group: value }))}
                    placeholder="例如：国内渠道"
                    helper="用于组织和筛选供应商"
                  />
                  <SettingToggle
                    label="启用状态"
                    checked={providerForm.isActive}
                    onChange={(checked) => setProviderForm(s => ({ ...s, isActive: checked }))}
                  />
                </div>
                
                <div>
                  <div className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">
                    价格获取
                  </div>
                  <div className="rounded-xl border border-[var(--border-light)] p-3 text-[13px] leading-6 text-[var(--text-secondary)]">
                    所有供应商都支持尝试获取价格，只是抓取地址和解析路径可能不同。系统会基于你填写的基础地址自动推断；如果供应商有专门的价格页，也会优先按该路径尝试。
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">
                    预算限制
                  </div>
                  <SegmentedControlMulti
                    options={['不限额', '金额', 'Tokens']}
                    value={providerForm.mode === 'unlimited' ? '不限额' : providerForm.mode === 'amount' ? '金额' : 'Tokens'}
                    onChange={(value) => setProviderForm(s => ({ 
                      ...s, 
                      mode: value === '不限额' ? 'unlimited' : value === '金额' ? 'amount' : 'tokens' 
                    }))}
                  />
                  {providerForm.mode !== 'unlimited' && (
                    <div className="mt-3">
                      <SettingInput
                        label="预算值"
                        value={providerForm.value}
                        onChange={(value) => setProviderForm(s => ({ ...s, value }))}
                        type="number"
                        placeholder={providerForm.mode === 'amount' ? '例如：100' : '例如：1000000'}
                      />
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 pt-2">
                  <PrimaryButton 
                    onClick={saveProvider}
                    loading={busy === `provider-save:${providerForm.id || 'new'}`}
                  >
                    <Save size={16} className="mr-1" />
                    {editingProviderId ? '保存修改' : '创建供应商'}
                  </PrimaryButton>
                  <SecondaryButton onClick={cancelEdit}>
                    取消
                  </SecondaryButton>
                  {editingProviderId && (
                    <DangerButton 
                      onClick={() => deleteProvider(editingProviderId)}
                      className="ml-auto"
                    >
                      <Trash2 size={16} className="mr-1" />
                      删除
                    </DangerButton>
                  )}
                </div>
              </div>
            </SettingCard>
          )}
        </div>
      )}
    </div>
  );
};

export default ApiSettingsView;
