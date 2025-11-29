# Guida per caricare il progetto su GitHub

## ✅ Repository configurata: spediresicuro
## ✅ Username/Organizzazione GitHub: gdsgroupsas-jpg

Dopo aver creato la repository "spediresicuro" su GitHub, esegui questi comandi:

```bash
# Aggiungi la repository remota
git remote add origin https://github.com/gdsgroupsas-jpg/spediresicuro.git

# Carica il progetto su GitHub (usiamo master come branch)
git push -u origin master
```

## Come scaricare il progetto su un altro PC

### Metodo 1: Clonare la repository (prima volta)

1. Apri il terminale sul nuovo PC
2. Vai nella cartella dove vuoi salvare il progetto
3. Esegui:

```bash
# Clona la repository
git clone https://github.com/gdsgroupsas-jpg/spediresicuro.git

# Entra nella cartella del progetto
cd spediresicuro

# Installa le dipendenze
npm install

# Avvia il server
npm run dev
```

### Metodo 2: Aggiornare un progetto già clonato

Se hai già clonato il progetto e vuoi scaricare le ultime modifiche:

```bash
# Entra nella cartella del progetto
cd spediresicuro

# Scarica le ultime modifiche
git pull
```

## Comandi Git utili per il futuro

```bash
# Vedere lo stato dei file modificati
git status

# Aggiungere tutti i file modificati
git add .

# Creare un commit (salvare le modifiche)
git commit -m "Descrizione delle modifiche"

# Caricare le modifiche su GitHub
git push

# Scaricare le modifiche da GitHub
git pull
```

