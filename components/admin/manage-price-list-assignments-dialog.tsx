"use client";

import {
  assignPriceListToUser,
  listAssignablePriceLists,
  listUserPriceListAssignments,
  revokePriceListAssignment,
} from "@/actions/price-list-assignments";
import { AlertTriangle, FileText, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ManagePriceListAssignmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userEmail: string;
  onSuccess: () => void;
}

export function ManagePriceListAssignmentsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
  onSuccess,
}: ManagePriceListAssignmentsDialogProps) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [availablePriceLists, setAvailablePriceLists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [selectedPriceListId, setSelectedPriceListId] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Carica dati
  useEffect(() => {
    async function loadData() {
      if (!open) return;

      setIsLoading(true);
      try {
        const [assignmentsRes, priceListsRes] = await Promise.all([
          listUserPriceListAssignments(userId),
          listAssignablePriceLists(),
        ]);

        if (assignmentsRes.success && assignmentsRes.assignments) {
          setAssignments(assignmentsRes.assignments);
        } else if (assignmentsRes.error) {
          toast.error(assignmentsRes.error);
        }

        if (priceListsRes.success && priceListsRes.priceLists) {
          setAvailablePriceLists(priceListsRes.priceLists);
        } else if (priceListsRes.error) {
          toast.error(priceListsRes.error);
        }
      } catch (error) {
        console.error("Errore caricamento dati:", error);
        toast.error("Errore nel caricamento dei dati");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [open, userId]);

  // Assegna nuovo listino
  const handleAssign = async () => {
    if (!selectedPriceListId) return;

    setIsAssigning(true);
    try {
      const result = await assignPriceListToUser(
        selectedPriceListId,
        userId,
        notes || undefined
      );

      if (result.success) {
        toast.success("Listino assegnato con successo");
        setSelectedPriceListId("");
        setNotes("");

        // Ricarica assegnazioni
        const res = await listUserPriceListAssignments(userId);
        if (res.success && res.assignments) {
          setAssignments(res.assignments);
        }

        onSuccess();
      } else {
        toast.error(result.error || "Errore nell'assegnazione");
      }
    } catch (error) {
      console.error("Errore assegnazione:", error);
      toast.error("Errore nell'assegnazione del listino");
    } finally {
      setIsAssigning(false);
    }
  };

  // Rimuovi assegnazione
  const handleRemove = async (assignmentId: string) => {
    setIsRemoving(assignmentId);
    try {
      const result = await revokePriceListAssignment(assignmentId);

      if (result.success) {
        toast.success("Assegnazione rimossa con successo");

        // Ricarica assegnazioni
        const res = await listUserPriceListAssignments(userId);
        if (res.success && res.assignments) {
          setAssignments(res.assignments);
        }

        onSuccess();
      } else {
        toast.error(result.error || "Errore nella rimozione");
      }
    } catch (error) {
      console.error("Errore rimozione:", error);
      toast.error("Errore nella rimozione dell'assegnazione");
    } finally {
      setIsRemoving(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">
              Gestisci Listini Personalizzati
            </h2>
          </div>
          <p className="text-sm text-gray-600">
            Utente: <strong>{userName || userEmail}</strong>
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 p-6">
            {/* Listini Assegnati */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Listini Assegnati ({assignments.length})
              </h3>
              {assignments.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-500">
                    Nessun listino assegnato
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <div>
                          <p className="font-medium text-gray-900">
                            {assignment.price_list?.name || "Listino sconosciuto"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {assignment.price_list?.list_type === "custom"
                              ? "Personalizzato"
                              : "Fornitore"}
                            {" • v"}
                            {assignment.price_list?.version || "1.0"}
                            {assignment.notes && ` • ${assignment.notes}`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemove(assignment.id)}
                        disabled={isRemoving === assignment.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isRemoving === assignment.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assegna Nuovo Listino */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Assegna Nuovo Listino
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Seleziona Listino
                  </label>
                  <select
                    value={selectedPriceListId}
                    onChange={(e) => setSelectedPriceListId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Seleziona un listino --</option>
                    {availablePriceLists
                      .filter(
                        (pl) =>
                          !assignments.some(
                            (a) => a.price_list_id === pl.id
                          )
                      )
                      .map((priceList) => (
                        <option key={priceList.id} value={priceList.id}>
                          {priceList.name} ({priceList.list_type}) - v
                          {priceList.version}
                          {priceList.default_margin_percent &&
                            ` - +${priceList.default_margin_percent}%`}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Note (opzionale)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Es: Listino speciale per cliente VIP"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <button
                  onClick={handleAssign}
                  disabled={!selectedPriceListId || isAssigning}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAssigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Assegnazione...
                    </>
                  ) : (
                    "Assegna Listino"
                  )}
                </button>
              </div>
            </div>

            {availablePriceLists.length === 0 && (
              <div className="text-center py-6 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <p className="text-sm text-amber-800">
                  Nessun listino disponibile da assegnare.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
