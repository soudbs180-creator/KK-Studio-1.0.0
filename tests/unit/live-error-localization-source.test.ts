import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("profile modal localizes backend errors and status labels before rendering", () => {
  const source = readSource("src/components/modals/UserProfileModal.tsx");

  assert.match(source, /import \{ localizeUserFacingText \} from '\.\.\/\.\.\/utils\/localeText';/);
  assert.match(source, /localizeUserFacingText\(error\?\.\s*message\)/);
  assert.match(source, /getRechargeSubmissionStatusLabel\(record\.status \|\| 'completed'\)/);
  assert.doesNotMatch(source, />\{record\.status \|\| 'completed'\}</);
});

test("recharge modal localizes surfaced submission failures", () => {
  const source = readSource("src/components/modals/RechargeModal.tsx");

  assert.match(source, /import \{ localizeUserFacingText \} from '\.\.\/\.\.\/utils\/localeText';/);
  assert.match(source, /localizeUserFacingText\(error\?\.\s*message\)/);
});
