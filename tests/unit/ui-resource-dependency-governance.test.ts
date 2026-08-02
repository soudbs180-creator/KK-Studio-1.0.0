import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { readSource, workspacePath } from '../support/workspacePaths.js';

function readJson<T>(relativePath: string): T {
  return JSON.parse(readSource(relativePath)) as T;
}

type PackageJson = {
  packageManager?: string;
  workspaces?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

test('web UI static assets have one canonical runtime entry per asset family', () => {
  const rootSource = readSource('apps/web/src/app/root.tsx');
  const rechargeModalSource = readSource('apps/web/src/components/modals/RechargeModal.tsx');

  assert.doesNotMatch(rootSource, /\/src\/__create\/favicon\.png/);
  assert.doesNotMatch(rootSource, /fontawesome\.com/);
  assert.doesNotMatch(rootSource, /token=/);

  assert.match(rechargeModalSource, /assets\/payment\/alipay\.svg/);
  assert.match(rechargeModalSource, /assets\/payment\/card\.svg/);
  assert.match(rechargeModalSource, /assets\/payment\/wechat\.svg/);

  for (const asset of [
    'apps/web/src/assets/payment/alipay.png',
    'apps/web/src/assets/payment/card.png',
    'apps/web/src/assets/payment/wechat.png',
    'apps/web/src/assets/avatars/preset-male-1.svg',
    'apps/web/src/assets/avatars/preset-male-2.svg',
    'apps/web/src/assets/avatars/preset-male-3.svg',
    'apps/web/src/assets/avatars/preset-female-1.svg',
    'apps/web/src/assets/avatars/preset-female-2.svg',
    'apps/web/src/assets/avatars/preset-female-3.svg',
    'apps/web/src/assets/icons/google-gemini.svg',
    'apps/web/src/assets/logo.png',
  ]) {
    assert.equal(existsSync(workspacePath(asset)), false, `${asset} should not remain as an unused UI asset`);
  }
});

test('web workspace uses root npm lockfile and declares local workspace packages explicitly', () => {
  const rootPackage = readJson<PackageJson>('package.json');
  const webPackage = readJson<PackageJson>('apps/web/package.json');

  assert.equal(rootPackage.packageManager, 'npm@11.12.1');
  assert.deepEqual(rootPackage.workspaces, ['packages/*', 'apps/web', 'local-runner']);
  assert.equal(existsSync(workspacePath('package-lock.json')), true);
  assert.equal(existsSync(workspacePath('pnpm-workspace.yaml')), false);
  assert.equal(existsSync(workspacePath('apps/web/package-lock.json')), false);
  assert.equal(existsSync(workspacePath('apps/web/bun.lock')), false);

  assert.equal(webPackage.dependencies?.['@kk/ui'], '*');
  assert.equal(webPackage.dependencies?.['@kk/shared'], '*');
  assert.equal(webPackage.dependencies?.['@nano-banana/api-client'], '*');

  for (const dependency of ['lucide-react', 'motion', 'react', 'react-dom', 'react-router-dom', 'three', 'zustand']) {
    assert.equal(rootPackage.dependencies?.[dependency], undefined, `${dependency} should be owned by apps/web`);
  }
});

test('@kk/ui package validates web React components without owning app runtime dependencies', () => {
  const uiPackage = readJson<PackageJson>('packages/ui/package.json');
  const uiTsconfig = readJson<{ compilerOptions?: Record<string, unknown> }>('packages/ui/tsconfig.json');

  assert.equal(uiPackage.peerDependencies?.react, '^19.2.7');
  assert.equal(uiPackage.peerDependencies?.['react-dom'], '^19.2.7');
  assert.equal(uiPackage.devDependencies?.['@types/react'], '^19.2.17');
  assert.equal(uiPackage.devDependencies?.['@types/react-dom'], '^19.2.3');
  assert.equal(uiPackage.dependencies && Object.keys(uiPackage.dependencies).length, 0);

  assert.deepEqual(uiTsconfig.compilerOptions?.lib, ['ES2022', 'DOM', 'DOM.Iterable']);
  assert.equal(uiTsconfig.compilerOptions?.jsx, 'react-jsx');
  assert.equal(uiTsconfig.compilerOptions?.moduleResolution, 'Bundler');
  assert.equal(uiTsconfig.compilerOptions?.noEmit, true);
});
