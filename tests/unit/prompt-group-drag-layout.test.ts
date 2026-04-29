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
  const promptGroupLayoutSource = readSource("src/app/usePromptGroupLayout.ts");
  const renderLayoutSource = readSource("src/app/promptGroupRenderLayout.ts");

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
  const promptGroupLayoutSource = readSource("src/app/usePromptGroupLayout.ts");

  assert.match(promptGroupLayoutSource, /const hasLiveDragInGroup = Boolean\(liveNodePositionByIdRef\.current\[promptNode\.id\]\)\s*\|\|\s*childImages\.some\(\(imageNode\) => Boolean\(liveNodePositionByIdRef\.current\[imageNode\.id\]\)\)/);
  assert.match(promptGroupLayoutSource, /const hasManualLayoutOverride = Boolean\(promptNode\.userMoved\)\s*\|\|\s*childImages\.some\(\(imageNode\) => Boolean\(imageNode\.userMoved\)\)/);
  assert.match(promptGroupLayoutSource, /const hasPromptGroupPresentationState = Boolean\(promptGroupLayoutStateByIdRef\.current\[promptNode\.id\]\)/);
  assert.match(promptGroupLayoutSource, /if \(hasLiveDragInGroup \|\| hasManualLayoutOverride \|\| hasPromptGroupPresentationState\) return;/);
});

test("dragged image cards mark manual layout overrides in canvas state", () => {
  const canvasContextSource = readSource("src/context/CanvasContext.tsx");

  assert.match(canvasContextSource, /userMoved: selectedSet\.has\(n\.id\) \? true : n\.userMoved/);
});

test("main-card regroup is not blocked by previously moved child cards", () => {
  const appSource = readSource("src/App.tsx");

  assert.match(appSource, /const shouldAutoRegroupPromptGroup = useCallback/);
  assert.match(appSource, /sourceNodeId === promptNode\.id/);
  assert.doesNotMatch(appSource, /childImages\.some\(\(imageNode\) => !imageNode\.userMoved\)/);
});

test("child-card drag clears regroup presentation state so connectors follow live positions", () => {
  const dragHandlerSource = readSource("src/app/usePromptGroupDragHandlers.ts");

  assert.ok((dragHandlerSource.match(/clearPromptGroupRegroup\((node\.id|groupId)\);/g)?.length ?? 0) >= 4);
});

test("viewport position resolver is declared after the live node ref is initialized", () => {
  const appSource = readSource("src/App.tsx");
  const refIndex = appSource.indexOf("const liveNodePositionByIdRef = useRef");
  const resolverIndex = appSource.indexOf("const resolveViewportNodePosition =");

  assert.notEqual(refIndex, -1);
  assert.notEqual(resolverIndex, -1);
  assert.ok(refIndex < resolverIndex);
});
