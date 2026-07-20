Status: historical

# Review Blocks - 2026-04-12

本文件用于把本轮“近两天未完成项收口”整理成可审查的交付块。

当前工作区不是一个可直接合并的单一变更，而是多个主线同时收口后的混合状态。下面的分块优先用于：

- 继续拆提交
- 做定向 code review
- 判断哪些共享文件需要最后再一起归并

## Shared Surfaces

以下文件跨多个主线共用，不建议直接按路径粗暴拆提交：

- `src/App.tsx`
- `src/components/layout/PromptBar.tsx`
- `src/types.ts`

这三个文件建议在其余专属块确认后，再做一次最终人工归并检查。

### Shared Ownership Map

下面这张归属图用于最后一轮拆分时快速判断“某段共享改动应该归哪条主线”：

- `src/App.tsx`
  - `partial-redraw`:
    - `buildPartialRedrawReferenceImage`
    - `onPartialRedraw`
    - `GenerationMode.REDRAW`
    - 重绘连接线颜色兼容 `REDRAW || INPAINT`
  - `ecommerce-mode`:
    - `EcommerceRuntimeState`
    - `analyzeEcommerceRequirementFile`
    - `resolveEcommercePromptNodeMetadata`
    - `handlePick/Analyze/ConfirmEcommerce*`
    - 非移动端 `PromptBar` 的电商 props
  - `mobile-shell`:
    - `MobileAppShell`
    - `MobileResultFeed`
    - `mobileHeader / mobileFeed / mobileComposer / overlays`
  - `prompt-optimizer`:
    - 只限去模板化配置清理和 `optimizePromptForImage` 调用整理
  - `not-in-scope-for-this-round`:
    - `createAppRootMode`
    - 任何明显属于 `kkai local edition` / 登录后台独立工程的逻辑

- `src/components/layout/PromptBar.tsx`
  - `ecommerce-mode`:
    - `DesktopComposerEcommercePanel`
    - `ecommerceRequirementFileName`
    - `ecommerceAnalysis`
    - `isEcommerceAllowedModel`
    - `ecommerceRatioOverride`
  - `desktop-settings`:
    - 发送按钮动效收敛
    - mode switcher 动效收敛
    - 桌面 composer 布局更 calm 的视觉收尾
  - `prompt-optimizer`:
    - 删除 prompt library / legacy optimizer config 痕迹
  - `shared-shell`:
    - `PromptBarTopRow`
    - `PromptBarFooter`
    - `DesktopComposerModePanel`
    - 这部分如果没有明确主线目标，建议最后统一归并

- `src/types.ts`
  - `partial-redraw`:
    - `GenerationMode.REDRAW`
    - `NormalizedRect`
    - `PartialRedrawMetadata`
    - `PartialRedrawRequest`
    - `GeneratedImage.partialRedraw`
    - `PromptNode.partialRedraw`
  - `ecommerce-mode`:
    - `GenerationMode.ECOMMERCE`
    - `EcommercePromptState`
    - 相关 ecommerce refs / stage / policy 类型
    - `PromptNode.ecommerce`
  - `prompt-optimizer`:
    - 去掉 `PromptOptimizationMode`
    - `meta.optimization_mode?: 'auto'`
  - `shared-foundation`:
    - 如果某个类型同时被两条主线消费，优先留到最后统一归并

- `src/components/settings/SettingsPanel.localized.tsx`
  - 当前更接近 `desktop-settings`
  - 但里面混有 `api-management` 的 legacy redirect 和管理员入口归并
  - 如果要拆提交，建议和 `src/routes/settingsRoutes.tsx` 一起处理，不要单拆

- `src/routes/settingsRoutes.tsx`
  - `desktop-settings`:
    - `consumption-records` 命名和路由整理
    - legacy settings redirect
  - `not-in-scope-for-this-round`:
    - `KKAI_FEATURE_FLAGS` 明显更接近 `kkai local edition`
  - 建议：本文件最后统一人工归并，不要早拆

- `tests/unit/prompt-bar-layout-regression.test.ts`
  - `desktop-settings`: footer wrap / motion 收敛
  - `ecommerce-mode`: dedicated ecommerce panel wiring
  - 建议：和 `PromptBar.tsx` 一起最后归并

### Shared File Notes

