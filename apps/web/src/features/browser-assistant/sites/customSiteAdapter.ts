import type { BrowserSiteAdapter } from '../browserAssistantTypes';

// 简体中文：用户自定义域名适配器 (Custom Site Adapter)
export const customSiteAdapter: BrowserSiteAdapter = {
  siteId: 'custom',
  canHandle: (urlOrTask: string) => {
    // 匹配类似 custom: 的自定义任务或显式指定的自定义链接
    return urlOrTask.startsWith('custom:') || urlOrTask.includes('custom-site');
  },

  extract: async (ctx) => {
    const targetUrl = ctx.intent.targetUrl || 'https://example.com';
    const res = await ctx.opencli.execute({
      kind: 'inspect_page',
      target: targetUrl,
      payload: { action: 'custom_dom_extract' }
    });
    return {
      text: res?.summary || res?.data?.extractedText || `自定义提取自 ${targetUrl} 完毕。`,
      images: res?.data?.images || []
    };
  }
};
