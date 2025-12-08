/**
 * Spedisci.Online Automation Agent
 * 
 * Versione standalone per Railway service
 * Copiato e adattato da lib/automation/spedisci-online-agent.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import * as qs from 'qs';
import * as crypto from 'crypto';

// Importa puppeteer
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
// SUPABASE CLIENT
// ============================================

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('⚠️ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devono essere configurati');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// ============================================
// ENCRYPTION (copiato da lib/security/encryption.ts)
// ============================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  
  if (!envKey) {
    throw new Error('ENCRYPTION_KEY non configurata');
  }
  
  if (envKey.length === 64) {
    return Buffer.from(envKey, 'hex');
  } else {
    return crypto.scryptSync(envKey, 'spediresicuro-salt', KEY_LENGTH);
  }
}

function decryptCredential(encryptedData: string): string {
  if (!encryptedData) {
    return '';
  }

  if (!encryptedData.includes(':')) {
    return encryptedData; // Testo in chiaro (retrocompatibilità)
  }

  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');
    
    if (parts.length !== 4) {
      throw new Error('Formato dati criptati non valido');
    }
    
    const [ivBase64, saltBase64, tagBase64, encryptedBase64] = parts;
    
    const iv = Buffer.from(ivBase64, 'base64');
    const salt = Buffer.from(saltBase64, 'base64');
    const tag = Buffer.from(tagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');
    
    const derivedKey = crypto.scryptSync(key, salt, KEY_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Errore decriptazione credenziale:', error);
    throw new Error('Errore durante la decriptazione della credenziale');
  }
}

// ============================================
// TIPI
// ============================================

export interface AutomationSettings {
  two_factor_method: 'email' | 'manual';
  email_2fa?: string;
  imap_server?: string;
  imap_port?: number;
  imap_username?: string;
  imap_password?: string;
  manual_otp_callback?: (() => Promise<string>) | null;
  spedisci_online_username: string;
  spedisci_online_password: string;
  auto_refresh_interval_hours?: number;
  enabled: boolean;
}

export interface SessionData {
  session_cookie: string;
  csrf_token?: string;
  client_id_internal?: string;
  vector_contract_id?: string;
  expires_at?: string;
  extracted_at: string;
}

export interface ExtractionResult {
  success: boolean;
  session_data?: SessionData;
  contracts?: Record<string, string>;
  error?: string;
  message?: string;
}

export interface ShipmentData {
  tracking_number: string;
  status: string;
  recipient_name: string;
  recipient_city?: string;
  recipient_zip?: string;
  price?: number;
  final_price?: number;
  shipped_at?: string;
  delivery_notes?: string;
  updated_at: string;
}

export interface SyncResult {
  success: boolean;
  shipments_synced: number;
  shipments_updated: number;
  shipments_created: number;
  errors: string[];
  error?: string;
  message?: string;
}

// ============================================
// CLASSE PRINCIPALE: SOA (SpedisciOnlineAgent)
// ============================================

class SOA {
  private settings: AutomationSettings;
  private baseUrl: string;

  constructor(settings: AutomationSettings, baseUrl: string) {
    this.settings = settings;
    this.baseUrl = baseUrl;
  }

  /**
   * Metodo privato per eseguire login centralizzato
   * Gestisce navigazione, inserimento credenziali, submit e 2FA (max 2 tentativi)
   */
  private async performLogin(page: any, settings: AutomationSettings, baseUrl: string): Promise<void> {
    try {
      // Naviga alla pagina di login
      await page.goto(`${baseUrl}/login`, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Inserisci credenziali
      await page.type('input[name="email"]', settings.spedisci_online_username);
      await page.type('input[name="password"]', settings.spedisci_online_password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Gestione 2FA (max 2 tentativi)
      let needs2FA = await page.evaluate(() => {
        return document.body.textContent?.includes('codice') || 
               document.querySelector('input[name="code"]') !== null;
      });

      if (needs2FA) {
        let code2FA: string | null = null;
        let attempts = 0;
        const maxAttempts = 2;

        while (needs2FA && attempts < maxAttempts) {
          attempts++;
          
          if (settings.two_factor_method === 'email') {
            code2FA = await this.read2FACode();
            if (!code2FA) {
              if (attempts >= maxAttempts) {
                throw new Error('Impossibile leggere codice 2FA da email dopo 2 tentativi');
              }
              // Attendi un po' e riprova
              await page.waitForTimeout(3000);
              continue;
            }
          } else {
            throw new Error('2FA manuale non supportato in questo servizio');
          }

          // Inserisci codice 2FA
          const codeInput = await page.$('input[name="code"], input[name="otp"]');
          if (codeInput) {
            await codeInput.type(code2FA);
          }
          
          const submitButton = await page.$('button[type="submit"]');
          if (submitButton) {
            await submitButton.click();
          }
          
          await page.waitForTimeout(2000);

          // Verifica se ancora serve 2FA
          needs2FA = await page.evaluate(() => {
            return document.body.textContent?.includes('codice') || 
                   document.querySelector('input[name="code"]') !== null;
          });
        }

        if (needs2FA) {
          throw new Error('2FA non completata dopo 2 tentativi');
        }
      }

      // Verifica login riuscito
      const loginSuccess = await page.evaluate(() => {
        return !window.location.href.includes('/login');
      });

      if (!loginSuccess) {
        throw new Error('Login fallito');
      }

    } catch (error: any) {
      // Log errore generico senza esporre password
      console.error('❌ [LOGIN] LOGIN_FAILED:', error.message || 'Errore sconosciuto durante login');
      throw new Error('LOGIN_FAILED');
    }
  }

  async extractSessionData(configId?: string, forceRefresh: boolean = false): Promise<ExtractionResult> {
    if (!puppeteer) {
      return {
        success: false,
        error: 'Puppeteer non installato',
      };
    }

    // Verifica lock e session esistente (se configId fornito)
    let lockId: string | null = null;
    if (configId) {
      const lockCheck = await this.checkLock(configId);
      if (lockCheck.has_lock && !forceRefresh) {
        return {
          success: false,
          error: `Lock attivo fino alle ${lockCheck.expires_at || 'data sconosciuta'}`,
        };
      }

      if (!forceRefresh) {
        const existingSession = await this.getExistingSession(configId);
        if (existingSession && this.isSessionValid(existingSession)) {
          return {
            success: true,
            session_data: existingSession,
            message: 'Session esistente ancora valida',
          };
        }
      }

      try {
        lockId = await this.acquireLock(configId, 'agent', 'Sistema automation');
      } catch (error: any) {
        return {
          success: false,
          error: `Impossibile acquisire lock: ${error.message}`,
        };
      }
    }

    let browser: any = null;

    try {
      console.log('🚀 [AGENT] Avvio estrazione session data...');

      // Apri browser (configurazione ottimizzata per Railway)
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-gpu',
        ],
      });

      const page = await browser.newPage();

      // Login centralizzato
      await this.performLogin(page, this.settings, this.baseUrl);

      // Estrai CSRF token
      await page.goto(`${this.baseUrl}/shippings/create`, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      const csrfToken = await page.evaluate(() => {
        const tokenInput = document.querySelector('input[name="_token"]') as HTMLInputElement;
        return tokenInput?.value || null;
      });

      if (!csrfToken) {
        throw new Error('CSRF token non trovato');
      }

      // Estrai cookies
      const cookies = await page.cookies();
      const sessionCookie = cookies
        .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
        .join('; ');

      if (!sessionCookie) {
        throw new Error('Session cookie non trovato');
      }

      // Estrai contratti
      const contracts = await this.extractContracts(page);

      const sessionData: SessionData = {
        session_cookie: sessionCookie,
        csrf_token: csrfToken,
        extracted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      if (contracts.client_id) {
        sessionData.client_id_internal = contracts.client_id;
      }
      if (contracts.vector_contract_id) {
        sessionData.vector_contract_id = contracts.vector_contract_id;
      }

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
      if (lockId && configId) {
        await this.releaseLock(configId, lockId);
      }
      
      if (browser) {
        await browser.close();
      }
    }
  }

  private async checkLock(configId: string): Promise<{
    has_lock: boolean;
    lock_type: string | null;
    expires_at: string | null;
  }> {
    try {
      const { data, error } = await supabaseAdmin.rpc('check_automation_lock', {
        p_config_id: configId,
      });

      if (error || !data || data.length === 0) {
        return { has_lock: false, lock_type: null, expires_at: null };
      }

      return {
        has_lock: data[0].has_lock || false,
        lock_type: data[0].lock_type,
        expires_at: data[0].expires_at,
      };
    } catch (error) {
      return { has_lock: false, lock_type: null, expires_at: null };
    }
  }

  private async acquireLock(
    configId: string,
    lockType: 'agent' | 'manual' | 'maintenance',
    lockedBy: string = 'system',
    durationMinutes: number = 30
  ): Promise<string> {
    const { data, error } = await supabaseAdmin.rpc('acquire_automation_lock', {
      p_config_id: configId,
      p_lock_type: lockType,
      p_locked_by: lockedBy,
      p_reason: 'Agent automation sync',
      p_duration_minutes: durationMinutes,
    });

    if (error || !data) {
      throw new Error(error?.message || 'Lock già attivo');
    }

    return data;
  }

  private async releaseLock(configId: string, lockId?: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin.rpc('release_automation_lock', {
        p_config_id: configId,
        p_lock_id: lockId || null,
      });

      return data || false;
    } catch (error) {
      return false;
    }
  }

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

  private isSessionValid(session: SessionData): boolean {
    if (!session.expires_at) {
      if (session.extracted_at) {
        const extracted = new Date(session.extracted_at);
        const now = new Date();
        const hoursSinceExtraction = (now.getTime() - extracted.getTime()) / (1000 * 60 * 60);
        return hoursSinceExtraction < 20;
      }
      return false;
    }

    const expires = new Date(session.expires_at);
    const now = new Date();
    return expires > now;
  }

  private async read2FACode(): Promise<string | null> {
    if (!ImapClient) {
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

          imap.search(['UNSEEN', ['FROM', 'noreply@spedisci.online']], (err: any, results: any) => {
            if (err || !results.length) {
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

  private fetchEmail(imap: any, uid: number, resolve: (code: string | null) => void) {
    const fetch = imap.fetch(uid, { bodies: '' });

    fetch.on('message', (msg: any) => {
      msg.on('body', (stream: any) => {
        let buffer = '';
        stream.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
        });
        stream.once('end', () => {
          const codeMatch = buffer.match(/\b\d{6}\b/);
          const code = codeMatch ? codeMatch[0] : null;
          resolve(code);
          imap.end();
        });
      });
    });
  }

  private async extractContracts(page: any): Promise<Record<string, string>> {
    try {
      const contracts: Record<string, string> = {};

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
      return {};
    }
  }

  /**
   * Sincronizza spedizioni da Spedisci.Online
   * Scraping intelligente con retry logic e validazione
   */
  async syncShipmentsFromPortal(configId: string, maxRetries: number = 3): Promise<SyncResult> {
    if (!puppeteer) {
      return {
        success: false,
        shipments_synced: 0,
        shipments_updated: 0,
        shipments_created: 0,
        errors: ['Puppeteer non installato'],
        error: 'Puppeteer non installato',
      };
    }

    let browser: any = null;
    const errors: string[] = [];
    let shipmentsSynced = 0;
    let shipmentsUpdated = 0;
    let shipmentsCreated = 0;

    // Retry logic con exponential backoff
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [SYNC SHIPMENTS] Tentativo ${attempt}/${maxRetries} per config ${configId.substring(0, 8)}...`);

        // Recupera configurazione
        const { data: config, error: configError } = await supabaseAdmin
          .from('courier_configs')
          .select('*')
          .eq('id', configId)
          .single();

        if (configError || !config) {
          throw new Error('Configurazione non trovata');
        }

        if (!config.automation_enabled) {
          return {
            success: false,
            shipments_synced: 0,
            shipments_updated: 0,
            shipments_created: 0,
            errors: ['Automation non abilitata'],
            error: 'Automation non abilitata',
          };
        }

        const rawSettings = config.automation_settings as any;
        if (!rawSettings || !rawSettings.enabled) {
          return {
            success: false,
            shipments_synced: 0,
            shipments_updated: 0,
            shipments_created: 0,
            errors: ['Automation settings non configurate'],
            error: 'Automation settings non configurate',
          };
        }

        const settings: AutomationSettings = { ...rawSettings };
        
        // Decripta password se necessario
        if (config.automation_encrypted) {
          if (settings.spedisci_online_password) {
            settings.spedisci_online_password = decryptCredential(settings.spedisci_online_password);
          }
        }

        // Apri browser
        browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu',
          ],
          timeout: 60000, // 60 secondi timeout
        });

        const page = await browser.newPage();
        
        // Set timeout per operazioni
        page.setDefaultTimeout(30000);
        page.setDefaultNavigationTimeout(30000);

        // Login centralizzato
        console.log('🔐 [SYNC SHIPMENTS] Esecuzione login...');
        await this.performLogin(page, settings, config.base_url);

        // Naviga alla pagina spedizioni
        console.log('📦 [SYNC SHIPMENTS] Navigazione a pagina spedizioni...');
        await page.goto(`${config.base_url}/shippings`, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });

        // Attendi che la tabella sia caricata
        await page.waitForSelector('table, .table, [data-shipments], tbody', { timeout: 10000 }).catch(() => {
          console.warn('⚠️ Tabella spedizioni non trovata, provo selettori alternativi...');
        });

        // Estrai dati spedizioni dalla tabella HTML
        const shipmentsData = await page.evaluate(() => {
          const shipments: ShipmentData[] = [];
          
          // Prova diversi selettori per la tabella
          const table = document.querySelector('table') || 
                       document.querySelector('.table') ||
                       document.querySelector('[data-shipments]') ||
                       document.querySelector('tbody')?.closest('table');

          if (!table) {
            return shipments;
          }

          const rows = table.querySelectorAll('tbody tr, tr:not(thead tr)');
          
          rows.forEach((row, index) => {
            if (index >= 50) return; // Limite 50 spedizioni
            
            try {
              const cellsNodeList = row.querySelectorAll('td');
              if (cellsNodeList.length < 3) return;

              // Converti NodeList in array per usare find()
              const cells = Array.from(cellsNodeList);

              // Estrai tracking number (prima colonna o colonna con link)
              const trackingCell = cells[0] || cells.find((cell: HTMLTableCellElement) => 
                cell.textContent?.match(/[A-Z0-9]{8,}/) || 
                cell.querySelector('a')
              );
              const trackingLink = trackingCell?.querySelector('a');
              const trackingText = trackingLink?.textContent?.trim() || 
                                  trackingCell?.textContent?.trim() || '';
              const trackingNumber = trackingText.match(/[A-Z0-9]{8,}/)?.[0];

              if (!trackingNumber) return;

              // Estrai status (cerca badge, span con classe status, o seconda colonna)
              const statusCell = cells[1] || cells.find((cell: HTMLTableCellElement) => 
                cell.textContent?.match(/in transito|consegnato|giacenza|in lavorazione|errore/i) ||
                cell.querySelector('.badge, .status, [class*="status"]')
              );
              const statusText = statusCell?.textContent?.trim() || 'unknown';
              const status = statusText.toLowerCase()
                .replace(/[^a-z0-9]/g, '_')
                .substring(0, 50);

              // Estrai destinatario (terza colonna o colonna con nome)
              const recipientCell = cells[2] || cells.find((cell: HTMLTableCellElement) => 
                cell.textContent?.match(/[A-Z][a-z]+ [A-Z][a-z]+/) ||
                cell.textContent?.length > 10
              );
              const recipientText = recipientCell?.textContent?.trim() || '';
              const recipientMatch = recipientText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
              const recipientName = recipientMatch?.[0] || recipientText.substring(0, 100);

              // Estrai prezzo (cerca colonna con € o numero decimale)
              const priceCell = cells.find((cell: HTMLTableCellElement) => 
                cell.textContent?.includes('€') || 
                cell.textContent?.match(/\d+[,.]\d{2}/)
              );
              const priceText = priceCell?.textContent?.replace(/[^\d,.]/g, '').replace(',', '.') || '';
              const price = priceText ? parseFloat(priceText) : undefined;

              // Estrai data (cerca formato data)
              const dateCell = cells.find((cell: HTMLTableCellElement) => 
                cell.textContent?.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/)
              );
              const dateText = dateCell?.textContent?.trim() || '';
              
              shipments.push({
                tracking_number: trackingNumber,
                status: status,
                recipient_name: recipientName,
                price: price,
                final_price: price,
                shipped_at: dateText ? new Date(dateText).toISOString() : undefined,
                updated_at: new Date().toISOString(),
              });
            } catch (err) {
              console.warn('Errore parsing riga:', err);
            }
          });

          return shipments;
        });

        console.log(`📊 [SYNC SHIPMENTS] Estratte ${shipmentsData.length} spedizioni`);

        if (shipmentsData.length === 0) {
          return {
            success: true,
            shipments_synced: 0,
            shipments_updated: 0,
            shipments_created: 0,
            errors: ['Nessuna spedizione trovata nella tabella'],
            message: 'Nessuna spedizione trovata',
          };
        }

        // Upsert in Supabase
        for (const shipment of shipmentsData) {
          try {
            // Valida dati
            if (!shipment.tracking_number || shipment.tracking_number.length < 5) {
              errors.push(`Tracking number non valido: ${shipment.tracking_number}`);
              continue;
            }

            // Cerca spedizione esistente
            const { data: existing, error: searchError } = await supabaseAdmin
              .from('shipments')
              .select('id, updated_at')
              .eq('tracking_number', shipment.tracking_number)
              .maybeSingle();

            if (searchError && searchError.code !== 'PGRST116') { // PGRST116 = not found (ok)
              errors.push(`Errore ricerca spedizione ${shipment.tracking_number}: ${searchError.message}`);
              continue;
            }

            const updateData: any = {
              status: shipment.status,
              recipient_name: shipment.recipient_name,
              updated_at: shipment.updated_at,
            };

            if (shipment.recipient_city) updateData.recipient_city = shipment.recipient_city;
            if (shipment.recipient_zip) updateData.recipient_zip = shipment.recipient_zip;
            if (shipment.final_price) updateData.final_price = shipment.final_price;
            if (shipment.shipped_at) updateData.shipped_at = shipment.shipped_at;
            if (shipment.delivery_notes) updateData.notes = shipment.delivery_notes;

            if (existing) {
              // Update esistente
              const { error: updateError } = await supabaseAdmin
                .from('shipments')
                .update(updateData)
                .eq('id', existing.id);

              if (updateError) {
                errors.push(`Errore update spedizione ${shipment.tracking_number}: ${updateError.message}`);
              } else {
                shipmentsUpdated++;
                shipmentsSynced++;
              }
            } else {
              // Insert nuovo
              const { error: insertError } = await supabaseAdmin
                .from('shipments')
                .insert({
                  tracking_number: shipment.tracking_number,
                  ...updateData,
                  created_at: shipment.updated_at,
                });

              if (insertError) {
                errors.push(`Errore insert spedizione ${shipment.tracking_number}: ${insertError.message}`);
              } else {
                shipmentsCreated++;
                shipmentsSynced++;
              }
            }
          } catch (err: any) {
            errors.push(`Errore processamento spedizione: ${err.message}`);
          }
        }

        // Successo!
        await browser.close();
        browser = null;

        return {
          success: true,
          shipments_synced: shipmentsSynced,
          shipments_updated: shipmentsUpdated,
          shipments_created: shipmentsCreated,
          errors: errors.length > 0 ? errors : [],
          message: `Sincronizzate ${shipmentsSynced} spedizioni (${shipmentsCreated} nuove, ${shipmentsUpdated} aggiornate)`,
        };

      } catch (error: any) {
        console.error(`❌ [SYNC SHIPMENTS] Errore tentativo ${attempt}:`, error);
        errors.push(`Tentativo ${attempt}: ${error.message}`);

        if (browser) {
          try {
            await browser.close();
          } catch (e) {
            // Ignora errori chiusura browser
          }
          browser = null;
        }

        // Se non è l'ultimo tentativo, aspetta prima di riprovare (exponential backoff)
        if (attempt < maxRetries) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 secondi
          console.log(`⏳ [SYNC SHIPMENTS] Attesa ${waitTime}ms prima di riprovare...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // Tutti i tentativi falliti
    return {
      success: false,
      shipments_synced: shipmentsSynced,
      shipments_updated: shipmentsUpdated,
      shipments_created: shipmentsCreated,
      errors: errors,
      error: `Tutti i ${maxRetries} tentativi falliti`,
    };
  }
}

// ============================================
// FUNZIONI HELPER ESPORTATE
// ============================================

export async function syncCourierConfig(configId: string, forceRefresh: boolean = false): Promise<ExtractionResult> {
  try {
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

    const settings: AutomationSettings = { ...rawSettings };
    
    // Decripta password se criptate
    if (config.automation_encrypted) {
      if (settings.spedisci_online_password) {
        settings.spedisci_online_password = decryptCredential(settings.spedisci_online_password);
      }
      
      if (settings.imap_password) {
        settings.imap_password = decryptCredential(settings.imap_password);
      }
    }

    const agent = new SOA(settings, config.base_url);
    const result = await agent.extractSessionData(configId, forceRefresh);

    if (result.success && result.session_data) {
      await supabaseAdmin
        .from('courier_configs')
        .update({
          session_data: result.session_data,
          last_automation_sync: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', configId);

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

export async function syncAllEnabledConfigs(): Promise<void> {
  try {
    const { data: configs, error } = await supabaseAdmin
      .from('courier_configs')
      .select('id')
      .eq('automation_enabled', true)
      .eq('is_active', true);

    if (error || !configs || configs.length === 0) {
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

/**
 * Sincronizza spedizioni da Spedisci.Online per una configurazione
 */
export async function syncShipmentsFromPortal(configId: string): Promise<SyncResult> {
  try {
    const { data: config, error } = await supabaseAdmin
      .from('courier_configs')
      .select('*')
      .eq('id', configId)
      .single();

    if (error || !config) {
      return {
        success: false,
        shipments_synced: 0,
        shipments_updated: 0,
        shipments_created: 0,
        errors: ['Configurazione non trovata'],
        error: 'Configurazione non trovata',
      };
    }

    if (!config.automation_enabled) {
      return {
        success: false,
        shipments_synced: 0,
        shipments_updated: 0,
        shipments_created: 0,
        errors: ['Automation non abilitata'],
        error: 'Automation non abilitata',
      };
    }

    const rawSettings = config.automation_settings as any;
    if (!rawSettings || !rawSettings.enabled) {
      return {
        success: false,
        shipments_synced: 0,
        shipments_updated: 0,
        shipments_created: 0,
        errors: ['Automation settings non configurate'],
        error: 'Automation settings non configurate',
      };
    }

    const settings: AutomationSettings = { ...rawSettings };
    
    // Decripta password se necessario
    if (config.automation_encrypted) {
      if (settings.spedisci_online_password) {
        settings.spedisci_online_password = decryptCredential(settings.spedisci_online_password);
      }
    }

    const agent = new SOA(settings, config.base_url);
    return await agent.syncShipmentsFromPortal(configId);
  } catch (error: any) {
    console.error('❌ Errore sync spedizioni:', error);
    return {
      success: false,
      shipments_synced: 0,
      shipments_updated: 0,
      shipments_created: 0,
      errors: [error.message || 'Errore durante sync'],
      error: error.message || 'Errore durante sync',
    };
  }
}

