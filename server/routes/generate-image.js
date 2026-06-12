/**
 * @file generate-image.js
 * @module server/routes
 * @description 平台代理图像生成与编辑路由收口文件。
 *              将业务逻辑交由 Controller + Billing Saga + Provider Dispatcher 处理，
 *              保持接口绑定的精简。
 */

const express = require('express');
const { handleGenerate } = require('../lib/generation/generationController');

const router = express.Router();

router.post('/generate-image', handleGenerate);
router.post('/generate/image', handleGenerate);
router.post('/generate/edit', handleGenerate);

module.exports = router;
