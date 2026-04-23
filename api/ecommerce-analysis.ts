import { normalizeEcommerceAnalysis } from '../src/services/ecommerce/normalize/ecommerceAnalysisNormalizer.ts';
import { analyzeEcommerceTextFallback } from '../src/services/ecommerce/text/fallbackTextAnalysis.ts';
import { parseOpenXmlWorkbook } from '../src/services/ecommerce/xlsx/openXmlWorkbookParser.ts';

export const config = { runtime: 'edge' };

const NUTRIENT_BUILD_URL = 'https://api.nutrient.io/build';
const DEFAULT_OCR_LANGUAGE = 'chi_sim';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type NutrientOperation = 'convert-to-pdf' | 'extract-text' | 'ocr-to-pdf';

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });

const trimFileName = (value: string) =>
  String(value || '')
    .trim()
    .split(/[\\/]/)
    .pop()
    ?.replace(/[^\w.\-() ]+/g, '_') || '';

const buildInstructions = (
  operation: NutrientOperation,
  fileName: string,
  ocrLanguage = DEFAULT_OCR_LANGUAGE,
) => {
  const parts = [{ file: fileName }];
  if (operation === 'extract-text') {
    return {
      parts,
      output: { type: 'text' },
    };
  }
  if (operation === 'ocr-to-pdf') {
    return {
      parts,
      actions: [{ type: 'ocr', language: ocrLanguage }],
    };
  }
  return { parts };
};

async function runNutrientBuild(operation: NutrientOperation, upload: File): Promise<Response> {
  const apiKey = process.env.NUTRIENT_API_KEY || process.env.NUTRIENT_DWS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing NUTRIENT_API_KEY or NUTRIENT_DWS_API_KEY.');
  }

  const inputFileName = trimFileName(upload.name) || 'document.bin';
  const upstreamFormData = new FormData();
  upstreamFormData.append(inputFileName, upload, inputFileName);
  upstreamFormData.append('instructions', JSON.stringify(buildInstructions(operation, inputFileName)));

  const upstreamResponse = await fetch(NUTRIENT_BUILD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: upstreamFormData,
  });

  if (!upstreamResponse.ok) {
    const rawText = (await upstreamResponse.text()).trim();
    throw new Error(rawText || 'Document processing failed.');
  }

  return upstreamResponse;
}

async function extractTextForFallback(upload: File): Promise<string> {
  const lowerName = upload.name.toLowerCase();
  if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
    return upload.text();
  }

  if (lowerName.endsWith('.pdf')) {
    const textResponse = await runNutrientBuild('extract-text', upload);
    const text = await textResponse.text();
    if (text.trim()) return text;

    const ocrResponse = await runNutrientBuild('ocr-to-pdf', upload);
    const ocrBlob = await ocrResponse.blob();
    const ocrFile = new File([ocrBlob], upload.name.replace(/\.pdf$/i, '.ocr.pdf'), { type: 'application/pdf' });
    const retryTextResponse = await runNutrientBuild('extract-text', ocrFile);
    return retryTextResponse.text();
  }

  if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
    const pdfResponse = await runNutrientBuild('convert-to-pdf', upload);
    const pdfBlob = await pdfResponse.blob();
    const pdfFile = new File([pdfBlob], upload.name.replace(/\.(docx|doc)$/i, '.pdf'), { type: 'application/pdf' });
    const textResponse = await runNutrientBuild('extract-text', pdfFile);
    return textResponse.text();
  }

  throw new Error('Unsupported fallback document format.');
}

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Only POST requests are supported.' }, 405);
  }

  try {
    const formData = await request.formData();
    const upload = formData.get('file');
    if (!(upload instanceof File)) {
      return jsonResponse({ error: 'Missing uploaded file.' }, 400);
    }

    const lowerName = upload.name.toLowerCase();
    if (lowerName.endsWith('.xlsx')) {
      const parsedWorkbook = await parseOpenXmlWorkbook(upload, upload.name);
      const analysis = normalizeEcommerceAnalysis(parsedWorkbook, 'gemini-3.1-flash-image-preview');
      return jsonResponse({ analysis }, 200);
    }

    if (
      lowerName.endsWith('.pdf')
      || lowerName.endsWith('.docx')
      || lowerName.endsWith('.doc')
      || lowerName.endsWith('.txt')
      || lowerName.endsWith('.md')
    ) {
      const text = await extractTextForFallback(upload);
      const analysis = analyzeEcommerceTextFallback({
        text,
        sourceFileName: upload.name,
        sourceFileType: lowerName.split('.').pop() || 'text',
      });
      return jsonResponse({ analysis }, 200);
    }

    return jsonResponse({ error: '当前仅支持 xlsx、pdf、docx、doc、txt、md 需求单。' }, 400);
  } catch (error: any) {
    return jsonResponse({ error: error?.message || '电商需求单解析失败。' }, 500);
  }
}
