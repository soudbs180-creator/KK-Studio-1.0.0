import type { BrowserSiteAdapter } from '../browserAssistantTypes';

// 简体中文：YouTube 视频适配器 (YouTube Adapter)
export const youtubeAdapter: BrowserSiteAdapter = {
  siteId: 'youtube',
  canHandle: (urlOrTask: string) => {
    return urlOrTask.includes('youtube.com') || urlOrTask.includes('youtu.be') || urlOrTask.toLowerCase().includes('youtube');
  },

  extract: async (ctx) => {
    const res = await ctx.opencli.execute({
      kind: 'extract_product',
      target: ctx.intent.targetUrl || 'https://www.youtube.com',
      payload: { targets: ['title', 'description'] }
    });
    return {
      text: `【YouTube 视频提取】\n标题：${res?.data?.title || 'YouTube Video'}\n摘要：${res?.data?.description || '提取简介完成'}`,
      images: res?.data?.images || []
    };
  }
};
