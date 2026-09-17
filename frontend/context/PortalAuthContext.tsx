'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  PortalUserProfile,
  portalLoginApi,
  portalAcceptInvitationApi,
  portalGetMeApi,
  portalLogoutApi,
} from '@/lib/api/portal';

interface PortalAuthContextType {
  user: PortalUserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  acceptInvitation: (data: { token: string; password: string; name?: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthContextType | undefined>(undefined);

export const PortalAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<PortalUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const fresh = await portalGetMeApi();
      setUser(fresh);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      try {
        const currentUser = await portalGetMeApi();
        if (isMounted) {
          setUser(currentUser);
        }
      } catch {
        if (isMounted) {
          setUser(null);
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
    const data = await portalLoginApi({ email, password });
    setUser(data.user);
    router.push('/portal');
  };

  const acceptInvitation = async (data: { token: string; password: string; name?: string; phone?: string }) => {
    const res = await portalAcceptInvitationApi(data);
    setUser(res.user);
    router.push('/portal');
  };

  const logout = async () => {
    try {
      await portalLogoutApi();
    } finally {
      setUser(null);
      router.push('/portal/login');
    }
  };

  return (
    <PortalAuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        acceptInvitation,
        logout,
        refreshUser,
      }}
    >
      {children}
    </PortalAuthContext.Provider>
  );
};

export const usePortalAuth = (): PortalAuthContextType => {
  const context = useContext(PortalAuthContext);
  if (!context) {
    throw new Error('usePortalAuth must be used within a PortalAuthProvider');
  }
  return context;
};
