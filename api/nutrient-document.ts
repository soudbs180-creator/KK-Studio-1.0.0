export const config = { runtime: 'edge' };

const NUTRIENT_BUILD_URL = 'https://api.nutrient.io/build';
const DEFAULT_OCR_LANGUAGE = 'chi_sim';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type NutrientOperation = 'convert-to-pdf' | 'extract-text' | 'ocr-to-pdf';

const SUPPORTED_OPERATIONS = new Set<NutrientOperation>([
  'convert-to-pdf',
  'extract-text',
  'ocr-to-pdf',
]);

const isSupportedOperation = (value: string): value is NutrientOperation =>
  SUPPORTED_OPERATIONS.has(value as NutrientOperation);

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

const replaceFileExtension = (fileName: string, extension: string) => {
  const normalizedName = trimFileName(fileName) || 'document';
  const cleanExtension = extension.startsWith('.') ? extension : `.${extension}`;
  const withoutExtension = normalizedName.replace(/\.[^.]+$/, '') || 'document';
  return `${withoutExtension}${cleanExtension}`;
};

const getOutputContentType = (operation: NutrientOperation) =>
  operation === 'extract-text' ? 'text/plain; charset=utf-8' : 'application/pdf';

const getOutputFileName = (operation: NutrientOperation, inputFileName: string) =>
  operation === 'extract-text'
    ? replaceFileExtension(inputFileName, '.txt')
    : replaceFileExtension(inputFileName, '.pdf');

const buildInstructions = (
  operation: NutrientOperation,
  fileName: string,
  ocrLanguage: string,
) => {
  const parts = [{ file: fileName }];

  switch (operation) {
    case 'convert-to-pdf':
      return { parts };
    case 'extract-text':
      return {
        parts,
        output: { type: 'text' },
      };
    case 'ocr-to-pdf':
      return {
        parts,
        actions: [
          {
            type: 'ocr',
            language: ocrLanguage || DEFAULT_OCR_LANGUAGE,
          },
        ],
      };
  }
};

const extractErrorMessage = async (response: Response) => {
  const rawText = (await response.text()).trim();
  if (!rawText) {
    return 'Nutrient request failed';
  }

  try {
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    return String(
      parsed.error
        || parsed.message
        || parsed.detail
        || parsed.title
        || rawText,
    );
  } catch {
    return rawText;
  }
};

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Only POST requests are supported.' }, 405);
  }

  const apiKey = process.env.NUTRIENT_API_KEY || process.env.NUTRIENT_DWS_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      {
        error: 'Missing NUTRIENT_API_KEY or NUTRIENT_DWS_API_KEY.',
      },
      500,
    );
  }

  try {
    const formData = await request.formData();
    const operationValue = String(formData.get('operation') || '').trim();
    const upload = formData.get('file');
    const requestedLanguage = String(formData.get('ocrLanguage') || '').trim();

    if (!isSupportedOperation(operationValue)) {
      return jsonResponse(
        {
          error: 'Unsupported operation. Use convert-to-pdf, extract-text, or ocr-to-pdf.',
        },
        400,
      );
    }

    if (!(upload instanceof File)) {
      return jsonResponse({ error: 'Missing uploaded file.' }, 400);
    }

    const inputFileName = trimFileName(upload.name) || 'document.bin';
    const instructions = buildInstructions(
      operationValue,
      inputFileName,
      requestedLanguage || DEFAULT_OCR_LANGUAGE,
    );

    const upstreamFormData = new FormData();
    upstreamFormData.append(inputFileName, upload, inputFileName);
    upstreamFormData.append('instructions', JSON.stringify(instructions));

    const upstreamResponse = await fetch(NUTRIENT_BUILD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: upstreamFormData,
    });

    if (!upstreamResponse.ok) {
      return jsonResponse(
        {
          error: await extractErrorMessage(upstreamResponse),
        },
        upstreamResponse.status || 502,
      );
    }

    const outputContentType =
      upstreamResponse.headers.get('content-type') || getOutputContentType(operationValue);
    const outputFileName = getOutputFileName(operationValue, inputFileName);

    return new Response(await upstreamResponse.arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': outputContentType,
        'Content-Disposition': `attachment; filename="${outputFileName}"`,
        ...CORS_HEADERS,
      },
    });
  } catch (error: any) {
    return jsonResponse(
      {
        error: error?.message || 'Document processing failed.',
      },
      500,
    );
  }
}
