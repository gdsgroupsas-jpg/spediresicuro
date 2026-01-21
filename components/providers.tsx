/**
 * Providers Component
 *
 * Wrapper per i provider necessari (NextAuth SessionProvider, Sonner Toaster)
 */

'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';
import { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster position="top-right" richColors closeButton duration={5000} />
    </SessionProvider>
  );
}
