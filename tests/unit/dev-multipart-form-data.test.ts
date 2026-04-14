import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeDevMultipartFormDataBody } from '../../src/utils/devMultipartFormData.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const boundary = '----codex-dev-multipart-boundary';
const payloadBytes = new Uint8Array([
  0x00,
  0xff,
  0x80,
  0xc3,
  0x28,
  0x61,
  0x0d,
  0x0a,
  0x42,
]);

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

function buildMultipartBody(dispositionLine: string): Uint8Array {
  return concatUint8Arrays(
    encoder.encode(`--${boundary}\r\n${dispositionLine}\r\nContent-Type: application/octet-stream\r\n\r\n`),
    payloadBytes,
    encoder.encode(`\r\n--${boundary}--\r\n`),
  );
}

function buildMultipartRequest(body: Uint8Array): Request {
  return new Request('https://example.test/upload', {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
}

function findHeaderTerminatorOffset(body: Uint8Array): number {
  for (let index = 0; index <= body.length - 4; index += 1) {
    if (
      body[index] === 0x0d &&
      body[index + 1] === 0x0a &&
      body[index + 2] === 0x0d &&
      body[index + 3] === 0x0a
    ) {
      return index;
    }
  }

  throw new Error('Expected multipart header terminator.');
}

test('normalizes .NET-style multipart headers without touching payload bytes', async () => {
  const rawBody = buildMultipartBody(
    "Content-Disposition: form-data; name=file; filename=ecommerce-analysis-smoke.md; filename*=utf-8''ecommerce-analysis-smoke.md",
  );

  await assert.rejects(
    buildMultipartRequest(rawBody).formData(),
    /Failed to parse body as FormData\./,
  );

  const normalizedBody = normalizeDevMultipartFormDataBody(rawBody);
  const rawHeaderTerminator = findHeaderTerminatorOffset(rawBody);
  const normalizedHeaderTerminator = findHeaderTerminatorOffset(normalizedBody);
  const normalizedHeaderText = decoder.decode(
    normalizedBody.subarray(0, normalizedHeaderTerminator),
  );

  assert.match(
    normalizedHeaderText,
    /Content-Disposition: form-data; name="file"; filename="ecommerce-analysis-smoke\.md"/,
  );
  assert.doesNotMatch(normalizedHeaderText, /filename\*=/);
  assert.deepEqual(
    Array.from(normalizedBody.subarray(normalizedHeaderTerminator + 4)),
    Array.from(rawBody.subarray(rawHeaderTerminator + 4)),
  );

  const formData = await buildMultipartRequest(normalizedBody).formData();
  const file = formData.get('file');

  assert(file instanceof File);
  assert.equal(file.name, 'ecommerce-analysis-smoke.md');
  assert.equal(file.type, 'application/octet-stream');
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), payloadBytes);
});
