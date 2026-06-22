// 简体中文：意图分析门控 (Intent Gate) 模块

import type { AssistantIntent, IntentResult, SanitizedProjectContext } from '../types.ts';

const promptOnlyWords = [
  '优化提示词', '改提示词', '润色提示词', '整理提示词',
  '给我提示词', '提示词怎么写', '只要提示词', '帮我优化'
];

const explicitGenerateWords = [
  '生成', '开始生成', '直接生成', '出图', '跑图', '批量生成', '每张都生成', '创造', '绘图'
];

const quickSettingsRoutes = [
  {
    view: 'user-profile',
    label: '个人中心',
    pattern: /个人中心|用户中心|个人资料|个人信息|账户中心|账号中心|我的账户|我的账号|profile/
  },
  {
    view: 'api-management',
    label: 'API 工作台',
    pattern: /\bapi\b|api\s*设置|api工作台|api\s*工作台|接口设置|接口管理|模型配置|模型设置|供应商|密钥管理/
  },
  {
    view: 'browser-assistant',
    label: 'Browser Assistant',
    pattern: /浏览器助手|browser\s*assistant|browser\s*bridge|chrome\s*bridge|浏览器接管/i
  },
  {
    view: 'consumption-records',
    label: '计费账本',
    pattern: /计费|账单|消费|消耗|用量|积分记录|充值记录|消费记录/
  },
  {
    view: 'storage-settings',
    label: '存储设置',
    pattern: /存储|容量|空间|资源存储|清理缓存/
  },
  {
    view: 'dashboard',
    label: '设置总览',
    pattern: /设置总览|设置首页|设置面板|打开设置|系统设置|settings/
  }
] as const;

function resolveQuickSettingsRoute(input: string): { view: string; label: string } | null {
  const isNavigationRequest = /帮我打开|帮我看|打开|查看|进入|跳到|跳转|去|定位到|带我去/.test(input);
  if (!isNavigationRequest) return null;

  const matched = quickSettingsRoutes.find(route => route.pattern.test(input));
  return matched ? { view: matched.view, label: matched.label } : null;
}

