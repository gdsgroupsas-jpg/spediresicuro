# 🔐 Content Security Policy (CSP) - Documentazione

**Data Creazione:** 2025-12-03  
**Versione:** 1.0  
**Status:** ⚠️ Configurata con `unsafe-eval` per compatibilità librerie

---

## 📋 COSA È LA CSP

La **Content Security Policy (CSP)** è un meccanismo di sicurezza che previene l'esecuzione di codice JavaScript non autorizzato nel browser. Protegge da attacchi XSS (Cross-Site Scripting).

---

## ⚠️ PERCHÉ ABBIAMO `unsafe-eval`

### **Librerie che Richiedono `unsafe-eval`**

1. **jsPDF (2.5.2)**
   - Usa `eval()` internamente per parsing template
   - Necessario per generazione PDF client-side
   - **Alternativa futura:** Usare generazione PDF server-side

2. **Tesseract.js (6.0.1)**
   - Usa `eval()` per caricare worker WebAssembly
   - Necessario per OCR client-side
   - **Alternativa futura:** Usare OCR server-side (Google Vision, Claude)

3. **xlsx (0.18.5)**
   - Usa `eval()` per parsing formule Excel
   - Necessario per export/import Excel
   - **Alternativa futura:** Usare librerie alternative o server-side

### **Rischio di Sicurezza**

`unsafe-eval` permette l'esecuzione di stringhe come JavaScript, il che può essere sfruttato da attaccanti se:

- C'è un XSS vulnerability nel codice
- Input utente non validato viene processato

**Mitigazioni Implementate:**

- ✅ Validazione input con Zod
- ✅ Sanitizzazione dati utente
- ✅ Server Actions per operazioni sensibili
- ✅ RLS (Row Level Security) su database

---

## 🔒 CONFIGURAZIONE ATTUALE

**File:** `next.config.js`

```javascript
"Content-Security-Policy": [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://widget.spediresicuro.it https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https: blob:",
  "connect-src 'self' https://*.supabase.co https://*.vercel.app wss://*.supabase.co https://api.anthropic.com",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests"
].join('; ')
```

---

## 🎯 PIANO DI MIGLIORAMENTO

### **Fase 1: Rimuovere `unsafe-eval` (Futuro)**

1. **jsPDF → Server-Side**
   - Spostare generazione PDF su API route
   - Usare `@react-pdf/renderer` o `pdfkit` server-side
   - **Beneficio:** Rimuove bisogno di `unsafe-eval` per PDF

2. **Tesseract.js → Server-Side**
   - Usare Google Cloud Vision o Claude OCR
   - Oppure Tesseract server-side (Node.js)
   - **Beneficio:** Rimuove bisogno di `unsafe-eval` per OCR

3. **xlsx → Server-Side**
   - Spostare export/import Excel su API route
   - Usare `xlsx` solo server-side
   - **Beneficio:** Rimuove bisogno di `unsafe-eval` per Excel

### **Fase 2: CSP Stricta (Dopo Migrazione)**

Dopo aver rimosso le dipendenze client-side che richiedono `unsafe-eval`:

```javascript
"script-src 'self' 'unsafe-inline' https://widget.spediresicuro.it";
// ❌ Rimosso: 'unsafe-eval'
```

---

## 🛡️ MITIGAZIONI ATTUALE

### **1. Validazione Input**

- ✅ Zod schema validation
- ✅ TypeScript type checking
- ✅ Server-side validation

### **2. Sanitizzazione**

- ✅ React automaticamente escape HTML
- ✅ No `dangerouslySetInnerHTML` con input utente
- ✅ Validazione URL e dati esterni

### **3. Autenticazione**

- ✅ NextAuth.js per session management
- ✅ RLS su database
- ✅ Server Actions protette

### **4. Monitoring**

- ✅ Audit logging
- ✅ Error tracking
- ✅ Security headers

---

## ⚠️ AVVERTENZE

1. **`unsafe-eval` è un rischio di sicurezza**
   - Permette esecuzione codice dinamico
   - Può essere sfruttato se c'è XSS vulnerability
   - **Mitigato da:** Validazione input, sanitizzazione, RLS

2. **Non aggiungere altre librerie che richiedono `unsafe-eval`**
   - Valutare alternative prima di aggiungere dipendenze
   - Preferire librerie che non usano `eval()`

3. **Monitorare vulnerabilità**
   - Aggiornare regolarmente dipendenze
   - Verificare changelog per fix sicurezza

---

## 📚 RIFERIMENTI

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP: XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Next.js: Security Headers](https://nextjs.org/docs/app/api-reference/next-config-js/headers)

---

**Documento generato:** 2025-12-03  
**Status:** ⚠️ Configurazione attuale funzionante ma con `unsafe-eval`  
**Piano:** Migrazione a server-side per rimuovere `unsafe-eval`
