// 职责：管理员维护供应商、预设 API、Key 和基础模型积分；高级能力开关迁移到 AI 管理页面。

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Edit, ExternalLink, Globe, Plus, RefreshCw, Save, Shield } from "lucide-react";
import type {
  AdminCreditProviderDto,
  SaveAdminCreditProviderRequestDto,
} from "../../../../../packages/shared/src/index.ts";
import { kkWebApiClient } from "../../services/api/kkApiClient.ts";
import {
  ADMIN_MODEL_QUALITY_KEYS,
  createDefaultAdminQualityPricing,
  type AdminModelQualityKey,
  type AdminModelQualityPricing,
} from "../../services/model/adminModelQuality.ts";
import {
  adminModelService,
  type AdminModelConfig,
  type AdminProvider,
} from "../../services/model/adminModelService.ts";
import { safeOpenLink } from "../../utils/browserUtils";

type AdminPresetKind = "official" | "relay";
type DraftPricing = Record<AdminModelQualityKey, string>;

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
    note: "APIMart 返回 { code, data } 包装结构，必须使用专用 adapter。",
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
    note: "12AI 独立多协议预设，按模型自动走 OpenAI Chat / Claude Messages / Gemini Generate Content。",
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
    note: "Wuyin 必须按每个模型文档执行；图片/视频/音频/工具由后端 strict router 接管。",
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
  isEditing?: boolean;
  originalModels?: any[];
  retainApiKeyFingerprints?: string[];
};

const toDraftPricing = (pricing?: AdminModelQualityPricing, fallbackCost = 1): DraftPricing => {
  const normalized = pricing || createDefaultAdminQualityPricing(fallbackCost);
  return ADMIN_MODEL_QUALITY_KEYS.reduce((draft, key) => {
    draft[key] = String(normalized[key]?.creditCost || 1);
    return draft;
  }, {} as DraftPricing);
};

const parseHost = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const formatPricingSummary = (pricing?: AdminModelQualityPricing, fallbackCost = 1): string => {
  const normalized = pricing || createDefaultAdminQualityPricing(fallbackCost);
  return `1K ${normalized["1K"]?.creditCost || 1} 分 · 4K ${normalized["4K"]?.creditCost || 1} 分`;
};

const normalizeCreditCost = (value: string): number => {
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
});

const buildSavePayload = (
  provider: AdminCreditProviderDto,
  selectedModel: AdminModelConfig,
  nextPricing: AdminModelQualityPricing,
): SaveAdminCreditProviderRequestDto => ({
  providerName: provider.providerName,
  baseUrl: provider.baseUrl,
  providerKind: provider.providerKind || "relay",
  apiKeys: [],
  retainApiKeyFingerprints: (provider.apiKeyEntries || []).map((entry) => entry.fingerprint).filter(Boolean),
  models: provider.models.map((model) => {
    const isTarget = model.modelId === selectedModel.id;
    const qualityPricing = isTarget ? nextPricing : model.qualityPricing || createDefaultAdminQualityPricing(model.creditCost || 1);

    return {
      modelId: model.modelId,
      displayName: model.displayName || model.modelId,
      description: model.description || "",
      endpointType: model.endpointType || selectedModel.endpoint || "openai_chat_completions",
      requestProfileId: model.requestProfileId || selectedModel.requestProfileId || "",
      creditCost: isTarget ? nextPricing["1K"].creditCost : Math.max(1, Number(model.creditCost || 1)),
      advancedEnabled: Boolean(model.advancedEnabled),
      mixWithSameModel: Boolean(model.mixWithSameModel),
      qualityPricing,
      priority: Number(model.priority || 0),
      weight: Number(model.weight || 0),
      isActive: model.isActive !== false,
      color: model.color || selectedModel.colorStart || "#3B82F6",
      colorSecondary: model.colorSecondary || selectedModel.colorSecondary || null,
      textColor: model.textColor === "black" ? "black" : "white",
      maxCallsLimit: model.maxCallsLimit ?? null,
    };
  }),
});

