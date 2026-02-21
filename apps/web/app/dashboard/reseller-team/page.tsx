/**
 * Redirect: /dashboard/reseller-team -> /dashboard/reseller/clienti
 *
 * Pagina legacy sostituita da Dashboard Unificata Clienti.
 * I componenti in _components/ rimangono perche' importati da altre pagine.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ResellerTeamRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/reseller/clienti');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Reindirizzamento...</p>
      </div>
    </div>
  );
}
