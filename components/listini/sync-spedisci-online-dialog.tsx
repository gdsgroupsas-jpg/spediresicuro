/**
 * Componente: Dialog Sincronizzazione Listini da Spedisci.Online
 *
 * Permette di:
 * 1. Testare l'endpoint /shipping/rates
 * 2. Sincronizzare listini prezzi da spedisci.online
 */

"use client";

import { listConfigurations } from "@/actions/configurations";
import {
  syncPriceListsFromSpedisciOnline,
  testSpedisciOnlineRates,
} from "@/actions/spedisci-online-rates";
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
import { Select } from "@/components/ui/select";
import { getZonesForMode } from "@/lib/constants/pricing-matrix";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  TestTube,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface SyncSpedisciOnlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncComplete?: () => void;
}

export function SyncSpedisciOnlineDialog({
  open,
  onOpenChange,
  onSyncComplete,
}: SyncSpedisciOnlineDialogProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncAllProgress, setSyncAllProgress] = useState<{
    current: number;
    total: number;
    currentConfig: string;
    results: Array<{
      configName: string;
      success: boolean;
      error?: string;
      created?: number;
      updated?: number;
    }>;
  } | null>(null);

  // Progress per il single sync chunked
  const [chunkProgress, setChunkProgress] = useState<{
    currentZoneIndex: number;
    totalZones: number;
    currentZoneName: string;
    completed: boolean;
  } | null>(null);

  const [testResult, setTestResult] = useState<{
    success: boolean;
    rates?: any[];
    error?: string;
    details?: any;
  } | null>(null);

  // Parametri di test
  const [testParams, setTestParams] = useState({
    weight: 2,
    length: 30,
    width: 20,
    height: 15,
    fromCity: "Roma",
    fromProvince: "RM",
    fromZip: "00100",
    toCity: "Milano",
    toProvince: "MI",
    toZip: "20100",
    insuranceValue: 0,
    codValue: 0,
  });

  const [configurations, setConfigurations] = useState<any[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);

  const [syncOptions, setSyncOptions] = useState({
    priceListName: "",
    overwriteExisting: false,
  });

  // Modalità di sincronizzazione
  const [syncMode, setSyncMode] = useState<"fast" | "balanced" | "matrix">(
    "balanced"
  );

  // Configurazioni per ogni modalità di sync (allineate con PRICING_MATRIX)
  const SYNC_MODES = {
    fast: {
      label: "⚡ Veloce",
      description: "Solo destinazioni principali (Italia standard + Sardegna)",
      zones: 2,
      weights: 3,
      calls: 6,
      timeEstimate: "~10 sec",
      color: "bg-green-50 border-green-200 text-green-800",
      badgeColor: "bg-green-100 text-green-700",
      icon: "⚡",
    },
    balanced: {
      label: "⚖️ Bilanciato",
      description: "Zone Italia complete (9 zone × 9 pesi = 63 combinazioni)",
      zones: 7,
      weights: 9,
      calls: 63,
      timeEstimate: "~2-3 min",
      color: "bg-blue-50 border-blue-200 text-blue-800",
      badgeColor: "bg-blue-100 text-blue-700",
      icon: "⚖️",
    },
    matrix: {
      label: "📊 Matrice Completa",
      description:
        "Tutte le zone × tutti i pesi (9 zone × 101 pesi = 909 combinazioni)",
      zones: 9,
      weights: 101,
      calls: 909,
      timeEstimate: "~15-20 min",
      color: "bg-purple-50 border-purple-200 text-purple-800",
      badgeColor: "bg-purple-100 text-purple-700",
      icon: "📊",
    },
  } as const;

  // Carica le configurazioni all'apertura
  useEffect(() => {
    if (open) {
      loadConfigs();
    }
  }, [open]);

  const loadConfigs = async () => {
    setIsLoadingConfigs(true);
    try {
      const result = await listConfigurations();
      if (result.success && result.configs) {
        // Filtra solo Spedisci.Online
        let spedisciConfigs = result.configs.filter(
          (c: any) => c.provider_id === "spedisci_online" && c.is_active
        );

        // ✨ FIX: Se superadmin, mostra SOLO config master (is_default) o proprie
        // Non mostra config dei reseller per privacy e professionalità
        try {
          const userInfoResponse = await fetch('/api/user/info');
          if (userInfoResponse.ok) {
            const userInfo = await userInfoResponse.json();
            const userData = userInfo.user || userInfo;
            
            if (userData.account_type === 'superadmin') {
              // Superadmin vede solo:
              // 1. Config globali (is_default = true)
              // 2. Config proprie (owner_user_id = superadmin.id o created_by = superadmin.email)
              spedisciConfigs = spedisciConfigs.filter((c: any) => {
                const isDefault = c.is_default === true;
                const isOwned = c.owner_user_id === userData.id;
                const isCreatedBy = c.created_by === userData.email;
                return isDefault || isOwned || isCreatedBy;
              });
              
              console.log('🔒 [SUPERADMIN] Filtro config: mostro solo config master/proprie, nascoste config reseller');
            }
          }
        } catch (userInfoError) {
          console.warn('⚠️ Errore verifica utente per filtro config:', userInfoError);
          // Continua senza filtro se errore
        }

        setConfigurations(spedisciConfigs);

        // Seleziona default o il primo
        const defaultConfig = spedisciConfigs.find((c: any) => c.is_default);
        if (defaultConfig) {
          setSelectedConfigId(defaultConfig.id);
        } else if (spedisciConfigs.length > 0) {
          setSelectedConfigId(spedisciConfigs[0].id);
        }
      }
    } catch (error) {
      console.error("Errore caricamento configurazioni", error);
      toast.error("Impossibile caricare le configurazioni");
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  async function handleTest() {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testSpedisciOnlineRates({
        packages: [
          {
            length: testParams.length,
            width: testParams.width,
            height: testParams.height,
            weight: testParams.weight,
          },
        ],
        shipFrom: {
          name: "Mittente Test",
          company: "Azienda Test",
          street1: "Via Roma 1",
          street2: "",
          city: testParams.fromCity,
          state: testParams.fromProvince,
          postalCode: testParams.fromZip,
          country: "IT",
          email: "mittente@example.com",
        },
        shipTo: {
          name: "Destinatario Test",
          company: "",
          street1: "Via Milano 2",
          street2: "",
          city: testParams.toCity,
          state: testParams.toProvince,
          postalCode: testParams.toZip,
          country: "IT",
          email: "destinatario@example.com",
        },
        notes: "Test API rates",
        insuranceValue: testParams.insuranceValue,
        codValue: testParams.codValue,
        accessoriServices: [],
        configId: selectedConfigId || undefined,
      });

      setTestResult(result);

      if (result.success) {
        toast.success(
          `Test completato! Trovati ${
            result.rates?.length || 0
          } rates disponibili`
        );
      } else {
        toast.error(result.error || "Errore durante il test");
      }
    } catch (error: any) {
      toast.error(error.message || "Errore durante il test");
      setTestResult({
        success: false,
        error: error.message || "Errore sconosciuto",
      });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSync() {
    console.log("🔄 [UI] handleSync chiamato", {
      testResult,
      testResultSuccess: testResult?.success,
      testResultRates: testResult?.rates?.length,
      isSyncing,
    });

    if (!testResult) {
      console.warn("⚠️ [UI] testResult è null, sync bloccata");
      toast.error("Esegui prima un test per verificare la connessione");
      return;
    }

    if (!testResult.success) {
      console.warn("⚠️ [UI] Test non passato, sync bloccata", {
        testResultError: testResult.error,
      });
      toast.error("Esegui prima un test per verificare la connessione");
      return;
    }

    console.log("✅ [UI] Test passato, avvio sync...");
    setIsSyncing(true);

    // Calcola le zone da processare in base alla modalità
    const zones = getZonesForMode(syncMode);

    // Per "fast" o "balanced" su Vercel Free, possiamo ancora provare una sync unica
    // ma per "matrix" o sicurezza, usiamo sempre il chunking
    const useChunking = true; // Forziamo chunking per robustezza

    console.log(
      `🚀 [UI] Starting Sync (${syncMode}) - Chunking: ${useChunking}`,
      {
        totalZones: zones.length,
      }
    );

    setChunkProgress({
      currentZoneIndex: 0,
      totalZones: zones.length,
      currentZoneName: "Inizializzazione...",
      completed: false,
    });

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalEntries = 0;
    let errors: string[] = [];

    try {
      if (useChunking) {
        // CHUNKED EXECUTION: Una chiamata per zona
        for (let i = 0; i < zones.length; i++) {
          const zone = zones[i];
          setChunkProgress({
            currentZoneIndex: i + 1,
            totalZones: zones.length,
            currentZoneName: zone.name,
            completed: false,
          });

          console.log(
            `📡 [UI] Sync Chunk ${i + 1}/${zones.length}: ${zone.name} (${
              zone.code
            })`
          );

          // Chiama server action solo per questa zona
          const result = await syncPriceListsFromSpedisciOnline({
            testParams: {
              // ... params ...
              packages: [
                {
                  length: testParams.length,
                  width: testParams.width,
                  height: testParams.height,
                  weight: testParams.weight,
                },
              ],
              shipFrom: {
                name: "Mittente Test",
                city: testParams.fromCity,
                state: testParams.fromProvince,
                postalCode: testParams.fromZip,
                country: "IT",
                street1: "Via Roma 1",
                company: "Azienda Test",
                email: "mittente@example.com",
              },
              shipTo: {
                name: "Destinatario Test",
                street1: "Via Milano 2",
                city: testParams.toCity,
                state: testParams.toProvince,
                postalCode: testParams.toZip,
                country: "IT",
                company: "",
                email: "destinatario@example.com",
              },
              notes: `Sync Chunk ${zone.code}`,
              insuranceValue: testParams.insuranceValue,
              codValue: testParams.codValue,
              accessoriServices: [],
            },
            priceListName: syncOptions.priceListName || undefined,
            overwriteExisting: syncOptions.overwriteExisting, // Attenzione: true solo al primo giro? No, per zone diverse va bene true
            configId: selectedConfigId || undefined,
            mode: syncMode,
            targetZones: [zone.code], // <--- KEY: Processa solo questa zona
          });

          if (result.success) {
            totalCreated += result.priceListsCreated || 0;
            totalUpdated += result.priceListsUpdated || 0;
            totalEntries += result.entriesAdded || 0;
            console.log(
              `✅ [UI] Chunk ${zone.code} OK: +${result.entriesAdded} entries`
            );
          } else {
            console.error(`❌ [UI] Chunk ${zone.code} FAIL:`, result.error);
            errors.push(`${zone.name}: ${result.error}`);
          }

          // Piccolo delay per non floodare
          await new Promise((r) => setTimeout(r, 200));
        }
      } else {
        // Legacy: Chiamata unica (rischio timeout)
        const result = await syncPriceListsFromSpedisciOnline({
          // original logic...
          // omitting for brevity since we force chunking
          mode: syncMode,
        } as any);
      }

      if (errors.length === 0) {
        console.log("✅ [UI] All chunks completed successfully!");
        toast.success(
          `Sincronizzazione completata! Creati ${totalCreated} listini, aggiornati ${totalUpdated}, aggiunte ${totalEntries} entries`
        );
        onSyncComplete?.();
        onOpenChange(false);
      } else {
        console.error("❌ [UI] Some chunks failed:", errors);
        toast.warning(
          `Sincronizzazione parziale. ${errors.length} zone fallite. Successo: ${totalEntries} entries.`
        );
      }
    } catch (error: any) {
      console.error("💥 [UI] Errore durante sync:", error);
      toast.error(error.message || "Errore durante la sincronizzazione");
    } finally {
      setIsSyncing(false);
      setChunkProgress(null);
    }
  }

  /**
   * Sincronizza TUTTI gli account Spedisci.Online attivi in sequenza
   * Ogni config viene sincronizzata separatamente per evitare conflitti
   */
  async function handleSyncAll() {
    if (configurations.length === 0) {
      toast.error("Nessuna configurazione disponibile");
      return;
    }

    console.log("🔄 [UI] handleSyncAll - Inizio sync di tutti gli account", {
      totalConfigs: configurations.length,
    });

    setIsSyncingAll(true);
    setSyncAllProgress({
      current: 0,
      total: configurations.length,
      currentConfig: "",
      results: [],
    });

    const results: Array<{
      configName: string;
      success: boolean;
      error?: string;
      created?: number;
      updated?: number;
    }> = [];

    for (let i = 0; i < configurations.length; i++) {
      const config = configurations[i];

      setSyncAllProgress({
        current: i + 1,
        total: configurations.length,
        currentConfig: config.name || `Config ${config.id.substring(0, 6)}`,
        results: [...results],
      });

      console.log(
        `📡 [UI] Sync config ${i + 1}/${configurations.length}: ${config.name}`
      );

      try {
        const result = await syncPriceListsFromSpedisciOnline({
          testParams: {
            packages: [
              {
                length: testParams.length,
                width: testParams.width,
                height: testParams.height,
                weight: testParams.weight,
              },
            ],
            shipFrom: {
              name: "Mittente Test",
              company: "Azienda Test",
              street1: "Via Roma 1",
              street2: "",
              city: testParams.fromCity,
              state: testParams.fromProvince,
              postalCode: testParams.fromZip,
              country: "IT",
              email: "mittente@example.com",
            },
            shipTo: {
              name: "Destinatario Test",
              company: "",
              street1: "Via Milano 2",
              street2: "",
              city: testParams.toCity,
              state: testParams.toProvince,
              postalCode: testParams.toZip,
              country: "IT",
              email: "destinatario@example.com",
            },
            notes: "Sincronizzazione listini - Sync All",
            insuranceValue: testParams.insuranceValue,
            codValue: testParams.codValue,
            accessoriServices: [],
          },
          overwriteExisting: syncOptions.overwriteExisting,
          configId: config.id,
          mode: "fast", // Usa fast per sync multipli per evitare timeout
        });

        results.push({
          configName: config.name || `Config ${config.id.substring(0, 6)}`,
          success: result.success,
          error: result.error,
          created: result.priceListsCreated,
          updated: result.priceListsUpdated,
        });

        if (result.success) {
          console.log(`✅ [UI] Sync ${config.name} completata`);
        } else {
          console.warn(`⚠️ [UI] Sync ${config.name} fallita:`, result.error);
        }
      } catch (error: any) {
        console.error(`💥 [UI] Errore sync ${config.name}:`, error);
        results.push({
          configName: config.name || `Config ${config.id.substring(0, 6)}`,
          success: false,
          error: error.message || "Errore sconosciuto",
        });
      }

      // Piccola pausa tra le sync per evitare rate limiting
      if (i < configurations.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Aggiorna stato finale
    setSyncAllProgress({
      current: configurations.length,
      total: configurations.length,
      currentConfig: "Completato",
      results,
    });

    // Riepilogo
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    const totalCreated = results.reduce((sum, r) => sum + (r.created || 0), 0);
    const totalUpdated = results.reduce((sum, r) => sum + (r.updated || 0), 0);

    if (failCount === 0) {
      toast.success(
        `✅ Sync completata per tutti i ${successCount} account! Creati ${totalCreated}, aggiornati ${totalUpdated} listini`
      );
    } else if (successCount > 0) {
      toast.warning(
        `⚠️ Sync parziale: ${successCount} OK, ${failCount} falliti. Creati ${totalCreated}, aggiornati ${totalUpdated} listini`
      );
    } else {
      toast.error(`❌ Sync fallita per tutti i ${failCount} account`);
    }

    setIsSyncingAll(false);
    onSyncComplete?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Sincronizza Listini da Spedisci.Online
          </DialogTitle>
          <DialogDescription>
            Testa l&apos;endpoint /shipping/rates e sincronizza i listini prezzi
            nel database
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Sezione Test */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              1. Test Connessione
            </h3>

            {/* Selezione Account */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
              <Label className="mb-2 block text-blue-900 font-semibold">
                Seleziona Account Spedisci.Online
              </Label>
              <div className="flex gap-2">
                <Select
                  value={selectedConfigId}
                  onChange={(e) => setSelectedConfigId(e.target.value)}
                  disabled={isLoadingConfigs || configurations.length === 0}
                  className="w-full bg-white border-blue-200"
                >
                  {isLoadingConfigs ? (
                    <option>Caricamento...</option>
                  ) : configurations.length === 0 ? (
                    <option value="">Nessuna configurazione trovata</option>
                  ) : (
                    configurations.map((config) => (
                      <option key={config.id} value={config.id}>
                        {config.name || `Config ${config.id.substring(0, 6)}`}{" "}
                        {config.is_default && "(Default)"}
                      </option>
                    ))
                  )}
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={loadConfigs}
                  title="Ricarica configurazioni"
                  className="bg-white border-blue-200 hover:bg-blue-50 text-blue-600"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      isLoadingConfigs ? "animate-spin" : ""
                    }`}
                  />
                </Button>
              </div>
              {configurations.length === 0 && !isLoadingConfigs && (
                <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Nessuna configurazione trovata. Vai in Integrazioni per
                  aggiungerne una.
                </p>
              )}

              {/* Bottone Sync All - visibile solo se ci sono più config */}
              {configurations.length > 1 && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <Button
                    onClick={handleSyncAll}
                    disabled={
                      isSyncingAll || isSyncing || configurations.length === 0
                    }
                    variant="outline"
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 hover:from-blue-600 hover:to-indigo-600"
                  >
                    {isSyncingAll ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sync {syncAllProgress?.current}/{syncAllProgress?.total}
                        : {syncAllProgress?.currentConfig}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        🚀 Sincronizza TUTTI ({configurations.length} account)
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-blue-600 mt-1 text-center">
                    Sincronizza i listini da tutti gli account in sequenza
                  </p>

                  {/* Progress Chunking (Single Sync) */}
                  {isSyncing && chunkProgress && (
                    <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-100">
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="font-semibold text-blue-800">
                          Sincronizzazione Zone:{" "}
                          {chunkProgress.currentZoneIndex}/
                          {chunkProgress.totalZones}
                        </span>
                        <span className="text-blue-600 text-xs">
                          {Math.round(
                            (chunkProgress.currentZoneIndex /
                              chunkProgress.totalZones) *
                              100
                          )}
                          %
                        </span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${
                              (chunkProgress.currentZoneIndex /
                                chunkProgress.totalZones) *
                              100
                            }%`,
                          }}
                        ></div>
                      </div>
                      <p className="text-xs text-blue-700 truncate">
                        Elaborazione:{" "}
                        <strong>{chunkProgress.currentZoneName}</strong>
                      </p>
                      <p className="text-[10px] text-blue-500 mt-1">
                        ⚠️ Non chiudere questa pagina durante la
                        sincronizzazione.
                      </p>
                    </div>
                  )}

                  {/* Progress dei risultati sync all */}
                  {syncAllProgress && syncAllProgress.results.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {syncAllProgress.results.map((r, idx) => (
                        <div
                          key={idx}
                          className={`text-xs p-1 rounded flex items-center gap-1 ${
                            r.success
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {r.success ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          <span className="font-medium">{r.configName}:</span>
                          {r.success
                            ? `${r.created || 0} creati, ${
                                r.updated || 0
                              } aggiornati`
                            : r.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Peso (kg)</Label>
                <Input
                  type="number"
                  value={testParams.weight}
                  onChange={(e) =>
                    setTestParams({
                      ...testParams,
                      weight: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Dimensioni (L x W x H cm)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="L"
                    value={testParams.length}
                    onChange={(e) =>
                      setTestParams({
                        ...testParams,
                        length: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                  <Input
                    type="number"
                    placeholder="W"
                    value={testParams.width}
                    onChange={(e) =>
                      setTestParams({
                        ...testParams,
                        width: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                  <Input
                    type="number"
                    placeholder="H"
                    value={testParams.height}
                    onChange={(e) =>
                      setTestParams({
                        ...testParams,
                        height: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Da (Città, Provincia, CAP)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Città"
                    value={testParams.fromCity}
                    onChange={(e) =>
                      setTestParams({ ...testParams, fromCity: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Prov"
                    className="w-20"
                    value={testParams.fromProvince}
                    onChange={(e) =>
                      setTestParams({
                        ...testParams,
                        fromProvince: e.target.value.toUpperCase().slice(0, 2),
                      })
                    }
                  />
                  <Input
                    placeholder="CAP"
                    className="w-24"
                    value={testParams.fromZip}
                    onChange={(e) =>
                      setTestParams({ ...testParams, fromZip: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>A (Città, Provincia, CAP)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Città"
                    value={testParams.toCity}
                    onChange={(e) =>
                      setTestParams({ ...testParams, toCity: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Prov"
                    className="w-20"
                    value={testParams.toProvince}
                    onChange={(e) =>
                      setTestParams({
                        ...testParams,
                        toProvince: e.target.value.toUpperCase().slice(0, 2),
                      })
                    }
                  />
                  <Input
                    placeholder="CAP"
                    className="w-24"
                    value={testParams.toZip}
                    onChange={(e) =>
                      setTestParams({ ...testParams, toZip: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valore Assicurazione (€)</Label>
                <Input
                  type="number"
                  value={testParams.insuranceValue}
                  onChange={(e) =>
                    setTestParams({
                      ...testParams,
                      insuranceValue: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Valore Contrassegno (€)</Label>
                <Input
                  type="number"
                  value={testParams.codValue}
                  onChange={(e) =>
                    setTestParams({
                      ...testParams,
                      codValue: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            <Button
              onClick={handleTest}
              disabled={isTesting}
              className="w-full"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Test in corso...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Testa Connessione
                </>
              )}
            </Button>

            {/* Risultato Test */}
            {testResult && (
              <div
                className={`p-4 rounded-lg border ${
                  testResult.success
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p
                      className={`font-semibold ${
                        testResult.success ? "text-green-900" : "text-red-900"
                      }`}
                    >
                      {testResult.success ? "Test Completato" : "Test Fallito"}
                    </p>
                    {testResult.success ? (
                      <div className="mt-2 space-y-1 text-sm text-green-800">
                        <p>
                          Trovati{" "}
                          <strong>{testResult.rates?.length || 0}</strong> rates
                          disponibili
                        </p>
                        {testResult.details?.carriersFound && (
                          <p>
                            Corrieri:{" "}
                            <strong>
                              {testResult.details.carriersFound.join(", ")}
                            </strong>
                          </p>
                        )}
                        {testResult.details?.responseTime && (
                          <p>
                            Tempo di risposta: {testResult.details.responseTime}
                            ms
                          </p>
                        )}
                        {testResult.rates && testResult.rates.length > 0 && (
                          <div className="mt-3">
                            <p className="font-semibold mb-2">
                              Rates disponibili:
                            </p>
                            <div className="space-y-2">
                              {testResult.rates
                                .slice(0, 5)
                                .map((rate: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="bg-white p-2 rounded border border-green-200 text-xs"
                                  >
                                    <div className="flex justify-between">
                                      <span className="font-semibold">
                                        {rate.carrierCode} - {rate.contractCode}
                                      </span>
                                      <span className="text-green-700 font-bold">
                                        €{rate.total_price}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              {testResult.rates.length > 5 && (
                                <p className="text-xs text-gray-600">
                                  ... e altri {testResult.rates.length - 5}{" "}
                                  rates
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-red-800">
                        {testResult.error}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sezione Sincronizzazione */}
          {testResult?.success && (
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                2. Sincronizza Listini
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome Listino (opzionale)</Label>
                  <Input
                    placeholder="Es: Listino GLS - Gennaio 2025"
                    value={syncOptions.priceListName}
                    onChange={(e) =>
                      setSyncOptions({
                        ...syncOptions,
                        priceListName: e.target.value,
                      })
                    }
                  />
                  <p className="text-xs text-gray-500">
                    Se non specificato, verrà generato automaticamente
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="overwrite"
                    checked={syncOptions.overwriteExisting}
                    onChange={(e) =>
                      setSyncOptions({
                        ...syncOptions,
                        overwriteExisting: e.target.checked,
                      })
                    }
                    className="rounded"
                  />
                  <Label htmlFor="overwrite" className="cursor-pointer">
                    Sovrascrivi listini esistenti
                  </Label>
                </div>

                {/* Selettore Modalità Sync */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">
                    Modalità Sincronizzazione
                  </Label>
                  <div className="grid gap-2">
                    {(
                      Object.entries(SYNC_MODES) as [
                        keyof typeof SYNC_MODES,
                        (typeof SYNC_MODES)[keyof typeof SYNC_MODES]
                      ][]
                    ).map(([mode, config]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSyncMode(mode)}
                        className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                          syncMode === mode
                            ? `${config.color} border-current ring-2 ring-offset-2 ring-current`
                            : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{config.icon}</span>
                            <span className="font-semibold">
                              {config.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${config.badgeColor}`}
                            >
                              {config.calls} chiamate
                            </span>
                            <span className="text-xs text-gray-500">
                              {config.timeEstimate}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs mt-1 opacity-80">
                          {config.description}
                        </p>
                      </button>
                    ))}
                  </div>

                  {/* Avviso per matrix mode */}
                  {syncMode === "matrix" && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-amber-800 font-medium">
                            Attenzione: Sincronizzazione Completa
                          </p>
                          <p className="text-xs text-amber-700 mt-1">
                            Questa modalità esegue {SYNC_MODES.matrix.calls}{" "}
                            chiamate API e può richiedere{" "}
                            {SYNC_MODES.matrix.timeEstimate}. Raccomandata per
                            uso notturno o con automazione.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={(e) => {
                    console.log("🖱️ [UI] Pulsante Sincronizza cliccato", {
                      isSyncing,
                      testResult,
                      testResultSuccess: testResult?.success,
                    });
                    e.preventDefault();
                    handleSync().catch((err) => {
                      console.error("❌ [UI] Errore in handleSync:", err);
                      toast.error(
                        `Errore durante la sincronizzazione: ${err.message}`
                      );
                    });
                  }}
                  disabled={isSyncing}
                  className="w-full"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sincronizzazione in corso...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Sincronizza Listini
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
