/**
 * Automation Service per Spedisci.Online
 * 
 * Servizio Express standalone per Railway
 * Gestisce automation browser con Puppeteer
 */

import express from 'express';
import { syncCourierConfig, syncAllEnabledConfigs } from './agent';

const app = express();
app.use(express.json());

// Health check endpoint (info limitate per sicurezza)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'automation-service',
    timestamp: new Date().toISOString()
    // Rimossa uptime per non esporre info sistema
  });
});

// Sync endpoint principale
app.post('/api/sync', async (req, res) => {
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

// Endpoint per cron job
app.get('/api/cron/sync', async (req, res) => {
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Automation Service avviato su porta ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔄 Sync endpoint: http://localhost:${PORT}/api/sync`);
});

