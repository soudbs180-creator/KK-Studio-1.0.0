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

async function buildEnglishAliasedWorkbook(options: {
  mainSheetName?: string;
  aPlusSheetName?: string;
} = {}): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const mainSheetName = options.mainSheetName || 'Main Images';
  const aPlusSheetName = options.aPlusSheetName || 'A Plus Modules';

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${mainSheetName}" sheetId="1" r:id="rId1" />
    <sheet name="${aPlusSheetName}" sheetId="2" r:id="rId2" />
  </sheets>
</workbook>`,
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships>
  <Relationship Id="rId1" Target="/xl/worksheets/sheet1.xml" />
  <Relationship Id="rId2" Target="worksheets/sheet2.xml" />
</Relationships>`,
  );

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<worksheet>
  <sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>Project Name</t></is></c><c r="B1" t="inlineStr"><is><t>Portable Blender Launch</t></is></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>Product Name</t></is></c><c r="B2" t="inlineStr"><is><t>Portable Blender</t></is></c></row>
    <row r="4">
      <c r="A4" t="inlineStr"><is><t>No.</t></is></c>
      <c r="B4" t="inlineStr"><is><t>Image Type</t></is></c>
      <c r="C4" t="inlineStr"><is><t>Angle</t></is></c>
      <c r="D4" t="inlineStr"><is><t>Theme</t></is></c>
      <c r="E4" t="inlineStr"><is><t>Design Requirements</t></is></c>
      <c r="F4" t="inlineStr"><is><t>Copy</t></is></c>
    </row>
    <row r="5">
      <c r="A5"><v>1</v></c>
      <c r="B5" t="inlineStr"><is><t>Hero</t></is></c>
      <c r="C5" t="inlineStr"><is><t>front view</t></is></c>
      <c r="D5" t="inlineStr"><is><t>fresh kitchen</t></is></c>
      <c r="E5" t="inlineStr"><is><t>Show bottle scale and fruit splash</t></is></c>
      <c r="F5" t="inlineStr"><is><t>Blend anywhere</t></is></c>
    </row>
  </sheetData>
</worksheet>`,
  );

  zip.file(
    'xl/worksheets/sheet2.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<worksheet>
  <sheetData>
    <row r="3">
      <c r="A3" t="inlineStr"><is><t>Module</t></is></c>
      <c r="B3" t="inlineStr"><is><t>Type</t></is></c>
      <c r="C3" t="inlineStr"><is><t>Size</t></is></c>
      <c r="D3" t="inlineStr"><is><t>Angle</t></is></c>
      <c r="E3" t="inlineStr"><is><t>Design Brief</t></is></c>
      <c r="F3" t="inlineStr"><is><t>Selling Points</t></is></c>
      <c r="G3" t="inlineStr"><is><t>Headline</t></is></c>
    </row>
    <row r="4">
      <c r="A4" t="inlineStr"><is><t>Module 1</t></is></c>
      <c r="B4" t="inlineStr"><is><t>Feature banner</t></is></c>
      <c r="C4" t="inlineStr"><is><t>970*600</t></is></c>
      <c r="D4" t="inlineStr"><is><t>detail</t></is></c>
      <c r="E4" t="inlineStr"><is><t>Explain USB charging and compact storage</t></is></c>
      <c r="F4" t="inlineStr"><is><t>portable, easy clean</t></is></c>
      <c r="G4" t="inlineStr"><is><t>Power in your bag</t></is></c>
    </row>
  </sheetData>
</worksheet>`,
  );

  return zip.generateAsync({ type: 'arraybuffer' });
}

