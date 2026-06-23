// server/routes/contract-compat.js
// 简体中文注释：大兼容路由拆分收口入口文件，按功能分发到 auth、billing、workspace 和 admin 子路由。

const express = require('express');
const authRouter = require('./compat/auth');
const billingRouter = require('./compat/billing');
const workspaceRouter = require('./compat/workspace');
const adminRouter = require('./compat/admin');

const router = express.Router();

router.use(authRouter);
router.use(billingRouter);
router.use(workspaceRouter);
router.use(adminRouter);

module.exports = router;
