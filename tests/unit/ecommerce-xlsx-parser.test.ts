import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import JSZip from 'jszip';

import { normalizeEcommerceAnalysis } from '../../src/services/ecommerce/normalize/ecommerceAnalysisNormalizer.ts';
import { parseOpenXmlWorkbook } from '../../src/services/ecommerce/xlsx/openXmlWorkbookParser.ts';

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pTnGoQAAAAASUVORK5CYII=';

async function buildCellImageWorkbook(): Promise<ArrayBuffer> {
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
  <Relationship Id="rId5" Target="cellimages.xml" Type="http://www.wps.cn/officeDocument/2020/cellImage" />
</Relationships>`,
  );

  zip.file(
    'xl/cellimages.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<etc:cellImages xmlns:etc="http://www.wps.cn/officeDocument/2017/etCustomData" xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <etc:cellImage>
    <xdr:nvPicPr><xdr:cNvPr id="1" name="ID_A" /></xdr:nvPicPr>
    <xdr:blipFill><a:blip r:embed="rId1" /></xdr:blipFill>
  </etc:cellImage>
  <etc:cellImage>
    <xdr:nvPicPr><xdr:cNvPr id="2" name="ID_C" /></xdr:nvPicPr>
    <xdr:blipFill><a:blip r:embed="rId3" /></xdr:blipFill>
  </etc:cellImage>
  <etc:cellImage>
    <xdr:nvPicPr><xdr:cNvPr id="3" name="ID_B" /></xdr:nvPicPr>
    <xdr:blipFill><a:blip r:embed="rId2" /></xdr:blipFill>
  </etc:cellImage>
</etc:cellImages>`,
  );

  zip.file(
    'xl/_rels/cellimages.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships>
  <Relationship Id="rId1" Target="media/image1.png" />
  <Relationship Id="rId2" Target="media/image2.png" />
  <Relationship Id="rId3" Target="media/image3.png" />
</Relationships>`,
  );

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<worksheet>
  <sheetData>
    <row r="2"><c r="A2" t="inlineStr"><is><t>需求名称</t></is></c><c r="D2" t="inlineStr"><is><t>410Y主图</t></is></c></row>
    <row r="3"><c r="A3" t="inlineStr"><is><t>产品名称</t></is></c><c r="D3" t="inlineStr"><is><t>410Y</t></is></c></row>
    <row r="4"><c r="A4" t="inlineStr"><is><t>需求尺寸</t></is></c><c r="D4" t="inlineStr"><is><t>1500*2000</t></is></c></row>
    <row r="10">
      <c r="A10" t="inlineStr"><is><t>序号</t></is></c>
      <c r="B10" t="inlineStr"><is><t>类型</t></is></c>
      <c r="C10" t="inlineStr"><is><t>角度</t></is></c>
      <c r="D10" t="inlineStr"><is><t>主题</t></is></c>
      <c r="E10" t="inlineStr"><is><t>设计要求</t></is></c>
      <c r="G10" t="inlineStr"><is><t>文案</t></is></c>
      <c r="H10" t="inlineStr"><is><t>参考案例</t></is></c>
    </row>
    <row r="11">
      <c r="A11"><v>1</v></c>
      <c r="B11" t="inlineStr"><is><t>白底图</t></is></c>
      <c r="C11" t="inlineStr"><is><t>朝右</t></is></c>
      <c r="D11" t="inlineStr"><is><t>产品展示</t></is></c>
      <c r="E11" t="inlineStr"><is><t>参考图1做白底，参考右边做场景</t></is></c>
      <c r="G11" t="inlineStr"><is><t>16.5Gal</t></is></c>
      <c r="H11"><f>_xlfn.DISPIMG("ID_A",1)</f></c>
      <c r="I11"><f>_xlfn.DISPIMG("ID_B",1)</f></c>
    </row>
  </sheetData>
</worksheet>`,
  );

  zip.file(
    'xl/worksheets/sheet2.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<worksheet>
  <sheetData>
    <row r="2"><c r="A2" t="inlineStr"><is><t>需求名称</t></is></c><c r="E2" t="inlineStr"><is><t>410Y-A+需求</t></is></c></row>
    <row r="3"><c r="A3" t="inlineStr"><is><t>产品名称</t></is></c><c r="E3" t="inlineStr"><is><t>410Y</t></is></c></row>
    <row r="8">
      <c r="A8" t="inlineStr"><is><t>模块</t></is></c>
      <c r="B8" t="inlineStr"><is><t>类型</t></is></c>
      <c r="C8" t="inlineStr"><is><t>图片尺寸</t></is></c>
      <c r="D8" t="inlineStr"><is><t>产品角度</t></is></c>
      <c r="E8" t="inlineStr"><is><t>设计要求</t></is></c>
      <c r="F8" t="inlineStr"><is><t>产品卖点</t></is></c>
      <c r="G8" t="inlineStr"><is><t>文案</t></is></c>
      <c r="H8" t="inlineStr"><is><t>参考案例</t></is></c>
    </row>
    <row r="9">
      <c r="A9" t="inlineStr"><is><t>模块1</t></is></c>
      <c r="B9" t="inlineStr"><is><t>EBC首图</t></is></c>
      <c r="C9" t="inlineStr"><is><t>970*600</t></is></c>
      <c r="D9" t="inlineStr"><is><t>朝右</t></is></c>
      <c r="E9" t="inlineStr"><is><t>desktop hero first, then mobile crop</t></is></c>
      <c r="F9" t="inlineStr"><is><t>水箱容量</t></is></c>
      <c r="G9" t="inlineStr"><is><t>Hero Copy</t></is></c>
      <c r="H9"><f>_xlfn.DISPIMG("ID_C",1)</f></c>
    </row>
  </sheetData>
</worksheet>`,
  );

  zip.file('xl/media/image1.png', TINY_PNG_BASE64, { base64: true });
  zip.file('xl/media/image2.png', TINY_PNG_BASE64, { base64: true });
  zip.file('xl/media/image3.png', TINY_PNG_BASE64, { base64: true });

  return zip.generateAsync({ type: 'arraybuffer' });
}

async function buildFallbackWorkbook(): Promise<ArrayBuffer> {
  const zip = new JSZip();

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="主图" sheetId="1" r:id="rId1" />
  </sheets>
</workbook>`,
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships>
  <Relationship Id="rId1" Target="worksheets/sheet1.xml" />
</Relationships>`,
  );

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<worksheet>
  <sheetData>
    <row r="10">
      <c r="A10" t="inlineStr"><is><t>序号</t></is></c>
      <c r="B10" t="inlineStr"><is><t>类型</t></is></c>
      <c r="H10" t="inlineStr"><is><t>参考案例</t></is></c>
    </row>
    <row r="11">
      <c r="A11"><v>1</v></c>
      <c r="B11" t="inlineStr"><is><t>白底图</t></is></c>
      <c r="H11"><f>DISPIMG("ID_A",1)</f></c>
      <c r="I11"><f>DISPIMG("ID_B",1)</f></c>
    </row>
  </sheetData>
</worksheet>`,
  );

  zip.file('xl/media/image1.png', TINY_PNG_BASE64, { base64: true });
  zip.file('xl/media/image2.png', TINY_PNG_BASE64, { base64: true });

  return zip.generateAsync({ type: 'arraybuffer' });
}

