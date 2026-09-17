'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ClientAutomationsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/client/workflows');
  }, [router]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-500">
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      <p className="text-sm font-medium">Navigating to Workflow Automations...</p>
    </div>
  );
}
