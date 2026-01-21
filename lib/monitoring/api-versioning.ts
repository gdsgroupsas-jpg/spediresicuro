/**
 * Sistema di Versionamento e Monitoraggio API Corrieri
 *
 * Traccia versioni API, monitora cambiamenti e gestisce compatibilità
 */

import { supabaseAdmin } from '@/lib/db/client';

export interface APIVersion {
  provider_id: string;
  version: string;
  base_url: string;
  changelog?: string;
  breaking_changes?: boolean;
  deprecated?: boolean;
  supported_until?: string;
  created_at: string;
}

export interface APIMonitor {
  provider_id: string;
  last_check: string;
  status: 'healthy' | 'degraded' | 'down';
  response_time_ms?: number;
  error_message?: string;
  api_version?: string;
}

/**
 * Registra una nuova versione API
 */
export async function registerAPIVersion(
  providerId: string,
  version: string,
  baseUrl: string,
  options?: {
    changelog?: string;
    breakingChanges?: boolean;
    deprecated?: boolean;
    supportedUntil?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from('api_versions').insert([
      {
        provider_id: providerId,
        version,
        base_url: baseUrl,
        changelog: options?.changelog,
        breaking_changes: options?.breakingChanges || false,
        deprecated: options?.deprecated || false,
        supported_until: options?.supportedUntil,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error('Errore registrazione versione API:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Errore registrazione versione API:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verifica lo stato di un'API corriere
 */
export async function checkAPIHealth(providerId: string, baseUrl: string): Promise<APIMonitor> {
  const startTime = Date.now();

  try {
    // Prova una chiamata di health check (se disponibile)
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000), // Timeout 5 secondi
    });

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      // Salva stato healthy
      await updateAPIMonitor(providerId, 'healthy', responseTime);

      return {
        provider_id: providerId,
        last_check: new Date().toISOString(),
        status: 'healthy',
        response_time_ms: responseTime,
      };
    } else {
      // API risponde ma con errore
      await updateAPIMonitor(providerId, 'degraded', responseTime, `HTTP ${response.status}`);

      return {
        provider_id: providerId,
        last_check: new Date().toISOString(),
        status: 'degraded',
        response_time_ms: responseTime,
        error_message: `HTTP ${response.status}`,
      };
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    // API non raggiungibile
    await updateAPIMonitor(providerId, 'down', responseTime, error.message);

    return {
      provider_id: providerId,
      last_check: new Date().toISOString(),
      status: 'down',
      response_time_ms: responseTime,
      error_message: error.message,
    };
  }
}

/**
 * Aggiorna stato monitoraggio API
 */
async function updateAPIMonitor(
  providerId: string,
  status: 'healthy' | 'degraded' | 'down',
  responseTime?: number,
  errorMessage?: string
): Promise<void> {
  try {
    await supabaseAdmin.from('api_monitors').upsert(
      {
        provider_id: providerId,
        last_check: new Date().toISOString(),
        status,
        response_time_ms: responseTime,
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'provider_id',
      }
    );
  } catch (error) {
    console.error('Errore aggiornamento monitor API:', error);
  }
}

/**
 * Recupera versione API corrente per un provider
 */
export async function getCurrentAPIVersion(providerId: string): Promise<APIVersion | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('api_versions')
      .select('*')
      .eq('provider_id', providerId)
      .eq('deprecated', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data as APIVersion;
  } catch (error) {
    console.error('Errore recupero versione API:', error);
    return null;
  }
}
