// 职责：管理员维护供应商、预设 API、Key、模型 ID 和基础积分费用。

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Edit, ExternalLink, Globe, Plus, RefreshCw, Save, Shield } from "lucide-react";
import type { AdminCreditProviderDto } from "../../../../../packages/shared/src/index.ts";
import { kkWebApiClient } from "../../services/api/kkApiClient.ts";
import {
  adminModelService,
  type AdminProvider,
} from "../../services/model/adminModelService.ts";
import {
  ADMIN_MODEL_QUALITY_KEYS,
  createDefaultAdminQualityPricing,
  normalizeAdminQualityPricing,
  type AdminModelQualityPricing,
} from "../../services/model/adminModelQuality.ts";
import { safeOpenLink } from "../../utils/browserUtils";

type AdminPresetKind = "official" | "relay";

type AdminApiPreset = {
  name: string;
  baseUrl: string;
  modelId: string;
  kind: AdminPresetKind;
  endpointType: string;
  requestProfileId: string;
  color: string;
  website: string;
  note?: string;
};

const ADMIN_API_PRESETS: AdminApiPreset[] = [
  {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    modelId: "gpt-4o",
    kind: "official",
    endpointType: "openai_chat_completions",
    requestProfileId: "openai-official",
    color: "#10a37f",
    website: "https://openai.com",
  },
  {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelId: "gemini-2.5-flash",
    kind: "official",
    endpointType: "google_gemini_generate_content",
    requestProfileId: "google-gemini-official",
    color: "#4285f4",
    website: "https://gemini.google.com",
  },
  {
    name: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com/v1",
    modelId: "claude-3-5-sonnet-latest",
    kind: "official",
    endpointType: "anthropic_messages",
    requestProfileId: "anthropic-official",
    color: "#d97706",
    website: "https://www.anthropic.com",
  },
  {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    modelId: "deepseek-chat",
    kind: "official",
    endpointType: "deepseek_chat_completions",
    requestProfileId: "deepseek-official",
    color: "#2563eb",
    website: "https://www.deepseek.com",
  },
  {
    name: "阿里 DashScope / Qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelId: "qwen-plus",
    kind: "official",
    endpointType: "openai_chat_completions",
    requestProfileId: "dashscope-openai-compatible",
    color: "#7c3aed",
    website: "https://help.aliyun.com/zh/model-studio/",
  },
  {
    name: "火山 Ark",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    modelId: "doubao-seed-1-6",
    kind: "official",
    endpointType: "openai_chat_completions",
    requestProfileId: "volcengine-ark-openai-compatible",
    color: "#ef4444",
    website: "https://www.volcengine.com/product/ark",
  },
  {
    name: "Moonshot / Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    modelId: "moonshot-v1-128k",
    kind: "official",
    endpointType: "openai_chat_completions",
    requestProfileId: "moonshot-openai-compatible",
    color: "#111827",
    website: "https://www.moonshot.cn",
  },
  {
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    modelId: "glm-4-plus",
    kind: "official",
    endpointType: "openai_chat_completions",
    requestProfileId: "zhipu-openai-compatible",
    color: "#0ea5e9",
    website: "https://open.bigmodel.cn",
  },
  {
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    modelId: "mistral-large-latest",
    kind: "official",
    endpointType: "openai_chat_completions",
    requestProfileId: "mistral-openai-compatible",
    color: "#f97316",
    website: "https://mistral.ai",
  },
  {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    modelId: "openai/gpt-4o",
    kind: "relay",
    endpointType: "openai_chat_completions",
    requestProfileId: "openrouter-openai-compatible",
    color: "#7c3aed",
    website: "https://openrouter.ai",
  },
  {
    name: "SiliconFlow",
    baseUrl: "https://api.siliconflow.cn/v1",
    modelId: "Qwen/Qwen3-235B-A22B-Instruct-2507",
    kind: "relay",
    endpointType: "openai_chat_completions",
    requestProfileId: "siliconflow-openai-compatible",
    color: "#ff5a00",
    website: "https://siliconflow.cn",
  },
  {
    name: "GPT-Best",
    baseUrl: "https://api.gpt-best.com/v1",
    modelId: "gpt-4o",
    kind: "relay",
    endpointType: "openai_chat_completions",
    requestProfileId: "gpt-best-openai-compatible",
    color: "#16a34a",
    website: "https://gpt-best.apifox.cn/llms.txt",
  },
  {
    name: "APIMart",
    baseUrl: "https://api.apimart.ai/v1",
    modelId: "gpt-5-mini",
    kind: "relay",
    endpointType: "apimart_chat_completions",
    requestProfileId: "apimart-openai-compatible",
    color: "#9333ea",
    website: "https://docs.apimart.ai/cn",
    note: "专用返回结构，使用 APIMart 预设保存。",
  },
  {
    name: "12AI",
    baseUrl: "https://cdn.12ai.org",
    modelId: "gpt-5.1",
    kind: "relay",
    endpointType: "twelveai_multi_protocol",
    requestProfileId: "12ai-documented-multi-protocol",
    color: "#06b6d4",
    website: "https://doc.12ai.org/docs/api",
    note: "独立多协议预设，按模型自动选择 12AI 文档协议。",
  },
  {
    name: "Wuyin / 速创",
    baseUrl: "https://api.wuyinkeji.com",
    modelId: "image_nanoBanana2",
    kind: "relay",
    endpointType: "wuyin_documented_task",
    requestProfileId: "wuyin-suchuang-form",
    color: "#f59e0b",
    website: "https://api.wuyinkeji.com/type/all",
    note: "按每个 Wuyin 模型文档执行。",
  },
  {
    name: "One API / New API",
    baseUrl: "https://your-new-api.example.com/v1",
    modelId: "gpt-4o-mini",
    kind: "relay",
    endpointType: "openai_chat_completions",
    requestProfileId: "one-api-new-api-compatible",
    color: "#64748b",
    website: "https://github.com/Calcium-Ion/new-api",
  },
  {
    name: "自定义 OpenAI 兼容",
    baseUrl: "https://example.com/v1",
    modelId: "gpt-4o-mini",
    kind: "relay",
    endpointType: "openai_chat_completions",
    requestProfileId: "generic-openai-compatible",
    color: "#0f172a",
    website: "https://platform.openai.com/docs/api-reference/chat",
  },
];

