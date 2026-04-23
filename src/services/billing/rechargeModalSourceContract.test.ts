import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('recharge modal keeps a bill-first manual-proof flow without payment sidecar polling', () => {
  const source = readSource('src/components/modals/RechargeModal.tsx');

  assert.match(source, /from '\.\.\/\.\.\/services\/billing\/rechargeSubmissionService';/);
  assert.match(source, /await createRechargeBill\(/);
  assert.match(source, /await submitRechargeProof\(/);
  assert.match(source, /await refreshBilling\(\{ includeTransactions: true \}\);/);
  assert.match(source, /Create bill/);
  assert.match(source, /Submit payment proof/);
  assert.match(source, /submissionId/);
  assert.match(source, /billNumber/);
  assert.match(source, /estimatedCredits/);
  assert.match(source, /qrDisplay/);
  assert.match(source, /transferReferenceLast4/);
  assert.match(source, /statusLabel/);
  assert.doesNotMatch(source, /paymentSidecarClient/);
  assert.doesNotMatch(source, /createPaymentOrder/);
  assert.doesNotMatch(source, /getPaymentOrderStatus/);
  assert.doesNotMatch(source, /QRCodeCanvas/);
  assert.doesNotMatch(source, /setTimeout\(/);
  assert.doesNotMatch(source, /\bbill_created\b/);
  assert.doesNotMatch(source, /\bproof_submitted\b/);
});

test('recharge modal restores channel-themed visual treatment for Alipay, WeChat, and international flows', () => {
  const source = readSource('src/components/modals/RechargeModal.tsx');

  assert.match(source, /useTheme/);
  assert.match(source, /selectedThemeChannel/);
  assert.match(source, /const theme = useMemo/);
  assert.match(source, /const palette = useMemo/);
  assert.match(source, /#10b981/);
  assert.match(source, /#f59e0b/);
  assert.match(source, /background: selected \? theme\.gradient : 'transparent'/);
  assert.match(source, /boxShadow: selected \? theme\.shadow : 'none'/);
});

test('recharge modal avoids hard-coded white text on light-mode surfaces', () => {
  const source = readSource('src/components/modals/RechargeModal.tsx');

  assert.doesNotMatch(source, /color:\s*selected \? theme\.text : '#ffffff'/);
  assert.doesNotMatch(source, /className="w-full rounded-2xl px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"/);
  assert.doesNotMatch(source, /className="w-full rounded-2xl px-4 py-3 text-sm uppercase text-white outline-none"/);
});

test('recharge modal keeps the legacy single-column payment sheet framing while using the current bill-first flow', () => {
  const source = readSource('src/components/modals/RechargeModal.tsx');

  assert.match(source, /mobile-overlay-safe items-end px-2/);
  assert.match(source, /ios-mobile-sheet mobile-sheet-viewport/);
  assert.match(source, /mobile-sheet-header-safe/);
  assert.match(source, /mobile-sheet-scroll/);
  assert.match(source, /import alipayIcon from '\.\.\/\.\.\/assets\/payment\/alipay\.png';/);
  assert.match(source, /import wechatIcon from '\.\.\/\.\.\/assets\/payment\/wechat\.png';/);
  assert.match(source, /import cardIcon from '\.\.\/\.\.\/assets\/payment\/card\.png';/);
  assert.doesNotMatch(source, /<aside/);
  assert.doesNotMatch(source, /lg:grid-cols-\[minmax\(0,1fr\)_260px\]/);
});

test('recharge modal renders the bill summary as inline reference cards instead of a sidebar shell', () => {
  const source = readSource('src/components/modals/RechargeModal.tsx');

  assert.match(source, /getChannelArtwork\(displayChannelConfig\?\.channel\)/);
  assert.match(source, /getChannelSupportText\(displayChannelConfig\?\.channel\)/);
});

test('recharge modal hides code-flavored field labels from the visible bill summary UI', () => {
  const source = readSource('src/components/modals/RechargeModal.tsx');

  assert.doesNotMatch(source, />submissionId</);
  assert.doesNotMatch(source, />billNumber</);
  assert.doesNotMatch(source, />estimatedCredits</);
  assert.doesNotMatch(source, />transferReferenceLast4</);
  assert.doesNotMatch(source, />qrDisplay</);
});

test('recharge modal keeps the tighter legacy desktop shell width instead of expanding into a settings-sized panel', () => {
  const source = readSource('src/components/modals/RechargeModal.tsx');

  assert.match(source, /max-w-\[480px\]/);
  assert.doesNotMatch(source, /max-w-\[520px\]/);
});

test('recharge modal keeps the secondary regeneration action behind an existing bill and avoids redundant utility shadow styling', () => {
  const source = readSource('src/components/modals/RechargeModal.tsx');

  assert.match(source, /\{billSnapshot \? \(\s*<button[\s\S]*Create bill again/);
  assert.doesNotMatch(source, /shadow-xl/);
});

test('recharge modal keeps the pre-bill reference area as a low-emphasis dashed placeholder instead of a full summary card', () => {
  const source = readSource('src/components/modals/RechargeModal.tsx');

  assert.match(
    source,
    /\) : \(\s*<div\s*className="rounded-xl border border-dashed px-4 py-3 text-xs"[\s\S]*Bill reference/,
  );
});
