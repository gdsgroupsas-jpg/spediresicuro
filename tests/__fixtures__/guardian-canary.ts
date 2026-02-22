/**
 * CANARY FILE — NON CANCELLARE, NON MODIFICARE
 *
 * Questo file contiene violazioni INTENZIONALI del pattern workspaceQuery.
 * Il guardian test DEVE trovarle. Se non le trova, il regex del guardian è rotto.
 *
 * Aggiunto dopo il bug del regex single-line (feb 2026) che mostrava
 * 0 violazioni false quando ce n'erano 137 reali.
 *
 * Se questo file viene cancellato, il test CANARY fallirà.
 */

import { supabaseAdmin } from '@/lib/db/client';

// Violazione 1: pattern single-line (il più semplice)
const _singleLine = supabaseAdmin.from('shipments').select('*');

// Violazione 2: pattern multilinea (il pattern reale del codebase)
const _multiLine = supabaseAdmin.from('price_lists').select('*');

// NOTA: questo file è escluso dallo scan del guardian (è in tests/)
// ma il canary test lo legge direttamente e verifica che il regex lo trovi.
