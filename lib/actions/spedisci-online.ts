"use server";

/**
 * Server Actions per Integrazione Spedisci.Online e Fulfillment Orchestrator
 *
 * Gestisce l'invio automatico delle spedizioni tramite orchestrator intelligente
 * per la creazione automatica delle LDV con routing ottimale.
 */

import { SpedisciOnlineAdapter } from "@/lib/adapters/couriers/spedisci-online";
import { auth } from "@/lib/auth-config";
import { getShippingProvider } from "@/lib/couriers/factory";
import { findUserByEmail } from "@/lib/database";
import { supabaseAdmin } from "@/lib/db/client";
import {
  getFulfillmentOrchestrator,
  ShipmentResult,
} from "@/lib/engine/fulfillment-orchestrator";
import { createServerActionClient } from "@/lib/supabase-server";
import type { CreateShipmentInput, Shipment } from "@/types/shipments";
import crypto from "crypto";

/**
 * Recupera credenziali spedisci.online dell'utente
 *
 * ⚠️ PRIORITÀ:
 * 1. Configurazione personale in courier_configs (created_by = user_email)
 * 2. Configurazione globale in courier_configs (is_default = true)
 * 3. user_integrations (legacy)
 * 4. Database locale (legacy)
 */
export async function getSpedisciOnlineCredentials(configId?: string) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    const userEmail = session.user.email;
    const { data: currentUser } = await supabaseAdmin
      .from("users")
      .select("id, account_type, assigned_config_id")
      .eq("email", userEmail)
      .maybeSingle();
    const currentUserId = currentUser?.id ?? null;
    const assignedConfigId = currentUser?.assigned_config_id ?? null;
    const isAdmin =
      currentUser?.account_type === "admin" ||
      currentUser?.account_type === "superadmin";

    // PRIORITÀ 1: Configurazione API Corriere (courier_configs)
    // ============================================
    const { decryptCredential, isEncrypted } = await import(
      "@/lib/security/encryption"
    );

    // 0. Se fornito configId, cerca quella specifica configurazione
    if (configId) {
      const { data: specificConfig } = await supabaseAdmin
        .from("courier_configs")
        .select("*")
        .eq("id", configId)
        .eq("provider_id", "spedisci_online")
        // .eq('created_by', userEmail) // Opzionale: se vogliamo forzare ownership
        .single();

      if (specificConfig) {
        // 🔒 P1-1 SECURITY: supabaseAdmin bypassa RLS → validazione esplicita accesso.
        // Consentito se:
        // - config default globale (is_default=true, owner_user_id NULL)
        // - config di proprietà dell'utente (owner_user_id = currentUserId)
        // - config creata dall'utente (created_by = userEmail) [legacy/backward-compat]
        // - admin/superadmin (operazioni amministrative)
        const isDefaultVisible =
          specificConfig.is_default === true && !specificConfig.owner_user_id;
        const isOwner =
          !!currentUserId && specificConfig.owner_user_id === currentUserId;
        const isCreator = specificConfig.created_by === userEmail;

        if (!isAdmin && !isDefaultVisible && !isOwner && !isCreator) {
          return {
            success: false,
            error: "Configurazione non trovata o non autorizzata",
          };
        }

        const configIdHash = crypto
          .createHash("sha256")
          .update(String(specificConfig.id))
          .digest("hex")
          .substring(0, 8);
        console.log(
          `✅ [SPEDISCI.ONLINE] Configurazione specifica trovata (id_hash=${configIdHash})`
        );

        let apiKey = specificConfig.api_key;
        let apiSecret = specificConfig.api_secret;

        if (apiKey && isEncrypted(apiKey)) apiKey = decryptCredential(apiKey);
        if (apiSecret && isEncrypted(apiSecret))
          apiSecret = decryptCredential(apiSecret);

        return {
          success: true,
          credentials: {
            api_key: apiKey,
            api_secret: apiSecret,
            base_url:
              specificConfig.base_url || "https://api.spedisci.online/api/v2",
            contract_mapping: specificConfig.contract_mapping || {},
          },
        };
      }
    }

    // 1.1. PRIORITÀ: Configurazione assegnata (assigned_config_id)
    if (assignedConfigId && currentUserId) {
      const { data: assignedConfig } = await supabaseAdmin
        .from("courier_configs")
        .select("*")
        .eq("id", assignedConfigId)
        .eq("provider_id", "spedisci_online")
        .eq("is_active", true)
        .maybeSingle();

      if (assignedConfig) {
        console.log(
          "✅ [SPEDISCI.ONLINE] Configurazione assegnata trovata (assigned_config_id)"
        );

        let apiKey = assignedConfig.api_key;
        let apiSecret = assignedConfig.api_secret;

        if (apiKey && isEncrypted(apiKey)) {
          apiKey = decryptCredential(apiKey);
        }
        if (apiSecret && isEncrypted(apiSecret)) {
          apiSecret = decryptCredential(apiSecret);
        }

        return {
          success: true,
          credentials: {
            api_key: apiKey,
            api_secret: apiSecret,
            base_url:
              assignedConfig.base_url || "https://api.spedisci.online/api/v2",
            contract_mapping: assignedConfig.contract_mapping || {},
          },
        };
      }
    }

    // 1.2. Cerca configurazione con owner_user_id = currentUserId
    if (currentUserId) {
      const { data: ownedConfig } = await supabaseAdmin
        .from("courier_configs")
        .select("*")
        .eq("provider_id", "spedisci_online")
        .eq("owner_user_id", currentUserId)
        .eq("is_active", true)
        .maybeSingle();

      if (ownedConfig) {
        console.log(
          "✅ [SPEDISCI.ONLINE] Configurazione personale trovata (owner_user_id)"
        );

        let apiKey = ownedConfig.api_key;
        let apiSecret = ownedConfig.api_secret;

        if (apiKey && isEncrypted(apiKey)) {
          apiKey = decryptCredential(apiKey);
        }
        if (apiSecret && isEncrypted(apiSecret)) {
          apiSecret = decryptCredential(apiSecret);
        }

        return {
          success: true,
          credentials: {
            api_key: apiKey,
            api_secret: apiSecret,
            base_url:
              ownedConfig.base_url || "https://api.spedisci.online/api/v2",
            contract_mapping: ownedConfig.contract_mapping || {},
          },
        };
      }
    }

    // 1.3. Cerca configurazione personale dell'utente (created_by)
    const { data: personalConfig } = await supabaseAdmin
      .from("courier_configs")
      .select("*")
      .eq("provider_id", "spedisci_online")
      .eq("created_by", userEmail)
      .eq("is_active", true)
      .maybeSingle();

    if (personalConfig) {
      console.log(
        "✅ [SPEDISCI.ONLINE] Configurazione personale trovata (created_by)"
      );

      // Decripta credenziali se necessario
      let apiKey = personalConfig.api_key;
      let apiSecret = personalConfig.api_secret;

      if (apiKey && isEncrypted(apiKey)) {
        apiKey = decryptCredential(apiKey);
      }
      if (apiSecret && isEncrypted(apiSecret)) {
        apiSecret = decryptCredential(apiSecret);
      }

      return {
        success: true,
        credentials: {
          api_key: apiKey,
          api_secret: apiSecret,
          base_url:
            personalConfig.base_url || "https://api.spedisci.online/api/v2",
          contract_mapping: personalConfig.contract_mapping || {},
        },
      };
    }

    // 1.2. Fallback: Configurazione globale
    const { data: globalConfig } = await supabaseAdmin
      .from("courier_configs")
      .select("*")
      .eq("provider_id", "spedisci_online")
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();

    if (globalConfig) {
      console.log(
        "✅ [SPEDISCI.ONLINE] Configurazione globale trovata in courier_configs"
      );

      // Decripta credenziali se necessario
      let apiKey = globalConfig.api_key;
      let apiSecret = globalConfig.api_secret;

      if (apiKey && isEncrypted(apiKey)) {
        apiKey = decryptCredential(apiKey);
      }
      if (apiSecret && isEncrypted(apiSecret)) {
        apiSecret = decryptCredential(apiSecret);
      }

      return {
        success: true,
        credentials: {
          api_key: apiKey,
          api_secret: apiSecret,
          base_url:
            globalConfig.base_url || "https://api.spedisci.online/api/v2",
          contract_mapping: globalConfig.contract_mapping || {},
        },
      };
    }

    // ============================================
    // PRIORITÀ 2: user_integrations (legacy)
    // ============================================
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      const supabase = createServerActionClient();
      const {
        data: { user: supabaseUser },
      } = await supabase.auth.getUser();

      if (supabaseUser) {
        const { data, error } = await supabase
          .from("user_integrations")
          .select("credentials")
          .eq("provider", "spedisci-online")
          .eq("is_active", true)
          .single();

        if (!error && data) {
          console.log(
            "✅ [SPEDISCI.ONLINE] Credenziali trovate in user_integrations (legacy)"
          );
          return {
            success: true,
            credentials: data.credentials,
          };
        }
      }
    }

    // ============================================
    // PRIORITÀ 3: Database locale (legacy)
    // ============================================
    const user = await findUserByEmail(userEmail);
    if (user?.integrazioni) {
      const spedisciOnlineIntegration = user.integrazioni.find(
        (i: any) =>
          i.platform === "spedisci_online" || i.platform === "spedisci-online"
      );
      if (spedisciOnlineIntegration) {
        console.log(
          "✅ [SPEDISCI.ONLINE] Credenziali trovate in database locale (legacy)"
        );
        return {
          success: true,
          credentials: spedisciOnlineIntegration.credentials,
        };
      }
    }

    return {
      success: false,
      error:
        "Credenziali spedisci.online non configurate. Configura le credenziali in /dashboard/integrazioni",
    };
  } catch (error) {
    console.error("Errore recupero credenziali spedisci.online:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
    };
  }
}

