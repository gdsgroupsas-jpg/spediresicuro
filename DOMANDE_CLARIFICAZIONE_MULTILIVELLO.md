# 🤔 Domande di Chiarificazione - Sistema Multi-Livello Admin

## 📋 CONTESTO

Devo implementare due funzionalità:

### 1. **Sistema Multi-Livello Admin** (Killer Feature a Pagamento)
- Admin A può avere sotto-admin (Admin B)
- Admin B può avere sotto-admin (Admin C)
- Fino a 5 livelli massimo
- esatto hai compreso 

### 2. **OCR per Resi**
- Usare scansione fotocamera, ed anche lettore barcode o qr per desktop per registrare resi tramite OCR

---

## ❓ DOMANDE DI CHIARIFICAZIONE

### **Sistema Multi-Livello Admin**

#### Q1: Eredità Feature
- Se **Admin A** acquista la killer feature "Multi-Livello Admin", i suoi sotto-admin (B, C, ecc.) la ereditano automaticamente?
- O ogni livello deve acquistare la feature separatamente?

**Ipotesi**: ✅ Ereditarietà automatica (se A ha la feature, tutti i suoi sotto-admin possono usarla)

#### Q2: Tipo Pagamento
- Il pagamento è:
  - ✅ **Una tantum** (acquisto definitivo)?
  - ✅ **Mensile** (abbonamento)?
  - ✅ **Annuale** (abbonamento)?

**Ipotesi**: Mensile/Annuale come le altre killer features

#### Q3: Limiti Sotto-Admin
- Ogni admin può creare un numero **illimitato** di sotto-admin?
- O c'è un **limite massimo** per livello?
  - Es: Admin A può creare max 10 Admin B, ogni Admin B può creare max 10 Admin C, ecc.

**Ipotesi**: Illimitato (solo limite di 5 livelli profondità)

#### Q4: Permessi e Accesso
- I sotto-admin vedono **tutte le spedizioni** del loro admin superiore?
- O solo le loro spedizioni + quelle dei loro sotto-admin?

**Ipotesi**: Solo spedizioni loro + sotto-admin (gerarchia)

#### Q5: Gestione Utenti
- Un admin può:
  - ✅ **Solo creare** nuovi sotto-admin?
  - ✅ **Creare e gestire** (modificare, eliminare) i suoi sotto-admin?
  - ✅ **Vedere statistiche** dei suoi sotto-admin?

**Ipotesi**: Creare, gestire, vedere statistiche

---

### **OCR per Resi**

#### Q1: Cosa Estrarre dall'OCR
Cosa deve estrarre l'OCR da una foto di documento di reso?
- ✅ Numero tracking/reso
- ✅ Motivo del reso
- ✅ Destinatario (mittente del reso)
- ✅ Tracking spedizione originale
- ✅ Altro?

**Ipotesi**: Numero reso + tracking originale + dati destinatario

#### Q2: Azione dopo OCR
Dopo aver estratto i dati, cosa deve fare il sistema?
- ✅ **Creare nuova spedizione** di reso collegata all'originale?
- ✅ **Aggiornare stato** spedizione originale a "in reso"?
- ✅ **Entrambe**?

**Ipotesi**: Creare nuova spedizione di reso + aggiornare originale

#### Q3: Documento Scansionato
Che tipo di documento viene scansionato?
- ✅ Lettera di Vettura di reso (LDV reso)
- ✅ Documento corriere con dati reso
- ✅ Screenshot/app con dati reso
- ✅ Altro?

**Ipotesi**: LDV reso o documento corriere

#### Q4: Collegamento Spedizione Originale
- Come si collega il reso alla spedizione originale?
  - ✅ Tramite tracking number originale (cerca nel DB)
  - ✅ Tramite numero reso che contiene riferimento
  - ✅ Inserimento manuale dopo OCR

**Ipotesi**: Cerca tramite tracking number estratto dall'OCR

---

## ✅ IPOTESI DA CONFERMARE

### Multi-Livello Admin
1. ✅ Feature ereditata automaticamente da sotto-admin
2. ✅ Pagamento mensile/annuale (come altre killer features)
3. ✅ Nessun limite numero sotto-admin (solo 5 livelli profondità)
4. ✅ Sotto-admin vedono solo loro spedizioni + sotto-admin
5. ✅ Admin può creare, gestire e vedere statistiche sotto-admin

### OCR Resi
1. ✅ Estrae: numero reso, tracking originale, dati destinatario
2. ✅ Crea nuova spedizione di reso + aggiorna originale
3. ✅ Documento: LDV reso o documento corriere
4. ✅ Collegamento: cerca spedizione originale tramite tracking

---

## 🚀 PROSSIMO PASSO

**Conferma queste ipotesi e procedo con l'implementazione!**

Se qualcosa è diverso, dimmelo e lo correggo.





