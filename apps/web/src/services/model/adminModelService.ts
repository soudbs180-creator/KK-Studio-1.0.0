import type { ApiError } from '../../../../../packages/shared/src/index.ts';
import { kkWebApiClient } from '../api/kkApiClient.ts';
import { keyManager } from '../auth/keyManager.ts';


import { isStartupStageReady, type AppStartupStage } from '../system/appStartup.ts';

import {
  type AdminModelQualityPricing,
  getAdminModelCreditCostForSize,
  isAdminQualityEnabled,
  normalizeAdminQualityPricing,
} from './adminModelQuality.ts';
import {
  getAdminModelAutoRefreshDelay,
  shouldStartAdminModelRefresh,
} from './adminModelRefreshPolicy.ts';
import {
  buildCreditModelCatalog,
  pickCreditRouteUnit,
  pickCreditModelSpec,
  type CreditModelCatalogEntry,
  type CreditModelSpec,
} from './adminRouteUnits.ts';

function darkenColor(hex: string, percent: number): string {
  const hslMatch = hex.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/i);
  if (hslMatch) {
    const h = parseInt(hslMatch[1], 10);
    const s = parseInt(hslMatch[2], 10);
    const l = Math.max(0, Math.floor((parseInt(hslMatch[3], 10) * (100 - percent)) / 100));
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  if (!hex.startsWith('#')) return hex;

  let color = hex.replace('#', '');
  if (color.length === 3) {
    color = color
      .split('')
      .map((item) => item + item)
      .join('');
  }

  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  const factor = (100 - percent) / 100;

  const nr = Math.max(0, Math.floor(r * factor));
  const ng = Math.max(0, Math.floor(g * factor));
  const nb = Math.max(0, Math.floor(b * factor));

  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb
    .toString(16)
    .padStart(2, '0')}`;
}

export interface AdminModelConfig {
  id: string;
  displayName: string;
  provider: string;
  providerId?: string;
  providerName?: string;
  requestProfileId?: string;
  routeStrategy?: 'priority-failover' | 'weighted-random' | 'parallel-race';
  recordId?: string;
  priority?: number;
  weight?: number;
  callCount?: number;
  colorStart: string;
  colorEnd: string;
  colorSecondary?: string;
  textColor?: 'white' | 'black';
  creditCost: number;
  advancedEnabled?: boolean;
  mixWithSameModel?: boolean;
  qualityPricing?: AdminModelQualityPricing;
  billingType: 'token' | 'per_request' | 'multiplier';
  endpoint: string;
  advantages?: string;
  isSystemModel: boolean;
  isSystemInternal?: boolean;
}

export interface AdminProvider {
  id: string;
  providerId: string;
  name: string;
  providerKind?: 'official' | 'relay';
  models: AdminModelConfig[];
}

interface FlatModelRow {
  id?: string;
  provider_id?: string;
  provider_name?: string;
  provider_kind?: string | null;
  request_profile_id?: string;
  route_strategy?: 'priority-failover' | 'weighted-random' | 'parallel-race' | null;
  model_id?: string;
  display_name?: string;
  description?: string | null;
  color?: string | null;
  color_secondary?: string | null;
  text_color?: string | null;
  endpoint_type?: string | null;
  credit_cost?: number | null;
  priority?: number | null;
  weight?: number | null;
  is_active?: boolean | null;
  call_count?: number | null;
  advanced_enabled?: boolean | null;
  mix_with_same_model?: boolean | null;
  quality_pricing?: Record<string, any> | null;
}

type AdminModelRouteSelection = {
  baseModelId: string;
  routeIndex: number | null;
  routeKey: string | null;
  hasSystemRouteSuffix: boolean;
};

export type AdminModelRouteSelectionContext = {
  baseModelId: string;
  routeIndex: number | null;
  routeKey: string | null;
  hasSystemRouteSuffix: boolean;
  matchedModels: AdminModelConfig[];
  mixedModels: AdminModelConfig[];
  mixedEligibleModels: AdminModelConfig[];
  exactModel: AdminModelConfig | null;
  useMixedRouting: boolean;
};

type ResolvedAdminModelRoute = {
  model: AdminModelConfig;
  creditCost: number;
  usedQualityPricing: boolean;
};

class AdminModelService {
  private static readonly BROADCAST_CHANNEL = 'kk-admin-model-catalog';
  private static readonly BROADCAST_EVENT = 'credit-models-updated';
  private providers: AdminProvider[] = [];
  private models: AdminModelConfig[] = [];
  private creditCatalog: CreditModelCatalogEntry[] = [];
  private listeners: Array<() => void> = [];
  private loadingPromise: Promise<void> | null = null;
  private lastLoadAttemptAt = 0;
  private modelRefreshHandler: (() => void) | null = null;
  private autoRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private autoRefreshInitialized = false;
  private broadcastChannel: BroadcastChannel | null = null;
  private backgroundRefreshEnabled = false;
  private startupStage: AppStartupStage = 'background_ready';

  private static readonly LOAD_RETRY_INTERVAL_MS = 15000;

  constructor() {
    this.initializeBroadcastRefresh();
  }

  private requestBackgroundRefresh(force = false): void {
    const shouldStart = shouldStartAdminModelRefresh({
      force,
      hasInflightRequest: Boolean(this.loadingPromise),
      lastAttemptAt: this.lastLoadAttemptAt,
      now: Date.now(),
      cooldownMs: AdminModelService.LOAD_RETRY_INTERVAL_MS,
    });

    if (!shouldStart) {
      return;
    }

    void this.loadAdminModels(force).catch((error) => {
      console.warn('[AdminModelService] Background refresh failed:', error);
    });
  }

  private initializeBroadcastRefresh(): void {
    if (
      this.broadcastChannel
      || typeof window === 'undefined'
      || typeof window.BroadcastChannel === 'undefined'
    ) {
      return;
    }

    const channel = new window.BroadcastChannel(AdminModelService.BROADCAST_CHANNEL);
    channel.addEventListener('message', (event) => {
      const payload = event.data as { event?: string } | null;
      if (payload?.event !== AdminModelService.BROADCAST_EVENT) {
        return;
      }

      this.requestBackgroundRefresh(false);
    });

    this.broadcastChannel = channel;
  }

  private initializeSafeAutoRefresh(): void {
    if (this.autoRefreshInitialized || typeof window === 'undefined') {
      return;
    }

    this.autoRefreshInitialized = true;

    // Use the sanitized active-model RPC instead of subscribing to the raw
    // admin_credit_models table so browser clients never receive provider api_keys.
    const refreshNow = () => {
      if (!this.backgroundRefreshEnabled) {
        return;
      }

      this.requestBackgroundRefresh(false);
    };

    const reschedule = (delayMs?: number) => {
      if (this.autoRefreshTimer) {
        clearTimeout(this.autoRefreshTimer);
      }

      const nextDelay = delayMs ?? getAdminModelAutoRefreshDelay(
        document.visibilityState === 'visible' ? 'visible' : 'hidden',
      );

      this.autoRefreshTimer = setTimeout(() => {
        refreshNow();
        reschedule();
      }, nextDelay);
    };

    window.addEventListener('focus', () => {
      refreshNow();
      reschedule(getAdminModelAutoRefreshDelay('visible'));
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        refreshNow();
      }
      reschedule();
    });

    reschedule(getAdminModelAutoRefreshDelay('visible'));
  }

  setBackgroundRefreshEnabled(enabled: boolean): void {
    const nextEnabled = enabled === true;
    this.backgroundRefreshEnabled = nextEnabled;

    if (!nextEnabled) {
      if (this.autoRefreshTimer) {
        clearTimeout(this.autoRefreshTimer);
        this.autoRefreshTimer = null;
      }
      return;
    }

    this.initializeSafeAutoRefresh();
  }

  setStartupStage(stage: AppStartupStage): void {
    if (this.startupStage === stage) {
      return;
    }
    this.startupStage = stage;
    this.setBackgroundRefreshEnabled(isStartupStageReady(stage, 'background_ready'));

    if (isStartupStageReady(stage, 'workspace_ready')) {
      void this.forceLoadAdminModels().catch((error) => {
        console.warn('[AdminModelService] Deferred startup refresh failed:', error);
      });
    }
  }

  private mapLegacyProviderRows(
    grouped: Array<{
      providerId?: string | null;
      providerName?: string | null;
      providerKind?: 'official' | 'relay' | null;
      models?: Array<{
        recordId?: string | null;
        modelId?: string | null;
        displayName?: string | null;
        description?: string | null;
        endpointType?: string | null;
        creditCost?: number | null;
        priority?: number | null;
        weight?: number | null;
        callCount?: number | null;
        color?: string | null;
        colorSecondary?: string | null;
        textColor?: string | null;
        advancedEnabled?: boolean | null;
        mixWithSameModel?: boolean | null;
        qualityPricing?: Record<string, any> | null;
      }> | null;
    }>
  ): FlatModelRow[] {
    return grouped.flatMap((provider) =>
      (provider.models || []).map((model) => ({
        id: model.recordId ?? undefined,
        provider_id: provider.providerId ?? undefined,
        provider_name: provider.providerName ?? undefined,
        provider_kind: provider.providerKind ?? undefined,
        request_profile_id: undefined,
        route_strategy: undefined,
        model_id: model.modelId ?? undefined,
        display_name: model.displayName ?? undefined,
        description: model.description ?? undefined,
        color: model.color ?? undefined,
        color_secondary: model.colorSecondary ?? undefined,
        text_color: model.textColor ?? undefined,
        endpoint_type: model.endpointType ?? undefined,
        credit_cost: model.creditCost ?? undefined,
        priority: model.priority ?? undefined,
        weight: model.weight ?? undefined,
        call_count: model.callCount ?? undefined,
        is_active: true,
        advanced_enabled: model.advancedEnabled ?? undefined,
        mix_with_same_model: model.mixWithSameModel ?? undefined,
        quality_pricing: model.qualityPricing ?? undefined,
      }))
    );
  }

  async loadAdminModels(force = false): Promise<void> {
    if (!isStartupStageReady(this.startupStage, 'workspace_ready')) {
      return;
    }

    const now = Date.now();

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    if (!force && now - this.lastLoadAttemptAt < AdminModelService.LOAD_RETRY_INTERVAL_MS) {
      return;
    }

    this.lastLoadAttemptAt = now;
    return this.doLoad();
  }

  async forceLoadAdminModels(): Promise<void> {
    return this.loadAdminModels(true);
  }

  private shouldFallbackToLegacyActiveCreditModels(
    error: ApiError | null | undefined,
  ): boolean {
    const errorCode = String(error?.code || '').trim();
    const errorMessage = String(error?.message || '').trim().toLowerCase();
    const has404Status = Array.isArray(error?.details)
      && error.details.some((detail) => {
        if (!detail || typeof detail !== 'object') {
          return false;
        }

        return Number((detail as { status?: unknown }).status || 0) === 404;
      });

    return errorCode === 'HTTP_404'
      || errorCode === 'NOT_FOUND'
      || has404Status
      || errorMessage.includes('404')
      || errorMessage.includes('not found');
  }

  private async readFromApi(): Promise<FlatModelRow[]> {
    const activeModelsResponse = await kkWebApiClient.listActiveModels({ accessToken: '' });
    if (activeModelsResponse.success) {
      return this.mapLegacyProviderRows(activeModelsResponse.data.items || []);
    }

    if (!this.shouldFallbackToLegacyActiveCreditModels(activeModelsResponse.error)) {
      throw new Error(activeModelsResponse.error?.message || 'Failed to load active model catalog.');
    }

    const response = await kkWebApiClient.listActiveCreditModels({ accessToken: '' });
    if (!response.success) {
      throw new Error(
        response.error?.message
        || activeModelsResponse.error?.message
        || 'Failed to load active credit models.',
      );
    }

    return this.mapLegacyProviderRows(response.data.items || []);
  }

  private normalizeHexColor(input?: string | null, fallback = '#3B82F6'): string {
    let color = (input || fallback).trim();

    if (/^[A-Fa-f0-9]{3,8}$/.test(color)) {
      color = `#${color}`;
    }

    return color;
  }

  private normalizeStyle(
    primary?: string | null,
    secondary?: string | null
  ): { colorStart: string; colorEnd: string; colorSecondary: string } {
    const colorStart = this.normalizeHexColor(primary, '#3B82F6');
    const secondaryRaw = secondary ? this.normalizeHexColor(secondary, colorStart) : '';
    const colorEnd = secondaryRaw || darkenColor(colorStart, 20);
    const colorSecondary = secondaryRaw || colorEnd;
    return { colorStart, colorEnd, colorSecondary };
  }

  private normalizeTextColor(input?: string | null): 'white' | 'black' {
    return input === 'black' ? 'black' : 'white';
  }

  private async doLoad(): Promise<void> {
    this.loadingPromise = (async () => {
      try {
        const rows: FlatModelRow[] = await this.readFromApi();

        const grouped = new Map<string, AdminProvider>();

        rows
          .filter((row) => row.is_active !== false)
          .forEach((row) => {
            const providerId = (row.provider_id || '').trim();
            const modelId = (row.model_id || '').trim();
            if (!providerId || !modelId) return;

            if (!grouped.has(providerId)) {
              grouped.set(providerId, {
                id: providerId,
                providerId,
                name: (row.provider_name || providerId).trim(),
                providerKind: (row.provider_kind as any) || 'relay',
                models: [],
              });
            }

            const provider = grouped.get(providerId)!;
            const style = this.normalizeStyle(row.color, row.color_secondary);

            provider.models.push({
              id: modelId,
              displayName: (row.display_name || modelId).trim(),
              provider: providerId,
              providerId,
              providerName: (row.provider_name || providerId).trim(),
              requestProfileId: row.request_profile_id?.trim() || undefined,
              routeStrategy: row.route_strategy || undefined,
              recordId: row.id?.trim(),
              priority: Number(row.priority || 0),
              weight: Number(row.weight || 0),
              callCount: Number(row.call_count || 0),
              colorStart: style.colorStart,
              colorEnd: style.colorEnd,
              colorSecondary: style.colorSecondary,
              textColor: this.normalizeTextColor(row.text_color),
              creditCost: Number(row.credit_cost || 0),
              advancedEnabled: Boolean(row.advanced_enabled),
              mixWithSameModel: Boolean(row.mix_with_same_model),
              qualityPricing: normalizeAdminQualityPricing(row.quality_pricing, Number(row.credit_cost || 1)),
              billingType: 'token',
              endpoint: (row.endpoint_type || 'openai').trim(),
              advantages: row.description || '',
              isSystemModel: true,
              isSystemInternal: true,
            });
          });

        this.providers = Array.from(grouped.values());

        const dedupe = new Map<string, AdminModelConfig>();
        this.providers.forEach((provider) => {
          provider.models.forEach((model) => {
            const key = `${provider.providerId}|${model.id}`;
            if (!dedupe.has(key)) {
              dedupe.set(key, model);
            }
          });
        });

        this.models = Array.from(dedupe.values());
        this.creditCatalog = buildCreditModelCatalog(this.models);

        this.modelRefreshHandler?.();

        this.notifyListeners();
      } catch (error) {
        console.error('[AdminModelService] 加载管理员模型失败:', error);
      } finally {
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  getModels(): AdminModelConfig[] {
    return this.models;
  }

  getCreditModelCatalog(): CreditModelCatalogEntry[] {
    return this.creditCatalog;
  }

  getCreditModelSpec(modelId: string, imageSize?: string | null): CreditModelSpec | undefined {
    const baseModelId = String(modelId || '').split('@')[0].trim();
    const catalog = this.creditCatalog.find((entry) => entry.id === baseModelId);
    return pickCreditModelSpec(catalog, imageSize);
  }

  getCreditRouteSnapshot(modelId: string, imageSize?: string | null) {
    const spec = this.getCreditModelSpec(modelId, imageSize);
    const resolved = this.getResolvedRoute(modelId, imageSize);
    const routeUnit = pickCreditRouteUnit(spec, resolved?.model.providerId);

    return {
      specId: spec?.id,
      routeStrategy: spec?.routeStrategy,
      routeUnitId: routeUnit?.id,
      supplierId: routeUnit?.supplierId || resolved?.model.providerId,
    };
  }

  getModelsByProvider(providerId: string): AdminModelConfig[] {
    return this.models.filter((model) => model.provider === providerId);
  }

  private parseRouteSelection(modelId: string): AdminModelRouteSelection {
    const rawId = String(modelId || '').trim();
    const parts = rawId.split('@');
    const baseModelId = (parts[0] || rawId).trim();
    const suffix = String(parts[1] || '').trim().toLowerCase();
    const systemMatch = suffix.match(/^system(?:_(.+))?$/);

    if (!systemMatch) {
      return {
        baseModelId,
        routeIndex: null,
        routeKey: null,
        hasSystemRouteSuffix: false,
      };
    }

    const rawRouteToken = String(systemMatch[1] || '').trim();
    if (!rawRouteToken) {
      return {
        baseModelId,
        routeIndex: null,
        routeKey: null,
        hasSystemRouteSuffix: true,
      };
    }

    if (/^\d+$/.test(rawRouteToken)) {
      const parsedIndex = Number(rawRouteToken) - 1;
      return {
        baseModelId,
        routeIndex: Number.isFinite(parsedIndex) && parsedIndex >= 0 ? parsedIndex : 0,
        routeKey: null,
        hasSystemRouteSuffix: true,
      };
    }

    let routeKey = rawRouteToken;
    try {
      routeKey = decodeURIComponent(rawRouteToken);
    } catch {
      routeKey = rawRouteToken;
    }

    return {
      baseModelId,
      routeIndex: null,
      routeKey: routeKey.toLowerCase(),
      hasSystemRouteSuffix: true,
    };
  }

  getRouteSelectionContext(modelId: string, imageSize?: string | null): AdminModelRouteSelectionContext {
    const selection = this.parseRouteSelection(modelId);
    const matchedModels = this.getRouteCandidates(selection.baseModelId);
    const mixedModels = matchedModels.filter((model) => model.mixWithSameModel);
    const mixedEligibleModels = mixedModels.filter((model) =>
      isAdminQualityEnabled(Boolean(model.advancedEnabled), model.qualityPricing, imageSize)
    );
    const exactModelByRouteKey =
      selection.routeKey !== null
        ? matchedModels.find(
            (model) => String(model.providerId || '').trim().toLowerCase() === selection.routeKey
          ) || null
        : null;
    const exactModel =
      exactModelByRouteKey ||
      (selection.routeIndex !== null
        ? matchedModels[selection.routeIndex] || matchedModels[0] || null
        : null);

    return {
      ...selection,
      matchedModels,
      mixedModels,
      mixedEligibleModels,
      exactModel,
      useMixedRouting:
        selection.routeKey === null &&
        (selection.routeIndex === null || selection.routeIndex === 0) &&
        mixedModels.length > 1,
    };
  }

  getModel(modelId: string): AdminModelConfig | undefined {
    const { exactModel, matchedModels } = this.getRouteSelectionContext(modelId);
    if (exactModel) return exactModel;

    const exact = this.models.find((model) => model.id === modelId);
    if (exact) return exact;

    if (matchedModels.length > 0) {
      return matchedModels[0];
    }

    return undefined;
  }

  getProvider(providerId: string): AdminProvider | undefined {
    return this.providers.find((provider) => provider.providerId === providerId);
  }

  getProviders(): AdminProvider[] {
    return this.providers;
  }

  isAdminModel(modelId: string): boolean {
    return !!this.getModel(modelId);
  }

  private sortModelsByRoutePriority(models: AdminModelConfig[]): AdminModelConfig[] {
    return [...models].sort((left, right) => {
      const priorityDiff = Number(right.priority || 0) - Number(left.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;

      const weightDiff = Number(right.weight || 0) - Number(left.weight || 0);
      if (weightDiff !== 0) return weightDiff;

      const providerDiff = String(left.provider || '').localeCompare(String(right.provider || ''));
      if (providerDiff !== 0) return providerDiff;

      return String(left.id || '').localeCompare(String(right.id || ''));
    });
  }

  getRouteCandidates(modelId: string): AdminModelConfig[] {
    const baseId = modelId.split('@')[0];
    return this.sortModelsByRoutePriority(this.models.filter((model) => model.id === baseId));
  }

  private getDisplayModelForContext(
    context: AdminModelRouteSelectionContext
  ): AdminModelConfig | null {
    if (context.useMixedRouting && context.mixedModels.length > 1) {
      return context.mixedModels[0] || context.matchedModels[0] || null;
    }

    return context.exactModel || context.matchedModels[0] || null;
  }

  private pickRandomCandidate<T>(candidates: T[]): T | null {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index] ?? candidates[0] ?? null;
  }

  private selectCheapestCandidate(
    candidates: AdminModelConfig[],
    imageSize?: string | null,
    options?: {
      onlyEnabledForRequestedSize?: boolean;
      useBaseCreditCost?: boolean;
    }
  ): ResolvedAdminModelRoute | null {
    if (candidates.length === 0) return null;

    const onlyEnabledForRequestedSize = options?.onlyEnabledForRequestedSize !== false;
    const useBaseCreditCost = options?.useBaseCreditCost === true;

    const scopedCandidates = onlyEnabledForRequestedSize
      ? candidates.filter((model) =>
          isAdminQualityEnabled(Boolean(model.advancedEnabled), model.qualityPricing, imageSize)
        )
      : candidates;

    if (scopedCandidates.length === 0) return null;

    const pricedCandidates = scopedCandidates.map((model) => ({
      model,
      creditCost: useBaseCreditCost
        ? Math.max(1, Number(model.creditCost || 1))
        : getAdminModelCreditCostForSize(
            model.creditCost,
            Boolean(model.advancedEnabled),
            model.qualityPricing,
            imageSize
          ),
      usedQualityPricing: !useBaseCreditCost,
    }));

    const lowestCost = Math.min(...pricedCandidates.map((item) => item.creditCost));
    const cheapestCandidates = pricedCandidates.filter((item) => item.creditCost === lowestCost);
    return this.pickRandomCandidate(cheapestCandidates);
  }

  private getResolvedRoute(
    modelId: string,
    imageSize?: string | null
  ): ResolvedAdminModelRoute | null {
    const context = this.getRouteSelectionContext(modelId, imageSize);
    if (context.matchedModels.length === 0) return null;

    if (context.routeKey) {
      const selected = context.exactModel;
      if (!selected) return null;
      if (
        !isAdminQualityEnabled(Boolean(selected.advancedEnabled), selected.qualityPricing, imageSize)
      ) {
        return null;
      }

      return {
        model: selected,
        creditCost: getAdminModelCreditCostForSize(
          selected.creditCost,
          Boolean(selected.advancedEnabled),
          selected.qualityPricing,
          imageSize
        ),
        usedQualityPricing: Boolean(selected.advancedEnabled),
      };
    }

    if (context.useMixedRouting) {
      const fromRequestedSize = this.selectCheapestCandidate(context.mixedModels, imageSize, {
        onlyEnabledForRequestedSize: true,
        useBaseCreditCost: false,
      });
      if (fromRequestedSize) return fromRequestedSize;

      return this.selectCheapestCandidate(context.mixedModels, imageSize, {
        onlyEnabledForRequestedSize: false,
        useBaseCreditCost: true,
      });
    }

    const selectedModel =
      context.exactModel ||
      context.matchedModels.find((model) =>
        isAdminQualityEnabled(Boolean(model.advancedEnabled), model.qualityPricing, imageSize)
      ) ||
      context.matchedModels[0];

    return {
      model: selectedModel,
      creditCost: getAdminModelCreditCostForSize(
        selectedModel.creditCost,
        Boolean(selectedModel.advancedEnabled),
        selectedModel.qualityPricing,
        imageSize
      ),
      usedQualityPricing: Boolean(selectedModel.advancedEnabled),
    };
  }

  getModelCreditCost(modelId: string, imageSize?: string | null): number {
    return this.getResolvedRoute(modelId, imageSize)?.creditCost ?? 0;
  }

  /**
   * 获取混合模式下选择的最佳供应商ID（用于调试和日志）
   */
  getSelectedProviderForModel(modelId: string, imageSize?: string | null): string | null {
    return this.getResolvedRoute(modelId, imageSize)?.model.providerId ?? null;
  }

  getModelDisplayInfo(modelId: string, imageSize?: string | null) {
    const context = this.getRouteSelectionContext(modelId, imageSize);
    const resolved = this.getResolvedRoute(modelId, imageSize);
    const displayModel =
      this.getDisplayModelForContext(context) || resolved?.model || this.getModel(modelId);
    if (!displayModel) return null;

    const isMixedRoute = context.useMixedRouting && context.mixedModels.length > 1;

    return {
      id: isMixedRoute ? `${context.baseModelId}@system` : displayModel.id,
      name: displayModel.displayName,
      displayName: displayModel.displayName,
      provider: isMixedRoute ? 'SystemProxy' : displayModel.provider,
      providerId: isMixedRoute ? undefined : displayModel.providerId,
      providerName: isMixedRoute ? 'Mixed Route' : displayModel.providerName,
      resolvedProviderId: resolved?.model.providerId,
      resolvedProviderName: resolved?.model.providerName,
      colorStart: displayModel.colorStart,
      colorEnd: displayModel.colorEnd,
      colorSecondary: displayModel.colorSecondary,
      textColor: displayModel.textColor,
      creditCost: resolved?.creditCost ?? displayModel.creditCost,
      billingType: displayModel.billingType,
      advantages:
        isMixedRoute && !displayModel.advantages
          ? `Mixed routing enabled across ${context.mixedModels.length} matching routes`
          : displayModel.advantages,
      isSystemModel: true,
      isMixedRoute,
    };
  }

  subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((listener) => listener !== callback);
    };
  }

  async broadcastCatalogUpdate(reason = 'updated'): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    await this.forceLoadAdminModels().catch((error) => {
      console.warn('[AdminModelService] Failed to refresh model catalog before broadcasting update:', error);
    });

    this.initializeBroadcastRefresh();
    if (!this.broadcastChannel) {
      return;
    }

    try {
      this.broadcastChannel.postMessage({
        event: AdminModelService.BROADCAST_EVENT,
        reason,
        ts: Date.now(),
      });
    } catch (error) {
      console.warn('[AdminModelService] Failed to broadcast model catalog update:', error);
    }
  }

  registerModelRefreshHandler(callback: (() => void) | null): void {
    this.modelRefreshHandler = callback;
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  // === Unified Model Service Logic ===
  private unifiedModels: UnifiedModel[] = [];
  private unifiedInitialized = false;
  private isRefreshingUnified = false;

  async initializeUnifiedModels(): Promise<void> {
    if (this.unifiedInitialized) return;

    keyManager.subscribe(() => {
      void this.refreshUnifiedModels();
    });

    this.loadUnifiedFromLocalCache();
    setTimeout(() => {
      void this.refreshUnifiedModels();
    }, 0);

    this.unifiedInitialized = true;
  }

  private loadUnifiedFromLocalCache(): void {
    try {
      this.unifiedModels = this.mapGlobalModels(keyManager.getGlobalModelList());
      this.notifyListeners();
      console.log('[AdminModelService] Loaded unified models from global cache:', this.unifiedModels.length);
    } catch (error) {
      console.error('[AdminModelService] Failed to load local cache for unified models:', error);
    }
  }

  async refreshUnifiedModels(): Promise<void> {
    if (this.isRefreshingUnified) return;
    this.isRefreshingUnified = true;
    try {
      await this.loadAdminModels();
      const nextModels = this.mapGlobalModels(keyManager.getGlobalModelList());
      if (JSON.stringify(this.unifiedModels) !== JSON.stringify(nextModels)) {
        this.unifiedModels = nextModels;
        this.notifyListeners();
      }
    } finally {
      this.isRefreshingUnified = false;
    }
  }

  getUnifiedModels(): UnifiedModel[] {
    return this.unifiedModels;
  }

  getUnifiedModelsByType(type: ModelType): UnifiedModel[] {
    return this.unifiedModels.filter((model) => model.type === type);
  }

  getUnifiedModel(id: string): UnifiedModel | undefined {
    return this.unifiedModels.find((model) => model.id === id);
  }

  isCreditBasedModel(id: string): boolean {
    const model = this.getUnifiedModel(id);
    if (model) {
      return model.isSystemInternal === true || model.isAdminModel === true;
    }

    return hasSystemRouteSuffix(id) && this.isAdminModel(id);
  }

  getUnifiedCreditCost(id: string): number {
    const model = this.getUnifiedModel(id);
    if (model?.isSystemInternal === true || hasSystemRouteSuffix(id)) {
      return Number(this.getModelCreditCost(id) || model?.creditCost || 0);
    }

    return Number(model?.creditCost || 0);
  }

  getUnifiedModelColors(id: string): { start: string; end: string } | null {
    const adminModel = this.getModel(id);
    if (adminModel) {
      return {
        start: adminModel.colorStart,
        end: adminModel.colorEnd,
      };
    }
    return null;
  }

  private mapGlobalModels(models: Array<ReturnType<typeof keyManager.getGlobalModelList>[number]>): UnifiedModel[] {
    const modelMap = new Map<string, UnifiedModel>();

    models.forEach((model) => {
      if (!modelMap.has(model.id)) {
        modelMap.set(model.id, this.convertGlobalModel(model));
      }
    });

    return Array.from(modelMap.values());
  }

  private convertGlobalModel(model: Array<ReturnType<typeof keyManager.getGlobalModelList>[number]>[number]): UnifiedModel {
    const adminModel = model.isSystemInternal ? this.getModel(model.id) : undefined;

    return {
      id: model.id,
      name: model.name,
      provider: model.provider,
      type: model.type as ModelType,
      isCustom: model.isCustom ?? false,
      isSystemInternal: model.isSystemInternal === true,
      isAdminModel: model.isSystemInternal === true,
      description: model.description,
      icon: model.icon,
      colorStart: model.colorStart ?? adminModel?.colorStart,
      colorEnd: model.colorEnd ?? adminModel?.colorEnd,
      creditCost: model.creditCost ?? adminModel?.creditCost,
      billingType: adminModel?.billingType,
      advantages: adminModel?.advantages,
      endpoint: adminModel?.endpoint,
    };
  }
}

export type ModelType = 'chat' | 'image' | 'video' | 'audio' | 'image+chat';

export interface UnifiedModel {
  id: string;
  name: string;
  provider: string;
  type: ModelType;
  isCustom: boolean;
  isSystemInternal?: boolean;
  isAdminModel?: boolean;
  description?: string;
  icon?: string;
  colorStart?: string;
  colorEnd?: string;
  creditCost?: number;
  billingType?: 'token' | 'per_request' | 'multiplier';
  advantages?: string;
  endpoint?: string;
}

const hasSystemRouteSuffix = (id: string): boolean => {
  const normalized = String(id || '').trim().toLowerCase();
  const suffix = normalized.includes('@') ? normalized.split('@')[1] : '';
  return suffix.startsWith('system') || suffix === 'systemproxy';
};

export const adminModelService = new AdminModelService();

