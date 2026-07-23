import type { Server } from 'node:http';
import { createLocalRunnerApp } from './app';

// 简体中文：启动 Local Runner 服务端 (Server Setup)
const PORT = 9099;
const LOOPBACK_ADDRESS = '127.0.0.1';

/** 仅绑定 IPv4 loopback，避免 Local Runner 暴露到局域网网卡。 */
export function startLocalRunnerServer(port = PORT): Server {
  return createLocalRunnerApp().listen(port, LOOPBACK_ADDRESS, () => {
    console.info(`[LocalRunner] Listening on http://${LOOPBACK_ADDRESS}:${port}`);
  });
}

if (require.main === module) {
  startLocalRunnerServer();
}