- `PromptBar.tsx`
  - `shared-shell`
    - `PromptBarTopRow`
    - `PromptBarFooter`
    - `DesktopComposerModeSwitcher`
    - `mobileShellMode`
    - `ModeSwitcherStyles` 删除
    - 发送按钮 / mode switcher 的减动效
    - `InpaintModal` 与其本地状态移除
  - `prompt-optimizer`
    - `DesktopComposerPromptTools`
    - 旧 prompt library 搜索 / 分类 / 收藏 / 模板插入逻辑删除
    - 提示词优化按钮保留
  - `desktop-settings`
    - `DesktopComposerModePanel`
    - 桌面 `networkControls` 插槽
    - 模型右键菜单和模型设置弹层视觉改造
  - `ecommerce-mode`
    - 新增 ecommerce props
    - `GenerationMode.ECOMMERCE` 模型过滤
    - 电商比例 override
    - `DesktopComposerEcommercePanel`
  - 高冲突区：
    - import 区
    - props 类型与参数解构
    - 桌面控制区大 JSX 替换

- `prompt-bar-layout-regression.test.ts`
  - 当前测试本身是混合的，不建议直接按文件整体归类
  - 建议拆成两部分理解：
    - `shared-shell`: top row / footer / reduced-motion
    - `desktop-settings`: `DesktopComposerModePanel` 摘要与 `networkControls`
  - `ecommerce-mode` 在这个文件里只有轻量 wiring 断言，不是主块

- `SettingsPanel.localized.tsx`
  - `desktop-settings`
    - `SettingsDesktopSidebar`
    - `SettingsDesktopWorkbenchHeader`
    - 桌面壳尺寸 / 圆角 / 毛玻璃 / account block
  - `mobile-shell`
    - `compact` 分组
    - 移动端标题 / 描述改写
    - `5 项手机入口` 焦点卡
  - `login-admin`
    - `admin-console` / `credit-models` / `exchange-rates` / `admin-system` 全部折叠到 `api-management`
    - `handleAccountClick`
    - `safeInitialView`
  - 结论：不能整体归到 `desktop-settings`

- `settingsRoutes.tsx`
  - `desktop-settings`
    - `consumption-records` 命名和 legacy redirect
  - `login-admin`
    - 删除 `AdminSystem`
    - admin legacy routes 重定向到 `api-management`
  - `other`
    - `KKAI_FEATURE_FLAGS.billing`
  - 结论：不要整体归到 `desktop-settings`

### Shared Split Order

推荐最后一轮按下面顺序做共享面归并：

1. `src/types.ts`
2. `src/App.tsx` 中的 `partial-redraw`
3. `src/App.tsx` 中的 `mobile-shell`
4. `src/App.tsx` 中的 `ecommerce-mode`
5. `src/App.tsx` 中的 `prompt-optimizer`
6. `src/components/layout/PromptBar.tsx` 与 `tests/unit/prompt-bar-layout-regression.test.ts`
7. `src/components/settings/SettingsPanel.localized.tsx` 与 `src/routes/settingsRoutes.tsx`

其中 `PromptBar.tsx` 的内部建议顺序是：

1. `shared-shell`
2. `prompt-optimizer`
3. `desktop-settings`
4. `ecommerce-mode`

`SettingsPanel.localized.tsx` 与 `settingsRoutes.tsx` 的内部建议顺序是：

1. `login-admin`
2. `other` (`KKAI_FEATURE_FLAGS.billing`)
3. `desktop-settings`
4. `mobile-shell`

## Block 1: Partial Redraw

状态：仓库内已收口，仍待真实 UI 手工验收

专属文件：

- `src/services/image/partialRedraw.ts`
- `src/components/image/PartialRedrawModal.tsx`
- `src/components/image/GlobalLightbox.tsx`
- `src/components/image/ImageCard2.tsx`
- `src/hooks/useImageGeneration.ts`
- `tests/unit/partial-redraw.test.ts`
- `tests/unit/partial-redraw-model-capabilities.test.ts`
- `tests/unit/partial-redraw-lightbox-contract.test.ts`
- `tests/unit/partial-redraw-modal-contract.test.ts`
- `tests/unit/partial-redraw-pipeline-contract.test.ts`

共享文件：

- `src/App.tsx`
- `src/components/layout/PromptBar.tsx`
- `src/types.ts`

本轮确认点：

- 修复了非方图下的像素比例错误，`expandSelectionToAspectRatio` 现在按真实像素空间扩边。
- 现有测试已覆盖非方图 `16:9` 像素比回归。

