import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Coins,
  Key,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import { useLocale } from '../../../context/LocaleContext';
import { kkWebApiClient } from '../../../services/api/kkApiClient';
import { adminModelService } from '../../../services/model/adminModelService';
import { notify } from '../../../services/system/notificationService';
import {
  SettingsActionButton,
  SettingsBadge,
  SettingsDangerZone,
  SettingsHero,
  SettingsMetricCard,
  SettingsSection,
  SettingsViewShell,
  SETTINGS_INPUT_CLASSNAME,
  SETTINGS_LABEL_CLASSNAME,
} from '../SettingsScaffold';
import { EmptyState } from '../ui/index';
import type {
  AdminCreditProviderDto,
  AdminCreditProviderModelDto,
  SaveAdminCreditProviderRequestDto,
} from '../../../../packages/contracts/src/index.ts';

export const AdminCreditsView: React.FC = () => {
  const { pick } = useLocale();

  const [providers, setProviders] = useState<AdminCreditProviderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 选中的 Provider 的 ID。如果是新建的，为 'temp_new_provider'
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 正在编辑的状态
  const [editedId, setEditedId] = useState('');
  const [editedName, setEditedName] = useState('');
  const [editedBaseUrl, setEditedBaseUrl] = useState('');
  const [newApiKeysInput, setNewApiKeysInput] = useState('');
  const [retainedFingerprints, setRetainedFingerprints] = useState<string[]>([]);
  const [editedModels, setEditedModels] = useState<AdminCreditProviderModelDto[]>([]);

  // 控制高级设置折叠的状态 (针对每个模型的 index 展开)
  const [expandedModelIndex, setExpandedModelIndex] = useState<number | null>(null);

  // 加载数据
  const loadData = async (selectIdAfterLoad?: string | null) => {
    setLoading(true);
    try {
      const response = await kkWebApiClient.listAdminCreditProviders({});
      if (response.success) {
        const list = response.data.items || [];
        setProviders(list);

        if (list.length > 0) {
          const nextSelectId = selectIdAfterLoad || list[0].providerId;
          const found = list.find((p) => p.providerId === nextSelectId) || list[0];
          setSelectedId(found.providerId);
          applyProviderToState(found);
        } else {
          setSelectedId(null);
          clearEditState();
        }
      } else {
        notify.error(
          pick('加载失败', 'Load Failed'),
          response.error?.message || pick('获取供应商列表失败。', 'Failed to retrieve providers.')
        );
      }
    } catch (err: any) {
      notify.error(pick('错误', 'Error'), err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const clearEditState = () => {
    setEditedId('');
    setEditedName('');
    setEditedBaseUrl('');
    setNewApiKeysInput('');
    setRetainedFingerprints([]);
    setEditedModels([]);
    setExpandedModelIndex(null);
  };

  const applyProviderToState = (provider: AdminCreditProviderDto) => {
    setEditedId(provider.providerId);
    setEditedName(provider.providerName);
    setEditedBaseUrl(provider.baseUrl);
    setNewApiKeysInput('');
    setRetainedFingerprints(
      (provider.apiKeyEntries || []).map((entry) => entry.fingerprint)
    );
    setEditedModels(provider.models || []);
    setExpandedModelIndex(null);
  };

  const handleSelectProvider = (id: string) => {
    if (selectedId === 'temp_new_provider') {
      const confirmed = window.confirm(
        pick('当前正在创建新渠道，确定要放弃吗？', 'Discard changes to the new channel?')
      );
      if (!confirmed) return;
    }

    setSelectedId(id);
    const found = providers.find((p) => p.providerId === id);
    if (found) {
      applyProviderToState(found);
    }
  };

  const handleAddNewProvider = () => {
    if (selectedId === 'temp_new_provider') {
      return;
    }
    setSelectedId('temp_new_provider');
    clearEditState();
    setEditedId(pick('new-channel-id', 'new-channel-id'));
    setEditedName(pick('新建大模型/中转站渠道', 'New Channel'));
    setEditedBaseUrl('https://api.openai.com');
  };

  const handleRemoveFingerprint = (fingerprint: string) => {
    setRetainedFingerprints((prev) => prev.filter((f) => f !== fingerprint));
  };

  // 模型行的新增和删除
  const handleAddNewModelRow = () => {
    const newModel: AdminCreditProviderModelDto = {
      modelId: 'new-model-id',
      displayName: pick('新模型', 'New Model'),
      description: '',
      endpointType: 'openai',
      creditCost: 10,
      priority: 0,
      weight: 100,
      isActive: true,
      callCount: 0,
      advancedEnabled: false,
      mixWithSameModel: false,
      qualityPricing: {},
    };

    setEditedModels((prev) => [...prev, newModel]);
    setExpandedModelIndex(editedModels.length); // 展开新行
  };

  const handleRemoveModelRow = (index: number) => {
    setEditedModels((prev) => prev.filter((_, i) => i !== index));
    if (expandedModelIndex === index) {
      setExpandedModelIndex(null);
    }
  };

  const handleUpdateModelField = <K extends keyof AdminCreditProviderModelDto>(
    index: number,
    field: K,
    value: AdminCreditProviderModelDto[K]
  ) => {
    setEditedModels((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // 质量定价 (qualityPricing) 的动态编辑 (比如针对特定的图片尺寸 512, 1024)
  const handleUpdateQualityPrice = (
    modelIndex: number,
    sizeKey: string,
    enabled: boolean,
    cost: number
  ) => {
    setEditedModels((prev) =>
      prev.map((model, i) => {
        if (i !== modelIndex) return model;
        const currentPricing = model.qualityPricing || {};
        return {
          ...model,
          qualityPricing: {
            ...currentPricing,
            [sizeKey]: { enabled, creditCost: cost },
          },
        };
      })
    );
  };

  // 保存数据
  const handleSaveProvider = async () => {
    const targetId = selectedId === 'temp_new_provider' ? editedId.trim() : selectedId;
    if (!targetId) {
      notify.error(pick('输入不完整', 'Incomplete input'), pick('渠道唯一 ID 不能为空。', 'Channel ID cannot be empty.'));
      return;
    }
    if (!editedName.trim()) {
      notify.error(pick('输入不完整', 'Incomplete input'), pick('渠道名称不能为空。', 'Channel name cannot be empty.'));
      return;
    }
    if (!editedBaseUrl.trim()) {
      notify.error(pick('输入不完整', 'Incomplete input'), pick('接口 Base URL 不能为空。', 'Base URL cannot be empty.'));
      return;
    }

    if (selectedId === 'temp_new_provider' && providers.some((p) => p.providerId === targetId)) {
      notify.error(pick('渠道已存在', 'Channel Exists'), pick('渠道唯一 ID 已被使用，请换一个。', 'Channel ID already exists.'));
      return;
    }

    setSaving(true);
    try {
      // 解析输入的 API Keys
      const apiKeys = newApiKeysInput
        .split('\n')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      const request: SaveAdminCreditProviderRequestDto = {
        providerName: editedName.trim(),
        baseUrl: editedBaseUrl.trim(),
        apiKeys,
        retainApiKeyFingerprints: retainedFingerprints,
        models: editedModels.map((m) => ({
          modelId: m.modelId.trim(),
          displayName: m.displayName.trim(),
          description: m.description || '',
          endpointType: m.endpointType || 'openai',
          creditCost: Number(m.creditCost ?? 0),
          advancedEnabled: m.advancedEnabled || false,
          mixWithSameModel: m.mixWithSameModel || false,
          qualityPricing: m.qualityPricing || {},
          priority: Number(m.priority ?? 0),
          weight: Number(m.weight ?? 0),
          isActive: m.isActive !== false,
          color: m.color || '#ff4d8b',
          colorSecondary: m.colorSecondary || null,
          textColor: m.textColor || 'white',
        })),
      };

      const response = await kkWebApiClient.saveAdminCreditProvider(targetId, request);
      if (response.success) {
        notify.success(
          pick('保存成功', 'Saved Successfully'),
          pick('供应商积分及渠道信息已持久化。', 'Provider configurations saved.')
        );

        // 重载前端的模型定价缓存数据
        void adminModelService.forceLoadAdminModels();

        // 重新加载供应商列表
        await loadData(response.data.providerId);
      } else {
        notify.error(
          pick('保存失败', 'Save Failed'),
          response.error?.message || pick('保存供应商设置失败。', 'Failed to save provider settings.')
        );
      }
    } catch (err: any) {
      notify.error(pick('错误', 'Error'), err?.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  // 删除供应商
  const handleDeleteProvider = async () => {
    if (!selectedId || selectedId === 'temp_new_provider') {
      setSelectedId(null);
      clearEditState();
      return;
    }

    const confirmed = window.confirm(
      pick(
        '确认删除该供应商渠道吗？这将会停用此渠道下的所有关联模型。',
        'Delete this provider channel? This will deactivate all attached models.'
      )
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const response = await kkWebApiClient.deleteAdminCreditProvider(selectedId);
      if (response.success) {
        notify.success(
          pick('已删除', 'Deleted'),
          pick('该渠道已从系统成功移除。', 'Provider removed from the system.')
        );

        void adminModelService.forceLoadAdminModels();
        await loadData();
      } else {
        notify.error(
          pick('删除失败', 'Delete Failed'),
          response.error?.message || pick('移除供应商失败。', 'Failed to remove provider.')
        );
      }
    } catch (err: any) {
      notify.error(pick('错误', 'Error'), err?.message || String(err));
    } finally {
      setDeleting(false);
    }
  };

  // 简化的 HSL 生成器，用于左侧卡片的视觉辨识度
  const getProviderAvatarBg = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 55%, 45%)`;
  };

  // 统计指标
  const totalModels = providers.reduce((acc, p) => acc + (p.models?.length || 0), 0);
  const totalKeys = providers.reduce((acc, p) => acc + (p.apiKeyCount || 0), 0);

  return (
    <SettingsViewShell>
      <div className="settings-reference-stack">
        <SettingsHero
          eyebrow={pick('系统配置', 'System Config')}
          title={pick('积分配置', 'Credit Models')}
          description={pick(
            '管理对接的官方大模型或中转站渠道，并配置各模型的计费扣减积分值。',
            'Configure credit billing rates and keys for official APIs and middle stations.'
          )}
          icon={Coins}
          tone="emerald"
          metrics={
            <>
              <SettingsMetricCard
                label={pick('渠道总数', 'Total Channels')}
                value={`${providers.length}`}
                helper={pick('目前已配置的供应商及中转网关。', 'API channels registered.')}
                tone="indigo"
              />
              <SettingsMetricCard
                label={pick('适配模型', 'Active Models')}
                value={`${totalModels}`}
                helper={pick('在前端可选并支持计费的模型数量。', 'Available chargeable models.')}
                tone="emerald"
              />
              <SettingsMetricCard
                label={pick('持有 API Keys', 'Total API Keys')}
                value={`${totalKeys}`}
                helper={pick('多渠道高可用分发所绑定的令牌数。', 'Stored active credentials.')}
                tone="sky"
              />
            </>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* 左侧：供应商卡片列表 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                {pick('供应商列表', 'Channels')}
              </span>
              <SettingsActionButton icon={Plus} size="sm" tone="primary" onClick={handleAddNewProvider}>
                {pick('新建渠道', 'Add')}
              </SettingsActionButton>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[600px] pr-1">
              {loading ? (
                <div className="p-4 text-center text-xs animate-pulse" style={{ color: 'var(--text-tertiary)' }}>
                  {pick('加载列表中...', 'Loading channels...')}
                </div>
              ) : providers.length === 0 && selectedId !== 'temp_new_provider' ? (
                <div className="rounded-[18px] border p-4 text-center text-xs" style={{ borderColor: 'var(--settings-border-subtle)', color: 'var(--text-tertiary)' }}>
                  {pick('暂无配置渠道', 'No Channels')}
                </div>
              ) : (
                <>
                  {selectedId === 'temp_new_provider' && (
                    <button
                      type="button"
                      className="settings-sidebar-item active flex w-full items-center gap-3 border p-3 text-left rounded-[16px]"
                      style={{
                        borderColor: 'var(--settings-nav-active-border)',
                        background: 'var(--settings-nav-active-bg)',
                      }}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-white font-semibold"
                        style={{ background: 'var(--clay-brand-pink)' }}
                      >
                        *
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium" style={{ color: 'var(--settings-nav-text-primary)' }}>
                          {editedName || pick('未命名渠道', 'Unnamed')}
                        </span>
                        <span className="block truncate text-[11px] mt-0.5" style={{ color: 'var(--clay-brand-pink)' }}>
                          {pick('创建中...', 'Creating...')}
                        </span>
                      </div>
                    </button>
                  )}

                  {providers.map((p) => {
                    const isSelected = selectedId === p.providerId;
                    const avatarBg = getProviderAvatarBg(p.providerName);
                    // 简易解析 hostname
                    let hostLabel = '';
                    try {
                      hostLabel = new URL(p.baseUrl).hostname;
                    } catch {
                      hostLabel = p.baseUrl;
                    }

                    return (
                      <button
                        key={p.providerId}
                        type="button"
                        onClick={() => handleSelectProvider(p.providerId)}
                        className={`settings-sidebar-item flex w-full items-center gap-3 border p-3 text-left rounded-[16px] transition-all ${
                          isSelected ? 'active' : ''
                        }`}
                        style={
                          isSelected
                            ? {
                                borderColor: 'var(--settings-nav-active-border)',
                                background: 'var(--settings-nav-active-bg)',
                              }
                            : {
                                borderColor: 'transparent',
                                background: 'var(--settings-surface-overlay)',
                              }
                        }
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-white font-semibold text-xs"
                          style={{ background: avatarBg }}
                        >
                          {p.providerName.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span
                            className="block truncate text-sm font-medium"
                            style={{
                              color: isSelected
                                ? 'var(--settings-nav-text-primary)'
                                : 'var(--text-primary)',
                            }}
                          >
                            {p.providerName}
                          </span>
                          <span
                            className="block truncate text-[11px] mt-0.5"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            {hostLabel} · {p.models?.length || 0} {pick('个模型', 'models')}
                          </span>
                        </div>
                        {p.apiKeyCount > 0 ? (
                          <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="Key Active" />
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-amber-500 shrink-0" title="No Key Configured" />
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* 右侧：表单配置区域 */}
          <div className="min-w-0">
            {selectedId ? (
              <div className="space-y-6">
                {/* 1. 供应商基础信息 */}
                <SettingsSection title={pick('渠道基本设置', 'API Channel settings')}>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className={SETTINGS_LABEL_CLASSNAME}>{pick('渠道 ID (唯一代号)', 'Channel Unique ID')}</label>
                      <input
                        type="text"
                        className={SETTINGS_INPUT_CLASSNAME}
                        value={editedId}
                        disabled={selectedId !== 'temp_new_provider'}
                        onChange={(e) => setEditedId(e.target.value.trim())}
                        placeholder="例如：openai-station, gemini-official"
                      />
                    </div>
                    <div>
                      <label className={SETTINGS_LABEL_CLASSNAME}>{pick('渠道名称', 'Channel Name')}</label>
                      <input
                        type="text"
                        className={SETTINGS_INPUT_CLASSNAME}
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        placeholder="例如：One API 中转、Google 官方"
                      />
                    </div>
                    <div>
                      <label className={SETTINGS_LABEL_CLASSNAME}>{pick('接口 Base URL', 'API Base URL')}</label>
                      <input
                        type="text"
                        className={SETTINGS_INPUT_CLASSNAME}
                        value={editedBaseUrl}
                        onChange={(e) => setEditedBaseUrl(e.target.value)}
                        placeholder="https://api.openai.com"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className={SETTINGS_LABEL_CLASSNAME}>
                      {pick('API Keys 管理 (每行一个)', 'API Keys (One per line)')}
                    </label>
                    {retainedFingerprints.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2 rounded-[12px] border p-3 bg-black/5 dark:bg-white/5" style={{ borderColor: 'var(--settings-border-subtle)' }}>
                        {retainedFingerprints.map((finger) => (
                          <div
                            key={finger}
                            className="flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs"
                            style={{ borderColor: 'var(--settings-border-subtle)', background: 'var(--bg-overlay)' }}
                          >
                            <Key size={12} className="text-emerald-500" />
                            <span className="text-[11px] font-mono text-[var(--text-secondary)]">{finger.slice(0, 8)}...</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFingerprint(finger)}
                              className="text-rose-500 hover:text-rose-700 ml-1 font-semibold"
                              title={pick('删除此凭证', 'Delete API Key')}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <textarea
                      rows={3}
                      className={SETTINGS_INPUT_CLASSNAME}
                      value={newApiKeysInput}
                      onChange={(e) => setNewApiKeysInput(e.target.value)}
                      placeholder={pick(
                        '在此输入新增的 API Key 密钥，每行一个。已保存的 Key 无需重复输入。',
                        'Paste new API keys here, one per line. Saved keys are kept automatically.'
                      )}
                    />
                  </div>
                </SettingsSection>

                {/* 2. 模型扣费及属性映射列表 */}
                <SettingsSection
                  title={pick('模型计费与适配规则', 'Model Credits & Route Rules')}
                  action={
                    <SettingsActionButton icon={Plus} size="sm" onClick={handleAddNewModelRow}>
                      {pick('添加模型', 'Add Model')}
                    </SettingsActionButton>
                  }
                >
                  {editedModels.length === 0 ? (
                    <div className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {pick('尚未关联任何计费模型，请点击右侧「添加模型」。', 'No models configured. Click Add Model to start.')}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {editedModels.map((model, idx) => {
                        const isExpanded = expandedModelIndex === idx;

                        return (
                          <div
                            key={idx}
                            className="rounded-[16px] border p-4 transition-all"
                            style={{
                              borderColor: isExpanded ? 'var(--settings-nav-active-border)' : 'var(--settings-border-subtle)',
                              background: isExpanded ? 'var(--settings-nav-active-bg)' : 'var(--settings-surface-overlay)',
                            }}
                          >
                            {/* 折叠头部栏 */}
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-[var(--clay-brand-pink)] cursor-pointer"
                                  checked={model.isActive !== false}
                                  onChange={(e) => handleUpdateModelField(idx, 'isActive', e.target.checked)}
                                />
                                <div className="min-w-0 flex-1 grid gap-2 md:grid-cols-3">
                                  <div>
                                    <span className="text-[10px] block font-medium tracking-[0.03em] text-[var(--text-tertiary)] uppercase">
                                      {pick('模型 Code / ID', 'Model ID')}
                                    </span>
                                    <input
                                      type="text"
                                      className="w-full mt-0.5 bg-transparent border-b outline-none text-sm font-semibold text-[var(--text-primary)]"
                                      style={{ borderColor: 'var(--settings-border-subtle)' }}
                                      value={model.modelId}
                                      onChange={(e) => handleUpdateModelField(idx, 'modelId', e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <span className="text-[10px] block font-medium tracking-[0.03em] text-[var(--text-tertiary)] uppercase">
                                      {pick('显示名称', 'Display Name')}
                                    </span>
                                    <input
                                      type="text"
                                      className="w-full mt-0.5 bg-transparent border-b outline-none text-sm text-[var(--text-primary)]"
                                      style={{ borderColor: 'var(--settings-border-subtle)' }}
                                      value={model.displayName}
                                      onChange={(e) => handleUpdateModelField(idx, 'displayName', e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <span className="text-[10px] block font-medium tracking-[0.03em] text-[var(--text-tertiary)] uppercase text-rose-500">
                                      {pick('单次积分', 'Credit Cost')}
                                    </span>
                                    <input
                                      type="number"
                                      className="w-full mt-0.5 bg-transparent border-b outline-none text-sm font-mono text-rose-500 font-semibold"
                                      style={{ borderColor: 'var(--settings-border-subtle)' }}
                                      value={model.creditCost}
                                      onChange={(e) => handleUpdateModelField(idx, 'creditCost', Number(e.target.value))}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  className="text-xs px-2.5 py-1.5 rounded-lg border bg-black/5 dark:bg-white/5"
                                  style={{ borderColor: 'var(--settings-border-subtle)' }}
                                  onClick={() => setExpandedModelIndex(isExpanded ? null : idx)}
                                >
                                  {isExpanded ? pick('折叠', 'Collapse') : pick('配置参数', 'Rules')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveModelRow(idx)}
                                  className="text-rose-500 hover:text-rose-700 p-1.5"
                                  title={pick('删除模型', 'Delete Model')}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>

                            {/* 展开的更多配置 */}
                            {isExpanded && (
                              <div className="mt-4 pt-4 border-t space-y-4 text-left" style={{ borderColor: 'var(--settings-border-subtle)' }}>
                                <div className="grid gap-4 sm:grid-cols-3">
                                  <div>
                                    <label className={SETTINGS_LABEL_CLASSNAME}>{pick('协议格式', 'Protocol Format')}</label>
                                    <select
                                      className={SETTINGS_INPUT_CLASSNAME}
                                      value={model.endpointType}
                                      onChange={(e) => handleUpdateModelField(idx, 'endpointType', e.target.value)}
                                    >
                                      <option value="openai">OpenAI Chat</option>
                                      <option value="gemini">Gemini Native</option>
                                      <option value="claude">Claude Messages</option>
                                      <option value="12ai-flow">12AI Flow</option>
                                      <option value="wuyin-async-image">Wuyin Async Image</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className={SETTINGS_LABEL_CLASSNAME}>{pick('分发优先级', 'Priority')}</label>
                                    <input
                                      type="number"
                                      className={SETTINGS_INPUT_CLASSNAME}
                                      value={model.priority || 0}
                                      onChange={(e) => handleUpdateModelField(idx, 'priority', Number(e.target.value))}
                                    />
                                  </div>
                                  <div>
                                    <label className={SETTINGS_LABEL_CLASSNAME}>{pick('权重 (负载均衡)', 'Weight')}</label>
                                    <input
                                      type="number"
                                      className={SETTINGS_INPUT_CLASSNAME}
                                      value={model.weight || 0}
                                      onChange={(e) => handleUpdateModelField(idx, 'weight', Number(e.target.value))}
                                    />
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 bg-black/5 dark:bg-white/5 p-3 rounded-lg">
                                  <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={model.advancedEnabled}
                                      onChange={(e) => handleUpdateModelField(idx, 'advancedEnabled', e.target.checked)}
                                    />
                                    {pick('开启图片高级定价', 'Quality Pricing')}
                                  </label>
                                  <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={model.mixWithSameModel}
                                      onChange={(e) => handleUpdateModelField(idx, 'mixWithSameModel', e.target.checked)}
                                    />
                                    {pick('混合路由 (分流或降级)', 'Mix with same model')}
                                  </label>
                                </div>

                                {/* 高级图片定价输入字段 */}
                                {model.advancedEnabled && (
                                  <div className="p-3 rounded-lg border space-y-3" style={{ borderColor: 'var(--settings-border-subtle)' }}>
                                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                                      {pick('高级图片质量定价 (各分辨率积分扣减额度)', 'Detailed Quality Pricing Settings')}
                                    </span>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      {['512', '1024'].map((sizeKey) => {
                                        const config = model.qualityPricing?.[sizeKey] || {
                                          enabled: false,
                                          creditCost: model.creditCost,
                                        };
                                        return (
                                          <div
                                            key={sizeKey}
                                            className="flex items-center gap-3 border p-2 rounded-lg bg-[var(--bg-overlay)]"
                                            style={{ borderColor: 'var(--settings-border-subtle)' }}
                                          >
                                            <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                                              <input
                                                type="checkbox"
                                                checked={config.enabled}
                                                onChange={(e) =>
                                                  handleUpdateQualityPrice(
                                                    idx,
                                                    sizeKey,
                                                    e.target.checked,
                                                    config.creditCost
                                                  )
                                                }
                                              />
                                              <span>{sizeKey}px</span>
                                            </label>
                                            <input
                                              type="number"
                                              className="w-20 ml-auto bg-transparent border-b outline-none text-xs text-rose-500 font-mono text-right"
                                              style={{ borderColor: 'var(--settings-border-subtle)' }}
                                              disabled={!config.enabled}
                                              value={config.creditCost}
                                              onChange={(e) =>
                                                handleUpdateQualityPrice(
                                                  idx,
                                                  sizeKey,
                                                  config.enabled,
                                                  Number(e.target.value)
                                                )
                                              }
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SettingsSection>

                {/* 3. 保存与危险区域 (删除) */}
                <div className="flex items-center justify-end gap-3">
                  <SettingsActionButton
                    icon={Save}
                    tone="primary"
                    loading={saving}
                    disabled={saving}
                    onClick={handleSaveProvider}
                  >
                    {pick('保存渠道设置', 'Save Configuration')}
                  </SettingsActionButton>
                </div>

                {selectedId !== 'temp_new_provider' && (
                  <SettingsDangerZone
                    title={pick('删除该供应商渠道', 'Delete API Channel')}
                    description={pick(
                      '将会从系统数据库物理移除该渠道所有配置信息。此操作不可逆。',
                      'This will delete the API channel and its models configurations from the storage database permanently.'
                    )}
                    action={
                      <SettingsActionButton
                        icon={Trash2}
                        tone="danger"
                        loading={deleting}
                        disabled={deleting}
                        onClick={handleDeleteProvider}
                      >
                        {pick('删除渠道', 'Delete Channel')}
                      </SettingsActionButton>
                    }
                  />
                )}
              </div>
            ) : (
              <EmptyState
                title={pick('选择或创建供应商渠道', 'Select or Create a Channel')}
                description={pick(
                  '请在左侧点击供应商或者点击「新建渠道」按钮，开始编辑该网关配置。',
                  'Select a channel on the sidebar or click New Channel to start setting up model metrics.'
                )}
              />
            )}
          </div>
        </div>
      </div>
    </SettingsViewShell>
  );
};

export default AdminCreditsView;
