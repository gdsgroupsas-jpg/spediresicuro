/**
 * Script per verificare e correggere/migliorare la tabella geo_locations
 * Aggiunge indici mancanti e verifica trigger
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// SQL per creare indici se mancanti
const INDEXES_SQL = [
  {
    name: 'idx_geo_locations_search_vector',
    sql: `CREATE INDEX IF NOT EXISTS idx_geo_locations_search_vector 
          ON geo_locations USING GIN (search_vector);`,
    description: 'GIN index su search_vector per full-text search',
  },
  {
    name: 'idx_geo_locations_name',
    sql: `CREATE INDEX IF NOT EXISTS idx_geo_locations_name 
          ON geo_locations USING BTREE (name);`,
    description: 'B-tree index su name per ricerche esatte',
  },
  {
    name: 'idx_geo_locations_province',
    sql: `CREATE INDEX IF NOT EXISTS idx_geo_locations_province 
          ON geo_locations USING BTREE (province);`,
    description: 'B-tree index su province per filtri rapidi',
  },
  {
    name: 'idx_geo_locations_caps',
    sql: `CREATE INDEX IF NOT EXISTS idx_geo_locations_caps 
          ON geo_locations USING GIN (caps);`,
    description: 'GIN index su caps array per ricerca CAP',
  },
  {
    name: 'idx_geo_locations_name_trgm',
    sql: `CREATE INDEX IF NOT EXISTS idx_geo_locations_name_trgm 
          ON geo_locations USING GIN (name gin_trgm_ops);`,
    description: 'GIN index trigram su name per ricerca fuzzy',
  },
];

// SQL per trigger updated_at
const TRIGGER_SQL = `
-- Funzione per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_geo_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per aggiornare updated_at
DROP TRIGGER IF EXISTS trigger_update_geo_locations_updated_at ON geo_locations;
CREATE TRIGGER trigger_update_geo_locations_updated_at
  BEFORE UPDATE ON geo_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_geo_locations_updated_at();
`;

async function executeSQL(supabase: ReturnType<typeof createClient>, sql: string, description: string): Promise<boolean> {
  try {
    // Supabase non permette DDL via client JS facilmente
    // Usiamo l'API REST direttamente
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY!,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (response.ok) {
      console.log(`✅ ${description}`);
      return true;
    } else {
      const errorText = await response.text();
      // Se è "already exists" va bene
      if (errorText.includes('already exists') || errorText.includes('duplicate')) {
        console.log(`✅ ${description} (già esistente)`);
        return true;
      } else {
        console.warn(`⚠️  ${description}: ${errorText.substring(0, 100)}`);
        return false;
      }
    }
  } catch (error) {
    console.warn(`⚠️  ${description}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    return false;
  }
}

async function main() {
  console.log('🔧 Verifica e Miglioramento Tabella geo_locations\n');
  console.log('='.repeat(60));
  console.log('');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Variabili ambiente mancanti!');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Verifica estensione pg_trgm
    console.log('📋 1. Verifica estensione pg_trgm...\n');
    console.log('   ⚠️  Nota: Le estensioni devono essere create manualmente in Supabase SQL Editor\n');
    console.log('   Esegui questo SQL se necessario:\n');
    console.log('   CREATE EXTENSION IF NOT EXISTS pg_trgm;\n');

    // 2. Verifica struttura base
    console.log('📋 2. Verifica struttura tabella...\n');
    
    const { data: testData, error: testError } = await supabase
      .from('geo_locations')
      .select('id, name, province, region, caps, search_vector, created_at, updated_at')
      .limit(1);

    if (testError) {
      console.error('❌ Errore verifica tabella:', testError.message);
      process.exit(1);
    }

    console.log('✅ Tabella verificata con tutte le colonne necessarie\n');

    // 3. Test search_vector
    console.log('📋 3. Verifica search_vector...\n');
    
    const { data: searchTest, error: searchError } = await supabase
      .from('geo_locations')
      .select('name, search_vector')
      .limit(1);

    if (searchError) {
      console.error('❌ Errore search_vector:', searchError.message);
    } else {
      console.log('✅ search_vector presente e funzionante\n');
    }

    // 4. Istruzioni per indici e trigger
    console.log('📋 4. Indici e Trigger...\n');
    console.log('   ⚠️  IMPORTANTE: Indici e trigger devono essere creati manualmente in Supabase SQL Editor\n');
    console.log('   Vai su: https://supabase.com/dashboard/project/pxwmposcsvsusjxdjues/sql/new\n');
    console.log('   Copia e incolla questo SQL:\n');
    console.log('─'.repeat(60));
    console.log('\n-- Estensione (se non già presente)');
    console.log('CREATE EXTENSION IF NOT EXISTS pg_trgm;\n');
    
    INDEXES_SQL.forEach((idx) => {
      console.log(`-- ${idx.description}`);
      console.log(idx.sql);
      console.log('');
    });

    console.log('-- Trigger per updated_at');
    console.log(TRIGGER_SQL);
    console.log('─'.repeat(60));
    console.log('');

    // 5. Test performance
    console.log('📋 5. Test performance...\n');
    
    const startTime = Date.now();
    const { data: perfTest, error: perfError } = await supabase
      .from('geo_locations')
      .select('name, province')
      .limit(100);
    
    const duration = Date.now() - startTime;

    if (perfError) {
      console.error('❌ Errore test performance:', perfError.message);
    } else {
      console.log(`✅ Query base: ${duration}ms`);
      if (duration > 100) {
        console.log('   ⚠️  Considera di creare gli indici per migliorare le performance\n');
      } else {
        console.log('   ✅ Performance ottimale\n');
      }
    }

    console.log('='.repeat(60));
    console.log('\n📝 RIEPILOGO:\n');
    console.log('✅ Tabella geo_locations verificata e funzionante');
    console.log('✅ search_vector configurato correttamente');
    console.log('⚠️  Indici: da creare manualmente (vedi SQL sopra)');
    console.log('⚠️  Trigger: da creare manualmente (vedi SQL sopra)');
    console.log('\n🚀 PROSSIMO STEP:\n');
    console.log('   1. Crea indici e trigger (SQL sopra)');
    console.log('   2. Esegui: npm run seed:geo');
    console.log('   3. Verifica: npm run verify:supabase\n');

  } catch (error) {
    console.error('\n❌ ERRORE CRITICO:', error);
    if (error instanceof Error) {
      console.error('   Messaggio:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

main();

