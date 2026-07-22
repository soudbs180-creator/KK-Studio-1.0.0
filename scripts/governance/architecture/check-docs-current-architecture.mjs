// scripts/governance/architecture/check-docs-current-architecture.mjs
import fs from 'node:fs';

const DOCUMENT_RULES = [
  {
    path: 'docs/architecture/NEW_ARCHITECTURE_SOURCE_OF_TRUTH.md',
    required: [
      'CanvasSpatialIndex',
      'CanvasMeasurementScheduler',
      'services/api/lib/generation-v3/routeEngine.js',
      '浏览器路由只提供交互投影',
    ],
  },
  {
    path: 'docs/architecture/ROUTE_TOPOLOGY_AND_CONSOLIDATION.md',
    required: [
      'services/api/routes/api.js',
      'services/api/routes/user/auth.js',
      'services/api/routes/user/profile.js',
      'services/api/routes/user/wuyin.js',
    ],
    forbidden: ['user.js(98KB)', 'user (legacy)'],
  },
  {
    path: 'docs/architecture/DATABASE_SCHEMA.md',
    required: ['generation_jobs', 'provider_connections', 'generation_image_worker_leases'],
  },
  {
    path: 'docs/architecture/DATABASE_STRUCTURE.md',
    required: [
      'services/api/routes/user/auth.js',
      'services/api/routes/user/profile.js',
      'services/api/routes/user/wuyin.js',
    ],
  },
  {
    path: 'docs/architecture/ACTIVE_UI_SURFACES.md',
    required: ['apps/web/src/components/mobile/index.ts'],
  },
  {
    path: 'docs/architecture/DEVICE_UI_ARCHITECTURE.md',
    required: ['apps/web/src/components/layout/PromptBar.tsx'],
  },
  {
    path: 'docs/governance/SOURCE_CAPABILITY_MATRIX.md',
    required: ['local-runner build/typecheck 已纳入 verify:changes'],
    forbidden: ['local-runner 独立构建未入 release 验证'],
  },
];

function checkRule(rule) {
  if (!fs.existsSync(rule.path)) {
    return [`Missing architecture documentation file: "${rule.path}"`];
  }
  const content = fs.readFileSync(rule.path, 'utf8');
  const missing = (rule.required || []).filter((token) => !content.includes(token));
  const stale = (rule.forbidden || []).filter((token) => content.includes(token));
  return [
    ...missing.map((token) => `${rule.path} is missing current fact: "${token}"`),
    ...stale.map((token) => `${rule.path} contains stale fact: "${token}"`),
  ];
}

function main() {
  const failures = DOCUMENT_RULES.flatMap(checkRule);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`[Docs Current Architecture Check] P0 ERROR: ${failure}`));
    process.exit(1);
  }
  console.log('[Docs Current Architecture Check] Passed: current architecture references match the live topology.');
}

main();
