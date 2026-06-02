import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();



test("prompt-group drag keeps child cards on their live positions", () => {
  const appSource = readSource("apps/web/src/App.tsx");
  const promptGroupLayoutSource = readSource("apps/web/src/app/usePromptGroupLayout.ts");
  const renderLayoutSource = readSource("apps/web/src/app/promptGroupRenderLayout.ts");

  assert.match(promptGroupLayoutSource, /const promptGroupRegroupLayoutsById = useMemo/);
  assert.match(promptGroupLayoutSource, /regroupLayoutMap\.set\(/);
  assert.match(appSource, /regroupLayoutsById: promptGroupRegroupLayoutsById\.get\(node\.id\) \?\? new Map\(\)/);
  assert.match(renderLayoutSource, /const regroupLayout = regroupLayoutsById\.get\(childNode\.id\);/);
  assert.match(renderLayoutSource, /visualPosition: regroupLayout\?\.renderPosition \?\? livePosition/);
  assert.doesNotMatch(appSource, /collapseTargetPosition/);
  assert.doesNotMatch(appSource, /collapseThreshold/);
  assert.doesNotMatch(appSource, /promptDragDistance/);
  assert.doesNotMatch(appSource, /collapsedChildGapX/);
  assert.doesNotMatch(appSource, /collapsedChildGapY/);
});

test("prompt-group layout repair skips active drags and manually moved cards", () => {
  const promptGroupLayoutSource = readSource("apps/web/src/app/usePromptGroupLayout.ts");

  assert.match(promptGroupLayoutSource, /const hasLiveDragInGroup = Boolean\(liveNodePositionByIdRef\.current\[promptNode\.id\]\)\s*\|\|\s*childImages\.some\(\(imageNode\) => Boolean\(liveNodePositionByIdRef\.current\[imageNode\.id\]\)\)/);
  assert.match(promptGroupLayoutSource, /const hasManualLayoutOverride = Boolean\(promptNode\.userMoved\)\s*\|\|\s*childImages\.some\(\(imageNode\) => Boolean\(imageNode\.userMoved\)\)/);
  assert.match(promptGroupLayoutSource, /const hasPromptGroupPresentationState = Boolean\(promptGroupLayoutStateByIdRef\.current\[promptNode\.id\]\)/);
  assert.match(promptGroupLayoutSource, /if \(hasLiveDragInGroup \|\| hasManualLayoutOverride \|\| hasPromptGroupPresentationState\) return;/);
});

test("dragged image cards mark manual layout overrides in canvas state", () => {
  const canvasMovementSource = readSource("apps/web/src/context/canvasMovement.ts");

  assert.match(canvasMovementSource, /userMoved: selectedSet\.has\(node\.id\) \? true : node\.userMoved/);
});

test("main-card regroup is not blocked by previously moved child cards", () => {
  const promptGroupLayoutSource = readSource("apps/web/src/app/usePromptGroupLayout.ts");

  assert.match(promptGroupLayoutSource, /const shouldAutoRegroupPromptGroup = useCallback/);
  assert.match(promptGroupLayoutSource, /sourceNodeId === promptNode\.id/);
  assert.doesNotMatch(promptGroupLayoutSource, /childImages\.some\(\(imageNode\) => !imageNode\.userMoved\)/);
});

test("child-card drag clears regroup presentation state so connectors follow live positions", () => {
  const dragHandlerSource = readSource("apps/web/src/app/usePromptGroupDragHandlers.ts");

  assert.ok((dragHandlerSource.match(/clearPromptGroupRegroup\((node\.id|groupId)\);/g)?.length ?? 0) >= 4);
});

test("viewport position resolver is declared after the live node ref is initialized", () => {
  const appSource = readSource("apps/web/src/App.tsx");
  const refIndex = appSource.indexOf("const liveNodePositionByIdRef = useRef");
  const resolverIndex = appSource.indexOf("const resolveViewportNodePosition =");

  assert.notEqual(refIndex, -1);
  assert.notEqual(resolverIndex, -1);
  assert.ok(refIndex < resolverIndex);
});
