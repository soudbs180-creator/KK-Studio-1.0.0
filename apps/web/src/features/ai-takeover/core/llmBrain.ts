// 简体中文：云端大模型接管规划器 (LLM Brain)
import type { AssistantPlan, SanitizedProjectContext } from '../types';
type LlmChat = typeof import('../../../services/llm/LLMService')['llmService']['chat'];

const chatWithLlm: LlmChat = async (...args) => {
  const { llmService } = await import('../../../services/llm/LLMService');
  return llmService.chat(...args);
};

export class LLMBrain {
  /**
   * 负责接收脱敏的 SanitizedProjectContext 及用户输入，生成符合 JSON Plan 的 AssistantPlan。
   * 此模块在云端连接可用时工作。在无 Key 状态时应当平滑回退到 LocalBrain。
   */
  async plan(userInput: string, context: SanitizedProjectContext, modelId?: string): Promise<AssistantPlan> {
    const activeModelId = modelId || context.settings.selectedModel || 'gemini-2.5-flash';
    const isGemini = activeModelId.toLowerCase().includes('gemini');

    // 1. 系统规划提示词约定，规定 LLM 只准输出规范的 Plan JSON，绝对不返回 Markdown 等杂乱文本，禁止接触密钥。
    const systemPrompt = `你是 KK Studio 的 AI 接管规划器（Agent）。
你必须理解用户的意图，进行任务的规划与拆解。
用户当前所处的页面、画布、视口、选区（包含选中的 Prompts 和 Images）以及最近事件历史，都已被完整封装在 SanitizedProjectContext.runtime (CanvasRuntimeState) 和 context 中传入。

[画布实时运行态感知 (CanvasRuntimeState)]
你可以通过 context.runtime 获得实时上下文：
- context.runtime.selection：包含当前选中的节点 IDs（selectedNodeIds）、选中的提示词卡片 IDs（promptNodeIds）、选中的图片卡片 IDs（imageNodeIds），以及从选中 Prompt 智能推导去重出来的子图 IDs（childImageNodeIdsFromSelectedPrompts）。
- context.runtime.viewport：包含当前视口的平移坐标 (x, y)、缩放比例 (scale) 及视口中心物理坐标 (center)。
- context.runtime.recentEvents：包含最近的用户与画布事件，可用于提取“刚刚生成/下载”的上下文信息。

[AI接管指令与动作链接规范]
你在与用户沟通回复时，可以在 Markdown 格式 of 回答（reply 字段）中嵌入以下交互式动作链接，供用户快速点击：
- [开始生成](action://takeover-bulk-generate?prompts=提示词1,提示词2) ：让后台排队生成图片。
- [正在自动定位](action://takeover-locate?keyword=关键词) ：在画布中平滑定位卡片。
- [只优化提示词并填充](action://takeover-prompt-only) ：只优化提示词并填充到输入框。
- [整理我的批量方案为文案](action://takeover-prompt-doc) ：整理生图文案。
- [去设置API](action://open-settings-api) ：高亮打开API Key管理。
- [打开系统日志](action://open-settings-logs) ：打开系统日志维护面板。
- [立即去充值](action://open-recharge) ：打开充值。

[动作计划 json schema]
除了返回普通文本 reply 外，你必须返回 actions 数组来驱动系统执行自动化动作。请从以下 actions 白名单中选择（支持最新的 Tool 规范及其别名）：
- {"type": "fillInputPrompt", "payload": {"prompt": "优化后的英文提示词"}} ：填充提示词到页面输入框。
- {"type": "fillPrompt", "payload": {"prompt": "提示词"}} ：在画布上修改或新建提示词卡片。
- {"type": "changeMode", "payload": {"mode": "image" | "video" | "audio" | "ppt" | "ecommerce"}} ：切换模式。
- {"type": "startGeneration", "payload": {"prompt": "提示词", "count": 数量}} ：在画布上新建卡片并开始生成。
- {"type": "submitPromptComposer", "payload": {}} ：帮我发送（点击生图发送键）。
- {"type": "locateCard", "payload": {"keyword": "关键词"}} ：高亮定位卡片（别名: canvas.locateNodes）。
- {"type": "openSettings", "payload": {"tab": "dashboard" | "api-management" | "consumption-records" | "storage-settings" | "system-logs" | "user-profile"}} ：打开设置页面板。
- {"type": "canvas.arrangeNodes", "payload": {"nodeIds": string[], "layout": "grid" | "row" | "column", "columns"?: number, "gap"?: number}} ：在画布上整理并排列指定卡片。若 nodeIds 为空，默认整理当前选区；若无选区，则整理整张画布。
- {"type": "assets.zipOriginals", "payload": {"scope": "selected_cards" | "latest_batch" | "all_canvas_outputs", "selectedNodeIds"?: string[]}} ：打包下载指定范围的卡片原图并生成 ZIP (别名: zipOutputs)。当用户说“下载选择的卡片”时，scope 设为 "selected_cards"，并通过 runtime 选区推导去重得出所有的 selectedNodeIds（包含 selectedImageIds 和 childImageNodeIdsFromSelectedPrompts）。
- {"type": "generation.createBatchJob", "payload": {"prompts": string[], "options": {"modelId": string, "aspectRatio": string, "countPerPrompt": number, "layout": "grid" | "row" | "column"}}} ：批量生成图片任务，通过后台持久化队列并发调度（别名: startBatchGeneration）。
- {"type": "browser.getStatus", "payload": {}} ：读取 Browser Assistant 守护进程、Chrome 插件、平台池和会话池的脱敏状态。
- {"type": "browser.openAssistant", "payload": {}} ：打开 Browser Assistant 设置页。
- {"type": "browser.extractProduct", "payload": {"url": "https://...", "targets": ["price", "title", "image", "description"]}} ：通过 Browser Bridge 提取外部商品页摘要，必须确认。
- {"type": "browser.generateExternal", "payload": {"prompt": "提示词", "platformId": "leonardo", "count": 1, "sessionCount"?: 2}} ：通过 Browser Bridge 调外部网页平台生图，必须确认。
- {"type": "browser.publishDraft", "payload": {"channelId": "xhs", "imageUrl"?: "https://...", "title"?: "标题", "body"?: "文案"}} ：保存到外部社媒草稿箱，不允许直接公开发布，必须确认。
- {"type": "browser.writeBackDom", "payload": {"target"?: "active_tab", "title": "标题", "price": "价格"}} ：回写外部网页 DOM，危险操作，必须确认。

[任务拆解要求]
- 当用户要求“下载选择的卡片”或“打包我框选的图”时，你必须根据 context.runtime.selection 收集选中的图片与 Prompt 关联子图，去重并推导出 selectedNodeIds，返回 {"type": "assets.zipOriginals", "payload": {"scope": "selected_cards", "selectedNodeIds": 选中节点ID数组}}，禁止模拟点击。
- 当用户要求“整理我的卡片”或“把选中的排一下”时，获取 context.runtime.selection.selectedNodeIds 作为 nodeIds，并根据需要指定排版模式，返回 {"type": "canvas.arrangeNodes", "payload": {"nodeIds": nodeIds数组, "layout": "grid"}}。
- 若用户要求“批量生成 30 张头像并排成网格”，必须返回 {"type": "generation.createBatchJob", "payload": {"prompts": [30个头像提示词], "options": {"modelId": context.settings.selectedModel || "gemini-2.5-flash", "aspectRatio": "1:1", "countPerPrompt": 1, "layout": "grid"}}}。
- 你绝对不能输出任意 CSS selector 点击脚本来控制外部网页；外部网页只能通过 browser.* 工具和 Browser Bridge 处理。
- 其余本地/常规操作指令继续遵循原定逻辑。

请直接输出以下 JSON，绝对不要用 \`\`\`json 等任何格式包裹它：
{
  "id": "plan_llm_随机数",
  "reply": "你与用户沟通的回答文本",
  "intent": "意图类型，如 optimize_prompt | change_generation_mode | ...",
  "confidence": 1.0,
  "actions": [动作对象数组],
  "requiresConfirmation": false
}`;

    const retryJobToolPrompt = `
[DurableGenerationQueue failed-item retry]
- Tool whitelist includes {"type":"generation.retryJob","payload":{"jobId":"job_xxx"}} and {"type":"generation.retryJob","payload":{"target":"latest_failed"}}.
- Use it when the user explicitly asks to retry a failed batch/job and provides a job_id/batch_id, or asks for the latest/recent/last failed batch.
- This is a safe queue-control action: set requiresConfirmation=false and never resubmit completed prompts.`;

    // 2. 原生搜索联网配置 (Grounding)
    // 开启 Agent 后肯定开启搜索功能（如果模型是原生支持搜索的 Gemini 模型系列）
    const providerConfig = isGemini ? {
      google: {
        tools: [{ googleSearch: {} }]
      }
    } : undefined;

    const responseText = await chatWithLlm({
      modelId: activeModelId,
      messages: [
        { role: 'system', content: systemPrompt + retryJobToolPrompt },
        { role: 'user', content: `当前项目脱敏上下文信息：\n${JSON.stringify(context, null, 2)}\n\n用户最新的聊天指令：\n${userInput}` }
      ],
      temperature: 0.2,
      providerConfig
    });

    let parsedPlan;
    try {
      parsedPlan = JSON.parse(responseText.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim());
    } catch (jsonErr) {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsedPlan = JSON.parse(match[0]);
      } else {
        throw jsonErr;
      }
    }

    return {
      id: parsedPlan.id || 'plan_llm_' + Date.now(),
      reply: parsedPlan.reply || responseText,
      intent: parsedPlan.intent || 'unknown',
      confidence: parsedPlan.confidence || 0.9,
      actions: parsedPlan.actions || [],
      requiresConfirmation: !!parsedPlan.requiresConfirmation
    };
  }
}
