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
  Zap
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
              
              {/* User Menu (cliccabile per andare a dati-cliente) - Stile Premium */}
              {session && (
                <Link
                  href="/dashboard/dati-cliente"
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
                </Link>
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
    </div>
  );
}

