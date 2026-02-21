'use client';

import {
  Check,
  MapPin,
  User,
  Package,
  Settings,
  Truck,
  CalendarClock,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShipmentWizard, WizardStep, STEP_ORDER } from '../ShipmentWizardContext';

const STEP_CONFIG: Record<WizardStep, { label: string; icon: React.ElementType }> = {
  sender: { label: 'Mittente', icon: User },
  recipient: { label: 'Destinatario', icon: MapPin },
  packages: { label: 'Colli', icon: Package },
  services: { label: 'Servizi', icon: Settings },
  pickup: { label: 'Ritiro', icon: CalendarClock },
  carrier: { label: 'Corriere', icon: Truck },
  confirm: { label: 'Conferma', icon: ClipboardCheck },
};

export function WizardProgress() {
  const { currentStep, setCurrentStep, isStepComplete, validateStep } = useShipmentWizard();

  const currentIndex = STEP_ORDER.indexOf(currentStep);

  const canNavigateToStep = (stepIndex: number): boolean => {
    // Can always go back
    if (stepIndex < currentIndex) return true;
    // Can go to current step
    if (stepIndex === currentIndex) return true;
    // Can only go forward if all previous steps are complete
    for (let i = 0; i < stepIndex; i++) {
      if (!isStepComplete(STEP_ORDER[i])) return false;
    }
    return true;
  };

  return (
    <div className="w-full py-4">
      {/* Desktop: Horizontal stepper */}
      <div className="hidden md:flex items-center justify-between">
        {STEP_ORDER.map((step, index) => {
          const config = STEP_CONFIG[step];
          const Icon = config.icon;
          const isActive = step === currentStep;
          const isComplete = isStepComplete(step) && index < currentIndex;
          const isPast = index < currentIndex;
          const canNavigate = canNavigateToStep(index);

          return (
            <div key={step} className="flex items-center flex-1">
              {/* Step circle */}
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

              {/* Step label */}
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

              {/* Connector line */}
              {index < STEP_ORDER.length - 1 && (
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

      {/* Mobile: Vertical stepper with current step highlighted */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-500">
            Passo {currentIndex + 1} di {STEP_ORDER.length}
          </span>
          <span className="text-sm font-medium text-blue-600">
            {STEP_CONFIG[currentStep].label}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / STEP_ORDER.length) * 100}%` }}
          />
        </div>

        {/* Step dots */}
        <div className="flex justify-between mt-2">
          {STEP_ORDER.map((step, index) => {
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
