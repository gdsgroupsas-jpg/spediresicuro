# PROMPT PER AGENT VISUAL STUDIO CODE
## Controllo, Pulizia e Push Homepage Dinamica

```
Ciao! Ho bisogno del tuo aiuto per fare un controllo completo del repository Git, 
risolvere conflitti e fare push della nuova homepage dinamica.

## SITUAZIONE ATTUALE

1. Ho creato una nuova homepage dinamica con componenti in:
   - components/homepage/dynamic/hero-dynamic.tsx
   - components/homepage/dynamic/features-dynamic.tsx
   - components/homepage/dynamic/how-it-works-dynamic.tsx
   - components/homepage/dynamic/annie-showcase.tsx
   - components/homepage/dynamic/stats-dynamic.tsx
   - components/homepage/dynamic/cta-dynamic.tsx
   - components/homepage/dynamic/index.ts
   - app/page.tsx (aggiornato)

2. PROBLEMI ATTUALI:
   - Git pull fallisce perché ci sono file modificati localmente:
     * app/api/ai/agent-chat/route.ts
     * components/dashboard-nav.tsx
     * package.json
   - C'è un file non tracciato che blocca il merge:
     * components/ai/pilot/pilot-modal.tsx

## OBIETTIVO

Fare push della homepage dinamica su GitHub (branch master) senza perdere 
le modifiche locali importanti.

## COMPITI DA FARE

### 1. VERIFICA STATO REPOSITORY
- Controlla lo stato Git: `git status`
- Verifica quali file sono modificati: `git diff --name-only`
- Controlla se ci sono file non tracciati problematici
- Verifica l'ultimo commit locale vs remoto: `git log --oneline -5` e `git log --oneline -5 origin/master`

### 2. SALVA MODIFICHE LOCALI
- Fai stash delle modifiche locali ai file in conflitto:
  `git stash push -m "Salvataggio modifiche locali prima di merge homepage" -- app/api/ai/agent-chat/route.ts components/dashboard-nav.tsx package.json`
- Verifica che lo stash sia andato a buon fine: `git stash list`

### 3. PULIZIA FILE PROBLEMATICI
- Rimuovi o sposta il file non tracciato che blocca:
  `components/ai/pilot/pilot-modal.tsx`
  - Se vuoi tenerlo: spostalo come backup: `pilot-modal.tsx.backup`
  - Se non ti serve: rimuovilo completamente
- Verifica che non ci siano altri file non tracciati che potrebbero causare problemi

### 4. SINCRONIZZAZIONE CON REMOTO
- Fai pull dal remoto: `git pull origin master --no-rebase`
- Se ci sono conflitti, risolvili (ma non dovrebbero esserci dopo lo stash)
- Verifica che il pull sia andato a buon fine

### 5. AGGIUNTA E COMMIT HOMEPAGE
- Aggiungi i file della homepage dinamica:
  `git add components/homepage/dynamic/ app/page.tsx`
- Verifica cosa è stato aggiunto: `git status --short`
- Fai commit con messaggio descrittivo:
  `git commit -m "feat: Homepage dinamica con animazioni Framer Motion - Hero con particelle e typing effect - Features con effetti 3D hover - How It Works interattivo con demo live - Annie AI showcase con chat animata - Stats con counter animati e carousel - CTA finale con gradient animato"`

### 6. PUSH SU GITHUB
- Fai push su master: `git push origin master`
- Verifica che il push sia andato a buon fine
- Controlla l'ultimo commit su GitHub: `git log --oneline -1 origin/master`

### 7. RIPRISTINO MODIFICHE LOCALI (OPZIONALE)
- Se le modifiche locali erano importanti, ripristinale:
  `git stash pop`
- Verifica se ci sono conflitti e risolvili se necessario

### 8. VERIFICA FINALE
- Controlla che tutti i file della homepage siano presenti:
  `git ls-files components/homepage/dynamic/`
- Verifica che app/page.tsx sia aggiornato correttamente
- Controlla che non ci siano file non committati importanti: `git status`

## REGOLE IMPORTANTI

1. NON cancellare file importanti senza chiedere
2. Se ci sono dubbi su cosa fare, chiedi prima di procedere
3. Mantieni sempre un backup delle modifiche locali (stash)
4. Verifica ogni passaggio prima di procedere al successivo
5. Se qualcosa va storto, fermati e dimmi cosa è successo

## OUTPUT RICHIESTO

Per ogni passaggio, dimmi:
- ✅ Se è andato a buon fine
- ❌ Se c'è stato un errore (e quale)
- ⚠️ Se ci sono warning o situazioni da monitorare
- 📋 Un riepilogo finale dello stato del repository

Inizia quando sei pronto!
```