async function buildSupplierAPlusWorkbook(): Promise<ArrayBuffer> {
  const zip = new JSZip();

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="A+" sheetId="1" r:id="rId1" />
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
<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>
    <row r="1"><c r="B1" t="inlineStr"><is><t>参考链接</t></is></c><c r="D1" t="inlineStr"><is><t>https://example.com/product</t></is></c></row>
    <row r="3">
      <c r="B3" t="inlineStr"><is><t>序号</t></is></c>
      <c r="C3" t="inlineStr"><is><t>A+模块</t></is></c>
      <c r="D3" t="inlineStr"><is><t>图片尺寸</t></is></c>
      <c r="E3" t="inlineStr"><is><t>图片内容</t></is></c>
      <c r="F3" t="inlineStr"><is><t>图片要求</t></is></c>
      <c r="G3" t="inlineStr"><is><t>文案</t></is></c>
      <c r="H3" t="inlineStr"><is><t>参考</t></is></c>
      <c r="I3" t="inlineStr"><is><t>参考图1</t></is></c>
    </row>
    <row r="4">
      <c r="B4"><v>1</v></c>
      <c r="C4" t="inlineStr"><is><t>高级完整图片</t></is></c>
      <c r="D4" t="inlineStr"><is><t>1464*600</t></is></c>
      <c r="E4" t="inlineStr"><is><t>一张长图切图</t></is></c>
      <c r="F4" t="inlineStr"><is><t>背景换成宠物和婴儿在客厅玩耍，无叶风扇吹出柔和风效。</t></is></c>
      <c r="G4" t="inlineStr"><is><t>MEPTY&#10;Embrace Safe, All-Day Cooling Comfort</t></is></c>
      <c r="H4" t="inlineStr"><is><t>风格参考图1</t></is></c>
    </row>
    <row r="5"><c r="B5" t="inlineStr"><is><t>600*450</t></is></c></row>
  </sheetData>
  <drawing r:id="rId9" />
</worksheet>`,
  );

  zip.file(
    'xl/worksheets/_rels/sheet1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId9" Target="../drawings/drawing1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" />
</Relationships>`,
  );

  zip.file(
    'xl/drawings/drawing1.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>8</xdr:col><xdr:row>3</xdr:row></xdr:from>
    <xdr:to><xdr:col>10</xdr:col><xdr:row>8</xdr:row></xdr:to>
    <xdr:pic>
      <xdr:nvPicPr><xdr:cNvPr id="1" name="APlus Supplier Reference" /></xdr:nvPicPr>
      <xdr:blipFill><a:blip r:embed="rId1" /></xdr:blipFill>
    </xdr:pic>
  </xdr:twoCellAnchor>
</xdr:wsDr>`,
  );

  zip.file(
    'xl/drawings/_rels/drawing1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Target="../media/supplier-aplus-reference.png" />
</Relationships>`,
  );

  zip.file('xl/media/supplier-aplus-reference.png', TINY_PNG_BASE64, { base64: true });

  return zip.generateAsync({ type: 'arraybuffer' });
}

