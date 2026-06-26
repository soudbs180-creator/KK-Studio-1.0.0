import type { BrowserSiteAdapter } from '../browserAssistantTypes';

// 简体中文：Amazon 电商商品适配器 (Amazon Adapter)
export const amazonAdapter: BrowserSiteAdapter = {
  siteId: 'amazon',
  canHandle: (urlOrTask: string) => {
    return urlOrTask.includes('amazon.com') || urlOrTask.includes('amazon.cn') || urlOrTask.toLowerCase().includes('amazon');
  },

  extract: async (ctx) => {
    const res = await ctx.opencli.execute({
      kind: 'extract_product',
      target: ctx.intent.targetUrl || 'https://www.amazon.com',
      payload: { targets: ['price', 'title', 'image', 'description'] }
    });
    return {
      text: `【亚马逊商品详情】\n品名：${res?.data?.title || 'Amazon Item'}\n价格：${res?.data?.price || '暂无标价'}\n描述：${res?.data?.description || ''}`,
      images: res?.data?.images || []
    };
  }
};
