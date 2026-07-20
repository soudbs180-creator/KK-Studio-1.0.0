Status: reference

<!-- AI_ROUTING_KEY: performance, cache, culling, indexeddb, blob, memory, self-healing -->
# KK Studio 画布性能与缓存设计规范

> 规定无限画布的视口裁剪剔除（Viewport Culling）、延迟重绘，以及基于 IndexedDB 的图片离线缓存自愈。

无限画布的图片和卡片节点随创作不断膨胀。为了在海量图片下仍能保持 60 FPS 的流畅体验，项目内统一采用如下性能与缓存策略：

## 1. 画布渲染性能优化

- **视口裁剪 (Viewport Culling)**：任何超出当前无限画布可视视口边界的卡片节点（Image Node, Prompt Node）与导线，必须使用虚拟化裁剪以避免不必要的 DOM 重绘开销。
- **延迟渲染 (Lazy Repaint)**：在画布快速平移和缩放（Pan & Zoom）时，对非可见区及低频区卡片内容采用防抖延迟渲染，避免在高频操作下触发大量 DOM 树级联重绘。
- **动效红线**：禁止在画布拖拽、缩放、平移等高频渲染生命周期中混入 `transition-all` 滥用，以防引起帧率（FPS）抖动。所有物理位移与缩放应通过 `transform` 的 GPU 加速属性直接完成。

---

## 2. 统一缓存与自愈机制

为了防止因浏览器刷新或内存清理导致 Blob 链接失效或重复产生网络负载，系统规定：

- **图片离线缓存自愈 (Storage Self-Healing)**：任何参考图与生成图，如果在 IndexedDB 中已保存对应 `storageId` 的数据，图片渲染组件（如 `ReferenceThumbnail`）及 Service Worker 缓存层必须进行拦截并就地恢复还原，防止因浏览器页面刷新或 Blob 链接失效引起的断裂或重复网络下载。
- **Service Worker 离线降级 (SW Cache Fallback)**：本地静态资源及已生成的图片数据在初次下载后自动归入 SW cache，当网络离线或超时熔断时，通过本地 IndexedDB 进行静态回退，确保应用基础工作区在离线状态下依然可交互。
