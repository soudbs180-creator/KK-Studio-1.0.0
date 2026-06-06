import type JSZip from 'jszip';

import type {
  OpenXmlParsedRow,
  OpenXmlParsedSheet,
  OpenXmlParsedReferenceSlot,
  OpenXmlWorkbookAsset,
  OpenXmlWorkbookParseResult,
} from '../types';

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

type DrawingAnchorBinding = {
  anchorCellRef: string;
  anchorRowIndex: number;
  anchorColRef: string;
  fromRow: number;
  fromCol: number;
  embedRid: string;
  mediaPath?: string;
};

type JSZipRuntime = {
  loadAsync(data: ArrayBuffer | Blob | Uint8Array): Promise<JSZip>;
};
type JSZipRuntimeModule = JSZipRuntime | {
  default?: JSZipRuntime;
};

function isJSZipRuntime(value: unknown): value is JSZipRuntime {
  return Boolean(value) && typeof (value as JSZipRuntime).loadAsync === 'function';
}

async function loadJSZipRuntime(): Promise<JSZipRuntime> {
  const zipModule = await import('jszip') as unknown as JSZipRuntimeModule;
  const runtime = isJSZipRuntime(zipModule)
    ? zipModule
    : zipModule.default;

  if (!isJSZipRuntime(runtime)) {
    throw new Error('XLSX ZIP runtime is unavailable.');
  }

  return runtime;
}

function decodeXml(value: string): string {
  return value
    .replace(/&#(x?[0-9a-fA-F]+);/g, (match, code) => {
      const radix = String(code).toLowerCase().startsWith('x') ? 16 : 10;
      const rawCodePoint = String(code).toLowerCase().startsWith('x')
        ? String(code).slice(1)
        : String(code);
      const codePoint = Number.parseInt(rawCodePoint, radix);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    })
    .replace(/&(amp|lt|gt|quot|apos);/g, (match) => XML_ENTITY_MAP[match] || match);
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

function parseXmlAttributes(attributeText: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attrRegex = /([\w:.-]+)="([^"]*)"/g;
  let match = attrRegex.exec(attributeText);
  while (match) {
    attributes[match[1]] = decodeXml(match[2]);
    match = attrRegex.exec(attributeText);
  }
  return attributes;
}

function inferMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function resolveZipPath(basePath: string, target: string): string {
  const normalizedTarget = target.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalizedTarget || normalizedTarget.startsWith('xl/')) {
    return normalizedTarget;
  }

  const segments = basePath.replace(/\\/g, '/').split('/');
  segments.pop();

  normalizedTarget.split('/').forEach((segment) => {
    if (!segment || segment === '.') return;
    if (segment === '..') {
      segments.pop();
      return;
    }
    segments.push(segment);
  });

  return segments.join('/');
}

function getRelationshipPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  const directory = lastSlash >= 0 ? normalized.slice(0, lastSlash) : '';
  const fileName = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  return directory ? `${directory}/_rels/${fileName}.rels` : `_rels/${fileName}.rels`;
}

function getColumnRef(cellRef: string): string {
  const match = cellRef.match(/^[A-Z]+/i);
  return match ? match[0].toUpperCase() : cellRef.toUpperCase();
}

function columnIndexToRef(index: number): string {
  let current = index + 1;
  let result = '';

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
}

function columnRefToIndex(columnRef: string | undefined): number {
  if (!columnRef) return Number.MAX_SAFE_INTEGER;

  return String(columnRef)
    .toUpperCase()
    .split('')
    .reduce((sum, char) => sum * 26 + (char.charCodeAt(0) - 64), 0);
}

function getAssetSpatialRowIndex(asset: Pick<OpenXmlWorkbookAsset, 'anchorRowIndex' | 'rowIndex' | 'fromRow'>): number {
  if (typeof asset.anchorRowIndex === 'number') return asset.anchorRowIndex;
  if (typeof asset.rowIndex === 'number') return asset.rowIndex;
  if (typeof asset.fromRow === 'number') return asset.fromRow + 1;
  return Number.MAX_SAFE_INTEGER;
}

function getAssetSpatialColIndex(asset: Pick<OpenXmlWorkbookAsset, 'anchorColRef' | 'fromCol'>): number {
  if (asset.anchorColRef) {
    return columnRefToIndex(asset.anchorColRef);
  }

  if (typeof asset.fromCol === 'number') {
    return asset.fromCol + 1;
  }

  return Number.MAX_SAFE_INTEGER;
}

function compareMediaAssetsBySpatialOrder(left: OpenXmlWorkbookAsset, right: OpenXmlWorkbookAsset): number {
  if ((left.sheetName || '') !== (right.sheetName || '')) {
    return left.displayOrder - right.displayOrder;
  }

  const rowDelta = getAssetSpatialRowIndex(left) - getAssetSpatialRowIndex(right);
  if (rowDelta !== 0) {
    return rowDelta;
  }

  const colDelta = getAssetSpatialColIndex(left) - getAssetSpatialColIndex(right);
  if (colDelta !== 0) {
    return colDelta;
  }

  return left.displayOrder - right.displayOrder;
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
  const relRegex = /<Relationship\b([^>]*)\/?>/g;
  let relMatch = relRegex.exec(cleanedRels);
  while (relMatch) {
    const attributes = parseXmlAttributes(relMatch[1]);
    if (!attributes.Id || !attributes.Target) {
      relMatch = relRegex.exec(cleanedRels);
      continue;
    }
    relationships.push({
      id: attributes.Id,
      target: attributes.Target,
      type: attributes.Type,
    });
    relMatch = relRegex.exec(cleanedRels);
  }
  return relationships;
}

