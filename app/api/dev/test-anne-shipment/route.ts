/**
 * API Route: Test flusso Anne – Creazione spedizione (solo sviluppo)
 *
 * POST con body { message: string, secondMessage?: string }.
 * Chiama supervisorRouter con contesto di test e restituisce il risultato
 * per generare scripts/anne-shipment-test-output.txt.
 *
 * Solo NODE_ENV !== 'production'. In produzione ritorna 403.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supervisorRouter } from '@/lib/agent/orchestrator/supervisor-router';
import { detectShipmentCreationIntent } from '@/lib/agent/intent-detector';
import { runShipmentCreationChain } from '@/lib/agent/workers/shipment-creation';
import type { ActingContext } from '@/lib/safe-auth';

function makeTestActingContext(): ActingContext {
  return {
    actor: {
      id: 'test-actor-id',
      email: 'test@spediresicuro.it',
      name: 'Test Actor',
      role: 'user',
    },
    target: {
      id: 'test-user-anne-shipment',
      email: 'test@spediresicuro.it',
      name: 'Test User',
      role: 'user',
    },
    isImpersonating: false,
  };
}

function buildOutputLine(
  round: number,
  message: string,
  result: Awaited<ReturnType<typeof supervisorRouter>>
): string[] {
  const lines: string[] = [];
  const sep = '='.repeat(60);
  lines.push('');
  lines.push(sep);
  lines.push(`Round ${round} – Messaggio: "${message}"`);
  lines.push(sep);
  lines.push(`Decision: ${result.decision}`);
  lines.push(`Source: ${result.source}`);
  lines.push(`Execution time (ms): ${result.executionTimeMs}`);
  if (result.clarificationRequest) {
    lines.push('');
    lines.push('--- Clarification (messaggio a utente) ---');
    lines.push(result.clarificationRequest);
  }
  if (result.pricingOptions?.length) {
    lines.push('');
    lines.push(`Pricing options: ${result.pricingOptions.length}`);
    result.pricingOptions.forEach((opt: any, i: number) => {
      lines.push(`  [${i}] ${opt.courier} - ${opt.finalPrice} €`);
    });
  }
  const state = result.agentState as any;
  if (state) {
    lines.push('');
    lines.push('--- AgentState (debug) ---');
    if (state.shipment_creation_phase) {
      lines.push(`shipment_creation_phase: ${state.shipment_creation_phase}`);
    }
    if (state.missingFields?.length) {
      lines.push(`missingFields: ${JSON.stringify(state.missingFields)}`);
    }
    if (state.shipmentDraft) {
      lines.push('shipmentDraft:');
      const d = state.shipmentDraft;
      if (d.sender) lines.push(`  sender: ${JSON.stringify(d.sender)}`);
      if (d.recipient) lines.push(`  recipient: ${JSON.stringify(d.recipient)}`);
      if (d.parcel) lines.push(`  parcel: ${JSON.stringify(d.parcel)}`);
      if (d.missingFields?.length) lines.push(`  missingFields: ${d.missingFields.join(', ')}`);
    }
    if (state.booking_result) {
      lines.push('booking_result:');
      lines.push(JSON.stringify(state.booking_result, null, 2));
    }
  }
  if (result.telemetry) {
    lines.push('');
    lines.push('--- Telemetria ---');
    lines.push(JSON.stringify(result.telemetry, null, 2));
  }
  return lines;
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  let body: { message?: string; secondMessage?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON required' }, { status: 400 });
  }

  const message1 = typeof body.message === 'string' ? body.message : 'Voglio fare una spedizione';
  const secondMessage = typeof body.secondMessage === 'string' ? body.secondMessage : undefined;

  const actingContext = makeTestActingContext();
  const traceId = `anne-test-${Date.now()}`;
  const allLines: string[] = [];

  allLines.push('TEST ANNE – FLUSSO CREAZIONE SPEDIZIONE (prompt generico)');
  allLines.push(`Data/ora: ${new Date().toISOString()}`);
  const shipmentIntentDetected = detectShipmentCreationIntent(message1);
  allLines.push(`Messaggio Round 1: "${message1}"`);
  allLines.push(`detectShipmentCreationIntent: ${shipmentIntentDetected}`);
  allLines.push('');

  try {
    if (shipmentIntentDetected) {
      allLines.push('(Uso catena creazione spedizione direttamente)');
      allLines.push('');
      let chainResult: Awaited<ReturnType<typeof runShipmentCreationChain>>;
      try {
        chainResult = await runShipmentCreationChain(
          {
            message: message1,
            existingState: null,
            userId: actingContext.target.id,
            userEmail: actingContext.target.email || 'test@spediresicuro.it',
            traceId,
          },
          console as any
        );
      } catch (chainErr) {
        const msg = chainErr instanceof Error ? chainErr.message : String(chainErr);
        const stack = chainErr instanceof Error ? chainErr.stack : '';
        allLines.push('--- Errore runShipmentCreationChain ---');
        allLines.push(msg);
        if (stack) allLines.push(stack);
        return NextResponse.json(
          { success: false, error: msg, outputForFile: allLines.join('\n') },
          { status: 500 }
        );
      }
      allLines.push('Round 1 – Catena creazione spedizione');
      allLines.push('============================================================');
      allLines.push(`missingFields: ${JSON.stringify(chainResult.missingFields)}`);
      allLines.push(`clarification_request: ${chainResult.clarification_request || '(nessuno)'}`);
      if (chainResult.shipmentDraft) {
        allLines.push('shipmentDraft:');
        const d = chainResult.shipmentDraft;
        if (d.sender) allLines.push(`  sender: ${JSON.stringify(d.sender)}`);
        if (d.recipient) allLines.push(`  recipient: ${JSON.stringify(d.recipient)}`);
        if (d.parcel) allLines.push(`  parcel: ${JSON.stringify(d.parcel)}`);
      }
      if (chainResult.booking_result) {
        allLines.push('booking_result:');
        allLines.push(JSON.stringify(chainResult.booking_result, null, 2));
      }
      allLines.push('');

      if (secondMessage && chainResult.missingFields?.length) {
        allLines.push('Round 2 – Messaggio integrazione');
        allLines.push('============================================================');
        let chainResult2: Awaited<ReturnType<typeof runShipmentCreationChain>> | null = null;
        try {
          chainResult2 = await runShipmentCreationChain(
            {
              message: secondMessage,
              existingState: chainResult.agentState as any,
              userId: actingContext.target.id,
              userEmail: actingContext.target.email || 'test@spediresicuro.it',
              traceId,
            },
            console as any
          );
        } catch (chainErr2) {
          const msg = chainErr2 instanceof Error ? chainErr2.message : String(chainErr2);
          allLines.push(`Errore Round 2: ${msg}`);
        }
        if (chainResult2) {
          allLines.push(`missingFields: ${JSON.stringify(chainResult2.missingFields)}`);
          allLines.push(
            `clarification_request: ${chainResult2.clarification_request || '(nessuno)'}`
          );
          if (chainResult2.booking_result) {
            allLines.push('booking_result:');
            allLines.push(JSON.stringify(chainResult2.booking_result, null, 2));
          }
        }
        allLines.push('');
      }
    } else {
      const result1 = await supervisorRouter({
        message: message1,
        userId: actingContext.target.id,
        userEmail: actingContext.target.email || 'test@spediresicuro.it',
        traceId,
        actingContext,
      });
      allLines.push(...buildOutputLine(1, message1, result1));

      const state1 = result1.agentState as any;
      if (
        secondMessage &&
        result1.decision === 'END' &&
        result1.clarificationRequest &&
        state1?.missingFields?.length
      ) {
        const result2 = await supervisorRouter({
          message: secondMessage,
          userId: actingContext.target.id,
          userEmail: actingContext.target.email || 'test@spediresicuro.it',
          traceId,
          actingContext,
        });
        allLines.push(...buildOutputLine(2, secondMessage, result2));
      }
    }

    allLines.push('');
    allLines.push('='.repeat(60));
    allLines.push('Fine test');

    return NextResponse.json({
      success: true,
      outputForFile: allLines.join('\n'),
      rounds: allLines.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    allLines.push('');
    allLines.push('ERRORE durante il test:');
    allLines.push(msg);
    if (stack) allLines.push(stack);
    return NextResponse.json(
      {
        success: false,
        error: msg,
        outputForFile: allLines.join('\n'),
      },
      { status: 500 }
    );
  }
}
