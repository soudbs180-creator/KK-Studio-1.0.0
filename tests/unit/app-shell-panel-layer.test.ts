import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath) {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

test("App delegates workspace panel rendering to a dedicated shell component", () => {
  const appSource = readSource("src/App.tsx");
  const layerSource = readSource("src/components/workspace/WorkspaceSurfacePanels.tsx");

  assert.match(appSource, /import \{ WorkspaceSurfacePanels \} from '\.\/components\/workspace\/WorkspaceSurfacePanels';/);
  assert.doesNotMatch(appSource, /<WorkspacePanels\s/);
  assert.match(layerSource, /export function WorkspaceSurfacePanels\(/);
  assert.match(layerSource, /<WorkspacePanels\s/);
  assert.match(layerSource, /<ChatSidebar/);
  assert.match(layerSource, /<AssetLibraryPanel/);
});
