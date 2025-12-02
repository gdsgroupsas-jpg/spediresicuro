/**
 * Dashboard Navigation Component
 * 
 * Sistema di navigazione premium per il dashboard con:
 * - Breadcrumbs
 * - Pulsante Indietro
 * - Link rapidi alle sezioni principali
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
  FileText as FileTextIcon
} from 'lucide-react';

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
      }
    }
    
    return items;
  })();

  return (
    <div className="mb-8 overflow-x-hidden">
      {/* Breadcrumbs con glassmorphism */}
      <nav className="flex items-center gap-2 text-sm mb-6 px-4 py-2 rounded-xl bg-white/80 backdrop-blur-md border border-gray-200/50 shadow-sm w-fit max-w-full overflow-x-auto">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-gray-700 hover:text-[#FF9500] transition-all duration-200 font-medium px-2 py-1 rounded-lg hover:bg-[#FFD700]/10"
        >
          <Home className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>
        
        {autoBreadcrumbs.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-gray-400" />
            {item.href && index < autoBreadcrumbs.length - 1 ? (
              <Link
                href={item.href}
                className="text-gray-600 hover:text-[#FF9500] transition-all duration-200 px-2 py-1 rounded-lg hover:bg-[#FFD700]/10 font-medium"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`px-2 py-1 rounded-lg ${index === autoBreadcrumbs.length - 1 ? 'text-gray-900 font-bold bg-gradient-to-r from-[#FFD700]/20 to-[#FF9500]/20' : 'text-gray-600'}`}>
                {item.label}
              </span>
            )}
          </div>
        ))}
      </nav>

      {/* Header con titolo e azioni - Design Premium */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 p-6 rounded-2xl bg-gradient-to-br from-white via-white to-gray-50/50 backdrop-blur-xl border border-gray-200/60 shadow-xl overflow-hidden">
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

            {/* Quick Actions - Design Premium con Glassmorphism */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto shrink-0">
              {actions}
              
              {/* User Menu (cliccabile per mostrare dati cliente) - Stile Premium */}
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
                  className={`flex items-center gap-2 px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl border transition-all duration-300 cursor-pointer backdrop-blur-sm shrink-0 ${
                    pathname === '/dashboard/dati-cliente'
                      ? 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] text-white border-transparent shadow-lg shadow-[#FF9500]/30 hover:shadow-xl hover:shadow-[#FF9500]/40 transform hover:scale-105'
                      : 'bg-white/80 border-gray-200/60 hover:bg-gradient-to-r hover:from-[#FFD700]/10 hover:to-[#FF9500]/10 text-gray-700 shadow-sm hover:shadow-md'
                  }`}
                >
                  <User className={`w-4 h-4 transition-transform duration-300 ${pathname === '/dashboard/dati-cliente' ? 'text-white' : 'text-gray-600'}`} />
                  <span className={`text-xs lg:text-sm font-semibold hidden lg:inline ${pathname === '/dashboard/dati-cliente' ? 'text-white' : 'text-gray-700'}`}>
                    {session.user?.name || session.user?.email}
                  </span>
                </button>
              )}
            </div>
          </div>
          
          {/* Quick Links Menu - Design Premium con Animazioni - Separato e scrollabile */}
          <div className="hidden lg:flex items-center gap-2 bg-white/60 backdrop-blur-md px-3 py-2 rounded-xl border border-gray-200/50 shadow-lg overflow-x-auto max-w-full mt-4">
            <Link
              href="/dashboard/spedizioni/nuova"
              className={`px-3 py-2 rounded-lg text-xs lg:text-sm font-semibold transition-all duration-300 relative overflow-hidden group shrink-0 whitespace-nowrap ${
                pathname === '/dashboard/spedizioni/nuova'
                  ? 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] text-white shadow-lg shadow-[#FF9500]/30 transform scale-105'
                  : 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] text-white shadow-lg shadow-[#FF9500]/30 hover:scale-105'
              }`}
            >
              <span className="relative z-10 flex items-center">
                <Plus className="w-3 h-3 lg:w-4 lg:h-4 inline mr-1 lg:mr-1.5" />
                <span className="hidden sm:inline">Nuova Spedizione</span>
                <span className="sm:hidden">Nuova</span>
              </span>
            </Link>
            
            <Link
              href="/dashboard/spedizioni"
              className={`px-3 py-2 rounded-lg text-xs lg:text-sm font-semibold transition-all duration-300 shrink-0 whitespace-nowrap ${
                pathname?.startsWith('/dashboard/spedizioni') && pathname !== '/dashboard/spedizioni/nuova'
                  ? 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] text-white shadow-lg shadow-[#FF9500]/30 transform scale-105'
                  : 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] text-white shadow-lg shadow-[#FF9500]/30 hover:scale-105'
              }`}
            >
              <Package className="w-3 h-3 lg:w-4 lg:h-4 inline mr-1 lg:mr-1.5" />
              <span className="hidden sm:inline">Lista Spedizioni</span>
              <span className="sm:hidden">Lista</span>
            </Link>
            
            <Link
              href="/dashboard"
              className={`px-3 py-2 rounded-lg text-xs lg:text-sm font-semibold transition-all duration-300 shrink-0 whitespace-nowrap ${
                pathname === '/dashboard'
                  ? 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] text-white shadow-lg shadow-[#FF9500]/30 transform scale-105'
                  : 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] text-white shadow-lg shadow-[#FF9500]/30 hover:scale-105'
              }`}
            >
              <LayoutDashboard className="w-3 h-3 lg:w-4 lg:h-4 inline mr-1 lg:mr-1.5" />
              Overview
            </Link>
            
            <Link
              href="/dashboard/posta"
              className={`px-3 py-2 rounded-lg text-xs lg:text-sm font-semibold transition-all duration-300 shrink-0 whitespace-nowrap ${
                pathname?.startsWith('/dashboard/posta')
                  ? 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] text-white shadow-lg shadow-[#FF9500]/30 transform scale-105'
                  : 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] text-white shadow-lg shadow-[#FF9500]/30 hover:scale-105'
              }`}
            >
              <Mail className="w-3 h-3 lg:w-4 lg:h-4 inline mr-1 lg:mr-1.5" />
              Posta
            </Link>
            
            <Link
              href="/dashboard/integrazioni"
              className={`px-3 py-2 rounded-lg text-xs lg:text-sm font-semibold transition-all duration-300 shrink-0 whitespace-nowrap ${
                pathname?.startsWith('/dashboard/integrazioni')
                  ? 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] text-white shadow-lg shadow-[#FF9500]/30 transform scale-105'
                  : 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] text-white shadow-lg shadow-[#FF9500]/30 hover:scale-105'
              }`}
            >
              <Zap className="w-3 h-3 lg:w-4 lg:h-4 inline mr-1 lg:mr-1.5" />
              <span className="hidden sm:inline">Integrazioni</span>
              <span className="sm:hidden">Integr.</span>
            </Link>
            
            <Link
              href="/dashboard/impostazioni"
              className={`px-3 py-2 rounded-lg text-xs lg:text-sm font-semibold transition-all duration-300 shrink-0 whitespace-nowrap ${
                pathname === '/dashboard/impostazioni'
                  ? 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] text-white shadow-lg shadow-[#FF9500]/30 transform scale-105'
                  : 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] text-white shadow-lg shadow-[#FF9500]/30 hover:scale-105'
              }`}
            >
              <Settings className="w-3 h-3 lg:w-4 lg:h-4 inline mr-1 lg:mr-1.5" />
              <span className="hidden sm:inline">Impostazioni</span>
              <span className="sm:hidden">Impost.</span>
            </Link>
            
            {session && (
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="px-3 py-2 rounded-lg text-xs lg:text-sm font-semibold text-gray-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 hover:text-red-600 transition-all duration-300 hover:shadow-md shrink-0 whitespace-nowrap"
                title="Esci"
              >
                <LogOut className="w-3 h-3 lg:w-4 lg:h-4 inline mr-1 lg:mr-1.5" />
                Logout
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Quick Links - Design Premium Mobile - Tutti evidenziati */}
      <div className="lg:hidden mt-4 flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-3 py-2 rounded-xl border border-gray-200/50 shadow-lg min-w-fit shrink-0">
          <Link
            href="/dashboard/spedizioni/nuova"
            className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-300 ${
              pathname === '/dashboard/spedizioni/nuova'
                ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-md transform scale-105'
                : 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-md hover:scale-105'
            }`}
          >
            <Plus className="w-3 h-3 inline mr-1" />
            Nuova Spedizione
          </Link>
          
          <Link
            href="/dashboard/spedizioni"
            className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-300 ${
              pathname?.startsWith('/dashboard/spedizioni') && pathname !== '/dashboard/spedizioni/nuova'
                ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-md transform scale-105'
                : 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-md hover:scale-105'
            }`}
          >
            <Package className="w-3 h-3 inline mr-1" />
            Lista Spedizioni
          </Link>
          
          <Link
            href="/dashboard"
            className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-300 ${
              pathname === '/dashboard'
                ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-md transform scale-105'
                : 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-md hover:scale-105'
            }`}
          >
            <LayoutDashboard className="w-3 h-3 inline mr-1" />
            Overview
          </Link>
          
          <Link
            href="/dashboard/posta"
            className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-300 ${
              pathname?.startsWith('/dashboard/posta')
                ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-md transform scale-105'
                : 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-md hover:scale-105'
            }`}
          >
            <Mail className="w-3 h-3 inline mr-1" />
            Posta
          </Link>
          
          <Link
            href="/dashboard/integrazioni"
            className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-300 ${
              pathname?.startsWith('/dashboard/integrazioni')
                ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-md transform scale-105'
                : 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-md hover:scale-105'
            }`}
          >
            <Zap className="w-3 h-3 inline mr-1" />
            Integrazioni
          </Link>
          
          <Link
            href="/dashboard/impostazioni"
            className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-300 ${
              pathname === '/dashboard/impostazioni'
                ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-md transform scale-105'
                : 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-md hover:scale-105'
            }`}
          >
            <Settings className="w-3 h-3 inline mr-1" />
            Impostazioni
          </Link>
          
          {session && (
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap bg-white/60 text-gray-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 hover:text-red-600 transition-all duration-300"
              title="Esci"
            >
              <LogOut className="w-3 h-3 inline mr-1" />
              Logout
            </button>
          )}
        </div>
      </div>

      {/* Modal Dati Cliente */}
      {showDatiClienteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowDatiClienteModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header Modal */}
            <div className="sticky top-0 bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] p-6 rounded-t-2xl flex items-center justify-between">
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
    </div>
  );
}

