/**
 * Spedisci.Online Automation Agent
 * 
 * Agent automatico per estrarre e aggiornare:
 * - Session cookies
 * - CSRF tokens
 * - Codici contratto
 * - Dati configurazione
 * 
 * ⚠️ IMPORTANTE: Questo agent automatizza il TUO account Spedisci.Online.
 * È legale perché stai automatizzando il tuo account personale.
 * 
 * REQUISITI:
 * - Credenziali Spedisci.Online (username/password)
 * - Accesso email per 2FA
 * - Configurazione IMAP per leggere email
 */

import { supabaseAdmin } from '@/lib/db/client';
import { decryptCredential } from '@/lib/security/encryption';
import * as cheerio from 'cheerio';
import * as qs from 'qs';

// Importa puppeteer solo se necessario (browser automation)
let puppeteer: any = null;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  console.warn('⚠️ Puppeteer non installato. Installa con: npm install puppeteer');
}

// Importa imap per leggere email 2FA
let ImapClient: any = null;
try {
  ImapClient = require('imap');
} catch (e) {
  console.warn('⚠️ IMAP client non installato. Installa con: npm install imap');
}

// ============================================
// TIPI
// ============================================

export interface AutomationSettings {
  // 2FA Method: 'email' (IMAP) o 'manual' (Microsoft Authenticator)
  two_factor_method: 'email' | 'manual';
  
  // Email 2FA (se two_factor_method = 'email')
  email_2fa?: string;
  imap_server?: string;
  imap_port?: number;
  imap_username?: string;
  imap_password?: string;
  
  // Manual 2FA (se two_factor_method = 'manual')
  // L'agent aspetterà che inserisci OTP manualmente
  manual_otp_callback?: (() => Promise<string>) | null; // Callback per ottenere OTP
  
  // Credenziali Spedisci.Online
  spedisci_online_username: string;
  spedisci_online_password: string;
  
  // Configurazione
  auto_refresh_interval_hours?: number;
  enabled: boolean;
}

export interface SessionData {
  session_cookie: string;
  csrf_token?: string;
  client_id_internal?: string;
  vector_contract_id?: string;
  expires_at?: string; // ISO timestamp
  extracted_at: string; // ISO timestamp
}

export interface ExtractionResult {
  success: boolean;
  session_data?: SessionData;
  contracts?: Record<string, string>; // Mappa contratti estratti
  error?: string;
  message?: string;
}

// ============================================
// CLASSE PRINCIPALE: SpedisciOnlineAgent
// ============================================

export class SpedisciOnlineAgent {
  private settings: AutomationSettings;
  private baseUrl: string;

  constructor(settings: AutomationSettings, baseUrl: string) {
    this.settings = settings;
    this.baseUrl = baseUrl;
  }

