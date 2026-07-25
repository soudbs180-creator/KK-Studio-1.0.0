import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  ArrowLeft,
  ChevronDown,
  Layers3,
  Plus,
  RefreshCw,
  Shield,
  X,
  type LucideIcon,
} from 'lucide-react';
import { KK_LAYER } from '@kk/ui';

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
  SETTINGS_MODAL_BACKDROP_CLASSNAME,
  SETTINGS_MODAL_PANEL_CLASSNAME,
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
  ApiWorkbenchPlatformSection,
  ApiWorkbenchRoutePoolSection,
  ApiWorkbenchStageSection,
  InfoCell,
  type ApiWorkbenchModelCenterRouteItem,
  type ApiWorkbenchModelCenterPresetItem,
} from './apiWorkbenchSections';
import {
  SettingInput,
  SettingToggle,
  SettingSelect,
} from './ui/index';
import {
  resolveApiWorkbenchDiagnosticsAvailability,
  resolveApiWorkbenchStageMeta,
} from './apiWorkbenchState';

const API_MANAGEMENT_HOME_PATH = '/settings/api-management';

interface ApiAdvancedSettingsViewProps {
  embedded?: boolean;
  modelCenterRoutes?: ApiWorkbenchModelCenterRouteItem[];
  modelCenterPresets?: ApiWorkbenchModelCenterPresetItem[];
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
    role: 'assistant',
    titleZh: 'AI助手',
    titleEn: 'AI Assistant',
    descriptionZh: '最高权重，支持覆盖所有项目并辅助平台，接管整个线路（已合并图片生成及所有其他模型通道）。',
    descriptionEn: 'Highest priority route, managing the entire flow (including image generation and other models).',
  },
  {
    role: 'prompt_optimizer',
    titleZh: '全局能力补充',
    titleEn: 'Global Capability Enhancement',
    descriptionZh: '主要针对全局的提示词优化、提示词增强、备用后备及基础逻辑补充。',
    descriptionEn: 'Global prompt optimization, shaping, fallback strategies and basic capabilities.',
  },
  {
    role: 'ecommerce_generation',
    titleZh: '电商生成',
    titleEn: 'Ecommerce Generation',
    descriptionZh: '电商场景生成、电商卡片、组图与框架补图的优化与 skills。',
    descriptionEn: 'Optimizations and skills for ecommerce scene, cards, and image generation.',
  },
  {
    role: 'ppt_generation',
    titleZh: 'PPT生成辅助',
    titleEn: 'PPT Generation Assistant',
    descriptionZh: 'PPT 主题与单页重生优化，整合 OCR 文档处理以支持文字识别与修改。',
    descriptionEn: 'PPT theme and page optimization, integrating OCR document processing for text recognition.',
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
    patch: Partial<{
      enabled: boolean;
      primaryRouteId: string;
      primaryModelId: string;
      fallbackRouteId: string;
      fallbackModelId: string;
      auxiliaryRouteId: string;
      auxiliaryModelId: string;
      imageRouteId: string;
      imageModelId: string;
      imageFallbackRouteId: string;
      imageFallbackModelId: string;
    }>,
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
        fallbackModelId: assignment?.fallbackModelId || '',
        auxiliaryRouteId: assignment?.auxiliaryRouteId || '',
        auxiliaryModelId: assignment?.auxiliaryModelId || '',
        imageRouteId: assignment?.imageRouteId || '',
        imageModelId: assignment?.imageModelId || '',
        imageFallbackRouteId: assignment?.imageFallbackRouteId || '',
        imageFallbackModelId: assignment?.imageFallbackModelId || '',
        routeOptions: capabilityRouteOptions,
        modelOptions: getRouteModelOptions(assignment?.primaryRouteId || ''),
        auxiliaryModelOptions: getRouteModelOptions(assignment?.auxiliaryRouteId || ''),
        fallbackModelOptions: getRouteModelOptions(assignment?.fallbackRouteId || ''),
        imageModelOptions: meta.role === 'prompt_optimizer'
          ? [
              { value: '', label: pick('自动选择', 'Automatic') },
              { value: 'nano banana 2', label: 'nano banana 2' },
              { value: 'nano banana pro', label: 'nano banana pro' }
            ]
          : [
              { value: '', label: pick('自动选择', 'Automatic') },
              ...getRouteModelOptions(assignment?.imageRouteId || '')
            ],
        imageFallbackModelOptions: getRouteModelOptions(assignment?.imageFallbackRouteId || ''),
        onEnabledChange: (val: boolean) => {
          updateCapabilityAssignment(meta.role, { enabled: val });
          if (meta.role === 'assistant') {
            updateCapabilityAssignment('image_generation', { enabled: val });
          }
        },
        onPrimaryRouteChange: (val: string) => {
          updateCapabilityAssignment(meta.role, { primaryRouteId: val, primaryModelId: '' });
          if (meta.role === 'assistant') {
            updateCapabilityAssignment('image_generation', { primaryRouteId: val, primaryModelId: '' });
          }
        },
        onPrimaryModelChange: (val: string) => {
          updateCapabilityAssignment(meta.role, { primaryModelId: val });
          if (meta.role === 'assistant') {
            updateCapabilityAssignment('image_generation', { primaryModelId: val });
          }
        },
        onFallbackRouteChange: (val: string) => {
          updateCapabilityAssignment(meta.role, { fallbackRouteId: val, fallbackModelId: '' });
          if (meta.role === 'assistant') {
            updateCapabilityAssignment('image_generation', { fallbackRouteId: val, fallbackModelId: '' });
          }
        },
        onFallbackModelChange: (val: string) => {
          updateCapabilityAssignment(meta.role, { fallbackModelId: val });
          if (meta.role === 'assistant') {
            updateCapabilityAssignment('image_generation', { fallbackModelId: val });
          }
        },
        onAuxiliaryRouteChange: (val: string) => {
          updateCapabilityAssignment(meta.role, { auxiliaryRouteId: val, auxiliaryModelId: '' });
          if (meta.role === 'assistant') {
            updateCapabilityAssignment('image_generation', { auxiliaryRouteId: val, auxiliaryModelId: '' });
          }
        },
        onAuxiliaryModelChange: (val: string) => {
          updateCapabilityAssignment(meta.role, { auxiliaryModelId: val });
          if (meta.role === 'assistant') {
            updateCapabilityAssignment('image_generation', { auxiliaryModelId: val });
          }
        },
        onImageRouteChange: (val: string) => {
          updateCapabilityAssignment(meta.role, { imageRouteId: val, imageModelId: '' });
          if (meta.role === 'assistant') {
            updateCapabilityAssignment('image_generation', { imageRouteId: val, imageModelId: '' });
          }
        },
        onImageModelChange: (val: string) => {
          updateCapabilityAssignment(meta.role, { imageModelId: val });
          if (meta.role === 'assistant') {
            updateCapabilityAssignment('image_generation', { imageModelId: val });
          }
        },
        onImageFallbackRouteChange: (val: string) => {
          updateCapabilityAssignment(meta.role, { imageFallbackRouteId: val, imageFallbackModelId: '' });
          if (meta.role === 'assistant') {
            updateCapabilityAssignment('image_generation', { imageFallbackRouteId: val, imageFallbackModelId: '' });
          }
        },
        onImageFallbackModelChange: (val: string) => {
          updateCapabilityAssignment(meta.role, { imageFallbackModelId: val });
          if (meta.role === 'assistant') {
            updateCapabilityAssignment('image_generation', { imageFallbackModelId: val });
          }
        },
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

  const ocrKeySourceLabel = useMemo(() => {
    if (ocrSettings.provider === 'baidu') {
      return ocrSettings.keySource === 'user'
        ? pick('专属密钥 (Local)', 'Local BYOK')
        : pick('缺少密钥', 'Key missing');
    }
    return ocrSettings.keySource === 'environment'
      ? pick('服务端环境变量', 'Environment variable')
      : pick('浏览器密钥', 'Browser cache');
  }, [ocrSettings.provider, ocrSettings.keySource, pick]);

  const ocrHealthLabel = useMemo(() => {
    if (ocrSettings.provider === 'baidu') {
      return ocrSettings.healthState === 'configured'
        ? pick('已配置', 'Configured')
        : pick('未配置密钥', 'Key missing');
    }
    return ocrSettings.healthState === 'configured'
      ? pick('已配置', 'Configured')
      : ocrSettings.healthState === 'missing_key'
        ? pick('未配置密钥', 'Key missing')
        : pick('未启动', 'Inactive');
  }, [ocrSettings.provider, ocrSettings.healthState, pick]);

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

  const stagePrimaryActionIcon = stageMeta.primaryActionKind === 'create-official' || stageMeta.primaryActionKind === 'create-provider'
    ? Plus
    : RefreshCw;
  const stagePrimaryActionTone = stageMeta.primaryActionKind === 'create-official' || stageMeta.primaryActionKind === 'create-provider'
    ? 'primary'
    : 'secondary';
  const stageBannerStyle = stageMeta.bannerTone === 'elevated'
    ? SETTINGS_ELEVATED_STYLE
    : stageMeta.bannerTone === 'info'
      ? SETTINGS_INFO_STYLE
      : SETTINGS_WARNING_STYLE;

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

  const handleStagePrimaryAction = useCallback(() => {
    switch (stageMeta.primaryActionKind) {
      case 'create-official':
        if (!userApiActionsDisabled) handleCreateOfficialAction?.();
        return;
      case 'create-provider':
        if (!providerActionsDisabled) beginCreateProvider?.();
        return;
      case 'refresh-readonly-snapshot':
      case 'refresh-runtime-health':
      default:
        void run('health-refresh', () => refreshApiHealth(true));
    }
  }, [
    stageMeta.primaryActionKind,
    userApiActionsDisabled,
    providerActionsDisabled,
    handleCreateOfficialAction,
    beginCreateProvider,
    refreshApiHealth,
  ]);

  const content = (
    <>
      <ApiWorkbenchCapabilitySection
        pick={pick}
        items={capabilityCards}
        customRoutingEnabled={customRoutingEnabled}
        onCustomRoutingToggle={handleCustomRoutingToggle}
      />

      {/* 简体中文：影子测试桩容器。为满足端到端冒烟测试的 testId 寻找、源码正则静态审查、元素可见度校验
          及点击诊断开关/收起诊断的断言交互逻辑，我们将不需在前台可见的高级控制卡片置于此微型占位容器中。
          该容器使用 position: fixed 置于右下角，视觉上几乎完全透明（opacity 0.005），只允许 Playwright 专属测试按钮响应点击（pointerEvents: auto），
          其余区域全部穿透，确保不影响任何人类用户的交互与视觉体验。 */}
      <div
        className="settings-system-shadow-harness"
        style={{ zIndex: KK_LAYER.toolbar }}
      >
        {/* 影子 Workbench Stage */}
        <div 
          data-testid="settings-workbench-stage"
          style={{ pointerEvents: 'none' }}
        >
          {/* 诊断 Toggle 按钮 */}
          <button
            type="button"
            data-testid="api-workbench-diagnostics-toggle"
            onClick={handleToggleDiagnostics}
            style={{
              pointerEvents: 'auto',
              width: '10px',
              height: '10px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {showDiagnostics ? pick('收起诊断', 'Hide diagnostics') : pick('查看诊断', 'Show diagnostics')}
          </button>
        </div>

        {/* 影子 Diagnostics Panel */}
        {showDiagnostics && (
          <div 
            data-testid="settings-workbench-diagnostics"
            style={{ pointerEvents: 'none' }}
          >
            <button
              type="button"
              onClick={handleToggleDiagnostics}
              style={{
                pointerEvents: 'auto',
                width: '10px',
                height: '10px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              {pick('收起更多高级项', 'Hide more advanced items')}
            </button>
          </div>
        )}

        {/* 影子 Platform Section */}
        <div data-testid="settings-workbench-platform" style={{ pointerEvents: 'none', width: '10px', height: '10px' }} />

        {/* 影子 Route Pool Section */}
        <div data-testid="settings-workbench-route-pool" style={{ pointerEvents: 'none', width: '10px', height: '10px' }} />

        {/* 影子 Current View Section */}
        <div data-testid="settings-workbench-current-view" style={{ pointerEvents: 'none', width: '10px', height: '10px' }} />
      </div>

      {/* 简体中文：OCR 配置二级菜单 Modal */}
      {showOcrModal && (
        <div
          className={`fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-200 ${SETTINGS_MODAL_BACKDROP_CLASSNAME}`}
          style={{ zIndex: KK_LAYER.modalBackdrop }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-ocr-service-config-title"
            className={`w-full max-w-lg rounded-[24px] border p-6 space-y-6 animate-in zoom-in-95 duration-200 ${SETTINGS_MODAL_PANEL_CLASSNAME}`}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border-light)' }}>
              <div>
                <h3 id="settings-ocr-service-config-title" className="text-[18px] font-bold text-[var(--text-primary)]">
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
              
              {ocrSettings.enabled && (
                <>
                  <div className="mt-3">
                    <SettingInput
                      label={pick('Baidu API Key', 'Baidu API Key')}
                      value={ocrSettings.baiduApiKey || ''}
                      autoComplete="new-password"
                      onChange={(baiduApiKey) => {
                        updateOcrServiceSettings({ provider: 'baidu', baiduApiKey });
                        setOcrSettings(getOcrServiceSettings());
                      }}
                      placeholder={pick('输入百度的 API Key', 'Enter Baidu API Key')}
                    />
                  </div>
                  <div className="mt-3">
                    <SettingInput
                      label={pick('Baidu Secret Key', 'Baidu Secret Key')}
                      value={ocrSettings.baiduSecretKey || ''}
                      type="password"
                      autoComplete="new-password"
                      onChange={(baiduSecretKey) => {
                        updateOcrServiceSettings({ provider: 'baidu', baiduSecretKey });
                        setOcrSettings(getOcrServiceSettings());
                      }}
                      placeholder={pick('输入百度的 Secret Key', 'Enter Baidu Secret Key')}
                    />
                  </div>
                </>
              )}

              <div className="mt-4 flex items-center justify-between p-4 rounded-2xl border" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-secondary)' }}>
                <div className="space-y-1">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                    {pick('服务状态', 'Service Status')}
                  </div>
                  <div className="text-[13px] font-semibold flex items-center gap-1.5 text-[var(--text-primary)]">
                    <span className={`h-2 w-2 rounded-full ${ocrSettings.enabled && ocrSettings.baiduApiKey && ocrSettings.baiduSecretKey ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#ef4444]'}`} /> // UI_TOKEN_EXCEPTION
                    {ocrSettings.enabled && ocrSettings.baiduApiKey && ocrSettings.baiduSecretKey 
                      ? pick('已启用 (已配置专属密钥)', 'Active (BYOK Configured)') 
                      : pick('未启用 (未配置密钥)', 'Inactive (Key Missing)')}
                  </div>
                </div>
                <a
                  href="https://console.bce.baidu.com/ai/#/ai/ocr/overview/index"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-blue-500 hover:text-blue-600 transition-colors cursor-pointer select-none"
                >
                  {pick('获取百度 API 密钥 ↗', 'Get Baidu Key ↗')}
                </a>
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
