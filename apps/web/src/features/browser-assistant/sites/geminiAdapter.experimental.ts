import type { BrowserSiteAdapter } from '../browserAssistantTypes';

// 简体中文：Gemini 实验性网页端个人账号生图/生文适配器 (Gemini Experimental Adapter)
export const geminiAdapter: BrowserSiteAdapter = {
  siteId: 'gemini',
  canHandle: (urlOrTask: string) => {
    return urlOrTask.includes('gemini.google.com') || urlOrTask.toLowerCase().includes('gemini');
  },

  generate: async (ctx) => {
    const res = await ctx.opencli.execute({
      kind: 'generate_external',
      target: 'https://gemini.google.com',
      payload: {
        prompt: ctx.intent.userText,
        platformId: 'gemini'
      }
    });
    return {
      text: res?.summary || res?.data?.text || 'Gemini 已成功生成文字结果。',
      assets: res?.data?.imageUrl ? [res.data.imageUrl] : []
    };
  }
};
