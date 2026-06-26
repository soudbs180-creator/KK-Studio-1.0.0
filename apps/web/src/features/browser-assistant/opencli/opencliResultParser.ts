// 简体中文：解析 OpenCLI 接口回传的渲染页面 DOM、截屏或网络参数 (Result Parser)
export class OpencliResultParser {
  public parseDomExtract(domJson: string): Record<string, any> {
    try {
      const data = JSON.parse(domJson);
      // 做数据结构清洗，防止 XSS 注入或格式畸变
      return {
        title: String(data.title || '').substring(0, 100),
        price: String(data.price || '').substring(0, 20),
        images: Array.isArray(data.images) ? data.images.map((img: any) => String(img)) : [],
        description: String(data.description || '').substring(0, 1000)
      };
    } catch {
      return {
        title: '未知提取内容',
        price: '',
        images: [],
        description: domJson
      };
    }
  }

  public parseNetworkOcr(ocrResult: any): string {
    if (typeof ocrResult === 'string') {
      return ocrResult;
    }
    return ocrResult?.text || ocrResult?.summary || '';
  }
}

export const opencliResultParser = new OpencliResultParser();
