// 简体中文：记录并管理活动 Chrome 的 CDP 会话状态 (Session Manager)
export interface BrowserSessionInfo {
  sessionId: string;
  url: string;
  title: string;
  createdAt: number;
}

export class OpencliSessionManager {
  private activeSessions: BrowserSessionInfo[] = [];

  public updateSessions(sessions: BrowserSessionInfo[]) {
    this.activeSessions = sessions;
  }

  public getActiveSessions(): BrowserSessionInfo[] {
    return this.activeSessions;
  }

  public clearSessions() {
    this.activeSessions = [];
  }
}

export const opencliSessionManager = new OpencliSessionManager();
