import type { BrowserSiteAdapter } from '../browserAssistantTypes';

// 简体中文：知乎内容问答适配器 (Zhihu Adapter)
export const zhihuAdapter: BrowserSiteAdapter = {
  siteId: 'zhihu',
  canHandle: (urlOrTask: string) => {
    return urlOrTask.includes('zhihu.com') || urlOrTask.toLowerCase().includes('知乎');
  },

  search: async (ctx) => {
    const keyword = encodeURIComponent(ctx.intent.userText.replace(/知乎搜索|zhihu search/gi, '').trim());
    const searchUrl = `https://www.zhihu.com/search?type=content&q=${keyword}`;
    const res = await ctx.opencli.execute({
      kind: 'inspect_page',
      target: searchUrl,
      payload: { action: 'zhihu_search_results' }
    });
    return {
      text: res?.summary || res?.data?.description || `【知乎搜索】已找到关于关键字: ${keyword} 的回答大纲。`,
      images: []
    };
  }
};
