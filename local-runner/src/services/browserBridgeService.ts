// 简体中文：桥接与管理 Chrome 调试会话 (Browser Bridge Service)
export class BrowserBridgeService {
  public async getActiveSessions(): Promise<any[]> {
    // 模拟返回当前用户 Chrome 打开并正在运行的活动标签页，防反爬和反自动化
    return [
      {
        sessionId: 'sess_chrome_1',
        url: 'https://www.zhihu.com/search?q=KK+Studio',
        title: 'KK Studio - 知乎搜索',
        createdAt: Date.now() - 60000
      },
      {
        sessionId: 'sess_chrome_2',
        url: 'https://www.xiaohongshu.com',
        title: '小红书 - 你的生活指南',
        createdAt: Date.now() - 120000
      }
    ];
  }
}

export const browserBridgeService = new BrowserBridgeService();