/**
 * Crea spedizione tramite Fulfillment Orchestrator
 *
 * Usa routing intelligente:
 * 1. Adapter diretto (se disponibile) - massima velocità
 * 2. Broker spedisci.online (se configurato) - copertura completa
 * 3. Fallback CSV (se tutto fallisce) - zero perdita ordini
 */
export async function createShipmentWithOrchestrator(
  shipmentData: Shipment | CreateShipmentInput | any,
  courierCode: string
): Promise<ShipmentResult> {
  console.log("🚀 [ORCHESTRATOR] createShipmentWithOrchestrator chiamato", {
    courierCode,
    hasShipmentData: !!shipmentData,
  });

  try {
    // 1. Verifica autenticazione
    const session = await auth();

    if (!session?.user?.email) {
      console.warn("⚠️ [ORCHESTRATOR] Non autenticato");
      return {
        success: false,
        tracking_number: "",
        carrier: courierCode,
        method: "fallback",
        error: "Non autenticato",
      };
    }

    console.log("✅ [ORCHESTRATOR] Utente autenticato:", session.user.email);

    // 2. Ottieni user_id (prova prima in users, poi user_profiles, poi auth.users)
    let userId: string | null = null;

    // Prova prima nella tabella users
    const { data: userFromUsers } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", session.user.email)
      .single();

    if (userFromUsers?.id) {
      userId = userFromUsers.id;
    } else {
      // Prova a recuperare da user_profiles o auth.users
      try {
        const { getSupabaseUserIdFromEmail } = await import("@/lib/database");
        // FIX: Passa NextAuth user.id come fallback
        userId = await getSupabaseUserIdFromEmail(
          session.user.email,
          session.user.id
        );
      } catch (error) {
        console.warn("⚠️ Impossibile recuperare user_id:", error);
        // FALLBACK: Usa NextAuth ID se disponibile
        if (session.user.id) {
          userId = session.user.id;
          console.log(
            `ℹ️ [ORCHESTRATOR] Usando NextAuth user.id come fallback: ${(
              userId || ""
            ).substring(0, 8)}...`
          );
        }
      }
    }

    // 3. Ottieni orchestrator
    const orchestrator = getFulfillmentOrchestrator();

    // 4. SEMPRE registra broker adapter (Spedisci.Online) se configurato nel database
    // Questo permette di usare Spedisci.Online come broker per qualsiasi corriere (GLS, SDA, ecc.)
    // Se userId è null, prova comunque a recuperare configurazione default
    if (userId) {
      try {
        const provider = await getShippingProvider(
          userId,
          "spedisci_online",
          shipmentData
        );
        if (provider && provider instanceof SpedisciOnlineAdapter) {
          orchestrator.registerBrokerAdapter(provider);
          console.log(
            "✅ [BROKER] Broker adapter (Spedisci.Online) registrato tramite configurazione DB"
          );
          console.log(
            '✅ [BROKER] Questo adapter verrà usato quando l\'utente seleziona corrieri come "Poste Italiane" (fallback broker)'
          );
        } else {
          console.warn(
            "⚠️ Spedisci.Online non configurato per questo utente. Provo configurazione default..."
          );
          // Continua - proveremo a recuperare config default
        }
      } catch (error) {
        console.warn("⚠️ Errore recupero configurazione per utente:", error);
        // Continua - proveremo config default
      }
    }

    // Se non abbiamo ancora registrato il broker, prova a recuperare configurazione default (admin)
    // Verifica se il broker è registrato controllando internamente
    let brokerRegistered = false;
    try {
      // Verifica se il broker è già registrato (usando reflection)
      const brokerAdapter = (orchestrator as any).brokerAdapter;
      brokerRegistered = !!brokerAdapter;
    } catch {
      brokerRegistered = false;
    }

    if (!brokerRegistered) {
      try {
        // FIX: Usa getCourierConfigForUser con userId null per ottenere config default
        // Questo garantisce che la priorità sia rispettata (default, non prima config attiva)
        // Se userId è null, la funzione RPC restituirà la config default
        const { getCourierConfigForUser } = await import(
          "@/lib/couriers/factory"
        );

        // Prova prima con un userId dummy per vedere se c'è una default
        // Se non c'è userId, usa query diretta ma SOLO per default
        let defaultConfig = null;

        // Prova a recuperare configurazione default (is_default = true) - PRIORITÀ ASSOLUTA
        const { data: defaultConfigData } = await supabaseAdmin
          .from("courier_configs")
          .select("*")
          .eq("provider_id", "spedisci_online") // Normalizzato
          .eq("is_active", true)
          .eq("is_default", true)
          .single();

        if (defaultConfigData) {
          defaultConfig = defaultConfigData;
        } else {
          // HARD FAIL: Se non c'è default, NON prendere la prima config attiva
          // Questo potrebbe essere una config con token vecchio
          console.error(
            "❌ [BROKER] Nessuna configurazione DEFAULT trovata per spedisci_online"
          );
          console.error(
            "❌ [BROKER] Configura una config con is_default=true in /dashboard/admin/configurations"
          );
          throw new Error(
            "Spedisci.Online: Nessuna configurazione default trovata. Configura una config default in /dashboard/admin/configurations"
          );
        }

        if (defaultConfig) {
          // Decripta credenziali se necessario
          const { decryptCredential, isEncrypted } = await import(
            "@/lib/security/encryption"
          );

          let api_key = defaultConfig.api_key;
          let api_secret = defaultConfig.api_secret;

          // Decripta se necessario
          if (api_key && isEncrypted(api_key)) {
            try {
              api_key = decryptCredential(api_key).trim(); // FIX: trim dopo decrypt
            } catch (decryptError: any) {
              const errorMsg =
                decryptError?.message || "Unknown decryption error";
              // Gestione ENCRYPTION_KEY rotation: errore gestibile
              if (errorMsg.includes("CREDENTIAL_DECRYPT_FAILED")) {
                console.error(
                  "❌ [BROKER] Errore decriptazione api_key (ENCRYPTION_KEY rotation):",
                  errorMsg
                );
                throw new Error(
                  "CREDENTIAL_DECRYPT_FAILED: Impossibile decriptare credenziali API. La chiave di criptazione potrebbe essere stata cambiata. Ricontrolla le credenziali dell'integrazione Spedisci.Online in /dashboard/admin/configurations"
                );
              }
              console.error("❌ Errore decriptazione api_key:", errorMsg);
              throw new Error("Impossibile decriptare credenziali");
            }
          } else if (api_key) {
            api_key = api_key.trim(); // FIX: trim anche se non criptata
          }

          if (api_secret && isEncrypted(api_secret)) {
            try {
              api_secret = decryptCredential(api_secret).trim(); // FIX: trim dopo decrypt
            } catch (decryptError: any) {
              const errorMsg =
                decryptError?.message || "Unknown decryption error";
              // api_secret è opzionale, ma logga l'errore
              if (errorMsg.includes("CREDENTIAL_DECRYPT_FAILED")) {
                console.warn(
                  "⚠️ [BROKER] Errore decriptazione api_secret (ENCRYPTION_KEY rotation) - continuo senza secret"
                );
              } else {
                console.warn(
                  "⚠️ [BROKER] Errore decriptazione api_secret - continuo senza secret:",
                  errorMsg
                );
              }
              // api_secret è opzionale, continua senza
            }
          } else if (api_secret) {
            api_secret = api_secret.trim(); // FIX: trim anche se non criptata
          }

          // Prepara contract_mapping
          let contractMapping: Record<string, string> = {};
          if (defaultConfig.contract_mapping) {
            if (typeof defaultConfig.contract_mapping === "string") {
              try {
                contractMapping = JSON.parse(defaultConfig.contract_mapping);
              } catch {
                console.warn(
                  "⚠️ Errore parsing contract_mapping, uso come oggetto"
                );
              }
            } else if (typeof defaultConfig.contract_mapping === "object") {
              contractMapping = defaultConfig.contract_mapping;
            }
          }

          // Istanzia provider dalla configurazione
          const credentials = {
            api_key: api_key,
            api_secret: api_secret,
            base_url: defaultConfig.base_url,
            customer_code: contractMapping["default"] || undefined,
            contract_mapping: contractMapping, // Passa il mapping completo
          };

          // FIX: Trim API key dopo decrypt
          if (credentials.api_key) {
            credentials.api_key = credentials.api_key.trim();
          }

          // Guard: Verifica che non sia un token demo/example + min length
          const knownDemoTokens = [
            "qCL7FN2RKFQDngWb6kJ7",
            "8ZZmDdwA",
            "demo",
            "example",
            "test",
          ];
          const apiKeyLower = credentials.api_key?.toLowerCase() || "";
          const isDemoToken = knownDemoTokens.some(
            (demo) =>
              apiKeyLower.includes(demo.toLowerCase()) ||
              credentials.api_key?.startsWith(demo)
          );

          if (isDemoToken) {
            throw new Error(
              "Spedisci.Online API key not configured correctly (using demo token). Please configure a valid API key in /dashboard/integrazioni"
            );
          }

          if (!credentials.api_key || credentials.api_key.length < 10) {
            throw new Error(
              "Spedisci.Online API key too short. Please configure a valid API key in /dashboard/integrazioni"
            );
          }

          // Genera fingerprint SHA256 della key per log production-safe
          const crypto = require("crypto");
          const keyFingerprint = credentials.api_key
            ? crypto
                .createHash("sha256")
                .update(credentials.api_key)
                .digest("hex")
                .substring(0, 8)
            : "N/A";

          // Log production-safe: sempre (dev + production)
          console.log("🔧 [BROKER] Spedisci.Online adapter istanziato:", {
            configId: defaultConfig.id,
            configName: defaultConfig.name,
            providerId: defaultConfig.provider_id,
            baseUrl: defaultConfig.base_url,
            apiKeyFingerprint: keyFingerprint, // SHA256 primi 8 caratteri (production-safe)
            apiKeyLength: credentials.api_key?.length || 0,
            contract_mapping_count: Object.keys(
              credentials.contract_mapping || {}
            ).length,
          });

          const provider = new SpedisciOnlineAdapter(credentials);
          orchestrator.registerBrokerAdapter(provider);
          console.log(
            "✅ [BROKER] Broker adapter registrato tramite configurazione DEFAULT"
          );
          console.log(
            '✅ [BROKER] Questo adapter verrà usato quando l\'utente seleziona corrieri come "Poste Italiane" (fallback broker)'
          );
          console.log("✅ [BROKER] Config usata:", {
            configId: defaultConfig.id,
            providerId: defaultConfig.provider_id,
            baseUrl: defaultConfig.base_url,
            apiKeyFingerprint: keyFingerprint,
          });
          console.log(
            "✅ [BROKER] Contratti configurati:",
            Object.keys(credentials.contract_mapping || {})
          );
        } else {
          console.warn(
            "⚠️ Spedisci.Online non configurato (né per utente né default)."
          );
          console.warn(
            "⚠️ Configura Spedisci.Online in /dashboard/integrazioni per abilitare chiamate API reali."
          );
        }
      } catch (error: any) {
        console.warn(
          "⚠️ Impossibile registrare broker adapter (Spedisci.Online):",
          error?.message || error
        );
        console.warn(
          "⚠️ La spedizione verrà creata solo localmente (fallback CSV)."
        );
        // Non bloccare il processo - continuerà con fallback CSV
      }
    }

    // 4.5 Tentativo registrazione Adapter Diretto per il corriere richiesto
    // Mappa codici UI -> Provider ID
    const providerMap: Record<string, string> = {
      poste: "poste",
      "poste italiane": "poste",
      posteitaliane: "poste",
      brt: "brt",
      bartolini: "brt",
      gls: "gls",
      sda: "sda", // SDA è un corriere separato, non mappare a Poste
    };

    const normalizedCourier = courierCode.toLowerCase().trim();
    const providerId = providerMap[normalizedCourier] || normalizedCourier;

    console.log(`🔍 [ORCHESTRATOR] Cerco adapter diretto per ${courierCode}`);
    console.log(`   - Normalizzato: "${normalizedCourier}"`);
    console.log(`   - Provider ID: "${providerId}"`);
    console.log(`   - User ID: ${userId || "NON DISPONIBILE"}`);
    console.log(
      `   - Provider Map contiene "${normalizedCourier}": ${
        normalizedCourier in providerMap
      }`
    );

    if (userId) {
      try {
        console.log(
          `🔍 [FACTORY] Chiamo getShippingProvider(${userId}, ${providerId})...`
        );
        const directProvider = await getShippingProvider(
          userId,
          providerId,
          shipmentData
        );
        console.log(
          `🔍 [FACTORY] Risultato: ${
            directProvider ? "✅ Adapter trovato" : "❌ Adapter NON trovato"
          }`
        );
        if (directProvider) {
          // Registra con la chiave normalizzata (usata dall'orchestrator per cercare)
          orchestrator.registerDirectAdapter(normalizedCourier, directProvider);
          // Registra anche con il providerId per sicurezza (es: "poste")
          if (normalizedCourier !== providerId) {
            orchestrator.registerDirectAdapter(providerId, directProvider);
          }
          // Registra anche con il codice originale (con maiuscole) per sicurezza
          if (normalizedCourier !== courierCode.toLowerCase()) {
            orchestrator.registerDirectAdapter(
              courierCode.toLowerCase(),
              directProvider
            );
          }
          console.log(
            `✅ [ORCHESTRATOR] Adapter diretto (${providerId}) registrato con chiavi: ${normalizedCourier}, ${providerId}`
          );
        } else {
          console.log(
            `ℹ️ [ORCHESTRATOR] Nessun adapter diretto trovato per ${providerId}`
          );
        }
      } catch (error) {
        console.warn(
          `⚠️ [ORCHESTRATOR] Errore caricamento adapter diretto:`,
          error
        );
      }
    }

    // 5. Crea spedizione tramite orchestrator (routing intelligente)
    // L'orchestrator userà:
    // 1. Adapter diretto (se disponibile per il corriere)
    // 2. Broker Spedisci.Online (se registrato sopra)
    // 3. Fallback CSV (se tutto fallisce)
    console.log(
      "🎯 [ORCHESTRATOR] Chiamo orchestrator.createShipment con corriere:",
      courierCode
    );
    const result = await orchestrator.createShipment(shipmentData, courierCode);
    console.log("🎯 [ORCHESTRATOR] Risultato orchestrator:", {
      success: result.success,
      method: result.method,
      has_tracking: !!result.tracking_number,
      error: result.error,
    });

    return result;
  } catch (error) {
    console.error("Errore creazione spedizione tramite orchestrator:", error);
    return {
      success: false,
      tracking_number: "",
      carrier: courierCode,
      method: "fallback",
      error:
        error instanceof Error ? error.message : "Errore durante la creazione",
      message: "Errore durante la creazione LDV",
    };
  }
}

