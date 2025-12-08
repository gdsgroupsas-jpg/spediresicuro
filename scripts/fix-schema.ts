/**
 * Script per correggere e migliorare lo schema geo_locations
 * Verifica cosa è stato creato e applica correzioni/miglioramenti
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log('🔧 Correzione e Miglioramento Schema geo_locations\n');
  console.log('='.repeat(50));
  console.log('');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Variabili ambiente mancanti!');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Verifica struttura attuale
    console.log('📋 1. Analisi struttura attuale...\n');
    
    const { data: sample, error: sampleError } = await supabase
      .from('geo_locations')
      .select('*')
      .limit(1);

    if (sampleError && !sampleError.message.includes('does not exist')) {
      console.error('❌ Errore:', sampleError.message);
      process.exit(1);
    }

    if (sample && sample.length > 0) {
      const columns = Object.keys(sample[0]);
      console.log('📊 Colonne attuali:');
      columns.forEach((col) => console.log(`   - ${col}`));
      console.log('');
    }

    // 2. Leggi schema target
    console.log('📋 2. Lettura schema target...\n');
    const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');
    console.log('✅ Schema target letto\n');

    // 3. Genera script di correzione
    console.log('📋 3. Generazione script correzione...\n');
    
    const fixes: string[] = [];

    // Verifica e aggiungi colonne mancanti
    const requiredColumns = {
      id: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()',
      name: 'TEXT NOT NULL',
      province: 'TEXT NOT NULL',
      region: 'TEXT',
      caps: 'TEXT[] NOT NULL DEFAULT \'{}\'',
      search_vector: 'tsvector',
      created_at: 'TIMESTAMPTZ DEFAULT NOW()',
      updated_at: 'TIMESTAMPTZ DEFAULT NOW()',
    };

    if (sample && sample.length > 0) {
      const existingColumns = Object.keys(sample[0]);
      
      for (const [colName, colDef] of Object.entries(requiredColumns)) {
        if (!existingColumns.includes(colName)) {
          if (colName === 'search_vector') {
            // search_vector deve essere GENERATED, non semplice colonna
            fixes.push(`ALTER TABLE geo_locations ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
              to_tsvector('italian', 
                COALESCE(name, '') || ' ' || 
                COALESCE(province, '') || ' ' || 
                COALESCE(region, '') || ' ' || 
                array_to_string(caps, ' ')
              )
            ) STORED;`);
          } else {
            fixes.push(`ALTER TABLE geo_locations ADD COLUMN IF NOT EXISTS ${colName} ${colDef};`);
          }
        }
      }
    }

    // 4. Aggiungi indici mancanti
    console.log('📋 4. Verifica indici...\n');
    const requiredIndexes = [
      {
        name: 'idx_geo_locations_search_vector',
        sql: 'CREATE INDEX IF NOT EXISTS idx_geo_locations_search_vector ON geo_locations USING GIN (search_vector);',
      },
      {
        name: 'idx_geo_locations_name',
        sql: 'CREATE INDEX IF NOT EXISTS idx_geo_locations_name ON geo_locations USING BTREE (name);',
      },
      {
        name: 'idx_geo_locations_province',
        sql: 'CREATE INDEX IF NOT EXISTS idx_geo_locations_province ON geo_locations USING BTREE (province);',
      },
      {
        name: 'idx_geo_locations_caps',
        sql: 'CREATE INDEX IF NOT EXISTS idx_geo_locations_caps ON geo_locations USING GIN (caps);',
      },
      {
        name: 'idx_geo_locations_name_trgm',
        sql: 'CREATE INDEX IF NOT EXISTS idx_geo_locations_name_trgm ON geo_locations USING GIN (name gin_trgm_ops);',
      },
    ];

    requiredIndexes.forEach((idx) => {
      fixes.push(idx.sql);
    });

    // 5. Aggiungi estensione pg_trgm
    fixes.unshift('CREATE EXTENSION IF NOT EXISTS pg_trgm;');

    // 6. Aggiungi funzione e trigger per updated_at
    fixes.push(`
CREATE OR REPLACE FUNCTION update_geo_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
    `.trim());

    fixes.push(`
DROP TRIGGER IF EXISTS trigger_update_geo_locations_updated_at ON geo_locations;
CREATE TRIGGER trigger_update_geo_locations_updated_at
  BEFORE UPDATE ON geo_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_geo_locations_updated_at();
    `.trim());

    // 7. Salva script di correzione
    const fixScript = fixes.join('\n\n');
    const fixScriptPath = path.join(process.cwd(), 'supabase', 'fix-schema.sql');
    fs.writeFileSync(fixScriptPath, fixScript, 'utf-8');

    console.log(`✅ Script di correzione generato: ${fixScriptPath}\n`);
    console.log('📝 Correzioni da applicare:\n');
    fixes.forEach((fix, i) => {
      const preview = fix.substring(0, 80).replace(/\n/g, ' ');
      console.log(`   ${i + 1}. ${preview}...`);
    });
    console.log('');

    // 8. Chiedi conferma (per ora solo mostra)
    console.log('='.repeat(50));
    console.log('\n📋 ISTRUZIONI:\n');
    console.log('1. Vai su Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/pxwmposcsvsusjxdjues/sql/new\n');
    console.log('2. Apri il file: supabase/fix-schema.sql\n');
    console.log('3. Copia tutto il contenuto\n');
    console.log('4. Incolla nel SQL Editor e esegui (Ctrl+Enter)\n');
    console.log('5. Oppure dimmi "esegui" e lo faccio io automaticamente\n');

  } catch (error) {
    console.error('\n❌ ERRORE:', error);
    process.exit(1);
  }
}

main();










