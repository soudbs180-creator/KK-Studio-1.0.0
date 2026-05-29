/**
 * 简体中文注释：安全且高性能地在各种设备（特别是手机端和微信等内置环境）中打开外部链接
 * 
 * 移动端/微信环境的核心痛点及优化策略：
 * 1. 微信等内置浏览器完全封禁了 window.open，必须降级使用 window.location.href 覆盖跳转才能成功。
 * 2. 很多国产手机浏览器（小米/华为/UC/QQ等）对于异步回调中的 window.open 会强制拦截（Popup Blocker），
 *    采用动态创建虚拟 <a> 标签并追加到 DOM 手动触发 click()，能完美绕过该拦截并实现流畅跳转。
 * 3. 针对未添加 http/https 协议前缀的链接（如 www.google.com），自动补全协议，防止触发本域 404。
 * 4. 针对移动端，默认采用 location.href 或原生链接链可以避开多标签并发渲染开销，极大提升移动端加载效率。
 * 
 * @param url 目标链接
 * @param preferNewTab 是否尝试在新标签页中打开（在 PC 端默认开启，在移动端会根据环境智能决定）
 */
export function safeOpenLink(url: string | undefined | null, preferNewTab = true): void {
  if (!url) {
    return;
  }

  // 1. 净化与格式化 URL，确保具有协议头
  let targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  // 2. 浏览器环境及特定 WebView 容器检测
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
  const isMobile = /mobile|android|iphone|ipad|phone/i.test(ua);
  const isWeChat = /micromessenger/i.test(ua);
  const isWeibo = /weibo/i.test(ua);
  const isQQ = /qq\//i.test(ua);
  const isQuark = /quark/i.test(ua); // 简体中文注释：识别移动端 Quark (夸克) 浏览器

  // 3. 针对内置 WebView（微信/微博/QQ等）或者夸克浏览器，或不强制要求新标签的移动端，采用 location.href 进行直接跳转
  // 在移动端夸克等拦截策略极度严格的浏览器中，location.href 是最稳妥、100% 不会被判定为广告弹窗的极致加速方案
  if (isWeChat || isWeibo || isQQ || isQuark || (isMobile && !preferNewTab)) {
    window.location.href = targetUrl;
    return;
  }

  // 4. 移动端普通浏览器使用动态 <a> 标签模拟点击，避开 window.open 弹窗拦截规则
  if (isMobile) {
    const link = document.createElement('a');
    link.href = targetUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // 5. PC 浏览器使用标准的 window.open，并结合容错机制
  try {
    const newWindow = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
      // 若浏览器广告拦截器拦截了 newWindow，则安全降级到本窗口直接跳转，确保 100% 成功率
      window.location.href = targetUrl;
    }
  } catch (e) {
    // 极端异常场景下，以 location.href 兜底
    window.location.href = targetUrl;
  }
}
