import { KKAI_LOCAL_USER_ID } from './kkaiLocalRuntime.ts';
import type { RuntimeAuthSession, RuntimeAuthUser } from '../services/auth/runtimeAuthTypes.ts';

export function shouldShowLoginForAuthGate(input: {
  user: RuntimeAuthUser | null;
  session: RuntimeAuthSession | null;
  isTempUser: boolean;
}): boolean {
  if (!input.user) {
    return true;
  }

  if (input.session || input.isTempUser) {
    return false;
  }

  return input.user.id !== KKAI_LOCAL_USER_ID;
}