验证命令：

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/partial-redraw.test.ts tests/unit/partial-redraw-model-capabilities.test.ts tests/unit/partial-redraw-lightbox-contract.test.ts tests/unit/partial-redraw-pipeline-contract.test.ts tests/unit/partial-redraw-modal-contract.test.ts
```

## Block 2: Ecommerce Mode

状态：仓库内已收口，仍待真实导入链路手工验收

专属文件：

- `api/ecommerce-analysis.ts`
- `src/components/ecommerce/EcommerceImportPanel.tsx`
- `src/services/ecommerce/text/fallbackTextAnalysis.ts`
- `src/services/ecommerce/xlsx/openXmlWorkbookParser.ts`
- `src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx`
- `src/components/layout/prompt-bar/composerModeRegistry.ts`
- `tests/unit/ecommerce-analysis-types-contract.test.ts`
- `tests/unit/ecommerce-canvas-contract.test.ts`
- `tests/unit/ecommerce-fallback-source-contract.test.ts`
- `tests/unit/ecommerce-mode-source-contract.test.ts`
- `tests/unit/ecommerce-mode-source-guard.test.ts`
- `tests/unit/ecommerce-model-policy.test.ts`
- `tests/unit/ecommerce-prompt-node-metadata.test.ts`
- `tests/unit/ecommerce-text-fallback.test.ts`
- `tests/unit/ecommerce-xlsx-parser.test.ts`
- `tests/unit/prompt-bar-ecommerce-panel-regression.test.ts`

共享文件：

- `src/App.tsx`
- `src/components/layout/PromptBar.tsx`

本轮确认点：

- 去掉了 `.xls` 伪支持，入口与路由统一为真实支持的 `xlsx/pdf/docx/doc/txt/md`。
- 文本回退分析说明已同步到“文档文本回退分析”。

验证命令：

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/ecommerce-analysis-types-contract.test.ts tests/unit/ecommerce-canvas-contract.test.ts tests/unit/ecommerce-fallback-source-contract.test.ts tests/unit/ecommerce-mode-source-contract.test.ts tests/unit/ecommerce-mode-source-guard.test.ts tests/unit/ecommerce-model-policy.test.ts tests/unit/ecommerce-prompt-node-metadata.test.ts tests/unit/ecommerce-text-fallback.test.ts tests/unit/ecommerce-xlsx-parser.test.ts tests/unit/prompt-bar-ecommerce-panel-regression.test.ts
```

## Block 3: Mobile Shell

状态：仓库内已收口，基本完成待验收

专属文件：

- `src/components/mobile/MobileAppShell.tsx`
- `src/components/mobile/MobileResultFeed.tsx`
- `src/components/mobile/mobileFeedSelectors.ts`
- `src/components/mobile/MobileWorkspaceQuickBar.tsx`
- `src/components/mobile/MobileTabBar.tsx`
- `src/components/mobile/index.ts`
- `tests/unit/mobile-app-shell-contract.test.ts`
- `tests/unit/mobile-app-shell-integration.test.ts`
- `tests/unit/mobile-feed-selectors.test.ts`
- `tests/unit/mobile-result-feed-app-contract.test.ts`
- `tests/unit/mobile-result-feed-detail-contract.test.ts`
- `tests/unit/mobile-retention-policy.test.ts`
- `tests/unit/mobile-settings-shell-contract.test.ts`
- `tests/unit/mobile-settings-taxonomy.test.ts`

共享文件：

- `src/App.tsx`
- `src/components/workspace/WorkspacePanels.tsx`
- `src/components/workspace/index.ts`
- `src/context/CanvasContext.tsx`

本轮确认点：

- 详情抽屉已补齐“时间”展示，并补了契约测试。

