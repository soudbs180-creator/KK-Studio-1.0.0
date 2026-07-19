// 简体中文：本地脑 (Local Brain) 模块

import type { AssistantPlan, SanitizedProjectContext, AssistantAction } from '../types';
import { analyzeIntent } from './intentGate.ts';
import { PROJECT_KNOWLEDGE, matchLocalKnowledge } from '../prompts/projectKnowledge.ts';
import { PROMPT_LIBRARY } from '../prompts/promptLibrary.ts';
import { matchPromptTemplates } from '../prompts/promptMatcher.ts';
import { optimizePromptLocally } from '../prompts/localPromptOptimizer.ts';
import { safetyPolicy } from './safetyPolicy.ts';
import { confirmationPolicy } from './confirmationPolicy.ts';

const SETTINGS_VIEW_LABELS: Record<string, string> = {
  dashboard: '设置总览',
  'api-management': 'API 工作台',
  'consumption-records': '计费账本',
  'storage-settings': '存储设置',
  'system-logs': '系统日志',
  'user-profile': '个人中心',
  'browser-assistant': '浏览器助手',
  'project-manager': '工程管理'
};

const SURFACE_LABELS: Record<string, string> = {
  workspace: '主画布工作区',
  library: '素材库',
  favorites: '收藏夹',
  profile: '个人中心',
  settings: '系统设置',
  admin: '后台管理页面'
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
        const prompt = (intentResult.extracted.prompt || context.promptBarInput?.prompt || '').trim();
        if (!prompt) {
          reply = `### 还需要一条生成提示词
当前输入框为空。请告诉我希望生成什么，或先在画布输入框中填写提示词；在得到明确内容后，我会展示数量、费用与影响范围，再提交持久任务。`;
          break;
        }

        reply = `### 已准备单张生成计划
提示词：「${prompt}」；预计输出 1 张。确认后将通过 DurableGenerationQueue 创建可恢复任务，并在完成后导入当前画布。`;
        actions.push({
          type: 'generation.createBatchJob',
          payload: {
            prompts: [{ prompt }],
            options: {
              countPerPrompt: 1,
              layout: 'grid'
            }
          }
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

      case 'navigate_to_surface': {
        const surface = intentResult.extracted.surface || 'workspace';
        const label = SURFACE_LABELS[surface] || '工作区';
        let actionUrl = `action://open-${surface}`;
        if (surface === 'workspace') actionUrl = 'action://open-workspace';

        reply = `### 🌐 正在为您跳转至${label}
这是本地安全跳转，我会直接调用页面导航控制器，不需要先配置模型。
您也可以手动点击 👉 [立即跳转到${label}](${actionUrl}) 快速切换。`;

        actions.push({
          type: 'ui.navigateToSurface',
          payload: { surface }
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

        // 针对不同页面的自然语言微动作映射 (高亮特定的按钮)
        const lowerInput = userInput.toLowerCase();
        if (settingsView === 'storage-settings') {
          if (/缓存|碎片|失效|清理/.test(lowerInput)) {
            actions.push({
              type: 'highlightElement',
              payload: { selector: 'button[data-storage-settings-action="storage-settings.cleanBrokenCards"]' }
            });
          } else if (/清空|全部/.test(lowerInput)) {
            actions.push({
              type: 'highlightElement',
              payload: { selector: 'button[data-storage-settings-action="storage-settings.clearAllData"]' }
            });
          }
        } else if (settingsView === 'consumption-records') {
          if (/api|接口|开发/.test(lowerInput)) {
            actions.push({
              type: 'highlightElement',
              payload: { selector: 'button[data-consumption-records-action="consumption-records.switchToApiLedger"]' }
            });
          } else if (/积分|额度|用户/.test(lowerInput)) {
            actions.push({
              type: 'highlightElement',
              payload: { selector: 'button[data-consumption-records-action="consumption-records.switchToCreditsLedger"]' }
            });
          } else if (/刷新/.test(lowerInput)) {
            actions.push({
              type: 'highlightElement',
              payload: { selector: 'button[data-consumption-records-action="consumption-records.refreshLedger"]' }
            });
          }
        } else if (settingsView === 'user-profile') {
          if (/消费|使用|明细|记录|日志/.test(lowerInput)) {
            actions.push({
              type: 'highlightElement',
              payload: { selector: 'button[data-user-profile-action="user-profile.switchToUsageLogs"]' }
            });
          } else if (/充值|交易|入账/.test(lowerInput)) {
            actions.push({
              type: 'highlightElement',
              payload: { selector: 'button[data-user-profile-action="user-profile.switchToRechargeLogs"]' }
            });
          } else if (/复制|id/.test(lowerInput)) {
            actions.push({
              type: 'highlightElement',
              payload: { selector: 'button[data-user-profile-action="user-profile.copyUserId"]' }
            });
          }
        } else if (settingsView === 'project-manager') {
          if (/下载|备份|导出|原图/.test(lowerInput)) {
            actions.push({
              type: 'highlightElement',
              payload: { selector: 'button[data-project-manager-action="project-manager.downloadProjectOriginals"]' }
            });
          }
        }
        break;
      }

      case 'control_multidevice': {
        reply = `### 🌐 正在检查 Browser Assistant 连接状态
我会读取本地守护进程、Chrome Bridge 插件、平台池和会话池的脱敏状态；如果未连接，只返回安装/连接引导，不会伪造成功结果。`;

        actions.push({
          type: 'browser.getStatus',
          payload: {}
        });
        break;
      }

      case 'extract_page_content': {
        const url = intentResult.extracted.url || '';
        reply = `### 🌐 准备通过 Browser Bridge 提取商品页
目标链接：\`${url || '未识别到链接'}\`

此操作会读取外部网页的标题、价格、主图和描述摘要。执行前需要您确认 Browser Bridge 授权。`;

        actions.push({
          type: 'browser.extractProduct',
          payload: {
            url,
            targets: ['price', 'title', 'image', 'description'],
            label: 'Browser Assistant product extraction'
          }
        });
        break;
      }

      case 'browser_generate_external': {
        const prompt = context.promptBarInput?.prompt || userInput || '商品海报图';
        const count = intentResult.extracted.count || 1;
        reply = `### 🌐 网页直通生图计划已准备
我会通过 Browser Bridge 调用外部网页平台会话池执行生图任务，预计生成 **${count}** 张。若本地守护进程或 Chrome 插件未连接，系统只会返回连接引导。`;

        actions.push({
          type: 'browser.generateExternal',
          payload: {
            prompt,
            platformId: 'leonardo',
            count,
            sessionCount: intentResult.extracted.sessionCount
          }
        });
        break;
      }

      case 'browser_publish_draft': {
        reply = `### 🌐 外部草稿箱分发计划已准备
我只会通过 Browser Bridge 保存到草稿箱，不会直接公开发布内容。`;

        actions.push({
          type: 'browser.publishDraft',
          payload: {
            channelId: 'xhs'
          }
        });
        break;
      }

      case 'browser_write_back_dom': {
        reply = `### ⚠️ 网页 DOM 回写需要二次确认
此操作会修改外部网页可见 DOM 字段。请确认目标页面和字段无误后再执行。`;

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

      case 'resume_generation_job': {
        const jobId = intentResult.extracted.jobId || '';
        reply = `### 已准备恢复暂停的生成任务
我会通过 \`generation.resumeJob\` 恢复任务 \`${jobId}\`。系统会先核对它仍处于暂停状态；继续处理未完成项目可能消耗积分或 Provider 配额。`;

        actions.push({
          type: 'generation.resumeJob',
          payload: { jobId }
        });
        break;
      }

      case 'retry_generation_job': {
        const jobId = intentResult.extracted.jobId || '';
        const retryTargetLabel = jobId ? `任务 \`${jobId}\`` : '最近一个存在失败项的批量任务';
        const retryPayload = intentResult.extracted.jobId
          ? { jobId: intentResult.extracted.jobId }
          : {};
        reply = `### 已准备重试失败批次
AgentRuntime 会在展示确认卡前把${retryTargetLabel}冻结为具体 Job、版本和失败项集合；确认后不会改选其他任务。通过 \`generation.retryJob\` 重新入队时，已完成结果不会重复提交。`;

        actions.push({
          type: 'generation.retryJob',
          payload: retryPayload
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

      case 'image_edit_missing_selection': {
        reply = `请选择一张图或拖入参考图`;
        break;
      }

      case 'image_to_video': {
        const refImageId = intentResult.extracted.referenceImageNodeId;
        const duration = intentResult.extracted.duration || 4;
        const motion = intentResult.extracted.motion || 'pan';
        reply = `### 🎬 准备为您生成视频版...
        已将生成模式切换至【视频】模式，并准备好以选定图片作为参考，以时长 **${duration}秒** 及运镜方式【${motion}】执行生成任务。`;
        
        actions.push({
          type: 'generation.createVideoJob',
          payload: {
            prompt: `generate video version, motion: ${motion}`,
            referenceImageNodeId: refImageId,
            durationSeconds: duration,
            motion
          }
        });
        break;
      }

      case 'research_to_canvas': {
        const subject = intentResult.extracted.style || '品牌视觉';
        const count = intentResult.extracted.count || 6;
        
        const isCoffee = /咖啡|coffee/i.test(userInput);
        let researchTitle = `品牌研究: ${subject}`;
        let researchBrief = `### 📋 ${subject} 视觉方案深度研究大纲
1. **核心概念**：现代极简主义与自然美学结合，注重材质肌理与光影留白。
2. **调色板**：温暖大地色系、燕麦白、低饱和灰与标志性点缀色。
3. **排版设计**：大面积优雅留白，搭配极细无衬线现代字体。`;
        
        let visualDirections = [
          '方向一：自然光影产品特写（以自然侧光照亮主体，营造静谧高端感）',
          '方向二：极简材质空间组合（展现产品与水泥、木质表面的质感碰撞）',
          '方向三：人机交互质感瞬间（聚焦使用时的局部细节与生活方式共鸣）'
        ];

        let prompts = [
          `A premium minimalist packaging box for ${subject}, shot on organic concrete surface, soft window shadow, warm oatmeal tone background, photorealistic 4k`,
          `Modern minimal store mockup with ${subject} design elements, concrete wall, warm spotlight, architectural lines, elegant, ultra detailed`,
          `Close-up shot of a hand holding a beautifully designed ${subject} item, soft studio lighting, organic linen clothes, clean aesthetic`,
          `Minimal graphic poster for ${subject}, abstract geometric shapes, earthy colors, large copy space, high-end editorial layout`,
          `Flatlay of ${subject} collection on a textured oak table, decorated with dried plants, high-end branding layout, shot from above`,
          `Modern Japanese interior design concept showing ${subject} branding products on a floating shelf, warm light glow, minimalist lifestyle`
        ];

        if (isCoffee) {
          researchTitle = `品牌研究: 极简咖啡品牌风格`;
          researchBrief = `### 📋 极简咖啡品牌 视觉方案深度研究大纲
1. **核心概念**：现代日式极简主义与 Wabi-Sabi 侘寂美学的完美碰撞。
2. **调色板**：燕麦色 (#F5F2EB)、磨砂白 (#FFFFFF)、炭黑 (#1A1A1A) 与原木色 (#D2B48C)。
3. **视觉排版**：大面积留白设计，搭配前卫的无衬线英文字体，突出产品静谧质感。`;
          
          visualDirections = [
            '方向一：晨光下的暖咖杯影（结合侧光与水合气泡，营造温润 of 唤醒仪式）',
            '方向二：寂风咖啡店一角（通过粗糙水泥墙面与胡桃木桌椅的对比展现材质冷暖）',
            '方向三：手冲滤泡拉丝瞬间（微距抓拍水流与滤杯的动态交融，强调匠心细节）'
          ];
          
          prompts = [
            'A ceramic coffee cup on an oak table in morning light, minimalist cafe style, 4k',
            'Minimalist cafe interior, concrete walls, Wabi-Sabi style, spacious and airy, photorealistic',
            'Hand pouring hot water into a coffee dripper, close-up, steam rising, minimalist dark background',
            'A stack of simple coffee packaging bags, warm oatmeal tones, elegant typography, studio lighting',
            'Oat milk latte art in a glass, close-up, textured froth, elegant wooden tray, minimal decor',
            'Minimal coffee store entrance, black steel frame, warm light glow, modern Japanese aesthetic'
          ];
        }

        const promptSet = prompts.slice(0, count);

        reply = `### 🧬 深度品牌研究与视觉规划已完成！
确认后，我会在画布上新建 **Research Brief 研究卡片**，并将 **${count}** 个视觉生成任务提交至 Durable 队列。
生成步骤验证通过后，再把「${subject}」的研究成果写入 KnowledgeStore。`;

        actions.push({
          type: 'generation.createBatchJob',
          payload: {
            prompts: promptSet.map((p, idx) => ({
              id: 'prompt_item_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 9),
              prompt: p
            })),
            options: {
              aspectRatio: '3:4',
              layoutPreset: 'grid',
              researchBrief: `${researchBrief}\n\n**建议视觉方向：**\n${visualDirections.join('\n')}`,
              outputGroup: {
                label: `研究生成：${subject}`,
                color: '#6366f1',
                includePromptNodes: true,
                tags: ['research', 'automation']
              }
            },
            idempotencyKey: 'research_job_' + Date.now()
          }
        });
        actions.push({
          type: 'knowledge.recordChange',
          payload: {
            title: researchTitle,
            summary: `已为 ${subject} 视觉方案设计了研究大纲、3大视觉方向，并规划了 ${count} 张图片的生成方案。`,
            source: 'runtime'
          }
        });
        break;
      }

      case 'generate_audio': {
        const duration = intentResult.extracted.duration || 30;
        const genre = intentResult.extracted.genre || 'ambient lofi';
        let promptText = userInput
          .replace(/(开始生成|直接生成|出图|跑图|生成音乐|生成音频|做段音乐|搞个音效|创作音乐|做段bgm|bgm|音乐|音频|音效)/g, '')
          .trim();
        if (!promptText) {
          promptText = 'a relaxing ambient background music';
        }
        reply = `### 🎵 准备为您生成音乐/音效
        我将生成一段时长为 **${duration}秒**，风格为【${genre}】的音频。提示词设定为：「${promptText}」。
        此操作涉及额度消耗，已为您准备好执行计划，请确认：`;
        
        actions.push({
          type: 'generation.createAudioJob',
          payload: {
            prompt: promptText,
            durationSeconds: duration,
            genre
          }
        });
        break;
      }

      case 'generate_images': {
        const count = intentResult.extracted.count || 4;
        const refImageId = intentResult.extracted.referenceImageNodeId;
        const aspectRatio = intentResult.extracted.aspectRatio;
        
        let promptText = (intentResult.extracted.prompt || userInput
          .replace(/(开始生成|直接生成|出图|跑图|生成|创造|绘图|把背景换成|换背景|背景改为|做成电商主图|更高级一点|更高级)/g, '')
          .replace(/(\d+)\s*(张|个)/g, '')
          .replace(/“/g, '').replace(/”/g, ''))
          .trim();

        if (!promptText) {
          promptText = refImageId ? 'enhance details' : 'a detailed visual art';
        }

        if (refImageId) {
          reply = `### 🚀 准备进行图片修改
我将基于选中的参考图片，生成 **1** 张新图片。修改指令：「${promptText}」。
此操作涉及额度消耗，我已为您准备好执行计划，请确认：`;

          actions.push({
            type: 'startGeneration',
            payload: {
              prompt: promptText,
              count: 1,
              aspectRatio,
              referenceImageNodeId: refImageId
            }
          });
        } else {
          reply = `### 🚀 准备开始生成图片
我将为您生成 **${count}** 张图片。提示词设定为：「${promptText}」。
此操作涉及额度消耗，我已为您准备好执行计划，请确认：`;

          actions.push({
            type: 'startGeneration',
            payload: {
              prompt: promptText,
              count,
              aspectRatio
            }
          });
        }
        break;
      }

      case 'batch_generate_from_folder': {
        const imageIds = intentResult.extracted.fileIds || context.assets?.images?.map(img => img.id) || [];
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

        if (taskDomain === 'ecommerce' && imageIds.length > 0) {
          reply = `### 🛍️ 准备执行电商主图批量重绘
共选中 **${imageCount}** 张图片作为批量生成的参考图。执行计划如下：`;
          
          actions.push({
            type: 'ecommerce.createBatchTransformJob',
            payload: {
              imageIds,
              rawUserRequest: userInput,
              aspectRatio,
              layoutPreset,
              outputGroup,
              productCategory: intentResult.extracted.productCategory,
              idempotencyKey: batchPlanId
            }
          });
        } else {
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
                productCategory: intentResult.extracted.productCategory,
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
        }
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