type AdminProviderDraft = {
  providerId: string;
  providerName: string;
  baseUrl: string;
  modelId: string;
  displayName: string;
  endpointType: string;
  requestProfileId: string;
  apiKey: string;
  color: string;
  kind: AdminPresetKind;
  creditCost: string;
  advancedEnabled: boolean;
  qualityPricing: AdminModelQualityPricing;
  isEditing?: boolean;
  originalModels?: any[];
  retainApiKeyFingerprints?: string[];
};

const parseHost = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const normalizeCreditCost = (value: string | number | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
};

const buildProviderId = (name: string, baseUrl: string): string => {
  const source = `${name}-${parseHost(baseUrl)}`.toLowerCase();
  const slug = source.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || `provider-${Date.now()}`;
};

const createDraftFromPreset = (preset: AdminApiPreset): AdminProviderDraft => ({
  providerId: buildProviderId(preset.name, preset.baseUrl),
  providerName: preset.name,
  baseUrl: preset.baseUrl,
  modelId: preset.modelId,
  displayName: preset.modelId,
  endpointType: preset.endpointType,
  requestProfileId: preset.requestProfileId,
  apiKey: "",
  color: preset.color,
  kind: preset.kind,
  creditCost: "1",
  advancedEnabled: false,
  qualityPricing: createDefaultAdminQualityPricing(1),
});

const createEmptyDraft = (): AdminProviderDraft => ({
  providerId: buildProviderId("custom-provider", "custom.local"),
  providerName: "自定义供应商",
  baseUrl: "",
  modelId: "",
  displayName: "",
  endpointType: "openai_chat_completions",
  requestProfileId: "generic-openai-compatible",
  apiKey: "",
  color: "#3B82F6",
  kind: "relay",
  creditCost: "1",
  advancedEnabled: false,
  qualityPricing: createDefaultAdminQualityPricing(1),
});