function parseWorkbookSheetEntries(workbookXml: string, relationships: WorkbookRelationship[]): Array<{ name: string; path: string }> {
  const cleanedWorkbook = stripXmlNamespaces(workbookXml);
  const relMap = new Map(relationships.map((item) => [item.id, item.target]));

  const sheets: Array<{ name: string; path: string }> = [];
  const sheetRegex = /<sheet\b([^>]*)\/?>/g;
  let match = sheetRegex.exec(cleanedWorkbook);
  while (match) {
    const attributes = parseXmlAttributes(match[1]);
    const relationshipId = attributes['r:id'] || attributes.id;
    const target = relationshipId ? relMap.get(relationshipId) : undefined;
    if (target) {
      sheets.push({ name: attributes.name || '', path: resolveZipPath('xl/workbook.xml', target) });
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

function parseWorksheetDrawingTargets(
  sheetXml: string,
  relsXml: string,
  sheetPath: string,
): string[] {
  const cleanedSheetXml = stripXmlNamespaces(sheetXml);
  const relationships = parseWorkbookRelationships(relsXml);
  const relMap = new Map(relationships.map((item) => [item.id, item.target]));
  const targets = new Set<string>();
  const drawingRegex = /<drawing[^>]*r:id="([^"]+)"/g;

  let match = drawingRegex.exec(cleanedSheetXml);
  while (match) {
    const target = relMap.get(match[1]);
    if (target) {
      targets.add(resolveZipPath(sheetPath, target));
    }
    match = drawingRegex.exec(cleanedSheetXml);
  }

  return Array.from(targets);
}

function parseDrawingAnchors(
  drawingXml: string,
  relsXml: string,
  drawingPath: string,
): DrawingAnchorBinding[] {
  const cleanedDrawingXml = stripXmlNamespaces(drawingXml);
  const relationships = parseWorkbookRelationships(relsXml);
  const relMap = new Map(relationships.map((item) => [item.id, item.target]));
  const anchors: DrawingAnchorBinding[] = [];
  const anchorRegex = /<(?:\w+:)?(?:oneCellAnchor|twoCellAnchor)\b[^>]*>([\s\S]*?)<\/(?:\w+:)?(?:oneCellAnchor|twoCellAnchor)>/g;

  let match = anchorRegex.exec(cleanedDrawingXml);
  while (match) {
    const block = match[1];
    const embedMatch = block.match(/<(?:\w+:)?blip[^>]*r:embed="([^"]+)"/);
    const fromMatch = block.match(
      /<(?:\w+:)?from>[\s\S]*?<(?:\w+:)?col>(\d+)<\/(?:\w+:)?col>[\s\S]*?<(?:\w+:)?row>(\d+)<\/(?:\w+:)?row>[\s\S]*?<\/(?:\w+:)?from>/,
    );

    if (!embedMatch || !fromMatch) {
      match = anchorRegex.exec(cleanedDrawingXml);
      continue;
    }

    const fromCol = Number(fromMatch[1]);
    const fromRow = Number(fromMatch[2]);
    const anchorRowIndex = fromRow + 1;
    const anchorColRef = columnIndexToRef(fromCol);
    anchors.push({
      anchorCellRef: `${anchorColRef}${anchorRowIndex}`,
      anchorRowIndex,
      anchorColRef,
      fromRow,
      fromCol,
      embedRid: embedMatch[1],
      mediaPath: (() => {
        const target = relMap.get(embedMatch[1]);
        return target ? resolveZipPath(drawingPath, target) : undefined;
      })(),
    });
    match = anchorRegex.exec(cleanedDrawingXml);
  }

  return anchors;
}

async function loadPreviewPayload(
  zip: JSZip,
  mediaPath: string | undefined,
): Promise<{ fileName: string; mimeType: string; previewUrl: string } | null> {
  if (!mediaPath) return null;
  const fileName = mediaPath.split('/').pop() || mediaPath;
  const mimeType = inferMimeType(fileName);
  const raw = await zip.file(mediaPath)?.async('base64');
  if (!raw) return null;
  return {
    fileName,
    mimeType,
    previewUrl: `data:${mimeType};base64,${raw}`,
  };
}

