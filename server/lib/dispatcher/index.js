/**
 * @file index.js
 * @module server/lib/dispatcher
 * @description 后端统一 AI 路由派发器（Dispatcher）。严格执行 14 步标准流控，
 *              完美串联积分预扣除、非标适配器动态转换、网络通信及高可靠异常退款。
 * @author KK-Studio Team
 * @version 1.5.2
 */

const fetch = require('node-fetch'); // 使用后端自带的 node-fetch 依赖
const { getPool } = require('../db');
const credits = require('../credits');
const { getModelConfig } = require('./modelRegistry');
const { getAdapter } = require('./adapterRegistry');

class BackendDispatcher {
  /**
   * 统一派发 AI 请求的核心控制方法
   * @param {string} userId 用户 ID
   * @param {object} unifiedPayload 统一的内部请求对象
   * @returns {Promise<object>} 标准化的返回结果
   */
  async dispatch(userId, unifiedPayload) {
    const pool = getPool();
    const modelId = unifiedPayload.model || 'gpt-4o-mini';
    const isImageIntent = unifiedPayload.task_type === 'image';
    const operationKey = isImageIntent ? 'image_generation' : 'chat';

    // 1. 获取模型物理绑定与适配协议配置
    const modelConfig = getModelConfig(modelId);
    const { realModelName, adapterId, providerId } = modelConfig;

    // 2. 动态加载渠道通信与私密凭证 (支持环境变量与数据库动态配置)
    const provider = await this.resolveProviderConfig(providerId, pool);

    let requiredCredits = 0;
    let currentCredits = 0;
    let creditsDeducted = false;

    try {
      // 3. 定价与原子预扣积分 (防并发负积分网闸)
      requiredCredits = await credits.getOperationCost(pool, operationKey);
      const availableCredits = await credits.getUserCredits(userId);
      if (availableCredits < requiredCredits) {
        const error = new Error('Insufficient credits.');
        error.statusCode = 402;
        error.credits = Math.max(0, availableCredits);
        error.creditsCost = requiredCredits;
        throw error;
      }

      currentCredits = await credits.deductCredits(userId, requiredCredits, operationKey);
      creditsDeducted = true;

      // 4. 调用适配器组装 HTTP 报文
      const adapter = getAdapter(adapterId);
      const transportReq = adapter.buildRequest(provider, realModelName, unifiedPayload);

      console.log(`[BackendDispatcher] 正在向渠道 [${providerId}] 派发请求. URL: ${transportReq.url} | 协议: ${adapterId}`);

      // 5. 发起物理网络请求 (设置超时控制)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒硬超时

      let response;
      try {
        response = await fetch(transportReq.url, {
          method: transportReq.method,
          headers: transportReq.headers,
          body: transportReq.body,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI 供应商请求失败 (${response.status}): ${errorText.slice(0, 300)}`);
      }

      const responseData = await response.json();
      
      // 6. 提纯模型最终的回复内容
      const content = adapter.extractContent(responseData);

      // 7. Token 用量审计入库
      const tokensUsed = responseData?.usage?.total_tokens || 0;
      if (tokensUsed > 0) {
        try {
          await credits.recordTokenUsage(userId, tokensUsed, `dispatcher:${realModelName}`);
        } catch (tokenErr) {
          console.error('[BackendDispatcher] 记录 Token 用量失败:', tokenErr);
        }
      }

      // 8. 成功响应，向前端交付轻量化数据与最新积分快照
      return {
        role: 'assistant',
        content,
        credits: currentCredits,
        creditsCost: requiredCredits,
        tokens: tokensUsed
      };

    } catch (err) {
      console.error('[BackendDispatcher Error]', err);

      // 如果积分预扣失败，或本就是积分不足错误，直接向外抛出
      if (err.statusCode === 402 || !creditsDeducted) {
        throw err;
      }

      // 9. 发生非标报错或通信超时，执行高可靠原子退款，确保零客诉
      let refundFailed = false;
      try {
        currentCredits = await credits.refundCredits(userId, requiredCredits, operationKey, currentCredits);
      } catch (refundErr) {
        refundFailed = true;
        console.error('[BackendDispatcher FATAL] 积分退款失败，需人工介入干预!', refundErr);
      }

      if (refundFailed) {
        const error = new Error('AI 请求发生异常且积分退费失败，请联系管理员介入。');
        error.statusCode = 500;
        error.refundStatus = 'manual_intervention_required';
        throw error;
      }

      // 抛出友好的错误信息，向用户说明积分已被妥善退回
      const error = new Error(`AI 请求处理失败，已安全回滚并退还 ${requiredCredits} 积分。`);
      error.statusCode = 500;
      throw error;
    }
  }

  /**
   * 动态解析渠道配置与环境变量
   */
  async resolveProviderConfig(providerId, pool) {
    // 默认兜底环境配置
    const config = {
      base_url: '',
      api_key: ''
    };

    if (providerId === 'openai-official') {
      config.base_url = 'https://api.openai.com/v1';
      config.api_key = process.env.OPENAI_API_KEY || 'mock-key-for-testing-only';
      return config;
    }

    if (providerId === 'wuyin-custom') {
      config.base_url = 'https://api.wuyinkeji.com/api/chat/index';
      config.api_key = process.env.GEMINI_API_KEY || 'mock-key-for-testing-only'; // 复用已有的密钥变量
      return config;
    }

    // 尝试从数据库加载动态配置 (管理员在后台面板中保存的渠道配置)
    try {
      const { rows } = await pool.query(
        'SELECT base_url, api_key FROM public.provider_configs WHERE provider_id = $1 AND is_enabled = true',
        [providerId]
      );
      if (rows.length > 0) {
        config.base_url = rows[0].base_url;
        config.api_key = rows[0].api_key;
        return config;
      }
    } catch (dbErr) {
      console.warn(`[BackendDispatcher] 无法从数据库动态获取渠道 ${providerId} 配置，将回退到环境变量默认值。`);
    }

    // 通用第三方中转兜底
    config.base_url = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
    config.api_key = process.env.OPENAI_API_KEY || 'mock-key-for-testing-only';
    return config;
  }
}

module.exports = new BackendDispatcher();
