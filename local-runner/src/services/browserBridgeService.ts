export interface BrowserSessionInfo {
  sessionId: string;
  url: string;
  title: string;
  createdAt: number;
}

export interface BrowserSessionAdapter {
  listActiveSessions: () => Promise<BrowserSessionInfo[]>;
}

/**
 * Exposes only sessions returned by a real desktop bridge adapter. An absent
 * adapter is an honest disconnected state, never a simulated healthy session.
 */
export class BrowserBridgeService {
  constructor(private readonly adapter: BrowserSessionAdapter | null = null) {}

  public async getActiveSessions(): Promise<BrowserSessionInfo[]> {
    return this.adapter ? this.adapter.listActiveSessions() : [];
  }
}

export const browserBridgeService = new BrowserBridgeService();
