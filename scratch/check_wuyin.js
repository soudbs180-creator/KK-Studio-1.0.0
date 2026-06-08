const fs = require('fs');
const path = require('path');

// 1. 读取并解析官方 API 数据
const contentPath = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\79a3ab4a-3e92-4897-b2a5-f6e8f1072481\\.system_generated\\steps\\12\\content.md';
const fileLines = fs.readFileSync(contentPath, 'utf8').split('\n');
const jsonLine = fileLines.find(line => line.startsWith('{"code"'));
if (!jsonLine) {
  console.error("未找到 JSON 行");
  process.exit(1);
}
const officialData = JSON.parse(jsonLine);
const officialList = officialData.data.api_list;

// 2. 导入本地的 wuyinProducts 模块
const wuyinProductsPath = 'c:\\Users\\Administrator\\Downloads\\KK-Studio-1.0.0\\server\\lib\\dispatcher\\wuyinProducts.js';
const { WUYIN_PRODUCTS } = require(wuyinProductsPath);

console.log("=== 本地 WUYIN_PRODUCTS 键值与 displayName ===");
Object.entries(WUYIN_PRODUCTS).forEach(([key, val]) => {
  console.log(`Key: ${key.padEnd(25)} | displayName: ${val.displayName.padEnd(25)} | category: ${val.category} | endpoint: ${val.endpoint}`);
});

console.log("\n=== 调试比对过程 ===");

function findLocalProduct(official) {
  let category = 'other';
  if (official.url.includes('/image_') || official.url.includes('/image/')) category = 'image';
  else if (official.url.includes('/video_') || official.url.includes('/video/')) category = 'video';
  else if (official.url.includes('/audio_') || official.url.includes('/audio/')) category = 'audio';
  else if (official.url.includes('/voice/')) category = 'audio';
  else if (official.url.includes('/sora2-new/')) category = 'video';
  else if (official.url.includes('/img/')) category = 'utility';
  
  // 比对
  for (const [key, val] of Object.entries(WUYIN_PRODUCTS)) {
    if (val.displayName === official.name && val.category === category) {
      return val;
    }
  }
  for (const [key, val] of Object.entries(WUYIN_PRODUCTS)) {
    if (val.displayName === official.name) {
      return val;
    }
  }
  for (const [key, val] of Object.entries(WUYIN_PRODUCTS)) {
    if (val.endpoint === official.url) {
      return val;
    }
  }
  return null;
}

officialList.forEach(api => {
  const local = findLocalProduct(api);
  if (local) {
    console.log(`官方: ${api.name.padEnd(20)} (${api.url}) -> 匹配本地: ${local.id}`);
  } else {
    console.log(`官方: ${api.name.padEnd(20)} (${api.url}) -> ❌ 未能匹配`);
  }
});
