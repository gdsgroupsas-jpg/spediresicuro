/**
 * Dashboard Sidebar Component - Redesigned
 *
 * Sidebar moderna con:
 * - Navigazione organizzata gerarchicamente per ruolo
 * - Sezioni collassabili
 * - Design marketing-oriented
 * - Icone e colori distintivi
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  Package,
  Plus,
  Mail,
  Settings,
  FileText,
  Shield,
  Users,
  Crown,
  User,
  LogOut,
  Bot,
  ChevronDown,
  ChevronRight,
  Wallet,
  Zap,
  Store,
  Building2,
  UserCircle,
} from 'lucide-react';

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [accountType, setAccountType] = useState<string | null>(null);
  const [isReseller, setIsReseller] = useState(false);
  const [isAdminExpanded, setIsAdminExpanded] = useState(false);
  const [isAccountExpanded, setIsAccountExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Carica il tipo di account e reseller status
  useEffect(() => {
    async function loadUserInfo() {
      if (session?.user?.email) {
        try {
          const response = await fetch('/api/user/info');
          if (response.ok) {
            const data = await response.json();
            const userData = data.user || data;
            setAccountType(userData.account_type || null);
            setIsReseller(userData.is_reseller === true);
          }
        } catch (error) {
          console.error('Errore caricamento info utente:', error);
        } finally {
          setIsLoading(false);
        }
      }
    }
    loadUserInfo();
  }, [session]);

  // Auto-espandi sezioni se siamo in una pagina relativa
  useEffect(() => {
    if (pathname?.startsWith('/dashboard/admin') ||
        pathname?.startsWith('/dashboard/super-admin') ||
        pathname?.startsWith('/dashboard/listini')) {
      setIsAdminExpanded(true);
    }
    if (pathname?.startsWith('/dashboard/impostazioni') ||
        pathname?.startsWith('/dashboard/dati-cliente') ||
        pathname?.startsWith('/dashboard/integrazioni')) {
      setIsAccountExpanded(true);
    }
  }, [pathname]);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname?.startsWith(path);
  };

  const navItemClass = (path: string) => {
    return `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      isActive(path)
        ? 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-600 font-semibold shadow-sm'
        : 'text-gray-700 hover:bg-gray-50 hover:text-orange-600 font-medium'
    }`;
  };

  const isAdmin = accountType === 'admin' || accountType === 'superadmin';
  const isSuperAdmin = accountType === 'superadmin';

  return (
    <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200 z-50">
      {/* Logo/Brand */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
          <Package className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">SpediRe Sicuro</h1>
          <p className="text-xs text-gray-500">Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {/* 📊 SEZIONE PRINCIPALE */}
        <div>
          <h3 className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Principale
          </h3>
          <nav className="space-y-1">
            <Link href="/dashboard" className={navItemClass('/dashboard')}>
              <LayoutDashboard className="w-5 h-5" />
              <span>Dashboard</span>
            </Link>

            <Link href="/dashboard/spedizioni" className={navItemClass('/dashboard/spedizioni')}>
              <Package className="w-5 h-5" />
              <span>Spedizioni</span>
            </Link>

            <Link
              href="/dashboard/spedizioni/nuova"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive('/dashboard/spedizioni/nuova')
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white font-semibold shadow-lg'
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold hover:shadow-lg hover:scale-[1.02]'
              }`}
            >
              <Plus className="w-5 h-5" />
              <span>Nuova Spedizione</span>
            </Link>

            <button
              onClick={() => {
                const event = new CustomEvent('openAiAssistant');
                window.dispatchEvent(event);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
            >
              <Bot className="w-5 h-5" />
              <span>AI Assistant</span>
            </button>
          </nav>
        </div>

        {/* 💰 SEZIONE RESELLER - Solo per Reseller */}
        {isReseller && (
          <div>
            <h3 className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Reseller
            </h3>
            <nav className="space-y-1">
              <Link
                href="/dashboard/reseller-team"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive('/dashboard/reseller-team')
                    ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600 font-semibold shadow-sm'
                    : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 font-medium'
                }`}
              >
                <Users className="w-5 h-5" />
                <span>I Miei Clienti</span>
              </Link>

              <Link
                href="/dashboard/wallet"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive('/dashboard/wallet')
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-600 font-semibold shadow-sm'
                    : 'text-gray-700 hover:bg-green-50 hover:text-green-600 font-medium'
                }`}
              >
                <Wallet className="w-5 h-5" />
                <span>Wallet</span>
              </Link>
            </nav>
          </div>
        )}

        {/* 📧 SEZIONE COMUNICAZIONI */}
        <div>
          <h3 className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Comunicazioni
          </h3>
          <nav className="space-y-1">
            <Link href="/dashboard/posta" className={navItemClass('/dashboard/posta')}>
              <Mail className="w-5 h-5" />
              <span>Posta</span>
            </Link>
          </nav>
        </div>

        {/* 💼 SEZIONE AMMINISTRAZIONE - Solo per Admin */}
        {isAdmin && (
          <div>
            <button
              onClick={() => setIsAdminExpanded(!isAdminExpanded)}
              className="w-full flex items-center justify-between px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 hover:text-gray-600 transition-colors"
            >
              <span>Amministrazione</span>
              {isAdminExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {isAdminExpanded && (
              <nav className="space-y-1">
                {isSuperAdmin && (
                  <Link
                    href="/dashboard/super-admin"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive('/dashboard/super-admin')
                        ? 'bg-gradient-to-r from-red-50 to-rose-50 text-red-600 font-semibold shadow-sm'
                        : 'text-gray-700 hover:bg-red-50 hover:text-red-600 font-medium'
                    }`}
                  >
                    <Crown className="w-5 h-5" />
                    <span>Super Admin</span>
                  </Link>
                )}

                <Link
                  href="/dashboard/admin"
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive('/dashboard/admin')
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 font-semibold shadow-sm'
                      : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 font-medium'
                  }`}
                >
                  <Shield className="w-5 h-5" />
                  <span>Admin Panel</span>
                </Link>

                <Link
                  href="/dashboard/team"
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive('/dashboard/team')
                      ? 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-600 font-semibold shadow-sm'
                      : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600 font-medium'
                  }`}
                >
                  <Building2 className="w-5 h-5" />
                  <span>Team Aziendale</span>
                </Link>

                <Link
                  href="/dashboard/listini"
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive('/dashboard/listini')
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-600 font-semibold shadow-sm'
                      : 'text-gray-700 hover:bg-green-50 hover:text-green-600 font-medium'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span>Listini</span>
                </Link>
              </nav>
            )}
          </div>
        )}

        {/* ⚙️ SEZIONE IL MIO ACCOUNT */}
        <div>
          <button
            onClick={() => setIsAccountExpanded(!isAccountExpanded)}
            className="w-full flex items-center justify-between px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 hover:text-gray-600 transition-colors"
          >
            <span>Il Mio Account</span>
            {isAccountExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {isAccountExpanded && (
            <nav className="space-y-1">
              {!isReseller && (
                <Link
                  href="/dashboard/wallet"
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive('/dashboard/wallet')
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-600 font-semibold shadow-sm'
                      : 'text-gray-700 hover:bg-green-50 hover:text-green-600 font-medium'
                  }`}
                >
                  <Wallet className="w-5 h-5" />
                  <span>Wallet</span>
                </Link>
              )}

              <Link
                href="/dashboard/dati-cliente"
                className={navItemClass('/dashboard/dati-cliente')}
              >
                <UserCircle className="w-5 h-5" />
                <span>Dati Cliente</span>
              </Link>

              <Link
                href="/dashboard/impostazioni"
                className={navItemClass('/dashboard/impostazioni')}
              >
                <Settings className="w-5 h-5" />
                <span>Impostazioni</span>
              </Link>

              <Link
                href="/dashboard/integrazioni"
                className={navItemClass('/dashboard/integrazioni')}
              >
                <Zap className="w-5 h-5" />
                <span>Integrazioni</span>
              </Link>
            </nav>
          )}
        </div>
      </div>

      {/* Footer - User Profile */}
      {session && (
        <div className="border-t border-gray-200 p-4 space-y-2">
          <Link
            href="/dashboard/dati-cliente"
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-all duration-200 group"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-semibold shadow-md">
              {session.user?.name?.[0]?.toUpperCase() || session.user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {session.user?.name || session.user?.email?.split('@')[0]}
              </p>
              <div className="flex items-center gap-1">
                <p className="text-xs text-gray-500 truncate">{session.user?.email}</p>
                {isSuperAdmin && <span className="text-xs">👑</span>}
                {isAdmin && !isSuperAdmin && <span className="text-xs">⭐</span>}
                {isReseller && <span className="text-xs">💼</span>}
              </div>
            </div>
          </Link>

          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200 font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Esci</span>
          </button>
        </div>
      )}
    </div>
  );
}
