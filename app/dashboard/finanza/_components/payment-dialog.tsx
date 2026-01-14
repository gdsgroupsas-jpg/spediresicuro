'use client';

import { useState } from 'react';
import { X, CreditCard, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  deadline?: {
    date: string;
    description: string;
    type: string;
  };
}

export function PaymentDialog({ isOpen, onClose, deadline }: PaymentDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [amount, setAmount] = useState('');

  const handlePayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Inserisci un importo valido');
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate Stripe payment processing
      // In production, this would call Stripe API
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Simulate payment with Stripe
      const paymentResult = await simulateStripePayment({
        amount: parseFloat(amount),
        description: deadline?.description || 'Pagamento fiscale',
        deadline: deadline?.date,
      });

      if (paymentResult.success) {
        setPaymentSuccess(true);
        toast.success('Pagamento effettuato con successo', {
          description: `€${amount} pagati per ${deadline?.description}`,
        });

        setTimeout(() => {
          onClose();
          setPaymentSuccess(false);
          setAmount('');
        }, 2000);
      } else {
        throw new Error(paymentResult.error || 'Pagamento fallito');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error('Errore nel pagamento', {
        description: error.message || 'Riprova più tardi',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  if (paymentSuccess) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl border border-green-500/30 w-full max-w-md shadow-2xl p-8">
          <div className="flex flex-col items-center gap-6">
            <div className="bg-green-600/20 p-4 rounded-full border-4 border-green-500/30">
              <CheckCircle2 className="w-16 h-16 text-green-400" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">
                Pagamento Completato
              </h2>
              <p className="text-slate-300">
                Il pagamento di €{amount} è stato processato con successo
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-600/20 p-2 rounded-lg border border-yellow-500/30">
              <CreditCard className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Paga Scadenza</h2>
              <p className="text-sm text-slate-400">
                {deadline?.description || 'Pagamento fiscale'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Chiudi dialog"
            disabled={isProcessing}
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Deadline Info */}
          {deadline && (
            <div className="bg-slate-900/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium text-yellow-400">
                  Scadenza
                </span>
              </div>
              <p className="text-slate-300 text-sm">
                <strong>Data:</strong>{' '}
                {new Date(deadline.date).toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <p className="text-slate-300 text-sm mt-1">
                <strong>Tipo:</strong> {deadline.type}
              </p>
            </div>
          )}

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Importo da pagare
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                €
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full bg-slate-700 text-white pl-10 pr-4 py-3 rounded-xl border border-slate-600 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 transition-all"
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Payment Method (Simulated) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Metodo di pagamento
            </label>
            <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-4 flex items-center gap-3">
              <CreditCard className="w-6 h-6 text-slate-400" />
              <div className="flex-1">
                <p className="text-white font-medium">Carta di credito</p>
                <p className="text-xs text-slate-400">•••• •••• •••• 4242</p>
              </div>
              <span className="text-xs text-green-400 font-medium">
                Verificata
              </span>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <p className="text-sm text-blue-300 leading-relaxed">
              💳 <strong>Pagamento sicuro</strong>: I tuoi dati sono protetti
              con crittografia SSL. Il pagamento viene processato tramite Stripe.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annulla
            </button>
            <button
              onClick={handlePayment}
              disabled={isProcessing || !amount}
              className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Elaborazione...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Paga Ora
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simulated Stripe payment function
async function simulateStripePayment(params: {
  amount: number;
  description: string;
  deadline?: string;
}): Promise<{ success: boolean; error?: string }> {
  // In production, this would be a server action that calls Stripe API
  // Example:
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  // const paymentIntent = await stripe.paymentIntents.create({
  //   amount: Math.round(params.amount * 100), // cents
  //   currency: 'eur',
  //   description: params.description,
  //   metadata: { deadline: params.deadline }
  // });

  console.log('Simulated Stripe payment:', params);

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // 95% success rate simulation
  if (Math.random() > 0.05) {
    return { success: true };
  } else {
    return { success: false, error: 'Carta rifiutata dalla banca' };
  }
}
