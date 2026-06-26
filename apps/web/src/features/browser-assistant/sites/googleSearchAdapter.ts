import type { BrowserSiteAdapter } from '../browserAssistantTypes';

// 简体中文：Google 搜索适配器 (Google Search Adapter)
export const googleSearchAdapter: BrowserSiteAdapter = {
  siteId: 'google',
  canHandle: (urlOrTask: string) => {
    return urlOrTask.includes('google.com') || urlOrTask.includes('google.com.hk') || urlOrTask.toLowerCase().includes('google');
  },

  search: async (ctx) => {
    const keyword = encodeURIComponent(ctx.intent.userText.replace(/谷歌搜索|google search/gi, '').trim());
    const searchUrl = `https://www.google.com/search?q=${keyword}`;
    const res = await ctx.opencli.execute({
      kind: 'inspect_page',
      target: searchUrl,
      payload: { action: 'google_search_results' }
    });
    return {
      text: res?.summary || res?.data?.description || `在 Google 上搜索关键字: ${keyword} 完成`,
      images: []
    };
  }
};
