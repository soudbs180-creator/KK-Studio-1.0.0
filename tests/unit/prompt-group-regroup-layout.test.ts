import assert from "node:assert/strict";
import { test } from "node:test";

import type { AspectRatio } from "../../src/types.ts";
import {
  buildDockedPromptChildRegroupLayout,
  buildGeneratedImageBatchPositions,
} from "../../src/utils/generatedImageLayout.ts";

const SQUARE: AspectRatio = "1:1";

test("generated batch layout keeps the existing default desktop grid geometry", () => {
  const positions = buildGeneratedImageBatchPositions({
    basePosition: { x: 500, y: 300 },
    items: [
      { aspectRatio: SQUARE },
      { aspectRatio: SQUARE },
      { aspectRatio: SQUARE },
    ],
  });

  assert.deepEqual(positions, [
    { x: 346, y: 700 },
    { x: 654, y: 700 },
    { x: 500, y: 1048 },
  ]);
});

test("docked regroup layout keeps child cards under the parent with a compact dock and a wider settled row", () => {
  const layouts = buildDockedPromptChildRegroupLayout({
    basePosition: { x: 500, y: 300 },
    items: [
      { aspectRatio: SQUARE },
      { aspectRatio: SQUARE },
      { aspectRatio: SQUARE },
    ],
  });

  assert.equal(layouts.length, 3);
  assert.deepEqual(
    layouts.map((layout) => layout.dockedPosition),
    [
      { x: 388, y: 644 },
      { x: 500, y: 644 },
      { x: 612, y: 644 },
    ],
  );
  assert.deepEqual(
    layouts.map((layout) => layout.settledPosition),
    [
      { x: 188, y: 676 },
      { x: 500, y: 676 },
      { x: 812, y: 676 },
    ],
  );
  assert.deepEqual(
    layouts.map((layout) => layout.position),
    layouts.map((layout) => layout.settledPosition),
  );
});

test("docked regroup layout supports fast-then-slow interpolation from caller-provided start positions", () => {
  const baseOptions = {
    basePosition: { x: 500, y: 300 },
    items: [{ aspectRatio: SQUARE }],
    regroupStartPositions: [{ x: 100, y: 100 }],
  };

  const initialLayout = buildDockedPromptChildRegroupLayout({
    ...baseOptions,
    fastRegroupProgress: 0,
    settleRegroupProgress: 0,
  })[0];
  const halfwayToDock = buildDockedPromptChildRegroupLayout({
    ...baseOptions,
    fastRegroupProgress: 0.5,
    settleRegroupProgress: 0,
  })[0];
  const dockedLayout = buildDockedPromptChildRegroupLayout({
    ...baseOptions,
    fastRegroupProgress: 1,
    settleRegroupProgress: 0,
  })[0];
  const halfwayToSettled = buildDockedPromptChildRegroupLayout({
    ...baseOptions,
    fastRegroupProgress: 1,
    settleRegroupProgress: 0.5,
  })[0];
  const settledLayout = buildDockedPromptChildRegroupLayout({
    ...baseOptions,
    fastRegroupProgress: 1,
    settleRegroupProgress: 1,
  })[0];

  assert.deepEqual(initialLayout.position, { x: 100, y: 100 });
  assert.deepEqual(initialLayout.dockedPosition, { x: 500, y: 644 });
  assert.deepEqual(initialLayout.settledPosition, { x: 500, y: 676 });
  assert.deepEqual(halfwayToDock.position, { x: 300, y: 372 });
  assert.deepEqual(dockedLayout.position, dockedLayout.dockedPosition);
  assert.deepEqual(halfwayToSettled.position, { x: 500, y: 660 });
  assert.deepEqual(settledLayout.position, settledLayout.settledPosition);
});
