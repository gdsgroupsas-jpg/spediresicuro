'use client'

import { Shield } from 'lucide-react'

import { QueryProvider } from '@/components/providers/query-provider'
import { UsersTable } from './_components/users-table'

export default function SuperAdminDashboard() {
  return (
    <QueryProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-indigo-50/20">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Super Admin Panel
                </h1>
                <p className="text-sm text-gray-500">
                  Gestione completa utenti e sistema
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Users Table - Self-contained component with filters, sorting, bulk actions */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Gestione Utenti
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Visualizza, modifica e gestisci tutti gli utenti della piattaforma
              </p>
            </div>

            <div className="p-6">
              <UsersTable />
            </div>
          </div>
        </main>
      </div>
    </QueryProvider>
  )
}

