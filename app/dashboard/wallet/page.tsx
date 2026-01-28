'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  User as UserIcon,
  Calendar,
  Filter,
  Download,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RechargeWalletDialog } from '@/components/wallet/recharge-wallet-dialog';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';

interface WalletTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
  created_by?: string;
  balance_after?: number;
}

interface WalletStats {
  currentBalance: number;
  totalCredits: number;
  totalDebits: number;
  transactionsCount: number;
  lastRecharge?: string;
  averageTransaction: number;
}

export default function WalletPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');
  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false);

  // Verifica autenticazione
  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated' || !session) {
      router.push('/login');
      return;
    }

    loadWalletData();
  }, [session, status, router]);

  async function loadWalletData() {
    try {
      setIsLoading(true);

      // Carica info utente con wallet balance
      let currentBalance = 0;
      const userResponse = await fetch('/api/user/info');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        const user = userData.user || userData;
        currentBalance = user.wallet_balance || 0;
        setWalletBalance(currentBalance);
      }

      // Carica transazioni reali dal database
      let loadedTransactions: WalletTransaction[] = [];
      const transactionsResponse = await fetch('/api/wallet/transactions');
      if (transactionsResponse.ok) {
        const transactionsData = await transactionsResponse.json();
        if (transactionsData.success && transactionsData.transactions) {
          // Le transazioni arrivano in ordine decrescente (più recenti prima)
          // Calcola balance_after partendo dal saldo attuale e andando indietro
          // IMPORTANTE: usa currentBalance (valore appena caricato) invece di walletBalance (state asincrono)
          let runningBalance = currentBalance;
          loadedTransactions = transactionsData.transactions.map((tx: WalletTransaction) => {
            // Sottrai l'importo per ottenere il saldo prima di questa transazione
            runningBalance -= tx.amount;
            return {
              ...tx,
              balance_after: runningBalance + tx.amount, // Saldo dopo questa transazione
            };
          });
        }
      }

      setTransactions(loadedTransactions);

      // Calcola statistiche dalle transazioni caricate
      const totalCredits = loadedTransactions
        .filter((t) => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);

      const totalDebits = Math.abs(
        loadedTransactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)
      );

      const lastRecharge = loadedTransactions
        .filter((t) => t.amount > 0)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      setStats({
        currentBalance: walletBalance,
        totalCredits,
        totalDebits,
        transactionsCount: loadedTransactions.length,
        lastRecharge: lastRecharge?.created_at,
        averageTransaction:
          loadedTransactions.length > 0
            ? Math.abs(
                loadedTransactions.reduce((sum, t) => sum + t.amount, 0) / loadedTransactions.length
              )
            : 0,
      });
    } catch (error) {
      console.error('Errore caricamento wallet:', error);
      toast.error('Errore durante il caricamento del wallet');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredTransactions = transactions.filter((t) => {
    if (filterType === 'all') return true;
    if (filterType === 'credit') return t.amount > 0;
    if (filterType === 'debit') return t.amount < 0;
    return true;
  });

  const getTransactionIcon = (amount: number) => {
    return amount > 0 ? (
      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
        <ArrowUpRight className="w-5 h-5 text-green-600" />
      </div>
    ) : (
      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
        <ArrowDownRight className="w-5 h-5 text-red-600" />
      </div>
    );
  };

  const getTransactionTypeLabel = (type: string) => {
    const types: Record<string, { label: string; color: string }> = {
      admin_gift: { label: 'Regalo Admin', color: 'bg-purple-100 text-purple-700' },
      admin_deduction: { label: 'Prelievo Admin', color: 'bg-red-100 text-red-700' },
      recharge: { label: 'Ricarica', color: 'bg-green-100 text-green-700' },
      self_recharge: { label: 'Ricarica Self', color: 'bg-green-100 text-green-700' },
      recharge_request: { label: 'Richiesta Ricarica', color: 'bg-yellow-100 text-yellow-700' },
      shipment: { label: 'Spedizione', color: 'bg-blue-100 text-blue-700' },
      feature: { label: 'Feature', color: 'bg-orange-100 text-orange-700' },
      refund: { label: 'Rimborso', color: 'bg-teal-100 text-teal-700' },
      reseller_recharge: { label: 'Ricarica Reseller', color: 'bg-indigo-100 text-indigo-700' },
    };
    return types[type] || { label: type, color: 'bg-gray-100 text-gray-700' };
  };

  const handleExportTransactions = () => {
    try {
      // Prepara dati CSV
      const headers = ['Data', 'Tipo', 'Descrizione', 'Importo', 'Saldo Dopo'];
      const rows = filteredTransactions.map((tx) => {
        const typeInfo = getTransactionTypeLabel(tx.type);
        return [
          formatDateTime(tx.created_at),
          typeInfo.label,
          tx.description,
          formatCurrency(tx.amount),
          tx.balance_after !== undefined ? formatCurrency(tx.balance_after) : '-',
        ];
      });

      // Crea CSV
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `wallet-transazioni-${new Date().toISOString().split('T')[0]}.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Transazioni esportate con successo!');
    } catch (error) {
      console.error('Errore export:', error);
      toast.error("Errore durante l'export delle transazioni");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/20">
      <PageHeader
        title="Il Mio Wallet"
        subtitle="Gestisci il tuo credito e monitora le transazioni"
        actions={
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="gap-2 border-2 border-gray-300 hover:border-gray-400"
              onClick={handleExportTransactions}
            >
              <Download className="w-4 h-4" />
              Esporta
            </Button>
            <Button
              onClick={() => setRechargeDialogOpen(true)}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 gap-2"
            >
              <Plus className="w-4 h-4" />
              Ricarica Wallet
            </Button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Balance Card - Hero */}
        <Card className="bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 border-0 shadow-2xl overflow-hidden">
          <CardContent className="p-8 relative">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm font-medium">Saldo Disponibile</p>
                    <p className="text-white text-xs">Aggiornato in tempo reale</p>
                  </div>
                </div>
                <Badge variant="default" className="bg-white/20 text-white border-white/30">
                  <CreditCard className="w-3 h-3 mr-1" />
                  Wallet Attivo
                </Badge>
              </div>

              <div className="mb-6">
                <p className="text-6xl font-bold text-white mb-2">
                  {formatCurrency(walletBalance)}
                </p>
                <p className="text-white/70 text-sm">
                  Credito disponibile per spedizioni e servizi
                </p>
              </div>

              {stats && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <p className="text-white/70 text-xs mb-1">Totale Entrate</p>
                    <p className="text-white text-xl font-bold">
                      {formatCurrency(stats.totalCredits)}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <p className="text-white/70 text-xs mb-1">Totale Uscite</p>
                    <p className="text-white text-xl font-bold">
                      {formatCurrency(stats.totalDebits)}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <p className="text-white/70 text-xs mb-1">Transazioni</p>
                    <p className="text-white text-xl font-bold">{stats.transactionsCount}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 mb-1">Ultima Ricarica</p>
                    <p className="text-lg font-bold text-gray-900">
                      {stats.lastRecharge
                        ? new Date(stats.lastRecharge).toLocaleDateString('it-IT')
                        : 'Nessuna'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <TrendingDown className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 mb-1">Media Transazione</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(stats.averageTransaction)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 mb-1">Questo Mese</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(stats.totalCredits - stats.totalDebits)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Transactions List */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Storico Transazioni</h2>
                <p className="text-sm text-gray-500">Tutte le movimentazioni del tuo wallet</p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <Button
                  variant={filterType === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('all')}
                >
                  Tutte
                </Button>
                <Button
                  variant={filterType === 'credit' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('credit')}
                  className="gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Entrate
                </Button>
                <Button
                  variant={filterType === 'debit' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('debit')}
                  className="gap-1"
                >
                  <Minus className="w-3 h-3" />
                  Uscite
                </Button>
              </div>
            </div>

            {/* Transaction List */}
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">Nessuna transazione trovata</p>
                <p className="text-sm text-gray-400">Le tue transazioni appariranno qui</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map((transaction) => {
                  const typeInfo = getTransactionTypeLabel(transaction.type);
                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all"
                    >
                      {getTransactionIcon(transaction.amount)}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-gray-900 truncate">
                            {transaction.description}
                          </p>
                          <Badge variant="secondary" className={cn('text-xs', typeInfo.color)}>
                            {typeInfo.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {formatDateTime(transaction.created_at)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p
                          className={cn(
                            'text-lg font-bold',
                            transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                          )}
                        >
                          {transaction.amount > 0 ? '+' : ''}
                          {formatCurrency(transaction.amount)}
                        </p>
                        {transaction.balance_after !== undefined && (
                          <p className="text-xs text-gray-500">
                            Saldo: {formatCurrency(transaction.balance_after)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Come funziona il Wallet?</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Il tuo wallet è il credito prepagato per utilizzare tutti i servizi della
                  piattaforma. Ogni spedizione, feature o servizio scala automaticamente dal saldo
                  disponibile.
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✅ Ricariche illimitate senza commissioni</li>
                  <li>✅ Storico completo delle transazioni</li>
                  <li>✅ Nessun canone mensile o costo fisso</li>
                  <li>✅ Paghi solo per ciò che usi</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recharge Wallet Dialog */}
      <RechargeWalletDialog
        isOpen={rechargeDialogOpen}
        onClose={() => setRechargeDialogOpen(false)}
        onSuccess={() => {
          loadWalletData(); // Ricarica i dati dopo la ricarica
        }}
        currentBalance={walletBalance}
      />
    </div>
  );
}