验证命令：

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/mobile-app-shell-contract.test.ts tests/unit/mobile-app-shell-integration.test.ts tests/unit/mobile-feed-selectors.test.ts tests/unit/mobile-result-feed-app-contract.test.ts tests/unit/mobile-result-feed-detail-contract.test.ts tests/unit/mobile-retention-policy.test.ts tests/unit/mobile-settings-shell-contract.test.ts tests/unit/mobile-settings-taxonomy.test.ts
```

## Block 4: Desktop Settings

状态：仓库内已收口，视觉风格已完成最后一轮瘦身

专属文件：

- `src/components/settings/ApiSettingsView.tsx`
- `src/components/settings/views/DashboardView.localized.tsx`
- `src/components/layout/prompt-bar/DesktopComposerModeSwitcher.tsx`
- `tests/unit/api-settings-routing-regression.test.ts`
- `tests/unit/api-settings-platform-assistant-entry.test.ts`
- `tests/unit/dashboard-settings-legacy-pruning.test.ts`

共享文件：

- `src/components/layout/PromptBar.tsx`
- `src/routes/settingsRoutes.tsx`

本轮确认点：

- 默认列表态不再同屏堆叠编辑器。
- 平台能力入口不再重复出现。
- Dashboard 里的 `false &&` 旧壳层残留已删。

验证命令：

```bash
node --test tests/unit/api-settings-routing-regression.test.ts tests/unit/api-settings-platform-assistant-entry.test.ts tests/unit/prompt-bar-layout-regression.test.ts tests/unit/dashboard-settings-legacy-pruning.test.ts
```

## Block 5: Prompt Optimizer

状态：仓库内已收口，逻辑与展示语义已统一

专属文件：

- `src/services/llm/promptOptimizerService.ts`
- `src/services/llm/promptOptimizerAutoroute.ts`
- `src/components/canvas/PromptNodeComponent.tsx`
- `tests/unit/prompt-optimizer-autoroute-contract.test.ts`
- `tests/unit/prompt-optimizer-service-source-contract.test.ts`

共享文件：

- `src/App.tsx`

本轮确认点：

- `template_*` 残留语义已清到 `route_*`。
- 短提示词时优先保留路由特异性建议。
- `PromptNodeComponent` 已改为读取 `route_title`。

验证命令：

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/prompt-optimizer-autoroute-contract.test.ts tests/unit/prompt-optimizer-service-source-contract.test.ts
```

## Block 6: Login Entry

状态：前端登录入口块已独立，API 端 owner-admin 保护不在当前未提交范围内

专属文件：

- `src/components/auth/LoginScreen.tsx`
- `src/components/auth/LoginScreen.css`
- `src/services/auth/googleAuth.ts`
- `tests/unit/google-auth-service.test.ts`
- `tests/unit/login-screen-auth-actions.test.ts`

本轮确认点：

- Google 登录入口已独立出来。
- 临时账号 / 管理员入口被压到紧凑辅助行。
- 这一块当前只看到前端与前端测试的未提交差异；owner-admin 后端保护看起来已经不在本轮工作区中。

## External Follow-ups

以下两项不属于仓库内代码收口，不能标记为已完成：

- Codex 默认 `gpt-5.4`
  还差一次 Desktop 冷启动后的新主线程实测，确认不再出现 `gpt-5.4-openai-compact`、`responses/compact`、`memory_stage1` 或 `gpt-5.1-codex-mini`。
- Vercel / 部署
  当前没有远端成功证据，只能继续后置。需要至少补齐远端推送、GitHub Actions 成功记录、Vercel deployment URL/ID、或 smoke test 结果中的一类。

## Repo-wide Verification

本轮仓库内收口最终通过的命令：

```bash
npm run typecheck
npm run build
npm run check:encoding
npm run governance:agent-docs
npm run governance:version
```

## Shared Ownership Addendum

### App.tsx Addendum

- `partial-redraw`
  - `buildPartialRedrawReferenceImage`
  - `onPartialRedraw`
  - `GenerationMode.REDRAW`
  - 重绘连接线颜色兼容 `REDRAW || INPAINT`
- `ecommerce-mode`
  - `EcommerceRuntimeState`
  - `analyzeEcommerceRequirementFile`
  - `buildEcommercePromptNode`
  - `handleConfirmEcommerceAnalysis`
  - `handleGenerateEcommerceNode`
  - `handleGenerateEcommerceGroup`
  - `handleConfirmEcommerceDesktop`
  - `handleRetryEcommerceModule`
  - 非移动端 `PromptBar` 的 ecommerce props
- `mobile-shell`
  - `mobileHeader`
  - `mobileFeed`
  - `mobileComposer`
  - `workspacePanels`
  - `MobileAppShell`
  - `MobileResultFeed`
- `prompt-optimizer`
  - `optimizePromptForImage(...)` 精简调用
  - 去模板化后的 optimizer 配置传递
- `not-in-scope-for-this-round`
  - `createAppRootMode`
  - 明显属于 `kkai local edition` 或独立登录后台工程的逻辑

`App.tsx` 的高冲突区：

