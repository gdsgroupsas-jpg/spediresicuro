# 🔍 MIGRATION AUDIT REPORT

**Data**: 2026-01-18 18:57:00
**Branch**: feature/invoice-recharges-billing
**Totale Migration**: 121 file
**Duplicazioni**: 20 numeri duplicati

---

## 🚨 EXECUTIVE SUMMARY

### Status: 🔴 **CRITICAL - Richiede Azione Immediata**

**Problema Identificato**:
- **20 numeri di migration duplicati** su 96 numeri univoci (21% di duplicazione)
- Rischio di **ordine di esecuzione non deterministico** in production
- Possibile **corruzione database** se migration duplicate vengono applicate in ordine errato

**Impatto**:
- 🔴 **Alto**: Database production potrebbe avere applicato migration in ordine casuale
- 🟡 **Medio**: Nuove migration potrebbero essere applicate prima di quelle vecchie
- 🟢 **Basso**: Development environment (facilmente risolvibile con reset)

---

## 📊 DUPLICAZIONI PER CRITICITÀ

### 🔴 CRITICA (Recent - Ultime 2 settimane)

#### **110 - TRIPLA DUPLICAZIONE** (16-18 Gennaio 2026)
**Criticità**: P0 - Potenziale conflitto in production

| File | Righe | Data | Descrizione |
|------|-------|------|-------------|
| `110_add_vat_semantics_to_price_lists.sql` | 173 | 2026-01-16 | VAT semantics (IVA inclusa/esclusa) |
| `110_admin_overview_stats_function.sql` | 84 | 2026-01-18 | Admin overview RPC function |
| `110_invoice_xml_and_recharge_billing.sql` | 353 | 2026-01-18 | Invoice XML + recharge billing |

**Problemi**:
- Schema changes in `110_add_vat_semantics` (colonne `vat_mode`, `vat_included`)
- RPC function in `110_admin_overview_stats_function` (potrebbe fallire se schema non applicato)
- Billing logic in `110_invoice_xml_and_recharge_billing` (dipende da schema esistente)

**Ordine Corretto**:
1. `110_add_vat_semantics_to_price_lists.sql` (schema changes)
2. `110_invoice_xml_and_recharge_billing.sql` (uses schema)
3. `110_admin_overview_stats_function.sql` (stats function)

**Raccomandazione**: Rinumerare a **110, 112, 113** SUBITO

---

#### **111 - DOPPIA DUPLICAZIONE** (16-18 Gennaio 2026)
**Criticità**: P1 - Ordine importante

| File | Righe | Data | Descrizione |
|------|-------|------|-------------|
| `111_migrate_legacy_vat_mode.sql` | 109 | 2026-01-16 | Migra dati legacy vat_mode |
| `111_admin_overview_stats_function_fix.sql` | 84 | 2026-01-18 | Fix admin stats function |

**Problemi**:
- `111_migrate_legacy_vat_mode` DEVE essere applicata DOPO `110_add_vat_semantics`
- `111_admin_overview_stats_function_fix` è una fix, deve essere DOPO `110_admin_overview_stats_function`

**Ordine Corretto**:
1. `111_migrate_legacy_vat_mode.sql` (data migration)
2. `111_admin_overview_stats_function_fix.sql` (fix function)

**Raccomandazione**: Rinumerare a **111, 114**

---

### 🟡 MEDIA (Recente - Ultimo mese)

#### **104 - DOPPIA** (14-16 Gennaio 2026)
| File | Righe | Data |
|------|-------|------|
| `104_security_fixes_views.sql` | 48 | 2026-01-14 |
| `104_get_platform_stats_function.sql` | 217 | 2026-01-16 |

**Raccomandazione**: Rinumerare seconda a **115**

---

#### **090 - DOPPIA** (7 Gennaio 2026)
| File | Righe | Data |
|------|-------|------|
| `090_platform_provider_costs.sql` | 439 | 2026-01-07 |
| `090_populate_reseller_tier.sql` | 91 | 2026-01-07 |

**Ordine Dipendenza**: `090_populate_reseller_tier` DEVE essere DOPO schema creation

**Raccomandazione**: Verificare ordine applicazione, rinumerare seconda a **091** (ma 091 esiste già! Rinominare a **116**)

---

### 🟢 BASSA (Vecchie - Dicembre 2025)

Tutte le altre duplicazioni (002-082) sono del 2025 e probabilmente già applicate in production.

**Raccomandazione**: NON toccare (rischio regressione), solo documentare.

---

## 🔧 PIANO DI REMEDIATION

### **Fase 1: Verifica Database Production** (URGENTE)