const buildModelPayload = (model: {
  modelId: string;
  displayName: string;
  description?: string;
  endpointType: string;
  requestProfileId?: string;
  creditCost: number;
  priority?: number;
  weight?: number;
  isActive?: boolean;
  color?: string;
  colorSecondary?: string | null;
  textColor?: "white" | "black";
  maxCallsLimit?: number | null;
  advancedEnabled?: boolean;
  mixWithSameModel?: boolean;
  qualityPricing?: AdminModelQualityPricing | Record<string, { enabled: boolean; creditCost: number }>;
}) => ({
  modelId: model.modelId,
  displayName: model.displayName || model.modelId,
  description: model.description || "",
  endpointType: model.endpointType || "openai_chat_completions",
  requestProfileId: model.requestProfileId || "",
  creditCost: normalizeCreditCost(model.creditCost),
  priority: Number(model.priority || 0),
  weight: Number(model.weight || 1),
  isActive: model.isActive !== false,
  color: model.color || "#3B82F6",
  colorSecondary: model.colorSecondary || null,
  textColor: model.textColor === "black" ? "black" : "white",
  maxCallsLimit: model.maxCallsLimit ?? null,
  advancedEnabled: Boolean(model.advancedEnabled),
  mixWithSameModel: Boolean(model.mixWithSameModel),
  qualityPricing: normalizeAdminQualityPricing(model.qualityPricing, normalizeCreditCost(model.creditCost)),
});

