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
  Contact,
  type LucideIcon,
  Trash2,
  Headphones,
  Key,
  UserPlus,
  Megaphone,
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
  /** Se specificato, la voce è visibile solo per questi ruoli */
  roles?: ('user' | 'admin' | 'superadmin')[];
}

/**
 * Tipo per le sezioni di navigazione (con sottomenu)
 * Supporta nested sections per organizzazione gerarchica
 */
export interface NavSection {
  id: string;
  label: string;
  icon?: LucideIcon;
  items: NavItem[];
  subsections?: NavSection[]; // 🆕 Supporto per sottosezioni nested
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
 * Feature flags per funzionalità opzionali
 * Permette rollout graduale e rollback istantaneo
 */
export const FEATURES = {
  KEYBOARD_NAV: true, // Keyboard navigation (Arrow keys, Enter, Escape)
  SIDEBAR_SEARCH: false, // Search/filter sidebar items
  TELEMETRY: false, // Analytics tracking
} as const;

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
      label: 'Spedizioni Contrassegno',
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
  requiredRole: ['superadmin'],
  items: [
    {
      id: 'mail',
      label: 'Posta',
      href: '/dashboard/posta',
      icon: Mail,
      description: 'Email inbox e invio @spediresicuro.it',
    },
    {
      id: 'bacheca',
      label: 'Bacheca',
      href: '/dashboard/bacheca',
      icon: Megaphone,
      description: 'Annunci broadcast per team e clienti',
    },
    {
      id: 'rubrica',
      label: 'Rubrica',
      href: '/dashboard/rubrica',
      icon: Contact,
      description: 'Gestione contatti e rubrica',
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
      id: 'escalations',
      label: 'Escalation',
      href: '/dashboard/supporto',
      icon: Headphones,
      description: 'Gestione escalation assistenza',
      roles: ['admin', 'superadmin'],
    },
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
 * FINANZE - RIMOSSA
 * Wallet spostato in "Il Mio Account" per eliminare duplicazione
 * La sezione "Finanze" conteneva solo Wallet, creando confusione per i reseller
 */

/**
 * RESELLER - Solo per reseller
 * SPRINT 2: UX Unification - Dashboard Unificata Clienti
 * Include gestione clienti, preventivi e listini
 */
const resellerSection: NavSection = {
  id: 'reseller',
  label: 'Gestione Business',
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
      id: 'reseller-prospects',
      label: 'I Miei Prospect',
      href: '/dashboard/prospects',
      icon: UserPlus,
      description: 'Pipeline vendite e gestione potenziali clienti',
    },
    {
      id: 'reseller-preventivo',
      label: 'Preventivatore',
      href: '/dashboard/reseller/preventivo',
      icon: Calculator,
      description: 'Calcola preventivi basati sulla matrice del listino',
    },
    {
      id: 'reseller-listini',
      label: 'Listini',
      href: '/dashboard/reseller/listini',
      icon: FileText,
      description: 'Gestisci listini fornitore e personalizzati',
    },
    {
      id: 'reseller-report-fiscale',
      label: 'Report Fiscale',
      href: '/dashboard/reseller/report-fiscale',
      icon: FileSpreadsheet,
      description: 'Report per fatturazione ai clienti',
    },
    {
      id: 'reseller-outreach',
      label: 'Outreach',
      href: '/dashboard/outreach',
      icon: Mail,
      description: 'Sequenze outreach e metriche invii',
    },
    {
      id: 'reseller-team',
      label: 'Il Mio Team',
      href: '/dashboard/workspace/team',
      icon: Users,
      description: 'Gestisci i membri del tuo team',
    },
    {
      id: 'workspace-settings',
      label: 'Impostazioni Workspace',
      href: '/dashboard/workspace/settings',
      icon: Settings,
      description: 'Configurazione e panoramica workspace',
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
      label: 'Dashboard Finanziaria',
      href: '/dashboard/super-admin/financial',
      icon: Calculator,
      description: 'P&L, Margini e Riconciliazione Piattaforma',
    },
  ],
};

