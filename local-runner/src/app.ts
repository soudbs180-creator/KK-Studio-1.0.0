import cors from 'cors';
import express, { ErrorRequestHandler, Express } from 'express';
import browserRouter from './routes/browser';
import healthRouter from './routes/health';
import opencliRouter from './routes/opencli';
import { isAllowedLocalOrigin, originGuard } from './security/originGuard';

export const LOCAL_RUNNER_JSON_LIMIT_BYTES = 256 * 1024;

function isPayloadTooLarge(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const bodyParserError = error as { status?: unknown; type?: unknown };
  return bodyParserError.status === 413 || bodyParserError.type === 'entity.too.large';
}

const handleRequestError: ErrorRequestHandler = (error, _req, res, next) => {
  if (isPayloadTooLarge(error)) {
    res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Local Runner request body exceeds the allowed size.',
      },
    });
    return;
  }

  next(error);
};

/** 创建无监听副作用的 Express app，供本地启动器和集成测试共用。 */
export function createLocalRunnerApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({
    origin: (origin, callback) => {
      const allowed = !origin || isAllowedLocalOrigin(origin);
      callback(allowed ? null : new Error('Not allowed by CORS origin guard.'), allowed);
    },
  }));
  app.use(express.json({ limit: LOCAL_RUNNER_JSON_LIMIT_BYTES }));
  app.use(originGuard);
  app.use('/api/health', healthRouter);
  app.use('/api/browser', browserRouter);
  app.use('/api/opencli', opencliRouter);
  app.use(handleRequestError);
  return app;
}

