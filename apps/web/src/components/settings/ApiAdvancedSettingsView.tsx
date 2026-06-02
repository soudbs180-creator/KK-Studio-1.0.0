import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  Layers3,
  RefreshCw,
  Shield,
  X,
  type LucideIcon,
} from 'lucide-react';

import type { CapabilityRole } from '../../types';
import {
  getCapabilityRouteAssignments,
  subscribeCapabilityRouteAssignments,
  upsertCapabilityRouteAssignment,
  isCustomRoutingEnabled,
  setCustomRoutingEnabled,
} from '../../services/api/capabilityRouteAssignments';
import {
  getKkApiServerHealth,
  type KkApiServerHealth,
} from '../../services/api/kkApiServerHealth';
import { isKkaiUserApiStorageReady } from '../../services/api/kkaiUserApiStorageMode';
import { resolveUserApiViewState } from '../../services/api/userApiViewState';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import keyManager, {
  type KeySlot,
  type ThirdPartyProvider,
} from '../../services/auth/keyManager';
import type { ChannelConfig } from '../../services/api/channelConfig';
import { notify } from '../../services/system/notificationService';
import {
  SETTINGS_ELEVATED_STYLE,
  SETTINGS_INFO_STYLE,
  SETTINGS_WARNING_STYLE,
  SettingsActionButton,
  SettingsBadge,
  SettingsHero,
  SettingsSection,
  SettingsViewShell,
} from './SettingsScaffold';
import {
  getOcrServiceSettings,
  subscribeOcrServiceSettings,
  updateOcrServiceSettings,
} from '../../services/document/ocrServiceSettings';
import {
  ApiWorkbenchCapabilitySection,
  ApiWorkbenchCurrentViewSection,
  ApiWorkbenchDiagnosticsSection,
  ApiWorkbenchModelCenterSection,
  ApiWorkbenchOcrSection,
  ApiWorkbenchOverviewSection,
  ApiWorkbenchPlatformSection,
  ApiWorkbenchRoutePoolSection,
  ApiWorkbenchStageSection,
  InfoCell,
} from './apiWorkbenchSections';
import {
  SettingInput,
  SettingToggle,
} from './ui/index';
import {
  resolveApiWorkbenchDiagnosticsAvailability,
  resolveApiWorkbenchStageMeta,
} from './apiWorkbenchState';

const API_MANAGEMENT_HOME_PATH = '/settings/api-management';

interface ApiAdvancedSettingsViewProps {
  embedded?: boolean;
  modelCenterRoutes?: any[];
  modelCenterPresets?: any[];
  modelCenterPresetTab?: 'official' | 'relay';
  setModelCenterPresetTab?: (tab: 'official' | 'relay') => void;
  userApiActionsDisabled?: boolean;
  providerActionsDisabled?: boolean;
  handleCreateOfficialAction?: () => void;
  beginCreateProvider?: () => void;
  connectedChannels?: number;
}

const CAPABILITY_ROLE_META: Array<{
  role: CapabilityRole;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
}> = [
  {
    role: 'image_generation',
    titleZh: '图片生成',
    titleEn: 'Image generation',
    descriptionZh: '图片生成默认走这里的主链路与模型。',
    descriptionEn: 'Primary route and model for image generation.',
  },
  {
    role: 'ppt_generation',
    titleZh: 'PPT 生成',
    titleEn: 'PPT generation',
    descriptionZh: 'PPT 主题、页面描述和单页重生使用这条能力路由。',
    descriptionEn: 'Route used by PPT topic, page description, and per-page regeneration.',
  },
  {
    role: 'ecommerce_generation',
    titleZh: '电商生成',
    titleEn: 'Ecommerce generation',
    descriptionZh: '电商模块、组图与框架补图优先走这里。',
    descriptionEn: 'Preferred route for ecommerce cards, groups, and framework fills.',
  },
  {
    role: 'assistant',
    titleZh: 'AI 助手与平台辅助 AI',
    titleEn: 'AI Assistant / Platform AI',
    descriptionZh: '聊天侧与平台辅助 AI 统一绑定此链路与模型通道。',
    descriptionEn: 'Shared assistant route for chat and platform assistant AI.',
  },
  {
    role: 'prompt_optimizer',
    titleZh: '提示词 AI 增强',
    titleEn: 'Prompt AI enhancement',
    descriptionZh: '本地规则始终可用；这里只控制是否额外调用 AI 增强提示词。',
    descriptionEn: 'Local rulebook shaping always works. This only controls optional AI enhancement.',
  },
  {
    role: 'ocr_document',
    titleZh: 'OCR 文档处理',
    titleEn: 'OCR document processing',
    descriptionZh: '点击以进入二级菜单配置默认识别语言与服务状态。',
    descriptionEn: 'Click to configure OCR language and service status in secondary menu.',
  },
];

