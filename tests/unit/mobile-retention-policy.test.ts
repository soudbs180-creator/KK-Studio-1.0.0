import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MOBILE_RETENTION_MODES,
  MOBILE_RETENTION_RESOURCES,
  getMobileRetentionCutoff,
  getMobileRetentionPolicy,
  getMobileRetentionRule,
} from '../../apps/web/src/services/storage/mobileRetentionPolicy.ts';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 3, 11, 0, 0, 0);

test('mobile retention exposes the supported mobile policy modes and resources', () => {
  assert.deepEqual(MOBILE_RETENTION_MODES, ['manual', '7d', '30d']);
  assert.deepEqual(MOBILE_RETENTION_RESOURCES, ['images', 'originals', 'tasks', 'logs']);
});

test('mobile retention cutoff stays disabled for manual mode and subtracts whole days for timed modes', () => {
  assert.equal(getMobileRetentionCutoff('manual', NOW), null);
  assert.equal(getMobileRetentionCutoff('7d', NOW), NOW - 7 * DAY_IN_MS);
  assert.equal(getMobileRetentionCutoff('30d', NOW), NOW - 30 * DAY_IN_MS);
});

test('mobile retention rules keep manual cleanup copy and timestamp semantics for every resource', () => {
  assert.deepEqual(getMobileRetentionRule('images', 'manual', NOW), {
    resource: 'images',
    label: '缓存图片',
    description: '缓存图片仅在你手动清理时删除。',
    days: null,
    cutoff: null,
    cutoffField: 'timestamp',
    scope: 'all',
  });

  assert.deepEqual(getMobileRetentionRule('originals', 'manual', NOW), {
    resource: 'originals',
    label: '原图',
    description: '原图仅在你手动清理时删除。',
    days: null,
    cutoff: null,
    cutoffField: 'timestamp',
    scope: 'all',
  });

  assert.deepEqual(getMobileRetentionRule('tasks', 'manual', NOW), {
    resource: 'tasks',
    label: '任务记录',
    description: '任务记录仅在你手动清理时删除。',
    days: null,
    cutoff: null,
    cutoffField: 'createdAt',
    scope: 'completed-or-failed',
  });

  assert.deepEqual(getMobileRetentionRule('logs', 'manual', NOW), {
    resource: 'logs',
    label: '系统日志',
    description: '系统日志仅在你手动清理时删除。',
    days: null,
    cutoff: null,
    cutoffField: 'timestamp',
    scope: 'all',
  });
});

test('mobile retention resolves timed rules for all resources from one shared helper', () => {
  assert.deepEqual(getMobileRetentionPolicy('7d', NOW), {
    images: {
      resource: 'images',
      label: '缓存图片',
      description: '自动清理 7 天前的缓存图片。',
      days: 7,
      cutoff: NOW - 7 * DAY_IN_MS,
      cutoffField: 'timestamp',
      scope: 'all',
    },
    originals: {
      resource: 'originals',
      label: '原图',
      description: '自动清理 7 天前的原图。',
      days: 7,
      cutoff: NOW - 7 * DAY_IN_MS,
      cutoffField: 'timestamp',
      scope: 'all',
    },
    tasks: {
      resource: 'tasks',
      label: '任务记录',
      description: '自动清理 7 天前已完成或失败的任务记录。',
      days: 7,
      cutoff: NOW - 7 * DAY_IN_MS,
      cutoffField: 'createdAt',
      scope: 'completed-or-failed',
    },
    logs: {
      resource: 'logs',
      label: '系统日志',
      description: '自动清理 7 天前的系统日志。',
      days: 7,
      cutoff: NOW - 7 * DAY_IN_MS,
      cutoffField: 'timestamp',
      scope: 'all',
    },
  });

  assert.equal(
    getMobileRetentionRule('tasks', '30d', NOW).description,
    '自动清理 30 天前已完成或失败的任务记录。',
  );
  assert.equal(getMobileRetentionRule('tasks', '30d', NOW).cutoff, NOW - 30 * DAY_IN_MS);
});
