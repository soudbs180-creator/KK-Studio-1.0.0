import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

test('AchievementToast does not reintroduce stale lucide imports', () => {
  const source = readSource('src/components/Onboarding/AchievementToast.tsx');

  assert.doesNotMatch(source, /import \{[^}]*\bStar\b[^}]*\} from 'lucide-react';/);
  assert.match(source, /import \{ Trophy, X, Sparkles \} from 'lucide-react';/);
});
