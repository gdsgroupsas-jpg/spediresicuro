/**
 * Intelligent Quote Comparator - Enterprise-Grade Component
 *
 * Preventivatore intelligente che:
 * 1. Si attiva automaticamente quando dati completi (zona, peso, misure)
 * 2. ✨ UNA SOLA chiamata generica che restituisce tutti i rates disponibili
 * 3. ✨ Mappa i rates ricevuti ai contratti configurati in contract_mapping
 * 4. ✨ Mostra solo contratti che hanno rates nella risposta (nasconde se non supportano destinazione)
 * 5. Vista Tabella (unica vista disponibile)
 * 6. Progresso globale + stato per singolo contratto
 * 7. Gestione accessori dinamica (solo se presenti nel listino cliente)
 */

"use client";

import { COMMON_ACCESSORY_SERVICES } from "@/types/supplier-price-list-config";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
// Rimuoviamo useQuoteRequest per gestire chiamate parallele manualmente

// Costi stimati per servizi accessori (da confermare in fase di creazione spedizione)
const ACCESSORY_SERVICE_COSTS: Record<string, number> = {
  Exchange: 3.5,
  "Document Return": 2.0,
  "Saturday Service": 5.0,
  Express12: 8.0,
  "Preavviso Telefonico": 1.5,
  "POD (Proof of Delivery)": 1.0,
  "Fermo Deposito": 3.0,
  "Consegna al Piano": 15.0,
  "Consegna Appuntamento": 4.0,
};

interface IntelligentQuoteComparatorProps {
  couriers: Array<{
    displayName: string;
    courierName: string;
    contractCode?: string;
  }>;
  weight: number;
  zip?: string;
  province?: string;
  city?: string;
  services?: string[];
  insuranceValue?: number;
  codValue?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  onQuoteReceived?: (courier: string, contractCode: string, quote: any) => void;
  onContractSelected?: (
    courier: string,
    contractCode: string,
    accessoryService?: string
  ) => void;
}

interface QuoteResult {
  courier: string;
  courierName: string;
  contractCode: string;
  success: boolean;
  rates?: any[];
  error?: string;
  cached?: boolean;
  cacheAge?: number;
  loading: boolean;
}

