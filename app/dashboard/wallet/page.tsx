'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
  Download,
  AlertCircle,
  Search,
  ChevronDown,
  ShoppingBag,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RechargeWalletDialog } from '@/components/wallet/recharge-wallet-dialog';
import { TopUpRequestsList } from '@/components/wallet/top-up-requests-list';
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
  thisMonthNet: number;
  spentToday: number;
}

const TRANSACTIONS_PER_PAGE = 20;

export default function WalletPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(TRANSACTIONS_PER_PAGE);
  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false);
  const [heroExpanded, setHeroExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
          let runningBalance = currentBalance;
          loadedTransactions = transactionsData.transactions.map((tx: WalletTransaction) => {
            runningBalance -= tx.amount;
            return {
              ...tx,
              balance_after: runningBalance + tx.amount,
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

      // Calcola net del mese corrente
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthNet = loadedTransactions
        .filter((t) => new Date(t.created_at) >= startOfMonth)
        .reduce((sum, t) => sum + t.amount, 0);

      // Calcola speso oggi
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const spentToday = Math.abs(
        loadedTransactions
          .filter((t) => t.amount < 0 && new Date(t.created_at) >= startOfDay)
          .reduce((sum, t) => sum + t.amount, 0)
      );

      setStats({
        currentBalance,
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
        thisMonthNet,
        spentToday,
      });
    } catch (error) {
      console.error('Errore caricamento wallet:', error);
      toast.error('Errore durante il caricamento del wallet');
    } finally {
      setIsLoading(false);
    }
  }

  // Filtra transazioni per tipo e ricerca
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Filtro tipo
      if (filterType === 'credit' && t.amount <= 0) return false;
      if (filterType === 'debit' && t.amount >= 0) return false;
      // Filtro ricerca
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const typeLabel = getTransactionTypeLabel(t.type).label.toLowerCase();
        return (
          t.description.toLowerCase().includes(query) ||
          typeLabel.includes(query) ||
          formatCurrency(t.amount).includes(query)
        );
      }
      return true;
    });
  }, [transactions, filterType, searchQuery]);

  // Dati per il grafico andamento saldo (ultimi 30 giorni)
  const chartData = useMemo(() => {
    if (transactions.length === 0) return [];

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Crea mappa giornaliera: per ogni giorno calcola il saldo a fine giornata
    const dailyMap = new Map<string, number>();

    // Ordina transazioni per data crescente
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Calcola saldo iniziale (prima delle transazioni caricate)
    const totalChange = sorted.reduce((sum, t) => sum + t.amount, 0);
    let runningBalance = walletBalance - totalChange;

    for (const tx of sorted) {
      runningBalance += tx.amount;
      const dateKey = new Date(tx.created_at).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
      });
      dailyMap.set(dateKey, runningBalance);
    }

    // Genera punti per gli ultimi 30 giorni
    const points: { data: string; saldo: number }[] = [];
    let lastKnownBalance = walletBalance - totalChange; // saldo pre-transazioni

    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });

      if (dailyMap.has(dateKey)) {
        lastKnownBalance = dailyMap.get(dateKey)!;
      }

      points.push({ data: dateKey, saldo: Math.max(0, lastKnownBalance) });
    }

    return points;
  }, [transactions, walletBalance]);

  const getTransactionIcon = (amount: number) => {
    return amount > 0 ? (
      <div className="w-8 h-8 rounded-full bg-green-900/30 flex items-center justify-center shrink-0">
        <ArrowUpRight className="w-4 h-4 text-green-400" />
      </div>
    ) : (
      <div className="w-8 h-8 rounded-full bg-red-900/30 flex items-center justify-center shrink-0">
        <ArrowDownRight className="w-4 h-4 text-red-400" />
      </div>
    );
  };

  const handleExportTransactions = () => {
    try {
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

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n');

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadWalletData();
    setIsRefreshing(false);
    toast.success('Wallet aggiornato');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
          {/* Hero skeleton */}
          <div className="rounded-xl bg-gradient-to-br from-green-600/50 via-emerald-600/50 to-teal-600/50 p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20"></div>
              <div>
                <div className="h-3 w-24 bg-white/20 rounded mb-2"></div>
                <div className="h-8 w-40 bg-white/20 rounded"></div>
              </div>
            </div>
          </div>
          {/* Chart skeleton */}
          <div className="rounded-xl bg-[#0f0f11] border border-[#FACC15]/10 p-4 animate-pulse">
            <div className="h-3 w-32 bg-gray-700 rounded mb-3"></div>
            <div className="h-44 bg-gray-800/50 rounded"></div>
          </div>
          {/* Stats skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl bg-[#0f0f11] border border-[#FACC15]/10 p-4 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-700"></div>
                  <div className="flex-1">
                    <div className="h-3 w-20 bg-gray-700 rounded mb-2"></div>
                    <div className="h-5 w-24 bg-gray-700 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Transactions skeleton */}
          <div className="rounded-xl bg-[#0f0f11] border border-[#FACC15]/10 p-4 animate-pulse">
            <div className="h-5 w-40 bg-gray-700 rounded mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-800"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-700"></div>
                  <div className="flex-1">
                    <div className="h-4 w-48 bg-gray-700 rounded mb-2"></div>
                    <div className="h-3 w-32 bg-gray-800 rounded"></div>
                  </div>
                  <div className="h-5 w-16 bg-gray-700 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const visibleTransactions = filteredTransactions.slice(0, visibleCount);
  const hasMore = visibleCount < filteredTransactions.length;

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
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              {isRefreshing ? 'Aggiorno...' : 'Aggiorna'}
            </Button>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Balance Card - Hero (collapsible) */}
        <div
          className="cursor-pointer select-none"
          onClick={() => setHeroExpanded((prev) => !prev)}
        >
          <Card
            className="bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 border-0 shadow-2xl overflow-hidden"
            hover={false}
          >
            <CardContent className="p-4 relative">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white/80 text-xs">Saldo Disponibile</p>
                      <p className="text-3xl font-bold text-white">
                        {formatCurrency(walletBalance)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-white/20 text-white border-white/30">
                      <CreditCard className="w-3 h-3 mr-1" />
                      Wallet Attivo
                    </Badge>
                    <ChevronDown
                      className={cn(
                        'w-5 h-5 text-white/70 transition-transform duration-200',
                        heroExpanded && 'rotate-180'
                      )}
                    />
                  </div>
                </div>

                <div
                  className={cn(
                    'grid transition-all duration-200 ease-in-out',
                    heroExpanded
                      ? 'grid-rows-[1fr] opacity-100 mt-4'
                      : 'grid-rows-[0fr] opacity-0 mt-0'
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="text-white/90 text-sm mb-3">
                      Credito disponibile per spedizioni e servizi
                    </p>
                    {stats && (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                          <p className="text-white text-xs font-medium mb-0.5">Totale Entrate</p>
                          <p className="text-white text-lg font-bold">
                            {formatCurrency(stats.totalCredits)}
                          </p>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                          <p className="text-white text-xs font-medium mb-0.5">Totale Uscite</p>
                          <p className="text-white text-lg font-bold">
                            {formatCurrency(stats.totalDebits)}
                          </p>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                          <p className="text-white text-xs font-medium mb-0.5">Transazioni</p>
                          <p className="text-white text-lg font-bold">{stats.transactionsCount}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Low Balance Alert */}
        {walletBalance > 0 && walletBalance < 10 && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-950/50 border border-amber-700/50">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-sm text-amber-200">
              Saldo in esaurimento! Ricarica il wallet per continuare a spedire senza interruzioni.
            </p>
            <Button
              size="sm"
              onClick={() => setRechargeDialogOpen(true)}
              className="ml-auto shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
            >
              Ricarica
            </Button>
          </div>
        )}

        {/* Grafico Andamento Saldo */}
        {chartData.length > 1 && (
          <Card variant="dark">
            <CardContent className="p-4">
              <h2 className="text-sm font-bold text-gray-100 mb-3">Andamento Saldo</h2>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="data"
                      stroke="#9ca3af"
                      fontSize={12}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="#9ca3af"
                      fontSize={12}
                      tickLine={false}
                      tickFormatter={(v) => `${v} \u20AC`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#f3f4f6',
                      }}
                      formatter={(value) => [formatCurrency(Number(value)), 'Saldo']}
                      labelStyle={{ color: '#9ca3af' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="saldo"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#saldoGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card variant="dark">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-900/30 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-0.5">Ultima Ricarica</p>
                    <p className="text-base font-bold text-gray-100">
                      {stats.lastRecharge
                        ? new Date(stats.lastRecharge).toLocaleDateString('it-IT')
                        : 'Nessuna'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {stats.transactionsCount >= 2 && (
              <Card variant="dark">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-900/30 flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-0.5">Media Transazione</p>
                      <p className="text-base font-bold text-gray-100">
                        {formatCurrency(stats.averageTransaction)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card variant="dark">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-900/30 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-0.5">Questo Mese</p>
                    <p
                      className={cn(
                        'text-base font-bold',
                        stats.thisMonthNet >= 0 ? 'text-green-400' : 'text-red-400'
                      )}
                    >
                      {stats.thisMonthNet >= 0 ? '+' : ''}
                      {formatCurrency(stats.thisMonthNet)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="dark">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-900/30 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-0.5">Speso Oggi</p>
                    <p className="text-base font-bold text-gray-100">
                      {stats.spentToday > 0
                        ? `-${formatCurrency(stats.spentToday)}`
                        : formatCurrency(0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Le mie richieste di ricarica (bonifico) */}
        <TopUpRequestsList />

        {/* Transactions List */}
        <Card variant="dark">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-100 mb-0.5">Storico Transazioni</h2>
                <p className="text-sm text-gray-400">Tutte le movimentazioni del tuo wallet</p>
              </div>

              <div className="flex items-center gap-2">
                {/* Ricerca */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    placeholder="Cerca..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setVisibleCount(TRANSACTIONS_PER_PAGE);
                    }}
                    className="pl-9 w-44 h-9 bg-transparent border-gray-700 text-gray-100 placeholder:text-gray-500 text-sm"
                  />
                </div>

                {/* Filtri */}
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
                <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
                  {searchQuery ? (
                    <Search className="w-7 h-7 text-gray-500" />
                  ) : (
                    <Wallet className="w-7 h-7 text-gray-500" />
                  )}
                </div>
                <p className="text-gray-300 font-medium mb-1">
                  {searchQuery ? 'Nessun risultato per la ricerca' : 'Nessuna transazione'}
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  {searchQuery
                    ? 'Prova con un termine diverso'
                    : 'Ricarica il wallet per iniziare a spedire'}
                </p>
                {!searchQuery && (
                  <Button
                    size="sm"
                    onClick={() => setRechargeDialogOpen(true)}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Ricarica Ora
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {visibleTransactions.map((transaction) => {
                    const typeInfo = getTransactionTypeLabel(transaction.type);
                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 hover:border-gray-600 hover:bg-white/5 transition-all"
                      >
                        {getTransactionIcon(transaction.amount)}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-gray-100 truncate">
                              {transaction.description}
                            </p>
                            <Badge variant="secondary" className={cn('text-xs', typeInfo.color)}>
                              {typeInfo.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {formatDateTime(transaction.created_at)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p
                            className={cn(
                              'text-base font-bold',
                              transaction.amount > 0 ? 'text-green-400' : 'text-red-400'
                            )}
                          >
                            {transaction.amount > 0 ? '+' : ''}
                            {formatCurrency(transaction.amount)}
                          </p>
                          {transaction.balance_after !== undefined && (
                            <p className="text-xs text-gray-400">
                              Saldo: {formatCurrency(transaction.balance_after)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Carica altre */}
                {hasMore && (
                  <div className="text-center mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setVisibleCount((prev) => prev + TRANSACTIONS_PER_PAGE)}
                      className="gap-2 border-gray-700 text-gray-300 hover:text-gray-100"
                    >
                      <ChevronDown className="w-4 h-4" />
                      Mostra altre ({filteredTransactions.length - visibleCount} rimanenti)
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="bg-blue-950/50 border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-900/50 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-100 mb-1">Come funziona il Wallet?</h3>
                <p className="text-sm text-gray-300 mb-2">
                  Il tuo wallet è il credito prepagato per utilizzare tutti i servizi della
                  piattaforma. Ogni spedizione, feature o servizio scala automaticamente dal saldo
                  disponibile.
                </p>
                <ul className="text-sm text-gray-300 space-y-1">
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
          loadWalletData();
        }}
        currentBalance={walletBalance}
      />
    </div>
  );
}

function getTransactionTypeLabel(type: string): { label: string; color: string } {
  const types: Record<string, { label: string; color: string }> = {
    deposit: { label: 'Deposito', color: 'bg-green-900/40 text-green-300' },
    shipment_charge: { label: 'Spedizione', color: 'bg-blue-900/40 text-blue-300' },
    adjustment: { label: 'Rettifica', color: 'bg-orange-900/40 text-orange-300' },
    admin_gift: { label: 'Regalo Admin', color: 'bg-purple-900/40 text-purple-300' },
    admin_deduction: { label: 'Prelievo Admin', color: 'bg-red-900/40 text-red-300' },
    recharge: { label: 'Ricarica', color: 'bg-green-900/40 text-green-300' },
    self_recharge: { label: 'Ricarica Self', color: 'bg-green-900/40 text-green-300' },
    recharge_request: { label: 'Richiesta Ricarica', color: 'bg-yellow-900/40 text-yellow-300' },
    shipment: { label: 'Spedizione', color: 'bg-blue-900/40 text-blue-300' },
    feature: { label: 'Feature', color: 'bg-orange-900/40 text-orange-300' },
    refund: { label: 'Rimborso', color: 'bg-teal-900/40 text-teal-300' },
    reseller_recharge: { label: 'Ricarica Reseller', color: 'bg-indigo-900/40 text-indigo-300' },
    reseller_transfer_in: {
      label: 'Trasferimento Reseller',
      color: 'bg-indigo-900/40 text-indigo-300',
    },
    reseller_transfer_out: {
      label: 'Trasferimento a Cliente',
      color: 'bg-violet-900/40 text-violet-300',
    },
    postpaid_charge: { label: 'Spedizione Postpagato', color: 'bg-cyan-900/40 text-cyan-300' },
  };
  return types[type.toLowerCase()] || { label: type, color: 'bg-gray-700 text-gray-300' };
}
