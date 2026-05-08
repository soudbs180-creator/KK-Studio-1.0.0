import assert from 'node:assert/strict';
import { test } from 'node:test';

import JSZip from 'jszip';

import { analyzeEcommerceRequirementFile } from '../../src/services/ecommerce/ecommerceAnalysisClient.ts';

async function withFetchStub<T>(
  stub: typeof fetch,
  callback: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stub;

  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function buildSimpleWorkbookFile(): Promise<File> {
  const zip = new JSZip();

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="主图" sheetId="1" r:id="rId1" />
    <sheet name="A+" sheetId="2" r:id="rId2" />
  </sheets>
</workbook>`,
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships>
  <Relationship Id="rId1" Target="worksheets/sheet1.xml" />
  <Relationship Id="rId2" Target="worksheets/sheet2.xml" />
</Relationships>`,
  );

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<worksheet>
  <sheetData>
    <row r="2"><c r="A2" t="inlineStr"><is><t>需求名称</t></is></c><c r="D2" t="inlineStr"><is><t>便携需求</t></is></c></row>
    <row r="3"><c r="A3" t="inlineStr"><is><t>产品名称</t></is></c><c r="D3" t="inlineStr"><is><t>除湿机</t></is></c></row>
    <row r="10">
      <c r="A10" t="inlineStr"><is><t>序号</t></is></c>
      <c r="B10" t="inlineStr"><is><t>类型</t></is></c>
      <c r="C10" t="inlineStr"><is><t>角度</t></is></c>
      <c r="D10" t="inlineStr"><is><t>主题</t></is></c>
      <c r="E10" t="inlineStr"><is><t>设计要求</t></is></c>
      <c r="G10" t="inlineStr"><is><t>文案</t></is></c>
    </row>
    <row r="11">
      <c r="A11"><v>1</v></c>
      <c r="B11" t="inlineStr"><is><t>场景图</t></is></c>
      <c r="C11" t="inlineStr"><is><t>正面</t></is></c>
      <c r="D11" t="inlineStr"><is><t>卧室静音</t></is></c>
      <c r="E11" t="inlineStr"><is><t>夜晚卧室场景，产品保持真实比例</t></is></c>
      <c r="G11" t="inlineStr"><is><t>静音除湿</t></is></c>
    </row>
  </sheetData>
</worksheet>`,
  );

  zip.file(
    'xl/worksheets/sheet2.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<worksheet>
  <sheetData>
    <row r="8">
      <c r="A8" t="inlineStr"><is><t>模块</t></is></c>
      <c r="B8" t="inlineStr"><is><t>类型</t></is></c>
      <c r="C8" t="inlineStr"><is><t>图片尺寸</t></is></c>
      <c r="D8" t="inlineStr"><is><t>产品角度</t></is></c>
      <c r="E8" t="inlineStr"><is><t>设计要求</t></is></c>
      <c r="F8" t="inlineStr"><is><t>产品卖点</t></is></c>
      <c r="G8" t="inlineStr"><is><t>文案</t></is></c>
    </row>
    <row r="9">
      <c r="A9" t="inlineStr"><is><t>模块1</t></is></c>
      <c r="B9" t="inlineStr"><is><t>EBC首图</t></is></c>
      <c r="C9" t="inlineStr"><is><t>970*600</t></is></c>
      <c r="D9" t="inlineStr"><is><t>正面</t></is></c>
      <c r="E9" t="inlineStr"><is><t>突出容量卖点，保持系列氛围</t></is></c>
      <c r="F9" t="inlineStr"><is><t>16.5Gal</t></is></c>
      <c r="G9" t="inlineStr"><is><t>容量升级</t></is></c>
    </row>
  </sheetData>
</worksheet>`,
  );

  const workbook = await zip.generateAsync({ type: 'uint8array' });
  return new File(
    [workbook],
    'portable-fallback.xlsx',
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
}