describe('ecommerce xlsx parser', () => {
  test('maps WPS cellimages by DISPIMG id instead of media order', async () => {
    const workbook = await buildCellImageWorkbook();
    const parsed = await parseOpenXmlWorkbook(workbook, 'fixture.xlsx');
    const analysis = normalizeEcommerceAnalysis(parsed, 'gemini-3.1-flash-image-preview');

    assert.equal(parsed.sheets.length, 2);
    assert.equal(parsed.mediaAssets.length, 3);
    assert.equal(analysis.projectMeta.projectName, '410Y主图');
    assert.equal(analysis.projectMeta.productName, '410Y');
    assert.equal(analysis.mainImageItems.length, 1);
    assert.equal(analysis.aPlusGroup.modules.length, 1);

    const mainAssets = parsed.mediaAssets.filter((asset) => asset.sheetName === '主图' && asset.rowIndex === 11);
    assert.deepEqual(mainAssets.map((asset) => asset.fileName), ['image1.png', 'image2.png']);
    assert.deepEqual(mainAssets.map((asset) => asset.anchorCellRef), ['H11', 'I11']);

    assert.deepEqual(
      analysis.mainImageItems[0].referenceMentions.map((item) => item.label),
      ['参考图1', '参考图2'],
    );
    assert.equal(analysis.mainImageItems[0].sizePolicy, 'main-default');
    assert.equal(analysis.aPlusGroup.modules[0].sizePolicy, 'sheet-native');
    assert.equal(analysis.aPlusGroup.modules[0].declaredSizeText, '970*600');
  });

  test('falls back to sequential media assignment when no cellimages mapping exists', async () => {
    const workbook = await buildFallbackWorkbook();
    const parsed = await parseOpenXmlWorkbook(workbook, 'fallback.xlsx');

    assert.equal(parsed.mediaAssets.length, 2);
    assert.deepEqual(parsed.mediaAssets.map((asset) => asset.fileName), ['image1.png', 'image2.png']);
    assert.deepEqual(parsed.mediaAssets.map((asset) => asset.anchorCellRef), ['H11', 'I11']);
  });
});
