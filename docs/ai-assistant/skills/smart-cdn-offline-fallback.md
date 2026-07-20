Status: reference

# Skill: 智能 CDN 与离线回退 (smart-cdn-offline-fallback)

## 触发场景 (Trigger)
- 页面初始化加载、刷新或更新，Service Worker（SW）拦截应用的版本化静态资源（JS, CSS, Font, Image, JSON）请求时。
- 静态网络条件发生变化，或当前选择的 CDN 服务出现波动/不可用时。

## 前置条件 (Preconditions)
- 浏览器支持并已成功注册激活 Service Worker。
- 系统具备多 CDN 节点清单以及同源服务器（Origin Server）兜底。

## 调用工具 (Tools)
- `sw.cacheFirst`：首先从 Cache Storage 获取匹配的缓存响应。
- `sw.fetchWithFallback`：通过多链路（CDN 优先，同源兜底）发起网络请求，并在任一链路失败时自动回退。
- `window.postMessageToSW`：主线程向 SW 广播 CDN 性能探测结果。

## 执行步骤 (Steps)
1. **拦截与路由判别**：
   - Service Worker 拦截发出的 Fetch 请求。
   - **同源优先白名单**：如果请求资源属于核心入口资源（如 `index.html`、`sw.js`、`version.json`、`manifest.json`），则**绝对不**进行 CDN 改写，直接从同源服务器请求，确保入口的准确性。
   - 如果属于其他版本化静态资源，则进入步骤 2。
2. **缓存查找 (Cache First)**：
   - 检查 Cache Storage 中是否存在对应缓存。
   - 若存在且缓存包含有效的版本元数据（如 `x-sw-app-version` 等于当前版本），直接返回缓存响应，加载结束。
   - 若不存在，则进入步骤 3。
3. **多 CDN 智能请求**：
   - 根据主线程之前同步的 CDN 偏好（通过 `SW_CDN_SET_PREFERENCE` 消息），对可用 CDN 列表进行排序。
   - 优先向延迟最低、状态最佳的 CDN 发起请求。
   - 如果 CDN 响应在 200ms 内未返回，或者返回 404/5xx 错误、甚至返回了异常的 HTML 页面（CDN 劫持）：
     - **降级与回退**：立即暂停该请求，回退到当前同源服务器拉取，确保用户正常打开。
     - **CDN 临时降级**：将此 CDN 节点标记为“故障”，在接下来的短时间内（如 5 分钟）禁止对其进行优先排序，避免重复尝试。
4. **缓存填充**：
   - 请求成功后，将最新的健康响应写入 Cache Storage，并附带当前应用版本号作为元数据，防止缓存漂移。

## 安全与校验规则 (Safety & Integrity)
- **缓存清理**：如果检测到缓存项损坏、元数据不匹配或包含了 HTML 错误页，SW 必须立即静默删除该缓存项。
- **防止劫持**：网络返回的 Response 头如果非空但缺少预期的内容类型（如本应是 JS 却返回了 text/html），一律视为异常并立即回退到同源服务器。

## 验证方式 (Validation)
- **模拟 CDN 故障测试**：利用拦截工具模拟 CDN 返回 502 错误，页面应该无感完成加载，控制台 SW 日志应显示 `[SW] CDN failed, falling back to origin`。
- **同源优先验证**：检查 `index.html` 载入，其网络源站必须为 KK Studio 同源主机名，不被 CDN 重写。
