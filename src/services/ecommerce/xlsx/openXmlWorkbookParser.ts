import JSZip from 'jszip';

import type {
  OpenXmlParsedRow,
  OpenXmlParsedSheet,
  OpenXmlParsedReferenceSlot,
  OpenXmlWorkbookAsset,
  OpenXmlWorkbookParseResult,
} from '../types.ts';

const XML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

type WorkbookRelationship = {
  id: string;
  target: string;
  type?: string;
};

type CellImageBinding = {
  dispImgId: string;
  embedRid: string;
  mediaPath?: string;
};

function decodeXml(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (match) => XML_ENTITY_MAP[match] || match);
}

function stripXmlNamespaces(xml: string): string {
  return xml.replace(/\s+xmlns(:\w+)?="[^"]*"/g, '');
}

function extractTagText(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'g');
  const values: string[] = [];
  let match = regex.exec(xml);
  while (match) {
    values.push(match[1]);
    match = regex.exec(xml);
  }
  return values;
}

function removeXmlMarkup(xml: string): string {
  return decodeXml(xml.replace(/<[^>]+>/g, ''));
}

function inferMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function getColumnRef(cellRef: string): string {
  const match = cellRef.match(/^[A-Z]+/i);
  return match ? match[0].toUpperCase() : cellRef.toUpperCase();
}

function parseSharedStrings(xml: string): string[] {
  const shared: string[] = [];
  const siBlocks = extractTagText(stripXmlNamespaces(xml), 'si');
  for (const block of siBlocks) {
    const textRuns = extractTagText(block, 't');
    shared.push(removeXmlMarkup(textRuns.join('')));
  }
  return shared;
}

function parseWorkbookRelationships(relsXml: string): WorkbookRelationship[] {
  const cleanedRels = stripXmlNamespaces(relsXml);
  const relationships: WorkbookRelationship[] = [];
  const relRegex = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"(?:[^>]*Type="([^"]+)")?[^>]*\/?>/g;
  let relMatch = relRegex.exec(cleanedRels);
  while (relMatch) {
    relationships.push({
      id: relMatch[1],
      target: relMatch[2],
      type: relMatch[3],
    });
    relMatch = relRegex.exec(cleanedRels);
  }
  return relationships;
}

function parseWorkbookSheetEntries(workbookXml: string, relationships: WorkbookRelationship[]): Array<{ name: string; path: string }> {
  const cleanedWorkbook = stripXmlNamespaces(workbookXml);
  const relMap = new Map(relationships.map((item) => [item.id, item.target]));

  const sheets: Array<{ name: string; path: string }> = [];
  const sheetRegex = /<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/?>/g;
  let match = sheetRegex.exec(cleanedWorkbook);
  while (match) {
    const target = relMap.get(match[2]);
    if (target) {
      sheets.push({ name: decodeXml(match[1]), path: `xl/${target.replace(/^\/+/, '')}` });
    }
    match = sheetRegex.exec(cleanedWorkbook);
  }
  return sheets;
}

function parseCellValue(cellXml: string, sharedStrings: string[]): { value: string; formula?: string; dispImgId?: string } {
  const typeMatch = cellXml.match(/\bt="([^"]+)"/);
  const type = typeMatch?.[1];
  const formulaMatch = cellXml.match(/<f[^>]*>([\s\S]*?)<\/f>/);
  const formula = formulaMatch ? removeXmlMarkup(formulaMatch[1]).trim() : undefined;
  const dispImgIdMatch = formula?.match(/DISPIMG\("([^"]+)"/i);
  const inlineText = extractTagText(cellXml, 't').join('');
  const valueNode = cellXml.match(/<v[^>]*>([\s\S]*?)<\/v>/);
  const rawValue = valueNode ? removeXmlMarkup(valueNode[1]) : '';

  if (type === 's') {
    const index = Number(rawValue);
    return { value: sharedStrings[index] || '', formula, dispImgId: dispImgIdMatch?.[1] };
  }

  if (type === 'inlineStr') {
    return { value: removeXmlMarkup(inlineText), formula, dispImgId: dispImgIdMatch?.[1] };
  }

  return { value: rawValue, formula, dispImgId: dispImgIdMatch?.[1] };
}

