// scripts/wuyin/sync-wuyin-catalog.mjs
// 职责：自动爬取并解析速创 API 模型文档中的真实端点路径，生成自适应多模型路由映射表。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_LIST_URL = 'https://api.wuyinkeji.com/themes/DigitalBlue/api?action=api_list';
const DOC_BASE_URL = 'https://api.wuyinkeji.com/doc';

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ...options.headers
        },
        signal: AbortSignal.timeout(10000), // 10秒超时
        ...options
      });
      if (res.status === 200) return res;
    } catch (err) {
      console.warn(`[sync-wuyin] Attempt ${i + 1} failed for ${url}:`, err.message || err);
      if (i === retries - 1) throw err;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function run() {
  try {
    console.log('1. 拉取速创 API 列表信息...');
    const listRes = await fetchWithRetry(API_LIST_URL);
    const listJson = await listRes.json();
    
    if (!listJson || !listJson.data || !Array.isArray(listJson.data.api_list)) {
      throw new Error('速创接口返回的 api_list 数据格式不正确');
    }
    
    const apis = listJson.data.api_list;
    console.log(`已获取到 ${apis.length} 个 API 产品，开始遍历下载并解析文档...`);
    
    const mapping = {};
    
    for (const api of apis) {
      const docId = api.id;
      const docName = String(api.name || '').trim();
      if (!docId || !docName) continue;
      
      const docUrl = `${DOC_BASE_URL}/${docId}`;
      console.log(`- 正在抓取 ID ${docId} 的文档 (${docName}) ...`);
      
      try {
        const docRes = await fetchWithRetry(docUrl);
        const html = await docRes.text();
        
        // 解析接口路径
        const docUrlRegex = /<strong>接口地址：<\/strong>[\s\S]*?<a[^>]+href="([^"]+)"/i;
        const match = html.match(docUrlRegex);
        let endpointUrl = '';
        
        if (match) {
          endpointUrl = match[1].trim();
        } else {
          // 备用匹配
          const fallbackRegex = /https:\/\/api\.wuyinkeji\.com\/api\/(async|img|voice|sora2-new)\/[A-Za-z0-9_.-]+/i;
          const fallbackMatch = html.match(fallbackRegex);
          if (fallbackMatch) {
            endpointUrl = fallbackMatch[0];
          }
        }
        
        if (endpointUrl) {
          try {
            let endpointPath = '';
            if (endpointUrl.startsWith('http://') || endpointUrl.startsWith('https://')) {
              const parsed = new URL(endpointUrl);
              endpointPath = parsed.pathname;
            } else {
              endpointPath = endpointUrl;
            }
            
            // 写入映射：支持中文名、英文名、小写匹配
            mapping[docName] = endpointPath;
            mapping[docName.toLowerCase()] = endpointPath;
            
            // 提取 endpointPath 最后的名称段
            const lastPart = endpointPath.split('/').pop();
            if (lastPart) {
              mapping[lastPart] = endpointPath;
              mapping[lastPart.toLowerCase()] = endpointPath;
            }
            
            console.log(`  成功解析: ${docName} -> ${endpointPath}`);
          } catch (urlErr) {
            console.warn(`  解析 URL 失败: ${endpointUrl}`, urlErr.message);
          }
        } else {
          console.warn(`  未能在文档中找到任何真实的接口地址！`);
        }
      } catch (docErr) {
        console.error(`  抓取文档 ID ${docId} 失败:`, docErr.message);
      }
      
      // 间隔 200ms
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // 生成写入目标路径
    const targetPath = path.resolve(__dirname, '../../server/lib/wuyinEndpoints.json');
    fs.writeFileSync(targetPath, JSON.stringify(mapping, null, 2));
    console.log(`\n🎉 自动同步完成！已生成最新的路由映射文件并写入：\n  ${targetPath}`);
    
  } catch (error) {
    console.error('[sync-wuyin] 同步流程发生致命错误:', error.message || error);
    process.exit(1);
  }
}

run();
