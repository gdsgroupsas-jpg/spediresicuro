#!/bin/bash
# Script di scan sicurezza pre-push
# Esegui: bash SCAN_SICUREZZA.sh

echo "🔒 SCAN SICUREZZA PRE-PUSH"
echo "=========================="
echo ""

# 1. Verifica file .env tracciati
echo "1️⃣ Verifica file .env tracciati da Git..."
ENV_FILES=$(git ls-files | grep -E "\.env|\.local")
if [ -z "$ENV_FILES" ]; then
    echo "   ✅ Nessun file .env tracciato (OK)"
else
    echo "   ❌ ATTENZIONE: File .env tracciati:"
    echo "$ENV_FILES"
    echo "   ⚠️  RIMUOVI prima di fare push!"
fi
echo ""

# 2. Verifica secrets hardcoded
echo "2️⃣ Verifica secrets hardcoded nel codice..."
SECRETS_FOUND=0

# Cerca API keys Anthropic
if grep -r "sk-ant-api03-[A-Za-z0-9]\{20,\}" --exclude-dir=node_modules --exclude="*.md" --exclude="*.txt" --exclude="SCAN_SICUREZZA.sh" . 2>/dev/null | grep -v "INSERISCI-LA-TUA-KEY" > /dev/null; then
    echo "   ❌ Trovate API keys Anthropic hardcoded!"
    SECRETS_FOUND=1
fi

# Cerca Google OAuth secrets
if grep -r "GOCSPX-[A-Za-z0-9]\{20,\}" --exclude-dir=node_modules --exclude="*.md" --exclude="*.txt" --exclude="SCAN_SICUREZZA.sh" . 2>/dev/null | grep -v "your-google-client-secret" > /dev/null; then
    echo "   ❌ Trovati Google OAuth secrets hardcoded!"
    SECRETS_FOUND=1
fi

# Cerca JWT tokens (Supabase, etc.)
if grep -r "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9]\{50,\}" --exclude-dir=node_modules --exclude="*.md" --exclude="*.txt" --exclude="SCAN_SICUREZZA.sh" . 2>/dev/null | grep -v "placeholder" > /dev/null; then
    echo "   ❌ Trovati JWT tokens hardcoded!"
    SECRETS_FOUND=1
fi

if [ $SECRETS_FOUND -eq 0 ]; then
    echo "   ✅ Nessun secret hardcoded trovato (OK)"
fi
echo ""

# 3. Verifica database.json
echo "3️⃣ Verifica database.json..."
if [ -f "data/database.json" ]; then
    DB_SIZE=$(wc -c < data/database.json)
    if [ $DB_SIZE -gt 100 ]; then
        echo "   ⚠️  database.json contiene dati ($DB_SIZE bytes)"
        echo "   ⚠️  Verifica che sia in .gitignore"
        
        if git check-ignore -q data/database.json; then
            echo "   ✅ database.json è in .gitignore (OK)"
        else
            echo "   ❌ database.json NON è in .gitignore!"
            echo "   ⚠️  Aggiungi 'data/database.json' a .gitignore"
        fi
    else
        echo "   ✅ database.json è vuoto o piccolo (OK)"
    fi
else
    echo "   ✅ database.json non esiste (OK)"
fi
echo ""

# 4. Verifica .gitignore
echo "4️⃣ Verifica .gitignore..."
if grep -q "\.env" .gitignore && grep -q "database\.json" .gitignore; then
    echo "   ✅ .gitignore protegge file sensibili (OK)"
else
    echo "   ⚠️  .gitignore potrebbe non proteggere tutti i file sensibili"
    echo "   Verifica manualmente .gitignore"
fi
echo ""

# 5. Riepilogo
echo "=========================="
echo "📊 RIEPILOGO"
echo "=========================="

if [ -z "$ENV_FILES" ] && [ $SECRETS_FOUND -eq 0 ]; then
    echo "✅ TUTTO OK - Puoi fare push in sicurezza!"
    exit 0
else
    echo "❌ PROBLEMI TROVATI - Risolvi prima di fare push!"
    exit 1
fi