function parseSheetRows(sheetXml: string, sharedStrings: string[], sheetName: string): OpenXmlParsedRow[] {
  const cleaned = stripXmlNamespaces(sheetXml);
  const rows: OpenXmlParsedRow[] = [];
  const rowRegex = /<row[^>]*r="([^"]+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch = rowRegex.exec(cleaned);
  while (rowMatch) {
    const rowIndex = Number(rowMatch[1]);
    const body = rowMatch[2];
    const cells: Record<string, string> = {};
    const referenceSlots: OpenXmlParsedReferenceSlot[] = [];
    const cellRegex = /<c\b([\s\S]*?)>([\s\S]*?)<\/c>/g;
    let cellMatch = cellRegex.exec(body);
    while (cellMatch) {
      const attrs = cellMatch[1];
      const innerXml = cellMatch[2];
      const refMatch = attrs.match(/\br="([^"]+)"/);
      const cellRef = refMatch?.[1];
      if (cellRef) {
        const parsed = parseCellValue(`<c ${attrs}>${innerXml}</c>`, sharedStrings);
        const columnRef = getColumnRef(cellRef);
        cells[columnRef] = parsed.value;
        if (parsed.dispImgId) {
          referenceSlots.push({
            cellRef,
            columnRef,
            sheetName,
            expectedReferenceIndex: referenceSlots.length + 1,
            dispImgId: parsed.dispImgId,
            formula: parsed.formula,
          });
        }
      }
      cellMatch = cellRegex.exec(body);
    }
    rows.push({ rowIndex, cells, referenceSlots });
    rowMatch = rowRegex.exec(cleaned);
  }
  return rows;
}

