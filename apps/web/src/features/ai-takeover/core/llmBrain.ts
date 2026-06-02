// 简体中文：云端大模型接管规划器 (LLM Brain)
import { AssistantPlan, SanitizedProjectContext } from '../types';

export class LLMBrain {
  /**
   * 负责接收脱敏的 SanitizedProjectContext 及用户输入，生成符合 JSON Plan 的 AssistantPlan。
   * 此模块在云端连接可用时工作。在无 Key 状态时应当平滑回退到 LocalBrain。
   */
  async plan(userInput: string, context: SanitizedProjectContext): Promise<AssistantPlan> {
    // 1. 系统规划提示词约定，规定 LLM 只准输出规范的 Plan JSON，绝对不返回 Markdown 等杂乱文本，禁止接触密钥，对高危动作必须强设 requiresConfirmation 为 true。
    const systemPrompt = `你是 KK Studio 的 AI 接管规划器。
你只能返回 JSON 格式，不要返回 Markdown 标记。
你不能直接执行任何高危动作。
你不能读取、填写、上传或记录任何包含 API Key、Token、密码、私钥、.env 等敏感文件的内容。
你必须严格区分“优化提示词”和“生成图片”：
- 若用户仅请求优化提示词，intent 必须为 optimize_prompt，且 actions 里不能包含 startGeneration；
- 若涉及生成、批量生成、文件读取与上传、积分消耗、删除、覆盖、发布等高危动作，requiresConfirmation 必须为 true；
- 你只能使用 availableTools 列表中注册的白名单工具。`;

    // 2. 将脱敏上下文转为 LLM Prompt 输送。
    // 在本骨架中，暂且返回一段未配置 API Key 的友好提示 plan，以确保系统不崩塌。
    const requiresCredits = context.settings.apiKeyStatus === 'missing';
    
    return {
      id: 'plan_llm_' + Date.now(),
      reply: `🤖 **AI 接管：本地模式**\n目前接管系统已根据您的本地环境进行了意图校准。由于暂未连接云端大语言模型，我已平滑回退到本地安全沙箱接管引擎为您服务。`,
      intent: 'help',
      confidence: 1.0,
      actions: [],
      requiresConfirmation: false
    };
  }
}