  /**
   * Estrae session cookie e dati da Spedisci.Online
   * 
   * Algoritmo Intelligente Anti-Conflitto:
   * 1. Verifica lock attivo (se utente sta usando, aspetta)
   * 2. Verifica session nel DB (se valida, riusala)
   * 3. Se session scaduta o mancante:
   *    a. Acquisisci lock
   *    b. Apri browser (Puppeteer)
   *    c. Vai a pagina login
   *    d. Compila form login
   *    e. Gestisci 2FA (leggi email)
   *    f. Estrai cookie di sessione
   *    g. Estrai CSRF token
   *    h. Estrai codici contratto
   *    i. Chiudi browser
   *    j. Rilascia lock
   * 4. Se session valida, ritorna quella
   */
  async extractSessionData(configId?: string, forceRefresh: boolean = false): Promise<ExtractionResult> {
    if (!puppeteer) {
      return {
        success: false,
        error: 'Puppeteer non installato. Installa con: npm install puppeteer',
      };
    }

    // ============================================
    // STEP 1: Verifica lock e session esistente
    // ============================================
    
    if (configId) {
      // Verifica lock attivo
      const lockCheck = await this.checkLock(configId);
      if (lockCheck.has_lock) {
        if (lockCheck.lock_type === 'manual') {
          // Utente sta usando manualmente - NON interferire
          const expiresAt = lockCheck.expires_at ? new Date(lockCheck.expires_at).toLocaleString('it-IT') : 'data sconosciuta';
          return {
            success: false,
            error: `Account in uso manuale. Lock attivo fino alle ${expiresAt}. Attendi o rilascia lock manualmente.`,
          };
        } else if (lockCheck.lock_type === 'agent' && !forceRefresh) {
          // Altro agent sta lavorando - aspetta
          return {
            success: false,
            error: `Altro agent sta lavorando. Lock attivo fino alle ${new Date(lockCheck.expires_at).toLocaleString('it-IT')}.`,
          };
        }
      }

      // Verifica session esistente nel DB (se non force refresh)
      if (!forceRefresh) {
        const existingSession = await this.getExistingSession(configId);
        if (existingSession && this.isSessionValid(existingSession)) {
          console.log('✅ [AGENT] Session esistente ancora valida, riuso quella');
          return {
            success: true,
            session_data: existingSession,
            message: 'Session esistente ancora valida',
          };
        }
      }
    }

    // ============================================
    // STEP 2: Acquisisci lock prima di procedere
    // ============================================
    
    let lockId: string | null = null;
    if (configId) {
      try {
        lockId = await this.acquireLock(configId, 'agent', 'Sistema automation');
        console.log('🔒 [AGENT] Lock acquisito:', lockId);
      } catch (error: any) {
        return {
          success: false,
          error: `Impossibile acquisire lock: ${error.message}. Potrebbe essere in uso manuale.`,
        };
      }
    }

    let browser: any = null;

    try {
      console.log('🚀 [AGENT] Avvio estrazione session data...');

      // 1. Apri browser
      // Configurazione ottimizzata per Vercel Serverless
      browser = await puppeteer.launch({
        headless: true, // Modalità headless (senza UI)
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process', // Importante per Vercel
          '--disable-gpu',
        ],
      });

      const page = await browser.newPage();

      // 2. Vai a pagina login
      console.log('📄 [AGENT] Navigazione a pagina login...');
      await page.goto(`${this.baseUrl}/login`, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // 3. Compila form login
      console.log('✍️ [AGENT] Compilazione form login...');
      await page.type('input[name="email"]', this.settings.spedisci_online_username);
      await page.type('input[name="password"]', this.settings.spedisci_online_password);
      await page.click('button[type="submit"]');

      // 4. Attendi possibile 2FA
      await page.waitForTimeout(2000);

      // Verifica se richiede 2FA
      const needs2FA = await page.evaluate(() => {
        return document.body.textContent?.includes('codice') || 
               document.body.textContent?.includes('verifica') ||
               document.body.textContent?.includes('autenticazione') ||
               document.querySelector('input[name="code"]') !== null ||
               document.querySelector('input[name="otp"]') !== null ||
               document.querySelector('input[type="text"][placeholder*="codice"]') !== null;
      });

      if (needs2FA) {
        console.log('🔐 [AGENT] Rilevato 2FA...');
        
        let code2FA: string | null = null;
        
        // Gestione 2FA in base al metodo configurato
        if (this.settings.two_factor_method === 'email') {
          // Metodo email (IMAP)
          console.log('📧 [AGENT] Leggo codice 2FA da email...');
          code2FA = await this.read2FACode();
          
          if (!code2FA) {
            throw new Error('Impossibile leggere codice 2FA da email. Verifica configurazione IMAP.');
          }
        } else if (this.settings.two_factor_method === 'manual') {
          // Metodo manuale (Microsoft Authenticator)
          console.log('👤 [AGENT] 2FA manuale richiesto (Microsoft Authenticator)');
          console.log('⏳ [AGENT] In attesa di OTP manuale...');
          
          if (this.settings.manual_otp_callback) {
            // Usa callback se fornito
            code2FA = await this.settings.manual_otp_callback();
          } else {
            // Altrimenti, aspetta input manuale (per sync manuale)
            // In questo caso, l'agent non può procedere automaticamente
            throw new Error(
              '2FA manuale richiesto. Per automation con Microsoft Authenticator, ' +
              'usa sync manuale dalla dashboard e inserisci OTP quando richiesto.'
            );
          }
        } else {
          throw new Error(`Metodo 2FA non supportato: ${this.settings.two_factor_method}`);
        }

        if (!code2FA) {
          throw new Error('Codice 2FA non ottenuto');
        }

        // Inserisci codice 2FA
        const codeInput = await page.$('input[name="code"], input[name="otp"], input[type="text"][placeholder*="codice"]');
        if (codeInput) {
          await codeInput.type(code2FA);
        } else {
          // Fallback: cerca qualsiasi input di testo
          await page.type('input[type="text"]', code2FA);
        }
        
        // Clicca submit
        const submitButton = await page.$('button[type="submit"], button:has-text("Verifica"), button:has-text("Conferma")');
        if (submitButton) {
          await submitButton.click();
        } else {
          await page.keyboard.press('Enter');
        }
        
        await page.waitForTimeout(2000);
      }

      // 5. Verifica login riuscito
      const loginSuccess = await page.evaluate(() => {
        return !window.location.href.includes('/login');
      });

      if (!loginSuccess) {
        throw new Error('Login fallito. Verifica credenziali.');
      }

      console.log('✅ [AGENT] Login riuscito');

      // 6. Vai a pagina creazione spedizione per estrarre CSRF token
      console.log('📄 [AGENT] Navigazione a pagina creazione spedizione...');
      await page.goto(`${this.baseUrl}/shippings/create`, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // 7. Estrai CSRF token
      const csrfToken = await page.evaluate(() => {
        const tokenInput = document.querySelector('input[name="_token"]') as HTMLInputElement;
        return tokenInput?.value || null;
      });

      if (!csrfToken) {
        throw new Error('CSRF token non trovato');
      }

      console.log('✅ [AGENT] CSRF token estratto');

      // 8. Estrai cookie di sessione
      const cookies = await page.cookies();
      const sessionCookie = cookies
        .map(c => `${c.name}=${c.value}`)
        .join('; ');

      if (!sessionCookie) {
        throw new Error('Session cookie non trovato');
      }

      console.log('✅ [AGENT] Session cookie estratto');

      // 9. Estrai codici contratto (se disponibili)
      const contracts = await this.extractContracts(page);

      // 10. Prepara session data
      const sessionData: SessionData = {
        session_cookie: sessionCookie,
        csrf_token: csrfToken,
        extracted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
      };

      // Aggiungi client_id e vector_contract_id se estratti
      if (contracts.client_id) {
        sessionData.client_id_internal = contracts.client_id;
      }
      if (contracts.vector_contract_id) {
        sessionData.vector_contract_id = contracts.vector_contract_id;
      }

      console.log('✅ [AGENT] Estrazione completata con successo');

      return {
        success: true,
        session_data: sessionData,
        contracts: contracts,
        message: 'Session data estratta con successo',
      };

    } catch (error: any) {
      console.error('❌ [AGENT] Errore estrazione:', error);
      return {
        success: false,
        error: error.message || 'Errore sconosciuto durante estrazione',
      };
    } finally {
      // Rilascia lock sempre, anche in caso di errore
      if (lockId && configId) {
        await this.releaseLock(configId, lockId);
        console.log('🔓 [AGENT] Lock rilasciato');
      }
      
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Verifica lock attivo per configurazione
   */
  private async checkLock(configId: string): Promise<{
    has_lock: boolean;
    lock_type: string | null;
    locked_by: string | null;
    expires_at: string | null;
    minutes_remaining: number | null;
  }> {
    try {
      const { data, error } = await supabaseAdmin.rpc('check_automation_lock', {
        p_config_id: configId,
      });

      if (error) {
        console.warn('⚠️ [AGENT] Errore verifica lock:', error);
        return { has_lock: false, lock_type: null, locked_by: null, expires_at: null, minutes_remaining: null };
      }

      if (data && data.length > 0) {
        return {
          has_lock: data[0].has_lock || false,
          lock_type: data[0].lock_type,
          locked_by: data[0].locked_by,
          expires_at: data[0].expires_at,
          minutes_remaining: data[0].minutes_remaining,
        };
      }

      return { has_lock: false, lock_type: null, locked_by: null, expires_at: null, minutes_remaining: null };
    } catch (error: any) {
      console.warn('⚠️ [AGENT] Errore check lock:', error);
      return { has_lock: false, lock_type: null, locked_by: null, expires_at: null, minutes_remaining: null };
    }
  }

  /**
   * Acquisisce lock per configurazione
   */
  private async acquireLock(
    configId: string,
    lockType: 'agent' | 'manual' | 'maintenance',
    lockedBy: string = 'system',
    durationMinutes: number = 30
  ): Promise<string> {
    try {
      const { data, error } = await supabaseAdmin.rpc('acquire_automation_lock', {
        p_config_id: configId,
        p_lock_type: lockType,
        p_locked_by: lockedBy,
        p_reason: `Agent automation sync`,
        p_duration_minutes: durationMinutes,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error('Lock già attivo per questa configurazione');
      }

      return data;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Rilascia lock per configurazione
   */
  private async releaseLock(configId: string, lockId?: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin.rpc('release_automation_lock', {
        p_config_id: configId,
        p_lock_id: lockId || null,
      });

      if (error) {
        console.warn('⚠️ [AGENT] Errore release lock:', error);
        return false;
      }

      return data || false;
    } catch (error: any) {
      console.warn('⚠️ [AGENT] Errore release lock:', error);
      return false;
    }
  }

  /**
   * Recupera session esistente dal database
   */
  private async getExistingSession(configId: string): Promise<SessionData | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('courier_configs')
        .select('session_data')
        .eq('id', configId)
        .single();

      if (error || !data || !data.session_data) {
        return null;
      }

      return data.session_data as SessionData;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verifica se session è ancora valida (non scaduta)
   */
  private isSessionValid(session: SessionData): boolean {
    if (!session.expires_at) {
      // Se non c'è expires_at, assumiamo valida (ma vecchia, meglio refresh)
      // Controlla extracted_at invece
      if (session.extracted_at) {
        const extracted = new Date(session.extracted_at);
        const now = new Date();
        const hoursSinceExtraction = (now.getTime() - extracted.getTime()) / (1000 * 60 * 60);
        // Se estratta più di 20 ore fa, considera scaduta
        return hoursSinceExtraction < 20;
      }
      return false;
    }

    const expires = new Date(session.expires_at);
    const now = new Date();
    return expires > now;
  }

  /**
   * Legge codice 2FA da email
   */
  private async read2FACode(): Promise<string | null> {
    if (!ImapClient) {
      console.error('❌ [AGENT] IMAP client non disponibile');
      return null;
    }

    return new Promise((resolve, reject) => {
      const imap = new ImapClient({
        user: this.settings.imap_username,
        password: this.settings.imap_password,
        host: this.settings.imap_server,
        port: this.settings.imap_port,
        tls: true,
      });

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err: any, box: any) => {
          if (err) {
            reject(err);
            return;
          }

          // Cerca email più recente da Spedisci.Online
          imap.search(['UNSEEN', ['FROM', 'noreply@spedisci.online']], (err: any, results: any) => {
            if (err || !results.length) {
              // Prova anche email lette
              imap.search([['FROM', 'noreply@spedisci.online']], (err2: any, results2: any) => {
                if (err2 || !results2.length) {
                  resolve(null);
                  return;
                }
                this.fetchEmail(imap, results2[results2.length - 1], resolve);
              });
              return;
            }

            this.fetchEmail(imap, results[results.length - 1], resolve);
          });
        });
      });

      imap.once('error', (err: any) => {
        reject(err);
      });

      imap.connect();
    });
  }

  /**
   * Fetch email e estrae codice 2FA
   */
  private fetchEmail(imap: any, uid: number, resolve: (code: string | null) => void) {
    const fetch = imap.fetch(uid, { bodies: '' });

    fetch.on('message', (msg: any) => {
      msg.on('body', (stream: any) => {
        let buffer = '';
        stream.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
        });
        stream.once('end', () => {
          // Estrai codice 2FA (solitamente 6 cifre)
          const codeMatch = buffer.match(/\b\d{6}\b/);
          const code = codeMatch ? codeMatch[0] : null;
          resolve(code);
          imap.end();
        });
      });
    });
  }

  /**
   * Estrae codici contratto dalla pagina
   */
  private async extractContracts(page: any): Promise<Record<string, string>> {
    try {
      const contracts: Record<string, string> = {};

      // Estrai client_id e vector_contract_id dalla pagina
      const pageData = await page.evaluate(() => {
        return {
          client_id: (document.querySelector('[data-client-id]') as HTMLElement)?.dataset.clientId,
          vector_contract_id: (document.querySelector('[data-vector-contract-id]') as HTMLElement)?.dataset.vectorContractId,
        };
      });

      if (pageData.client_id) {
        contracts.client_id = pageData.client_id;
      }
      if (pageData.vector_contract_id) {
        contracts.vector_contract_id = pageData.vector_contract_id;
      }

      return contracts;
    } catch (error) {
      console.warn('⚠️ [AGENT] Impossibile estrarre contratti:', error);
      return {};
    }
  }
}

