import type { Session, User } from '@supabase/supabase-js';

import { KKAI_LOCAL_USER_ID } from '../app/kkaiLocalRuntime.ts';

export interface KkaiRuntimeAuthSnapshot {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  loginAsTempUser: () => Promise<void>;
  isTempUser: boolean;
  tempUserExpiry: number | null;
}

function createLocalUser(): User {
  return {
    id: KKAI_LOCAL_USER_ID,
    app_metadata: {},
    user_metadata: {
      provider: 'local',
      providers: ['local'],
    },
    aud: 'authenticated',
    created_at: '1970-01-01T00:00:00.000Z',
    email: 'local-user@kkai.local',
  } as unknown as User;
}

export function createKkaiRuntimeAuthSnapshot(): KkaiRuntimeAuthSnapshot {
  return {
    session: null,
    user: createLocalUser(),
    loading: false,
    signOut: async () => {},
    loginAsTempUser: async () => {},
    isTempUser: false,
    tempUserExpiry: null,
  };
}

export function createAppRootMode(_input: { pathname: string }): 'workspace' {
  return 'workspace';
}
