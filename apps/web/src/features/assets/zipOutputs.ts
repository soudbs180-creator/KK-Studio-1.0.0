// 简体中文：生成图片 ZIP 打包归档器 (Zip Outputs)

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useAssetStore } from './assetStore';

export interface ZipParams {
  projectName: string;
  batchId: string;
  imageNodes: any[]; // 包含 url, id, name, timestamp, parentPromptId
}

/**
 * 将指定范围内的图片输出打包成 ZIP，并自动附加一份说明 manifest.json
 */
export async function zipOutputs(scope: string, params: ZipParams): Promise<{ count: number; failedCount: number }> {
  let outputs = params.imageNodes || [];

  if (scope === 'latest_batch') {
    // 智能获取最后一批生成的图片：按时间降序排列，取最近 of 4 张
    const sorted = [...outputs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    outputs = sorted.slice(0, 4);
  }

  if (outputs.length === 0) {
    throw new Error('当前画布上没有可供打包的生成图片结果。');
  }

  const zip = new JSZip();
  const manifest = {
    projectName: params.projectName || 'KKStudio',
    batchId: params.batchId,
    createdAt: new Date().toISOString(),
    count: 0,
    items: [] as Array<{ id: string; filename: string; sourceCardId: string }>,
    failedItems: [] as Array<{ id: string; name?: string; url?: string; reason: string }>
  };

  const { images, files } = useAssetStore.getState();

  for (let i = 0; i < outputs.length; i++) {
    const output = outputs[i];
    let blob: Blob;

    // 优先在本地 assetStore 中寻找关联的本地 File
    const matchedImage = images.find(img => 
      img.id === output.id || 
      img.name === output.name || 
      img.thumbnailUrl === output.url
    );

    const matchedFile = files.find(f => 
      f.id === output.id || 
      f.name === output.name
    );

    const matchedAsset = matchedImage || matchedFile;

    // 格式化安全的文件名
    const safeName = (output.name || `image_${output.id}`)
      .replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_')
      .substring(0, 50);
    const filename = `${String(i + 1).padStart(3, '0')}_${safeName}.png`;

    try {
      if (matchedAsset && matchedAsset.localFile) {
        blob = matchedAsset.localFile;
      } else {
        blob = await fetch(output.url).then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.blob();
        });
      }

      zip.file(filename, blob);
      manifest.items.push({
        id: output.id,
        filename,
        sourceCardId: output.parentPromptId || output.id
      });
    } catch (error: any) {
      manifest.failedItems.push({
        id: output.id,
        name: output.name,
        url: output.url,
        reason: error?.message || 'fetch_failed'
      });
    }
  }

  manifest.count = manifest.items.length;
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  if (manifest.items.length === 0) {
    throw new Error('没有任何图片成功打包，请检查图片地址是否有效或是否存在跨域限制。');
  }

  // 导出生成
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${params.projectName || 'KKStudio'}_outputs.zip`);

  return {
    count: manifest.items.length,
    failedCount: manifest.failedItems.length
  };
}

