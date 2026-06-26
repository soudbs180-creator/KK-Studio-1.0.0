import express from 'express';
import cors from 'cors';
import { originGuard } from './security/originGuard';
import healthRouter from './routes/health';
import browserRouter from './routes/browser';
import opencliRouter from './routes/opencli';
import { localToken } from './security/localToken';

// 简体中文：启动 Local Runner 服务端 (Server Setup)
const app = express();
const PORT = 9099;

// 1. CORS 配置：严格限制仅允许本地请求
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    const isLocal = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
    if (isLocal) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS origin guard.'));
    }
  }
}));

app.use(express.json());

// 2. 装载 Origin Guard，拦截非法 Host DNS 劫持等
app.use(originGuard);

// 3. 挂载子路由
app.use('/api/health', healthRouter);
app.use('/api/browser', browserRouter);
app.use('/api/opencli', opencliRouter);

// 4. 监听端口
app.listen(PORT, () => {
  console.log(`==========================================`);
  console.log(`🚀 KK Studio Local Runner 服务开启成功!`);
  console.log(`📡 监听本地端口: http://localhost:${PORT}`);
  console.log(`🔐 本地运行凭据: ${localToken.getToken()}`);
  console.log(`==========================================`);
});
