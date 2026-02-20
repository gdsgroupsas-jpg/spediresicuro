/**
 * Anne fixtures: generic prompts per flow per test di instradamento e azione
 */

export type FlowId =
  | 'richiesta_preventivo'
  | 'crea_spedizione'
  | 'support'
  | 'crm'
  | 'outreach'
  | 'listini'
  | 'mentor'
  | 'debug'
  | 'explain';

export interface FlowTestCase {
  id: FlowId;
  genericPrompt: string;
  description: string;
  expectResponse: boolean;
}

export const FLOW_TEST_CASES: FlowTestCase[] = [
  {
    id: 'richiesta_preventivo',
    genericPrompt: 'Vorrei un preventivo per 2 kg destinazione 00100 Roma',
    description: 'Richiesta preventivo con peso e CAP',
    expectResponse: true,
  },
  {
    id: 'crea_spedizione',
    genericPrompt: 'Voglio fare una spedizione da Milano a Roma',
    description: 'Intento creazione spedizione',
    expectResponse: true,
  },
  {
    id: 'support',
    genericPrompt: 'Dove si trova il mio pacco?',
    description: 'Support tracking',
    expectResponse: true,
  },
  {
    id: 'crm',
    genericPrompt: 'Come va la pipeline commerciale?',
    description: 'CRM pipeline',
    expectResponse: true,
  },
  {
    id: 'outreach',
    genericPrompt: 'Attiva una campagna email per i prospect',
    description: 'Outreach campagne',
    expectResponse: true,
  },
  {
    id: 'listini',
    genericPrompt: 'Mostrami il listino prezzi attivo',
    description: 'Listini',
    expectResponse: true,
  },
  {
    id: 'mentor',
    genericPrompt: 'Spiegami come funziona il wallet nel sistema',
    description: 'Mentor documentazione',
    expectResponse: true,
  },
  {
    id: 'debug',
    genericPrompt: 'Ho un errore 500 sulla creazione spedizione',
    description: 'Debug errore',
    expectResponse: true,
  },
  {
    id: 'explain',
    genericPrompt: 'Come funzionano i margini sulle spedizioni?',
    description: 'Explain business',
    expectResponse: true,
  },
];