// ============================================
// FUNZIONI HELPER
// ============================================

/**
 * Aggiorna configurazione courier con session data estratta
 */
export async function updateCourierConfigWithSessionData(
  configId: string,
  sessionData: SessionData
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('courier_configs')
      .update({
        session_data: sessionData,
        last_automation_sync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', configId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error: any) {
    console.error('❌ Errore aggiornamento config:', error);
    return {
      success: false,
      error: error.message || 'Errore aggiornamento configurazione',
    };
  }
}

/**
 * Esegue sync automatico per una configurazione
 */
export async function syncCourierConfig(configId: string, forceRefresh: boolean = false): Promise<ExtractionResult> {
  try {
    // 1. Recupera configurazione
    const { data: config, error } = await supabaseAdmin
      .from('courier_configs')
      .select('*')
      .eq('id', configId)
      .single();

    if (error || !config) {
      throw new Error('Configurazione non trovata');
    }

    if (!config.automation_enabled) {
      return {
        success: false,
        error: 'Automation non abilitata per questa configurazione',
      };
    }

    const rawSettings = config.automation_settings as any;
    if (!rawSettings || !rawSettings.enabled) {
      return {
        success: false,
        error: 'Automation settings non configurate',
      };
    }

    // ============================================
    // 🔓 DECRITTAZIONE PASSWORD (SICUREZZA CRITICA)
    // ============================================
    
    const settings: AutomationSettings = { ...rawSettings };
    
    // Decripta password se criptate
    if (config.automation_encrypted) {
      if (settings.spedisci_online_password) {
        try {
          settings.spedisci_online_password = decryptCredential(
            settings.spedisci_online_password
          );
        } catch (error) {
          console.error('❌ Errore decriptazione password Spedisci.Online:', error);
          return {
            success: false,
            error: 'Errore decriptazione password. Verifica ENCRYPTION_KEY.',
          };
        }
      }
      
      if (settings.imap_password) {
        try {
          settings.imap_password = decryptCredential(settings.imap_password);
        } catch (error) {
          console.error('❌ Errore decriptazione password IMAP:', error);
          return {
            success: false,
            error: 'Errore decriptazione password IMAP. Verifica ENCRYPTION_KEY.',
          };
        }
      }
    }

    // 2. Crea agent
    const agent = new SpedisciOnlineAgent(settings, config.base_url);

    // 3. Estrai session data (passa configId per lock management)
    const result = await agent.extractSessionData(configId, forceRefresh);

    if (result.success && result.session_data) {
      // 4. Aggiorna configurazione
      await updateCourierConfigWithSessionData(configId, result.session_data);

      // 5. Aggiorna contract_mapping se contratti estratti
      if (result.contracts) {
        const currentMapping = (config.contract_mapping || {}) as Record<string, string>;
        const updatedMapping = { ...currentMapping, ...result.contracts };

        await supabaseAdmin
          .from('courier_configs')
          .update({ contract_mapping: updatedMapping })
          .eq('id', configId);
      }
    }

    return result;
  } catch (error: any) {
    console.error('❌ Errore sync configurazione:', error);
    return {
      success: false,
      error: error.message || 'Errore durante sync',
    };
  }
}

/**
 * Esegue sync automatico per tutte le configurazioni abilitate
 */
export async function syncAllEnabledConfigs(): Promise<void> {
  try {
    const { data: configs, error } = await supabaseAdmin
      .from('courier_configs')
      .select('id')
      .eq('automation_enabled', true)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    if (!configs || configs.length === 0) {
      console.log('ℹ️ Nessuna configurazione con automation abilitata');
      return;
    }

    console.log(`🔄 [SYNC] Trovate ${configs.length} configurazioni da sincronizzare`);

    for (const config of configs) {
      try {
        await syncCourierConfig(config.id);
        console.log(`✅ [SYNC] Config ${config.id} sincronizzata`);
      } catch (error: any) {
        console.error(`❌ [SYNC] Errore sync config ${config.id}:`, error);
      }
    }
  } catch (error: any) {
    console.error('❌ [SYNC] Errore sync globale:', error);
  }
}

