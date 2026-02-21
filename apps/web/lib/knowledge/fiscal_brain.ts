/**
 * ANNE FISCAL BRAIN v2.1
 *
 * Matrice di conoscenza esperta per logistica e fiscalità italiana.
 * Non leggi statiche, ma SCENARI DECISIONALI.
 */

export interface FiscalScenario {
  id: string;
  category: 'VAT' | 'CUSTOMS' | 'STRATEGY' | 'COMPLIANCE';
  trigger_condition: string; // Descrizione logica del trigger
  expert_advice: string;
  actionable_step: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export const FISCAL_BRAIN: FiscalScenario[] = [
  // --- IVA & TRIANGOLAZIONI ---
  {
    id: 'VAT_TRIANGULATION_EU',
    category: 'VAT',
    trigger_condition:
      'Spedizione triangolare UE (Promotore IT -> Cedente UE1 -> Destinatario UE2)',
    expert_advice:
      'Operazione non imponibile IVA Art. 58 DL 331/93 se soddisfatti 3 requisiti: tutti soggetti IVA, trasporto a cura del promotore/primo cedente, destinazione UE2.',
    actionable_step:
      'Verificare iscrizione VIES di tutti i soggetti coinvolti prima della spedizione.',
    risk_level: 'HIGH',
  },
  {
    id: 'VAT_OSS_THRESHOLD',
    category: 'VAT',
    trigger_condition: 'Vendite B2C UE > 10.000€/anno',
    expert_advice:
      'Obbligo registrazione OSS (One Stop Shop) o identificazione IVA in ogni paese UE di destinazione.',
    actionable_step:
      'Iscriversi al regime OSS tramite portale Agenzia Entrate per semplificare versamento IVA estera.',
    risk_level: 'HIGH',
  },

  // --- DOGANE & EXPORT ---
  {
    id: 'CUSTOMS_DAP_VS_DDP',
    category: 'CUSTOMS',
    trigger_condition: 'Export Extra-UE (es. UK, USA, CH)',
    expert_advice:
      'DAP (Delivered At Place): dazi a carico destinatario. Rischio rifiuto pacco e costi ritorno. DDP (Delivered Duty Paid): dazi pagati da mittente. Migliore CX.',
    actionable_step:
      'Per e-commere B2C suggerisco DDP (o DTP) per evitare resi per "sorprese doganali" al cliente.',
    risk_level: 'MEDIUM',
  },
  {
    id: 'CUSTOMS_VOEC_UK_NORWAY',
    category: 'CUSTOMS',
    trigger_condition: 'Export UK/Norvegia < 135 GBP / 3000 NOK',
    expert_advice:
      "Regime VOEC: marketplace/venditore deve raccogliere VAT al checkout e versarla all'ente estero. Niente dogana all'arrivo ma codice VOEC obbligatorio su etichetta.",
    actionable_step:
      'Inserire codice VOEC/EORI UK nel campo "Riferimento Doganale" della spedizione.',
    risk_level: 'CRITICAL',
  },

  // --- REGIMI FISCALI IT ---
  {
    id: 'REGIME_FORFETTARIO_MONITOR',
    category: 'STRATEGY',
    trigger_condition: 'Fatturato annuo > 75.000€ (avvicinamento soglia 85.000€)',
    expert_advice:
      "Attenzione: superamento soglia 85.000€ comporta uscita dal regime forfettario l'anno successivo (o immediata se >100k).",
    actionable_step:
      'Pianificare fatturazione fine anno o valutare passaggio a SRL se margine reale < 78% (coefficiente redditività e-commerce 40% servizi/78% commercio).',
    risk_level: 'HIGH',
  },

  // --- CASH FLOW & STRATEGY ---
  {
    id: 'CASH_FLOW_COD_GAP',
    category: 'STRATEGY',
    trigger_condition: 'Incassi COD (Contrassegno) > 30% del fatturato',
    expert_advice:
      'Alto rischio liquidità. I tempi di rimessa corriere (10-15gg) creano cash gap rispetto ai pagamenti fornitori immediati.',
    actionable_step:
      'Negoziare rimesse COD più veloci (settimanali) o incentivare pagamenti digitali con sconto 2%.',
    risk_level: 'MEDIUM',
  },

  // --- COMPLIANCE BASE ---
  {
    id: 'COMPLIANCE_STANDARD_IT',
    category: 'COMPLIANCE',
    trigger_condition: 'Spedizioni nazionali standard < 3.000€',
    expert_advice:
      'Operazione ordinaria IVA 22%. Nessuna formalità Intrastat o doganale richiesta se mittente e destinatario sono in Italia.',
    actionable_step:
      'Assicurarsi solo della corretta emissione fattura elettronica entro 12 giorni.',
    risk_level: 'LOW',
  },
];

/**
 * Funzione helper per Anne per "consultare" il cervello
 */
export function consultFiscalBrain(contextText: string): string {
  // Simulazione di ricerca semantica (in futuro Vector Search)
  // Per ora keywords matching semplice
  const relevantScenarios = FISCAL_BRAIN.filter((s) => {
    const keywords = s.trigger_condition.toLowerCase().replace(/[()]/g, '').split(' ');
    return keywords.some((k) => contextText.toLowerCase().includes(k) && k.length >= 2);
  });

  if (relevantScenarios.length === 0) return '';

  return `
    MEMORIA ESPERTA RILEVATA:
    ${relevantScenarios
      .map(
        (s) => `
    - ${s.trigger_condition}
      CONSIGLIO: ${s.expert_advice}
      AZIONE: ${s.actionable_step}
      RISCHIO: ${s.risk_level}
    `
      )
      .join('\n')}
    `;
}
