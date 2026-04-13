import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

test("prompt-group drag keeps child cards on their live positions", () => {
  const appSource = readSource("src/App.tsx");

  assert.match(appSource, /visualPosition: livePosition/);
  assert.doesNotMatch(appSource, /collapseTargetPosition/);
  assert.doesNotMatch(appSource, /collapseThreshold/);
  assert.doesNotMatch(appSource, /promptDragDistance/);
  assert.doesNotMatch(appSource, /collapsedChildGapX/);
  assert.doesNotMatch(appSource, /collapsedChildGapY/);
});

test("prompt-group layout repair skips active drags and manually moved cards", () => {
  const appSource = readSource("src/App.tsx");

  assert.match(appSource, /const hasLiveDragInGroup = Boolean\(liveNodePositionById\[promptNode\.id\]\)\s*\|\|\s*childImages\.some\(\(imageNode\) => Boolean\(liveNodePositionById\[imageNode\.id\]\)\)/);
  assert.match(appSource, /const hasManualLayoutOverride = Boolean\(promptNode\.userMoved\)\s*\|\|\s*childImages\.some\(\(imageNode\) => Boolean\(imageNode\.userMoved\)\)/);
  assert.match(appSource, /if \(hasLiveDragInGroup \|\| hasManualLayoutOverride\) return;/);
});

test("dragged image cards mark manual layout overrides in canvas state", () => {
  const canvasContextSource = readSource("src/context/CanvasContext.tsx");

  assert.match(canvasContextSource, /userMoved: selectedSet\.has\(n\.id\) \? true : n\.userMoved/);
});
