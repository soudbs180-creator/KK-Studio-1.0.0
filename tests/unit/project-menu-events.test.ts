import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PROJECT_MENU_TOGGLE_EVENT,
  requestProjectMenuToggle,
} from '../../apps/web/src/components/settings/projectMenuEvents.ts';

test('project menu requests use one shared event', () => {
  const target = new EventTarget();
  let requests = 0;
  target.addEventListener(PROJECT_MENU_TOGGLE_EVENT, () => {
    requests += 1;
  });

  requestProjectMenuToggle(target);

  assert.equal(requests, 1);
});
