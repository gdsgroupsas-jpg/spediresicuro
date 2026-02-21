'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect da /dashboard/bonifici a /dashboard/admin/bonifici
 * Per compatibilità con URL più corto
 */
export default function BonificiRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/admin/bonifici');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500">Reindirizzamento in corso...</p>
      </div>
    </div>
  );
}