```sql
-- Query 1: Controlla quali migration sono state applicate
SELECT version, inserted_at
FROM supabase_migrations.schema_migrations
WHERE version LIKE '110%' OR version LIKE '111%' OR version LIKE '104%'
ORDER BY inserted_at;

-- Query 2: Verifica schema price_lists (da 110_add_vat_semantics)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'price_lists'
AND column_name IN ('vat_mode', 'vat_included');

-- Query 3: Verifica funzione admin stats (da 110_admin_overview_stats_function)
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'get_admin_overview_stats';
```

**Azione**: Eseguire queste query su **production DB** e condividere risultati.

---

### **Fase 2: Rinumerazione Migration** (POST-VERIFICA)

**IMPORTANTE**: NON rinumerare finché non sappiamo cosa è stato applicato in production!

**Se production ha solo migration fino a 109**:
- ✅ Possiamo rinumerare 110-111 senza problemi

**Se production ha già applicato 110-111 duplicate**:
- ❌ NON rinumerare (database ha già quelle versioni nella tabella `schema_migrations`)
- ✅ Creare nuove migration di "consolidamento" che verificano stato e applicano fix se necessario

---

### **Fase 3: Prevenzione Futura**

#### **Soluzione A: Timestamp-Based (Raccomandato)**

```bash
# Usa Supabase CLI per generare migration con timestamp
supabase migration new add_feature_description

# Genera: 20260118185700_add_feature_description.sql
# Vantaggio: MAI collisioni
```

#### **Soluzione B: Numerazione Sequenziale + Lock File**

Creare script di verifica pre-commit:

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Trova ultimo numero migration
LAST_NUM=$(ls supabase/migrations/*.sql | grep -E '^[0-9]+_' | sed 's/.*\///;s/_.*//' | sort -n | tail -1)

# Verifica nuove migration
for file in $(git diff --cached --name-only --diff-filter=A | grep 'supabase/migrations/.*\.sql'); do
  NUM=$(echo $file | sed 's/.*\///;s/_.*//')
  if [ "$NUM" -le "$LAST_NUM" ]; then
    echo "ERROR: Migration $file has number $NUM <= last number $LAST_NUM"
    echo "Expected: $((LAST_NUM + 1)) or higher"
    exit 1
  fi
done
```

#### **Soluzione C: Migration Registry File**

Creare `supabase/migrations/REGISTRY.md`:

```markdown
# Migration Registry

| Number | Filename | Date | Status | Applied to Production |
|--------|----------|------|--------|----------------------|
| 110 | 110_add_vat_semantics_to_price_lists.sql | 2026-01-16 | ✅ | Yes (2026-01-16) |
| 111 | 111_migrate_legacy_vat_mode.sql | 2026-01-16 | ✅ | Yes (2026-01-16) |
| 112 | 112_create_reseller_pricing_policies.sql | 2026-01-17 | 🟡 | Pending |
| 113 | *NEXT* | - | - | - |
```

---

## 📋 CHECKLIST AZIONI IMMEDIATE

### **Prima di Creare Nuove Migration**

- [ ] Eseguire query verifica su production DB (Fase 1)
- [ ] Condividere risultati query
- [ ] Decidere strategia rinumerazione (Fase 2)
- [ ] Scegliere soluzione prevenzione (Fase 3)

### **Prima di Merge PR #51**

- [ ] Verificare che migration 112 non crei conflitti
- [ ] Verificare ordine esecuzione migration 110-111-112
- [ ] Test migration in staging environment
- [ ] Backup production DB prima del deploy

---

## 🎯 RACCOMANDAZIONE FINALE

**OPZIONE CONSIGLIATA**:

1. **Adotta Supabase CLI timestamp-based naming** da SUBITO (previene futuri problemi)
2. **NON rinumerare migration vecchie** (troppo rischio regressione)
3. **Verifica production DB** per confermare stato attuale
4. **Crea migration "consolidamento"** se necessario (applica fix per stato inconsistente)

**Prossima migration dovrebbe essere**:
```bash
supabase migration new create_something
# Genera: 20260118_create_something.sql
```

Oppure, se mantieni numerazione sequenziale:
- **113** (se production ha già 110, 111, 112)
- Verifica prima con: `ls -1 supabase/migrations/*.sql | grep -E '^[0-9]+_' | tail -5`

---

## 📞 AZIONI RICHIESTE

**Domande per Te**:

1. Posso eseguire query su production DB per verificare migration applicate?
2. Preferisci timestamp-based (20260118_xxx.sql) o numerazione sequenziale (113_xxx.sql)?
3. Vuoi che crei script pre-commit per prevenire duplicazioni future?

**Aspetto conferma prima di procedere con qualsiasi modifica alle migration esistenti.**

---

**Auditor**: Claude Sonnet 4.5
**Report Date**: 2026-01-18
**Risk Level**: 🔴 CRITICAL (requires immediate action)
