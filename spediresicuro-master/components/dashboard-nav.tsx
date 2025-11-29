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
  User
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
    <div className="mb-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-gray-600 mb-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 hover:text-[#FF9500] transition-colors"
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
                className="hover:text-[#FF9500] transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={index === autoBreadcrumbs.length - 1 ? 'text-gray-900 font-medium' : ''}>
                {item.label}
              </span>
            )}
          </div>
        ))}
      </nav>

      {/* Header con titolo e azioni */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {showBackButton && (
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
                title="Indietro"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-[#FF9500] transition-colors" />
              </button>
            )}
            {title && (
              <h1 className="text-3xl font-bold text-gray-900">
                {title}
              </h1>
            )}
          </div>
          {subtitle && (
            <p className="text-gray-600 ml-11">
              {subtitle}
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          {actions}
          
          {/* User Menu */}
          {session && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <User className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700 hidden sm:inline">
                {session.user?.name || session.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="p-1.5 hover:bg-red-50 rounded-md transition-colors group"
                title="Esci"
              >
                <LogOut className="w-4 h-4 text-gray-600 group-hover:text-red-600 transition-colors" />
              </button>
            </div>
          )}
          
          {/* Quick Links Menu */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/dashboard"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                pathname === '/dashboard'
                  ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 inline mr-1.5" />
              Overview
            </Link>
            
            <Link
              href="/dashboard/spedizioni"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                pathname?.startsWith('/dashboard/spedizioni')
                  ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Package className="w-4 h-4 inline mr-1.5" />
              Spedizioni
            </Link>
            
            <Link
              href="/preventivo"
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all"
            >
              <FileText className="w-4 h-4 inline mr-1.5" />
              Preventivi
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Quick Links */}
      <div className="md:hidden mt-4 flex items-center gap-2 overflow-x-auto pb-2">
        <Link
          href="/dashboard"
          className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
            pathname === '/dashboard'
              ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-sm'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          <LayoutDashboard className="w-3 h-3 inline mr-1" />
          Overview
        </Link>
        
        <Link
          href="/dashboard/spedizioni"
          className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
            pathname?.startsWith('/dashboard/spedizioni')
              ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-sm'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          <Package className="w-3 h-3 inline mr-1" />
          Spedizioni
        </Link>
        
        <Link
          href="/preventivo"
          className="px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap bg-gray-100 text-gray-700"
        >
          <FileText className="w-3 h-3 inline mr-1" />
          Preventivi
        </Link>
      </div>
    </div>
  );
}

