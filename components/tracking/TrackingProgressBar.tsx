/**
 * TrackingProgressBar — Barra progresso animata per il ciclo vita spedizione
 *
 * 5 step principali: Creato → Ritirato → In Transito → In Consegna → Consegnato
 * Branch visivo per giacenza/exception (deviazione dal flusso principale).
 *
 * Responsive: orizzontale su desktop, verticale su mobile.
 * Animazioni con CSS transitions (leggero, no Framer Motion necessario).
 */

'use client';

import { Package, Truck, MapPin, CheckCircle2, AlertCircle, Clock, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';

// Step del ciclo vita spedizione
const LIFECYCLE_STEPS = [
  { key: 'created', label: 'Creato', icon: Package },
  { key: 'picked_up', label: 'Ritirato', icon: Package },
  { key: 'in_transit', label: 'In Transito', icon: Truck },
  { key: 'out_for_delivery', label: 'In Consegna', icon: MapPin },
  { key: 'delivered', label: 'Consegnato', icon: CheckCircle2 },
] as const;

// Mappa stato normalizzato → indice step (0-4)
const STATUS_TO_STEP_INDEX: Record<string, number> = {
  created: 0,
  pending_pickup: 0,
  picked_up: 1,
  in_transit: 2,
  at_destination: 3,
  out_for_delivery: 3,
  delivered: 4,
};

// Stati "anomali" che generano un branch
const ANOMALY_STATUSES = new Set(['in_giacenza', 'exception', 'returned', 'cancelled']);

interface TrackingProgressBarProps {
  currentStatus: string;
  className?: string;
  compact?: boolean;
}

export function TrackingProgressBar({
  currentStatus,
  className,
  compact = false,
}: TrackingProgressBarProps) {
  const isAnomaly = ANOMALY_STATUSES.has(currentStatus);
  const activeStepIndex = isAnomaly
    ? (STATUS_TO_STEP_INDEX['in_transit'] ?? 2) // Anomalie partono da "in transito"
    : (STATUS_TO_STEP_INDEX[currentStatus] ?? -1);

  return (
    <div className={cn('w-full', className)}>
      {/* Desktop: orizzontale */}
      <div className={cn('hidden sm:block', compact && '!block')}>
        <div className="flex items-center justify-between">
          {LIFECYCLE_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index <= activeStepIndex && !isAnomaly;
            const isCompletedBeforeAnomaly = isAnomaly && index < activeStepIndex;
            const isCurrent = index === activeStepIndex && !isAnomaly;
            const isActive = isCompleted || isCompletedBeforeAnomaly;

            return (
              <div key={step.key} className="flex items-center flex-1 last:flex-none">
                {/* Step circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500',
                      isActive
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                        : isCurrent
                          ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30 ring-4 ring-blue-500/20'
                          : 'bg-gray-100 text-gray-400',
                      isCurrent && 'animate-pulse'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  {!compact && (
                    <span
                      className={cn(
                        'mt-1.5 text-[10px] font-medium text-center leading-tight transition-colors duration-300',
                        isActive || isCurrent ? 'text-gray-900' : 'text-gray-400'
                      )}
                    >
                      {step.label}
                    </span>
                  )}
                </div>

                {/* Connettore */}
                {index < LIFECYCLE_STEPS.length - 1 && (
                  <div className="flex-1 mx-1.5 h-0.5 relative">
                    <div className="absolute inset-0 bg-gray-200 rounded-full" />
                    <div
                      className={cn(
                        'absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out',
                        isActive || isCompletedBeforeAnomaly
                          ? 'bg-emerald-500 w-full'
                          : 'bg-transparent w-0'
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Branch anomalia */}
        {isAnomaly && <AnomalyBranch status={currentStatus} compact={compact} />}
      </div>

      {/* Mobile: verticale (solo quando non compact) */}
      {!compact && (
        <div className="sm:hidden">
          <div className="flex flex-col gap-0">
            {LIFECYCLE_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = index <= activeStepIndex && !isAnomaly;
              const isCompletedBeforeAnomaly = isAnomaly && index < activeStepIndex;
              const isCurrent = index === activeStepIndex && !isAnomaly;
              const isActive = isCompleted || isCompletedBeforeAnomaly;

              return (
                <div key={step.key} className="flex items-start gap-3">
                  {/* Timeline verticale */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500 flex-shrink-0',
                        isActive
                          ? 'bg-emerald-500 text-white'
                          : isCurrent
                            ? 'bg-blue-500 text-white ring-4 ring-blue-500/20'
                            : 'bg-gray-100 text-gray-400'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    {index < LIFECYCLE_STEPS.length - 1 && (
                      <div className="w-0.5 h-6 relative my-0.5">
                        <div className="absolute inset-0 bg-gray-200" />
                        <div
                          className={cn(
                            'absolute inset-x-0 top-0 transition-all duration-500',
                            isActive || isCompletedBeforeAnomaly
                              ? 'bg-emerald-500 h-full'
                              : 'bg-transparent h-0'
                          )}
                        />
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      'text-sm font-medium pt-1 transition-colors duration-300',
                      isActive || isCurrent ? 'text-gray-900' : 'text-gray-400'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Branch anomalia mobile */}
          {isAnomaly && <AnomalyBranch status={currentStatus} compact={false} mobile />}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ANOMALY BRANCH
// ═══════════════════════════════════════════════════════════════════════════

const ANOMALY_CONFIG: Record<
  string,
  { label: string; icon: typeof AlertCircle; color: string; bgColor: string }
> = {
  in_giacenza: {
    label: 'In Giacenza',
    icon: Archive,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500',
  },
  exception: {
    label: 'Eccezione',
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-500',
  },
  returned: {
    label: 'Reso',
    icon: AlertCircle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-500',
  },
  cancelled: {
    label: 'Annullato',
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-500',
  },
};

function AnomalyBranch({
  status,
  compact,
  mobile = false,
}: {
  status: string;
  compact: boolean;
  mobile?: boolean;
}) {
  const config = ANOMALY_CONFIG[status];
  if (!config) return null;

  const Icon = config.icon;

  if (mobile) {
    return (
      <div className="ml-[26px] mt-1 flex items-center gap-2 pl-3 border-l-2 border-dashed border-amber-300">
        <div
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center',
            config.bgColor,
            'text-white'
          )}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className={cn('text-sm font-semibold', config.color)}>{config.label}</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 mt-2', compact ? 'ml-[40%]' : 'ml-[35%]')}>
      {/* Linea tratteggiata di deviazione */}
      <div className="w-6 h-0.5 border-t-2 border-dashed border-amber-400" />
      <div
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
          config.bgColor,
          'text-white shadow-sm'
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </div>
    </div>
  );
}
