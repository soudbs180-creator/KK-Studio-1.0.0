// server/routes/api.js
/**
 * @file api.js
 * @module server/routes
 * @description 统一的 /api 命名空间网关路由器，合并了原本分散在 index.js 中的 8 个子路由，
 *              并通过确定的顺序声明防止匹配退化。
 */

const express = require('express');
const generateV1Router = require('./generate-v1');
const generationV3Router = require('./generation-v3');
const userApiPayloadRouter = require('./user-api-payload-router');
const userRouter = require('./user');
const adminRouter = require('./admin');
const providerProbeRouter = require('./provider-probe');
const ocrRouter = require('./ocr');
const aiAssistantRouter = require('./ai-assistant');
const configRouter = require('./config');

const apiRouter = express.Router();

// 简体中文注释：按原本在 index.js 中的顺序挂载，以保障优先级的一致与 100% 前向兼容
apiRouter.use(generateV1Router);
apiRouter.use(generationV3Router);
apiRouter.use(userApiPayloadRouter);
apiRouter.use(userRouter);
apiRouter.use(adminRouter);
apiRouter.use(providerProbeRouter);
apiRouter.use(ocrRouter);
apiRouter.use(aiAssistantRouter);
apiRouter.use(configRouter);

module.exports = apiRouter;
