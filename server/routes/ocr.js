/**
 * @file ocr.js
 * @module server/routes
 * @description 百度智能云 OCR 文字识别代理中转路由，负责在后端安全地管理百度 Access Token，调用高精度 OCR 接口并拼接返回文本。
 */

const express = require('express');
const router = express.Router();

// 百度文字识别 Token 换取接口地址
const BAIDU_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
// 百度高精度文字识别接口地址
const BAIDU_ACCURATE_BASIC_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic';

/**
 * 获取百度的 Access Token
 * @param {string} apiKey 百度 API Key
 * @param {string} secretKey 百度 Secret Key
 * @returns {Promise<string>} 返回 access_token
 */
async function getBaiduAccessToken(apiKey, secretKey) {
  const url = `${BAIDU_TOKEN_URL}?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`获取百度 Token 失败: HTTP ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`获取百度 Token 错误: ${data.error_description || data.error}`);
  }

  if (!data.access_token) {
    throw new Error('未在百度授权响应中找到 access_token，请检查 API Key 和 Secret Key 是否正确。');
  }

  return data.access_token;
}

/**
 * POST /api/ocr
 * 统一 OCR 中转代理路由，接收 Base64 格式的文件并调用百度云 OCR 识别
 */
async function handleOcr(req, res) {
  const {
    operation,
    fileBase64,
    fileName,
    ocrLanguage,
    provider,
    baiduApiKey,
    baiduSecretKey
  } = req.body;

  // 1. 参数校验
  if (provider !== 'baidu') {
    return res.status(400).send('当前接口仅支持百度 OCR 专属 API 中转。');
  }

  if (!baiduApiKey || !baiduSecretKey) {
    return res.status(400).send('缺少百度的 API Key 或 Secret Key 配置，请在高级分配页面的 OCR 卡片中进行配置。');
  }

  if (!fileBase64) {
    return res.status(400).send('请求体中缺少 fileBase64 文件数据。');
  }

  try {
    // 2. 换取 Access Token
    const accessToken = await getBaiduAccessToken(baiduApiKey, baiduSecretKey);

    // 3. 构造百度识别请求参数
    const isPdf = String(fileName || '').toLowerCase().endsWith('.pdf');
    const params = new URLSearchParams();

    if (isPdf) {
      params.append('pdf_file', fileBase64);
      // 默认解析前 10 页，百度 accurate_basic 最大可设置识别 10 页
      params.append('pdf_file_num', '10');
    } else {
      params.append('image', fileBase64);
    }

    // 百度支持语言设定，若前端默认是 chi_sim，百度通常默认支持中英文识别，不用显式传语言，
    // 若要设定，可以通过 language_type 设置。例如：CHN_ENG（中英文混合）。
    params.append('language_type', 'CHN_ENG');

    // 4. 调用百度文字识别高精度版 API
    const ocrUrl = `${BAIDU_ACCURATE_BASIC_URL}?access_token=${accessToken}`;
    const ocrResponse = await fetch(ocrUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (!ocrResponse.ok) {
      const status = ocrResponse.status;
      const errorText = await ocrResponse.text();
      return res.status(status).send(`调用百度 OCR 接口失败: HTTP ${status} - ${errorText}`);
    }

    const ocrData = await ocrResponse.json();

    // 5. 校验百度接口返回的业务错误
    if (ocrData.error_code) {
      return res.status(400).send(`百度云 OCR 服务返回错误 [${ocrData.error_code}]: ${ocrData.error_msg}`);
    }

    // 6. 提取拼接文字并返回
    const wordsList = ocrData.words_result || [];
    const plainText = wordsList.map(item => item.words).join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(plainText);

  } catch (error) {
    console.error('[ocr-route] 百度 OCR 代理过程出错:', error);
    return res.status(500).send(`后端 OCR 中转异常: ${error.message}`);
  }
}

router.post('/ocr', handleOcr);
router.post('/v1/ocr', handleOcr);

module.exports = router;
