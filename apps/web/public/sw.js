// 简体中文：全局 Service Worker 静态加速与 CDN 智能降级缓存控制中心 (sw.js)

const CACHE_NAME = 'kk-static-assets-v1';
const DEGRADED_CDNS = new Map(); // 存储被降级的 CDN 地址与冷却截止时间戳

// 静态 CDN 节点备选列表
const DEFAULT_CDN_NODES = [
  'https://cdn1.kkai.plus',
  'https://cdn2.kkai.plus',
  'https://cdn3.kkai.plus'
];

let preferredCdn = ''; // 主线程广播过来的测速最优 CDN

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 监听主线程的消息广播
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SW_CDN_SET_PREFERENCE') {
    preferredCdn = String(data.preference || '').trim().replace(/\/$/, '');
    console.log('[SW] Preferred CDN updated:', preferredCdn);
  }
});

// 核心 fetch 拦截逻辑
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 0. 开发与测试环境 Bypass 安全守卫：如果是本地开发或测试环境，直接 bypass，防止干扰 Vite 热更新与 Puppeteer 自动化测试
  if (
    self.location.hostname === 'localhost' ||
    self.location.hostname === '127.0.0.1' ||
    self.location.hostname.startsWith('192.168.')
  ) {
    return;
  }

  // 1. 强同源优先过滤：对于核心入口、SW 自身以及 API 中转路由，坚决不走 CDN 且不作拦截，强同源直接通过
  if (
    url.origin === self.location.origin &&
    (url.pathname === '/' ||
     url.pathname === '/index.html' ||
     url.pathname === '/sw.js' ||
     url.pathname.startsWith('/api/') ||
     url.pathname.startsWith('/__kk_'))
  ) {
    return; // 让浏览器用默认网络行为加载
  }

  // 2. 只针对静态资源（/assets/ 版本化文件或图片等）进行加速及降级处理
  const isAsset = url.pathname.startsWith('/assets/') || 
                  /\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ico)$/i.test(url.pathname);

  if (!isAsset) {
    return;
  }

  event.respondWith(
    (async () => {
      // 3. Cache First：优先在 Cache Storage 寻找匹配项
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }

      // 4. 未命中缓存，组装 CDN 和源站的尝试链条
      const pathname = url.pathname;
      const candidates = [];

      if (preferredCdn) {
        // 如果已经通过测速确定了最优 CDN，优先使用它
        candidates.push(preferredCdn);
        // 如果最优 CDN 失败，直接降级至源站，避免依次尝试其他未测速 CDN 导致连续超时
        candidates.push(self.location.origin);
      } else {
        // 在测速完成前（即首次加载页面时），直接优先使用源站，确保首屏加载速度
        candidates.push(self.location.origin);
        DEFAULT_CDN_NODES.forEach(node => {
          candidates.push(node);
        });
      }

      // 5. 依次拉取尝试，带超时熔断
      const now = Date.now();
      for (const host of candidates) {
        // 如果该节点当前处于降级冷却状态，直接跳过它
        if (DEGRADED_CDNS.has(host)) {
          const expire = DEGRADED_CDNS.get(host);
          if (now < expire) {
            continue; // 跳过，尝试下一个
          } else {
            DEGRADED_CDNS.delete(host); // 冷却时间已过，释放
          }
        }

        const fetchUrl = `${host}${pathname}`;
        
        try {
          // 200ms 超时熔断机制：在 200ms 内如果没有成功拿到 response，则判定为超时降级
          const response = await Promise.race([
            fetch(fetchUrl, { mode: host === self.location.origin ? 'same-origin' : 'cors' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('CDNTimeout')), 200))
          ]);

          if (response && response.ok) {
            // 拉取成功！将其存入缓存，以便下一次 Cache First 命中
            cache.put(event.request, response.clone());
            return response;
          }
        } catch (err) {
          console.warn(`[SW] CDN Fetch failed or timeout on ${fetchUrl}, error:`, err.message || err);
          // 如果是非同源的 CDN 域名请求出现故障，将其标记为降级状态（冷却 5 分钟）
          if (host !== self.location.origin) {
            DEGRADED_CDNS.set(host, Date.now() + 300000); // 5分钟
          }
        }
      }

      // 6. 如果所有 CDN 及正常 fetch 链条全部宣告失败，做最后兜底尝试（强同源本地拉取）
      try {
        const fallbackResponse = await fetch(event.request);
        if (fallbackResponse && fallbackResponse.ok) {
          cache.put(event.request, fallbackResponse.clone());
        }
        return fallbackResponse;
      } catch (finalErr) {
        return new Response('Static asset load failed', { status: 503 });
      }
    })()
  );
});
