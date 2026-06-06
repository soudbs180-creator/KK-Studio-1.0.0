import type { EcommerceAnalysisResult } from './types';

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

function hasJsonContentType(response: Response): boolean {
  const contentType = response.headers.get('content-type')?.toLowerCase();
  if (!contentType) {
    return true;
  }

  return contentType.includes('application/json') || contentType.includes('+json');
}

async function analyzeRequirementFileTextLocally(
  file: File,
  sourceText: string,
): Promise<EcommerceAnalysisResult> {
  const { analyzeEcommerceTextFallback } = await import('./text/fallbackTextAnalysis.ts');
  return analyzeEcommerceTextFallback({
    text: sourceText,
    sourceFileName: file.name,
    sourceFileType: getFileExtension(file),
  });
}

async function extractDocumentTextLocally(file: File): Promise<string> {
  const extension = getFileExtension(file);

  if (extension === 'pdf') {
    const { nutrientDocumentService } = await import('../document/nutrientDocumentService.ts');
    const extractedText = await nutrientDocumentService.extractTextFromPdf(file, { fileName: file.name });
    if (extractedText.text.trim()) {
      return extractedText.text;
    }

    const ocrPdf = await nutrientDocumentService.runOcrOnPdf(file, { fileName: file.name });
    const ocrText = await nutrientDocumentService.extractTextFromPdf(ocrPdf.blob, { fileName: ocrPdf.fileName });
    return ocrText.text;
  }

  if (extension === 'doc' || extension === 'docx') {
    const { nutrientDocumentService } = await import('../document/nutrientDocumentService.ts');
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
    nonJsonResponse?: boolean;
  } = {},
): boolean {
  const extension = getFileExtension(file);
  if (!canUseLocalFallback(extension)) {
    return false;
  }

  if (options.status === 404 || options.status === 501) {
    return true;
  }

  if (options.nonJsonResponse) {
    return true;
  }

  return options.error instanceof TypeError;
}

async function analyzeRequirementFileLocally(file: File): Promise<EcommerceAnalysisResult> {
  const extension = getFileExtension(file);

  if (extension === 'xlsx') {
    const [{ parseOpenXmlWorkbook }, { normalizeEcommerceAnalysis }] = await Promise.all([
      import('./xlsx/openXmlWorkbookParser.ts'),
      import('./normalize/ecommerceAnalysisNormalizer.ts'),
    ]);
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
      if (!hasJsonContentType(response) && shouldUseLocalFallback(file, { nonJsonResponse: true })) {
        return analyzeRequirementFileLocally(file);
      }

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

    if (!hasJsonContentType(response)) {
      if (shouldUseLocalFallback(file, { nonJsonResponse: true })) {
        return analyzeRequirementFileLocally(file);
      }

      throw new Error('电商需求单解析接口返回了非 JSON 数据，当前文件类型暂不支持本地解析。');
    }

    let payload: { analysis?: EcommerceAnalysisResult };
    try {
      payload = await response.json() as { analysis?: EcommerceAnalysisResult };
    } catch {
      if (shouldUseLocalFallback(file, { nonJsonResponse: true })) {
        return analyzeRequirementFileLocally(file);
      }

      throw new Error('电商需求单返回数据格式无效。');
    }

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
