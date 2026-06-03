// 简体中文：云端大模型接管规划器 (LLM Brain)
import type { AssistantPlan, SanitizedProjectContext } from '../types';
import { llmService } from '../../../services/llm/LLMService';

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
用户输入框和画布当前的信息被封装在 SanitizedProjectContext 中传入（其中包括当前输入框的提示词、参考图、当前模式以及电商模块配置等）。

[AI接管指令与动作链接规范]
你在与用户沟通回复时，可以在 Markdown 格式的回答（reply 字段）中嵌入以下交互式动作链接。浏览器会自动识别这些链接并在后台“自动帮用户点击运行”：
- [开始生成](action://takeover-bulk-generate?prompts=提示词1,提示词2) ：让后台排队生成图片。
- [正在自动定位](action://takeover-locate?keyword=关键词) ：在画布中平滑定位卡片。
- [只优化提示词并填充](action://takeover-prompt-only) ：只优化提示词并填充到输入框。
- [整理我的批量方案为文案](action://takeover-prompt-doc) ：整理生图文案。
- [去设置API](action://open-settings-api) ：高亮打开API Key管理。
- [立即去充值](action://open-recharge) ：打开充值。

[动作计划 json schema]
除了返回普通文本 reply 外，你必须返回 actions 数组来驱动系统执行自动化动作。请从以下 actions 白名单中选择：
- {"type": "fillInputPrompt", "payload": {"prompt": "优化后的英文提示词"}} ：填充提示词到页面输入框（若用户要求优化提示词，使用此动作直接替换页面输入框的内容，如果是电商模式，则直接替换电商原有输入框）。
- {"type": "fillPrompt", "payload": {"prompt": "提示词"}} ：在画布上为选中卡片修改提示词，或没有选中卡片时创建卡片。
- {"type": "changeMode", "payload": {"mode": "image" | "video" | "audio" | "ppt" | "ecommerce"}} ：切换模式。
- {"type": "startGeneration", "payload": {"prompt": "提示词", "count": 数量}} ：在画布上新建卡片并开始生成。
- {"type": "submitPromptComposer", "payload": {}} ：帮我发送（点击生图发送键）。
- {"type": "locateCard", "payload": {"keyword": "关键词"}} ：高亮定位卡片。
- {"type": "openSettings", "payload": {"tab": "api-management"}} ：打开API密钥设置。

[任务拆解要求]
- 若用户要求“帮我把输入框的提示词优化一下”，你应当获取 context.promptBarInput.prompt 进行优化，并返回 fillInputPrompt 动作（如果是电商模式，则直接优化电商的原输入框提示词）。
- 若用户要求“帮我发送”或“帮我建卡”，你必须返回 {"type": "submitPromptComposer", "payload": {}} 或 {"type": "startGeneration", "payload": {"prompt": context.promptBarInput.prompt, "count": 1}}。
- 若用户要求连续的多阶段任务（如“生成一张图片，再切换到视频模式用生成的这张图片再给我生成一个视频”）：
  第一步：先切换至图片模式 {"type": "changeMode", "payload": {"mode": "image"}}；
  第二步：直接发起生图 {"type": "startGeneration", "payload": {"prompt": "用户当前的提示词", "count": 1}}；
  并在 reply 中告知用户已为您自动完成了前两步，当图片生成成功后，您可以随时点击 [开启图生视频](action://takeover-image-to-video) 自动将生图设为参考图并进入视频模式继续完成最终生成。

请直接输出以下 JSON，绝对不要用 \`\`\`json 等任何格式包裹它：
{
  "id": "plan_llm_随机数",
  "reply": "你与用户沟通的回答文本",
  "intent": "意图类型，如 optimize_prompt | change_generation_mode | ...",
  "confidence": 1.0,
  "actions": [动作对象数组],
  "requiresConfirmation": false
}`;

    // 2. 原生搜索联网配置 (Grounding)
    // 开启 Agent 后肯定开启搜索功能（如果模型是原生支持搜索的 Gemini 模型系列）
    const providerConfig = isGemini ? {
      google: {
        tools: [{ googleSearch: {} }]
      }
    } : undefined;

    const responseText = await llmService.chat({
      modelId: activeModelId,
      messages: [
        { role: 'system', content: systemPrompt },
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
