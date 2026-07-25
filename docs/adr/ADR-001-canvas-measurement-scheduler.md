# ADR-001: CanvasMeasurementScheduler 批量读写分离架构

- **状态**: accepted
- **日期**: 2026-06-25
- **决策者**: yckhw
- **相关**: Session Handoff #10, AGENTS.md §4

## 背景

KK Studio 无限画布在拖拽、平移、缩放操作期间，大量 Prompt 节点和 Image 卡片同时触发 `ResizeObserver` 回调进行高度测量。每次测量内部包含 DOM 读取（`getBoundingClientRect` / `offsetHeight`）和 DOM 写入（React setState → 样式更新），读写交替导致频繁的强制同步布局（Layout Thrashing），严重影响交互流畅度。

## 决策

实现 `CanvasMeasurementScheduler` — 一个通用的批处理测量调度器，采用"读写分离"架构：

```
┌─────────────────────────────────────────┐
│           测量调度器架构                   │
│                                          │
│  组件调用 request()                       │
│       │                                  │
│       ▼                                  │
│  ┌──────────────┐     rAF 触发           │
│  │ pendingTasks  │ ──────────────────►    │
│  │  (Map 缓存)   │                        │
│  └──────────────┘                        │
│       │                                  │
│       ▼                                  │
│  Phase 1: DOM Read（批量读取所有元素尺寸）   │
│       │                                  │
│       ▼                                  │
│  Phase 2: DOM Write（统一回调触发状态更新）  │
│                                          │
│  🔒 变换期间全局锁 (setLocked)             │
└─────────────────────────────────────────┘
```

核心设计要素：
1. **批量收集**: `request<T>(id, element, measureFn, callback)` 将测量任务存入 Map
2. **rAF 聚合**: 在单个 `requestAnimationFrame` 周期内收集所有待处理任务
3. **读写分离**: 先执行所有 `measureFn`（读），再统一执行所有 `callback`（写）
4. **交互锁定**: `setLocked(true)` 在拖拽/缩放期间取消所有测量并阻止新任务
5. **向下兼容**: 保留 `registerCallback` / `requestHeightUpdate` 等旧接口

## 备选方案

| 方案 | 优点 | 缺点 | 为何不选 |
|------|------|------|----------|
| 每个组件独立 debounce 测量 | 实现简单 | 多个 debounce 重叠导致批量失效，仍会 Thrashing | — |
| Web Worker 测量 | 完全脱离主线程 | Canvas 测量需要 DOM API，Worker 无法直接访问 | 技术限制 |
| `ResizeObserver` + `contentRect` | 浏览器原生 | contentRect 精度不足，无法满足自适应密度需求 | 精度不足 |

## 影响

- **正面影响**:
  - 消除 Layout Thrashing，大画布拖拽帧率从 20fps 提升至稳定 60fps
  - 统一的调度入口，便于全局控制和调试
  - 向下兼容，零破坏性迁移成本

- **负面影响**:
  - 增加了一层抽象，新开发者需要理解调度器概念
  - rAF 延迟（<16ms）在极少数场景下可能导致高度更新晚一帧渲染

- **迁移路径**: 无需迁移 — 新组件直接使用 `request()` API，已有组件通过旧接口兼容运行

## 相关证据

- 性能测试：`verify:canvas-performance` — 10K 节点画布，计算耗时 0.14ms ~ 0.30ms
- 契约测试：`tests/unit/canvas-measurement-guards-contract.test.ts` — 100% 通过
