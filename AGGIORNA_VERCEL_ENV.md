# 🔄 Aggiorna Variabili Ambiente su Vercel

## 📋 Variabili da Aggiornare

Le seguenti variabili sono state aggiornate in `.env.local` e devono essere sincronizzate su Vercel:

### 1. ENCRYPTION_KEY
```
2f115d63a33168e643f4a973a0fc125b892332b680394743ddc98a2767ab71f5
```

### 2. AUTOMATION_SERVICE_TOKEN
```
1vwgf1Il7HXUbbigX1ANRTMYM02JVO8O
```

### 3. SUPABASE_SERVICE_ROLE_KEY
```
sb_secret_H0wT6xcg8vgp2z7oAkH8Sw_nJMHo2qp
```

---

## 🚀 Metodo 1: Vercel Dashboard (Consigliato)

### Passo 1: Accedi a Vercel
1. Vai su: https://vercel.com/dashboard
2. Accedi con il tuo account
3. Seleziona il progetto: **spediresicuro**

### Passo 2: Vai su Environment Variables
1. Clicca su **Settings** (⚙️)
2. Clicca su **Environment Variables** nel menu laterale

### Passo 3: Aggiorna le Variabili

Per ogni variabile da aggiornare:

1. **Trova la variabile** nella lista
2. **Clicca sui 3 puntini** (⋮) accanto alla variabile
3. **Clicca "Edit"** o "Remove"
4. Se rimuovi, poi clicca **"Add New"** per aggiungerla di nuovo
5. **Incolla il nuovo valore** (vedi sopra)
6. **Seleziona gli ambienti**: Development, Preview, Production
7. **Clicca "Save"**

Ripeti per tutte e 3 le variabili.

---

## 🖥️ Metodo 2: Vercel CLI (Interattivo)

### Passo 1: Rimuovi variabile esistente
```bash
npx vercel env rm ENCRYPTION_KEY production
npx vercel env rm ENCRYPTION_KEY preview
npx vercel env rm ENCRYPTION_KEY development
```

Ripeti per:
- `AUTOMATION_SERVICE_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`

### Passo 2: Aggiungi nuovo valore
```bash
# Quando richiesto, incolla il valore e premi Enter
echo "2f115d63a33168e643f4a973a0fc125b892332b680394743ddc98a2767ab71f5" | npx vercel env add ENCRYPTION_KEY production
echo "2f115d63a33168e643f4a973a0fc125b892332b680394743ddc98a2767ab71f5" | npx vercel env add ENCRYPTION_KEY preview
echo "2f115d63a33168e643f4a973a0fc125b892332b680394743ddc98a2767ab71f5" | npx vercel env add ENCRYPTION_KEY development
```

Ripeti per le altre variabili con i rispettivi valori.

---

## ✅ Verifica

Dopo l'aggiornamento, verifica che le variabili siano corrette:

```bash
npx vercel env ls
```

Oppure controlla su Vercel Dashboard che i valori siano aggiornati.

---

## 🔄 Dopo l'Aggiornamento

Le modifiche alle variabili ambiente richiedono un **nuovo deploy** per essere attive:

```bash
npm run vercel:deploy
```

Oppure fai un push su master per triggerare il deploy automatico.

---

## 📝 Note

- ⚠️ **NON committare** mai i valori reali delle chiavi
- ✅ Le variabili su Vercel sono **criptate** e sicure
- 🔄 Aggiorna **tutti e 3 gli ambienti**: Development, Preview, Production
- 📋 Usa i valori esatti da `.env.local` (vedi sopra)

---

**Ultimo aggiornamento**: 2025-01-17

