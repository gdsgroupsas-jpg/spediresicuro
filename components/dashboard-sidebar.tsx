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
import { useState, useEffect, useMemo } from 'react';
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
  // ⚠️ Usa useMemo per evitare ricreazioni ad ogni render (risolve "Maximum update depth exceeded")
  const userRole: UserRole = (accountType as UserRole) || 'user';
  const navigationConfig = useMemo(() => {
    return getNavigationForUser(userRole, {
      isReseller,
    });
  }, [userRole, isReseller]);
  
  // ⚠️ Memoizza anche manuallyCollapsed per stabilità
  const manuallyCollapsedMemo = useMemo(() => manuallyCollapsed, [manuallyCollapsed]);

  // Auto-espandi sezioni se siamo in una pagina relativa (rispetta scelte manuali)
  // ⚠️ Usa functional update per setExpandedSections e dipendenze stabili
  useEffect(() => {
    setExpandedSections((prevExpanded) => {
      const newExpandedSections = new Set<string>();

      navigationConfig.sections.forEach((section) => {
        // Se l'utente ha manualmente chiuso questa sezione, non riaprirla automaticamente
        if (manuallyCollapsedMemo.has(section.id)) {
          return;
        }

        // Espandi automaticamente se defaultExpanded è true
        if (section.defaultExpanded) {
          newExpandedSections.add(section.id);
        }

        // Espandi se una delle voci è attiva (sempre, anche se chiusa manualmente)
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
        // Chiudendo manualmente, segna come collassata manualmente
        newSet.delete(sectionId);
        setManuallyCollapsed((prevCollapsed) => {
          const newCollapsed = new Set(prevCollapsed);
          newCollapsed.add(sectionId);
          return newCollapsed;
        });
      } else {
        // Aprendo manualmente, rimuovi dal set delle collassate manualmente
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
    <div className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-0 bg-gradient-to-b from-gray-50 to-white border-r border-gray-200 shadow-sm z-50">
      {/* Logo/Brand con SuperAdmin Badge */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">SpediRe Sicuro</h1>
            <p className="text-xs text-gray-500">Dashboard Pro</p>
          </div>
        </div>
        {isSuperAdmin && (
          <div className="px-2 py-1 rounded-md bg-gradient-to-r from-red-500 to-rose-600 shadow-md">
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Super</span>
          </div>
        )}
      </div>

      {/* Navigation con stili migliorati */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {/* 1. Dashboard Item Standalone - PRIMO */}
        {navigationConfig.dashboardItem && (
          <Link
            href={navigationConfig.dashboardItem.href}
            className={getNavItemClass(navigationConfig.dashboardItem.href, navigationConfig.dashboardItem.variant)}
            title={navigationConfig.dashboardItem.description}
          >
            <navigationConfig.dashboardItem.icon className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1 font-semibold">{navigationConfig.dashboardItem.label}</span>
          </Link>
        )}

        {/* 2. Sections: Logistica, AI & Automazione, etc. */}
        {navigationConfig.sections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const hasActiveItem = section.items.some(item => 
            pathname === item.href || pathname.startsWith(item.href)
          );
          
          return (
            <div key={section.id} className="space-y-2">
              {/* Section Header - Design migliorato con tendina - Stile uniforme per menu principali */}
              {section.collapsible ? (
                <button
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all duration-200",
                    hasActiveItem 
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md" 
                      : "bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 hover:from-orange-200 hover:to-amber-200",
                    "border border-orange-300"
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span className="uppercase tracking-wide">{section.label}</span>
                  {hasActiveItem && !isExpanded && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-white animate-pulse" />
                  )}
                </button>
              ) : (
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {section.label}
                </div>
              )}

              {/* Section Items - Animazione tendina */}
              {(!section.collapsible || isExpanded) && (
                <div className="space-y-1 pl-2">
                  {section.items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={getNavItemClass(item.href, item.variant)}
                      title={item.description}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* 3. Anne AI Assistant - DOPO le sections */}
        {navigationConfig.mainActions.map((action) => {
          const isAiAction = action.variant === 'ai';
          const isPrimaryAction = action.variant === 'primary';
          const isActive = pathname === action.href || pathname.startsWith(action.href);
          
          return (
            <div key={action.id}>
              {action.href === '#ai-assistant' ? (
                <button
                  onClick={() => {
                    const event = new CustomEvent('openAiAssistant');
                    window.dispatchEvent(event);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg",
                    isAiAction && "bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700",
                    isPrimaryAction && "bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:from-orange-600 hover:to-amber-700",
                    !isAiAction && !isPrimaryAction && "bg-white text-gray-700 border border-gray-200 hover:border-orange-300 hover:bg-orange-50"
                  )}
                  title={action.description}
                >
                  <action.icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{action.label}</span>
                  {action.badge && (
                    <span className="text-xs bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-full font-medium">
                      {action.badge}
                    </span>
                  )}
                </button>
              ) : (
                <Link
                  href={action.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-200",
                    isPrimaryAction && "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md hover:shadow-lg hover:from-orange-600 hover:to-amber-700",
                    !isPrimaryAction && isActive && "bg-orange-50 text-orange-700 border-l-4 border-orange-500 shadow-sm",
                    !isPrimaryAction && !isActive && "text-gray-700 hover:bg-gray-100"
                  )}
                  title={action.description}
                >
                  <action.icon className="w-5 h-5" />
                  <span className="flex-1">{action.label}</span>
                  {action.badge && (
                    <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                      {action.badge}
                    </span>
                  )}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer - User Profile con design migliorato */}
      {session && (
        <div className="border-t-2 border-gray-200 bg-white p-4 space-y-2">
          <Link
            href="/dashboard/dati-cliente"
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 transition-all duration-200 group border border-transparent hover:border-orange-200"
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
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 hover:shadow-sm transition-all duration-200 font-medium border border-transparent hover:border-red-200"
          >
            <LogOut className="w-5 h-5" />
            <span>Esci</span>
          </button>
        </div>
      )}
    </div>
  );
}
