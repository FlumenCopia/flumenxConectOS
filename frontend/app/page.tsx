import Link from 'next/link';
import Image from 'next/image';
import { Building2, Shield, ArrowRight, ExternalLink } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F7F8F5] flex flex-col justify-center items-center p-6 select-none">
      <div className="max-w-md w-full bg-white border border-sage-200/90 rounded-2xl shadow-soft-md p-8 text-center">
        <div className="flex justify-center mb-4">
          <Image
            src="/images/logo.png"
            alt="flumenxConectOS"
            width={240}
            height={60}
            priority
            className="h-12 w-auto object-contain"
          />
        </div>
        <p className="text-xs text-sage-500 mt-1 mb-6">
          FlumenX Digital Marketing Operations Platform
        </p>

        <div className="space-y-3 text-left">
          <Link
            href="/client/dashboard"
            className="flex items-center justify-between p-3.5 border border-sage-200 rounded-xl hover:border-brand-600 hover:bg-sage-50/70 transition-all group shadow-soft-xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-50 text-brand-800">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-sage-900 group-hover:text-brand-800">Client Workspace</p>
                <p className="text-[11px] text-sage-500">CRM leads, unified inbox, pipeline, forms & tasks</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-sage-400 group-hover:text-brand-800 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link
            href="/admin/dashboard"
            className="flex items-center justify-between p-3.5 border border-sage-200 rounded-xl hover:border-brand-600 hover:bg-sage-50/70 transition-all group shadow-soft-xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sage-100 text-sage-700">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-sage-900 group-hover:text-brand-800">Super Admin Console</p>
                <p className="text-[11px] text-sage-500">Cross-client management, tenant setup & audit trail</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-sage-400 group-hover:text-brand-800 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link
            href="/portal"
            className="flex items-center justify-between p-3.5 border border-sage-200 rounded-xl hover:border-brand-600 hover:bg-sage-50/70 transition-all group shadow-soft-xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
                <ExternalLink className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-sage-900 group-hover:text-brand-800">Customer Portal</p>
                <p className="text-[11px] text-sage-500">Client ticket requests, approvals & messaging</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-sage-400 group-hover:text-brand-800 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <div className="pt-3 text-center">
            <Link href="/login" className="text-xs text-brand-800 hover:text-brand-900 font-semibold underline">
              Go to Sign In Screen
            </Link>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-sage-400 mt-6">
        Simple. Powerful. Connected &bull; FlumenX Internal System
      </p>
    </div>
  );
}