export function IntelligentQuoteComparator({
  couriers,
  weight,
  zip,
  province,
  city,
  services = [],
  insuranceValue = 0,
  codValue = 0,
  dimensions,
  onQuoteReceived,
  onContractSelected,
}: IntelligentQuoteComparatorProps) {
  const [quotes, setQuotes] = useState<Map<string, QuoteResult>>(new Map());
  const [isCalculating, setIsCalculating] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // ✨ NUOVO: Stati per selezione corriere e servizio accessorio
  const [selectedCourierKey, setSelectedCourierKey] = useState<string | null>(
    null
  );
  const [selectedAccessoryService, setSelectedAccessoryService] = useState<
    string | null
  >(null);
  const [showAccessoryDropdown, setShowAccessoryDropdown] = useState(false);

  // ⚠️ FIX: Prevenire loop infinito - traccia se abbiamo già fatto le chiamate per questi parametri
  const lastRequestParamsRef = useRef<string>("");
  const isRequestingRef = useRef(false);

  // ✨ FIX: Memorizza i servizi precedenti per rilevare cambiamenti
  const prevServicesRef = useRef<string>("");

  // ✨ IMPORTANTE: Reset refs quando cambiano servizi o COD - PRIMA dell'useEffect principale
  const currentServicesKey = services.sort().join(",");
  if (prevServicesRef.current !== currentServicesKey) {
    console.log(
      "🔄 [QUOTE COMPARATOR] Servizi cambiati:",
      prevServicesRef.current,
      "→",
      currentServicesKey
    );
    prevServicesRef.current = currentServicesKey;
    lastRequestParamsRef.current = ""; // Forza nuova chiamata
    isRequestingRef.current = false;
  }

  // Verifica se dati sono completi per attivare preventivatore
  const isDataComplete = useMemo(() => {
    return (
      weight > 0 &&
      !!zip &&
      !!province &&
      dimensions?.length &&
      dimensions?.width &&
      dimensions?.height
    );
  }, [weight, zip, province, dimensions]);

  // Chiamata automatica quando dati completi
  useEffect(() => {
    if (!isDataComplete || couriers.length === 0) {
      return;
    }

    // ⚠️ FIX: Prevenire loop infinito - crea chiave univoca per questi parametri
    const requestKey = `${weight}-${zip}-${province}-${services.join(
      ","
    )}-${insuranceValue}-${codValue}-${couriers.length}`;

    // ✨ DEBUG: Log per vedere se i parametri cambiano
    console.log("🔄 [QUOTE COMPARATOR] useEffect triggered:", {
      requestKey,
      lastRequestKey: lastRequestParamsRef.current,
      isRequesting: isRequestingRef.current,
      services,
      willSkip:
        isRequestingRef.current || lastRequestParamsRef.current === requestKey,
    });

    // Se stiamo già facendo una richiesta o abbiamo già fatto questa richiesta, esci
    if (
      isRequestingRef.current ||
      lastRequestParamsRef.current === requestKey
    ) {
      console.log(
        "⏭️ [QUOTE COMPARATOR] Skipping request - already done or in progress"
      );
      return;
    }

    // Marca che stiamo facendo una richiesta
    isRequestingRef.current = true;
    lastRequestParamsRef.current = requestKey;

    // Reset stato
    setQuotes(new Map());
    setCompletedCount(0);
    setTotalCount(couriers.length);
    setIsCalculating(true);

    // ✨ ENTERPRISE: Una sola chiamata generica che restituisce tutti i rates
    // Poi mappiamo i rates ricevuti ai contratti configurati
    const fetchAllQuotes = async () => {
      try {
        // Inizializza stato loading per tutti i contratti
        const initialQuotes = new Map<string, QuoteResult>();
        couriers.forEach((courier) => {
          const key = `${courier.displayName}::${
            courier.contractCode || "default"
          }`;
          initialQuotes.set(key, {
            courier: courier.displayName,
            courierName: courier.courierName,
            contractCode: courier.contractCode || "default",
            success: false,
            loading: true,
          });
        });
        setQuotes(initialQuotes);

        // ✨ UNA SOLA chiamata generica senza filtri courier/contractCode
        console.log(
          "📊 [QUOTE COMPARATOR] Chiamata API con servizi:",
          services
        );
        const response = await fetch("/api/quotes/realtime", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            allContracts: true, // ✨ Flag per chiamata generica
            weight,
            zip,
            province,
            city,
            services,
            insuranceValue,
            codValue,
            dimensions, // Passa dimensioni se disponibili
          }),
        });

        const result = await response.json();

        if (!result.success || !result.rates || result.rates.length === 0) {
          // Nessun rate disponibile: aggiorna tutti i contratti come non disponibili
          setQuotes((prev) => {
            const next = new Map(prev);
            Array.from(next.keys()).forEach((key) => {
              const existing = next.get(key);
              if (existing) {
                next.set(key, {
                  ...existing,
                  success: false,
                  error:
                    result?.error ||
                    "Nessun rate disponibile per questa destinazione",
                  loading: false,
                });
              }
            });
            return next;
          });
          setIsCalculating(false);
          isRequestingRef.current = false;
          return;
        }

        // ✨ MAPPING: Mappa i rates ricevuti ai contratti configurati
        // Usa la stessa logica della sincronizzazione listini: matching flessibile per variazioni formato
        const ratesByContractCode = new Map<string, any[]>();
        const ratesByNormalizedCode = new Map<string, any[]>();
        const ratesByExactMatch = new Map<string, any[]>(); // Match esatto case-sensitive
        const ratesByKeyParts = new Map<string, any[]>(); // ✨ NUOVO: Match per parti chiave (come sync listini)

        result.rates.forEach((rate: any) => {
          const contractCode = rate.contractCode;
          if (contractCode) {
            // Match esatto case-sensitive (priorità massima)
            if (!ratesByExactMatch.has(contractCode)) {
              ratesByExactMatch.set(contractCode, []);
            }
            ratesByExactMatch.get(contractCode)!.push(rate);

            // Match esatto case-insensitive
            if (!ratesByContractCode.has(contractCode)) {
              ratesByContractCode.set(contractCode, []);
            }
            ratesByContractCode.get(contractCode)!.push(rate);

            // Match normalizzato (lowercase, senza spazi, senza trattini, senza underscore)
            const normalized = contractCode
              .toLowerCase()
              .trim()
              .replace(/\s+/g, "")
              .replace(/-/g, "")
              .replace(/_/g, "")
              .replace(/---/g, "") // Rimuovi anche tripli trattini
              .replace(/--/g, ""); // Rimuovi doppi trattini
            if (!ratesByNormalizedCode.has(normalized)) {
              ratesByNormalizedCode.set(normalized, []);
            }
            ratesByNormalizedCode.get(normalized)!.push(rate);

            // ✨ NUOVO: Match per parti chiave (come nella sincronizzazione listini)
            // Estrai parti significative dal contractCode (es. "postedeliverybusiness-SDA---Express---H24+" -> ["sda", "express", "h24"])
            const keyParts = contractCode
              .toLowerCase()
              .split(/[-_\s]+/)
              .filter(
                (p: string) =>
                  p.length > 2 &&
                  ![
                    "poste",
                    "gls",
                    "brt",
                    "sda",
                    "ups",
                    "dhl",
                    "postedeliverybusiness",
                    "posteitaliane",
                  ].includes(p)
              )
              .sort()
              .join("-");
            if (keyParts) {
              if (!ratesByKeyParts.has(keyParts)) {
                ratesByKeyParts.set(keyParts, []);
              }
              ratesByKeyParts.get(keyParts)!.push(rate);
            }
          }
        });

        // ✨ DEBUG: Log dettagliato tutti i rates ricevuti
        console.log(
          "🔍 [QUOTE COMPARATOR] ========================================"
        );
        console.log(
          "🔍 [QUOTE COMPARATOR] Rates ricevuti dall'API:",
          result.rates.length
        );
        console.log(
          "🔍 [QUOTE COMPARATOR] TUTTI i rates ricevuti (RAW):",
          result.rates.map((r: any) => ({
            carrierCode: r.carrierCode,
            contractCode: r.contractCode,
            total_price: r.total_price,
          }))
        );
        console.log(
          "🔍 [QUOTE COMPARATOR] Contratti configurati nel DB:",
          couriers.length
        );
        console.log(
          "🔍 [QUOTE COMPARATOR] TUTTI i contratti configurati (RAW):",
          couriers.map((c) => ({
            displayName: c.displayName,
            courierName: c.courierName,
            contractCode: c.contractCode,
          }))
        );
        console.log(
          "🔍 [QUOTE COMPARATOR] ========================================"
        );

        // ✨ DEBUG: Log dettagliato per troubleshooting
        console.log(
          "🔍 [QUOTE COMPARATOR] ========================================"
        );
        console.log(
          "🔍 [QUOTE COMPARATOR] Rates ricevuti:",
          result.rates.length
        );
        console.log("🔍 [QUOTE COMPARATOR] 📊 TUTTI I RATES RAW DALL'API:");
        console.table(
          result.rates.map((r: any) => ({
            carrierCode: r.carrierCode,
            contractCode: r.contractCode,
            total_price: r.total_price,
          }))
        );
        // Log separato per carrierCode unici
        const uniqueCarriers = [
          ...new Set(result.rates.map((r: any) => r.carrierCode)),
        ];
        console.log(
          "🔍 [QUOTE COMPARATOR] Carrier codes UNICI nei rates:",
          uniqueCarriers
        );
        console.log(
          "🔍 [QUOTE COMPARATOR] Contratti configurati:",
          couriers.map((c) => ({
            displayName: c.displayName,
            courierName: c.courierName,
            contractCode: c.contractCode,
          }))
        );
        console.log(
          "🔍 [QUOTE COMPARATOR] ========================================"
        );

        // ✨ FILTRO DESTINAZIONE: Escludi contratti internazionali se destinazione è Italia
        // ⚠️ FIX REGRESSIONE: "GLS Europa" non deve apparire per destinazioni italiane
        // Verifica se destinazione è Italia: CAP italiani sono 5 cifre (00000-99999)
        // Province italiane sono 2 lettere maiuscole (es. SA, RM, MI)
        const isItalianDestination =
          zip &&
          /^[0-9]{5}$/.test(zip) &&
          province &&
          /^[A-Z]{2}$/.test(province) &&
          province !== "IT";
        const internationalKeywords = [
          "europa",
          "europe",
          "international",
          "internazionale",
          "worldwide",
          "mondiale",
          "eu-",
        ];

        // Filtra rates per escludere contratti internazionali se destinazione è Italia
        const filteredRates = result.rates.filter((rate: any) => {
          if (isItalianDestination) {
            const rateCode = (rate.contractCode || "").toLowerCase();
            // Escludi se contiene keyword internazionali
            if (
              internationalKeywords.some((keyword) =>
                rateCode.includes(keyword)
              )
            ) {
              console.warn(
                `⚠️ [QUOTE COMPARATOR] Escluso rate internazionale per destinazione italiana: ${rate.contractCode}`
              );
              return false;
            }
          }
          return true;
        });

        // ✨ MAPPING: Per ogni contratto configurato, verifica se ha rates nella risposta
        const mappedQuotes = new Map<string, QuoteResult>();
        couriers.forEach((courier) => {
          const key = `${courier.displayName}::${
            courier.contractCode || "default"
          }`;
          const contractCode = courier.contractCode || "default";

          // ⚠️ FIX: Escludi contratti internazionali se destinazione è Italia
          if (isItalianDestination) {
            const configCodeLower = contractCode.toLowerCase();
            if (
              internationalKeywords.some((keyword) =>
                configCodeLower.includes(keyword)
              )
            ) {
              console.warn(
                `⚠️ [QUOTE COMPARATOR] Escluso contratto configurato internazionale per destinazione italiana: ${contractCode}`
              );
              return; // Salta questo contratto
            }
          }

          // ⚠️ FIX BUG GRAVE: Match RIGOROSO per contractCode - OGNI contractCode è UNIVOCO
          // Ogni reseller ha contractCode univoco, anche per stesso corriere
          // NO match per prefisso generico - solo match esatto o molto simile

          // ✨ FIX CRITICO: Filtra rates per corriere PRIMA di cercare match
          // ⚠️ IMPORTANTE: Filtra solo rates del corriere configurato, non tutti i rates
          const ratesForCourier = filteredRates.filter((rate: any) => {
            const rateCarrier = (rate.carrierCode || "").toLowerCase().trim();
            const configCourier = courier.courierName.toLowerCase().trim();
            // Match esatto o parziale (es. "postedeliverybusiness" matcha "PosteDeliveryBusiness")
            return (
              rateCarrier === configCourier ||
              rateCarrier.includes(configCourier) ||
              configCourier.includes(rateCarrier)
            );
          });

          // 1. Prova match esatto case-sensitive (priorità massima) - SOLO nei rates del corriere
          const exactMatchRates = ratesByExactMatch.get(contractCode) || [];
          let ratesForContract = exactMatchRates.filter((r: any) => {
            const rateCarrier = (r.carrierCode || "").toLowerCase().trim();
            const configCourier = courier.courierName.toLowerCase().trim();
            return (
              rateCarrier === configCourier ||
              rateCarrier.includes(configCourier) ||
              configCourier.includes(rateCarrier)
            );
          });

          // 2. Se non trovato, prova match esatto case-insensitive - SOLO nei rates del corriere
          if (ratesForContract.length === 0) {
            const caseInsensitiveRates =
              ratesByContractCode.get(contractCode.toLowerCase()) || [];
            ratesForContract = caseInsensitiveRates.filter((r: any) => {
              const rateCarrier = (r.carrierCode || "").toLowerCase().trim();
              const configCourier = courier.courierName.toLowerCase().trim();
              return (
                rateCarrier === configCourier ||
                rateCarrier.includes(configCourier) ||
                configCourier.includes(rateCarrier)
              );
            });
          }

          // 3. Se non trovato, prova match normalizzato (senza spazi, trattini, underscore, doppi/tripli trattini)
          // ✨ STESSA LOGICA DELLA SINCRONIZZAZIONE LISTINI: normalizza completamente per gestire variazioni formato
          if (ratesForContract.length === 0) {
            const normalized = contractCode
              .toLowerCase()
              .trim()
              .replace(/\s+/g, "")
              .replace(/-/g, "")
              .replace(/_/g, "")
              .replace(/---/g, "") // Rimuovi tripli trattini
              .replace(/--/g, ""); // Rimuovi doppi trattini
            const normalizedRates = ratesByNormalizedCode.get(normalized) || [];
            ratesForContract = normalizedRates.filter((r: any) => {
              const rateCarrier = (r.carrierCode || "").toLowerCase().trim();
              const configCourier = courier.courierName.toLowerCase().trim();
              return (
                rateCarrier === configCourier ||
                rateCarrier.includes(configCourier) ||
                configCourier.includes(rateCarrier)
              );
            });
          }

          // 3.5. ✨ NUOVO: Match per parti chiave (come nella sincronizzazione listini)
          // Estrai parti significative dal contractCode configurato e matcha con quelle nei rates
          if (ratesForContract.length === 0) {
            const configKeyParts = contractCode
              .toLowerCase()
              .split(/[-_\s]+/)
              .filter(
                (p: string) =>
                  p.length > 2 &&
                  ![
                    "poste",
                    "gls",
                    "brt",
                    "sda",
                    "ups",
                    "dhl",
                    "postedeliverybusiness",
                    "posteitaliane",
                    "interno",
                  ].includes(p)
              )
              .sort()
              .join("-");

            if (configKeyParts) {
              // Cerca nei rates del corriere per parti chiave
              ratesForContract = ratesForCourier.filter((rate: any) => {
                const rateCode = (rate.contractCode || "").toLowerCase();
                const rateKeyParts = rateCode
                  .split(/[-_\s]+/)
                  .filter(
                    (p: string) =>
                      p.length > 2 &&
                      ![
                        "poste",
                        "gls",
                        "brt",
                        "sda",
                        "ups",
                        "dhl",
                        "postedeliverybusiness",
                        "posteitaliane",
                        "interno",
                      ].includes(p)
                  )
                  .sort()
                  .join("-");

                return rateKeyParts === configKeyParts;
              });
            }
          }

          // 4. Match parziale INTELLIGENTE: matcha parti specifiche del contractCode
          // ⚠️ IMPORTANTE: Match per PARTI SPECIFICHE, non per prefisso generico
          // ✨ FIX: Usa ratesForCourier invece di filteredRates per evitare match con altri corrieri
          if (ratesForContract.length === 0) {
            ratesForContract = ratesForCourier.filter((rate: any) => {
              const rateCode = (rate.contractCode || "").toLowerCase().trim();
              const configCode = contractCode.toLowerCase().trim();
              const rateCarrier = (rate.carrierCode || "").toLowerCase();
              const configCourier = courier.courierName.toLowerCase();

              // ⚠️ ANTI-BUG: Verifica che il corriere corrisponda
              if (
                rateCarrier !== configCourier &&
                !rateCarrier.includes(configCourier) &&
                !configCourier.includes(rateCarrier)
              ) {
                return false;
              }

              // ⚠️ ANTI-BUG: NO match se configCode è solo un prefisso generico
              const genericPrefixes = [
                "poste",
                "gls",
                "brt",
                "sda",
                "ups",
                "dhl",
                "postedeliverybusiness",
                "posteitaliane",
              ];
              if (
                genericPrefixes.includes(configCode) ||
                configCode.length < 5
              ) {
                return false;
              }

              // Estrai parti specifiche del contractCode configurato (escludi prefissi generici)
              // ✨ FIX: Accetta anche parti di 2 caratteri (es. "PD", "BA", "4") e gestisci variazioni formato
              const configParts = configCode
                .split(/[-_\s]+/)
                .filter(
                  (p: string) =>
                    p.length > 1 && !genericPrefixes.includes(p.toLowerCase())
                );

              // Se non ci sono parti specifiche, non matchare
              if (configParts.length === 0) {
                return false;
              }

              // ⚠️ MATCH INTELLIGENTE: Verifica che ALMENO UNA parte specifica sia presente nel rateCode
              // Es: "postedeliverybusiness-PDB-4" -> parti: ["pdb", "4"]
              // Deve matchare rateCode che contiene "pdb" O "4" (più permissivo)
              // Oppure: "postedeliverybusiness-Solution-and-Shipment" -> parti: ["solution", "and", "shipment"]
              // Deve matchare rateCode che contiene almeno una di queste parti
              const matchingParts = configParts.filter((part) =>
                rateCode.includes(part.toLowerCase())
              );

              // Match se ALMENO UNA parte specifica è presente (più permissivo per gestire variazioni formato)
              if (matchingParts.length > 0) {
                // Verifica anche che non sia un match troppo generico
                // Se configCode contiene parti molto specifiche (es. "pdb", "solution"), richiedi match di quelle
                const specificParts = configParts.filter(
                  (p) =>
                    p.length >= 2 &&
                    !["and", "the", "for", "with", "of"].includes(
                      p.toLowerCase()
                    )
                );
                if (specificParts.length > 0) {
                  // Almeno una parte specifica deve matchare
                  return specificParts.some((part) =>
                    rateCode.includes(part.toLowerCase())
                  );
                }
                return true;
              }

              return false;
            });

            // ⚠️ ANTI-BUG: Se ci sono più rates, usa solo quello con più parti matchate
            if (ratesForContract.length > 1) {
              ratesForContract = ratesForContract.sort((a, b) => {
                const aCode = (a.contractCode || "").toLowerCase();
                const bCode = (b.contractCode || "").toLowerCase();
                const configCodeLower = contractCode.toLowerCase();
                const configParts = configCodeLower
                  .split(/[-_\s]/)
                  .filter((p: string) => p.length > 2);

                const aMatches = configParts.filter((p: string) =>
                  aCode.includes(p)
                ).length;
                const bMatches = configParts.filter((p: string) =>
                  bCode.includes(p)
                ).length;

                // Ordina per numero di parti matchate (decrescente)
                return bMatches - aMatches;
              });

              // Prendi solo il migliore match
              ratesForContract = [ratesForContract[0]];
            }
          }

          // 5. ❌ FALLBACK COMPLETAMENTE DISABILITATO
          // Ogni contractCode deve avere il suo rate specifico, altrimenti non mostrarlo
          // NO fallback per evitare bug multi-contratto

          // ✨ DEBUG: Log matching per questo contratto
          if (ratesForContract.length > 0) {
            console.log(
              `✅ [QUOTE COMPARATOR] Match trovato per ${courier.displayName} (${contractCode}):`,
              ratesForContract.map(
                (r: any) =>
                  `${r.carrierCode}::${r.contractCode} (€${r.total_price})`
              )
            );
          } else {
            console.warn(
              `⚠️ [QUOTE COMPARATOR] NESSUN match per ${courier.displayName} (${contractCode})`
            );
            console.warn(
              `   📋 ContractCode configurato nel DB: "${contractCode}"`
            );
            console.warn(
              `   📋 ContractCode normalizzato: "${contractCode
                .toLowerCase()
                .trim()
                .replace(/\s+/g, "")
                .replace(/-/g, "")
                .replace(/_/g, "")
                .replace(/---/g, "")
                .replace(/--/g, "")}"`
            );
            console.warn(
              `   📋 ContractCode keyParts: "${contractCode
                .toLowerCase()
                .split(/[-_\s]+/)
                .filter(
                  (p: string) =>
                    p.length > 2 &&
                    ![
                      "poste",
                      "gls",
                      "brt",
                      "sda",
                      "ups",
                      "dhl",
                      "postedeliverybusiness",
                      "posteitaliane",
                      "interno",
                    ].includes(p)
                )
                .sort()
                .join("-")}"`
            );
            console.warn(
              `   🔍 Rates disponibili per questo corriere (${courier.courierName}):`,
              ratesForCourier.length
            );
            if (ratesForCourier.length > 0) {
              console.warn(`   📊 Dettagli rates:`);
              ratesForCourier.forEach((r: any, index: number) => {
                console.warn(`      Rate ${index + 1}:`, {
                  carrierCode: r.carrierCode,
                  contractCode: r.contractCode || "(vuoto)",
                  contractCode_normalized: (r.contractCode || "")
                    .toLowerCase()
                    .trim()
                    .replace(/\s+/g, "")
                    .replace(/-/g, "")
                    .replace(/_/g, "")
                    .replace(/---/g, "")
                    .replace(/--/g, ""),
                  contractCode_keyParts: (r.contractCode || "")
                    .toLowerCase()
                    .split(/[-_\s]+/)
                    .filter(
                      (p: string) =>
                        p.length > 2 &&
                        ![
                          "poste",
                          "gls",
                          "brt",
                          "sda",
                          "ups",
                          "dhl",
                          "postedeliverybusiness",
                          "posteitaliane",
                        ].includes(p)
                    )
                    .sort()
                    .join("-"),
                  total_price: r.total_price,
                });
              });
            }
            // ✨ DEBUG: Prova tutti i livelli di matching per capire perché non matcha
            const configCodeLower = contractCode.toLowerCase().trim();
            const configNormalized = configCodeLower
              .replace(/\s+/g, "")
              .replace(/-/g, "")
              .replace(/_/g, "")
              .replace(/---/g, "")
              .replace(/--/g, "");
            const configKeyParts = configCodeLower
              .split(/[-_\s]+/)
              .filter(
                (p: string) =>
                  p.length > 2 &&
                  ![
                    "poste",
                    "gls",
                    "brt",
                    "sda",
                    "ups",
                    "dhl",
                    "postedeliverybusiness",
                    "posteitaliane",
                    "interno",
                  ].includes(p)
              )
              .sort()
              .join("-");
            console.warn(
              `   🔍 Tentativo match esatto: "${contractCode}" in rates?`,
              ratesForCourier.some((r: any) => r.contractCode === contractCode)
            );
            console.warn(
              `   🔍 Tentativo match case-insensitive: "${configCodeLower}" in rates?`,
              ratesForCourier.some(
                (r: any) =>
                  (r.contractCode || "").toLowerCase() === configCodeLower
              )
            );
            console.warn(
              `   🔍 Tentativo match normalizzato: "${configNormalized}" in rates?`,
              ratesForCourier.some((r: any) => {
                const rateNormalized = (r.contractCode || "")
                  .toLowerCase()
                  .trim()
                  .replace(/\s+/g, "")
                  .replace(/-/g, "")
                  .replace(/_/g, "")
                  .replace(/---/g, "")
                  .replace(/--/g, "");
                return rateNormalized === configNormalized;
              })
            );
            console.warn(
              `   🔍 Tentativo match keyParts: "${configKeyParts}" in rates?`,
              ratesForCourier.some((r: any) => {
                const rateKeyParts = (r.contractCode || "")
                  .toLowerCase()
                  .split(/[-_\s]+/)
                  .filter(
                    (p: string) =>
                      p.length > 2 &&
                      ![
                        "poste",
                        "gls",
                        "brt",
                        "sda",
                        "ups",
                        "dhl",
                        "postedeliverybusiness",
                        "posteitaliane",
                      ].includes(p)
                  )
                  .sort()
                  .join("-");
                return rateKeyParts === configKeyParts && rateKeyParts !== "";
              })
            );
          }

          if (ratesForContract.length > 0) {
            // ✨ Contratto ha rates: mostra
            mappedQuotes.set(key, {
              courier: courier.displayName,
              courierName: courier.courierName,
              contractCode: contractCode,
              success: true,
              rates: ratesForContract,
              cached: result?.details?.cached || false,
              cacheAge: result?.details?.cacheAge,
              loading: false,
            });

            // Notifica callback
            if (onQuoteReceived) {
              onQuoteReceived(courier.displayName, contractCode, {
                success: true,
                rates: ratesForContract,
                cached: result?.details?.cached,
                cacheAge: result?.details?.cacheAge,
              });
            }
          } else {
            // ⚠️ DEBUG: Contratto configurato ma senza rates dall'API
            // L'API DOVREBBE restituire rates per tutti i contratti configurati
            // Se non li trova, il problema è nel matching, non nell'API
            console.error(
              `❌ [QUOTE COMPARATOR] ERRORE MATCHING: Contratto ${courier.displayName} (${contractCode}) configurato nel DB ma NON trovato nei rates API!`
            );
            console.error(
              `   - CourierName configurato: ${courier.courierName}`
            );
            console.error(`   - ContractCode configurato: ${contractCode}`);
            console.error(
              `   - Rates disponibili per questo corriere:`,
              ratesForCourier.map(
                (r: any) => `${r.carrierCode}::${r.contractCode}`
              )
            );
            console.error(
              `   - TUTTI i rates ricevuti dall'API:`,
              result.rates.map(
                (r: any) => `${r.carrierCode}::${r.contractCode}`
              )
            );
          }
        });

        console.log(
          "✅ [QUOTE COMPARATOR] Contratti mappati con successo:",
          mappedQuotes.size
        );

        // ⚠️ RIMOSSO FALLBACK: L'API Spedisci.Online restituisce rates per tutti i contratti configurati
        // Se un contratto non viene trovato, il problema è nel matching, non nell'API

        setQuotes(mappedQuotes);
        setCompletedCount(couriers.length); // Tutti completati in una volta
        setIsCalculating(false);
        isRequestingRef.current = false;
      } catch (error: any) {
        // Errore nella chiamata: aggiorna tutti i contratti come errore
        setQuotes((prev) => {
          const next = new Map(prev);
          Array.from(next.keys()).forEach((key) => {
            const existing = next.get(key);
            if (existing) {
              next.set(key, {
                ...existing,
                success: false,
                error: error.message || "Errore sconosciuto",
                loading: false,
              });
            }
          });
          return next;
        });
        setCompletedCount(couriers.length);
        setIsCalculating(false);
        isRequestingRef.current = false;
      }
    };

    fetchAllQuotes();
  }, [
    isDataComplete,
    couriers,
    weight,
    zip,
    province,
    city,
    services,
    insuranceValue,
    codValue,
    dimensions,
    onQuoteReceived,
  ]);

  // Filtra solo contratti con risultati validi e ordina per prezzo (crescente)
  const validQuotes = useMemo(() => {
    const valid = Array.from(quotes.values()).filter(
      (quote) => quote.success && quote.rates && quote.rates.length > 0
    );

    // Ordina per prezzo totale (crescente) - il più economico prima
    return valid.sort((a, b) => {
      const priceA = a.rates?.[0]
        ? parseFloat(a.rates[0].total_price || "0")
        : Infinity;
      const priceB = b.rates?.[0]
        ? parseFloat(b.rates[0].total_price || "0")
        : Infinity;
      return priceA - priceB;
    });
  }, [quotes]);

  // Progresso calcolo
  const progressPercent =
    totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (!isDataComplete) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-medium">
            Completa tutti i campi (zona geografica, peso, misure) per attivare
            il preventivatore intelligente
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {/* Header con switch vista e progresso */}
      <div className="bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 p-5 mb-4 w-full shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-2xl font-bold text-gray-900">
                Preventivatore Intelligente
              </h3>
              {validQuotes.length > 0 && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                  {validQuotes.length} disponibili
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">
              {isCalculating
                ? "Calcolo preventivi in corso..."
                : validQuotes.length > 0
                ? `${validQuotes.length} di ${couriers.length} contratti configurati supportano questa destinazione`
                : "Nessun contratto disponibile per questa destinazione"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Progresso globale */}
            {isCalculating && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#FF9500]" />
                <div className="hidden sm:flex flex-col">
                  <span className="text-xs font-medium text-gray-700">
                    {completedCount}/{totalCount}
                  </span>
                  <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#FF9500] transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Risultati */}
      {validQuotes.length === 0 && !isCalculating && (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-lg p-8 text-center">
          <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-700 font-semibold text-lg mb-2">
            Nessun contratto disponibile
          </p>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Nessuno dei {couriers.length} contratti configurati supporta questa
            destinazione con i parametri inseriti. Verifica che i dati
            (destinazione, peso, dimensioni) siano corretti.
          </p>
        </div>
      )}

      {/* Vista Tabella - Ottimizzata con selezione corriere + servizi accessori */}
      {validQuotes.length > 0 && (
        <div className="space-y-4">
          {/* Tabella preventivi base */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full divide-y divide-gray-200 table-auto">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Corriere
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Costo Fornitore
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Prezzo Base
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {validQuotes.map((quote, index) => {
                  const quoteKey = `${quote.courierName || quote.courier}::${
                    quote.contractCode
                  }`;
                  const isSelected = selectedCourierKey === quoteKey;

                  return (
                    <QuoteTableRow
                      key={quoteKey}
                      quote={quote}
                      isSelected={isSelected}
                      onSelect={() => {
                        console.log(
                          "🖱️ [QUOTE COMPARATOR] Selezione corriere:",
                          {
                            courier: quote.courier,
                            courierName: quote.courierName,
                            contractCode: quote.contractCode,
                          }
                        );

                        // Toggle selezione corriere
                        if (isSelected) {
                          setSelectedCourierKey(null);
                          setSelectedAccessoryService(null);
                          setShowAccessoryDropdown(false);
                        } else {
                          setSelectedCourierKey(quoteKey);
                          setSelectedAccessoryService(null);
                          setShowAccessoryDropdown(true);
                        }
                      }}
                      isBest={index === 0}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ✨ PANNELLO SERVIZI ACCESSORI - Appare dopo selezione corriere */}
          {selectedCourierKey &&
            showAccessoryDropdown &&
            (() => {
              const selectedQuote = validQuotes.find(
                (q) =>
                  `${q.courierName || q.courier}::${q.contractCode}` ===
                  selectedCourierKey
              );
              if (!selectedQuote) return null;

              const courierKey = (
                selectedQuote.courierName || selectedQuote.courier
              ).toLowerCase();
              const availableServices =
                COMMON_ACCESSORY_SERVICES[courierKey] || [];
              const bestRate = selectedQuote.rates?.[0];
              const basePrice = bestRate
                ? parseFloat(bestRate.total_price || "0")
                : 0;
              const accessoryCost = selectedAccessoryService
                ? ACCESSORY_SERVICE_COSTS[selectedAccessoryService] || 0
                : 0;
              const finalPrice = basePrice + accessoryCost;

              return (
                <div className="bg-gradient-to-br from-[#FF9500]/5 to-[#FF9500]/10 border-2 border-[#FF9500] rounded-xl p-4 space-y-4">
                  {/* Header selezione */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900">
                        {selectedQuote.courier}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {selectedQuote.contractCode}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase">
                        Prezzo Base
                      </p>
                      <p className="text-lg font-bold text-gray-700">
                        €{basePrice.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Dropdown servizi accessori */}
                  {availableServices.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Servizi Accessori (opzionale)
                      </label>
                      <div className="relative">
                        <select
                          value={selectedAccessoryService || ""}
                          onChange={(e) => {
                            setSelectedAccessoryService(e.target.value || null);
                          }}
                          className="w-full px-4 py-2.5 pr-10 border-2 border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 focus:border-[#FF9500] focus:ring-2 focus:ring-[#FF9500]/20 appearance-none cursor-pointer transition-colors"
                        >
                          <option value="">Nessun servizio aggiuntivo</option>
                          {availableServices.map((service) => (
                            <option key={service} value={service}>
                              {service} (+€
                              {(ACCESSORY_SERVICE_COSTS[service] || 0).toFixed(
                                2
                              )}
                              )
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  {/* Riepilogo prezzo finale */}
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Prezzo Base</span>
                      <span className="font-medium">
                        €{basePrice.toFixed(2)}
                      </span>
                    </div>
                    {selectedAccessoryService && (
                      <div className="flex justify-between items-center mb-2 text-[#FF9500]">
                        <span className="text-sm">
                          {selectedAccessoryService}
                        </span>
                        <span className="font-medium">
                          +€{accessoryCost.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between items-center">
                      <span className="font-bold text-gray-900">Totale</span>
                      <span className="text-2xl font-bold text-[#FF9500]">
                        €{finalPrice.toFixed(2)}
                      </span>
                    </div>
                    {selectedAccessoryService && (
                      <p className="text-xs text-gray-500 mt-2 italic">
                        * Il costo del servizio accessorio è stimato. Il prezzo
                        finale sarà confermato alla creazione della spedizione.
                      </p>
                    )}
                  </div>

                  {/* Pulsante conferma */}
                  <button
                    onClick={() => {
                      console.log("✅ [QUOTE COMPARATOR] Conferma selezione:", {
                        courier:
                          selectedQuote.courierName || selectedQuote.courier,
                        contractCode: selectedQuote.contractCode,
                        accessoryService: selectedAccessoryService,
                        finalPrice,
                      });
                      onContractSelected?.(
                        selectedQuote.courierName || selectedQuote.courier,
                        selectedQuote.contractCode,
                        selectedAccessoryService || undefined
                      );
                      // Chiudi pannello dopo conferma
                      setShowAccessoryDropdown(false);
                    }}
                    className="w-full py-3 px-4 bg-[#FF9500] hover:bg-[#E88500] text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    Conferma Selezione
                  </button>
                </div>
              );
            })()}
        </div>
      )}
    </div>
  );
}

// Componente Riga Tabella - UI Enterprise-Grade
function QuoteTableRow({
  quote,
  onSelect,
  isBest = false,
  isSelected = false,
}: {
  quote: QuoteResult;
  onSelect: () => void;
  isBest?: boolean;
  isSelected?: boolean;
}) {
  const bestRate = quote.rates?.[0];
  const totalPrice = bestRate ? parseFloat(bestRate.total_price || "0") : 0;
  const supplierPrice = bestRate ? parseFloat(bestRate.weight_price || "0") : 0;
  const margin = totalPrice - supplierPrice;

  // Formatta contractCode per display
  const formatContractCode = (code: string) => {
    if (!code) return "Standard";
    return code
      .replace(/^(gls|postedeliverybusiness|brt|sda|ups|dhl)-/i, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .substring(0, 25);
  };

  return (
    <tr
      className={`transition-colors cursor-pointer ${
        isSelected
          ? "bg-[#FF9500]/10 border-l-4 border-l-[#FF9500]"
          : isBest
          ? "bg-green-50 hover:bg-green-100"
          : "hover:bg-gray-50"
      }`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(
          "🖱️ [QUOTE TABLE] Click su riga:",
          quote.courier,
          quote.contractCode
        );
        onSelect();
      }}
    >
      {/* Colonna Corriere - con contratto su due righe */}
      <td className="px-3 py-2.5">
        <div className="flex items-start gap-1.5">
          {isBest && (
            <span className="px-1 py-0.5 bg-green-500 text-white text-xs font-bold rounded flex-shrink-0 mt-0.5">
              ★
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-gray-900 text-sm leading-tight">
              {quote.courier}
            </div>
            <div
              className="text-xs text-gray-500 mt-0.5 leading-tight truncate"
              title={quote.contractCode}
            >
              {formatContractCode(quote.contractCode)}
            </div>
          </div>
        </div>
      </td>

      {/* Colonna Costo Fornitore */}
      <td className="px-3 py-2.5 text-right">
        <div className="text-sm font-medium text-gray-700">
          €{supplierPrice.toFixed(2)}
        </div>
        {margin > 0 && (
          <div className="text-xs text-green-600 mt-0.5">
            +€{margin.toFixed(2)}
          </div>
        )}
      </td>

      {/* Colonna Prezzo Vendita */}
      <td className="px-3 py-2.5 text-right">
        <span className="text-base font-bold text-[#FF9500]">
          €{totalPrice.toFixed(2)}
        </span>
        {quote.cached && (
          <div className="text-xs text-blue-600 mt-0.5 flex items-center justify-end gap-1">
            <Clock className="w-3 h-3" />
            <span>Cache</span>
          </div>
        )}
      </td>
    </tr>
  );
}
