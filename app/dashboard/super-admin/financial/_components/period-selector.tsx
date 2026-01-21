'use client';

import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type PeriodType = '7d' | '30d' | '90d' | 'ytd' | 'all';

interface PeriodSelectorProps {
  value: PeriodType;
  onChange: (period: PeriodType) => void;
}

const periodLabels: Record<PeriodType, string> = {
  '7d': 'Ultimi 7 giorni',
  '30d': 'Ultimi 30 giorni',
  '90d': 'Ultimi 90 giorni',
  ytd: 'Da inizio anno',
  all: 'Tutto il periodo',
};

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-[180px] justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span>{periodLabels[value]}</span>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]">
        <DropdownMenuItem onClick={() => onChange('7d')}>{periodLabels['7d']}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange('30d')}>{periodLabels['30d']}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange('90d')}>{periodLabels['90d']}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onChange('ytd')}>{periodLabels['ytd']}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange('all')}>{periodLabels['all']}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Calcola la data di inizio basata sul periodo selezionato
 */
export function getStartDateForPeriod(period: PeriodType): Date | null {
  const now = new Date();

  switch (period) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'ytd':
      return new Date(now.getFullYear(), 0, 1); // 1 Gennaio anno corrente
    case 'all':
      return null; // Nessun filtro
    default:
      return null;
  }
}
