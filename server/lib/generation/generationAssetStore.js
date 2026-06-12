// server/lib/generation/generationAssetStore.js
// 中文注释：大模型生成文件落盘服务

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * 确保 uploads 目录存在
 */
async function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * 从远程 URL 下载并保存图片文件
 */
async function saveFromUrl(imageUrl) {
  await ensureUploadsDir();
  const fileExt = imageUrl.split('.').pop()?.split('?')[0] || 'png';
  const filename = `kkai-gen-${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image from upstream: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await fs.promises.writeFile(filePath, Buffer.from(arrayBuffer));
  return `/uploads/${filename}`;
}

/**
 * 保存 base64 图片文件
 */
async function saveFromBase64(base64Data, mimeType = 'image/png') {
  await ensureUploadsDir();
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const fileExt = mimeType.split('/')[1] || 'png';
  const filename = `kkai-gen-${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  await fs.promises.writeFile(filePath, Buffer.from(cleanBase64, 'base64'));
  return `/uploads/${filename}`;
}

module.exports = {
  saveFromUrl,
  saveFromBase64
};
