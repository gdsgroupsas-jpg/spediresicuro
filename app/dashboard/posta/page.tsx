/**
 * Dashboard: Posta
 * 
 * Pagina per gestione email e comunicazioni
 */

'use client'

import { useState } from 'react'
import DashboardNav from '@/components/dashboard-nav'

export default function PostaPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardNav
          title="Posta"
          subtitle="Gestione email e comunicazioni"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Posta', href: '/dashboard/posta' },
          ]}
        />

        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Sezione Posta
            </h2>
            <p className="text-gray-600 mb-8">
              Questa sezione sarà disponibile a breve.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

