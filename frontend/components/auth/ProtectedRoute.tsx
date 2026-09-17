'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'client';
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredPermission,
}) => {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-brand-800 mb-2" />
        <p className="text-xs text-slate-500">Verifying flumenxConectOS session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // If Admin role is strictly required and user is not Super Admin
  if (requiredRole === 'admin' && !user?.isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-6 text-center shadow-sm">
          <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-500 mt-1 mb-5">
            Super Administrator privilege is required to access the FlumenX internal console.
          </p>
          <Button size="sm" onClick={() => router.push('/client/dashboard')}>
            Return to Client Workspace
          </Button>
        </div>
      </div>
    );
  }

  // If specific permission is required and user lacks it
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-6 text-center shadow-sm">
          <div className="h-10 w-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-3">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Permission Denied</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Your assigned role does not grant permission: <code className="text-slate-800 font-mono font-semibold">{requiredPermission}</code>.
          </p>
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
