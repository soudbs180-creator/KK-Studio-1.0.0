import type { BrowserSiteAdapter } from './browserAssistantTypes.ts';
import { genericWebAdapter } from './sites/genericWebAdapter.ts';
import { googleSearchAdapter } from './sites/googleSearchAdapter.ts';
import { youtubeAdapter } from './sites/youtubeAdapter.ts';
import { amazonAdapter } from './sites/amazonAdapter.ts';
import { behanceAdapter } from './sites/behanceAdapter.ts';
import { xiaohongshuAdapter } from './sites/xiaohongshuAdapter.ts';
import { zhihuAdapter } from './sites/zhihuAdapter.ts';
import { chatgptAdapter } from './sites/chatgptAdapter.experimental.ts';
import { geminiAdapter } from './sites/geminiAdapter.experimental.ts';
import { customSiteAdapter } from './sites/customSiteAdapter.ts';

// 简体中文：站点适配器注册表类 (Site Registry)
export class SiteRegistry {
  private static instance: SiteRegistry;
  private adapters: Map<string, BrowserSiteAdapter> = new Map();

  private constructor() {
    this.registerDefaultAdapters();
  }

  public static getInstance(): SiteRegistry {
    if (!SiteRegistry.instance) {
      SiteRegistry.instance = new SiteRegistry();
    }
    return SiteRegistry.instance;
  }

  private registerDefaultAdapters() {
    this.register(googleSearchAdapter);
    this.register(youtubeAdapter);
    this.register(amazonAdapter);
    this.register(behanceAdapter);
    this.register(xiaohongshuAdapter);
    this.register(zhihuAdapter);
    this.register(chatgptAdapter);
    this.register(geminiAdapter);
    this.register(customSiteAdapter);
  }

  public register(adapter: BrowserSiteAdapter) {
    this.adapters.set(adapter.siteId, adapter);
  }

  public getAdapter(siteId: string): BrowserSiteAdapter | undefined {
    return this.adapters.get(siteId);
  }

  public matchAdapter(urlOrTask: string): BrowserSiteAdapter {
    for (const [_, adapter] of this.adapters.entries()) {
      if (adapter.canHandle(urlOrTask)) {
        return adapter;
      }
    }
    return genericWebAdapter; // 无法识别时 fallback 到通用网页适配器
  }

  public getAllAdapters(): BrowserSiteAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const siteRegistry = SiteRegistry.getInstance();
