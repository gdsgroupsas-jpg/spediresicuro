'use client';

import { Check, Building2, Truck, FileText, Settings, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useQuoteWizard,
  QUOTE_STEP_ORDER,
  type QuoteWizardStep,
} from '../CommercialQuoteWizardContext';

const STEP_CONFIG: Record<QuoteWizardStep, { label: string; icon: React.ElementType }> = {
  prospect: { label: 'Prospect', icon: Building2 },
  carrier: { label: 'Corriere', icon: Truck },
  offerta: { label: 'Offerta', icon: FileText },
  servizi: { label: 'Servizi', icon: Settings },
  riepilogo: { label: 'Riepilogo', icon: ClipboardCheck },
};

export function QuoteWizardProgress() {
  const { currentStep, setCurrentStep, isStepComplete } = useQuoteWizard();

  const currentIndex = QUOTE_STEP_ORDER.indexOf(currentStep);

  const canNavigateToStep = (stepIndex: number): boolean => {
    if (stepIndex < currentIndex) return true;
    if (stepIndex === currentIndex) return true;
    for (let i = 0; i < stepIndex; i++) {
      if (!isStepComplete(QUOTE_STEP_ORDER[i])) return false;
    }
    return true;
  };

  return (
    <div className="w-full py-4">
      {/* Desktop: Horizontal stepper */}
      <div className="hidden md:flex items-center justify-between">
        {QUOTE_STEP_ORDER.map((step, index) => {
          const config = STEP_CONFIG[step];
          const Icon = config.icon;
          const isActive = step === currentStep;
          const isComplete = isStepComplete(step) && index < currentIndex;
          const isPast = index < currentIndex;
          const canNavigate = canNavigateToStep(index);

          return (
            <div key={step} className="flex items-center flex-1">
              <button
                onClick={() => canNavigate && setCurrentStep(step)}
                disabled={!canNavigate}
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200',
                  isActive && 'bg-blue-600 border-blue-600 text-white shadow-lg scale-110',
                  isComplete && 'bg-green-500 border-green-500 text-white',
                  isPast && !isComplete && 'bg-gray-200 border-gray-300 text-gray-500',
                  !isActive && !isComplete && !isPast && 'bg-white border-gray-300 text-gray-400',
                  canNavigate &&
                    !isActive &&
                    'hover:border-blue-400 hover:text-blue-500 cursor-pointer',
                  !canNavigate && 'cursor-not-allowed opacity-50'
                )}
              >
                {isComplete ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </button>

              <span
                className={cn(
                  'ml-2 text-sm font-medium hidden lg:block',
                  isActive && 'text-blue-600',
                  isComplete && 'text-green-600',
                  !isActive && !isComplete && 'text-gray-500'
                )}
              >
                {config.label}
              </span>

              {index < QUOTE_STEP_ORDER.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-3',
                    index < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: Progress bar + dots */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-500">
            Passo {currentIndex + 1} di {QUOTE_STEP_ORDER.length}
          </span>
          <span className="text-sm font-medium text-blue-600">
            {STEP_CONFIG[currentStep].label}
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / QUOTE_STEP_ORDER.length) * 100}%` }}
          />
        </div>

        <div className="flex justify-between mt-2">
          {QUOTE_STEP_ORDER.map((step, index) => {
            const isActive = step === currentStep;
            const isComplete = isStepComplete(step) && index < currentIndex;
            const canNavigate = canNavigateToStep(index);

            return (
              <button
                key={step}
                onClick={() => canNavigate && setCurrentStep(step)}
                disabled={!canNavigate}
                className={cn(
                  'w-3 h-3 rounded-full transition-all',
                  isActive && 'bg-blue-600 scale-125',
                  isComplete && 'bg-green-500',
                  !isActive && !isComplete && 'bg-gray-300',
                  !canNavigate && 'opacity-50'
                )}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
