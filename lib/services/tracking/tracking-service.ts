/**
 * Tracking Service
 *
 * Handles fetching and caching tracking data from Spedisci.Online API
 * and other carrier APIs.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/db/database.types';

// Type aliases from generated database types
type TrackingEventInsert = Database['public']['Tables']['tracking_events']['Insert'];

// Types - aligned with database schema
export interface TrackingEvent {
  id?: string;
  shipment_id: string;
  tracking_number: string;
  event_date: string;
  status: string;
  status_normalized: string | null;
  location: string | null;
  description?: string | null;
  carrier?: string | null;
  provider?: string | null;
  raw_data?: Json | null;
  created_at?: string | null;
  fetched_at?: string | null;
}

export interface TrackingResponse {
  success: boolean;
  tracking_number: string;
  carrier?: string;
  current_status: string;
  current_status_normalized: string;
  last_update: string | null;
  events: TrackingEvent[];
  is_delivered: boolean;
  estimated_delivery?: string | null;
  error?: string;
}

interface SpedisciOnlineTrackingResponse {
  TrackingDettaglio: Array<{
    Data: string;
    Stato: string;
    Luogo: string;
  }>;
}

// Status normalization mapping
// IMPORTANT: Order matters - giacenza patterns checked before exception
const STATUS_MAP: Record<string, string> = {
  // Giacenza (held at depot) - MUST be before exceptions
  'in giacenza': 'in_giacenza',
  giacenza: 'in_giacenza',
  'mancata consegna': 'in_giacenza',
  'tentativo di consegna fallito': 'in_giacenza',
  'fermo deposito': 'in_giacenza',
  'in deposito': 'in_giacenza',
  'destinatario assente': 'in_giacenza',
  'non consegnabile': 'in_giacenza',

  // Delivered
  consegnata: 'delivered',
  delivered: 'delivered',
  recapitata: 'delivered',

  // In transit
  'in transito': 'in_transit',
  transit: 'in_transit',
  partita: 'in_transit',

  // Out for delivery
  'in consegna': 'out_for_delivery',
  'consegna prevista': 'out_for_delivery',

  // At destination
  'arrivata in sede': 'at_destination',

  // Exceptions
  eccezione: 'exception',
  problema: 'exception',

  // Created/Pending
  'spedizione generata': 'created',
  'in attesa di ritiro': 'pending_pickup',

  // Returned
  reso: 'returned',
  respinta: 'returned',
};

export function normalizeStatus(rawStatus: string): string {
  const lower = rawStatus.toLowerCase();

  // Check exact matches first
  for (const [key, value] of Object.entries(STATUS_MAP)) {
    if (lower.includes(key)) {
      return value;
    }
  }

  // Pattern matching - giacenza BEFORE exception
  if (
    lower.includes('giacenz') ||
    lower.includes('mancata consegna') ||
    lower.includes('fermo deposito') ||
    lower.includes('non consegnabile')
  )
    return 'in_giacenza';
  if (lower.includes('consegnat')) return 'delivered';
  if (lower.includes('transit')) return 'in_transit';
  if (lower.includes('partita') || lower.includes('partenza')) return 'in_transit';
  if (lower.includes('consegna prevista') || lower.includes('in consegna'))
    return 'out_for_delivery';
  if (lower.includes('destinatar') || lower.includes('arrivata')) return 'at_destination';
  if (lower.includes('eccezione') || lower.includes('problem') || lower.includes('assente'))
    return 'in_giacenza';
  if (lower.includes('generata') || lower.includes('registrata')) return 'created';
  if (lower.includes('ritiro')) return 'pending_pickup';
  if (lower.includes('reso') || lower.includes('return')) return 'returned';
  if (lower.includes('annullat')) return 'cancelled';

  return 'unknown';
}

function parseItalianDate(dateStr: string): Date {
  // Format: "22/09/2016 15:22" or "22/09/2016"
  const parts = dateStr.split(' ');
  const dateParts = parts[0].split('/');

  if (dateParts.length !== 3) {
    return new Date(dateStr);
  }

  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // JS months are 0-indexed
  const year = parseInt(dateParts[2], 10);

  if (parts[1]) {
    const timeParts = parts[1].split(':');
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    return new Date(year, month, day, hours, minutes);
  }

  return new Date(year, month, day);
}

// Configuration constants with env var overrides
const TRACKING_CONFIG = {
  // Cache TTL: how long before we consider cached tracking data stale (default: 30 minutes)
  CACHE_TTL_MS: parseInt(process.env.TRACKING_CACHE_TTL_MINUTES || '30', 10) * 60 * 1000,
  // Sync max age: only sync shipments with tracking data older than this (default: 1 hour)
  SYNC_MAX_AGE_MS: parseInt(process.env.TRACKING_SYNC_MAX_AGE_HOURS || '1', 10) * 60 * 60 * 1000,
  // Sync batch limit: max shipments to sync per cron run (default: 300)
  SYNC_BATCH_LIMIT: parseInt(process.env.TRACKING_SYNC_BATCH_LIMIT || '300', 10),
  // Sync delay: delay between API calls per worker (default: 200ms)
  SYNC_DELAY_MS: parseInt(process.env.TRACKING_SYNC_DELAY_MS || '200', 10),
  // Sync lookback: only sync shipments created within this period (default: 30 days)
  SYNC_LOOKBACK_DAYS: parseInt(process.env.TRACKING_SYNC_LOOKBACK_DAYS || '30', 10),
  // Concorrenza: numero di worker paralleli per sync (default: 5)
  SYNC_CONCURRENCY: parseInt(process.env.TRACKING_SYNC_CONCURRENCY || '5', 10),
  // Max retry per errori transient (default: 2)
  SYNC_MAX_RETRIES: parseInt(process.env.TRACKING_SYNC_MAX_RETRIES || '2', 10),
};

// Risultato dettagliato di un singolo sync
interface ShipmentSyncResult {
  shipmentId: string;
  trackingNumber: string;
  success: boolean;
  eventsCount: number;
  retries: number;
  durationMs: number;
  error?: string;
  errorType?: 'permanent' | 'transient';
}

// Risultato aggregato con metriche
export interface SyncMetrics {
  synced: number;
  errors: number;
  skipped: number;
  totalShipments: number;
  totalEventsUpserted: number;
  durationMs: number;
  avgApiCallMs: number;
  permanentErrors: number;
  transientErrors: number;
  retriesUsed: number;
}

export class TrackingService {
  private supabaseAdmin: SupabaseClient<Database>;
  private spedisciOnlineBaseUrl: string;
  private spedisciOnlineApiKey: string;

  constructor() {
    // Initialize admin client for service operations
    this.supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Spedisci.Online config
    this.spedisciOnlineBaseUrl =
      process.env.SPEDISCI_ONLINE_BASE_URL || 'https://demo1.spedisci.online/api/v2';
    this.spedisciOnlineApiKey = process.env.SPEDISCI_ONLINE_API_KEY || '';
  }

  /**
   * Get tracking info for a shipment
   * First checks cache (DB), then fetches from API if stale
   */
  async getTracking(shipmentId: string, forceRefresh = false): Promise<TrackingResponse> {
    try {
      // Get shipment info
      const { data: shipmentData, error: shipmentError } = await this.supabaseAdmin
        .from('shipments')
        .select('id, tracking_number, carrier, tracking_status, tracking_last_update')
        .eq('id', shipmentId)
        .single();

      if (shipmentError || !shipmentData) {
        return {
          success: false,
          tracking_number: '',
          current_status: 'unknown',
          current_status_normalized: 'unknown',
          last_update: null,
          events: [],
          is_delivered: false,
          error: 'Shipment not found',
        };
      }

      if (!shipmentData.tracking_number) {
        return {
          success: false,
          tracking_number: '',
          current_status: 'unknown',
          current_status_normalized: 'unknown',
          last_update: null,
          events: [],
          is_delivered: false,
          error: 'No tracking number available',
        };
      }

      // Check if we need to refresh from API
      const shouldRefresh = forceRefresh || this.shouldRefreshTracking(shipmentData);

      if (shouldRefresh) {
        // Fetch from Spedisci.Online API
        await this.fetchAndCacheTracking(
          shipmentData.id,
          shipmentData.tracking_number,
          shipmentData.carrier
        );
      }

      // Get cached events from DB
      const { data: eventsData, error: eventsError } = await this.supabaseAdmin
        .from('tracking_events')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('event_date', { ascending: false });

      // Type is correctly inferred from Database types
      const trackingEvents = eventsData || [];

      if (eventsError) {
        console.error('Error fetching tracking events:', eventsError);
      }

      const latestEvent = trackingEvents[0];

      return {
        success: true,
        tracking_number: shipmentData.tracking_number,
        carrier: shipmentData.carrier || undefined,
        current_status: latestEvent?.status || 'unknown',
        current_status_normalized: latestEvent?.status_normalized || 'unknown',
        last_update: latestEvent?.fetched_at || null,
        events: trackingEvents,
        is_delivered: latestEvent?.status_normalized === 'delivered',
      };
    } catch (error) {
      console.error('TrackingService.getTracking error:', error);
      return {
        success: false,
        tracking_number: '',
        current_status: 'error',
        current_status_normalized: 'error',
        last_update: null,
        events: [],
        is_delivered: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if we should refresh tracking from API
   * Rules:
   * - If never fetched: yes
   * - If delivered: no (final state)
   * - If last fetch > 30 minutes ago: yes
   */
  private shouldRefreshTracking(shipment: {
    tracking_status?: string | null;
    tracking_last_update?: string | null;
  }): boolean {
    // Never fetched
    if (!shipment.tracking_last_update) {
      return true;
    }

    // Already delivered - no need to refresh
    if (shipment.tracking_status === 'delivered') {
      return false;
    }

    // Check cache age (configurable, default 30 minutes)
    const lastUpdate = new Date(shipment.tracking_last_update);
    const cacheAge = Date.now() - lastUpdate.getTime();

    return cacheAge > TRACKING_CONFIG.CACHE_TTL_MS;
  }

  /**
   * Fetch tracking from Spedisci.Online API and cache in DB.
   * Ritorna il numero di eventi inseriti (0 se errore).
   */
  async fetchAndCacheTracking(
    shipmentId: string,
    trackingNumber: string,
    carrier?: string | null
  ): Promise<{ eventsCount: number; errorType?: 'permanent' | 'transient' }> {
    try {
      // Call Spedisci.Online API
      const response = await fetch(
        `${this.spedisciOnlineBaseUrl}/tracking/${encodeURIComponent(trackingNumber)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.spedisciOnlineApiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(15_000), // 15s timeout per singola chiamata
        }
      );

      if (!response.ok) {
        const status = response.status;
        // Errori permanenti: non ritentare mai
        const isPermanent = status === 404 || status === 400 || status === 403;
        console.error(
          `[TrackingService] API ${status} per ${trackingNumber} (${isPermanent ? 'permanent' : 'transient'})`
        );
        return { eventsCount: 0, errorType: isPermanent ? 'permanent' : 'transient' };
      }

      const data: SpedisciOnlineTrackingResponse = await response.json();

      if (!data.TrackingDettaglio || !Array.isArray(data.TrackingDettaglio)) {
        return { eventsCount: 0, errorType: 'permanent' };
      }

      // Transform events
      const now = new Date().toISOString();
      const events: TrackingEventInsert[] = data.TrackingDettaglio.map((event) => {
        const eventDate = parseItalianDate(event.Data);
        const statusNormalized = normalizeStatus(event.Stato);

        return {
          shipment_id: shipmentId,
          tracking_number: trackingNumber,
          event_date: eventDate.toISOString(),
          status: event.Stato,
          status_normalized: statusNormalized,
          location: event.Luogo || null,
          carrier: carrier || 'unknown',
          provider: 'spediscionline',
          raw_data: event as Json,
          fetched_at: now,
        };
      });

      if (events.length === 0) {
        return { eventsCount: 0 };
      }

      // Batch upsert: tutti gli eventi in UNA sola chiamata DB
      const { error: upsertError } = await this.supabaseAdmin
        .from('tracking_events')
        .upsert(events, {
          onConflict: 'shipment_id,event_date,status',
          ignoreDuplicates: true,
        });

      if (upsertError) {
        console.error(
          `[TrackingService] Batch upsert fallito per ${shipmentId}: ${upsertError.message}`
        );
        return { eventsCount: 0, errorType: 'transient' };
      }

      return { eventsCount: events.length };
    } catch (error) {
      // Timeout o errori di rete → transient
      const msg = error instanceof Error ? error.message : 'Unknown';
      console.error(`[TrackingService] Fetch error per ${trackingNumber}: ${msg}`);
      return { eventsCount: 0, errorType: 'transient' };
    }
  }

  /**
   * Batch sync tracking per spedizioni attive.
   * Parallelismo controllato con pool di worker, retry per errori transient.
   */
  async syncActiveShipments(
    options: {
      maxAge?: number;
      limit?: number;
      delayBetween?: number;
      concurrency?: number;
    } = {}
  ): Promise<SyncMetrics> {
    const startTime = Date.now();
    const {
      maxAge = TRACKING_CONFIG.SYNC_MAX_AGE_MS,
      limit = TRACKING_CONFIG.SYNC_BATCH_LIMIT,
      delayBetween = TRACKING_CONFIG.SYNC_DELAY_MS,
      concurrency = TRACKING_CONFIG.SYNC_CONCURRENCY,
    } = options;

    const metrics: SyncMetrics = {
      synced: 0,
      errors: 0,
      skipped: 0,
      totalShipments: 0,
      totalEventsUpserted: 0,
      durationMs: 0,
      avgApiCallMs: 0,
      permanentErrors: 0,
      transientErrors: 0,
      retriesUsed: 0,
    };

    try {
      // Query spedizioni attive che necessitano aggiornamento tracking
      const cutoffDate = new Date(Date.now() - maxAge).toISOString();
      const lookbackDate = new Date(
        Date.now() - TRACKING_CONFIG.SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

      const { data: shipmentsData, error } = await this.supabaseAdmin
        .from('shipments')
        .select('id, tracking_number, carrier, tracking_status, tracking_last_update, created_at')
        .not('tracking_number', 'is', null)
        .not('tracking_status', 'eq', 'delivered')
        .not('tracking_status', 'eq', 'cancelled')
        .not('tracking_status', 'eq', 'returned')
        .or(`tracking_last_update.is.null,tracking_last_update.lt.${cutoffDate}`)
        .gte('created_at', lookbackDate)
        .order('tracking_last_update', { ascending: true, nullsFirst: true })
        .limit(limit);

      if (error) {
        console.error('[TrackingSync] Errore query spedizioni:', error);
        return { ...metrics, errors: 1, durationMs: Date.now() - startTime };
      }

      const shipments = shipmentsData || [];
      metrics.totalShipments = shipments.length;
      console.log(
        `[TrackingSync] Avvio sync per ${shipments.length} spedizioni (concurrency=${concurrency})`
      );

      if (shipments.length === 0) {
        metrics.durationMs = Date.now() - startTime;
        return metrics;
      }

      // Pool di worker con concorrenza controllata
      const results = await this.runWithConcurrency(
        shipments.map((shipment) => () => this.syncSingleShipment(shipment, delayBetween)),
        concurrency
      );

      // Aggrega risultati
      const apiCallDurations: number[] = [];
      for (const result of results) {
        if (result.success) {
          metrics.synced++;
          metrics.totalEventsUpserted += result.eventsCount;
        } else if (result.errorType === 'permanent') {
          metrics.permanentErrors++;
          metrics.errors++;
        } else {
          metrics.transientErrors++;
          metrics.errors++;
        }
        metrics.retriesUsed += result.retries;
        apiCallDurations.push(result.durationMs);
      }

      metrics.durationMs = Date.now() - startTime;
      metrics.avgApiCallMs =
        apiCallDurations.length > 0
          ? Math.round(apiCallDurations.reduce((a, b) => a + b, 0) / apiCallDurations.length)
          : 0;

      // Log strutturato con metriche
      console.log(
        `[TrackingSync] Completato in ${metrics.durationMs}ms — ` +
          `synced=${metrics.synced} errors=${metrics.errors} ` +
          `(perm=${metrics.permanentErrors} trans=${metrics.transientErrors}) ` +
          `events=${metrics.totalEventsUpserted} retries=${metrics.retriesUsed} ` +
          `avgApi=${metrics.avgApiCallMs}ms`
      );
    } catch (error) {
      console.error('[TrackingSync] Errore critico:', error);
      metrics.errors++;
      metrics.durationMs = Date.now() - startTime;
    }

    return metrics;
  }

  /**
   * Sync singola spedizione con retry per errori transient.
   */
  private async syncSingleShipment(
    shipment: { id: string; tracking_number: string | null; carrier: string | null },
    delayBetween: number
  ): Promise<ShipmentSyncResult> {
    const callStart = Date.now();
    let retries = 0;
    const maxRetries = TRACKING_CONFIG.SYNC_MAX_RETRIES;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.fetchAndCacheTracking(
          shipment.id,
          shipment.tracking_number!,
          shipment.carrier
        );

        // Errore permanente → non ritentare
        if (result.errorType === 'permanent') {
          return {
            shipmentId: shipment.id,
            trackingNumber: shipment.tracking_number!,
            success: false,
            eventsCount: 0,
            retries,
            durationMs: Date.now() - callStart,
            errorType: 'permanent',
          };
        }

        // Errore transient → retry con backoff
        if (result.errorType === 'transient' && attempt < maxRetries) {
          retries++;
          const backoff = delayBetween * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }

        // Successo o ultimo tentativo fallito
        if (result.eventsCount > 0) {
          // Rate limiting delay dopo successo
          if (delayBetween > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayBetween));
          }
          return {
            shipmentId: shipment.id,
            trackingNumber: shipment.tracking_number!,
            success: true,
            eventsCount: result.eventsCount,
            retries,
            durationMs: Date.now() - callStart,
          };
        }

        // eventsCount === 0 senza errore → nessun evento (OK, non e' un errore)
        return {
          shipmentId: shipment.id,
          trackingNumber: shipment.tracking_number!,
          success: !result.errorType,
          eventsCount: 0,
          retries,
          durationMs: Date.now() - callStart,
          errorType: result.errorType,
        };
      } catch (err) {
        if (attempt < maxRetries) {
          retries++;
          const backoff = delayBetween * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }
        return {
          shipmentId: shipment.id,
          trackingNumber: shipment.tracking_number!,
          success: false,
          eventsCount: 0,
          retries,
          durationMs: Date.now() - callStart,
          error: err instanceof Error ? err.message : 'Unknown',
          errorType: 'transient',
        };
      }
    }

    // Fallback (non dovrebbe mai arrivarci)
    return {
      shipmentId: shipment.id,
      trackingNumber: shipment.tracking_number!,
      success: false,
      eventsCount: 0,
      retries,
      durationMs: Date.now() - callStart,
      errorType: 'transient',
    };
  }

  /**
   * Esegue un array di task con concorrenza limitata.
   * Come Promise.all() ma con max N task in parallelo.
   */
  private async runWithConcurrency<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number
  ): Promise<T[]> {
    const results: T[] = [];
    let index = 0;

    async function worker() {
      while (index < tasks.length) {
        const currentIndex = index++;
        results[currentIndex] = await tasks[currentIndex]();
      }
    }

    // Lancia N worker in parallelo
    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
    await Promise.all(workers);

    return results;
  }

  /**
   * Get tracking by tracking number (for external lookup)
   */
  async getTrackingByNumber(trackingNumber: string): Promise<TrackingResponse> {
    // Find shipment by tracking number
    const { data: shipmentData, error } = await this.supabaseAdmin
      .from('shipments')
      .select('id')
      .eq('tracking_number', trackingNumber)
      .single();

    if (error || !shipmentData) {
      return {
        success: false,
        tracking_number: trackingNumber,
        current_status: 'unknown',
        current_status_normalized: 'unknown',
        last_update: null,
        events: [],
        is_delivered: false,
        error: 'Shipment not found',
      };
    }

    return this.getTracking(shipmentData.id);
  }
}

// Singleton instance
let trackingServiceInstance: TrackingService | null = null;

export function getTrackingService(): TrackingService {
  if (!trackingServiceInstance) {
    trackingServiceInstance = new TrackingService();
  }
  return trackingServiceInstance;
}

export default TrackingService;
