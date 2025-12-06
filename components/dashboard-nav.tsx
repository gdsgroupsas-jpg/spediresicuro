/**
 * Dashboard Navigation Component
 *
 * Sistema di navigazione premium per il dashboard con:
 * - Breadcrumbs intelligenti
 * - Navbar sticky con blur effect
 * - Quick access menu migliorato
 * - Badge ruoli dinamici
 * - Animazioni fluide
 */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import {
  Home,
  ArrowLeft,
  LayoutDashboard,
  Package,
  FileText,
  Settings,
  ChevronRight,
  LogOut,
  User,
  Plus,
  Mail,
  Zap,
  X,
  Building2,
  CreditCard,
  MapPin,
  Phone,
  Mail as MailIcon,
  FileText as FileTextIcon,
  Shield,
  Bot,
  Sparkles,
  Crown,
  Users
} from 'lucide-react';
import { PilotModal } from '@/components/ai/pilot/pilot-modal';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface DashboardNavProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  showBackButton?: boolean;
  actions?: React.ReactNode;
}

export default function DashboardNav({
  title,
  subtitle,
  breadcrumbs,
  showBackButton = true,
  actions,
}: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [showDatiClienteModal, setShowDatiClienteModal] = useState(false);
  const [datiCliente, setDatiCliente] = useState<any>(null);
  const [isLoadingDati, setIsLoadingDati] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Detect scroll per sticky navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Verifica ruolo utente
  useEffect(() => {
    async function checkUserRole() {
      if (session?.user?.email) {
        try {
          const response = await fetch('/api/user/info');
          if (response.ok) {
            const data = await response.json();
            const userData = data.user || data;
            setUserRole(userData.role || null);
            setAccountType(userData.account_type || null);
            console.log('Account Type caricato:', userData.account_type, 'Role:', userData.role);
          }
        } catch (error) {
          console.error('Errore verifica ruolo:', error);
        }
      }
    }
    checkUserRole();
  }, [session]);

  // Genera breadcrumbs automatici se non forniti
  const autoBreadcrumbs: BreadcrumbItem[] = breadcrumbs || (() => {
    const paths = pathname.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [{ label: 'Dashboard', href: '/dashboard' }];

    if (paths.length > 1) {
      if (paths[1] === 'spedizioni') {
        items.push({ label: 'Spedizioni', href: '/dashboard/spedizioni' });
        if (paths[2] === 'nuova') {
          items.push({ label: 'Nuova Spedizione', href: '/dashboard/spedizioni/nuova' });
        }
      } else if (paths[1] === 'listini') {
        items.push({ label: 'Listini', href: '/dashboard/listini' });
        if (paths[2]) {
          items.push({ label: 'Dettaglio Listino', href: `/dashboard/listini/${paths[2]}` });
        }
      } else if (paths[1] === 'admin') {
        items.push({ label: 'Admin', href: '/dashboard/admin' });
      } else if (paths[1] === 'super-admin') {
        items.push({ label: 'Super Admin', href: '/dashboard/super-admin' });
      } else if (paths[1] === 'team') {
        items.push({ label: 'Team', href: '/dashboard/team' });
      }
    }

    return items;
  })();

  return (
    <div className="mb-8 overflow-x-hidden">
      {/* Sticky Navigation Bar con Glassmorphism */}
      <div className={`sticky top-0 z-40 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-xl shadow-lg border-b border-gray-200/80'
          : 'bg-white/90 backdrop-blur-sm border-b border-gray-100'
      }`}>
        <div className="max-w-full px-4 py-2.5">
          {/* Breadcrumbs compatti */}
          <nav className="flex items-center gap-2 text-xs mb-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-gray-600 hover:text-[#FF9500] transition-colors duration-200 font-medium"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Home</span>
            </Link>

            {autoBreadcrumbs.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                {item.href && index < autoBreadcrumbs.length - 1 ? (
                  <Link
                    href={item.href}
                    className="text-gray-600 hover:text-[#FF9500] transition-colors duration-200 font-medium"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className={`font-semibold ${index === autoBreadcrumbs.length - 1 ? 'text-[#FF9500]' : 'text-gray-600'}`}>
                    {item.label}
                  </span>
                )}
              </div>
            ))}
          </nav>

          {/* Quick Links Menu - Migliorato e Responsivo */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide min-h-[44px]">
            {/* AI Assistant - Prominente */}
            <button
              onClick={() => setShowAiAssistant(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 shrink-0 text-xs font-bold whitespace-nowrap"
              title="Apri Assistente AI"
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden md:inline">AI</span>
              <Sparkles className="w-3 h-3 hidden md:inline" />
            </button>

            {/* Super Admin Dashboard - Solo per superadmin */}
            {accountType === 'superadmin' && (
              <Link
                href="/dashboard/super-admin"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 shrink-0 whitespace-nowrap ${
                  pathname === '/dashboard/super-admin'
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg scale-105'
                    : 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md hover:shadow-lg hover:scale-105'
                }`}
                title="Super Admin Dashboard"
              >
                <Crown className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Super Admin</span>
              </Link>
            )}

            {/* Admin Panel - Per admin e superadmin */}
            {(accountType === 'admin' || accountType === 'superadmin') && (
              <Link
                href="/dashboard/admin"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 shrink-0 whitespace-nowrap ${
                  pathname === '/dashboard/admin'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg scale-105'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg hover:scale-105'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}

            {/* Team Management - Per admin e superadmin */}
            {(accountType === 'admin' || accountType === 'superadmin') && (
              <Link
                href="/dashboard/team"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 shrink-0 whitespace-nowrap ${
                  pathname === '/dashboard/team'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-lg scale-105'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md hover:shadow-lg hover:scale-105'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Team</span>
              </Link>
            )}

            {/* Nuova Spedizione - CTA principale */}
            <Link
              href="/dashboard/spedizioni/nuova"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 shrink-0 whitespace-nowrap ${
                pathname === '/dashboard/spedizioni/nuova'
                  ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-lg scale-105'
                  : 'bg-gradient-to-r from-[#FFB800] to-[#FF9500] text-white shadow-md hover:shadow-lg hover:scale-105'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nuova</span>
            </Link>

            {/* Link Secondari */}
            <Link
              href="/dashboard/spedizioni"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 shrink-0 whitespace-nowrap ${
                pathname?.startsWith('/dashboard/spedizioni') && pathname !== '/dashboard/spedizioni/nuova'
                  ? 'bg-gray-200 text-gray-900 shadow-md scale-105'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:shadow-md hover:scale-105'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Spedizioni</span>
            </Link>

            <Link
              href="/dashboard"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 shrink-0 whitespace-nowrap ${
                pathname === '/dashboard'
                  ? 'bg-gray-200 text-gray-900 shadow-md scale-105'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:shadow-md hover:scale-105'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Overview</span>
            </Link>

            {/* Listini - Per superadmin e admin */}
            {(accountType === 'superadmin' || accountType === 'admin') && (
              <Link
                href="/dashboard/listini"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 shrink-0 whitespace-nowrap ${
                  pathname?.startsWith('/dashboard/listini')
                    ? 'bg-gray-200 text-gray-900 shadow-md scale-105'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:shadow-md hover:scale-105'
                }`}
                title="Gestione Listini Prezzi"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Listini</span>
              </Link>
            )}

            <Link
              href="/dashboard/posta"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 shrink-0 whitespace-nowrap ${
                pathname?.startsWith('/dashboard/posta')
                  ? 'bg-gray-200 text-gray-900 shadow-md scale-105'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:shadow-md hover:scale-105'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Posta</span>
            </Link>

            <Link
              href="/dashboard/integrazioni"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 shrink-0 whitespace-nowrap ${
                pathname?.startsWith('/dashboard/integrazioni')
                  ? 'bg-gray-200 text-gray-900 shadow-md scale-105'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:shadow-md hover:scale-105'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Integrazioni</span>
            </Link>

            <Link
              href="/dashboard/impostazioni"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 shrink-0 whitespace-nowrap ${
                pathname === '/dashboard/impostazioni'
                  ? 'bg-gray-200 text-gray-900 shadow-md scale-105'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:shadow-md hover:scale-105'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Impostazioni</span>
            </Link>

            {/* User Menu con Badge Ruolo */}
            {session && (
              <button
                onClick={async () => {
                  setShowDatiClienteModal(true);
                  setIsLoadingDati(true);
                  try {
                    const response = await fetch('/api/user/dati-cliente');
                    if (response.ok) {
                      const data = await response.json();
                      setDatiCliente(data.datiCliente);
                    }
                  } catch (error) {
                    console.error('Errore caricamento dati cliente:', error);
                  } finally {
                    setIsLoadingDati(false);
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 hover:shadow-md transition-all duration-300 shrink-0 ml-auto whitespace-nowrap"
              >
                <User className="w-3.5 h-3.5 text-gray-600" />
                <span className="text-xs font-semibold text-gray-700 hidden xl:inline max-w-[100px] truncate">
                  {session.user?.name?.split(' ')[0] || session.user?.email?.split('@')[0]}
                </span>
                {/* Badge Ruolo - Migliorato */}
                {accountType && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none ${
                    accountType === 'superadmin'
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md'
                      : accountType === 'admin'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                      : 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-sm'
                  }`}>
                    {accountType === 'superadmin' ? '👑' : accountType === 'admin' ? '⭐' : '👤'}
                  </span>
                )}
              </button>
            )}

            {/* Logout */}
            {session && (
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 hover:shadow-md transition-all duration-300 shrink-0 whitespace-nowrap"
                title="Esci"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Esci</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Header con titolo e azioni - Design Premium */}
      {(title || subtitle || showBackButton || actions) && (
        <div className="mt-6 mb-6">
          <div className="flex flex-col gap-4 p-6 rounded-2xl bg-gradient-to-br from-white via-white to-gray-50/50 backdrop-blur-xl border border-gray-200/60 shadow-xl">
            {/* Titolo e Azioni */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  {showBackButton && (
                    <button
                      onClick={() => router.back()}
                      className="p-2.5 hover:bg-gradient-to-br hover:from-[#FFD700]/20 hover:to-[#FF9500]/20 rounded-xl transition-all duration-300 group shadow-sm hover:shadow-md shrink-0"
                      title="Indietro"
                    >
                      <ArrowLeft className="w-5 h-5 text-gray-700 group-hover:text-[#FF9500] transition-all duration-300 group-hover:scale-110" />
                    </button>
                  )}
                  {title && (
                    <h1 className="text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent break-words">
                      {title}
                    </h1>
                  )}
                </div>
                {subtitle && (
                  <p className="text-gray-600 ml-0 lg:ml-14 text-base lg:text-lg font-medium">
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Quick Actions */}
              {actions && (
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto shrink-0">
                  {actions}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Dati Cliente */}
      {showDatiClienteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowDatiClienteModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header Modal */}
            <div className="sticky top-0 bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] p-6 rounded-t-2xl flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Dati Cliente</h2>
                  <p className="text-sm text-white/90">Informazioni registrate</p>
                </div>
              </div>
              <button
                onClick={() => setShowDatiClienteModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Contenuto Modal */}
            <div className="p-6">
              {isLoadingDati ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF9500] mb-4"></div>
                    <p className="text-gray-600">Caricamento dati...</p>
                  </div>
                </div>
              ) : datiCliente ? (
                <div className="space-y-6">
                  {/* Dati Anagrafici */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                    <div className="flex items-center gap-2 mb-4">
                      <User className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-bold text-gray-900">Dati Anagrafici</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Nome</p>
                        <p className="font-semibold text-gray-900">{datiCliente.nome || '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Cognome</p>
                        <p className="font-semibold text-gray-900">{datiCliente.cognome || '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Codice Fiscale</p>
                        <p className="font-semibold text-gray-900">{datiCliente.codiceFiscale || '—'}</p>
                      </div>
                      {datiCliente.dataNascita && (
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Data di Nascita</p>
                          <p className="font-semibold text-gray-900">{new Date(datiCliente.dataNascita).toLocaleDateString('it-IT')}</p>
                        </div>
                      )}
                      {datiCliente.luogoNascita && (
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Luogo di Nascita</p>
                          <p className="font-semibold text-gray-900">{datiCliente.luogoNascita}</p>
                        </div>
                      )}
                      {datiCliente.sesso && (
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Sesso</p>
                          <p className="font-semibold text-gray-900">{datiCliente.sesso === 'M' ? 'Maschio' : 'Femmina'}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contatti */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                    <div className="flex items-center gap-2 mb-4">
                      <Phone className="w-5 h-5 text-green-600" />
                      <h3 className="text-lg font-bold text-gray-900">Contatti</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Telefono</p>
                        <p className="font-semibold text-gray-900">{datiCliente.telefono || '—'}</p>
                      </div>
                      {datiCliente.cellulare && (
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Cellulare</p>
                          <p className="font-semibold text-gray-900">{datiCliente.cellulare}</p>
                        </div>
                      )}
                      <div className="md:col-span-2">
                        <p className="text-sm text-gray-600 mb-1">Email</p>
                        <p className="font-semibold text-gray-900">{datiCliente.email || '—'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Indirizzo */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin className="w-5 h-5 text-purple-600" />
                      <h3 className="text-lg font-bold text-gray-900">Indirizzo</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <p className="text-sm text-gray-600 mb-1">Indirizzo</p>
                        <p className="font-semibold text-gray-900">{datiCliente.indirizzo || '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Città</p>
                        <p className="font-semibold text-gray-900">{datiCliente.citta || '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Provincia</p>
                        <p className="font-semibold text-gray-900">{datiCliente.provincia || '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">CAP</p>
                        <p className="font-semibold text-gray-900">{datiCliente.cap || '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Nazione</p>
                        <p className="font-semibold text-gray-900">{datiCliente.nazione || 'Italia'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Dati Azienda (se presente) */}
                  {datiCliente.tipoCliente === 'azienda' && (datiCliente.ragioneSociale || datiCliente.partitaIva) && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-100">
                      <div className="flex items-center gap-2 mb-4">
                        <Building2 className="w-5 h-5 text-amber-600" />
                        <h3 className="text-lg font-bold text-gray-900">Dati Azienda</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {datiCliente.ragioneSociale && (
                          <div className="md:col-span-2">
                            <p className="text-sm text-gray-600 mb-1">Ragione Sociale</p>
                            <p className="font-semibold text-gray-900">{datiCliente.ragioneSociale}</p>
                          </div>
                        )}
                        {datiCliente.partitaIva && (
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Partita IVA</p>
                            <p className="font-semibold text-gray-900">{datiCliente.partitaIva}</p>
                          </div>
                        )}
                        {datiCliente.codiceSDI && (
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Codice SDI</p>
                            <p className="font-semibold text-gray-900">{datiCliente.codiceSDI}</p>
                          </div>
                        )}
                        {datiCliente.pec && (
                          <div className="md:col-span-2">
                            <p className="text-sm text-gray-600 mb-1">PEC</p>
                            <p className="font-semibold text-gray-900">{datiCliente.pec}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dati Bancari (se presenti) */}
                  {(datiCliente.iban || datiCliente.banca) && (
                    <div className="bg-gradient-to-br from-cyan-50 to-teal-50 rounded-xl p-6 border border-cyan-100">
                      <div className="flex items-center gap-2 mb-4">
                        <CreditCard className="w-5 h-5 text-cyan-600" />
                        <h3 className="text-lg font-bold text-gray-900">Dati Bancari</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {datiCliente.iban && (
                          <div>
                            <p className="text-sm text-gray-600 mb-1">IBAN</p>
                            <p className="font-semibold text-gray-900">{datiCliente.iban}</p>
                          </div>
                        )}
                        {datiCliente.banca && (
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Banca</p>
                            <p className="font-semibold text-gray-900">{datiCliente.banca}</p>
                          </div>
                        )}
                        {datiCliente.nomeIntestatario && (
                          <div className="md:col-span-2">
                            <p className="text-sm text-gray-600 mb-1">Intestatario</p>
                            <p className="font-semibold text-gray-900">{datiCliente.nomeIntestatario}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Documento Identità (se presente) */}
                  {datiCliente.documentoIdentita && (
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-100">
                      <div className="flex items-center gap-2 mb-4">
                        <FileTextIcon className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-lg font-bold text-gray-900">Documento Identità</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Tipo Documento</p>
                          <p className="font-semibold text-gray-900">
                            {datiCliente.documentoIdentita.tipo === 'carta_identita' ? 'Carta d\'Identità' :
                             datiCliente.documentoIdentita.tipo === 'patente' ? 'Patente' :
                             datiCliente.documentoIdentita.tipo === 'passaporto' ? 'Passaporto' : '—'}
                          </p>
                        </div>
                        {datiCliente.documentoIdentita.numero && (
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Numero</p>
                            <p className="font-semibold text-gray-900">{datiCliente.documentoIdentita.numero}</p>
                          </div>
                        )}
                        {datiCliente.documentoIdentita.rilasciatoDa && (
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Rilasciato da</p>
                            <p className="font-semibold text-gray-900">{datiCliente.documentoIdentita.rilasciatoDa}</p>
                          </div>
                        )}
                        {datiCliente.documentoIdentita.dataRilascio && (
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Data Rilascio</p>
                            <p className="font-semibold text-gray-900">{new Date(datiCliente.documentoIdentita.dataRilascio).toLocaleDateString('it-IT')}</p>
                          </div>
                        )}
                        {datiCliente.documentoIdentita.dataScadenza && (
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Data Scadenza</p>
                            <p className="font-semibold text-gray-900">{new Date(datiCliente.documentoIdentita.dataScadenza).toLocaleDateString('it-IT')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bottone per modificare */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setShowDatiClienteModal(false);
                        router.push('/dashboard/dati-cliente');
                      }}
                      className="px-6 py-2.5 bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105"
                    >
                      Modifica Dati
                    </button>
                    <button
                      onClick={() => setShowDatiClienteModal(false)}
                      className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all duration-300"
                    >
                      Chiudi
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">Nessun dato cliente registrato</p>
                  <button
                    onClick={() => {
                      setShowDatiClienteModal(false);
                      router.push('/dashboard/dati-cliente');
                    }}
                    className="px-6 py-2.5 bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105"
                  >
                    Registra Dati Cliente
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Modal */}
      {session?.user && (
        <PilotModal
          isOpen={showAiAssistant}
          onClose={() => setShowAiAssistant(false)}
          userId={session.user.id || ''}
          userRole={(accountType as 'admin' | 'user') || (userRole as 'admin' | 'user') || 'user'}
          userName={session.user.name || session.user.email || 'Utente'}
        />
      )}

      {/* Scrollbar Hide CSS */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
