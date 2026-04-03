import { useEffect, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { ADMIN_SESSION_CHANGE_EVENT } from '../services/api/adminSession';
import { legacyWebApiClient } from '../services/api/kkApiClient';
import {
  type AppAccountRole,
  isAdminAccountRole,
  normalizeAppAccountRole,
} from '../services/admin/adminAccountRole';

type UseAdminRoleResult = {
  authLoading: boolean;
  checkingAdmin: boolean;
  accountRole: AppAccountRole;
  isAdmin: boolean;
  adminSessionActive: boolean;
  adminSessionExpiresAt?: string;
  requiresAdminPasswordChange: boolean;
  user: ReturnType<typeof useAuth>['user'];
};

type ResolvedAdminRoleState = {
  accountRole: AppAccountRole;
  isAdmin: boolean;
  adminSessionActive: boolean;
  adminSessionExpiresAt?: string;
  requiresAdminPasswordChange: boolean;
};

const DEFAULT_ADMIN_ROLE_STATE: ResolvedAdminRoleState = {
  accountRole: 'user',
  isAdmin: false,
  adminSessionActive: false,
  adminSessionExpiresAt: undefined,
  requiresAdminPasswordChange: false,
};

function buildAdminRequestOptions() {
  return {};
}

function toAdminRoleStateFromApi(response: {
  role?: unknown;
  isAdmin?: unknown;
  adminSessionActive?: unknown;
  adminSessionExpiresAt?: unknown;
  requiresPasswordChange?: unknown;
}): ResolvedAdminRoleState {
  const accountRole = normalizeAppAccountRole(response.role);
  const isAdmin = response.isAdmin === true || isAdminAccountRole(accountRole);
  const adminSessionActive = isAdmin && response.adminSessionActive === true;

  return {
    accountRole,
    isAdmin,
    adminSessionActive,
    adminSessionExpiresAt: adminSessionActive
      ? String(response.adminSessionExpiresAt || '').trim() || undefined
      : undefined,
    requiresAdminPasswordChange: isAdmin && response.requiresPasswordChange === true,
  };
}

export const useAdminRole = (): UseAdminRoleResult => {
  const { user, loading: authLoading, isTempUser } = useAuth();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [accountRole, setAccountRole] = useState<AppAccountRole>('user');
  const [isAdmin, setIsAdmin] = useState(DEFAULT_ADMIN_ROLE_STATE.isAdmin);
  const [adminSessionActive, setAdminSessionActive] = useState(DEFAULT_ADMIN_ROLE_STATE.adminSessionActive);
  const [adminSessionExpiresAt, setAdminSessionExpiresAt] = useState<string | undefined>(
    DEFAULT_ADMIN_ROLE_STATE.adminSessionExpiresAt,
  );
  const [requiresAdminPasswordChange, setRequiresAdminPasswordChange] = useState(
    DEFAULT_ADMIN_ROLE_STATE.requiresAdminPasswordChange,
  );
  const [sessionRevision, setSessionRevision] = useState(0);
  const lastResolvedStateRef = useRef<{
    userId: string;
    state: ResolvedAdminRoleState;
  } | null>(null);

  const applyResolvedState = (state: ResolvedAdminRoleState) => {
    setAccountRole(state.accountRole);
    setIsAdmin(state.isAdmin);
    setAdminSessionActive(state.adminSessionActive);
    setAdminSessionExpiresAt(state.adminSessionExpiresAt);
    setRequiresAdminPasswordChange(state.requiresAdminPasswordChange);
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleAdminSessionChange = () => {
      setSessionRevision((current) => current + 1);
    };

    window.addEventListener(ADMIN_SESSION_CHANGE_EVENT, handleAdminSessionChange);
    return () => {
      window.removeEventListener(ADMIN_SESSION_CHANGE_EVENT, handleAdminSessionChange);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const checkAdmin = async () => {
      if (authLoading) {
        return;
      }

      if (!user || isTempUser) {
        if (alive) {
          lastResolvedStateRef.current = null;
          applyResolvedState(DEFAULT_ADMIN_ROLE_STATE);
          setCheckingAdmin(false);
        }
        return;
      }

      setCheckingAdmin(true);

      try {
        const response = await legacyWebApiClient
          .getAdminAccess(buildAdminRequestOptions())
          .catch(() => undefined);

        if (!alive) {
          return;
        }

        if (response?.success) {
          const resolvedState = toAdminRoleStateFromApi(response.data);
          applyResolvedState(resolvedState);
          lastResolvedStateRef.current = {
            userId: user.id,
            state: resolvedState,
          };
          return;
        }

        const previousState =
          lastResolvedStateRef.current?.userId === user.id
            ? lastResolvedStateRef.current.state
            : null;

        if (previousState?.isAdmin) {
          applyResolvedState(previousState);
          return;
        }

        applyResolvedState(DEFAULT_ADMIN_ROLE_STATE);
      } catch {
        if (!alive) {
          return;
        }

        const previousState =
          lastResolvedStateRef.current?.userId === user.id
            ? lastResolvedStateRef.current.state
            : null;

        if (previousState?.isAdmin) {
          applyResolvedState(previousState);
          return;
        }

        applyResolvedState(DEFAULT_ADMIN_ROLE_STATE);
      } finally {
        if (alive) {
          setCheckingAdmin(false);
        }
      }
    };

    void checkAdmin();

    return () => {
      alive = false;
    };
  }, [authLoading, isTempUser, sessionRevision, user]);

  return {
    authLoading,
    checkingAdmin,
    accountRole,
    isAdmin,
    adminSessionActive,
    adminSessionExpiresAt,
    requiresAdminPasswordChange,
    user,
  };
};

export default useAdminRole;
