import { useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { ADMIN_SESSION_CHANGE_EVENT } from '../services/api/adminSession';
import { legacyWebApiClient } from '../services/api/kkApiClient';

type UseAdminRoleResult = {
  authLoading: boolean;
  checkingAdmin: boolean;
  isAdmin: boolean;
  adminSessionActive: boolean;
  adminSessionExpiresAt?: string;
  requiresAdminPasswordChange: boolean;
  user: ReturnType<typeof useAuth>['user'];
};

function buildAdminRequestOptions() {
  return {};
}

export const useAdminRole = (): UseAdminRoleResult => {
  const { user, loading: authLoading, isTempUser } = useAuth();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminSessionActive, setAdminSessionActive] = useState(false);
  const [adminSessionExpiresAt, setAdminSessionExpiresAt] = useState<string | undefined>();
  const [requiresAdminPasswordChange, setRequiresAdminPasswordChange] = useState(false);
  const [sessionRevision, setSessionRevision] = useState(0);

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
          setIsAdmin(false);
          setAdminSessionActive(false);
          setAdminSessionExpiresAt(undefined);
          setRequiresAdminPasswordChange(false);
          setCheckingAdmin(false);
        }
        return;
      }

      setCheckingAdmin(true);

        try {
          const response = await legacyWebApiClient.getAdminAccess(
            buildAdminRequestOptions(),
          );

        if (!alive) {
          return;
        }

        setIsAdmin(response.success ? response.data.isAdmin === true : false);
        setAdminSessionActive(response.success ? response.data.adminSessionActive === true : false);
        setAdminSessionExpiresAt(response.success ? response.data.adminSessionExpiresAt : undefined);
        setRequiresAdminPasswordChange(
          response.success ? response.data.requiresPasswordChange === true : false,
        );
      } catch {
        if (alive) {
          setIsAdmin(false);
          setAdminSessionActive(false);
          setAdminSessionExpiresAt(undefined);
          setRequiresAdminPasswordChange(false);
        }
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
    isAdmin,
    adminSessionActive,
    adminSessionExpiresAt,
    requiresAdminPasswordChange,
    user,
  };
};

export default useAdminRole;
