# 🚀 Guida Setup Supabase - Passo Passo

Questa guida ti accompagna nella configurazione completa di Supabase per il sistema di autocompletamento geografico.

---

## 📋 Prerequisiti

- Account email (per registrazione Supabase)
- 5 minuti di tempo

---

## 🎯 Passo 1: Creare Account Supabase

1. Vai su **https://supabase.com**
2. Clicca **"Start your project"** o **"Sign In"**
3. Registrati con GitHub, Google o email
4. Conferma email se richiesto

**✅ Fatto?** Passa al passo 2.

---

## 🎯 Passo 2: Creare Nuovo Progetto

1. Nel dashboard Supabase, clicca **"New Project"**
2. Compila il form:
   - **Name:** `spediresicuro` (o nome a tua scelta)
   - **Database Password:** Scegli una password forte (⚠️ **SALVALA!**)
   - **Region:** Scegli la più vicina (es. `West Europe` per Italia)
   - **Pricing Plan:** Seleziona **Free** (piano gratuito)
3. Clicca **"Create new project"**
4. ⏳ Attendi 2-3 minuti per il provisioning

**✅ Fatto?** Passa al passo 3.

---

## 🎯 Passo 3: Ottenere Credenziali API

1. Nel dashboard del progetto, vai su **Settings** (icona ingranaggio in basso a sinistra)
2. Clicca su **API** nel menu laterale
3. Troverai queste informazioni:

   ```
   Project URL: https://xxxxxxxxxxxxx.supabase.co
   anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. **Copia questi valori** (li useremo dopo)

**✅ Fatto?** Passa al passo 4.

---

## 🎯 Passo 4: Configurare Variabili Ambiente

1. Nel progetto, apri il file `.env.local` (se non esiste, crealo)
2. Aggiungi queste righe con i valori copiati:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **⚠️ IMPORTANTE:** Sostituisci i valori con quelli del tuo progetto!
4. Salva il file

**✅ Fatto?** Passa al passo 5.

---

## 🎯 Passo 5: Eseguire Schema SQL

### Opzione A: Via Dashboard (Consigliata)

1. Nel dashboard Supabase, vai su **SQL Editor** (menu laterale)
2. Clicca **"New query"**
3. Apri il file `supabase/schema.sql` nel tuo editor
4. **Copia tutto il contenuto** del file
5. **Incolla** nel SQL Editor di Supabase
6. Clicca **"Run"** (o premi `Ctrl+Enter` / `Cmd+Enter`)
7. ✅ Dovresti vedere: **"Success. No rows returned"**

### Opzione B: Via Script Automatico

Esegui lo script di setup:

```bash
npm run setup:supabase
```

Lo script ti guiderà passo-passo.

**✅ Fatto?** Passa al passo 6.

---

## 🎯 Passo 6: Verificare Configurazione

Esegui lo script di verifica:

```bash
npm run verify:supabase
```

Dovresti vedere:

```
✅ Variabili ambiente: Tutte le variabili necessarie sono configurate
✅ Connessione: Connessione a Supabase riuscita
✅ Struttura tabella: Tabella configurata correttamente
⚠️  Dati: Tabella vuota. Esegui: npm run seed:geo
```

**✅ Tutto OK?** Passa al passo 7.

**❌ Errori?** Controlla:
- Variabili ambiente corrette?
- Schema SQL eseguito?
- Progetto Supabase attivo?

---

## 🎯 Passo 7: Popolare Database

Ora popoliamo il database con i comuni italiani:

```bash
npm run seed:geo
```

**Cosa fa:**
- Scarica ~8000 comuni da GitHub
- Li inserisce nel database
- Mostra progresso in tempo reale

**Tempo stimato:** 1-2 minuti

**Output atteso:**
```
🚀 Avvio seeding geo-locations...
📥 Download dati comuni da GitHub...
✅ Scaricati 8000+ comuni
📦 Inserimento in batch...
✅ Batch 1/9 completato: 1000/8000 comuni (12.5%)
...
🎉 Seeding completato con successo!
```

**✅ Fatto?** Passa al passo 8.

---

## 🎯 Passo 8: Verifica Finale

Esegui di nuovo la verifica:

```bash
npm run verify:supabase
```

Ora dovresti vedere:

```
✅ Dati: 8000+ comuni presenti nel database
🎉 Configurazione completa e funzionante!
```

**✅ Perfetto!** Passa al passo 9.

---

## 🎯 Passo 9: Testare l'Applicazione

1. Avvia il server di sviluppo:

   ```bash
   npm run dev
   ```

2. Apri il browser: **http://localhost:3000/dashboard/spedizioni/nuova**

3. Nel form, prova a digitare nel campo "Città, Provincia, CAP":
   - `Roma` → Dovresti vedere "Roma (RM)"
   - `20121` → Dovresti vedere comuni con quel CAP
   - `MI` → Dovresti vedere comuni della provincia di Milano

4. Seleziona un risultato e verifica che i campi si popolino automaticamente!

**✅ Funziona?** 🎉 **Setup completato!**

---

## 🐛 Troubleshooting

### Errore: "Tabella geo_locations non trovata"

**Soluzione:**
1. Vai su SQL Editor in Supabase
2. Esegui manualmente lo schema SQL
3. Verifica che non ci siano errori

### Errore: "Variabili ambiente mancanti"

**Soluzione:**
1. Verifica che `.env.local` esista
2. Controlla che i valori siano corretti (no spazi, no virgolette)
3. Riavvia il server (`npm run dev`)

### Errore: "Errore connessione Supabase"

**Soluzione:**
1. Verifica che il progetto Supabase sia attivo
2. Controlla che URL e chiavi siano corrette
3. Prova a rigenerare le chiavi in Settings → API

### Nessun risultato nella ricerca

**Soluzione:**
1. Verifica che il database sia popolato: `npm run verify:supabase`
2. Se vuoto, esegui: `npm run seed:geo`
3. Controlla la console del browser per errori

### Errore durante seeding

**Soluzione:**
1. Verifica che `SUPABASE_SERVICE_ROLE_KEY` sia configurata
2. Controlla che il progetto Supabase sia attivo
3. Prova a eseguire lo script di nuovo

---

## 📚 Comandi Utili

```bash
# Setup iniziale Supabase
npm run setup:supabase

# Verifica configurazione
npm run verify:supabase

# Popola database comuni
npm run seed:geo

# Avvia applicazione
npm run dev
```

---

## ✅ Checklist Finale

- [ ] Account Supabase creato
- [ ] Progetto Supabase creato
- [ ] Credenziali API copiate
- [ ] Variabili ambiente configurate in `.env.local`
- [ ] Schema SQL eseguito
- [ ] Database popolato con comuni
- [ ] Verifica completata con successo
- [ ] Test applicazione funzionante

---

## 🎉 Fatto!

Il sistema di autocompletamento geografico è ora completamente configurato e pronto all'uso!

**Prossimi passi:**
- Usa `AsyncLocationCombobox` in altri form
- Personalizza lo stile se necessario
- Aggiungi altre funzionalità

**Domande?** Consulta `docs/GEO_AUTOCOMPLETE_SETUP.md` per dettagli tecnici.








