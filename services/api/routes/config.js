/**
 * @file config.js
 * @description 系统配置与密钥状态信息读取路由，返回各渠道 Key 配置状态，不返回任何明文密钥。
 */

const express = require('express');
const router = express.Router();
const { getActiveGatewayProvider } = require('../utils/apiGatewayConfig');

router.get('/config/keys', (req, res) => {
  const activeProvider = getActiveGatewayProvider();
  const hasSuchuangKey = !!process.env.SUCHUANG_API_KEY;
  
  res.json({
    ACTIVE_API_PROVIDER: activeProvider,
    _configured: {
      SUCHUANG_API_KEY: hasSuchuangKey,
      YUNWU_API_KEY: !!process.env.YUNWU_API_KEY,
      COMFLY_API_KEY: !!process.env.COMFLY_API_KEY
    }
  });
});

module.exports = router;
