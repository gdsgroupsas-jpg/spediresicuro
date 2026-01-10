/**
 * Dialog: Configurazione Manuale Listino Fornitore
 *
 * Permette al reseller di configurare manualmente le sezioni non disponibili via API:
 * - Assicurazione
 * - Contrassegni
 * - Servizi accessori
 * - Giacenze
 * - Ritiro
 * - Extra
 */

"use client";

import {
  getSupplierPriceListConfig,
  upsertSupplierPriceListConfig,
} from "@/actions/supplier-price-list-config";
import { updatePriceListAction } from "@/actions/price-lists";
import { listConfigurations } from "@/actions/configurations";
import type { CourierConfig } from "@/actions/configurations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PriceList } from "@/types/listini";
import type {
  AccessoryServiceConfig,
  CODConfigRow,
  InsuranceConfig,
  PickupServiceConfig,
  StorageConfig,
} from "@/types/supplier-price-list-config";
import {
  COMMON_ACCESSORY_SERVICES,
  COMMON_STORAGE_SERVICES,
} from "@/types/supplier-price-list-config";
import {
  CreditCard,
  Loader2,
  Package,
  Plus,
  Save,
  Settings,
  Shield,
  Trash2,
  Truck,
  Warehouse,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface SupplierPriceListConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceList: PriceList;
  onSaveComplete?: () => void;
}

