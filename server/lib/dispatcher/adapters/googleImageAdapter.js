// server/lib/dispatcher/adapters/googleImageAdapter.js
// 中文注释：Google Imagen 图像生成适配器

const assetStore = require('../../generation/generationAssetStore');
const { toStandardError } = require('../providerErrors');

class GoogleImageAdapter {
  constructor() {
    this.providerId = 'google';
  }

  async generateImage(input) {
    const { prompt, referenceImages = [], aspectRatio = '1:1', modelId, requestId } = input;
    const isEditMode = referenceImages.length > 0;
    
    try {
      const contents = [{ text: prompt }];
      if (isEditMode) {
        const refImg = referenceImages[0];
        const base64Data = typeof refImg === 'string' ? refImg : refImg.data;
        const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        contents.push({
          inlineData: {
            mimeType: 'image/png',
            data: cleanBase64,
          },
        });
      }

      // 注意：这里采用动态 import 加载官方 SDK，对齐路由原有实现
      const { GoogleGenAI, Modality } = await import('@google/genai');
      const apiKey = input.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        const setupError = new Error('Gemini API key is missing.');
        setupError.code = 'SETUP_REQUIRED';
        throw setupError;
      }
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: modelId || 'gemini-2.5-flash-image',
        contents,
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
          imageConfig: isEditMode ? undefined : { aspectRatio: ['1:1', '16:9', '9:16'].includes(aspectRatio) ? aspectRatio : '1:1' },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((part) => part.inlineData);
      if (!imagePart?.inlineData) {
        throw new Error('Gemini API failed to return image data, possibly blocked by safety filters.');
      }

      const generatedMimeType = imagePart.inlineData.mimeType || 'image/png';
      const base64Image = imagePart.inlineData.data;

      // 文件落盘
      const staticUrl = await assetStore.saveFromBase64(base64Image, generatedMimeType);

      return {
        requestId,
        providerId: this.providerId,
        surface: 'gemini-native-image',
        modelId: modelId || 'gemini-2.5-flash-image',
        status: 'success',
        urls: [staticUrl],
        raw: response
      };
    } catch (err) {
      throw toStandardError(err, this.providerId, 'gemini-native-image');
    }
  }
}

module.exports = new GoogleImageAdapter();