export const ApiConfigPanel: React.FC = () => {
  const [presetTab, setPresetTab] = useState<AdminPresetKind>("official");
  const [providers, setProviders] = useState<AdminProvider[]>(() => adminModelService.getProviders());
  const [adminProviders, setAdminProviders] = useState<AdminCreditProviderDto[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [providerDraft, setProviderDraft] = useState<AdminProviderDraft | null>(null);
  const [draftCreditCost, setDraftCreditCost] = useState<string>("1");
  const [draftAdvancedPricingEnabled, setDraftAdvancedPricingEnabled] = useState(false);
  const [draftQualityPricing, setDraftQualityPricing] = useState<AdminModelQualityPricing>(() => createDefaultAdminQualityPricing(1));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");

  const refreshAdminProviders = useCallback(async () => {
    const response = await kkWebApiClient.listAdminCreditProviders();
    if (response.success) {
      setAdminProviders(response.data.items || []);
      return;
    }
    setMessage(response.error?.message || "无法读取管理员供应商详情。");
  }, []);

  useEffect(() => {
    const update = () => setProviders([...adminModelService.getProviders()]);
    update();
    setLoading(true);
    void Promise.all([
      adminModelService.forceLoadAdminModels(),
      refreshAdminProviders(),
    ]).finally(() => {
      update();
      setLoading(false);
    });
    return adminModelService.subscribe(update);
  }, [refreshAdminProviders]);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.providerId === selectedProviderId) || providers[0] || null,
    [providers, selectedProviderId],
  );

  const selectedModel = useMemo(() => {
    const models = selectedProvider?.models || [];
    return models.find((model) => model.recordId === selectedModelId || model.id === selectedModelId) || models[0] || null;
  }, [selectedModelId, selectedProvider]);

  useEffect(() => {
    if (!selectedProvider && providers[0]) setSelectedProviderId(providers[0].providerId);
  }, [providers, selectedProvider]);

  useEffect(() => {
    if (!selectedModel) return;
    const creditCost = normalizeCreditCost(selectedModel.creditCost || 1);
    setDraftCreditCost(String(creditCost));
    setDraftAdvancedPricingEnabled(Boolean(selectedModel.advancedEnabled));
    setDraftQualityPricing(normalizeAdminQualityPricing(selectedModel.qualityPricing, creditCost));
  }, [selectedModel]);

  const filteredPresets = ADMIN_API_PRESETS.filter((preset) => preset.kind === presetTab);

  const handlePreset = (preset: AdminApiPreset) => {
    setProviderDraft(createDraftFromPreset(preset));
    setDraftCreditCost("1");
    setDraftAdvancedPricingEnabled(false);
    setDraftQualityPricing(createDefaultAdminQualityPricing(1));
    setMessage(`${preset.name} 已载入。填写 API Key、模型 ID 和基础积分费用后即可保存。`);
  };

  const handleCreateCustomDraft = () => {
    setProviderDraft(createEmptyDraft());
    setDraftCreditCost("1");
    setDraftAdvancedPricingEnabled(false);
    setDraftQualityPricing(createDefaultAdminQualityPricing(1));
    setMessage("自定义供应商草稿已创建。填写 Base URL、模型 ID、API Key 和基础积分费用后保存。");
  };

  const handleEditProvider = (provider: AdminProvider) => {
    const providerDetail = adminProviders.find((p) => p.providerId === provider.providerId);
    const firstModel = provider.models[0];
    const detailModel = providerDetail?.models[0];
    const modelId = firstModel?.id || detailModel?.modelId || "";
    const creditCost = firstModel?.creditCost || detailModel?.creditCost || 1;

    const originalModels = providerDetail ? providerDetail.models.map((model) => buildModelPayload({
      modelId: model.modelId,
      displayName: model.displayName || model.modelId,
      description: model.description || "",
      endpointType: model.endpointType || "openai_chat_completions",
      requestProfileId: model.requestProfileId || "",
      creditCost: model.creditCost || 1,
      priority: model.priority || 0,
      weight: model.weight || 1,
      isActive: model.isActive,
      color: model.color || "#3B82F6",
      colorSecondary: model.colorSecondary || null,
      textColor: model.textColor || "white",
      maxCallsLimit: model.maxCallsLimit || null,
      advancedEnabled: Boolean(model.advancedEnabled),
      mixWithSameModel: Boolean(model.mixWithSameModel),
      qualityPricing: normalizeAdminQualityPricing(model.qualityPricing, model.creditCost || 1),
    })) : [];
    const nextQualityPricing = normalizeAdminQualityPricing(detailModel?.qualityPricing || firstModel?.qualityPricing, creditCost);

    setProviderDraft({
      providerId: provider.providerId,
      providerName: provider.name,
      baseUrl: providerDetail?.baseUrl || "",
      modelId,
      displayName: firstModel?.displayName || detailModel?.displayName || modelId,
      endpointType: firstModel?.endpoint || detailModel?.endpointType || "openai_chat_completions",
      requestProfileId: firstModel?.requestProfileId || detailModel?.requestProfileId || "",
      apiKey: "",
      color: firstModel?.colorStart || detailModel?.color || "#3B82F6",
      kind: provider.providerKind || providerDetail?.providerKind || "relay",
      creditCost: String(creditCost),
      advancedEnabled: Boolean(detailModel?.advancedEnabled ?? firstModel?.advancedEnabled),
      qualityPricing: nextQualityPricing,
      isEditing: true,
      originalModels,
      retainApiKeyFingerprints: (providerDetail?.apiKeyEntries || []).map((entry) => entry.fingerprint).filter(Boolean),
    });
    setDraftCreditCost(String(creditCost));
    setDraftAdvancedPricingEnabled(Boolean(detailModel?.advancedEnabled ?? firstModel?.advancedEnabled));
    setDraftQualityPricing(nextQualityPricing);
    setMessage(`已载入供应商 ${provider.name} 的配置以供修改。`);
  };

  const handleDraftChange = (patch: Partial<AdminProviderDraft>) => {
    setProviderDraft((current) => current ? { ...current, ...patch } : current);
  };

  const handleAdvancedPricingToggle = (enabled: boolean) => {
    setDraftAdvancedPricingEnabled(enabled);
    setProviderDraft((current) => current ? { ...current, advancedEnabled: enabled } : current);
  };

  const handleQualityPricingChange = (
    quality: (typeof ADMIN_MODEL_QUALITY_KEYS)[number],
    patch: Partial<{ enabled: boolean; creditCost: string | number }>,
  ) => {
    setDraftQualityPricing((current) => {
      const defaults = createDefaultAdminQualityPricing(normalizeCreditCost(draftCreditCost));
      const nextRule = {
        ...defaults[quality],
        ...current[quality],
        ...patch,
      };
      const nextPricing = {
        ...current,
        [quality]: {
          enabled: nextRule.enabled !== false,
          creditCost: normalizeCreditCost(nextRule.creditCost),
        },
      };
      setProviderDraft((draft) => draft ? { ...draft, qualityPricing: nextPricing } : draft);
      return nextPricing;
    });
  };

  const handleSaveDraftProvider = async () => {
    if (!providerDraft) return;
    const providerName = providerDraft.providerName.trim();
    const baseUrl = providerDraft.baseUrl.trim();
    const modelId = providerDraft.modelId.trim();
    if (!providerName || !baseUrl || !modelId) {
      setMessage("供应商名称、Base URL 和模型 ID 都必须填写。");
      return;
    }

    const creditCost = normalizeCreditCost(providerDraft.creditCost || draftCreditCost);
    const qualityPricing = normalizeAdminQualityPricing(providerDraft.qualityPricing || draftQualityPricing, creditCost);
    const providerId = providerDraft.isEditing && providerDraft.providerId ? providerDraft.providerId : buildProviderId(providerName, baseUrl);
    const nextModel = buildModelPayload({
      modelId,
      displayName: providerDraft.displayName.trim() || modelId,
      description: providerDraft.kind === "relay" ? "中转站模型通道" : "官方模型通道",
      endpointType: providerDraft.endpointType.trim() || "openai_chat_completions",
      requestProfileId: providerDraft.requestProfileId.trim(),
      creditCost,
      priority: 0,
      weight: 1,
      isActive: true,
      color: providerDraft.color || "#3B82F6",
      colorSecondary: null,
      textColor: "white",
      maxCallsLimit: null,
      advancedEnabled: providerDraft.advancedEnabled,
      mixWithSameModel: false,
      qualityPricing,
    });

    let finalModels: any[] = [];
    if (providerDraft.isEditing && providerDraft.originalModels && providerDraft.originalModels.length > 0) {
      finalModels = providerDraft.originalModels.map((model, index) => {
        if (index === 0 || model.modelId === modelId) return { ...model, ...nextModel };
        return model;
      });
      if (!finalModels.some((model) => model.modelId === modelId)) finalModels.unshift(nextModel);
    } else {
      finalModels = [nextModel];
    }

    setSaving(true);
    try {
      const response = await kkWebApiClient.saveAdminCreditProvider(providerId, {
        providerName,
        baseUrl,
        providerKind: providerDraft.kind,
        apiKeys: providerDraft.apiKey.trim() ? [providerDraft.apiKey.trim()] : [],
        retainApiKeyFingerprints: providerDraft.isEditing ? (providerDraft.retainApiKeyFingerprints || []) : [],
        models: finalModels,
      } as any);

      if (!response.success) {
        setMessage(response.error?.message || "保存供应商失败，请稍后重试。");
        return;
      }

      setMessage(`${providerName} 已保存为管理员模型供应商。`);
      setProviderDraft(null);
      await refreshAdminProviders();
      await adminModelService.forceLoadAdminModels();
      await adminModelService.broadcastCatalogUpdate("admin-provider-saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存供应商失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePricing = async () => {
    if (!selectedProvider || !selectedModel) return;
    const providerDetail = adminProviders.find((provider) => provider.providerId === selectedProvider.providerId);
    if (!providerDetail) {
      setMessage("无法找到该供应商的管理员详情，请刷新后重试。");
      return;
    }

    const creditCost = normalizeCreditCost(draftCreditCost);
    setSaving(true);
    try {
      const response = await kkWebApiClient.saveAdminCreditProvider(providerDetail.providerId, {
        providerName: providerDetail.providerName,
        baseUrl: providerDetail.baseUrl,
        providerKind: providerDetail.providerKind || "relay",
        apiKeys: [],
        retainApiKeyFingerprints: (providerDetail.apiKeyEntries || []).map((entry) => entry.fingerprint).filter(Boolean),
        models: providerDetail.models.map((model) => {
          const isTarget = model.modelId === selectedModel.id;
          const nextPricing = normalizeAdminQualityPricing(draftQualityPricing, creditCost);
          const qualityPricing = isTarget ? nextPricing : normalizeAdminQualityPricing(model.qualityPricing, model.creditCost || 1);
          return buildModelPayload({
            modelId: model.modelId,
            displayName: model.displayName || model.modelId,
            description: model.description || "",
            endpointType: model.endpointType || selectedModel.endpoint || "openai_chat_completions",
            requestProfileId: model.requestProfileId || selectedModel.requestProfileId || "",
            creditCost: isTarget ? creditCost : model.creditCost || 1,
            priority: model.priority || 0,
            weight: model.weight || 1,
            isActive: model.isActive,
            color: model.color || selectedModel.colorStart || "#3B82F6",
            colorSecondary: model.colorSecondary || selectedModel.colorSecondary || null,
            textColor: model.textColor || "white",
            maxCallsLimit: model.maxCallsLimit || null,
            advancedEnabled: isTarget ? draftAdvancedPricingEnabled : Boolean(model.advancedEnabled),
            mixWithSameModel: Boolean(model.mixWithSameModel),
            qualityPricing,
          });
        }),
      } as any);

      if (!response.success) {
        setMessage(response.error?.message || "保存积分费用失败，请稍后重试。");
        return;
      }

      selectedModel.creditCost = creditCost;
      selectedModel.advancedEnabled = draftAdvancedPricingEnabled;
      selectedModel.qualityPricing = normalizeAdminQualityPricing(draftQualityPricing, creditCost);
      setProviders([...providers]);
      setMessage(`${selectedModel.displayName} 的基础积分费用已保存。`);
      await refreshAdminProviders();
      await adminModelService.broadcastCatalogUpdate("admin-pricing-saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存积分费用失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-api-nexus flex flex-col gap-6 w-full">
      <section className="admin-api-nexus__main">
        <div className="admin-api-nexus__header">
          <div>
            <h2>API 供应商配置</h2>
            <p>这里只添加供应商、选择预设 API、填写地址 / Key、模型 ID 和基础积分费用。</p>
          </div>
          <button type="button" onClick={() => void adminModelService.forceLoadAdminModels()}>
            <RefreshCw size={15} />
            <span>刷新</span>
          </button>
        </div>

        {message ? <div className="admin-api-nexus__message">{message}</div> : null}

        <div className="admin-api-nexus__provider-grid">
          {providers.filter((provider) => (provider.providerKind || "relay") === presetTab).map((provider) => (
            <div
              key={provider.providerId}
              className={`admin-api-nexus__provider-card ${selectedProvider?.providerId === provider.providerId ? "is-active" : ""}`}
              onClick={() => {
                setSelectedProviderId(provider.providerId);
                setSelectedModelId("");
              }}
              style={{ position: "relative" }}
            >
              <Globe size={18} />
              <strong>{provider.name}</strong>
              <span>{provider.models.length} 个模型</span>
              {selectedProvider?.providerId === provider.providerId && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleEditProvider(provider);
                  }}
                  className="admin-api-nexus__provider-card-edit"
                  title="修改供应商配置"
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    background: "transparent",
                    border: "none",
                    color: "#9ca3af",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "4px",
                  }}
                >
                  <Edit size={14} />
                </button>
              )}
            </div>
          ))}
          {!loading && providers.filter((provider) => (provider.providerKind || "relay") === presetTab).length === 0 ? (
            <div className="admin-api-nexus__empty">此分类下暂无已发布的模型供应商。先从右侧目录添加。</div>
          ) : null}
        </div>

        <div className="admin-api-nexus__model-grid">
          {(selectedProvider?.models || []).map((model) => (
            <button
              key={`${model.providerId}:${model.recordId || model.id}`}
              type="button"
              className={`admin-api-nexus__model-card ${selectedModel === model ? "is-active" : ""}`}
              onClick={() => setSelectedModelId(model.recordId || model.id)}
            >
              <span>{model.endpoint || "openai_chat_completions"}</span>
              <strong>{model.displayName}</strong>
              <small>{model.id}</small>
              <em>{model.creditCost || 1} 积分 / 次</em>
            </button>
          ))}
        </div>

        <div className="admin-api-nexus__pricing">
          <div>
            <h3>基础积分费用</h3>
            <p>{selectedModel ? `${selectedProvider?.name || selectedModel.providerName} · ${selectedModel.id}` : "选择一个模型后调整基础积分费用。"}</p>
          </div>
          <label>
            <span>每次调用积分</span>
            <input
              type="number"
              min={1}
              value={draftCreditCost}
              onChange={(event) => setDraftCreditCost(event.target.value)}
              disabled={!selectedModel || saving}
            />
          </label>
          <label>
            <span>图像档位计费</span>
            <input
              type="checkbox"
              checked={draftAdvancedPricingEnabled}
              onChange={(event) => handleAdvancedPricingToggle(event.target.checked)}
              disabled={!selectedModel || saving}
            />
          </label>
          <div className="admin-api-nexus__pricing-grid">
            {ADMIN_MODEL_QUALITY_KEYS.map((quality) => {
              const rule = draftQualityPricing[quality] || createDefaultAdminQualityPricing(normalizeCreditCost(draftCreditCost))[quality];
              return (
                <label key={quality}>
                  <span>{quality}</span>
                  <input
                    type="number"
                    min={1}
                    value={rule.creditCost}
                    onChange={(event) => handleQualityPricingChange(quality, { creditCost: event.target.value })}
                    disabled={!selectedModel || saving || !draftAdvancedPricingEnabled}
                  />
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(event) => handleQualityPricingChange(quality, { enabled: event.target.checked })}
                    disabled={!selectedModel || saving || !draftAdvancedPricingEnabled}
                    aria-label={`${quality} enabled`}
                  />
                </label>
              );
            })}
          </div>
          <button type="button" className="admin-api-nexus__save" disabled={!selectedModel || saving} onClick={handleSavePricing}>
            <Save size={15} />
            <span>{saving ? "保存中" : "保存积分费用"}</span>
          </button>
        </div>
      </section>

      <aside className="admin-api-nexus__directory w-full" style={{ width: "100%" }}>
        <div className="admin-api-nexus__tabs">
          <button type="button" className={presetTab === "official" ? "is-active" : ""} onClick={() => setPresetTab("official")}>
            <Shield size={14} />
            <span>官方</span>
          </button>
          <button type="button" className={presetTab === "relay" ? "is-active" : ""} onClick={() => setPresetTab("relay")}>
            <Globe size={14} />
            <span>中转站</span>
          </button>
        </div>
        <div className="admin-api-nexus__preset-list">
          {filteredPresets.map((preset) => (
            <div key={`${preset.kind}:${preset.name}`} className="admin-api-nexus__preset-row">
              <button type="button" onClick={() => handlePreset(preset)}>
                <Plus size={18} />
              </button>
              <span className="admin-api-nexus__dot" style={{ backgroundColor: preset.color }} />
              <div>
                <strong>{preset.name}</strong>
                <small>{parseHost(preset.baseUrl)} · {preset.modelId}</small>
                {preset.note ? <small>{preset.note}</small> : null}
              </div>
              <a
                href={preset.website}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-api-nexus__preset-row-link"
                style={{ color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                onClick={(event) => {
                  event.preventDefault();
                  safeOpenLink(preset.website);
                }}
              >
                <ExternalLink size={16} />
              </a>
            </div>
          ))}
          <button type="button" className="admin-api-nexus__custom-row" onClick={handleCreateCustomDraft}>
            <Box size={18} />
            <div>
              <strong>自定义供应商</strong>
              <small>默认按 OpenAI 兼容协议；填写 Base URL、模型 ID、Key 和积分费用</small>
            </div>
          </button>
        </div>
        {providerDraft ? (
          <div className="admin-api-nexus__draft" data-testid="admin-api-provider-draft">
            <div>
              <strong>{providerDraft.isEditing ? "修改供应商配置" : "供应商草稿"}</strong>
              <small>{providerDraft.isEditing ? "正在编辑已有供应商通道" : `${providerDraft.kind === "relay" ? "中转站" : "官方"} · 保存后进入模型积分池`}</small>
            </div>
            <label>
              <span>名称</span>
              <input
                value={providerDraft.providerName}
                onChange={(event) => {
                  const updatedName = event.target.value;
                  const patch: Partial<AdminProviderDraft> = { providerName: updatedName };
                  if (!providerDraft.isEditing) patch.providerId = buildProviderId(updatedName, providerDraft.baseUrl);
                  handleDraftChange(patch);
                }}
              />
            </label>
            <label>
              <span>Base URL</span>
              <input
                value={providerDraft.baseUrl}
                onChange={(event) => {
                  const updatedUrl = event.target.value;
                  const patch: Partial<AdminProviderDraft> = { baseUrl: updatedUrl };
                  if (!providerDraft.isEditing) patch.providerId = buildProviderId(providerDraft.providerName, updatedUrl);
                  handleDraftChange(patch);
                }}
              />
            </label>
            <label>
              <span>模型 ID</span>
              <input value={providerDraft.modelId} onChange={(event) => handleDraftChange({ modelId: event.target.value, displayName: event.target.value })} />
            </label>
            <label>
              <span>API Key</span>
              <input type="password" value={providerDraft.apiKey} onChange={(event) => handleDraftChange({ apiKey: event.target.value })} placeholder="可稍后补充" />
            </label>
            <label>
              <span>每次调用积分</span>
              <input
                type="number"
                min={1}
                value={providerDraft.creditCost}
                onChange={(event) => {
                  handleDraftChange({ creditCost: event.target.value });
                  setDraftCreditCost(event.target.value);
                }}
                disabled={saving}
              />
            </label>
            <small>协议预设：{providerDraft.requestProfileId || "generic-openai-compatible"} · {providerDraft.endpointType}</small>
            <button type="button" className="admin-api-nexus__save" disabled={saving} onClick={handleSaveDraftProvider}>
              <Save size={15} />
              <span>{saving ? "保存中" : (providerDraft.isEditing ? "保存修改" : "保存供应商")}</span>
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
};
