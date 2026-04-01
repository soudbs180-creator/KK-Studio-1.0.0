import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('prompt bar keeps footer wrapping while allowing full desktop control labels', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const footerSource = readSource('src/components/layout/prompt-bar/PromptBarFooterDesktop.tsx');

  assert.match(
    footerSource,
    /className="input-bar-footer flex w-full min-w-0 flex-wrap items-center gap-1\.5 px-1 pb-1 pt-0\.5 min-h-\[42px\]"/,
  );
  assert.match(promptBarSource, /className=\{`relative inline-flex \$\{isMobile \? 'row-start-2 min-w-0' : 'min-w-fit flex-shrink-0'\}`\}/);
  assert.match(promptBarSource, /className="relative h-full w-\[58px\]"/);
  assert.match(promptBarSource, /className=\{`flex min-w-0 max-w-full items-center justify-center gap-1 overflow-hidden px-2 h-full rounded-md transition-all text-\[11px\] font-medium \$\{config\.enableGrounding/);
  assert.match(promptBarSource, /className=\{`flex min-w-0 max-w-full items-center justify-center gap-1 overflow-hidden px-2 h-full rounded-md transition-all text-\[11px\] font-medium \$\{config\.enableImageSearch/);
  assert.match(promptBarSource, /<span className="[^"]*whitespace-nowrap[^"]*">\{config\.aspectRatio === AspectRatio\.AUTO \? [^:]+ : config\.aspectRatio\} [^<]+ \{config\.imageSize\}<\/span>/);
  assert.match(promptBarSource, /enableGrounding[\s\S]*<span className="min-w-0 truncate whitespace-nowrap">/);
  assert.match(promptBarSource, /enableImageSearch[\s\S]*<span className="min-w-0 truncate whitespace-nowrap">/);
  assert.match(promptBarSource, /className="group relative flex h-10 max-w-full min-w-0 shrink items-center gap-2 rounded-full pl-3\.5 pr-1/);
  assert.match(promptBarSource, /group relative flex h-10 max-w-full min-w-0 shrink flex-row items-center whitespace-nowrap rounded-full px-1 py-1 overflow-hidden/);
});
