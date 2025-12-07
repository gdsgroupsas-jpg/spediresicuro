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
  Mic,
  Wallet,
  Zap,
  Building2,
  BookOpen,
  ScanLine,
  TruckIcon,
  RotateCcw,
  MapPin,
  Calculator,
  Euro,
  FileSpreadsheet,
  Archive,
  Search,
  DollarSign,
  type LucideIcon,
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
 * LOGISTICA - Menu completo operazioni spedizioni
 * Ispirato a Spedisci.Online ma migliorato e organizzato
 */
const logisticsSection: NavSection = {
  id: 'logistics',
  label: 'Logistica',
  collapsible: true,
  defaultExpanded: true,
  items: [
    {
      id: 'new-shipment',
      label: 'Nuova Spedizione',
      href: '/dashboard/spedizioni/nuova',
      icon: Plus,
      variant: 'gradient',
      description: 'Crea spedizione rapidamente',
    },
    {
      id: 'shipments',
      label: 'Elenco Spedizioni',
      href: '/dashboard/spedizioni',
      icon: List,
      description: 'Tutte le spedizioni',
    },
    {
      id: 'giacenze',
      label: 'Giacenze',
      href: '/dashboard/giacenze',
      icon: Archive,
      description: 'Spedizioni in giacenza',
    },
    {
      id: 'tracking',
      label: 'Tracking Interno',
      href: '/dashboard/tracking',
      icon: MapPin,
      description: 'Tracciamento spedizioni',
    },
    {
      id: 'returns',
      label: 'Gestione Resi',
      href: '/dashboard/resi',
      icon: RotateCcw,
      description: 'Resi e rimborsi',
    },
    {
      id: 'return-scanner',
      label: 'Scanner Resi',
      href: '/dashboard/scanner-resi',
      icon: ScanLine,
      description: 'Scansione LDV per resi',
    },
    {
      id: 'shipments-cancelled',
      label: 'Spedizioni Cancellate',
      href: '/dashboard/spedizioni/cancellate',
      icon: PackageX,
      description: 'Archivio spedizioni annullate',
    },
  ],
};

/**
 * INTELLIGENZA ARTIFICIALE - Anne e automazioni
 */
const aiSection: NavSection = {
  id: 'ai',
  label: 'AI & Automazione',
  collapsible: true,
  defaultExpanded: true,
  items: [
    {
      id: 'ocr-scanner',
      label: 'AI OCR Scanner',
      href: '/dashboard/ocr-scanner',
      icon: ScanLine,
      variant: 'gradient',
      description: 'Scanner OCR per estrazione dati da immagini',
    },
    {
      id: 'voice-control',
      label: 'Voice Control',
      href: '/dashboard/voice',
      icon: Mic,
      variant: 'default',
      description: 'Controllo vocale delle funzioni',
    },
  ],
};

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
      href: '/manuale',
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
  defaultExpanded: false,
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
 */
const resellerSection: NavSection = {
  id: 'reseller',
  label: 'Reseller',
  collapsible: true,
  defaultExpanded: true,
  requiredFeature: 'reseller',
  items: [
    {
      id: 'reseller-team',
      label: 'I Miei Clienti',
      href: '/dashboard/reseller-team',
      icon: Users,
      description: 'Gestisci il tuo portfolio clienti',
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
 * Filtra le sezioni in base al ruolo utente e feature flags
 */
export function getNavigationForUser(
  role: UserRole,
  features: {
    isReseller?: boolean;
    hasTeam?: boolean;
  } = {}
): NavigationConfig {
  const { isReseller = false, hasTeam = false } = features;

  // Filtra le sezioni in base ai permessi
  // ⚠️ Ordine DEFINITIVO: Dashboard (standalone), Logistica, AI & Automazione, poi resto
  let sections: NavSection[] = [
    logisticsSection,
    aiSection,
  ];

  // Aggiungi sezione reseller solo se l'utente è reseller
  if (isReseller) {
    sections.push(resellerSection);
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

  // Azioni principali (AI Assistant visibile DOPO Dashboard e Logistica)
  const mainActions: NavItem[] = [
    {
      id: 'ai-assistant',
      label: 'Anne AI Assistant',
      href: '#ai-assistant',
      icon: Bot,
      variant: 'ai',
      description: 'Apri Anne, il tuo assistente virtuale',
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
