# Nutrient Document Processing

KK Studio now includes a server-side Nutrient proxy at `/api/nutrient-document` for document workflows that should not expose secrets in the browser.

## Setup

Add one of these server-only environment variables:

```bash
NUTRIENT_API_KEY=your-api-key
# or
NUTRIENT_DWS_API_KEY=your-api-key
```

Do not expose the key through any `VITE_*` variable.

## Supported flows

- Convert office documents to PDF through `convert-to-pdf`
  This works for `.docx` and also fits the app's exported `.pptx` files when you want a PDF handoff.
- Extract plain text from PDFs through `extract-text`
- OCR scanned PDFs into searchable PDFs through `ocr-to-pdf`

## Frontend usage

Use [`nutrientDocumentService`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/services/document/nutrientDocumentService.ts) from the browser code:

```ts
import { nutrientDocumentService } from '@/services/document/nutrientDocumentService';

const pdfResult = await nutrientDocumentService.convertDocumentToPdf(fileOrBlob, {
  fileName: 'deck.pptx',
});

const textResult = await nutrientDocumentService.extractTextFromPdf(pdfFile, {
  fileName: 'contract.pdf',
});

const ocrResult = await nutrientDocumentService.runOcrOnPdf(scannedPdf, {
  fileName: 'scan.pdf',
  language: 'chi_sim',
});
```

## Notes

- The OCR default is `chi_sim` because this repo primarily targets Chinese-language workflows. Override it per request when needed.
- In local development, Vite proxies `/api/nutrient-document` to the same handler used for deployment, so the browser code does not need a different base URL.
- The service accepts both `File` and `Blob`, which means it can process files uploaded by the user or PPT/PDF blobs generated inside the app.
