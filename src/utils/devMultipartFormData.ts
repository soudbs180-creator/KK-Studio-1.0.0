const CRLF_BYTES = new Uint8Array([0x0d, 0x0a]);
const HEADER_TERMINATOR_BYTES = new Uint8Array([0x0d, 0x0a, 0x0d, 0x0a]);
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function concatUint8Arrays(...chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((length, chunk) => length + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

function indexOfSequence(
  body: Uint8Array,
  sequence: Uint8Array,
  startOffset: number,
): number {
  const lastStart = body.length - sequence.length;

  for (let index = startOffset; index <= lastStart; index += 1) {
    let matches = true;

    for (let offset = 0; offset < sequence.length; offset += 1) {
      if (body[index + offset] !== sequence[offset]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return index;
    }
  }

  return -1;
}

function bytesEqual(
  left: Uint8Array,
  leftStart: number,
  leftEnd: number,
  right: Uint8Array,
): boolean {
  if (leftEnd - leftStart !== right.length) {
    return false;
  }

  for (let index = 0; index < right.length; index += 1) {
    if (left[leftStart + index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function isClosingBoundaryLine(
  body: Uint8Array,
  boundaryStart: number,
  boundaryEnd: number,
  openingBoundaryLine: Uint8Array,
): boolean {
  return (
    boundaryEnd - boundaryStart === openingBoundaryLine.length + 2 &&
    bytesEqual(body, boundaryStart, boundaryStart + openingBoundaryLine.length, openingBoundaryLine) &&
    body[boundaryEnd - 2] === 0x2d &&
    body[boundaryEnd - 1] === 0x2d
  );
}

function findNextBoundaryMarker(
  body: Uint8Array,
  openingBoundaryLine: Uint8Array,
  startOffset: number,
): number {
  for (let index = startOffset; index <= body.length - (openingBoundaryLine.length + 2); index += 1) {
    if (body[index] !== 0x0d || body[index + 1] !== 0x0a) {
      continue;
    }

    if (
      bytesEqual(
        body,
        index + 2,
        index + 2 + openingBoundaryLine.length,
        openingBoundaryLine,
      )
    ) {
      return index;
    }
  }

  return -1;
}

function unquoteHeaderValue(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  return value;
}

function decodeExtendedFilename(value: string): string {
  const rawValue = unquoteHeaderValue(value);
  const match = /^([^']*)'[^']*'(.*)$/.exec(rawValue);
  const encodedValue = match ? match[2] : rawValue;

  try {
    return decodeURIComponent(encodedValue);
  } catch {
    return encodedValue;
  }
}

function escapeQuotedHeaderValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normalizeContentDispositionLine(line: string): string {
  const separatorIndex = line.indexOf(':');

  if (separatorIndex === -1) {
    return line;
  }

  const headerName = line.slice(0, separatorIndex);

  if (headerName.toLowerCase() !== 'content-disposition') {
    return line;
  }

  const rawValue = line.slice(separatorIndex + 1).trim();
  const segments = rawValue.split(';').map((segment) => segment.trim()).filter(Boolean);

  if (segments.length === 0 || segments[0].toLowerCase() !== 'form-data') {
    return line;
  }

  let nameValue: string | undefined;
  let filenameValue: string | undefined;
  let filenameStarValue: string | undefined;
  const passthroughSegments: string[] = [];

  for (const segment of segments.slice(1)) {
    const equalsIndex = segment.indexOf('=');

    if (equalsIndex === -1) {
      passthroughSegments.push(segment);
      continue;
    }

    const key = segment.slice(0, equalsIndex).trim().toLowerCase();
    const value = segment.slice(equalsIndex + 1).trim();

    if (key === 'name') {
      nameValue = unquoteHeaderValue(value);
      continue;
    }

    if (key === 'filename') {
      filenameValue = unquoteHeaderValue(value);
      continue;
    }

    if (key === 'filename*') {
      filenameStarValue = value;
      continue;
    }

    passthroughSegments.push(segment);
  }

  if (!filenameStarValue || !nameValue) {
    return line;
  }

  const effectiveFilename = filenameValue ?? decodeExtendedFilename(filenameStarValue);

  if (!effectiveFilename) {
    return line;
  }

  const normalizedSegments = [
    'form-data',
    `name="${escapeQuotedHeaderValue(nameValue)}"`,
    `filename="${escapeQuotedHeaderValue(effectiveFilename)}"`,
    ...passthroughSegments,
  ];

  return `${headerName}: ${normalizedSegments.join('; ')}`;
}

function normalizeHeaderBlock(headerBytes: Uint8Array): Uint8Array {
  const headerText = textDecoder.decode(headerBytes);
  const headerLines = headerText.split('\r\n');
  let changed = false;
  const normalizedLines = headerLines.map((line) => {
    const normalizedLine = normalizeContentDispositionLine(line);

    if (normalizedLine !== line) {
      changed = true;
    }

    return normalizedLine;
  });

  if (!changed) {
    return headerBytes;
  }

  return textEncoder.encode(normalizedLines.join('\r\n'));
}

export function normalizeDevMultipartFormDataBody(body: Uint8Array): Uint8Array {
  const firstLineEnd = indexOfSequence(body, CRLF_BYTES, 0);

  if (firstLineEnd === -1) {
    return body;
  }

  const openingBoundaryLine = body.subarray(0, firstLineEnd);

  if (openingBoundaryLine.length < 4 || openingBoundaryLine[0] !== 0x2d || openingBoundaryLine[1] !== 0x2d) {
    return body;
  }

  const normalizedChunks: Uint8Array[] = [];
  let changed = false;
  let boundaryStart = 0;

  while (boundaryStart < body.length) {
    const lineEnd = indexOfSequence(body, CRLF_BYTES, boundaryStart);
    const boundaryEnd = lineEnd === -1 ? body.length : lineEnd;

    if (isClosingBoundaryLine(body, boundaryStart, boundaryEnd, openingBoundaryLine)) {
      normalizedChunks.push(body.subarray(boundaryStart));
      return changed ? concatUint8Arrays(...normalizedChunks) : body;
    }

    if (lineEnd === -1) {
      return body;
    }

    const headerStart = lineEnd + CRLF_BYTES.length;
    const headerEnd = indexOfSequence(body, HEADER_TERMINATOR_BYTES, headerStart);

    if (headerEnd === -1) {
      return body;
    }

    const headerBytes = body.subarray(headerStart, headerEnd);
    const normalizedHeaderBytes = normalizeHeaderBlock(headerBytes);

    if (normalizedHeaderBytes !== headerBytes) {
      changed = true;
    }

    normalizedChunks.push(body.subarray(boundaryStart, headerStart));
    normalizedChunks.push(normalizedHeaderBytes);
    normalizedChunks.push(HEADER_TERMINATOR_BYTES);

    const contentStart = headerEnd + HEADER_TERMINATOR_BYTES.length;
    const nextBoundaryMarker = findNextBoundaryMarker(body, openingBoundaryLine, contentStart);

    if (nextBoundaryMarker === -1) {
      return body;
    }

    normalizedChunks.push(body.subarray(contentStart, nextBoundaryMarker + CRLF_BYTES.length));
    boundaryStart = nextBoundaryMarker + CRLF_BYTES.length;
  }

  return changed ? concatUint8Arrays(...normalizedChunks) : body;
}

export function normalizeMultipartProxyBody(headers: Headers, body: Buffer): Buffer {
  const contentType = headers.get('content-type') || '';

  if (!/multipart\/form-data/i.test(contentType)) {
    return body;
  }

  return Buffer.from(normalizeDevMultipartFormDataBody(body));
}
