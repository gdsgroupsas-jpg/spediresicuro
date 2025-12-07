/**
 * Dashboard Sidebar Component - Redesigned
 *
 * Sidebar moderna con:
 * - Navigazione organizzata gerarchicamente per ruolo
 * - Sezioni collassabili
 * - Design marketing-oriented
 * - Icone e colori distintivi
 * - Configurazione dinamica tramite navigationConfig
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  Package,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  getNavigationForUser,
  isNavItemActive,
  navItemVariants,
  type UserRole,
  type NavSection,
} from '@/lib/config/navigationConfig';

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [accountType, setAccountType] = useState<string | null>(null);
  const [isReseller, setIsReseller] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
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

  // Ottieni la configurazione di navigazione per l'utente corrente
  const userRole: UserRole = (accountType as UserRole) || 'user';
  const navigationConfig = getNavigationForUser(userRole, {
    isReseller,
  });

  // Auto-espandi sezioni se siamo in una pagina relativa
  useEffect(() => {
    const newExpandedSections = new Set<string>();

    navigationConfig.sections.forEach((section) => {
      // Espandi automaticamente se defaultExpanded è true
      if (section.defaultExpanded) {
        newExpandedSections.add(section.id);
      }

      // Espandi se una delle voci è attiva
      const hasActiveItem = section.items.some((item) =>
        isNavItemActive(item.href, pathname || '')
      );

      if (hasActiveItem) {
        newExpandedSections.add(section.id);
      }
    });

    setExpandedSections(newExpandedSections);
  }, [pathname, navigationConfig]);

  // Toggle espansione sezione
  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Helper per ottenere le classi CSS di un nav item
  const getNavItemClass = (href: string, variant: string = 'default') => {
    const isActive = isNavItemActive(href, pathname || '');
    const variantStyles = navItemVariants[variant as keyof typeof navItemVariants] || navItemVariants.default;

    return `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      isActive ? variantStyles.active : variantStyles.inactive
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
        {/* Main Actions */}
        {navigationConfig.mainActions.map((action) => (
          <div key={action.id}>
            {action.href === '#ai-assistant' ? (
              <button
                onClick={() => {
                  const event = new CustomEvent('openAiAssistant');
                  window.dispatchEvent(event);
                }}
                className={getNavItemClass(action.href, action.variant)}
                title={action.description}
              >
                <action.icon className="w-5 h-5" />
                <span>{action.label}</span>
                {action.badge && (
                  <span className="ml-auto text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                    {action.badge}
                  </span>
                )}
              </button>
            ) : (
              <Link
                href={action.href}
                className={getNavItemClass(action.href, action.variant)}
                title={action.description}
              >
                <action.icon className="w-5 h-5" />
                <span>{action.label}</span>
                {action.badge && (
                  <span className="ml-auto text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                    {action.badge}
                  </span>
                )}
              </Link>
            )}
          </div>
        ))}

        {/* Sections */}
        {navigationConfig.sections.map((section) => (
          <div key={section.id}>
            {/* Section Header */}
            {section.collapsible ? (
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 hover:text-gray-600 transition-colors"
              >
                <span>{section.label}</span>
                {expandedSections.has(section.id) ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            ) : (
              <h3 className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                {section.label}
              </h3>
            )}

            {/* Section Items */}
            {(!section.collapsible || expandedSections.has(section.id)) && (
              <nav className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={getNavItemClass(item.href, item.variant)}
                    title={item.description}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        ))}
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
