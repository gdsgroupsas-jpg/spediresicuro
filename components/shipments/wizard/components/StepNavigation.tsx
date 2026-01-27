'use client';

import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useShipmentWizard, STEP_ORDER } from '../ShipmentWizardContext';

interface StepNavigationProps {
  onSubmit?: () => void;
  submitLabel?: string;
}

export function StepNavigation({ onSubmit, submitLabel = 'Crea Spedizione' }: StepNavigationProps) {
  const {
    currentStep,
    goToNextStep,
    goToPrevStep,
    canGoNext,
    canGoPrev,
    isSubmitting,
    validateStep,
  } = useShipmentWizard();

  const isLastStep = currentStep === 'confirm';
  const currentValidation = validateStep(currentStep);

  const handleNext = () => {
    if (isLastStep && onSubmit) {
      onSubmit();
    } else {
      goToNextStep();
    }
  };

  return (
    <div className="flex items-center justify-between pt-6 border-t border-gray-200">
      {/* Back button */}
      <Button
        type="button"
        variant="outline"
        onClick={goToPrevStep}
        disabled={!canGoPrev || isSubmitting}
        className="flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Indietro
      </Button>

      {/* Validation errors hint */}
      {!currentValidation.isValid && currentValidation.errors.length > 0 && (
        <div className="hidden md:block text-sm text-red-500 max-w-xs text-center">
          {currentValidation.errors[0]}
        </div>
      )}

      {/* Next/Submit button */}
      <Button
        type="button"
        onClick={handleNext}
        disabled={(!canGoNext && !isLastStep) || isSubmitting || !currentValidation.isValid}
        className={`flex items-center gap-2 ${
          isLastStep
            ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
        }`}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creazione in corso...
          </>
        ) : isLastStep ? (
          <>
            {submitLabel}
            <ArrowRight className="w-4 h-4" />
          </>
        ) : (
          <>
            Avanti
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </div>
  );
}