function extractSimpleGeneratePrompt(input: string): string {
  return input
    .replace(/^(请|麻烦|帮我|请帮我|麻烦帮我|给我|我要|我想要)\s*/g, '')
    .replace(/^(直接)?(生成|开始生成|出图|跑图|绘图|画|创建|做)\s*(一个|一张|一下|个|张)?\s*/g, '')
    .replace(/(\d+)\s*(张|个)/g, '')
    .replace(/[“”"]/g, '')
    .trim();
}

const matchAny = (input: string, patterns: RegExp[]): boolean =>
  patterns.some(pattern => pattern.test(input));

function extractGenerationJobId(input: string): string | undefined {
  return input.match(/\b(?:job|batch)_[a-zA-Z0-9_-]+\b/)?.[0];
}

function extractHttpUrl(input: string): string | undefined {
  return input.match(/https?:\/\/[^\s"'<>]+/i)?.[0]?.replace(/[，。；、,.!?]+$/u, '');
}

function extractCountNear(input: string, fallback = 1): number {
  const match = input.match(/(\d+)\s*(?:张|个|次|幅|份|images?|pics?|outputs?)/i);
  return match ? Math.max(1, parseInt(match[1], 10)) : fallback;
}

function extractBrowserSessionCount(input: string): number | undefined {
  const match = input.match(/(\d+)\s*(?:个)?\s*(?:号|账号|会话|sessions?|tabs?)/i);
  return match ? Math.max(1, parseInt(match[1], 10)) : undefined;
}

function extractAspectRatio(input: string): string | undefined {
  const match = input.match(/(?:aspect\s*ratio|ratio|比例|画幅|比例改成|比例调整为|改成比例)?\s*(\d{1,2})\s*[:：]\s*(\d{1,2})/i);
  if (!match) return undefined;
  return `${match[1]}:${match[2]}`;
}

function extractLayoutPreset(input: string): 'compact-grid' | 'grid' | 'row' | 'column' | undefined {
  if (matchAny(input, [/紧凑|紧密|compact|密集|排版布局|紧凑.*布局|布局.*紧凑/i])) {
    return 'compact-grid';
  }
  if (matchAny(input, [/横排|一行|row/i])) return 'row';
  if (matchAny(input, [/竖排|一列|column/i])) return 'column';
  if (matchAny(input, [/网格|宫格|grid/i])) return 'grid';
  return undefined;
}

function extractTaskDomain(input: string): 'ecommerce' | 'general' {
  return matchAny(input, [/电商|商品|主图|详情页|A\+|亚马逊|淘宝|京东|排版|布局|卖点|产品图/i])
    ? 'ecommerce'
    : 'general';
}

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
  const retryJobId = extractGenerationJobId(cleanInput);
  const firstUrl = extractHttpUrl(cleanInput);
  const hasRetryGenerationCommand = /重试|重新跑|再试|retry|rerun/i.test(cleanInput);
  const hasFailedBatchTarget = Boolean(retryJobId) || /失败.*(批次|队列|任务)|(?:批次|队列|任务).*(失败)|刚才|上次|最近|latest|last|recent|failed\s+(?:job|batch)|job|batch/i.test(cleanInput);

  if (
    hasRetryGenerationCommand &&
    hasFailedBatchTarget
  ) {
    return {
      intent: 'retry_generation_job',
      confidence: 0.93,
      extracted: retryJobId ? { jobId: retryJobId } : { retryTarget: 'latest_failed' },
      risk: 'none',
      needsConfirmation: false,
      reason: '识别到重试失败批量生成任务的安全队列控制指令。'
    };
  }

  const hasBrowserAssistantSurface = /浏览器助手|browser\s*assistant|网页直通|多端|守护进程|chrome\s*插件|bridge\s*插件|插件状态|daemon/i.test(cleanInput);
  if (hasBrowserAssistantSurface && /检查|检测|诊断|状态|连接|连通|是否可用|健康/i.test(cleanInput)) {
    return {
      intent: 'control_multidevice',
      confidence: 0.94,
      extracted: {
        browserAction: 'status'
      },
      risk: 'none',
      needsConfirmation: false,
      reason: '识别到 Browser Assistant 本地守护进程与 Chrome 插件连接诊断请求。'
    };
  }

  if (firstUrl && /抓取|提取|解析|读取|商品|价格|主图|详情页|网页|extract/i.test(cleanInput)) {
    return {
      intent: 'extract_page_content',
      confidence: 0.92,
      extracted: {
        browserAction: 'extract_product',
        url: firstUrl
      },
      risk: 'upload',
      needsConfirmation: true,
      reason: '识别到外部网页商品信息提取请求，需通过 Browser Bridge 并经用户确认。'
    };
  }

  if (/回写|写回|同步.*dom|dom.*同步|修改网页|改网页/.test(lowerInput)) {
    return {
      intent: 'browser_write_back_dom',
      confidence: 0.9,
      extracted: {
        browserAction: 'write_back_dom',
        url: firstUrl
      },
      risk: 'destructive',
      needsConfirmation: true,
      reason: '识别到外部网页 DOM 回写请求，属于危险操作，必须二次确认。'
    };
  }

  if (/小红书|微博|草稿|分发|发布草稿|保存草稿/.test(lowerInput) && /分发|发布|草稿|保存/.test(lowerInput)) {
    return {
      intent: 'browser_publish_draft',
      confidence: 0.88,
      extracted: {
        browserAction: 'publish_draft'
      },
      risk: 'upload',
      needsConfirmation: true,
      reason: '识别到外部社媒草稿箱分发请求，只允许保存草稿，不直接公开发布。'
    };
  }

  if (
    /网页直通|代理|多开|外部平台|leonardo|midjourney|tensor|browser\s*bridge/i.test(cleanInput) &&
    /生成|生图|跑图|跑\s*\d*\s*张|海报|出图|generate/i.test(cleanInput)
  ) {
    const countMatch = lowerInput.match(/(\d+)\s*(?:张|幅|份)(?=.*(?:图|海报|图片|生成|生图|出图|跑))/);
    const sessionCount = extractBrowserSessionCount(cleanInput);
    return {
      intent: 'browser_generate_external',
      confidence: 0.91,
      extracted: {
        browserAction: 'generate_external',
        count: countMatch ? Number.parseInt(countMatch[1], 10) : extractCountNear(cleanInput, 1),
        sessionCount
      },
      risk: 'cost',
      needsConfirmation: true,
      reason: '识别到网页直通或多账号代理生图请求，需通过 Browser Bridge 并经用户确认。'
    };
  }

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

  // 6. 系统日志查看意图。安全 UI 操作必须优先于 API 配置兜底识别。
  if (/打开日志|查看日志|系统日志|日志流|运行日志|我的日志/.test(lowerInput)) {
    return {
      intent: 'open_logs',
      confidence: 0.95,
      extracted: {},
      risk: 'none',
      needsConfirmation: false,
      reason: '匹配到查看或打开系统日志的指示。'
    };
  }

  // 6.2. 设置页快速跳转。凡是“帮我打开/查看/进入某功能”，优先走本地 UI 工具，不请求模型。
  const quickSettingsRoute = resolveQuickSettingsRoute(lowerInput);
  if (quickSettingsRoute) {
    return {
      intent: 'open_settings_view',
      confidence: 0.95,
      extracted: {
        settingsView: quickSettingsRoute.view
      },
      risk: 'none',
      needsConfirmation: false,
      reason: `匹配到快速打开设置页子功能：${quickSettingsRoute.label}。`
    };
  }

  // 6.5. API 配置引导意图
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

  // 6.8. 简单“生成一个...”直接复用画布输入框配置并发送，不绕到独立建卡确认流。
  if (
    shouldTreatAsGeneration(cleanInput) &&
    !/批量|文件夹|每张|所有图片|全部图片|多张|几张/.test(lowerInput) &&
    !/报错|错误|失败|崩溃|断开|不工作|故障|限流|退款|无法运行|下载|导出|打包|保存结果|上传|导入|添加图片|添加文件/.test(lowerInput)
  ) {
    const countMatch = lowerInput.match(/(\d+)\s*(张|个)/);
    const count = countMatch ? parseInt(countMatch[1], 10) : 1;
    if (count <= 1) {
      return {
        intent: 'submit_composer',
        confidence: 0.93,
        extracted: {
          prompt: extractSimpleGeneratePrompt(cleanInput)
        },
        risk: 'cost',
        needsConfirmation: false,
        reason: '识别到简单单次生成指令，复用画布输入框当前模型、比例、参考图等配置并直接发送。'
      };
    }
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
  const isFolderBatchRequest = /批量|文件夹|每张|所有图片|全部图片|全部图|所有图/.test(lowerInput);
  const isBatchTransformRequest = /生成|出图|跑图|风格化|修改|改成|处理|重绘|重做|换成|调整/.test(lowerInput)
    || shouldTreatAsGeneration(cleanInput);
  if (isFolderBatchRequest && isBatchTransformRequest) {
    const aspectRatio = extractAspectRatio(cleanInput);
    const layoutPreset = extractLayoutPreset(cleanInput) || 'grid';
    const taskDomain = extractTaskDomain(cleanInput);
    return {
      intent: 'batch_generate_from_folder',
      confidence: 0.9,
      extracted: {
        count: 0, // 待后续在 Context 中解析真实数量
        taskDomain,
        aspectRatio,
        layoutPreset,
        outputGroup: {
          label: taskDomain === 'ecommerce' ? 'AI ecommerce batch' : 'AI batch output',
          color: '#ffffff',
          includePromptNodes: true,
          tags: ['automation']
        }
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

  // 7.5. 整理与排版画布卡片意图
  if (/整理|排版|排列|对齐|排成一排|排网格|自动整理/.test(lowerInput)) {
    const layoutPreset = extractLayoutPreset(cleanInput) || 'grid';
    return {
      intent: 'arrange_nodes',
      confidence: 0.95,
      extracted: {
        layoutPreset
      },
      risk: 'none',
      needsConfirmation: false,
      reason: '识别到整理与排列卡片排版意图。'
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
