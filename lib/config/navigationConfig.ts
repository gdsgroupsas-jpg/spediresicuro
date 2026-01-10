/**
 * Navigation Configuration
 *
 * Configurazione centralizzata per la navigazione della dashboard.
 * Definisce menu, sezioni e permessi per ciascun ruolo utente.
 *
 * @module navigationConfig
 */

import {
  LayoutDashboard,
  Package,
  Plus,
  List,
  PackageX,
  Mail,
  Settings,
  FileText,
  Shield,
  Users,
  Crown,
  UserCircle,
  Bot,
  Wallet,
  Zap,
  Building2,
  BookOpen,
  ScanLine,
  Truck,
  RotateCcw,
  MapPin,
  Calculator,
  Euro,
  FileSpreadsheet,
  Archive,
  Search,
  DollarSign,
  Activity,
  type LucideIcon,
  Trash2,
} from 'lucide-react';

/**
 * Tipo per le voci di navigazione
 */
export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  variant?: 'default' | 'primary' | 'gradient' | 'ai';
  description?: string;
}

/**
 * Tipo per le sezioni di navigazione (con sottomenu)
 */
export interface NavSection {
  id: string;
  label: string;
  icon?: LucideIcon;
  items: NavItem[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
  requiredRole?: UserRole[];
  requiredFeature?: 'reseller' | 'team';
}

/**
 * Ruoli utente supportati
 */
export type UserRole = 'user' | 'admin' | 'superadmin';

/**
 * Configurazione completa navigazione
 */
export interface NavigationConfig {
  mainActions: NavItem[];
  dashboardItem?: NavItem; // Dashboard standalone
  sections: NavSection[];
}

/**
 * DASHBOARD - Item standalone (non in un menu)
 */
const dashboardItem: NavItem = {
  id: 'dashboard',
  label: 'Dashboard',
  href: '/dashboard',
  icon: LayoutDashboard,
  variant: 'primary',
  description: 'Panoramica generale e statistiche',
};

/**
 * LOGISTICA - Menu organizzato per workflow operativo
 * Ordine logico: Creazione → Gestione → Giacenze → Resi
 */
const logisticsSection: NavSection = {
  id: 'logistics',
  label: 'Spedizioni',
  collapsible: true,
  defaultExpanded: true,
  items: [
    {
      id: 'new-shipment',
      label: 'Nuova Spedizione',
      href: '/dashboard/spedizioni/nuova',
      icon: Plus,
      variant: 'gradient',
      description: 'Crea una nuova spedizione',
    },
    {
      id: 'shipments',
      label: 'Tutte le Spedizioni',
      href: '/dashboard/spedizioni',
      icon: List,
      description: 'Elenco completo spedizioni',
    },
    {
      id: 'cancelled-shipments',
      label: 'Spedizioni Cancellate',
      href: '/dashboard/spedizioni/cancellate',
      icon: Trash2,
      description: 'Tracciabilità spedizioni eliminate',
    },
    {
      id: 'giacenze',
      label: 'Giacenze',
      href: '/dashboard/giacenze',
      icon: Archive,
      description: 'Spedizioni in giacenza',
    },
    {
      id: 'contrassegni',
      label: 'Contrassegni',
      href: '/dashboard/contrassegni',
      icon: DollarSign,
      description: 'Gestione spedizioni con contrassegno',
    },
  ],
};

/**
 * RESI - Gestione resi e rimborsi
 * Scanner Resi è un sottomenu di Resi
 */
const returnsSection: NavSection = {
  id: 'returns',
  label: 'Resi',
  collapsible: true,
  defaultExpanded: true,
  items: [
    {
      id: 'returns-main',
      label: 'Gestione Resi',
      href: '/dashboard/resi',
      icon: RotateCcw,
      description: 'Gestione resi e rimborsi',
    },
    {
      id: 'return-scanner',
      label: 'Scanner Resi',
      href: '/dashboard/scanner-resi',
      icon: ScanLine,
      description: 'Scansione LDV per resi',
    },
  ],
};

/**
 * STRUMENTI - RIMOSSO
 * OCR Scanner e Controllo Vocale sono disponibili come features
 * quando si crea una spedizione (AI Import)
 */

/**
 * COMUNICAZIONI
 */
const communicationsSection: NavSection = {
  id: 'communications',
  label: 'Comunicazioni',
  collapsible: false,
  items: [
    {
      id: 'mail',
      label: 'Posta',
      href: '/dashboard/posta',
      icon: Mail,
      description: 'Messaggi e notifiche',
    },
  ],
};

/**
 * SUPPORTO
 */
const supportSection: NavSection = {
  id: 'support',
  label: 'Supporto',
  collapsible: false,
  items: [
    {
      id: 'manual',
      label: 'Manuale Utente',
      href: '/dashboard/manuale',
      icon: BookOpen,
      description: 'Documentazione completa',
    },
  ],
};

/**
 * FINANZE - Solo per Reseller o utenti con wallet
 */
const financeSection: NavSection = {
  id: 'finance',
  label: 'Finanze',
  collapsible: true,
  defaultExpanded: true, // Sempre espansa per migliore UX
  items: [
    {
      id: 'wallet',
      label: 'Wallet',
      href: '/dashboard/wallet',
      icon: Wallet,
      description: 'Ricariche e transazioni',
    },
  ],
};

/**
 * RESELLER - Solo per reseller
 * SPRINT 2: UX Unification - Dashboard Unificata Clienti
 */
const resellerSection: NavSection = {
  id: 'reseller',
  label: 'Reseller',
  collapsible: true,
  defaultExpanded: true,
  requiredFeature: 'reseller',
  items: [
    {
      id: 'reseller-clienti',
      label: 'I Miei Clienti',
      href: '/dashboard/reseller/clienti',
      icon: Users,
      description: 'Gestisci clienti, listini e wallet',
    },
    {
      id: 'reseller-preventivo',
      label: 'Preventivatore',
      href: '/dashboard/reseller/preventivo',
      icon: Calculator,
      description: 'Calcola preventivi basati sulla matrice del listino',
    },
    {
      id: 'reseller-listini-fornitore',
      label: 'Listini Fornitore',
      href: '/dashboard/reseller/listini-fornitore',
      icon: Package,
      description: 'Gestisci i tuoi listini fornitore',
    },
    // Listini Personalizzati ora accessibile da "I Miei Clienti" inline
    // Mantenuto per backward compatibility e accesso diretto
    {
      id: 'reseller-listini-personalizzati',
      label: 'Listini Personalizzati',
      href: '/dashboard/reseller/listini-personalizzati',
      icon: FileText,
      description: 'Listini personalizzati per i tuoi clienti',
    },
  ],
};

/**
 * FINANZA SUPERADMIN - Solo per superadmin
 * SPRINT 2: Financial Dashboard & Reconciliation
 */
const superAdminFinanceSection: NavSection = {
  id: 'superadmin-finance',
  label: 'Finanza Piattaforma',
  collapsible: true,
  defaultExpanded: true,
  requiredRole: ['superadmin'],
  items: [
    {
      id: 'financial-dashboard',
      label: 'Financial Dashboard',
      href: '/dashboard/super-admin/financial',
      icon: Calculator,
      description: 'P&L, Margini e Riconciliazione',
    },
    {
      id: 'listini-master',
      label: 'Listini Master',
      href: '/dashboard/super-admin/listini-master',
      icon: FileText,
      description: 'Listini globali piattaforma',
    },
  ],
};

/**
 * AMMINISTRAZIONE - Solo per admin/superadmin
 * Include gestione utenti, features, prezzi e distinte contrassegni
 */
const adminSection: NavSection = {
  id: 'admin',
  label: 'Amministrazione',
  collapsible: true,
  defaultExpanded: true,
  requiredRole: ['admin', 'superadmin'],
  items: [
    {
      id: 'super-admin',
      label: 'Super Admin',
      href: '/dashboard/super-admin',
      icon: Crown,
      variant: 'default',
      description: 'Pannello Super Amministratore - Accesso Totale',
    },
    {
      id: 'admin-panel',
      label: 'Admin Panel',
      href: '/dashboard/admin',
      icon: Shield,
      description: 'Dashboard amministratore principale',
    },
    {
      id: 'team',
      label: 'Team Aziendale',
      href: '/dashboard/team',
      icon: Building2,
      description: 'Gestione team e sub-admin',
    },
    {
      id: 'leads',
      label: 'Leads (CRM)',
      href: '/dashboard/admin/leads',
      icon: Users,
      description: 'Gestione potenziali clienti e opportunità',
    },
    {
      id: 'finance',
      label: 'Financial Control',
      href: '/dashboard/finanza',
      icon: Wallet,
      description: 'CFO Dashboard & Fiscal Brain',
    },
    {
      id: 'price-lists',
      label: 'Listini Prezzi',
      href: '/dashboard/listini',
      icon: FileText,
      description: 'Gestione listini per utenti',
    },
    {
      id: 'cash-on-delivery',
      label: 'Lista Contrassegni',
      href: '/dashboard/contrassegni',
      icon: DollarSign,
      description: 'Gestione contrassegni',
    },
    {
      id: 'cash-statements',
      label: 'Distinte Contrassegni',
      href: '/dashboard/distinte-contrassegni',
      icon: FileSpreadsheet,
      description: 'Distinte riepilogative contrassegni',
    },
    {
      id: 'admin-invoices',
      label: 'Gestione Fatture',
      href: '/dashboard/admin/invoices',
      icon: FileText,
      description: 'Emissione e gestione fatture',
    },
    {
      id: 'cost-adjustment',
      label: 'Rettifica Costi',
      href: '/dashboard/rettifica-costi',
      icon: Calculator,
      description: 'Correzione costi spedizioni',
    },
    {
      id: 'admin-features',
      label: 'Features Platform',
      href: '/dashboard/admin/features',
      icon: Zap,
      description: 'Gestione features utenti',
    },
    {
      id: 'admin-automation',
      label: 'Automazioni',
      href: '/dashboard/admin/automation',
      icon: Bot,
      description: 'Sync automatici e integrazioni',
    },
    {
      id: 'admin-config',
      label: 'Configurazioni',
      href: '/dashboard/admin/configurations',
      icon: Settings,
      description: 'Impostazioni globali piattaforma',
    },
    {
      id: 'admin-logs',
      label: 'Log Diagnostici',
      href: '/dashboard/admin/logs',
      icon: Activity,
      description: 'Visualizzazione eventi diagnostici e monitoring',
    },
    {
      id: 'admin-bonifici',
      label: 'Gestione Bonifici',
      href: '/dashboard/admin/bonifici',
      icon: Wallet,
      description: 'Approvazione e rifiuto richieste ricarica wallet',
    },
  ],
};

/**
 * IL MIO ACCOUNT - Impostazioni personali
 */
const accountSection: NavSection = {
  id: 'account',
  label: 'Il Mio Account',
  collapsible: true,
  defaultExpanded: true,
  items: [
    {
      id: 'wallet',
      label: 'Wallet',
      href: '/dashboard/wallet',
      icon: Wallet,
      description: 'Ricariche e transazioni',
    },
    {
      id: 'invoices',
      label: 'Fatture',
      href: '/dashboard/fatture',
      icon: FileText,
      description: 'Storico fatture e pagamenti',
    },
    {
      id: 'profile',
      label: 'Dati Cliente',
      href: '/dashboard/dati-cliente',
      icon: UserCircle,
      description: 'Informazioni personali',
    },
    {
      id: 'settings',
      label: 'Impostazioni',
      href: '/dashboard/impostazioni',
      icon: Settings,
      description: 'Preferenze e configurazioni',
    },
    {
      id: 'integrations',
      label: 'Integrazioni',
      href: '/dashboard/integrazioni',
      icon: Zap,
      description: 'Connessioni e API',
    },
  ],
};

/**
 * BYOC - Solo per BYOC (Bring Your Own Carrier)
 */
const byocSection: NavSection = {
  id: 'byoc',
  label: 'BYOC',
  collapsible: true,
  defaultExpanded: true,
  items: [
    {
      id: 'byoc-listini-fornitore',
      label: 'Listini Fornitore',
      href: '/dashboard/byoc/listini-fornitore',
      icon: Package,
      description: 'Gestisci i tuoi listini fornitore',
    },
    {
      id: 'byoc-preventivo',
      label: 'Preventivatore',
      href: '/dashboard/reseller/preventivo',
      icon: Calculator,
      description: 'Calcola preventivi basati sulla matrice del listino',
    },
  ],
};

/**
 * Filtra le sezioni in base al ruolo utente e feature flags
 */
export function getNavigationForUser(
  role: UserRole,
  features: {
    isReseller?: boolean;
    hasTeam?: boolean;
    accountType?: string;
  } = {}
): NavigationConfig {
  const { isReseller = false, hasTeam = false, accountType } = features;

  // Filtra le sezioni in base ai permessi
  // ⚠️ Ordine logico: Spedizioni → Resi → Finanze → Admin → Account → Comunicazioni → Supporto
  // ⚠️ Strumenti rimosso: OCR e Voice sono features disponibili durante la creazione spedizione
  let sections: NavSection[] = [
    logisticsSection,
    returnsSection,
  ];

  // Aggiungi sezione BYOC se account_type è 'byoc'
  if (accountType === 'byoc') {
    sections.push(byocSection);
  }

  // Aggiungi sezione finanze se reseller o se ha wallet
  if (isReseller) {
    sections.push(financeSection);
    sections.push(resellerSection);
  }

  // Aggiungi sezione Finanza Piattaforma solo per superadmin
  // SPRINT 2: Financial Dashboard
  if (role === 'superadmin') {
    sections.push(superAdminFinanceSection);
  }

  // Aggiungi admin solo se admin/superadmin
  if (role === 'admin' || role === 'superadmin') {
    // Filtra i items di admin in base al ruolo
    const filteredAdminItems = adminSection.items.filter((item) => {
      if (item.id === 'super-admin') {
        return role === 'superadmin';
      }
      return true;
    });

    sections.push({
      ...adminSection,
      items: filteredAdminItems,
    });
  }

  // Aggiungi sempre la sezione account
  sections.push(accountSection);

  // ⚠️ Aggiungi Comunicazioni e Supporto alla fine come richiesto dall'utente
  sections.push(communicationsSection);
  sections.push(supportSection);

  // Azioni principali (AI Assistant - sempre visibile)
  const mainActions: NavItem[] = [
    {
      id: 'ai-assistant',
      label: 'Anne AI',
      href: '#ai-assistant',
      icon: Bot,
      variant: 'ai',
      description: 'Assistente virtuale intelligente',
    },
  ];

  return {
    mainActions,
    dashboardItem, // Dashboard come primo item standalone
    sections,
  };
}

/**
 * Helper per determinare se un item è attivo
 */
export function isNavItemActive(itemHref: string, currentPath: string): boolean {
  if (itemHref === '/dashboard') {
    return currentPath === '/dashboard';
  }
  return currentPath?.startsWith(itemHref);
}

/**
 * Stili per i variant delle nav item
 */
export const navItemVariants = {
  default: {
    active: 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-600 font-semibold shadow-sm',
    inactive: 'text-gray-700 hover:bg-gray-50 hover:text-orange-600 font-medium',
  },
  primary: {
    active: 'bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-600 font-semibold shadow-sm',
    inactive: 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 font-medium',
  },
  gradient: {
    active: 'bg-gradient-to-r from-orange-600 to-amber-600 text-white font-semibold shadow-lg',
    inactive: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold hover:shadow-lg hover:scale-[1.02]',
  },
  ai: {
    active: 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white font-semibold shadow-lg',
    inactive: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:shadow-lg hover:scale-[1.02]',
  },
};
