# Session Handoff - 设置页面职责划分与极简配置重构

**Last Updated:** 2026-06-10

## 1. 修改范围
我们对 KK Studio 的统一设置控制面板进行了功能职责的清晰梳理，移除了所有前台暴露的高级运维、诊断和测试元素，对第三方供应商接入逻辑进行了颠覆性的极简重构。

## 2. 修改文件
- **[apiProviderPresets.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/components/settings/apiProviderPresets.ts)**
  - 实现了 `detectProviderPresetByBaseUrl` 函数。根据 Base URL 的主机域名提取技术，高精度智能识别已注册的预设供应商。
- **[ApiSettingsView.tsx](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/components/settings/ApiSettingsView.tsx)**
  - 隐藏了供应商编辑表单上的“名字 (Name)”输入框和“模型 (Models)”文本域。
  - 在用户输入“接口地址 (Base URL)”时自动在后台执行 `detectProviderPresetByBaseUrl` 识别：
    - 若匹配到预设，则使用各厂商自身的 API 协议（如 `gemini`，`claude`），避免与 OpenAI 等其它协议格式混用。
    - 若未匹配，则默认以标准兼容协议（即 `openai` 格式）通信，且名称自动根据域名定为 `自定义 (域名)`。
    - 接口地址输入框下方增加了识别状态的 Premium Badge 及文案提示。
  - 移除了前台“高级抓取”卡片和“自动获取模型”、“自动获取价格”等偏向诊断和调试的交互项。
  - 新增保存成功后的静默同步：保存 800ms 后，自动在后台静默发起通道连通测试并拉取模型，自动回填模型列表并写入本地存储，向用户提示“模型库已自动同步”。
  - 屏蔽底部的“高级模式”隐形按钮，并将 `renderAdvancedPanels` 强行短路返回 `null`，移除与“AI 管理”功能重叠的能力指派模块、OCR 配置及平台助手等，确保职责隔离。

## 3. 设计决策
- **极简式表单输入**：在新建或修改供应商通道时，UI 表单统一仅呈现“接口地址”与“API Key”两个字段（另外包含预算策略策略），用户体验更加傻瓜化、无感。
- **静默后台交互**：将原本在前台频繁打扰、具有强运维感的“测试可用模型”操作移到保存数据后由后台静默跑完，回填结果后只给一条友好的模型同步成功通知，降低了系统运维感的门槛。
- **双向割离**：AI 管理页专职负责 Prompt 能力预设和 Skill 编写；供应商页面专职负责地址、密钥维护和计费预算策略，避免模块混杂。

## 4. 已运行验证
- 运行类型检查：`npm run typecheck` 成功通过。
- 运行生产环境构建：`npm run build` 成功完成。

## 5. 未运行验证及原因
- 线上真实部署：需在实际部署环境中检查代理服务器连通性。

## 6. 风险与下一步
- **风险**：个别使用非常小众/极端的自定义 Base URL 的代理服务器，其 `detectProviderPresetByBaseUrl` 可能会匹配不到任何预设，此时将默认以 `openai` (标准兼容协议) 进行通信。这符合设计预期。
- **下一步**：继续进行画布和前端其它页面对新重构供应商配置的读取验证。

## 7. 版本治理与声明 (Version Governance)
- 本次会话开发完全遵循 KK Studio v1.5.6 的版本治理规范。
- `config/release-manifest.json` 为主版本源。
- `apps/web/src/config/appInfo.ts` 运行时只读导出。
- `release/publish/stable/manifest.json` 为 portable stable 发布清单。