export function SupplierPriceListConfigDialog({
  open,
  onOpenChange,
  priceList,
  onSaveComplete,
}: SupplierPriceListConfigDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  
  // Metadata editabili - inizializzati dai metadata del priceList
  const initialMetadata = (priceList.metadata || priceList.source_metadata || {}) as any;
  const [metadataFields, setMetadataFields] = useState({
    courier_config_id: initialMetadata.courier_config_id || '',
    carrier_code: initialMetadata.carrier_code || '',
    contract_code: initialMetadata.contract_code || '',
  });
  const [configurations, setConfigurations] = useState<CourierConfig[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [availableContractCodes, setAvailableContractCodes] = useState<string[]>([]);

  // Configurazioni
  const [insuranceConfig, setInsuranceConfig] = useState<InsuranceConfig>({
    max_value: 0,
    fixed_price: 0,
    percent: 0,
    percent_on: "totale",
  });

  const [codConfig, setCodConfig] = useState<CODConfigRow[]>([]);
  const [accessoryServicesConfig, setAccessoryServicesConfig] = useState<
    AccessoryServiceConfig[]
  >([]);
  const [storageConfig, setStorageConfig] = useState<StorageConfig>({
    services: [],
    dossier_opening_cost: 0,
  });
  const [pickupConfig, setPickupConfig] = useState<PickupServiceConfig[]>([]);
  const [extraConfig, setExtraConfig] = useState<Record<string, any>>({});
  const [volumetricDensityFactor, setVolumetricDensityFactor] =
    useState<number>(200); // Default: 200 kg/m³

  const initializeDefaults = useCallback(() => {
    // Estrai carrier_code dai metadata
    const metadata = priceList.source_metadata || {};
    let carrierCode = (metadata.carrier_code || "").toLowerCase();

    // Normalizza alias comuni per Poste
    const carrierAliases: Record<string, string> = {
      poste: "postedeliverybusiness",
      posteitaliane: "postedeliverybusiness",
      "poste italiane": "postedeliverybusiness",
    };

    // Se c'è un alias, usa quello
    if (carrierAliases[carrierCode]) {
      carrierCode = carrierAliases[carrierCode];
    }

    // Inizializza servizi accessori comuni per questo corriere
    const commonServices = COMMON_ACCESSORY_SERVICES[carrierCode] || [];
    setAccessoryServicesConfig(
      commonServices.map((service) => ({
        service,
        price: 0,
        percent: 0,
      }))
    );

    // Inizializza servizi giacenza comuni
    setStorageConfig({
      services: COMMON_STORAGE_SERVICES.map((service) => ({
        service,
        price: 0,
        percent: 0,
      })),
      dossier_opening_cost: 0,
    });

    // Inizializza ritiro
    setPickupConfig([
      {
        service: "Ritiro",
        fixed_price: 0,
        percent_of_freight: 0,
      },
    ]);
  }, [priceList.source_metadata]);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getSupplierPriceListConfig(priceList.id);
      if (result.success && result.config) {
        const config = result.config;
        setInsuranceConfig(config.insurance_config);
        setCodConfig(config.cod_config || []);
        setAccessoryServicesConfig(config.accessory_services_config || []);
        setStorageConfig(
          config.storage_config || {
            services: [],
            dossier_opening_cost: 0,
          }
        );
        setPickupConfig(config.pickup_config || []);
        setExtraConfig(config.extra_config || {});
        setVolumetricDensityFactor(config.volumetric_density_factor || 200);
      } else {
        // Inizializza con valori di default basati sul corriere
        initializeDefaults();
      }
    } catch (error) {
      console.error("Errore caricamento configurazione:", error);
      toast.error("Errore caricamento configurazione");
      initializeDefaults();
    } finally {
      setIsLoading(false);
    }
  }, [priceList.id, initializeDefaults]);

  // Carica configurazioni disponibili
  useEffect(() => {
    if (open) {
      loadConfigurations();
    }
  }, [open]);

  // Carica contract codes quando cambia configurazione
  useEffect(() => {
    if (metadataFields.courier_config_id) {
      const config = configurations.find(c => c.id === metadataFields.courier_config_id);
      if (config && config.contract_mapping) {
        const contractCodes = Object.keys(config.contract_mapping);
        setAvailableContractCodes(contractCodes);
      } else {
        setAvailableContractCodes([]);
      }
    }
  }, [metadataFields.courier_config_id, configurations]);

  // Auto-fill carrier_code quando cambia contract_code
  useEffect(() => {
    if (metadataFields.contract_code) {
      const carrierCode = metadataFields.contract_code.split('-')[0].toLowerCase();
      if (carrierCode && carrierCode !== metadataFields.carrier_code) {
        setMetadataFields(prev => ({ ...prev, carrier_code: carrierCode }));
      }
    }
  }, [metadataFields.contract_code]);

  // Aggiorna metadata fields quando cambia priceList
  useEffect(() => {
    const metadata = (priceList.metadata || priceList.source_metadata || {}) as any;
    setMetadataFields({
      courier_config_id: metadata.courier_config_id || '',
      carrier_code: metadata.carrier_code || '',
      contract_code: metadata.contract_code || '',
    });
  }, [priceList.metadata, priceList.source_metadata]);

  // Carica configurazione esistente
  useEffect(() => {
    if (open && priceList.id) {
      loadConfig();
    }
  }, [open, priceList.id, loadConfig]);

  const loadConfigurations = async () => {
    setIsLoadingConfigs(true);
    try {
      const result = await listConfigurations();
      if (result.success && result.configs) {
        const spedisciConfigs = result.configs.filter(
          (c) => c.provider_id === 'spedisci_online' && c.is_active
        );
        setConfigurations(spedisciConfigs);
      }
    } catch (error) {
      console.error('Errore caricamento configurazioni:', error);
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  async function handleSave() {
    setIsSaving(true);
    try {
      // Usa i valori dai campi editabili invece di metadata esistenti
      const carrierCode = metadataFields.carrier_code || 
        (priceList.courier?.code?.toLowerCase()) || 
        "";

      // Valida metadata obbligatori
      if (!metadataFields.courier_config_id || !carrierCode || !metadataFields.contract_code) {
        toast.error(
          `Metadata incompleti: mancano ${
            [
              !metadataFields.courier_config_id && 'Config ID',
              !carrierCode && 'Carrier Code',
              !metadataFields.contract_code && 'Contract Code',
            ]
              .filter(Boolean)
              .join(', ')
          }. Completa tutti i campi nel tab "Generale".`
        );
        setIsSaving(false);
        return;
      }

      // 1. Aggiorna metadata nel price_list stesso
      const existingMetadata = (priceList.metadata || priceList.source_metadata || {}) as any;
      const updatedMetadata = {
        ...existingMetadata,
        courier_config_id: metadataFields.courier_config_id,
        carrier_code: carrierCode,
        contract_code: metadataFields.contract_code,
        synced_at: existingMetadata.synced_at || new Date().toISOString(),
      };

      const updateResult = await updatePriceListAction(priceList.id, {
        metadata: updatedMetadata,
      });

      if (!updateResult.success) {
        toast.error(updateResult.error || "Errore aggiornamento metadata");
        setIsSaving(false);
        return;
      }

      // 2. Salva configurazione nella tabella supplier_price_list_config
      const result = await upsertSupplierPriceListConfig({
        price_list_id: priceList.id,
        carrier_code: carrierCode,
        contract_code: metadataFields.contract_code,
        courier_config_id: metadataFields.courier_config_id,
        insurance_config: insuranceConfig,
        cod_config: codConfig,
        accessory_services_config: accessoryServicesConfig,
        storage_config: storageConfig,
        pickup_config: pickupConfig,
        extra_config: extraConfig,
        volumetric_density_factor: volumetricDensityFactor,
      });

      if (result.success) {
        toast.success("Configurazione e metadata salvati con successo");
        onSaveComplete?.();
        onOpenChange(false);
      } else {
        toast.error(result.error || "Errore durante il salvataggio");
      }
    } catch (error: any) {
      console.error("Errore salvataggio configurazione:", error);
      toast.error(error.message || "Errore durante il salvataggio");
    } finally {
      setIsSaving(false);
    }
  }

  // Helper per aggiungere riga COD
  function addCodRow() {
    setCodConfig([
      ...codConfig,
      {
        max_value: 0,
        fixed_price: 0,
        percent: 0,
        percent_on: "totale",
      },
    ]);
  }

  // Helper per rimuovere riga COD
  function removeCodRow(index: number) {
    setCodConfig(codConfig.filter((_, i) => i !== index));
  }

  // Helper per aggiungere servizio accessorio
  function addAccessoryService() {
    setAccessoryServicesConfig([
      ...accessoryServicesConfig,
      {
        service: "",
        price: 0,
        percent: 0,
      },
    ]);
  }

  // Helper per rimuovere servizio accessorio
  function removeAccessoryService(index: number) {
    setAccessoryServicesConfig(
      accessoryServicesConfig.filter((_, i) => i !== index)
    );
  }

  // Helper per aggiungere servizio giacenza
  function addStorageService() {
    setStorageConfig({
      ...storageConfig,
      services: [
        ...storageConfig.services,
        {
          service: "",
          price: 0,
          percent: 0,
        },
      ],
    });
  }

  // Helper per rimuovere servizio giacenza
  function removeStorageService(index: number) {
    setStorageConfig({
      ...storageConfig,
      services: storageConfig.services.filter((_, i) => i !== index),
    });
  }

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2">Caricamento configurazione...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurazione Manuale: {priceList.name}
          </DialogTitle>
          <DialogDescription>
            Configura le sezioni non disponibili via API per questo listino
            {priceList.list_type === "custom" ? " cliente" : " fornitore"}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="general">
              <Settings className="h-4 w-4 mr-1" />
              Generale
            </TabsTrigger>
            <TabsTrigger value="weights-zones">
              <Package className="h-4 w-4 mr-1" />
              Pesi / Zone
            </TabsTrigger>
            <TabsTrigger value="insurance">
              <Shield className="h-4 w-4 mr-1" />
              Assicurazione
            </TabsTrigger>
            <TabsTrigger value="cod">
              <CreditCard className="h-4 w-4 mr-1" />
              Contrassegni
            </TabsTrigger>
            <TabsTrigger value="services">
              <Package className="h-4 w-4 mr-1" />
              Servizi
            </TabsTrigger>
            <TabsTrigger value="storage">
              <Warehouse className="h-4 w-4 mr-1" />
              Giacenze
            </TabsTrigger>
            <TabsTrigger value="pickup">
              <Truck className="h-4 w-4 mr-1" />
              Ritiro
            </TabsTrigger>
            <TabsTrigger value="extra">
              <Settings className="h-4 w-4 mr-1" />
              Extra
            </TabsTrigger>
          </TabsList>

          {/* Tab Assicurazione */}
          {/* Tab Generale */}
          <TabsContent value="general" className="space-y-4 mt-4">
            {/* ⚠️ Sezione Metadata (obbligatori per sync) */}
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Metadata API (Obbligatori per Sincronizzazione)
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Questi campi sono necessari per sincronizzare il listino con l&apos;API Spedisci.Online.
                Se mancanti, la sincronizzazione incrementale non funzionerà.
              </p>
              
              <div className="space-y-4">
                {/* Configurazione API */}
                <div>
                  <Label htmlFor="metadata-courier-config-id">
                    Configurazione API (Config ID) *
                  </Label>
                  <select
                    id="metadata-courier-config-id"
                    value={metadataFields.courier_config_id}
                    onChange={(e) => {
                      setMetadataFields(prev => ({ 
                        ...prev, 
                        courier_config_id: e.target.value,
                        contract_code: '' // Reset contract code quando cambia config
                      }));
                    }}
                    disabled={isLoadingConfigs}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md mt-1"
                  >
                    <option value="">
                      {isLoadingConfigs ? 'Caricamento...' : 'Seleziona configurazione'}
                    </option>
                    {configurations.map((config) => (
                      <option key={config.id} value={config.id}>
                        {config.name} {config.is_default ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Configurazione Spedisci.Online da utilizzare per questo listino
                  </p>
                </div>

                {/* Contract Code */}
                {metadataFields.courier_config_id && (
                  <div>
                    <Label htmlFor="metadata-contract-code">
                      Contract Code *
                    </Label>
                    <select
                      id="metadata-contract-code"
                      value={metadataFields.contract_code}
                      onChange={(e) => {
                        setMetadataFields(prev => ({ 
                          ...prev, 
                          contract_code: e.target.value 
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md mt-1"
                    >
                      <option value="">Seleziona contract code</option>
                      {availableContractCodes.map((contractCode) => {
                        const config = configurations.find(c => c.id === metadataFields.courier_config_id);
                        const courierName = config?.contract_mapping?.[contractCode] || contractCode;
                        return (
                          <option key={contractCode} value={contractCode}>
                            {contractCode} ({courierName})
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Contract code specifico per questo listino (auto-compila carrier_code)
                    </p>
                  </div>
                )}

                {/* Carrier Code */}
                <div>
                  <Label htmlFor="metadata-carrier-code">
                    Carrier Code *
                  </Label>
                  <Input
                    id="metadata-carrier-code"
                    value={metadataFields.carrier_code}
                    onChange={(e) => setMetadataFields(prev => ({ 
                      ...prev, 
                      carrier_code: e.target.value.toLowerCase() 
                    }))}
                    placeholder="Es: gls, postedeliverybusiness"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Codice corriere (auto-compilato dal contract code se selezionato)
                  </p>
                </div>
              </div>
            </div>

            {/* Fattore Peso/Volume */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h3 className="font-semibold text-gray-900 mb-4">
                Fattore Peso/Volume (Densità)
              </h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="volumetric-density-factor">
                    Densità (kg/m³)
                  </Label>
                  <Input
                    id="volumetric-density-factor"
                    type="number"
                    step="0.01"
                    min="1"
                    value={volumetricDensityFactor}
                    onChange={(e) =>
                      setVolumetricDensityFactor(
                        parseFloat(e.target.value) || 200
                      )
                    }
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Fattore densità per calcolo peso volumetrico. Default: 200
                    kg/m³ (corrisponde a divisore 5000).
                    <br />
                    Formula: Peso volumetrico (kg) = (L × W × H in cm) /
                    (1,000,000 / densità)
                    <br />
                    Esempio: 200 kg/m³ → divisore 5000
                  </p>
                  {volumetricDensityFactor > 0 && (
                    <p className="text-xs text-blue-700 mt-1 font-medium">
                      Divisore equivalente:{" "}
                      {Math.round(1000000 / volumetricDensityFactor)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tab Generale */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h3 className="font-semibold text-gray-900 mb-4">
                Fattore Peso/Volume (Densità)
              </h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="volumetric-density-factor">
                    Densità (kg/m³)
                  </Label>
                  <Input
                    id="volumetric-density-factor"
                    type="number"
                    step="0.01"
                    min="1"
                    value={volumetricDensityFactor}
                    onChange={(e) =>
                      setVolumetricDensityFactor(
                        parseFloat(e.target.value) || 200
                      )
                    }
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Fattore densità per calcolo peso volumetrico. Default: 200
                    kg/m³ (corrisponde a divisore 5000).
                    <br />
                    Formula: Peso volumetrico (kg) = (L × W × H in cm) /
                    (1,000,000 / densità)
                    <br />
                    Esempio: 200 kg/m³ → divisore 5000
                  </p>
                  {volumetricDensityFactor > 0 && (
                    <p className="text-xs text-blue-700 mt-1 font-medium">
                      Divisore equivalente:{" "}
                      {Math.round(1000000 / volumetricDensityFactor)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tab Pesi / Zone */}
          <TabsContent value="weights-zones" className="space-y-4 mt-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h3 className="font-semibold text-gray-900 mb-2">
                Matrice Pesi / Zone
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                La matrice pesi/zone viene gestita nella pagina dettaglio del
                listino. Puoi modificare manualmente tutti i valori per ogni
                combinazione di peso e zona geografica.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Apri pagina dettaglio listino in nuova tab
                    // Usa route corretta in base al tipo di listino
                    const detailUrl =
                      priceList.list_type === "custom"
                        ? `/dashboard/listini/${priceList.id}`
                        : `/dashboard/reseller/listini-fornitore/${priceList.id}`;
                    window.open(detailUrl, "_blank");
                  }}
                  className="gap-2"
                >
                  <Package className="h-4 w-4" />
                  Apri Matrice Completa
                </Button>
              </div>
              <div className="mt-4 p-3 bg-white rounded border border-gray-200">
                <p className="text-xs text-gray-600">
                  <strong>Nota:</strong> La configurazione della matrice
                  pesi/zone è gestita direttamente nella pagina dettaglio del
                  listino, dove puoi:
                </p>
                <ul className="text-xs text-gray-600 mt-2 list-disc list-inside space-y-1">
                  <li>Visualizzare tutte le zone geografiche</li>
                  <li>Modificare manualmente i prezzi per ogni combinazione</li>
                  <li>Aggiungere nuove fasce di peso</li>
                  <li>Eliminare righe non necessarie</li>
                  <li>Modificare il fuel surcharge per riga</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="insurance" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="insurance-max-value">Valore massimo</Label>
                <Input
                  id="insurance-max-value"
                  type="number"
                  value={insuranceConfig.max_value}
                  onChange={(e) =>
                    setInsuranceConfig({
                      ...insuranceConfig,
                      max_value: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="insurance-fixed-price">€ Prezzo fisso</Label>
                <Input
                  id="insurance-fixed-price"
                  type="number"
                  step="0.01"
                  value={insuranceConfig.fixed_price}
                  onChange={(e) =>
                    setInsuranceConfig({
                      ...insuranceConfig,
                      fixed_price: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="insurance-percent">€ +%</Label>
                <Input
                  id="insurance-percent"
                  type="number"
                  step="0.01"
                  value={insuranceConfig.percent}
                  onChange={(e) =>
                    setInsuranceConfig({
                      ...insuranceConfig,
                      percent: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="insurance-percent-on">Calcolo % su</Label>
                <select
                  id="insurance-percent-on"
                  className="w-full px-3 py-2 border rounded-md"
                  value={insuranceConfig.percent_on}
                  onChange={(e) =>
                    setInsuranceConfig({
                      ...insuranceConfig,
                      percent_on: e.target.value as "totale" | "base",
                    })
                  }
                >
                  <option value="totale">Totale</option>
                  <option value="base">Base</option>
                </select>
              </div>
            </div>
          </TabsContent>

          {/* Tab Contrassegni */}
          <TabsContent value="cod" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Scaglioni Contrassegno</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCodRow}
              >
                <Plus className="h-4 w-4 mr-1" />
                Aggiungi riga
              </Button>
            </div>
            <div className="space-y-3">
              {codConfig.map((row, index) => (
                <div
                  key={index}
                  className="grid grid-cols-5 gap-3 p-3 border rounded-lg"
                >
                  <div>
                    <Label>Valore massimo</Label>
                    <Input
                      type="number"
                      value={row.max_value}
                      onChange={(e) => {
                        const newCod = [...codConfig];
                        newCod[index].max_value =
                          parseFloat(e.target.value) || 0;
                        setCodConfig(newCod);
                      }}
                    />
                  </div>
                  <div>
                    <Label>€ Prezzo fisso</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={row.fixed_price}
                      onChange={(e) => {
                        const newCod = [...codConfig];
                        newCod[index].fixed_price =
                          parseFloat(e.target.value) || 0;
                        setCodConfig(newCod);
                      }}
                    />
                  </div>
                  <div>
                    <Label>€ +% del valore</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={row.percent}
                      onChange={(e) => {
                        const newCod = [...codConfig];
                        newCod[index].percent = parseFloat(e.target.value) || 0;
                        setCodConfig(newCod);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Calcolo % su</Label>
                    <select
                      className="w-full px-3 py-2 border rounded-md"
                      value={row.percent_on}
                      onChange={(e) => {
                        const newCod = [...codConfig];
                        newCod[index].percent_on = e.target.value as
                          | "totale"
                          | "base";
                        setCodConfig(newCod);
                      }}
                    >
                      <option value="totale">Totale</option>
                      <option value="base">Base</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCodRow(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
              {codConfig.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nessuna riga configurata. Clicca &quot;Aggiungi riga&quot; per
                  iniziare.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Tab Servizi Accessori */}
          <TabsContent value="services" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Servizi Accessori</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAccessoryService}
              >
                <Plus className="h-4 w-4 mr-1" />
                Aggiungi servizio
              </Button>
            </div>
            <div className="space-y-3">
              {accessoryServicesConfig.map((service, index) => (
                <div
                  key={index}
                  className="grid grid-cols-4 gap-3 p-3 border rounded-lg"
                >
                  <div>
                    <Label>Servizio</Label>
                    <Input
                      value={service.service}
                      onChange={(e) => {
                        const newServices = [...accessoryServicesConfig];
                        newServices[index].service = e.target.value;
                        setAccessoryServicesConfig(newServices);
                      }}
                      placeholder="es. Exchange, Saturday Service..."
                    />
                  </div>
                  <div>
                    <Label>Prezzo (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={service.price}
                      onChange={(e) => {
                        const newServices = [...accessoryServicesConfig];
                        newServices[index].price =
                          parseFloat(e.target.value) || 0;
                        setAccessoryServicesConfig(newServices);
                      }}
                    />
                  </div>
                  <div>
                    <Label>€ +% del valore spedizione</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={service.percent}
                      onChange={(e) => {
                        const newServices = [...accessoryServicesConfig];
                        newServices[index].percent =
                          parseFloat(e.target.value) || 0;
                        setAccessoryServicesConfig(newServices);
                      }}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAccessoryService(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
              {accessoryServicesConfig.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nessun servizio configurato. Clicca &quot;Aggiungi
                  servizio&quot; per iniziare.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Tab Giacenze */}
          <TabsContent value="storage" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Servizi Giacenza</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addStorageService}
              >
                <Plus className="h-4 w-4 mr-1" />
                Aggiungi servizio
              </Button>
            </div>
            <div className="space-y-3">
              {storageConfig.services.map((service, index) => (
                <div
                  key={index}
                  className="grid grid-cols-4 gap-3 p-3 border rounded-lg"
                >
                  <div>
                    <Label>Servizio</Label>
                    <Input
                      value={service.service}
                      onChange={(e) => {
                        const newServices = [...storageConfig.services];
                        newServices[index].service = e.target.value;
                        setStorageConfig({
                          ...storageConfig,
                          services: newServices,
                        });
                      }}
                      placeholder="es. Riconsegna, Reso al mittente..."
                    />
                  </div>
                  <div>
                    <Label>Prezzo (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={service.price}
                      onChange={(e) => {
                        const newServices = [...storageConfig.services];
                        newServices[index].price =
                          parseFloat(e.target.value) || 0;
                        setStorageConfig({
                          ...storageConfig,
                          services: newServices,
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label>€ +% del valore spedizione</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={service.percent}
                      onChange={(e) => {
                        const newServices = [...storageConfig.services];
                        newServices[index].percent =
                          parseFloat(e.target.value) || 0;
                        setStorageConfig({
                          ...storageConfig,
                          services: newServices,
                        });
                      }}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStorageService(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
              {storageConfig.services.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nessun servizio configurato. Clicca &quot;Aggiungi
                  servizio&quot; per iniziare.
                </p>
              )}
            </div>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <Label htmlFor="dossier-opening-cost">
                Apertura dossier giacenza (€)
              </Label>
              <Input
                id="dossier-opening-cost"
                type="number"
                step="0.01"
                value={storageConfig.dossier_opening_cost}
                onChange={(e) =>
                  setStorageConfig({
                    ...storageConfig,
                    dossier_opening_cost: parseFloat(e.target.value) || 0,
                  })
                }
                className="mt-2"
              />
              <p className="text-xs text-gray-600 mt-2">
                * Il costo sarà addebitato solo nella fase di svincolo da parte
                del cliente
              </p>
            </div>
          </TabsContent>

          {/* Tab Ritiro */}
          <TabsContent value="pickup" className="space-y-4 mt-4">
            <div className="space-y-3">
              {pickupConfig.map((service, index) => (
                <div
                  key={index}
                  className="grid grid-cols-3 gap-3 p-3 border rounded-lg"
                >
                  <div>
                    <Label>Servizio</Label>
                    <Input
                      value={service.service}
                      onChange={(e) => {
                        const newPickup = [...pickupConfig];
                        newPickup[index].service = e.target.value;
                        setPickupConfig(newPickup);
                      }}
                      placeholder="es. Ritiro"
                    />
                  </div>
                  <div>
                    <Label>Prezzo fisso (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={service.fixed_price}
                      onChange={(e) => {
                        const newPickup = [...pickupConfig];
                        newPickup[index].fixed_price =
                          parseFloat(e.target.value) || 0;
                        setPickupConfig(newPickup);
                      }}
                    />
                  </div>
                  <div>
                    <Label>+% del nolo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={service.percent_of_freight}
                      onChange={(e) => {
                        const newPickup = [...pickupConfig];
                        newPickup[index].percent_of_freight =
                          parseFloat(e.target.value) || 0;
                        setPickupConfig(newPickup);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Tab Extra */}
          <TabsContent value="extra" className="space-y-4 mt-4">
            <p className="text-sm text-gray-600">
              Configurazioni extra per questo listino. Questa sezione può essere
              estesa in futuro per configurazioni aggiuntive specifiche del
              corriere.
            </p>
            <div className="p-4 bg-gray-50 rounded-lg border">
              <p className="text-sm text-gray-500">
                Nessuna configurazione extra disponibile al momento.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvataggio...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salva Configurazione
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
