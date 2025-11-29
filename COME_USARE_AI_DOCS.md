# 📖 COME USARE I DOCUMENTI AI - Guida per l'Utente

> **Per: gdsgroupsas-jpg**
> **Scopo: Capire come condividere le direttive AI con i vari agenti**

---

## 📁 FILE CREATI

Ho generato questi file nel repository:

| File | Scopo | Quando usarlo |
|------|-------|---------------|
| `.AI_DIRECTIVE.md` | **Documento MASTER completo** | Carica in tutti gli agenti AI |
| `AI_QUICK_START.md` | **Guida rapida** | Per chi ha fretta (Cursor) |
| `.ai-lock.json` | **Sistema lock** | Gli agenti controllano automaticamente |
| `AGENT_NOTES.md` | **Log comunicazioni** | Gli agenti aggiungono entry |
| `COME_USARE_AI_DOCS.md` | **Questa guida** | Per te (umano) |

---

## 🤖 COME CARICARE IN OGNI AGENTE

### 1️⃣ **Cursor** (IDE)

#### Opzione A: Workspace (Consigliata)
```bash
# I file sono già nel progetto!
# Cursor li vede automaticamente nel file explorer

# Per riferimento rapido:
# 1. Apri Cursor
# 2. File explorer → .AI_DIRECTIVE.md
# 3. Tienilo aperto in un tab laterale
```

#### Opzione B: Cursor AI Chat
```
1. In Cursor, apri chat AI (Ctrl+L)
2. Click sull'icona "Attach"
3. Seleziona: .AI_DIRECTIVE.md
4. Chiedi: "Leggi questo documento e seguilo per le modifiche"
```

#### Opzione C: Cursor Composer
```
1. Apri Composer (Ctrl+I)
2. Scrivi: "@.AI_DIRECTIVE.md Implementa [feature] seguendo queste direttive"
3. Cursor caricherà il file come contesto
```

---

### 2️⃣ **ChatGPT**

#### Web Interface
```
1. Vai su chat.openai.com
2. Nuova conversazione
3. Click icona 📎 (allega file)
4. Carica: .AI_DIRECTIVE.md
5. Scrivi: "Leggi questo documento. Ti chiederò snippet seguendo queste linee guida."
```

#### ChatGPT Desktop App
```
1. Apri app
2. Nuova chat
3. Drag & drop: .AI_DIRECTIVE.md
4. Stessa istruzione di sopra
```

---

### 3️⃣ **Claude Web** (claude.ai)

```
1. Vai su claude.ai
2. Nuova conversazione
3. Click icona 📎
4. Carica: .AI_DIRECTIVE.md
5. Scrivi: "Leggi tutto questo documento. Lo useremo come riferimento per discutere architettura del progetto SpediSicuro."
```

#### Pro Tip: Progetti Claude
```
1. Claude.ai → "Projects"
2. Crea nuovo progetto: "SpediSicuro"
3. Aggiungi file al progetto:
   - .AI_DIRECTIVE.md
   - package.json
   - tsconfig.json
4. Tutte le chat in quel progetto avranno contesto automatico!
```

---

### 4️⃣ **Gemini** (Google AI)

```
1. Vai su gemini.google.com
2. Nuova conversazione
3. Click icona caricamento file
4. Carica: .AI_DIRECTIVE.md
5. Scrivi: "Analizza questo documento. È la guida per lavorare su progetto SpediSicuro."
```

---

### 5️⃣ **Claude Code** (Questo Agente)

```
✅ GIÀ FATTO!
Io (Claude Code) ho già accesso a tutti i file nel repository.
Non serve fare nulla, leggo automaticamente .AI_DIRECTIVE.md quando serve.
```

---

## 🔄 WORKFLOW CONSIGLIATO

### Scenario: "Voglio implementare nuova feature"

