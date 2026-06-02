/**
 * @file wuyinCatalogCrawler.js
 * @description 自动从速创 API 接口文档系统爬取最新模型列表、价格、请求方式和入参，生成本地 Catalog。
 */

const fs = require('fs');
const path = require('path');

// 统一的内置 Fallback 目录，在抓取失败或无网络时使用
const WUYIN_FALLBACK_CATALOG = [
  {
    id: 'image_gpt',
    name: 'GPT-Image-2',
    displayName: 'GPT-Image-2',
    categoryName: '图片模型',
    kind: 'image',
    executionMode: 'async-detail',
    endpointPath: '/api/async/image_gpt',
    endpointUrl: 'https://api.wuyinkeji.com/api/async/image_gpt',
    method: 'POST',
    contentType: 'application/json',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    detailStatusMode: 'wuyin-async',
    price: 0.1,
    priceText: '0.1元/张',
    priceUnit: '张',
    aliases: ['gpt-image-2', 'gpt image 2', 'image_gpt'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'image_nanoBanana2',
    name: 'NanoBanana2',
    displayName: 'NanoBanana2',
    categoryName: '图片模型',
    kind: 'image',
    executionMode: 'async-detail',
    endpointPath: '/api/async/image_nanoBanana2',
    endpointUrl: 'https://api.wuyinkeji.com/api/async/image_nanoBanana2',
    method: 'POST',
    contentType: 'application/json',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    detailStatusMode: 'wuyin-async',
    price: 0.1,
    priceText: '0.1元/张',
    priceUnit: '张',
    aliases: ['nanobanana2', 'nano-banana-2', 'nano banana 2', 'gemini-3.1-flash-image-preview', 'gemini-3.1-flash-image', 'image_nanoBanana2'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'image_grok_imagine',
    name: 'grok_imagine',
    displayName: 'grok_imagine',
    categoryName: '图片模型',
    kind: 'image',
    executionMode: 'async-detail',
    endpointPath: '/api/async/image_grok_imagine',
    endpointUrl: 'https://api.wuyinkeji.com/api/async/image_grok_imagine',
    method: 'POST',
    contentType: 'application/json',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    detailStatusMode: 'wuyin-async',
    price: 0.1,
    priceText: '0.1元/张',
    priceUnit: '张',
    aliases: ['grok_imagine', 'grok imagine', 'image_grok_imagine'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'image_nanoBanana_pro',
    name: 'NanoBanana_pro',
    displayName: 'NanoBanana_pro',
    categoryName: '图片模型',
    kind: 'image',
    executionMode: 'async-detail',
    endpointPath: '/api/async/image_nanoBanana_pro',
    endpointUrl: 'https://api.wuyinkeji.com/api/async/image_nanoBanana_pro',
    method: 'POST',
    contentType: 'application/json',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    detailStatusMode: 'wuyin-async',
    price: 0.3,
    priceText: '0.3元/张',
    priceUnit: '张',
    aliases: ['nanobanana_pro', 'nanobanana-pro', 'nano-banana-pro', 'nano banana pro', 'gemini-3-pro-image-preview', 'image_nanoBanana_pro'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'image_nanoBanana',
    name: 'NanoBanana',
    displayName: 'NanoBanana',
    categoryName: '图片模型',
    kind: 'image',
    executionMode: 'async-detail',
    endpointPath: '/api/async/image_nanoBanana',
    endpointUrl: 'https://api.wuyinkeji.com/api/async/image_nanoBanana',
    method: 'POST',
    contentType: 'application/json',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    detailStatusMode: 'wuyin-async',
    price: 0.1,
    priceText: '0.1元/张',
    priceUnit: '张',
    aliases: ['nanobanana', 'nano-banana', 'nano banana', 'gemini-2.5-flash-image', 'image_nanoBanana'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'image_wan2.6',
    name: 'Wan2.6',
    displayName: 'Wan2.6',
    categoryName: '图片模型',
    kind: 'image',
    executionMode: 'async-detail',
    endpointPath: '/api/async/image_wan2.6',
    endpointUrl: 'https://api.wuyinkeji.com/api/async/image_wan2.6',
    method: 'POST',
    contentType: 'application/json',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    detailStatusMode: 'wuyin-async',
    price: 0.2,
    priceText: '0.2元/张',
    priceUnit: '张',
    aliases: ['wan2.6', 'wan26', 'wan image', 'image_wan2.6'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'video_google_omni',
    name: 'google_omni',
    displayName: 'google_omni',
    categoryName: '视频模型',
    kind: 'video',
    executionMode: 'async-detail',
    endpointPath: '/api/async/video_google_omni',
    endpointUrl: 'https://api.wuyinkeji.com/api/async/video_google_omni',
    method: 'POST',
    contentType: 'application/json',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    detailStatusMode: 'wuyin-async',
    price: 0.1,
    priceText: '0.1元/秒',
    priceUnit: '秒',
    aliases: ['google_omni', 'google omni', 'video_google_omni'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'video_vidu',
    name: 'video_vidu',
    displayName: 'video_vidu',
    categoryName: '视频模型',
    kind: 'video',
    executionMode: 'async-detail',
    endpointPath: '/api/async/video_vidu',
    endpointUrl: 'https://api.wuyinkeji.com/api/async/video_vidu',
    method: 'POST',
    contentType: 'application/json',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    detailStatusMode: 'wuyin-async',
    price: 1.0,
    priceText: '1.0元/秒',
    priceUnit: '秒',
    aliases: ['vidu', 'video_vidu'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'video_omni',
    name: 'video_omni',
    displayName: 'video_omni',
    categoryName: '视频模型',
    kind: 'video',
    executionMode: 'async-detail',
    endpointPath: '/api/async/video_omni',
    endpointUrl: 'https://api.wuyinkeji.com/api/async/video_omni',
    method: 'POST',
    contentType: 'application/json',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    detailStatusMode: 'wuyin-async',
    price: 1.0,
    priceText: '1.0元/秒',
    priceUnit: '秒',
    aliases: ['video_omni', 'omni video'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'video_digital_humans',
    name: 'Digital_Humans',
    displayName: 'Digital_Humans',
    categoryName: '视频模型',
    kind: 'video',
    executionMode: 'async-detail',
    endpointPath: '/api/async/video_digital_humans',
    endpointUrl: 'https://api.wuyinkeji.com/api/async/video_digital_humans',
    method: 'POST',
    contentType: 'application/json',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    detailStatusMode: 'wuyin-async',
    price: 0.02,
    priceText: '0.02元/秒',
    priceUnit: '秒',
    aliases: ['digital_humans', 'digital humans', 'video_digital_humans'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'video_package',
    name: 'Package_1.0',
    displayName: 'Package_1.0',
    categoryName: '视频模型',
    kind: 'video',
    executionMode: 'async-detail',
    endpointPath: '/api/async/video_package',
    endpointUrl: 'https://api.wuyinkeji.com/api/async/video_package',
    method: 'POST',
    contentType: 'application/json',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    detailStatusMode: 'wuyin-async',
    price: 0.01,
    priceText: '0.01元/秒',
    priceUnit: '秒',
    aliases: ['package_1.0', 'video_package'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'video_veo3.1_fast',
    name: 'veo3.1_fast',
    displayName: 'veo3.1_fast',
    categoryName: '视频模型',
    kind: 'video',
    executionMode: 'async-detail',
    endpointPath: '/api/async/video_veo3.1_fast',
    endpointUrl: 'https://api.wuyinkeji.com/api/async/video_veo3.1_fast',
    method: 'POST',
    contentType: 'application/json',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    detailStatusMode: 'wuyin-async',
    price: 0.05,
    priceText: '0.05元/秒',
    priceUnit: '秒',
    aliases: ['veo3.1_fast', 'veo 3.1 fast', 'video_veo3.1_fast'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'video_grok_imagine',
    name: 'grok_imagine',
    displayName: 'grok_imagine',
    categoryName: '视频模型',
    kind: 'video',
    executionMode: 'async-detail',
    endpointPath: '/api/async/video_grok_imagine',
    endpointUrl: 'https://api.wuyinkeji.com/api/async/video_grok_imagine',
    method: 'POST',
    contentType: 'application/json',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    detailStatusMode: 'wuyin-async',
    price: 0.05,
    priceText: '0.05元/秒',
    priceUnit: '秒',
    aliases: ['grok_imagine', 'grok imagine video', 'video_grok_imagine'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'video_wan2.6',
    name: 'Wan2.6',
    displayName: 'Wan2.6',
    categoryName: '视频模型',
    kind: 'video',
    executionMode: 'async-detail',
    endpointPath: '/api/async/video_wan2.6',
    endpointUrl: 'https://api.wuyinkeji.com/api/async/video_wan2.6',
    method: 'POST',
    contentType: 'application/json',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    detailStatusMode: 'wuyin-async',
    price: 0.8,
    priceText: '0.8元/秒',
    priceUnit: '秒',
    aliases: ['wan2.6', 'wan26', 'wan video', 'video_wan2.6'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'chat_index',
    name: 'ChatAPI',
    displayName: 'ChatAPI',
    categoryName: '对话模型',
    kind: 'chat',
    executionMode: 'sync',
    endpointPath: '/api/chat/index',
    endpointUrl: 'https://api.wuyinkeji.com/api/chat/index',
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded',
    submitContentType: 'application/x-www-form-urlencoded',
    price: 0,
    priceText: '免费',
    priceUnit: 'token',
    aliases: ['chatapi', 'chat_index', 'api/chat/index'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'audio_tts',
    name: '语音合成',
    displayName: '语音合成',
    categoryName: '音频模型',
    kind: 'audio',
    executionMode: 'async-detail',
    endpointPath: '/api/async/audio_tts',
    endpointUrl: 'https://api.wuyinkeji.com/api/async/audio_tts',
    method: 'POST',
    contentType: 'application/json',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    detailStatusMode: 'wuyin-async',
    price: 0.0006,
    priceText: '0.0006元/字符',
    priceUnit: '字符',
    aliases: ['audio_tts', 'tts'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'voice_composite',
    name: '语音合成（同步）',
    displayName: '语音合成（同步）',
    categoryName: '音频模型',
    kind: 'audio',
    executionMode: 'sync',
    endpointPath: '/api/voice/composite',
    endpointUrl: 'https://api.wuyinkeji.com/api/voice/composite',
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded',
    submitContentType: 'application/x-www-form-urlencoded',
    price: 0.0006,
    priceText: '0.0006元/字符',
    priceUnit: '字符',
    aliases: ['voice_composite', 'voice composite'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'voice_clone',
    name: '语音克隆（同步）',
    displayName: '语音克隆（同步）',
    categoryName: '音频模型',
    kind: 'audio',
    executionMode: 'sync',
    endpointPath: '/api/voice/clone',
    endpointUrl: 'https://api.wuyinkeji.com/api/voice/clone',
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded',
    submitContentType: 'application/x-www-form-urlencoded',
    price: 6,
    priceText: '6元/次',
    priceUnit: '次',
    aliases: ['voice_clone', 'voice clone'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'sora2-new',
    name: 'sora2-new',
    displayName: 'sora2-new',
    categoryName: '备用接口',
    kind: 'video',
    executionMode: 'sora2-special',
    endpointPath: '/api/sora2-new/submit',
    endpointUrl: 'https://api.wuyinkeji.com/api/sora2-new/submit',
    method: 'POST',
    contentType: 'application/json',
    submitContentType: 'application/json',
    detailPath: '/api/sora2/detail',
    detailStatusMode: 'sora2',
    price: 1.2,
    priceText: '1.2元/次',
    priceUnit: '次',
    aliases: ['sora2-new', 'sora2'],
    enabled: true,
    lastCrawledAt: new Date().toISOString(),
  },
  {
    id: 'img_split',
    name: '智能拼图',
    displayName: '智能拼图',
    categoryName: '备用接口',
    kind: 'utility',
    executionMode: 'sync',
    endpointPath: '/api/img/split',
    endpointUrl: 'https://api.wuyinkeji.com/api/img/split',
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded',
    submitContentType: 'application/x-www-form-urlencoded',
    price: 0.03,
    priceText: '0.03元/次',
    priceUnit: '次',
    aliases: ['img_split', 'split'],
    enabled: false,
    lastCrawledAt: new Date().toISOString(),
  },
];

const CACHE_FILE_PATH = path.join(__dirname, 'wuyinCatalogCache.json');

/**
 * 抓取指定 URL 的纯文本
 */
async function fetchText(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    },
  });
  if (!response.ok) {
    throw new Error(`请求 ${url} 失败: HTTP ${response.status}`);
  }
  return await response.text();
}

/**
 * 将 HTML 剔除标签转为纯文本，并做常规换行清洗
 */
function htmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/**
 * 解析目录页面获得所有的子文档链接
 */
function parseProductDocLinks(html) {
  const links = [];
  const seen = new Set();
  
  // 匹配形如 /doc/65 或 https://api.wuyinkeji.com/doc/65
  // 我们使用宽正则以兼顾各种路径格式
  const docLinkRegex = /href=["'](?:https:\/\/api\.wuyinkeji\.com)?\/doc\/(\d+)["'][^>]*>([^<]+)<\/a>/gi;
  let match;

  // 在含有“产品目录”或者 sidebar 内部匹配更精准，这里用全局匹配并过滤无意义词
  while ((match = docLinkRegex.exec(html)) !== null) {
    const docId = match[1];
    const name = match[2].trim();
    const url = `https://api.wuyinkeji.com/doc/${docId}`;
    
    // 忽略一些系统目录文档、常见入口
    if (docId === '65' || docId === '47' || !name || name.includes('文档') || name.includes('接口说明') || name.includes('返回说明')) {
      continue;
    }

    if (!seen.has(docId)) {
      seen.add(docId);
      links.push({
        docId,
        displayName: name,
        url,
      });
    }
  }

  return links;
}

/**
 * 从文本段提取指定两块字符中间的文本内容
 */
function parseSection(text, startKeyword, endKeyword) {
  const startIndex = text.indexOf(startKeyword);
  if (startIndex === -1) return '';
  const realStart = startIndex + startKeyword.length;
  const endIndex = text.indexOf(endKeyword, realStart);
  if (endIndex === -1) {
    return text.slice(realStart).trim();
  }
  return text.slice(realStart, endIndex).trim();
}

/**
 * 依据接口路径和可能的名字推断 kind
 */
function inferKindFromEndpoint(endpointPath, categoryName = '') {
  if (endpointPath === '/api/async/detail') return 'detail';
  if (endpointPath.startsWith('/api/async/image_')) return 'image';
  if (endpointPath.startsWith('/api/async/video_')) return 'video';
  if (endpointPath.startsWith('/api/async/audio_')) return 'audio';
  if (endpointPath.startsWith('/api/voice/')) return 'audio';
  if (endpointPath.startsWith('/api/img/')) return 'utility';
  if (endpointPath.startsWith('/api/sora2')) return 'video';
  
  const lowerCat = categoryName.toLowerCase();
  if (lowerCat.includes('图片') || lowerCat.includes('image')) return 'image';
  if (lowerCat.includes('视频') || lowerCat.includes('video')) return 'video';
  if (lowerCat.includes('音频') || lowerCat.includes('audio') || lowerCat.includes('voice')) return 'audio';
  return 'utility';
}

/**
 * 推断 executionMode
 */
function inferExecutionMode(endpointPath) {
  if (endpointPath.startsWith('/api/async/')) return 'async-detail';
  if (endpointPath === '/api/sora2-new/submit') return 'sora2-special';
  return 'sync';
}

/**
 * 推断 detailPath
 */
function inferDetailPath(endpointPath) {
  if (endpointPath.startsWith('/api/async/') && endpointPath !== '/api/async/detail') {
    return '/api/async/detail';
  }
  if (endpointPath === '/api/sora2-new/submit') {
    return '/api/sora2/detail';
  }
  return undefined;
}

/**
 * 解析单个文档详情页面
 */
function parseWuyinDocPage(html, link) {
  const text = htmlToText(html);

  // 1. 解析 H1 (标题名)
  let displayName = link.displayName;
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    displayName = htmlToText(h1Match[1]).trim() || link.displayName;
  }

  // 2. 解析接口地址
  let endpointUrl = '';
  // 匹配 “接口地址：https://api.wuyinkeji.com/api/async/image_gpt”
  const urlMatch = text.match(/(?:接口地址|请求地址)[:：]\s*(https:\/\/api\.wuyinkeji\.com\/[^\s"'<>]+)/i) 
    || text.match(/(https:\/\/api\.wuyinkeji\.com\/api\/[^\s"'<>]+)/i);
  if (urlMatch) {
    endpointUrl = urlMatch[1].trim();
  }

  // 兜底补全 endpointUrl
  if (!endpointUrl) {
    // 尝试根据文档推断
    return null;
  }

  let endpointPath = '';
  try {
    endpointPath = new URL(endpointUrl).pathname;
  } catch (e) {
    // 忽略异常并返回 null，认为此文档没有正确公开的 API 路径
    return null;
  }

  // 3. 请求方式
  let method = 'POST';
  const methodMatch = text.match(/请求方式[:：]\s*(?:HTTP\s+)?(GET|POST)/i);
  if (methodMatch) {
    method = methodMatch[2].toUpperCase();
  } else if (endpointPath.includes('detail')) {
    method = 'GET';
  }

  // 4. Content-Type
  let contentType = 'application/json';
  const ctMatch = text.match(/Content-Type[:：\s]\s*([a-zA-Z0-9/-]+)/i);
  if (ctMatch) {
    contentType = ctMatch[1].trim();
  } else {
    // 兜底逻辑
    if (endpointPath.includes('chat') || endpointPath.includes('composite') || endpointPath.includes('clone') || endpointPath.includes('split')) {
      contentType = 'application/x-www-form-urlencoded';
    }
  }

  // 5. 价格解析
  let priceText = '免费';
  // 参考价格 \n 0.1元/秒
  const priceMatch = text.match(/参考价格[:：\s]*\n?\s*([^\n\r<]+)/i);
  if (priceMatch) {
    priceText = priceMatch[1].trim();
  }

  let price = 0;
  if (!priceText.includes('免费')) {
    const floatMatch = priceText.match(/(\d+(?:\.\d+)?)/);
    if (floatMatch) {
      price = parseFloat(floatMatch[1]);
    }
  }

  let priceUnit = '次';
  const unitMatch = priceText.match(/元\/([^\s]+)/);
  if (unitMatch) {
    priceUnit = unitMatch[1].trim();
  } else if (priceText.includes('字符')) {
    priceUnit = '字符';
  } else if (priceText.includes('token')) {
    priceUnit = 'token';
  }

  // 6. 确定分类名字
  let categoryName = '未分类模型';
  if (endpointPath.includes('image_') || endpointPath.includes('draw')) {
    categoryName = '图片模型';
  } else if (endpointPath.includes('video_') || endpointPath.includes('sora')) {
    categoryName = '视频模型';
  } else if (endpointPath.includes('audio_') || endpointPath.includes('voice') || endpointPath.includes('tts')) {
    categoryName = '音频模型';
  }

  const kind = inferKindFromEndpoint(endpointPath, categoryName);
  const executionMode = inferExecutionMode(endpointPath);
  const detailPath = inferDetailPath(endpointPath);

  // 7. 生成 ID = endpointPath 的最后一节
  const id = endpointPath.split('/').pop() || endpointPath.replace(/[^a-zA-Z0-9_.-]/g, '_');

  // 8. 别名列表
  const aliases = Array.from(new Set([
    id,
    displayName,
    displayName.toLowerCase().replace(/[^a-z0-9_.-]/g, '_'),
    endpointPath.replace(/^\/+/, '').replace(/\//g, '_')
  ])).filter(Boolean);

  return {
    id,
    name: displayName,
    displayName,
    categoryName,
    kind,
    executionMode,
    docId: link.docId,
    docUrl: link.url,
    endpointPath,
    endpointUrl,
    method,
    contentType,
    submitContentType: contentType, // 兼容旧属性
    detailPath,
    detailStatusMode: endpointPath.startsWith('/api/sora2') ? 'sora2' : 'wuyin-async',
    price,
    priceText,
    priceUnit,
    aliases,
    enabled: true,
    requestParamsRaw: parseSection(text, '请求参数说明', '返回参数说明'),
    responseParamsRaw: parseSection(text, '返回参数说明', '返回示例'),
    lastCrawledAt: new Date().toISOString(),
  };
}

/**
 * 自动刷新并下载最新的目录列表及页面明细
 */
async function refreshWuyinCatalog() {
  console.log('[wuyin-catalog] 启动全量目录抓取任务...');
  const entryDocUrl = 'https://api.wuyinkeji.com/doc/65';
  
  try {
    const entryHtml = await fetchText(entryDocUrl);
    const docLinks = parseProductDocLinks(entryHtml);
    console.log(`[wuyin-catalog] 解析出 ${docLinks.length} 个文档链接，准备爬取子文档...`);

    const items = [];
    
    // 我们并发请求以提高拉取速度，速创官方文档页面一般承受力较好
    await Promise.all(
      docLinks.map(async (link) => {
        try {
          const html = await fetchText(link.url);
          const item = parseWuyinDocPage(html, link);
          if (item) {
            items.push(item);
          }
        } catch (err) {
          console.warn(`[wuyin-catalog] 爬取子文档 ${link.url} 失败，忽略:`, err.message);
        }
      })
    );

    if (items.length === 0) {
      throw new Error('未爬取到任何有效的速创模型，拒绝存入缓存');
    }

    // 将抓取成功的结果与 Fallback 结果进行合并去重
    // 保证以爬到的真实配置优先，对于爬虫遗漏的，使用 Fallback 兜底
    const finalItems = [...items];
    for (const fallback of WUYIN_FALLBACK_CATALOG) {
      if (!finalItems.some(x => x.endpointPath === fallback.endpointPath)) {
        finalItems.push(fallback);
      }
    }

    const payload = {
      version: 1,
      source: 'doc-crawler',
      crawledAt: new Date().toISOString(),
      items: finalItems,
    };

    // 写入文件缓存
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`[wuyin-catalog] 缓存刷新成功，共写入 ${finalItems.length} 个模型接口。`);
    return finalItems;
  } catch (error) {
    console.error('[wuyin-catalog] 自动刷新失败，错误信息:', error.message);
    throw error;
  }
}

/**
 * 获取 Catalog，优先从缓存载入，不存在则提供内置 fallback
 */
function getCachedWuyinCatalog() {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      const payload = JSON.parse(raw);
      if (payload && Array.isArray(payload.items) && payload.items.length > 0) {
        return payload.items;
      }
    }
  } catch (e) {
    console.warn('[wuyin-catalog] 加载本地缓存文件失败，使用静态兜底配置:', e.message);
  }
  return WUYIN_FALLBACK_CATALOG;
}

module.exports = {
  refreshWuyinCatalog,
  getCachedWuyinCatalog,
  WUYIN_FALLBACK_CATALOG,
};