async function buildFloatingDrawingWorkbook(options: {
  reverseMainAnchorOrder?: boolean;
  mainDesignRequirements?: string;
} = {}): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const mainDesignRequirements = options.mainDesignRequirements
    || '参考右图生成一张类似图片，保留夜晚卧室氛围。';
  const leftMainAnchorXml = `  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>7</xdr:col><xdr:row>9</xdr:row></xdr:from>
    <xdr:to><xdr:col>10</xdr:col><xdr:row>16</xdr:row></xdr:to>
    <xdr:pic>
      <xdr:nvPicPr><xdr:cNvPr id="1" name="Main Float Left" /></xdr:nvPicPr>
      <xdr:blipFill><a:blip r:embed="rId1" /></xdr:blipFill>
    </xdr:pic>
  </xdr:twoCellAnchor>`;
  const rightMainAnchorXml = `  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>8</xdr:col><xdr:row>9</xdr:row></xdr:from>
    <xdr:to><xdr:col>11</xdr:col><xdr:row>16</xdr:row></xdr:to>
    <xdr:pic>
      <xdr:nvPicPr><xdr:cNvPr id="2" name="Main Float Right" /></xdr:nvPicPr>
      <xdr:blipFill><a:blip r:embed="rId2" /></xdr:blipFill>
    </xdr:pic>
  </xdr:twoCellAnchor>`;
  const mainDrawingAnchors = options.reverseMainAnchorOrder
    ? `${rightMainAnchorXml}
${leftMainAnchorXml}`
    : `${leftMainAnchorXml}
${rightMainAnchorXml}`;

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
<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>
    <row r="2"><c r="A2" t="inlineStr"><is><t>需求名称</t></is></c><c r="D2" t="inlineStr"><is><t>浮动主图需求</t></is></c></row>
    <row r="3"><c r="A3" t="inlineStr"><is><t>产品名称</t></is></c><c r="D3" t="inlineStr"><is><t>除湿机</t></is></c></row>
    <row r="4"><c r="A4" t="inlineStr"><is><t>需求尺寸</t></is></c><c r="D4" t="inlineStr"><is><t>2000*2000</t></is></c></row>
    <row r="10">
      <c r="A10" t="inlineStr"><is><t>类型</t></is></c>
      <c r="B10" t="inlineStr"><is><t>角度</t></is></c>
      <c r="C10" t="inlineStr"><is><t>卖点</t></is></c>
      <c r="D10" t="inlineStr"><is><t>设计要求</t></is></c>
      <c r="E10" t="inlineStr"><is><t>文案（中文）</t></is></c>
      <c r="F10" t="inlineStr"><is><t>文案（英文）</t></is></c>
    </row>
    <row r="11">
      <c r="A11" t="inlineStr"><is><t>场景图</t></is></c>
      <c r="B11" t="inlineStr"><is><t>侧面/正面</t></is></c>
      <c r="C11" t="inlineStr"><is><t>三种模式</t></is></c>
      <c r="D11" t="inlineStr"><is><t>${mainDesignRequirements}</t></is></c>
      <c r="E11" t="inlineStr"><is><t>满足所有除湿需求</t></is></c>
      <c r="F11" t="inlineStr"><is><t>Meet all your dehumidifying needs</t></is></c>
    </row>
  </sheetData>
  <drawing r:id="rId9" />
</worksheet>`,
  );

  zip.file(
    'xl/worksheets/_rels/sheet1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId9" Target="../drawings/drawing1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" />
</Relationships>`,
  );

  zip.file(
    'xl/worksheets/sheet2.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>
    <row r="2"><c r="A2" t="inlineStr"><is><t>需求名称</t></is></c><c r="E2" t="inlineStr"><is><t>浮动 A+ 需求</t></is></c></row>
    <row r="3"><c r="A3" t="inlineStr"><is><t>产品名称</t></is></c><c r="E3" t="inlineStr"><is><t>除湿机</t></is></c></row>
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
      <c r="B9" t="inlineStr"><is><t>EBC 首图</t></is></c>
      <c r="C9" t="inlineStr"><is><t>970*600</t></is></c>
      <c r="D9" t="inlineStr"><is><t>正面</t></is></c>
      <c r="E9" t="inlineStr"><is><t>参考图展示 6 个排版，融入卧室背景。</t></is></c>
      <c r="F9" t="inlineStr"><is><t>静音睡眠</t></is></c>
      <c r="G9" t="inlineStr"><is><t>Peaceful rest at night</t></is></c>
    </row>
  </sheetData>
  <drawing r:id="rId5" />
</worksheet>`,
  );

  zip.file(
    'xl/worksheets/_rels/sheet2.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId5" Target="../drawings/drawing2.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" />
</Relationships>`,
  );

  zip.file(
    'xl/drawings/drawing1.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${mainDrawingAnchors}
</xdr:wsDr>`,
  );

  zip.file(
    'xl/drawings/_rels/drawing1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Target="../media/float-main-left.png" />
  <Relationship Id="rId2" Target="../media/float-main-right.png" />
</Relationships>`,
  );

  zip.file(
    'xl/drawings/drawing2.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>7</xdr:col><xdr:row>7</xdr:row></xdr:from>
    <xdr:to><xdr:col>10</xdr:col><xdr:row>13</xdr:row></xdr:to>
    <xdr:pic>
      <xdr:nvPicPr><xdr:cNvPr id="1" name="APlus Float 1" /></xdr:nvPicPr>
      <xdr:blipFill><a:blip r:embed="rId1" /></xdr:blipFill>
    </xdr:pic>
  </xdr:twoCellAnchor>
</xdr:wsDr>`,
  );

  zip.file(
    'xl/drawings/_rels/drawing2.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Target="../media/float-aplus-1.png" />
</Relationships>`,
  );

  zip.file('xl/media/float-main-left.png', TINY_PNG_BASE64, { base64: true });
  zip.file('xl/media/float-main-right.png', TINY_PNG_BASE64, { base64: true });
  zip.file('xl/media/float-aplus-1.png', TINY_PNG_BASE64, { base64: true });

  return zip.generateAsync({ type: 'arraybuffer' });
}