/**
 * @deprecated Usa createShipmentWithOrchestrator invece
 * Mantenuto per retrocompatibilità
 */
export async function sendShipmentToSpedisciOnline(shipmentData: any) {
  const result = await createShipmentWithOrchestrator(shipmentData, "GLS");

  return {
    success: result.success,
    tracking_number: result.tracking_number,
    label_url: result.label_url,
    message: result.message || "Spedizione processata",
    error: result.error,
  };
}

/**
 * Salva credenziali spedisci.online
 */
export async function saveSpedisciOnlineCredentials(credentials: {
  api_key: string;
  api_secret?: string;
  customer_code?: string;
  base_url?: string;
}) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    // Validazione base
    if (!credentials.api_key) {
      return { success: false, error: "API Key obbligatoria" };
    }

    // Prova Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      const supabase = createServerActionClient();
      const {
        data: { user: supabaseUser },
      } = await supabase.auth.getUser();

      if (supabaseUser) {
        const { error } = await supabase.from("user_integrations").upsert(
          {
            user_id: supabaseUser.id,
            provider: "spedisci-online",
            credentials: credentials,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,provider",
          }
        );

        if (!error) {
          return { success: true, message: "Credenziali salvate con successo" };
        }
      }
    }

    // Fallback: database locale
    const { findUserByEmail: findUser, updateUser } = await import(
      "@/lib/database"
    );
    const user = await findUser(session.user.email);

    if (user) {
      const integrations = user.integrazioni || [];
      const existingIndex = integrations.findIndex(
        (i: any) =>
          i.platform === "spedisci_online" || i.platform === "spedisci-online"
      );

      const integration = {
        platform: "spedisci-online",
        credentials,
        connectedAt: new Date().toISOString(),
        status: "active" as const,
      };

      if (existingIndex >= 0) {
        integrations[existingIndex] = integration;
      } else {
        integrations.push(integration);
      }

      await updateUser(user.id, { integrazioni: integrations });

      return { success: true, message: "Credenziali salvate con successo" };
    }

    return { success: false, error: "Utente non trovato" };
  } catch (error) {
    console.error("Errore salvataggio credenziali spedisci.online:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio",
    };
  }
}
