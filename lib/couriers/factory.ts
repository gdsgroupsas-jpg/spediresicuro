/**
 * Courier Factory - Database-Backed Provider Instantiation
 *
 * Factory per istanziare provider corrieri usando configurazioni dinamiche dal database.
 * ⚠️ SOLO DATABASE: Nessun fallback a variabili d'ambiente.
 *
 * Logica:
 * 1. Recupera configurazione per utente (assigned_config_id o default)
 * 2. Istanzia provider con credenziali dalla configurazione
 * 3. Se non trovata, ritorna null (nessun fallback)
 */

import { CourierAdapter } from "@/lib/adapters/couriers/base";
import { PosteAdapter } from "@/lib/adapters/couriers/poste";
import {
  SpedisciOnlineAdapter,
  type SpedisciOnlineCredentials,
} from "@/lib/adapters/couriers/spedisci-online";
import { supabaseAdmin } from "@/lib/db/client";
import { decryptCredential, isEncrypted } from "@/lib/security/encryption";
import type { CreateShipmentInput, Shipment } from "@/types/shipments";
import crypto from "crypto";

/**
 * AUDIT FIX P1-3: Sanitizza UUID per log production-safe
 * Genera hash parziale (primi 8 caratteri) invece di UUID completo
 */
function sanitizeIdForLog(id: string | null | undefined): string {
  if (!id) return "N/A";
  return crypto
    .createHash("sha256")
    .update(String(id))
    .digest("hex")
    .substring(0, 8);
}

/**
 * AUDIT FIX P1-3: Sanitizza nome per log production-safe
 * Rimuove caratteri sensibili e limita lunghezza
 */
function sanitizeNameForLog(name: string | null | undefined): string {
  if (!name) return "N/A";
  // Rimuove caratteri speciali e limita a 20 caratteri
  return name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .substring(0, 20)
    .trim() || "N/A";
}

// Tipo per configurazione corriere dal DB
export interface CourierConfig {
  id: string;
  name: string;
  provider_id: string;
  api_key: string;
  api_secret?: string;
  base_url: string;
  contract_mapping: Record<string, string>;
  is_active: boolean;
}

/**
 * Recupera configurazione corriere per utente
 *
 * ⚠️ SOLO DATABASE: Nessun fallback a variabili d'ambiente.
 *
 * Priorità:
 * 1. Configurazione assegnata specificamente all'utente (assigned_config_id)
 * 2. Configurazione default per il provider (is_default = true)
 *
 * @param userId - ID utente
 * @param providerId - ID provider (es: 'spedisci_online')
 * @returns Configurazione o null se non trovata
 */
