'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Plus, Eye, EyeOff, Copy, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { createSubUser } from '@/actions/admin-reseller';
import { createUserSchema, type CreateUserInput } from '@/lib/validations/user-schema';
import { formatCurrency } from '@/lib/utils';

interface CreateUserDialogProps {
  onSuccess?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function CreateUserDialog({
  onSuccess,
  isOpen: externalIsOpen,
  onClose: externalOnClose,
}: CreateUserDialogProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalOnClose ? () => externalOnClose() : setInternalIsOpen;
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      initialBalance: 0,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = form;
  const initialBalance = watch('initialBalance');

  async function onSubmit(data: CreateUserInput) {
    startTransition(async () => {
      try {
        const result = await createSubUser({
          name: data.name,
          email: data.email,
          password: data.password || undefined,
        });

        if (!result.success) {
          toast.error(result.error || 'Errore nella creazione del cliente');
          return;
        }

        // Se è stata generata una password, mostrala
        if (result.generatedPassword) {
          setGeneratedPassword(result.generatedPassword);
          toast.success(`Cliente ${data.name} creato con successo!`);
        } else {
          toast.success(`Cliente ${data.name} creato con successo!`);
          reset();
          setIsOpen(false);
          onSuccess?.();
        }
      } catch (error) {
        toast.error('Errore imprevisto. Riprova.');
        console.error('Create user error:', error);
      }
    });
  }

  const handleClose = () => {
    if (!isPending) {
      reset();
      setGeneratedPassword(null);
      setCopied(false);
      setIsOpen(false);
    }
  };

  const handleCopyPassword = async () => {
    if (generatedPassword) {
      await navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      toast.success('Password copiata negli appunti');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseWithPassword = () => {
    reset();
    setGeneratedPassword(null);
    setCopied(false);
    setIsOpen(false);
    onSuccess?.();
  };

  return (
    <>
      {externalIsOpen === undefined && (
        <Button onClick={() => setIsOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Cliente
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent onClose={handleClose} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crea Nuovo Cliente</DialogTitle>
            <DialogDescription>
              Inserisci i dati del nuovo cliente. Se non specifichi una password, verrà generata
              automaticamente.
            </DialogDescription>
          </DialogHeader>

          {generatedPassword ? (
            // Mostra password generata
            <div className="py-6">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  Password generata automaticamente
                </p>
                <p className="text-xs text-amber-600 mb-3">
                  Copia e salva questa password. Non sarà più visibile dopo la chiusura.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white px-3 py-2 rounded border border-amber-200 font-mono text-sm">
                    {generatedPassword}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyPassword}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={handleCloseWithPassword} className="w-full">
                  Ho salvato la password, chiudi
                </Button>
              </DialogFooter>
            </div>
          ) : (
            // Form creazione
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name" required>
                  Nome completo
                </Label>
                <Input
                  id="name"
                  placeholder="Mario Rossi"
                  {...register('name')}
                  error={!!errors.name}
                  disabled={isPending}
                  autoFocus
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" required>
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="mario@esempio.it"
                  {...register('email')}
                  error={!!errors.email}
                  disabled={isPending}
                />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Password <span className="text-gray-400 font-normal">(opzionale)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Lascia vuoto per generarne una"
                    {...register('password')}
                    error={!!errors.password}
                    disabled={isPending}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="initialBalance">
                  Saldo iniziale <span className="text-gray-400 font-normal">(opzionale)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="initialBalance"
                    type="number"
                    step="0.01"
                    min="0"
                    max="10000"
                    placeholder="0.00"
                    {...register('initialBalance', { valueAsNumber: true })}
                    error={!!errors.initialBalance}
                    disabled={isPending}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    €
                  </span>
                </div>
                {errors.initialBalance && (
                  <p className="text-xs text-red-500">{errors.initialBalance.message}</p>
                )}
                {initialBalance > 0 && (
                  <p className="text-xs text-gray-500">
                    Il cliente partirà con un saldo di {formatCurrency(initialBalance)}
                  </p>
                )}
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                  Annulla
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isPending ? 'Creazione...' : 'Crea Cliente'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
