import type { CapabilityRole, CapabilityRouteAssignment } from '../../types';

const STORAGE_KEY = 'kk_capability_route_assignments_v1';
const CUSTOM_ROUTING_KEY = 'kk_custom_routing_enabled_v1';

type CapabilityRouteKeyManager = {
  getSlots: () => Array<{
    id: string;
    disabled?: boolean;
    budgetLimit?: number;
    tokenLimit?: number;
    supportedModels?: string[];
  }>;
  getProviders: () => Array<{
    id: string;
    isActive?: boolean;
    budgetLimit?: number;
    tokenLimit?: number;
    models?: string[];
  }>;
  getChannelConfigs: (options: { includeDisabled: boolean; includeProviders: boolean }) => Array<{
    id: string;
    capabilities?: { chat: boolean; image: boolean; video: boolean; audio: boolean; modelDiscovery: boolean };
  }>;
};

const KEY_MANAGER_REGISTRY_KEY = '__KK_CAPABILITY_ROUTE_KEY_MANAGER__';

export const registerCapabilityRouteKeyManager = (manager: CapabilityRouteKeyManager): void => {
  (globalThis as typeof globalThis & Record<typeof KEY_MANAGER_REGISTRY_KEY, CapabilityRouteKeyManager | undefined>)[KEY_MANAGER_REGISTRY_KEY] = manager;
};

const getCapabilityRouteKeyManager = (): CapabilityRouteKeyManager | undefined => (
  (globalThis as typeof globalThis & Record<typeof KEY_MANAGER_REGISTRY_KEY, CapabilityRouteKeyManager | undefined>)[KEY_MANAGER_REGISTRY_KEY]
);

const CAPABILITY_ROLES: CapabilityRole[] = [
  'image_generation',
  'ppt_generation',
  'ecommerce_generation',
  'assistant',
  'prompt_optimizer',
  'ocr_document',
];

const listeners = new Set<() => void>();

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const normalizeRouteMatchValue = (value: string | null | undefined) => String(value || '').trim().toLowerCase();

const decodeRouteSuffix = (suffix: string | null | undefined) => {
  try {
    return decodeURIComponent(normalizeRouteMatchValue(suffix));
  } catch {
    return normalizeRouteMatchValue(suffix);
  }
};

const extractRouteTargetFromModelId = (modelId: string | null | undefined) => {
  const suffix = String(modelId || '').split('@')[1];
  const decodedSuffix = decodeRouteSuffix(suffix);
  if (!decodedSuffix) return '';
  if (decodedSuffix.startsWith('slot_key_')) return decodedSuffix.slice(5);
  if (decodedSuffix.startsWith('slot_')) return decodedSuffix.slice(5);
  if (decodedSuffix.startsWith('provider_')) return decodedSuffix;
  return decodedSuffix;
};

const buildDefaultAssignments = (): CapabilityRouteAssignment[] => {
  const timestamp = Date.now();
  return CAPABILITY_ROLES.map((role) => ({
    role,
    enabled: role !== 'ocr_document',
    updatedAt: timestamp,
  }));
};

const normalizeAssignment = (
  raw: Partial<CapabilityRouteAssignment> | null | undefined,
): CapabilityRouteAssignment | null => {
  if (!raw || typeof raw !== 'object' || typeof raw.role !== 'string') {
    return null;
  }

  const role = CAPABILITY_ROLES.find((item) => item === raw.role);
  if (!role) {
    return null;
  }

  return {
    role,
    primaryRouteId: typeof raw.primaryRouteId === 'string' ? raw.primaryRouteId.trim() || undefined : undefined,
    primaryModelId: typeof raw.primaryModelId === 'string' ? raw.primaryModelId.trim() || undefined : undefined,
    fallbackRouteId: typeof raw.fallbackRouteId === 'string' ? raw.fallbackRouteId.trim() || undefined : undefined,
    auxiliaryRouteId: typeof raw.auxiliaryRouteId === 'string' ? raw.auxiliaryRouteId.trim() || undefined : undefined,
    auxiliaryModelId: typeof raw.auxiliaryModelId === 'string' ? raw.auxiliaryModelId.trim() || undefined : undefined,
    enabled: raw.enabled !== false,
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
      ? raw.updatedAt
      : Date.now(),
  };
};