export async function getCourierConfigForUser(
  userId: string,
  providerId: string,
  specificConfigId?: string // Nuova opzione per forzare una config specifica
): Promise<CourierConfig | null> {
  try {
    // Normalizza provider_id per matching esatto
    const normalizedProviderId = providerId.toLowerCase().trim();

    // 0. Se specificConfigId è fornito, cerca direttamente quella configurazione
    // Questa ha la massima priorità (override manuale)
    if (specificConfigId) {
      // Recupera email del target user (serve per compat legacy created_by=email)
      const { data: targetUser } = await supabaseAdmin
        .from("users")
        .select("email")
        .eq("id", userId)
        .maybeSingle();

      const { data: specificConfig, error: specificError } = await supabaseAdmin
        .from("courier_configs")
        .select("*")
        .eq("id", specificConfigId)
        .eq("provider_id", normalizedProviderId) // Safety check: deve essere dello stesso provider
        .single();

      if (specificError) {
        // console.error(`❌ [FACTORY] Errore query specifica:`, specificError);
      }

      if (!specificError && specificConfig) {
        // 🔒 P1-1 SECURITY: supabaseAdmin bypassa RLS → validazione esplicita accesso.
        // Consentito se:
        // - config default globale (is_default=true, owner_user_id NULL)
        // - config di proprietà del target user (owner_user_id = userId)
        // - config creata dal target user (created_by = targetUser.email) [legacy/backward-compat]
        const isDefaultVisible =
          specificConfig.is_default === true && !specificConfig.owner_user_id;
        const isOwner = specificConfig.owner_user_id === userId;
        const isCreator =
          !!targetUser?.email && specificConfig.created_by === targetUser.email;

        if (!isDefaultVisible && !isOwner && !isCreator) {
          console.warn(
            `⚠️ [FACTORY] Accesso negato a configurazione specifica ${sanitizeIdForLog(specificConfigId)} per userId=${sanitizeIdForLog(userId)}`
          );
          return null;
        }

        return specificConfig as CourierConfig;
      } else {
        console.warn(
          `⚠️ [FACTORY] Configurazione specifica ${sanitizeIdForLog(specificConfigId)} non trovata o provider non corrispondente.`
        );
        // Fallback al comportamento standard se non trovata? O return null?
        // Meglio return null per essere espliciti sull'errore di richiesta
        return null;
      }
    }

    // Usa funzione SQL helper se disponibile
    const { data: configs, error } = await supabaseAdmin.rpc(
      "get_courier_config_for_user",
      {
        p_user_id: userId,
        p_provider_id: normalizedProviderId,
      }
    );

    if (error) {
      // Gestione errore RPC 42702 (ambiguous column reference)
      const isAmbiguousError =
        error.code === "42702" ||
        error.message?.includes("ambiguous") ||
        error.message?.includes('column reference "id"');
      if (isAmbiguousError) {
        console.warn(
          "⚠️ [FACTORY] Errore RPC 42702 (ambiguous id) - applica migrazione 031_fix_ambiguous_id_rpc.sql. Uso fallback query diretta."
        );
      } else {
        console.warn(
          "⚠️ [FACTORY] Errore recupero config tramite RPC, provo query diretta:",
          {
            code: error.code,
            message: error.message,
            hint: error.hint,
          }
        );
      }

      // Fallback: query diretta con stessa priorità della RPC (migration 053)
      // Priorità: 1) Config personale (owner_user_id), 2) Config assegnata, 3) Config default
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("assigned_config_id")
        .eq("id", userId)
        .single();

      // Normalizza provider_id per matching esatto (case-insensitive ma match esatto)
      const normalizedProviderId = providerId.toLowerCase().trim();

      // 🔧 FIX: Cerca prima configurazione personale (owner_user_id = userId)
      // Questa è la priorità più alta, come nella RPC migration 053
      console.log(
        `🔍 [FACTORY] Fallback query: cerco config per userId=${sanitizeIdForLog(userId)}, provider=${normalizedProviderId}`
      );

      // PRIORITÀ 1: Configurazione personale (owner_user_id = userId)
      const { data: personalConfig, error: personalError } = await supabaseAdmin
        .from("courier_configs")
        .select("*")
        .eq("provider_id", normalizedProviderId)
        .eq("is_active", true)
        .eq("owner_user_id", userId)
        .single();

      if (!personalError && personalConfig) {
        console.log(
          `✅ [FACTORY] Trovata config personale (owner_user_id match):`,
          {
            id: sanitizeIdForLog(personalConfig.id),
            name: sanitizeNameForLog(personalConfig.name),
            owner_user_id: sanitizeIdForLog(personalConfig.owner_user_id),
          }
        );
        return personalConfig as CourierConfig;
      }

      // PRIORITÀ 2: Configurazione assegnata (assigned_config_id)
      if (user?.assigned_config_id) {
        const { data: assignedConfig, error: assignedError } =
          await supabaseAdmin
            .from("courier_configs")
            .select("*")
            .eq("id", user.assigned_config_id)
            .eq("provider_id", normalizedProviderId)
            .eq("is_active", true)
            .single();

        if (!assignedError && assignedConfig) {
          console.log(
            `✅ [FACTORY] Trovata config assegnata (assigned_config_id):`,
            {
              id: sanitizeIdForLog(assignedConfig.id),
              name: sanitizeNameForLog(assignedConfig.name),
            }
          );
          return assignedConfig as CourierConfig;
        }
      }

      // PRIORITÀ 3: Configurazione default
      const { data: defaultConfig, error: defaultError } = await supabaseAdmin
        .from("courier_configs")
        .select("*")
        .eq("provider_id", normalizedProviderId)
        .eq("is_active", true)
        .eq("is_default", true)
        .single();

      if (!defaultError && defaultConfig) {
        console.log(
          `ℹ️ [FACTORY] Nessuna config personale/assegnata, uso config default:`,
          {
            id: sanitizeIdForLog(defaultConfig.id),
            name: sanitizeNameForLog(defaultConfig.name),
          }
        );
        return defaultConfig as CourierConfig;
      }

      console.error("❌ Nessuna configurazione trovata nel DB");
      console.error(`   - Provider ID cercato: "${normalizedProviderId}"`);
      console.error(`   - User ID: ${sanitizeIdForLog(userId)}`);
      console.error(
        `   - Cercate: personale (owner_user_id), assegnata (assigned_config_id), default (is_default)`
      );
      return null;
    }

    if (configs && configs.length > 0) {
      const config = configs[0] as CourierConfig;

      // Verifica che provider_id corrisponda esattamente
      if (config.provider_id?.toLowerCase() !== normalizedProviderId) {
        console.error(
          `❌ Provider ID mismatch: config ha "${config.provider_id}" ma cercato "${normalizedProviderId}"`
        );
        return null;
      }

      return config;
    }

    return null;
  } catch (error: any) {
    console.error("Errore getCourierConfigForUser:", error);
    return null;
  }
}

