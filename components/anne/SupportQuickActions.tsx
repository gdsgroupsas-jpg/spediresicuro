/**
 * SupportQuickActions
 *
 * Pill-style quick actions per problemi comuni di supporto.
 * Mostrate nella chat di Anne per guidare l'utente.
 */

'use client';

import { Package, MapPin, RefreshCw, HelpCircle } from 'lucide-react';

interface QuickAction {
  label: string;
  message: string;
  icon: React.ReactNode;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Traccia spedizione',
    message: 'Vorrei tracciare la mia spedizione',
    icon: <Package className="w-3 h-3" />,
  },
  {
    label: 'Problema giacenza',
    message: 'Ho una spedizione in giacenza, puoi aiutarmi?',
    icon: <MapPin className="w-3 h-3" />,
  },
  {
    label: 'Stato rimborso',
    message: 'Vorrei verificare lo stato di un rimborso',
    icon: <RefreshCw className="w-3 h-3" />,
  },
  {
    label: 'Ho un problema',
    message: 'Ho bisogno di assistenza per una spedizione',
    icon: <HelpCircle className="w-3 h-3" />,
  },
];

interface SupportQuickActionsProps {
  onSelect: (message: string) => void;
}

export function SupportQuickActions({ onSelect }: SupportQuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-1.5 px-4 py-2">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.label}
          onClick={() => onSelect(action.message)}
          className="flex items-center gap-1 px-2.5 py-1 bg-white border border-purple-200 text-purple-700 rounded-full text-xs hover:bg-purple-50 hover:border-purple-300 transition-colors"
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
}
