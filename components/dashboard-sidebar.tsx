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
import { Package, LogOut, ChevronDown, ChevronRight } from 'lucide-react';
import {
  getNavigationForUser,
  isNavItemActive,
  type UserRole,
  type NavSection,
  type NavItem,
  FEATURES,
} from '@/lib/config/navigationConfig';
import { cn } from '@/lib/utils';
import { useKeyboardNav } from '@/hooks/useKeyboardNav';
import { useGiacenzeCount } from '@/hooks/useGiacenzeCount';
import { useWorkspaceUI } from '@/hooks/useWorkspaceUI';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [accountType, setAccountType] = useState<string | null>(null);
  const [isReseller, setIsReseller] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const giacenzeCount = useGiacenzeCount();

  // UI adattiva per workspace type (nasconde Listini per client)
  const { showPriceListMenu, isClient: isClientWorkspace, workspaceType } = useWorkspaceUI();

  // Rileva se si sta operando in workspace altrui (safety indicator)
  const { workspace: currentWorkspace } = useWorkspaceContext();
  const isInForeignWorkspace =
    currentWorkspace?.role !== 'owner' && currentWorkspace?.workspace_type !== undefined;

  // 🆕 LocalStorage keys
  const STORAGE_KEYS = {
    expandedSections: 'sidebar-expanded-sections',
    manuallyCollapsed: 'sidebar-manually-collapsed',
  };

  // 🔧 FIX HYDRATION: Inizializza sempre vuoto (server e client identici)
  // Il caricamento da localStorage avviene dopo il mount per evitare mismatch
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [manuallyCollapsed, setManuallyCollapsed] = useState<Set<string>>(new Set());

  // 🔧 FIX HYDRATION: Flag per indicare quando il componente è montato sul client
  const [mounted, setMounted] = useState(false);

  // 🔧 FIX HYDRATION: Imposta mounted dopo il primo render sul client
  useEffect(() => {
    setMounted(true);
  }, []);

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
    // Se workspace è client, forza isReseller a false (nasconde sezione Business/Listini)
    const effectiveIsReseller = isClientWorkspace ? false : isReseller;

    return getNavigationForUser(userRole, {
      isReseller: effectiveIsReseller,
      accountType: accountType || undefined,
      workspaceType: workspaceType || undefined,
    });
  }, [userRole, isReseller, accountType, isClientWorkspace, workspaceType]);

  // 🆕 Flatten all navigable items for keyboard navigation
  const allNavigableItems = useMemo(() => {
    const items: NavItem[] = [];

    // Add dashboard item
    if (navigationConfig.dashboardItem) {
      items.push(navigationConfig.dashboardItem);
    }

    // Add all section items (including nested)
    navigationConfig.sections.forEach((section) => {
      items.push(...section.items);

      // Add subsection items
      if (section.subsections) {
        section.subsections.forEach((subsection) => {
          items.push(...subsection.items);
        });
      }
    });

    return items;
  }, [navigationConfig]);

  // 🆕 Keyboard navigation support
  const { focusedIndex, isKeyboardMode } = useKeyboardNav(allNavigableItems, {
    enabled: FEATURES.KEYBOARD_NAV,
  });

  // 🔧 FIX HYDRATION: Carica da localStorage e applica auto-espansione solo dopo il mount
  useEffect(() => {
    if (!mounted) return;

    // Carica stato salvato da localStorage
    try {
      const storedExpanded = localStorage.getItem(STORAGE_KEYS.expandedSections);
      const storedCollapsed = localStorage.getItem(STORAGE_KEYS.manuallyCollapsed);

      const loadedExpanded = storedExpanded
        ? new Set<string>(JSON.parse(storedExpanded) as string[])
        : new Set<string>();
      const loadedCollapsed = storedCollapsed
        ? new Set<string>(JSON.parse(storedCollapsed) as string[])
        : new Set<string>();

      setManuallyCollapsed(loadedCollapsed);

      // Applica auto-espansione basata su pathname e configurazione
      setExpandedSections((prevExpanded) => {
        const newExpandedSections = new Set<string>();

        // Mantieni le sezioni già espanse da localStorage (se non manualmente collassate)
        loadedExpanded.forEach((sectionId) => {
          if (!loadedCollapsed.has(sectionId)) {
            newExpandedSections.add(sectionId);
          }
        });

        // Auto-espandi sezioni basate su configurazione e pathname attivo
        navigationConfig.sections.forEach((section) => {
          if (loadedCollapsed.has(section.id)) {
            return; // Rispetta le sezioni manualmente collassate
          }

          if (section.defaultExpanded) {
            newExpandedSections.add(section.id);
          }

          // Verifica items diretti
          const hasActiveItem = section.items.some((item) =>
            isNavItemActive(item.href, pathname || '')
          );

          if (hasActiveItem) {
            newExpandedSections.add(section.id);
          }

          // Verifica items nelle subsections
          if (section.subsections) {
            section.subsections.forEach((subsection) => {
              if (subsection.defaultExpanded) {
                newExpandedSections.add(subsection.id);
              }

              const hasActiveNestedItem = subsection.items.some((item) =>
                isNavItemActive(item.href, pathname || '')
              );

              if (hasActiveNestedItem) {
                newExpandedSections.add(section.id); // Espandi sezione parent
                newExpandedSections.add(subsection.id); // Espandi subsection
              }
            });
          }
        });

        return newExpandedSections;
      });
    } catch (error) {
      console.error('Errore caricamento stato sidebar:', error);
    }
  }, [
    mounted,
    pathname,
    navigationConfig,
    STORAGE_KEYS.expandedSections,
    STORAGE_KEYS.manuallyCollapsed,
  ]);

  // 🆕 Salva stato in localStorage quando cambia (solo dopo mount)
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        STORAGE_KEYS.expandedSections,
        JSON.stringify(Array.from(expandedSections))
      );
    } catch (error) {
      console.error('Failed to save expanded sections:', error);
    }
  }, [mounted, expandedSections, STORAGE_KEYS.expandedSections]);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        STORAGE_KEYS.manuallyCollapsed,
        JSON.stringify(Array.from(manuallyCollapsed))
      );
    } catch (error) {
      console.error('Failed to save manually collapsed:', error);
    }
  }, [mounted, manuallyCollapsed, STORAGE_KEYS.manuallyCollapsed]);

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

  // 🆕 Helper to get global nav index for an item (for keyboard nav)
  const getNavIndex = (item: NavItem): number => {
    return allNavigableItems.findIndex((i) => i.id === item.id);
  };

  return (
    <div
      className={cn(
        'hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white z-50',
        isInForeignWorkspace ? 'border-r-4 border-amber-400' : 'border-r border-gray-200'
      )}
      data-keyboard-nav
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Header - Logo e Brand (amber se in workspace altrui) */}
      <div
        className={cn(
          'flex items-center gap-3 px-6 py-4 border-b',
          isInForeignWorkspace ? 'bg-amber-50 border-amber-300' : 'border-gray-200'
        )}
      >
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            isInForeignWorkspace ? 'bg-amber-400' : 'bg-gradient-to-br from-orange-500 to-amber-600'
          )}
        >
          <Package className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">SpediRe Sicuro</h1>
          {isSuperAdmin && !isInForeignWorkspace && (
            <p className="text-[10px] text-red-600 font-medium uppercase tracking-wide">
              Super Admin
            </p>
          )}
          {isInForeignWorkspace && (
            <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wide truncate">
              WS: {currentWorkspace?.workspace_name}
            </p>
          )}
        </div>
      </div>

      {/* Workspace attivo - Indicatore compatto (switch nella context bar del dashboard) */}
      {session && currentWorkspace && (
        <div className="px-3 pt-3 pb-2 border-b border-gray-200">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div
              className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold text-white shrink-0',
                currentWorkspace.workspace_type === 'platform'
                  ? 'bg-violet-600'
                  : currentWorkspace.workspace_type === 'reseller'
                    ? 'bg-blue-600'
                    : 'bg-emerald-600'
              )}
            >
              {currentWorkspace.workspace_name
                ?.split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {currentWorkspace.workspace_name}
              </p>
              <p className="text-[10px] text-gray-500 truncate">
                {currentWorkspace.organization_name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {/* Dashboard - Sempre visibile in alto */}
        {navigationConfig.dashboardItem && (
          <Link
            href={navigationConfig.dashboardItem.href}
            data-nav-index={getNavIndex(navigationConfig.dashboardItem)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isNavItemActive(navigationConfig.dashboardItem.href, pathname || '')
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
              // 🆕 Keyboard focus ring
              isKeyboardMode &&
                focusedIndex === getNavIndex(navigationConfig.dashboardItem) &&
                'ring-2 ring-orange-500 ring-offset-1'
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

          // Verifica active state sia per items diretti che nested
          const hasActiveItem = section.items.some((item) =>
            isNavItemActive(item.href, pathname || '')
          );
          const hasActiveNestedItem = section.subsections?.some((subsection) =>
            subsection.items.some((item) => isNavItemActive(item.href, pathname || ''))
          );
          const hasActive = hasActiveItem || hasActiveNestedItem;

          return (
            <div key={section.id} className="space-y-0.5">
              {/* Section Header */}
              {section.collapsible ? (
                <button
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-gray-500 uppercase tracking-wider transition-colors',
                    hasActive && 'text-gray-900',
                    'hover:text-gray-900'
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

              {/* Section Content */}
              {(!section.collapsible || isExpanded) && (
                <div className="space-y-0.5 pl-5">
                  {/* Section Items (diretti) */}
                  {section.items.map((item) => {
                    const isItemActive = isNavItemActive(item.href, pathname || '');
                    const isPrimary = item.variant === 'primary' || item.variant === 'gradient';
                    const navIndex = getNavIndex(item);
                    const isFocused = isKeyboardMode && focusedIndex === navIndex;

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        data-nav-index={navIndex}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors group',
                          isItemActive
                            ? isPrimary
                              ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-900 font-medium'
                            : isPrimary
                              ? 'text-gray-700 hover:bg-gray-50'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                          // 🆕 Keyboard focus ring
                          isFocused && 'ring-2 ring-orange-500 ring-offset-1'
                        )}
                        title={item.description}
                      >
                        <item.icon
                          className={cn(
                            'w-4 h-4 flex-shrink-0',
                            isItemActive && isPrimary ? 'text-white' : ''
                          )}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.id === 'giacenze' && giacenzeCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-red-500 text-white min-w-[18px] text-center">
                            {giacenzeCount}
                          </span>
                        )}
                        {item.badge && (
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded font-medium',
                              isItemActive && isPrimary
                                ? 'bg-white/20 text-white'
                                : 'bg-gray-200 text-gray-700'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}

                  {/* 🆕 Subsections (nested) */}
                  {section.subsections?.map((subsection) => {
                    const isSubExpanded = expandedSections.has(subsection.id);
                    const hasActiveSubItem = subsection.items.some((item) =>
                      isNavItemActive(item.href, pathname || '')
                    );

                    return (
                      <div key={subsection.id} className="space-y-0.5 mt-2">
                        {/* Subsection Header */}
                        {subsection.collapsible ? (
                          <button
                            onClick={() => toggleSection(subsection.id)}
                            className={cn(
                              'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wide transition-colors',
                              hasActiveSubItem
                                ? 'text-orange-600'
                                : 'text-gray-500 hover:text-gray-700'
                            )}
                          >
                            {isSubExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                            {subsection.icon && <subsection.icon className="w-3 h-3" />}
                            <span className="flex-1 text-left">{subsection.label}</span>
                          </button>
                        ) : (
                          <div className="px-2 py-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                            {subsection.icon && <subsection.icon className="w-3 h-3" />}
                            <span>{subsection.label}</span>
                          </div>
                        )}

                        {/* Subsection Items */}
                        {(!subsection.collapsible || isSubExpanded) && (
                          <div className="space-y-0.5 pl-3">
                            {subsection.items.map((item) => {
                              const isItemActive = isNavItemActive(item.href, pathname || '');
                              const isPrimary =
                                item.variant === 'primary' || item.variant === 'gradient';
                              const navIndex = getNavIndex(item);
                              const isFocused = isKeyboardMode && focusedIndex === navIndex;

                              return (
                                <Link
                                  key={item.id}
                                  href={item.href}
                                  data-nav-index={navIndex}
                                  className={cn(
                                    'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors group',
                                    isItemActive
                                      ? isPrimary
                                        ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-900 font-medium'
                                      : isPrimary
                                        ? 'text-gray-700 hover:bg-gray-50'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                                    // 🆕 Keyboard focus ring
                                    isFocused && 'ring-2 ring-orange-500 ring-offset-1'
                                  )}
                                  title={item.description}
                                >
                                  <item.icon
                                    className={cn(
                                      'w-3.5 h-3.5 flex-shrink-0',
                                      isItemActive && isPrimary ? 'text-white' : ''
                                    )}
                                  />
                                  <span className="flex-1 truncate text-sm">{item.label}</span>
                                  {item.id === 'giacenze' && giacenzeCount > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-red-500 text-white min-w-[18px] text-center">
                                      {giacenzeCount}
                                    </span>
                                  )}
                                  {item.badge && (
                                    <span
                                      className={cn(
                                        'text-[10px] px-1.5 py-0.5 rounded font-medium',
                                        isItemActive && isPrimary
                                          ? 'bg-white/20 text-white'
                                          : 'bg-gray-200 text-gray-700'
                                      )}
                                    >
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
              )}
            </div>
          );
        })}
      </div>

      {/* Footer - User Profile */}
      {session && (
        <div className="border-t border-gray-200 bg-gray-50">
          {/* User Profile */}
          <div className="p-3 space-y-1">
            <Link
              href="/dashboard/dati-cliente"
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white text-xs font-semibold">
                {session.user?.name?.[0]?.toUpperCase() ||
                  session.user?.email?.[0]?.toUpperCase() ||
                  'U'}
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
        </div>
      )}
    </div>
  );
}