/**
 * Factory: Ottieni provider corriere per utente
 *
 * ⚠️ SOLO DATABASE: Nessun fallback a variabili d'ambiente.
 * Se non c'è configurazione nel DB, ritorna null.
 *
 * @param userId - ID utente
 * @param providerId - ID provider (es: 'spedisci_online', 'gls', 'brt')
 * @param shipmentData - Dati spedizione (opzionale, per validazione)
 * @returns Provider istanziato o null se non disponibile
 */
export async function getShippingProvider(
  userId: string,
  providerId: string,
  shipmentData?: Shipment | CreateShipmentInput,
  specificConfigId?: string
): Promise<CourierAdapter | null> {
  try {
    // Recupera configurazione dal DB (SOLO DB, nessun fallback)
    const config = await getCourierConfigForUser(
      userId,
      providerId,
      specificConfigId
    );

    if (!config) return null;

    // Istanzia provider dalla configurazione DB
    return instantiateProviderFromConfig(providerId, config);
  } catch (error: any) {
    console.error("❌ Errore getShippingProvider:", error);
    return null;
  }
}

/**
 * Istanzia provider da configurazione DB
 */
function instantiateProviderFromConfig(
  providerId: string,
  config: CourierConfig
): CourierAdapter | null {
  try {
    const normalizedProviderId = providerId.toLowerCase(); // Define normalizedProviderId here

    switch (normalizedProviderId) {
      case "spedisci_online":
      case "spedisci-online": {
        // Prepara contract_mapping (può essere già un oggetto o una stringa JSON)
        let contractMapping: Record<string, string> = {};
        if (config.contract_mapping) {
          if (typeof config.contract_mapping === "string") {
            try {
              contractMapping = JSON.parse(config.contract_mapping);
            } catch {
              console.warn(
                "Errore parsing contract_mapping come JSON, provo formato semplice"
              );
            }
          } else if (typeof config.contract_mapping === "object") {
            contractMapping = config.contract_mapping;
          }
        }

        // FIX: Decripta API key se criptata, poi trim
        let rawApiKey = config.api_key || "";
        if (rawApiKey && isEncrypted(rawApiKey)) {
          console.log("🔐 [FACTORY] API key è criptata, decripto...");
          rawApiKey = decryptCredential(rawApiKey);
        }
        const trimmedApiKey = rawApiKey.trim();

        // Guard: Verifica che non sia un token demo/example + min length
        const knownDemoTokens = [
          "qCL7FN2RKFQDngWb6kJ7",
          "8ZZmDdwA",
          "demo",
          "example",
          "test",
        ];
        const apiKeyLower = trimmedApiKey.toLowerCase();
        const isDemoToken = knownDemoTokens.some(
          (demo) =>
            apiKeyLower.includes(demo.toLowerCase()) ||
            trimmedApiKey.startsWith(demo)
        );

        if (isDemoToken) {
          throw new Error(
            "Spedisci.Online API key not configured correctly (using demo token). Please configure a valid API key in /dashboard/integrazioni"
          );
        }

        if (trimmedApiKey.length < 10) {
          throw new Error(
            "Spedisci.Online API key too short. Please configure a valid API key in /dashboard/integrazioni"
          );
        }

        // Genera fingerprint SHA256 della key per log production-safe
        const crypto = require("crypto");
        const keyFingerprint = trimmedApiKey
          ? crypto
              .createHash("sha256")
              .update(trimmedApiKey)
              .digest("hex")
              .substring(0, 8)
          : "N/A";

        // Log sicuro: sempre (dev + production)
        // AUDIT FIX P1-3: Sanitizza configId e configName
        console.log(`🔑 [FACTORY] Spedisci.Online config loaded:`, {
          configId: sanitizeIdForLog(config.id),
          configName: sanitizeNameForLog(config.name),
          providerId: config.provider_id,
          baseUrl: config.base_url,
          apiKeyFingerprint: keyFingerprint, // SHA256 primi 8 caratteri (production-safe)
          apiKeyLength: trimmedApiKey.length,
          // 🔍 AUDIT: Log contract_mapping per debug cambio contratti
          contractMappingKeys: Object.keys(contractMapping),
          contractMappingCount: Object.keys(contractMapping).length,
        });

        // 🔍 AUDIT: Log dettagliato contract_mapping (solo in development)
        if (process.env.NODE_ENV === "development") {
          console.log(
            `🔍 [FACTORY] Contract mapping dettaglio:`,
            contractMapping
          );
        }

        const credentials: SpedisciOnlineCredentials = {
          api_key: trimmedApiKey, // Usa la key trimmed
          api_secret: config.api_secret?.trim(),
          base_url: config.base_url,
          customer_code: contractMapping["default"] || undefined,
          contract_mapping: contractMapping, // Passa il mapping completo
        };

        return new SpedisciOnlineAdapter(credentials);
      }

      // Altri provider possono essere aggiunti qui
      case "gls":
      case "brt":
        // TODO: Implementare adapter per altri provider
        console.warn(
          `Provider ${providerId} non ancora supportato con config DB`
        );
        return null;
      case "poste":
        // Instantiate Poste adapter using DB config
        // ⚠️ IMPORTANTE: Mapping DB fields to Adapter fields
        // Il database salva come api_key/api_secret (schema standard per tutti i corrieri)
        // L'adapter Poste si aspetta client_id/client_secret
        // Mapping:
        //   api_key (DB) -> client_id (Adapter)
        //   api_secret (DB) -> client_secret (Adapter)
        //   contract_mapping['cdc'] -> cost_center_code (Adapter)

        // FIX: Decripta credenziali se criptate
        let posteApiKey = config.api_key || "";
        let posteApiSecret = config.api_secret || "";
        if (posteApiKey && isEncrypted(posteApiKey)) {
          console.log("🔐 [FACTORY] Poste API key è criptata, decripto...");
          posteApiKey = decryptCredential(posteApiKey);
        }
        if (posteApiSecret && isEncrypted(posteApiSecret)) {
          console.log("🔐 [FACTORY] Poste API secret è criptato, decripto...");
          posteApiSecret = decryptCredential(posteApiSecret);
        }

        let cdc = "CDC-DEFAULT";
        if (config.contract_mapping) {
          // Check if contract_mapping is object or string JSON
          const mapping =
            typeof config.contract_mapping === "string"
              ? JSON.parse(config.contract_mapping)
              : config.contract_mapping;

          if (mapping["cdc"]) cdc = mapping["cdc"];
        }

        const posteCreds = {
          client_id: posteApiKey.trim(),
          client_secret: posteApiSecret.trim(),
          base_url: config.base_url,
          cost_center_code: cdc,
        } as any;
        return new PosteAdapter(posteCreds);

      default:
        console.warn(`Provider sconosciuto: ${providerId}`);
        return null;
    }
  } catch (error: any) {
    console.error("Errore istanziazione provider da config:", error);
    return null;
  }
}

// ⚠️ RIMOSSO: Fallback a variabili d'ambiente
// Il sistema funziona SOLO con configurazioni dal database

/**
 * Verifica se un provider è disponibile per un utente
 *
 * @param userId - ID utente
 * @param providerId - ID provider
 * @returns true se provider disponibile
 */
export async function isProviderAvailable(
  userId: string,
  providerId: string
): Promise<boolean> {
  try {
    const provider = await getShippingProvider(userId, providerId);
    return provider !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Ottieni lista provider disponibili per un utente
 *
 * @param userId - ID utente
 * @returns Array di provider ID disponibili
 */
export async function getAvailableProviders(userId: string): Promise<string[]> {
  const providers = ["spedisci_online", "gls", "brt", "poste"];
  const available: string[] = [];

  for (const providerId of providers) {
    const isAvailable = await isProviderAvailable(userId, providerId);
    if (isAvailable) {
      available.push(providerId);
    }
  }

  return available;
}