const readAssignments = (): CapabilityRouteAssignment[] => {
  const defaults = buildDefaultAssignments();
  if (!canUseStorage()) {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return defaults;
    }

    const normalized = parsed
      .map((item) => normalizeAssignment(item))
      .filter((item): item is CapabilityRouteAssignment => Boolean(item));

    const byRole = new Map(normalized.map((item) => [item.role, item] as const));
    return defaults.map((fallback) => byRole.get(fallback.role) || fallback);
  } catch {
    return defaults;
  }
};

const writeAssignments = (assignments: CapabilityRouteAssignment[]) => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
};

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

// 简体中文注释：新增自定义能力路由开启状态管理
export const isCustomRoutingEnabled = (): boolean => {
  if (!canUseStorage()) {
    return false;
  }
  return window.localStorage.getItem(CUSTOM_ROUTING_KEY) === 'true';
};

export const setCustomRoutingEnabled = (enabled: boolean): void => {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(CUSTOM_ROUTING_KEY, String(enabled));
  notifyListeners();
};

// 简体中文注释：获取智能的自动路由选择
const getSmartAutoAssignment = (role: CapabilityRole): CapabilityRouteAssignment => {
  const timestamp = Date.now();
  const defaultAssignment: CapabilityRouteAssignment = {
    role,
    enabled: role !== 'ocr_document',
    updatedAt: timestamp,
  };

  try {
    const keyManager = getCapabilityRouteKeyManager();
    if (!keyManager) {
      return defaultAssignment;
    }

    // 获取当前活跃的所有官方 slots 和第三方供应商
    const slots = keyManager.getSlots().filter((s) => !s.disabled);
    const providers = keyManager.getProviders().filter((p) => p.isActive);

    const candidates: Array<{
      id: string;
      source: 'user-slot' | 'provider';
      budgetLimit: number;
      tokenLimit: number;
      supportedModels: string[];
      capabilities: { chat: boolean; image: boolean; video: boolean; audio: boolean; modelDiscovery: boolean };
    }> = [];

    const configs = keyManager.getChannelConfigs({ includeDisabled: true, includeProviders: true });

    for (const slot of slots) {
      const config = configs.find((c) => c.id === slot.id);
      if (!config) continue;
      candidates.push({
        id: slot.id,
        source: 'user-slot',
        budgetLimit: slot.budgetLimit ?? -1,
        tokenLimit: slot.tokenLimit || -1,
        supportedModels: slot.supportedModels || [],
        capabilities: config.capabilities || { chat: true, image: false, video: false, audio: false, modelDiscovery: false },
      });
    }

    for (const provider of providers) {
      const config = configs.find((c) => c.id === provider.id);
      if (!config) continue;
      candidates.push({
        id: provider.id,
        source: 'provider',
        budgetLimit: provider.budgetLimit ?? -1,
        tokenLimit: provider.tokenLimit ?? -1,
        supportedModels: provider.models || [],
        capabilities: config.capabilities || { chat: true, image: false, video: false, audio: false, modelDiscovery: false },
      });
    }

    // 根据 role 筛选对应的能力通道
    let filtered = candidates;
    if (role === 'image_generation' || role === 'ecommerce_generation') {
      filtered = candidates.filter((c) => c.capabilities.image);
    } else if (role === 'assistant' || role === 'ppt_generation' || role === 'prompt_optimizer') {
      filtered = candidates.filter((c) => c.capabilities.chat);
    }

    // 兜底：若没有任何针对性的通道，则选用全部活跃通道
    if (filtered.length === 0) {
      filtered = candidates;
    }

    if (filtered.length === 0) {
      return defaultAssignment;
    }

    // 智能权重计算规则：优先预算金额最高或者 tokens 最高的活跃通道
    const getScore = (c: typeof candidates[0]) => {
      let budgetScore = 0;
      if (c.budgetLimit > 0) {
        budgetScore = c.budgetLimit;
      }
      let tokenScore = 0;
      if (c.tokenLimit > 0) {
        tokenScore = c.tokenLimit / 10000; // 每一万 Tokens 折合 $1 权重
      }
      const maxLimitScore = Math.max(budgetScore, tokenScore);
      if (maxLimitScore > 0) {
        return maxLimitScore;
      }
      // 不限额通道赋予极小的正值，优先于被过滤的但低于明确设定了高额度的渠道
      if (c.budgetLimit === -1 || c.tokenLimit === -1) {
        return 0.0001;
      }
      return 0;
    };

    filtered.sort((a, b) => getScore(b) - getScore(a));

    const bestCandidate = filtered[0];

    // 从候选通道中确定一个最匹配的模型
    let primaryModelId = bestCandidate.supportedModels[0] || '';
    if (role === 'image_generation' || role === 'ecommerce_generation') {
      const imgModel = bestCandidate.supportedModels.find((m) =>
        m.toLowerCase().includes('imagen') ||
        m.toLowerCase().includes('image') ||
        m.toLowerCase().includes('dall') ||
        m.toLowerCase().includes('banana'),
      );
      if (imgModel) primaryModelId = imgModel;
    } else {
      const chatModel = bestCandidate.supportedModels.find((m) =>
        m.toLowerCase().includes('gemini-2.5-pro') ||
        m.toLowerCase().includes('gemini-2.5-flash') ||
        m.toLowerCase().includes('gemini-3') ||
        m.toLowerCase().includes('gpt-') ||
        m.toLowerCase().includes('deepseek') ||
        m.toLowerCase().includes('claude'),
      );
      if (chatModel) primaryModelId = chatModel;
    }

    return {
      role,
      primaryRouteId: bestCandidate.id,
      primaryModelId,
      enabled: role !== 'ocr_document',
      updatedAt: timestamp,
    };
  } catch (error) {
    console.error('[CapabilityRouteAssignments] Failed to compute smart auto route:', error);
    return defaultAssignment;
  }
};