```
┌─────────────────────────────────────────┐
│ STEP 1: Pianificazione                  │
│ Agente: Claude Web (claude.ai)          │
│ Action: Carica .AI_DIRECTIVE.md         │
│ Task: "Come implemento sistema pagamenti│
│        seguendo architettura progetto?" │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ STEP 2: Implementazione Backend         │
│ Agente: Claude Code (questo)            │
│ Action: Automatico (già ha accesso)     │
│ Task: Implementa backend seguendo piano │
│ Output: Branch claude/[feature]-[id]    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ STEP 3: Scarica e Testa                 │
│ Agente: Tu manualmente                  │
│ Action: git fetch && checkout branch    │
│ Task: Test in locale                    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ STEP 4: Frontend UI                     │
│ Agente: Cursor                          │
│ Action: Apri .AI_DIRECTIVE.md in tab    │
│ Task: Implementa UI, segui convenzioni  │
│ Output: Commit su stesso branch         │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ STEP 5: Generazione Test                │
│ Agente: ChatGPT                          │
│ Action: Carica .AI_DIRECTIVE.md         │
│ Task: "Genera test per payment service" │
│ Output: Copy/paste test nel progetto    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ STEP 6: Review e Deploy                 │
│ Agente: Tu                               │
│ Action: PR → Merge → Vercel deploy      │
└─────────────────────────────────────────┘
```

---

## 💡 TIPS PER USARE BENE IL SISTEMA

### Tip 1: Tieni .AI_DIRECTIVE.md sempre aperto in Cursor
```
- Tab pinned a sinistra
- Riferimento veloce mentre lavori
- Cursor lo vede nel contesto
```

### Tip 2: Aggiorna AGENT_NOTES.md regolarmente
```
Dopo ogni sessione di lavoro importante:
1. Apri AGENT_NOTES.md
2. Aggiungi entry con:
   - Cosa hai fatto
   - Cosa manca
   - Note per prossima sessione
3. Commit & push
```

### Tip 3: Usa .ai-lock.json per task lunghi
```
Prima di iniziare task che dura >30 min:
1. Apri .ai-lock.json
2. Aggiungi lock sui file che modificherai
3. Commit & push
4. Altri agenti vedranno che stai lavorando
5. Rimuovi lock quando finito
```

### Tip 4: Prefix commit sempre
```bash
# ✅ BENE
git commit -m "feat(cursor): add payment form"
git commit -m "fix(claude): resolve auth bug"
git commit -m "test(chatgpt): add validation tests"

# ❌ MALE
git commit -m "add form"
git commit -m "fix bug"
```

---

## 🎯 QUICK REFERENCE CARDS

### Per Cursor (stampa e tieni vicino)
```
┌────────────────────────────────────┐
│ CURSOR QUICK CARD                  │
├────────────────────────────────────┤
│ 1. git fetch origin                │
│ 2. cat AGENT_NOTES.md              │
│ 3. cat .ai-lock.json               │
│ 4. Lavora con .AI_DIRECTIVE.md tab │
│ 5. Percorsi relativi SEMPRE        │
│ 6. Commit: feat(cursor): ...       │
└────────────────────────────────────┘
```

### Per ChatGPT/Claude Web (copia in note)
```
┌────────────────────────────────────┐
│ CHATGPT/CLAUDE WEB QUICK CARD      │
├────────────────────────────────────┤
│ 1. Carica .AI_DIRECTIVE.md         │
│ 2. Dì: "Segui queste linee guida"  │
│ 3. Chiedi snippet/architettura     │
│ 4. Copia output nel progetto       │
│ 5. Test prima di commit            │
└────────────────────────────────────┘
```

---

## 🔄 AGGIORNARE I DOCUMENTI

### Quando aggiornare .AI_DIRECTIVE.md?

