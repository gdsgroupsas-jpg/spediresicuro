/**
 * Dialog: Clona Listino Fornitore (Enterprise-Grade)
 * 
 * Permette al reseller di clonare un listino fornitore esistente
 * applicando margini personalizzati (percentuale, fisso o nessuno).
 */

"use client";

import { useState, useEffect } from "react";
import {
  resellerCloneSupplierPriceListAction,
  getResellerSupplierPriceListsAction,
  getResellerSubUsersAction,
} from "@/actions/reseller-price-lists";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Copy, Plus, Save, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import type { PriceList } from "@/types/listini";

interface CloneSupplierPriceListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CloneSupplierPriceListDialog({
  open,
  onOpenChange,
  onSuccess,
}: CloneSupplierPriceListDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [subUsers, setSubUsers] = useState<
    Array<{ id: string; email: string; name?: string }>
  >([]);

  // Form fields
  const [sourcePriceListId, setSourcePriceListId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [marginType, setMarginType] = useState<
    "percent" | "fixed" | "none"
  >("percent");
  const [marginValue, setMarginValue] = useState<number>(20);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [description, setDescription] = useState("");

  // Carica dati quando si apre il dialog
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  async function loadData() {
    setIsLoading(true);
    try {
      // Carica listini supplier
      const priceListsResult = await getResellerSupplierPriceListsAction();
      if (priceListsResult.success && priceListsResult.priceLists) {
        setPriceLists(priceListsResult.priceLists);
      } else {
        toast.error(priceListsResult.error || "Errore caricamento listini");
      }

      // Carica sub-users
      const subUsersResult = await getResellerSubUsersAction();
      if (subUsersResult.success && subUsersResult.subUsers) {
        setSubUsers(subUsersResult.subUsers);
      } else {
        toast.error(subUsersResult.error || "Errore caricamento clienti");
      }
    } catch (error) {
      console.error("Errore caricamento dati:", error);
      toast.error("Errore caricamento dati");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleClone() {
    // Validazioni
    if (!sourcePriceListId) {
      toast.error("Seleziona un listino fornitore");
      return;
    }

    if (!newName.trim()) {
      toast.error("Il nome del listino è obbligatorio");
      return;
    }

    if (marginType === "percent" && marginValue < -100) {
      toast.error("Il margine percentuale non può essere inferiore a -100%");
      return;
    }

    if (marginType === "fixed" && marginValue < 0) {
      toast.error("Il margine fisso non può essere negativo");
      return;
    }

    setIsSaving(true);
    try {
      // Clona listino
      const result = await resellerCloneSupplierPriceListAction(
        sourcePriceListId,
        newName.trim(),
        marginType,
        marginValue,
        description.trim() || undefined
      );

      if (!result.success) {
        toast.error(result.error || "Errore clonazione listino");
        setIsSaving(false);
        return;
      }

      toast.success(
        `Listino clonato con successo! (${result.entryCount} tariffe importate)`
      );

      // Se è stato selezionato un cliente, assegna il listino
      if (selectedClientId) {
        const { resellerAssignPriceListAction } = await import(
          "@/actions/reseller-price-lists"
        );
        const assignResult = await resellerAssignPriceListAction(
          result.priceListId!,
          selectedClientId,
          `Assegnato dopo clonazione da ${newName}`
        );

        if (assignResult.success) {
          toast.success("Listino assegnato al cliente selezionato");
        } else {
          toast.warning(
            `Listino clonato ma assegnazione fallita: ${assignResult.error}`
          );
        }
      }

      // Reset e chiudi
      setSourcePriceListId("");
      setNewName("");
      setMarginType("percent");
      setMarginValue(20);
      setSelectedClientId("");
      setDescription("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Errore clonazione listino:", error);
      toast.error("Errore durante la clonazione del listino");
    } finally {
      setIsSaving(false);
    }
  }

  // Calcola esempio prezzo
  const calculateExamplePrice = () => {
    const basePrice = 10; // Esempio
    if (marginType === "percent") {
      return {
        base: basePrice,
        margin: basePrice * (marginValue / 100),
        total: basePrice * (1 + marginValue / 100),
      };
    } else if (marginType === "fixed") {
      return {
        base: basePrice,
        margin: marginValue,
        total: basePrice + marginValue,
      };
    } else {
      return {
        base: basePrice,
        margin: 0,
        total: basePrice,
      };
    }
  };

  const example = calculateExamplePrice();
  const sourcePriceList = priceLists.find((pl) => pl.id === sourcePriceListId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-orange-600" />
            Clona Listino Fornitore
          </DialogTitle>
          <DialogDescription>
            Clona un listino fornitore esistente applicando margini
            personalizzati per creare un listino personalizzato per i tuoi
            clienti.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600 mb-4" />
            <p className="text-sm text-gray-500">
              Caricamento listini fornitore...
            </p>
          </div>
        ) : priceLists.length === 0 ? (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">
                  Nessun listino fornitore disponibile
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Prima di clonare, devi creare dei listini fornitore dalla pagina{" "}
                  <strong>Listini Fornitore</strong>.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {/* Listino sorgente */}
            <div>
              <Label htmlFor="source-list">Listino Fornitore *</Label>
              <Select
                id="source-list"
                value={sourcePriceListId}
                onChange={(e) => setSourcePriceListId(e.target.value)}
                disabled={isSaving}
              >
                <option value="">Seleziona un listino fornitore</option>
                {priceLists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name} - {pl.courier?.name || "Multi-corriere"}
                    {pl.entries && pl.entries.length > 0
                      ? ` (${pl.entries.length} tariffe)`
                      : ""}
                  </option>
                ))}
              </Select>
              {sourcePriceList && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                  <p className="font-medium text-blue-900">
                    Informazioni listino selezionato:
                  </p>
                  <ul className="mt-1 space-y-1 text-blue-800">
                    <li>• Nome: {sourcePriceList.name}</li>
                    <li>• Versione: {sourcePriceList.version}</li>
                    <li>• Corriere: {sourcePriceList.courier?.name || "Multi-corriere"}</li>
                    <li>
                      • Tariffe:{" "}
                      {sourcePriceList.entries?.length || "N/D"} entries
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Nome nuovo listino */}
            <div>
              <Label htmlFor="new-name">Nome Listino Personalizzato *</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`es. ${sourcePriceList?.name || "Listino"} - Cliente A`}
                disabled={isSaving}
              />
            </div>

            {/* Tipo margine */}
            <div>
              <Label htmlFor="margin-type">Tipo Margine *</Label>
              <Select
                id="margin-type"
                value={marginType}
                onChange={(e) =>
                  setMarginType(e.target.value as "percent" | "fixed" | "none")
                }
                disabled={isSaving}
              >
                <option value="percent">Percentuale (%)</option>
                <option value="fixed">Importo Fisso (€)</option>
                <option value="none">Nessun margine</option>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {marginType === "percent" &&
                  "Applica una percentuale di ricarico sul prezzo base"}
                {marginType === "fixed" &&
                  "Aggiunge un importo fisso a tutte le tariffe"}
                {marginType === "none" &&
                  "Copia le tariffe così come sono"}
              </p>
            </div>

            {/* Valore margine */}
            {marginType !== "none" && (
              <div>
                <Label htmlFor="margin-value">
                  {marginType === "percent" ? "Margine Percentuale *" : "Margine Fisso (€) *"}
                </Label>
                <Input
                  id="margin-value"
                  type="number"
                  step={marginType === "percent" ? "0.01" : "0.01"}
                  min={marginType === "percent" ? -100 : 0}
                  value={marginValue}
                  onChange={(e) => setMarginValue(parseFloat(e.target.value) || 0)}
                  placeholder={marginType === "percent" ? "es. 20" : "es. 2.50"}
                  disabled={isSaving}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {marginType === "percent" &&
                    "20 = +20% sul prezzo base (es. 10€ → 12€)"}
                  {marginType === "fixed" &&
                    "2.50 = +2.50€ a ogni tariffa (es. 10€ → 12.50€)"}
                </p>
              </div>
            )}

            {/* Esempio calcolo */}
            {marginType !== "none" && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900">
                      Anteprima applicazione margine
                    </p>
                    <div className="mt-2 space-y-1 text-sm">
                      <p className="text-green-800">
                        Prezzo base: <strong>€{example.base.toFixed(2)}</strong>
                      </p>
                      <p className="text-green-800">
                        Margine applicato: <strong>+€{example.margin.toFixed(2)}</strong>
                      </p>
                      <p className="text-green-800">
                        Prezzo finale: <strong>€{example.total.toFixed(2)}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Assegnazione cliente (opzionale) */}
            <div>
              <Label htmlFor="client-assign">Assegna a Cliente (opzionale)</Label>
              <Select
                id="client-assign"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                disabled={isSaving || subUsers.length === 0}
              >
                <option value="">Non assegnare ora</option>
                {subUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email} ({user.email})
                  </option>
                ))}
              </Select>
              {subUsers.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Nessun cliente disponibile. Puoi assegnare il listino dopo la
                  creazione.
                </p>
              )}
            </div>

            {/* Descrizione (opzionale) */}
            <div>
              <Label htmlFor="description">Descrizione (opzionale)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Note aggiuntive sul listino"
                disabled={isSaving}
              />
            </div>
          </div>
        )}

        <DialogFooter className="mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Annulla
          </Button>
          <Button
            onClick={handleClone}
            disabled={
              isSaving ||
              !sourcePriceListId ||
              !newName.trim() ||
              isLoading ||
              priceLists.length === 0
            }
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Clonazione...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Clona Listino
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
