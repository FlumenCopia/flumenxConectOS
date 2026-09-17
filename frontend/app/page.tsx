import Link from 'next/link';
import { Building2, Shield, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg shadow-sm p-8 text-center">
        <div className="h-12 w-12 rounded-lg bg-brand-800 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
          FX
        </div>
        <h1 className="text-xl font-bold text-slate-900">flumenxConectOS</h1>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          FlumenX Internal Digital Marketing Operations Platform
        </p>

        <div className="space-y-3 text-left">
          <Link
            href="/admin/dashboard"
            className="flex items-center justify-between p-3.5 border border-slate-200 rounded-md hover:border-brand-600 hover:bg-slate-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-brand-50 text-brand-800">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-800">Super Admin Portal</p>
                <p className="text-xs text-slate-500">Cross-client management, setup & audit logs</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-brand-800" />
          </Link>

          <Link
            href="/client/dashboard"
            className="flex items-center justify-between p-3.5 border border-slate-200 rounded-md hover:border-brand-600 hover:bg-slate-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-slate-100 text-slate-700">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-800">Client Workspace</p>
                <p className="text-xs text-slate-500">CRM leads, unified inbox, forms & reports</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-brand-800" />
          </Link>

          <div className="pt-2 text-center">
            <Link href="/login" className="text-xs text-slate-500 hover:text-slate-800 underline">
              Go to Sign In Screen
            </Link>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mt-6">
        Release 1: System Foundation Active &bull; FlumenX Internal System
      </p>
    </div>
  );
}
