'use client';

import { useState, useTransition, useRef } from 'react';
import {
  Loader2,
  Wallet,
  Plus,
  CreditCard,
  UploadCloud,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  initiateCardRecharge,
  uploadBankTransferReceipt,
  getWalletRechargePreview,
} from '@/app/actions/wallet';
import { formatCurrency, cn } from '@/lib/utils';

interface RechargeWalletDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currentBalance: number;
}

const QUICK_AMOUNTS = [50, 100, 250, 500];

export function RechargeWalletDialog({
  isOpen,
  onClose,
  onSuccess,
  currentBalance,
}: RechargeWalletDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState('card');

  // Card Payment State
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [feePreview, setFeePreview] = useState<{
    fee: number;
    total: number;
    creditAmount?: number;
    vatAmount?: number;
    vatMode?: 'included' | 'excluded';
    vatRate?: number;
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Transfer State
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch VAT-aware preview from server (debounced)
  const updateCardAmount = async (val: number) => {
    setCardAmount(val);
    if (val > 0) {
      // Immediate local preview for responsiveness
      const fee = Number((val * 0.014 + 0.25).toFixed(2)); // Stripe: 1.4% + €0.25
      setFeePreview({ fee, total: val + fee });

      // Fetch VAT-aware preview from server
      setIsLoadingPreview(true);
      try {
        const result = await getWalletRechargePreview(val);
        if (result.success && result.preview) {
          setFeePreview({
            fee: result.preview.stripeFee,
            total: result.preview.totalToPay,
            creditAmount: result.preview.creditAmount,
            vatAmount: result.preview.vatAmount,
            vatMode: result.preview.vatMode,
            vatRate: result.preview.vatRate,
          });
        }
      } catch (error) {
        // Keep local preview on error
        console.warn('Preview fetch failed, using local calculation');
      } finally {
        setIsLoadingPreview(false);
      }
    } else {
      setFeePreview(null);
    }
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cardAmount <= 0) return;

    startTransition(async () => {
      try {
        const result = await initiateCardRecharge(cardAmount);
        if (result.success && result.checkoutUrl) {
          // Redirect diretto a Stripe Checkout
          window.location.href = result.checkoutUrl;
          // Dialog will close on redirect
        } else {
          toast.error('Errore inizializzazione pagamento');
        }
      } catch (error: any) {
        console.error('Errore Stripe:', error);
        toast.error(error.message || 'Errore di connessione al gateway');
      }
    });
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || transferAmount <= 0) {
      toast.error('Inserisci importo e allega ricevuta');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('amount', transferAmount.toString());

    startTransition(async () => {
      try {
        const result = await uploadBankTransferReceipt(formData);
        if (result.success) {
          toast.success("Ricevuta inviata! L'IA sta verificando i dati.");
          onSuccess?.();
          onClose();
        } else {
          toast.error(result.error || 'Errore upload');
        }
      } catch (error) {
        toast.error('Errore imprevisto');
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isPending && open && onClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-slate-50">
        <DialogHeader className="p-6 bg-white border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Wallet className="h-6 w-6 text-indigo-600" />
            Ricarica Credito
          </DialogTitle>
          <DialogDescription>
            Scegli il metodo di ricarica preferito. I fondi saranno subito disponibili*
          </DialogDescription>
        </DialogHeader>

        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 p-1 bg-slate-200/50 rounded-xl">
              <TabsTrigger
                value="card"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all py-2.5"
              >
                <CreditCard className="w-4 h-4 mr-2" /> Carta / Stripe
              </TabsTrigger>
              <TabsTrigger
                value="transfer"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all py-2.5"
              >
                <FileText className="w-4 h-4 mr-2" /> Bonifico Smart
              </TabsTrigger>
            </TabsList>

            {/* --- TAB CARTA --- */}
            <TabsContent
              value="card"
              className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="space-y-4">
                <Label>Seleziona o Inserisci Importo</Label>
                <div className="grid grid-cols-4 gap-3">
                  {QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => updateCardAmount(amt)}
                      className={cn(
                        'py-2 px-3 rounded-lg border text-sm font-medium transition-all',
                        cardAmount === amt
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                          : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                      )}
                    >
                      {amt} €
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="Altro importo..."
                    value={cardAmount || ''}
                    onChange={(e) => updateCardAmount(parseFloat(e.target.value))}
                    className="pl-8 text-lg font-semibold"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                </div>

                {feePreview && (
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-2">
                    {/* Credito che riceverai */}
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Credito Wallet</span>
                      <span className="font-semibold">
                        {isLoadingPreview ? (
                          <Loader2 className="w-4 h-4 animate-spin inline" />
                        ) : (
                          formatCurrency(feePreview.creditAmount ?? cardAmount)
                        )}
                      </span>
                    </div>

                    {/* VAT breakdown (solo se IVA esclusa) */}
                    {feePreview.vatMode === 'excluded' && feePreview.vatAmount && (
                      <div className="flex justify-between text-sm text-amber-600 bg-amber-50/50 -mx-4 px-4 py-1.5">
                        <span>IVA {feePreview.vatRate || 22}% (esclusa dal credito)</span>
                        <span>{formatCurrency(feePreview.vatAmount)}</span>
                      </div>
                    )}

                    {/* Info IVA inclusa */}
                    {feePreview.vatMode === 'included' && (
                      <div className="text-xs text-emerald-600 bg-emerald-50/50 -mx-4 px-4 py-1.5">
                        IVA inclusa - ricevi l&apos;intero importo come credito
                      </div>
                    )}

                    {/* Commissioni Stripe */}
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Commissioni Stripe (1.4% + 0.25€)</span>
                      <span>+ {formatCurrency(feePreview.fee)}</span>
                    </div>

                    {/* Totale */}
                    <div className="border-t border-indigo-100 mt-2 pt-2 flex justify-between items-center">
                      <span className="font-bold text-indigo-900">Totale Addebito</span>
                      <span className="text-xl font-bold text-indigo-600">
                        {formatCurrency(feePreview.total)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleCardSubmit}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 text-lg shadow-lg shadow-indigo-200"
                disabled={isPending || cardAmount <= 0}
              >
                {isPending ? <Loader2 className="animate-spin" /> : 'Procedi al Pagamento Sicuro'}
              </Button>
              <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Gestito da Stripe (PCI DSS compliant)
              </p>
            </TabsContent>

            {/* --- TAB BONIFICO --- */}
            <TabsContent
              value="transfer"
              className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-800">
                <p className="font-semibold mb-1">IBAN per Ricarica:</p>
                <p className="font-mono text-lg bg-white/50 px-2 py-1 rounded select-all mb-2">
                  IT00 X000 0000 0000 0000 0000 000
                </p>
                <p className="text-xs opacity-80">Intestato a SpedireSicuro S.R.L.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Importo Bonificato</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={transferAmount || ''}
                    onChange={(e) => setTransferAmount(parseFloat(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Ricevuta (PDF/IMG)</Label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-white',
                      file
                        ? 'border-emerald-500 bg-emerald-50/30'
                        : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50'
                    )}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      hidden
                      accept=".pdf,.jpg,.png,.jpeg"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    {file ? (
                      <>
                        <FileText className="w-10 h-10 text-emerald-600 mb-2" />
                        <p className="font-medium text-emerald-900">{file.name}</p>
                        <p className="text-xs text-emerald-600">Clicca per cambiare</p>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-10 h-10 text-slate-400 mb-2" />
                        <p className="font-medium text-slate-600">Carica Ricevuta</p>
                        <p className="text-xs text-slate-400">PDF o Immagine leggibile</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleTransferSubmit}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 shadow-lg shadow-emerald-200"
                disabled={isPending || !file || transferAmount <= 0}
              >
                {isPending ? <Loader2 className="animate-spin" /> : 'Invia per Verifica AI'}
              </Button>
              <p className="text-center text-xs text-slate-400">
                *L&apos;accredito è automatico dopo la verifica intelligente (max 2h)
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