async function buildFloatingBetweenRowsWorkbook(): Promise<ArrayBuffer> {
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
<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>
    <row r="2"><c r="A2" t="inlineStr"><is><t>需求名称</t></is></c><c r="D2" t="inlineStr"><is><t>跨行浮动主图需求</t></is></c></row>
    <row r="3"><c r="A3" t="inlineStr"><is><t>产品名称</t></is></c><c r="D3" t="inlineStr"><is><t>净化器</t></is></c></row>
    <row r="10">
      <c r="A10" t="inlineStr"><is><t>类型</t></is></c>
      <c r="B10" t="inlineStr"><is><t>角度</t></is></c>
      <c r="C10" t="inlineStr"><is><t>卖点</t></is></c>
      <c r="D10" t="inlineStr"><is><t>设计要求</t></is></c>
      <c r="E10" t="inlineStr"><is><t>文案</t></is></c>
    </row>
    <row r="11">
      <c r="A11" t="inlineStr"><is><t>主场景</t></is></c>
      <c r="B11" t="inlineStr"><is><t>正面</t></is></c>
      <c r="C11" t="inlineStr"><is><t>静音</t></is></c>
      <c r="D11" t="inlineStr"><is><t>参考图展示夜间卧室氛围。</t></is></c>
      <c r="E11" t="inlineStr"><is><t>Night mode</t></is></c>
    </row>
    <row r="13">
      <c r="A13" t="inlineStr"><is><t>细节图</t></is></c>
      <c r="B13" t="inlineStr"><is><t>侧面</t></is></c>
      <c r="C13" t="inlineStr"><is><t>滤网结构</t></is></c>
      <c r="D13" t="inlineStr"><is><t>突出滤网拆装细节。</t></is></c>
      <c r="E13" t="inlineStr"><is><t>Easy filter access</t></is></c>
    </row>
  </sheetData>
  <drawing r:id="rId9" />
</worksheet>`,
  );

  zip.file(
    'xl/worksheets/_rels/sheet1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId9" Target="../drawings/drawing1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" />
</Relationships>`,
  );

  zip.file(
    'xl/drawings/drawing1.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>7</xdr:col><xdr:row>11</xdr:row></xdr:from>
    <xdr:to><xdr:col>10</xdr:col><xdr:row>17</xdr:row></xdr:to>
    <xdr:pic>
      <xdr:nvPicPr><xdr:cNvPr id="1" name="Between Rows" /></xdr:nvPicPr>
      <xdr:blipFill><a:blip r:embed="rId1" /></xdr:blipFill>
    </xdr:pic>
  </xdr:twoCellAnchor>
</xdr:wsDr>`,
  );

  zip.file(
    'xl/drawings/_rels/drawing1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Target="../media/between-rows.png" />
</Relationships>`,
  );

  zip.file('xl/media/between-rows.png', TINY_PNG_BASE64, { base64: true });

  return zip.generateAsync({ type: 'arraybuffer' });
}

