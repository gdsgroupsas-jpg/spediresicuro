'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Store, Mail, User, Key, Wallet, Sparkles } from 'lucide-react';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

import { createReseller } from '@/actions/super-admin';
import { formatCurrency } from '@/lib/utils';

const createResellerSchema = z.object({
  email: z.string().email('Email non valida'),
  name: z.string().min(2, 'Nome troppo corto'),
  password: z.string().min(8, 'Password minimo 8 caratteri'),
  initialCredit: z.number().min(0, 'Credito non valido').max(10000, 'Credito massimo €10,000'),
  notes: z.string().optional(),
});

type CreateResellerInput = z.infer<typeof createResellerSchema>;

interface CreateResellerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const QUICK_CREDITS = [0, 50, 100, 250, 500, 1000];

export function CreateResellerDialog({ isOpen, onClose, onSuccess }: CreateResellerDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<CreateResellerInput>({
    resolver: zodResolver(createResellerSchema),
    defaultValues: {
      email: '',
      name: '',
      password: '',
      initialCredit: 100,
      notes: '',
    },
  });

  const initialCredit = watch('initialCredit');

  const handleGeneratePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    const password = Array.from(
      { length: 12 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    setValue('password', password);
    setGeneratedPassword(password);
    toast.success('Password generata!');
  };

  const handleQuickCredit = (amount: number) => {
    setValue('initialCredit', amount);
  };

  async function onSubmit(data: CreateResellerInput) {
    startTransition(async () => {
      try {
        const result = await createReseller({
          email: data.email,
          name: data.name,
          password: data.password,
          initialCredit: data.initialCredit,
          notes: data.notes,
        });

        if (!result.success) {
          toast.error(result.error || 'Errore nella creazione reseller');
          return;
        }

        toast.success(
          <div>
            <p className="font-semibold">🎉 Reseller creato con successo!</p>
            <p className="text-sm mt-1">
              Account attivato con {formatCurrency(data.initialCredit)} di credito
            </p>
          </div>
        );

        reset();
        setGeneratedPassword(null);
        onClose();
        onSuccess?.();
      } catch (error) {
        toast.error('Errore imprevisto. Riprova.');
        console.error('Create reseller error:', error);
      }
    });
  }

  const handleClose = () => {
    if (!isPending) {
      reset();
      setGeneratedPassword(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent size="large">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl">Crea Nuovo Reseller</DialogTitle>
              <DialogDescription>
                Crea un account reseller completo con accesso immediato
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <DialogBody className="space-y-6">
            {/* Informazioni Account */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Informazioni Account</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                    Nome Completo *
                  </Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder="Mario Rossi"
                    className="mt-1"
                    disabled={isPending}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email *
                  </Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      placeholder="reseller@example.com"
                      className="pl-10"
                      disabled={isPending}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password *
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <div className="relative flex-1">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="password"
                        type="text"
                        {...register('password')}
                        placeholder="Minimo 8 caratteri"
                        className="pl-10"
                        disabled={isPending}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGeneratePassword}
                      disabled={isPending}
                      className="shrink-0"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Genera
                    </Button>
                  </div>
                  {generatedPassword && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                      <p className="text-green-800 font-mono">{generatedPassword}</p>
                      <p className="text-green-600 text-xs mt-1">Salva questa password!</p>
                    </div>
                  )}
                  {errors.password && (
                    <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Credito Iniziale */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900">Credito Iniziale</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="initialCredit" className="text-sm font-medium text-gray-700">
                    Importo da Accreditare
                  </Label>
                  <Input
                    id="initialCredit"
                    type="number"
                    step="0.01"
                    {...register('initialCredit', { valueAsNumber: true })}
                    className="mt-1 text-lg font-semibold"
                    disabled={isPending}
                  />
                  {errors.initialCredit && (
                    <p className="text-sm text-red-600 mt-1">{errors.initialCredit.message}</p>
                  )}
                </div>

                {/* Quick Amounts */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Importi Rapidi
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_CREDITS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => handleQuickCredit(amount)}
                        disabled={isPending}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          initialCredit === amount
                            ? 'bg-green-600 text-white shadow-lg scale-105'
                            : 'bg-white border border-green-200 text-green-700 hover:bg-green-50'
                        }`}
                      >
                        {formatCurrency(amount)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Credito Totale:</span>
                    <span className="text-2xl font-bold text-green-600">
                      {formatCurrency(initialCredit || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Note (Opzionale) */}
            <div>
              <Label htmlFor="notes" className="text-sm font-medium text-gray-700">
                Note Interne (opzionale)
              </Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Es: Cliente referenziato da..."
                className="mt-1"
                rows={3}
                disabled={isPending}
              />
            </div>

            {/* Summary Badge */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="default" className="bg-purple-600">
                  🎯 Riepilogo
                </Badge>
              </div>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>✅ Account reseller attivato automaticamente</li>
                <li>✅ Credito wallet disponibile immediatamente</li>
                <li>✅ Può creare e gestire propri clienti</li>
                <li>✅ Accesso alla dashboard reseller</li>
              </ul>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creazione...
                </>
              ) : (
                <>
                  <Store className="w-4 h-4 mr-2" />
                  Crea Reseller
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
