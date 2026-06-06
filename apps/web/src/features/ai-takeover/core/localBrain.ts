// 简体中文：本地脑 (Local Brain) 模块

import type { AssistantPlan, SanitizedProjectContext, AssistantAction } from '../types';
import { analyzeIntent } from './intentGate';
import { PROJECT_KNOWLEDGE, matchLocalKnowledge } from '../prompts/projectKnowledge';
import { PROMPT_LIBRARY } from '../prompts/promptLibrary';
import { matchPromptTemplates } from '../prompts/promptMatcher';
import { optimizePromptLocally } from '../prompts/localPromptOptimizer';
import { safetyPolicy } from './safetyPolicy';
import { confirmationPolicy } from './confirmationPolicy';

const SETTINGS_VIEW_LABELS: Record<string, string> = {
  dashboard: '设置总览',
  'api-management': 'API 工作台',
  'consumption-records': '计费账本',
  'storage-settings': '存储设置',
  'system-logs': '系统日志',
  'user-profile': '个人中心'
};

export class LocalAssistantBrain {
  async plan(userInput: string, context: SanitizedProjectContext): Promise<AssistantPlan> {
    const intentResult = analyzeIntent(userInput, context);
    const actions: AssistantAction[] = [];
    let reply = '';

    switch (intentResult.intent) {
      case 'optimize_input_prompt': {
        const inputPrompt = context.promptBarInput?.prompt || '';
        const isEcommerce = context.promptBarInput?.mode === 'ecommerce';
        
        // 匹配模板
        const matches = matchPromptTemplates(inputPrompt, PROMPT_LIBRARY);
        const bestMatch = matches[0]?.template;

        // 执行本地提示词优化
        const optResult = optimizePromptLocally(inputPrompt || 'a beautiful landscape', bestMatch);
        
        if (isEcommerce) {
          reply = `### 🛍️ 电商模块提示词优化完成！
已为您生成差异化商业展示与打光优化文案，并**直接替换原有组合提示词**：

**优化后的英文提示词：**
\`\`\`text
${optResult.optimizedPromptEn}
\`\`\`

**设计意图说明：**
${optResult.optimizedPromptZh}`;
        } else {
          reply = `### ✨ 输入框提示词本地优化完成！
已将优化后的文案**直接覆盖替换输入框原有内容**：

**优化后的英文提示词：**
\`\`\`text
${optResult.optimizedPromptEn}
\`\`\`

**中文解析：**
${optResult.optimizedPromptZh}`;
        }

        actions.push({
          type: 'fillInputPrompt',
          payload: {
            prompt: optResult.optimizedPromptEn
          }
        });
        break;
      }

      case 'change_generation_mode': {
        const mode = intentResult.extracted.style || 'image';
        const modeLabel = mode === 'image' ? '图片' : mode === 'video' ? '视频' : mode === 'audio' ? '音频' : mode === 'ppt' ? 'PPT' : '电商';
        reply = `### ⚙️ 生成模式切换中...
接管引擎已在后台自动为您将模式切换至【${modeLabel}】模式。`;
        actions.push({
          type: 'changeMode',
          payload: { mode: mode as any }
        });
        break;
      }

      case 'submit_composer': {
        const prompt = (intentResult.extracted.prompt || '').trim();

        if (prompt) {
          reply = `### 🚀 已接管画布输入框并发送
我会先把「${prompt}」填入当前画布输入框，然后复用当前已设置的模型、比例、参考图和生成参数直接发送。`;
          actions.push({
            type: 'fillInputPrompt',
            payload: { prompt }
          });
        } else {
          reply = `### 🚀 收到指令，正在帮您运行发送...
接管引擎正直接调用 PromptBar 发送生成按钮为您拉起任务。`;
        }

        actions.push({
          type: 'submitPromptComposer',
          payload: {}
        });
        break;
      }

      case 'create_card': {
        const prompt = context.promptBarInput?.prompt || 'a detailed visual art';
        reply = `### 🃏 正在画布上为您新建生图提示词卡片...`;
        actions.push({
          type: 'fillPrompt',
          payload: {
            prompt,
            modelId: context.settings.selectedModel
          }
        });
        break;
      }

      case 'complex_sequence': {
        const prompt = context.promptBarInput?.prompt || 'a fantasy landscape';
        reply = `### 🎬 连续复合生图规划已就绪：
1. **自动切换**：已将生成模式切换至【图片】模式。
2. **提交任务**：已在画布上自动创建生图节点并开始出图。
3. **图生视频预备**：出图完成后，您可以直接点击 [开启图生视频](action://takeover-image-to-video?prompt=${encodeURIComponent(prompt)}) 切换至视频模式以完成最终串联生成！`;
        
        actions.push({
          type: 'changeMode',
          payload: { mode: 'image' as any }
        });
        actions.push({
          type: 'startGeneration',
          payload: {
            prompt,
            count: 1
          }
        });
        break;
      }

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

      case 'open_logs': {
        reply = `### ⚙️ 正在为您打开系统日志面板
已为您自动打开“系统日志”维护面板，您可以在其中实时观察 KK Studio 的运行实况、API 请求流以及排障告警信息。
您也可以手动点击 👉 [跳转到系统日志页面](action://open-settings-logs) 快速打开该面板。`;

        actions.push({
          type: 'openSettings',
          payload: { tab: 'system-logs' }
        });
        break;
      }

      case 'open_settings_view': {
        const settingsView = intentResult.extracted.settingsView || 'dashboard';
        const label = SETTINGS_VIEW_LABELS[settingsView] || '设置页';
        reply = `### ⚙️ 正在为您打开${label}
这是本地安全跳转，我会直接调用设置页路由，不需要先配置模型。`;

        actions.push({
          type: 'openSettings',
          payload: { tab: settingsView }
        });
        break;
      }

      case 'search_card': {
        const query = (intentResult.extracted.cardQuery || '').trim();
        const lowerQuery = query.toLowerCase();
        
        // 判断是否是 API 卡片（匹配 API ID 规则，或者包含已知渠道缩写且没有明显的画布实体指示）
        const isApiId = /[a-z0-9]+-\d{4}-\d+/.test(lowerQuery);
        const isKnownApiName = /(?:zhipu|deepseek|siliconflow|openai|gemini|custom|智谱|火山|百度|阿里|零一|通义|千问|腾讯|混元|秘塔|阶跃|月之暗面|kimi)/i.test(lowerQuery);

        if (isApiId || isKnownApiName) {
          reply = `### ⚙️ 正在为您查找供应商卡片“${query}”...
已为您自动打开 API 设置面板，并对目标卡片进行磨砂挖空聚焦高亮显示。`;
          actions.push({
            type: 'openSettings',
            payload: { tab: 'api-management' }
          });
          actions.push({
            type: 'locateApiCard',
            payload: { idOrName: query }
          });
        } else {
          reply = `### 🔍 正在画布上检索包含“${query}”的卡片...
如果找到了对应的卡片，我将平滑地将您的视口平移过去并加上高亮闪烁效果。`;

          actions.push({
            type: 'locateCard',
            payload: { keyword: query }
          });
        }
        break;
      }

      case 'download_outputs': {
        const scope = (intentResult.extracted.downloadScope || 'latest_batch') as any;
        const selectedIds = context.runtime?.selection?.selectedNodeIds || context.canvas?.selectedNodeIds || [];
        
        if (scope === 'selected_cards') {
          if (selectedIds.length === 0) {
            reply = `### 📦 打包下载提示
当前没有选中的图片卡片或可下载子图。您可以先在画布上选中卡片，或者我可以直接帮您打包下载最新一次生成的批次。`;
            actions.push({
              type: 'zipOutputs',
              payload: { scope: 'latest_batch' }
            });
            break;
          }
          
          reply = `### 📦 正在准备为您打包选中的 **${selectedIds.length}** 张卡片原图...
我将在后台使用 JSZip 将您选中的生成结果压缩为 ZIP，包含其原图文件及说明清单 \`manifest.json\`。打包完成后浏览器会自动弹出下载。`;
        } else {
          reply = `### 📦 正在准备为您打包图片结果...
我将在后台使用 JSZip 将您指定的生成结果压缩为 ZIP，并在其根目录下自动生成说明元数据文件 \`manifest.json\`。打包完成后浏览器会自动弹出下载保存。`;
        }

        actions.push({
          type: 'zipOutputs',
          payload: { 
            scope,
            selectedNodeIds: selectedIds
          }
        });
        break;
      }

      case 'arrange_nodes': {
        const layoutPreset = intentResult.extracted.layoutPreset || 'grid';
        const selectedIds = context.runtime?.selection?.selectedNodeIds || context.canvas?.selectedNodeIds || [];
        const count = selectedIds.length;

        if (count > 0) {
          reply = `### 📐 画布节点智能整理排版
我已检测到您当前选中了 **${count}** 个卡片，正在后台自动为您执行排版整理，排版模式设为：【${layoutPreset === 'grid' ? '网格' : layoutPreset === 'row' ? '横排' : '竖排'}】。`;
          
          actions.push({
            type: 'canvas.arrangeNodes',
            payload: {
              nodeIds: selectedIds,
              mode: layoutPreset === 'compact-grid' ? 'grid' : layoutPreset,
              preset: layoutPreset
            }
          });
        } else {
          reply = `### 📐 画布节点智能整理排版
检测到您当前未选中任何卡片，我将在后台为您自动整理画布上的**所有卡片**，排版模式设为：【${layoutPreset === 'grid' ? '网格' : layoutPreset === 'row' ? '横排' : '竖排'}】。`;

          actions.push({
            type: 'canvas.arrangeNodes',
            payload: {
              nodeIds: [],
              mode: layoutPreset === 'compact-grid' ? 'grid' : layoutPreset,
              preset: layoutPreset
            }
          });
        }
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
        const taskDomain = intentResult.extracted.taskDomain || 'general';
        const aspectRatio = intentResult.extracted.aspectRatio || '1:1';
        const layoutPreset = intentResult.extracted.layoutPreset || 'grid';
        const batchPlanId = 'batch_' + Date.now();
        const extractedOutputGroup = intentResult.extracted.outputGroup;
        const outputGroup = {
          label: extractedOutputGroup?.label || (taskDomain === 'ecommerce' ? 'AI ecommerce batch' : 'AI batch output'),
          color: extractedOutputGroup?.color || '#ffffff',
          includePromptNodes: extractedOutputGroup?.includePromptNodes ?? true,
          tags: Array.from(new Set([...(extractedOutputGroup?.tags || []), 'automation', `batch:${batchPlanId}`]))
        };

        reply = `### 📁 准备从选定文件夹执行批量重绘生图
我已将导入的项目资源池共 **${imageCount}** 张参考图绑定至批量任务中。
此操作将为文件夹内的每张图片拉起生成任务，涉及高额积分消耗。执行计划如下：`;

        actions.push({
          type: 'startBatchGeneration',
          payload: {
            plan: {
              id: batchPlanId,
              sourceCollectionId: 'assets_pool',
              imageIds,
              taskDomain,
              aspectRatio,
              layoutPreset,
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
              confirmationRequired: true,
              outputGroup
            }
          }
        });
        break;
      }

      default: {
        reply = `由于未配置云端模型，目前我正运行在本地基础脑模式，处理复杂意图的能力有限。
对于您刚才的输入，我未能在本地匹配到精准的执行指令。
为了获得完整的 AI 智能接管与规划能力，建议您前往配置相应的对话和图片模型。
您可以直接点击 👉 [去配置模型](action://open-settings-api) 快速进行设置。`;
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
