// 职责：管理员维护供应商、模型和积分参数，入口形态与用户 API 设置保持一致。

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, ExternalLink, Globe, Plus, RefreshCw, Save, Shield } from "lucide-react";
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
  color: string;
  website: string;
};

const ADMIN_API_PRESETS: AdminApiPreset[] = [
  { name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", modelId: "gemini-2.5-flash-image", kind: "official", endpointType: "openai", color: "#4285f4", website: "https://gemini.google.com" },
  { name: "OpenAI", baseUrl: "https://api.openai.com/v1", modelId: "gpt-4o", kind: "official", endpointType: "openai", color: "#10a37f", website: "https://openai.com" },
  { name: "Anthropic Claude", baseUrl: "https://api.anthropic.com", modelId: "claude-3-5-sonnet-latest", kind: "official", endpointType: "claude", color: "#d97706", website: "https://www.anthropic.com" },
  { name: "DeepSeek", baseUrl: "https://api.deepseek.com", modelId: "deepseek-chat", kind: "official", endpointType: "openai", color: "#2563eb", website: "https://www.deepseek.com" },
  { name: "Qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", modelId: "qwen-plus", kind: "official", endpointType: "openai", color: "#7c3aed", website: "https://chat.qwen.ai" },
  { name: "Kimi", baseUrl: "https://api.moonshot.cn/v1", modelId: "moonshot-v1-128k", kind: "official", endpointType: "openai", color: "#111827", website: "https://www.kimi.com" },
  { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", modelId: "openai/gpt-4o", kind: "relay", endpointType: "openai", color: "#7c3aed", website: "https://openrouter.ai" },
  { name: "WorldRouter", baseUrl: "https://inference-api.worldrouter.ai/v1", modelId: "openai/gpt-4o", kind: "relay", endpointType: "openai", color: "#0891b2", website: "https://www.worldrouter.ai" },
  { name: "SiliconFlow", baseUrl: "https://api.siliconflow.cn/v1", modelId: "Qwen/Qwen3-235B-A22B-Instruct-2507", kind: "relay", endpointType: "openai", color: "#ff5a00", website: "https://siliconflow.cn" },
  { name: "B.ai", baseUrl: "https://api.theb.ai/v1", modelId: "gpt-4o", kind: "relay", endpointType: "openai", color: "#0f172a", website: "https://b.ai" },
];

type AdminProviderDraft = {
  providerId: string;
  providerName: string;
  baseUrl: string;
  modelId: string;
  displayName: string;
  endpointType: string;
  apiKey: string;
  color: string;
  kind: AdminPresetKind;
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
  endpointType: "openai",
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
  providerKind: provider.providerKind || 'relay',
  apiKeys: [],
  retainApiKeyFingerprints: (provider.apiKeyEntries || []).map((entry) => entry.fingerprint).filter(Boolean),
  models: provider.models.map((model) => {
    const isTarget = model.modelId === selectedModel.id;
    const qualityPricing = isTarget ? nextPricing : model.qualityPricing || createDefaultAdminQualityPricing(model.creditCost || 1);

    return {
      modelId: model.modelId,
      displayName: model.displayName || model.modelId,
      description: model.description || "",
      endpointType: model.endpointType || selectedModel.endpoint || "openai",
      creditCost: isTarget ? nextPricing["1K"].creditCost : Math.max(1, Number(model.creditCost || 1)),
      advancedEnabled: isTarget ? true : Boolean(model.advancedEnabled),
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
    setMessage(`${preset.name} 已载入为管理员供应商草稿。补充 API Key 和积分档位后即可保存。`);
  };

  const handleCreateCustomDraft = () => {
    setProviderDraft(createEmptyDraft());
    setDraftPricing(toDraftPricing(undefined, 1));
    setMessage("自定义供应商草稿已创建。填写 Base URL、模型 ID 和积分档位后保存。");
  };

  const handleDraftChange = (patch: Partial<AdminProviderDraft>) => {
    setProviderDraft((current) => current ? { ...current, ...patch } : current);
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

    const nextPricing = ADMIN_MODEL_QUALITY_KEYS.reduce((pricing, key) => {
      pricing[key] = {
        enabled: true,
        creditCost: normalizeCreditCost(draftPricing[key]),
      };
      return pricing;
    }, {} as AdminModelQualityPricing);
    const providerId = buildProviderId(providerName, baseUrl);

    setSaving(true);
    try {
      const response = await kkWebApiClient.saveAdminCreditProvider(providerId, {
        providerName,
        baseUrl,
        providerKind: providerDraft.kind,
        apiKeys: providerDraft.apiKey.trim() ? [providerDraft.apiKey.trim()] : [],
        retainApiKeyFingerprints: [],
        models: [{
          modelId,
          displayName: providerDraft.displayName.trim() || modelId,
          description: providerDraft.kind === "relay" ? "中转站模型通道" : "官方模型通道",
          endpointType: providerDraft.endpointType.trim() || "openai",
          creditCost: nextPricing["1K"].creditCost,
          advancedEnabled: true,
          mixWithSameModel: false,
          qualityPricing: nextPricing,
          priority: 0,
          weight: 0,
          isActive: true,
          color: providerDraft.color || "#3B82F6",
          colorSecondary: null,
          textColor: "white",
          maxCallsLimit: null,
        }],
      });

      if (!response.success) {
        setMessage(response.error?.message || "保存供应商草稿失败，请稍后重试。");
        return;
      }

      setMessage(`${providerName} 已保存为管理员模型供应商。`);
      setProviderDraft(null);
      await refreshAdminProviders();
      await adminModelService.forceLoadAdminModels();
      await adminModelService.broadcastCatalogUpdate("admin-provider-saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存供应商草稿失败，请稍后重试。");
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

    const nextPricing = ADMIN_MODEL_QUALITY_KEYS.reduce((pricing, key) => {
      pricing[key] = {
        enabled: true,
        creditCost: normalizeCreditCost(draftPricing[key]),
      };
      return pricing;
    }, {} as AdminModelQualityPricing);

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

      selectedModel.advancedEnabled = true;
      selectedModel.qualityPricing = nextPricing;
      selectedModel.creditCost = nextPricing["1K"].creditCost;
      setProviders([...providers]);
      setMessage(`${selectedModel.displayName} 的积分参数已保存到管理员模型配置。`);
      await refreshAdminProviders();
      await adminModelService.broadcastCatalogUpdate("admin-pricing-saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存积分参数失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-api-nexus">
      <section className="admin-api-nexus__main">
        <div className="admin-api-nexus__header">
          <div>
            <h2>API 供应商与模型积分</h2>
            <p>官方和中转站入口与用户侧保持一致；管理员在这里维护模型对应的积分参数。</p>
          </div>
          <button type="button" onClick={() => void adminModelService.forceLoadAdminModels()}>
            <RefreshCw size={15} />
            <span>刷新</span>
          </button>
        </div>

        {message ? <div className="admin-api-nexus__message">{message}</div> : null}

        <div className="admin-api-nexus__provider-grid">
          {providers.filter((p) => (p.providerKind || "relay") === presetTab).map((provider) => (
            <button
              key={provider.providerId}
              type="button"
              className={`admin-api-nexus__provider-card ${selectedProvider?.providerId === provider.providerId ? "is-active" : ""}`}
              onClick={() => {
                setSelectedProviderId(provider.providerId);
                setSelectedModelId("");
              }}
            >
              <Globe size={18} />
              <strong>{provider.name}</strong>
              <span>{provider.models.length} 个模型</span>
            </button>
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
              <span>{model.endpoint || "openai"}</span>
              <strong>{model.displayName}</strong>
              <small>{model.id}</small>
              <em>{formatPricingSummary(model.qualityPricing, model.creditCost)}</em>
            </button>
          ))}
        </div>

        <div className="admin-api-nexus__pricing">
          <div>
            <h3>积分档位</h3>
            <p>{selectedModel ? `${selectedProvider?.name || selectedModel.providerName} · ${selectedModel.id}` : "选择一个模型后调整不同参数档位的积分。"}</p>
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
            <span>{saving ? "保存中" : "保存积分参数"}</span>
          </button>
        </div>
      </section>

      <aside className="admin-api-nexus__directory">
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
              </div>
              <a
                href={preset.website}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-api-nexus__preset-row-link"
                style={{ color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                <ExternalLink size={16} />
              </a>
            </div>
          ))}
          <button type="button" className="admin-api-nexus__custom-row" onClick={handleCreateCustomDraft}>
            <Box size={18} />
            <div>
              <strong>自定义供应商</strong>
              <small>填写 Base URL、模型 ID 和积分参数</small>
            </div>
          </button>
        </div>
        {providerDraft ? (
          <div className="admin-api-nexus__draft" data-testid="admin-api-provider-draft">
            <div>
              <strong>供应商草稿</strong>
              <small>{providerDraft.kind === "relay" ? "中转站" : "官方"} · 保存后进入模型积分池</small>
            </div>
            <label>
              <span>名称</span>
              <input value={providerDraft.providerName} onChange={(event) => handleDraftChange({ providerName: event.target.value })} />
            </label>
            <label>
              <span>Base URL</span>
              <input value={providerDraft.baseUrl} onChange={(event) => handleDraftChange({ baseUrl: event.target.value, providerId: buildProviderId(providerDraft.providerName, event.target.value) })} />
            </label>
            <label>
              <span>模型 ID</span>
              <input value={providerDraft.modelId} onChange={(event) => handleDraftChange({ modelId: event.target.value, displayName: event.target.value })} />
            </label>
            <label>
              <span>API Key</span>
              <input type="password" value={providerDraft.apiKey} onChange={(event) => handleDraftChange({ apiKey: event.target.value })} placeholder="可稍后补充" />
            </label>
            <button type="button" className="admin-api-nexus__save" disabled={saving} onClick={handleSaveDraftProvider}>
              <Save size={15} />
              <span>{saving ? "保存中" : "保存草稿"}</span>
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
};
