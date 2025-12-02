# 🚀 Quick Start - Test Locale

## ⚡ Setup Rapido (3 minuti)

### 1. Verifica Setup
```bash
npm run check:env:simple
npm run type-check
```

### 2. Avvia Server
```bash
npm run dev
```

### 3. Test Configurazioni Corrieri

#### A. Crea Configurazione
1. Vai su: `http://localhost:3000/dashboard/admin/configurations`
2. Clicca "Nuova Configurazione"
3. Compila:
   - Nome: `Test Config`
   - Provider: `Spedisci.Online`
   - API Key: `test-key-123`
   - Base URL: `https://ecommerceitalia.spedisci.online/api/v2`
   - Default: ✅ Spunta
4. Salva

#### B. Test Spedizione
1. Vai su: `http://localhost:3000/dashboard/spedizioni/nuova`
2. Crea una spedizione
3. Scegli corriere
4. Verifica nei log che usi la config DB

---

## ✅ Checklist Veloce

- [ ] Server avviato (`npm run dev`)
- [ ] Login come admin
- [ ] Configurazione creata in `/dashboard/admin/configurations`
- [ ] Spedizione creata con successo
- [ ] Log mostrano uso config DB

---

## 🐛 Problemi Comuni

**"Accesso negato" in configurazioni:**
```sql
UPDATE users SET role = 'admin' WHERE email = 'tuo-email@example.com';
```

**"Configurazione non trovata":**
- Verifica che esista una config con `is_default = true`

**Errori TypeScript:**
```bash
npm run type-check
```

---

## 📚 Documentazione Completa

Vedi `docs/TEST_LOCALE_COURIER_CONFIGS.md` per guida dettagliata.

---

**Pronto per i test! 🎉**

