/**
 * Dashboard Sidebar Component - Clean & Modern Design
 *
 * Sidebar minimalista e professionale con:
 * - Design pulito e moderno (ispirato a Linear/Vercel)
 * - Organizzazione logica e intuitiva
 * - Colori sobri con accenti strategici
 * - Navigazione fluida e chiara
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  Package,
  LogOut,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  getNavigationForUser,
  isNavItemActive,
  type UserRole,
  type NavSection,
} from '@/lib/config/navigationConfig';
import { cn } from '@/lib/utils';

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [accountType, setAccountType] = useState<string | null>(null);
  const [isReseller, setIsReseller] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [manuallyCollapsed, setManuallyCollapsed] = useState<Set<string>>(new Set());
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
  const navigationConfig = useMemo(() => {
    return getNavigationForUser(userRole, {
      isReseller,
    });
  }, [userRole, isReseller]);
  
  const manuallyCollapsedMemo = useMemo(() => manuallyCollapsed, [manuallyCollapsed]);

  // Auto-espandi sezioni se siamo in una pagina relativa
  useEffect(() => {
    setExpandedSections((prevExpanded) => {
      const newExpandedSections = new Set<string>();

      navigationConfig.sections.forEach((section) => {
        if (manuallyCollapsedMemo.has(section.id)) {
          return;
        }

        if (section.defaultExpanded) {
          newExpandedSections.add(section.id);
        }

        const hasActiveItem = section.items.some((item) =>
          isNavItemActive(item.href, pathname || '')
        );

        if (hasActiveItem) {
          newExpandedSections.add(section.id);
        }
      });

      return newExpandedSections;
    });
  }, [pathname, navigationConfig, manuallyCollapsedMemo]);

  // Toggle espansione sezione
  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
        setManuallyCollapsed((prevCollapsed) => {
          const newCollapsed = new Set(prevCollapsed);
          newCollapsed.add(sectionId);
          return newCollapsed;
        });
      } else {
        newSet.add(sectionId);
        setManuallyCollapsed((prevCollapsed) => {
          const newCollapsed = new Set(prevCollapsed);
          newCollapsed.delete(sectionId);
          return newCollapsed;
        });
      }
      return newSet;
    });
  };

  const isAdmin = accountType === 'admin' || accountType === 'superadmin';
  const isSuperAdmin = accountType === 'superadmin';

  return (
    <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200 z-50">
      {/* Header - Logo e Brand */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
          <Package className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">SpediRe Sicuro</h1>
          {isSuperAdmin && (
            <p className="text-[10px] text-red-600 font-medium uppercase tracking-wide">Super Admin</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {/* Dashboard - Sempre visibile in alto */}
        {navigationConfig.dashboardItem && (
          <Link
            href={navigationConfig.dashboardItem.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isNavItemActive(navigationConfig.dashboardItem.href, pathname || '')
                ? "bg-gray-100 text-gray-900"
                : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <navigationConfig.dashboardItem.icon className="w-4 h-4 flex-shrink-0" />
            <span>{navigationConfig.dashboardItem.label}</span>
          </Link>
        )}

        {/* Anne AI - Azione rapida prominente */}
        {navigationConfig.mainActions.map((action) => {
          if (action.href === '#ai-assistant') {
            return (
              <button
                key={action.id}
                onClick={() => {
                  const event = new CustomEvent('openAiAssistant');
                  window.dispatchEvent(event);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 text-white hover:from-purple-600 hover:via-purple-700 hover:to-pink-600 transition-all shadow-sm hover:shadow-md"
              >
                <action.icon className="w-4 h-4" />
                <span>{action.label}</span>
              </button>
            );
          }
          return null;
        })}

        {/* Sezioni principali */}
        {navigationConfig.sections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const hasActiveItem = section.items.some(item => 
            isNavItemActive(item.href, pathname || '')
          );
          
          return (
            <div key={section.id} className="space-y-0.5">
              {/* Section Header */}
              {section.collapsible ? (
                <button
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-gray-500 uppercase tracking-wider transition-colors",
                    hasActiveItem && "text-gray-900",
                    "hover:text-gray-900"
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  <span className="flex-1 text-left">{section.label}</span>
                </button>
              ) : (
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {section.label}
                </div>
              )}

              {/* Section Items */}
              {(!section.collapsible || isExpanded) && (
                <div className="space-y-0.5 pl-5">
                  {section.items.map((item) => {
                    const isItemActive = isNavItemActive(item.href, pathname || '');
                    const isPrimary = item.variant === 'primary' || item.variant === 'gradient';
                    
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors group",
                          isItemActive
                            ? isPrimary
                              ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-sm"
                              : "bg-gray-100 text-gray-900 font-medium"
                            : isPrimary
                            ? "text-gray-700 hover:bg-gray-50"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        )}
                        title={item.description}
                      >
                        <item.icon className={cn(
                          "w-4 h-4 flex-shrink-0",
                          isItemActive && isPrimary ? "text-white" : ""
                        )} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium",
                            isItemActive && isPrimary
                              ? "bg-white/20 text-white"
                              : "bg-gray-200 text-gray-700"
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer - User Profile */}
      {session && (
        <div className="border-t border-gray-200 bg-gray-50 p-3 space-y-1">
          <Link
            href="/dashboard/dati-cliente"
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white text-xs font-semibold">
              {session.user?.name?.[0]?.toUpperCase() || session.user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {session.user?.name || session.user?.email?.split('@')[0]}
              </p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-gray-500 truncate">{session.user?.email}</p>
                {isSuperAdmin && <span className="text-[10px]">👑</span>}
                {isAdmin && !isSuperAdmin && <span className="text-[10px]">⭐</span>}
                {isReseller && <span className="text-[10px]">💼</span>}
              </div>
            </div>
          </Link>

          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-white hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Esci</span>
          </button>
        </div>
      )}
    </div>
  );
}
