import type { BrowserSiteAdapter } from '../browserAssistantTypes';

// 简体中文：Behance 视觉素材适配器 (Behance Adapter)
export const behanceAdapter: BrowserSiteAdapter = {
  siteId: 'behance',
  canHandle: (urlOrTask: string) => {
    return urlOrTask.includes('behance.net') || urlOrTask.toLowerCase().includes('behance');
  },

  extract: async (ctx) => {
    const res = await ctx.opencli.execute({
      kind: 'inspect_page',
      target: ctx.intent.targetUrl || 'https://www.behance.net',
      payload: { action: 'extract_design_gallery' }
    });
    return {
      text: `【Behance 素材信息】\n作者：${res?.data?.author || '视觉艺术家'}\n标题：${res?.data?.title || '作品集'}\n画板调色盘：${res?.data?.palette || 'RGB'}`,
      images: res?.data?.images || []
    };
  }
};
