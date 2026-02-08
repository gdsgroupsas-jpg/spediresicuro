/**
 * Test CRM Write Service — Sprint S2
 *
 * Verifica:
 * - updateEntityStatus: transizioni valide/invalide, score, eventi, lost_reason
 * - addEntityNote: timestamp, append, eventi
 * - recordEntityContact: last_contact_at, auto-advance, nota contatto
 * - Errori: entita' inesistente, errore DB
 *
 * Usa mock Supabase per isolare la logica di business.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCK SUPABASE
// ============================================

// Traccia le operazioni per verificare cosa viene chiamato
const mockInsertData: Record<string, unknown>[] = [];
const mockUpdateData: Record<string, unknown>[] = [];

// Stato configurabile per ogni test
let mockSelectResult: { data: Record<string, unknown> | null; error: unknown } = {
  data: null,
  error: null,
};
let mockUpdateResult: { error: unknown } = { error: null };

// Builder pattern che replica il Supabase query builder
const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(() => mockSelectResult),
  update: vi.fn((data: Record<string, unknown>) => {
    mockUpdateData.push(data);
    return {
      eq: vi.fn(() => mockUpdateResult),
    };
  }),
  insert: vi.fn((data: Record<string, unknown>) => {
    mockInsertData.push(data);
    return { error: null };
  }),
};

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn(() => mockQueryBuilder),
  },
}));

// Mock lead scoring — funzione pura, restituisce score prevedibile
vi.mock('@/lib/crm/lead-scoring', () => ({
  calculateLeadScore: vi.fn(() => 65),
}));

// ============================================
// IMPORTS (dopo i mock)
// ============================================

import {
  updateEntityStatus,
  addEntityNote,
  recordEntityContact,
} from '@/lib/crm/crm-write-service';
import { LEAD_VALID_TRANSITIONS } from '@/types/leads';
import { VALID_TRANSITIONS } from '@/types/reseller-prospects';

// ============================================
// FIXTURES
// ============================================

const ACTOR_ID = 'actor-123';
const WORKSPACE_ID = 'ws-456';

function makeLead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead-1',
    company_name: 'Farmacia Rossi',
    status: 'new',
    lead_score: 40,
    email: 'info@farmacia.it',
    phone: '+39 02 1234567',
    sector: 'pharma',
    estimated_monthly_volume: 100,
    email_open_count: 3,
    last_contact_at: null,
    created_at: '2026-01-15T10:00:00Z',
    linked_quote_ids: [],
    notes: '',
    ...overrides,
  };
}

function makeProspect(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prospect-1',
    company_name: 'TechShop Srl',
    workspace_id: WORKSPACE_ID,
    status: 'contacted',
    lead_score: 55,
    email: 'info@techshop.it',
    phone: '+39 06 9876543',
    sector: 'ecommerce',
    estimated_monthly_volume: 200,
    email_open_count: 5,
    last_contact_at: '2026-01-20T14:00:00Z',
    created_at: '2026-01-10T10:00:00Z',
    linked_quote_ids: ['q-1'],
    notes: 'Nota esistente',
    ...overrides,
  };
}

// ============================================
// SETUP
// ============================================

beforeEach(() => {
  vi.clearAllMocks();
  mockInsertData.length = 0;
  mockUpdateData.length = 0;
  mockSelectResult = { data: null, error: null };
  mockUpdateResult = { error: null };
});

// ============================================
// UPDATE ENTITY STATUS
// ============================================

describe('updateEntityStatus', () => {
  it('aggiorna lead new → contacted (admin)', async () => {
    const lead = makeLead({ status: 'new' });
    mockSelectResult = { data: lead, error: null };

    const result = await updateEntityStatus({
      role: 'admin',
      entityId: 'lead-1',
      newStatus: 'contacted',
      actorId: ACTOR_ID,
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe('status_update');
    expect(result.entityName).toBe('Farmacia Rossi');
    expect(result.details).toContain('new');
    expect(result.details).toContain('contacted');
    expect(result.newScore).toBe(65);
  });

  it('aggiorna prospect contacted → quote_sent (user)', async () => {
    const prospect = makeProspect({ status: 'contacted' });
    mockSelectResult = { data: prospect, error: null };

    const result = await updateEntityStatus({
      role: 'user',
      entityId: 'prospect-1',
      newStatus: 'quote_sent',
      actorId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe('status_update');
    expect(result.entityName).toBe('TechShop Srl');
  });

  it('rifiuta transizione invalida lead new → won', async () => {
    const lead = makeLead({ status: 'new' });
    mockSelectResult = { data: lead, error: null };

    const result = await updateEntityStatus({
      role: 'admin',
      entityId: 'lead-1',
      newStatus: 'won',
      actorId: ACTOR_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('non valida');
    expect(result.error).toContain('contacted');
  });

  it('rifiuta transizione invalida prospect new → won', async () => {
    const prospect = makeProspect({ status: 'new' });
    mockSelectResult = { data: prospect, error: null };

    const result = await updateEntityStatus({
      role: 'user',
      entityId: 'prospect-1',
      newStatus: 'won',
      actorId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('non valida');
  });

  it('rifiuta transizione da stato finale won', async () => {
    const lead = makeLead({ status: 'won' });
    mockSelectResult = { data: lead, error: null };

    const result = await updateEntityStatus({
      role: 'admin',
      entityId: 'lead-1',
      newStatus: 'contacted',
      actorId: ACTOR_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('stato finale');
  });

  it('consente riattivazione lost → new', async () => {
    const lead = makeLead({ status: 'lost' });
    mockSelectResult = { data: lead, error: null };

    const result = await updateEntityStatus({
      role: 'admin',
      entityId: 'lead-1',
      newStatus: 'new',
      actorId: ACTOR_ID,
    });

    expect(result.success).toBe(true);
    expect(result.details).toContain('lost');
    expect(result.details).toContain('new');
  });

  it('ritorna errore per entita inesistente', async () => {
    mockSelectResult = { data: null, error: { message: 'Not found' } };

    const result = await updateEntityStatus({
      role: 'admin',
      entityId: 'non-esiste',
      newStatus: 'contacted',
      actorId: ACTOR_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Entita non trovata');
  });

  it('gestisce errore DB su update', async () => {
    const lead = makeLead({ status: 'new' });
    mockSelectResult = { data: lead, error: null };
    mockUpdateResult = { error: { message: 'DB connection failed' } };

    const result = await updateEntityStatus({
      role: 'admin',
      entityId: 'lead-1',
      newStatus: 'contacted',
      actorId: ACTOR_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Errore aggiornamento');
  });

  it('include lost_reason quando status = lost', async () => {
    const lead = makeLead({ status: 'new' });
    mockSelectResult = { data: lead, error: null };

    const result = await updateEntityStatus({
      role: 'admin',
      entityId: 'lead-1',
      newStatus: 'lost',
      actorId: ACTOR_ID,
      lostReason: 'Prezzo troppo alto',
    });

    expect(result.success).toBe(true);
    // Verifica che l'update includa lost_reason
    expect(mockUpdateData.length).toBeGreaterThan(0);
    expect(mockUpdateData[0]).toHaveProperty('lost_reason', 'Prezzo troppo alto');
  });

  it('ricalcola score dopo update', async () => {
    const lead = makeLead({ status: 'new', lead_score: 40 });
    mockSelectResult = { data: lead, error: null };

    const result = await updateEntityStatus({
      role: 'admin',
      entityId: 'lead-1',
      newStatus: 'contacted',
      actorId: ACTOR_ID,
    });

    expect(result.success).toBe(true);
    expect(result.newScore).toBe(65); // mock restituisce sempre 65
    expect(mockUpdateData[0]).toHaveProperty('lead_score', 65);
  });

  it('crea evento timeline su status change', async () => {
    const lead = makeLead({ status: 'new' });
    mockSelectResult = { data: lead, error: null };

    await updateEntityStatus({
      role: 'admin',
      entityId: 'lead-1',
      newStatus: 'contacted',
      actorId: ACTOR_ID,
    });

    // Almeno 1 insert per evento (contacted) + possibile score_changed
    expect(mockInsertData.length).toBeGreaterThanOrEqual(1);
    const contactedEvent = mockInsertData.find((d) => d.event_type === 'contacted');
    expect(contactedEvent).toBeDefined();
    expect(contactedEvent?.actor_id).toBe(ACTOR_ID);
  });

  it('crea evento score_changed se delta >= 10', async () => {
    const lead = makeLead({ status: 'new', lead_score: 40 });
    mockSelectResult = { data: lead, error: null };
    // mock restituisce 65, delta = 25 >= 10

    await updateEntityStatus({
      role: 'admin',
      entityId: 'lead-1',
      newStatus: 'contacted',
      actorId: ACTOR_ID,
    });

    const scoreEvent = mockInsertData.find((d) => d.event_type === 'score_changed');
    expect(scoreEvent).toBeDefined();
    expect((scoreEvent?.event_data as Record<string, unknown>)?.old_score).toBe(40);
    expect((scoreEvent?.event_data as Record<string, unknown>)?.new_score).toBe(65);
  });
});

// ============================================
// ADD ENTITY NOTE
// ============================================

describe('addEntityNote', () => {
  it('aggiunge nota con timestamp a lead vuoto', async () => {
    const lead = makeLead({ notes: '' });
    mockSelectResult = { data: lead, error: null };

    const result = await addEntityNote({
      role: 'admin',
      entityId: 'lead-1',
      note: 'Primo contatto telefonico',
      actorId: ACTOR_ID,
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe('note_added');
    expect(result.details).toContain('Primo contatto telefonico');

    // Verifica formato timestamp nella nota salvata
    expect(mockUpdateData.length).toBe(1);
    const savedNotes = mockUpdateData[0].notes as string;
    expect(savedNotes).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] Primo contatto telefonico$/);
  });

  it('appendi a note esistenti', async () => {
    const lead = makeLead({ notes: '[2026-01-15 10:00] Nota precedente' });
    mockSelectResult = { data: lead, error: null };

    await addEntityNote({
      role: 'admin',
      entityId: 'lead-1',
      note: 'Secondo contatto',
      actorId: ACTOR_ID,
    });

    const savedNotes = mockUpdateData[0].notes as string;
    expect(savedNotes).toContain('[2026-01-15 10:00] Nota precedente');
    expect(savedNotes).toContain('Secondo contatto');
    // Separato da doppio newline
    expect(savedNotes).toContain('\n\n');
  });

  it('crea evento note_added', async () => {
    const lead = makeLead();
    mockSelectResult = { data: lead, error: null };

    await addEntityNote({
      role: 'admin',
      entityId: 'lead-1',
      note: 'Una nota importante per il follow-up',
      actorId: ACTOR_ID,
    });

    const noteEvent = mockInsertData.find((d) => d.event_type === 'note_added');
    expect(noteEvent).toBeDefined();
    expect(noteEvent?.actor_id).toBe(ACTOR_ID);
    expect((noteEvent?.event_data as Record<string, unknown>)?.note_preview).toBe(
      'Una nota importante per il follow-up'
    );
  });

  it('tronca preview nota a 100 caratteri', async () => {
    const lead = makeLead();
    mockSelectResult = { data: lead, error: null };

    const longNote = 'A'.repeat(150);
    await addEntityNote({
      role: 'admin',
      entityId: 'lead-1',
      note: longNote,
      actorId: ACTOR_ID,
    });

    const noteEvent = mockInsertData.find((d) => d.event_type === 'note_added');
    const preview = (noteEvent?.event_data as Record<string, unknown>)?.note_preview as string;
    expect(preview.length).toBe(100);
  });

  it('ritorna errore per entita inesistente', async () => {
    mockSelectResult = { data: null, error: { message: 'Not found' } };

    const result = await addEntityNote({
      role: 'admin',
      entityId: 'non-esiste',
      note: 'Test',
      actorId: ACTOR_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Entita non trovata');
  });

  it('aggiunge nota a prospect con workspace', async () => {
    const prospect = makeProspect();
    mockSelectResult = { data: prospect, error: null };

    const result = await addEntityNote({
      role: 'user',
      entityId: 'prospect-1',
      note: 'Interessati a spedizioni pallet',
      actorId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(result.success).toBe(true);
    expect(result.entityName).toBe('TechShop Srl');
  });
});

// ============================================
// RECORD ENTITY CONTACT
// ============================================

describe('recordEntityContact', () => {
  it('aggiorna last_contact_at', async () => {
    const lead = makeLead({ status: 'contacted' });
    mockSelectResult = { data: lead, error: null };

    const result = await recordEntityContact({
      role: 'admin',
      entityId: 'lead-1',
      actorId: ACTOR_ID,
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe('contact_recorded');
    expect(mockUpdateData[0]).toHaveProperty('last_contact_at');
    // Verifica formato ISO
    const savedDate = mockUpdateData[0].last_contact_at as string;
    expect(savedDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('auto-avanza new → contacted', async () => {
    const lead = makeLead({ status: 'new' });
    mockSelectResult = { data: lead, error: null };

    const result = await recordEntityContact({
      role: 'admin',
      entityId: 'lead-1',
      actorId: ACTOR_ID,
    });

    expect(result.success).toBe(true);
    expect(result.details).toContain('Stato avanzato');
    expect(result.details).toContain('contacted');
    expect(mockUpdateData[0]).toHaveProperty('status', 'contacted');
  });

  it('non cambia stato se gia contacted', async () => {
    const lead = makeLead({ status: 'contacted' });
    mockSelectResult = { data: lead, error: null };

    const result = await recordEntityContact({
      role: 'admin',
      entityId: 'lead-1',
      actorId: ACTOR_ID,
    });

    expect(result.success).toBe(true);
    expect(result.details).toContain('Ultimo contatto: adesso');
    expect(mockUpdateData[0]).not.toHaveProperty('status');
  });

  it('non cambia stato se qualified', async () => {
    const lead = makeLead({ status: 'qualified' });
    mockSelectResult = { data: lead, error: null };

    const result = await recordEntityContact({
      role: 'admin',
      entityId: 'lead-1',
      actorId: ACTOR_ID,
    });

    expect(result.success).toBe(true);
    expect(mockUpdateData[0]).not.toHaveProperty('status');
  });

  it('aggiunge nota contatto se fornita', async () => {
    const lead = makeLead({ status: 'contacted', notes: 'Nota vecchia' });
    mockSelectResult = { data: lead, error: null };

    await recordEntityContact({
      role: 'admin',
      entityId: 'lead-1',
      contactNote: 'Chiamata di follow-up',
      actorId: ACTOR_ID,
    });

    const savedNotes = mockUpdateData[0].notes as string;
    expect(savedNotes).toContain('Nota vecchia');
    expect(savedNotes).toContain('Contatto: Chiamata di follow-up');
  });

  it('crea evento contacted', async () => {
    const lead = makeLead({ status: 'contacted' });
    mockSelectResult = { data: lead, error: null };

    await recordEntityContact({
      role: 'admin',
      entityId: 'lead-1',
      actorId: ACTOR_ID,
    });

    const contactEvent = mockInsertData.find((d) => d.event_type === 'contacted');
    expect(contactEvent).toBeDefined();
    expect(contactEvent?.actor_id).toBe(ACTOR_ID);
  });

  it('crea evento note_added se nota contatto presente', async () => {
    const lead = makeLead({ status: 'contacted' });
    mockSelectResult = { data: lead, error: null };

    await recordEntityContact({
      role: 'admin',
      entityId: 'lead-1',
      contactNote: 'Ha chiesto listino pallet',
      actorId: ACTOR_ID,
    });

    const noteEvent = mockInsertData.find((d) => d.event_type === 'note_added');
    expect(noteEvent).toBeDefined();
  });

  it('non crea evento note_added senza nota contatto', async () => {
    const lead = makeLead({ status: 'contacted' });
    mockSelectResult = { data: lead, error: null };

    await recordEntityContact({
      role: 'admin',
      entityId: 'lead-1',
      actorId: ACTOR_ID,
    });

    const noteEvent = mockInsertData.find((d) => d.event_type === 'note_added');
    expect(noteEvent).toBeUndefined();
  });

  it('ricalcola score dopo contatto', async () => {
    const lead = makeLead({ status: 'new', lead_score: 40 });
    mockSelectResult = { data: lead, error: null };

    const result = await recordEntityContact({
      role: 'admin',
      entityId: 'lead-1',
      actorId: ACTOR_ID,
    });

    expect(result.newScore).toBe(65);
    expect(mockUpdateData[0]).toHaveProperty('lead_score', 65);
  });

  it('ritorna errore per entita inesistente', async () => {
    mockSelectResult = { data: null, error: { message: 'Not found' } };

    const result = await recordEntityContact({
      role: 'user',
      entityId: 'non-esiste',
      actorId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Entita non trovata');
  });

  it('registra contatto prospect con workspace', async () => {
    const prospect = makeProspect({ status: 'new' });
    mockSelectResult = { data: prospect, error: null };

    const result = await recordEntityContact({
      role: 'user',
      entityId: 'prospect-1',
      contactNote: 'Presentazione listino completata',
      actorId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(result.success).toBe(true);
    expect(result.details).toContain('Stato avanzato');
    expect(result.entityName).toBe('TechShop Srl');
  });
});

// ============================================
// VALIDAZIONE TRANSIZIONI (tabella completa)
// ============================================

describe('Validazione transizioni — copertura completa', () => {
  it('tutte le transizioni lead valide sono accettate', async () => {
    for (const [from, validTargets] of Object.entries(LEAD_VALID_TRANSITIONS)) {
      for (const to of validTargets) {
        const lead = makeLead({ status: from });
        mockSelectResult = { data: lead, error: null };
        mockUpdateResult = { error: null };

        const result = await updateEntityStatus({
          role: 'admin',
          entityId: 'lead-1',
          newStatus: to,
          actorId: ACTOR_ID,
        });

        expect(result.success).toBe(true);
      }
    }
  });

  it('tutte le transizioni prospect valide sono accettate', async () => {
    for (const [from, validTargets] of Object.entries(VALID_TRANSITIONS)) {
      for (const to of validTargets) {
        const prospect = makeProspect({ status: from });
        mockSelectResult = { data: prospect, error: null };
        mockUpdateResult = { error: null };

        const result = await updateEntityStatus({
          role: 'user',
          entityId: 'prospect-1',
          newStatus: to,
          actorId: ACTOR_ID,
          workspaceId: WORKSPACE_ID,
        });

        expect(result.success).toBe(true);
      }
    }
  });
});
