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
  sections: NavSection[];
}

/**
 * LOGISTICA - Spedizioni, tracking, resi
 */
const logisticsSection: NavSection = {
  id: 'logistics',
  label: 'Logistica',
  collapsible: false,
  defaultExpanded: true,
  items: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      description: 'Panoramica generale',
    },
    {
      id: 'shipments',
      label: 'Spedizioni',
      href: '/dashboard/spedizioni',
      icon: Package,
      description: 'Gestisci le tue spedizioni',
    },
    {
      id: 'new-shipment',
      label: 'Nuova Spedizione',
      href: '/dashboard/spedizioni/nuova',
      icon: Plus,
      variant: 'gradient',
      description: 'Crea una nuova spedizione',
    },
  ],
};

/**
 * INTELLIGENZA ARTIFICIALE - Anne e automazioni
 */
const aiSection: NavSection = {
  id: 'ai',
  label: 'AI & Automazione',
  collapsible: false,
  defaultExpanded: true,
  items: [
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
  defaultExpanded: false,
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
 */
const adminSection: NavSection = {
  id: 'admin',
  label: 'Amministrazione',
  collapsible: true,
  defaultExpanded: false,
  requiredRole: ['admin', 'superadmin'],
  items: [
    {
      id: 'super-admin',
      label: 'Super Admin',
      href: '/dashboard/super-admin',
      icon: Crown,
      description: 'Pannello Super Amministratore',
    },
    {
      id: 'admin-panel',
      label: 'Admin Panel',
      href: '/dashboard/admin',
      icon: Shield,
      description: 'Pannello amministratore',
    },
    {
      id: 'team',
      label: 'Team Aziendale',
      href: '/dashboard/team',
      icon: Building2,
      description: 'Gestione team interno',
    },
    {
      id: 'price-lists',
      label: 'Listini',
      href: '/dashboard/listini',
      icon: FileText,
      description: 'Gestione listini prezzi',
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
  defaultExpanded: false,
  items: [
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
  let sections: NavSection[] = [
    logisticsSection,
    aiSection,
    communicationsSection,
    supportSection,
  ];

  // Aggiungi finanze (sempre visibile, modificato in base a isReseller)
  sections.push(financeSection);

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

  // Azioni principali (visibili sempre in alto)
  const mainActions: NavItem[] = [
    {
      id: 'ai-assistant',
      label: 'AI Assistant',
      href: '#ai-assistant',
      icon: Bot,
      variant: 'ai',
      description: 'Apri Anne, il tuo assistente virtuale',
    },
  ];

  return {
    mainActions,
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
