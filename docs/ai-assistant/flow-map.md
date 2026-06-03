# 流程地图 (Flow Map)

本文件整理了 KK Studio v1.5.3 的核心工作流流转路径。

---

## 1. 下载选中卡片原图工作流

用户触发：“打包下载我选中的图” / “下载这些卡片的原图”

```mermaid
graph TD
    User([用户在画布框选卡片并输入下载指令]) --> IntentGate[IntentGate 识别下载意图及 scope=selected_cards]
    IntentGate --> ToolCall[调用 assets.zipOriginals 工具]
    ToolCall --> SelectedNodes[CanvasContext 读取 selectedNodeIds]
    SelectedNodes --> ParseImages[解析所选图片卡片及 Prompt 卡片的子图像]
    ParseImages --> Deduplicate[卡片去重并收集 GeneratedImage 对象]
    Deduplicate --> ResolveOriginal{解析原图源}
    ResolveOriginal -- 1. originalUrl 存在 --> DownloadOrig[请求下载 originalUrl]
    ResolveOriginal -- 2. apiResultUrl 存在 --> DownloadApi[请求下载 apiResultUrl]
    ResolveOriginal -- 3. url 存在 --> DownloadUrl[请求下载 url]
    ResolveOriginal -- 4. 只有 storageId --> LoadLocal[从 IndexedDB 恢复物理图文件]
    ResolveOriginal -- 5. 均不存在 --> MarkFailed[标记下载失败, 写入 failedItems]
    DownloadOrig --> Zip[加入 ZIP 压缩包]
    DownloadApi --> Zip
    DownloadUrl --> Zip
    LoadLocal --> Zip
    MarkFailed --> Manifest[写入 manifest.json 记录原因]
    Zip --> Manifest
    Manifest --> TriggerSave([通过浏览器触发 zip 下载保存])
```

### Implementation update - 2026-06-03

The selected-original download path is implemented by:

- `apps/web/src/features/assets/resolveOriginalAssets.ts`
- `apps/web/src/features/assets/zipOutputs.ts`
- `apps/web/src/features/ai-takeover/core/toolRegistry.ts`

Runtime rule: `selected_cards` never means all canvases. It means the current `selectedNodeIds`; selected Prompt cards expand to their child image nodes. The ZIP source resolver tries `originalUrl`, then `apiResultUrl`, then `url`, then `storageId`, then local asset recovery. `manifest.json` is always written, including manifest-only archives when every download fails.

---

## 2. 批量生成并自动整理工作流

用户触发：“批量生成 30 张头像，整理成卡片组”

```mermaid
graph TD
    User([用户输入批量生成指令]) --> IntentGate[IntentGate 识别批量意图]
    IntentGate --> Planner[Planner 制定 BatchGenerationPlan]
    Planner --> CostCheck[ConfirmationPolicy 评估积分消耗与成本确认]
    CostCheck --> UserConfirm{用户确认执行计划?}
    UserConfirm -- 取消 --> Cancel([取消任务并友好推荐备选方案])
    UserConfirm -- 确认 --> Queue[任务推入 DurableGenerationQueue 持久队列]
    Queue --> Loop[限速及并发控制器提取任务]
    Loop --> CreateCard[在画布中心偏移位置创建 Prompt 卡片置于 queued 状态]
    CreateCard --> ExecuteGen[调用 executeGeneration 激活倒计时与生成接口]
    ExecuteGen --> Response{服务器返回图片结果?}
    Response -- 成功 --> AddImageNode[保存原图并创建 Image 卡片连结至 Prompt 节点]
    Response -- 失败 --> Refund[回滚扣除的积分并标记 Prompt 卡片 error]
    AddImageNode --> AutoArrange[canvas.arrangeNodes 按 grid 排列该批次节点]
    AutoArrange --> TagNode[为对应节点打上 automation 和 batch:jobId 标签]
    TagNode --> Loop
```