test('falls back to local text analysis when ecommerce analysis endpoint is unavailable', async () => {
  const file = new File(
    [
      [
        '需求名称：便携需求',
        '产品名称：除湿机',
        '主图',
        '1. 类型：场景图 主题：卧室静音 设计要求：夜晚卧室场景，产品保持真实比例 文案：静音除湿',
        'A+',
        '模块1 类型：EBC首图 图片尺寸：970*600 设计要求：突出容量卖点，保持系列氛围 文案：容量升级',
      ].join('\n'),
    ],
    'portable-fallback.md',
    { type: 'text/markdown' },
  );

  const analysis = await withFetchStub(
    async () => new Response(JSON.stringify({ error: 'portable runtime route is unavailable' }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    }),
    () => analyzeEcommerceRequirementFile(file),
  );

  assert.equal(analysis.projectMeta.projectName, '便携需求');
  assert.equal(analysis.projectMeta.productName, '除湿机');
  assert.equal(analysis.projectMeta.sourceFileType, 'md');
  assert.equal(analysis.mainImageItems.length, 1);
  assert.equal(analysis.aPlusGroup.modules.length, 1);
});

test('falls back to local xlsx analysis when ecommerce analysis endpoint is unavailable', async () => {
  const file = await buildSimpleWorkbookFile();

  const analysis = await withFetchStub(
    async () => new Response(JSON.stringify({ error: 'portable runtime route is unavailable' }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    }),
    () => analyzeEcommerceRequirementFile(file),
  );

  assert.equal(analysis.projectMeta.projectName, '便携需求');
  assert.equal(analysis.projectMeta.productName, '除湿机');
  assert.equal(analysis.projectMeta.sourceFileType, 'xlsx');
  assert.equal(analysis.mainImageItems.length, 1);
  assert.equal(analysis.mainImageItems[0].theme, '卧室静音');
  assert.equal(analysis.aPlusGroup.modules.length, 1);
  assert.equal(analysis.aPlusGroup.modules[0].declaredSizeText, '970*600');
});

test('falls back to local xlsx analysis when static preview returns html instead of json', async () => {
  const file = await buildSimpleWorkbookFile();

  const analysis = await withFetchStub(
    async () => new Response('<!DOCTYPE html><html><body>KK Studio</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }),
    () => analyzeEcommerceRequirementFile(file),
  );

  assert.equal(analysis.projectMeta.projectName, '便携需求');
  assert.equal(analysis.projectMeta.productName, '除湿机');
  assert.equal(analysis.projectMeta.sourceFileType, 'xlsx');
  assert.equal(analysis.mainImageItems.length, 1);
  assert.equal(analysis.aPlusGroup.modules.length, 1);
  assert.equal(analysis.aPlusGroup.modules[0].declaredSizeText, '970*600');
});

test('falls back to local pdf analysis through the nutrient document route when ecommerce analysis endpoint is unavailable', async () => {
  const file = new File(
    [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
    'portable-fallback.pdf',
    { type: 'application/pdf' },
  );

  const requests: string[] = [];
  const analysis = await withFetchStub(
    async (input, init) => {
      const url = String(input);
      requests.push(url);

      if (url === '/api/ecommerce-analysis') {
        return new Response(JSON.stringify({ error: 'portable runtime route is unavailable' }), {
          status: 501,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === '/api/nutrient-document') {
        const request = new Request('http://localhost/api/nutrient-document', init);
        const formData = await request.formData();
        assert.equal(formData.get('operation'), 'extract-text');

        return new Response(
          [
            '需求名称：便携 PDF 需求',
            '产品名称：除湿机',
            '主图',
            '1. 类型：场景图 主题：卧室静音 设计要求：夜晚卧室场景，产品保持真实比例 文案：静音除湿',
          ].join('\n'),
          {
            status: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Content-Disposition': 'attachment; filename="portable-fallback.txt"',
            },
          },
        );
      }

      throw new Error(`Unexpected fetch request: ${url}`);
    },
    () => analyzeEcommerceRequirementFile(file),
  );

  assert.deepEqual(requests, ['/api/ecommerce-analysis', '/api/nutrient-document']);
  assert.equal(analysis.projectMeta.projectName, '便携 PDF 需求');
  assert.equal(analysis.projectMeta.productName, '除湿机');
  assert.equal(analysis.projectMeta.sourceFileType, 'pdf');
  assert.equal(analysis.mainImageItems.length, 1);
});
