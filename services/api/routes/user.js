// services/api/routes/user.js
// 简体中文注释：路由拆分收口入口文件，按域分发到 auth、profile 和 wuyin 子路由。

const express = require('express');
const authRouter = require('./user/auth');
const profileRouter = require('./user/profile');
const wuyinRouter = require('./user/wuyin');

const router = express.Router();

router.use(authRouter);
router.use(profileRouter);
router.use(wuyinRouter);

module.exports = router;
