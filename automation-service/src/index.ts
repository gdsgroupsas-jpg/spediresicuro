/**
 * Automation Service per Spedisci.Online
 * 
 * Servizio Express standalone per Railway
 * Gestisce automation browser con Puppeteer
 */

// Carica variabili d'ambiente da .env (solo in sviluppo locale)
// In produzione (Railway/Vercel) le variabili vengono da environment
try {
  if (process.env.NODE_ENV !== 'production') {
    const dotenv = require('dotenv');
    const result = dotenv.config();
    if (result.error) {
      console.error('❌ Errore caricamento .env:', result.error);
    } else {
      console.log('✅ File .env caricato correttamente');
    }
  }
} catch (e) {
  console.error('❌ dotenv non disponibile:', e);
}

import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { syncCourierConfig, syncAllEnabledConfigs, syncShipmentsFromPortal } from './agent';

const app = express();
app.set('trust proxy', 1); // Trust proxy per leggere IP reale su Vercel/Railway
app.use(express.json());

// ============================================
// SUPABASE CLIENT
// ============================================

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('🔍 Debug Supabase Config:');
console.log('  - SUPABASE_URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NON CONFIGURATO');
console.log('  - SERVICE_ROLE_KEY:', supabaseServiceKey ? 'CONFIGURATO' : 'NON CONFIGURATO');

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devono essere configurati per diagnostics');
}

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// ============================================
// RATE LIMITING
// ============================================

// Handler standardizzato per rate limit
// express-rate-limit v7 passa options con retryAfter in secondi
const rateLimitHandler = (req: Request, res: Response, next: any, options: any) => {
  res.status(429).json({
    success: false,
    error: 'rate_limited',
    retry_after_seconds: options.retryAfter || 60, // retryAfter è già in secondi
  });
};

// Limiter per diagnostics: 30 richieste al minuto
const diagnosticsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // 30 richieste per finestra
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter per sync: 20 richieste ogni 10 minuti
const syncLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minuti
  max: 20, // 20 richieste per finestra
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// SANITIZZAZIONE PII (Personally Identifiable Information)
// ============================================

/**
 * Sanitizza un oggetto ricorsivamente mascherando email e telefoni
 * Non cancella i campi, solo offusca i valori sensibili
 */
function sanitizeContext(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Se è un array, sanitizza ogni elemento
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeContext(item));
  }

  // Se è un oggetto, sanitizza ricorsivamente
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        
        // Se il valore è una stringa, controlla se è email o telefono
        if (typeof value === 'string') {
          // Pattern per email: qualcosa@qualcosa.qualcosa
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
          if (emailPattern.test(value)) {
            // Maschera email: a***@b.com
            const [localPart, domain] = value.split('@');
            const maskedLocal = localPart.length > 0 
              ? `${localPart[0]}***` 
              : '***';
            sanitized[key] = `${maskedLocal}@${domain}`;
            continue;
          }

          // Pattern per telefono: stringa numerica di 9-15 cifre
          const phonePattern = /^[\d\s\-\+\(\)]{9,15}$/;
          const digitsOnly = value.replace(/\D/g, '');
          if (digitsOnly.length >= 9 && digitsOnly.length <= 15 && phonePattern.test(value)) {
            // Maschera telefono: mostra solo ultime 4 cifre
            const last4 = digitsOnly.slice(-4);
            sanitized[key] = `***${last4}`;
            continue;
          }
        }

        // Per altri tipi, sanitizza ricorsivamente
        sanitized[key] = sanitizeContext(value);
      }
    }
    return sanitized;
  }

  // Per valori primitivi non stringa, ritorna così com'è
  return obj;
}

// Health check endpoint (info limitate per sicurezza)
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    service: 'automation-service',
    timestamp: new Date().toISOString()
    // Rimossa uptime per non esporre info sistema
  });
});