function parseCellImages(cellImagesXml: string, relsXml: string): Map<string, CellImageBinding> {
  const cleanedCellImages = stripXmlNamespaces(cellImagesXml);
  const relationships = parseWorkbookRelationships(relsXml);
  const relMap = new Map(relationships.map((item) => [item.id, item.target]));
  const bindings = new Map<string, CellImageBinding>();
  const imageRegex =
    /<(?:\w+:)?cellImage\b[^>]*>[\s\S]*?<(?:\w+:)?cNvPr[^>]*name="([^"]+)"[\s\S]*?<(?:\w+:)?blip[^>]*r:embed="([^"]+)"[\s\S]*?<\/(?:\w+:)?cellImage>/g;
  let match = imageRegex.exec(cleanedCellImages);
  while (match) {
    const dispImgId = match[1];
    const embedRid = match[2];
    bindings.set(dispImgId, {
      dispImgId,
      embedRid,
      mediaPath: (() => {
        const target = relMap.get(embedRid);
        if (!target) return undefined;
        const normalized = target.replace(/^\.?\.\//, '').replace(/^\/+/, '');
        return normalized.startsWith('xl/') ? normalized : `xl/${normalized}`;
      })(),
    });
    match = imageRegex.exec(cleanedCellImages);
  }
  return bindings;
}

async function loadPreviewMap(zip: JSZip, bindings: Map<string, CellImageBinding>): Promise<Map<string, { fileName: string; mimeType: string; previewUrl: string; embedRid: string }>> {
  const previewMap = new Map<string, { fileName: string; mimeType: string; previewUrl: string; embedRid: string }>();
  for (const binding of bindings.values()) {
    if (!binding.mediaPath) continue;
    const fileName = binding.mediaPath.split('/').pop() || binding.mediaPath;
    const mimeType = inferMimeType(fileName);
    if (previewMap.has(binding.dispImgId)) continue;
    const raw = await zip.file(binding.mediaPath)?.async('base64');
    if (!raw) continue;
    previewMap.set(binding.dispImgId, {
      fileName,
      mimeType,
      previewUrl: `data:${mimeType};base64,${raw}`,
      embedRid: binding.embedRid,
    });
  }
  return previewMap;
}

export async function parseOpenXmlWorkbook(input: Blob | File | ArrayBuffer, fileName = 'requirement.xlsx'): Promise<OpenXmlWorkbookParseResult> {
  const arrayBuffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  const workbookXml = await zip.file('xl/workbook.xml')?.async('string');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');

  if (!workbookXml || !relsXml) {
    throw new Error('无法解析工作簿结构。');
  }

  const relationships = parseWorkbookRelationships(relsXml);
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];
  const sheetEntries = parseWorkbookSheetEntries(workbookXml, relationships);
  const sheets: OpenXmlParsedSheet[] = [];

  for (const sheetEntry of sheetEntries) {
    const sheetXml = await zip.file(sheetEntry.path)?.async('string');
    if (!sheetXml) continue;
    sheets.push({
      name: sheetEntry.name,
      worksheetPath: sheetEntry.path,
      rows: parseSheetRows(sheetXml, sharedStrings, sheetEntry.name),
    });
  }

  const mediaAssets: OpenXmlWorkbookAsset[] = [];
  const cellImageRelationship = relationships.find((item) => (item.target || '').toLowerCase().includes('cellimages.xml'));
  const cellImagesXml = cellImageRelationship ? await zip.file(`xl/${cellImageRelationship.target.replace(/^\/+/, '')}`)?.async('string') : undefined;
  const cellImagesRelsXml = await zip.file('xl/_rels/cellimages.xml.rels')?.async('string');

  if (cellImagesXml && cellImagesRelsXml) {
    const bindings = parseCellImages(cellImagesXml, cellImagesRelsXml);
    const previewMap = await loadPreviewMap(zip, bindings);
    let displayOrder = 1;

    for (const sheet of sheets) {
      for (const row of sheet.rows) {
        for (const slot of row.referenceSlots) {
          if (!slot.dispImgId) continue;
          const preview = previewMap.get(slot.dispImgId);
          if (!preview) continue;
          mediaAssets.push({
            assetId: `${slot.dispImgId}-${sheet.name}-${slot.cellRef}`,
            fileName: preview.fileName,
            mimeType: preview.mimeType,
            previewUrl: preview.previewUrl,
            displayOrder,
            sheetName: sheet.name,
            rowIndex: row.rowIndex,
            worksheetPath: sheet.worksheetPath,
            dispImgId: slot.dispImgId,
            embedRid: preview.embedRid,
            anchorCellRef: slot.cellRef,
            anchorRowIndex: row.rowIndex,
            anchorColRef: slot.columnRef,
            fromRow: row.rowIndex,
            fromCol: slot.columnRef ? slot.columnRef.charCodeAt(0) - 'A'.charCodeAt(0) : undefined,
            linkedCellRefs: [slot.cellRef],
          });
          displayOrder += 1;
        }
      }
    }
  } else {
    const fallbackAssets: OpenXmlWorkbookAsset[] = [];
    zip.folder('xl/media')?.forEach((relativePath) => {
      fallbackAssets.push({
        assetId: `media-${fallbackAssets.length + 1}`,
        fileName: relativePath.split('/').pop() || relativePath,
        mimeType: inferMimeType(relativePath),
        previewUrl: '',
        displayOrder: fallbackAssets.length + 1,
      });
    });

    fallbackAssets.sort((left, right) => left.fileName.localeCompare(right.fileName, undefined, { numeric: true }));
    for (const asset of fallbackAssets) {
      const raw = await zip.file(`xl/media/${asset.fileName}`)?.async('base64');
      if (raw) {
        asset.previewUrl = `data:${asset.mimeType};base64,${raw}`;
      }
    }

    let assetIndex = 0;
    for (const sheet of sheets) {
      for (const row of sheet.rows) {
        for (const slot of row.referenceSlots) {
          const asset = fallbackAssets[assetIndex];
          if (!asset) continue;
          mediaAssets.push({
            ...asset,
            assetId: `${asset.assetId}-${sheet.name}-${slot.cellRef}`,
            sheetName: sheet.name,
            rowIndex: row.rowIndex,
            worksheetPath: sheet.worksheetPath,
            anchorCellRef: slot.cellRef,
            anchorRowIndex: row.rowIndex,
            anchorColRef: slot.columnRef,
            fromRow: row.rowIndex,
            fromCol: slot.columnRef ? slot.columnRef.charCodeAt(0) - 'A'.charCodeAt(0) : undefined,
            linkedCellRefs: [slot.cellRef],
          });
          assetIndex += 1;
        }
      }
    }
  }

  return {
    sheets,
    mediaAssets,
    sourceFileName: fileName,
    sourceFileType: 'xlsx',
  };
}
