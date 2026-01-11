/**
 * Form per creazione/modifica listino fornitore
 *
 * Componente riutilizzabile per gestire listini fornitore (Reseller/BYOC)
 */

"use client";

import type { CourierConfig } from "@/actions/configurations";
import { listConfigurations } from "@/actions/configurations";
import {
  createSupplierPriceListAction,
  updatePriceListAction,
} from "@/actions/price-lists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PriceList, PriceListStatus } from "@/types/listini";
import { Loader2, Package } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface SupplierPriceListFormProps {
  priceList?: PriceList; // Se presente, modalità modifica
  onSuccess: () => void;
  onCancel: () => void;
  availableCouriers: Array<{ courierId: string; courierName: string }>;
}

export function SupplierPriceListForm({
  priceList,
  onSuccess,
  onCancel,
  availableCouriers,
}: SupplierPriceListFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [configurations, setConfigurations] = useState<CourierConfig[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [availableContractCodes, setAvailableContractCodes] = useState<
    string[]
  >([]);
  const [selectedCourierCode, setSelectedCourierCode] = useState<string>("");

  // Estrai metadata dal listino esistente (se in modifica)
  const existingMetadata =
    priceList?.metadata || priceList?.source_metadata || {};
  const existingConfigId = (existingMetadata as any)?.courier_config_id || "";
  const existingCarrierCode = (existingMetadata as any)?.carrier_code || "";
  const existingContractCode = (existingMetadata as any)?.contract_code || "";

  const [formData, setFormData] = useState({
    name: priceList?.name || "",
    version: priceList?.version || "1.0.0",
    status: (priceList?.status || "draft") as PriceListStatus,
    courier_id: priceList?.courier_id || "",
    courier_config_id: existingConfigId,
    carrier_code: existingCarrierCode,
    contract_code: existingContractCode,
    description: priceList?.description || "",
    notes: priceList?.notes || "",
  });

  const loadConfigurations = useCallback(async () => {
    setIsLoadingConfigs(true);
    try {
      const result = await listConfigurations();
      if (result.success && result.configs) {
        // Filtra solo Spedisci.Online attive
        const spedisciConfigs = result.configs.filter(
          (c) => c.provider_id === "spedisci_online" && c.is_active
        );
        setConfigurations(spedisciConfigs);

        // Auto-select prima configurazione se disponibile
        if (spedisciConfigs.length > 0 && !formData.courier_config_id) {
          const defaultConfig =
            spedisciConfigs.find((c) => c.is_default) || spedisciConfigs[0];
          setFormData((prev) => ({
            ...prev,
            courier_config_id: defaultConfig.id,
          }));
        }
      }
    } catch (error) {
      console.error("Errore caricamento configurazioni:", error);
      toast.error("Errore caricamento configurazioni");
    } finally {
      setIsLoadingConfigs(false);
    }
  }, [formData.courier_config_id]);

  // Carica configurazioni disponibili
  useEffect(() => {
    if (!priceList) {
      // Solo in creazione
      loadConfigurations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo al mount, non serve priceList nelle dependencies

  // Carica contract codes quando cambia configurazione
  useEffect(() => {
    if (formData.courier_config_id) {
      const config = configurations.find(
        (c) => c.id === formData.courier_config_id
      );
      if (config && config.contract_mapping) {
        const contractCodes = Object.keys(config.contract_mapping);
        setAvailableContractCodes(contractCodes);

        // Auto-select primo contract code se non selezionato
        // Usa funzione updater per evitare dependency su formData.contract_code
        setFormData((prev) => {
          if (!prev.contract_code && contractCodes.length > 0) {
            return { ...prev, contract_code: contractCodes[0] };
          }
          return prev;
        });
      } else {
        setAvailableContractCodes([]);
      }
    }
  }, [formData.courier_config_id, configurations]);

  // ✨ SCHEMA CORRETTO:
  // - carrier_code = solo prefisso (es. "gls") → nome base del corriere
  // - contract_code = codice completo (es. "gls-GLS-5000") → identificatore contratto univoco
  // 
  // Nel contract_mapping:
  // - CHIAVI = contract_code completo (es. "gls-GLS-5000") → identificatore UNIVOCO
  // - VALORI = courierName (es. "Gls") → nome corriere interno
  useEffect(() => {
    if (formData.contract_code) {
      // ✅ Il "contract_code" selezionato nel dropdown è il codice completo (es. "gls-GLS-5000")
      // Lo salviamo come contract_code
      // Estrai solo il prefisso per carrier_code (es. "gls")
      const carrierCodePrefisso = formData.contract_code.split("-")[0].toLowerCase();
      
      // Aggiorna solo se diverso dal valore corrente (previene loop infiniti)
      if (carrierCodePrefisso && carrierCodePrefisso !== formData.carrier_code) {
        setFormData((prev) => ({ ...prev, carrier_code: carrierCodePrefisso }));
        setSelectedCourierCode(carrierCodePrefisso);
      }
    }
  }, [formData.contract_code, formData.carrier_code]);

  // Fallback: Auto-fill carrier_code quando cambia corriere (se contract_code non disponibile)
  useEffect(() => {
    if (
      formData.courier_id &&
      availableCouriers.length > 0 &&
      !formData.carrier_code
    ) {
      const courier = availableCouriers.find(
        (c) => c.courierId === formData.courier_id
      );
      if (courier) {
        // Estrai carrier_code dal nome corriere (es. "GLS" -> "gls", "Poste Italiane" -> "postedeliverybusiness")
        const carrierCode = courier.courierName
          .toLowerCase()
          .replace(/\s+/g, "")
          .replace("posteitaliane", "postedeliverybusiness")
          .replace("poste", "postedeliverybusiness");
        setSelectedCourierCode(carrierCode);
        setFormData((prev) => ({ ...prev, carrier_code: carrierCode }));
      }
    }
  }, [formData.courier_id, availableCouriers, formData.carrier_code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (priceList) {
        // Modifica
        const result = await updatePriceListAction(priceList.id, {
          name: formData.name,
          version: formData.version,
          status: formData.status,
          description: formData.description,
          notes: formData.notes,
        });

        if (result.success) {
          toast.success("Listino aggiornato con successo");
          onSuccess();
        } else {
          toast.error(result.error || "Errore aggiornamento listino");
        }
      } else {
        // Creazione
        if (!formData.courier_id) {
          toast.error("Seleziona un corriere");
          setIsSubmitting(false);
          return;
        }

        if (!formData.courier_config_id) {
          toast.error("Seleziona una configurazione API");
          setIsSubmitting(false);
          return;
        }

        if (!formData.contract_code) {
          toast.error("Seleziona un contract code");
          setIsSubmitting(false);
          return;
        }

        if (!formData.carrier_code) {
          toast.error("Carrier code mancante");
          setIsSubmitting(false);
          return;
        }

        // ✅ SCHEMA CORRETTO:
        // - carrier_code = solo prefisso (es. "gls") → nome base del corriere
        // - contract_code = codice completo (es. "gls-GLS-5000") → identificatore contratto univoco
        // 
        // formData.contract_code contiene il codice completo selezionato (es. "gls-GLS-5000")
        // formData.carrier_code contiene il prefisso (es. "gls")
        
        console.log('📦 [FORM] Salvataggio listino fornitore:');
        console.log('   - carrier_code (prefisso):', formData.carrier_code);
        console.log('   - contract_code (completo):', formData.contract_code);
        console.log('   - dropdown selection:', formData.contract_code);

        const result = await createSupplierPriceListAction({
          name: formData.name,
          version: formData.version,
          status: formData.status,
          courier_id: formData.courier_id,
          description: formData.description,
          notes: formData.notes,
          // ✅ SCHEMA CORRETTO: Metadata con valori corretti
          // - carrier_code = solo prefisso (es. "gls")
          // - contract_code = codice completo (es. "gls-GLS-5000")
          metadata: {
            courier_config_id: formData.courier_config_id,
            carrier_code: formData.carrier_code, // ✅ Prefisso (es. "gls")
            contract_code: formData.contract_code, // ✅ Completo (es. "gls-GLS-5000")
            synced_at: new Date().toISOString(),
          },
        });

        if (result.success) {
          toast.success("Listino creato con successo");
          onSuccess();
        } else {
          toast.error(result.error || "Errore creazione listino");
        }
      }
    } catch (error: any) {
      console.error("Errore submit form:", error);
      toast.error("Errore imprevisto. Riprova più tardi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nome Listino */}
      <div>
        <Label htmlFor="name">Nome Listino *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Es: Listino GLS 2025"
          required
          className="mt-1"
        />
      </div>

      {/* ✨ FASE 1: Configurazione API (solo in creazione) */}
      {!priceList && (
        <div>
          <Label htmlFor="courier_config_id">Configurazione API *</Label>
          <Select
            id="courier_config_id"
            value={formData.courier_config_id}
            onChange={(e) =>
              setFormData({
                ...formData,
                courier_config_id: e.target.value,
                contract_code: "",
              })
            }
            required
            disabled={isLoadingConfigs}
            className="mt-1"
          >
            <option value="">
              {isLoadingConfigs ? "Caricamento..." : "Seleziona configurazione"}
            </option>
            {configurations.map((config) => (
              <option key={config.id} value={config.id}>
                {config.name} {config.is_default ? "(Default)" : ""}
              </option>
            ))}
          </Select>
          <p className="text-xs text-gray-500 mt-1">
            Seleziona la configurazione API Spedisci.Online da utilizzare
          </p>
        </div>
      )}

      {/* ✨ FASE 1: Contract Code (solo in creazione) */}
      {!priceList && formData.courier_config_id && (
        <div>
          <Label htmlFor="contract_code">Contract Code *</Label>
          <Select
            id="contract_code"
            value={formData.contract_code}
            onChange={(e) =>
              setFormData({ ...formData, contract_code: e.target.value })
            }
            required
            className="mt-1"
          >
            <option value="">Seleziona contract code</option>
            {availableContractCodes.map((contractCode) => {
              const config = configurations.find(
                (c) => c.id === formData.courier_config_id
              );
              const courierName =
                config?.contract_mapping?.[contractCode] || contractCode;
              return (
                <option key={contractCode} value={contractCode}>
                  {contractCode} ({courierName})
                </option>
              );
            })}
          </Select>
          <p className="text-xs text-gray-500 mt-1">
            Seleziona il contract code per questo listino
          </p>
        </div>
      )}

      {/* ✨ FASE 1: Carrier Code (solo in creazione, auto-fill) */}
      {!priceList && (
        <div>
          <Label htmlFor="carrier_code">Carrier Code *</Label>
          <Input
            id="carrier_code"
            value={formData.carrier_code}
            onChange={(e) =>
              setFormData({ ...formData, carrier_code: e.target.value })
            }
            placeholder="Es: gls, postedeliverybusiness"
            required
            className="mt-1"
          />
          <p className="text-xs text-gray-500 mt-1">
            Codice corriere (auto-compilato dal corriere selezionato)
          </p>
        </div>
      )}

      {/* Corriere (solo in creazione) */}
      {!priceList && (
        <div>
          <Label htmlFor="courier_id">Corriere *</Label>
          <Select
            id="courier_id"
            value={formData.courier_id}
            onChange={(e) =>
              setFormData({ ...formData, courier_id: e.target.value })
            }
            required
            className="mt-1"
          >
            <option value="">Seleziona corriere</option>
            {availableCouriers.map((courier) => (
              <option key={courier.courierId} value={courier.courierId}>
                {courier.courierName}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Versione */}
      <div>
        <Label htmlFor="version">Versione *</Label>
        <Input
          id="version"
          value={formData.version}
          onChange={(e) =>
            setFormData({ ...formData, version: e.target.value })
          }
          placeholder="Es: 1.0.0"
          required
          className="mt-1"
        />
      </div>

      {/* Status */}
      <div>
        <Label htmlFor="status">Status *</Label>
        <Select
          id="status"
          value={formData.status}
          onChange={(e) =>
            setFormData({
              ...formData,
              status: e.target.value as PriceListStatus,
            })
          }
          required
          className="mt-1"
        >
          <option value="draft">Bozza</option>
          <option value="active">Attivo</option>
          <option value="archived">Archiviato</option>
        </Select>
      </div>

      {/* Descrizione */}
      <div>
        <Label htmlFor="description">Descrizione</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="Descrizione opzionale del listino"
          rows={3}
          className="mt-1"
        />
      </div>

      {/* Note */}
      <div>
        <Label htmlFor="notes">Note</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Note interne opzionali"
          rows={2}
          className="mt-1"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Annulla
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {priceList ? "Aggiornamento..." : "Creazione..."}
            </>
          ) : (
            <>
              <Package className="w-4 h-4 mr-2" />
              {priceList ? "Aggiorna Listino" : "Crea Listino"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
