/**
 * @file index.js
 * @module server/lib/dispatcher
 * @description 后端统一 AI 路由派发器（Dispatcher）。严格执行标准流控，
 *              支持 Keep-Alive 连接复用、内存拓扑极速缓存、均匀洗牌算法及坏 Key 自动熔断冷却。
 * @author KK-Studio Team
 * @version 1.5.4
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fetch = require('node-fetch'); // 使用后端自带的 node-fetch 依赖
const { getPool } = require('../db');
const credits = require('../credits');
const { getModelConfig } = require('./modelRegistry');
const { getAdapter } = require('./adapterRegistry');

// 1. 建立全局高性能 HTTP/HTTPS 连接复用池，杜绝大并发下 TCP 端口耗尽
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 150,
  maxFreeSockets: 15,
  timeout: 60000,
  freeSocketTimeout: 30000
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 150,
  maxFreeSockets: 15,
  timeout: 60000,
  freeSocketTimeout: 30000
});

// 2. 建立极速内存拓扑缓存层，消除高频对话时频繁物理查询数据库的 I/O 延迟
const ROUTE_CACHE = new Map();
const CACHE_TTL_MS = 30000; // 配置缓存 30 秒

// 3. 建立内存坏 Key 熔断冷却器，防范并发请求持续尝试坏 Key 产生性能滑坡
const BREAKER_COOLDOWN_MS = 300000; // 发生 401/429 时熔断冷却 5 分钟
const KEY_BREAKER = new Map(); // 记录 fingerprint -> cooldown_timestamp

/**
 * 严格且均匀的 O(N) 洗牌算法，确保 API Key 分摊绝对均匀
 */
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

/**
 * 获取 Key 的 SHA256 指纹，防止在日志或熔断器中直接泄露明文密钥
 */
function getKeyFingerprint(key) {
  return crypto.createHash('sha256').update(String(key || '')).digest('hex');
}

/**
 * 校验 API Key 是否处于熔断冷却中
 */
function isKeyFused(key) {
  const fingerprint = getKeyFingerprint(key);
  const cooldownUntil = KEY_BREAKER.get(fingerprint);
  if (cooldownUntil && cooldownUntil > Date.now()) {
    return true;
  }
  if (cooldownUntil) {
    KEY_BREAKER.delete(fingerprint); // 冷却时间已过，自动释放
  }
  return false;
}

/**
 * 将故障 Key 熔断隔离
 */
function fuseBadKey(key) {
  const fingerprint = getKeyFingerprint(key);
  KEY_BREAKER.set(fingerprint, Date.now() + BREAKER_COOLDOWN_MS);
  console.warn(`[BackendDispatcher] 密钥触发熔断机制，已物理隔离 300 秒。指纹前缀: ${fingerprint.slice(0, 8)}`);
}

class BackendDispatcher {
  /**
   * 解析模型路由别名，支持 "model@provider" 和 "model@system_provider" 格式
   * @param {string} modelId 模型别名 ID
   */
  parseModelRoute(modelId) {
    const rawId = String(modelId || '').trim();
    const parts = rawId.split('@');
    const baseModelId = (parts[0] || rawId).trim();
    const suffix = String(parts[1] || '').trim();

    let targetProviderId = null;
    if (suffix) {
      const providerMatch = suffix.match(/^(?:system_)?(.+)$/i);
      if (providerMatch) {
        targetProviderId = providerMatch[1].trim();
      }
    }
    return { baseModelId, targetProviderId };
  }

  /**
   * 读缓存或查数据库以获取特定模型已激活的渠道拓扑
   */
  async getModelChannels(pool, baseModelId) {
    const now = Date.now();
    const cached = ROUTE_CACHE.get(baseModelId);
    if (cached && cached.expiresAt > now) {
      return cached.channels;
    }

    const result = await pool.query(
      `SELECT id, provider_id, provider_name, base_url, api_keys, model_id, 
              endpoint_type, credit_cost, priority, weight, is_active,
              advanced_enabled, mix_with_same_model, quality_pricing, provider_kind
         FROM public.admin_credit_models
        WHERE model_id = $1 AND is_active = true`,
      [baseModelId]
    );

    const channels = result.rows;
    ROUTE_CACHE.set(baseModelId, {
      channels,
      expiresAt: now + CACHE_TTL_MS
    });

    return channels;
  }

