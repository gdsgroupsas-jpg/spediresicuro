'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Archive,
  Search,
  Clock,
  AlertTriangle,
  Truck,
  MapPin,
  Trash2,
  Package,
  RotateCcw,
  ChevronRight,
  Loader2,
  AlertCircle,
  X,
  Wallet,
} from 'lucide-react';
import type { ShipmentHold, HoldActionOption, HoldActionType, HoldStatus } from '@/types/giacenze';
import { HOLD_REASON_LABELS, HOLD_ACTION_LABELS, HOLD_STATUS_LABELS } from '@/types/giacenze';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

// =====================================================
// Helpers
// =====================================================

function getDaysRemaining(deadlineAt: string | null): number | null {
  if (!deadlineAt) return null;
  const now = new Date();
  const deadline = new Date(deadlineAt);
  const diff = deadline.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getCountdownColor(days: number | null): string {
  if (days === null) return 'text-gray-400';
  if (days <= 2) return 'text-red-600';
  if (days <= 5) return 'text-amber-600';
  return 'text-green-600';
}

function getCountdownBgColor(days: number | null): string {
  if (days === null) return 'bg-gray-50 border-gray-200';
  if (days <= 2) return 'bg-red-50 border-red-200';
  if (days <= 5) return 'bg-amber-50 border-amber-200';
  return 'bg-green-50 border-green-200';
}

function getReasonBadge(reason: string | null) {
  const config: Record<string, { bg: string; text: string }> = {
    destinatario_assente: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
    indirizzo_errato: { bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
    rifiutata: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' },
    documenti_mancanti: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
    contrassegno_non_pagato: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
    zona_non_accessibile: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
    altro: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-700' },
  };
  const c = config[reason || 'altro'] || config.altro;
  return c;
}

function getStatusBadge(status: HoldStatus) {
  const config: Record<HoldStatus, { bg: string; text: string }> = {
    open: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
    action_requested: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
    action_confirmed: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
    resolved: { bg: 'bg-green-50 border-green-200', text: 'text-green-700' },
    expired: { bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
  };
  return config[status] || config.open;
}

function getActionIcon(action: HoldActionType) {
  switch (action) {
    case 'riconsegna':
      return <Truck className="w-4 h-4" />;
    case 'riconsegna_nuovo_destinatario':
      return <MapPin className="w-4 h-4" />;
    case 'reso_mittente':
      return <RotateCcw className="w-4 h-4" />;
    case 'distruggere':
      return <Trash2 className="w-4 h-4" />;
    case 'ritiro_in_sede':
      return <Package className="w-4 h-4" />;
    default:
      return <Package className="w-4 h-4" />;
  }
}

// =====================================================
// Page
// =====================================================

export default function GiacenzePage() {
  // Data
  const [holds, setHolds] = useState<ShipmentHold[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('open');

  // Action dialog
  const [selectedHold, setSelectedHold] = useState<ShipmentHold | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [availableActions, setAvailableActions] = useState<HoldActionOption[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);

  // Confirmation
  const [selectedAction, setSelectedAction] = useState<HoldActionOption | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // New address form (for riconsegna_nuovo_destinatario)
  const [newAddress, setNewAddress] = useState({
    name: '',
    address: '',
    city: '',
    zip: '',
    province: '',
    phone: '',
  });

  // =====================================================
  // Fetch holds
  // =====================================================

  useEffect(() => {
    fetchHolds();
  }, [statusFilter]);

  async function fetchHolds() {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/giacenze?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Errore caricamento giacenze');
      }
      const result = await response.json();
      setHolds(result.holds || []);
    } catch (err: any) {
      setError(err.message || 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  }

  // =====================================================
  // Filtered holds
  // =====================================================

  const filteredHolds = useMemo(() => {
    if (!searchQuery) return holds;
    const q = searchQuery.toLowerCase();
    return holds.filter(
      (h) =>
        h.shipment?.tracking_number?.toLowerCase().includes(q) ||
        h.shipment?.recipient_name?.toLowerCase().includes(q) ||
        h.shipment?.recipient_city?.toLowerCase().includes(q)
    );
  }, [holds, searchQuery]);

  // =====================================================
  // Open action dialog
  // =====================================================

  async function handleManageClick(hold: ShipmentHold) {
    setSelectedHold(hold);
    setShowActionDialog(true);
    setLoadingActions(true);
    setAvailableActions([]);
    setSelectedAction(null);

    try {
      const response = await fetch(`/api/giacenze/${hold.id}/actions`);
      if (!response.ok) throw new Error('Errore caricamento azioni');
      const result = await response.json();
      setAvailableActions(result.actions || []);
    } catch {
      setAvailableActions([]);
    } finally {
      setLoadingActions(false);
    }
  }

  // =====================================================
  // Select action → show confirm
  // =====================================================

  function handleSelectAction(action: HoldActionOption) {
    setSelectedAction(action);
    if (action.requires_new_address) {
      // Keep action dialog open for address form, then confirm
      return;
    }
    setShowConfirmDialog(true);
  }

  function handleConfirmNewAddress() {
    if (!newAddress.name || !newAddress.address || !newAddress.city || !newAddress.zip) {
      alert('Compila tutti i campi obbligatori del nuovo indirizzo');
      return;
    }
    setShowConfirmDialog(true);
  }

  // =====================================================
  // Execute action
  // =====================================================

  async function handleExecuteAction() {
    if (!selectedHold || !selectedAction) return;

    setIsExecuting(true);
    try {
      const body: any = { action_type: selectedAction.action };
      if (selectedAction.requires_new_address) {
        body.new_address = newAddress;
      }

      const response = await fetch(`/api/giacenze/${selectedHold.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.code === 'INSUFFICIENT_BALANCE') {
          alert(result.error);
          return;
        }
        throw new Error(result.error || 'Errore esecuzione azione');
      }

      // Success: close dialogs and refresh
      setShowConfirmDialog(false);
      setShowActionDialog(false);
      setSelectedHold(null);
      setSelectedAction(null);
      setNewAddress({ name: '', address: '', city: '', zip: '', province: '', phone: '' });
      fetchHolds();
    } catch (err: any) {
      alert(err.message || 'Errore esecuzione azione');
    } finally {
      setIsExecuting(false);
    }
  }

  // =====================================================
  // Render
  // =====================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl">
              <Archive className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Giacenze</h1>
              <p className="text-sm text-gray-500">Spedizioni in giacenza presso i corrieri</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200/60 shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cerca per tracking, destinatario, città..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent text-sm"
              />
            </div>
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent text-sm"
            >
              <option value="open">Aperte</option>
              <option value="action_requested">In corso</option>
              <option value="action_confirmed">Confermate</option>
              <option value="resolved">Risolte</option>
              <option value="expired">Scadute</option>
              <option value="all">Tutte</option>
            </select>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#FF9500] animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-gray-600">{error}</p>
            <button
              onClick={fetchHolds}
              className="mt-4 px-4 py-2 bg-[#FF9500] text-white rounded-lg hover:bg-[#E88500] transition-colors text-sm"
            >
              Riprova
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && filteredHolds.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="p-4 bg-green-50 rounded-full mb-4">
              <Archive className="w-12 h-12 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">Nessuna giacenza</h3>
            <p className="text-sm text-gray-500">
              {statusFilter === 'open'
                ? 'Non ci sono spedizioni in giacenza al momento'
                : 'Nessun risultato per i filtri selezionati'}
            </p>
          </div>
        )}

        {/* Holds list */}
        {!isLoading && !error && filteredHolds.length > 0 && (
          <div className="space-y-4">
            {filteredHolds.map((hold) => {
              const days = getDaysRemaining(hold.deadline_at);
              const countdownColor = getCountdownColor(days);
              const countdownBg = getCountdownBgColor(days);
              const reasonBadge = getReasonBadge(hold.reason);
              const statusBadge = getStatusBadge(hold.status);

              return (
                <div
                  key={hold.id}
                  className="bg-white rounded-xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Left: shipment info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-sm font-semibold text-gray-900">
                            {hold.shipment?.tracking_number || '—'}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge.bg} ${statusBadge.text}`}
                          >
                            {HOLD_STATUS_LABELS[hold.status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" />
                            {hold.shipment?.recipient_name || '—'}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {hold.shipment?.recipient_city || '—'}
                          </span>
                          {hold.shipment?.courier_id && (
                            <span className="text-xs font-medium uppercase text-gray-400">
                              {hold.shipment.courier_id}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Center: reason */}
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${reasonBadge.bg} ${reasonBadge.text}`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {HOLD_REASON_LABELS[hold.reason || 'altro']}
                        </span>
                      </div>

                      {/* Right: countdown + action */}
                      <div className="flex items-center gap-4">
                        {/* Countdown */}
                        {hold.status === 'open' && (
                          <div
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${countdownBg}`}
                          >
                            <Clock className={`w-4 h-4 ${countdownColor}`} />
                            <span className={`text-sm font-semibold ${countdownColor}`}>
                              {days !== null ? (days > 0 ? `${days}g rimasti` : 'Scaduta') : '—'}
                            </span>
                          </div>
                        )}

                        {/* Action cost if confirmed */}
                        {hold.action_cost !== null && hold.action_cost > 0 && (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Wallet className="w-3.5 h-3.5" />€{hold.action_cost.toFixed(2)}
                          </div>
                        )}

                        {/* Manage button */}
                        {hold.status === 'open' && (
                          <button
                            onClick={() => handleManageClick(hold)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-medium rounded-lg shadow-sm hover:shadow-md transition-all text-sm"
                          >
                            Gestisci
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}

                        {/* Show action taken */}
                        {hold.action_type && hold.status !== 'open' && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            {getActionIcon(hold.action_type)}
                            <span>{HOLD_ACTION_LABELS[hold.action_type]?.label}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Detected date */}
                    <div className="mt-3 text-xs text-gray-400">
                      Rilevata il{' '}
                      {new Date(hold.detected_at).toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {hold.reason_detail && (
                        <span className="ml-2 italic">— {hold.reason_detail}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =====================================================
          Action Selection Dialog
          ===================================================== */}
      {showActionDialog && selectedHold && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Gestisci Giacenza</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selectedHold.shipment?.tracking_number} — {selectedHold.shipment?.recipient_name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowActionDialog(false);
                  setSelectedHold(null);
                  setSelectedAction(null);
                }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Shipment summary */}
            <div className="px-5 pt-4 pb-2">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Destinatario</span>
                  <span className="font-medium">
                    {selectedHold.shipment?.recipient_name}, {selectedHold.shipment?.recipient_city}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Motivo</span>
                  <span className={`font-medium ${getReasonBadge(selectedHold.reason).text}`}>
                    {HOLD_REASON_LABELS[selectedHold.reason || 'altro']}
                  </span>
                </div>
                {selectedHold.deadline_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Scadenza</span>
                    <span
                      className={`font-medium ${getCountdownColor(getDaysRemaining(selectedHold.deadline_at))}`}
                    >
                      {new Date(selectedHold.deadline_at).toLocaleDateString('it-IT')} (
                      {getDaysRemaining(selectedHold.deadline_at)}g rimasti)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions list */}
            <div className="p-5">
              {loadingActions && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-[#FF9500] animate-spin" />
                </div>
              )}

              {!loadingActions && availableActions.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  Nessuna azione disponibile per questa giacenza
                </p>
              )}

              {!loadingActions && availableActions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Scegli come vuoi gestire questa giacenza:
                  </p>
                  {availableActions.map((action) => (
                    <button
                      key={action.action}
                      onClick={() => handleSelectAction(action)}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all hover:border-[#FF9500] hover:bg-orange-50/50 ${
                        selectedAction?.action === action.action
                          ? 'border-[#FF9500] bg-orange-50/50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            {getActionIcon(action.action)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{action.label}</p>
                            <p className="text-xs text-gray-500">{action.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {action.total_cost > 0 ? (
                            <span className="text-sm font-bold text-gray-900">
                              €{action.total_cost.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-sm font-medium text-green-600">Gratuito</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* New address form (shown when riconsegna_nuovo_destinatario selected) */}
              {selectedAction?.requires_new_address && (
                <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <h4 className="text-sm font-semibold text-blue-900 mb-3">
                    Nuovo indirizzo di consegna
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Nome destinatario *"
                        value={newAddress.name}
                        onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF9500] focus:border-transparent"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Indirizzo *"
                        value={newAddress.address}
                        onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF9500] focus:border-transparent"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Città *"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF9500] focus:border-transparent"
                    />
                    <input
                      type="text"
                      placeholder="CAP *"
                      value={newAddress.zip}
                      onChange={(e) => setNewAddress({ ...newAddress, zip: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF9500] focus:border-transparent"
                    />
                    <input
                      type="text"
                      placeholder="Provincia"
                      value={newAddress.province}
                      onChange={(e) => setNewAddress({ ...newAddress, province: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF9500] focus:border-transparent"
                    />
                    <input
                      type="text"
                      placeholder="Telefono"
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF9500] focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={handleConfirmNewAddress}
                    className="mt-3 w-full py-2.5 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-medium rounded-lg text-sm hover:shadow-md transition-all"
                  >
                    Conferma indirizzo e procedi
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          Confirm Action Dialog
          ===================================================== */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma azione giacenza</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="space-y-3 block">
                <p>
                  Stai per richiedere: <strong>{selectedAction?.label}</strong>
                </p>
                {selectedAction && selectedAction.total_cost > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1 text-sm">
                    {selectedAction.fixed_cost > 0 && (
                      <div className="flex justify-between">
                        <span>Costo fisso</span>
                        <span>€{selectedAction.fixed_cost.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedAction.percent_cost > 0 && (
                      <div className="flex justify-between">
                        <span>Costo percentuale</span>
                        <span>€{selectedAction.percent_cost.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedAction.dossier_cost > 0 && (
                      <div className="flex justify-between">
                        <span>Apertura dossier</span>
                        <span>€{selectedAction.dossier_cost.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold border-t border-amber-300 pt-1 mt-1">
                      <span>Totale</span>
                      <span>€{selectedAction.total_cost.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-amber-700 mt-2">
                      L&apos;importo sarà addebitato sul tuo wallet.
                    </p>
                  </div>
                )}
                {selectedAction && selectedAction.total_cost === 0 && (
                  <p className="text-green-600 font-medium">Questa azione è gratuita.</p>
                )}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExecuting}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteAction}
              disabled={isExecuting}
              className="bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white hover:shadow-md"
            >
              {isExecuting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Wallet className="w-4 h-4 mr-2" />
              )}
              {isExecuting ? 'Elaborazione...' : 'Conferma'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
