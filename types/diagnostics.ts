/**
 * Types per Eventi Diagnostici
 * 
 * Interfacce TypeScript per la gestione degli eventi di diagnostica
 * e monitoring del sistema
 */

/**
 * Interfaccia per un evento diagnostico
 * 
 * Rappresenta un evento di diagnostica, errore, warning o performance
 * registrato nel sistema
 */
export interface DiagnosticEvent {
  /** ID univoco dell'evento (UUID) */
  id: string;
  
  /** Tipo di evento */
  type: 'error' | 'warning' | 'info' | 'performance' | 'user_action';
  
  /** Livello di severità */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  
  /** Contesto JSON con dettagli aggiuntivi dell'evento */
  context: any;
  
  /** Data e ora di creazione dell'evento (ISO string) */
  created_at: string;
  
  /** ID di correlazione per tracciare richieste attraverso più eventi (opzionale) */
  correlation_id?: string;
  
  /** Indirizzo IP da cui è stato generato l'evento (opzionale) */
  ip_address?: string;
  
  /** User agent del client (opzionale) */
  user_agent?: string;
  
  /** ID dell'utente associato all'evento (opzionale) */
  user_id?: string;
}
