import type { EcommerceAnalysisResult } from './types';

export async function analyzeEcommerceRequirementFile(file: File): Promise<EcommerceAnalysisResult> {
  const formData = new FormData();
  formData.append('file', file, file.name);

  const response = await fetch('/api/ecommerce-analysis', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let message = '电商需求单解析失败';
    try {
      const payload = await response.json() as Record<string, unknown>;
      message = String(payload.error || payload.message || message);
    } catch {
      // Keep fallback.
    }
    throw new Error(message);
  }

  const payload = await response.json() as { analysis?: EcommerceAnalysisResult };
  if (!payload.analysis) {
    throw new Error('电商需求单返回数据格式无效。');
  }
  return payload.analysis;
}
