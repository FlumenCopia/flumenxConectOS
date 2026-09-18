import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole="admin">
      <div className="flex h-screen bg-[#F7F8F5] overflow-hidden text-sage-900">
        <Sidebar mode="admin" />
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <Topbar mode="admin" />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

