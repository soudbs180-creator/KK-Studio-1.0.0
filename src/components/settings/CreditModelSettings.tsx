import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Info, Plus, ShieldAlert, SlidersHorizontal, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { notify } from '../../services/system/notificationService';
import { getCachedPricing, type ModelPricingInfo } from '../../services/billing/newApiPricingService';
import {
  ADMIN_MODEL_QUALITY_KEYS,
  type AdminModelQualityKey,
  type AdminModelQualityPricing,
  createDefaultAdminQualityPricing,
  normalizeAdminQualityPricing,
} from '../../services/model/adminModelQuality';
import {
  DEFAULT_CREDITS_PER_USD,
  buildAdminModelCreditSuggestion,
} from '../../services/model/adminModelAdvisor';
import { adminModelService } from '../../services/model/adminModelService';
import { getModelCapabilities } from '../../services/model/modelCapabilities';
import { unifiedModelService } from '../../services/model/unifiedModelService';
import { ImageSize } from '../../types';
import {
  DangerButton,
  EmptyState,
  MetricCard,
  PrimaryButton,
  SecondaryButton,
  SettingCard,
} from './ui/index';

type CreditModelRow = {
  provider_id: string;
  provider_name: string;
  base_url: string;
  api_keys: string[] | null;
  model_id: string;
  display_name: string;
  description: string | null;
  endpoint_type: 'openai' | 'gemini' | string;
  credit_cost: number;
  is_active: boolean;
  call_count: number | null;
  max_calls_limit: number | null;
  color: string | null;
  color_secondary: string | null;
  text_color: 'white' | 'black' | null;
  advanced_enabled?: boolean | null;
  mix_with_same_model?: boolean | null;
  quality_pricing?: Record<string, any> | null;
};

type CreditModelRpcModel = {
  model_id?: string | null;
  display_name?: string | null;
  description?: string | null;
  endpoint_type?: string | null;
  credit_cost?: number | null;
  is_active?: boolean | null;
  call_count?: number | null;
  max_calls_limit?: number | null;
  color?: string | null;
  color_secondary?: string | null;
  text_color?: 'white' | 'black' | string | null;
  advanced_enabled?: boolean | null;
  mix_with_same_model?: boolean | null;
  quality_pricing?: Record<string, any> | null;
};

type CreditModelRpcProvider = {
  provider_id?: string | null;
  provider_name?: string | null;
  base_url?: string | null;
  api_keys?: string[] | null;
  models?: CreditModelRpcModel[] | null;
};

type EditableModel = {
  modelId: string;
  displayName: string;
  endpointType: 'auto' | 'openai' | 'gemini';
  creditCost: number;
  description: string;
  isActive: boolean;
  maxCallsLimit: number | null;
  color: string;
  colorSecondary: string;
  textColor: 'white' | 'black';
  advancedEnabled: boolean;
  mixWithSameModel: boolean;
  qualityPricing: AdminModelQualityPricing;
};

type EditableProvider = {
  providerId: string;
  providerName: string;
  baseUrl: string;
  apiKey: string;
  models: EditableModel[];
};

const inferEndpointType = (modelId: string): 'openai' | 'gemini' => {
  const id = modelId.toLowerCase();
  if (id.includes('gemini') || id.includes('imagen') || id.includes('veo')) {
    return 'gemini';
  }
  return 'openai';
};

const normalizeBaseModelId = (value: string): string => {
  return (value || '').split('@')[0].trim();
};

const normalizeHexColor = (value?: string | null, fallback = '#3B82F6'): string => {
  let color = (value || fallback || '#3B82F6').trim();
  if (!color) return fallback || '#3B82F6';
  
  // Remove # prefix for processing
  let hexPart = color.startsWith('#') ? color.slice(1) : color;
  
  // Check if it's valid hex characters
  if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
    return fallback || '#3B82F6';
  }
  
  // Expand 3-char hex to 6-char (e.g., ABC -> AABBCC)
  if (hexPart.length === 3) {
    hexPart = hexPart[0] + hexPart[0] + hexPart[1] + hexPart[1] + hexPart[2] + hexPart[2];
  }
  
  // Handle edge cases: pad to 6 chars or truncate to 6/8 chars
  if (hexPart.length < 6) {
    hexPart = hexPart.padEnd(6, '0');
  } else if (hexPart.length === 7) {
    hexPart = hexPart.slice(0, 6);
  } else if (hexPart.length > 8) {
    hexPart = hexPart.slice(0, 8);
  }
  
  // If not 6 or 8 chars, force to 6
  if (hexPart.length !== 6 && hexPart.length !== 8) {
    hexPart = '3B82F6';
  }
  
  return `#${hexPart.toUpperCase()}`;
};

const newModel = (): EditableModel => ({
  modelId: '',
  displayName: '',
  endpointType: 'auto',
  creditCost: 1,
  description: '',
  isActive: true,
  maxCallsLimit: null,
  color: '#3B82F6',
  colorSecondary: '',
  textColor: 'white',
  advancedEnabled: false,
  mixWithSameModel: false,
  qualityPricing: createDefaultAdminQualityPricing(1),
});

const emptyProvider = (): EditableProvider => ({
  providerId: '',
  providerName: '',
  baseUrl: '',
  apiKey: '',
  models: [newModel()],
});

const SIZE_TO_QUALITY: Record<string, AdminModelQualityKey> = {
  [ImageSize.SIZE_05K]: '0.5K',
  [ImageSize.SIZE_1K]: '1K',
  [ImageSize.SIZE_2K]: '2K',
  [ImageSize.SIZE_4K]: '4K',
};

