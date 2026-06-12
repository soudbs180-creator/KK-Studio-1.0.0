// server/lib/dispatcher/adapters/wuyinImageAdapter.js
// 中文注释：无垠科技 Suchuang 图像生成适配器

const assetStore = require('../../generation/generationAssetStore');
const { toStandardError } = require('../providerErrors');
const { SuchuangProvider } = require('../../../providers/suchuangProvider');

class WuyinImageAdapter {
  constructor() {
    this.providerId = 'wuyinkeji';
  }

  async generateImage(input) {
    const { prompt, referenceImages = [], aspectRatio = '1:1', size, modelId, requestId } = input;
    const refImg = referenceImages[0];
    const base64Data = refImg ? (typeof refImg === 'string' ? refImg : refImg.data) : undefined;

    try {
      const result = await SuchuangProvider.generateImage({
        prompt,
        modelId: modelId || 'image_nanoBanana2',
        aspectRatio,
        size,
        referenceImages: base64Data ? [base64Data] : [],
        generateCount: 1,
      });

      const imageUrl = result.image;
      if (!imageUrl) {
        throw new Error('Wuyin API failed to return image URL.');
      }

      // 文件落盘
      const staticUrl = await assetStore.saveFromUrl(imageUrl);

      return {
        requestId,
        providerId: this.providerId,
        surface: 'async-image',
        modelId: modelId || 'image_nanoBanana2',
        status: 'success',
        urls: [staticUrl],
        raw: result
      };
    } catch (err) {
      throw toStandardError(err, this.providerId, 'async-image');
    }
  }
}

module.exports = new WuyinImageAdapter();
