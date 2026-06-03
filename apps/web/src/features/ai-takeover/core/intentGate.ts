// 简体中文：意图分析门控 (Intent Gate) 模块

import type { AssistantIntent, IntentResult, SanitizedProjectContext } from '../types.ts';

const promptOnlyWords = [
  '优化提示词', '改提示词', '润色提示词', '整理提示词',
  '给我提示词', '提示词怎么写', '只要提示词', '帮我优化'
];

const explicitGenerateWords = [
  '生成', '开始生成', '直接生成', '出图', '跑图', '批量生成', '每张都生成', '创造', '绘图'
];

/**
 * 核心判断：是否应该被当做生图任务处理
 * 规则：若只包含提示词润色/优化的词汇，而没有明确的“生成/出图/跑图”指令，则不能生成图片，只能优化提示词。
 */
export function shouldTreatAsGeneration(input: string): boolean {
  const hasPromptOnly = promptOnlyWords.some(word => input.includes(word));
  const hasGenerate = explicitGenerateWords.some(word => input.includes(word));
  if (hasPromptOnly && !hasGenerate) return false;
  return hasGenerate;
}

/**
 * 意图门控解析函数
 */
export function analyzeIntent(input: string, context?: SanitizedProjectContext): IntentResult {
  const cleanInput = (input || '').trim();
  const lowerInput = cleanInput.toLowerCase();
  // 1. 复杂串联模式生图+生视频
  if ((lowerInput.includes('生图') && lowerInput.includes('视频')) || (lowerInput.includes('生成一张图片') && lowerInput.includes('生成一个视频'))) {
    return {
      intent: 'complex_sequence',
      confidence: 0.95,
      extracted: {},
      risk: 'cost',
      needsConfirmation: false,
      reason: '识别到连续的生图且图生视频多阶段操作。'
    };
  }

  // 2. 切换生成模式意图
  if (/切换(?:至|到)?(图片|视频|音频|ppt|电商|ecommerce)(?:模式)?/.test(lowerInput)) {
    const match = lowerInput.match(/切换(?:至|到)?(图片|视频|音频|ppt|电商|ecommerce)(?:模式)?/);
    const modeName = match ? match[1] : '';
    let mode = 'image';
    if (modeName.includes('视频')) mode = 'video';
    else if (modeName.includes('音频')) mode = 'audio';
    else if (modeName.includes('ppt')) mode = 'ppt';
    else if (modeName.includes('电商') || modeName.includes('ecommerce')) mode = 'ecommerce';

    return {
      intent: 'change_generation_mode',
      confidence: 0.95,
      extracted: {
        style: mode
      },
      risk: 'none',
      needsConfirmation: false,
      reason: '识别到切换生成模式指令。'
    };
  }

  // 3. 帮我发送意图
  if (/帮我发送|帮我运行|帮我出图|帮我跑图|把输入框发一下/.test(lowerInput)) {
    return {
      intent: 'submit_composer',
      confidence: 0.95,
      extracted: {},
      risk: 'cost',
      needsConfirmation: false,
      reason: '识别到发送/运行生成意图。'
    };
  }

  // 4. 帮我建卡意图
  if (/帮我建卡|建个卡片|创建卡片/.test(lowerInput)) {
    return {
      intent: 'create_card',
      confidence: 0.95,
      extracted: {},
      risk: 'none',
      needsConfirmation: false,
      reason: '识别到在画布上新建卡片意图。'
    };
  }

  // 5. 优化输入框提示词意图
  if (/优化(?:一下)?输入框|优化输入栏|帮我把输入框的提示词优化一下|优化提示词并且填充|优化电商提示词/.test(lowerInput)) {
    return {
      intent: 'optimize_input_prompt',
      confidence: 0.95,
      extracted: {},
      risk: 'none',
      needsConfirmation: false,
      reason: '识别到优化输入框内提示词的指令。'
    };
  }

  // 6. API 配置引导意图
  if (
    /api|key|密钥|配置|接口|设置key|专属key|设置api|密钥怎么写/.test(lowerInput) &&
    !lowerInput.includes('生成')
  ) {
    return {
      intent: 'configure_api',
      confidence: 0.9,
      extracted: {},
      risk: 'none',
      needsConfirmation: false,
      reason: '匹配到 API 密钥配置相关的指示词。'
    };
  }

  // 2. 错误排查意图
  if (/报错|错误|失败|崩溃|断开|不工作|故障|限流|退款|无法运行/.test(lowerInput)) {
    return {
      intent: 'explain_error',
      confidence: 0.95,
      extracted: {},
      risk: 'none',
      needsConfirmation: false,
      reason: '识别到错误、异常、失败等排错关键字。'
    };
  }

  // 3. 卡片检索与定位意图
  if (/查找|定位|找到|搜下|高亮卡片|聚焦卡片|在哪/.test(lowerInput) || /[a-z0-9]+-\d{4}-\d+/.test(lowerInput)) {
    // 优先匹配形如 deepseek-1007-1 的供应商 ID
    const apiIdMatch = lowerInput.match(/([a-z0-9]+-\d{4}-\d+)/);
    const cardQueryMatch = cleanInput.match(/(?:查找|定位|找到|搜下|高亮|聚焦)(?:包含)?(?:“|")?([^”\"]+)(?:”|")?的?(?:卡片|节点)?/);
    
    return {
      intent: 'search_card',
      confidence: apiIdMatch ? 0.95 : 0.85,
      extracted: {
        cardQuery: apiIdMatch ? apiIdMatch[1] : (cardQueryMatch ? cardQueryMatch[1] : cleanInput.replace(/[查找定位找到搜下高亮聚焦卡片节点]/g, '').trim())
      },
      risk: 'none',
      needsConfirmation: false,
      reason: apiIdMatch ? '直接识别到 API 供应商 ID，准备定位供应商卡片。' : '识别到卡片检索或视口跳转聚焦意图。'
    };
  }

  // 4. 下载与 ZIP 导出意图
  if (/下载|导出|打包|zip|保存结果|打包下载/.test(lowerInput)) {
    let scope = 'latest_batch';
    if (lowerInput.includes('选中') || lowerInput.includes('选择')) scope = 'selected_cards';
    else if (lowerInput.includes('当前') || lowerInput.includes('画布')) scope = 'all_canvas_outputs';

    return {
      intent: 'download_outputs',
      confidence: 0.9,
      extracted: {
        downloadScope: scope
      },
      risk: 'none',
      needsConfirmation: false, // 下载不需要额外确认，只在范围不明确时让用户选即可
      reason: '识别到文件 ZIP 压缩与下载意图。'
    };
  }

  // 5. 资源文件上传/导入意图
  if (/上传|导入|拖入|添加图片|添加文件|导入文件夹/.test(lowerInput)) {
    return {
      intent: 'upload_assets',
      confidence: 0.85,
      extracted: {},
      risk: 'upload',
      needsConfirmation: true, // 上传文件给 AI 必须经过确认
      reason: '检测到用户触发资源上传或添加文件/文件夹请求。'
    };
  }

  // 6. 文件夹批量生成意图
  if (
    /批量|文件夹|每张|所有图片|全部图片/.test(lowerInput) &&
    (/生成|出图|跑图|风格化/.test(lowerInput) || shouldTreatAsGeneration(cleanInput))
  ) {
    return {
      intent: 'batch_generate_from_folder',
      confidence: 0.9,
      extracted: {
        count: 0 // 待后续在 Context 中解析真实数量
      },
      risk: 'cost',
      needsConfirmation: true, // 批量生成涉及消耗额度和参考图，属于高风险操作，强制弹卡片确认
      reason: '检测到从指定图片库或文件夹执行批量生成的意图，属于高积分消耗操作，必须强确认。'
    };
  }

  // 7. 单图生成/多图生成意图
  if (shouldTreatAsGeneration(cleanInput)) {
    // 提取可能的生图数量
    const countMatch = lowerInput.match(/(\d+)\s*(张|个)/);
    const count = countMatch ? parseInt(countMatch[1]) : 1;

    return {
      intent: 'generate_images',
      confidence: 0.85,
      extracted: {
        count
      },
      risk: 'cost',
      needsConfirmation: true, // 单图或多图生成必须弹出确认卡片
      reason: '检测到明确的画图或出图意图，将消耗积分或调用远程大模型，需要获得用户确认。'
    };
  }

  // 8. 优化提示词/润色提示词意图 (最高优先级生图冲突拦截)
  if (promptOnlyWords.some(word => lowerInput.includes(word)) || lowerInput.includes('提示词')) {
    return {
      intent: 'optimize_prompt',
      confidence: 0.9,
      extracted: {},
      risk: 'none',
      needsConfirmation: false, // 纯优化提示词，绝不自动生成图片，也不需要弹卡片确认
      reason: '用户仅请求优化、润色或编写提示词，绝不能直接拉起图片生成流程。'
    };
  }

  // 9. 帮助说明
  if (/帮助|使用|指南|怎么用|介绍|新手|菜单/.test(lowerInput)) {
    return {
      intent: 'help',
      confidence: 0.8,
      extracted: {},
      risk: 'none',
      needsConfirmation: false,
      reason: '匹配到关于使用帮助和使用说明的咨询。'
    };
  }

  // 10. 默认未知
  return {
    intent: 'unknown',
    confidence: 0.5,
    extracted: {},
    risk: 'none',
    needsConfirmation: false,
    reason: '意图不明确，将转为通用回答或向用户寻求澄清。'
  };
}