const QUALITY_META: Record<AdminModelQualityKey, { resolution: string; hint: string }> = {
  '0.5K': { resolution: '512px', hint: '快速预览与轻量草稿' },
  '1K': { resolution: '1024px', hint: '常规出图，速度与质量均衡' },
  '2K': { resolution: '2048px', hint: '适合细节强化与展示图' },
  '4K': { resolution: '4096px', hint: '高分辨率交付与精修图' },
};

type PricingCacheStatus = 'idle' | 'loading' | 'ready' | 'empty';

const formatUsdEstimate = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return '--';
  return value >= 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`;
};

const normalizeAdminCreditModelRows = (providers: CreditModelRpcProvider[]): CreditModelRow[] =>
  providers.flatMap((provider) =>
    (provider.models || []).map((model) => ({
      provider_id: String(provider.provider_id || '').trim(),
      provider_name: String(provider.provider_name || provider.provider_id || '').trim(),
      base_url: String(provider.base_url || '').trim(),
      api_keys: Array.isArray(provider.api_keys) ? provider.api_keys.filter((key): key is string => typeof key === 'string') : [],
      model_id: String(model.model_id || '').trim(),
      display_name: String(model.display_name || model.model_id || '').trim(),
      description: model.description || '',
      endpoint_type: String(model.endpoint_type || 'openai').trim(),
      credit_cost: Math.max(1, Number(model.credit_cost || 1)),
      is_active: model.is_active !== false,
      call_count: model.call_count ?? null,
      max_calls_limit: model.max_calls_limit ?? null,
      color: normalizeHexColor(model.color, '#3B82F6') || '#3B82F6',
      color_secondary: normalizeHexColor(model.color_secondary) || null,
      text_color: model.text_color === 'black' ? 'black' : 'white',
      advanced_enabled: Boolean(model.advanced_enabled),
      mix_with_same_model: Boolean(model.mix_with_same_model),
      quality_pricing: model.quality_pricing ?? null,
    }))
  );

const getConfiguredKeyCount = (apiKeys?: string[] | null): number =>
  Array.isArray(apiKeys)
    ? apiKeys.filter((key): key is string => typeof key === 'string' && key.trim().length > 0).length
    : 0;

const areQualityPricingEqual = (
  left: AdminModelQualityPricing,
  right: AdminModelQualityPricing,
  qualities: AdminModelQualityKey[]
): boolean =>
  qualities.every((quality) => {
    const leftRule = left[quality];
    const rightRule = right[quality];

    return (
      Boolean(leftRule?.enabled !== false) === Boolean(rightRule?.enabled !== false) &&
      Number(leftRule?.creditCost || 0) === Number(rightRule?.creditCost || 0)
    );
  });

const getSupportedQualities = (modelId: string): AdminModelQualityKey[] => {
  const caps = getModelCapabilities(modelId);
  const supportedSizes = caps?.supportedSizes || [ImageSize.SIZE_1K, ImageSize.SIZE_2K, ImageSize.SIZE_4K];
  const supportedQualities = supportedSizes
    .map((size) => SIZE_TO_QUALITY[size])
    .filter((quality): quality is AdminModelQualityKey => !!quality);

  return supportedQualities.length > 0 ? supportedQualities : ADMIN_MODEL_QUALITY_KEYS;
};

type AdvancedToggleProps = {
  checked: boolean;
  label: string;
  onToggle: () => void;
  tone?: 'indigo' | 'emerald';
  size?: 'default' | 'compact';
};

const AdvancedToggle: React.FC<AdvancedToggleProps> = ({
  checked,
  label,
  onToggle,
  tone = 'indigo',
  size = 'default',
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onToggle}
    data-tone={tone}
    className={`credit-advanced-switch ${checked ? 'is-on' : ''} ${
      size === 'compact' ? 'credit-advanced-switch--compact' : ''
    }`}
  >
    <span className="sr-only">{label}</span>
    <span className="credit-advanced-switch__thumb" />
  </button>
);

const ADD_MODEL_BUTTON_CLASSNAME = 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap';

const CreditModelSettings: React.FC = () => {
  const [rows, setRows] = useState<CreditModelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supportsMaxCallsLimit, setSupportsMaxCallsLimit] = useState(true);
  const [supportsAdvancedSettings, setSupportsAdvancedSettings] = useState(true);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [form, setForm] = useState<EditableProvider>(emptyProvider());
  const [cachedPricing, setCachedPricing] = useState<ModelPricingInfo[] | null>(null);
  const [pricingCacheStatus, setPricingCacheStatus] = useState<PricingCacheStatus>('idle');
  const [pricingMultiplier, setPricingMultiplier] = useState(1);

  const providers = useMemo(() => {
    const grouped = new Map<string, CreditModelRow[]>();
    for (const row of rows) {
      const key = row.provider_id;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }
    return Array.from(grouped.entries()).map(([providerId, items]) => ({ providerId, items }));
  }, [rows]);

  const selectedProviderKeyCount = useMemo(() => {
    if (!selectedProviderId) return 0;
    const entry = providers.find((item) => item.providerId === selectedProviderId);
    if (!entry) return 0;
    return getConfiguredKeyCount(entry.items[0]?.api_keys);
  }, [providers, selectedProviderId]);

  const activeModelCount = useMemo(
    () => rows.filter((row) => row.is_active).length,
    [rows]
  );

  const advancedModelCount = useMemo(
    () => rows.filter((row) => row.advanced_enabled).length,
    [rows]
  );

  useEffect(() => {
    let cancelled = false;
    const providerId = form.providerId.trim();

    if (!providerId) {
      setCachedPricing(null);
      setPricingCacheStatus('idle');
      return;
    }

    setPricingCacheStatus('loading');
    void getCachedPricing(providerId)
      .then((data) => {
        if (cancelled) return;
        const nextPricing = Array.isArray(data) ? data : null;
        setCachedPricing(nextPricing);
        setPricingCacheStatus(nextPricing && nextPricing.length > 0 ? 'ready' : 'empty');
      })
      .catch(() => {
        if (cancelled) return;
        setCachedPricing(null);
        setPricingCacheStatus('empty');
      });

    return () => {
      cancelled = true;
    };
  }, [form.providerId]);

  const modelMixSnapshots = useMemo(() => {
    const currentProviderId = form.providerId.trim() || '__draft_provider__';
    const currentProviderName = form.providerName.trim() || form.providerId.trim() || '当前供应商';
    const providerNameMap = new Map<string, string>();
    const routeProvidersByBaseId = new Map<string, Set<string>>();

    rows
      .filter((row) => row.provider_id !== currentProviderId)
      .forEach((row) => {
        const baseId = normalizeBaseModelId(row.model_id);
        if (!baseId) return;
        if (!routeProvidersByBaseId.has(baseId)) {
          routeProvidersByBaseId.set(baseId, new Set());
        }
        routeProvidersByBaseId.get(baseId)!.add(row.provider_id);
        providerNameMap.set(row.provider_id, row.provider_name || row.provider_id);
      });

    form.models.forEach((model) => {
      const baseId = normalizeBaseModelId(model.modelId);
      if (!baseId) return;
      if (!routeProvidersByBaseId.has(baseId)) {
        routeProvidersByBaseId.set(baseId, new Set());
      }
      routeProvidersByBaseId.get(baseId)!.add(currentProviderId);
      providerNameMap.set(currentProviderId, currentProviderName);
    });

    return form.models.map((model, index) => {
      const baseModelId = normalizeBaseModelId(model.modelId);
      const providerIds = baseModelId ? Array.from(routeProvidersByBaseId.get(baseModelId) || []) : [];
      const peerProviderIds = providerIds.filter((providerId) => providerId !== currentProviderId);

      return {
        index,
        baseModelId,
        routeCount: providerIds.length,
        peerProviderCount: peerProviderIds.length,
        peerProviders: peerProviderIds.map((providerId) => providerNameMap.get(providerId) || providerId),
      };
    });
  }, [rows, form.providerId, form.providerName, form.models]);

  const creditsPerUsd = useMemo(
    () => Math.max(1, DEFAULT_CREDITS_PER_USD * pricingMultiplier),
    [pricingMultiplier]
  );

  const modelSuggestions = useMemo(
    () =>
      form.models.map((model, index) => {
        const baseModelId = normalizeBaseModelId(model.modelId);
        const supportedQualities = getSupportedQualities(baseModelId || model.modelId);
        const suggestion = buildAdminModelCreditSuggestion({
          modelId: baseModelId || model.modelId,
          currentCreditCost: Number(model.creditCost || 1),
          supportedQualities,
          cachedPricing,
          creditsPerUsd,
        });

        const qualitySuggestionChanged =
          supportsAdvancedSettings &&
          !areQualityPricingEqual(model.qualityPricing, suggestion.recommendedQualityPricing, supportedQualities);

        return {
          index,
          baseModelId,
          supportedQualities,
          suggestion,
          mixSnapshot: modelMixSnapshots[index],
          hasSuggestedChange:
            suggestion.recommendedCredits !== Number(model.creditCost || 1) || qualitySuggestionChanged,
        };
      }),
    [form.models, cachedPricing, creditsPerUsd, modelMixSnapshots, supportsAdvancedSettings]
  );

  const pricingCacheSummary = useMemo(() => {
    if (pricingCacheStatus === 'loading') return '正在读取价格缓存...';
    if (pricingCacheStatus === 'ready') {
      return `已读取 ${cachedPricing?.length || 0} 条缓存价格，优先用于积分建议。`;
    }
    if (pricingCacheStatus === 'empty') {
      return '未找到缓存价格，将自动回退到内置定价或当前积分。';
    }
    return '填写供应商 ID 后会自动尝试读取价格缓存。';
  }, [cachedPricing, pricingCacheStatus]);

  const suggestionChangeCount = modelSuggestions.filter((item) => item.hasSuggestedChange).length;

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_admin_credit_models_full');
      if (error) throw error;

      const normalized = normalizeAdminCreditModelRows((data || []) as CreditModelRpcProvider[]);
      setRows(normalized);
      setSupportsMaxCallsLimit(true);
      setSupportsAdvancedSettings(true);
    } catch (error: any) {
      notify.error('加载失败', error.message || '无法加载积分模型配置');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const refreshAdminModelSync = async () => {
    await adminModelService.forceLoadAdminModels();
    await unifiedModelService.refreshModels();
  };

  useEffect(() => {
    if (!selectedProviderId) return;
    const entry = providers.find((item) => item.providerId === selectedProviderId);
    if (!entry) return;
    const first = entry.items[0];
    setForm({
      providerId: first.provider_id,
      providerName: first.provider_name,
      baseUrl: first.base_url,
      // Existing upstream keys are intentionally never hydrated back into the client UI.
      apiKey: '',
      models: entry.items.map((row) => ({
        modelId: normalizeBaseModelId(row.model_id),
        displayName: row.display_name,
        endpointType: row.endpoint_type === 'gemini' ? 'gemini' : 'openai',
        creditCost: Number(row.credit_cost || 1),
        description: row.description || '',
        isActive: Boolean(row.is_active),
        maxCallsLimit: row.max_calls_limit,
        color: row.color || '#3B82F6',
        colorSecondary: row.color_secondary || '',
        textColor: row.text_color === 'black' ? 'black' : 'white',
        advancedEnabled: Boolean(row.advanced_enabled),
        mixWithSameModel: Boolean(row.mix_with_same_model),
        qualityPricing: normalizeAdminQualityPricing(row.quality_pricing, Number(row.credit_cost || 1)),
      })),
    });
  }, [providers, selectedProviderId]);

  const resetForm = () => {
    setSelectedProviderId('');
    setForm(emptyProvider());
  };

  const updateModelAt = (index: number, patch: Partial<EditableModel>) => {
    setForm((prev) => ({
      ...prev,
      models: prev.models.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  };

  const updateModelQualityAt = (
    index: number,
    quality: AdminModelQualityKey,
    patch: Partial<AdminModelQualityPricing[AdminModelQualityKey]>
  ) => {
    setForm((prev) => ({
      ...prev,
      models: prev.models.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          qualityPricing: {
            ...item.qualityPricing,
            [quality]: {
              ...item.qualityPricing[quality],
              ...patch,
            },
          },
        };
      }),
    }));
  };

  const addModel = () => {
    setForm((prev) => ({
      ...prev,
      models: [...prev.models, newModel()],
    }));
  };

  const removeModel = (index: number) => {
    setForm((prev) => ({
      ...prev,
      models: prev.models.filter((_, i) => i !== index),
    }));
  };

  const applySuggestionToModel = (index: number) => {
    const entry = modelSuggestions[index];
    if (!entry) return;

    setForm((prev) => ({
      ...prev,
      models: prev.models.map((item, i) =>
        i === index
          ? {
              ...item,
              creditCost: entry.suggestion.recommendedCredits,
              qualityPricing: supportsAdvancedSettings
                ? entry.suggestion.recommendedQualityPricing
                : item.qualityPricing,
            }
          : item
      ),
    }));
  };

  const applyAllSuggestions = () => {
    setForm((prev) => ({
      ...prev,
      models: prev.models.map((item, index) => {
        const entry = modelSuggestions[index];
        if (!entry) return item;

        return {
          ...item,
          creditCost: entry.suggestion.recommendedCredits,
          qualityPricing: supportsAdvancedSettings
            ? entry.suggestion.recommendedQualityPricing
            : item.qualityPricing,
        };
      }),
    }));

    notify.success(
      '建议已应用',
      supportsAdvancedSettings ? '积分与画质矩阵已回填建议值。' : '基础积分已回填建议值。'
    );
  };

  const saveProvider = async () => {
    const providerId = form.providerId.trim();
    const nextApiKey = form.apiKey.trim();
    const canKeepExistingApiKeys =
      selectedProviderId === providerId && selectedProviderKeyCount > 0;

    if (!form.providerId.trim() || !form.providerName.trim() || !form.baseUrl.trim()) {
      notify.error('缺少字段', '供应商 ID、名称和基础 地址 为必填项');
      return;
    }
    if (!nextApiKey && !canKeepExistingApiKeys) {
      notify.error('缺少 接口密钥', '请填写上游 接口密钥');
      return;
    }

    const validModels = form.models.filter((item) => item.modelId.trim() && item.displayName.trim());
    if (validModels.length === 0) {
      notify.error('模型无效', '至少配置一个有效模型');
      return;
    }

    setSaving(true);
    try {
      const payloadModels = validModels.map((item, index) => ({
        model_id: normalizeBaseModelId(item.modelId),
        display_name: item.displayName.trim(),
        description: item.description || '',
        endpoint_type: item.endpointType === 'auto' ? inferEndpointType(item.modelId) : item.endpointType,
        credit_cost: Number(item.creditCost || 1),
        advanced_enabled: Boolean(item.advancedEnabled),
        mix_with_same_model: Boolean(item.mixWithSameModel),
        quality_pricing: ADMIN_MODEL_QUALITY_KEYS.reduce<Record<string, { enabled: boolean; creditCost: number }>>((acc, quality) => {
          const rule = item.qualityPricing[quality];
          acc[quality] = {
            enabled: rule.enabled !== false,
            creditCost: Math.max(1, Number(rule.creditCost || item.creditCost || 1)),
          };
          return acc;
        }, {}),
        priority: 10 - index,
        weight: 1,
        is_active: Boolean(item.isActive),
        color: normalizeHexColor(item.color, '#3B82F6'),
        color_secondary: item.colorSecondary ? normalizeHexColor(item.colorSecondary) : null,
        text_color: item.textColor,
        ...(supportsMaxCallsLimit
          ? {
              max_calls_limit: item.maxCallsLimit && item.maxCallsLimit > 0 ? item.maxCallsLimit : null,
              auto_pause_on_limit: true,
            }
          : {}),
      }));

      const { error } = await supabase.rpc('save_credit_provider', {
        p_provider_id: providerId,
        p_provider_name: form.providerName.trim(),
        p_base_url: form.baseUrl.trim(),
        p_api_keys: nextApiKey ? [nextApiKey] : [],
        p_models: payloadModels,
      });

      if (error) {
        throw error;
      }

      notify.success(
        '保存成功',
        nextApiKey ? '积分模型配置已更新' : '积分模型配置已更新，并保留了现有上游密钥'
      );
      await load();
      setSelectedProviderId(providerId);
      await refreshAdminModelSync();
    } catch (error: any) {
      notify.error('保存失败', error.message || '请检查 Supabase 权限和 RPC');
    } finally {
      setSaving(false);
    }
  };

  const deleteProvider = async (providerId: string) => {
    if (!confirm(`确认删除供应商 ${providerId} 及其全部积分模型吗？`)) return;
    try {
      const { error } = await supabase.rpc('delete_credit_provider', {
        p_provider_id: providerId,
      });
      if (error) throw error;
      notify.success('删除成功', '供应商积分模型已删除');
      if (selectedProviderId === providerId) resetForm();
      await load();
    } catch (error: any) {
      notify.error('删除失败', error.message || '请使用正确权限后重试');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          value={`${providers.length}`}
          label="供应商配置"
          helper="按供应商维护积分模型"
          tone="indigo"
        />
        <MetricCard
          value={`${rows.length}`}
          label="模型总数"
          helper={`${activeModelCount} 个启用中`}
          tone={activeModelCount > 0 ? 'emerald' : 'neutral'}
        />
        <MetricCard
          value={`${advancedModelCount}`}
          label="高级模型"
          helper="开启高级混合或画质矩阵"
          tone={advancedModelCount > 0 ? 'amber' : 'neutral'}
        />
        <MetricCard
          value={`${creditsPerUsd.toFixed(1)}`}
          label="积分系数"
          helper="$1 估算换算后的积分成本"
          tone="neutral"
        />
      </div>

      <SettingCard
        title="积分模型配置（全局）"
        action={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={() => void load()}>
              {loading ? '刷新中...' : '刷新'}
            </SecondaryButton>
            <PrimaryButton onClick={resetForm}>新建供应商</PrimaryButton>
          </div>
        }
      >
        <div className="rounded-xl border p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--warning) 26%, transparent)' }}>
          <div className="flex items-center gap-2 text-[15px] font-medium text-[var(--text-primary)]">
            <ShieldAlert className="h-4 w-4" />
            这里配置的是管理员全局积分模型
          </div>
          <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
            修改后会同步影响所有用户看到的积分模型，不会改动用户自己的接口配置。
          </p>
        </div>
      </SettingCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px,minmax(0,1fr)]">
        <SettingCard title="已配置供应商" className="self-start xl:sticky xl:top-4">
          <div className="settings-scroll-region space-y-2 pr-1">
            {providers.length === 0 ? (
              <EmptyState title="暂无积分供应商配置" description="先创建一个供应商后再添加模型。" />
            ) : (
              providers.map((item) => {
                const first = item.items[0];
                const activeCount = item.items.filter((m) => m.is_active).length;
                return (
                  <div
                    key={item.providerId}
                    className={`rounded-lg border p-2 ${selectedProviderId === item.providerId ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-[var(--border-light)]'}`}
                  >
                    <button onClick={() => setSelectedProviderId(item.providerId)} className="w-full text-left">
                      <div className="text-sm text-[var(--text-primary)]">{first.provider_name}</div>
                      <div className="text-[11px] text-[var(--text-tertiary)]">{item.providerId}</div>
                      <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                        模型总数：{item.items.length} | 启用：{activeCount}
                      </div>
                    </button>
                    <button
                      onClick={() => void deleteProvider(item.providerId)}
                      className="settings-danger-text mt-2 inline-flex items-center gap-1 text-[11px]"
                    >
                      删除
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </SettingCard>

        <div className="settings-section-card space-y-4 p-4 rounded-2xl border border-[var(--border-light)]" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 60%, transparent)' }}>
          <div>
            <div className="mb-2 text-xs font-semibold text-[var(--text-primary)]">供应商基础信息</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[11px] text-[var(--text-tertiary)]">供应商 编号（唯一）</span>
                <input
                  value={form.providerId}
                  onChange={(e) => setForm((prev) => ({ ...prev, providerId: e.target.value }))}
                  placeholder="例如：cdn.12ai"
                  className="w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-[var(--text-tertiary)]">供应商名称</span>
                <input
                  value={form.providerName}
                  onChange={(e) => setForm((prev) => ({ ...prev, providerName: e.target.value }))}
                  placeholder="例如：官方镜像"
                  className="w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-[var(--text-tertiary)]">基础 地址</span>
                <input
                  value={form.baseUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="例如：https://api.example.com/v1"
                  className="w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-[var(--text-tertiary)]">上游 接口密钥</span>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                  autoComplete="new-password"
                  placeholder={
                    selectedProviderId && selectedProviderId === form.providerId.trim() && selectedProviderKeyCount > 0
                      ? '留空则保留现有密钥，填写则替换'
                      : '请输入上游 接口密钥'
                  }
                  className="w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm"
                />
                <div className="text-[11px] leading-5 text-[var(--text-tertiary)]">
                  {selectedProviderId && selectedProviderId === form.providerId.trim() && selectedProviderKeyCount > 0
                    ? `当前已配置 ${selectedProviderKeyCount} 个上游密钥。为了安全，前端不会回显真实值；留空将保留现有密钥。`
                    : '为了安全，已有上游密钥不会回显到前端。新增或轮换时请输入新的密钥。'}
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">价格建议 / 快速调节</div>
                  <div className="mt-1 text-[11px] leading-5 text-[var(--text-tertiary)]">
                    依据缓存价格、内置定价和积分换算系数，快速回填每个模型的推荐积分。
                  </div>
                </div>
                <button
                  type="button"
                  onClick={applyAllSuggestions}
                  disabled={suggestionChangeCount === 0}
                  className="apple-button-secondary min-h-9 px-3 text-[11px] disabled:opacity-60"
                >
                  应用全部建议
                </button>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr),120px]">
                <div className="rounded-lg bg-[var(--bg-tertiary)] px-3 py-2">
                  <div className="text-[11px] font-medium text-[var(--text-primary)]">
                    $1 ≈ {DEFAULT_CREDITS_PER_USD} 积分 × 系数 = {creditsPerUsd.toFixed(1)} 积分
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-[var(--text-tertiary)]">
                    {pricingCacheSummary}
                  </div>
                </div>
                <label className="space-y-1">
                  <span className="text-[11px] text-[var(--text-tertiary)]">调节系数</span>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={pricingMultiplier}
                    onChange={(e) => {
                      const nextValue = Number(e.target.value);
                      setPricingMultiplier(Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1);
                    }}
                    className="w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="mt-3 space-y-2">
                {modelSuggestions.filter((item) => item.baseModelId).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--border-light)] px-3 py-2 text-[11px] text-[var(--text-tertiary)]">
                    添加模型后，这里会自动显示当前积分与建议积分的对照。
                  </div>
                ) : (
                  modelSuggestions
                    .filter((item) => item.baseModelId)
                    .map((item) => {
                      const model = form.models[item.index];
                      const qualityPreview = item.supportedQualities
                        .map(
                          (quality) =>
                            `${quality}: ${item.suggestion.recommendedQualityPricing[quality].creditCost}`
                        )
                        .join(' / ');

                      return (
                        <div
                          key={`${item.baseModelId}-${item.index}`}
                          className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-3 py-2"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-[var(--text-primary)]">
                                {model.displayName || item.baseModelId}
                              </div>
                              <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
                                当前 {model.creditCost} 积分 → 建议 {item.suggestion.recommendedCredits} 积分
                              </div>
                              <div className="text-[11px] leading-5 text-[var(--text-tertiary)]">
                                来源：{item.suggestion.sourceLabel}
                                {item.suggestion.usdEstimate !== null
                                  ? ` · 估算单次成本 ${formatUsdEstimate(item.suggestion.usdEstimate)}`
                                  : ''}
                                {item.suggestion.matchedModel ? ` · 匹配 ${item.suggestion.matchedModel}` : ''}
                              </div>
                            </div>
                            <SecondaryButton
                              onClick={() => applySuggestionToModel(item.index)}
                              className={!item.hasSuggestedChange ? 'pointer-events-none opacity-60' : ''}
                            >
                              套用建议
                            </SecondaryButton>
                          </div>
                          <div className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
                            {item.suggestion.note}
                          </div>
                          {supportsAdvancedSettings && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span className="rounded-full bg-indigo-500/14 px-2 py-1 text-[10px] font-medium text-indigo-200">
                                画质矩阵建议
                              </span>
                              <span className="text-[10px] leading-5 text-[var(--text-tertiary)]">
                                {qualityPreview} 积分
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">模型配置</div>
                <div className="mt-1 text-[12px] text-[var(--text-tertiary)]">每个模型都能单独配置积分、颜色、上限和高级策略。</div>
              </div>
              <SecondaryButton onClick={addModel} className={ADD_MODEL_BUTTON_CLASSNAME}>
                <Plus size={14} className="h-3.5 w-3.5 shrink-0" />
                <span className="leading-none">添加模型</span>
              </SecondaryButton>
            </div>
            {!supportsMaxCallsLimit && (
              <div className="rounded-xl border px-3 py-2 text-[11px] leading-5" style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--warning) 26%, transparent)', color: 'var(--text-secondary)' }}>
                当前数据库未包含总调用上限字段（`max_calls_limit`），已自动降级兼容。
                执行最新 Supabase 迁移后，可启用“总调用上限/自动暂停”能力。
              </div>
            )}
            {!supportsAdvancedSettings && (
              <div className="rounded-xl border px-3 py-2 text-[11px] leading-5" style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--warning) 26%, transparent)', color: 'var(--text-secondary)' }}>
                当前数据库未包含高级设置字段（`advanced_enabled / mix_with_same_model / quality_pricing`），
                已自动隐藏画质定价与混合路由配置。执行最新 Supabase 迁移后即可启用。
              </div>
            )}
            {form.models.map((model, index) => {
              const callsUsed = rows.find(
                (row) => row.provider_id === form.providerId && row.model_id === model.modelId
              )?.call_count;
              const qualitiesToShow = getSupportedQualities(model.modelId);
              const enabledQualityCount = qualitiesToShow.filter(
                (quality) => model.qualityPricing[quality]?.enabled !== false
              ).length;

              return (
                <div key={`${model.modelId}-${index}`} className="rounded-xl border border-[var(--border-light)] p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-light)] px-3 py-2" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 24%, transparent)' }}>
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">
                        {model.displayName || model.modelId || `模型 ${index + 1}`}
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                        {model.modelId || '先填写模型编号'}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full border border-[var(--border-light)] px-2 py-1 text-[var(--text-secondary)]">
                        {model.endpointType === 'auto' ? '自动' : model.endpointType}
                      </span>
                      <span className="rounded-full border border-[var(--border-light)] px-2 py-1 text-[var(--text-secondary)]">
                        {model.creditCost} 积分
                      </span>
                      {supportsAdvancedSettings ? (
                        <span className="rounded-full border border-[var(--border-light)] px-2 py-1 text-[var(--text-secondary)]">
                          {model.advancedEnabled ? '高级已开' : '标准模式'}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-[11px] text-[var(--text-tertiary)]">模型编号</span>
                      <input
                        value={model.modelId}
                        onChange={(e) => {
                          const value = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            models: prev.models.map((item, i) => (i === index ? { ...item, modelId: value } : item)),
                          }));
                        }}
                        placeholder="例如：gemini-2.5-flash"
                        className="w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-[var(--text-tertiary)]">显示名称</span>
                      <input
                        value={model.displayName}
                        onChange={(e) => {
                          const value = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            models: prev.models.map((item, i) => (i === index ? { ...item, displayName: value } : item)),
                          }));
                        }}
                        placeholder="例如：Gemini 2.5 Flash"
                        className="w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-[var(--text-tertiary)]">接口类型</span>
                      <select
                        value={model.endpointType}
                        onChange={(e) => {
                          const value = e.target.value as EditableModel['endpointType'];
                          setForm((prev) => ({
                            ...prev,
                            models: prev.models.map((item, i) => (i === index ? { ...item, endpointType: value } : item)),
                          }));
                        }}
                        className="w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm"
                      >
                        <option value="auto">自动判断</option>
                        <option value="openai">通用兼容接口</option>
                        <option value="gemini">谷歌接口</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-[var(--text-tertiary)]">
                        积分消耗
                        {model.advancedEnabled && (
                          <span className="ml-1.5 text-[10px] text-indigo-400">(高级模式)</span>
                        )}
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={model.creditCost}
                        onChange={(e) => {
                          const value = Number(e.target.value || 1);
                          setForm((prev) => ({
                            ...prev,
                            models: prev.models.map((item, i) => (
                              i === index
                                ? {
                                    ...item,
                                    creditCost: value,
                                    qualityPricing: item.advancedEnabled ? item.qualityPricing : createDefaultAdminQualityPricing(value),
                                  }
                                : item
                            )),
                          }));
                        }}
                        className="w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm"
                      />
                      {model.advancedEnabled && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {qualitiesToShow.map((quality) => {
                            const rule = model.qualityPricing[quality];
                            const isEnabled = rule.enabled !== false;
                            const qualityMeta = QUALITY_META[quality];

                            return (
                              <span
                                key={quality}
                                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium ${
                                  isEnabled
                                    ? 'bg-indigo-500/14 text-indigo-500 dark:text-indigo-200'
                                    : 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)]'
                                }`}
                              >
                                <span>{qualityMeta.resolution}</span>
                                <span>{rule.creditCost} 积分</span>
                                {!isEnabled ? <span className="opacity-80">已停用</span> : null}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-[var(--text-tertiary)]">主颜色</span>
                      <input
                        type="color"
                        value={model.color}
                        onChange={(e) => {
                          const value = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            models: prev.models.map((item, i) => (i === index ? { ...item, color: value } : item)),
                          }));
                        }}
                        className="h-10 w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-2"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-[var(--text-tertiary)]">副颜色（可选）</span>
                      <input
                        type="color"
                        value={model.colorSecondary || '#3B82F6'}
                        onChange={(e) => {
                          const value = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            models: prev.models.map((item, i) => (i === index ? { ...item, colorSecondary: value } : item)),
                          }));
                        }}
                        className="h-10 w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-2"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-[var(--text-tertiary)]">文本颜色</span>
                      <select
                        value={model.textColor}
                        onChange={(e) => {
                          const value = e.target.value as 'white' | 'black';
                          setForm((prev) => ({
                            ...prev,
                            models: prev.models.map((item, i) => (i === index ? { ...item, textColor: value } : item)),
                          }));
                        }}
                        className="w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm"
                      >
                        <option value="white">白色</option>
                        <option value="black">黑色</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-[var(--text-tertiary)]">总调用上限（留空为无限）</span>
                      <input
                        type="number"
                        min={1}
                        disabled={!supportsMaxCallsLimit}
                        value={model.maxCallsLimit ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const value = raw ? Number(raw) : null;
                          setForm((prev) => ({
                            ...prev,
                            models: prev.models.map((item, i) =>
                              i === index ? { ...item, maxCallsLimit: value && value > 0 ? value : null } : item
                            ),
                          }));
                        }}
                        placeholder="默认无限"
                        className="w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </label>
                  </div>

                  <label className="space-y-1 block">
                    <span className="text-[11px] text-[var(--text-tertiary)]">描述（可选）</span>
                    <input
                      value={model.description}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          models: prev.models.map((item, i) => (i === index ? { ...item, description: value } : item)),
                        }));
                      }}
                      placeholder="例如：高质量图像生成，适合专业设计"
                      className="w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm"
                    />
                  </label>

                  {supportsAdvancedSettings && (
                    <div className="rounded-2xl border border-[var(--border-light)] p-4" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 22%, transparent)' }}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-light)] bg-[color-mix(in_srgb,var(--bg-hover)_92%,transparent)] text-[var(--text-primary)]">
                            <SlidersHorizontal size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Advanced Controls</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <div className="text-[15px] font-medium text-[var(--text-primary)]">高级设置</div>
                              <span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${model.advancedEnabled ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300' : 'border-[var(--border-light)] text-[var(--text-tertiary)]'}`}>
                                {model.advancedEnabled ? '已启用' : '未启用'}
                              </span>
                            </div>
                            <div className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">
                              把复杂配置收敛成两件事：混合路由和分辨率定价。
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-[var(--border-light)] px-3 py-2" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 28%, transparent)' }}>
                          <div className="mb-2 text-[11px] text-[var(--text-tertiary)]">启用高级策略</div>
                          <AdvancedToggle
                            checked={model.advancedEnabled}
                            label="启用高级设置"
                            onToggle={() => {
                              const enabled = !model.advancedEnabled;
                              updateModelAt(index, {
                                advancedEnabled: enabled,
                                qualityPricing: normalizeAdminQualityPricing(model.qualityPricing, model.creditCost),
                              });
                            }}
                          />
                        </div>
                      </div>

                      {model.advancedEnabled && (
                        <div className="mt-4 space-y-4">
                          <div className="grid gap-3 lg:grid-cols-2">
                            <div className="rounded-xl border border-[var(--border-light)] p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 40%, transparent)' }}>
                              <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-300">
                                  <ArrowRightLeft size={15} />
                                </div>
                                <div>
                                  <div className="text-[15px] font-medium text-[var(--text-primary)]">多供应商混合</div>
                                  <div className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">
                                    自动均衡同模型下的请求量，优先使用调用次数较少的供应商。
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 flex items-center justify-between gap-3">
                                <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${model.mixWithSameModel ? 'bg-emerald-500/12 text-emerald-300' : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'}`}>
                                  {model.mixWithSameModel ? '自动均衡已开启' : '保持单供应商'}
                                </span>
                                <AdvancedToggle
                                  checked={model.mixWithSameModel}
                                  label="启用多供应商混合"
                                  onToggle={() => updateModelAt(index, { mixWithSameModel: !model.mixWithSameModel })}
                                  tone="emerald"
                                />
                              </div>
                            </div>

                            <div className="rounded-xl border border-[var(--border-light)] p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 40%, transparent)' }}>
                              <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/12 text-indigo-300">
                                  <Sparkles size={15} />
                                </div>
                                <div>
                                  <div className="text-[15px] font-medium text-[var(--text-primary)]">画质定价</div>
                                  <div className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">
                                    按分辨率单独设置积分成本，方便把高质量出图与默认费率区分开。
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                <div className="rounded-xl border border-[var(--border-light)] px-3 py-2 text-center">
                                  <div className="text-[10px] text-[var(--text-tertiary)]">可配置规格</div>
                                  <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">{qualitiesToShow.length}</div>
                                </div>
                                <div className="rounded-xl border border-[var(--border-light)] px-3 py-2 text-center">
                                  <div className="text-[10px] text-[var(--text-tertiary)]">当前启用</div>
                                  <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">{enabledQualityCount}</div>
                                </div>
                                <div className="rounded-xl border border-[var(--border-light)] px-3 py-2 text-center">
                                  <div className="text-[10px] text-[var(--text-tertiary)]">默认积分</div>
                                  <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">{model.creditCost}</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-[var(--border-light)] p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 32%, transparent)' }}>
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Pricing Matrix</div>
                                <div className="mt-1 text-[15px] font-medium text-[var(--text-primary)]">按画质单独定价</div>
                              </div>
                              <div className="rounded-full border border-[var(--border-light)] px-2 py-1 text-[11px] text-[var(--text-secondary)]">
                                已启用 {enabledQualityCount} / {qualitiesToShow.length}
                              </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                              {qualitiesToShow.map((quality) => {
                                const rule = model.qualityPricing[quality];
                                const isEnabled = rule.enabled !== false;
                                const qualityMeta = QUALITY_META[quality];

                                return (
                                  <div
                                    key={quality}
                                    className="flex h-full flex-col rounded-[22px] border border-[var(--border-light)] px-4 py-4"
                                    style={{
                                      backgroundColor: isEnabled
                                        ? 'color-mix(in srgb, var(--bg-hover) 55%, transparent)'
                                        : 'color-mix(in srgb, var(--bg-tertiary) 24%, transparent)',
                                    }}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <div className="text-[15px] font-semibold text-[var(--text-primary)]">{quality}</div>
                                          <span className="rounded-full border border-[var(--border-light)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                                            {qualityMeta.resolution}
                                          </span>
                                        </div>
                                        <div className="mt-2">
                                          <span
                                            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${
                                              isEnabled
                                                ? 'bg-indigo-500/14 text-indigo-200'
                                                : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                                            }`}
                                          >
                                            {isEnabled ? '当前启用' : '当前停用'}
                                          </span>
                                        </div>
                                      </div>
                                      <AdvancedToggle
                                        checked={isEnabled}
                                        label={`启用 ${quality}`}
                                        onToggle={() => updateModelQualityAt(index, quality, { enabled: !isEnabled })}
                                        size="compact"
                                      />
                                    </div>

                                    <div className="mt-3 flex-1 text-[13px] leading-6 text-[var(--text-secondary)]">
                                      {qualityMeta.hint}
                                    </div>

                                    <label className="mt-auto block pt-4">
                                      <div className="mb-2 flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-[var(--text-tertiary)]">
                                          {isEnabled ? '单次积分' : '当前已停用'}
                                        </span>
                                        <span className="text-[10px] text-[var(--text-tertiary)]">
                                          {isEnabled ? '按次结算' : '暂停计费'}
                                        </span>
                                      </div>
                                      <div
                                        className={`flex h-12 items-center justify-between gap-3 rounded-2xl border px-3 ${
                                          isEnabled ? '' : 'opacity-70'
                                        }`}
                                        style={{ backgroundColor: 'color-mix(in srgb, var(--bg-primary) 38%, transparent)' }}
                                      >
                                        <input
                                          type="number"
                                          min={1}
                                          disabled={!isEnabled}
                                          value={rule.creditCost}
                                          onChange={(e) =>
                                            updateModelQualityAt(index, quality, {
                                              creditCost: Math.max(1, Number(e.target.value || model.creditCost || 1)),
                                            })
                                          }
                                          className="w-16 min-w-0 bg-transparent text-left text-[18px] font-semibold tabular-nums text-[var(--text-primary)] outline-none"
                                        />
                                        <span className="shrink-0 text-[12px] font-medium text-[var(--text-secondary)]">
                                          积分
                                        </span>
                                      </div>
                                    </label>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex gap-2 rounded-xl border border-[var(--border-light)] px-3 py-2 text-[var(--text-secondary)]" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 20%, transparent)' }}>
                            <Info className="mt-0.5 h-4 w-4 shrink-0" />
                            <div className="text-[11px] leading-5">
                              <span className="font-semibold">混合路由策略：</span>
                              同一模型有多个供应商开启混合时，系统会先选择调用次数更少的供应商；若用量相同，再优先选择成本更低的链路。
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 rounded-xl border border-[var(--border-light)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 24%, transparent)' }}>
                    <div className="text-[11px] text-[var(--text-tertiary)]">
                      已调用：{callsUsed ?? 0}
                      {model.maxCallsLimit ? ` / ${model.maxCallsLimit}` : ' / 无限'}
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="text-xs text-[var(--text-secondary)]">
                        <input
                          className="mr-2"
                          type="checkbox"
                          checked={model.isActive}
                          onChange={(e) => {
                            const value = e.target.checked;
                            setForm((prev) => ({
                              ...prev,
                              models: prev.models.map((item, i) => (i === index ? { ...item, isActive: value } : item)),
                            }));
                          }}
                        />
                        启用
                      </label>
                      <DangerButton onClick={() => removeModel(index)} className="px-3 py-2 text-xs">
                        删除模型
                      </DangerButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton onClick={addModel} className={ADD_MODEL_BUTTON_CLASSNAME}>
              <Plus size={14} className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-none">添加模型</span>
            </SecondaryButton>
            <PrimaryButton onClick={() => void saveProvider()} loading={saving}>
              {saving ? '保存中...' : '保存供应商'}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditModelSettings;

