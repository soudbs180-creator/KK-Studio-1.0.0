// 简体中文：本地脑 (Local Brain) 模块

import type { AssistantPlan, SanitizedProjectContext, AssistantAction } from '../types';
import { analyzeIntent } from './intentGate';
import { PROJECT_KNOWLEDGE, matchLocalKnowledge } from '../prompts/projectKnowledge';
import { PROMPT_LIBRARY } from '../prompts/promptLibrary';
import { matchPromptTemplates } from '../prompts/promptMatcher';
import { optimizePromptLocally } from '../prompts/localPromptOptimizer';
import { safetyPolicy } from './safetyPolicy';
import { confirmationPolicy } from './confirmationPolicy';

export class LocalAssistantBrain {
  async plan(userInput: string, context: SanitizedProjectContext): Promise<AssistantPlan> {
    const intentResult = analyzeIntent(userInput, context);
    const actions: AssistantAction[] = [];
    let reply = '';

    switch (intentResult.intent) {
      case 'help': {
        const localAnswer = matchLocalKnowledge(userInput);
        if (localAnswer) {
          reply = localAnswer;
        } else {
          reply = `### 💡 欢迎使用 KK Studio AI 助手！
我可以在本地协助您完成以下操作：
1. **优化提示词**：提问如“帮我优化提示词：二次元少女，带猫”
2. **定位卡片**：提问如“帮我找到包含猫的卡片”
3. **API 配置引导**：提问如“我想配置 API 密钥”
4. **报错调试**：提问如“为什么生成失败了”
5. **打包下载**：提问如“帮我全部打包下载”

请随时发送您的操作诉求！`;
        }
        break;
      }

      case 'optimize_prompt': {
        // 匹配模板
        const matches = matchPromptTemplates(userInput, PROMPT_LIBRARY);
        const bestMatch = matches[0]?.template;

        // 执行本地提示词优化
        const optResult = optimizePromptLocally(userInput, bestMatch);

        reply = `### ✨ 提示词本地优化完成！
我为您匹配到了【${bestMatch ? bestMatch.name : '通用高清'}】模板：

**优化后的英文提示词：**
\`\`\`text
${optResult.optimizedPromptEn}
\`\`\`

**中文解析说明：**
${optResult.optimizedPromptZh}

*提示：我已自动将此提示词填充至下方输入栏中。您可以微调后点击生成！*`;

        actions.push({
          type: 'fillPrompt',
          payload: {
            prompt: optResult.optimizedPromptEn,
            negativePrompt: bestMatch?.negativePrompt,
            modelId: context.settings.selectedModel
          }
        });
        break;
      }

      case 'configure_api': {
        reply = `### ⚙️ 正在为您打开 API 设置面板
出于安全原因，我**无法替您填写、读取或保存** API 密钥。我会为您打开设置页面并高亮 API 密钥的输入位置。
请您在稍后高亮的输入框中手动填写您的密钥（如 Gemini API Key），保存后即可不消耗任何系统积分畅享无限绘图！`;

        actions.push({
          type: 'openSettings',
          payload: { tab: 'api-management' }
        });
        actions.push({
          type: 'highlightElement',
          payload: { selector: '.settings-api-key-input, input[type="password"]' }
        });
        break;
      }

      case 'search_card': {
        const query = intentResult.extracted.cardQuery || '';
        reply = `### 🔍 正在画布上检索包含“${query}”的卡片...
如果找到了对应的卡片，我将平滑地将您的视口平移过去并加上高亮闪烁效果。`;

        actions.push({
          type: 'locateCard',
          payload: { keyword: query }
        });
        break;
      }

      case 'download_outputs': {
        const scope = (intentResult.extracted.downloadScope || 'latest_batch') as any;
        reply = `### 📦 正在准备为您打包图片结果...
我将在后台使用 JSZip 将您指定的生成结果压缩为 ZIP，并在其根目录下自动生成说明元数据文件 \`manifest.json\`。打包完成后浏览器会自动弹出下载保存。`;

        actions.push({
          type: 'zipOutputs',
          payload: { scope }
        });
        break;
      }

      case 'explain_error': {
        // 分析当前画布上的节点报错
        const failedNode = context.canvas?.promptNodes?.find(n => n.status === 'failed');
        const errMessage = failedNode?.error || (context.errors && context.errors[0]?.message) || '';
        
        reply = `### 🔍 本地报错排查与诊疗建议

`;

        if (errMessage.toLowerCase().includes('credit') || errMessage.includes('积分')) {
          reply += `诊断结果：**积分余额不足**
建议方案：系统积分模型需要消耗您的积分。您可以点击 [立即去充值](action://open-recharge) 来充值积分，或 [高亮充值按钮](action://highlight-#btn-desktop-recharge) 后进行充值操作。`;
        } else if (errMessage.toLowerCase().includes('api_key') || errMessage.toLowerCase().includes('key') || errMessage.includes('密钥')) {
          reply += `诊断结果：**API 密钥无效或未配置**
建议方案：您配置的专属 API 密钥发生失效。请点击 [跳转到API设置页面](action://open-settings-api) 检查您的密钥是否输入正确且依然有效。`;
        } else if (errMessage) {
          reply += `诊断结果：**网络请求超时或未知服务端异常**
异常详情：\`${errMessage}\`
建议方案：请检查您的本地代理网络连接状态，并稍后重试生成。如果是云端模型，请检查云端通道状态。`;
        } else {
          reply += `诊断结果：目前画布上没有发现活动的错误。
如果您遇到了生成卡顿，请尝试刷新页面重试。如果您想配置您的专属密钥，我可以带您 [去配置专属 API 密钥](action://open-settings-api)。`;
        }
        break;
      }

      case 'generate_images': {
        const count = intentResult.extracted.count || 1;
        // 尝试从 userInput 中提取提示词：
        let promptText = userInput
          .replace(/(开始生成|直接生成|出图|跑图|生成|创造|绘图)/g, '')
          .replace(/(\d+)\s*(张|个)/g, '')
          .replace(/“/g, '').replace(/”/g, '')
          .trim();

        if (!promptText) {
          // 如果提取失败，尝试找画布上当前被填充的内容
          promptText = 'a detailed visual art';
        }

        reply = `### 🚀 准备开始生成图片
我将为您生成 **${count}** 张图片。提示词设定为：「${promptText}」。
此操作涉及额度消耗，我已为您准备好执行计划，请确认：`;

        actions.push({
          type: 'startGeneration',
          payload: {
            prompt: promptText,
            count
          }
        });
        break;
      }

      case 'batch_generate_from_folder': {
        // 从资产池获取图片数量
        const imageIds = context.assets?.images?.map(img => img.id) || [];
        const imageCount = imageIds.length;

        reply = `### 📁 准备从选定文件夹执行批量重绘生图
我已将导入的项目资源池共 **${imageCount}** 张参考图绑定至批量任务中。
此操作将为文件夹内的每张图片拉起生成任务，涉及高额积分消耗。执行计划如下：`;

        actions.push({
          type: 'startBatchGeneration',
          payload: {
            plan: {
              id: 'batch_' + Date.now(),
              sourceCollectionId: 'assets_pool',
              imageIds,
              promptStrategy: {
                mode: 'single_template',
                rawUserStyle: userInput,
                basePrompt: userInput,
              },
              output: {
                countPerImage: 1,
                expectedTotal: imageCount
              },
              referencePolicy: {
                useEachImageAsReference: true,
                uploadOnlyWhenGenerating: true
              },
              costPolicy: {
                requiresCredits: context.settings.apiKeyStatus === 'missing'
              },
              confirmationRequired: true
            }
          }
        });
        break;
      }

      default: {
        reply = `你好！我已听到你的消息。
目前已为您开启了 AI 接管模式。我可以在本地帮您优化提示词、查找定位卡片、高亮界面元素、引导 API 密钥配置及打包下载。请问我有什么可以协助您的？`;
        break;
      }
    }

    // 运行安全与拦截检查，过滤 Actions
    const filteredActions = actions.filter(action => {
      const check = safetyPolicy.evaluate(action);
      if (!check.allowed) {
        reply = `⚠️ **安全策略拦截通知**
${check.reason}`;
        return false;
      }
      return true;
    });

    const plan: AssistantPlan = {
      id: 'plan_' + Date.now(),
      reply,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      actions: filteredActions,
      requiresConfirmation: false
    };

    // 运行确认评估
    const confirmDetails = confirmationPolicy.evaluate(plan, context);
    if (confirmDetails.required) {
      plan.requiresConfirmation = true;
      plan.confirmation = confirmDetails;
    }

    return plan;
  }
}
