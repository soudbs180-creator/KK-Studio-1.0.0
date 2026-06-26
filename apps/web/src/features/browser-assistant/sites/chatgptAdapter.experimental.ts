import type { BrowserSiteAdapter } from '../browserAssistantTypes';

// 简体中文：ChatGPT 实验性已登录网页会话生图/生文适配器 (ChatGPT Experimental Adapter)
export const chatgptAdapter: BrowserSiteAdapter = {
  siteId: 'chatgpt',
  canHandle: (urlOrTask: string) => {
    return urlOrTask.includes('chatgpt.com') || urlOrTask.toLowerCase().includes('chatgpt');
  },

  generate: async (ctx) => {
    const res = await ctx.opencli.execute({
      kind: 'generate_external',
      target: 'https://chatgpt.com',
      payload: {
        prompt: ctx.intent.userText,
        platformId: 'chatgpt'
      }
    });
    return {
      text: res?.summary || res?.data?.text || 'ChatGPT 已成功生成回应。',
      assets: res?.data?.imageUrl ? [res.data.imageUrl] : []
    };
  }
};