- 顶部 import hunk
- 生成链路里同时混有计费 / optimizer / ecommerce 的区域
- `mobileHeader / mobileFeed / mobileComposer / PromptBar props` 这块移动壳接线区

### types.ts Addendum

- `partial-redraw`
  - `GenerationMode.REDRAW`
  - `NormalizedRect`
  - `PartialRedrawMetadata`
  - `PartialRedrawRequest`
  - `GeneratedImage.partialRedraw`
  - `PromptNode.partialRedraw`
- `ecommerce-mode`
  - `GenerationMode.ECOMMERCE`
  - `EcommercePromptState`
  - ecommerce refs / stage / policy 类型
  - `PromptNode.ecommerce`
- `prompt-optimizer`
  - 移除 `PromptOptimizationMode`
  - `meta.optimization_mode?: 'auto'`

`types.ts` 里不建议单拆的共享基础设施：

- `GeneratedImage.userMoved`
- `PromptNode.billingAttemptId`
- `PromptNode.balanceAfter`

结论：

- `types.ts` 里没有干净独立的 `mobile-shell` / `desktop-settings` 专属块
- 这两个标签不要试图从 `types.ts` 单独硬拆

### Settings Shell Addendum

`SettingsPanel.localized.tsx` 与 `settingsRoutes.tsx` 的归属如下：

- `desktop-settings`
  - `SettingsDesktopSidebar`
  - `SettingsDesktopWorkbenchHeader`
  - 桌面 workbench 视觉壳
- `mobile-shell`
  - `compact` 分组
  - `5 项手机入口`
  - 移动标题 / 描述
- `login-admin`
  - `admin-console`
  - `credit-models`
  - `exchange-rates`
  - `admin-system`
  - `handleAccountClick`
  - `safeInitialView`
- `other`
  - `KKAI_FEATURE_FLAGS.billing`

结论：

- 这两个文件不能整体归入 `desktop-settings`
- 建议按 `login-admin -> other -> desktop-settings -> mobile-shell` 的顺序拆

## Current Staging Snapshot

当前已经安全拎进索引、可以优先做 review 的文件：

