// 简体中文：惰性上传机制 (Lazy Upload)

import { assetStore } from './assetStore';

/**
 * 确保文件已成功上传。若为 linked 状态且不是敏感文件，则触发假上传或实际存储上传。
 */
export async function ensureFileUploaded(assetId: string): Promise<string> {
  const asset = assetStore.getFile(assetId);
  if (!asset) {
    throw new Error('文件不存在');
  }

  if (asset.sensitive || asset.uploadState === 'blocked_sensitive') {
    throw new Error('该文件包含或可能包含敏感配置信息，接管系统物理性禁止将其发送或上传给 AI');
  }

  if (asset.uploadState === 'uploaded' && asset.uploadedUrl) {
    return asset.uploadedUrl;
  }

  if (!asset.localFile) {
    throw new Error('本地文件句柄已失效，请重新连接');
  }

  // 模拟真实网络延时与上传交互
  await new Promise(resolve => setTimeout(resolve, 1000));
  const uploadedUrl = `https://storage.kkai.plus/projects/assets/takeover_${assetId}_${encodeURIComponent(asset.name)}`;

  assetStore.updateFile(assetId, {
    uploadState: 'uploaded',
    uploadedUrl
  });

  return uploadedUrl;
}
