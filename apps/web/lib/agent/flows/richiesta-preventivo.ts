/**
 * Flusso Richiesta Preventivo: estrazione peso, CAP, provincia con Ollama; poi motore prezzi.
 * Contesto minimo: messaggio + stato sessione (dati già estratti).
 */

import { chatWithOllama } from '@/lib/ai/ollama';
import { calculateOptimalPrice, type PricingResult } from '@/lib/ai/pricing-engine';
import { DEFAULT_PLATFORM_FEE } from '@/lib/services/pricing/platform-fee';
import { agentCache } from '@/lib/services/cache';
import type { FlowContext, FlowResult } from './types';

export interface PreventivoSessionState {
  weight?: number | null;
  destinationZip?: string | null;
  destinationProvince?: string | null;
}

const EXTRACT_SYSTEM = `Estrai dal messaggio dell'utente i dati per un preventivo di spedizione.
Rispondi SOLO con un JSON valido, nessun altro testo:
{"weight": number|null, "destinationZip": string|null, "destinationProvince": string|null}
- weight: peso in kg (numero, es. 2.5). null se non menzionato.
- destinationZip: CAP destinazione 5 cifre. null se non menzionato.
- destinationProvince: sigla provincia 2 lettere (es. RM, MI). null se non menzionato.
Usa null per ogni campo non presente nel messaggio.`;

function parseExtract(content: string): PreventivoSessionState {
  const cleaned = content
    .replace(/```json?/g, '')
    .replace(/```/g, '')
    .trim();
  try {
    const o = JSON.parse(cleaned);
    return {
      weight: typeof o.weight === 'number' ? o.weight : null,
      destinationZip: typeof o.destinationZip === 'string' ? o.destinationZip.trim() : null,
      destinationProvince:
        typeof o.destinationProvince === 'string'
          ? o.destinationProvince.trim().toUpperCase().slice(0, 2)
          : null,
    };
  } catch {
    return { weight: null, destinationZip: null, destinationProvince: null };
  }
}

function hasEnoughData(s: PreventivoSessionState): boolean {
  return !!(
    s.weight &&
    s.weight > 0 &&
    s.destinationZip &&
    s.destinationZip.length === 5 &&
    s.destinationProvince &&
    s.destinationProvince.length === 2
  );
}

function buildClarification(s: PreventivoSessionState): string {
  const missing: string[] = [];
  if (!s.weight || s.weight <= 0) missing.push('peso in kg');
  if (!s.destinationZip || s.destinationZip.length !== 5)
    missing.push('CAP destinazione (5 cifre)');
  if (!s.destinationProvince || s.destinationProvince.length !== 2)
    missing.push('provincia destinazione (es. RM, MI)');
  return `Per calcolare il preventivo mi servono: ${missing.join(', ')}. Puoi fornirmeli?`;
}

export async function runRichiestaPreventivoFlow(ctx: FlowContext): Promise<FlowResult> {
  const existing = (ctx.sessionState || {}) as PreventivoSessionState;
  const state: PreventivoSessionState = {
    weight: existing.weight ?? null,
    destinationZip: existing.destinationZip ?? null,
    destinationProvince: existing.destinationProvince ?? null,
  };

  const res = await chatWithOllama({
    messages: [
      {
        role: 'user',
        content: `Messaggio utente: "${ctx.message}"\nDati già noti: ${JSON.stringify(state)}`,
      },
    ],
    system: EXTRACT_SYSTEM,
    temperature: 0,
    maxTokens: 256,
  });

  const extracted = parseExtract(res.content || '{}');
  if (extracted.weight != null) state.weight = extracted.weight;
  if (extracted.destinationZip != null) state.destinationZip = extracted.destinationZip;
  if (extracted.destinationProvince != null)
    state.destinationProvince = extracted.destinationProvince;

  if (!hasEnoughData(state)) {
    return {
      message: buildClarification(state),
      clarificationRequest: buildClarification(state),
      sessionState: state as unknown as Record<string, unknown>,
    };
  }

  const cached = agentCache.getPricing({
    weight: state.weight!,
    destinationZip: state.destinationZip!,
    destinationProvince: state.destinationProvince!,
    serviceType: undefined,
    cashOnDelivery: undefined,
    declaredValue: undefined,
  });

  let options: PricingResult[];
  if (cached) {
    options = cached;
  } else {
    options = await calculateOptimalPrice({
      weight: state.weight!,
      destinationZip: state.destinationZip!,
      destinationProvince: state.destinationProvince!,
      serviceType: 'standard',
      cashOnDelivery: undefined,
      declaredValue: undefined,
      insurance: undefined,
    });
    agentCache.setPricing(
      {
        weight: state.weight!,
        destinationZip: state.destinationZip!,
        destinationProvince: state.destinationProvince!,
        serviceType: undefined,
        cashOnDelivery: undefined,
        declaredValue: undefined,
      },
      options
    );
  }

  const withFee: PricingResult[] = options.map((o) => ({
    ...o,
    finalPrice: o.finalPrice + DEFAULT_PLATFORM_FEE,
  }));

  const best = withFee[0];
  const lines = withFee.slice(0, 4).map((o) => `• ${o.courier}: €${o.finalPrice.toFixed(2)}`);
  const message =
    withFee.length > 0
      ? `Preventivo per ${state.weight} kg verso ${state.destinationZip} ${state.destinationProvince}:\n${lines.join('\n')}\n(Include fee piattaforma €${DEFAULT_PLATFORM_FEE.toFixed(2)}.)`
      : 'Non sono riuscita a calcolare preventivi per questa destinazione. Verifica CAP e provincia.';

  return {
    message,
    pricingOptions: withFee,
    sessionState: state as unknown as Record<string, unknown>,
  };
}