- `api/ecommerce-analysis.ts`
- `docs/development/review-blocks-2026-04-12.md`
- `src/components/canvas/PromptNodeComponent.tsx`
- `src/components/ecommerce/EcommerceImportPanel.tsx`
- `src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx`
- `src/components/ecommerce/EcommerceCardActions.tsx`
- `src/components/image/GlobalLightbox.tsx`
- `src/components/image/ImageCard2.tsx`
- `src/components/image/InpaintModal.tsx`
- `src/components/image/PartialRedrawModal.tsx`
- `src/components/layout/PromptBar.tsx`
- `src/components/layout/prompt-bar/composerModeRegistry.ts`
- `src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx`
- `src/components/layout/prompt-bar/DesktopComposerModePanel.tsx`
- `src/components/layout/prompt-bar/DesktopComposerModeSwitcher.tsx`
- `src/components/layout/prompt-bar/DesktopComposerPromptTools.tsx`
- `src/components/mobile/MobileResultFeed.tsx`
- `src/components/mobile/MobileAppShell.tsx`
- `src/components/mobile/MobileTabBar.tsx`
- `src/components/mobile/MobileWorkspaceQuickBar.tsx`
- `src/components/mobile/mobileFeedSelectors.ts`
- `src/components/mobile/index.ts`
- `src/components/workspace/WorkspacePanels.tsx`
- `src/components/workspace/index.ts`
- `src/components/settings/ApiSettingsView.tsx`
- `src/components/settings/desktop/SettingsDesktopSidebar.tsx`
- `src/components/settings/desktop/SettingsDesktopWorkbenchHeader.tsx`
- `src/components/settings/views/DashboardView.localized.tsx`
- `src/components/settings/views/StorageSettingsView.localized.tsx`
- `src/components/settings/ui/index.tsx`
- `src/services/ecommerce/text/fallbackTextAnalysis.ts`
- `src/services/ecommerce/ecommerceAnalysisClient.ts`
- `src/services/ecommerce/ecommerceModelPolicy.ts`
- `src/services/ecommerce/ecommercePromptNodeMetadata.ts`
- `src/services/ecommerce/types.ts`
- `src/services/ecommerce/normalize/ecommerceAnalysisNormalizer.ts`
- `src/services/ecommerce/xlsx/openXmlWorkbookParser.ts`
- `src/services/ecommerce/xlsx/referenceBindingResolver.ts`
- `src/services/image/partialRedraw.ts`
- `src/services/model/modelCapabilities.ts`
- `src/services/llm/promptOptimizerAutoroute.ts`
- `src/services/llm/promptOptimizerService.ts`
- `src/services/auth/googleAuth.ts`
- `src/hooks/useImageGeneration.ts`
- `src/context/CanvasContext.tsx`
- `src/components/index.ts`
- `tests/unit/api-settings-platform-assistant-entry.test.ts`
- `tests/unit/api-settings-routing-regression.test.ts`
- `tests/unit/dashboard-settings-legacy-pruning.test.ts`
- `tests/unit/ecommerce-fallback-source-contract.test.ts`
- `tests/unit/ecommerce-analysis-types-contract.test.ts`
- `tests/unit/ecommerce-canvas-contract.test.ts`
- `tests/unit/ecommerce-mode-source-contract.test.ts`
- `tests/unit/ecommerce-mode-source-guard.test.ts`
- `tests/unit/ecommerce-model-policy.test.ts`
- `tests/unit/ecommerce-prompt-node-metadata.test.ts`
- `tests/unit/ecommerce-text-fallback.test.ts`
- `tests/unit/ecommerce-xlsx-parser.test.ts`
- `tests/unit/prompt-bar-ecommerce-panel-regression.test.ts`
- `tests/unit/google-auth-service.test.ts`
- `tests/unit/login-screen-auth-actions.test.ts`
- `tests/unit/mobile-app-shell-contract.test.ts`
- `tests/unit/mobile-app-shell-integration.test.ts`
- `tests/unit/mobile-feed-selectors.test.ts`
- `tests/unit/mobile-result-feed-app-contract.test.ts`
- `tests/unit/mobile-result-feed-detail-contract.test.ts`
- `tests/unit/mobile-retention-policy.test.ts`
- `tests/unit/mobile-settings-shell-contract.test.ts`
- `tests/unit/mobile-settings-taxonomy.test.ts`
- `tests/unit/partial-redraw-lightbox-contract.test.ts`
- `tests/unit/partial-redraw-modal-contract.test.ts`
- `tests/unit/partial-redraw-model-capabilities.test.ts`
- `tests/unit/partial-redraw-pipeline-contract.test.ts`
- `tests/unit/partial-redraw.test.ts`
- `tests/unit/prompt-bar-layout-regression.test.ts`
- `tests/unit/prompt-optimizer-autoroute-contract.test.ts`
- `tests/unit/prompt-optimizer-service-source-contract.test.ts`

按 block 粗看，当前已暂存的优先 review 批次已经覆盖：

- `Prompt Optimizer`
- `Partial Redraw`
- `Ecommerce Mode`
- `Mobile Shell`
- `Desktop Settings`
- `Login Entry` 前端部分

注意：

- `src/App.tsx`
- `src/components/layout/PromptBar.tsx`
- `src/types.ts`
- `src/components/settings/SettingsPanel.localized.tsx`
- `src/routes/settingsRoutes.tsx`
- `tests/unit/prompt-bar-layout-regression.test.ts`

虽然已经进入索引，但它们仍属于“共享混合块”，review 时请按本文件里的归属图和拆分顺序阅读，不要把它们当作单一主线。

## Remaining Shared Review Risks

以下文件虽然已经进入索引，但依然需要按归属图人工 review：

- `src/App.tsx`
- `src/components/layout/PromptBar.tsx`
- `src/types.ts`
- `src/components/settings/SettingsPanel.localized.tsx`
- `src/routes/settingsRoutes.tsx`
- `tests/unit/prompt-bar-layout-regression.test.ts`

处理策略：

- 先用本文件里的 `Shared Ownership Map` 做人工挑块，不再尝试一次性按文件归类。
- `src/types.ts` 已进索引，但 review 时仍按 `prompt-optimizer -> partial-redraw -> ecommerce-mode -> shared-foundation` 的顺序看。
- `PromptBar.tsx` 和 `prompt-bar-layout-regression.test.ts` 需要按 `shared-shell -> prompt-optimizer -> desktop-settings -> ecommerce-mode` 的顺序拆。
- `SettingsPanel.localized.tsx` 和 `settingsRoutes.tsx` 需要按 `login-admin -> other -> desktop-settings -> mobile-shell` 的顺序拆。
