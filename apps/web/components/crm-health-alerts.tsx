'use client';

/**
 * CRM Health Alerts Widget — Componente condiviso tra admin leads e reseller prospects
 *
 * Visualizza alert di salute CRM organizzati per severity (critico, warning, info).
 * Pattern UI coerente con CrmAnalyticsPanel.
 */

import type { CrmAlert, CrmAlertLevel } from '@/lib/crm/health-rules';
import type { HealthAlertsSummary } from '@/app/actions/crm-health';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';

// ============================================
// CONFIGURAZIONE VISUALE
// ============================================

const LEVEL_CONFIG: Record<
  CrmAlertLevel,
  {
    icon: LucideIcon;
    label: string;
    cardBg: string;
    iconColor: string;
    borderColor: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  critical: {
    icon: AlertTriangle,
    label: 'Critico',
    cardBg: 'bg-red-50',
    iconColor: 'text-red-500',
    borderColor: 'border-red-200',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
  },
  warning: {
    icon: AlertCircle,
    label: 'Attenzione',
    cardBg: 'bg-orange-50',
    iconColor: 'text-orange-500',
    borderColor: 'border-orange-200',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-700',
  },
  info: {
    icon: Info,
    label: 'Informazione',
    cardBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    borderColor: 'border-blue-200',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
  },
};

// ============================================
// COMPONENTE PRINCIPALE
// ============================================

interface CrmHealthAlertsProps {
  data: HealthAlertsSummary;
}

export default function CrmHealthAlerts({ data }: CrmHealthAlertsProps) {
  const { alerts, totalCritical, totalWarning, totalInfo } = data;

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-400 mb-3" />
        <h3 className="text-lg font-semibold text-gray-900">Tutto in ordine!</h3>
        <p className="text-sm text-gray-500 mt-1">Nessun alert di salute CRM al momento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard level="critical" count={totalCritical} />
        <SummaryCard level="warning" count={totalWarning} />
        <SummaryCard level="info" count={totalInfo} />
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        {alerts.map((alert) => (
          <AlertCard key={`${alert.type}-${alert.entityId}`} alert={alert} />
        ))}
      </div>
    </div>
  );
}

// ============================================
// SOTTO-COMPONENTI
// ============================================

function SummaryCard({ level, count }: { level: CrmAlertLevel; count: number }) {
  const config = LEVEL_CONFIG[level];
  const Icon = config.icon;

  return (
    <div
      className={`${config.cardBg} ${config.borderColor} border rounded-xl p-4 flex items-center gap-3`}
    >
      <div className={`${config.iconColor}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{count}</div>
        <div className="text-xs text-gray-600">{config.label}</div>
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: CrmAlert }) {
  const config = LEVEL_CONFIG[alert.level];
  const Icon = config.icon;

  return (
    <div
      className={`${config.cardBg} ${config.borderColor} border rounded-xl p-4 flex items-start gap-3`}
    >
      <div className={`${config.iconColor} mt-0.5 flex-shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-gray-900">{alert.entityName}</span>
          <span
            className={`${config.badgeBg} ${config.badgeText} px-2 py-0.5 rounded-full text-[10px] font-bold uppercase`}
          >
            {config.label}
          </span>
          <span className="text-xs text-gray-400 capitalize">{alert.entityType}</span>
        </div>
        <p className="text-sm text-gray-700 mt-1">{alert.message}</p>
        <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
          <Clock className="w-3 h-3" />
          <span>{alert.daysSinceEvent} giorni</span>
        </div>
      </div>
    </div>
  );
}
