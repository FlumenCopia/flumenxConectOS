'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserProfile, ClientMembershipItem, loginApi, logoutApi, getMeApi } from '@/lib/auth';
import { getErrorMessage } from '@/lib/api';

interface AuthContextType {
  user: UserProfile | null;
  memberships: ClientMembershipItem[];
  permissions: string[];
  activeClient: ClientMembershipItem | null;
  activeClientId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveClientId: (clientId: string) => void;
  switchWorkspace: (targetClientId: string) => Promise<void>;
  hasPermission: (permissionCode: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<ClientMembershipItem[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [activeClientId, setActiveClientIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activeClientId');
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  // Load session on startup
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        const data = await getMeApi();
        if (isMounted && data?.user) {
          setUser(data.user);
          const userMemberships = data.memberships || [];
          setMemberships(userMemberships);
          setPermissions(data.permissions || []);

          const stored = typeof window !== 'undefined' ? localStorage.getItem('activeClientId') : null;
          const match = userMemberships.find((m) => m.clientId === stored);

          if (match) {
            setActiveClientIdState(match.clientId);
          } else if (userMemberships.length > 0) {
            const firstId = userMemberships[0].clientId;
            setActiveClientIdState(firstId);
            if (typeof window !== 'undefined') {
              localStorage.setItem('activeClientId', firstId);
            }
          }
        }
      } catch {
        // No active session or unauthenticated
        if (isMounted) {
          setUser(null);
          setMemberships([]);
          setPermissions([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await loginApi({ email, password });
      setUser(data.user);
      const userMemberships = data.memberships || [];
      setMemberships(userMemberships);
      setPermissions(data.permissions || []);

      if (userMemberships.length > 0) {
        const firstId = userMemberships[0].clientId;
        setActiveClientIdState(firstId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('activeClientId', firstId);
        }
      }

      // Redirect based on role
      if (data.user.isSuperAdmin) {
        router.push('/admin/dashboard');
      } else {
        router.push('/client/dashboard');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutApi();
    } catch {
      // Continue cleanup even if server call fails
    } finally {
      setUser(null);
      setMemberships([]);
      setPermissions([]);
      setActiveClientIdState(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('activeClientId');
      }
      setIsLoading(false);
      router.push('/login');
    }
  };

  const setActiveClientId = useCallback((clientId: string) => {
    setActiveClientIdState(clientId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeClientId', clientId);
    }
  }, []);

  const switchWorkspace = async (targetClientId: string) => {
    const { switchWorkspaceApi } = await import('@/lib/clients');
    setIsLoading(true);
    try {
      await switchWorkspaceApi(targetClientId);
      setActiveClientIdState(targetClientId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('activeClientId', targetClientId);
      }
      const meData = await getMeApi();
      if (meData?.user) {
        setUser(meData.user);
        setMemberships(meData.memberships || []);
        setPermissions(meData.permissions || []);
      }
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const activeClient =
    memberships.find((m) => m.clientId === activeClientId) || memberships[0] || null;

  const hasPermission = useCallback(
    (code: string): boolean => {
      if (user?.isSuperAdmin) return true;
      if (activeClient) {
        return activeClient.permissions.includes(code);
      }
      return permissions.includes(code);
    },
    [user, activeClient, permissions]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        permissions,
        activeClient,
        activeClientId,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        setActiveClientId,
        switchWorkspace,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
