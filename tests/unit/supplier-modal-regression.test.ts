import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('SupplierModal keeps edit mode isolated from create drafts and never persists secrets in draft storage', () => {
  const source = readSource('src/components/api/SupplierModal.tsx');

  assert.match(source, /const sanitizeDraftFormData = \(formData: SupplierDraftFormData\): SupplierDraftFormData => \(\{/);
  assert.match(source, /apiKey: '',/);
  assert.match(source, /systemToken: '',/);
  assert.match(source, /formData: sanitizeDraftFormData\(formData\),/);
  assert.match(source, /window\.localStorage\.setItem\(SUPPLIER_DRAFT_STORAGE_KEY, JSON\.stringify\(payload\)\);/);
  assert.match(source, /const persistDraft = useCallback\([\s\S]*?if \(!isOpen \|\| editSupplier \|\| !isDraftReady\) return;/);
  assert.match(source, /if \(editSupplier\) \{\s*setIsDraftReady\(false\);[\s\S]*?setFormData\(\{\s*name: editSupplier\.name,[\s\S]*?apiKey: editSupplier\.apiKey,[\s\S]*?systemToken: editSupplier\.systemToken \|\| '',[\s\S]*?\}\);[\s\S]*?setFetchedModels\(editSupplier\.models\.map/);
  assert.match(source, /} else \{\s*const draft = loadSupplierDraft\(\);[\s\S]*?setIsDraftReady\(true\);\s*\}/);
  assert.match(source, /useLayoutEffect\(\(\) => \{\s*if \(!isOpen \|\| editSupplier \|\| !isDraftReady\) return;\s*saveSupplierDraft\(formData, fetchedModels, tokenValid\);/);
  assert.match(source, /if \(editSupplier\) \{\s*supplierService\.update\(editSupplier\.id, data\);[\s\S]*?\} else \{\s*supplierService\.create\(data\);[\s\S]*?clearSupplierDraft\(\);[\s\S]*?setFormData\(createDefaultFormData\(\)\);[\s\S]*?setFetchedModels\(null\);[\s\S]*?setTokenValid\(null\);/);
});
