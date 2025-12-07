/**
 * Dashboard Top Bar Component
 *
 * Top bar minimale per desktop/mobile con:
 * - Breadcrumbs (solo desktop)
 * - Titolo pagina e azioni
 * - Bottone AI Assistant
 * - Notifiche (futuro)
 */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Home,
  ChevronRight,
  ArrowLeft,
  Bot,
  Sparkles,
  Bell,
} from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface DashboardTopBarProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  showBackButton?: boolean;
  actions?: React.ReactNode;
  showAiButton?: boolean;
}

export default function DashboardTopBar({
  title,
  subtitle,
  breadcrumbs,
  showBackButton = false,
  actions,
  showAiButton = true,
}: DashboardTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);

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

  const handleOpenAiAssistant = () => {
    const event = new CustomEvent('openAiAssistant');
    window.dispatchEvent(event);
  };

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Top Bar per Mobile e Desktop */}
      <div className="px-4 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left Side - Mobile: Logo, Desktop: Breadcrumbs */}
          <div className="flex-1 min-w-0">
            {/* Breadcrumbs - Solo Desktop */}
            {autoBreadcrumbs.length > 0 && (
              <nav className="hidden lg:flex items-center gap-2 text-sm mb-2">
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

            {/* Mobile: Logo */}
            <Link
              href="/dashboard"
              className="lg:hidden flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">SR</span>
              </div>
              <span className="text-lg font-bold text-gray-900">SpediRe Sicuro</span>
            </Link>
          </div>

          {/* Right Side - Actions */}
          <div className="flex items-center gap-2">
            {/* AI Assistant Button */}
            {showAiButton && (
              <button
                onClick={handleOpenAiAssistant}
                className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
                title="Apri AI Assistant"
              >
                <Bot className="w-5 h-5" />
                <span>AI Assistant</span>
                <Sparkles className="w-4 h-4" />
              </button>
            )}

            {/* Mobile: AI Button (icon only) */}
            {showAiButton && (
              <button
                onClick={handleOpenAiAssistant}
                className="lg:hidden p-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md hover:shadow-lg transition-all duration-200"
                title="Apri AI Assistant"
              >
                <Bot className="w-5 h-5" />
              </button>
            )}

            {/* Notifications */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-colors duration-200"
              title="Notifiche"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {/* Badge per notifiche non lette */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </div>
      </div>

      {/* Header con Titolo e Azioni - Opzionale */}
      {(title || subtitle || showBackButton || actions) && (
        <div className="px-4 lg:px-8 py-6 border-t border-gray-100">
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
        </div>
      )}
    </div>
  );
}
