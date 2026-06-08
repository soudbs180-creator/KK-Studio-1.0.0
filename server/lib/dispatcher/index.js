/**
 * @file index.js
 * @module server/lib/dispatcher
 * @description 后端统一 AI 路由派发器（Dispatcher）。严格执行标准流控，
 *              支持 Keep-Alive 连接复用、内存拓扑缓存、显式供应商锁定、
 *              priority-failover、weighted-random、多 Key 熔断、渠道级隔离、厂商文档契约校验及智能第三方协议适配。
 * @author KK-Studio Team
 * @version 2.4.0
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fetch = require('node-fetch');
const { getPool } = require('../db');
const credits = require('../credits');
const { getModelConfig } = require('./modelRegistry');
const { getAdapter, normalizeAdapterId } = require('./adapterRegistry');
const { matchProviderProfile } = require('./providerProfiles');
const { assertStrictTaskSupported } = require('./strictProviderContracts');

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 150,
  maxFreeSockets: 15,
  timeout: 60000,
  freeSocketTimeout: 30000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 150,
  maxFreeSockets: 15,
  timeout: 60000,
  freeSocketTimeout: 30000,
});

const ROUTE_CACHE = new Map();
const CACHE_TTL_MS = 30000;

const BREAKER_COOLDOWN_MS = 300000;
const KEY_BREAKER = new Map();
const CHANNEL_BREAKER = new Map();

const ROUTE_STRATEGIES = new Set(['priority-failover', 'weighted-random', 'parallel-race']);

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

function stableHashInt(value) {
  const hex = crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 8);
  return parseInt(hex, 16);
}

function getKeyFingerprint(key) {
  return crypto.createHash('sha256').update(String(key || '')).digest('hex');
}

function getChannelFingerprint(channel) {
  return crypto
    .createHash('sha256')
    .update(`${channel.provider_id || ''}:${channel.base_url || ''}:${channel.model_id || ''}`)
    .digest('hex');
}

function isCircuitOpen(map, fingerprint) {
  const cooldownUntil = map.get(fingerprint);
  if (cooldownUntil && cooldownUntil > Date.now()) return true;
  if (cooldownUntil) map.delete(fingerprint);
  return false;
}

function isKeyFused(key) {
  return isCircuitOpen(KEY_BREAKER, getKeyFingerprint(key));
}

function fuseBadKey(key, reason = '') {
  const fingerprint = getKeyFingerprint(key);
  KEY_BREAKER.set(fingerprint, Date.now() + BREAKER_COOLDOWN_MS);
  console.warn(`[BackendDispatcher] 密钥触发熔断隔离 300 秒。指纹前缀: ${fingerprint.slice(0, 8)}${reason ? ` | ${reason}` : ''}`);
}

function isChannelFused(channel) {
  return isCircuitOpen(CHANNEL_BREAKER, getChannelFingerprint(channel));
}

function fuseBadChannel(channel, reason = '') {
  const fingerprint = getChannelFingerprint(channel);
  CHANNEL_BREAKER.set(fingerprint, Date.now() + BREAKER_COOLDOWN_MS);
  console.warn(`[BackendDispatcher] 渠道触发熔断隔离 300 秒。provider=${channel.provider_id} model=${channel.model_id} fp=${fingerprint.slice(0, 8)}${reason ? ` | ${reason}` : ''}`);
}

function extractApiKeys(rawKeys) {
  const keys = [];
  if (Array.isArray(rawKeys)) {
    rawKeys.forEach(entry => {
      if (typeof entry === 'string' && entry.trim()) {
        keys.push(entry.trim());
      } else if (entry && typeof entry === 'object' && typeof entry.value === 'string' && entry.value.trim()) {
        keys.push(entry.value.trim());
      }
    });
  }
  return keys;
}

function isFatalProviderError(statusCode, errorText = '') {
  const normalized = String(errorText || '').toLowerCase();
  return statusCode === 401
    || statusCode === 403
    || statusCode === 404
    || statusCode === 429
    || normalized.includes('invalid_api_key')
    || normalized.includes('api_key_invalid')
    || normalized.includes('insufficient_quota')
    || normalized.includes('no available channel')
    || normalized.includes('model not found')
    || normalized.includes('not support')
    || normalized.includes('unsupported');
}

function normalizeRouteStrategy(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ROUTE_STRATEGIES.has(normalized) ? normalized : 'priority-failover';
}

function resolveRouteStrategy(channels, unifiedPayload = {}) {
  const explicit = normalizeRouteStrategy(unifiedPayload.routeStrategy || unifiedPayload.route_strategy || '');
  if (explicit !== 'priority-failover') return explicit;

  const firstConfigured = channels.find((channel) => String(channel.route_strategy || '').trim());
  return normalizeRouteStrategy(firstConfigured?.route_strategy || 'priority-failover');
}

function choosePriorityFailoverOrder(channels) {
  return [...channels].sort((left, right) => {
    const priorityDiff = Number(right.priority || 0) - Number(left.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;

    const weightDiff = Number(right.weight || 0) - Number(left.weight || 0);
    if (weightDiff !== 0) return weightDiff;

    const providerDiff = String(left.provider_id || '').localeCompare(String(right.provider_id || ''));
    if (providerDiff !== 0) return providerDiff;

    return String(left.id || '').localeCompare(String(right.id || ''));
  });
}

function chooseWeightedRandomOrder(channels, seed = '') {
  const scored = channels.map((channel, index) => {
    const weight = Math.max(1, Number(channel.weight || 1));
    const hash = (stableHashInt(`${seed}:${channel.provider_id}:${channel.id || index}:${channel.base_url}`) % 1000000) / 1000000;
    return {
      channel,
      score: Math.pow(Math.max(hash, 0.000001), 1 / weight),
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((item) => item.channel);
}

function chooseChannelOrder(channels, strategy, seed = '') {
  if (strategy === 'weighted-random') {
    return chooseWeightedRandomOrder(channels, seed);
  }

  if (strategy === 'parallel-race') {
    // 简体中文注释：parallel-race 会同时命中多个供应商，容易造成重复扣费或第三方重复消耗。
    // 在计费幂等和取消上游请求能力完善前，先安全降级为 weighted-random + failover。
    return chooseWeightedRandomOrder(channels, seed);
  }

  return choosePriorityFailoverOrder(channels);
}

function resolveChannelProfile(channel) {
  const explicitProfileId = String(channel.request_profile_id || channel.requestProfileId || '').trim();
  if (explicitProfileId) {
    return {
      id: explicitProfileId,
      source: 'request_profile_id',
    };
  }

  const matched = matchProviderProfile({
    baseUrl: channel.base_url,
    provider_id: channel.provider_id,
    provider_name: channel.provider_name,
    providerHint: channel.provider_id || channel.provider_name,
    endpoint_type: channel.endpoint_type || channel.adapterId,
  });

  return {
    id: matched?.id || '',
    source: matched?.id ? 'matched_profile' : 'unknown',
  };
}

function enforceStrictContractForChannel(channel, unifiedPayload, adapterId) {
  const profile = resolveChannelProfile(channel);
  if (!profile.id) return { profileId: null, contractTask: null };

  const taskType = unifiedPayload.task_type || 'chat';
  const modelId = channel.model_id || unifiedPayload.model;
  const contractTask = assertStrictTaskSupported(profile.id, taskType, { modelId });
  if (contractTask?.adapterId && contractTask.adapterId !== adapterId) {
    const error = new Error(`强预设 ${profile.id} 的 ${taskType} 任务必须使用 ${contractTask.adapterId}，当前为 ${adapterId}。已阻止旧逻辑污染。`);
    error.statusCode = 400;
    error.code = 'STRICT_PROVIDER_ADAPTER_MISMATCH';
    error.route = {
      profileId: profile.id,
      profileSource: profile.source,
      taskType,
      modelId,
      adapterId,
      expectedAdapterId: contractTask.adapterId,
      providerId: channel.provider_id,
      providerName: channel.provider_name,
    };
    throw error;
  }

  return { profileId: profile.id, profileSource: profile.source, contractTask };
}

class BackendDispatcher {
  parseModelRoute(modelId) {
    const rawId = String(modelId || '').trim();
    const separatorIndex = rawId.indexOf('@');
    const baseModelId = (separatorIndex >= 0 ? rawId.slice(0, separatorIndex) : rawId).trim();
    const suffix = separatorIndex >= 0 ? rawId.slice(separatorIndex + 1).trim() : '';

    let targetProviderId = null;
    if (suffix) {
      try {
        targetProviderId = decodeURIComponent(suffix).trim();
      } catch {
        targetProviderId = suffix;
      }
      targetProviderId = targetProviderId.replace(/^system_/i, '').trim();
    }
    return { baseModelId: baseModelId || rawId, targetProviderId };
  }

  async getModelChannels(pool, baseModelId) {
    const now = Date.now();
    const cached = ROUTE_CACHE.get(baseModelId);
    if (cached && cached.expiresAt > now) {
      return cached.channels;
    }

    const result = await pool.query(
      `SELECT id, provider_id, provider_name, base_url, api_keys, model_id,
              endpoint_type, request_profile_id, route_strategy, credit_cost, priority, weight, is_active,
              advanced_enabled, mix_with_same_model, quality_pricing, provider_kind
         FROM public.admin_credit_models
        WHERE model_id = $1 AND is_active = true`,
      [baseModelId]
    );

    const channels = result.rows;
    ROUTE_CACHE.set(baseModelId, {
      channels,
      expiresAt: now + CACHE_TTL_MS,
    });

    return channels;
  }

  buildFallbackChannels(modelId) {
    const modelConfig = getModelConfig(modelId);
    const { realModelName, adapterId, providerId } = modelConfig;

    let baseUrl = '';
    let apiKey = '';
    if (providerId === 'openai-official') {
      baseUrl = 'https://api.openai.com/v1';
      apiKey = process.env.OPENAI_API_KEY || 'mock-key-for-testing-only';
    } else if (providerId === 'wuyin-custom') {
      baseUrl = 'https://api.wuyinkeji.com/api/chat/index';
      apiKey = process.env.GEMINI_API_KEY || 'mock-key-for-testing-only';
    } else {
      baseUrl = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
      apiKey = process.env.OPENAI_API_KEY || 'mock-key-for-testing-only';
    }

    return [{
      provider_id: providerId,
      provider_name: providerId,
      base_url: baseUrl,
      api_keys: [apiKey],
      model_id: realModelName,
      endpoint_type: adapterId,
      request_profile_id: providerId || adapterId,
      route_strategy: 'priority-failover',
      credit_cost: null,
      priority: 0,
      weight: 1,
    }];
  }

  resolveCandidateChannels({ channels, baseModelId, modelId, targetProviderId, requestId, unifiedPayload }) {
    let matched = channels;

    if (targetProviderId) {
      const normalizedTarget = targetProviderId.toLowerCase();
      matched = channels.filter(c => String(c.provider_id || '').toLowerCase() === normalizedTarget);
      if (matched.length === 0) {
        matched = channels.filter(c => String(c.provider_id || '').toLowerCase().includes(normalizedTarget));
      }
      if (matched.length === 0) {
        const error = new Error(`用户选择的供应商不可用或未配置：${targetProviderId}`);
        error.statusCode = 400;
        error.code = 'SELECTED_PROVIDER_NOT_AVAILABLE';
        error.route = { model: baseModelId, selectedProvider: targetProviderId };
        throw error;
      }
    }

    const healthyChannels = matched.filter(channel => !isChannelFused(channel));
    const usableChannels = healthyChannels.length > 0 ? healthyChannels : matched;
    const requestedStrategy = resolveRouteStrategy(usableChannels, unifiedPayload);
    const effectiveStrategy = requestedStrategy === 'parallel-race' ? 'weighted-random' : requestedStrategy;

    return {
      channels: chooseChannelOrder(usableChannels, requestedStrategy, requestId || modelId || baseModelId),
      requestedStrategy,
      effectiveStrategy,
      parallelRaceDowngraded: requestedStrategy === 'parallel-race',
      fusedChannelCount: matched.length - healthyChannels.length,
    };
  }

  async dispatch(userId, unifiedPayload) {
    const pool = getPool();
    const modelId = unifiedPayload.model || 'gpt-4o-mini';
    const isImageIntent = unifiedPayload.task_type === 'image';
    const operationKey = isImageIntent ? 'image_generation' : 'chat';
    const requestId = unifiedPayload.requestId || unifiedPayload.attemptId || `job_${crypto.randomUUID()}`;

    const { baseModelId, targetProviderId } = this.parseModelRoute(modelId);
    let channels = [];
    try {
      channels = await this.getModelChannels(pool, baseModelId);
    } catch (dbErr) {
      console.error('[BackendDispatcher] 无法从数据库动态获取渠道配置，将使用降级兜底逻辑。', dbErr);
    }

    let routePlan = {
      channels: [],
      requestedStrategy: 'priority-failover',
      effectiveStrategy: 'priority-failover',
      parallelRaceDowngraded: false,
      fusedChannelCount: 0,
    };

    if (channels.length > 0) {
      routePlan = this.resolveCandidateChannels({
        channels,
        baseModelId,
        modelId,
        targetProviderId,
        requestId,
        unifiedPayload,
      });
    }

    if (routePlan.channels.length === 0) {
      if (targetProviderId) {
        const error = new Error(`用户选择的供应商没有可用渠道：${targetProviderId}`);
        error.statusCode = 400;
        error.code = 'SELECTED_PROVIDER_NOT_AVAILABLE';
        error.route = { model: baseModelId, selectedProvider: targetProviderId };
        throw error;
      }
      routePlan = {
        channels: this.buildFallbackChannels(baseModelId),
        requestedStrategy: 'priority-failover',
        effectiveStrategy: 'priority-failover',
        parallelRaceDowngraded: false,
        fusedChannelCount: 0,
      };
    }

    const sortedChannels = routePlan.channels;
    let requiredCredits = 0;
    const firstChannel = sortedChannels[0];
    if (firstChannel && firstChannel.credit_cost !== null && firstChannel.credit_cost !== undefined) {
      requiredCredits = Number(firstChannel.credit_cost);
    } else {
      requiredCredits = await credits.getOperationCost(pool, operationKey);
    }

    let currentCredits = 0;
    let creditsDeducted = false;

    try {
      await pool.query(
        'INSERT INTO public.billing_jobs (id, user_id, operation_key, required_credits, status) VALUES ($1, $2, $3, $4, $5)',
        [requestId, userId, operationKey, requiredCredits, 'draft']
      );

      const availableCredits = await credits.getUserCredits(userId);
      if (availableCredits < requiredCredits) {
        const error = new Error('Insufficient credits.');
        error.statusCode = 402;
        error.credits = Math.max(0, availableCredits);
        error.creditsCost = requiredCredits;

        await pool.query(
          'UPDATE public.billing_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
          ['failed', requestId]
        );
        throw error;
      }

      currentCredits = await credits.deductCredits(userId, requiredCredits, operationKey);
      creditsDeducted = true;

      await pool.query(
        'UPDATE public.billing_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
        ['pending_deducted', requestId]
      );

      let requestSuccess = false;
      let finalContent = '';
      let finalTokensUsed = 0;
      let usedChannelInfo = null;
      let usedContractInfo = null;
      let lastAttemptError = null;
      const attemptedRoutes = [];

      for (let channelIndex = 0; channelIndex < sortedChannels.length; channelIndex++) {
        const channel = sortedChannels[channelIndex];
        const extractedKeys = extractApiKeys(channel.api_keys);
        const fallbackKey = process.env.OPENAI_API_KEY || 'mock-key-for-testing-only';
        const keys = extractedKeys.length > 0 ? extractedKeys : [fallbackKey];
        const shuffledKeys = shuffle(keys);
        let keysToUse = shuffledKeys.filter(k => !isKeyFused(k));
        if (keysToUse.length === 0) {
          keysToUse = shuffledKeys;
        }

        const adapterId = normalizeAdapterId(channel.endpoint_type || channel.adapterId, channel);
        let contractInfo;
        try {
          contractInfo = enforceStrictContractForChannel(channel, unifiedPayload, adapterId);
        } catch (strictErr) {
          lastAttemptError = strictErr;
          attemptedRoutes.push({
            providerId: channel.provider_id,
            adapter: adapterId,
            requestProfileId: channel.request_profile_id || null,
            status: 'blocked_by_contract',
            error: strictErr.message,
          });
          console.warn(`[BackendDispatcher] 渠道 [${channel.provider_id}] 被文档契约阻止: ${strictErr.message}`);
          continue;
        }

        console.log(`[BackendDispatcher] 尝试渠道 [${channel.provider_name || channel.provider_id}] provider=${channel.provider_id} adapter=${adapterId} profile=${contractInfo.profileId || 'generic'} (${channelIndex + 1}/${sortedChannels.length}) strategy=${routePlan.effectiveStrategy} key=${keysToUse.length}/${shuffledKeys.length} selected=${targetProviderId || 'auto'}`);

        for (let keyIndex = 0; keyIndex < keysToUse.length; keyIndex++) {
          const currentKey = keysToUse[keyIndex];
          const activeProvider = {
            base_url: channel.base_url,
            api_key: currentKey,
          };

          try {
            const adapter = getAdapter(channel.endpoint_type || channel.adapterId, channel);
            const transportReq = adapter.buildRequest(activeProvider, channel.model_id, unifiedPayload);

            console.log(`[BackendDispatcher] Key [${keyIndex + 1}/${keysToUse.length}] 请求 URL: ${transportReq.url} | adapter=${adapterId} | profile=${contractInfo.profileId || 'generic'}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            const isHttps = transportReq.url.startsWith('https');
            const activeAgent = isHttps ? httpsAgent : httpAgent;

            let response;
            try {
              response = await fetch(transportReq.url, {
                method: transportReq.method,
                headers: transportReq.headers,
                body: transportReq.body,
                signal: controller.signal,
                agent: activeAgent,
              });
            } finally {
              clearTimeout(timeoutId);
            }

            attemptedRoutes.push({
              providerId: channel.provider_id,
              adapter: adapterId,
              requestProfileId: contractInfo.profileId || channel.request_profile_id || null,
              status: response.status,
            });

            if (!response.ok) {
              const errorText = await response.text();
              const statusCode = response.status;
              const errObj = new Error(`AI 供应商返回状态码 (${statusCode}): ${errorText.slice(0, 300)}`);
              errObj.statusCode = statusCode;
              errObj.providerErrorText = errorText;
              errObj.route = {
                model: baseModelId,
                providerId: channel.provider_id,
                providerName: channel.provider_name,
                adapter: adapterId,
                requestProfileId: contractInfo.profileId || channel.request_profile_id || null,
                requestedStrategy: routePlan.requestedStrategy,
                effectiveStrategy: routePlan.effectiveStrategy,
                strictContractChecked: Boolean(contractInfo.profileId),
                explicitProviderLocked: Boolean(targetProviderId),
              };

              if (isFatalProviderError(statusCode, errorText)) {
                fuseBadKey(currentKey, `status=${statusCode}`);
                if (statusCode === 404 || statusCode === 403 || String(errorText).toLowerCase().includes('unsupported')) {
                  fuseBadChannel(channel, `status=${statusCode}`);
                }
              }
              throw errObj;
            }

            const responseData = await response.json();
            finalContent = adapter.extractContent(responseData);
            finalTokensUsed = responseData?.usage?.total_tokens || responseData?.usage?.totalTokens || responseData?.data?.usage?.total_tokens || 0;
            usedChannelInfo = channel;
            usedContractInfo = contractInfo;
            requestSuccess = true;

            try {
              await pool.query(
                'UPDATE public.admin_credit_models SET call_count = call_count + 1, updated_at = NOW() WHERE provider_id = $1 AND model_id = $2',
                [channel.provider_id, channel.model_id]
              );
            } catch (auditErr) {
              console.error('[BackendDispatcher] 递增调用计数失败:', auditErr);
            }

            break;
          } catch (err) {
            lastAttemptError = err;
            console.warn(`[BackendDispatcher] 渠道 [${channel.provider_id}] Key [${keyIndex + 1}/${keysToUse.length}] 调用异常: ${err.message}`);
          }
        }

        if (requestSuccess) {
          break;
        }
      }

      if (!requestSuccess) {
        throw lastAttemptError || new Error('所有配置的 AI 聚合渠道及 Key 均不可用');
      }

      if (finalTokensUsed > 0 && usedChannelInfo) {
        try {
          await credits.recordTokenUsage(userId, finalTokensUsed, `dispatcher:${usedChannelInfo.model_id}`);
        } catch (tokenErr) {
          console.error('[BackendDispatcher] 记录 Token 用量失败:', tokenErr);
        }
      }

      await pool.query(
        'UPDATE public.billing_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
        ['completed', requestId]
      );

      return {
        role: 'assistant',
        content: finalContent,
        credits: currentCredits,
        creditsCost: requiredCredits,
        tokens: finalTokensUsed,
        model: usedChannelInfo?.model_id || baseModelId,
        provider: usedChannelInfo?.provider_id,
        providerName: usedChannelInfo?.provider_name,
        route: usedChannelInfo ? {
          selectedProvider: targetProviderId || null,
          providerId: usedChannelInfo.provider_id,
          providerName: usedChannelInfo.provider_name,
          adapter: normalizeAdapterId(usedChannelInfo.endpoint_type || usedChannelInfo.adapterId, usedChannelInfo),
          requestProfileId: usedContractInfo?.profileId || usedChannelInfo.request_profile_id || null,
          profileSource: usedContractInfo?.profileSource || null,
          strictContractChecked: Boolean(usedContractInfo?.profileId),
          baseModelId,
          requestedStrategy: routePlan.requestedStrategy,
          effectiveStrategy: routePlan.effectiveStrategy,
          parallelRaceDowngraded: routePlan.parallelRaceDowngraded,
          fusedChannelCount: routePlan.fusedChannelCount,
          attemptedRoutes,
          locked: Boolean(targetProviderId),
        } : undefined,
      };

    } catch (err) {
      console.error('[BackendDispatcher Error]', err);

      if (err.statusCode === 402 || !creditsDeducted) {
        throw err;
      }

      let refundFailed = false;
      try {
        currentCredits = await credits.refundCredits(userId, requiredCredits, operationKey, currentCredits);
      } catch (refundErr) {
        refundFailed = true;
        console.error('[P0 ALERT] 积分退款失败，需人工介入', {
          userId,
          jobId: requestId,
          cost: requiredCredits,
          originalError: err.message,
          refundError: refundErr.message,
          timestamp: new Date().toISOString(),
        });
      }

      if (refundFailed) {
        await pool.query(
          'UPDATE public.billing_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
          ['failed', requestId]
        );
        const error = new Error('AI 请求发生异常且积分退费失败，请联系管理员介入。');
        error.statusCode = 500;
        error.code = 'REFUND_FAILED';
        error.refundStatus = 'manual_intervention_required';
        error.route = err.route;
        throw error;
      }

      await pool.query(
        'UPDATE public.billing_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
        ['refunded', requestId]
      );

      const error = new Error(`AI 请求处理失败，已安全回滚并退还 ${requiredCredits} 积分。`);
      error.statusCode = err.statusCode || 500;
      error.code = err.code || 'AI_CHAT_FAILED';
      error.route = err.route;
      throw error;
    }
  }
}

module.exports = new BackendDispatcher();
