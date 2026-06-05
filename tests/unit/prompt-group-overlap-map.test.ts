import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildPromptGroupOverlapMap,
  type PromptGroupOverlapBounds,
} from '../../apps/web/src/app/promptGroupOverlapMap.ts';

const sortOverlapMap = (map: Record<string, string[]>): Record<string, string[]> => (
  Object.fromEntries(
    Object.entries(map)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, [...value].sort()])
  )
);

const bounds = (
  x: number,
  y: number,
  width = 100,
  height = 100,
): PromptGroupOverlapBounds => ({ x, y, width, height });

test('prompt group overlap map uses spatial indexing while preserving overlap semantics', () => {
  const overlapMap = buildPromptGroupOverlapMap(new Map<string, PromptGroupOverlapBounds>([
    ['a', bounds(0, 0)],
    ['b', bounds(50, 40)],
    ['c', bounds(100, 0)],
    ['d', bounds(260, 0)],
    ['wide', bounds(-850, -850, 2000, 2000)],
    ['far', bounds(1800, 1800)],
  ]));

  assert.deepEqual(sortOverlapMap(overlapMap), {
    a: ['b', 'wide'],
    b: ['a', 'c', 'wide'],
    c: ['b', 'wide'],
    d: ['wide'],
    far: [],
    wide: ['a', 'b', 'c', 'd'],
  });
});
