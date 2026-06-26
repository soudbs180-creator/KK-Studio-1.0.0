import type { BrowserSiteAdapter } from '../browserAssistantTypes';

// 简体中文：通用网页适配器 (Generic Web Adapter)
export const genericWebAdapter: BrowserSiteAdapter = {
  siteId: 'generic_web',
  canHandle: (_urlOrTask: string) => true,
  
  inspect: async (ctx) => {
    return ctx.opencli.execute({
      kind: 'inspect_page',
      target: ctx.intent.targetUrl || 'about:blank',
      payload: { action: 'extract_sanitized_dom' }
    });
  },

  extract: async (ctx) => {
    const res = await ctx.opencli.execute({
      kind: 'extract_product',
      target: ctx.intent.targetUrl || 'about:blank',
      payload: { targets: ['title', 'description', 'image'] }
    });
    return {
      text: res?.summary || res?.data?.description || '提取完毕。',
      images: res?.data?.images || []
    };
  }
};
