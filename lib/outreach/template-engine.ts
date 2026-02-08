/**
 * Template Engine — Sprint S3
 *
 * Rendering template Handlebars per messaggi outreach.
 * Variabili mancanti → stringa vuota (sicuro, no crash).
 * Sanitizzazione input per prevenire injection.
 */

import Handlebars from 'handlebars';
import type { TemplateVars } from '@/types/outreach';

// ============================================
// RENDERING
// ============================================

/**
 * Compila e renderizza un template Handlebars con le variabili fornite.
 * Variabili non presenti → stringa vuota (safe default).
 *
 * @example
 * renderTemplate('Ciao {{company_name}}, il tuo score e\' {{score}}', { company_name: 'Acme', score: 85 })
 * // => "Ciao Acme, il tuo score e' 85"
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  try {
    // Crea istanza isolata per evitare side-effect globali
    const hbs = Handlebars.create();

    // Helper: variabili mancanti → stringa vuota
    hbs.registerHelper('helperMissing', function () {
      return '';
    });

    const compiled = hbs.compile(template, {
      noEscape: false, // Escape HTML per default (sicurezza)
      strict: false, // Non throware su variabili mancanti
    });

    return compiled(vars);
  } catch (error) {
    console.error('[template-engine] Errore rendering template:', error);
    return template; // Fallback: ritorna template non compilato
  }
}

// ============================================
// VALIDAZIONE
// ============================================

/**
 * Verifica che un template Handlebars sia sintatticamente valido.
 *
 * @returns { valid: true } o { valid: false, error: 'messaggio' }
 */
export function validateTemplate(template: string): { valid: boolean; error?: string } {
  try {
    Handlebars.precompile(template);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// ESTRAZIONE VARIABILI
// ============================================

/**
 * Estrae i nomi delle variabili usate in un template.
 * Utile per validazione e documentazione.
 *
 * @example
 * extractVariables('Ciao {{company_name}}, score: {{score}}')
 * // => ['company_name', 'score']
 */
export function extractVariables(template: string): string[] {
  const regex = /\{\{([^{}#/!>]+?)\}\}/g;
  const vars = new Set<string>();
  let match;
  while ((match = regex.exec(template)) !== null) {
    const varName = match[1].trim();
    if (varName) {
      vars.add(varName);
    }
  }
  return Array.from(vars);
}

/**
 * Costruisce le TemplateVars da un'entita' lead o prospect.
 * Usato dal sequence executor per popolare il contesto template.
 */
export function buildTemplateVars(entity: Record<string, unknown>): TemplateVars {
  return {
    company_name: String(entity.company_name || ''),
    contact_name: entity.contact_name ? String(entity.contact_name) : undefined,
    sector: entity.sector ? String(entity.sector) : undefined,
    status: entity.status ? String(entity.status) : undefined,
    score: typeof entity.lead_score === 'number' ? entity.lead_score : undefined,
  };
}
