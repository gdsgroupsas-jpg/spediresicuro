'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  Search, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  Clock,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Trash2,
  User,
  Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getTopUpRequestsAdmin, getTopUpRequestAdmin, TopUpRequestAdmin } from '@/app/actions/topups-admin';
import { approveTopUpRequest, rejectTopUpRequest, deleteTopUpRequest } from '@/app/actions/wallet';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

type StatusFilter = 'pending' | 'manual_review' | 'approved' | 'rejected';

export default function AdminBonificiPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [requests, setRequests] = useState<TopUpRequestAdmin[]>([]);
  const [allRequests, setAllRequests] = useState<TopUpRequestAdmin[]>([]); // Per conteggi tab
  const [activeTab, setActiveTab] = useState<StatusFilter>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<TopUpRequestAdmin | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [approvedAmount, setApprovedAmount] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Verifica permessi admin
  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated' || !session) {
      router.push('/login');
      return;
    }

    async function checkPermissions() {
      try {
        const response = await fetch('/api/user/info');
        if (response.ok) {
          const data = await response.json();
          const userData = data.user || data;
          const userAccountType = userData.account_type || userData.accountType;
          const userRole = userData.role;
          
          const isAdmin = userAccountType === 'superadmin' || 
                         userAccountType === 'admin' || 
                         userRole === 'admin';
          
          if (isAdmin) {
            setIsAuthorized(true);
            loadRequests('pending');
          } else {
            router.push('/dashboard?error=unauthorized');
          }
        }
      } catch (error) {
        console.error('Errore verifica permessi:', error);
        router.push('/dashboard?error=unauthorized');
      }
    }

    checkPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, router]);

  // Carica richieste quando cambia tab
  useEffect(() => {
    if (isAuthorized) {
      loadRequests(activeTab);
      // Carica anche tutti i conteggi per i tab
      loadAllRequestsForCounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAuthorized]);

  async function loadAllRequestsForCounts() {
    try {
      // Carica tutte le richieste senza filtro per avere i conteggi
      const result = await getTopUpRequestsAdmin({
        limit: 1000, // Carica molte per avere conteggi accurati
      });
      if (result.success && result.data) {
        setAllRequests(result.data);
      }
    } catch (error) {
      console.error('Errore caricamento conteggi:', error);
    }
  }

  async function loadRequests(statusFilter?: StatusFilter) {
    try {
      setIsLoading(true);
      const result = await getTopUpRequestsAdmin({
        status: statusFilter,
        search: searchQuery || undefined,
        limit: 100,
      });

      if (result.success && result.data) {
        setRequests(result.data);
      } else {
        toast.error(result.error || 'Errore nel caricamento delle richieste');
        setRequests([]);
      }
    } catch (error: any) {
      console.error('Errore caricamento richieste:', error);
      toast.error('Errore imprevisto durante il caricamento');
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleViewDetails(id: string) {
    try {
      const result = await getTopUpRequestAdmin(id);
      if (result.success && result.data) {
        setSelectedRequest(result.data);
        // Reset sempre a vuoto quando apri una nuova richiesta
        setApprovedAmount('');
        setRejectReason('');
        setShowDetailsModal(true);
      } else {
        toast.error(result.error || 'Errore nel caricamento dei dettagli');
      }
    } catch (error: any) {
      console.error('Errore caricamento dettagli:', error);
      toast.error('Errore imprevisto');
    }
  }

  // Reset campo quando il modal si apre/chiude
  useEffect(() => {
    if (!showDetailsModal) {
      // Quando il modal si chiude, resetta tutto
      setApprovedAmount('');
      setRejectReason('');
      setSelectedRequest(null);
    } else if (showDetailsModal && selectedRequest) {
      // Quando il modal si apre, assicurati che il campo sia vuoto
      setApprovedAmount('');
    }
  }, [showDetailsModal, selectedRequest?.id]);

  async function handleApprove() {
    if (!selectedRequest) {
      toast.error('Nessuna richiesta selezionata');
      return;
    }

    // Parsing robusto: gestisce stringa vuota, virgole, punti
    // Fix: Se il campo è vuoto, usa l'importo originale della richiesta.
    // Se c'è un valore, usa quello.
    const raw = approvedAmount.trim();
    let amountToApprove: number;

    if (raw === '') {
        // Usa importo originale
        amountToApprove = selectedRequest.amount;
        console.log('Campo vuoto → uso importo originale:', amountToApprove);
    } else {
        // Sostituisci virgola con punto per parsing (formato italiano)
        const normalized = raw.replace(',', '.');
        const parsedAmount = Number(normalized);

        // Validazione robusta
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 10000) {
            toast.error('Importo non valido. Deve essere tra €0.01 e €10.000');
            return;
        }
        amountToApprove = parsedAmount;
        console.log('Importo specificato:', parsedAmount);
    }

    try {
      setIsProcessing(true);
      console.log('✅ Approving request:', selectedRequest.id, 'with amount:', amountToApprove);
      
      const result = await approveTopUpRequest(
        selectedRequest.id,
        amountToApprove
      );

      console.log('✅ Approve result:', result);

      if (result.success) {
        toast.success(result.message || 'Richiesta approvata con successo');
        setShowDetailsModal(false);
        setSelectedRequest(null);
        setApprovedAmount('');
        setRejectReason('');
        loadRequests(activeTab);
        loadAllRequestsForCounts();
      } else {
        toast.error(result.error || 'Errore durante l\'approvazione');
      }
    } catch (error: any) {
      console.error('❌ Errore approvazione:', error);
      toast.error('Errore imprevisto durante l\'approvazione: ' + (error.message || 'Errore sconosciuto'));
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleReject() {
    if (!selectedRequest) return;

    if (!rejectReason.trim()) {
      toast.error('Inserisci un motivo per il rifiuto');
      return;
    }

    try {
      setIsProcessing(true);
      const result = await rejectTopUpRequest(selectedRequest.id, rejectReason);

      if (result.success) {
        toast.success(result.message || 'Richiesta rifiutata con successo');
        setShowDetailsModal(false);
        setSelectedRequest(null);
        loadRequests(activeTab);
        loadAllRequestsForCounts();
      } else {
        toast.error(result.error || 'Errore durante il rifiuto');
      }
    } catch (error: any) {
      console.error('Errore rifiuto:', error);
      toast.error('Errore imprevisto durante il rifiuto');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleDelete() {
    if (!selectedRequest) return;

    // Conferma cancellazione
    if (!confirm(`Sei sicuro di voler eliminare questa richiesta?\n\nQuesta azione è irreversibile e la richiesta verrà eliminata definitivamente.`)) {
      return;
    }

    try {
      setIsProcessing(true);
      const result = await deleteTopUpRequest(selectedRequest.id);

      if (result.success) {
        toast.success(result.message || 'Richiesta eliminata con successo');
        setShowDetailsModal(false);
        setSelectedRequest(null);
        loadRequests(activeTab);
        loadAllRequestsForCounts();
      } else {
        toast.error(result.error || 'Errore durante la cancellazione');
      }
    } catch (error: any) {
      console.error('Errore cancellazione:', error);
      toast.error('Errore imprevisto durante la cancellazione');
    } finally {
      setIsProcessing(false);
    }
  }

  function getStatusBadge(status: string) {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700',
      manual_review: 'bg-orange-100 text-orange-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    const labels = {
      pending: 'In Attesa',
      manual_review: 'Revisione Manuale',
      approved: 'Approvata',
      rejected: 'Rifiutata',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.pending}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('it-IT', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(amount);
  }

  function formatDate(dateString: string) {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: it });
    } catch {
      return dateString;
    }
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Verifica permessi in corso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-8 h-8 text-blue-600" />
            Gestione Bonifici
          </h1>
          <p className="text-gray-500 mt-1">
            Approvazione e rifiuto richieste di ricarica wallet
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mt-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusFilter)}>
            <div className="border-b border-gray-200 px-6">
              <TabsList className="bg-transparent">
                <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-50">
                  <Clock className="w-4 h-4 mr-2" />
                  In Attesa ({allRequests.filter(r => r.status === 'pending').length})
                </TabsTrigger>
                <TabsTrigger value="manual_review" className="data-[state=active]:bg-orange-50">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Revisione ({allRequests.filter(r => r.status === 'manual_review').length})
                </TabsTrigger>
                <TabsTrigger value="approved" className="data-[state=active]:bg-green-50">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approvate ({allRequests.filter(r => r.status === 'approved').length})
                </TabsTrigger>
                <TabsTrigger value="rejected" className="data-[state=active]:bg-red-50">
                  <XCircle className="w-4 h-4 mr-2" />
                  Rifiutate ({allRequests.filter(r => r.status === 'rejected').length})
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-6">
              {/* Search Bar */}
              <div className="mb-6 flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Cerca per email o nome utente..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        loadRequests(activeTab);
                      }
                    }}
                    className="pl-10"
                  />
                </div>
                <Button
                  onClick={() => loadRequests(activeTab)}
                  variant="outline"
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Aggiorna
                </Button>
              </div>

              {/* Table */}
              {isLoading ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">Caricamento in corso...</p>
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">Nessuna richiesta trovata</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Utente</th>
                        <th className="px-6 py-4">Importo</th>
                        <th className="px-6 py-4">Stato</th>
                        <th className="px-6 py-4">AI Conf</th>
                        <th className="px-6 py-4 text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {requests.map((request) => (
                        <tr key={request.id} className="hover:bg-gray-50 group transition-colors">
                          <td className="px-6 py-4 text-gray-900">
                            {formatDate(request.created_at)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">
                                {request.user_name || 'N/A'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {request.user_email || request.user_id}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-gray-900">
                              {formatCurrency(request.amount)}
                            </div>
                            {request.approved_amount && request.approved_amount !== request.amount && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                Approvato: {formatCurrency(request.approved_amount)}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(request.status)}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {request.ai_confidence !== null 
                              ? `${Math.round(request.ai_confidence * 100)}%`
                              : '-'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                onClick={() => handleViewDetails(request.id)}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                <Eye className="w-3 h-3 mr-1.5" />
                                Dettagli
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Tabs>
        </div>

        {/* Details Modal */}
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Dettagli Richiesta Ricarica
              </DialogTitle>
              <DialogDescription>
                {selectedRequest && (
                  <>
                    Richiesta #{selectedRequest.id.slice(0, 8)}... · {formatDate(selectedRequest.created_at)}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-6">
                {/* Card: Info Principali */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <Label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">
                        Utente
                      </Label>
                      <p className="font-semibold text-gray-900">
                        {selectedRequest.user_name || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {selectedRequest.user_email || selectedRequest.user_id}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">
                        Stato
                      </Label>
                      <div className="mt-1">
                        {getStatusBadge(selectedRequest.status)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card: Importo */}
                <div className="bg-blue-50 rounded-lg p-5 border border-blue-200">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
                    Importo Richiesto
                  </Label>
                  <p className="text-3xl font-bold text-blue-900">
                    {formatCurrency(selectedRequest.amount)}
                  </p>
                </div>

                {/* Card: Dettagli Tecnici */}
                <div className="grid grid-cols-2 gap-4">
                  {/* AI Confidence */}
                  {selectedRequest.ai_confidence !== null && (
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
                        Confidenza AI
                      </Label>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${
                              selectedRequest.ai_confidence > 0.8
                                ? 'bg-green-500'
                                : selectedRequest.ai_confidence > 0.5
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${selectedRequest.ai_confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-900 min-w-[3rem] text-right">
                          {Math.round(selectedRequest.ai_confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Ricevuta */}
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
                      Ricevuta Bonifico
                    </Label>
                    <a
                      href={selectedRequest.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Apri ricevuta
                    </a>
                  </div>
                </div>

                {/* Approvazione (solo se pending o manual_review) */}
                {(selectedRequest.status === 'pending' || selectedRequest.status === 'manual_review') && (
                  <div className="bg-white rounded-lg p-5 border border-gray-200 space-y-5">
                    <div>
                      <Label htmlFor="approvedAmount" className="text-sm font-medium text-gray-900 mb-2 block">
                        Importo da Accreditare (€)
                      </Label>
                      <Input
                        id="approvedAmount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="10000"
                        value={approvedAmount}
                        onChange={(e) => {
                          // Aggiorna sempre lo state con il valore dell'input
                          setApprovedAmount(e.target.value);
                        }}
                        placeholder={selectedRequest.amount.toString()}
                        className="text-lg font-semibold"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Lasciare vuoto per accreditare l&apos;importo richiesto ({formatCurrency(selectedRequest.amount)})
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="rejectReason" className="text-sm font-medium text-gray-900 mb-2 block">
                        Note / Motivo Rifiuto
                      </Label>
                      <Textarea
                        id="rejectReason"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Inserisci note o motivo del rifiuto..."
                        rows={3}
                        className="resize-none"
                      />
                    </div>

                    <div className="flex gap-3 pt-2 border-t border-gray-200">
                      <Button
                        onClick={handleApprove}
                        disabled={isProcessing}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium h-11"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approva
                      </Button>
                      <Button
                        onClick={handleReject}
                        disabled={isProcessing || !rejectReason.trim()}
                        variant="destructive"
                        className="flex-1 font-medium h-11"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Rifiuta
                      </Button>
                      <Button
                        onClick={handleDelete}
                        disabled={isProcessing}
                        variant="outline"
                        className="font-medium h-11 border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Elimina
                      </Button>
                    </div>
                  </div>
                )}

                {/* Info Approvazione (se già approvata/rifiutata) */}
                {selectedRequest.status === 'approved' && selectedRequest.approved_at && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <p className="text-sm font-semibold text-green-900">
                        Richiesta Approvata
                      </p>
                    </div>
                    <div className="space-y-1 text-sm text-green-800">
                      <p>
                        <strong>Data approvazione:</strong> {formatDate(selectedRequest.approved_at)}
                      </p>
                      {selectedRequest.approved_amount && (
                        <p>
                          <strong>Importo accreditato:</strong> {formatCurrency(selectedRequest.approved_amount)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedRequest.status === 'rejected' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <p className="text-sm font-semibold text-red-900">
                        Richiesta Rifiutata
                      </p>
                    </div>
                    {selectedRequest.approved_at && (
                      <p className="text-sm text-red-800">
                        <strong>Data rifiuto:</strong> {formatDate(selectedRequest.approved_at)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
