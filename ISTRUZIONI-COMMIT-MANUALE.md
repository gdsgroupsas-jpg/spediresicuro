# ISTRUZIONI COMMIT E PUSH MANUALE

## Problema
PowerShell/Git non mostra output nei comandi automatici, quindi devi eseguire manualmente.

## File Modificato
- `app/dashboard/listini/page.tsx` - Dialog creazione listino completo implementato

## Verifica Modifiche
Apri PowerShell o CMD nella cartella `d:\spediresicuro-master` ed esegui:

```bash
git status
```

Dovresti vedere `app/dashboard/listini/page.tsx` nella lista dei file modificati.

## Commit e Push

### Opzione 1: Usa lo script batch
Esegui direttamente:
```
COMMIT-PUSH-DIALOG-FIX.bat
```

### Opzione 2: Comandi manuali
```bash
# Aggiungi file modificato
git add app/dashboard/listini/page.tsx

# Commit
git commit -m "Fix: Implementato dialog completo creazione listino prezzi

- Sostituito placeholder con form completo funzionante
- Aggiunti campi: nome, versione, stato, priorita, corriere, globale, date validita, descrizione
- Integrato con createPriceListAction
- Aggiunto caricamento corrieri con fallback
- Validazione form e gestione errori
- Toast notifiche per successo/errore"

# Push
git push origin master
```

## Verifica
Dopo il push, verifica su GitHub:
https://github.com/gdsgroupsas-jpg/spediresicuro

Il commit dovrebbe apparire nella cronologia.

## Nota
Se vedi errori di autenticazione, potrebbe essere necessario:
1. Configurare le credenziali Git
2. Usare un Personal Access Token invece della password
