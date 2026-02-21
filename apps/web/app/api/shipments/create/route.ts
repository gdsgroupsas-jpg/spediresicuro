import { supabaseAdmin } from '@/lib/db/client';
import { requireWorkspaceAuth } from '@/lib/workspace-auth';
import { AUDIT_ACTIONS } from '@/lib/security/audit-actions';
import { writeShipmentAuditLog } from '@/lib/security/audit-log';
import { createShipmentSchema } from '@/lib/validations/shipment';
import { createShipmentCore } from '@/lib/shipments/create-shipment-core';
import { getCourierClientReal } from '@/lib/shipments/get-courier-client';
import { convertLegacyPayload } from '@/lib/shipments/convert-legacy-payload';

export async function POST(request: Request) {
  // ============================================
  // AUTH (con supporto impersonation)
  // ============================================
  const context = await requireWorkspaceAuth();

  try {
    const body = await request.json();

    // ============================================
    // LEGACY FORMAT SUPPORT (conversione completa)
    // ============================================
    // Converte payload legacy (mittenteNome, corriere, peso, etc.)
    // in formato standard (sender, recipient, packages, carrier)
    const convertedBody = convertLegacyPayload(body);

    // ============================================
    // VALIDATION (Zod)
    // ============================================
    const validated = createShipmentSchema.parse(convertedBody);

    // ============================================
    // CALL CORE (Single Source of Truth)
    // ============================================
    // Resolve courier config (client + configId for per-provider tracking)
    const courierResult = await getCourierClientReal(supabaseAdmin, validated, {
      userId: context.target.id,
      configId: validated.configId || (body as any).configId,
    });

    const result = await createShipmentCore({
      context,
      validated,
      deps: {
        supabaseAdmin,
        getCourierClient: async () => courierResult.client,
        courierConfigId: courierResult.configId,
      },
    });

    // ============================================
    // AUDIT LOG (solo su successo)
    // ============================================
    if (result.status === 200 && result.json?.shipment) {
      try {
        await writeShipmentAuditLog(
          context,
          AUDIT_ACTIONS.CREATE_SHIPMENT,
          result.json.shipment.id,
          {
            carrier: validated.carrier,
            tracking_number: result.json.shipment.tracking_number,
            cost: result.json.shipment.cost,
            provider: validated.provider,
          }
        );
      } catch (auditError) {
        // Fail-open: non bloccare se audit fallisce
        console.warn('⚠️ [AUDIT] Failed to log shipment creation:', auditError);
      }
    }

    // ============================================
    // RESPONSE
    // ============================================
    return Response.json(result.json, { status: result.status });
  } catch (error: any) {
    console.error('Error:', error);

    // Errore di autenticazione
    if (
      error.message?.includes('UNAUTHORIZED') ||
      error.message?.includes('Authentication required')
    ) {
      return Response.json(
        { error: 'Non autenticato', message: 'Autenticazione richiesta' },
        { status: 401 }
      );
    }

    // Errore di validazione Zod
    if (error.name === 'ZodError') {
      return Response.json({ error: 'Dati non validi', details: error.errors }, { status: 400 });
    }

    // Errore config non trovata (da getCourierClientReal)
    if (error.message?.includes('Configurazione non trovata')) {
      return Response.json(
        { error: 'Errore durante la creazione della spedizione' },
        { status: 400 }
      );
    }

    return Response.json({ error: 'Errore interno' }, { status: 500 });
  }
}
