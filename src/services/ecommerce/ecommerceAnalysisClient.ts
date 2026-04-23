import { nutrientDocumentService } from '../document/nutrientDocumentService.ts';
import { normalizeEcommerceAnalysis } from './normalize/ecommerceAnalysisNormalizer.ts';
import { analyzeEcommerceTextFallback } from './text/fallbackTextAnalysis.ts';
import type { EcommerceAnalysisResult } from './types';
import { parseOpenXmlWorkbook } from './xlsx/openXmlWorkbookParser.ts';

type SupportedLocalFallbackExtension = 'xlsx' | 'txt' | 'md' | 'pdf' | 'doc' | 'docx';

function getFileExtension(file: File): string {
  const match = file.name.toLowerCase().match(/\.([^.]+)$/);
  return match?.[1] || '';
}

function canUseLocalFallback(extension: string): extension is SupportedLocalFallbackExtension {
  return extension === 'xlsx'
    || extension === 'txt'
    || extension === 'md'
    || extension === 'pdf'
    || extension === 'doc'
    || extension === 'docx';
}

async function analyzeRequirementFileTextLocally(
  file: File,
  sourceText: string,
): Promise<EcommerceAnalysisResult> {
  return analyzeEcommerceTextFallback({
    text: sourceText,
    sourceFileName: file.name,
    sourceFileType: getFileExtension(file),
  });
}

async function extractDocumentTextLocally(file: File): Promise<string> {
  const extension = getFileExtension(file);

  if (extension === 'pdf') {
    const extractedText = await nutrientDocumentService.extractTextFromPdf(file, { fileName: file.name });
    if (extractedText.text.trim()) {
      return extractedText.text;
    }

    const ocrPdf = await nutrientDocumentService.runOcrOnPdf(file, { fileName: file.name });
    const ocrText = await nutrientDocumentService.extractTextFromPdf(ocrPdf.blob, { fileName: ocrPdf.fileName });
    return ocrText.text;
  }

  if (extension === 'doc' || extension === 'docx') {
    const pdfDocument = await nutrientDocumentService.convertDocumentToPdf(file, { fileName: file.name });
    const extractedText = await nutrientDocumentService.extractTextFromPdf(pdfDocument.blob, { fileName: pdfDocument.fileName });
    return extractedText.text;
  }

  throw new Error('当前文档类型暂不支持文本提取回退。');
}

function shouldUseLocalFallback(
  file: File,
  options: {
    status?: number;
    error?: unknown;
  } = {},
): boolean {
  const extension = getFileExtension(file);
  if (!canUseLocalFallback(extension)) {
    return false;
  }

  if (options.status === 404 || options.status === 501) {
    return true;
  }

  return options.error instanceof TypeError;
}

async function analyzeRequirementFileLocally(file: File): Promise<EcommerceAnalysisResult> {
  const extension = getFileExtension(file);

  if (extension === 'xlsx') {
    const parsedWorkbook = await parseOpenXmlWorkbook(file, file.name);
    return normalizeEcommerceAnalysis(parsedWorkbook, 'gemini-3.1-flash-image-preview');
  }

  if (extension === 'txt' || extension === 'md') {
    return analyzeRequirementFileTextLocally(file, await file.text());
  }

  if (extension === 'pdf' || extension === 'doc' || extension === 'docx') {
    return analyzeRequirementFileTextLocally(file, await extractDocumentTextLocally(file));
  }

  throw new Error('当前文件类型暂不支持本地回退分析。');
}

export async function analyzeEcommerceRequirementFile(file: File): Promise<EcommerceAnalysisResult> {
  const formData = new FormData();
  formData.append('file', file, file.name);

  try {
    const response = await fetch('/api/ecommerce-analysis', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      if (shouldUseLocalFallback(file, { status: response.status })) {
        return analyzeRequirementFileLocally(file);
      }

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
  } catch (error) {
    if (shouldUseLocalFallback(file, { error })) {
      return analyzeRequirementFileLocally(file);
    }

    throw error;
  }
}
