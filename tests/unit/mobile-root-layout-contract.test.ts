import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();
const APP_DIR = path.join(ROOT_DIR, 'apps', 'mobile', 'src', 'app');

function readAppFile(name: string): string {
  return readFileSync(path.join(APP_DIR, name), 'utf8');
}

// ---------------------------------------------------------------------------
// 回归守护：apps/mobile/src/app 下曾同时存在 _layout.tsx 与 _layout.jsx。
// Expo/Metro 默认 sourceExts 把 ts/tsx 排在 js/jsx 之前，实际生效的是 .tsx，
// 而当时 .tsx 只是一个 8 行的 <Slot /> 空壳 —— 应用真实运行时因此丢失了
// QueryClientProvider、useAuth 初始化、GestureHandlerRootView、启动屏控制，
// 以及四条业务路由的标题注册（那些内容都写在不生效的 .jsx 里）。
//
// 本机未安装 apps/mobile 依赖（无 expo / react-native），无法对该工程做类型检查，
// 故以源码契约断言守护。
// ---------------------------------------------------------------------------

const ROOT_LAYOUT = readAppFile('_layout.tsx');

test('the effective root layout provides the app-wide providers', () => {
  assert.match(ROOT_LAYOUT, /QueryClientProvider/, '缺少 QueryClientProvider，所有 react-query 调用会抛错');
  assert.match(ROOT_LAYOUT, /GestureHandlerRootView/, '缺少手势根容器，手势交互会失效');
  assert.match(ROOT_LAYOUT, /useAuth/, '缺少鉴权初始化');
  assert.match(ROOT_LAYOUT, /SplashScreen/, '缺少启动屏控制');
});

test('the effective root layout uses a Stack and registers every feature route', () => {
  assert.match(ROOT_LAYOUT, /<Stack\b/, '必须用 Stack 而非 Slot，否则没有栈式导航与标题');

  for (const route of ['index', 'brand-vi', 'skills', 'canvas', 'settings']) {
    assert.match(
      ROOT_LAYOUT,
      new RegExp('name="' + route + '"'),
      `路由 ${route} 未在生效的根布局中注册`
    );
  }
});

test('the effective root layout is not a bare Slot stub', () => {
  // 空壳的特征：只 return <Slot />，没有任何 Provider。
  const isBareStub = /return\s*<Slot\s*\/>/.test(ROOT_LAYOUT) && !/QueryClientProvider/.test(ROOT_LAYOUT);
  assert.equal(isBareStub, false, '生效的根布局不得退化为 <Slot /> 空壳');
});

test('react-query options use the v5 name gcTime, not the removed cacheTime', () => {
  // @tanstack/react-query v5 已把 cacheTime 更名为 gcTime。沿用旧名不会报错，
  // 但配置会被静默忽略并回落到默认值 —— 属于「看起来配了、其实没配」的死配置。
  // 只匹配属性写法，避免误伤注释中对该改动的说明文字。
  assert.doesNotMatch(ROOT_LAYOUT, /^\s*cacheTime\s*:/m, 'cacheTime 在 react-query v5 已移除，会被静默忽略');
  assert.match(ROOT_LAYOUT, /^\s*gcTime\s*:/m);

  const queryCorePkg = path.join(ROOT_DIR, 'node_modules', '@tanstack', 'query-core', 'package.json');
  if (existsSync(queryCorePkg)) {
    const version = JSON.parse(readFileSync(queryCorePkg, 'utf8')).version as string;
    assert.ok(
      Number.parseInt(version.split('.')[0], 10) >= 5,
      `本断言以 react-query v5+ 为前提，实际 ${version}；若降级到 v4 需改回 cacheTime`
    );
  }
});

test('a duplicate root layout, if still present, must not be the one carrying the real content', () => {
  // 允许 _layout.jsx 暂时留存（删除需人工执行），但真实内容必须在生效的 .tsx 里。
  const duplicatePath = path.join(APP_DIR, '_layout.jsx');
  if (!existsSync(duplicatePath)) return;

  const duplicate = readFileSync(duplicatePath, 'utf8');
  const duplicateHasProviders = /QueryClientProvider/.test(duplicate);
  const effectiveHasProviders = /QueryClientProvider/.test(ROOT_LAYOUT);

  assert.ok(
    !duplicateHasProviders || effectiveHasProviders,
    '真实布局内容不得只存在于不生效的 _layout.jsx 中'
  );
});
