'use client';

/**
 * Dialog con Wizard per creare nuovi clienti (Persona o Azienda)
 *
 * Utilizza il componente OnboardingWizard in mode="reseller"
 * per permettere ai reseller di creare clienti completi.
 */

import { useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { OnboardingWizard } from '@/components/onboarding';

interface CreateClientWizardDialogProps {
  onSuccess?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function CreateClientWizardDialog({
  onSuccess,
  isOpen: externalIsOpen,
  onClose: externalOnClose,
}: CreateClientWizardDialogProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const handleClose = () => {
    if (externalOnClose) {
      externalOnClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const handleOpen = () => {
    setInternalIsOpen(true);
  };

  const handleComplete = (data: any) => {
    if (data.generatedPassword) {
      toast.success(`Cliente creato! Password: ${data.generatedPassword}`, { duration: 10000 });
    } else {
      toast.success('Cliente creato con successo!');
    }

    // Delay close to let user see the success message
    setTimeout(() => {
      handleClose();
      onSuccess?.();
    }, 2000);
  };

  return (
    <>
      {/* Trigger button (only if not controlled externally) */}
      {externalIsOpen === undefined && (
        <Button
          onClick={handleOpen}
          className="bg-[#FACC15] hover:bg-[#FBBF24] text-black font-semibold"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Nuovo Cliente
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-100 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#FACC15]" />
              Crea Nuovo Cliente
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Compila i dati per creare un nuovo cliente. Potrà essere una persona fisica o
              un&apos;azienda.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <OnboardingWizard mode="reseller" onComplete={handleComplete} onCancel={handleClose} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
