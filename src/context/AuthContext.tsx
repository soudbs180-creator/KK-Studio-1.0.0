import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { tempUserService, type TempUserSession } from '../services/auth/tempUserService';
import { setKkApiAccessToken } from '../services/api/kkApiClient';
import { clearStoredAdminSession } from '../services/api/adminSession';
import { emitAuthSessionChange } from '../services/auth/authSessionEvents';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
    loginAsTempUser: () => Promise<void>;
    isTempUser: boolean;
    tempUserExpiry: number | null;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    loading: true,
    signOut: async () => { },
    loginAsTempUser: async () => { },
    isTempUser: false,
    tempUserExpiry: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [tempUserSession, setTempUserSession] = useState<TempUserSession | null>(null);
    const latestSessionRef = useRef<Session | null>(null);
    const latestUserRef = useRef<User | null>(null);
    const latestTempUserSessionRef = useRef<TempUserSession | null>(null);
    const expectedSessionClearReasonRef = useRef<'user-signout' | 'temp-login' | null>(null);
    const authRecoveryPromiseRef = useRef<Promise<void> | null>(null);

    useEffect(() => {
        latestSessionRef.current = session;
    }, [session]);

    useEffect(() => {
        latestUserRef.current = user;
    }, [user]);

    useEffect(() => {
        latestTempUserSessionRef.current = tempUserSession;
    }, [tempUserSession]);

    // Check for cached temp user on mount
    useEffect(() => {
        const cachedTempUser = tempUserService.getCachedTempUser();
        if (cachedTempUser) {
            console.log('[AuthContext] Restoring cached temp user session');
            try {
                supabase.auth.stopAutoRefresh();
            } catch (error) {
                console.warn('[AuthContext] Failed to stop Supabase auto refresh for temp user:', error);
            }
            setKkApiAccessToken(undefined);
            setTempUserSession(cachedTempUser);
            setUser(cachedTempUser.user);
            emitAuthSessionChange({
                hasSession: false,
                userId: cachedTempUser.user.id,
                isTempUser: true,
            });
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let active = true;
        const preserveCurrentAuthState = (reason: string) => {
            if (!active) return;

            const currentSession = latestSessionRef.current;
            const currentUser = latestUserRef.current;
            const currentTempUserSession = latestTempUserSessionRef.current;
            if (currentSession?.user && currentUser) {
                console.warn('[AuthContext] Preserving existing Supabase session:', reason);
                setLoading(false);
                return;
            }

            if (currentTempUserSession && currentUser) {
                console.warn('[AuthContext] Preserving existing temp user session:', reason);
                setLoading(false);
                return;
            }

            setLoading(false);
        };

        const recoverUnexpectedSessionLoss = (reason: string) => {
            if (!active || authRecoveryPromiseRef.current) {
                return;
            }

            const fallbackSession = latestSessionRef.current;
            authRecoveryPromiseRef.current = (async () => {
                try {
                    const { data: { session: currentSession }, error: currentSessionError } = await supabase.auth.getSession();
                    if (currentSessionError) {
                        console.warn('[AuthContext] Failed to read session during recovery:', currentSessionError);
                    }

                    if (currentSession?.user) {
                        settleAuthState(currentSession);
                        return;
                    }

                    if (fallbackSession?.access_token && fallbackSession?.refresh_token) {
                        const { data: restoredSessionData, error: restoreError } = await supabase.auth.setSession({
                            access_token: fallbackSession.access_token,
                            refresh_token: fallbackSession.refresh_token,
                        });

                        if (restoreError) {
                            console.warn('[AuthContext] Failed to restore cached session after unexpected sign-out:', restoreError);
                        }

                        if (restoredSessionData.session?.user) {
                            settleAuthState(restoredSessionData.session);
                            return;
                        }
                    }
                } catch (error) {
                    console.warn('[AuthContext] Unexpected session recovery failed:', error);
                } finally {
                    authRecoveryPromiseRef.current = null;
                }

                preserveCurrentAuthState(`${reason} (recovery unavailable)`);
            })();
        };

        const settleAuthState = (nextSession: Session | null) => {
            if (!active) return;

            if (nextSession?.user) {
                expectedSessionClearReasonRef.current = null;
                tempUserService.clearCachedTempUser();
                try {
                    supabase.auth.startAutoRefresh();
                } catch (error) {
                    console.warn('[AuthContext] Failed to start Supabase auto refresh:', error);
                }
                setKkApiAccessToken(nextSession.access_token || undefined);
                setTempUserSession(null);
                setSession(nextSession);
                setUser(nextSession.user);
                emitAuthSessionChange({
                    hasSession: true,
                    userId: nextSession.user.id,
                    accessToken: nextSession.access_token || undefined,
                    isTempUser: false,
                });
                setLoading(false);
                return;
            }

            const cachedTempUser = tempUserService.getCachedTempUser();
            if (cachedTempUser) {
                try {
                    supabase.auth.stopAutoRefresh();
                } catch (error) {
                    console.warn('[AuthContext] Failed to stop Supabase auto refresh:', error);
                }
                setKkApiAccessToken(undefined);
                setTempUserSession(cachedTempUser);
                setSession(null);
                setUser(cachedTempUser.user);
                emitAuthSessionChange({
                    hasSession: false,
                    userId: cachedTempUser.user.id,
                    isTempUser: true,
                });
                setLoading(false);
                return;
            }

            try {
                supabase.auth.stopAutoRefresh();
            } catch (error) {
                console.warn('[AuthContext] Failed to stop Supabase auto refresh:', error);
            }
            setTempUserSession(null);
            setSession(null);
            setUser(null);
            setKkApiAccessToken(undefined);
            clearStoredAdminSession();
            emitAuthSessionChange({
                hasSession: false,
                userId: null,
                isTempUser: false,
            });
            setLoading(false);
        };

        const sessionTimeout = window.setTimeout(() => {
            console.warn('[AuthContext] getSession timeout, preserving current auth state');
            preserveCurrentAuthState('getSession timeout');
        }, 5000);

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            window.clearTimeout(sessionTimeout);
            settleAuthState(session);
        }).catch((err) => {
            window.clearTimeout(sessionTimeout);
            console.error('[AuthContext] Failed to get session:', err);
            preserveCurrentAuthState('getSession failed');
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            window.clearTimeout(sessionTimeout);
            if (!session) {
                if (event === 'SIGNED_OUT') {
                    const expectedClearReason = expectedSessionClearReasonRef.current;
                    if (!expectedClearReason) {
                        preserveCurrentAuthState('unexpected SIGNED_OUT event');
                        recoverUnexpectedSessionLoss('unexpected SIGNED_OUT event');
                        return;
                    }

                    expectedSessionClearReasonRef.current = null;
                    settleAuthState(null);
                    return;
                }

                preserveCurrentAuthState(`auth event ${event} delivered empty session`);
                recoverUnexpectedSessionLoss(`auth event ${event} delivered empty session`);
                return;
            }
            settleAuthState(session);
        });

        return () => {
            active = false;
            window.clearTimeout(sessionTimeout);
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        expectedSessionClearReasonRef.current = 'user-signout';
        try {
            await supabase.auth.signOut();
        } catch (error) {
            expectedSessionClearReasonRef.current = null;
            throw error;
        }
        try {
            supabase.auth.stopAutoRefresh();
        } catch (error) {
            console.warn('[AuthContext] Failed to stop Supabase auto refresh on sign out:', error);
        }
        setKkApiAccessToken(undefined);
        clearStoredAdminSession();
        // Clear temp user cache if exists
        tempUserService.clearCachedTempUser();
        setTempUserSession(null);
        setSession(null);
        setUser(null);
        emitAuthSessionChange({
            hasSession: false,
            userId: null,
            isTempUser: false,
        });
        expectedSessionClearReasonRef.current = null;
    };

    const loginAsTempUser = async () => {
        setLoading(true);
        try {
            expectedSessionClearReasonRef.current = 'temp-login';
            await supabase.auth.signOut();
            try {
                supabase.auth.stopAutoRefresh();
            } catch (error) {
                console.warn('[AuthContext] Failed to stop Supabase auto refresh for temp login:', error);
            }
            setKkApiAccessToken(undefined);
            clearStoredAdminSession();
            const tempSession = await tempUserService.getOrCreateTempUser();
            setTempUserSession(tempSession);
            setSession(null);
            setUser(tempSession.user);
            emitAuthSessionChange({
                hasSession: false,
                userId: tempSession.user.id,
                isTempUser: true,
            });
            expectedSessionClearReasonRef.current = null;
            setLoading(false);
            console.log('[AuthContext] Temp user login successful, expires at:', new Date(tempSession.expiresAt).toISOString());
        } catch (error: any) {
            expectedSessionClearReasonRef.current = null;
            console.error('[AuthContext] Temp user login failed:', error);
            setLoading(false);
            throw error;
        }
    };

    const isTempUser = tempUserService.isTempUser(user);
    const tempUserExpiry = tempUserSession?.expiresAt || null;

    return (
        <AuthContext.Provider value={{ 
            session, 
            user, 
            loading, 
            signOut, 
            loginAsTempUser,
            isTempUser,
            tempUserExpiry
        }}>
            {children}
        </AuthContext.Provider>
    );
};
