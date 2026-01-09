'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Shield, Store, DollarSign, FileText, TrendingUp, AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { QueryProvider } from '@/components/providers/query-provider'
import { UsersTable } from './_components/users-table'
import { CreateResellerDialog } from './_components/create-reseller-dialog'
import { AIProviderSelector } from './_components/ai-provider-selector'

export default function SuperAdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateReseller, setShowCreateReseller] = useState(false)

  // Verifica permessi superadmin
  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated' || !session) {
      router.push('/login')
      return
    }

    async function checkSuperAdmin() {
      try {
        const response = await fetch('/api/user/info')
        if (response.ok) {
          const data = await response.json()
          const userData = data.user || data
          const accountType = userData.account_type || userData.accountType

          if (accountType === 'superadmin') {
            setIsAuthorized(true)
          } else {
            router.push('/dashboard?error=unauthorized')
            return
          }
        } else {
          router.push('/dashboard?error=unauthorized')
          return
        }
      } catch (error) {
        console.error('Errore verifica superadmin:', error)
        router.push('/dashboard?error=unauthorized')
        return
      } finally {
        setIsLoading(false)
      }
    }

    checkSuperAdmin()
  }, [session, status, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifica permessi...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h1>
          <p className="text-gray-600">Solo i superadmin possono accedere a questa sezione.</p>
        </div>
      </div>
    )
  }

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
          {/* AI Provider Selector */}
          <div className="mb-8">
            <AIProviderSelector />
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <button
              onClick={() => router.push('/dashboard/super-admin/financial')}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-emerald-300 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Financial Dashboard</h3>
                  <p className="text-sm text-gray-500">P&L, Margini, Riconciliazione</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => router.push('/dashboard/super-admin/listini-master')}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Listini Master</h3>
                  <p className="text-sm text-gray-500">Gestione listini globali</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => router.push('/dashboard/super-admin/verifica-costi')}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-orange-300 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Verifica Costi</h3>
                  <p className="text-sm text-gray-500">Confronto DB vs API</p>
                </div>
              </div>
            </button>
          </div>

          {/* Users Table - Self-contained component with filters, sorting, bulk actions */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Gestione Utenti
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Visualizza, modifica e gestisci tutti gli utenti della piattaforma
                  </p>
                </div>
                <Button
                  onClick={() => setShowCreateReseller(true)}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                >
                  <Store className="w-4 h-4 mr-2" />
                  Crea Reseller
                </Button>
              </div>
            </div>

            <div className="p-6">
              <UsersTable />
            </div>
          </div>

          {/* Create Reseller Dialog */}
          <CreateResellerDialog
            isOpen={showCreateReseller}
            onClose={() => setShowCreateReseller(false)}
            onSuccess={() => {
              // Refresh della tabella utenti
              window.location.reload()
            }}
          />
        </main>
      </div>
    </QueryProvider>
  )
}

