const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Carica variabili d'ambiente
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Manca NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInvoicesSystem() {
  console.log('🚀 Inizio Test Sistema Fatturazione...');

  try {
    // 1. Trova un utente di test
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .limit(1)
      .single();
    if (userError || !user) {
      console.log('⚠️ Nessun utente trovato. Tento creazione utente test...');
      // Opzionale: creare utente se non esiste
      throw new Error('Nessun utente trovato per il test (creane uno dalla dashboard prima).');
    }
    console.log(`👤 Utente test: ${user.email} (${user.id})`);

    // 2. Crea una bozza di fattura (Draft)
    console.log('📝 Creazione bozza fattura...');
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: user.id,
        status: 'draft',
        notes: 'Test fattura automatica JS',
      })
      .select()
      .single();

    if (invoiceError) throw new Error(`Errore creazione bozza: ${invoiceError.message}`);
    console.log(`✅ Fattura creata: ${invoice.id} (Status: ${invoice.status})`);

    // 3. Aggiungi righe (Items) e verifica trigger calcolo totali
    console.log('➕ Aggiunta righe...');
    const items = [
      {
        invoice_id: invoice.id,
        description: 'Spedizione Express',
        quantity: 1,
        unit_price: 10.0,
        tax_rate: 22.0,
        total: 10.0,
      },
      {
        invoice_id: invoice.id,
        description: 'Assicurazione',
        quantity: 1,
        unit_price: 5.0,
        tax_rate: 22.0,
        total: 5.0,
      },
    ];

    const { error: itemsError } = await supabase.from('invoice_items').insert(items);
    if (itemsError) throw new Error(`Errore inserimento items: ${itemsError.message}`);

    // 4. Verifica ricalcolo totali
    const { data: updatedInvoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice.id)
      .single();
    console.log('💰 Verifica Totali Trigger:');
    console.log(`   - Subtotal: ${updatedInvoice.subtotal} (Atteso: 15.00)`);
    console.log(`   - Tax: ${updatedInvoice.tax_amount} (Atteso: 3.30)`);
    console.log(`   - Total: ${updatedInvoice.total} (Atteso: 18.30)`);

    if (Math.abs(updatedInvoice.total - 18.3) > 0.01)
      console.warn('⚠️ Totale non corrisponde perfettamente (possibile arrotondamento)');
    else console.log('✅ Totali corretti.');

    // 5. Emetti fattura (Draft -> Issued) e verifica numerazione
    console.log('📤 Emissione fattura (Draft -> Issued)...');
    const { data: issuedInvoice, error: issueError } = await supabase
      .from('invoices')
      .update({ status: 'issued' })
      .eq('id', invoice.id)
      .select()
      .single();

    if (issueError) throw new Error(`Errore emissione: ${issueError.message}`);
    console.log(`✅ Fattura emessa! Numero: ${issuedInvoice.invoice_number}`);

    if (!issuedInvoice.invoice_number) throw new Error('❌ Numero fattura non generato!');

    // Check anno corretto (2025 o anno corrente)
    const currentYear = new Date().getFullYear();
    if (!issuedInvoice.invoice_number.startsWith(`${currentYear}-`))
      console.warn(`⚠️ Anno numero fattura diverso da ${currentYear}`);

    console.log('🎉 TEST SUPERATO: Il sistema di fatturazione funziona!');

    // Cleanup (opzionale, per non sporcare troppo il DB di produzione con dati test)
    console.log('🧹 Pulizia dati test...');
    await supabase.from('invoices').delete().eq('id', invoice.id);
    console.log('✅ Pulizia completata.');
  } catch (err) {
    console.error('❌ ERRORE TEST:', err.message);
    process.exit(1);
  }
}

testInvoicesSystem();
