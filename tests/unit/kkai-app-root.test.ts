import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createAppRootMode,
  createKkaiRuntimeAuthSnapshot,
} from '../../src/context/kkaiRuntimeContext.ts';

test('createKkaiRuntimeAuthSnapshot produces a non-loading fixed local runtime user', () => {
  const snapshot = createKkaiRuntimeAuthSnapshot();

  assert.equal(snapshot.loading, false);
  assert.equal(snapshot.isTempUser, false);
  assert.equal(snapshot.user?.id, 'local-user');
  assert.equal(snapshot.session, null);
});

test('createAppRootMode always boots the workspace shell in local-only mode', () => {
  assert.equal(createAppRootMode({ pathname: '/' }), 'workspace');
  assert.equal(createAppRootMode({ pathname: '/auth/callback' }), 'workspace');
});