```
✅ Quando cambi struttura progetto
✅ Quando aggiungi nuove convenzioni
✅ Quando scopri best practice nuova
✅ Dopo merge feature importante

Come:
1. Modifica .AI_DIRECTIVE.md
2. git commit -m "docs: update AI directive [motivo]"
3. git push
4. Ricarica in tutti gli agenti attivi
```

---

## 🆘 TROUBLESHOOTING

### "Cursor non segue le convenzioni"
```
Soluzione:
1. Apri .AI_DIRECTIVE.md in tab Cursor
2. In chat Cursor: "@.AI_DIRECTIVE.md Segui SEMPRE queste regole"
3. Specifica la regola che non segue
```

### "ChatGPT dimentica il contesto"
```
Soluzione:
1. All'inizio di ogni richiesta, ricorda:
   "Ricorda: stiamo lavorando su SpediSicuro, segui .AI_DIRECTIVE.md"
2. Oppure usa progetti Claude (memoria persistente)
```

### "Agenti si sovrascrivono modifiche"
```
Soluzione:
1. Usa .ai-lock.json SEMPRE per task lunghi
2. Controlla AGENT_NOTES.md prima di iniziare
3. Un agente alla volta per area di codice
```

---

## 📊 DASHBOARD STATO PROGETTO

### Come sapere chi sta lavorando su cosa?

```bash
# Metodo 1: Controlla locks
cat .ai-lock.json

# Metodo 2: Controlla note
cat AGENT_NOTES.md

# Metodo 3: Vedi branch remoti
git fetch origin
git branch -r | grep claude  # Branch Claude Code
git branch -r | grep human   # Branch tuoi

# Metodo 4: Ultimo commit per branch
git log --all --oneline --graph -10
```

---

## ✅ CHECKLIST SETUP INIZIALE

```markdown
Fai una volta sola, poi sei a posto:

- [ ] Ho fatto git pull per scaricare i file AI
- [ ] Ho aperto .AI_DIRECTIVE.md e letto tutto
- [ ] Ho letto AI_QUICK_START.md
- [ ] In Cursor: ho pinnato .AI_DIRECTIVE.md in tab
- [ ] In Claude Web: ho creato progetto "SpediSicuro" con .AI_DIRECTIVE.md
- [ ] In ChatGPT: ho una chat dedicata con .AI_DIRECTIVE.md caricato
- [ ] Ho stampato/salvato le Quick Reference Cards
- [ ] Ho capito come funziona .ai-lock.json e AGENT_NOTES.md
```

---

## 🎓 PROSSIMI PASSI

1. **Merge questo branch su master**
   ```bash
   # In locale:
   git checkout master
   git pull origin master
   git merge claude/sync-master-branch-01AQAkxwR5Pd2Ww1CDZdBbL8
   git push origin master
   ```

2. **Tutti gli agenti avranno accesso** ai documenti da master

3. **Inizia a usare il sistema** per la prossima feature

4. **Migliora i documenti** man mano che scopri nuove best practices

---

## 📞 DOMANDE FREQUENTI

**Q: Devo caricare .AI_DIRECTIVE.md ogni volta in ChatGPT?**
A: Solo all'inizio della conversazione. Poi ChatGPT ricorda (fino a reset chat).

**Q: Cursor vede automaticamente i file?**
A: Sì, ma per essere sicuro usa @ reference o tienilo aperto in tab.

**Q: Posso modificare .AI_DIRECTIVE.md?**
A: Sì! Anzi, miglioralo quando trovi nuove best practices.

**Q: Cosa faccio se due agenti vanno in conflitto?**
A: Usa .ai-lock.json per coordinare. Un agente alla volta per area.

**Q: Devo seguire TUTTE le regole?**
A: Le regole d'oro SÌ (percorsi relativi, lock check, commit prefix). Il resto sono linee guida.

---

**Fatto! Ora hai tutto pronto per lavorare in modo coordinato con tutti gli agenti AI! 🚀**

Domande? Controlla `.AI_DIRECTIVE.md` per dettagli completi.
