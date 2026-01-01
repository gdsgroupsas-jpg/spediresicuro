/**
 * Dashboard Mobile Navigation Component
 *
 * Bottom navigation bar per mobile con:
 * - 5 azioni principali sempre visibili
 * - Menu drawer per funzioni secondarie
 * - Design iOS/Android style
 * - Icone chiare e touch-friendly
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  Home,
  Package,
  Plus,
  Mail,
  Menu,
  X,
  Bot,
  Zap,
  Settings,
  FileText,
  Shield,
  Users,
  Crown,
  User,
  LogOut,
  ChevronRight,
  BookOpen,
  Ghost,
} from 'lucide-react';

export default function DashboardMobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [accountType, setAccountType] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Carica il tipo di account
  useEffect(() => {
    async function loadAccountType() {
      if (session?.user?.email) {
        try {
          const response = await fetch('/api/user/info');
          if (response.ok) {
            const data = await response.json();
            const userData = data.user || data;
            setAccountType(userData.account_type || null);
          }
        } catch (error) {
          console.error('Errore caricamento account type:', error);
        }
      }
    }
    loadAccountType();
  }, [session]);

  // Chiudi menu quando cambia la pagina
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Previeni scroll quando menu è aperto
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname?.startsWith(path);
  };

  const isAdmin = accountType === 'admin' || accountType === 'superadmin';
  const isSuperAdmin = accountType === 'superadmin';

  return (
    <>
      {/* Bottom Navigation Bar - Fixed con grafica migliorata */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-gray-50 border-t-2 border-gray-200 z-50 safe-area-inset-bottom shadow-2xl">
        <div className="flex items-center justify-around px-2 py-2">
          {/* Home */}
          <Link
            href="/dashboard"
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 ${
              isActive('/dashboard') && pathname === '/dashboard'
                ? 'text-orange-600 bg-orange-50 scale-105'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Home className={`w-6 h-6 transition-all ${isActive('/dashboard') && pathname === '/dashboard' ? 'fill-orange-600 drop-shadow-md' : ''}`} />
            <span className="text-[10px] font-semibold">Home</span>
          </Link>

          {/* Spedizioni */}
          <Link
            href="/dashboard/spedizioni"
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 ${
              isActive('/dashboard/spedizioni') && pathname !== '/dashboard/spedizioni/nuova'
                ? 'text-orange-600 bg-orange-50 scale-105'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Package className={`w-6 h-6 transition-all ${isActive('/dashboard/spedizioni') && pathname !== '/dashboard/spedizioni/nuova' ? 'fill-orange-600 drop-shadow-md' : ''}`} />
            <span className="text-[10px] font-semibold">Spedizioni</span>
          </Link>

          {/* Nuova Spedizione - CTA Centrale con animazione migliorata */}
          <Link
            href="/dashboard/spedizioni/nuova"
            className="flex flex-col items-center gap-1 -mt-4"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 transform ${
              isActive('/dashboard/spedizioni/nuova')
                ? 'bg-gradient-to-br from-orange-600 to-amber-600 scale-110 rotate-6'
                : 'bg-gradient-to-br from-orange-500 to-amber-500 hover:scale-110 hover:rotate-3'
            }`}>
              <Plus className="w-7 h-7 text-white drop-shadow-lg" strokeWidth={3} />
            </div>
            <span className="text-[10px] font-bold text-orange-600 mt-1">Nuova</span>
          </Link>

          {/* Posta */}
          <Link
            href="/dashboard/posta"
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 ${
              isActive('/dashboard/posta')
                ? 'text-orange-600 bg-orange-50 scale-105'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Mail className={`w-6 h-6 transition-all ${isActive('/dashboard/posta') ? 'fill-orange-600 drop-shadow-md' : ''}`} />
            <span className="text-[10px] font-semibold">Posta</span>
          </Link>

          {/* Menu */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 hover:bg-gray-100"
          >
            <div className="relative">
              <Menu className="w-6 h-6 text-gray-600" />
              {(isAdmin || isSuperAdmin) && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
              )}
            </div>
            <span className="text-[10px] font-semibold text-gray-600">Menu</span>
          </button>
        </div>
      </div>

      {/* Menu Drawer - Slide from Right */}
      {isMenuOpen && (
        <>
          {/* Backdrop con animazione */}
          <div
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity animate-in fade-in-0 duration-200"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Drawer con animazione slide */}
          <div className="lg:hidden fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-white z-50 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* Header con design migliorato */}
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-amber-600 p-6 flex items-center justify-between shadow-lg z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Menu className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Menu</h2>
                  <p className="text-sm text-white/90">Navigazione completa</p>
                </div>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-all duration-200 active:scale-95"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* User Info con design migliorato */}
            {session && (
              <Link
                href="/dashboard/dati-cliente"
                className="flex items-center gap-3 p-6 border-b-2 border-gray-100 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 transition-all duration-200 group"
                onClick={() => setIsMenuOpen(false)}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform duration-200">
                  {session.user?.name?.[0]?.toUpperCase() || session.user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-orange-600 transition-colors">
                    {session.user?.name || session.user?.email?.split('@')[0]}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-gray-500 truncate">{session.user?.email}</p>
                    {accountType && (
                      <span className="text-xs">
                        {accountType === 'superadmin' ? '👑' : accountType === 'admin' ? '⭐' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </Link>
            )}

            {/* Menu Items */}
            <div className="p-4 space-y-6">
              {/* Azioni Rapide */}
              <div>
                <h3 className="px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Azioni Rapide
                </h3>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      const event = new CustomEvent('openAiAssistant');
                      window.dispatchEvent(event);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:shadow-lg transition-all duration-200"
                  >
                    <Bot className="w-5 h-5" />
                    <span>AI Assistant</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      const event = new CustomEvent('openAnneAssistant');
                      window.dispatchEvent(event);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:shadow-lg transition-all duration-200"
                  >
                    <Ghost className="w-5 h-5" />
                    <span>Anne Assistant</span>
                  </button>
                </div>
              </div>

              {/* Gestione */}
              <div>
                <h3 className="px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Gestione
                </h3>
                <nav className="space-y-1">
                  <Link
                    href="/dashboard/integrazioni"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive('/dashboard/integrazioni')
                        ? 'bg-orange-50 text-orange-600 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Zap className="w-5 h-5" />
                    <span>Integrazioni</span>
                  </Link>

                  <Link
                    href="/dashboard/impostazioni"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive('/dashboard/impostazioni')
                        ? 'bg-orange-50 text-orange-600 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Settings className="w-5 h-5" />
                    <span>Impostazioni</span>
                  </Link>
                </nav>
              </div>

              {/* Supporto */}
              <div>
                <h3 className="px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Supporto
                </h3>
                <nav className="space-y-1">
                  <Link
                    href="/manuale"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-gray-50 transition-all duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <BookOpen className="w-5 h-5" />
                    <span>Manuale Utente</span>
                  </Link>
                </nav>
              </div>

              {/* Amministrazione - Solo Admin */}
              {isAdmin && (
                <div>
                  <h3 className="px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    Amministrazione
                  </h3>
                  <nav className="space-y-1">
                    {isSuperAdmin && (
                      <Link
                        href="/dashboard/super-admin"
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                          isActive('/dashboard/super-admin')
                            ? 'bg-red-50 text-red-600 font-semibold'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <Crown className="w-5 h-5" />
                        <span>Super Admin</span>
                      </Link>
                    )}

                    <Link
                      href="/dashboard/admin"
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                        isActive('/dashboard/admin')
                          ? 'bg-blue-50 text-blue-600 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Shield className="w-5 h-5" />
                      <span>Admin Panel</span>
                    </Link>

                    <Link
                      href="/dashboard/team"
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                        isActive('/dashboard/team')
                          ? 'bg-purple-50 text-purple-600 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Users className="w-5 h-5" />
                      <span>Team</span>
                    </Link>

                    <Link
                      href="/dashboard/listini"
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                        isActive('/dashboard/listini')
                          ? 'bg-green-50 text-green-600 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <FileText className="w-5 h-5" />
                      <span>Listini</span>
                    </Link>
                  </nav>
                </div>
              )}

              {/* Profilo */}
              <div>
                <h3 className="px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Profilo
                </h3>
                <nav className="space-y-1">
                  <Link
                    href="/dashboard/dati-cliente"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-gray-50 transition-all duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <User className="w-5 h-5" />
                    <span>Dati Cliente</span>
                  </Link>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      signOut({ callbackUrl: '/' });
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200 font-medium"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Esci</span>
                  </button>
                </nav>
              </div>
            </div>

            {/* Footer con versione */}
            <div className="p-6 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">
                SpediRe Sicuro Dashboard v2.0
              </p>
            </div>
          </div>
        </>
      )}

      {/* Spacer per evitare che il contenuto vada sotto la bottom nav */}
      <div className="lg:hidden h-20" />
    </>
  );
}
