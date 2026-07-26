// tests/support/waitFor.js
// 职责：为异步测试提供基于条件轮询的等待，替代固定时长 sleep。
// 所有注释均使用中文。
//
// 背景：测试中大量使用 `await new Promise(r => setTimeout(r, 120))` 这类固定等待，
// 隐含假设「这段墙钟时间足够后台任务跑完」。在 CI 或本机负载高时该假设会失效，
// 表现为间歇性失败（flaky），且失败信息只有断言不符、无法看出是时序问题。
// 条件轮询把「等够时间」换成「等到条件成立」：常见情况下更快返回，
// 负载高时自动多等，超时后给出明确的诊断信息。

/**
 * 轮询直到 predicate 返回真值。
 *
 * @param {() => unknown} predicate 条件函数，返回真值即结束等待
 * @param {object} [options]
 * @param {number} [options.timeoutMs=5000] 最长等待时长
 * @param {number} [options.intervalMs=5] 轮询间隔
 * @param {string} [options.description] 超时报错时展示的条件描述
 * @param {typeof setTimeout} [options.timer] 计时器实现。测试若替换了全局
 *        setTimeout（例如把长延时压缩为 1ms），必须把**原始** setTimeout 传进来，
 *        否则轮询会被自身的替身影响。
 * @returns {Promise<void>}
 */
export async function waitFor(predicate, options = {}) {
  const {
    timeoutMs = 5000,
    intervalMs = 5,
    description = 'condition',
    timer = setTimeout,
  } = options;

  const startedAt = Date.now();

  for (;;) {
    let satisfied = false;
    try {
      satisfied = Boolean(await predicate());
    } catch (error) {
      // 条件函数在目标状态就绪前可能因空引用抛错，视为「尚未满足」继续轮询，
      // 但超时后要把最后一次错误带出来，便于定位。
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`waitFor 超时（${timeoutMs}ms）等待 ${description}，最后一次求值抛出：${error.message}`);
      }
      await new Promise((resolve) => timer(resolve, intervalMs));
      continue;
    }

    if (satisfied) return;

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`waitFor 超时（${timeoutMs}ms）等待 ${description}`);
    }

    await new Promise((resolve) => timer(resolve, intervalMs));
  }
}

export default waitFor;
