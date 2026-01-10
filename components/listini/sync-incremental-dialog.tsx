/**
 * Dialog per sincronizzazione incrementale zone mancanti
 *
 * ✨ FASE 4: Permette sincronizzare solo zone mancanti con atomic commit
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
// Usa input checkbox nativo invece di componente UI
import {
  getExistingZonesForPriceListAction,
  syncIncrementalPriceListEntries,
} from "@/actions/sync-incremental-entries";
import { getZonesForMode } from "@/lib/constants/pricing-matrix";
import type { PriceList } from "@/types/listini";
import { toast } from "sonner";

interface SyncIncrementalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceList: PriceList;
  onSuccess: () => void;
}

interface ZoneStatus {
  code: string;
  name: string;
  isMissing: boolean;
  selected: boolean;
}

export function SyncIncrementalDialog({
  open,
  onOpenChange,
  priceList,
  onSuccess,
}: SyncIncrementalDialogProps) {
  const [zones, setZones] = useState<ZoneStatus[]>([]);
  const [isLoadingZones, setIsLoadingZones] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
    currentZone: string;
  } | null>(null);
  const [syncResults, setSyncResults] = useState<any[]>([]);
  const [mode, setMode] = useState<"fast" | "balanced" | "matrix">("balanced");

  const loadMissingZones = useCallback(async () => {
    setIsLoadingZones(true);
    try {
      // Recupera zone esistenti nel listino (tramite server action per evitare errori 401)
      const result = await getExistingZonesForPriceListAction(priceList.id);

      if (!result.success) {
        toast.error(result.error || "Errore recupero zone esistenti");
        setIsLoadingZones(false);
        return;
      }

      const existingZones = new Set(result.zones || []);

      // Ottieni tutte le zone per la modalità selezionata
      const allZones = getZonesForMode(mode);

      // Crea lista zone con stato
      const zonesList: ZoneStatus[] = allZones.map((zone) => ({
        code: zone.code,
        name: zone.name,
        isMissing: !existingZones.has(zone.code),
        selected: !existingZones.has(zone.code), // Auto-select zone mancanti
      }));

      setZones(zonesList);
    } catch (error: any) {
      console.error("Errore caricamento zone:", error);
      toast.error("Errore caricamento zone mancanti");
    } finally {
      setIsLoadingZones(false);
    }
  }, [priceList.id, mode]);

  // Carica zone mancanti
  useEffect(() => {
    if (open && priceList.id) {
      loadMissingZones();
    }
  }, [open, priceList.id, loadMissingZones]);

  // Toggle selezione zona
  const toggleZone = (zoneCode: string) => {
    setZones((prev) =>
      prev.map((z) =>
        z.code === zoneCode ? { ...z, selected: !z.selected } : z
      )
    );
  };

  // Esegui sincronizzazione
  const handleSync = async () => {
    const selectedZones = zones.filter((z) => z.selected).map((z) => z.code);

    if (selectedZones.length === 0) {
      toast.error("Seleziona almeno una zona da sincronizzare");
      return;
    }

    setIsSyncing(true);
    setSyncProgress({
      current: 0,
      total: selectedZones.length,
      currentZone: "",
    });
    setSyncResults([]);

    try {
      // Validazione metadata (già validata in UI, ma doppio check per sicurezza)
      const metadata = (priceList.metadata ||
        priceList.source_metadata ||
        {}) as any;
      const configId = metadata.courier_config_id;
      const carrierCode = metadata.carrier_code;
      const contractCode = metadata.contract_code;

      if (!configId || !carrierCode || !contractCode) {
        toast.error(
          `Metadata incompleti: mancano ${[
            !configId && "configId",
            !carrierCode && "carrierCode",
            !contractCode && "contractCode",
          ]
            .filter(Boolean)
            .join(", ")}. Configura il listino prima di sincronizzare.`
        );
        setIsSyncing(false);
        return;
      }

      const result = await syncIncrementalPriceListEntries({
        priceListId: priceList.id,
        targetZones: selectedZones,
        mode,
        configId,
      });

      if (result.error) {
        toast.error(result.error);
        setIsSyncing(false);
        return;
      }

      setSyncResults(result.results);

      // Toast con risultato
      if (result.zonesFailed > 0) {
        toast.warning(
          `Sincronizzazione completata: ${result.zonesSucceeded} zone sincronizzate, ${result.zonesFailed} fallite`
        );
      } else {
        toast.success(
          `${result.zonesSucceeded} zone sincronizzate con successo. ${result.totalEntriesAdded} entries aggiunte.`
        );
      }

      // Refresh dopo 2 secondi
      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
      }, 2000);
    } catch (error: any) {
      console.error("Errore sincronizzazione incrementale:", error);
      toast.error(`Errore durante la sincronizzazione: ${error.message}`);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  const missingZonesCount = zones.filter((z) => z.isMissing).length;
  const selectedZonesCount = zones.filter((z) => z.selected).length;

  // Valida metadata prima di permettere la sync
  const metadata = (priceList.metadata ||
    priceList.source_metadata ||
    {}) as any;
  const configId = metadata.courier_config_id;
  const carrierCode = metadata.carrier_code;
  const contractCode = metadata.contract_code;

  const hasCompleteMetadata = !!(configId && carrierCode && contractCode);
  const missingMetadataFields = [];
  if (!configId) missingMetadataFields.push("configId (courier_config_id)");
  if (!carrierCode) missingMetadataFields.push("carrierCode");
  if (!contractCode) missingMetadataFields.push("contractCode");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sincronizzazione Incrementale Zone</DialogTitle>
          <DialogDescription>
            Sincronizza solo le zone mancanti nel listino. Ogni zona viene
            sincronizzata atomicamente (all or nothing).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* ⚠️ Avviso metadata incompleti */}
          {!hasCompleteMetadata && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-red-900 mb-1">
                    Metadata Incompleti
                  </h4>
                  <p className="text-sm text-red-700 mb-2">
                    Il listino non ha metadata completi. Per sincronizzare è
                    necessario configurare:
                  </p>
                  <ul className="text-sm text-red-700 list-disc list-inside mb-3">
                    {missingMetadataFields.map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-red-600">
                    Vai su <strong>&quot;Configurazione&quot;</strong> per
                    completare i metadata del listino.
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* Modalità */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Modalità Sincronizzazione
            </label>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as any);
                loadMissingZones();
              }}
              disabled={isLoadingZones || isSyncing}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="fast">Fast (2 zone)</option>
              <option value="balanced">Balanced (7 zone Italia)</option>
              <option value="matrix">Matrix (Tutte le zone)</option>
            </select>
          </div>

          {/* Loading zone */}
          {isLoadingZones && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Caricamento zone...</span>
            </div>
          )}

          {/* Lista zone */}
          {!isLoadingZones && zones.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium text-gray-700">
                  Zone da Sincronizzare
                </label>
                <div className="text-sm text-gray-500">
                  {missingZonesCount} mancanti, {selectedZonesCount} selezionate
                </div>
              </div>
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <div className="divide-y">
                  {zones.map((zone) => (
                    <div
                      key={zone.code}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={zone.selected}
                        onChange={() => toggleZone(zone.code)}
                        disabled={isSyncing}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{zone.name}</div>
                        <div className="text-xs text-gray-500">{zone.code}</div>
                      </div>
                      {zone.isMissing ? (
                        <Badge className="bg-yellow-100 text-yellow-700">
                          Mancante
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700">
                          Presente
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Nessuna zona mancante */}
          {!isLoadingZones && missingZonesCount === 0 && (
            <div className="text-center py-8 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
              <p className="text-green-700 font-medium">
                Tutte le zone sono già sincronizzate
              </p>
            </div>
          )}

          {/* Progress sincronizzazione */}
          {syncProgress && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  Sincronizzazione in corso...
                </span>
              </div>
              <div className="text-sm text-blue-700">
                Zona {syncProgress.current} di {syncProgress.total}:{" "}
                {syncProgress.currentZone}
              </div>
              <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${
                      (syncProgress.current / syncProgress.total) * 100
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Risultati */}
          {syncResults.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                Risultati Sincronizzazione
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-4">
                {syncResults.map((result, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded ${
                      result.success
                        ? "bg-green-50 border border-green-200"
                        : "bg-red-50 border border-red-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                      <div>
                        <div className="text-sm font-medium">
                          {result.zoneName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {result.zone}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {result.success ? (
                        <div className="text-sm text-green-700">
                          {result.entriesAdded} entries
                        </div>
                      ) : (
                        <div className="text-sm text-red-700">
                          {result.error || "Errore"}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSyncing}
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={handleSync}
              disabled={
                isSyncing ||
                isLoadingZones ||
                selectedZonesCount === 0 ||
                missingZonesCount === 0 ||
                !hasCompleteMetadata
              }
              className="gap-2"
              title={
                !hasCompleteMetadata
                  ? `Metadata incompleti: ${missingMetadataFields.join(", ")}`
                  : undefined
              }
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sincronizzazione...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Sincronizza {selectedZonesCount} Zone
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