  /**
   * 统一派发 AI 请求的核心控制方法，集成连接池复用、负载均衡、多 Key 轮询熔断及渠道 Failover
   * @param {string} userId 用户 ID
   * @param {object} unifiedPayload 统一的内部请求对象
   * @returns {Promise<object>} 标准化的返回结果
   */
  async dispatch(userId, unifiedPayload) {
    const pool = getPool();
    const modelId = unifiedPayload.model || 'gpt-4o-mini';
    const isImageIntent = unifiedPayload.task_type === 'image';
    const operationKey = isImageIntent ? 'image_generation' : 'chat';

    // 1. 解析别名路由并获取所有激活的候选渠道
    const { baseModelId, targetProviderId } = this.parseModelRoute(modelId);
    let channels = [];
    try {
      channels = await this.getModelChannels(pool, baseModelId);
    } catch (dbErr) {
      console.error('[BackendDispatcher] 无法从数据库动态获取渠道配置，将使用降级兜底逻辑。', dbErr);
    }

    let sortedChannels = [];

    if (channels.length > 0) {
      let matched = channels;
      if (targetProviderId) {
        matched = channels.filter(c => c.provider_id.toLowerCase() === targetProviderId.toLowerCase());
        if (matched.length === 0) {
          matched = channels.filter(c => c.provider_id.toLowerCase().includes(targetProviderId.toLowerCase()));
        }
      }
      // 按 priority 降序排序，若 priority 相同则按 weight 降序排序
      sortedChannels = [...matched].sort((a, b) => {
        const pDiff = Number(b.priority || 0) - Number(a.priority || 0);
        if (pDiff !== 0) return pDiff;
        return Number(b.weight || 0) - Number(a.weight || 0);
      });
    }

    // 优雅降级：如果数据库或缓存中未配置任何可用渠道，回退至硬编码与环境变量配置
    if (sortedChannels.length === 0) {
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

      sortedChannels = [{
        provider_id: providerId,
        provider_name: providerId,
        base_url: baseUrl,
        api_keys: [apiKey],
        model_id: realModelName,
        endpoint_type: adapterId,
        credit_cost: null
      }];
    }

    // 2. 积分定价：优先使用查到的模型个性化扣除，否则兜底采用通用的 credits 接口
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
      // 3. 生成此 AI 请求对应的唯一任务流水单 ID 并写入草稿状态 (Saga Draft)
      const jobId = unifiedPayload.requestId || unifiedPayload.attemptId || `job_${crypto.randomUUID()}`;
      await pool.query(
        'INSERT INTO public.billing_jobs (id, user_id, operation_key, required_credits, status) VALUES ($1, $2, $3, $4, $5)',
        [jobId, userId, operationKey, requiredCredits, 'draft']
      );

      const availableCredits = await credits.getUserCredits(userId);
      if (availableCredits < requiredCredits) {
        const error = new Error('Insufficient credits.');
        error.statusCode = 402;
        error.credits = Math.max(0, availableCredits);
        error.creditsCost = requiredCredits;
        
        await pool.query(
          'UPDATE public.billing_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
          ['failed', jobId]
        );
        throw error;
      }

      currentCredits = await credits.deductCredits(userId, requiredCredits, operationKey);
      creditsDeducted = true;

      // 预扣除成功，将任务单置为已扣除待执行 (Saga Pending Deducted)
      await pool.query(
        'UPDATE public.billing_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
        ['pending_deducted', jobId]
      );

      let requestSuccess = false;
      let finalContent = '';
      let finalTokensUsed = 0;
      let usedChannelInfo = null;
      let lastAttemptError = null;

      // 4. 多渠道容灾重试 (Failover)：遍历候选渠道列表
      for (let channelIndex = 0; channelIndex < sortedChannels.length; channelIndex++) {
        const channel = sortedChannels[channelIndex];
        
        // 提取该渠道的所有可用 API Key (支持 string 或 带有 value 属性的 object 结构)
        const rawKeys = channel.api_keys;
        let keys = [];
        if (Array.isArray(rawKeys)) {
          rawKeys.forEach(entry => {
            if (typeof entry === 'string' && entry.trim()) {
              keys.push(entry.trim());
            } else if (entry && typeof entry === 'object' && entry.value && entry.value.trim()) {
              keys.push(entry.value.trim());
            }
          });
        }
        
        if (keys.length === 0) {
          keys = [process.env.OPENAI_API_KEY || 'mock-key-for-testing-only'];
        }

        // 使用 Fisher-Yates 算法进行均匀洗牌，摊平多 Key 的并发压力
        const shuffledKeys = shuffle(keys);

        // 过滤熔断中的故障 Key
        let keysToUse = shuffledKeys.filter(k => !isKeyFused(k));
        if (keysToUse.length === 0) {
          // 极度严苛的容灾保护：如果所有 Key 均被熔断，则降级尝试所有 Key，防止误判导致服务完全不可用
          keysToUse = shuffledKeys;
        }

        console.log(`[BackendDispatcher] 正在尝试渠道 [${channel.provider_name || channel.provider_id}] (第 ${channelIndex + 1}/${sortedChannels.length} 个渠道)，可用 Key 数量 (熔断后): ${keysToUse.length}/${shuffledKeys.length}.`);

        // 5. 遍历 API Key 进行重试
        for (let keyIndex = 0; keyIndex < keysToUse.length; keyIndex++) {
          const currentKey = keysToUse[keyIndex];
          const activeProvider = {
            base_url: channel.base_url,
            api_key: currentKey
          };

          try {
            const adapter = getAdapter(channel.endpoint_type || channel.adapterId);
            const transportReq = adapter.buildRequest(activeProvider, channel.model_id, unifiedPayload);

            console.log(`[BackendDispatcher] Key [${keyIndex + 1}/${keysToUse.length}] 物理请求 URL: ${transportReq.url} | 协议: ${channel.endpoint_type}`);

            // 6. 网络连接池复用与硬超时控制
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒硬超时

            const isHttps = transportReq.url.startsWith('https');
            const activeAgent = isHttps ? httpsAgent : httpAgent;

            let response;
            try {
              response = await fetch(transportReq.url, {
                method: transportReq.method,
                headers: transportReq.headers,
                body: transportReq.body,
                signal: controller.signal,
                agent: activeAgent // 传递 Keep-Alive 连接池代理
              });
            } finally {
              clearTimeout(timeoutId);
            }

            if (!response.ok) {
              const errorText = await response.text();
              const statusCode = response.status;
              const errObj = new Error(`AI 供应商返回状态码 (${statusCode}): ${errorText.slice(0, 300)}`);
              
              // 如果返回 401 或者是 429 或者是服务封禁，触发 Key 熔断冷却隔离，下一次派发时直接跳过此 Key
              if (statusCode === 401 || statusCode === 429 || errorText.includes('invalid_api_key') || errorText.includes('insufficient_quota')) {
                fuseBadKey(currentKey);
              }
              throw errObj;
            }

            const responseData = await response.json();
            
            // 提纯模型最终的回复内容
            finalContent = adapter.extractContent(responseData);
            finalTokensUsed = responseData?.usage?.total_tokens || 0;
            usedChannelInfo = channel;
            requestSuccess = true;

            // 增加该渠道的物理调用次数审计计数
            try {
              await pool.query(
                'UPDATE public.admin_credit_models SET call_count = call_count + 1, updated_at = NOW() WHERE provider_id = $1 AND model_id = $2',
                [channel.provider_id, channel.model_id]
              );
            } catch (auditErr) {
              console.error('[BackendDispatcher] 递增调用计数失败:', auditErr);
            }

            break; // 调用成功，跳出 Key 循环
          } catch (err) {
            lastAttemptError = err;
            console.warn(`[BackendDispatcher] 渠道 [${channel.provider_id}] Key [${keyIndex + 1}/${keysToUse.length}] 调用异常: ${err.message}`);
          }
        }

        if (requestSuccess) {
          break; // 调用成功，跳出渠道循环 (容灾 Failover 结束)
        }
      }

      if (!requestSuccess) {
        throw lastAttemptError || new Error('所有配置的 AI 聚合渠道及 Key 均不可用');
      }

      // 7. Token 用量审计入库
      if (finalTokensUsed > 0 && usedChannelInfo) {
        try {
          await credits.recordTokenUsage(userId, finalTokensUsed, `dispatcher:${usedChannelInfo.model_id}`);
        } catch (tokenErr) {
          console.error('[BackendDispatcher] 记录 Token 用量失败:', tokenErr);
        }
      }

      // 正常响应成功，将 Saga 任务状态标记为已完成
      await pool.query(
        'UPDATE public.billing_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
        ['completed', jobId]
      );

      // 8. 成功响应，向前端交付轻量化数据与最新积分快照
      return {
        role: 'assistant',
        content: finalContent,
        credits: currentCredits,
        creditsCost: requiredCredits,
        tokens: finalTokensUsed
      };

    } catch (err) {
      console.error('[BackendDispatcher Error]', err);

      if (err.statusCode === 402 || !creditsDeducted) {
        throw err;
      }

      const jobId = unifiedPayload.requestId || unifiedPayload.attemptId;

      // 9. 发生非标报错或通信超时，执行高可靠原子退款，确保零客诉
      let refundFailed = false;
      try {
        currentCredits = await credits.refundCredits(userId, requiredCredits, operationKey, currentCredits);
      } catch (refundErr) {
        refundFailed = true;
        console.error('[P0 ALERT] 积分退款失败，需人工介入', {
          userId,
          jobId,
          cost: requiredCredits,
          originalError: err.message,
          refundError: refundErr.message,
          timestamp: new Date().toISOString()
        });
      }

      if (refundFailed) {
        if (jobId) {
          await pool.query(
            'UPDATE public.billing_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['failed', jobId]
          );
        }
        const error = new Error('AI 请求发生异常且积分退费失败，请联系管理员介入。');
        error.statusCode = 500;
        error.code = 'REFUND_FAILED';
        error.refundStatus = 'manual_intervention_required';
        throw error;
      }

      if (jobId) {
        // 原子退款成功，更新流水状态为 refunded
        await pool.query(
          'UPDATE public.billing_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
          ['refunded', jobId]
        );
      }

      // 抛出友好的错误信息，向用户说明积分已被妥善退回
      const error = new Error(`AI 请求处理失败，已安全回滚并退还 ${requiredCredits} 积分。`);
      error.statusCode = 500;
      error.code = 'AI_CHAT_FAILED';
      throw error;
    }
  }
}

module.exports = new BackendDispatcher();