/**
 * AMMINISTRAZIONE - Solo per admin/superadmin
 * Organizzata in 3 sottogruppi logici per migliore UX enterprise-grade
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
  ],
  subsections: [
    {
      id: 'admin-users',
      label: 'Utenti & Team',
      icon: Users,
      collapsible: true,
      defaultExpanded: true,
      items: [
        {
          id: 'team',
          label: 'Team Piattaforma',
          href: '/dashboard/workspace/team',
          icon: Building2,
          description: 'Gestione membri del team piattaforma',
        },
        {
          id: 'leads',
          label: 'Leads (CRM)',
          href: '/dashboard/admin/leads',
          icon: Users,
          description: 'Gestione potenziali clienti e opportunità',
        },
      ],
    },
    {
      id: 'admin-finance',
      label: 'Finanza & Fatturazione',
      icon: Wallet,
      collapsible: true,
      defaultExpanded: true,
      items: [
        {
          id: 'finance',
          label: 'Dashboard Finanziaria',
          href: '/dashboard/finanza',
          icon: Wallet,
          description: 'CFO Dashboard & Fiscal Brain',
        },
        {
          id: 'admin-invoices',
          label: 'Gestione Fatture',
          href: '/dashboard/admin/invoices',
          icon: FileText,
          description: 'Emissione e gestione fatture',
        },
        {
          id: 'admin-bonifici',
          label: 'Gestione Bonifici',
          href: '/dashboard/admin/bonifici',
          icon: Wallet,
          description: 'Approvazione e rifiuto richieste ricarica wallet',
        },
        {
          id: 'cost-adjustment',
          label: 'Rettifica Costi',
          href: '/dashboard/rettifica-costi',
          icon: Calculator,
          description: 'Correzione costi spedizioni',
        },
        {
          id: 'price-lists',
          label: 'Listini',
          href: '/dashboard/listini',
          icon: FileText,
          description: 'Gestione listini prezzi e master',
        },
        {
          id: 'cash-on-delivery',
          label: 'Admin Contrassegni',
          href: '/dashboard/contrassegni',
          icon: DollarSign,
          description: 'Gestione amministrativa contrassegni',
        },
        {
          id: 'cash-statements',
          label: 'Distinte Contrassegni',
          href: '/dashboard/distinte-contrassegni',
          icon: FileSpreadsheet,
          description: 'Distinte riepilogative contrassegni',
        },
      ],
    },
    {
      id: 'admin-system',
      label: 'Sistema & Configurazione',
      icon: Settings,
      collapsible: true,
      defaultExpanded: true,
      items: [
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
          id: 'admin-outreach',
          label: 'Outreach',
          href: '/dashboard/admin/outreach',
          icon: Mail,
          description: 'Monitoraggio outreach multi-canale',
        },
      ],
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
      id: 'security',
      label: 'Sicurezza',
      href: '/dashboard/profile/security',
      icon: Key,
      description: 'Cambio password e sicurezza account',
    },
    {
      id: 'settings',
      label: 'Impostazioni',
      href: '/dashboard/impostazioni',
      icon: Settings,
      description: 'Preferenze e configurazioni',
    },
    {
      id: 'courier-config',
      label: 'Configurazioni Corrieri',
      href: '/dashboard/configurazioni-corrieri',
      icon: Truck,
      description: 'Configura API corrieri con wizard guidati',
    },
    {
      id: 'integrations',
      label: 'Integrazioni Store',
      href: '/dashboard/integrazioni',
      icon: Zap,
      description: 'Connessioni e-commerce e widget',
    },
  ],
};

/**
 * FINANZA - Dashboard fiscale personale (TUTTI gli utenti)
 * Accessibile a: user, reseller, admin, superadmin, BYOC
 */
