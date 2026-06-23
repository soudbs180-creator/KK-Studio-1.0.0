/**
 * @file metricsCollector.js
 * @module server/lib/dispatcher
 * @description 轻量级 Router 性能指标统计收集器。
 *              收集总请求数、成功/失败率、各模型与供应商的 Latency 等信息。
 */

class MetricsCollector {
  constructor() {
    this.totalRequests = 0;
    this.successRequests = 0;
    this.failedRequests = 0;
    
    // 全局响应耗时滑动窗口，保留最近 200 次请求
    this.latencyWindowSize = 200;
    this.latencyHistory = [];

    // 模型统计：key 为 modelId，值为 { total, success, failed, latencyHistory }
    this.modelMetrics = new Map();

    // 供应商统计：key 为 providerId，值为 { total, success, failed, latencyHistory }
    this.providerMetrics = new Map();

    // 路由统计：key 为 routePath，值为 { total, success, failed, latencyHistory }
    this.routeMetrics = new Map();
  }

  /**
   * 记录一次 API 请求指标
   * @param {object} param
   * @param {string} param.modelId 模型 ID
   * @param {string} param.providerId 供应商 ID
   * @param {boolean} param.success 是否成功
   * @param {number} param.latency 响应时间 (ms)
   */
  recordRequest({ modelId, providerId, success, latency }) {
    this.totalRequests++;
    if (success) {
      this.successRequests++;
    } else {
      this.failedRequests++;
    }

    if (typeof latency === 'number' && latency >= 0) {
      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > this.latencyWindowSize) {
        this.latencyHistory.shift();
      }
    }

    // 统计模型
    if (modelId) {
      if (!this.modelMetrics.has(modelId)) {
        this.modelMetrics.set(modelId, { total: 0, success: 0, failed: 0, latencyHistory: [] });
      }
      const modelStat = this.modelMetrics.get(modelId);
      modelStat.total++;
      if (success) modelStat.success++;
      else modelStat.failed++;
      
      if (typeof latency === 'number' && latency >= 0) {
        modelStat.latencyHistory.push(latency);
        if (modelStat.latencyHistory.length > this.latencyWindowSize) {
          modelStat.latencyHistory.shift();
        }
      }
    }

    // 统计供应商
    if (providerId) {
      if (!this.providerMetrics.has(providerId)) {
        this.providerMetrics.set(providerId, { total: 0, success: 0, failed: 0, latencyHistory: [] });
      }
      const providerStat = this.providerMetrics.get(providerId);
      providerStat.total++;
      if (success) providerStat.success++;
      else providerStat.failed++;

      if (typeof latency === 'number' && latency >= 0) {
        providerStat.latencyHistory.push(latency);
        if (providerStat.latencyHistory.length > this.latencyWindowSize) {
          providerStat.latencyHistory.shift();
        }
      }
    }
  }

  /**
   * 记录一次路由请求的指标
   * @param {object} param
   * @param {string} param.routePath 路由路径
   * @param {boolean} param.success 是否成功
   * @param {number} param.latency 响应时间 (ms)
   */
  recordRouteCall({ routePath, success, latency }) {
    if (!routePath) return;
    if (!this.routeMetrics.has(routePath)) {
      this.routeMetrics.set(routePath, { total: 0, success: 0, failed: 0, latencyHistory: [] });
    }
    const stat = this.routeMetrics.get(routePath);
    stat.total++;
    if (success) {
      stat.success++;
    } else {
      stat.failed++;
    }

    if (typeof latency === 'number' && latency >= 0) {
      stat.latencyHistory.push(latency);
      if (stat.latencyHistory.length > this.latencyWindowSize) {
        stat.latencyHistory.shift();
      }
    }
  }

  /**
   * 获取所有性能指标
   */
  getMetrics() {
    const avgLatency = this.latencyHistory.length > 0
      ? Math.round(this.latencyHistory.reduce((sum, val) => sum + val, 0) / this.latencyHistory.length)
      : 0;

    const models = {};
    for (const [modelId, stat] of this.modelMetrics.entries()) {
      const avg = stat.latencyHistory.length > 0
        ? Math.round(stat.latencyHistory.reduce((sum, val) => sum + val, 0) / stat.latencyHistory.length)
        : 0;
      models[modelId] = {
        total: stat.total,
        success: stat.success,
        failed: stat.failed,
        successRate: stat.total > 0 ? parseFloat((stat.success / stat.total).toFixed(4)) : 0,
        averageLatencyMs: avg,
      };
    }

    const providers = {};
    for (const [providerId, stat] of this.providerMetrics.entries()) {
      const avg = stat.latencyHistory.length > 0
        ? Math.round(stat.latencyHistory.reduce((sum, val) => sum + val, 0) / stat.latencyHistory.length)
        : 0;
      providers[providerId] = {
        total: stat.total,
        success: stat.success,
        failed: stat.failed,
        successRate: stat.total > 0 ? parseFloat((stat.success / stat.total).toFixed(4)) : 0,
        averageLatencyMs: avg,
      };
    }

    const routes = {};
    for (const [routePath, stat] of this.routeMetrics.entries()) {
      const avg = stat.latencyHistory.length > 0
        ? Math.round(stat.latencyHistory.reduce((sum, val) => sum + val, 0) / stat.latencyHistory.length)
        : 0;
      routes[routePath] = {
        total: stat.total,
        success: stat.success,
        failed: stat.failed,
        successRate: stat.total > 0 ? parseFloat((stat.success / stat.total).toFixed(4)) : 0,
        averageLatencyMs: avg,
      };
    }

    return {
      global: {
        totalRequests: this.totalRequests,
        successRequests: this.successRequests,
        failedRequests: this.failedRequests,
        successRate: this.totalRequests > 0 ? parseFloat((this.successRequests / this.totalRequests).toFixed(4)) : 0,
        averageLatencyMs: avgLatency,
      },
      models,
      providers,
      routes,
    };
  }

  /**
   * 重置所有指标
   */
  reset() {
    this.totalRequests = 0;
    this.successRequests = 0;
    this.failedRequests = 0;
    this.latencyHistory = [];
    this.modelMetrics.clear();
    this.providerMetrics.clear();
    this.routeMetrics.clear();
  }
}

module.exports = new MetricsCollector();