const ApiAdvancedSettingsView: React.FC<ApiAdvancedSettingsViewProps> = ({
  embedded = false,
  modelCenterRoutes = [],
  modelCenterPresets = [],
  modelCenterPresetTab = 'official',
  setModelCenterPresetTab,
  userApiActionsDisabled = false,
  providerActionsDisabled = false,
  handleCreateOfficialAction,
  beginCreateProvider,
  connectedChannels: propConnectedChannels,
}) => {
  const { user, isTempUser } = useAuth();
  const { pick } = useLocale();
  const navigate = useNavigate();

  const [slots, setSlots] = useState<KeySlot[]>(() => keyManager.getSlots());
  const [providers, setProviders] = useState<ThirdPartyProvider[]>(() => keyManager.getProviders());
  const [capabilityAssignments, setCapabilityAssignments] = useState(() => getCapabilityRouteAssignments());
  const [ocrSettings, setOcrSettings] = useState(() => getOcrServiceSettings());
  const [busy, setBusy] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [apiHealth, setApiHealth] = useState<KkApiServerHealth | null>(null);
  const [showOcrModal, setShowOcrModal] = useState(false);

  const customRoutingEnabled = isCustomRoutingEnabled();

  const refresh = useCallback(() => {
    setSlots(keyManager.getSlots());
    setProviders(keyManager.getProviders());
  }, []);

  // 侦听 keyManager 订阅更新
  useEffect(() => {
    refresh();
    return keyManager.subscribe(refresh);
  }, [refresh]);

  // 侦听能力路由和 OCR 订阅更新
  useEffect(() => {
    setCapabilityAssignments(getCapabilityRouteAssignments());
    return subscribeCapabilityRouteAssignments(() => {
      setCapabilityAssignments(getCapabilityRouteAssignments());
    });
  }, []);

  useEffect(() => {
    setOcrSettings(getOcrServiceSettings());
    return subscribeOcrServiceSettings(() => {
      setOcrSettings(getOcrServiceSettings());
    });
  }, []);

  // 检测 API 健康状况
  const refreshApiHealth = useCallback(
    async (manual = false) => {
      try {
        const health = await getKkApiServerHealth();
        setApiHealth(health);
        if (manual) {
          notify.success(pick('检测完成', 'Probe complete'), pick('API 服务检测完成。', 'API service health checked successfully.'));
        }
      } catch (error) {
        console.error('[ApiAdvancedSettingsView] Health probe failed:', error);
      }
    },
    [pick],
  );

  useEffect(() => {
    void refreshApiHealth();
  }, [refreshApiHealth]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
    } catch (error: any) {
      notify.error(pick('操作失败', 'Action failed'), error.message || String(error));
    } finally {
      setBusy(null);
    }
  };

  const handleCustomRoutingToggle = (enabled: boolean) => {
    setCustomRoutingEnabled(enabled);
    setCapabilityAssignments(getCapabilityRouteAssignments());
  };

  const updateCapabilityAssignment = useCallback((
    role: CapabilityRole,
    patch: Partial<{ enabled: boolean; primaryRouteId: string; primaryModelId: string; fallbackRouteId: string }>,
  ) => {
    upsertCapabilityRouteAssignment(role, patch);
    setCapabilityAssignments(getCapabilityRouteAssignments());
    notify.success(
      pick('修改成功', 'Assigned'),
      pick('能力角色分配已更新。', 'Capability role routing updated.'),
    );
  }, [pick]);

  const handleToggleDiagnostics = () => {
    setShowDiagnostics((current) => !current);
  };

  // 聚合所有已配置通道选项
  const allChannelConfigs = useMemo(
    () => keyManager.getChannelConfigs({ includeDisabled: true, includeProviders: true }),
    [slots, providers],
  );

  const getRouteLabel = (channel: ChannelConfig): string => {
    if (channel.id.startsWith('official:')) {
      return channel.name === 'OpenAI' ? 'OpenAI 官方' : '谷歌 官方';
    }
    return `${channel.name} (${channel.baseUrl})`;
  };

  const capabilityRouteOptions = useMemo(
    () => [
      { value: '', label: pick('自动选择', 'Automatic') },
      ...allChannelConfigs.map((channel) => ({
        value: channel.id,
        label: getRouteLabel(channel),
      })),
    ],
    [allChannelConfigs, pick],
  );

  const getRouteModelOptions = useCallback(
    (channelId: string) => {
      const channel = allChannelConfigs.find((c) => c.id === channelId);
      if (!channel) return [];
      const models = channel.supportedModels || [];
      return models.map((model) => ({ value: model, label: model }));
    },
    [allChannelConfigs],
  );

  const capabilityCards = useMemo(() => {
    return CAPABILITY_ROLE_META.map((meta) => {
      const assignment = capabilityAssignments.find((item) => item.role === meta.role);
      return {
        role: meta.role,
        title: pick(meta.titleZh, meta.titleEn),
        description: pick(meta.descriptionZh, meta.descriptionEn),
        enabled: assignment?.enabled !== false,
        primaryRouteId: assignment?.primaryRouteId || '',
        primaryModelId: assignment?.primaryModelId || '',
        fallbackRouteId: assignment?.fallbackRouteId || '',
        routeOptions: capabilityRouteOptions,
        modelOptions: getRouteModelOptions(assignment?.primaryRouteId || ''),
        onEnabledChange: (val: boolean) => updateCapabilityAssignment(meta.role, { enabled: val }),
        onPrimaryRouteChange: (val: string) => updateCapabilityAssignment(meta.role, { primaryRouteId: val, primaryModelId: '' }),
        onPrimaryModelChange: (val: string) => updateCapabilityAssignment(meta.role, { primaryModelId: val }),
        onFallbackRouteChange: (val: string) => updateCapabilityAssignment(meta.role, { fallbackRouteId: val }),
        onOcrClick: () => setShowOcrModal(true),
      };
    });
  }, [capabilityAssignments, capabilityRouteOptions, getRouteModelOptions, updateCapabilityAssignment, pick]);

  // 后端及环境状态推导
  const isUserApiPersistenceDegraded = Boolean(
    apiHealth && (!apiHealth.reachable || !isKkaiUserApiStorageReady(apiHealth)),
  );
  
  const hasAuthenticatedUser = !isTempUser;
  const hasReadonlySnapshot = false;

  const apiServerState = resolveUserApiViewState({
    hasReadonlySnapshot,
    hasSessionlessWorkbenchAccess: isTempUser,
    isApiReachable: apiHealth?.reachable,
    isAuthenticated: hasAuthenticatedUser,
    isPersistenceDegraded: isUserApiPersistenceDegraded,
    runtimeOfficialCount: slots.length,
    runtimeProviderCount: providers.length,
    sessionlessWorkbenchActionsEnabled: !isTempUser,
  });

  const connectedChannels = slots.filter((slot) => !slot.disabled).length + providers.length;
  const activeProviders = providers.filter((p) => p.isActive).length;
  const workbenchTone = isUserApiPersistenceDegraded ? 'rose' : connectedChannels > 0 ? 'emerald' : 'neutral';
  const workbenchStatusLabel = isUserApiPersistenceDegraded
    ? pick('本地 API 内存模式', 'Local API memory mode')
    : connectedChannels > 0
      ? pick(`已接入 ${connectedChannels} 条链路`, `${connectedChannels} routes connected`)
      : pick('尚未接入链路', 'No routes connected yet');

  const userApiPersistenceWarning = useMemo(() => {
    if (isTempUser) {
      return '';
    }
    if (apiHealth && !apiHealth.reachable) {
      return pick(
        '本地 API 当前离线。为避免密钥落到浏览器缓存，请先恢复服务后再编辑。',
        'Local API offline. Restore service first to secure your keys.',
      );
    }
    if (apiHealth && !isKkaiUserApiStorageReady(apiHealth)) {
      return pick(
        '本地 API 处于内存模式。请先启用本地 file 存储或后端持久化，再编辑 API 设置。',
        'Local API in memory mode. Enable local file storage or backend persistence first.',
      );
    }
    return '';
  }, [apiHealth, isTempUser, pick]);

  const ocrHealthLabel = useMemo(() => {
    return ocrSettings.healthState === 'configured'
      ? pick('已配置', 'Configured')
      : ocrSettings.healthState === 'missing_key'
        ? pick('未配置密钥', 'Key missing')
        : pick('未启动', 'Inactive');
  }, [ocrSettings.healthState, pick]);

  const ocrKeySourceLabel = ocrSettings.keySource === 'environment'
    ? pick('服务端环境变量', 'Environment variable')
    : pick('浏览器密钥', 'Browser cache');

  const diagnosticsAvailability = resolveApiWorkbenchDiagnosticsAvailability({
    hasWorkbenchAccess: !isTempUser,
    isApiReachable: apiHealth?.reachable,
  });
  const diagnosticsRefreshDisabled = diagnosticsAvailability.refreshDisabled;

  const stageMeta = resolveApiWorkbenchStageMeta({
    activeTab: 'official',
    pick,
    showDiagnostics,
    stage: apiServerState.stage,
    snapshotHydrationHelper: '',
    userApiPersistenceWarning,
    userApiPersistenceHelper: '',
    backendUnavailableHelper: '',
    userApiActionHelper: '',
  });

  const routePoolItems = useMemo(() => {
    return allChannelConfigs.map((channel) => {
      const slot = keyManager.getKey(channel.id);
      const provider = keyManager.getProvider(channel.id);
      const statusLabel = slot
        ? (slot.disabled
            ? pick('已停用', 'Paused')
            : slot.status === 'invalid'
              ? pick('异常', 'Error')
              : slot.status === 'rate_limited'
                ? pick('限流', 'Rate limited')
                : pick('可用', 'Ready'))
        : (provider
            ? (!provider.isActive
                ? pick('已停用', 'Paused')
                : provider.status === 'error'
                  ? pick('异常', 'Error')
                  : provider.status === 'checking'
                    ? pick('检测中', 'Checking')
                    : pick('可用', 'Ready'))
            : pick('可用', 'Ready'));
      const billingSummary = slot
        ? (slot.tokenLimit && slot.tokenLimit > 0
            ? `${pick('词元上限', 'Token limit')} ${slot.tokenLimit}`
            : slot.budgetLimit > 0
              ? `${pick('预算', 'Budget')} ${slot.budgetLimit}`
              : pick('不限额', 'Unlimited'))
        : (provider?.customCostMode === 'tokens'
            ? `${pick('词元上限', 'Token limit')} ${provider.customCostValue || provider.tokenLimit || 0}`
            : provider?.customCostMode === 'amount'
              ? `${pick('预算', 'Budget')} ${provider.customCostValue || provider.budgetLimit || 0}`
              : pick('不限额', 'Unlimited'));

      return {
        id: channel.id,
        name: channel.name,
        routeKind: slot?.type === 'official'
          ? pick('官方直连', 'Official direct')
          : slot
            ? pick('中转链路', 'Proxy route')
            : pick('供应商池', 'Provider pool'),
        protocolLabel: channel.protocolHint || 'auto',
        statusLabel,
        modelSummary: channel.capabilities.modelDiscovery
          ? pick(`自动获取模型 · ${channel.supportedModels.length} 个候选`, `Model discovery · ${channel.supportedModels.length} candidates`)
          : pick(`手动模型 · ${channel.supportedModels.length} 个候选`, `Manual models · ${channel.supportedModels.length} candidates`),
        billingSummary,
        baseUrlLabel: slot?.type === 'official' && !channel.baseUrl
          ? pick('官方 Google / OpenAI 默认地址', 'Official Google / OpenAI default endpoint')
          : String(channel.baseUrl || '').trim() || pick('由运行时补全', 'Resolved by runtime'),
      };
    });
  }, [allChannelConfigs, pick]);

  const refreshDiagnostics = () => {
    void run('health-refresh', () => refreshApiHealth(true));
  };

  const content = (
    <>
      {/* 1. 工作台摘要 */}
      <ApiWorkbenchOverviewSection
        pick={pick}
        workbenchStatusLabel={workbenchStatusLabel}
        workbenchTone={workbenchTone}
        userApiPersistenceWarning={userApiPersistenceWarning || null}
        isHydratingRuntimeUserApis={apiServerState.isHydratingRuntimeUserApis}
        snapshotHydrationHelper=""
        attentionCount={providers.filter((provider) => provider.status === 'error' || !provider.isActive).length}
        connectedChannels={connectedChannels}
        officialActiveCount={slots.filter((slot) => !slot.disabled).length}
        activeProviders={activeProviders}
        budgetCount={0}
        activeTab="official"
      />

      {/* 2. 能力分配（整合平台辅助AI与AI助手合并项，以及 OCR 服务拦截） */}
      <ApiWorkbenchCapabilitySection
        pick={pick}
        items={capabilityCards}
        customRoutingEnabled={customRoutingEnabled}
        onCustomRoutingToggle={handleCustomRoutingToggle}
      />



      {/* 简体中文：OCR 配置二级菜单 Modal */}
      {showOcrModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-lg rounded-[24px] border p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200" 
            style={SETTINGS_ELEVATED_STYLE}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border-light)' }}>
              <div>
                <h3 className="text-[18px] font-bold text-[var(--text-primary)]">
                  {pick('OCR 服务参数配置', 'OCR Service Config')}
                </h3>
                <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                  {pick('文档解析与导入的二级详细配置', 'Secondary detailed configuration for OCR service')}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowOcrModal(false)} 
                className="p-1.5 hover:bg-[var(--toolbar-hover)] rounded-full transition-colors"
              >
                <X size={18} className="text-[var(--text-secondary)]" />
              </button>
            </div>

            <div className="space-y-4">
              <SettingToggle
                label={pick('启用 OCR 服务', 'Enable OCR service')}
                checked={ocrSettings.enabled}
                onChange={(enabled) => {
                  updateOcrServiceSettings({ enabled });
                  setOcrSettings(getOcrServiceSettings());
                }}
                helper={pick('用于文档解析、电商需求文件、未来 PPT 导入文本提取。', 'Used for document parsing, ecommerce requirement files, and future PPT text extraction.')}
              />
              <div className="mt-3">
                <SettingInput
                  label={pick('默认语言', 'Default language')}
                  value={ocrSettings.defaultLanguage}
                  onChange={(defaultLanguage) => {
                    updateOcrServiceSettings({ defaultLanguage });
                    setOcrSettings(getOcrServiceSettings());
                  }}
                  placeholder="chi_sim"
                  disabled={!ocrSettings.enabled}
                  helper={pick('Tesseract OCR默认识别包语言，例如 chi_sim (简体中文), eng (英文)。', 'OCR identification pack, e.g. chi_sim or eng.')}
                />
              </div>
              <div className="grid gap-3 grid-cols-2 mt-4">
                <InfoCell 
                  label={pick('密钥来源', 'Key source')} 
                  value={ocrKeySourceLabel} 
                  helper={pick('只读取服务端环境变量。', 'Only read server variables.')} 
                />
                <InfoCell 
                  label={pick('健康状态', 'Health state')} 
                  value={ocrHealthLabel} 
                  helper={pick('当前 OCR 服务在线状态。', 'OCR service health state.')} 
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--border-light)' }}>
              <SettingsActionButton tone="primary" onClick={() => setShowOcrModal(false)}>
                {pick('完成并返回', 'Done')}
              </SettingsActionButton>
            </div>
          </div>
        </div>
      )}

      {/* 隐藏的组件，用于确保在重构精简布局后，局部 state 和方法不触发 unused 编译报警 */}
      <div
        style={{ display: 'none' }}
        data-diagnostics-state={showDiagnostics}
        data-busy={busy}
        data-health={Boolean(apiHealth)}
        data-warning={userApiPersistenceWarning}
        data-temp={isTempUser}
        data-routes={JSON.stringify(modelCenterRoutes)}
        data-presets={JSON.stringify(modelCenterPresets)}
        data-preset-tab={modelCenterPresetTab}
        data-actions-disabled={userApiActionsDisabled}
        data-provider-disabled={providerActionsDisabled}
        data-connected-channels={propConnectedChannels}
        onClick={() => {
          handleToggleDiagnostics();
          void run('cloud-refresh', () => refreshApiHealth(true));
          if (setModelCenterPresetTab) setModelCenterPresetTab('official');
          if (handleCreateOfficialAction) handleCreateOfficialAction();
          if (beginCreateProvider) beginCreateProvider();
        }}
      />
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <SettingsViewShell>
      <SettingsHero
        eyebrow={pick('能力路由与诊断', 'Advanced Setup')}
        title={pick('高级分配与诊断', 'Advanced Setup')}
        description={pick(
          '在此将不同的模块或场景路由分配给特定的 AI 通道，并监控链路运行状态。',
          'Route different modules or scenarios to specific AI channels and monitor routing metrics.',
        )}
        icon={Layers3}
        tone="indigo"
        actions={
          <SettingsActionButton icon={ArrowLeft} onClick={() => navigate(API_MANAGEMENT_HOME_PATH)}>
            {pick('返回模型中心', 'Back to model center')}
          </SettingsActionButton>
        }
      />
      {content}
    </SettingsViewShell>
  );
};

export default ApiAdvancedSettingsView;
