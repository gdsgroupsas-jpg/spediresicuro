/**
 * API Versioning & Monitoring Migration
 * 
 * Migration: 014 - Sistema di Versionamento e Monitoraggio API
 * Description: Traccia versioni API e monitora stato salute API corrieri
 */

-- ============================================
-- STEP 1: Crea Tabella api_versions
-- ============================================

CREATE TABLE IF NOT EXISTS public.api_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Provider
  provider_id TEXT NOT NULL, -- 'spedisci_online', 'gls', etc.
  
  -- Versione
  version TEXT NOT NULL, -- Es: 'v1', 'v2.1', '2024-01'
  base_url TEXT NOT NULL, -- URL base per questa versione
  
  -- Changelog
  changelog TEXT, -- Note su cambiamenti in questa versione
  breaking_changes BOOLEAN DEFAULT false, -- Se true, contiene breaking changes
  deprecated BOOLEAN DEFAULT false, -- Se true, versione deprecata
  supported_until TIMESTAMPTZ, -- Data fino a quando è supportata
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_api_versions_provider ON public.api_versions(provider_id);
CREATE INDEX IF NOT EXISTS idx_api_versions_deprecated ON public.api_versions(deprecated) WHERE deprecated = false;

-- ============================================
-- STEP 2: Crea Tabella api_monitors
-- ============================================

CREATE TABLE IF NOT EXISTS public.api_monitors (
  provider_id TEXT PRIMARY KEY,
  
  -- Stato
  last_check TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
  response_time_ms INTEGER, -- Tempo risposta in millisecondi
  error_message TEXT, -- Messaggio errore se status != healthy
  api_version TEXT, -- Versione API rilevata
  
  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_api_monitors_status ON public.api_monitors(status);
CREATE INDEX IF NOT EXISTS idx_api_monitors_last_check ON public.api_monitors(last_check DESC);

-- Commenti
COMMENT ON TABLE public.api_versions IS 
  'Registro versioni API corrieri per gestire compatibilità e migrazioni';
COMMENT ON TABLE public.api_monitors IS 
  'Monitoraggio stato salute API corrieri in tempo reale';

