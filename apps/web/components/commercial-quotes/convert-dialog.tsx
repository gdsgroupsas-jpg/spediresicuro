'use client';

/**
 * Dialog conversione preventivo -> cliente operativo
 *
 * Form: email + nome + password temporanea -> convertQuoteToClientAction
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { convertQuoteToClientAction } from '@/actions/commercial-quotes';
import { CheckCircle2, Loader2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ConvertDialogProps {
  quoteId: string | null;
  prospectCompany?: string;
  prospectEmail?: string | null;
  prospectPhone?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted?: () => void;
}

export function ConvertDialog({
  quoteId,
  prospectCompany,
  prospectEmail,
  prospectPhone,
  open,
  onOpenChange,
  onConverted,
}: ConvertDialogProps) {
  const [email, setEmail] = useState(prospectEmail || '');
  const [name, setName] = useState(prospectCompany || '');
  const [companyName, setCompanyName] = useState(prospectCompany || '');
  const [phone, setPhone] = useState(prospectPhone || '');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sincronizza state quando le props cambiano (dati caricati async)
  useEffect(() => {
    if (open) {
      setEmail(prospectEmail || '');
      setName(prospectCompany || '');
      setCompanyName(prospectCompany || '');
      setPhone(prospectPhone || '');
      setPassword('');
      setSuccess(false);
    }
  }, [open, prospectEmail, prospectCompany, prospectPhone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!quoteId) return;
    if (!email.trim()) {
      toast.error('Email obbligatoria');
      return;
    }
    if (!name.trim()) {
      toast.error('Nome obbligatorio');
      return;
    }
    if (!password || password.length < 8) {
      toast.error('Password: almeno 8 caratteri');
      return;
    }

    setIsLoading(true);

    try {
      const result = await convertQuoteToClientAction({
        quote_id: quoteId,
        client_email: email,
        client_name: name,
        client_password: password,
        client_company_name: companyName || undefined,
        client_phone: phone || undefined,
      });

      if (result.success) {
        setSuccess(true);
        toast.success('Cliente creato con successo!');
        onConverted?.();
      } else {
        toast.error(result.error || 'Errore conversione');
      }
    } catch (error: any) {
      toast.error(error.message || 'Errore imprevisto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Converti in Cliente
          </DialogTitle>
          <DialogDescription>
            Crea un account operativo per {prospectCompany || 'il prospect'} con listino
            personalizzato dal preventivo accettato.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <DialogBody>
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Cliente Creato!</h3>
              <p className="text-sm text-gray-600 text-center mb-1">
                Account creato per <strong>{email}</strong>
              </p>
              <p className="text-sm text-gray-600 text-center">
                Il cliente pu\u00F2 accedere con le credenziali fornite.
              </p>
              <Button onClick={handleClose} className="mt-6">
                Chiudi
              </Button>
            </div>
          </DialogBody>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogBody>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="convert-email">Email *</Label>
                  <Input
                    id="convert-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@azienda.it"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="convert-name">Nome utente *</Label>
                  <Input
                    id="convert-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Mario Rossi"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="convert-company">Ragione sociale</Label>
                  <Input
                    id="convert-company"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Es. Azienda Esempio SRL"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="convert-phone">Telefono</Label>
                  <Input
                    id="convert-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+39 333 1234567"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="convert-password">Password temporanea *</Label>
                  <Input
                    id="convert-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimo 8 caratteri"
                    required
                    minLength={8}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Il cliente potr\u00E0 cambiarla al primo accesso
                  </p>
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Annulla
              </Button>
              <Button type="submit" disabled={isLoading || !email || !name || !password}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creazione...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Crea Cliente
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