export const getCapabilityRouteAssignments = () => readAssignments();

// 简体中文注释：获取能力角色分配路由
export const resolveCapabilityRouteAssignment = (role: CapabilityRole) => {
  if (isCustomRoutingEnabled()) {
    return readAssignments().find((assignment) => assignment.role === role);
  }
  return getSmartAutoAssignment(role);
};

export const resolveEnabledCapabilityRouteAssignment = (role: CapabilityRole) => {
  const assignment = resolveCapabilityRouteAssignment(role);
  return assignment?.enabled ? assignment : undefined;
};

export const isCapabilityRouteAssignmentRouteDisabled = (role: CapabilityRole, routeId?: string) => {
  const normalizedRouteId = normalizeRouteMatchValue(routeId);
  if (!normalizedRouteId) return false;
  const assignment = resolveCapabilityRouteAssignment(role);
  return assignment?.enabled === false
    && normalizeRouteMatchValue(assignment.primaryRouteId) === normalizedRouteId;
};

export const isCapabilityRouteAssignmentModelDisabled = (role: CapabilityRole, modelId?: string) => {
  const normalizedModelId = normalizeRouteMatchValue(modelId);
  if (!normalizedModelId) return false;

  const assignment = resolveCapabilityRouteAssignment(role);
  if (!assignment || assignment.enabled !== false) return false;

  const primaryModelId = normalizeRouteMatchValue(assignment.primaryModelId);
  if (primaryModelId && primaryModelId === normalizedModelId) return true;

  const primaryRouteId = normalizeRouteMatchValue(assignment.primaryRouteId);
  if (!primaryRouteId) return false;
  return extractRouteTargetFromModelId(modelId) === primaryRouteId;
};

export const upsertCapabilityRouteAssignment = (
  role: CapabilityRole,
  patch: Partial<Omit<CapabilityRouteAssignment, 'role' | 'updatedAt'>>,
) => {
  const nextAssignments = readAssignments().map((assignment) => (
    assignment.role === role
      ? {
          ...assignment,
          ...patch,
          updatedAt: Date.now(),
        }
      : assignment
  ));

  writeAssignments(nextAssignments);
  notifyListeners();
  return nextAssignments.find((assignment) => assignment.role === role) || null;
};

export const subscribeCapabilityRouteAssignments = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
