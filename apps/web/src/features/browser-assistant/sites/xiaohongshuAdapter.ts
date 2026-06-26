import type { BrowserSiteAdapter } from '../browserAssistantTypes';

// 简体中文：小红书社媒平台适配器 (Xiaohongshu Adapter)
export const xiaohongshuAdapter: BrowserSiteAdapter = {
  siteId: 'xiaohongshu',
  canHandle: (urlOrTask: string) => {
    return urlOrTask.includes('xiaohongshu.com') || urlOrTask.includes('xhslink.com') || urlOrTask.toLowerCase().includes('小红书') || urlOrTask.toLowerCase().includes('xhs');
  },

  extract: async (ctx) => {
    const res = await ctx.opencli.execute({
      kind: 'inspect_page',
      target: ctx.intent.targetUrl || 'https://www.xiaohongshu.com',
      payload: { action: 'extract_xhs_note' }
    });
    return {
      text: `【小红书笔记提取】\n标题：${res?.data?.title || '小红书精选'}\n正文：${res?.data?.body || '暂无内容'}\n标签：${res?.data?.tags || '#设计'}`,
      images: res?.data?.images || []
    };
  }
};
