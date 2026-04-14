import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  isEcommerceRequirementFile,
  routeEcommerceDroppedFiles,
} from '../../src/components/layout/prompt-bar/ecommerceDropRouting.ts';

type DropLikeFile = Pick<File, 'name' | 'type'>;

function createDropFile(name: string, type = ''): DropLikeFile {
  return { name, type };
}

describe('ecommerce drop routing', () => {
  test('treats spreadsheet and document drops as requirement files even without mime types', () => {
    const spreadsheet = createDropFile('需求单.xlsx');
    const markdown = createDropFile('campaign-notes.md', 'text/markdown');
    const productImage = createDropFile('product.png', 'image/png');

    assert.equal(isEcommerceRequirementFile(spreadsheet), true);
    assert.equal(isEcommerceRequirementFile(markdown), true);
    assert.equal(isEcommerceRequirementFile(productImage), false);
  });

  test('routes dropped images into product files before ecommerce analysis is confirmed', () => {
    const route = routeEcommerceDroppedFiles(
      [
        createDropFile('需求单.xlsx'),
        createDropFile('主图1.png', 'image/png'),
        createDropFile('主图2.jpg', 'image/jpeg'),
        createDropFile('archive.zip', 'application/zip'),
      ],
      { analysisConfirmed: false },
    );

    assert.deepEqual(route.requirementFiles.map((file) => file.name), ['需求单.xlsx']);
    assert.deepEqual(route.productFiles.map((file) => file.name), ['主图1.png', '主图2.jpg']);
    assert.deepEqual(route.promptReferenceFiles, []);
    assert.deepEqual(route.ignoredFiles.map((file) => file.name), ['archive.zip']);
  });

  test('routes dropped images into prompt references after ecommerce analysis is confirmed', () => {
    const route = routeEcommerceDroppedFiles(
      [
        createDropFile('更新需求.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        createDropFile('补充参考图.webp', 'image/webp'),
      ],
      { analysisConfirmed: true },
    );

    assert.deepEqual(route.requirementFiles.map((file) => file.name), ['更新需求.docx']);
    assert.deepEqual(route.productFiles, []);
    assert.deepEqual(route.promptReferenceFiles.map((file) => file.name), ['补充参考图.webp']);
    assert.deepEqual(route.ignoredFiles, []);
  });
});