export const ApiConfigPanel: React.FC = () => {
  const [presetTab, setPresetTab] = useState<AdminPresetKind>("official");
  const [providers, setProviders] = useState<AdminProvider[]>(() => adminModelService.getProviders());
  const [adminProviders, setAdminProviders] = useState<AdminCreditProviderDto[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [providerDraft, setProviderDraft] = useState<AdminProviderDraft | null>(null);
  const [draftPricing, setDraftPricing] = useState<DraftPricing>(() => toDraftPricing());
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
    if (!selectedProvider && providers[0]) {
      setSelectedProviderId(providers[0].providerId);
    }
  }, [providers, selectedProvider]);

  useEffect(() => {
    if (!selectedModel) return;
    setDraftPricing(toDraftPricing(selectedModel.qualityPricing, selectedModel.creditCost));
  }, [selectedModel]);

  const filteredPresets = ADMIN_API_PRESETS.filter((preset) => preset.kind === presetTab);

  const handlePreset = (preset: AdminApiPreset) => {
    setProviderDraft(createDraftFromPreset(preset));
    setDraftPricing(toDraftPricing(undefined, 1));
    setMessage(`${preset.name} 已载入。填写 API Key 和模型积分费用后即可保存。`);
  };

  const handleCreateCustomDraft = () => {
    setProviderDraft(createEmptyDraft());
    setDraftPricing(toDraftPricing(undefined, 1));
    setMessage("自定义供应商草稿已创建。填写 Base URL、模型 ID、API Key 和积分费用后保存。");
  };

  const handleEditProvider = (provider: AdminProvider) => {
    const providerDetail = adminProviders.find((p) => p.providerId === provider.providerId);
    const baseUrl = providerDetail?.baseUrl || "";
    const providerKind = provider.providerKind || providerDetail?.providerKind || "relay";

    const firstModel = provider.models[0];
    const modelId = firstModel?.id || "";
    const displayName = firstModel?.displayName || "";
    const endpointType = firstModel?.endpoint || "openai_chat_completions";
    const requestProfileId = firstModel?.requestProfileId || providerDetail?.models[0]?.requestProfileId || "";
    const color = firstModel?.colorStart || "#3B82F6";

    const modelsForDraft = providerDetail ? providerDetail.models.map(m => ({
      modelId: m.modelId,
      displayName: m.displayName || m.modelId,
      description: m.description || "",
      endpointType: m.endpointType || "openai_chat_completions",
      requestProfileId: m.requestProfileId || "",
      creditCost: m.creditCost,
      advancedEnabled: m.advancedEnabled,
      mixWithSameModel: m.mixWithSameModel,
      qualityPricing: m.qualityPricing || createDefaultAdminQualityPricing(m.creditCost || 1),
      priority: m.priority,
      weight: m.weight,
      isActive: m.isActive,
      color: m.color || "#3B82F6",
      colorSecondary: m.colorSecondary || null,
      textColor: m.textColor || "white",
      maxCallsLimit: m.maxCallsLimit || null,
    })) : [];

    setProviderDraft({
      providerId: provider.providerId,
      providerName: provider.name,
      baseUrl,
      modelId,
      displayName,
      endpointType,
      requestProfileId,
      apiKey: "",
      color,
      kind: providerKind,
      isEditing: true,
      originalModels: modelsForDraft,
      retainApiKeyFingerprints: (providerDetail?.apiKeyEntries || []).map((entry) => entry.fingerprint).filter(Boolean),
    });
    setDraftPricing(toDraftPricing(firstModel?.qualityPricing, firstModel?.creditCost || 1));
    setMessage(`已载入供应商 ${provider.name} 的配置以供修改。`);
  };

  const handleDraftChange = (patch: Partial<AdminProviderDraft>) => {
    setProviderDraft((current) => current ? { ...current, ...patch } : current);
  };

  const buildDraftPricing = (): AdminModelQualityPricing => ADMIN_MODEL_QUALITY_KEYS.reduce((pricing, key) => {
    pricing[key] = {
      enabled: true,
      creditCost: normalizeCreditCost(draftPricing[key]),
    };
    return pricing;
  }, {} as AdminModelQualityPricing);

  const handleSaveDraftProvider = async () => {
    if (!providerDraft) return;
    const providerName = providerDraft.providerName.trim();
    const baseUrl = providerDraft.baseUrl.trim();
    const modelId = providerDraft.modelId.trim();
    if (!providerName || !baseUrl || !modelId) {
      setMessage("供应商名称、Base URL 和模型 ID 都必须填写。");
      return;
    }

    const nextPricing = buildDraftPricing();
    const providerId = providerDraft.isEditing && providerDraft.providerId
      ? providerDraft.providerId
      : buildProviderId(providerName, baseUrl);

    const nextModel = {
      modelId,
      displayName: providerDraft.displayName.trim() || modelId,
      description: providerDraft.kind === "relay" ? "中转站模型通道" : "官方模型通道",
      endpointType: providerDraft.endpointType.trim() || "openai_chat_completions",
      requestProfileId: providerDraft.requestProfileId.trim(),
      creditCost: nextPricing["1K"].creditCost,
      advancedEnabled: false,
      mixWithSameModel: false,
      qualityPricing: nextPricing,
      priority: 0,
      weight: 1,
      isActive: true,
      color: providerDraft.color || "#3B82F6",
      colorSecondary: null,
      textColor: "white" as const,
      maxCallsLimit: null,
    };

    let finalModels: any[] = [];
    if (providerDraft.isEditing && providerDraft.originalModels && providerDraft.originalModels.length > 0) {
      finalModels = providerDraft.originalModels.map((m, index) => {
        if (index === 0 || m.modelId === providerDraft.modelId) {
          return { ...m, ...nextModel };
        }
        return m;
      });
      if (!finalModels.some(m => m.modelId === modelId)) {
        finalModels.unshift(nextModel);
      }
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
      });

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

    const targetModel = providerDetail.models.find((model) => model.modelId === selectedModel.id);
    if (!targetModel) {
      setMessage("无法找到该模型的管理员详情，请刷新后重试。");
      return;
    }

    const nextPricing = buildDraftPricing();

    setSaving(true);
    try {
      const response = await kkWebApiClient.saveAdminCreditProvider(
        providerDetail.providerId,
        buildSavePayload(providerDetail, selectedModel, nextPricing),
      );

      if (!response.success) {
        setMessage(response.error?.message || "保存积分参数失败，请稍后重试。");
        return;
      }

      selectedModel.qualityPricing = nextPricing;
      selectedModel.creditCost = nextPricing["1K"].creditCost;
      setProviders([...providers]);
      setMessage(`${selectedModel.displayName} 的积分费用已保存到供应商配置。`);
      await refreshAdminProviders();
      await adminModelService.broadcastCatalogUpdate("admin-pricing-saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存积分参数失败，请稍后重试。");
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
            <p>这里只添加供应商、选择预设 API、填写地址 / Key，并维护基础模型积分费用；高级能力到 AI 管理页面配置。</p>
          </div>
          <button type="button" onClick={() => void adminModelService.forceLoadAdminModels()}>
            <RefreshCw size={15} />
            <span>刷新</span>
          </button>
        </div>

        {message ? <div className="admin-api-nexus__message">{message}</div> : null}

        <div className="admin-api-nexus__provider-grid">
          {providers.filter((p) => (p.providerKind || "relay") === presetTab).map((provider) => (
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
                  onClick={(e) => {
                    e.stopPropagation();
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
          {!loading && providers.filter((p) => (p.providerKind || "relay") === presetTab).length === 0 ? (
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
              <em>{formatPricingSummary(model.qualityPricing, model.creditCost)}</em>
            </button>
          ))}
        </div>

        <div className="admin-api-nexus__pricing">
          <div>
            <h3>模型积分费用</h3>
            <p>{selectedModel ? `${selectedProvider?.name || selectedModel.providerName} · ${selectedModel.id}` : "选择一个模型后调整供应商基础积分费用。"}</p>
          </div>
          <div className="admin-api-nexus__pricing-grid">
            {ADMIN_MODEL_QUALITY_KEYS.map((key) => (
              <label key={key}>
                <span>{key}</span>
                <input
                  type="number"
                  min={1}
                  value={draftPricing[key]}
                  onChange={(event) => setDraftPricing((current) => ({ ...current, [key]: event.target.value }))}
                  disabled={!selectedModel || saving}
                />
              </label>
            ))}
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
            <div className="admin-api-nexus__pricing-grid">
              {ADMIN_MODEL_QUALITY_KEYS.map((key) => (
                <label key={key}>
                  <span>{key} 积分</span>
                  <input
                    type="number"
                    min={1}
                    value={draftPricing[key]}
                    onChange={(event) => setDraftPricing((current) => ({ ...current, [key]: event.target.value }))}
                    disabled={saving}
                  />
                </label>
              ))}
            </div>
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
