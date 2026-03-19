import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type UseAdminRoleResult = {
  authLoading: boolean;
  checkingAdmin: boolean;
  isAdmin: boolean;
  user: ReturnType<typeof useAuth>['user'];
};

export const useAdminRole = (): UseAdminRoleResult => {
  const { user, loading: authLoading, isTempUser } = useAuth();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;

    const checkAdmin = async () => {
      if (authLoading) return;

      if (!user || isTempUser) {
        if (alive) {
          setIsAdmin(false);
          setCheckingAdmin(false);
        }
        return;
      }

      const metadataRole =
        (user.user_metadata?.role as string | undefined) ||
        (user.app_metadata?.role as string | undefined);

      if (metadataRole === 'admin') {
        if (alive) {
          setIsAdmin(true);
          setCheckingAdmin(false);
        }
        return;
      }

      setCheckingAdmin(true);

      try {
        const adminRpc = await supabase.rpc('is_admin');
        if (!adminRpc.error && Boolean(adminRpc.data) === true) {
          if (alive) {
            setIsAdmin(true);
            setCheckingAdmin(false);
          }
          return;
        }

        const profileResult = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (!alive) return;
        setIsAdmin(profileResult.data?.role === 'admin');
      } catch {
        if (alive) {
          setIsAdmin(false);
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
  }, [authLoading, isTempUser, user]);

  return {
    authLoading,
    checkingAdmin,
    isAdmin,
    user,
  };
};

export default useAdminRole;