const financeSection: NavSection = {
  id: 'finance',
  label: 'Finanza',
  collapsible: true,
  defaultExpanded: true,
  items: [
    {
      id: 'finance-dashboard',
      label: 'Dashboard Finanziaria',
      href: '/dashboard/finanza',
      icon: Wallet,
      description: 'CFO Dashboard & Fiscal Brain - Dati fiscali personali',
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
    workspaceType?: 'platform' | 'reseller' | 'client';
  } = {}
): NavigationConfig {
  const { isReseller = false, hasTeam = false, accountType, workspaceType } = features;

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

  // Se siamo in un workspace client, mostra solo voci operative
  // Il reseller opera come se fosse il client stesso
  if (workspaceType === 'client') {
    return {
      mainActions,
      dashboardItem,
      sections: [
        logisticsSection,
        returnsSection,
        {
          ...accountSection,
          items: accountSection.items.filter((item) =>
            ['wallet', 'profile', 'settings', 'courier-config'].includes(item.id)
          ),
        },
        {
          ...supportSection,
          items: supportSection.items.filter((item) => item.id === 'manual'),
        },
      ],
    };
  }

  // Filtra le sezioni in base ai permessi e ruolo
  // 🎯 ORDINE ENTERPRISE-GRADE (priority-first):
  //    Per SUPERADMIN: Finanza Piattaforma → Amministrazione → Operativo → Account
  //    Per USER: Operativo → Account → Supporto
  // ⚠️ Strumenti rimosso: OCR e Voice sono features disponibili durante la creazione spedizione
  let sections: NavSection[] = [];

  // 1. SEZIONI STRATEGICHE (solo superadmin)
  if (role === 'superadmin') {
    sections.push(superAdminFinanceSection);
  }

  // 2. SEZIONI AMMINISTRATIVE (admin/superadmin)
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

  // 3. SEZIONI OPERATIVE (tutti gli utenti)
  sections.push(logisticsSection);
  sections.push(returnsSection);

  // 4. SEZIONE FINANZA (TUTTI gli utenti - dashboard fiscale personale)
  sections.push(financeSection);

  // 5. SEZIONI BUSINESS SPECIFICHE
  // BYOC section
  if (accountType === 'byoc') {
    sections.push(byocSection);
  }

  // Reseller section (rinominata "Gestione Business")
  if (isReseller) {
    sections.push(resellerSection);
  }

  // 6. SEZIONI PERSONALI (tutti gli utenti)
  // Team Workspace in "Il Mio Account" SOLO per BYOC (non reseller)
  // Admin/superadmin lo hanno gia' in "Amministrazione > Utenti & Team" come "Team Piattaforma"
  // I reseller lo hanno gia' in "Gestione Business" come "Il Mio Team"
  const showTeamWorkspace = accountType === 'byoc' && !isReseller;

  const accountItems = showTeamWorkspace
    ? [
        {
          id: 'workspace-team',
          label: 'Team Workspace',
          href: '/dashboard/workspace/team',
          icon: Users,
          description: 'Gestione membri del workspace',
        },
        ...accountSection.items,
      ]
    : accountSection.items;

  sections.push({
    ...accountSection,
    items: accountItems,
  });

  // 7. COMUNICAZIONI (superadmin: Posta platform, reseller: Posta workspace)
  if (role === 'superadmin') {
    sections.push(communicationsSection);
  } else if (isReseller) {
    sections.push({
      ...communicationsSection,
      requiredRole: undefined,
      items: [
        {
          id: 'mail-workspace',
          label: 'Posta',
          href: '/dashboard/posta-workspace',
          icon: Mail,
          description: 'Email inbox workspace',
        },
        {
          id: 'bacheca',
          label: 'Bacheca',
          href: '/dashboard/bacheca',
          icon: Megaphone,
          description: 'Annunci per team e clienti',
        },
        {
          id: 'rubrica',
          label: 'Rubrica',
          href: '/dashboard/rubrica',
          icon: Contact,
          description: 'Gestione contatti e rubrica',
        },
      ],
    });
  }

  // 8. SEZIONI SUPPORTO (sempre alla fine, con filtro item per ruolo)
  sections.push({
    ...supportSection,
    items: supportSection.items.filter((item) => !item.roles || item.roles.includes(role)),
  });

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
    inactive:
      'bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold hover:shadow-lg hover:scale-[1.02]',
  },
  ai: {
    active: 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white font-semibold shadow-lg',
    inactive:
      'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:shadow-lg hover:scale-[1.02]',
  },
};
