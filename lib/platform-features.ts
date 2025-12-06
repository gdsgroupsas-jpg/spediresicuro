/**
 * Helper per verificare se una platform feature è attiva
 * 
 * Queste funzioni controllano se una feature è abilitata globalmente
 * nella piattaforma (gestita dal superadmin).
 */

import { supabaseAdmin, isSupabaseConfigured } from './supabase';

/**
 * Verifica se una platform feature è attiva
 */
export async function isPlatformFeatureEnabled(featureCode: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    // Se Supabase non è configurato, ritorna true (compatibilità)
    return true;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('platform_features')
      .select('is_enabled')
      .eq('code', featureCode)
      .single();

    if (error || !data) {
      // Se la feature non esiste, ritorna true (compatibilità)
      console.warn(`Feature ${featureCode} non trovata, assumendo attiva`);
      return true;
    }

    return data.is_enabled === true;
  } catch (error) {
    console.error(`Errore verifica feature ${featureCode}:`, error);
    // In caso di errore, ritorna true (compatibilità)
    return true;
  }
}

/**
 * Verifica se una platform feature è visibile
 */
export async function isPlatformFeatureVisible(featureCode: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    // Se Supabase non è configurato, ritorna true (compatibilità)
    return true;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('platform_features')
      .select('is_visible')
      .eq('code', featureCode)
      .single();

    if (error || !data) {
      // Se la feature non esiste, ritorna true (compatibilità)
      console.warn(`Feature ${featureCode} non trovata, assumendo visibile`);
      return true;
    }

    return data.is_visible === true;
  } catch (error) {
    console.error(`Errore verifica visibilità feature ${featureCode}:`, error);
    // In caso di errore, ritorna true (compatibilità)
    return true;
  }
}

/**
 * Verifica se una platform feature è attiva E visibile
 */
export async function isPlatformFeatureActive(featureCode: string): Promise<boolean> {
  const [enabled, visible] = await Promise.all([
    isPlatformFeatureEnabled(featureCode),
    isPlatformFeatureVisible(featureCode),
  ]);

  return enabled && visible;
}

/**
 * Carica tutte le platform features (per uso lato server)
 */
export async function getAllPlatformFeatures() {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('platform_features')
      .select('*')
      .order('category', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Errore caricamento platform features:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Errore caricamento platform features:', error);
    return [];
  }
}