async function loadPreviewMap(zip: JSZip, bindings: Map<string, CellImageBinding>): Promise<Map<string, { fileName: string; mimeType: string; previewUrl: string; embedRid: string }>> {
  const previewMap = new Map<string, { fileName: string; mimeType: string; previewUrl: string; embedRid: string }>();
  for (const binding of bindings.values()) {
    if (previewMap.has(binding.dispImgId)) continue;
    const preview = await loadPreviewPayload(zip, binding.mediaPath);
    if (!preview) continue;
    previewMap.set(binding.dispImgId, {
      fileName: preview.fileName,
      mimeType: preview.mimeType,
      previewUrl: preview.previewUrl,
      embedRid: binding.embedRid,
    });
  }
  return previewMap;
}

export async function parseOpenXmlWorkbook(input: Blob | File | ArrayBuffer, fileName = 'requirement.xlsx'): Promise<OpenXmlWorkbookParseResult> {
  const arrayBuffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
  const JSZipRuntime = await loadJSZipRuntime();
  const zip = await JSZipRuntime.loadAsync(arrayBuffer);

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
  const sheetXmlByPath = new Map<string, string>();

  for (const sheetEntry of sheetEntries) {
    const sheetXml = await zip.file(sheetEntry.path)?.async('string');
    if (!sheetXml) continue;
    sheetXmlByPath.set(sheetEntry.path, sheetXml);
    sheets.push({
      name: sheetEntry.name,
      worksheetPath: sheetEntry.path,
      rows: parseSheetRows(sheetXml, sharedStrings, sheetEntry.name),
    });
  }

  const mediaAssets: OpenXmlWorkbookAsset[] = [];
  const mediaAssetKeys = new Set<string>();
  const appendMediaAsset = (asset: Omit<OpenXmlWorkbookAsset, 'displayOrder'>) => {
    const assetKey = [
      asset.sheetName || '',
      asset.anchorCellRef || '',
      asset.embedRid || '',
      asset.fileName,
    ].join('|');

    if (mediaAssetKeys.has(assetKey)) {
      return;
    }

    mediaAssetKeys.add(assetKey);
    mediaAssets.push({
      ...asset,
      displayOrder: mediaAssets.length + 1,
    });
  };
  const cellImageRelationship = relationships.find((item) => (item.target || '').toLowerCase().includes('cellimages.xml'));
  const cellImagesXml = cellImageRelationship
    ? await zip.file(resolveZipPath('xl/workbook.xml', cellImageRelationship.target))?.async('string')
    : undefined;
  const cellImagesRelsXml = await zip.file('xl/_rels/cellimages.xml.rels')?.async('string');

  if (cellImagesXml && cellImagesRelsXml) {
    const bindings = parseCellImages(cellImagesXml, cellImagesRelsXml);
    const previewMap = await loadPreviewMap(zip, bindings);

    for (const sheet of sheets) {
      for (const row of sheet.rows) {
        for (const slot of row.referenceSlots) {
          if (!slot.dispImgId) continue;
          const preview = previewMap.get(slot.dispImgId);
          if (!preview) continue;
          appendMediaAsset({
            assetId: `${slot.dispImgId}-${sheet.name}-${slot.cellRef}`,
            fileName: preview.fileName,
            mimeType: preview.mimeType,
            previewUrl: preview.previewUrl,
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
          appendMediaAsset({
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

  for (const sheet of sheets) {
    if (!sheet.worksheetPath) continue;
    const sheetXml = sheetXmlByPath.get(sheet.worksheetPath);
    if (!sheetXml) continue;

    const sheetRelsPath = getRelationshipPath(sheet.worksheetPath);
    const sheetRelsXml = await zip.file(sheetRelsPath)?.async('string');
    if (!sheetRelsXml) continue;

    const drawingTargets = parseWorksheetDrawingTargets(sheetXml, sheetRelsXml, sheet.worksheetPath);
    for (const drawingPath of drawingTargets) {
      const drawingXml = await zip.file(drawingPath)?.async('string');
      const drawingRelsXml = await zip.file(getRelationshipPath(drawingPath))?.async('string');
      if (!drawingXml || !drawingRelsXml) continue;

      const anchors = parseDrawingAnchors(drawingXml, drawingRelsXml, drawingPath);
      for (const anchor of anchors) {
        const preview = await loadPreviewPayload(zip, anchor.mediaPath);
        if (!preview) continue;

        appendMediaAsset({
          assetId: `${preview.fileName}-${sheet.name}-${anchor.anchorCellRef}`,
          fileName: preview.fileName,
          mimeType: preview.mimeType,
          previewUrl: preview.previewUrl,
          sheetName: sheet.name,
          rowIndex: anchor.anchorRowIndex,
          worksheetPath: sheet.worksheetPath,
          embedRid: anchor.embedRid,
          anchorCellRef: anchor.anchorCellRef,
          anchorRowIndex: anchor.anchorRowIndex,
          anchorColRef: anchor.anchorColRef,
          fromRow: anchor.fromRow,
          fromCol: anchor.fromCol,
          linkedCellRefs: [anchor.anchorCellRef],
        });
      }
    }
  }

  mediaAssets.sort(compareMediaAssetsBySpatialOrder);
  mediaAssets.forEach((asset, index) => {
    asset.displayOrder = index + 1;
  });

  return {
    sheets,
    mediaAssets,
    sourceFileName: fileName,
    sourceFileType: 'xlsx',
  };
}
