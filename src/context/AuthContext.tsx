import React, { createContext, useContext, useLayoutEffect, useMemo } from 'react';

import { keyManager } from '../services/auth/keyManager';
import { setTaskPersistenceStorageUserId } from '../services/persistence/taskPersistence';
import { createKkaiRuntimeAuthSnapshot } from './kkaiRuntimeContext';

interface AuthContextType {
    session: ReturnType<typeof createKkaiRuntimeAuthSnapshot>['session'];
    user: ReturnType<typeof createKkaiRuntimeAuthSnapshot>['user'];
    loading: boolean;
    signOut: () => Promise<void>;
    loginAsTempUser: () => Promise<void>;
    isTempUser: boolean;
    tempUserExpiry: number | null;
}

const DEFAULT_AUTH_CONTEXT = createKkaiRuntimeAuthSnapshot();

const AuthContext = createContext<AuthContextType>(DEFAULT_AUTH_CONTEXT);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const snapshot = useMemo(() => createKkaiRuntimeAuthSnapshot(), []);
    const runtimeUserId = snapshot.user?.id || null;

    useLayoutEffect(() => {
        setTaskPersistenceStorageUserId(runtimeUserId);
        void keyManager.setUserId(runtimeUserId).catch((error) => {
            console.warn('[AuthContext] Failed to sync local KKAI runtime user scope:', error);
        });
    }, [runtimeUserId]);

    return (
        <AuthContext.Provider value={snapshot}>
            {children}
        </AuthContext.Provider>
    );
};