async function buildFloatingSpacerRowsWorkbook(): Promise<ArrayBuffer> {
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
<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>
    <row r="2"><c r="A2" t="inlineStr"><is><t>需求名称</t></is></c><c r="D2" t="inlineStr"><is><t>隔行浮动主图需求</t></is></c></row>
    <row r="3"><c r="A3" t="inlineStr"><is><t>产品名称</t></is></c><c r="D3" t="inlineStr"><is><t>空气炸锅</t></is></c></row>
    <row r="10">
      <c r="A10" t="inlineStr"><is><t>类型</t></is></c>
      <c r="B10" t="inlineStr"><is><t>角度</t></is></c>
      <c r="C10" t="inlineStr"><is><t>卖点</t></is></c>
      <c r="D10" t="inlineStr"><is><t>设计要求</t></is></c>
      <c r="E10" t="inlineStr"><is><t>文案</t></is></c>
    </row>
    <row r="11">
      <c r="A11" t="inlineStr"><is><t>蒸烤一体主图</t></is></c>
      <c r="B11" t="inlineStr"><is><t>正面</t></is></c>
      <c r="C11" t="inlineStr"><is><t>大容量</t></is></c>
      <c r="D11" t="inlineStr"><is><t>参考图突出机身正面与厨房场景。</t></is></c>
      <c r="E11" t="inlineStr"><is><t>Large Capacity</t></is></c>
    </row>
    <row r="15">
      <c r="A15" t="inlineStr"><is><t>配件细节图</t></is></c>
      <c r="B15" t="inlineStr"><is><t>俯视</t></is></c>
      <c r="C15" t="inlineStr"><is><t>炸篮结构</t></is></c>
      <c r="D15" t="inlineStr"><is><t>突出炸篮细节和拆洗方式。</t></is></c>
      <c r="E15" t="inlineStr"><is><t>Easy Clean Basket</t></is></c>
    </row>
  </sheetData>
  <drawing r:id="rId9" />
</worksheet>`,
  );

  zip.file(
    'xl/worksheets/_rels/sheet1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId9" Target="../drawings/drawing1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" />
</Relationships>`,
  );

  zip.file(
    'xl/drawings/drawing1.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>7</xdr:col><xdr:row>13</xdr:row></xdr:from>
    <xdr:to><xdr:col>10</xdr:col><xdr:row>19</xdr:row></xdr:to>
    <xdr:pic>
      <xdr:nvPicPr><xdr:cNvPr id="1" name="Spacer Rows" /></xdr:nvPicPr>
      <xdr:blipFill><a:blip r:embed="rId1" /></xdr:blipFill>
    </xdr:pic>
  </xdr:twoCellAnchor>
</xdr:wsDr>`,
  );

  zip.file(
    'xl/drawings/_rels/drawing1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Target="../media/spacer-rows.png" />
</Relationships>`,
  );

  zip.file('xl/media/spacer-rows.png', TINY_PNG_BASE64, { base64: true });

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

  test('normalizes English sheet aliases and flexible headers from alternate supplier workbooks', async () => {
    const workbook = await buildEnglishAliasedWorkbook();
    const parsed = await parseOpenXmlWorkbook(workbook, 'english-aliases.xlsx');
    const analysis = normalizeEcommerceAnalysis(parsed, 'gemini-3.1-flash-image-preview');

    assert.deepEqual(parsed.sheets.map((sheet) => sheet.name), ['Main Images', 'A Plus Modules']);
    assert.equal(analysis.projectMeta.projectName, 'Portable Blender Launch');
    assert.equal(analysis.projectMeta.productName, 'Portable Blender');
    assert.equal(analysis.mainImageItems.length, 1);
    assert.equal(analysis.aPlusGroup.modules.length, 1);
    assert.equal(analysis.mainImageItems[0].type, 'Hero');
    assert.equal(analysis.mainImageItems[0].copyText, 'Blend anywhere');
    assert.equal(analysis.aPlusGroup.modules[0].moduleName, 'Module 1');
    assert.equal(analysis.aPlusGroup.modules[0].declaredSizeText, '970*600');
  });

  test('detects main and A+ sheets from flexible header schemas when supplier sheet names are generic', async () => {
    const workbook = await buildEnglishAliasedWorkbook({
      mainSheetName: 'Sheet 1',
      aPlusSheetName: 'Supplier Export',
    });
    const parsed = await parseOpenXmlWorkbook(workbook, 'generic-sheets.xlsx');
    const analysis = normalizeEcommerceAnalysis(parsed, 'gemini-3.1-flash-image-preview');

    assert.deepEqual(parsed.sheets.map((sheet) => sheet.name), ['Sheet 1', 'Supplier Export']);
    assert.equal(analysis.mainImageItems.length, 1);
    assert.equal(analysis.aPlusGroup.modules.length, 1);
    assert.equal(analysis.mainImageItems[0].designRequirements, 'Show bottle scale and fruit splash');
    assert.equal(analysis.aPlusGroup.modules[0].designRequirements, 'Explain USB charging and compact storage');
  });

  test('normalizes supplier A+ tables with sequence, content, requirement, copy, and reference columns', async () => {
    const workbook = await buildSupplierAPlusWorkbook();
    const parsed = await parseOpenXmlWorkbook(workbook, 'supplier-aplus.xlsx');
    const analysis = normalizeEcommerceAnalysis(parsed, 'gemini-3.1-flash-image-preview');

    assert.equal(parsed.mediaAssets.length, 1);
    assert.equal(parsed.mediaAssets[0].anchorCellRef, 'I4');
    assert.equal(analysis.aPlusGroup.modules.length, 1);

    const module = analysis.aPlusGroup.modules[0];
    assert.equal(module.moduleName, '高级完整图片');
    assert.equal(module.type, '一张长图切图');
    assert.equal(module.declaredSizeText, '1464*600');
    assert.equal(module.angle, '');
    assert.equal(module.designRequirements, '背景换成宠物和婴儿在客厅玩耍，无叶风扇吹出柔和风效。');
    assert.equal(module.copyText, 'MEPTY\nEmbrace Safe, All-Day Cooling Comfort');
    assert.deepEqual(module.referenceAssetIds, ['supplier-aplus-reference.png-A+-I4']);
    assert(module.referenceMentions[0].mentionTokens.includes('参考图1'));
  });

  test('parses floating drawing images and main rows without sequence numbers', async () => {
    const workbook = await buildFloatingDrawingWorkbook();
    const parsed = await parseOpenXmlWorkbook(workbook, 'floating.xlsx');
    const analysis = normalizeEcommerceAnalysis(parsed, 'gemini-3.1-flash-image-preview');

    assert.equal(parsed.mediaAssets.length, 3);
    assert.equal(analysis.mainImageItems.length, 1);
    assert.equal(analysis.aPlusGroup.modules.length, 1);

    const mainItem = analysis.mainImageItems[0];
    assert.equal(mainItem.sequence, 1);
    assert.equal(mainItem.type, '场景图');
    assert.equal(mainItem.angle, '侧面/正面');
    assert.equal(mainItem.theme, '三种模式');
    assert.match(mainItem.designRequirements, /夜晚卧室/);
    assert.match(mainItem.copyText, /Meet all your dehumidifying needs/);
    assert.equal(mainItem.referenceAssetIds.length, 2);

    const aPlusModule = analysis.aPlusGroup.modules[0];
    assert.equal(aPlusModule.moduleName, '模块1');
    assert.equal(aPlusModule.referenceAssetIds.length, 1);
    assert.match(aPlusModule.designRequirements, /卧室背景/);
  });

  test('keeps floating references in left-to-right order when drawing xml order is reversed', async () => {
    const workbook = await buildFloatingDrawingWorkbook({
      reverseMainAnchorOrder: true,
      mainDesignRequirements: '参考左图做白底图，参考右图做场景图。',
    });
    const parsed = await parseOpenXmlWorkbook(workbook, 'floating-reversed.xlsx');
    const analysis = normalizeEcommerceAnalysis(parsed, 'gemini-3.1-flash-image-preview');

    const mainAssets = parsed.mediaAssets.filter((asset) => asset.sheetName === '主图');
    assert.deepEqual(mainAssets.map((asset) => asset.fileName), [
      'float-main-left.png',
      'float-main-right.png',
    ]);
    assert.deepEqual(mainAssets.map((asset) => asset.anchorColRef), ['H', 'I']);

    const mainMentions = analysis.mainImageItems[0].referenceMentions;
    assert.equal(mainMentions.length, 2);
    assert.deepEqual(mainMentions.map((mention) => mention.label), ['参考图1', '参考图2']);
    assert(mainMentions[0].mentionTokens.includes('左边'));
    assert(mainMentions[1].mentionTokens.includes('右边'));
  });

  test('assigns floating references to the preceding row when the anchor sits between content rows', async () => {
    const workbook = await buildFloatingBetweenRowsWorkbook();
    const parsed = await parseOpenXmlWorkbook(workbook, 'floating-between-rows.xlsx');
    const analysis = normalizeEcommerceAnalysis(parsed, 'gemini-3.1-flash-image-preview');

    assert.equal(analysis.mainImageItems.length, 2);
    assert.equal(parsed.mediaAssets[0].anchorCellRef, 'H12');
    assert.deepEqual(
      analysis.mainImageItems.map((item) => item.referenceAssetIds.length),
      [1, 0],
    );
  });

  test('keeps floating references on the preceding populated row even when blank spacer rows make the next row numerically closer', async () => {
    const workbook = await buildFloatingSpacerRowsWorkbook();
    const parsed = await parseOpenXmlWorkbook(workbook, 'floating-spacer-rows.xlsx');
    const analysis = normalizeEcommerceAnalysis(parsed, 'gemini-3.1-flash-image-preview');

    assert.equal(analysis.mainImageItems.length, 2);
    assert.equal(parsed.mediaAssets[0].anchorCellRef, 'H14');
    assert.deepEqual(
      analysis.mainImageItems.map((item) => item.referenceAssetIds.length),
      [1, 0],
    );
  });

  test('dedupes identical review warnings at the analysis and group level', () => {
    const analysis = normalizeEcommerceAnalysis({
      sheets: [],
      mediaAssets: [],
      sourceFileName: 'warnings.xlsx',
      sourceFileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }, 'gemini-3.1-flash-image-preview');

    analysis.mainImageItems = [
      {
        itemId: 'main-1',
        sheet: '主图',
        rowIndex: 1,
        sequence: 1,
        type: '场景图',
        angle: '',
        theme: 'A',
        designRequirements: 'A',
        copyText: '',
        sizePolicy: 'main-default',
        referenceAssetIds: [],
        referenceMentions: [],
        productAssetRequired: true,
        promptDraft: '',
        resolvedPromptPreview: '',
        editableTask: undefined,
        needsReview: true,
        reviewWarnings: ['存在多张参考图，但文本中未检测到明确的编号引用。'],
      },
      {
        itemId: 'main-2',
        sheet: '主图',
        rowIndex: 2,
        sequence: 2,
        type: '场景图',
        angle: '',
        theme: 'B',
        designRequirements: 'B',
        copyText: '',
        sizePolicy: 'main-default',
        referenceAssetIds: [],
        referenceMentions: [],
        productAssetRequired: true,
        promptDraft: '',
        resolvedPromptPreview: '',
        editableTask: undefined,
        needsReview: true,
        reviewWarnings: ['存在多张参考图，但文本中未检测到明确的编号引用。'],
      },
    ];

    analysis.aPlusGroup.modules = [
      {
        moduleId: 'aplus-1',
        sheet: 'A+',
        rowIndex: 3,
        moduleName: '模块1',
        type: '长图',
        declaredSizeText: '1464*600',
        angle: '',
        sellingPoints: '',
        designRequirements: 'C',
        copyText: '',
        sizePolicy: 'desktop-then-mobile',
        referenceAssetIds: [],
        referenceMentions: [],
        productAssetRequired: true,
        promptDraft: '',
        resolvedPromptPreview: '',
        editableTask: undefined,
        needsReview: true,
        reviewWarnings: ['存在多张参考图，但文本中未检测到明确的编号引用。'],
      },
    ];

    const dedupedWarnings = Array.from(new Set([
      ...analysis.mainImageItems.flatMap((item) => item.reviewWarnings),
      ...analysis.aPlusGroup.modules.flatMap((module) => module.reviewWarnings),
    ]));

    assert.deepEqual(dedupedWarnings, ['存在多张参考图，但文本中未检测到明确的编号引用。']);
  });
});
