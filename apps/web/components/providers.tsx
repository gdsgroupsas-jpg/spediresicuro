/**
 * Providers Component
 *
 * Wrapper per i provider necessari (NextAuth SessionProvider, Sonner Toaster, UserContext)
 */

'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';
import { ReactNode } from 'react';
import { UserProvider } from '@/contexts/UserContext';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <UserProvider>
        {children}
        <Toaster position="top-right" richColors closeButton duration={5000} />
      </UserProvider>
    </SessionProvider>
  );
}
