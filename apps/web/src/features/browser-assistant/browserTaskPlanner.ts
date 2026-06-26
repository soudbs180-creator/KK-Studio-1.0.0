import type { BrowserTaskIntent, ActionType, OutputTarget } from './browserAssistantTypes';

// 简体中文：自然语言任务意图解析与规划引擎 (NLP Task Planner)
export class BrowserTaskPlanner {
  public plan(userText: string): BrowserTaskIntent {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const lowerText = userText.toLowerCase();

    // 1. 匹配目标站点
    let targetSite = 'generic_web';
    if (lowerText.includes('google') || lowerText.includes('谷歌')) {
      targetSite = 'google';
    } else if (lowerText.includes('youtube') || lowerText.includes('油管') || lowerText.includes('视频')) {
      targetSite = 'youtube';
    } else if (lowerText.includes('amazon') || lowerText.includes('亚马逊')) {
      targetSite = 'amazon';
    } else if (lowerText.includes('behance')) {
      targetSite = 'behance';
    } else if (lowerText.includes('xiaohongshu') || lowerText.includes('小红书') || lowerText.includes('xhs')) {
      targetSite = 'xiaohongshu';
    } else if (lowerText.includes('zhihu') || lowerText.includes('知乎')) {
      targetSite = 'zhihu';
    } else if (lowerText.includes('chatgpt')) {
      targetSite = 'chatgpt';
    } else if (lowerText.includes('gemini')) {
      targetSite = 'gemini';
    }

    // 2. 匹配执行动作
    let actionType: ActionType = 'read';
    if (lowerText.includes('搜索') || lowerText.includes('search')) {
      actionType = 'search';
    } else if (lowerText.includes('提取') || lowerText.includes('抓取') || lowerText.includes('分析') || lowerText.includes('extract')) {
      actionType = 'extract';
    } else if (lowerText.includes('下载') || lowerText.includes('download')) {
      actionType = 'download';
    } else if (lowerText.includes('上传') || lowerText.includes('upload')) {
      actionType = 'upload';
    } else if (lowerText.includes('生成图像') || lowerText.includes('生图') || lowerText.includes('draw')) {
      actionType = 'generate-image';
    } else if (lowerText.includes('生成文字') || lowerText.includes('写文案') || lowerText.includes('对话')) {
      actionType = 'generate-text';
    } else if (lowerText.includes('发布') || lowerText.includes('publish') || lowerText.includes('发帖')) {
      actionType = 'publish';
    } else if (lowerText.includes('删除') || lowerText.includes('delete') || lowerText.includes('下架')) {
      actionType = 'delete';
    }

    // 3. 匹配输出目标
    let outputTarget: OutputTarget = 'canvas';
    if (lowerText.includes('大纲') || lowerText.includes('ppt')) {
      outputTarget = 'ppt-outline';
    } else if (lowerText.includes('素材') || lowerText.includes('库')) {
      outputTarget = 'asset';
    } else if (lowerText.includes('markdown') || lowerText.includes('md')) {
      outputTarget = 'markdown';
    } else if (lowerText.includes('任务') || lowerText.includes('队列')) {
      outputTarget = 'generation-task';
    }

    // 4. 解析目标 URL (如果有的话)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urlMatch = userText.match(urlRegex);
    const targetUrl = urlMatch ? urlMatch[0] : undefined;

    // 5. 根据目标站判断是否需要登录及会员
    const requiresLogin = ['xiaohongshu', 'zhihu', 'chatgpt', 'gemini'].includes(targetSite);
    const usesMembership = ['xiaohongshu', 'zhihu', 'chatgpt', 'gemini'].includes(targetSite);

    return {
      taskId,
      userText,
      targetSite,
      targetUrl,
      actionType,
      requiresLogin,
      usesMembership,
      outputTarget
    };
  }
}

export const browserTaskPlanner = new BrowserTaskPlanner();
