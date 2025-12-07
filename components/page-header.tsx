/**
 * Page Header Component
 *
 * Header semplice per le pagine del dashboard con:
 * - Breadcrumbs automatici
 * - Titolo e sottotitolo
 * - Bottone back
 * - Azioni custom
 */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  showBackButton?: boolean;
  actions?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  showBackButton = false,
  actions,
}: PageHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Genera breadcrumbs automatici se non forniti
  const autoBreadcrumbs: BreadcrumbItem[] = breadcrumbs || (() => {
    const paths = pathname.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [];

    if (paths.length > 1) {
      if (paths[1] === 'spedizioni') {
        items.push({ label: 'Spedizioni', href: '/dashboard/spedizioni' });
        if (paths[2] === 'nuova') {
          items.push({ label: 'Nuova Spedizione' });
        } else if (paths[2]) {
          items.push({ label: 'Dettaglio Spedizione' });
        }
      } else if (paths[1] === 'listini') {
        items.push({ label: 'Listini', href: '/dashboard/listini' });
        if (paths[2]) {
          items.push({ label: 'Dettaglio Listino' });
        }
      } else if (paths[1] === 'admin') {
        items.push({ label: 'Admin Panel' });
      } else if (paths[1] === 'super-admin') {
        items.push({ label: 'Super Admin' });
      } else if (paths[1] === 'team') {
        items.push({ label: 'Gestione Team' });
      } else if (paths[1] === 'posta') {
        items.push({ label: 'Posta' });
      } else if (paths[1] === 'integrazioni') {
        items.push({ label: 'Integrazioni' });
      } else if (paths[1] === 'impostazioni') {
        items.push({ label: 'Impostazioni' });
      } else if (paths[1] === 'dati-cliente') {
        items.push({ label: 'Dati Cliente' });
      }
    }

    return items;
  })();

  return (
    <div className="px-4 lg:px-8 py-6">
      {/* Breadcrumbs - Solo Desktop */}
      {autoBreadcrumbs.length > 0 && (
        <nav className="hidden lg:flex items-center gap-2 text-sm mb-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-gray-600 hover:text-orange-600 transition-colors duration-200 font-medium"
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>

          {autoBreadcrumbs.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-gray-400" />
              {item.href ? (
                <Link
                  href={item.href}
                  className="text-gray-600 hover:text-orange-600 transition-colors duration-200 font-medium"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-orange-600 font-semibold">
                  {item.label}
                </span>
              )}
            </div>
          ))}
        </nav>
      )}

      {/* Header con Titolo e Azioni */}
      {(title || subtitle || showBackButton || actions) && (
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {showBackButton && (
                <button
                  onClick={() => router.back()}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200 group"
                  title="Indietro"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-700 group-hover:text-orange-600 transition-colors" />
                </button>
              )}
              {title && (
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                  {title}
                </h1>
              )}
            </div>
            {subtitle && (
              <p className="text-gray-600 lg:ml-14 text-sm lg:text-base">
                {subtitle}
              </p>
            )}
          </div>

          {/* Quick Actions */}
          {actions && (
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {actions}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