// Sync endpoint principale (protetto da rate limiting)
app.post('/api/sync', syncLimiter, async (req: Request, res: Response) => {
  try {
    const { config_id, sync_all, force_refresh, otp } = req.body;
    
    // Log sanitizzato (non espone UUID completo per sicurezza)
    const configIdShort = config_id ? `${config_id.substring(0, 8)}...` : null;
    console.log('🔄 [AUTOMATION] Richiesta sync ricevuta:', { 
      config_id: configIdShort, 
      sync_all, 
      force_refresh 
    });

    // Verifica autenticazione (OBBLIGATORIA per sicurezza)
    const authToken = req.headers.authorization;
    const expectedToken = process.env.AUTOMATION_SERVICE_TOKEN;
    
    if (!expectedToken) {
      console.error('❌ [AUTOMATION] AUTOMATION_SERVICE_TOKEN non configurato - Rischio sicurezza!');
      return res.status(500).json({ 
        success: false, 
        error: 'Configurazione sicurezza mancante' 
      });
    }
    
    if (authToken !== `Bearer ${expectedToken}`) {
      console.warn('⚠️ [AUTOMATION] Tentativo accesso non autorizzato');
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized - Token mancante o non valido' 
      });
    }

    if (sync_all) {
      // Sync tutte le configurazioni abilitate
      console.log('🔄 [AUTOMATION] Avvio sync globale...');
      await syncAllEnabledConfigs();
      
      return res.json({
        success: true,
        message: 'Sync globale completata',
        timestamp: new Date().toISOString(),
      });
    } 
    
    if (config_id) {
      // Sync configurazione specifica
      // Log sanitizzato (non espone UUID completo)
      const configIdShort = config_id ? `${config_id.substring(0, 8)}...` : null;
      console.log(`🔄 [AUTOMATION] Avvio sync per config: ${configIdShort}`);
      
      const result = await syncCourierConfig(config_id, force_refresh || false);
      
      if (result.success) {
        return res.json({
          success: true,
          message: result.message || 'Sync completata',
          session_data: result.session_data,
          contracts: result.contracts,
          timestamp: new Date().toISOString(),
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error || 'Errore durante sync',
          timestamp: new Date().toISOString(),
        });
      }
    } 
    
    return res.status(400).json({
      success: false,
      error: 'Specifica config_id o sync_all=true',
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error('❌ [AUTOMATION] Errore sync:', error);
    
    // Sanitizza error message in produzione (non esporre dettagli sistema)
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Errore durante sync. Verifica logs per dettagli.'
      : error.message || 'Errore sconosciuto';
    
    return res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

// Endpoint per sync spedizioni (protetto da rate limiting)
app.post('/api/sync-shipments', syncLimiter, async (req: Request, res: Response) => {
  try {
    const { configId } = req.body;
    
    // Verifica autenticazione (OBBLIGATORIA)
    const authToken = req.headers.authorization;
    const expectedToken = process.env.AUTOMATION_SERVICE_TOKEN;
    
    if (!expectedToken) {
      console.error('❌ [SYNC SHIPMENTS] AUTOMATION_SERVICE_TOKEN non configurato - Rischio sicurezza!');
      return res.status(500).json({ 
        success: false, 
        error: 'Configurazione sicurezza mancante' 
      });
    }
    
    if (authToken !== `Bearer ${expectedToken}`) {
      console.warn('⚠️ [SYNC SHIPMENTS] Tentativo accesso non autorizzato');
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized - Token mancante o non valido' 
      });
    }

    if (!configId) {
      return res.status(400).json({
        success: false,
        error: 'configId richiesto',
      });
    }

    // Log sanitizzato
    const configIdShort = configId ? `${configId.substring(0, 8)}...` : null;
    console.log(`🔄 [SYNC SHIPMENTS] Avvio sync spedizioni per config: ${configIdShort}`);

    const result = await syncShipmentsFromPortal(configId);

    if (result.success) {
      return res.json({
        success: true,
        shipments_synced: result.shipments_synced,
        shipments_updated: result.shipments_updated,
        shipments_created: result.shipments_created,
        errors: result.errors,
        message: result.message,
        timestamp: new Date().toISOString(),
      });
    } else {
      return res.status(500).json({
        success: false,
        shipments_synced: result.shipments_synced,
        shipments_updated: result.shipments_updated,
        shipments_created: result.shipments_created,
        errors: result.errors,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    console.error('❌ [SYNC SHIPMENTS] Errore:', error);
    
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Errore durante sync spedizioni. Verifica logs per dettagli.'
      : error.message || 'Errore sconosciuto';
    
    return res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

// Endpoint per cron job (protetto da rate limiting)
app.get('/api/cron/sync', syncLimiter, async (req: Request, res: Response) => {
  try {
    // Verifica secret token (protezione cron job)
    const authHeader = req.headers.authorization;
    const secretToken = process.env.CRON_SECRET_TOKEN;

    // Autenticazione obbligatoria per cron job
    if (!secretToken) {
      console.error('❌ [CRON] CRON_SECRET_TOKEN non configurato - Rischio sicurezza!');
      return res.status(500).json({
        success: false,
        error: 'Configurazione sicurezza mancante',
      });
    }
    
    if (authHeader !== `Bearer ${secretToken}`) {
      console.warn('⚠️ [CRON] Tentativo accesso non autorizzato');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    console.log('🔄 [CRON] Avvio sync automatico automation...');
    
    await syncAllEnabledConfigs();
    
    return res.json({
      success: true,
      message: 'Sync automatico completata',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [CRON] Errore sync automatico:', error);
    
    // Sanitizza error message in produzione
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Errore durante sync. Verifica logs per dettagli.'
      : error.message || 'Errore durante sync';
    
    return res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// DIAGNOSTICS ENDPOINT
// ============================================

/**
 * Endpoint per salvare eventi di diagnostica
 * Protetto da rate limiting e autenticazione token
 */
app.post('/api/diagnostics', diagnosticsLimiter, async (req: Request, res: Response) => {
  try {
    // 1. Verifica token Bearer
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.DIAGNOSTICS_TOKEN || 'd4t1_d14gn0st1c1_s3gr3t1_2025_x9z';

    // Avviso se si usa il token di default (non sicuro per produzione)
    if (!process.env.DIAGNOSTICS_TOKEN) {
      console.warn('⚠️ [DIAGNOSTICS] DIAGNOSTICS_TOKEN non configurato - uso token di default (NON SICURO per produzione)');
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - Token Bearer mancante',
      });
    }

    const token = authHeader.substring(7); // Rimuove "Bearer "
    if (token !== expectedToken) {
      console.warn('⚠️ [DIAGNOSTICS] Tentativo accesso non autorizzato');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - Token non valido',
      });
    }

    // 2. Valida body: type, severity e correlation_id
    const { type, severity, context, correlation_id, user_id, ip_address, user_agent } = req.body;

    // Valida correlation_id (UUID opzionale)
    let validCorrelationId: string | null = null;
    if (correlation_id) {
      // Regex semplice per UUID v4: 8-4-4-4-12 caratteri esadecimali
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(correlation_id)) {
        validCorrelationId = correlation_id;
      } else {
        // Se non è valido, ignoralo (null)
        console.warn('⚠️ [DIAGNOSTICS] correlation_id non valido, ignorato:', correlation_id);
      }
    }

    // Valida type
    const validTypes = ['error', 'warning', 'info', 'performance', 'user_action'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `type deve essere uno di: ${validTypes.join(', ')}`,
      });
    }

    // Valida severity
    const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
    if (!severity || !validSeverities.includes(severity)) {
      return res.status(400).json({
        success: false,
        error: `severity deve essere uno di: ${validSeverities.join(', ')}`,
      });
    }

    // 3. Valida context (JSON): max 10KB e max 3 livelli profondità
    let contextObj = context || {};
    
    // Se context è stringa, prova a parsarla
    if (typeof context === 'string') {
      try {
        contextObj = JSON.parse(context);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'context deve essere un JSON valido',
        });
      }
    }

    // Verifica dimensione (10KB = 10240 bytes)
    const contextString = JSON.stringify(contextObj);
    if (Buffer.byteLength(contextString, 'utf8') > 10240) {
      return res.status(400).json({
        success: false,
        error: 'context non può superare 10KB',
      });
    }

    // Verifica profondità (max 3 livelli)
    function getDepth(obj: any, currentDepth: number = 0): number {
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return currentDepth;
      }
      
      let maxDepth = currentDepth;
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const depth = getDepth(obj[key], currentDepth + 1);
          maxDepth = Math.max(maxDepth, depth);
        }
      }
      return maxDepth;
    }

    const contextDepth = getDepth(contextObj);
    if (contextDepth > 3) {
      return res.status(400).json({
        success: false,
        error: 'context non può superare 3 livelli di profondità',
      });
    }

    // 4. Sanitizza context per rimuovere PII (email, telefoni)
    const cleanContext = sanitizeContext(contextObj);

    // 5. Estrai IP address dalla richiesta se non fornito
    const clientIp = ip_address || req.ip || req.socket.remoteAddress || null;

    // 6. Salva in Supabase
    if (!supabaseAdmin) {
      // Se Supabase non è configurato, ritorna un fallback invece di errore
      return res.status(202).json({
        success: true,
        id: `temp-${Date.now()}`,
        message: 'Diagnostic event queued (database not configured)',
        warning: 'Supabase not configured - event not persisted',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('diagnostics_events')
      .insert({
        type,
        severity,
        context: cleanContext, // Usa context sanitizzato
        correlation_id: validCorrelationId, // Aggiungi correlation_id se valido
        user_id: user_id || null,
        ip_address: clientIp,
        user_agent: user_agent || req.headers['user-agent'] || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [DIAGNOSTICS] Errore salvataggio:', error);
      return res.status(500).json({
        success: false,
        error: 'Errore durante salvataggio evento diagnostico',
      });
    }

    return res.json({
      success: true,
      id: data.id,
      message: 'Evento diagnostico salvato con successo',
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ [DIAGNOSTICS] Errore:', error);
    
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Errore durante salvataggio diagnostica. Verifica logs per dettagli.'
      : error.message || 'Errore sconosciuto';
    
    return res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Automation Service avviato su porta ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔄 Sync endpoint: http://localhost:${PORT}/api/sync`);
});

