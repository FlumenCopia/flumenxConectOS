'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function InviteRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      router.replace(`/invite/accept?token=${encodeURIComponent(token)}`);
    } else {
      router.replace('/invite/accept');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#F7F8F5] flex items-center justify-center text-xs text-charcoal-500">
      <Loader2 className="h-5 w-5 animate-spin text-brand-700 mr-2" />
      <span>Redirecting to invitation...</span>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F7F8F5] flex items-center justify-center text-xs text-charcoal-500">
          <Loader2 className="h-5 w-5 animate-spin text-brand-700 mr-2" />
          <span>Redirecting to invitation...</span>
        </div>
      }
    >
      <InviteRedirect />
    </Suspense>
  );
}
